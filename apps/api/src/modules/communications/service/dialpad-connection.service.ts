import { randomBytes } from 'node:crypto';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { toE164 } from '../../candidates/lib/contact-policy';
import { DialpadClient, DialpadError } from '../dialpad/dialpad.client';
import { decryptSecret, encryptSecret } from '../lib/secret-box';

export const DIALPAD = 'dialpad';

/** What is kept in `integrations.config` for Dialpad. Secrets are stored encrypted (see lib/secret-box.ts). */
export interface DialpadConfig {
  apiKeyEnc?: string;
  fromNumber?: string;
  companyName?: string;
  webhookToken?: string;
  webhookSecretEnc?: string;
  webhookId?: string;
  smsSubscriptionId?: string;
  callSubscriptionId?: string;
  /** Why receiving incoming texts/calls is not set up, when it is not. */
  webhookError?: string;
  lastWebhookAt?: string;
  lastHealth?: { at: string; ok: boolean; checks: HealthCheck[] };
}

export interface HealthCheck {
  key: 'api_key' | 'business_number' | 'webhook';
  ok: boolean;
  message: string;
}

export interface DialpadStatus {
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING_SETUP';
  fromNumber: string | null;
  companyName: string | null;
  connectedAt: string | null;
  receiving: boolean;
  receivingError: string | null;
  lastWebhookAt: string | null;
  lastHealth: DialpadConfig['lastHealth'] | null;
  webhookUrlConfigured: boolean;
}

@Injectable()
export class DialpadConnectionService {
  private readonly logger = new Logger(DialpadConnectionService.name);
  private readonly userCache = new Map<string, { id: string; until: number }>();

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private secretKey(): string {
    return this.config.get<string>('INTEGRATION_ENCRYPTION_KEY') || this.config.getOrThrow<string>('SESSION_SECRET');
  }

  /** Public address Dialpad can reach this API on, for the webhook. */
  webhookUrl(token: string): string | null {
    const base = (this.config.get<string>('PUBLIC_API_URL') ?? this.config.get<string>('API_URL') ?? '').replace(/\/$/, '');
    if (!base || /localhost|127\.0\.0\.1/.test(base)) return null;
    const prefix = this.config.get<string>('API_GLOBAL_PREFIX', 'api/v1');
    return `${base}/${prefix}/webhooks/dialpad/${token}`;
  }

  async load(organisationId: string) {
    const row = await this.db.client.integration.findUnique({ where: { organisationId_provider: { organisationId, provider: DIALPAD } } });
    return { row, config: ((row?.config ?? {}) as DialpadConfig) };
  }

  private async save(organisationId: string, userId: string | null, status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR', config: DialpadConfig, extra: { connected?: boolean } = {}) {
    const data = {
      status,
      config: config as never,
      lastSyncedAt: new Date(),
      ...(extra.connected ? { connectedById: userId, connectedAt: new Date() } : {}),
    };
    await this.db.client.integration.upsert({
      where: { organisationId_provider: { organisationId, provider: DIALPAD } },
      create: { organisationId, provider: DIALPAD, ...data },
      update: data,
    });
  }

  async status(organisationId: string): Promise<DialpadStatus> {
    const { row, config } = await this.load(organisationId);
    const connected = row?.status === 'CONNECTED' && Boolean(config.apiKeyEnc);
    return {
      connected,
      status: row?.status ?? 'PENDING_SETUP',
      fromNumber: config.fromNumber ?? null,
      companyName: config.companyName ?? null,
      connectedAt: row?.connectedAt?.toISOString() ?? null,
      receiving: connected && Boolean(config.smsSubscriptionId || config.callSubscriptionId),
      receivingError: config.webhookError ?? null,
      lastWebhookAt: config.lastWebhookAt ?? null,
      lastHealth: config.lastHealth ?? null,
      webhookUrlConfigured: Boolean(this.webhookUrl('x')),
    };
  }

  /** A ready client and the company number, or a clear "connect Dialpad first" error. */
  async clientFor(organisationId: string): Promise<{ client: DialpadClient; fromNumber: string; config: DialpadConfig }> {
    const { row, config } = await this.load(organisationId);
    if (row?.status !== 'CONNECTED' || !config.apiKeyEnc) {
      throw new AppException('DIALPAD_NOT_CONNECTED', 'Dialpad is not connected. An administrator can connect it in Settings → Integrations.', HttpStatus.CONFLICT);
    }
    if (!config.fromNumber) {
      throw new AppException('DIALPAD_NO_NUMBER', 'No Dialpad business number is set. Choose it in Settings → Integrations.', HttpStatus.CONFLICT);
    }
    return { client: new DialpadClient(decryptSecret(config.apiKeyEnc, this.secretKey())), fromNumber: config.fromNumber, config };
  }

  async webhookSecretFor(token: string): Promise<{ organisationId: string; secret: string; config: DialpadConfig } | null> {
    if (!/^[a-f0-9]{48}$/.test(token)) return null;
    const row = await this.db.client.integration.findFirst({
      where: { provider: DIALPAD, status: 'CONNECTED', config: { path: ['webhookToken'], equals: token } },
    });
    const config = (row?.config ?? {}) as DialpadConfig;
    if (!row || !config.webhookSecretEnc) return null;
    try {
      return { organisationId: row.organisationId, secret: decryptSecret(config.webhookSecretEnc, this.secretKey()), config };
    } catch {
      return null;
    }
  }

  async touchWebhook(organisationId: string) {
    const { row, config } = await this.load(organisationId);
    if (!row) return;
    await this.db.client.integration.update({ where: { id: row.id }, data: { config: { ...config, lastWebhookAt: new Date().toISOString() } as never } });
  }

  /** The Dialpad user that matches a CRM user's e-mail (calls are placed through that person's Dialpad app). Cached for 10 minutes. */
  async dialpadUserId(organisationId: string, client: DialpadClient, email: string): Promise<string> {
    const key = `${organisationId}:${email.toLowerCase()}`;
    const hit = this.userCache.get(key);
    if (hit && hit.until > Date.now()) return hit.id;
    const user = await client.findUserByEmail(email);
    if (!user) {
      throw new AppException('DIALPAD_USER_NOT_FOUND', `No Dialpad user has the e-mail ${email}. Calls are placed through your own Dialpad app, so your CRM e-mail must match your Dialpad e-mail.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const id = String(user.id);
    this.userCache.set(key, { id, until: Date.now() + 10 * 60_000 });
    return id;
  }

  /**
   * Connect (or reconnect) with an API key from the company's Dialpad admin console. The key is checked against
   * Dialpad first, then stored encrypted; the webhook for incoming texts/calls is registered best-effort — a company
   * that cannot receive webhooks can still call and send.
   */
  async connect(organisationId: string, userId: string, input: { apiKey: string; fromNumber?: string }): Promise<DialpadStatus> {
    const apiKey = input.apiKey.trim();
    const client = new DialpadClient(apiKey);

    let company: Awaited<ReturnType<DialpadClient['company']>>;
    try {
      company = await client.company();
    } catch (error) {
      throw this.asException(error, 'Dialpad did not accept this API key.');
    }

    const previous = await this.load(organisationId);
    await this.tearDownWebhook(previous.config, organisationId).catch(() => undefined);

    const fromNumber = input.fromNumber ? toE164(input.fromNumber) : (previous.config.fromNumber ?? null);
    if (input.fromNumber && !fromNumber) {
      throw new AppException('INVALID_NUMBER', 'The business number is not a valid phone number. Use the full number with its country code, e.g. +442071234567.', HttpStatus.BAD_REQUEST);
    }
    let numberWarning: string | undefined;
    if (fromNumber) {
      try {
        const owned = await client.numbers();
        if (!owned.some((n) => n.number === fromNumber)) {
          throw new AppException('NUMBER_NOT_IN_ACCOUNT', `${fromNumber} is not one of this Dialpad account's numbers.`, HttpStatus.UNPROCESSABLE_ENTITY);
        }
      } catch (error) {
        if (error instanceof AppException) throw error;
        // listing numbers needs an admin-level key; a user-level key still works for sending, so do not block on it
        numberWarning = 'The number could not be checked against the account (needs an admin API key).';
      }
    }

    const token = randomBytes(24).toString('hex');
    const secret = randomBytes(32).toString('hex');
    const config: DialpadConfig = {
      apiKeyEnc: encryptSecret(apiKey, this.secretKey()),
      fromNumber: fromNumber ?? undefined,
      companyName: company.name,
      webhookToken: token,
      webhookSecretEnc: encryptSecret(secret, this.secretKey()),
    };
    await this.registerWebhook(client, token, secret, config);
    if (numberWarning) this.logger.warn(`Dialpad ${organisationId}: ${numberWarning}`);

    await this.save(organisationId, userId, 'CONNECTED', config, { connected: true });
    await this.auditLogs.record({ organisationId, userId, action: 'CONNECT_DIALPAD', entityType: 'Integration', entityId: DIALPAD, newValues: { fromNumber, receiving: Boolean(config.smsSubscriptionId), company: company.name } });
    return this.status(organisationId);
  }

  async setBusinessNumber(organisationId: string, userId: string, number: string): Promise<DialpadStatus> {
    const { row, config } = await this.load(organisationId);
    if (!row || row.status !== 'CONNECTED') throw new AppException('DIALPAD_NOT_CONNECTED', 'Connect Dialpad first.', HttpStatus.CONFLICT);
    const e164 = toE164(number);
    if (!e164) throw new AppException('INVALID_NUMBER', 'That is not a valid phone number. Use the full number with its country code.', HttpStatus.BAD_REQUEST);
    await this.save(organisationId, userId, 'CONNECTED', { ...config, fromNumber: e164 });
    await this.auditLogs.record({ organisationId, userId, action: 'SET_DIALPAD_NUMBER', entityType: 'Integration', entityId: DIALPAD, newValues: { fromNumber: e164 } });
    return this.status(organisationId);
  }

  async availableNumbers(organisationId: string): Promise<{ numbers: string[]; note?: string }> {
    const { client } = await this.clientFor(organisationId).catch(async (e) => {
      // numbers can be listed before a business number has been chosen
      const { row, config } = await this.load(organisationId);
      if (row?.status === 'CONNECTED' && config.apiKeyEnc) return { client: new DialpadClient(decryptSecret(config.apiKeyEnc, this.secretKey())) };
      throw e;
    });
    try {
      const all = await client.numbers();
      return { numbers: all.filter((n) => !n.status || n.status !== 'pending').map((n) => n.number) };
    } catch (error) {
      if (error instanceof DialpadError && error.isAuth) return { numbers: [], note: 'This API key cannot list the account numbers (needs an admin key). Type the number instead.' };
      throw this.asException(error, 'Could not list the Dialpad numbers.');
    }
  }

  /** Is everything still working? Updates the stored status so Settings shows the truth, not the last good day. */
  async health(organisationId: string): Promise<DialpadStatus> {
    const { row, config } = await this.load(organisationId);
    if (!row || row.status === 'DISCONNECTED' || !config.apiKeyEnc) return this.status(organisationId);

    const client = new DialpadClient(decryptSecret(config.apiKeyEnc, this.secretKey()));
    const checks: HealthCheck[] = [];
    let status: 'CONNECTED' | 'ERROR' = 'CONNECTED';
    try {
      const company = await client.company();
      config.companyName = company.name ?? config.companyName;
      checks.push({ key: 'api_key', ok: true, message: `Dialpad accepted the API key${company.name ? ` (${company.name})` : ''}.` });
    } catch (error) {
      status = 'ERROR';
      checks.push({ key: 'api_key', ok: false, message: error instanceof DialpadError && error.isAuth ? 'Dialpad rejected the API key — it was revoked or expired. Reconnect with a new key.' : `Could not reach Dialpad: ${(error as Error).message}` });
    }

    if (!config.fromNumber) {
      checks.push({ key: 'business_number', ok: false, message: 'No business number is chosen.' });
    } else if (status === 'CONNECTED') {
      try {
        const owned = await client.numbers();
        const found = owned.some((n) => n.number === config.fromNumber);
        checks.push({ key: 'business_number', ok: found, message: found ? `${config.fromNumber} belongs to this Dialpad account.` : `${config.fromNumber} is no longer a number of this Dialpad account.` });
      } catch {
        checks.push({ key: 'business_number', ok: true, message: `${config.fromNumber} (could not be checked — the key is not an admin key).` });
      }
    }

    const receiving = Boolean(config.smsSubscriptionId || config.callSubscriptionId);
    checks.push({
      key: 'webhook',
      ok: receiving,
      message: receiving
        ? config.lastWebhookAt
          ? `Incoming texts and calls are being received (last event ${config.lastWebhookAt}).`
          : 'Incoming texts and calls are subscribed; none has arrived yet.'
        : (config.webhookError ?? 'Incoming texts and calls are not subscribed. Reconnect to try again.'),
    });

    const next: DialpadConfig = { ...config, lastHealth: { at: new Date().toISOString(), ok: checks.every((c) => c.ok), checks } };
    await this.save(organisationId, null, status, next);
    return this.status(organisationId);
  }

  async disconnect(organisationId: string, userId: string): Promise<DialpadStatus> {
    const { row, config } = await this.load(organisationId);
    if (!row) return this.status(organisationId);
    await this.tearDownWebhook(config, organisationId).catch((e) => this.logger.warn(`Dialpad webhook clean-up: ${(e as Error).message}`));
    // credentials are erased; the chosen number is kept so reconnecting is one step
    await this.save(organisationId, userId, 'DISCONNECTED', { fromNumber: config.fromNumber, companyName: config.companyName });
    for (const key of [...this.userCache.keys()]) if (key.startsWith(`${organisationId}:`)) this.userCache.delete(key);
    await this.auditLogs.record({ organisationId, userId, action: 'DISCONNECT_DIALPAD', entityType: 'Integration', entityId: DIALPAD });
    return this.status(organisationId);
  }

  private async registerWebhook(client: DialpadClient, token: string, secret: string, config: DialpadConfig) {
    const url = this.webhookUrl(token);
    if (!url) {
      config.webhookError = 'The public address of this server is not configured (API_URL), so Dialpad cannot call back.';
      return;
    }
    try {
      const hook = await client.createWebhook(url, secret);
      config.webhookId = String(hook.id);
      for (const [kind, subscribe] of [
        ['sms', (field: 'endpoint_id' | 'webhook_id') => client.subscribeSms(field, hook.id)],
        ['call', (field: 'endpoint_id' | 'webhook_id') => client.subscribeCalls(field, hook.id)],
      ] as const) {
        let sub: { id: number | string } | undefined;
        for (const field of ['endpoint_id', 'webhook_id'] as const) {
          try {
            sub = await subscribe(field);
            break;
          } catch (error) {
            if (!(error instanceof DialpadError) || error.status !== 400) throw error;
          }
        }
        if (!sub) throw new DialpadError(`Dialpad refused the ${kind} subscription`, 400);
        if (kind === 'sms') config.smsSubscriptionId = String(sub.id);
        else config.callSubscriptionId = String(sub.id);
      }
    } catch (error) {
      config.webhookError = `Incoming texts and calls could not be subscribed: ${(error as Error).message}`;
      this.logger.warn(config.webhookError);
    }
  }

  private async tearDownWebhook(config: DialpadConfig, organisationId: string) {
    if (!config.apiKeyEnc) return;
    const client = new DialpadClient(decryptSecret(config.apiKeyEnc, this.secretKey()));
    const steps: Array<[string | undefined, (id: string) => Promise<unknown>]> = [
      [config.smsSubscriptionId, (id) => client.deleteSmsSubscription(id)],
      [config.callSubscriptionId, (id) => client.deleteCallSubscription(id)],
      [config.webhookId, (id) => client.deleteWebhook(id)],
    ];
    for (const [id, remove] of steps) {
      if (!id) continue;
      await remove(id).catch((e) => this.logger.warn(`Dialpad ${organisationId}: could not remove ${id}: ${(e as Error).message}`));
    }
  }

  /** Turns a Dialpad failure into something a recruiter can act on. */
  asException(error: unknown, fallback: string): AppException {
    if (error instanceof AppException) return error;
    if (error instanceof DialpadError) {
      if (error.isAuth) return new AppException('DIALPAD_AUTH', 'Dialpad rejected the credentials or the key may not use this feature. An administrator should reconnect Dialpad.', HttpStatus.BAD_GATEWAY);
      if (error.isRateLimit) return new AppException('DIALPAD_RATE_LIMIT', 'Dialpad is limiting how fast we can send. Try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
      if (error.status === 0) return new AppException('DIALPAD_UNREACHABLE', 'Dialpad could not be reached. Try again shortly.', HttpStatus.BAD_GATEWAY);
      return new AppException('DIALPAD_ERROR', `${fallback} ${error.message}`.trim(), HttpStatus.BAD_GATEWAY);
    }
    return new AppException('DIALPAD_ERROR', fallback, HttpStatus.BAD_GATEWAY);
  }
}

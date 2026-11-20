import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import { verifyDialpadJwt } from '../lib/dialpad-jwt';
import { isOptOutText } from '../lib/placeholders';

import { CommunicationsService } from './communications.service';
import { DialpadConnectionService } from './dialpad-connection.service';

type Status = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'UNDELIVERED' | 'FAILED' | 'RECEIVED' | 'RINGING' | 'CONNECTED' | 'COMPLETED' | 'MISSED' | 'NO_ANSWER';

/** A status never moves backwards (webhooks can arrive out of order). */
const RANK: Record<Status, number> = { QUEUED: 0, SENDING: 1, RINGING: 2, SENT: 2, CONNECTED: 3, RECEIVED: 4, UNDELIVERED: 5, FAILED: 5, MISSED: 6, NO_ANSWER: 6, COMPLETED: 6, DELIVERED: 6 };

export type WebhookOutcome = 'unknown_endpoint' | 'bad_signature' | 'ignored' | 'processed';

@Injectable()
export class DialpadWebhookService {
  private readonly logger = new Logger(DialpadWebhookService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly connection: DialpadConnectionService,
    private readonly comms: CommunicationsService,
  ) {}

  /** `body` is the raw request text: Dialpad sends events as a JWT signed (HS256) with the secret we registered. */
  async handle(token: string, body: string): Promise<WebhookOutcome> {
    const target = await this.connection.webhookSecretFor(token);
    if (!target) return 'unknown_endpoint';
    const event = verifyDialpadJwt(body, target.secret);
    if (!event) return 'bad_signature';

    await this.connection.touchWebhook(target.organisationId);
    try {
      if (typeof event.call_id !== 'undefined' && typeof event.state === 'string') await this.onCall(target.organisationId, event);
      else if (typeof event.id !== 'undefined' && (event.from_number || event.to_number)) await this.onSms(target.organisationId, event);
      else return 'ignored';
      return 'processed';
    } catch (error) {
      // answer 200 anyway would hide a bug; throw so Dialpad retries
      this.logger.error(`Dialpad event failed: ${(error as Error).message}`);
      throw error;
    }
  }

  // ------------------------------------------------------------------------------------------------------ SMS

  private async onSms(organisationId: string, e: Record<string, unknown>) {
    const providerId = String(e.id);
    const inbound = e.direction === 'inbound';
    const from = typeof e.from_number === 'string' ? e.from_number : null;
    const to = Array.isArray(e.to_number) ? (e.to_number as unknown[]).find((n): n is string => typeof n === 'string') ?? null : typeof e.to_number === 'string' ? e.to_number : null;
    const text = typeof e.text === 'string' ? e.text : null;
    const status = this.smsStatus(e.message_status, inbound);
    const providerStatus = [e.message_status, e.message_delivery_result].filter((v) => typeof v === 'string').join(':') || null;

    let existing = await this.find(organisationId, providerId);
    if (!existing && !inbound) {
      // the webhook can beat the API response that stores our own message's id — give it a moment
      await new Promise((r) => setTimeout(r, 1500));
      existing = await this.find(organisationId, providerId);
    }

    if (existing) {
      if (RANK[status] >= RANK[existing.status as Status]) {
        await this.db.client.communication.update({ where: { id: existing.id }, data: { status, providerStatus, errorMessage: status === 'FAILED' || status === 'UNDELIVERED' ? `Dialpad: ${providerStatus ?? 'not delivered'}` : existing.errorMessage, lastEventAt: new Date() } });
      }
      return;
    }

    const external = inbound ? from : to;
    if (!external) return;
    const candidateId = await this.comms.findCandidateByNumber(organisationId, external);
    const target = e.target as { email?: string } | undefined;
    const userId = await this.comms.findCrmUserByEmail(organisationId, target?.email);
    await this.db.client.communication.create({
      data: {
        organisationId,
        candidateId,
        userId,
        type: 'SMS',
        direction: inbound ? 'INBOUND' : 'OUTBOUND',
        status,
        // the text only arrives when the API key may export message content; otherwise the row says so honestly
        body: text,
        externalNumber: external,
        fromNumber: inbound ? to : from,
        providerId,
        providerStatus,
        lastEventAt: new Date(),
      },
    });

    if (inbound && candidateId && isOptOutText(text)) {
      // "STOP" is honoured immediately, for every candidate that has this number
      const digits = this.digits(external);
      const result = await this.db.client.candidate.updateMany({ where: { organisationId, normalizedPhone: digits }, data: { smsConsent: 'OPTED_OUT', consentUpdatedAt: new Date() } });
      this.logger.log(`Opt-out text received: ${result.count} candidate(s) switched to opted-out`);
    }
  }

  private smsStatus(raw: unknown, inbound: boolean): Status {
    if (inbound) return 'RECEIVED';
    switch (raw) {
      case 'delivered':
        return 'DELIVERED';
      case 'failed':
        return 'FAILED';
      case 'undelivered':
        return 'UNDELIVERED';
      default:
        return 'SENT';
    }
  }

  // ------------------------------------------------------------------------------------------------------ calls

  private async onCall(organisationId: string, e: Record<string, unknown>) {
    const providerId = String(e.call_id);
    const state = String(e.state);
    if (!['ringing', 'connected', 'hangup', 'missed', 'voicemail', 'calling'].includes(state)) return;
    const inbound = e.direction === 'inbound';
    const stamp = typeof e.event_timestamp === 'number' ? new Date(e.event_timestamp) : new Date();
    const external = typeof e.external_number === 'string' ? e.external_number : null;
    const internal = typeof e.internal_number === 'string' ? e.internal_number : null;
    const customData = typeof e.custom_data === 'string' ? e.custom_data : null;

    let row = await this.find(organisationId, providerId);
    if (!row && customData) {
      // a call started from the CRM carries our communication id; the first event binds Dialpad's call id to it
      row = await this.db.client.communication.findFirst({ where: { id: customData, organisationId, type: 'CALL', providerId: null } });
      if (row) await this.db.client.communication.update({ where: { id: row.id }, data: { providerId } });
    }

    const connected = Boolean(e.date_connected) || row?.status === 'CONNECTED';
    const status: Status =
      state === 'ringing' || state === 'calling' ? 'RINGING' : state === 'connected' ? 'CONNECTED' : state === 'hangup' ? (connected ? 'COMPLETED' : inbound ? 'MISSED' : 'NO_ANSWER') : 'MISSED';
    const seconds = typeof e.duration === 'number' ? Math.round(e.duration / 1000) : undefined;

    if (row) {
      if (row.lastEventAt && row.lastEventAt > stamp) return;
      if (RANK[status] < RANK[row.status as Status]) return;
      await this.db.client.communication.update({ where: { id: row.id }, data: { status, providerStatus: state, lastEventAt: stamp, ...(seconds !== undefined && status !== 'RINGING' ? { durationSeconds: seconds } : {}) } });
    } else {
      if (!external) return;
      const target = e.target as { email?: string } | undefined;
      const candidateId = await this.comms.findCandidateByNumber(organisationId, external);
      const userId = await this.comms.findCrmUserByEmail(organisationId, target?.email);
      try {
        await this.db.client.communication.create({
          data: { organisationId, candidateId, userId, type: 'CALL', direction: inbound ? 'INBOUND' : 'OUTBOUND', status, externalNumber: external, fromNumber: internal, providerId, providerStatus: state, lastEventAt: stamp, durationSeconds: seconds },
        });
      } catch {
        // two events for the same new call raced; the other one created it — apply this one on top
        const again = await this.find(organisationId, providerId);
        if (again && RANK[status] >= RANK[again.status as Status]) await this.db.client.communication.update({ where: { id: again.id }, data: { status, providerStatus: state, lastEventAt: stamp } });
      }
    }

    if (status === 'COMPLETED') {
      const done = await this.find(organisationId, providerId);
      if (done?.candidateId) await this.db.client.candidate.updateMany({ where: { id: done.candidateId, organisationId }, data: { lastContactedAt: new Date() } });
    }
  }

  private find(organisationId: string, providerId: string) {
    return this.db.client.communication.findUnique({ where: { organisationId_provider_providerId: { organisationId, provider: 'dialpad', providerId } } });
  }

  private digits(e164: string) {
    return e164.replace(/\D/g, '');
  }
}

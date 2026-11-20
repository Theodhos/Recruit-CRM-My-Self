import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { decryptSecret, encryptSecret } from '../../modules/communications/lib/secret-box';

export const ZOOM = 'zoom';
export const STORAGE = 'storage';

export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export interface StorageSettings {
  provider: 's3' | 'r2' | 'minio' | 'local' | 'gdrive';
  bucket?: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  driveClientId?: string;
  driveClientSecret?: string;
  driveRefreshToken?: string;
  driveFolderId?: string;
}

/** What is saved in `integrations.config`: every secret is encrypted (AES-256-GCM, see communications/lib/secret-box.ts). */
type StoredZoom = { accountId?: string; clientId?: string; clientSecretEnc?: string };
type StoredStorage = Omit<StorageSettings, 'secretAccessKey' | 'driveClientSecret' | 'driveRefreshToken'> & {
  secretAccessKeyEnc?: string;
  driveClientSecretEnc?: string;
  driveRefreshTokenEnc?: string;
};

/**
 * The credentials of the connections an administrator sets in Settings → Connections (Zoom, File storage). What is
 * saved there wins; with nothing saved the server's own settings (.env) are used, so a platform that already works
 * keeps working. Kept in memory and refreshed when something is saved, so callers can ask without waiting.
 */
@Injectable()
export class ConnectionSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ConnectionSettingsService.name);
  private zoom: ZoomCredentials | null = null;
  private storage: StorageSettings | null = null;
  private listeners: Array<() => void> = [];

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh().catch((error) => this.logger.warn(`Could not read the saved connections: ${(error as Error).message}`));
  }

  secretKey(): string {
    return this.config.get<string>('INTEGRATION_ENCRYPTION_KEY') || this.config.getOrThrow<string>('SESSION_SECRET');
  }

  encrypt(value: string): string {
    return encryptSecret(value, this.secretKey());
  }

  /** Called after a save so the storage provider is rebuilt. */
  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  async refresh(): Promise<void> {
    const rows = await this.db.client.integration.findMany({ where: { provider: { in: [ZOOM, STORAGE] }, status: 'CONNECTED' } });
    const zoomRow = rows.find((row) => row.provider === ZOOM);
    const storageRow = rows.find((row) => row.provider === STORAGE);
    this.zoom = zoomRow ? this.readZoom(zoomRow.config as StoredZoom) : null;
    this.storage = storageRow ? this.readStorage(storageRow.config as StoredStorage) : null;
    for (const listener of this.listeners) listener();
  }

  private readZoom(stored: StoredZoom | null): ZoomCredentials | null {
    if (!stored?.accountId || !stored.clientId || !stored.clientSecretEnc) return null;
    try {
      return { accountId: stored.accountId, clientId: stored.clientId, clientSecret: decryptSecret(stored.clientSecretEnc, this.secretKey()) };
    } catch {
      this.logger.warn('The saved Zoom credentials could not be decrypted — the server settings are used.');
      return null;
    }
  }

  private readStorage(stored: StoredStorage | null): StorageSettings | null {
    if (!stored?.provider) return null;
    const open = (value?: string) => (value ? decryptSecret(value, this.secretKey()) : undefined);
    try {
      const { secretAccessKeyEnc, driveClientSecretEnc, driveRefreshTokenEnc, ...plain } = stored;
      return {
        ...plain,
        secretAccessKey: open(secretAccessKeyEnc),
        driveClientSecret: open(driveClientSecretEnc),
        driveRefreshToken: open(driveRefreshTokenEnc),
      };
    } catch {
      this.logger.warn('The saved storage credentials could not be decrypted — the server settings are used.');
      return null;
    }
  }

  /** Saved in Settings, else the server's .env; null when neither has all three values. */
  zoomCredentials(): ZoomCredentials | null {
    if (this.zoom) return this.zoom;
    const accountId = this.config.get<string>('ZOOM_ACCOUNT_ID');
    const clientId = this.config.get<string>('ZOOM_CLIENT_ID');
    const clientSecret = this.config.get<string>('ZOOM_CLIENT_SECRET');
    return accountId && clientId && clientSecret ? { accountId, clientId, clientSecret } : null;
  }

  zoomSource(): 'settings' | 'server' | 'none' {
    return this.zoom ? 'settings' : this.zoomCredentials() ? 'server' : 'none';
  }

  /** Saved in Settings, or null to use the server's .env (what the storage module builds from at start-up). */
  savedStorage(): StorageSettings | null {
    return this.storage;
  }

  /** The server's own storage settings (.env). */
  serverStorage(): StorageSettings {
    const get = (key: string) => this.config.get<string>(key) || undefined;
    return {
      provider: (this.config.get<string>('STORAGE_PROVIDER', 's3') as StorageSettings['provider']) ?? 's3',
      bucket: get('STORAGE_BUCKET') ?? 'crm-documents',
      region: get('STORAGE_REGION') ?? 'auto',
      endpoint: get('STORAGE_ENDPOINT'),
      forcePathStyle: ['1', 'true', 'yes'].includes((get('STORAGE_FORCE_PATH_STYLE') ?? '').toLowerCase()),
      accessKeyId: get('STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: get('STORAGE_SECRET_ACCESS_KEY'),
      driveClientId: get('GOOGLE_DRIVE_CLIENT_ID'),
      driveClientSecret: get('GOOGLE_DRIVE_CLIENT_SECRET'),
      driveRefreshToken: get('GOOGLE_DRIVE_REFRESH_TOKEN'),
      driveFolderId: get('GOOGLE_DRIVE_FOLDER_ID'),
    };
  }

  effectiveStorage(): StorageSettings {
    return this.storage ?? this.serverStorage();
  }

  // ---- saving -------------------------------------------------------------------------------------------------

  async saveZoom(organisationId: string, userId: string, input: { accountId: string; clientId: string; clientSecret?: string }): Promise<void> {
    const current = await this.stored<StoredZoom>(organisationId, ZOOM);
    const secretEnc = input.clientSecret?.trim() ? this.encrypt(input.clientSecret.trim()) : current?.clientSecretEnc;
    const config: StoredZoom = { accountId: input.accountId.trim(), clientId: input.clientId.trim(), clientSecretEnc: secretEnc };
    await this.write(organisationId, userId, ZOOM, config);
  }

  async saveStorage(organisationId: string, userId: string, input: Partial<StorageSettings> & { provider: StorageSettings['provider'] }): Promise<void> {
    const current = await this.stored<StoredStorage>(organisationId, STORAGE);
    // a field left empty keeps what was saved before (the secrets are never shown back, so they cannot be re-typed)
    const keep = (value: string | undefined, previousEnc: string | undefined) => (value?.trim() ? this.encrypt(value.trim()) : previousEnc);
    const text = (value?: string) => (value?.trim() ? value.trim() : undefined);
    const config: StoredStorage = {
      provider: input.provider,
      bucket: text(input.bucket),
      region: text(input.region),
      endpoint: text(input.endpoint),
      forcePathStyle: Boolean(input.forcePathStyle),
      accessKeyId: text(input.accessKeyId),
      secretAccessKeyEnc: keep(input.secretAccessKey, current?.secretAccessKeyEnc),
      driveClientId: text(input.driveClientId),
      driveClientSecretEnc: keep(input.driveClientSecret, current?.driveClientSecretEnc),
      driveRefreshTokenEnc: keep(input.driveRefreshToken, current?.driveRefreshTokenEnc),
      driveFolderId: text(input.driveFolderId),
    };
    await this.write(organisationId, userId, STORAGE, config);
  }

  async clear(organisationId: string, provider: typeof ZOOM | typeof STORAGE): Promise<void> {
    await this.db.client.integration.deleteMany({ where: { organisationId, provider } });
    await this.refresh();
  }

  /** The secrets an incoming save does not repeat, so a form that leaves a secret empty can still be tested. */
  async mergedStorage(organisationId: string, input: Partial<StorageSettings> & { provider: StorageSettings['provider'] }): Promise<StorageSettings> {
    const current = this.readStorage(await this.stored<StoredStorage>(organisationId, STORAGE)) ?? this.serverStorage();
    const sameProvider = current.provider === input.provider;
    const pick = (value: string | undefined, previous: string | undefined) => (value?.trim() ? value.trim() : sameProvider ? previous : undefined);
    return {
      provider: input.provider,
      bucket: input.bucket?.trim() || undefined,
      region: input.region?.trim() || undefined,
      endpoint: input.endpoint?.trim() || undefined,
      forcePathStyle: Boolean(input.forcePathStyle),
      accessKeyId: input.accessKeyId?.trim() || undefined,
      secretAccessKey: pick(input.secretAccessKey, current.secretAccessKey),
      driveClientId: input.driveClientId?.trim() || undefined,
      driveClientSecret: pick(input.driveClientSecret, current.driveClientSecret),
      driveRefreshToken: pick(input.driveRefreshToken, current.driveRefreshToken),
      driveFolderId: input.driveFolderId?.trim() || undefined,
    };
  }

  async mergedZoom(organisationId: string, input: { accountId: string; clientId: string; clientSecret?: string }): Promise<ZoomCredentials | null> {
    const current = this.readZoom(await this.stored<StoredZoom>(organisationId, ZOOM)) ?? this.zoomCredentials();
    const clientSecret = input.clientSecret?.trim() || current?.clientSecret;
    return clientSecret ? { accountId: input.accountId.trim(), clientId: input.clientId.trim(), clientSecret } : null;
  }

  private async stored<T>(organisationId: string, provider: string): Promise<T | null> {
    const row = await this.db.client.integration.findUnique({ where: { organisationId_provider: { organisationId, provider } } });
    return (row?.config as T | null) ?? null;
  }

  private async write(organisationId: string, userId: string, provider: string, config: object): Promise<void> {
    const data = { status: 'CONNECTED' as const, config: config as never, connectedById: userId, connectedAt: new Date(), lastSyncedAt: new Date() };
    await this.db.client.integration.upsert({
      where: { organisationId_provider: { organisationId, provider } },
      create: { organisationId, provider, ...data },
      update: data,
    });
    await this.refresh();
  }

  async savedAt(organisationId: string, provider: string): Promise<string | null> {
    const row = await this.db.client.integration.findUnique({ where: { organisationId_provider: { organisationId, provider } } });
    return row?.connectedAt?.toISOString() ?? null;
  }
}

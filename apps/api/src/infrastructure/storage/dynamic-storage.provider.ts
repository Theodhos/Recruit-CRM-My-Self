import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { createStorageProvider, LocalDiskStorageProvider, type SignedUrlOptions, type StorageObject, type StorageProvider, type StoredFile, type UploadObjectInput } from '@crm/storage';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ConnectionSettingsService, StorageSettings } from '../connections/connection-settings.service';

import { resolveStorageLocalRoot } from './local-root';

/** Builds the provider for these settings (also used to test settings before they are saved). */
export function buildStorageProvider(settings: StorageSettings, config: ConfigService): StorageProvider {
  const apiUrl = config.get<string>('API_URL', 'http://localhost:4000');
  const globalPrefix = config.get<string>('API_GLOBAL_PREFIX', 'api/v1');
  return createStorageProvider({
    provider: settings.provider,
    bucket: settings.bucket ?? 'crm-documents',
    region: settings.region ?? 'auto',
    endpoint: settings.endpoint,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    forcePathStyle: settings.forcePathStyle ?? false,
    driveClientId: settings.driveClientId,
    driveClientSecret: settings.driveClientSecret,
    driveRefreshToken: settings.driveRefreshToken,
    driveFolderId: settings.driveFolderId,
    rootDir: resolveStorageLocalRoot(config),
    publicBaseUrl: config.get<string>('STORAGE_LOCAL_PUBLIC_BASE_URL') || `${apiUrl}/${globalPrefix}`,
  } as Parameters<typeof createStorageProvider>[0]);
}

/**
 * The storage the rest of the platform injects. It passes every call to the provider built from the storage settings
 * saved in Settings → Connections (or from the server's .env when nothing is saved), and is rebuilt the moment those
 * settings change — no restart. Files saved before a change stay where they were saved.
 *
 * It never lets an upload fail because the main storage is down (Google Drive's sign-in expired, an S3 outage…): the
 * file is then kept on this server's own disk (a persistent volume) and served from there, and the failure is
 * remembered (`lastFallback`) so Settings can tell an administrator to reconnect the storage. Lookups try the server's
 * disk first, so files kept there open whichever storage is in use later.
 */
export class DynamicStorageProvider implements StorageProvider {
  private readonly logger = new Logger(DynamicStorageProvider.name);
  private inner: StorageProvider;
  private readonly local: LocalDiskStorageProvider;
  private readonly localRoot: string;
  /** The last time the main storage refused a file and the server's disk took it instead. */
  lastFallback: { at: string; message: string } | null = null;

  constructor(
    private readonly settings: ConnectionSettingsService,
    private readonly config: ConfigService,
  ) {
    this.inner = buildStorageProvider(this.settings.effectiveStorage(), this.config);
    this.localRoot = resolveStorageLocalRoot(this.config);
    this.local = new LocalDiskStorageProvider({
      rootDir: this.localRoot,
      publicBaseUrl: this.config.get<string>('STORAGE_LOCAL_PUBLIC_BASE_URL') || `${this.config.get<string>('API_URL', 'http://localhost:4000')}/${this.config.get<string>('API_GLOBAL_PREFIX', 'api/v1')}`,
    });
    this.settings.onChange(() => this.rebuild());
  }

  private rebuild(): void {
    try {
      this.inner = buildStorageProvider(this.settings.effectiveStorage(), this.config);
      this.lastFallback = null;
    } catch (error) {
      this.logger.error(`Storage settings could not be applied, the previous storage stays in use: ${(error as Error).message}`);
    }
  }

  private get mainIsLocal(): boolean {
    return this.settings.effectiveStorage().provider === 'local';
  }

  private async onLocalDisk(key: string): Promise<boolean> {
    return !this.mainIsLocal && (await this.local.exists(key).catch(() => false));
  }

  async upload(input: UploadObjectInput): Promise<StorageObject> {
    try {
      return await this.inner.upload(input);
    } catch (error) {
      if (this.mainIsLocal) throw error;
      const message = (error as Error).message ?? 'unknown error';
      this.logger.error(`The main storage refused a file, it is kept on this server's disk instead: ${message}`);
      // a file may be a Readable stream already consumed by the failed attempt: only buffers can be tried again
      if (!Buffer.isBuffer(input.body) && !(input.body instanceof Uint8Array)) throw error;
      const stored = await this.local.upload(input);
      this.lastFallback = { at: new Date().toISOString(), message: message.split('\n')[0]!.slice(0, 300) };
      return stored;
    }
  }

  /** Only present when the provider in use can hand the bytes back (Google Drive): callers check for it. Files kept on the server's disk are read from there. */
  get getObject(): ((key: string) => Promise<StoredFile | undefined>) | undefined {
    const inner = this.inner;
    if (!inner.getObject) return undefined;
    return async (key: string) => {
      if (await this.onLocalDisk(key)) {
        const path = resolve(this.localRoot, key);
        if (!path.startsWith(resolve(this.localRoot) + sep)) return undefined;
        return { body: await readFile(path) };
      }
      return inner.getObject!(key);
    };
  }

  async delete(key: string): Promise<void> {
    if (await this.onLocalDisk(key)) await this.local.delete(key);
    else await this.inner.delete(key);
  }

  async getDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    if (await this.onLocalDisk(key)) return this.local.getDownloadUrl(key, options);
    return this.inner.getDownloadUrl(key, options);
  }

  getUploadUrl(key: string, contentType: string, options?: SignedUrlOptions): Promise<string> {
    return this.inner.getUploadUrl(key, contentType, options);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.onLocalDisk(key)) || this.inner.exists(key);
  }
}

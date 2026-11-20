import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import type {
  SignedUrlOptions,
  StorageObject,
  StorageProvider,
  StoredFile,
  UploadObjectInput,
} from '../storage.interface';

export interface GoogleDriveStorageConfig {
  /** OAuth client of a Google Cloud project (Drive API enabled). */
  driveClientId?: string;
  driveClientSecret?: string;
  /** Long-lived refresh token of the Google account whose Drive holds the files (see scripts/google-drive-auth.mjs). */
  driveRefreshToken?: string;
  /** Optional: a folder this app created earlier. Empty = a folder named "CRM Documents" is found or created. */
  driveFolderId?: string;
  /** This API's own base URL — download links point back at its /storage/download route (Drive has no presigned URLs). */
  publicBaseUrl?: string;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'CRM Documents';
const ID_CACHE_MAX = 5000;

async function toBuffer(body: Buffer | Uint8Array | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const escapeQuery = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const encodeKeyForUrl = (key: string): string => Buffer.from(key, 'utf-8').toString('base64url');
/** Drive limits a property to 124 bytes (name + value), so the file carries a short hash of its key, not the key itself. */
const keyTag = (key: string): string => createHash('sha1').update(key).digest('hex');
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * StorageProvider backed by Google Drive, over its REST API (plain fetch — no SDK). Every file lives in ONE folder and
 * is named after its storage key (`<organisationId>/documents/<uuid>-<name>`), so a key maps to exactly one file and
 * the tenant prefix check in the storage controller keeps working. The app only sees files it created itself
 * (`drive.file` scope), never the rest of the Drive.
 *
 * Drive has no presigned URLs, so — like the local provider — download links point back at this API's
 * `/storage/download/:encodedKey` route, which checks the tenant and streams the bytes through `getObject`.
 */
export class GoogleDriveStorageProvider implements StorageProvider {
  private accessToken?: { value: string; expiresAt: number };
  private folderId?: string;
  private readonly ids = new Map<string, string>();
  private readonly folders = new Map<string, string>();

  constructor(private readonly config: GoogleDriveStorageConfig) {
    if (!config.driveClientId || !config.driveClientSecret || !config.driveRefreshToken) {
      throw new Error(
        'STORAGE_PROVIDER=gdrive requires GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN.',
      );
    }
    if (!config.publicBaseUrl) throw new Error('STORAGE_PROVIDER=gdrive requires a public API base URL.');
    this.folderId = config.driveFolderId || undefined;
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.driveClientId!,
        client_secret: this.config.driveClientSecret!,
        refresh_token: this.config.driveRefreshToken!,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) throw new Error(`Google sign-in failed (${response.status}): ${await response.text()}`);
    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  /** Authenticated call with a few retries on rate limits (429) and Google-side errors (5xx). */
  private async call(url: string, init: RequestInit = {}, expected: number[] = [200]): Promise<Response> {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${await this.token()}` },
      });
      if (expected.includes(response.status)) return response;
      lastStatus = response.status;
      if (response.status === 401) this.accessToken = undefined;
      if (response.status !== 401 && response.status !== 429 && response.status < 500) {
        throw new Error(`Google Drive answered ${response.status}: ${await response.text()}`);
      }
      await sleep(300 * 2 ** attempt);
    }
    throw new Error(`Google Drive kept failing (${lastStatus}).`);
  }

  private async list(query: string): Promise<Array<{ id: string }>> {
    const url = `${FILES_URL}?${new URLSearchParams({ q: query, fields: 'files(id)', pageSize: '10', spaces: 'drive' })}`;
    const response = await this.call(url);
    return ((await response.json()) as { files?: Array<{ id: string }> }).files ?? [];
  }

  private async folder(): Promise<string> {
    if (this.folderId) return this.folderId;
    const found = await this.list(`name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`);
    if (found[0]) {
      this.folderId = found[0].id;
      return this.folderId;
    }
    const response = await this.call(
      `${FILES_URL}?fields=id`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }) },
    );
    this.folderId = ((await response.json()) as { id: string }).id;
    return this.folderId;
  }

  /** The folder for a path under the root ("Candidates" / "Ana Dodaj" / "CV"): found or created, one level at a time. */
  private async folderFor(path: string[] | undefined): Promise<string> {
    let parent = await this.folder();
    let walked = '';
    for (const raw of path ?? []) {
      const name = raw.replace(/\//g, '-').trim().slice(0, 120) || 'Unnamed';
      walked += '/' + name;
      const cached = this.folders.get(walked);
      if (cached) {
        parent = cached;
        continue;
      }
      const found = await this.list(`name='${escapeQuery(name)}' and mimeType='${FOLDER_MIME}' and '${parent}' in parents and trashed=false`);
      let id = found[0]?.id;
      if (!id) {
        const response = await this.call(
          `${FILES_URL}?fields=id`,
          { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }) },
        );
        id = ((await response.json()) as { id: string }).id;
      }
      this.folders.set(walked, id);
      parent = id;
    }
    return parent;
  }

  private remember(key: string, id: string): void {
    if (this.ids.size >= ID_CACHE_MAX) this.ids.delete(this.ids.keys().next().value as string);
    this.ids.set(key, id);
  }

  private async findId(key: string): Promise<string | undefined> {
    const cached = this.ids.get(key);
    if (cached) return cached;
    // files placed by the app carry their key as a property; the ones from before folders existed are named by it
    const tagged = await this.list(`appProperties has { key='k' and value='${keyTag(key)}' } and trashed=false`);
    const found = tagged[0] ? tagged : await this.list(`name='${escapeQuery(key)}' and '${await this.folder()}' in parents and trashed=false`);
    if (found[0]) this.remember(key, found[0].id);
    return found[0]?.id;
  }

  async upload(input: UploadObjectInput): Promise<StorageObject> {
    const body = await toBuffer(input.body);
    const boundary = `crm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const metadata = { name: input.displayName?.trim() || input.key, parents: [await this.folderFor(input.folderPath)], mimeType: input.contentType, appProperties: { k: keyTag(input.key) } };
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${input.contentType}\r\n\r\n`),
      body,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await this.call(`${UPLOAD_URL}?uploadType=multipart&fields=id,md5Checksum`, {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body: payload,
    });
    const data = (await response.json()) as { id: string; md5Checksum?: string };
    this.remember(input.key, data.id);
    return { key: input.key, sizeBytes: input.sizeBytes, contentType: input.contentType, etag: data.md5Checksum };
  }

  async getObject(key: string): Promise<StoredFile | undefined> {
    const id = await this.findId(key);
    if (!id) return undefined;
    const response = await this.call(`${FILES_URL}/${id}?alt=media`, {}, [200, 404]);
    if (response.status === 404) {
      this.ids.delete(key);
      return undefined;
    }
    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? undefined,
    };
  }

  async delete(key: string): Promise<void> {
    const id = await this.findId(key);
    if (!id) return;
    await this.call(`${FILES_URL}/${id}`, { method: 'DELETE' }, [204, 404]);
    this.ids.delete(key);
  }

  async getDownloadUrl(key: string, _options?: SignedUrlOptions): Promise<string> {
    return `${this.config.publicBaseUrl}/storage/download/${encodeKeyForUrl(key)}`;
  }

  async getUploadUrl(key: string, _contentType: string, _options?: SignedUrlOptions): Promise<string> {
    return this.getDownloadUrl(key);
  }

  async exists(key: string): Promise<boolean> {
    return Boolean(await this.findId(key));
  }
}

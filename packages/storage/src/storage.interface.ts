import type { Readable } from 'node:stream';

/**
 * Vendor-agnostic contract every storage provider implements. Application
 * code (apps/api document/candidate-document services, apps/worker CV
 * parsing) depends ONLY on this interface — never on @aws-sdk/* directly —
 * so switching AWS S3 <-> Cloudflare R2 <-> MinIO is a config change, not a
 * code change. See docs/architecture/overview.md#file-storage.
 */
export interface UploadObjectInput {
  key: string;
  body: Buffer | Uint8Array | Readable;
  contentType: string;
  sizeBytes: number;
  metadata?: Record<string, string>;
  /** Where a provider that has folders (Google Drive) puts the file, under its root folder: e.g. ['Candidates', 'Ana Dodaj', 'CV']. Others ignore it. */
  folderPath?: string[];
  /** The readable name a provider with folders gives the file (the key stays how the platform finds it). */
  displayName?: string;
}

export interface StorageObject {
  key: string;
  sizeBytes: number;
  contentType: string;
  etag?: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
}

export interface StoredFile {
  body: Buffer;
  contentType?: string;
}

export interface StorageProvider {
  upload(input: UploadObjectInput): Promise<StorageObject>;
  /**
   * Optional: providers without presigned URLs (Google Drive) hand the bytes back directly, so the API can stream
   * them after its own auth checks. Resolves to undefined when the key does not exist.
   */
  getObject?(key: string): Promise<StoredFile | undefined>;
  delete(key: string): Promise<void>;
  getDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  getUploadUrl(key: string, contentType: string, options?: SignedUrlOptions): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
] as const;

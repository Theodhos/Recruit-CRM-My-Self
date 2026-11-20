import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Encrypts third-party credentials (the Dialpad API key, the webhook secret) before they are stored in
 * `integrations.config`. AES-256-GCM with a random nonce per value; the key is derived (HKDF-SHA256) from
 * INTEGRATION_ENCRYPTION_KEY, or — when that is not set — from SESSION_SECRET, so no new server setting is needed.
 * Output: `v1.<nonce>.<tag>.<ciphertext>` (base64url). A value that was tampered with fails to decrypt.
 */
export function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'crm-integrations-salt', 'crm-integration-credentials', 32));
}

export function encryptSecret(plain: string, secret: string): string {
  const key = deriveKey(secret);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', nonce.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(boxed: string, secret: string): string {
  const [version, nonce, tag, data] = boxed.split('.');
  if (version !== 'v1' || !nonce || !tag || !data) throw new Error('Unsupported secret format');
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(nonce, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

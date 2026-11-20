import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Dialpad signs webhook events as a JWT (HS256) with the secret given when the webhook was created. Verifies the
 * signature and returns the payload, or null when the token is malformed, not HS256, or not signed with our secret.
 * (Implemented directly: HS256 is just an HMAC, and it avoids a dependency for one check.)
 */
export function verifyDialpadJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string };
    if (head.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    const given = Buffer.from(signature, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Builds a token the same way Dialpad does — used by the tests. */
export function signDialpadJwt(payload: Record<string, unknown>, secret: string): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

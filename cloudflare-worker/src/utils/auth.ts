/**
 * User JWT verification utilities.
 * Extension sends Authorization: Bearer <jwt>; Worker validates with JWT_SECRET.
 */

import type { Env, JwtClaims } from '../types';

export type AuthResult =
  | { ok: true; claims: JwtClaims }
  | { ok: false; message: string };

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const aa = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bb = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) {
    diff |= aa[i]! ^ bb[i]!;
  }
  return diff === 0;
}

async function hmacSha256(secret: string, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

/**
 * Verifies HS256 JWTs issued for Leverage Lab executives.
 */
export async function verifyUserJwt(request: Request, env: Env): Promise<AuthResult> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return { ok: false, message: 'Missing Bearer token' };
  }

  const token = header.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, message: 'Malformed JWT' };
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  if (!env.JWT_SECRET) {
    return { ok: false, message: 'JWT_SECRET is not configured' };
  }

  try {
    const signingInput = `${headerB64}.${payloadB64}`;
    const expected = new Uint8Array(await hmacSha256(env.JWT_SECRET, signingInput));
    const actual = base64UrlToBytes(signatureB64);
    if (!timingSafeEqual(expected, actual)) {
      return { ok: false, message: 'Invalid JWT signature' };
    }

    const payloadJson = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    const claims = JSON.parse(payloadJson) as JwtClaims;

    if (!claims.email || !claims.sub) {
      return { ok: false, message: 'JWT missing required claims' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp === 'number' && claims.exp < now) {
      return { ok: false, message: 'JWT expired' };
    }

    return { ok: true, claims };
  } catch {
    return { ok: false, message: 'Unable to verify JWT' };
  }
}

/**
 * Optional shared-secret check for Dashform webhooks.
 */
export function verifyDashformSecret(payloadSecret: string | undefined, env: Env): boolean {
  if (!env.DASHFORM_WEBHOOK_SECRET) return false;
  if (!payloadSecret) return false;
  if (payloadSecret.length !== env.DASHFORM_WEBHOOK_SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < payloadSecret.length; i += 1) {
    diff |= payloadSecret.charCodeAt(i) ^ env.DASHFORM_WEBHOOK_SECRET.charCodeAt(i);
  }
  return diff === 0;
}

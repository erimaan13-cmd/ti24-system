import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Sesión del CRM en MODO DEMO: cookie firmada (HMAC-SHA256), httpOnly, 8 horas.
 * Cuando exista el proyecto Supabase «ti24», se reemplaza por Supabase Auth (enlace mágico);
 * el resto del CRM no cambia porque solo usa requireActor().
 */
export const COOKIE = 'ti24_crm';
const TTL_S = 8 * 60 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET falta o tiene menos de 32 caracteres');
  return s;
}
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function encodeSession(uid: string): string {
  const payload = b64(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + TTL_S }));
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): { uid: string } | null {
  if (!token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { uid: string; exp: number };
    if (!data.uid || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

export async function setSessionCookie(uid: string) {
  (await cookies()).set(COOKIE, encodeSession(uid), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL_S,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.CRM_DEMO_PASSWORD;
  if (!expected || expected.length < 8) return false;
  const a = createHmac('sha256', 'cmp').update(input).digest();
  const b = createHmac('sha256', 'cmp').update(expected).digest();
  return timingSafeEqual(a, b);
}

import 'server-only';
/**
 * Utilidades de servidor para las API públicas: límite de frecuencia, origen, dispositivo y Turnstile.
 * Límite de frecuencia en memoria: protege por instancia. Suficiente para P0 (tráfico bajo);
 * si el tráfico crece se mueve a un almacén compartido (P1).
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** Rechaza POST desde otros sitios (el navegador siempre manda Origin en fetch POST). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // clientes sin navegador (p. ej., pruebas); igual pasan por validación
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Resumen de dispositivo (no se guarda el user-agent completo, AT-11 §17). */
export function deviceSummary(ua: string | null): string | null {
  if (!ua) return null;
  const type = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /edg\//i.test(ua) ? 'edge' : /chrome|crios/i.test(ua) ? 'chrome' : /firefox|fxios/i.test(ua) ? 'firefox' : /safari/i.test(ua) ? 'safari' : 'other';
  return `${type}/${browser}`;
}

export type CaptchaResult = 'ok' | 'failed' | 'skipped' | 'misconfigured';

export async function verifyTurnstile(token: string | null, ip: string): Promise<CaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.VERCEL_ENV === 'production' ? 'misconfigured' : 'skipped';
  if (!token) return 'failed';
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await r.json()) as { success?: boolean };
    return data.success ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('payload_too_large');
  return JSON.parse(text);
}

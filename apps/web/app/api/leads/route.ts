import { NextResponse } from 'next/server';
import { fieldIssues, LeadSubmission, type LeadIntakeResult } from '@ti24/contracts';
import { intakeLead, tenantId } from '@ti24/db';
import { clientIp, deviceSummary, rateLimit, readJson, sameOrigin, verifyTurnstile } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (body: LeadIntakeResult, status: number) => NextResponse.json(body, { status });

/**
 * POST /api/leads — formulario de diagnóstico.
 * Orden: origen → límite de frecuencia → esquema Zod → honeypot → Turnstile → ingesta idempotente.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ ok: false, error: 'spam' }, 403);
  const ip = clientIp(req);
  if (!rateLimit(`lead:${ip}`, Number(process.env.LEAD_RATE_LIMIT ?? 5), 10 * 60_000)) return reply({ ok: false, error: 'rate_limited' }, 429);

  let body: unknown;
  try {
    body = await readJson(req, 16_000);
  } catch {
    return reply({ ok: false, error: 'invalid' }, 400);
  }
  const parsed = LeadSubmission.safeParse(body);
  if (!parsed.success) return reply({ ok: false, error: 'invalid', issues: fieldIssues(parsed.error) }, 422);
  const sub = parsed.data;

  // Honeypot lleno: respondemos «ok» para no dar pistas al bot, pero no guardamos nada.
  if (sub.website.trim() !== '') return reply({ ok: true, status: 'created', lead_id: crypto.randomUUID() }, 201);

  const captcha = await verifyTurnstile(sub.turnstile_token, ip);
  if (captcha === 'misconfigured') return reply({ ok: false, error: 'server_error' }, 503);
  if (captcha === 'failed') return reply({ ok: false, error: 'captcha_failed' }, 400);

  try {
    const r = await intakeLead(tenantId(), sub, { device: deviceSummary(req.headers.get('user-agent')) });
    return reply({ ok: true, status: r.status, lead_id: r.lead_id }, r.status === 'replayed' ? 200 : 201);
  } catch (e) {
    console.error('[api/leads]', (e as Error).message);
    return reply({ ok: false, error: 'server_error' }, 500);
  }
}

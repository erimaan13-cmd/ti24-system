import { NextResponse } from 'next/server';
import { EventBatch } from '@ti24/contracts';
import { recordEvents, tenantId } from '@ti24/db';
import { clientIp, deviceSummary, rateLimit, readJson, sameOrigin } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/events — eventos anónimos del contrato v1. Idempotente por event_id. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  if (!rateLimit(`ev:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  let body: unknown;
  try {
    body = await readJson(req, 32_000);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }
  const parsed = EventBatch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 422 });
  try {
    const r = await recordEvents(tenantId(), parsed.data, { device: deviceSummary(req.headers.get('user-agent')) });
    return NextResponse.json({ ok: true, ...r }, { status: 202 });
  } catch (e) {
    console.error('[api/events]', (e as Error).message);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

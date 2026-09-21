/** Pruebas de la web pública: páginas P0, 404, móvil y rechazos de la API (inválido, spam, duplicado). */
import { expect, test } from '@playwright/test';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const ORIGIN = { origin: WEB };

const lead = (over: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) => ({
  event_id: crypto.randomUUID(),
  form_id: 'diagnostico',
  anonymous_id: crypto.randomUUID(),
  session_id: crypto.randomUUID(),
  page_path: '/diagnostico',
  fields: {
    full_name: 'Prueba API', email: `api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@demo-api.example`,
    company: 'Demo API', service_code: 'WEB', message: 'Mensaje de prueba de la API.', privacy_accepted: true, ...fields,
  },
  ...over,
});

test('las páginas P0 cargan con un H1, título y sin errores de consola', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const path of ['/', '/desarrollo-de-software', '/diagnostico', '/gracias', '/aviso-de-privacidad', '/en']) {
    const res = await page.goto(`${WEB}${path}`);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.title()).toContain('TI24');
  }
  expect(errors).toEqual([]);
});

test('404 propia con rutas útiles', async ({ page }) => {
  const res = await page.goto(`${WEB}/no-existe`);
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Agendar diagnóstico' })).toBeVisible();
});

test('en celular no hay desbordamiento horizontal y el CTA es tocable (≥ 44 px)', async ({ page }) => {
  for (const path of ['/', '/desarrollo-de-software', '/diagnostico']) {
    await page.goto(`${WEB}${path}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto(`${WEB}/`);
  const box = await page.locator('[data-cta="home_hero"]').boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test('el aviso de privacidad marca los campos PENDIENTE y el sitio pide no indexar (preview)', async ({ page, request }) => {
  await page.goto(`${WEB}/aviso-de-privacidad`);
  expect(await page.locator('[data-pending="true"]').count()).toBeGreaterThanOrEqual(3);
  const robots = await (await request.get(`${WEB}/robots.txt`)).text();
  expect(robots).toMatch(/Disallow: \//);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('API /api/leads: rechaza carga inválida, sin aviso de privacidad y de otro origen', async ({ request }) => {
  const bad = await request.post(`${WEB}/api/leads`, { data: lead({}, { email: 'no-es-correo' }), headers: ORIGIN });
  expect(bad.status()).toBe(422);
  expect((await bad.json()).issues.email).toBe('Correo no válido');

  const noPrivacy = await request.post(`${WEB}/api/leads`, { data: lead({}, { privacy_accepted: false }), headers: ORIGIN });
  expect(noPrivacy.status()).toBe(422);

  const extra = await request.post(`${WEB}/api/leads`, { data: { ...lead(), is_admin: true }, headers: ORIGIN });
  expect(extra.status()).toBe(422);

  const foreign = await request.post(`${WEB}/api/leads`, { data: lead(), headers: { origin: 'https://sitio-malicioso.example' } });
  expect(foreign.status()).toBe(403);
});

test('API /api/leads: el mismo event_id no crea dos leads; el honeypot no guarda nada', async ({ request }) => {
  const body = lead();
  const first = await request.post(`${WEB}/api/leads`, { data: body, headers: ORIGIN });
  expect(first.status()).toBe(201);
  const firstJson = await first.json();
  const again = await request.post(`${WEB}/api/leads`, { data: body, headers: ORIGIN });
  expect(again.status()).toBe(200);
  expect(await again.json()).toMatchObject({ ok: true, status: 'replayed', lead_id: firstJson.lead_id });

  const botBody = lead({ website: 'http://spam.example' });
  const bot = await request.post(`${WEB}/api/leads`, { data: botBody, headers: ORIGIN });
  expect(bot.status()).toBe(201); // el bot cree que funcionó…
  // …pero no se guardó nada: el mismo event_id sin honeypot se crea como nuevo (no como «replayed»)
  const real = await request.post(`${WEB}/api/leads`, { data: { ...botBody, website: '' }, headers: ORIGIN });
  expect(await real.json()).toMatchObject({ ok: true, status: 'created' });
});

test('API /api/events: acepta eventos anónimos, ignora duplicados y rechaza datos personales', async ({ request }) => {
  const ev = {
    event_id: crypto.randomUUID(), event_name: 'PAGE_VIEWED', schema_version: 1, occurred_at: new Date().toISOString(),
    anonymous_id: crypto.randomUUID(), session_id: crypto.randomUUID(), page: { path: '/', title: 'TI24', referrer: null },
  };
  const ok = await request.post(`${WEB}/api/events`, { data: { events: [ev] }, headers: ORIGIN });
  expect(ok.status()).toBe(202);
  expect(await ok.json()).toMatchObject({ accepted: 1, duplicates: 0 });
  const dup = await request.post(`${WEB}/api/events`, { data: { events: [ev] }, headers: ORIGIN });
  expect(await dup.json()).toMatchObject({ accepted: 0, duplicates: 1 });
  const pii = await request.post(`${WEB}/api/events`, { data: { events: [{ ...ev, event_id: crypto.randomUUID(), metadata: { email: 'x@y.com' } }] }, headers: ORIGIN });
  expect(pii.status()).toBe(422);
  const serverOnly = await request.post(`${WEB}/api/events`, { data: { events: [{ ...ev, event_id: crypto.randomUUID(), event_name: 'FORM_SUBMITTED' }] }, headers: ORIGIN });
  expect(serverOnly.status()).toBe(422);
});

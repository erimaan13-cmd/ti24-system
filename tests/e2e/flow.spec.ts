/**
 * Prueba E2E del vertical slice P0 (AT-13 tarea 7):
 * Google → /desarrollo-de-software → CTA → /diagnostico → /gracias
 * → CRM: lead con canal Google → calificar → convertir → propuesta aceptada → ganada → proyecto.
 * Guarda capturas en docs/evidencia/ para que Erick y Abraham revisen sin correr nada.
 */
import { expect, test, type Page } from '@playwright/test';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const CRM = process.env.CRM_URL ?? 'http://localhost:3001';
const PASSWORD = process.env.CRM_DEMO_PASSWORD ?? 'demo-e2e-2026';
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/evidencia/${name}.png`, fullPage: true });

async function login(page: Page, email: string) {
  await page.goto(`${CRM}/login`);
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('flujo completo: Google → sitio → lead → oportunidad → propuesta → ganada → proyecto', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'El flujo completo corre una vez, en escritorio');

  // ── 1. Visitante llega desde Google a la landing de software ──
  await page.goto(`${WEB}/desarrollo-de-software`, { referer: 'https://www.google.com/' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Software a medida');
  await shot(page, '01-landing-desarrollo-de-software');

  // ── 2. Clic en el CTA → formulario con el servicio preseleccionado ──
  await page.locator('[data-cta="sys_hero"]').click();
  await expect(page).toHaveURL(/\/diagnostico\?servicio=SYS/);
  await expect(page.getByLabel('¿Qué te interesa?')).toHaveValue('SYS');

  // ── 3. Envío vacío → errores junto a cada campo (validación del servidor) ──
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByText('Escribe tu nombre')).toBeVisible();
  await expect(page.getByText('Debes aceptar el aviso de privacidad')).toBeVisible();

  // ── 4. Envío válido → /gracias ──
  await page.getByLabel('Nombre', { exact: true }).fill('Contacto Demo');
  await page.getByLabel('Empresa', { exact: true }).fill('Aceros Demo SA de CV');
  await page.getByLabel('Correo de trabajo').fill('compras@aceros-demo.example');
  await page.getByLabel('¿Qué te gustaría resolver?').fill('Cotizamos en Excel y perdemos el seguimiento de cada cliente.');
  await page.getByLabel('Teléfono (opcional)').fill('81 0000 0000');
  await page.getByLabel(/He leído y acepto/).check();
  await shot(page, '02-formulario-diagnostico');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page).toHaveURL(/\/gracias$/);
  await expect(page.getByRole('heading', { name: 'Recibimos tu solicitud' })).toBeVisible();

  // ── 5. CRM: ventas ve el lead con canal Google ──
  const crm = await (await browser.newContext()).newPage();
  await login(crm, 'ventas@ti24.example');
  await crm.getByRole('link', { name: 'Leads' }).click();
  const row = crm.getByRole('row', { name: /Contacto Demo/ });
  await expect(row).toContainText('Aceros Demo SA de CV');
  await expect(row).toContainText('Google');
  await expect(row).toContainText('Nuevo');
  await shot(crm, '03-crm-bandeja-leads');
  await row.getByRole('link', { name: 'Contacto Demo' }).click();
  await expect(crm.getByText('Google / organic')).toBeVisible();
  await expect(crm.getByText('Landing /desarrollo-de-software')).toBeVisible();

  // ── 6. Registrar llamada (pasa a contactado) → calificar → convertir con SYS + MNT ──
  await crm.getByLabel('Asunto').fill('Llamada de diagnóstico');
  await crm.getByRole('button', { name: 'Registrar actividad' }).click();
  await expect(crm.getByText('Actividad registrada.')).toBeVisible();
  await crm.getByRole('button', { name: 'Marcar calificado' }).click();
  await expect(crm.getByRole('heading', { name: 'Convertir en cuenta y oportunidad' })).toBeVisible();
  await crm.getByLabel('Título de la oportunidad').fill('Sistema de cotizaciones');
  await crm.getByRole('checkbox', { name: /Mantenimiento/ }).first().check();
  await shot(crm, '04-crm-lead-convertir');
  await crm.getByRole('button', { name: 'Convertir' }).click();
  await expect(crm.getByText('Lead convertido')).toBeVisible();
  await expect(crm.getByRole('heading', { level: 1 })).toHaveText('Sistema de cotizaciones');

  // ── 7. Regla: no se puede ganar sin propuesta aceptada ──
  await crm.getByRole('button', { name: 'Marcar ganada' }).click();
  await expect(crm.getByText('Para ganar se necesita una propuesta aceptada.')).toBeVisible();

  // ── 8. Propuesta: precios → enviada → aceptada ──
  await crm.getByRole('button', { name: 'Nueva propuesta' }).click();
  await expect(crm.getByText('Propuesta creada en borrador')).toBeVisible();
  const sysRow = crm.getByRole('row', { name: /SYS/ });
  await sysRow.getByLabel('Descripción').fill('Desarrollo del sistema de cotizaciones');
  await sysRow.getByLabel('Precio unitario').fill('120000');
  await sysRow.getByRole('button', { name: /Guardar/ }).click();
  await expect(crm.getByText('Línea actualizada.')).toBeVisible();
  const mntRow = crm.getByRole('row', { name: /MNT/ });
  await mntRow.getByLabel('Precio unitario').fill('2000');
  await mntRow.getByRole('button', { name: /Guardar/ }).click();
  await expect(crm.getByText('Línea actualizada.')).toBeVisible();
  await expect(crm.getByRole('row', { name: /Total pago único/ })).toContainText('120,000.00');
  await expect(crm.getByRole('row', { name: /Total mensual/ })).toContainText('2,000.00');
  await shot(crm, '05-crm-propuesta-borrador');
  await crm.getByRole('button', { name: 'Marcar como enviada' }).click();
  await expect(crm.getByText('Propuesta marcada como enviada.')).toBeVisible();
  await crm.getByRole('button', { name: 'Cliente aceptó' }).click();
  await expect(crm.getByText('Propuesta aceptada.')).toBeVisible();

  // ── 9. Ganar → proyecto creado; la cuenta queda como cliente ──
  await crm.getByRole('link', { name: 'Sistema de cotizaciones' }).first().click();
  await crm.getByRole('button', { name: 'Marcar ganada' }).click();
  await expect(crm.getByText('Oportunidad ganada. Se creó el proyecto.')).toBeVisible();
  await expect(crm.getByRole('link', { name: /Proyecto: Sistema de cotizaciones/ })).toBeVisible();
  await shot(crm, '06-crm-oportunidad-ganada');
  await crm.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await expect(crm.getByRole('row', { name: /Sistema de cotizaciones/ })).toContainText('Aceros Demo SA de CV');
  await crm.getByRole('link', { name: 'Aceros Demo SA de CV' }).click();
  await expect(crm.getByText('Cliente', { exact: true })).toBeVisible();
  await expect(crm.getByText('Software a medida · contratado')).toBeVisible();
  await shot(crm, '07-crm-ficha-360');

  // ── 10. Tablero: canal → ingreso ──
  await crm.getByRole('link', { name: 'Tablero', exact: true }).click();
  await crm.getByRole('link', { name: 'Todo' }).click();
  const revenue = crm.getByRole('region', { name: 'Ingreso ganado por canal' });
  await expect(revenue.getByRole('row', { name: /Google/ })).toContainText('120,000.00');
  await expect(crm.locator('.kpi', { hasText: 'Tasa de cierre' })).toContainText('Datos insuficientes (1 de 5)');
  await shot(crm, '08-crm-tablero');

  // ── 11. Seguridad: ventas no ve la auditoría; admin sí, con cada paso registrado ──
  await expect(crm.getByRole('link', { name: 'Auditoría' })).toHaveCount(0);
  await crm.goto(`${CRM}/auditoria`);
  await expect(crm.getByText('Solo un administrador puede ver esa sección.')).toBeVisible();
  const admin = await (await browser.newContext()).newPage();
  await login(admin, 'admin@ti24.example');
  await admin.getByRole('link', { name: 'Auditoría' }).click();
  for (const action of ['lead.created', 'lead.converted', 'proposal.accepted', 'opportunity.won', 'project.created']) {
    await expect(admin.getByRole('cell', { name: action, exact: true }).first()).toBeVisible();
  }
  await shot(admin, '09-crm-auditoria-admin');
});

import { defineConfig, devices } from '@playwright/test';

/**
 * E2E del P0: Google → /desarrollo-de-software → /diagnostico → Lead → Oportunidad → Propuesta → Ganada → Proyecto.
 * Local: levanta web (3000) y CRM (3001) contra E2E_DATABASE_URL (se reinicia antes de correr).
 * Contra un Vercel Preview: definir WEB_URL y CRM_URL y omitir los servidores locales.
 */
const DB = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ti24_e2e';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const CRM = process.env.CRM_URL ?? 'http://localhost:3001';
const local = !process.env.WEB_URL;
const env = {
  DATABASE_URL: DB,
  TENANT_ID: '00000000-0000-0000-0000-000000000001',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-0123456789',
  CRM_DEMO_PASSWORD: process.env.CRM_DEMO_PASSWORD ?? 'demo-e2e-2026',
  NEXT_PUBLIC_SITE_URL: WEB,
  LEAD_RATE_LIMIT: '1000', // las pruebas envían muchos formularios desde la misma IP
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: local ? './tests/e2e/global-setup.ts' : undefined,
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /web\.spec\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  metadata: { WEB, CRM },
  webServer: local
    ? [
        { command: 'pnpm --filter @ti24/web start', url: `${WEB}/`, env, reuseExistingServer: false, timeout: 120_000 },
        { command: 'pnpm --filter @ti24/crm start', url: `${CRM}/login`, env, reuseExistingServer: false, timeout: 120_000 },
      ]
    : undefined,
});

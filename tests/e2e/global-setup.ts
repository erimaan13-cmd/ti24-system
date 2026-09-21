import { execFileSync } from 'node:child_process';

export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ti24_e2e';
  execFileSync('node', ['scripts/migrate.mjs', '--reset', '--seed'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}

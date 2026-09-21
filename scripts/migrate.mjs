#!/usr/bin/env node
// Aplica supabase/migrations/*.sql en orden y registra cuáles ya corrieron.
// Uso: DATABASE_URL=... node scripts/migrate.mjs [--reset] [--seed]
//  --reset  borra y recrea el esquema (SOLO local; se niega si la URL no es localhost)
//  --seed   aplica supabase/seed.sql al final
// Si la base no tiene esquema "auth" (Postgres puro), aplica supabase/local/auth_stub.sql.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL'); process.exit(1); }
const args = new Set(process.argv.slice(2));
const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  if (args.has('--reset')) {
    if (!isLocal) throw new Error('--reset solo se permite contra una base local');
    await sql.unsafe(`drop schema if exists public cascade; drop schema if exists app_private cascade;
      drop schema if exists auth cascade; create schema public; grant all on schema public to public;`);
    console.log('RESET_OK');
  }
  const [{ has_auth }] = await sql`select exists(select 1 from pg_namespace where nspname = 'auth') as has_auth`;
  if (!has_auth) {
    await sql.unsafe(readFileSync(join(root, 'supabase/local/auth_stub.sql'), 'utf8'));
    console.log('AUTH_STUB_OK (Postgres local)');
  }
  await sql`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from public.schema_migrations`).map((r) => r.name));
  const dir = join(root, 'supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), 'utf8'));
      await tx`insert into public.schema_migrations(name) values (${file})`;
    });
    console.log(`MIGRATION_OK ${file}`);
  }
  if (args.has('--seed')) {
    await sql.unsafe(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
    console.log('SEED_OK');
  }
} catch (e) {
  console.error('MIGRATION_FAILED', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

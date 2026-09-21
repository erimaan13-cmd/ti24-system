-- TI24 Commercial & Operations System — migración 0001 (P0)
-- Postgres 15+ / Supabase. Todas las tablas de negocio llevan tenant_id (regla AT-05).
-- Fuente: AT-13 Apéndice A (verificada en PostgreSQL 16 el 21-sep-2026).
create extension if not exists pgcrypto;

-- ============ Catálogos y seguridad ============
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type app_role as enum ('admin','sales');

create table app_users (               -- perfil; en Supabase id = auth.users.id
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  full_name text not null,
  email text not null,
  role app_role not null default 'sales',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table services (                -- catálogo SYNC 2 (códigos compartidos con la web)
  tenant_id uuid not null references tenants(id),
  code text not null,                  -- DIAG, WEB, SYS, APP, MNT, MKT, SOC, EDU-IC, EDU-OP...
  name_es text not null,
  name_en text,
  line text not null check (line in ('entrada','captar','construir','sostener','capacitar')),
  revenue_model text not null check (revenue_model in ('project','recurring','education','package')),
  active boolean not null default true,
  primary key (tenant_id, code)
);

create table pipeline_stages (
  tenant_id uuid not null references tenants(id),
  code text not null,                  -- discovery, proposal, negotiation, won, lost
  name_es text not null,
  position int not null,
  is_closed boolean not null default false,
  is_won boolean not null default false,
  primary key (tenant_id, code)
);

-- ============ Web (anónimo, sin datos personales) ============
create table web_sessions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  anonymous_id uuid not null,
  started_at timestamptz not null default now(),
  landing_path text,
  referrer text,
  source text, medium text, campaign text, content text, term text,
  device text                          -- resumen, no user-agent completo
);
create index on web_sessions (tenant_id, anonymous_id);

create table web_events (
  event_id uuid primary key,           -- idempotencia: el mismo id no entra dos veces
  tenant_id uuid not null references tenants(id),
  session_id uuid references web_sessions(id),
  anonymous_id uuid not null,
  event_name text not null check (event_name in (
    'PAGE_VIEWED','SERVICE_VIEWED','CTA_CLICKED','FORM_STARTED','FORM_SUBMITTED',
    'DIAGNOSTIC_REQUESTED','QUOTE_REQUESTED','MEETING_REQUESTED','RESOURCE_DOWNLOADED',
    'COURSE_VIEWED','COURSE_INTERESTED','COURSE_ENROLLED')),
  schema_version int not null default 1,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  page_path text,
  service_code text,
  metadata jsonb not null default '{}'::jsonb
);
create index on web_events (tenant_id, anonymous_id, occurred_at);

-- ============ Comercial ============
create table accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  domain text,                          -- dominio corporativo (no gmail/hotmail)
  country text default 'MX',
  lifecycle text not null default 'prospect' check (lifecycle in ('prospect','customer','former')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index accounts_domain_uq on accounts (tenant_id, lower(domain)) where domain is not null;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  account_id uuid references accounts(id),
  full_name text not null,
  email text,
  phone text,
  job_title text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index contacts_email_uq on contacts (tenant_id, lower(email)) where email is not null;

create table touches (                 -- cada contacto atribuible
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  anonymous_id uuid,
  occurred_at timestamptz not null,
  source text not null default 'direct',
  medium text not null default 'none',
  platform text,
  campaign text, content text, term text,
  landing_path text, referrer text,
  ref_code text,                       -- código REF de WhatsApp
  kind text not null default 'web' check (kind in ('web','whatsapp','manual','referral','event'))
);

create table form_submissions (        -- carga cruda e inmutable (auditoría y reproceso)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  form_id text not null,
  event_id uuid unique,
  anonymous_id uuid,
  payload jsonb not null,
  privacy_accepted boolean not null,
  received_at timestamptz not null default now(),
  check (privacy_accepted)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  status text not null default 'new' check (status in ('new','contacted','qualified','disqualified','converted','duplicate')),
  intent text not null default 'contact' check (intent in ('diagnostic','quote','meeting','contact','course')),
  full_name text not null,
  email text not null,
  phone text,
  company text,
  service_code text,
  message text,
  lang text not null default 'es',
  form_submission_id uuid references form_submissions(id),
  first_touch_id uuid references touches(id),
  last_touch_id uuid references touches(id),
  duplicate_of uuid references leads(id),
  converted_account_id uuid references accounts(id),
  converted_contact_id uuid references contacts(id),
  owner_id uuid references app_users(id),
  first_response_due_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, service_code) references services(tenant_id, code)
);
create index on leads (tenant_id, status, created_at desc);
create index on leads (tenant_id, lower(email));

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  account_id uuid not null references accounts(id),
  primary_contact_id uuid references contacts(id),
  lead_id uuid references leads(id),
  title text not null,
  type text not null default 'new' check (type in ('new','upsell','cross_sell','renewal')),
  stage_code text not null,
  amount numeric(12,2),
  currency text not null default 'MXN' check (currency in ('MXN','USD')),
  expected_close date,
  lost_reason text,
  -- atribución congelada al crear
  first_touch_source text, first_touch_medium text, first_touch_campaign text, first_touch_landing text,
  last_touch_source text,  last_touch_medium text,  last_touch_campaign text,  last_touch_landing text,
  owner_id uuid references app_users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, stage_code) references pipeline_stages(tenant_id, code),
  check (stage_code <> 'lost' or lost_reason is not null)
);
create index on opportunities (tenant_id, stage_code);

create table opportunity_services (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  tenant_id uuid not null,
  service_code text not null,
  primary key (opportunity_id, service_code),
  foreign key (tenant_id, service_code) references services(tenant_id, code)
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  kind text not null check (kind in ('call','meeting','email','note','whatsapp')),
  subject text not null,
  body text,
  occurred_at timestamptz not null default now(),
  lead_id uuid references leads(id),
  account_id uuid references accounts(id),
  opportunity_id uuid references opportunities(id),
  created_by uuid references app_users(id),
  check (num_nonnulls(lead_id, account_id, opportunity_id) >= 1)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  title text not null,
  due_at timestamptz not null,
  done_at timestamptz,
  assignee_id uuid references app_users(id),
  lead_id uuid references leads(id),
  opportunity_id uuid references opportunities(id),
  created_at timestamptz not null default now()
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  opportunity_id uuid not null references opportunities(id),
  folio text not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  valid_until date,
  currency text not null default 'MXN',
  sent_at timestamptz, decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, folio)
);

create table proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  tenant_id uuid not null,
  service_code text not null,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  billing text not null default 'one_time' check (billing in ('one_time','monthly')),
  foreign key (tenant_id, service_code) references services(tenant_id, code)
);

create table projects (                -- se crea al ganar una oportunidad de tipo proyecto
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  account_id uuid not null references accounts(id),
  opportunity_id uuid not null unique references opportunities(id),
  name text not null,
  status text not null default 'planned' check (status in ('planned','active','on_hold','delivered','cancelled')),
  repo_url text,                       -- referencia, no gestión técnica
  created_at timestamptz not null default now()
);

-- ============ Auditoría (solo agregar) ============
create table audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  actor_id uuid,                       -- null = sistema / web
  action text not null,                -- lead.created, opportunity.stage_changed, ...
  entity text not null,
  entity_id uuid,
  before jsonb, after jsonb,
  at timestamptz not null default now()
);
create or replace function forbid_audit_mutation() returns trigger language plpgsql as $$
begin raise exception 'audit_events es solo de agregar (append-only)'; end $$;
create trigger audit_no_update before update or delete on audit_events
  for each row execute function forbid_audit_mutation();

-- ============ RLS (en Supabase: tenant del usuario autenticado) ============
do $$ declare t text; begin
  foreach t in array array['app_users','services','pipeline_stages','web_sessions','web_events','accounts',
    'contacts','touches','form_submissions','leads','opportunities','opportunity_services','activities',
    'tasks','proposals','proposal_items','projects','audit_events'] loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;
-- Las políticas concretas (tenant_id = tenant del usuario; ventas no borra ni lee auditoría)
-- van en 0002_policies.sql porque dependen de auth.uid() de Supabase.

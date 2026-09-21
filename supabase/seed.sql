-- TI24 — datos base (catálogos + usuarios demo). Idempotente.
-- Los usuarios demo solo sirven en modo demo; con Supabase Auth, app_users.id = auth.users.id.
insert into tenants(id, name) values ('00000000-0000-0000-0000-000000000001', 'TI24')
  on conflict (id) do nothing;

-- Catálogo SYNC 2 (D-12). Códigos compartidos con la web (packages/contracts).
insert into services(tenant_id, code, name_es, name_en, line, revenue_model) values
  ('00000000-0000-0000-0000-000000000001','DIAG','Diagnóstico','Assessment','entrada','package'),
  ('00000000-0000-0000-0000-000000000001','WEB','Sitios web','Websites','captar','project'),
  ('00000000-0000-0000-0000-000000000001','MKT','Marketing digital','Digital marketing','captar','recurring'),
  ('00000000-0000-0000-0000-000000000001','SOC','Gestión de redes','Social media','captar','recurring'),
  ('00000000-0000-0000-0000-000000000001','SYS','Software a medida','Custom software','construir','project'),
  ('00000000-0000-0000-0000-000000000001','APP','Aplicaciones','Apps','construir','project'),
  ('00000000-0000-0000-0000-000000000001','MNT','Mantenimiento y soporte','Maintenance & support','sostener','recurring'),
  ('00000000-0000-0000-0000-000000000001','EDU-IC','Capacitación in-company','In-company training','capacitar','education'),
  ('00000000-0000-0000-0000-000000000001','EDU-OP','Cursos abiertos','Open courses','capacitar','education')
on conflict (tenant_id, code) do nothing;

insert into pipeline_stages(tenant_id, code, name_es, position, is_closed, is_won) values
  ('00000000-0000-0000-0000-000000000001','discovery','Diagnóstico',1,false,false),
  ('00000000-0000-0000-0000-000000000001','proposal','Propuesta',2,false,false),
  ('00000000-0000-0000-0000-000000000001','negotiation','Negociación',3,false,false),
  ('00000000-0000-0000-0000-000000000001','won','Ganada',4,true,true),
  ('00000000-0000-0000-0000-000000000001','lost','Perdida',5,true,false)
on conflict (tenant_id, code) do nothing;

insert into app_users(id, tenant_id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-000000000001','Admin Demo','admin@ti24.example','admin'),
  ('00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-000000000001','Ventas Demo','ventas@ti24.example','sales')
on conflict (id) do nothing;

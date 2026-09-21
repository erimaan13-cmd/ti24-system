-- TI24 — migración 0002: políticas RLS (Row Level Security)
-- Regla: cada usuario autenticado solo ve y modifica filas de SU tenant.
--        El rol «sales» no borra nada y no lee la auditoría. Solo «admin» borra.
-- Depende de auth.uid() (Supabase). En local se usa supabase/local/auth_stub.sql.
-- La ingesta web (/api/events, /api/leads) corre con el rol dueño de las tablas
-- (servidor), que no pasa por RLS; el navegador nunca habla directo con la base.

create schema if not exists app_private;
revoke all on schema app_private from public;

-- Tenant y rol del usuario autenticado. SECURITY DEFINER evita la recursión de RLS sobre app_users.
create or replace function app_private.current_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.app_users where id = auth.uid() and active
$$;

create or replace function app_private.current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.app_users where id = auth.uid() and active
$$;

grant usage on schema app_private to authenticated;
grant execute on function app_private.current_tenant_id() to authenticated;
grant execute on function app_private.current_app_role() to authenticated;

-- Permisos base de tabla (RLS decide QUÉ filas). anon no recibe nada.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ─── Tablas de negocio: leer/crear/editar dentro del tenant; borrar solo admin ───
do $$ declare t text; begin
  foreach t in array array['accounts','contacts','leads','opportunities','opportunity_services',
    'activities','tasks','proposals','proposal_items','projects','touches'] loop
    execute format('create policy %I on %I for select to authenticated using (tenant_id = app_private.current_tenant_id())', t || '_sel', t);
    execute format('create policy %I on %I for insert to authenticated with check (tenant_id = app_private.current_tenant_id())', t || '_ins', t);
    execute format('create policy %I on %I for update to authenticated using (tenant_id = app_private.current_tenant_id()) with check (tenant_id = app_private.current_tenant_id())', t || '_upd', t);
    execute format('create policy %I on %I for delete to authenticated using (tenant_id = app_private.current_tenant_id() and app_private.current_app_role() = ''admin'')', t || '_del', t);
  end loop; end $$;

-- ─── Catálogos: todos leen; solo admin modifica ───
do $$ declare t text; begin
  foreach t in array array['services','pipeline_stages'] loop
    execute format('create policy %I on %I for select to authenticated using (tenant_id = app_private.current_tenant_id())', t || '_sel', t);
    execute format('create policy %I on %I for all to authenticated using (tenant_id = app_private.current_tenant_id() and app_private.current_app_role() = ''admin'') with check (tenant_id = app_private.current_tenant_id() and app_private.current_app_role() = ''admin'')', t || '_admin', t);
  end loop; end $$;

-- ─── Usuarios: todos ven a su equipo; solo admin crea o edita ───
create policy app_users_sel on app_users for select to authenticated
  using (tenant_id = app_private.current_tenant_id());
create policy app_users_admin on app_users for all to authenticated
  using (tenant_id = app_private.current_tenant_id() and app_private.current_app_role() = 'admin')
  with check (tenant_id = app_private.current_tenant_id() and app_private.current_app_role() = 'admin');

-- ─── Datos crudos de la web: el CRM solo los lee (los escribe el servidor de la web) ───
do $$ declare t text; begin
  foreach t in array array['web_sessions','web_events','form_submissions'] loop
    execute format('create policy %I on %I for select to authenticated using (tenant_id = app_private.current_tenant_id())', t || '_sel', t);
  end loop; end $$;

-- ─── Auditoría: cualquiera del tenant agrega como sí mismo; solo admin lee ───
-- (UPDATE y DELETE ya están bloqueados para todos por el trigger audit_no_update.)
create policy audit_ins on audit_events for insert to authenticated
  with check (tenant_id = app_private.current_tenant_id() and actor_id = auth.uid());
create policy audit_sel_admin on audit_events for select to authenticated
  using (tenant_id = app_private.current_tenant_id() and app_private.current_app_role() = 'admin');
revoke update, delete on audit_events from authenticated;

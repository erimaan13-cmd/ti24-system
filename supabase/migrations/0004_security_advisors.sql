-- TI24 — migración 0004: correcciones del asesor de seguridad de Supabase (21-sep-2026).
-- 1) tenants no tenía RLS (el asesor lo marcó como ERROR). Cada usuario solo ve su propio tenant.
alter table tenants enable row level security;
create policy tenants_sel_own on tenants for select to authenticated
  using (id = app_private.current_tenant_id());
-- 2) search_path fijo en la función del trigger de auditoría (advertencia del asesor).
alter function public.forbid_audit_mutation() set search_path = public;

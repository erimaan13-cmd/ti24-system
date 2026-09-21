-- TI24 — migración 0003: ajustes del P0 encontrados al construir (no cambian 0001).
-- 1) Deduplicación por dominio: el lead sugiere una cuenta existente sin fusionarla (AT-11 §22).
alter table leads add column suggested_account_id uuid references accounts(id);
-- 2) Campos opcionales del formulario de diagnóstico (AT-11 §11).
alter table leads add column company_size text
  check (company_size is null or company_size in ('1-9','10-49','50-199','200+'));
alter table leads add column marketing_consent boolean not null default false;
-- 3) Motivo de descalificación visible en la bandeja.
alter table leads add column disqualified_reason text;
alter table leads add constraint leads_disqualified_reason_ck
  check (status <> 'disqualified' or disqualified_reason is not null);
-- 4) Búsqueda rápida del CRM.
create index accounts_name_idx on accounts (tenant_id, lower(name));
create index opportunities_created_idx on opportunities (tenant_id, created_at desc);
create index tasks_open_idx on tasks (tenant_id, due_at) where done_at is null;
-- 5) Excepciones acotadas a «ventas no borra»: editar documentos abiertos, no registros de negocio.
--    Se puede quitar una línea de una propuesta en BORRADOR y un servicio de una oportunidad ABIERTA.
create policy proposal_items_del_draft on proposal_items for delete to authenticated
  using (tenant_id = app_private.current_tenant_id()
         and exists (select 1 from proposals p where p.id = proposal_id and p.status = 'draft'));
create policy opportunity_services_del_open on opportunity_services for delete to authenticated
  using (tenant_id = app_private.current_tenant_id()
         and exists (select 1 from opportunities o where o.id = opportunity_id and o.stage_code not in ('won','lost')));

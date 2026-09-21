import { asSystem, asUser, type Actor, type Sql } from './client';

/** Busca un usuario activo por correo (login). Corre como sistema porque aún no hay sesión. */
export async function findActiveUserByEmail(tenant: string, email: string, sql?: Sql): Promise<Actor | null> {
  return asSystem(async (tx) => {
    const [u] = await tx<{ id: string; tenant_id: string; role: 'admin' | 'sales'; full_name: string; email: string }[]>`
      select id, tenant_id, role, full_name, email from app_users
      where tenant_id = ${tenant} and lower(email) = ${email.trim().toLowerCase()} and active`;
    return u ? { id: u.id, tenantId: u.tenant_id, role: u.role, fullName: u.full_name, email: u.email } : null;
  }, sql);
}

/** Relee el usuario de la sesión (si lo desactivaron, la sesión deja de valer). */
export async function reloadActor(id: string, sql?: Sql): Promise<Actor | null> {
  return asSystem(async (tx) => {
    const [u] = await tx<{ id: string; tenant_id: string; role: 'admin' | 'sales'; full_name: string; email: string }[]>`
      select id, tenant_id, role, full_name, email from app_users where id = ${id} and active`;
    return u ? { id: u.id, tenantId: u.tenant_id, role: u.role, fullName: u.full_name, email: u.email } : null;
  }, sql);
}

export async function listUsers(actor: Actor, sql?: Sql) {
  return asUser(actor, (tx) => tx<{ id: string; full_name: string; role: string }[]>`
    select id, full_name, role from app_users where active order by full_name`, sql);
}

export async function listServices(actor: Actor, sql?: Sql) {
  return asUser(actor, (tx) => tx<{ code: string; name_es: string; line: string; revenue_model: string }[]>`
    select code, name_es, line, revenue_model from services where active order by line, code`, sql);
}

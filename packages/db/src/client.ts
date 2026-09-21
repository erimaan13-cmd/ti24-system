/**
 * Conexión a Postgres/Supabase y los dos modos de ejecución:
 *  - asSystem: servidor de la web (ingesta). Corre como dueño de las tablas; valida todo antes.
 *  - asUser:   CRM. Cambia al rol `authenticated` con el id del usuario en el JWT simulado,
 *              así las políticas RLS de 0002 se aplican DE VERDAD en cada consulta del CRM.
 */
import postgres from 'postgres';

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
export type AppRole = 'admin' | 'sales';

export interface Actor {
  id: string;
  tenantId: string;
  role: AppRole;
  fullName: string;
  email: string;
}

/** Error de regla de negocio: el mensaje se muestra tal cual a la persona usuaria. */
export class DomainError extends Error {
  constructor(message: string, public readonly issues: string[] = [message]) {
    super(message);
    this.name = 'DomainError';
  }
}

const globalForSql = globalThis as unknown as { __ti24Sql?: Sql; __ti24SqlUrl?: string };

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no está configurada');
  if (!globalForSql.__ti24Sql || globalForSql.__ti24SqlUrl !== url) {
    globalForSql.__ti24Sql = postgres(url, {
      max: Number(process.env.DB_POOL_MAX ?? 5),
      prepare: false, // requerido por el pooler de Supabase en modo transacción
      idle_timeout: 20,
      onnotice: () => {},
    });
    globalForSql.__ti24SqlUrl = url;
  }
  return globalForSql.__ti24Sql;
}

export function tenantId(): string {
  return process.env.TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
}

export async function asSystem<T>(fn: (tx: Tx) => Promise<T>, sql: Sql = getSql()): Promise<T> {
  return sql.begin((tx) => fn(tx)) as Promise<T>;
}

export async function asUser<T>(actor: Actor, fn: (tx: Tx) => Promise<T>, sql: Sql = getSql()): Promise<T> {
  return sql.begin(async (tx) => {
    const claims = JSON.stringify({ sub: actor.id, role: 'authenticated' });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

export async function audit(
  tx: Tx,
  a: { tenantId: string; actorId: string | null },
  action: string,
  entity: string,
  entityId: string | null,
  before: unknown = null,
  after: unknown = null,
) {
  await tx`insert into audit_events (tenant_id, actor_id, action, entity, entity_id, before, after)
           values (${a.tenantId}, ${a.actorId}, ${action}, ${entity}, ${entityId},
                   ${before === null ? null : tx.json(before as never)}, ${after === null ? null : tx.json(after as never)})`;
}

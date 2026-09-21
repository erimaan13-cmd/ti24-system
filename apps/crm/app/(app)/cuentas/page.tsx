import Link from 'next/link';
import { listAccounts } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { flashFrom, fmtDate } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { DemoTag } from '@/components/bits';
import { Badge } from '@ti24/ui';

export const metadata = { title: 'Cuentas' };
type SP = Promise<Record<string, string | string[] | undefined>>;
const LIFECYCLE: Record<string, { l: string; t?: 'ok' | 'amber' }> = { prospect: { l: 'Prospecto', t: 'amber' }, customer: { l: 'Cliente', t: 'ok' }, former: { l: 'Excliente' } };

export default async function AccountsPage({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const { error, ok, one, params } = await flashFrom(searchParams);
  const q = one(params.q) ?? '';
  const accounts = await listAccounts(actor, q);
  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head"><div><h1>Cuentas</h1><p className="muted small">«Cliente» es un estado de la cuenta, no una etapa del pipeline.</p></div></div>
      <form className="filters" role="search"><div className="field" style={{ flex: 1, maxWidth: 420 }}><label htmlFor="a-q">Buscar</label><input id="a-q" name="q" className="input" defaultValue={q} placeholder="Nombre o dominio" /></div><button className="btn btn-secondary btn-sm">Buscar</button></form>
      {accounts.length === 0 ? <p className="empty">Sin cuentas. Se crean al convertir un lead calificado.</p> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Cuenta</th><th>Dominio</th><th>Estado</th><th className="num">Oport. abiertas</th><th className="num">Proyectos</th><th>Alta</th></tr></thead>
          <tbody>{accounts.map((a) => (
            <tr key={a.id}><td><Link href={`/cuentas/${a.id}`}>{a.name}</Link> <DemoTag on={a.is_demo} /></td><td className="small mono">{a.domain ?? '—'}</td>
              <td><Badge tone={LIFECYCLE[a.lifecycle]?.t}>{LIFECYCLE[a.lifecycle]?.l ?? a.lifecycle}</Badge></td><td className="num">{a.open_opps}</td><td className="num">{a.projects}</td><td className="small">{fmtDate(a.created_at)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

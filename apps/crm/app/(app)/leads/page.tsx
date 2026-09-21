import Link from 'next/link';
import { listLeads } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { flashFrom, fmtDateTime, LEAD_STATUS, sourceLabel } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { LeadBadge, ServiceTags } from '@/components/bits';

export const metadata = { title: 'Leads' };
type SP = Promise<Record<string, string | string[] | undefined>>;
const STATUS_OPTS = [['open', 'Abiertos'], ['all', 'Todos'], ...Object.entries(LEAD_STATUS).map(([k, v]) => [k, v.label])] as const;

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const { error, ok, one, params } = await flashFrom(searchParams);
  const status = (one(params.status) ?? 'open') as never;
  const q = one(params.q) ?? '';
  const source = one(params.source) ?? '';
  const leads = await listLeads(actor, { status, q, source: source || undefined });
  const now = Date.now();
  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head"><div><h1>Bandeja de leads</h1><p className="muted small">Solicitudes que llegan del sitio y de captura manual.</p></div></div>
      <form className="filters" role="search" aria-label="Filtrar leads">
        <div className="field"><label htmlFor="f-status">Estado</label>
          <select id="f-status" name="status" className="select" defaultValue={status}>{STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="field"><label htmlFor="f-source">Canal</label>
          <input id="f-source" name="source" className="input" defaultValue={source} placeholder="google, meta…" /></div>
        <div className="field" style={{ flex: 1 }}><label htmlFor="f-q">Buscar</label>
          <input id="f-q" name="q" className="input" defaultValue={q} placeholder="Nombre, correo o empresa" /></div>
        <button className="btn btn-secondary btn-sm" type="submit">Filtrar</button>
      </form>
      {leads.length === 0 ? <p className="empty">No hay leads con estos filtros.</p> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Lead</th><th>Empresa</th><th>Servicio</th><th>Canal</th><th>Estado</th><th>Recibido</th></tr></thead>
          <tbody>{leads.map((l) => {
            const late = l.status === 'new' && l.first_response_due_at && new Date(l.first_response_due_at).getTime() < now;
            return (
              <tr key={l.id}>
                <td><Link href={`/leads/${l.id}`}>{l.full_name}</Link><div className="muted xs">{l.email}</div></td>
                <td>{l.company ?? '—'}{l.suggested_account_name ? <div className="xs muted">Posible cuenta: {l.suggested_account_name}</div> : null}</td>
                <td>{l.service_code ? <ServiceTags codes={[l.service_code]} /> : '—'}</td>
                <td>{sourceLabel(l.source)}<div className="muted xs">{l.medium}</div></td>
                <td><LeadBadge s={l.status} />{late ? <div className="xs" style={{ color: 'var(--danger)' }}>Respuesta vencida</div> : null}</td>
                <td className="small">{fmtDateTime(l.created_at)}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}

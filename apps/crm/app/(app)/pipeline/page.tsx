import Link from 'next/link';
import { SERVICE_CODES } from '@ti24/contracts';
import { STAGES, type StageCode } from '@ti24/domain';
import { listOpportunities } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { flashFrom, fmtDate, money, SERVICE_LABEL, sourceLabel, stageLabel } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { DemoTag, ServiceTags, StageBadge } from '@/components/bits';

export const metadata = { title: 'Pipeline' };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PipelinePage({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const { error, ok, one, params } = await flashFrom(searchParams);
  const f = {
    stage: (STAGES as readonly string[]).includes(one(params.stage) ?? '') ? (one(params.stage) as StageCode) : undefined,
    service: one(params.service) || undefined,
    source: one(params.source) || undefined,
    from: /^\d{4}-\d{2}-\d{2}$/.test(one(params.from) ?? '') ? one(params.from)! : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(one(params.to) ?? '') ? one(params.to)! : undefined,
    q: one(params.q) || undefined,
  };
  const view = one(params.view) === 'lista' ? 'lista' : 'kanban';
  const opps = await listOpportunities(actor, f);
  const qs = new URLSearchParams(Object.entries({ ...f, stage: f.stage }).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head">
        <div><h1>Pipeline</h1><p className="muted small">{opps.length} oportunidad(es) · {money(opps.filter((o) => !['won', 'lost'].includes(o.stage_code)).reduce((a, o) => a + (o.amount ?? 0), 0))} abierto</p></div>
        <nav className="row" aria-label="Vista">
          <Link className={`btn btn-sm ${view === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} href={`/pipeline?${qs}`}>Tablero</Link>
          <Link className={`btn btn-sm ${view === 'lista' ? 'btn-primary' : 'btn-secondary'}`} href={`/pipeline?${qs}&view=lista`}>Lista</Link>
        </nav>
      </div>
      <form className="filters" role="search" aria-label="Filtrar oportunidades">
        <input type="hidden" name="view" value={view} />
        {view === 'lista' ? (
          <div className="field"><label htmlFor="p-stage">Etapa</label>
            <select id="p-stage" name="stage" className="select" defaultValue={f.stage ?? ''}><option value="">Todas</option>{STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}</select></div>
        ) : null}
        <div className="field"><label htmlFor="p-service">Servicio</label>
          <select id="p-service" name="service" className="select" defaultValue={f.service ?? ''}><option value="">Todos</option>{SERVICE_CODES.map((c) => <option key={c} value={c}>{SERVICE_LABEL[c]}</option>)}</select></div>
        <div className="field"><label htmlFor="p-source">Canal</label><input id="p-source" name="source" className="input" defaultValue={f.source ?? ''} placeholder="google…" /></div>
        <div className="field"><label htmlFor="p-from">Desde</label><input id="p-from" name="from" type="date" className="input" defaultValue={f.from ?? ''} /></div>
        <div className="field"><label htmlFor="p-to">Hasta</label><input id="p-to" name="to" type="date" className="input" defaultValue={f.to ?? ''} /></div>
        <div className="field" style={{ flex: 1 }}><label htmlFor="p-q">Buscar</label><input id="p-q" name="q" className="input" defaultValue={f.q ?? ''} placeholder="Título o cuenta" /></div>
        <button className="btn btn-secondary btn-sm" type="submit">Filtrar</button>
      </form>

      {view === 'kanban' ? (
        <div className="kanban">
          {STAGES.map((s) => {
            const col = opps.filter((o) => o.stage_code === s);
            return (
              <section key={s} className="kanban-col" aria-labelledby={`col-${s}`}>
                <h2 id={`col-${s}`}><span>{stageLabel(s)}</span><span className="mono muted">{col.length} · {money(col.reduce((a, o) => a + (o.amount ?? 0), 0))}</span></h2>
                {col.length === 0 ? <p className="muted xs">Vacío</p> : col.map((o) => (
                  <Link key={o.id} href={`/oportunidades/${o.id}`} className="opp-card">
                    <strong>{o.title}</strong>
                    <span className="muted xs">{o.account_name} <DemoTag on={o.is_demo} /></span>
                    <span className="row" style={{ justifyContent: 'space-between' }}><ServiceTags codes={o.services} /><span className="mono xs">{money(o.amount, o.currency)}</span></span>
                    <span className="muted xs">{sourceLabel(o.first_touch_source)} · {fmtDate(o.created_at)}</span>
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      ) : opps.length === 0 ? <p className="empty">No hay oportunidades con estos filtros.</p> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Oportunidad</th><th>Cuenta</th><th>Etapa</th><th>Servicios</th><th>Canal</th><th className="num">Monto</th><th>Creada</th></tr></thead>
          <tbody>{opps.map((o) => (
            <tr key={o.id}>
              <td><Link href={`/oportunidades/${o.id}`}>{o.title}</Link></td>
              <td><Link href={`/cuentas/${o.account_id}`} style={{ fontWeight: 400 }}>{o.account_name}</Link> <DemoTag on={o.is_demo} /></td>
              <td><StageBadge s={o.stage_code} /></td>
              <td><ServiceTags codes={o.services} /></td>
              <td>{sourceLabel(o.first_touch_source)}</td>
              <td className="num">{money(o.amount, o.currency)}</td>
              <td className="small">{fmtDate(o.created_at)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

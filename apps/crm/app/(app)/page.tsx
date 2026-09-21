import Link from 'next/link';
import { Kpi } from '@ti24/ui';
import { dashboard } from '@ti24/db';
import { formatRatio } from '@ti24/domain';
import { requireActor } from '@/lib/auth';
import { flashFrom, money, sourceLabel, stageLabel } from '@/lib/format';
import { Flash } from '@/components/Flash';

export const metadata = { title: 'Tablero' };
type SP = Promise<Record<string, string | string[] | undefined>>;

const PERIODS = [{ v: '30', l: '30 días' }, { v: '90', l: '90 días' }, { v: 'all', l: 'Todo' }];

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const { error, ok, one, params } = await flashFrom(searchParams);
  const d = one(params.d) ?? '90';
  const days = d === 'all' ? null : Number(d) === 30 ? 30 : 90;
  const data = await dashboard(actor, days);
  const totalLeads = data.leadsBySource.reduce((a, r) => a + r.leads, 0);
  const maxLeads = Math.max(1, ...data.leadsBySource.map((r) => r.leads));

  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head">
        <div><h1>Tablero</h1><p className="muted small">Canal → lead → oportunidad → ingreso.</p></div>
        <nav className="row" aria-label="Periodo">
          {PERIODS.map((p) => (
            <Link key={p.v} href={`/?d=${p.v}`} className={`btn btn-sm ${d === p.v ? 'btn-primary' : 'btn-secondary'}`} aria-current={d === p.v ? 'true' : undefined}>{p.l}</Link>
          ))}
        </nav>
      </div>

      {(data.overdue.leads > 0 || data.overdue.tasks > 0) && (
        <p className="notice" style={{ marginBottom: 'var(--s-4)' }}>
          {data.overdue.leads > 0 && <><Link href="/leads?status=new">{data.overdue.leads} lead(s) nuevos</Link> sin primera respuesta a tiempo. </>}
          {data.overdue.tasks > 0 && <><Link href="/tareas">{data.overdue.tasks} tarea(s)</Link> vencidas.</>}
        </p>
      )}

      <div className="grid grid-5" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi label="Leads" value={totalLeads} note="Sin duplicados" />
        <Kpi label="Lead → oportunidad" value={data.leadConversion.sufficient ? formatRatio(data.leadConversion) : '—'} note={data.leadConversion.sufficient ? `${data.leadConversion.n} leads` : formatRatio(data.leadConversion)} />
        <Kpi label="Pipeline abierto" value={money(data.openValue)} note="Diagnóstico + propuesta + negociación" />
        <Kpi label="Ganado" value={money(data.won.value)} note={`${data.won.n} oportunidad(es)`} />
        <Kpi label="Tasa de cierre" value={data.winRate.sufficient ? formatRatio(data.winRate) : '—'} note={data.winRate.sufficient ? `${data.winRate.n} cerradas` : formatRatio(data.winRate)} />
      </div>

      <div className="grid grid-3">
        <section className="card" aria-labelledby="t-src">
          <h2 id="t-src" className="section-title">Leads por canal</h2>
          {data.leadsBySource.length === 0 ? <p className="empty">Sin datos todavía.</p> : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.leadsBySource.map((r) => (
                <li key={r.source} className="small">
                  <div className="row" style={{ justifyContent: 'space-between' }}><span>{sourceLabel(r.source)}</span><span className="mono">{r.leads}</span></div>
                  <div className="bar" aria-hidden="true"><span style={{ width: `${(r.leads / maxLeads) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="t-stage">
          <h2 id="t-stage" className="section-title">Oportunidades por etapa</h2>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Etapa</th><th className="num">#</th><th className="num">Valor</th></tr></thead>
            <tbody>{data.byStage.map((s) => (
              <tr key={s.stage_code}><td><Link href={`/pipeline?view=lista&stage=${s.stage_code}`}>{stageLabel(s.stage_code)}</Link></td><td className="num">{s.n}</td><td className="num">{money(s.value)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
        <section className="card" aria-labelledby="t-rev">
          <h2 id="t-rev" className="section-title">Ingreso ganado por canal</h2>
          {data.revenueByChannel.length === 0 ? <p className="empty">Aún no hay oportunidades ganadas.</p> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Canal (primer contacto)</th><th className="num">Ganadas</th><th className="num">Ingreso</th></tr></thead>
              <tbody>{data.revenueByChannel.map((r) => (
                <tr key={r.source}><td>{sourceLabel(r.source)}</td><td className="num">{r.won}</td><td className="num">{money(r.value)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      </div>
    </>
  );
}

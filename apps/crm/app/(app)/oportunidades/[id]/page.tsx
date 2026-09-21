import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SERVICE_CODES } from '@ti24/contracts';
import { OPEN_STAGES, STAGES } from '@ti24/domain';
import { getOpportunity, listActivities, listTasks } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { createProposalAction, servicesAction, stageAction, updateOpportunityAction } from '@/lib/actions';
import { flashFrom, fmtDate, fmtDateTime, money, SERVICE_LABEL, sourceLabel, stageLabel } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { ActivityForm, ActivityList, DemoTag, ProposalBadge, ServiceTags, StageBadge, TaskForm, TaskList } from '@/components/bits';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OpportunityPage({ params, searchParams }: Props) {
  const actor = await requireActor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { error, ok } = await flashFrom(searchParams);
  const data = await getOpportunity(actor, id);
  if (!data) notFound();
  const { opp, proposals, project, contact } = data;
  const [activities, tasks] = await Promise.all([listActivities(actor, { opportunityId: id }), listTasks(actor, { opportunityId: id })]);
  const closed = opp.stage_code === 'won' || opp.stage_code === 'lost';
  const back = `/oportunidades/${id}`;
  const stageIdx = STAGES.indexOf(opp.stage_code);
  const hasAccepted = proposals.some((p) => p.status === 'accepted');

  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head">
        <div>
          <p className="xs muted"><Link href="/pipeline">Pipeline</Link> / <Link href={`/cuentas/${opp.account_id}`}>{opp.account_name}</Link> <DemoTag on={opp.is_demo} /></p>
          <h1>{opp.title}</h1>
          <p className="row small" style={{ marginTop: 8 }}><StageBadge s={opp.stage_code} /> <ServiceTags codes={opp.services} /> <span className="mono">{money(opp.amount, opp.currency)}</span></p>
        </div>
        {project ? <Link className="btn btn-primary btn-sm" href="/proyectos">Proyecto: {project.name}</Link> : null}
      </div>
      <div className="stagebar" aria-hidden="true">
        {OPEN_STAGES.map((s, i) => <span key={s} className={opp.stage_code === 'won' || (!closed && stageIdx >= i) ? 'on' : ''} />)}
        <span className={opp.stage_code === 'won' ? 'won' : opp.stage_code === 'lost' ? 'lost' : ''} />
      </div>

      <div className="detail">
        <div>
          <section className="card" aria-labelledby="prop-t">
            <h2 id="prop-t" className="section-title">Propuestas
              {!closed ? (
                <form action={createProposalAction}><input type="hidden" name="opportunity_id" value={opp.id} /><button className="btn btn-secondary btn-sm" type="submit">Nueva propuesta</button></form>
              ) : null}
            </h2>
            {proposals.length === 0 ? <p className="empty">Sin propuestas. Crea una para poder ganar la oportunidad.</p> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Folio</th><th>Estado</th><th className="num">Pago único</th><th className="num">Mensual</th><th>Creada</th></tr></thead>
                <tbody>{proposals.map((p) => (
                  <tr key={p.id}><td><Link href={`/propuestas/${p.id}`} className="mono">{p.folio}</Link></td><td><ProposalBadge s={p.status} /></td>
                    <td className="num">{money(p.one_time, opp.currency)}</td><td className="num">{money(p.monthly, opp.currency)}</td><td className="small">{fmtDate(p.created_at)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>

          {!closed ? (
            <section className="card" aria-labelledby="stage-t">
              <h2 id="stage-t" className="section-title">Mover de etapa</h2>
              <div className="row">
                {STAGES.filter((s) => s !== opp.stage_code && s !== 'lost').map((s) => (
                  <form key={s} action={stageAction}>
                    <input type="hidden" name="id" value={opp.id} /><input type="hidden" name="to" value={s} />
                    <button className={`btn btn-sm ${s === 'won' ? 'btn-primary' : 'btn-secondary'}`} type="submit">
                      {s === 'won' ? 'Marcar ganada' : `A ${stageLabel(s).toLowerCase()}`}
                    </button>
                  </form>
                ))}
              </div>
              {!hasAccepted ? <p className="muted xs" style={{ marginTop: 8 }}>Para ganar se necesita una propuesta aceptada y un monto.</p> : null}
              <form action={stageAction} className="inline-form" style={{ marginTop: 'var(--s-3)' }}>
                <input type="hidden" name="id" value={opp.id} /><input type="hidden" name="to" value="lost" />
                <div className="field" style={{ flex: 1 }}><label htmlFor="lost">Motivo si se pierde</label><input id="lost" name="lost_reason" className="input" required minLength={3} placeholder="Ej. presupuesto, eligió otro proveedor" /></div>
                <button className="btn btn-danger btn-sm" type="submit">Marcar perdida</button>
              </form>
            </section>
          ) : opp.stage_code === 'lost' ? <p className="notice notice-danger">Perdida: {opp.lost_reason}</p> : null}

          <section className="card">
            <h2 className="section-title">Actividades</h2>
            <ActivityForm target={{ opportunityId: opp.id }} back={back} />
            <hr style={{ margin: 'var(--s-4) 0' }} />
            <ActivityList items={activities} />
          </section>
        </div>

        <div>
          <section className="card">
            <h2 className="section-title">Datos</h2>
            {!closed ? (
              <form action={updateOpportunityAction} className="form-grid">
                <input type="hidden" name="id" value={opp.id} />
                <div className="field"><label htmlFor="o-title">Título</label><input id="o-title" name="title" className="input" defaultValue={opp.title} /></div>
                <div className="field"><label htmlFor="o-amount">Monto ({opp.currency})</label><input id="o-amount" name="amount" type="number" min="0" step="0.01" className="input" defaultValue={opp.amount ?? ''} /></div>
                <div className="field"><label htmlFor="o-close">Cierre esperado</label><input id="o-close" name="expected_close" type="date" className="input" defaultValue={opp.expected_close ? new Date(opp.expected_close).toISOString().slice(0, 10) : ''} /></div>
                <div><button className="btn btn-secondary btn-sm" type="submit">Guardar</button></div>
              </form>
            ) : (
              <dl className="dl"><dt>Monto</dt><dd>{money(opp.amount, opp.currency)}</dd><dt>Cerrada</dt><dd>{fmtDateTime(opp.closed_at)}</dd></dl>
            )}
            <hr style={{ margin: 'var(--s-4) 0' }} />
            <dl className="dl">
              <dt>Contacto</dt><dd>{contact ? <>{contact.full_name}<br /><span className="muted xs">{contact.email}</span></> : '—'}</dd>
              <dt>Responsable</dt><dd>{opp.owner_name ?? '—'}</dd>
              <dt>Creada</dt><dd>{fmtDateTime(opp.created_at)}</dd>
              {opp.lead_id ? <><dt>Origen</dt><dd><Link href={`/leads/${opp.lead_id}`}>Lead original</Link></dd></> : null}
            </dl>
          </section>

          <section className="card">
            <h2 className="section-title">Servicios</h2>
            {!closed ? (
              <form action={servicesAction} className="form-grid">
                <input type="hidden" name="id" value={opp.id} />
                <div className="checkgrid" style={{ gridTemplateColumns: '1fr' }}>
                  {SERVICE_CODES.map((c) => <label key={c} className="check"><input type="checkbox" name="services" value={c} defaultChecked={opp.services.includes(c)} /> <span>{SERVICE_LABEL[c]} <span className="tag">{c}</span></span></label>)}
                </div>
                <div><button className="btn btn-secondary btn-sm" type="submit">Guardar servicios</button></div>
              </form>
            ) : <ServiceTags codes={opp.services} />}
          </section>

          <section className="card">
            <h2 className="section-title">Atribución (congelada)</h2>
            <dl className="dl">
              <dt>Primer contacto</dt><dd>{sourceLabel(opp.first_touch_source)} / {opp.first_touch_medium}<br /><span className="muted xs">{opp.first_touch_landing}</span></dd>
              <dt>Último contacto</dt><dd>{sourceLabel(opp.last_touch_source)} / {opp.last_touch_medium}</dd>
            </dl>
          </section>

          <section className="card">
            <h2 className="section-title">Tareas</h2>
            {!closed ? <TaskForm target={{ opportunityId: opp.id }} back={back} /> : null}
            <div style={{ marginTop: 'var(--s-3)' }}><TaskList items={tasks} back={back} /></div>
          </section>
        </div>
      </div>
    </>
  );
}

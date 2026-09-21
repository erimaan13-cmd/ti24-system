import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SERVICE_CODES } from '@ti24/contracts';
import { allowedLeadTransitions } from '@ti24/domain';
import { getLead, listActivities, listTasks } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { convertLeadAction, leadStatusAction } from '@/lib/actions';
import { flashFrom, fmtDateTime, LEAD_STATUS, SERVICE_LABEL, sourceLabel } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { ActivityForm, ActivityList, LeadBadge, ServiceTags, TaskForm, TaskList } from '@/components/bits';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LeadPage({ params, searchParams }: Props) {
  const actor = await requireActor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { error, ok } = await flashFrom(searchParams);
  const data = await getLead(actor, id);
  if (!data) notFound();
  const { lead, touches, events, duplicates } = data;
  const [activities, tasks] = await Promise.all([listActivities(actor, { leadId: id }), listTasks(actor, { leadId: id })]);
  const back = `/leads/${id}`;
  const transitions = allowedLeadTransitions(lead.status).filter((s) => s !== 'converted' && s !== 'disqualified');
  const canDisqualify = allowedLeadTransitions(lead.status).includes('disqualified');

  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head">
        <div>
          <p className="xs muted"><Link href="/leads">Leads</Link> / {lead.full_name}</p>
          <h1>{lead.full_name}</h1>
          <p className="row small" style={{ marginTop: 8 }}><LeadBadge s={lead.status} /> <span className="muted">{lead.company}</span> {lead.service_code ? <ServiceTags codes={[lead.service_code]} /> : null}</p>
        </div>
        {lead.converted_account_id ? <Link className="btn btn-secondary btn-sm" href={`/cuentas/${lead.converted_account_id}`}>Ver cuenta</Link> : null}
      </div>

      {lead.duplicate_of ? <p className="notice" style={{ marginBottom: 'var(--s-4)' }}>Este lead es un duplicado del <Link href={`/leads/${lead.duplicate_of}`}>lead original</Link> (mismo correo).</p> : null}
      {lead.suggested_account_id && !lead.converted_account_id ? <p className="notice" style={{ marginBottom: 'var(--s-4)' }}>El dominio del correo coincide con la cuenta <Link href={`/cuentas/${lead.suggested_account_id}`}>{lead.suggested_account_name}</Link>. Al convertir puedes ligarlo a ella.</p> : null}

      <div className="detail">
        <div>
          <section className="card">
            <h2 className="section-title">Solicitud</h2>
            <dl className="dl">
              <dt>Correo</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
              <dt>Teléfono</dt><dd>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : '—'}</dd>
              <dt>Tamaño</dt><dd>{lead.company_size ?? '—'}</dd>
              <dt>Mensaje</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{lead.message ?? '—'}</dd>
              <dt>Consentimiento marketing</dt><dd>{lead.marketing_consent ? 'Sí' : 'No'}</dd>
              <dt>Recibido</dt><dd>{fmtDateTime(lead.created_at)}</dd>
              <dt>Primera respuesta</dt><dd>{lead.status === 'new' ? `Vence ${fmtDateTime(lead.first_response_due_at)}` : 'Atendido'}</dd>
              {lead.disqualified_reason ? <><dt>Motivo</dt><dd>{lead.disqualified_reason}</dd></> : null}
            </dl>
          </section>

          {lead.status === 'qualified' ? (
            <section className="card" aria-labelledby="conv-t">
              <h2 id="conv-t" className="section-title">Convertir en cuenta y oportunidad</h2>
              <form action={convertLeadAction} className="form-grid">
                <input type="hidden" name="id" value={lead.id} />
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <div className="field"><label htmlFor="c-account">Cuenta (empresa)</label><input id="c-account" name="account_name" className="input" defaultValue={lead.company ?? ''} /></div>
                  <div className="field"><label htmlFor="c-title">Título de la oportunidad</label><input id="c-title" name="title" className="input" required minLength={3} defaultValue={lead.service_code ? `${SERVICE_LABEL[lead.service_code]} — ${lead.company ?? lead.full_name}` : ''} /></div>
                  <div className="field"><label htmlFor="c-amount">Monto estimado MXN (opcional)</label><input id="c-amount" name="amount" type="number" min="0" step="0.01" className="input" inputMode="decimal" /></div>
                </div>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="label">Servicios</legend>
                  <div className="checkgrid">
                    {SERVICE_CODES.map((c) => (
                      <label key={c} className="check"><input type="checkbox" name="services" value={c} defaultChecked={c === lead.service_code} /> <span>{SERVICE_LABEL[c]} <span className="tag">{c}</span></span></label>
                    ))}
                  </div>
                </fieldset>
                {lead.suggested_account_id ? <label className="check"><input type="checkbox" name="use_suggested" defaultChecked /> <span>Ligar a la cuenta existente «{lead.suggested_account_name}»</span></label> : null}
                <div><button className="btn btn-primary" type="submit">Convertir</button></div>
              </form>
            </section>
          ) : null}

          <section className="card">
            <h2 className="section-title">Actividades</h2>
            {lead.status !== 'converted' && lead.status !== 'duplicate' ? <ActivityForm target={{ leadId: lead.id }} back={back} /> : null}
            <hr style={{ margin: 'var(--s-4) 0' }} />
            <ActivityList items={activities} />
          </section>
        </div>

        <div>
          {transitions.length > 0 || canDisqualify ? (
            <section className="card">
              <h2 className="section-title">Estado</h2>
              <div className="row">
                {transitions.map((s) => (
                  <form key={s} action={leadStatusAction}>
                    <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="to" value={s} />
                    <button className={`btn btn-sm ${s === 'qualified' ? 'btn-primary' : 'btn-secondary'}`} type="submit">Marcar {LEAD_STATUS[s]?.label.toLowerCase()}</button>
                  </form>
                ))}
              </div>
              {canDisqualify ? (
                <form action={leadStatusAction} className="inline-form" style={{ marginTop: 'var(--s-3)' }}>
                  <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="to" value="disqualified" />
                  <div className="field" style={{ flex: 1 }}><label htmlFor="dq">Motivo de descalificación</label><input id="dq" name="reason" className="input" required minLength={3} /></div>
                  <button className="btn btn-danger btn-sm" type="submit">Descalificar</button>
                </form>
              ) : null}
            </section>
          ) : null}

          <section className="card">
            <h2 className="section-title">Tareas</h2>
            {lead.status !== 'converted' ? <TaskForm target={{ leadId: lead.id }} back={back} /> : null}
            <div style={{ marginTop: 'var(--s-3)' }}><TaskList items={tasks} back={back} /></div>
          </section>

          <section className="card">
            <h2 className="section-title">Atribución</h2>
            {touches.length === 0 ? <p className="empty">Sin datos de atribución.</p> : (
              <ul className="timeline">
                {touches.map((t, i) => (
                  <li key={t.id}>
                    <strong>{touches.length > 1 ? (i === 0 ? 'Primer contacto' : 'Último contacto') : 'Primer y último contacto'}:</strong> {sourceLabel(t.source)} / {t.medium}
                    <div className="muted xs">Landing {t.landing_path ?? '—'} · {fmtDateTime(t.occurred_at)}</div>
                    {t.campaign ? <div className="xs">Campaña: {t.campaign}</div> : null}
                    {t.ref_code ? <div className="xs">Código: <span className="mono">{t.ref_code}</span></div> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="section-title">Recorrido en el sitio</h2>
            {events.length === 0 ? <p className="empty">Sin eventos.</p> : (
              <ul className="timeline">{events.map((e, i) => (
                <li key={i}><span className="mono xs">{e.event_name}</span> <span className="small">{e.page_path}</span><div className="muted xs">{fmtDateTime(e.occurred_at)}</div></li>
              ))}</ul>
            )}
          </section>

          {duplicates.length ? (
            <section className="card">
              <h2 className="section-title">Envíos duplicados</h2>
              <ul className="timeline">{duplicates.map((d) => <li key={d.id}><Link href={`/leads/${d.id}`}>{fmtDateTime(d.created_at)}</Link> {d.service_code ? <span className="tag">{d.service_code}</span> : null}</li>)}</ul>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}


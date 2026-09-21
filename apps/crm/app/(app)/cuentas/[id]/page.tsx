import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@ti24/ui';
import { getAccount360 } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { flashFrom, fmtDate, money, SERVICE_LABEL, sourceLabel } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { ActivityForm, ActivityList, DemoTag, LeadBadge, ProposalBadge, StageBadge } from '@/components/bits';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Ficha 360: una cuenta puede tener a la vez proyectos, mantenimiento y oportunidades nuevas (AT-11 §15.2). */
export default async function Account360({ params, searchParams }: Props) {
  const actor = await requireActor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { error, ok } = await flashFrom(searchParams);
  const v = await getAccount360(actor, id);
  if (!v) notFound();
  const { account: a } = v;
  const back = `/cuentas/${id}`;
  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head">
        <div>
          <p className="xs muted"><Link href="/cuentas">Cuentas</Link> / {a.name}</p>
          <h1>{a.name} <DemoTag on={a.is_demo} /></h1>
          <p className="row small" style={{ marginTop: 8 }}>
            <Badge tone={a.lifecycle === 'customer' ? 'ok' : 'amber'}>{a.lifecycle === 'customer' ? 'Cliente' : a.lifecycle === 'former' ? 'Excliente' : 'Prospecto'}</Badge>
            <span className="mono muted">{a.domain ?? 'sin dominio'}</span><span className="muted">Alta {fmtDate(a.created_at)}</span>
          </p>
        </div>
      </div>

      <section className="card" aria-labelledby="svc-t" style={{ marginBottom: 'var(--s-4)' }}>
        <h2 id="svc-t" className="section-title">Servicios con esta cuenta</h2>
        {v.services.length === 0 ? <p className="empty">Todavía no hay servicios.</p> : (
          <ul className="row" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {v.services.map((s) => <li key={s.service_code + s.status}><Badge tone={s.status === 'contratado' ? 'ok' : s.status === 'perdido' ? 'danger' : 'info'}>{SERVICE_LABEL[s.service_code] ?? s.service_code} · {s.status}</Badge></li>)}
          </ul>
        )}
      </section>

      <div className="detail">
        <div>
          <section className="card">
            <h2 className="section-title">Oportunidades</h2>
            {v.opportunities.length === 0 ? <p className="empty">Sin oportunidades.</p> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Oportunidad</th><th>Etapa</th><th>Canal</th><th className="num">Monto</th></tr></thead>
                <tbody>{v.opportunities.map((o) => <tr key={o.id}><td><Link href={`/oportunidades/${o.id}`}>{o.title}</Link><div className="muted xs">{fmtDate(o.created_at)}</div></td><td><StageBadge s={o.stage_code} /></td><td>{sourceLabel(o.first_touch_source)}</td><td className="num">{money(o.amount, o.currency as 'MXN')}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
          <section className="card">
            <h2 className="section-title">Proyectos</h2>
            {v.projects.length === 0 ? <p className="empty">Sin proyectos. Se crean al ganar una oportunidad de tipo proyecto.</p> : (
              <ul className="timeline">{v.projects.map((p) => <li key={p.id}><strong>{p.name}</strong> <Badge>{p.status}</Badge><div className="muted xs">Desde {fmtDate(p.created_at)}</div></li>)}</ul>
            )}
          </section>
          <section className="card">
            <h2 className="section-title">Actividad</h2>
            <ActivityForm target={{ accountId: a.id }} back={back} />
            <hr style={{ margin: 'var(--s-4) 0' }} />
            <ActivityList items={v.activities} />
          </section>
        </div>
        <div>
          <section className="card">
            <h2 className="section-title">Contactos</h2>
            {v.contacts.length === 0 ? <p className="empty">Sin contactos.</p> : (
              <ul className="timeline">{v.contacts.map((c) => <li key={c.id}><strong>{c.full_name}</strong>{c.job_title ? ` · ${c.job_title}` : ''}<div className="xs">{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}{c.phone ? <> · <a href={`tel:${c.phone}`}>{c.phone}</a></> : null}</div></li>)}</ul>
            )}
          </section>
          <section className="card">
            <h2 className="section-title">Propuestas</h2>
            {v.proposals.length === 0 ? <p className="empty">Sin propuestas.</p> : (
              <ul className="timeline">{v.proposals.map((p) => <li key={p.id}><Link href={`/propuestas/${p.id}`} className="mono">{p.folio}</Link> <ProposalBadge s={p.status} /><div className="muted xs">{p.opportunity_title}</div></li>)}</ul>
            )}
          </section>
          <section className="card">
            <h2 className="section-title">Leads relacionados</h2>
            {v.leads.length === 0 ? <p className="empty">Sin leads.</p> : (
              <ul className="timeline">{v.leads.map((l) => <li key={l.id}><Link href={`/leads/${l.id}`}>{fmtDate(l.created_at)}</Link> <LeadBadge s={l.status} /> {l.service_code ? <span className="tag">{l.service_code}</span> : null}</li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

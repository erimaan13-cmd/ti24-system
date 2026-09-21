import Link from 'next/link';
import { globalSearch } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { flashFrom } from '@/lib/format';
import { LeadBadge, StageBadge } from '@/components/bits';

export const metadata = { title: 'Buscar' };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const { one, params } = await flashFrom(searchParams);
  const q = (one(params.q) ?? '').slice(0, 100);
  const r = await globalSearch(actor, q);
  const total = r.accounts.length + r.leads.length + r.opportunities.length;
  return (
    <>
      <div className="page-head"><div><h1>Resultados</h1><p className="muted small">{q.length < 2 ? 'Escribe al menos 2 caracteres.' : `${total} resultado(s) para «${q}»`}</p></div></div>
      <div className="grid grid-3">
        <section className="card"><h2 className="section-title">Cuentas</h2>{r.accounts.length ? <ul className="timeline">{r.accounts.map((a) => <li key={a.id}><Link href={`/cuentas/${a.id}`}>{a.name}</Link></li>)}</ul> : <p className="empty">Nada.</p>}</section>
        <section className="card"><h2 className="section-title">Leads</h2>{r.leads.length ? <ul className="timeline">{r.leads.map((l) => <li key={l.id}><Link href={`/leads/${l.id}`}>{l.full_name}</Link> <LeadBadge s={l.status} /><div className="muted xs">{l.company}</div></li>)}</ul> : <p className="empty">Nada.</p>}</section>
        <section className="card"><h2 className="section-title">Oportunidades</h2>{r.opportunities.length ? <ul className="timeline">{r.opportunities.map((o) => <li key={o.id}><Link href={`/oportunidades/${o.id}`}>{o.title}</Link> <StageBadge s={o.stage_code} /></li>)}</ul> : <p className="empty">Nada.</p>}</section>
      </div>
    </>
  );
}

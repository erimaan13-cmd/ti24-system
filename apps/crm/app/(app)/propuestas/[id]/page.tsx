import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SERVICE_CODES } from '@ti24/contracts';
import { getProposal } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { addItemAction, proposalStatusAction, removeItemAction, updateItemAction } from '@/lib/actions';
import { flashFrom, fmtDate, fmtDateTime, money, SERVICE_LABEL } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { ProposalBadge } from '@/components/bits';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProposalPage({ params, searchParams }: Props) {
  const actor = await requireActor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { error, ok } = await flashFrom(searchParams);
  const data = await getProposal(actor, id);
  if (!data) notFound();
  const { proposal: p, items, totals } = data;
  const draft = p.status === 'draft';
  const StatusBtn = ({ to, label, variant = 'secondary' }: { to: string; label: string; variant?: string }) => (
    <form action={proposalStatusAction}><input type="hidden" name="proposal_id" value={p.id} /><input type="hidden" name="to" value={to} />
      <button className={`btn btn-sm btn-${variant}`} type="submit">{label}</button></form>
  );

  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head">
        <div>
          <p className="xs muted"><Link href={`/oportunidades/${p.opportunity_id}`}>{p.opportunity_title}</Link> · {p.account_name}</p>
          <h1 className="mono">{p.folio}</h1>
          <p className="row small" style={{ marginTop: 8 }}><ProposalBadge s={p.status} /> <span className="muted">Creada {fmtDate(p.created_at)}{p.sent_at ? ` · Enviada ${fmtDateTime(p.sent_at)}` : ''}{p.decided_at ? ` · Decidida ${fmtDateTime(p.decided_at)}` : ''}</span></p>
        </div>
        <div className="row">
          {p.status === 'draft' ? <StatusBtn to="sent" label="Marcar como enviada" variant="primary" /> : null}
          {p.status === 'sent' ? <><StatusBtn to="accepted" label="Cliente aceptó" variant="primary" /><StatusBtn to="rejected" label="Cliente rechazó" variant="danger" /><StatusBtn to="expired" label="Venció" /></> : null}
        </div>
      </div>
      {draft ? <p className="notice" style={{ marginBottom: 'var(--s-4)' }}>Borrador: captura precios y descripción. Al marcarla como enviada ya no se puede editar. El envío al cliente (PDF/correo) es P1: por ahora se envía por fuera y aquí se registra.</p> : null}

      <section className="card">
        <h2 className="section-title">Conceptos</h2>
        {items.length === 0 ? <p className="empty">Sin conceptos.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Servicio</th><th>Descripción</th><th className="num">Cant.</th><th className="num">Precio unitario</th><th>Cobro</th><th className="num">Importe</th>{draft ? <th><span className="sr-only">Acciones</span></th> : null}</tr></thead>
            <tbody>{items.map((it) => draft ? (
              <tr key={it.id}>
                <td><span className="tag">{it.service_code}</span></td>
                <td colSpan={3}>
                  <form action={updateItemAction} className="inline-form" id={`f-${it.id}`}>
                    <input type="hidden" name="proposal_id" value={p.id} /><input type="hidden" name="item_id" value={it.id} />
                    <label className="sr-only" htmlFor={`d-${it.id}`}>Descripción</label>
                    <input id={`d-${it.id}`} name="description" className="input" defaultValue={it.description} style={{ flex: 2, minWidth: 160, minHeight: 36 }} />
                    <label className="sr-only" htmlFor={`q-${it.id}`}>Cantidad</label>
                    <input id={`q-${it.id}`} name="quantity" type="number" min="0.01" step="0.01" className="input num" defaultValue={it.quantity} style={{ width: 80, minHeight: 36 }} />
                    <label className="sr-only" htmlFor={`u-${it.id}`}>Precio unitario</label>
                    <input id={`u-${it.id}`} name="unit_price" type="number" min="0" step="0.01" className="input num" defaultValue={it.unit_price} style={{ width: 130, minHeight: 36 }} />
                    <button className="btn btn-secondary btn-sm" type="submit">Guardar<span className="sr-only"> {it.description}</span></button>
                  </form>
                </td>
                <td className="small">{it.billing === 'monthly' ? 'Mensual' : 'Único'}</td>
                <td className="num">{money(it.quantity * it.unit_price, p.currency)}</td>
                <td>
                  <form action={removeItemAction}><input type="hidden" name="proposal_id" value={p.id} /><input type="hidden" name="item_id" value={it.id} />
                    <button className="btn btn-ghost btn-sm" type="submit">Quitar<span className="sr-only"> {it.description}</span></button></form>
                </td>
              </tr>
            ) : (
              <tr key={it.id}>
                <td><span className="tag">{it.service_code}</span></td><td>{it.description}</td><td className="num">{it.quantity}</td>
                <td className="num">{money(it.unit_price, p.currency)}</td><td className="small">{it.billing === 'monthly' ? 'Mensual' : 'Único'}</td>
                <td className="num">{money(it.quantity * it.unit_price, p.currency)}</td>
              </tr>
            ))}</tbody>
            <tfoot>
              <tr><td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Total pago único</td><td className="num" style={{ fontWeight: 600 }}>{money(totals.oneTime, p.currency)}</td>{draft ? <td /> : null}</tr>
              <tr><td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Total mensual</td><td className="num" style={{ fontWeight: 600 }}>{money(totals.monthly, p.currency)}</td>{draft ? <td /> : null}</tr>
            </tfoot>
          </table></div>
        )}
      </section>

      {draft ? (
        <section className="card" aria-labelledby="add-t">
          <h2 id="add-t" className="section-title">Agregar concepto</h2>
          <form action={addItemAction} className="inline-form">
            <input type="hidden" name="proposal_id" value={p.id} />
            <div className="field"><label htmlFor="a-svc">Servicio</label><select id="a-svc" name="service_code" className="select">{SERVICE_CODES.map((c) => <option key={c} value={c}>{SERVICE_LABEL[c]}</option>)}</select></div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor="a-desc">Descripción</label><input id="a-desc" name="description" className="input" required minLength={2} /></div>
            <div className="field" style={{ width: 90 }}><label htmlFor="a-q">Cant.</label><input id="a-q" name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className="input" /></div>
            <div className="field" style={{ width: 140 }}><label htmlFor="a-u">Precio unitario</label><input id="a-u" name="unit_price" type="number" min="0" step="0.01" className="input" required /></div>
            <div className="field" style={{ width: 130 }}><label htmlFor="a-b">Cobro</label><select id="a-b" name="billing" className="select"><option value="one_time">Único</option><option value="monthly">Mensual</option></select></div>
            <button className="btn btn-secondary btn-sm" type="submit">Agregar</button>
          </form>
        </section>
      ) : null}
    </>
  );
}

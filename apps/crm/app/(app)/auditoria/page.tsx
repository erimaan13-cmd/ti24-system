import { listAudit } from '@ti24/db';
import { requireAdmin } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';

export const metadata = { title: 'Auditoría' };

/** Solo administradores. La tabla es solo de agregar: nadie la edita ni la borra (trigger en la base). */
export default async function AuditPage() {
  const actor = await requireAdmin();
  const rows = await listAudit(actor, 300);
  return (
    <>
      <div className="page-head"><div><h1>Auditoría</h1><p className="muted small">Últimos 300 eventos. Solo de agregar: no se puede editar ni borrar.</p></div></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>#</th><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Entidad</th><th>Cambio</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td className="mono xs">{r.id}</td><td className="small">{fmtDateTime(r.at)}</td><td className="small">{r.actor}</td><td className="mono xs">{r.action}</td>
            <td className="xs">{r.entity}<div className="mono muted">{r.entity_id?.slice(0, 8)}</div></td>
            <td className="mono xs" style={{ maxWidth: 360, overflowWrap: 'anywhere' }}>{r.before ? <div className="muted">antes: {JSON.stringify(r.before)}</div> : null}{r.after ? <div>después: {JSON.stringify(r.after)}</div> : null}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}

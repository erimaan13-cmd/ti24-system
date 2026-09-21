import Link from 'next/link';
import { Badge } from '@ti24/ui';
import { listProjects } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { fmtDate, money } from '@/lib/format';
import { ServiceTags } from '@/components/bits';

export const metadata = { title: 'Proyectos' };

export default async function ProjectsPage() {
  const actor = await requireActor();
  const projects = await listProjects(actor);
  return (
    <>
      <div className="page-head"><div><h1>Proyectos</h1><p className="muted small">Se crean automáticamente al ganar una oportunidad con servicios de tipo proyecto. La gestión técnica vive fuera del CRM.</p></div></div>
      {projects.length === 0 ? <p className="empty">Todavía no hay proyectos.</p> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Proyecto</th><th>Cuenta</th><th>Servicios</th><th>Estado</th><th className="num">Monto</th><th>Inicio</th></tr></thead>
          <tbody>{projects.map((p) => (
            <tr key={p.id}><td><Link href={`/oportunidades/${p.opportunity_id}`}>{p.name}</Link></td><td><Link href={`/cuentas/${p.account_id}`} style={{ fontWeight: 400 }}>{p.account_name}</Link></td>
              <td><ServiceTags codes={p.services} /></td><td><Badge tone="info">{p.status === 'planned' ? 'Planeado' : p.status}</Badge></td><td className="num">{money(p.amount)}</td><td className="small">{fmtDate(p.created_at)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

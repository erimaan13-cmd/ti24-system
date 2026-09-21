import Link from 'next/link';
import { listTasks } from '@ti24/db';
import { requireActor } from '@/lib/auth';
import { flashFrom } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { TaskList } from '@/components/bits';

export const metadata = { title: 'Tareas' };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function TasksPage({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const { error, ok, one, params } = await flashFrom(searchParams);
  const mine = one(params.mine) === '1';
  const tasks = await listTasks(actor, { open: true, mine });
  return (
    <>
      <Flash error={error} ok={ok} />
      <div className="page-head">
        <div><h1>Tareas abiertas</h1><p className="muted small">Ordenadas por vencimiento. Las vencidas aparecen en rojo.</p></div>
        <nav className="row" aria-label="Filtro">
          <Link className={`btn btn-sm ${!mine ? 'btn-primary' : 'btn-secondary'}`} href="/tareas">Todas</Link>
          <Link className={`btn btn-sm ${mine ? 'btn-primary' : 'btn-secondary'}`} href="/tareas?mine=1">Mías</Link>
        </nav>
      </div>
      <section className="card"><TaskList items={tasks} back={mine ? '/tareas?mine=1' : '/tareas'} /></section>
    </>
  );
}

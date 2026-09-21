import { WordmarkSvg } from '@ti24/ui';
import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { logoutAction } from '@/lib/actions';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="wordmark" href="/" aria-label="CRM TI24, tablero"><WordmarkSvg /></Link>
        <span className="env-demo">Prototipo · datos DEMO</span>
        <Nav isAdmin={actor.role === 'admin'} />
        <div className="me">
          <span><strong style={{ color: 'var(--ink)' }}>{actor.fullName}</strong><br />{actor.role === 'admin' ? 'Administrador' : 'Ventas'}</span>
          <form action={logoutAction}><button className="btn btn-ghost btn-sm" type="submit">Cerrar sesión</button></form>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <form action="/buscar" role="search">
            <label htmlFor="q" className="sr-only">Buscar</label>
            <input id="q" name="q" className="input" placeholder="Buscar cuentas, leads, oportunidades…" style={{ minHeight: 40 }} />
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}

import { WordmarkSvg } from '@ti24/ui';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { loginAction } from '@/lib/actions';
import { COOKIE, decodeSession } from '@/lib/session';
import { flashFrom } from '@/lib/format';
import { Flash } from '@/components/Flash';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { error } = await flashFrom(searchParams);
  let hasSession = false;
  try { hasSession = !!decodeSession((await cookies()).get(COOKIE)?.value); } catch { hasSession = false; }
  if (hasSession) redirect('/');
  return (
    <main className="login">
      <div className="card stack">
        <span className="wordmark"><WordmarkSvg /></span>
        <div>
          <h1 style={{ fontSize: 'var(--fs-lg)', marginBottom: 4 }}>CRM · Entrar</h1>
          <p className="muted small" style={{ margin: 0 }}>Prototipo en modo demo. El acceso definitivo usará enlace mágico por correo (Supabase Auth).</p>
        </div>
        <Flash error={error} ok={null} />
        <form action={loginAction} className="form-grid">
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" className="input" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
          <button className="btn btn-primary" type="submit">Entrar</button>
        </form>
      </div>
    </main>
  );
}

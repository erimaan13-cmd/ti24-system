import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { reloadActor, type Actor } from '@ti24/db';
import { COOKIE, decodeSession } from './session';

/** Usuario de la petición (o redirección a /login). Se consulta la base: un usuario desactivado pierde acceso. */
export const requireActor = cache(async (): Promise<Actor> => {
  const token = (await cookies()).get(COOKIE)?.value;
  const s = decodeSession(token);
  if (!s) redirect('/login');
  const actor = await reloadActor(s.uid);
  if (!actor) redirect('/login');
  return actor;
});

export async function requireAdmin(): Promise<Actor> {
  const a = await requireActor();
  if (a.role !== 'admin') redirect('/?error=' + encodeURIComponent('Solo un administrador puede ver esa sección.'));
  return a;
}

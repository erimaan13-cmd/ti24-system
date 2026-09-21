import type { Metadata } from 'next';
import Link from 'next/link';
import { thanks as c } from '@/content/es';

export const metadata: Metadata = { title: 'Solicitud recibida', robots: { index: false, follow: false } };

export default function ThanksPage() {
  return (
    <section className="section">
      <div className="container prose">
        <span className="eyebrow">Diagnóstico</span>
        <h1 style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-xl)' }}>{c.title}</h1>
        <p className="lead">{c.lead}</p>
        <h2>{c.nextTitle}</h2>
        <ul className="checklist">{c.next.map((t) => <li key={t}>{t}</li>)}</ul>
        <p style={{ marginTop: 'var(--s-6)' }}><Link className="btn btn-secondary" href="/">{c.back}</Link></p>
      </div>
    </section>
  );
}

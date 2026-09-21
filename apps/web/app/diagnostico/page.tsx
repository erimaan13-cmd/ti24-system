import type { Metadata } from 'next';
import { Suspense } from 'react';
import { diagnostic as c } from '@/content/es';
import { DiagnosticForm } from './DiagnosticForm';

export const metadata: Metadata = {
  title: 'Agenda tu diagnóstico',
  description: 'Cuéntanos qué te gustaría resolver. Revisamos tu caso y te proponemos una llamada de diagnóstico de 45 minutos.',
  alternates: { canonical: '/diagnostico' },
};

export default function DiagnosticPage() {
  return (
    <section className="section">
      <div className="container two-col">
        <div>
          <span className="eyebrow">{c.eyebrow}</span>
          <h1 style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-xl)' }}>{c.title}</h1>
          <p className="lead">{c.lead}</p>
          <h2 className="small" style={{ fontSize: 'var(--fs-md)', marginTop: 'var(--s-6)' }}>{c.whatTitle}</h2>
          <ul className="checklist">{c.what.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="card">
          <Suspense fallback={<p className="muted">Cargando formulario…</p>}>
            <DiagnosticForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

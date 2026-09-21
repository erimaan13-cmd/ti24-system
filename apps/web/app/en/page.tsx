import type { Metadata } from 'next';
import Link from 'next/link';
import { en } from '@/content/en';

export const metadata: Metadata = {
  title: 'English',
  description: en.lead,
  alternates: { canonical: '/en', languages: { 'es-MX': '/', en: '/en' } },
};

/** Estructura bilingüe (D-15). El contenido completo en inglés es P1. */
export default function EnglishPage() {
  return (
    <section className="section" lang="en">
      <div className="container prose">
        <span className="eyebrow">English</span>
        <h1 style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-xl)' }}>{en.title}</h1>
        <p className="lead">{en.lead}</p>
        <p className="muted">{en.contact}</p>
        <p><Link className="btn btn-primary" href="/" hrefLang="es">{en.cta}</Link></p>
      </div>
    </section>
  );
}

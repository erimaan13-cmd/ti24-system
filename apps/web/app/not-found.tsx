import Link from 'next/link';
import { notFound as c } from '@/content/es';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container prose">
        <span className="eyebrow mono">404</span>
        <h1 style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-xl)' }}>{c.title}</h1>
        <p className="lead">{c.lead}</p>
        <ul className="row" style={{ listStyle: 'none', padding: 0 }}>
          {c.links.map((l, i) => <li key={l.href}><Link className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} href={l.href}>{l.label}</Link></li>)}
        </ul>
      </div>
    </section>
  );
}

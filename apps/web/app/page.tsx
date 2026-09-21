import Link from 'next/link';
import { home } from '@/content/es';
import { TrackedLink } from '@/components/TrackedLink';
import { WhatsAppButton } from '@/components/WhatsAppButton';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">{home.eyebrow}</span>
          <h1>{home.title}</h1>
          <p className="lead">{home.lead}</p>
          <div className="row">
            <TrackedLink href="/diagnostico" ctaId="home_hero" className="btn btn-primary">{home.primary}</TrackedLink>
            <TrackedLink href="/desarrollo-de-software" ctaId="home_hero_sys" serviceCode="SYS" className="btn btn-secondary">{home.secondary}</TrackedLink>
          </div>
        </div>
      </section>

      <section className="section" id="servicios" aria-labelledby="servicios-t">
        <div className="container">
          <div className="section-head">
            <h2 id="servicios-t">{home.linesTitle}</h2>
            <p className="lead">{home.linesLead}</p>
          </div>
          <ul className="grid grid-5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {home.lines.map((l) => (
              <li key={l.name} className="card card-tight line-card">
                <span className="tag">{l.code}</span>
                <h3>{l.name}</h3>
                <p>{l.text}</p>
                {l.href ? <Link href={l.href}>{l.href === '/desarrollo-de-software' ? 'Ver más' : 'Solicitar'}<span className="sr-only">: {l.name}</span></Link> : <span className="muted xs">Bajo oferta</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="como-trabajamos" aria-labelledby="metodo-t">
        <div className="container">
          <div className="section-head"><h2 id="metodo-t">{home.methodTitle}</h2></div>
          <ol className="steps">
            {home.method.map((s) => (
              <li key={s.n}><span className="n">{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="fit-t">
        <div className="container two-col">
          <div>
            <h2 id="fit-t">{home.case0Title}</h2>
            <p className="muted">{home.case0Text}</p>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <h3>{home.fitTitle}</h3>
              <ul className="checklist">{home.fitYes.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="card">
              <h3>{home.fitNoTitle}</h3>
              <ul className="checklist no">{home.fitNo.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <h2>{home.finalTitle}</h2>
            <p>{home.finalText}</p>
            <div className="row">
              <TrackedLink href="/diagnostico" ctaId="home_final" className="btn btn-primary">{home.primary}</TrackedLink>
              <WhatsAppButton context="inicio" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from 'next';
import { software as c } from '@/content/es';
import { ServiceViewed } from '@/components/ServiceViewed';
import { TrackedLink } from '@/components/TrackedLink';
import { WhatsAppButton } from '@/components/WhatsAppButton';

export const metadata: Metadata = {
  title: 'Desarrollo de software a medida',
  description: 'Software a medida para empresas: cotizaciones, pedidos, inventarios y seguimiento de clientes en un sistema que tu equipo usa todos los días. Empezamos con un diagnóstico.',
  alternates: { canonical: '/desarrollo-de-software' },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};
const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Desarrollo de software a medida',
  provider: { '@type': 'Organization', name: 'TI24' },
  areaServed: ['MX', 'US'],
};

const cta = `/diagnostico?servicio=${c.serviceCode}`;

export default function SoftwarePage() {
  return (
    <>
      <ServiceViewed serviceCode={c.serviceCode}>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">{c.eyebrow}</span>
            <h1>{c.title}</h1>
            <p className="lead">{c.lead}</p>
            <div className="row">
              <TrackedLink href={cta} ctaId="sys_hero" serviceCode="SYS" className="btn btn-primary">{c.primary}</TrackedLink>
              <WhatsAppButton context="desarrollo de software" serviceCode="SYS" />
            </div>
          </div>
        </section>
      </ServiceViewed>

      <section className="section" aria-labelledby="problema-t">
        <div className="container two-col">
          <h2 id="problema-t">{c.problemTitle}</h2>
          <ul className="checklist">{c.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </section>

      <section className="section" aria-labelledby="para-t">
        <div className="container">
          <div className="section-head"><h2 id="para-t">{c.forTitle}</h2></div>
          <div className="grid grid-2">
            <div className="card"><h3>Sí es para ti si…</h3><ul className="checklist">{c.forYes.map((t) => <li key={t}>{t}</li>)}</ul></div>
            <div className="card"><h3>No es para ti si…</h3><ul className="checklist no">{c.forNo.map((t) => <li key={t}>{t}</li>)}</ul></div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="entregables-t">
        <div className="container">
          <div className="section-head"><h2 id="entregables-t">{c.deliverablesTitle}</h2></div>
          <ul className="grid grid-4" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {c.deliverables.map((d) => (
              <li key={d.title} className="card card-tight"><h3 style={{ fontSize: 'var(--fs-md)' }}>{d.title}</h3><p className="muted small" style={{ margin: 0 }}>{d.text}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="como-t">
        <div className="container">
          <div className="section-head"><h2 id="como-t">{c.howTitle}</h2></div>
          <ol className="steps">{c.how.map((s) => <li key={s.n}><span className="n">{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
        </div>
      </section>

      <section className="section" aria-labelledby="prueba-t">
        <div className="container grid grid-2">
          <div><h2 id="prueba-t">{c.proofTitle}</h2><p className="muted">{c.proofText}</p></div>
          <div><h2>{c.priceTitle}</h2><p className="muted">{c.priceText}</p></div>
        </div>
      </section>

      <section className="section faq" aria-labelledby="faq-t">
        <div className="container two-col">
          <h2 id="faq-t">{c.faqTitle}</h2>
          <div>{c.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <h2>{c.finalTitle}</h2>
            <p>{c.finalText}</p>
            <TrackedLink href={cta} ctaId="sys_final" serviceCode="SYS" className="btn btn-primary">{c.primary}</TrackedLink>
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
    </>
  );
}

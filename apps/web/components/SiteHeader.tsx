import { WordmarkSvg } from '@ti24/ui';
import Link from 'next/link';
import { nav } from '@/content/es';
import { TrackedLink } from './TrackedLink';

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#contenido">{nav.skip}</a>
      <div className="container site-header__inner">
        <Link className="wordmark" href="/" aria-label="TI24, inicio"><WordmarkSvg /></Link>
        <nav aria-label="Principal" className="site-nav">
          {nav.links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <Link href={nav.langSwitch.href} hrefLang={nav.langSwitch.hrefLang} lang="en">{nav.langSwitch.label}</Link>
        </nav>
        <TrackedLink href="/diagnostico" ctaId="header" className="btn btn-primary btn-sm">{nav.cta}</TrackedLink>
      </div>
    </header>
  );
}

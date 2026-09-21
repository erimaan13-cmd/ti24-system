import { WordmarkSvg } from '@ti24/ui';
import Link from 'next/link';
import { footer } from '@/content/es';

export function SiteFooter() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="stack">
          <span className="wordmark"><WordmarkSvg /></span>
          <p className="muted small">{footer.note}</p>
        </div>
        <nav aria-label="Legal y contacto" className="row small">
          {email ? <a href={`mailto:${email}`}>{email}</a> : null}
          <Link href="/aviso-de-privacidad">{footer.privacy}</Link>
          <span className="muted">© {new Date().getFullYear()} {footer.rights}</span>
        </nav>
      </div>
    </footer>
  );
}

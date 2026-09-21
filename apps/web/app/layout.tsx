import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@ti24/ui/styles.css';
import './web.css';
import { site } from '@/content/es';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Tracker } from '@/components/Tracker';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const indexable = process.env.SITE_INDEXABLE === 'true';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${site.name} · Software, sitios y marketing para empresas`, template: `%s · ${site.name}` },
  description: site.description,
  alternates: { canonical: '/', languages: { 'es-MX': '/', en: '/en' } },
  openGraph: { type: 'website', locale: site.locale, siteName: site.name, title: site.name, description: site.description, url: '/' },
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#111214' },
  ],
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'TI24',
  url: siteUrl,
  areaServed: ['MX', 'US'],
  description: site.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <SiteHeader />
        <main id="contenido" tabIndex={-1}>{children}</main>
        <SiteFooter />
        <Tracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </body>
    </html>
  );
}

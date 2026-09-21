import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Mientras SITE_INDEXABLE no sea "true" (aviso de privacidad incompleto, D-21), se pide no indexar. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXABLE !== 'true') return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/gracias'] }, sitemap: `${base}/sitemap.xml` };
}

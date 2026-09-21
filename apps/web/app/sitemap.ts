import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['/', '/desarrollo-de-software', '/diagnostico', '/aviso-de-privacidad', '/en'];
  return pages.map((p) => ({ url: `${base}${p}`, changeFrequency: 'monthly', priority: p === '/' ? 1 : 0.7 }));
}

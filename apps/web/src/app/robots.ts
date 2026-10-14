import type { MetadataRoute } from 'next';

/** Absolute base URL, trailing slash trimmed. */
function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micow.example').replace(/\/$/, '');
}

/**
 * robots.txt — allow public browsing, disallow API + internal routes.
 * Sitemap is advertised so crawlers discover it without guessing.
 */
export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/portfolio'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

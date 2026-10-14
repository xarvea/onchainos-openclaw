import type { MetadataRoute } from 'next';

import { listCollections } from '@/lib/read-model';

/**
 * sitemap.xml — static routes plus every indexed collection.
 *
 * Collections come from the read model; with no DATABASE_URL this degrades to
 * just the static routes rather than failing the request. Individual asset pages
 * are not emitted (assets are addressable via their collection page and the
 * activity feed), keeping the sitemap focused and cheap to crawl.
 */

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micow.example').replace(/\/$/, '');
}

// Re-crawl daily; collections change slowly relative to page traffic.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/explore`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/activity`, lastModified: now, changeFrequency: 'hourly', priority: 0.6 },
  ];

  const { items: collections } = await listCollections({ limit: 500 }).catch(() => ({
    items: [],
    enabled: false,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${base}/collection/${c.address}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...collectionRoutes];
}

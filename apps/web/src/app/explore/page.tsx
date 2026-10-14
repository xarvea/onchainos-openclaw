import type { Metadata } from 'next';

import { AssetGrid, CollectionCard, EmptyState } from '@/components/asset-grid';
import { SiteHeader } from '@/components/site-header';
import { listAssetsByCollection, listCollections, readModelEnabled } from '@/lib/read-model';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Jelajahi koleksi',
  description: 'Jelajahi koleksi NFT di MICOW — marketplace Solana berbasis standar terbuka.',
  alternates: { canonical: '/explore' },
  openGraph: {
    title: 'Jelajahi koleksi · MICOW',
    description: 'Jelajahi koleksi NFT di MICOW — marketplace Solana berbasis standar terbuka.',
    url: '/explore',
  },
};

export default async function ExplorePage() {
  const enabled = readModelEnabled();
  const { items: collections } = await listCollections({ limit: 24 });

  // For a light “featured” strip, pull a few assets from the first collection.
  const firstCollection = collections[0];
  const featured = firstCollection
    ? (await listAssetsByCollection(firstCollection.address, { limit: 10 })).items
    : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20">
        <h1 className="mt-6 text-2xl font-semibold">Jelajahi</h1>
        <p className="mt-1 text-sm text-[var(--micow-muted)]">
          Koleksi & aset dibaca dari read model (Postgres), yang diisi dari on-chain via indexer DAS.
        </p>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-medium">Koleksi</h2>
          {collections.length === 0 ? (
            <EmptyState
              enabled={enabled}
              hint="Belum ada koleksi terindeks. Sync indexer (event micow/collection.sync) untuk mengisi data."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c) => (
                <CollectionCard key={c.address} collection={c} />
              ))}
            </div>
          )}
        </section>

        {featured.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-medium">
              Dari {firstCollection?.name || 'koleksi terbaru'}
            </h2>
            <AssetGrid assets={featured} />
          </section>
        )}
      </main>
    </>
  );
}

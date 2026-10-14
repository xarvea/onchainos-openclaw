import type { Metadata } from 'next';

import { AssetGrid, EmptyState } from '@/components/asset-grid';
import { SiteHeader } from '@/components/site-header';
import { getCollection, listAssetsByCollection } from '@/lib/read-model';
import { base58Pubkey } from '@micow/validation';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Collection ${address.slice(0, 4)}…${address.slice(-4)}`,
    description: `Browse NFTs in collection ${address} on MICOW.`,
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { address } = await params;

  // Validate the address; a non-pubkey param is a 404, not a DB query.
  if (!base58Pubkey.safeParse(address).success) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-20">
          <h1 className="text-2xl font-semibold">Alamat tidak valid</h1>
          <p className="mt-2 font-mono text-sm text-[var(--micow-muted)] break-all">{address}</p>
        </main>
      </>
    );
  }

  const { items: collections, enabled } = await getCollection(address);
  const collection = collections[0] ?? null;
  const { items: assets } = await listAssetsByCollection(address, { limit: 60 });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mt-6">
          <h1 className="text-2xl font-semibold">
            {collection?.name || 'Collection'}
            {collection?.verified && <span className="ml-2 text-[var(--micow-accent)]">✓</span>}
          </h1>
          <p className="mt-1 font-mono text-sm text-[var(--micow-muted)] break-all">{address}</p>
          {collection?.description && (
            <p className="mt-3 max-w-2xl text-sm text-[var(--micow-muted)]">
              {collection.description}
            </p>
          )}
        </div>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-medium">
            Aset {assets.length > 0 && <span className="text-[var(--micow-muted)]">({assets.length})</span>}
          </h2>
          {assets.length === 0 ? (
            <EmptyState
              enabled={enabled}
              hint="Belum ada aset dari koleksi ini di read model. Sync indexer untuk mengisinya."
            />
          ) : (
            <AssetGrid assets={assets} />
          )}
        </section>
      </main>
    </>
  );
}

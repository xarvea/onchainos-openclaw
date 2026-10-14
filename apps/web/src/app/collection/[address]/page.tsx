import type { Metadata } from 'next';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ address: string }>;
}

/**
 * Collection detail page — SEO-friendly via server rendering + ISR.
 * Data fetching from the indexer/DB is wired in M2 (see BLUEPRINT milestone).
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Collection ${address.slice(0, 4)}…${address.slice(-4)}`,
    description: `Browse NFTs in collection ${address} on MICOW.`,
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { address } = await params;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Collection</h1>
      <p className="mt-1 font-mono text-sm text-[var(--micow-muted)] break-all">{address}</p>
      <p className="mt-6 text-sm text-[var(--micow-muted)]">
        Asset grid akan dirender di sini (M2 — indexer + read model).
      </p>
    </main>
  );
}

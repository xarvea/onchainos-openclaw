import type { Asset, Collection } from '@micow/domain';
import { Card } from '@micow/ui';
import Image from 'next/image';
import Link from 'next/link';

/** Small, reusable NFT card used across explore / collection / portfolio. */
export function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square w-full bg-[#111118]">
        {asset.image ? (
          <Image
            src={asset.image}
            alt={asset.name || asset.mint}
            fill
            sizes="(max-width: 768px) 50vw, 240px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--micow-muted)]">
            no image
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium" title={asset.name}>
          {asset.name || 'Untitled'}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--micow-muted)]">
          {asset.mint.slice(0, 4)}…{asset.mint.slice(-4)}
        </p>
        <span className="mt-2 inline-block rounded bg-[#1c1c24] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--micow-muted)]">
          {asset.standard}
        </span>
      </div>
    </Card>
  );
}

export function AssetGrid({ assets }: { assets: Asset[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {assets.map((a) => (
        <AssetCard key={a.mint} asset={a} />
      ))}
    </div>
  );
}

export function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link href={`/collection/${collection.address}`} className="group">
      <Card className="overflow-hidden transition-colors group-hover:border-[var(--micow-accent)]">
        <div className="relative aspect-[3/1] w-full bg-[#111118]">
          {collection.image ? (
            <Image
              src={collection.image}
              alt={collection.name || collection.address}
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--micow-muted)]">
              no banner
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="flex items-center gap-2 truncate font-medium">
            {collection.name || 'Untitled collection'}
            {collection.verified && (
              <span className="text-xs text-[var(--micow-accent)]" title="verified">
                ✓
              </span>
            )}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--micow-muted)]">
            {collection.address.slice(0, 4)}…{collection.address.slice(-4)}
            {collection.size > 0 ? ` · ${collection.size} items` : ''}
          </p>
        </div>
      </Card>
    </Link>
  );
}

/**
 * Shown when the read model is empty or not configured. Explains *why* there is
 * nothing to show (the indexer fills Postgres; the DB is not the source of
 * truth) instead of a bare "no results".
 */
export function EmptyState({
  enabled,
  hint = 'Belum ada data di read model.',
}: {
  enabled: boolean;
  hint?: string;
}) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm text-[var(--micow-muted)]">{hint}</p>
      {!enabled && (
        <p className="mx-auto mt-3 max-w-md text-xs text-[var(--micow-muted)]">
          Read model tidak aktif — set <code className="font-mono">DATABASE_URL</code> lalu jalankan{' '}
          <code className="font-mono">pnpm db:migrate</code> dan sync indexer agar data muncul.
        </p>
      )}
    </Card>
  );
}

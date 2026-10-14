import type { Asset, Collection } from '@micow/domain';
import type { AssetRepository, CollectionRepository } from '@micow/application';
import { logger } from '@micow/observability';

import { inngest } from '../client';
import type { AssetIndexer } from '../indexer-port';

const log = logger.child({ app: 'micow-worker', fn: 'sync-asset' });

export interface SyncAssetDeps {
  indexer: AssetIndexer;
  assets: AssetRepository;
  collections?: CollectionRepository;
}

export interface SyncAssetResult {
  mint: string;
  stored: boolean;
}

/**
 * Pure sync logic: fetch one asset from the indexer and upsert it into the
 * read model. Extracted from the Inngest wrapper so it can be unit-tested
 * directly (no Inngest runtime required) — see sync-asset.test.ts.
 */
export async function syncAsset(deps: SyncAssetDeps, mint: string): Promise<SyncAssetResult> {
  const asset = await deps.indexer.getAsset(mint);
  if (!asset) {
    log.warn('asset not found on-chain, skipping', { mint });
    return { mint, stored: false };
  }
  await deps.assets.upsert(asset);
  log.info('asset upserted', { mint, owner: asset.owner });
  return { mint, stored: true };
}

export interface SyncBatchResult {
  fetched: number;
  stored: number;
}

/** Upsert a batch of assets; returns how many were fetched vs stored. */
async function upsertAll(deps: SyncAssetDeps, assets: Asset[]): Promise<SyncBatchResult> {
  for (const asset of assets) {
    await deps.assets.upsert(asset);
  }
  return { fetched: assets.length, stored: assets.length };
}

/**
 * Sync every asset in a collection into the read model (the M2 milestone:
 * "read model terisi dari DAS"). Pagination is handled by the indexer
 * implementation; here we only batch-upsert.
 */
export async function syncCollection(
  deps: SyncAssetDeps,
  collection: string,
): Promise<SyncBatchResult> {
  const assets = await deps.indexer.getAssetsByCollection(collection);
  const result = await upsertAll(deps, assets);
  log.info('collection synced', { collection, ...result });
  return result;
}

/** Sync every asset owned by a wallet into the read model. */
export async function syncOwner(deps: SyncAssetDeps, owner: string): Promise<SyncBatchResult> {
  const assets = await deps.indexer.getAssetsByOwner(owner);
  const result = await upsertAll(deps, assets);
  log.info('owner synced', { owner, ...result });
  return result;
}

/**
 * Refresh a collection's own metadata row (name/image/size) when a
 * CollectionRepository and a DAS indexer that exposes `getCollection` are
 * available. Size is counted from the read model when DAS reports 0.
 */
export async function syncCollectionMeta(
  deps: SyncAssetDeps,
  collection: string,
): Promise<{ stored: boolean }> {
  if (!deps.collections || !deps.indexer.getCollection) {
    return { stored: false };
  }
  const meta: Collection | null = await deps.indexer.getCollection(collection);
  if (!meta) {
    log.warn('collection not found on-chain, skipping', { collection });
    return { stored: false };
  }
  const size =
    meta.size > 0 ? meta.size : (await deps.assets.findByCollection(collection)).length;
  await deps.collections.upsert({ ...meta, size });
  log.info('collection meta upserted', { collection, size });
  return { stored: true };
}

/**
 * Build the single-asset Inngest function with injected dependencies. The body
 * delegates to {@link syncAsset} so tested logic == shipped logic.
 */
export function makeSyncAssetFunction(deps: SyncAssetDeps) {
  return inngest.createFunction(
    { id: 'sync-asset-metadata' },
    { event: 'micow/asset.sync' },
    async ({ event, step }) => {
      const { mint } = event.data as { mint: string };
      return step.run('fetch-and-upsert', () => syncAsset(deps, mint));
    },
  );
}

/** Build the collection-sync Inngest function (assets + collection meta). */
export function makeSyncCollectionFunction(deps: SyncAssetDeps) {
  return inngest.createFunction(
    { id: 'sync-collection' },
    { event: 'micow/collection.sync' },
    async ({ event, step }) => {
      const { collection } = event.data as { collection: string };
      const assets = await step.run('sync-assets', () => syncCollection(deps, collection));
      const meta = await step.run('sync-collection-meta', () => syncCollectionMeta(deps, collection));
      return { collection, ...assets, metaStored: meta.stored };
    },
  );
}

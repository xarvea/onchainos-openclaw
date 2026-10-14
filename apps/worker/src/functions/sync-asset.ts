import type { AssetRepository } from '@micow/application';
import { logger } from '@micow/observability';

import { inngest } from '../client';
import type { AssetIndexer } from '../indexer-port';

const log = logger.child({ app: 'micow-worker', fn: 'sync-asset' });

export interface SyncAssetDeps {
  indexer: AssetIndexer;
  assets: AssetRepository;
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

/**
 * Build the Inngest function with injected dependencies. Kept as a factory so
 * the composition root (with real or fake indexer/repo) is wired in one place.
 * The body delegates to {@link syncAsset} so tested logic == shipped logic.
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

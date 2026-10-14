import type { AssetRepository } from '@micow/application';
import { logger } from '@micow/observability';

import { inngest } from '../client';
import type { AssetIndexer } from '../indexer-port';

const log = logger.child({ app: 'micow-worker', fn: 'sync-asset' });

export interface SyncAssetDeps {
  indexer: AssetIndexer;
  assets: AssetRepository;
}

/**
 * Build the sync function with injected dependencies. Kept as a factory so the
 * composition root (with real or fake indexer/repo) is wired in one place.
 */
export function makeSyncAssetFunction(deps: SyncAssetDeps) {
  return inngest.createFunction(
    { id: 'sync-asset-metadata' },
    { event: 'micow/asset.sync' },
    async ({ event, step }) => {
      const { mint } = event.data as { mint: string };

      const result = await step.run('fetch-and-upsert', async () => {
        const asset = await deps.indexer.getAsset(mint);
        if (!asset) {
          log.warn('asset not found on-chain, skipping', { mint });
          return { mint, stored: false };
        }
        await deps.assets.upsert(asset);
        log.info('asset upserted', { mint, owner: asset.owner });
        return { mint, stored: true };
      });

      return result;
    },
  );
}

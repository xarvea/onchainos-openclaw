import { parseServerEnv } from '@micow/config';
import { createContainer, createDb } from '@micow/database';
import { logger } from '@micow/observability';
import { HeliusDasIndexer } from '@micow/solana';

import { makeSyncAssetFunction, makeSyncCollectionFunction } from './functions/sync-asset';

const log = logger.child({ app: 'micow-worker' });

/**
 * Composition root for the worker: reads validated env, builds the DB
 * container and the indexer, and assembles the Inngest functions.
 *
 * Fails fast if DATABASE_URL is missing — a worker without a DB is useless.
 */
export function buildWorker() {
  const env = parseServerEnv();

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the worker');
  }

  const db = createDb(env.DATABASE_URL, { max: 5 });
  const container = createContainer(db);

  // Indexer is optional until HELIUS_API_KEY is set; without it, sync jobs will
  // fail loudly rather than silently no-op.
  const indexer = env.HELIUS_API_KEY
    ? new HeliusDasIndexer(env.HELIUS_API_KEY)
    : (() => {
        throw new Error('HELIUS_API_KEY is required for the asset indexer');
      })();

  const deps = {
    indexer,
    assets: container.assets,
    collections: container.collections,
  };

  const functions = [makeSyncAssetFunction(deps), makeSyncCollectionFunction(deps)];

  log.info('micow worker assembled', { functions: functions.length });
  return { handler: functions, container };
}

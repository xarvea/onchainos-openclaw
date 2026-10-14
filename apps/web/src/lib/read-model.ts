import { createContainer, createDb, type Container } from '@micow/database';
import type { Activity, Asset, Collection } from '@micow/domain';
import { logger } from '@micow/observability';

/**
 * Server-side read-model access for the web app.
 *
 * The database is a *read model* fed by the indexer — it is not a source of
 * truth. If DATABASE_URL is unset (fresh checkout, CI build, preview without a
 * DB) we must NOT crash the page; we degrade to empty results so the UI renders
 * a helpful empty state instead.
 */

const log = logger.child({ app: 'micow-web', lib: 'read-model' });

let cached: Container | null | undefined;

/** Returns a container, or null when no database is configured. */
export function readModel(): Container | null {
  if (cached !== undefined) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    log.warn('DATABASE_URL not set — read model disabled (empty results)');
    cached = null;
    return cached;
  }

  try {
    cached = createContainer(createDb(url, { max: 3 }));
  } catch (err) {
    log.error('failed to initialise database — degrading to empty results', {
      error: err instanceof Error ? err.message : String(err),
    });
    cached = null;
  }
  return cached;
}

/** True when a read model is available (used to show setup hints in the UI). */
export function readModelEnabled(): boolean {
  return readModel() !== null;
}

export interface ListResult<T> {
  items: T[];
  enabled: boolean;
}

export async function listCollections(
  opts: { limit?: number; offset?: number } = {},
): Promise<ListResult<Collection>> {
  const c = readModel();
  if (!c) return { items: [], enabled: false };
  const items = await c.collections.list(opts);
  return { items, enabled: true };
}

export async function getCollection(address: string): Promise<ListResult<Collection | null>> {
  const c = readModel();
  if (!c) return { items: [], enabled: false };
  const found = await c.collections.findByAddress(address).catch(() => null);
  return { items: found ? [found] : [], enabled: true };
}

export async function listAssetsByCollection(
  collection: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ListResult<Asset>> {
  const c = readModel();
  if (!c) return { items: [], enabled: false };
  const assets = await c.assets.findByCollection(collection, opts).catch(() => [] as Asset[]);
  return { items: assets, enabled: true };
}

export async function listAssetsByOwner(
  owner: string,
  opts: { limit?: number } = {},
): Promise<ListResult<Asset>> {
  const c = readModel();
  if (!c) return { items: [], enabled: false };
  let assets = await c.assets.findByOwner(owner).catch(() => [] as Asset[]);
  if (opts.limit) assets = assets.slice(0, opts.limit);
  return { items: assets, enabled: true };
}

export async function listRecentActivities(
  opts: { limit?: number; offset?: number } = {},
): Promise<ListResult<Activity>> {
  const c = readModel();
  if (!c) return { items: [], enabled: false };
  const items = await c.activities.listRecent(opts).catch(() => [] as Activity[]);
  return { items, enabled: true };
}

export async function listActivitiesByAsset(
  asset: string,
  opts: { limit?: number } = {},
): Promise<ListResult<Activity>> {
  const c = readModel();
  if (!c) return { items: [], enabled: false };
  const items = await c.activities.listByAsset(asset, opts).catch(() => [] as Activity[]);
  return { items, enabled: true };
}

/**
 * Persist activities into the read model (idempotent). Returns false when no
 * database is configured, so the webhook can answer 503 rather than silently
 * dropping events. Errors propagate — a webhook must not claim success on a
 * failed write or Helius will stop retrying.
 */
export async function recordActivities(activities: Activity[]): Promise<boolean> {
  const c = readModel();
  if (!c) return false;
  if (activities.length === 0) return true;
  await c.activities.recordMany(activities);
  return true;
}

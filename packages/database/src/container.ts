import type {
  Activity,
  ActivityRepository,
  Asset,
  AssetRepository,
  Collection,
  CollectionRepository,
  Listing,
  ListingRepository,
  ListingStatus,
} from '@micow/application';
import type { drizzle } from 'drizzle-orm/postgres-js';

import {
  DrizzleActivityRepository,
  DrizzleAssetRepository,
  DrizzleCollectionRepository,
  DrizzleListingRepository,
} from './repositories/index';
import type * as schema from './schema/index';

/** Concrete Drizzle database handle type. */
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export interface Container {
  assets: AssetRepository;
  collections: CollectionRepository;
  listings: ListingRepository;
  activities: ActivityRepository;
}

/**
 * Composition root: wires infrastructure (Drizzle) to the application's ports.
 * This is the ONLY place that knows about concrete implementations.
 */
export function createContainer(db: DrizzleDb): Container {
  return {
    assets: new DrizzleAssetRepository(db),
    collections: new DrizzleCollectionRepository(db),
    listings: new DrizzleListingRepository(db),
    activities: new DrizzleActivityRepository(db),
  };
}

/** In-memory implementation for tests and local development without a DB. */
export class InMemoryAssetRepository implements AssetRepository {
  private readonly store = new Map<string, Asset>();

  async findByMint(mint: string): Promise<Asset | null> {
    return this.store.get(mint) ?? null;
  }
  async findByOwner(owner: string): Promise<Asset[]> {
    return [...this.store.values()].filter((a) => a.owner === owner);
  }
  async findByCollection(
    collection: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<Asset[]> {
    const all = [...this.store.values()].filter((a) => a.collection === collection);
    return all.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
  }
  async upsert(asset: Asset): Promise<void> {
    this.store.set(asset.mint, asset);
  }
  get size(): number {
    return this.store.size;
  }
}

export class InMemoryCollectionRepository implements CollectionRepository {
  private readonly store = new Map<string, Collection>();
  async findByAddress(address: string): Promise<Collection | null> {
    return this.store.get(address) ?? null;
  }
  async list(opts: { limit?: number; offset?: number } = {}): Promise<Collection[]> {
    return [...this.store.values()].slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
  }
  async upsert(collection: Collection): Promise<void> {
    this.store.set(collection.address, collection);
  }
}

export class InMemoryListingRepository implements ListingRepository {
  private readonly store = new Map<string, Listing>();
  async findActiveByAsset(asset: string): Promise<Listing | null> {
    return [...this.store.values()].find((l) => l.asset === asset && l.status === 'ACTIVE') ?? null;
  }
  async findById(id: string): Promise<Listing | null> {
    return this.store.get(id) ?? null;
  }
  async listActiveBySeller(seller: string): Promise<Listing[]> {
    return [...this.store.values()].filter((l) => l.seller === seller && l.status === 'ACTIVE');
  }
  async listActive(opts: { limit?: number; offset?: number } = {}): Promise<Listing[]> {
    const all = [...this.store.values()].filter((l) => l.status === 'ACTIVE');
    return all.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
  }
  async create(listing: Listing): Promise<void> {
    this.store.set(listing.id, listing);
  }
  async updateStatus(id: string, status: ListingStatus): Promise<void> {
    const existing = this.store.get(id);
    if (existing) this.store.set(id, { ...existing, status });
  }
}

export class InMemoryActivityRepository implements ActivityRepository {
  private readonly store = new Map<string, Activity>();

  async record(activity: Activity): Promise<void> {
    // Append-only: replays are a no-op, matching the Drizzle `DO NOTHING` impl.
    if (!this.store.has(activity.id)) this.store.set(activity.id, activity);
  }

  async recordMany(items: Activity[]): Promise<void> {
    for (const a of items) await this.record(a);
  }

  private sorted(): Activity[] {
    return [...this.store.values()].sort((a, b) => b.blockTime.getTime() - a.blockTime.getTime());
  }

  async listByAsset(
    asset: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<Activity[]> {
    return this.page(
      this.sorted().filter((a) => a.asset === asset),
      opts,
    );
  }

  async listByCollection(
    collection: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<Activity[]> {
    return this.page(
      this.sorted().filter((a) => a.collection === collection),
      opts,
    );
  }

  async listRecent(opts: { limit?: number; offset?: number } = {}): Promise<Activity[]> {
    return this.page(this.sorted(), opts);
  }

  private page(items: Activity[], opts: { limit?: number; offset?: number }): Activity[] {
    return items.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
  }

  get size(): number {
    return this.store.size;
  }
}

/** In-memory container for unit tests. */
export function createInMemoryContainer(): Container {
  return {
    assets: new InMemoryAssetRepository(),
    collections: new InMemoryCollectionRepository(),
    listings: new InMemoryListingRepository(),
    activities: new InMemoryActivityRepository(),
  };
}

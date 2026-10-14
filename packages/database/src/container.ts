import type {
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
  DrizzleAssetRepository,
  DrizzleCollectionRepository,
  DrizzleListingRepository,
} from './repositories/index';
import * as schema from './schema/index';

/** Concrete Drizzle database handle type. */
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export interface Container {
  assets: AssetRepository;
  collections: CollectionRepository;
  listings: ListingRepository;
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
  async create(listing: Listing): Promise<void> {
    this.store.set(listing.id, listing);
  }
  async updateStatus(id: string, status: ListingStatus): Promise<void> {
    const existing = this.store.get(id);
    if (existing) this.store.set(id, { ...existing, status });
  }
}

/** In-memory container for unit tests. */
export function createInMemoryContainer(): Container {
  return {
    assets: new InMemoryAssetRepository(),
    collections: new InMemoryCollectionRepository(),
    listings: new InMemoryListingRepository(),
  };
}

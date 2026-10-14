import type { Asset, AssetRepository, Collection, CollectionRepository } from '@micow/application';
import { asPublicKey } from '@micow/domain';
import { eq, sql } from 'drizzle-orm';

import type { Db } from '../index';
import { assets, collections } from '../schema/index';

/** Drizzle-backed implementation of the application AssetRepository port. */
export class DrizzleAssetRepository implements AssetRepository {
  constructor(private readonly db: Db) {}

  async findByMint(mint: string): Promise<Asset | null> {
    const rows = await this.db.select().from(assets).where(eq(assets.mint, mint)).limit(1);
    const row = rows[0];
    return row ? toAsset(row) : null;
  }

  async findByOwner(owner: string): Promise<Asset[]> {
    const rows = await this.db.select().from(assets).where(eq(assets.owner, owner));
    return rows.map(toAsset);
  }

  async findByCollection(
    collection: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<Asset[]> {
    const rows = await this.db
      .select()
      .from(assets)
      .where(eq(assets.collection, collection))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
    return rows.map(toAsset);
  }

  /** Idempotent upsert keyed on mint. Safe to replay from DAS/chain. */
  async upsert(asset: Asset): Promise<void> {
    await this.db
      .insert(assets)
      .values({
        mint: asset.mint,
        name: asset.name,
        uri: asset.uri,
        image: asset.image,
        standard: asset.standard,
        collection: asset.collection,
        owner: asset.owner,
        creator: asset.creator,
        attributes: asset.attributes.map((a) => ({ traitType: a.traitType, value: a.value })),
        compressed: asset.compressed,
        frozen: asset.frozen,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: assets.mint,
        set: {
          name: asset.name,
          uri: asset.uri,
          image: asset.image,
          owner: asset.owner,
          standard: asset.standard,
          collection: asset.collection,
          creator: asset.creator,
          attributes: asset.attributes.map((a) => ({ traitType: a.traitType, value: a.value })),
          compressed: asset.compressed,
          frozen: asset.frozen,
          updatedAt: new Date(),
        },
      });
  }

  async count(): Promise<number> {
    const rows = await this.db.select({ n: sql<number>`count(*)::int` }).from(assets);
    return rows[0]?.n ?? 0;
  }
}

export class DrizzleCollectionRepository implements CollectionRepository {
  constructor(private readonly db: Db) {}

  async findByAddress(address: string): Promise<Collection | null> {
    const rows = await this.db
      .select()
      .from(collections)
      .where(eq(collections.address, address))
      .limit(1);
    const row = rows[0];
    return row ? toCollection(row) : null;
  }

  async list(opts: { limit?: number; offset?: number } = {}): Promise<Collection[]> {
    const rows = await this.db
      .select()
      .from(collections)
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
    return rows.map(toCollection);
  }

  async upsert(collection: Collection): Promise<void> {
    await this.db
      .insert(collections)
      .values({
        address: collection.address,
        name: collection.name,
        image: collection.image,
        description: collection.description,
        verified: collection.verified,
        size: collection.size,
        standard: collection.standard,
        creator: collection.creator,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: collections.address,
        set: {
          name: collection.name,
          image: collection.image,
          description: collection.description,
          verified: collection.verified,
          size: collection.size,
          standard: collection.standard,
          creator: collection.creator,
          updatedAt: new Date(),
        },
      });
  }
}

type AssetRow = typeof assets.$inferSelect;
type CollectionRow = typeof collections.$inferSelect;

function toAsset(row: AssetRow): Asset {
  return {
    mint: asPublicKey(row.mint),
    name: row.name,
    uri: row.uri,
    image: row.image,
    standard: row.standard as Asset['standard'],
    collection: row.collection ? asPublicKey(row.collection) : null,
    owner: asPublicKey(row.owner),
    creator: row.creator ? asPublicKey(row.creator) : null,
    attributes: (row.attributes ?? []).map((a) => ({ traitType: a.traitType, value: a.value })),
    compressed: row.compressed,
    frozen: row.frozen,
  };
}

function toCollection(row: CollectionRow): Collection {
  return {
    address: asPublicKey(row.address),
    name: row.name,
    image: row.image,
    description: row.description,
    verified: row.verified,
    size: row.size,
    standard: row.standard as Collection['standard'],
    creator: row.creator ? asPublicKey(row.creator) : null,
  };
}

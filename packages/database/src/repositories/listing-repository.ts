import type { Listing, ListingRepository, ListingStatus } from '@micow/application';
import { asLamports, asPublicKey, type TxSignature } from '@micow/domain';
import { and, desc, eq } from 'drizzle-orm';

import type { Db } from '../index';
import { listings } from '../schema/index';

/** Drizzle-backed implementation of the application ListingRepository port. */
export class DrizzleListingRepository implements ListingRepository {
  constructor(private readonly db: Db) {}

  async findActiveByAsset(asset: string): Promise<Listing | null> {
    const rows = await this.db
      .select()
      .from(listings)
      .where(and(eq(listings.asset, asset), eq(listings.status, 'ACTIVE')))
      .orderBy(desc(listings.createdAt))
      .limit(1);
    const row = rows[0];
    return row ? toListing(row) : null;
  }

  async findById(id: string): Promise<Listing | null> {
    const rows = await this.db.select().from(listings).where(eq(listings.id, id)).limit(1);
    const row = rows[0];
    return row ? toListing(row) : null;
  }

  async listActiveBySeller(seller: string): Promise<Listing[]> {
    const rows = await this.db
      .select()
      .from(listings)
      .where(and(eq(listings.seller, seller), eq(listings.status, 'ACTIVE')))
      .orderBy(desc(listings.createdAt));
    return rows.map(toListing);
  }

  async listActive(opts: { limit?: number; offset?: number } = {}): Promise<Listing[]> {
    const rows = await this.db
      .select()
      .from(listings)
      .where(eq(listings.status, 'ACTIVE'))
      .orderBy(desc(listings.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
    return rows.map(toListing);
  }

  async create(listing: Listing): Promise<void> {
    await this.db.insert(listings).values({
      id: listing.id,
      asset: listing.asset,
      seller: listing.seller,
      price: listing.price,
      platformFee: listing.platformFee,
      creatorRoyalty: listing.creatorRoyalty,
      status: listing.status,
      txSignature: listing.txSignature,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt,
    });
  }

  async updateStatus(id: string, status: ListingStatus): Promise<void> {
    await this.db.update(listings).set({ status }).where(eq(listings.id, id));
  }
}

type ListingRow = typeof listings.$inferSelect;

function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    asset: asPublicKey(row.asset),
    seller: asPublicKey(row.seller),
    price: asLamports(row.price),
    platformFee: asLamports(row.platformFee),
    creatorRoyalty: asLamports(row.creatorRoyalty),
    status: row.status as ListingStatus,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    txSignature: (row.txSignature as TxSignature | null) ?? null,
  };
}

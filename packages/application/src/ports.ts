import type { Asset, Collection, Listing, ListingStatus } from '@micow/domain';

/**
 * Ports (interfaces) that the application layer depends on. Infrastructure
 * (Helius, Postgres, on-chain program clients) implements these. Application
 * code must not import concrete infra.
 */

export interface AssetRepository {
  findByMint(mint: string): Promise<Asset | null>;
  findByOwner(owner: string): Promise<Asset[]>;
  findByCollection(collection: string, opts?: { limit?: number; offset?: number }): Promise<Asset[]>;
  upsert(asset: Asset): Promise<void>;
}

export interface CollectionRepository {
  findByAddress(address: string): Promise<Collection | null>;
  list(opts?: { limit?: number; offset?: number }): Promise<Collection[]>;
  upsert(collection: Collection): Promise<void>;
}

export interface ListingRepository {
  findActiveByAsset(asset: string): Promise<Listing | null>;
  create(listing: Listing): Promise<void>;
  updateStatus(id: string, status: ListingStatus): Promise<void>;
}

/** Broadcaster for on-chain writes (list/buy/cancel). Implemented in infra. */
export interface ListingGateway {
  buildCreateListingTx(input: {
    asset: string;
    seller: string;
    priceLamports: bigint;
    expiresAt?: Date;
  }): Promise<{ serializedTx: string }>;
  buildCancelListingTx(input: { listingId: string; seller: string }): Promise<{ serializedTx: string }>;
  buildBuyTx(input: { listingId: string; buyer: string }): Promise<{ serializedTx: string }>;
}

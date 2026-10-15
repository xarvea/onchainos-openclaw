import type { Activity, Asset, Collection, Listing, ListingStatus } from '@micow/domain';

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
  findById(id: string): Promise<Listing | null>;
  listActiveBySeller(seller: string): Promise<Listing[]>;
  listActive(opts?: { limit?: number; offset?: number }): Promise<Listing[]>;
  create(listing: Listing): Promise<void>;
  updateStatus(id: string, status: ListingStatus): Promise<void>;
}

/**
 * Append-only feed of on-chain events (mints, transfers, sales, listings).
 * Fed by Helius webhooks / backfill; keyed by a deterministic id so replays and
 * duplicate deliveries are idempotent.
 */
export interface ActivityRepository {
  /** Idempotent insert keyed on `activity.id`. Safe to replay. */
  record(activity: Activity): Promise<void>;
  /** Record many in one round-trip; must itself be idempotent. */
  recordMany(activities: Activity[]): Promise<void>;
  listByAsset(asset: string, opts?: { limit?: number; offset?: number }): Promise<Activity[]>;
  listByCollection(
    collection: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<Activity[]>;
  listRecent(opts?: { limit?: number; offset?: number }): Promise<Activity[]>;
}

/**
 * Broadcaster for on-chain listing writes (list/buy/cancel).
 *
 * Model: **non-custodial** (ADR-0005 rev). The asset stays in the seller's
 * wallet; listing works by granting MICOW's delegate authority over the asset
 * via Core's `Transfer Delegate` plugin. Buying transfers seller→buyer (the
 * delegate authority is revoked by Core automatically after the transfer).
 * Cancelling revokes the delegate.
 *
 * All methods return an **unsigned, serialized** transaction — the backend never
 * signs for the user (BLUEPRINT §3). Signing happens in the user's wallet.
 */
export interface ListingGateway {
  buildCreateListingTx(input: {
    asset: string;
    seller: string;
    /** Delegate authority (MICOW) that will be granted transfer rights. */
    delegate: string;
    expiresAt?: Date;
  }): Promise<{ serializedTx: string }>;
  buildCancelListingTx(input: {
    listingId: string;
    asset: string;
    seller: string;
    delegate: string;
  }): Promise<{ serializedTx: string }>;
  buildBuyTx(input: {
    listingId: string;
    asset: string;
    seller: string;
    buyer: string;
    delegate: string;
    priceLamports: bigint;
  }): Promise<{ serializedTx: string }>;
}

/**
 * Off-chain metadata storage (IPFS, Arweave, or any other content-addressed
 * host). Implemented in infra. The application layer never talks to a storage
 * SDK directly — it only asks for a URI, which is then embedded in the on-chain
 * collection/asset metadata.
 */
export interface MetadataStorage {
  /**
   * Persist a UTF-8 metadata object (already JSON-serializable) and return an
   * immutable URI that resolves to it. Implementations must fail loudly on
   * error — a launch with a broken URI produces un-metadata'd assets on-chain.
   */
  putJson(json: Record<string, unknown>): Promise<{ uri: string }>;
  /**
   * Persist raw bytes (an image) and return the URI that resolves to it.
   * Used before `putJson` so the metadata can reference the image URI.
   */
  putBytes(
    data: Uint8Array,
    opts: { contentType: string; fileName?: string },
  ): Promise<{ uri: string }>;
}

/**
 * Creates a collection + public-mint launch on-chain (Candy Machine v3 + Core).
 * Implemented in infra (Umi). Admin operation — never invoked from the browser;
 * the interactive mint itself is signed by the user's wallet client-side.
 */
export interface CollectionMinter {
  /**
   * Create a Core collection and a Candy Machine that mints items into it.
   * Returns the addresses of the created accounts. Idempotency is the caller's
   * concern — each call creates fresh accounts.
   */
  launchCollection(input: {
    name: string;
    /** Off-chain metadata URI for the collection (uploaded separately). */
    uri: string;
    items: { name: string; uri: string }[];
    /** Mint price in lamports (0 = free). */
    priceLamports: bigint;
    /** Treasury receiving proceeds (required when price > 0). */
    treasury: string;
    /** Max mints per wallet (0 = unlimited). */
    mintLimitPerWallet: number;
    /** Royalty in basis points (0-10000). */
    royaltyBps: number;
  }): Promise<{ collection: string; candyMachine: string; signatures: string[] }>;
}

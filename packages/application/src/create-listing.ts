import {
  asLamports,
  assertCanBuy,
  assertCanCancel,
  assertSingleActiveListing,
  computeFeeSplit,
  type Lamports,
  type Listing,
  type PublicKeyString,
} from '@micow/domain';

import type { ListingGateway, ListingRepository } from './ports';

/**
 * Listing use cases (create / cancel / buy) for the **non-custodial** model
 * (ADR-0005 rev). Each use case:
 *   1. enforces the domain invariants (BLUEPRINT §6),
 *   2. persists the intended state change in the read model,
 *   3. asks the gateway for the *unsigned* transaction the user must sign.
 *
 * The backend never signs for the user. A listing created here is `ACTIVE` in
 * the read model; the on-chain delegate grant is confirmed by the client.
 */

/** Injected dependencies; `now` and `id` are injectable for determinism. */
export interface ListingDeps {
  listings: ListingRepository;
  gateway: ListingGateway;
  now?: () => Date;
  /** Generate a listing id (defaults to crypto.randomUUID). */
  newId?: () => string;
  /** Platform fee in basis points (D5 — configurable). */
  platformBps: number;
}

function makeId(deps: ListingDeps): string {
  return (deps.newId ?? (() => crypto.randomUUID()))();
}

// ─────────────────────────────────────────────────────────────────────────────
// createListing
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateListingInput {
  asset: PublicKeyString;
  seller: PublicKeyString;
  delegate: PublicKeyString;
  priceLamports: bigint;
  /** Royalty basis points copied from the collection (0 disables royalty). */
  royaltyBps?: number;
  expiresAt?: Date | null;
}

export interface CreateListingResult {
  listing: Listing;
  serializedTx: string;
}

export async function createListing(
  deps: ListingDeps,
  input: CreateListingInput,
): Promise<CreateListingResult> {
  const now = (deps.now ?? (() => new Date()))();

  if (input.priceLamports <= 0n) {
    throw new Error('createListing: price must be > 0');
  }
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) {
    throw new Error('createListing: expiresAt must be in the future');
  }

  // I1 — at most one ACTIVE listing per asset.
  const existing = await deps.listings.findActiveByAsset(input.asset);
  assertSingleActiveListing(
    { asset: input.asset, status: 'ACTIVE' },
    existing ? [{ asset: existing.asset, status: existing.status }] : [],
  );

  // I5 — deterministic split, computed now and stored with the listing.
  const split = computeFeeSplit((input.priceLamports as unknown) as Lamports, {
    platformBps: deps.platformBps,
    royaltyBps: input.royaltyBps ?? 0,
  });

  const listing: Listing = {
    id: makeId(deps),
    asset: input.asset,
    seller: input.seller,
    price: input.priceLamports as unknown as Lamports,
    platformFee: split.platformFee,
    creatorRoyalty: split.creatorRoyalty,
    status: 'ACTIVE',
    createdAt: now,
    expiresAt: input.expiresAt ?? null,
    txSignature: null,
  };

  await deps.listings.create(listing);

  const { serializedTx } = await deps.gateway.buildCreateListingTx({
    asset: input.asset,
    seller: input.seller,
    delegate: input.delegate,
    expiresAt: input.expiresAt ?? undefined,
  });

  return { listing, serializedTx };
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelListing
// ─────────────────────────────────────────────────────────────────────────────

export interface CancelListingInput {
  listingId: string;
  caller: PublicKeyString;
  delegate: PublicKeyString;
}

export async function cancelListing(
  deps: ListingDeps,
  input: CancelListingInput,
): Promise<{ listing: Listing; serializedTx: string }> {
  const listing = await deps.listings.findById(input.listingId);
  if (!listing) throw new Error(`cancelListing: listing not found: ${input.listingId}`);

  // I4 — only the seller may cancel, and not once terminal.
  assertCanCancel(listing, input.caller);

  await deps.listings.updateStatus(listing.id, 'CANCELLED');

  const { serializedTx } = await deps.gateway.buildCancelListingTx({
    listingId: listing.id,
    asset: listing.asset,
    seller: listing.seller,
    delegate: input.delegate,
  });

  return { listing: { ...listing, status: 'CANCELLED' }, serializedTx };
}

// ─────────────────────────────────────────────────────────────────────────────
// buyListing
// ─────────────────────────────────────────────────────────────────────────────

export interface BuyListingInput {
  listingId: string;
  buyer: PublicKeyString;
  delegate: PublicKeyString;
}

export async function buyListing(
  deps: ListingDeps,
  input: BuyListingInput,
): Promise<{ listing: Listing; split: { platformFee: Lamports; creatorRoyalty: Lamports; sellerProceeds: Lamports }; serializedTx: string }> {
  const now = (deps.now ?? (() => new Date()))();
  const listing = await deps.listings.findById(input.listingId);
  if (!listing) throw new Error(`buyListing: listing not found: ${input.listingId}`);

  // I6 — must be ACTIVE and not expired.
  assertCanBuy(listing, now);

  if (listing.seller === input.buyer) {
    throw new Error('buyListing: seller cannot buy their own listing');
  }

  // Recompute the split from the stored price to hand the exact amounts to the
  // transaction builder. (Stored platformFee/creatorRoyalty are authoritative;
  // sellerProceeds is the remainder.)
  const sellerProceeds = asLamports(listing.price - listing.platformFee - listing.creatorRoyalty);

  await deps.listings.updateStatus(listing.id, 'FILLED');

  const { serializedTx } = await deps.gateway.buildBuyTx({
    listingId: listing.id,
    asset: listing.asset,
    seller: listing.seller,
    buyer: input.buyer,
    delegate: input.delegate,
    priceLamports: listing.price,
  });

  return {
    listing: { ...listing, status: 'FILLED' },
    split: {
      platformFee: listing.platformFee,
      creatorRoyalty: listing.creatorRoyalty,
      sellerProceeds,
    },
    serializedTx,
  };
}

export function toListingId(listing: Pick<Listing, 'id'>): string {
  return listing.id;
}

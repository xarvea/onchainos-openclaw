import { assertSingleActiveListing, type Listing, type PublicKeyString } from '@micow/domain';

import type { ListingGateway, ListingRepository } from './ports';

export interface CreateListingDeps {
  listings: ListingRepository;
  gateway: ListingGateway;
  now?: () => Date;
}

/**
 * Create-listing use case. Enforces I1 (single active listing per asset) before
 * asking the gateway to build the transaction.
 *
 * NOTE: this prepares an unsigned transaction. The backend never signs on behalf
 * of the user — signing happens in the user's wallet.
 */
export async function createListing(
  deps: CreateListingDeps,
  input: { asset: PublicKeyString; seller: PublicKeyString; priceLamports: bigint; expiresAt?: Date },
): Promise<{ serializedTx: string }> {
  const existing = await deps.listings.findActiveByAsset(input.asset);
  assertSingleActiveListing(
    { asset: input.asset, status: 'ACTIVE' },
    existing ? [{ asset: existing.asset, status: existing.status }] : [],
  );

  return deps.gateway.buildCreateListingTx({
    asset: input.asset,
    seller: input.seller,
    priceLamports: input.priceLamports,
    expiresAt: input.expiresAt,
  });
}

export function toListingId(listing: Pick<Listing, 'id'>): string {
  return listing.id;
}

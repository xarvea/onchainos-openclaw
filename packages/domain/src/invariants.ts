import { isTerminal, type Listing, type ListingStatus } from './listing';
import type { Lamports } from './primitives';

/**
 * Domain invariants for NFT listings (docs/product/BLUEPRINT.md §6).
 *
 * These are pure functions with no framework/DB/chain dependency so they can be
 * unit-tested in isolation and reused by both the on-chain program tests and
 * the backend.
 */

export class InvariantViolation extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'InvariantViolation';
  }
}

/** I1 — an asset may have at most one ACTIVE listing at a time. */
export function assertSingleActiveListing(
  candidate: { asset: string; status: ListingStatus },
  existing: ReadonlyArray<{ asset: string; status: ListingStatus }>,
): void {
  const conflict = existing.find(
    (l) => l.asset === candidate.asset && l.status === 'ACTIVE' && candidate.status === 'ACTIVE',
  );
  if (conflict) {
    throw new InvariantViolation('I1', `Asset ${candidate.asset} already has an ACTIVE listing`);
  }
}

/** I3/I5 — funds must be split deterministically and sum exactly to the price. */
export function assertPaymentSplit(
  price: Lamports,
  platformFee: Lamports,
  creatorRoyalty: Lamports,
  sellerProceeds: Lamports,
): void {
  const total = platformFee + creatorRoyalty + sellerProceeds;
  if (total !== price) {
    throw new InvariantViolation(
      'I5',
      `Payment split mismatch: ${total} != price ${price} (fee=${platformFee}, royalty=${creatorRoyalty}, seller=${sellerProceeds})`,
    );
  }
}

/** I4 — only the original seller may cancel. */
export function assertCanCancel(listing: Listing, caller: string): void {
  if (isTerminal(listing.status)) {
    throw new InvariantViolation('I4', `Cannot cancel listing in terminal state ${listing.status}`);
  }
  if (listing.seller !== caller) {
    throw new InvariantViolation('I4', `Only seller ${listing.seller} may cancel (caller=${caller})`);
  }
}

/** I6 — an expired listing can never be bought. */
export function assertCanBuy(listing: Listing, now: Date = new Date()): void {
  if (listing.status !== 'ACTIVE') {
    throw new InvariantViolation('I6', `Listing is not ACTIVE (status=${listing.status})`);
  }
  if (listing.expiresAt && listing.expiresAt.getTime() <= now.getTime()) {
    throw new InvariantViolation('I6', `Listing expired at ${listing.expiresAt.toISOString()}`);
  }
}

import type { Lamports, PublicKeyString, TxSignature } from './primitives';

/**
 * Listing state machine (see docs/product/BLUEPRINT.md §6).
 *
 *   createListing
 *        │
 *        ▼
 *   ┌─────────┐   buy        ┌───────────┐
 *   │ ACTIVE  │─────────────▶│  FILLED   │  (terminal)
 *   └────┬────┘              └───────────┘
 *        │ cancel / expire
 *        ▼
 *   ┌───────────┐
 *   │ CANCELLED │  (terminal)
 *   └───────────┘
 */
export const ListingStatus = {
  ACTIVE: 'ACTIVE',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const TERMINAL_LISTING_STATUSES: readonly ListingStatus[] = [
  ListingStatus.FILLED,
  ListingStatus.CANCELLED,
  ListingStatus.EXPIRED,
];

export interface Listing {
  readonly id: string;
  readonly asset: PublicKeyString;
  readonly seller: PublicKeyString;
  /** Price the buyer pays, in lamports. */
  readonly price: Lamports;
  /** Platform fee portion, in lamports. */
  readonly platformFee: Lamports;
  /** Creator royalty portion, in lamports. */
  readonly creatorRoyalty: Lamports;
  readonly status: ListingStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly txSignature: TxSignature | null;
}

export function isTerminal(status: ListingStatus): boolean {
  return TERMINAL_LISTING_STATUSES.includes(status);
}

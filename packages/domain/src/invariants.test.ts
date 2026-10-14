import { describe, expect, it } from 'vitest';

import {
  assertCanBuy,
  assertCanCancel,
  assertPaymentSplit,
  assertSingleActiveListing,
  InvariantViolation,
} from './invariants';
import { ListingStatus, type Listing } from './listing';
import { asPublicKey, lamportsFromSol } from './primitives';

const price = lamportsFromSol(1);
const fee = lamportsFromSol(0.02);
const royalty = lamportsFromSol(0.05);
const seller = lamportsFromSol(0.93);

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    asset: asPublicKey('So11111111111111111111111111111111111111112'),
    seller: asPublicKey('So11111111111111111111111111111111111111112'),
    price,
    platformFee: fee,
    creatorRoyalty: royalty,
    status: ListingStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: null,
    txSignature: null,
    ...overrides,
  };
}

describe('domain invariants', () => {
  it('I1: rejects a second ACTIVE listing for the same asset', () => {
    const existing = [{ asset: 'A', status: ListingStatus.ACTIVE }];
    expect(() => assertSingleActiveListing({ asset: 'A', status: 'ACTIVE' }, existing)).toThrow(
      InvariantViolation,
    );
    expect(() => assertSingleActiveListing({ asset: 'B', status: 'ACTIVE' }, existing)).not.toThrow();
  });

  it('I5: payment split must sum exactly to price', () => {
    expect(() => assertPaymentSplit(price, fee, royalty, seller)).not.toThrow();
    expect(() => assertPaymentSplit(price, fee, royalty, lamportsFromSol(0.92))).toThrow(
      InvariantViolation,
    );
  });

  it('I4: only the seller can cancel', () => {
    const l = listing();
    expect(() => assertCanCancel(l, l.seller)).not.toThrow();
    expect(() => assertCanCancel(l, 'someone-else')).toThrow(InvariantViolation);
    expect(() => assertCanCancel(listing({ status: ListingStatus.FILLED }), l.seller)).toThrow(
      InvariantViolation,
    );
  });

  it('I6: expired listings cannot be bought', () => {
    const expired = listing({ expiresAt: new Date('2026-01-02T00:00:00Z') });
    const now = new Date('2026-01-03T00:00:00Z');
    expect(() => assertCanBuy(expired, now)).toThrow(InvariantViolation);
    expect(() => assertCanBuy(listing(), now)).not.toThrow();
  });
});

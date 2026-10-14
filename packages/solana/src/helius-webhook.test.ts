import { describe, expect, it } from 'vitest';

import {
  activityId,
  mapHeliusTransaction,
  mapHeliusWebhook,
  type HeliusEnhancedTransaction,
} from './helius-webhook';

// Valid base58 strings (no 0/O/I/l) so they pass the domain pubkey check.
const MINT = 'So11111111111111111111111111111111111111112';
const OWNER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
const BUYER = '3xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFi1';
const COLLECTION = 'Co11ecT1111111111111111111111111111111111111';
const SIGNATURE = '5'.repeat(88);

function tx(overrides: Partial<HeliusEnhancedTransaction> = {}): HeliusEnhancedTransaction {
  return {
    signature: SIGNATURE,
    slot: 100,
    timestamp: 1_700_000_000,
    type: 'NFT_SALE',
    ...overrides,
  };
}

describe('activityId', () => {
  it('is deterministic from signature + mint + type (replay-stable)', () => {
    const a = activityId(SIGNATURE, MINT, 'SALE');
    const b = activityId(SIGNATURE, MINT, 'SALE');
    expect(a).toBe(b);
    expect(a).toBe(`${SIGNATURE}:${MINT}:SALE`);
  });

  it('differs across event types for the same signature', () => {
    expect(activityId(SIGNATURE, MINT, 'SALE')).not.toBe(activityId(SIGNATURE, MINT, 'TRANSFER'));
  });
});

describe('mapHeliusTransaction', () => {
  it('maps an NFT_SALE event with price and parties', () => {
    const activities = mapHeliusTransaction(
      tx({ events: { nft: { mint: MINT, seller: OWNER, buyer: BUYER, amount: '1500000000' } } }),
    );
    expect(activities).toHaveLength(1);
    const a = activities[0]!;
    expect(a.type).toBe('SALE');
    expect(a.asset).toBe(MINT);
    expect(a.from).toBe(OWNER);
    expect(a.to).toBe(BUYER);
    expect(a.price).toBe(1_500_000_000n); // 1.5 SOL > 2^31 — bigint must survive
    expect(a.slot).toBe(100n);
    expect(a.blockTime.getTime()).toBe(1_700_000_000_000);
    expect(a.txSignature).toBe(SIGNATURE);
  });

  it('maps an NFT_MINT to the fee payer as recipient', () => {
    const activities = mapHeliusTransaction(
      tx({ type: 'NFT_MINT', feePayer: BUYER, events: { nft: { mint: MINT } } }),
    );
    expect(activities).toHaveLength(1);
    expect(activities[0]!.type).toBe('MINT');
    expect(activities[0]!.to).toBe(BUYER);
    expect(activities[0]!.from).toBeNull();
    expect(activities[0]!.price).toBeNull();
  });

  it('resolves the collection via the injected resolver', () => {
    const activities = mapHeliusTransaction(
      tx({ events: { nft: { mint: MINT, seller: OWNER, buyer: BUYER, amount: '1' } } }),
      { collectionOf: (mint) => (mint === MINT ? COLLECTION : null) },
    );
    expect(activities[0]!.collection).toBe(COLLECTION);
  });

  it('falls back to nativeTransfers for the sale price when nft.amount is absent', () => {
    const activities = mapHeliusTransaction(
      tx({
        events: { nft: { mint: MINT, seller: OWNER, buyer: BUYER } },
        nativeTransfers: [
          { fromUserAccount: BUYER, toUserAccount: OWNER, amount: 2_000_000_000 },
          { fromUserAccount: BUYER, toUserAccount: 'FEE', amount: 5_000 },
        ],
      }),
    );
    expect(activities[0]!.price).toBe(2_000_000_000n);
  });

  it('maps a transfer via tokenTransfers when no nft event is present', () => {
    const activities = mapHeliusTransaction(
      tx({
        type: 'TRANSFER',
        tokenTransfers: [{ mint: MINT, fromUserAccount: OWNER, toUserAccount: BUYER }],
      }),
    );
    expect(activities).toHaveLength(1);
    expect(activities[0]!.type).toBe('TRANSFER');
    expect(activities[0]!.from).toBe(OWNER);
    expect(activities[0]!.to).toBe(BUYER);
  });

  it('returns [] for unknown transaction types (never fabricates history)', () => {
    expect(mapHeliusTransaction(tx({ type: 'UNKNOWN_THING' }))).toEqual([]);
  });

  it('returns [] when the signature is missing or malformed', () => {
    expect(mapHeliusTransaction(tx({ signature: undefined }))).toEqual([]);
    expect(mapHeliusTransaction(tx({ signature: 'too-short' }))).toEqual([]);
  });

  it('returns [] when slot or timestamp are unusable', () => {
    expect(mapHeliusTransaction(tx({ slot: undefined }))).toEqual([]);
    expect(mapHeliusTransaction(tx({ timestamp: undefined }))).toEqual([]);
  });

  it('drops non-pubkey mints rather than inserting junk', () => {
    const activities = mapHeliusTransaction(
      tx({ events: { nft: { mint: 'not-a-key', seller: OWNER, buyer: BUYER, amount: '1' } } }),
    );
    expect(activities).toEqual([]);
  });
});

describe('mapHeliusWebhook', () => {
  it('flattens activities across many transactions in a delivery', () => {
    const payload = [
      tx({ events: { nft: { mint: MINT, seller: OWNER, buyer: BUYER, amount: '1' } } }),
      tx({
        signature: '6'.repeat(88),
        type: 'NFT_MINT',
        feePayer: BUYER,
        events: { nft: { mint: MINT } },
      }),
    ];
    const activities = mapHeliusWebhook(payload);
    expect(activities.map((a) => a.type)).toEqual(['SALE', 'MINT']);
  });

  it('is empty-safe on an empty delivery', () => {
    expect(mapHeliusWebhook([])).toEqual([]);
  });
});

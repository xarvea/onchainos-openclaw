import { describe, expect, it } from 'vitest';

import { computeFeeSplit } from './fees';
import { assertPaymentSplit } from './invariants';
import { asLamports, lamportsFromSol, SOL_DECIMALS, LAMPORTS_PER_SOL } from './primitives';

describe('computeFeeSplit', () => {
  it('splits a clean price exactly (I5 sum == price)', () => {
    const price = lamportsFromSol(1); // 1 SOL
    const split = computeFeeSplit(price, { platformBps: 200, royaltyBps: 500 }); // 2% + 5%
    expect(split.platformFee).toBe(lamportsFromSol(0.02));
    expect(split.creatorRoyalty).toBe(lamportsFromSol(0.05));
    expect(split.sellerProceeds).toBe(lamportsFromSol(0.93));
    expect(split.platformFee + split.creatorRoyalty + split.sellerProceeds).toBe(price);
  });

  it('always sums to price even with non-divisible amounts (remainder → seller)', () => {
    // 1 lamport price, 2.5% platform (100 bps = 1%), 1 bps royalty → floors to 0/0.
    const price = asLamports(101n);
    const split = computeFeeSplit(price, { platformBps: 250, royaltyBps: 100 });
    // platform = floor(101*250/10000)=2 ; royalty = floor(101*100/10000)=1 ; seller=98
    expect(split.platformFee).toBe(2n);
    expect(split.creatorRoyalty).toBe(1n);
    expect(split.sellerProceeds).toBe(98n);
    expect(split.platformFee + split.creatorRoyalty + split.sellerProceeds).toBe(101n);
    // And the split passes the domain invariant.
    expect(() =>
      assertPaymentSplit(price, split.platformFee, split.creatorRoyalty, split.sellerProceeds),
    ).not.toThrow();
  });

  it('property: for many prices/bps, the parts always sum to the price', () => {
    const prices = [1n, 7n, 999n, 1_000_000n, 1_234_567_890n, LAMPORTS_PER_SOL];
    const combos = [
      { platformBps: 0, royaltyBps: 0 },
      { platformBps: 250, royaltyBps: 0 },
      { platformBps: 0, royaltyBps: 500 },
      { platformBps: 200, royaltyBps: 500 },
      { platformBps: 3000, royaltyBps: 7000 }, // 100% to fees (seller gets 0)
    ];
    for (const p of prices) {
      for (const c of combos) {
        const split = computeFeeSplit(asLamports(p), c);
        expect(split.platformFee + split.creatorRoyalty + split.sellerProceeds).toBe(p);
        expect(split.sellerProceeds).toBeGreaterThanOrEqual(0n);
      }
    }
  });

  it('handles 100% platform fee (seller gets nothing)', () => {
    const price = asLamports(1000n);
    const split = computeFeeSplit(price, { platformBps: 10_000, royaltyBps: 0 });
    expect(split.platformFee).toBe(1000n);
    expect(split.creatorRoyalty).toBe(0n);
    expect(split.sellerProceeds).toBe(0n);
  });

  it('rejects out-of-range basis points', () => {
    const price = asLamports(1000n);
    expect(() => computeFeeSplit(price, { platformBps: -1, royaltyBps: 0 })).toThrow(/out of range/);
    expect(() => computeFeeSplit(price, { platformBps: 0, royaltyBps: 10_001 })).toThrow(/out of range/);
    expect(() => computeFeeSplit(price, { platformBps: 1.5, royaltyBps: 0 })).toThrow(/out of range/);
  });

  it('rejects when fees exceed the price (sum > 10000 bps)', () => {
    expect(() => computeFeeSplit(asLamports(1000n), { platformBps: 6000, royaltyBps: 5000 })).toThrow(
      /must be <= 10000/,
    );
  });

  it('rejects a negative price', () => {
    expect(() => computeFeeSplit(asLamports(-1n), { platformBps: 0, royaltyBps: 0 })).toThrow();
  });

  it('SOL_DECIMALS sanity', () => {
    expect(SOL_DECIMALS).toBe(9);
  });
});

import { describe, expect, it } from 'vitest';

import {
  assertValidItems,
  buildMintGuards,
  computeConfigLineSettings,
} from './launch';

describe('computeConfigLineSettings', () => {
  it('uses an empty prefix and the longest name/uri lengths', () => {
    const s = computeConfigLineSettings([
      { name: 'MICOW #1', uri: 'https://arweave.net/abc1.json' },
      { name: 'MICOW #22', uri: 'https://arweave.net/abc22.json' },
    ]);
    expect(s.prefixName).toBe('');
    expect(s.nameLength).toBe('MICOW #22'.length);
    expect(s.prefixUri).toBe('');
    expect(s.uriLength).toBe('https://arweave.net/abc22.json'.length);
    expect(s.isSequential).toBe(false);
  });

  it('takes the longest value across all items (not just the first)', () => {
    const s = computeConfigLineSettings([
      { name: 'X1', uri: 'https://x/1.json' },
      { name: 'X9999', uri: 'https://x/1.json' },
    ]);
    expect(s.nameLength).toBe('X9999'.length);
  });

  it('throws on an empty item list', () => {
    expect(() => computeConfigLineSettings([])).toThrow(/at least one item/);
  });

  it('a single item yields its full name/uri length', () => {
    const s = computeConfigLineSettings([{ name: 'Solo', uri: 'https://x/y.json' }]);
    expect(s.nameLength).toBe('Solo'.length);
    expect(s.uriLength).toBe('https://x/y.json'.length);
  });
});

describe('buildMintGuards', () => {
  it('omits solPayment when the price is zero (free mint)', () => {
    const g = buildMintGuards({ priceLamports: 0n, destination: '', mintLimitPerWallet: 0 });
    expect(g.solPayment).toBeUndefined();
    expect(g.mintLimit).toBeUndefined();
  });

  it('includes solPayment when the price is positive', () => {
    const g = buildMintGuards({
      priceLamports: 10_000_000n,
      destination: 'So11111111111111111111111111111111111111112',
      mintLimitPerWallet: 0,
    });
    expect(g.solPayment).toEqual({
      lamports: 10_000_000n,
      destination: 'So11111111111111111111111111111111111111112',
    });
  });

  it('includes mintLimit when a per-wallet limit is set', () => {
    const g = buildMintGuards({ priceLamports: 0n, destination: '', mintLimitPerWallet: 3 });
    expect(g.mintLimit).toEqual({ id: 1, limit: 3 });
  });

  it('rejects a positive price with no destination (money must go somewhere)', () => {
    expect(() =>
      buildMintGuards({ priceLamports: 1n, destination: '', mintLimitPerWallet: 0 }),
    ).toThrow(/destination is required/);
  });
});

describe('assertValidItems', () => {
  it('throws when there are no items', () => {
    expect(() => assertValidItems([])).toThrow(/no items/);
  });

  it('throws on an empty name', () => {
    expect(() => assertValidItems([{ name: '  ', uri: 'https://x/1.json' }])).toThrow(
      /empty name/,
    );
  });

  it('throws on a non-http uri', () => {
    expect(() => assertValidItems([{ name: 'A', uri: 'ipfs://cid' }])).toThrow(/http\(s\)/);
  });

  it('accepts valid items', () => {
    expect(() =>
      assertValidItems([{ name: 'A', uri: 'https://x/1.json' }]),
    ).not.toThrow();
  });
});

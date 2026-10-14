import { asPublicKey, lamportsFromSol, type Listing } from '@micow/domain';
import { describe, expect, it } from 'vitest';

import { buyListing, cancelListing, createListing, type ListingDeps } from './create-listing';
import type { ListingGateway, ListingRepository } from './ports';

const ASSET = asPublicKey('So11111111111111111111111111111111111111112');
const SELLER = asPublicKey('So11111111111111111111111111111111111111112');
const BUYER = asPublicKey('Co11111111111111111111111111111111111111111');
const DELEGATE = asPublicKey('CM1111111111111111111111111111111111111111');

/** In-memory ListingRepository (mirrors the database package, kept local so the
 * application package has no infra dependency in tests). */
function repo(): ListingRepository & { rows: Map<string, Listing> } {
  const rows = new Map<string, Listing>();
  const r: ListingRepository & { rows: Map<string, Listing> } = {
    rows,
    async findActiveByAsset(asset) {
      return [...rows.values()].find((l) => l.asset === asset && l.status === 'ACTIVE') ?? null;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async listActiveBySeller(seller) {
      return [...rows.values()].filter((l) => l.seller === seller && l.status === 'ACTIVE');
    },
    async listActive() {
      return [...rows.values()].filter((l) => l.status === 'ACTIVE');
    },
    async create(l) {
      rows.set(l.id, l);
    },
    async updateStatus(id, status) {
      const e = rows.get(id);
      if (e) rows.set(id, { ...e, status });
    },
  };
  return r;
}

function gateway(): ListingGateway & { calls: string[] } {
  const calls: string[] = [];
  const g: ListingGateway & { calls: string[] } = {
    calls,
    async buildCreateListingTx() {
      calls.push('create');
      return { serializedTx: 'tx-create' };
    },
    async buildCancelListingTx() {
      calls.push('cancel');
      return { serializedTx: 'tx-cancel' };
    },
    async buildBuyTx() {
      calls.push('buy');
      return { serializedTx: 'tx-buy' };
    },
  };
  return g;
}

type TestDeps = ListingDeps & {
  listings: ListingRepository & { rows: Map<string, Listing> };
  gateway: ListingGateway & { calls: string[] };
};

function deps(over: Partial<ListingDeps> = {}): TestDeps {
  const listings = repo();
  const gw = gateway();
  return {
    listings,
    gateway: gw,
    platformBps: 200,
    now: () => new Date('2026-06-01T00:00:00Z'),
    newId: () => 'l1',
    ...over,
  } as TestDeps;
}

describe('createListing', () => {
  it('creates an ACTIVE listing with the deterministic split and returns an unsigned tx', async () => {
    const d = deps();
    const { listing, serializedTx } = await createListing(d, {
      asset: ASSET,
      seller: SELLER,
      delegate: DELEGATE,
      priceLamports: lamportsFromSol(1),
      royaltyBps: 500,
    });

    expect(listing.status).toBe('ACTIVE');
    expect(listing.platformFee).toBe(lamportsFromSol(0.02));
    expect(listing.creatorRoyalty).toBe(lamportsFromSol(0.05));
    expect(listing.price - listing.platformFee - listing.creatorRoyalty).toBe(lamportsFromSol(0.93));
    expect(serializedTx).toBe('tx-create');
    expect(d.gateway.calls).toEqual(['create']);
  });

  it('rejects a second ACTIVE listing for the same asset (I1)', async () => {
    const d = deps();
    await createListing(d, { asset: ASSET, seller: SELLER, delegate: DELEGATE, priceLamports: lamportsFromSol(1) });
    await expect(
      createListing(d, { asset: ASSET, seller: SELLER, delegate: DELEGATE, priceLamports: lamportsFromSol(2) }),
    ).rejects.toThrow(/already has an ACTIVE listing/);
  });

  it('rejects a non-positive price', async () => {
    const d = deps();
    await expect(
      createListing(d, { asset: ASSET, seller: SELLER, delegate: DELEGATE, priceLamports: 0n }),
    ).rejects.toThrow(/price must be > 0/);
  });

  it('rejects an expiry in the past', async () => {
    const d = deps();
    await expect(
      createListing(d, {
        asset: ASSET,
        seller: SELLER,
        delegate: DELEGATE,
        priceLamports: lamportsFromSol(1),
        expiresAt: new Date('2020-01-01T00:00:00Z'),
      }),
    ).rejects.toThrow(/must be in the future/);
  });
});

describe('cancelListing', () => {
  async function withActive() {
    const d = deps();
    await createListing(d, { asset: ASSET, seller: SELLER, delegate: DELEGATE, priceLamports: lamportsFromSol(1) });
    return d;
  }

  it('cancels an ACTIVE listing for the seller', async () => {
    const d = await withActive();
    const { listing, serializedTx } = await cancelListing(d, { listingId: 'l1', caller: SELLER, delegate: DELEGATE });
    expect(listing.status).toBe('CANCELLED');
    expect(serializedTx).toBe('tx-cancel');
    expect(d.gateway.calls).toEqual(['create', 'cancel']);
  });

  it('rejects cancel by a non-seller (I4)', async () => {
    const d = await withActive();
    await expect(cancelListing(d, { listingId: 'l1', caller: BUYER, delegate: DELEGATE })).rejects.toThrow(
      /Only seller/,
    );
  });

  it('rejects cancel of a missing listing', async () => {
    const d = deps();
    await expect(cancelListing(d, { listingId: 'nope', caller: SELLER, delegate: DELEGATE })).rejects.toThrow(
      /not found/,
    );
  });
});

describe('buyListing', () => {
  async function withActive(over: Partial<Parameters<typeof createListing>[1]> = {}) {
    const d = deps();
    await createListing(d, {
      asset: ASSET,
      seller: SELLER,
      delegate: DELEGATE,
      priceLamports: lamportsFromSol(1),
      royaltyBps: 500,
      ...over,
    });
    return d;
  }

  it('fills an ACTIVE listing and returns the split + unsigned tx', async () => {
    const d = await withActive();
    const res = await buyListing(d, { listingId: 'l1', buyer: BUYER, delegate: DELEGATE });
    expect(res.listing.status).toBe('FILLED');
    expect(res.split.platformFee).toBe(lamportsFromSol(0.02));
    expect(res.split.creatorRoyalty).toBe(lamportsFromSol(0.05));
    expect(res.split.sellerProceeds).toBe(lamportsFromSol(0.93));
    expect(res.split.platformFee + res.split.creatorRoyalty + res.split.sellerProceeds).toBe(lamportsFromSol(1));
    expect(res.serializedTx).toBe('tx-buy');
  });

  it('rejects buying an expired listing (I6)', async () => {
    // Create with a future expiry, then advance the clock past it.
    const d = deps();
    await createListing(d, {
      asset: ASSET,
      seller: SELLER,
      delegate: DELEGATE,
      priceLamports: lamportsFromSol(1),
      expiresAt: new Date('2026-06-02T00:00:00Z'),
    });
    d.now = () => new Date('2026-06-03T00:00:00Z');
    await expect(buyListing(d, { listingId: 'l1', buyer: BUYER, delegate: DELEGATE })).rejects.toThrow(/expired/);
  });

  it('rejects the seller buying their own listing', async () => {
    const d = await withActive();
    await expect(buyListing(d, { listingId: 'l1', buyer: SELLER, delegate: DELEGATE })).rejects.toThrow(
      /cannot buy their own/,
    );
  });

  it('rejects buying an already-filled listing (I6 — not ACTIVE)', async () => {
    const d = await withActive();
    await buyListing(d, { listingId: 'l1', buyer: BUYER, delegate: DELEGATE });
    await expect(buyListing(d, { listingId: 'l1', buyer: BUYER, delegate: DELEGATE })).rejects.toThrow(
      /not ACTIVE/,
    );
  });
});

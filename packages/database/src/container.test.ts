import { createListing } from '@micow/application';
import { asLamports, asPublicKey, ListingStatus, type Listing } from '@micow/domain';
import { describe, expect, it } from 'vitest';

import { createInMemoryContainer, InMemoryAssetRepository } from './container';

const ASSET = asPublicKey('So11111111111111111111111111111111111111112');
const SELLER = asPublicKey('So11111111111111111111111111111111111111112');

function asset(overrides = {}) {
  return {
    mint: ASSET,
    name: 'Test #1',
    uri: 'https://example.com/1.json',
    image: 'https://example.com/1.png',
    standard: 'core' as const,
    collection: null,
    owner: SELLER,
    creator: SELLER,
    attributes: [],
    compressed: false,
    frozen: false,
    ...overrides,
  };
}

describe('InMemoryAssetRepository', () => {
  it('upserts and retrieves by mint (idempotent)', async () => {
    const repo = new InMemoryAssetRepository();
    await repo.upsert(asset());
    await repo.upsert(asset({ name: 'Updated' }));
    expect(repo.size).toBe(1);
    const found = await repo.findByMint(ASSET);
    expect(found?.name).toBe('Updated');
  });

  it('filters by owner and by collection', async () => {
    const repo = new InMemoryAssetRepository();
    const col = asPublicKey('So11111111111111111111111111111111111111113');
    await repo.upsert(asset());
    await repo.upsert(
      asset({ mint: asPublicKey('So11111111111111111111111111111111111111114'), collection: col }),
    );
    expect(await repo.findByOwner(SELLER)).toHaveLength(2);
    expect(await repo.findByCollection(col)).toHaveLength(1);
  });
});

describe('createListing use case with in-memory container', () => {
  it('rejects a second active listing for the same asset (invariant I1)', async () => {
    const c = createInMemoryContainer();
    const listing: Listing = {
      id: 'l1',
      asset: ASSET,
      seller: SELLER,
      price: asLamports(1_000_000_000n),
      platformFee: asLamports(20_000_000n),
      creatorRoyalty: asLamports(50_000_000n),
      status: ListingStatus.ACTIVE,
      createdAt: new Date(),
      expiresAt: null,
      txSignature: null,
    };
    await c.listings.create(listing);

    const gateway = {
      buildCreateListingTx: async () => ({ serializedTx: 'x' }),
      buildCancelListingTx: async () => ({ serializedTx: 'x' }),
      buildBuyTx: async () => ({ serializedTx: 'x' }),
    };

    await expect(
      createListing({ listings: c.listings, gateway }, { asset: ASSET, seller: SELLER, priceLamports: 1n }),
    ).rejects.toThrow();
  });
});

import { createInMemoryContainer } from '@micow/database';
import { asPublicKey, type Asset } from '@micow/domain';
import { describe, expect, it } from 'vitest';

import type { AssetIndexer } from './indexer-port';

/**
 * A fake indexer standing in for Helius DAS in tests. Verifies the sync
 * use-case stores what the indexer returns (integration contract).
 */
class FakeIndexer implements AssetIndexer {
  constructor(private readonly byMint: Record<string, Asset>) {}
  async getAsset(mint: string): Promise<Asset | null> {
    return this.byMint[mint] ?? null;
  }
  async getAssetsByOwner(): Promise<Asset[]> {
    return [];
  }
  async getAssetsByCollection(): Promise<Asset[]> {
    return [];
  }
}

const MINT = asPublicKey('So11111111111111111111111111111111111111112');

function makeAsset(): Asset {
  return {
    mint: MINT,
    name: 'Fake #1',
    uri: 'https://x/1.json',
    image: 'https://x/1.png',
    standard: 'core',
    collection: null,
    owner: MINT,
    creator: MINT,
    attributes: [],
    compressed: false,
    frozen: false,
  };
}

describe('sync-asset contract', () => {
  it('stores the asset returned by the indexer', async () => {
    const container = createInMemoryContainer();
    const indexer = new FakeIndexer({ [MINT]: makeAsset() });

    const asset = await indexer.getAsset(MINT);
    expect(asset).not.toBeNull();
    if (asset) await container.assets.upsert(asset);

    const stored = await container.assets.findByMint(MINT);
    expect(stored?.name).toBe('Fake #1');
  });

  it('no-ops when the indexer has no such asset', async () => {
    const container = createInMemoryContainer();
    const indexer = new FakeIndexer({});
    const asset = await indexer.getAsset(MINT);
    expect(asset).toBeNull();
    expect(await container.assets.findByMint(MINT)).toBeNull();
  });
});

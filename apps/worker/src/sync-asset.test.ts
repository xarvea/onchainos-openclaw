import { createInMemoryContainer } from '@micow/database';
import { asPublicKey, type Asset } from '@micow/domain';
import { describe, expect, it, vi } from 'vitest';

import { syncAsset } from './functions/sync-asset';
import type { AssetIndexer } from './indexer-port';

/**
 * A fake indexer standing in for Helius DAS in tests.
 */
class FakeIndexer implements AssetIndexer {
  readonly getAsset = vi.fn(async (mint: string): Promise<Asset | null> => this.byMint[mint] ?? null);
  constructor(private readonly byMint: Record<string, Asset>) {}
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

describe('syncAsset (real logic under test)', () => {
  it('fetches from the indexer and upserts into the read model', async () => {
    const container = createInMemoryContainer();
    const indexer = new FakeIndexer({ [MINT]: makeAsset() });

    const result = await syncAsset({ indexer, assets: container.assets }, MINT);

    expect(result).toEqual({ mint: MINT, stored: true });
    expect(indexer.getAsset).toHaveBeenCalledWith(MINT);
    const stored = await container.assets.findByMint(MINT);
    expect(stored?.name).toBe('Fake #1');
    expect(stored?.uri).toBe('https://x/1.json');
  });

  it('no-ops (stored:false) when the indexer has no such asset', async () => {
    const container = createInMemoryContainer();
    const indexer = new FakeIndexer({});

    const result = await syncAsset({ indexer, assets: container.assets }, MINT);

    expect(result).toEqual({ mint: MINT, stored: false });
    expect(await container.assets.findByMint(MINT)).toBeNull();
  });
});

import { createInMemoryContainer } from '@micow/database';
import { HeliusDasIndexer } from '@micow/solana';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AssetIndexer } from './indexer-port';
import { syncCollection, syncOwner } from './functions/sync-asset';

/**
 * Integration test for the REAL DAS → domain → repository pipeline.
 *
 * Unlike the unit test (which injects a fake indexer), here we instantiate the
 * real `HeliusDasIndexer` and mock only the network boundary (`global.fetch`).
 * This catches mapping/pagination bugs that a fake indexer would hide.
 */

type JsonRpcReq = { method: string; params: Record<string, unknown> };

// Valid base58 alphabet (no 0/O/I/l) so ids pass the domain's pubkey check.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
/** Deterministic, valid-looking 44-char base58 id from a seed. */
function id(seed: number): string {
  let s = '';
  let n = seed + 1;
  for (let i = 0; i < 44; i++) {
    s += B58[n % B58.length];
    n = (n * 31 + 7) % 1_000_003;
  }
  return s;
}

/** Build a DAS asset payload in the exact shape Helius returns. */
function dasItem(mint: string, name: string, owner: string, collection?: string) {
  return {
    id: mint,
    interface: 'MplCoreAsset',
    content: {
      json_uri: `https://arweave.net/${mint}.json`,
      metadata: { name },
      links: { image: `https://thumb/${mint}.png` },
      files: [{ uri: `https://cdn/${mint}.png`, mime: 'image/png' }],
    },
    ownership: { owner, frozen: false },
    grouping: collection ? [{ group_key: 'collection', group_value: collection }] : [],
    creators: [{ address: owner, verified: true }],
    compression: { compressed: false },
  };
}

/** Mock fetch that answers DAS JSON-RPC calls and honours page/limit. */
function mockDasFetch(pages: Record<number, unknown[]>, mints: Record<string, unknown> = {}) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as JsonRpcReq;
    const respond = (result: unknown) =>
      ({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 'micow', result }) }) as Response;

    if (body.method === 'getAsset') {
      const reqId = String(body.params.id);
      return respond(mints[reqId] ?? { id: reqId, interface: 'MplCoreAsset', content: { metadata: {} } });
    }
    // getAssetsByOwner / getAssetsByGroup / getAssetsByCreator → paginated items
    const page = Number(body.params.page ?? 1);
    return respond({ items: pages[page] ?? [] });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const OWNER = 'So11111111111111111111111111111111111111112';
const COLLECTION = 'Co11111111111111111111111111111111111111111';

describe('HeliusDasIndexer satisfies the worker AssetIndexer port', () => {
  it('is structurally assignable (compile-time + runtime smoke)', () => {
    vi.stubGlobal('fetch', mockDasFetch({}));
    const indexer: AssetIndexer = new HeliusDasIndexer('test-key', 'https://rpc.test');
    expect(typeof indexer.getAsset).toBe('function');
    expect(typeof indexer.getAssetsByCollection).toBe('function');
    expect(typeof indexer.getAssetsByOwner).toBe('function');
  });
});

describe('syncCollection over the real indexer', () => {
  it('maps DAS JSON, paginates, and upserts every asset into the repo', async () => {
    const p1 = Array.from({ length: 1000 }, (_, i) => dasItem(id(i), `P1 #${i}`, OWNER, COLLECTION));
    const lastMint = id(999999);
    const p2 = [dasItem(lastMint, 'P2 #0', OWNER, COLLECTION)];

    vi.stubGlobal('fetch', mockDasFetch({ 1: p1, 2: p2 }));

    const indexer = new HeliusDasIndexer('test-key', 'https://rpc.test');
    const container = createInMemoryContainer();

    const result = await syncCollection({ indexer, assets: container.assets }, COLLECTION);

    // 1000 (page 1) + 1 (page 2) fetched and stored → pagination worked.
    expect(result).toEqual({ fetched: 1001, stored: 1001 });

    // Verify a stored asset carries the DAS-derived fields (uri, image, collection).
    const one = await container.assets.findByMint(lastMint);
    expect(one?.name).toBe('P2 #0');
    expect(one?.uri).toBe(`https://arweave.net/${lastMint}.json`);
    expect(one?.image).toBe(`https://cdn/${lastMint}.png`);
    expect(one?.standard).toBe('core');
    expect(one?.collection).toBe(COLLECTION);
  });

  it('handles an empty collection without error', async () => {
    vi.stubGlobal('fetch', mockDasFetch({ 1: [] }));
    const indexer = new HeliusDasIndexer('test-key', 'https://rpc.test');
    const container = createInMemoryContainer();

    const result = await syncCollection({ indexer, assets: container.assets }, COLLECTION);

    expect(result).toEqual({ fetched: 0, stored: 0 });
  });
});

describe('syncOwner over the real indexer', () => {
  it('upserts the owner portfolio into the read model', async () => {
    const items = [dasItem(id(7), 'Owned #1', OWNER)];
    vi.stubGlobal('fetch', mockDasFetch({ 1: items }));

    const indexer = new HeliusDasIndexer('test-key', 'https://rpc.test');
    const container = createInMemoryContainer();

    const result = await syncOwner({ indexer, assets: container.assets }, OWNER);

    expect(result).toEqual({ fetched: 1, stored: 1 });
    const stored = await container.assets.findByOwner(OWNER);
    expect(stored.map((a) => a.name)).toEqual(['Owned #1']);
  });
});

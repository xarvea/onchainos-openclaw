import { asPublicKey, type Collection } from '@micow/domain';
import { describe, expect, it } from 'vitest';

import { buildCollectionMetadataJson, buildItemMetadataJson, launchCollection } from './launch-collection';
import type { CollectionMinter, CollectionRepository, MetadataStorage } from './ports';

/**
 * Unit tests for the launch orchestration. Everything is faked through ports, so
 * this runs with no network/chain and pins the ordering + read-model contract.
 */

/** In-memory MetadataStorage that returns deterministic pseudo-URIs. */
function fakeStorage(): MetadataStorage & { json: Record<string, unknown>[] } {
  const json: Record<string, unknown>[] = [];
  let n = 0;
  return {
    json,
    async putJson(obj) {
      json.push(obj);
      return { uri: `ar://meta-${n++}` };
    },
    async putBytes(_data, opts) {
      return { uri: `ar://blob-${opts.fileName ?? n++}` };
    },
  };
}

/** Minter that records its input and returns fixed addresses. */
function fakeMinter(): CollectionMinter & { lastInput?: unknown } {
  const self = {
    lastInput: undefined as unknown,
    async launchCollection(input: unknown) {
      self.lastInput = input;
      return {
        collection: 'Co11111111111111111111111111111111111111111',
        candyMachine: 'CM1111111111111111111111111111111111111111',
        signatures: ['sig1', 'sig2', 'sig3'],
      };
    },
  };
  return self as unknown as CollectionMinter & { lastInput?: unknown };
}

/** CollectionRepository capturing upserts. */
function fakeCollections(): CollectionRepository & { rows: Collection[] } {
  const rows: Collection[] = [];
  return {
    rows,
    async findByAddress() {
      return null;
    },
    async list() {
      return rows;
    },
    async upsert(c) {
      rows.push(c);
    },
  };
}

const IMG = new Uint8Array([1, 2, 3]);

describe('buildItemMetadataJson / buildCollectionMetadataJson', () => {
  it('maps domain attributes to Metaplex trait_type/value shape', () => {
    const meta = buildItemMetadataJson({
      name: 'Cebong #1',
      imageUri: 'ar://img',
      description: 'hi',
      attributes: [{ traitType: 'Background', value: 'Blue' }],
    });
    expect(meta).toEqual({
      name: 'Cebong #1',
      image: 'ar://img',
      description: 'hi',
      attributes: [{ trait_type: 'Background', value: 'Blue' }],
    });
  });

  it('defaults description to empty string and attributes to []', () => {
    const meta = buildCollectionMetadataJson({ name: 'C', imageUri: 'ar://c' });
    expect(meta).toEqual({ name: 'C', image: 'ar://c', description: '' });
  });
});

describe('launchCollection', () => {
  const baseInput = {
    name: 'Cebong Genesis',
    description: 'first drop',
    image: IMG,
    imageContentType: 'image/png',
    items: [
      { name: 'Cebong #1', image: IMG, imageContentType: 'image/png' },
      { name: 'Cebong #2', image: IMG, imageContentType: 'image/png' },
    ],
    priceLamports: 10_000_000n,
    treasury: asPublicKey('Tr11111111111111111111111111111111111111111'),
    mintLimitPerWallet: 2,
    royaltyBps: 500,
  };

  it('uploads metadata, calls the minter, and seeds only the collection row', async () => {
    const storage = fakeStorage();
    const minter = fakeMinter();
    const collections = fakeCollections();

    const result = await launchCollection({ storage, minter, collections }, baseInput);

    // 3 metadata JSONs uploaded: cover + 2 items.
    expect(storage.json).toHaveLength(3);
    expect(storage.json[0]).toMatchObject({ name: 'Cebong Genesis', description: 'first drop' });
    expect(storage.json[1]).toMatchObject({ name: 'Cebong #1' });

    // Minter received the config lines (name + uri), in order.
    const input = minter.lastInput as { items: { name: string; uri: string }[] };
    expect(input.items.map((i) => i.name)).toEqual(['Cebong #1', 'Cebong #2']);
    expect(input.items[0]?.uri).toMatch(/^ar:\/\/meta-/);

    // Read model: exactly one collection row, no phantom assets.
    expect(collections.rows).toHaveLength(1);
    expect(collections.rows[0]).toMatchObject({
      name: 'Cebong Genesis',
      verified: false,
      size: 2,
      standard: 'core',
    });

    expect(result).toEqual({
      collection: 'Co11111111111111111111111111111111111111111',
      candyMachine: 'CM1111111111111111111111111111111111111111',
      signatures: ['sig1', 'sig2', 'sig3'],
      seeded: { collection: true },
    });
  });

  it('never fabricates verified=true (chain is source of truth)', async () => {
    const collections = fakeCollections();
    await launchCollection(
      { storage: fakeStorage(), minter: fakeMinter(), collections },
      baseInput,
    );
    expect(collections.rows[0]?.verified).toBe(false);
  });

  it('rejects an empty item list before any I/O', async () => {
    const storage = fakeStorage();
    await expect(
      launchCollection(
        { storage, minter: fakeMinter(), collections: fakeCollections() },
        { ...baseInput, items: [] },
      ),
    ).rejects.toThrow(/at least one item/);
    // Aborted before uploading anything.
    expect(storage.json).toHaveLength(0);
  });

  it('aborts before chain if storage fails (no SOL spent)', async () => {
    const minter = fakeMinter();
    const failing: MetadataStorage = {
      async putJson() {
        throw new Error('arweave down');
      },
      async putBytes() {
        throw new Error('arweave down');
      },
    };
    await expect(
      launchCollection({ storage: failing, minter, collections: fakeCollections() }, baseInput),
    ).rejects.toThrow('arweave down');
    expect(minter.lastInput).toBeUndefined();
  });
});

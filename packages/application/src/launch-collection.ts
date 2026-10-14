import {
  asPublicKey,
  type AssetStandard,
  type Collection,
  type PublicKeyString,
} from '@micow/domain';

import type { CollectionMinter, CollectionRepository, MetadataStorage } from './ports';

/**
 * Launch a collection end-to-end: build + upload off-chain metadata, create the
 * Core collection + Candy Machine on-chain, then seed the read model with the
 * collection row and its (soon-to-be-minted) asset rows.
 *
 * Why this lives in the application layer: it is the single place that knows the
 * *order* of the steps (metadata before chain; chain before read model) and the
 * failure semantics (a half-launch must not leave a phantom collection in the
 * read model). It depends only on ports, so it is fully unit-testable with fakes.
 */

export interface LaunchItemInput {
  name: string;
  /** Item image bytes. Required (a marketplace asset without art is a bug). */
  image: Uint8Array;
  imageContentType: string;
  description?: string;
  attributes?: { traitType: string; value: string }[];
}

export interface LaunchCollectionInput {
  name: string;
  /** Collection-level description, uploaded as the collection metadata JSON. */
  description?: string;
  /** Collection cover image bytes. */
  image: Uint8Array;
  imageContentType: string;
  standard?: AssetStandard;
  items: LaunchItemInput[];
  /** Mint economics, passed straight through to the minter. */
  priceLamports: bigint;
  treasury: PublicKeyString;
  mintLimitPerWallet: number;
  royaltyBps: number;
}

export interface LaunchCollectionDeps {
  storage: MetadataStorage;
  minter: CollectionMinter;
  collections: CollectionRepository;
  /** Injected so the use case stays deterministic in tests. */
  now?: () => Date;
}

export interface LaunchCollectionResult {
  collection: PublicKeyString;
  candyMachine: PublicKeyString;
  signatures: string[];
  /** Read-model rows written (collection only; assets arrive via the indexer). */
  seeded: { collection: boolean };
}

/**
 * Build the Metaplex-style metadata JSON for an item. Pure — no I/O — so the
 * shape is unit-tested independently of storage/minter.
 */
export function buildItemMetadataJson(input: {
  name: string;
  imageUri: string;
  description?: string;
  attributes?: { traitType: string; value: string }[];
}): Record<string, unknown> {
  return {
    name: input.name,
    image: input.imageUri,
    description: input.description ?? '',
    attributes: (input.attributes ?? []).map((a) => ({
      trait_type: a.traitType,
      value: a.value,
    })),
  };
}

/** Collection-level metadata JSON (Core expects at least name + image). */
export function buildCollectionMetadataJson(input: {
  name: string;
  imageUri: string;
  description?: string;
}): Record<string, unknown> {
  return {
    name: input.name,
    image: input.imageUri,
    description: input.description ?? '',
  };
}

/**
 * Upload every item's image + metadata (in order) and return the config-line
 * list the minter needs. Sequential on purpose: it keeps the item order
 * deterministic and avoids hammering the storage provider with a fan-out.
 */
async function uploadItems(
  storage: MetadataStorage,
  items: LaunchItemInput[],
): Promise<{ name: string; uri: string }[]> {
  const lines: { name: string; uri: string }[] = [];
  for (const item of items) {
    const image = await storage.putBytes(item.image, {
      contentType: item.imageContentType,
      fileName: item.name,
    });
    const meta = await storage.putJson(
      buildItemMetadataJson({
        name: item.name,
        imageUri: image.uri,
        description: item.description,
        attributes: item.attributes,
      }),
    );
    lines.push({ name: item.name, uri: meta.uri });
  }
  return lines;
}

export async function launchCollection(
  deps: LaunchCollectionDeps,
  input: LaunchCollectionInput,
): Promise<LaunchCollectionResult> {
  if (input.items.length === 0) {
    throw new Error('launchCollection: at least one item is required');
  }

  // 1) Off-chain first: if storage fails we abort before spending SOL.
  const collectionImage = await deps.storage.putBytes(input.image, {
    contentType: input.imageContentType,
    fileName: `${input.name}-cover`,
  });
  const collectionMeta = await deps.storage.putJson(
    buildCollectionMetadataJson({
      name: input.name,
      imageUri: collectionImage.uri,
      description: input.description,
    }),
  );
  const configLines = await uploadItems(deps.storage, input.items);

  // 2) On-chain: create collection + CM + insert config lines.
  const launched = await deps.minter.launchCollection({
    name: input.name,
    uri: collectionMeta.uri,
    items: configLines,
    priceLamports: input.priceLamports,
    treasury: input.treasury,
    mintLimitPerWallet: input.mintLimitPerWallet,
    royaltyBps: input.royaltyBps,
  });

  // 3) Read model: seed the collection row.
  //
  // We deliberately do NOT insert asset rows here. A Candy Machine holds
  // *config lines*, not minted assets — each item only becomes a real asset with
  // its own mint address when a buyer mints it. Fabricating asset rows keyed by
  // the CM address would (a) collide on the `assets.mint` primary key and (b)
  // violate "chain is the source of truth". Assets are populated by the indexer
  // (`syncCollection` → DAS `getAssetsByGroup`) once mints land on-chain.
  const standard = input.standard ?? 'core';
  const collectionRow: Collection = {
    address: asPublicKey(launched.collection),
    name: input.name,
    image: collectionImage.uri,
    description: input.description ?? null,
    // Not verified until DAS reports the collection's authorities; we never
    // fabricate `true`.
    verified: false,
    size: input.items.length,
    standard,
    creator: null,
  };
  await deps.collections.upsert(collectionRow);

  return {
    collection: asPublicKey(launched.collection),
    candyMachine: asPublicKey(launched.candyMachine),
    signatures: launched.signatures,
    seeded: { collection: true },
  };
}

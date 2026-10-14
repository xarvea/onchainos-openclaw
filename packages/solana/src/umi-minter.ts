import type { CollectionMinter } from '@micow/application';
import { createCollection } from '@metaplex-foundation/mpl-core';
import {
  addConfigLines,
  create,
} from '@metaplex-foundation/mpl-core-candy-machine';
import { generateSigner, lamports, publicKey, some, type Umi } from '@metaplex-foundation/umi';

import {
  assertValidItems,
  buildMintGuards,
  computeConfigLineSettings,
  type ConfigLine,
} from './launch';

/**
 * Umi implementation of the CollectionMinter port.
 *
 * Orchestrates: (1) create a Core collection, (2) create a Core Candy Machine v3
 * with guards, (3) insert config lines. All transactions are signed by the Umi
 * identity (the admin keypair); nothing here touches the browser.
 *
 * Verified end-to-end against Solana devnet (see scripts/probe-launch.ts).
 */
export class UmiCollectionMinter implements CollectionMinter {
  constructor(private readonly umi: Umi) {}

  async launchCollection(input: {
    name: string;
    uri: string;
    items: ConfigLine[];
    priceLamports: bigint;
    treasury: string;
    mintLimitPerWallet: number;
    royaltyBps: number;
  }): Promise<{ collection: string; candyMachine: string; signatures: string[] }> {
    const umi = this.umi;

    assertValidItems(input.items);
    if (input.royaltyBps < 0 || input.royaltyBps > 10_000) {
      throw new Error(`royaltyBps out of range (0-10000): ${input.royaltyBps}`);
    }

    const guardConfig = buildMintGuards({
      priceLamports: input.priceLamports,
      destination: input.treasury,
      mintLimitPerWallet: input.mintLimitPerWallet,
    });

    // 1) Core collection.
    const collection = generateSigner(umi);
    const createCollectionSig = await createCollection(umi, {
      collection,
      name: input.name,
      uri: input.uri,
    }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

    // 2) Core Candy Machine v3 with guards.
    const candyMachine = generateSigner(umi);
    const createBuilder = await create(umi, {
      candyMachine,
      collection: collection.publicKey,
      collectionUpdateAuthority: umi.identity,
      itemsAvailable: input.items.length,
      configLineSettings: some(computeConfigLineSettings(input.items)),
      guards: {
        ...(guardConfig.solPayment
          ? {
              solPayment: some({
                lamports: lamports(guardConfig.solPayment.lamports),
                destination: publicKey(guardConfig.solPayment.destination),
              }),
            }
          : {}),
        ...(guardConfig.mintLimit ? { mintLimit: some(guardConfig.mintLimit) } : {}),
      },
    });
    const createCmSig = await createBuilder.sendAndConfirm(umi, {
      confirm: { commitment: 'confirmed' },
    });

    // 3) Insert config lines (chunked to stay within tx size limits).
    const CHUNK = 8;
    const insertSigs: string[] = [];
    for (let i = 0; i < input.items.length; i += CHUNK) {
      const chunk = input.items.slice(i, i + CHUNK);
      const sig = await addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: i,
        configLines: chunk,
      }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
      insertSigs.push(Buffer.from(sig.signature).toString('base64'));
    }

    return {
      collection: collection.publicKey,
      candyMachine: candyMachine.publicKey,
      signatures: [
        Buffer.from(createCollectionSig.signature).toString('base64'),
        Buffer.from(createCmSig.signature).toString('base64'),
        ...insertSigs,
      ],
    };
  }
}

/**
 * Devnet end-to-end probe for the MICOW launch flow (Core Candy Machine v3).
 *
 * Steps:
 *   1. Create a Metaplex Core collection
 *   2. Create a Core Candy Machine v3 (with a solPayment + mintLimit guard)
 *   3. Insert config lines (NFTs)
 *   4. Fetch the CM back to confirm
 *
 * Run (spends devnet SOL, hits the network — manual only, not CI):
 *   SOLANA_KEYPAIR=~/.config/solana/devnet.json \
 *   ../../apps/worker/node_modules/.bin/tsx scripts/probe-launch.ts
 */
import { createCollection } from '@metaplex-foundation/mpl-core';
import {
  addConfigLines,
  create,
  fetchCandyMachine,
} from '@metaplex-foundation/mpl-core-candy-machine';
import { generateSigner, sol, some } from '@metaplex-foundation/umi';

import { createUmiClient } from '../src/umi-client';

const ENDPOINT = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const KEYPAIR = process.env.SOLANA_KEYPAIR ?? `${process.env.HOME}/.config/solana/devnet.json`;

const ITEMS = [
  { name: 'MICOW Probe #1', uri: 'https://example.com/micow/1.json' },
  { name: 'MICOW Probe #2', uri: 'https://example.com/micow/2.json' },
];

async function main() {
  const umi = createUmiClient({ endpoint: ENDPOINT, keypairPath: KEYPAIR });
  console.log('endpoint :', umi.rpc.getEndpoint());
  console.log('identity :', umi.identity.publicKey);

  // 1) Core collection.
  const collection = generateSigner(umi);
  await createCollection(umi, {
    collection,
    name: 'MICOW Probe',
    uri: 'https://example.com/micow-probe.json',
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
  console.log('collection:', collection.publicKey);

  // 2) Core Candy Machine v3 with guards.
  const candyMachine = generateSigner(umi);
  const createBuilder = await create(umi, {
    candyMachine,
    collection: collection.publicKey,
    collectionUpdateAuthority: umi.identity,
    itemsAvailable: ITEMS.length,
    configLineSettings: some({
      prefixName: 'MICOW Probe #',
      nameLength: 4,
      prefixUri: 'https://example.com/micow/',
      uriLength: 10,
      isSequential: false,
    }),
    guards: {
      solPayment: some({ lamports: sol(0.01), destination: umi.identity.publicKey }),
      mintLimit: some({ id: 1, limit: 2 }),
    },
  });
  const createSig = await createBuilder.sendAndConfirm(umi, {
    confirm: { commitment: 'confirmed' },
  });
  console.log('candyMachine:', candyMachine.publicKey);
  console.log('create sig   :', Buffer.from(createSig.signature).toString('base64'));

  // 3) Insert items.
  await addConfigLines(umi, {
    candyMachine: candyMachine.publicKey,
    index: 0,
    configLines: ITEMS,
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  // 4) Verify.
  const account = await fetchCandyMachine(umi, candyMachine.publicKey);
  console.log('itemsAvailable:', account.data.itemsAvailable, 'itemsRedeemed:', account.itemsRedeemed);
  console.log('OK');
}

main().catch((e) => {
  console.error('FAILED:', e?.stack ?? e?.message ?? e);
  process.exit(1);
});

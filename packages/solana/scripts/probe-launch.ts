/**
 * Devnet end-to-end probe for the MICOW launch flow, exercising the REAL
 * `UmiCollectionMinter` (not inline logic) so the refactor is proven on-chain.
 *
 * Run (spends devnet SOL, hits the network — manual only, not CI):
 *   SOLANA_KEYPAIR=~/.config/solana/devnet.json \
 *   ../../apps/worker/node_modules/.bin/tsx scripts/probe-launch.ts
 */
import { fetchCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine';

import { UmiCollectionMinter, createUmiClient } from '../src/index';

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

  const minter = new UmiCollectionMinter(umi);
  const result = await minter.launchCollection({
    name: 'MICOW Probe',
    uri: 'https://example.com/micow-probe.json',
    items: ITEMS,
    priceLamports: 10_000_000n, // 0.01 SOL
    treasury: umi.identity.publicKey,
    mintLimitPerWallet: 2,
    royaltyBps: 500,
  });

  console.log('collection  :', result.collection);
  console.log('candyMachine:', result.candyMachine);
  console.log('signatures  :', result.signatures.length);

  // Verify the CM holds the items.
  const account = await fetchCandyMachine(umi, result.candyMachine);
  console.log('itemsAvailable:', account.data.itemsAvailable, 'itemsRedeemed:', account.itemsRedeemed);
  console.log('OK');
}

main().catch((e) => {
  console.error('FAILED:', e?.stack ?? e?.message ?? e);
  process.exit(1);
});

/**
 * Devnet end-to-end probe for the FULL launch → read-model pipeline.
 *
 * Unlike probe-launch.ts (which exercises only the minter), this drives the real
 * application use case `launchCollection`:
 *
 *   off-chain metadata (storage)  →  Core collection + Candy Machine (minter)
 *                                 →  read model (in-memory container)
 *
 * Storage is a LOCAL HTTP server (http://127.0.0.1:PORT/<hash>) so the metadata
 * URIs are genuinely resolvable http(s) URLs — which the minter's validation
 * (rightly) requires — without needing an IPFS pinning secret. This proves the
 * *wiring*; swap in PinataStorage for a real, durable drop.
 *
 * Run (spends devnet SOL, hits the network — manual only, not CI):
 *   pnpm --filter @micow/worker launch:e2e
 */
import { createServer } from 'node:http';

import { launchCollection, type MetadataStorage } from '@micow/application';
import { createInMemoryContainer } from '@micow/database';
import { asPublicKey } from '@micow/domain';
import { UmiCollectionMinter, createUmiClient } from '@micow/solana';

const ENDPOINT = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const KEYPAIR = process.env.SOLANA_KEYPAIR ?? `${process.env.HOME}/.config/solana/devnet.json`;

/**
 * Storage backed by an in-process HTTP server. Each put is stored under a
 * content key and served back as a real URL — so `assertValidItems` (which
 * requires http(s)) passes and the on-chain URI is actually fetchable.
 */
class LocalHttpStorage implements MetadataStorage {
  private readonly blobs = new Map<string, { body: Buffer; contentType: string }>();
  private n = 0;
  base = '';

  async putJson(json: Record<string, unknown>): Promise<{ uri: string }> {
    const key = `meta-${this.n++}.json`;
    this.blobs.set(key, {
      body: Buffer.from(JSON.stringify(json), 'utf8'),
      contentType: 'application/json',
    });
    return { uri: `${this.base}/${key}` };
  }

  async putBytes(data: Uint8Array, opts: { contentType: string }): Promise<{ uri: string }> {
    const key = `blob-${this.n++}`;
    this.blobs.set(key, { body: Buffer.from(data), contentType: opts.contentType });
    return { uri: `${this.base}/${key}` };
  }

  async listen(): Promise<void> {
    const server = createServer((req, res) => {
      const key = (req.url ?? '/').replace(/^\//, '');
      const blob = this.blobs.get(key);
      if (!blob) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': blob.contentType }).end(blob.body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('failed to bind local server');
    this.base = `http://127.0.0.1:${addr.port}`;
  }
}

/** A 1x1 transparent PNG — a real, valid image so metadata is well-formed. */
const ONE_PX_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ),
);

async function main() {
  const umi = createUmiClient({ endpoint: ENDPOINT, keypairPath: KEYPAIR });
  console.log('endpoint :', umi.rpc.getEndpoint());
  console.log('identity :', umi.identity.publicKey);

  const storage = new LocalHttpStorage();
  await storage.listen();
  console.log('storage  :', storage.base);

  const deps = {
    storage,
    minter: new UmiCollectionMinter(umi),
    collections: createInMemoryContainer().collections,
  };

  const result = await launchCollection(deps, {
    name: 'MICOW E2E',
    description: 'end-to-end launch → read model probe',
    image: ONE_PX_PNG,
    imageContentType: 'image/png',
    items: [
      { name: 'MICOW E2E #1', image: ONE_PX_PNG, imageContentType: 'image/png' },
      { name: 'MICOW E2E #2', image: ONE_PX_PNG, imageContentType: 'image/png' },
    ],
    priceLamports: 10_000_000n,
    treasury: asPublicKey(String(umi.identity.publicKey)),
    mintLimitPerWallet: 2,
    royaltyBps: 500,
  });

  console.log('collection  :', result.collection);
  console.log('candyMachine:', result.candyMachine);
  console.log('signatures  :', result.signatures.length);
  console.log('seeded      :', JSON.stringify(result.seeded));

  // Verify the read model was actually written (the "→ read model" half).
  const row = await deps.collections.findByAddress(result.collection);
  if (!row) throw new Error('collection row missing from read model');
  console.log('read-model  :', JSON.stringify({ name: row.name, size: row.size, verified: row.verified }));

  console.log('OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e?.stack ?? e?.message ?? e);
  process.exit(1);
});

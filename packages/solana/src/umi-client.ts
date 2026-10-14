import { readFileSync } from 'node:fs';

import { mplCore } from '@metaplex-foundation/mpl-core';
import { mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine';
import { createSignerFromKeypair, signerIdentity, type Umi } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';

/**
 * Umi client factory for launch/admin operations (create collection, Candy
 * Machine, insert items).
 *
 * Design:
 * - **Keys never live in the browser.** This module is for server scripts/worker
 *   use. Interactive minting (user-signed) is a separate client-side flow.
 * - Reading a Solana CLI keypair file is a convenience for devnet ops; the raw
 *   secret is never logged.
 */

/** Read a Solana CLI JSON keypair file (`[u8,...]`) as a 64-byte secret key. */
export function readKeypairFile(path: string): Uint8Array {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as number[];
  if (!Array.isArray(raw) || raw.length !== 64) {
    throw new Error(`Invalid keypair file (expected 64-byte array): ${path}`);
  }
  return new Uint8Array(raw);
}

export interface UmiClientOptions {
  endpoint: string;
  /** Solana CLI keypair JSON path; when set, becomes the signing identity. */
  keypairPath?: string;
}

/** Create a Umi instance wired with Core + Candy Machine programs. */
export function createUmiClient(opts: UmiClientOptions): Umi {
  let umi = createUmi(opts.endpoint).use(mplCore()).use(mplCandyMachine());
  if (opts.keypairPath) {
    const secretKey = readKeypairFile(opts.keypairPath);
    const keypair = fromWeb3JsKeypair(Keypair.fromSecretKey(secretKey));
    const signer = createSignerFromKeypair(umi, keypair);
    umi = umi.use(signerIdentity(signer));
  }
  return umi;
}

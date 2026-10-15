import { mplCore } from '@metaplex-foundation/mpl-core';
import { generateSigner, signerIdentity, type Umi } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { describe, expect, it } from 'vitest';

import { UmiListingGateway } from './umi-listing';

/**
 * Unit tests for the Umi listing gateway. We build transactions only (no
 * network): `addPlugin`/`revokePluginAuthority` are pure builders. `buildBuyTx`
 * fetches the asset so its *on-chain* behaviour is covered by the devnet e2e
 * probe (`scripts/probe-listing-e2e.ts`), not here.
 *
 * ── What these tests prove (and why "unsigned" alone was not enough) ──────────
 * The original tests asserted only that the returned tx was UNSIGNED (every
 * signature slot zeroed). That is trivially true for a transaction that requires
 * **nobody** to sign — which is exactly the bug the devnet probe surfaced: when
 * the `authority` is passed as a bare PublicKey (or omitted), Core emits the
 * authority account with `isSigner = false`, so the tx has an EMPTY required-
 * signer set and can never be submitted. We therefore assert the tx's
 * `numRequiredSignatures` and its required-signer accounts, not just emptiness.
 */

const DELEGATE = 'Co11111111111111111111111111111111111111111';
const ASSET = 'So11111111111111111111111111111111111111112';

function gateway() {
  // Build-only paths; a random local signer is needed because Umi requires an
  // identity to compute the payer — it never leaves this process.
  const umi = createUmi('https://api.devnet.solana.com').use(mplCore());
  const signer = generateSigner(umi);
  const withIdentity = umi.use(signerIdentity(signer));
  return { gw: new UmiListingGateway(withIdentity, DELEGATE), umi: withIdentity };
}

/**
 * Decode a base64 tx and return whether it is genuinely UNSIGNED: every
 * signature slot (64 bytes each, after the 1-byte count prefix) is empty.
 */
function isUnsigned(base64Tx: string): boolean {
  const bytes = Buffer.from(base64Tx, 'base64');
  const count = bytes[0] ?? 0xff;
  if (count >= 0x80) return false; // unexpected large count
  for (let i = 1; i < 1 + count * 64; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

/**
 * Return the ordered list of required-signer public keys (base58) for a
 * base64-serialized transaction. In a serialized Solana message the first
 * `numRequiredSignatures` account keys are the required signers.
 */
function requiredSigners(umi: Umi, base64Tx: string): string[] {
  const tx = umi.transactions.deserialize(new Uint8Array(Buffer.from(base64Tx, 'base64')));
  const n = tx.message.header.numRequiredSignatures;
  return tx.message.accounts.slice(0, n).map((k) => k.toString());
}

describe('UmiListingGateway', () => {
  it('buildCreateListingTx returns a base64, unsigned transaction', async () => {
    const { gw } = gateway();
    const { serializedTx } = await gw.buildCreateListingTx({
      asset: ASSET,
      seller: DELEGATE,
      delegate: DELEGATE,
    });
    expect(typeof serializedTx).toBe('string');
    expect(Buffer.from(serializedTx, 'base64').length).toBeGreaterThan(0);
    // Genuinely unsigned: all signature slots are empty.
    expect(isUnsigned(serializedTx)).toBe(true);
  });

  it('buildCreateListingTx REQUIRES the seller (authority) to sign', async () => {
    const { gw, umi } = gateway();
    const { serializedTx } = await gw.buildCreateListingTx({
      asset: ASSET,
      seller: DELEGATE,
      delegate: DELEGATE,
    });
    const signers = requiredSigners(umi, serializedTx);
    // Non-empty: the bug was a tx that required nobody.
    expect(signers.length).toBeGreaterThan(0);
    // The seller (owner / add-plugin authority) must be a required signer.
    expect(signers).toContain(DELEGATE);
  });

  it('buildCreateListingTx defaults the delegate to the configured authority', async () => {
    const { gw, umi } = gateway();
    // No explicit delegate → falls back to the constructor address (DELEGATE).
    const { serializedTx } = await gw.buildCreateListingTx({
      asset: ASSET,
      seller: DELEGATE,
      delegate: '',
    });
    expect(isUnsigned(serializedTx)).toBe(true);
    expect(requiredSigners(umi, serializedTx)).toContain(DELEGATE);
  });

  it('buildCancelListingTx returns a base64, unsigned transaction that requires the seller', async () => {
    const { gw, umi } = gateway();
    const { serializedTx } = await gw.buildCancelListingTx({
      listingId: 'l1',
      asset: ASSET,
      seller: DELEGATE,
      delegate: DELEGATE,
    });
    expect(isUnsigned(serializedTx)).toBe(true);
    expect(requiredSigners(umi, serializedTx)).toContain(DELEGATE);
  });

  it('create and cancel produce different transactions', async () => {
    const { gw } = gateway();
    const a = await gw.buildCreateListingTx({ asset: ASSET, seller: DELEGATE, delegate: DELEGATE });
    const b = await gw.buildCancelListingTx({
      listingId: 'l1',
      asset: ASSET,
      seller: DELEGATE,
      delegate: DELEGATE,
    });
    expect(a.serializedTx).not.toBe(b.serializedTx);
  });
});

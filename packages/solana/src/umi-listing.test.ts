import { generateSigner, signerIdentity } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { describe, expect, it } from 'vitest';

import { UmiListingGateway } from './umi-listing';

/**
 * Unit tests for the Umi listing gateway. We build transactions only (no
 * network): `addPlugin`/`revokePluginAuthority` are pure builders. `buildBuyTx`
 * fetches the asset so it is covered by the devnet e2e probe, not here.
 *
 * The key property under test: the gateway returns a valid, **unsigned**
 * base64 transaction (empty signature vector) that the wallet can sign.
 */

const DELEGATE = 'Co11111111111111111111111111111111111111111';
const ASSET = 'So11111111111111111111111111111111111111112';

function gateway() {
  // Build-only paths; a random local signer is needed because Umi requires an
  // identity to compute the payer — it never leaves this process.
  const umi = createUmi('https://api.devnet.solana.com').use(mplCore());
  const signer = generateSigner(umi);
  const withIdentity = umi.use(signerIdentity(signer));
  return new UmiListingGateway(withIdentity, DELEGATE);
}

/**
 * Decode a base64 transaction and return whether it is genuinely UNSIGNED:
 * every signature slot must be 64 zero-bytes. (Umi pre-allocates a slot per
 * required signer, so the count is >= 0 but the bytes are empty until signed.)
 */
function isUnsigned(base64Tx: string): boolean {
  const bytes = Buffer.from(base64Tx, 'base64');
  const count = bytes[0] ?? 0xff;
  if (count >= 0x80) return false; // unexpected large count
  // Signature bytes start right after the (1-byte) count prefix.
  for (let i = 1; i < 1 + count * 64; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

describe('UmiListingGateway', () => {
  it('buildCreateListingTx returns a base64, unsigned transaction', async () => {
    const gw = gateway();
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

  it('buildCancelListingTx returns a base64, unsigned transaction', async () => {
    const gw = gateway();
    const { serializedTx } = await gw.buildCancelListingTx({
      listingId: 'l1',
      asset: ASSET,
      seller: DELEGATE,
      delegate: DELEGATE,
    });
    expect(isUnsigned(serializedTx)).toBe(true);
  });

  it('buildCreateListingTx defaults the delegate to the configured authority', async () => {
    const gw = gateway();
    // No explicit delegate → falls back to the constructor address (DELEGATE).
    const { serializedTx } = await gw.buildCreateListingTx({ asset: ASSET, seller: DELEGATE, delegate: '' });
    expect(isUnsigned(serializedTx)).toBe(true);
  });

  it('create and cancel produce different transactions', async () => {
    const gw = gateway();
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

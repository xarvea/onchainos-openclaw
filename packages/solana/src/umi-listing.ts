import type { ListingGateway } from '@micow/application';
import { addPlugin, fetchAsset, revokePluginAuthority, transfer } from '@metaplex-foundation/mpl-core';
import {
  createNoopSigner,
  publicKey,
  type TransactionBuilder,
  type Umi,
} from '@metaplex-foundation/umi';

/**
 * Umi implementation of the ListingGateway port for the **non-custodial** model
 * (ADR-0005 rev), built on Metaplex Core's `Transfer Delegate` plugin.
 *
 * Flow:
 *  - **list**   → `addPlugin(TransferDelegate → delegate)`; the asset stays in
 *                 the seller's wallet; MICOW's delegate gains transfer rights.
 *  - **cancel** → `revokePluginAuthority(TransferDelegate)`.
 *  - **buy**    → `transfer(newOwner = buyer, authority = delegate)`; Core
 *                 revokes the delegate automatically after the transfer.
 *
 * Every method returns an **unsigned, base64-serialized** transaction. The
 * backend never signs for the user — the wallet signs client-side.
 *
 * ── Why `createNoopSigner` matters (learned via the devnet e2e probe) ─────────
 * Core's `addPlugin`/`transfer` resolve their `authority` account from a Umi
 * `Signer`; only a Signer is emitted with `isSigner = true`. Passing a bare
 * `PublicKey` (or omitting the authority) yields a transaction that requires
 * **nobody** to sign — which the client could never submit and which the unit
 * tests could not catch (an empty tx is trivially "unsigned"). We therefore wrap
 * each authority address in `createNoopSigner`: it never signs (the backend
 * holds no user key) but it *marks the address as a required signer*, so the
 * serialized tx carries the correct, non-empty signature slots for the wallet.
 */
export class UmiListingGateway implements ListingGateway {
  constructor(
    private readonly umi: Umi,
    /** The MICOW delegate authority (address) used for listings. */
    private readonly delegateAddress: string,
  ) {}

  /**
   * Serialize a built transaction to base64 WITHOUT signing. `setLatestBlockhash`
   * is required — a transaction with a default (all-zero) blockhash would be
   * rejected by the RPC when the user submits it.
   *
   * NOTE: we deliberately avoid `base64.serialize` from `@metaplex-foundation/umi/serializers`:
   * in umi 1.6 it is a string→string serializer and throws on a Uint8Array.
   */
  private async toUnsignedBase64(builder: TransactionBuilder): Promise<string> {
    const tx = (await builder.setLatestBlockhash(this.umi)).build(this.umi);
    const bytes = this.umi.transactions.serialize(tx);
    return Buffer.from(bytes).toString('base64');
  }

  async buildCreateListingTx(input: {
    asset: string;
    seller: string;
    delegate: string;
    expiresAt?: Date;
  }): Promise<{ serializedTx: string }> {
    // The delegate is parameterized per call; default to the configured MICOW
    // authority if the caller does not override it.
    const delegate = input.delegate || this.delegateAddress;
    if (!delegate) {
      throw new Error('buildCreateListingTx: a delegate authority is required');
    }

    const builder = addPlugin(this.umi, {
      asset: publicKey(input.asset),
      // The seller owns the asset, so the seller is the authority that must sign
      // the add-plugin instruction. Mark it required via a noop signer.
      authority: createNoopSigner(publicKey(input.seller)),
      plugin: {
        type: 'TransferDelegate',
        authority: { type: 'Address', address: publicKey(delegate) },
      },
    });

    return { serializedTx: await this.toUnsignedBase64(builder) };
  }

  async buildCancelListingTx(input: {
    listingId: string;
    asset: string;
    seller: string;
    delegate: string;
  }): Promise<{ serializedTx: string }> {
    const builder = revokePluginAuthority(this.umi, {
      asset: publicKey(input.asset),
      // Revoking is a plugin authority op; the asset's owner (seller) signs.
      authority: createNoopSigner(publicKey(input.seller)),
      plugin: { type: 'TransferDelegate' },
    });
    return { serializedTx: await this.toUnsignedBase64(builder) };
  }

  async buildBuyTx(input: {
    listingId: string;
    asset: string;
    seller: string;
    buyer: string;
    delegate: string;
    priceLamports: bigint;
  }): Promise<{ serializedTx: string }> {
    // `transfer` needs the fetched asset (owner/oracles/lifecycleHooks), not just
    // the address.
    const asset = await fetchAsset(this.umi, publicKey(input.asset));

    const builder = transfer(this.umi, {
      asset,
      newOwner: publicKey(input.buyer),
      // The delegate holds the TransferDelegate authority and must sign the
      // transfer. Mark it required (the buyer only pays; the delegate authorizes).
      authority: createNoopSigner(publicKey(input.delegate)),
    });

    return { serializedTx: await this.toUnsignedBase64(builder) };
  }
}

import type { ListingGateway } from '@micow/application';
import { addPlugin, fetchAsset, revokePluginAuthority, transfer } from '@metaplex-foundation/mpl-core';
import { publicKey, type TransactionBuilder, type Umi } from '@metaplex-foundation/umi';

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
 * backend never signs for the user — the wallet signs client-side. The returned
 * tx is unsigned (its signature vector is empty), verified in the unit test.
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
      // The delegate holds the TransferDelegate authority and signs (client-side).
      authority: this.umi.identity,
    });

    return { serializedTx: await this.toUnsignedBase64(builder) };
  }
}

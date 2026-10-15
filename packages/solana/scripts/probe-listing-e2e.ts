/**
 * Devnet end-to-end probe for the FULL non-custodial listing pipeline
 * (ADR-0005 rev): list → buy, driven through the *real* application use cases
 * and the *real* `UmiListingGateway` against a live devnet.
 *
 * Why this exists: the unit tests only build transactions offline. They cannot
 * prove that (a) the Transfer Delegate plugin is actually accepted by the Core
 * program, (b) the delegate — not the seller — is the valid signer for the buy
 * transfer, or (c) Core revokes the delegate after the transfer. Only an
 * on-chain run can. This probe is MANUAL ONLY (spends devnet SOL, hits network).
 *
 * Roles (distinct keys, so the split-role case is genuinely exercised):
 *   - funder   : the devnet keypair (SOLANA_KEYPAIR), pays for account creation
 *   - seller   : fresh keypair, owns the asset, signs `createListing`
 *   - delegate : fresh keypair, MICOW's authority, signs the buy transfer
 *   - buyer    : fresh keypair, receives the asset
 *
 * Run:
 *   pnpm --filter @micow/solana listing:e2e
 */
import { create, deriveAssetPlugins, fetchAsset } from '@metaplex-foundation/mpl-core';
import { transferSol } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  keypairIdentity,
  publicKey,
  signTransaction as umiSignTransaction,
  sol,
  type Signer,
  type TransactionBuilder,
  type Umi,
} from '@metaplex-foundation/umi';

import {
  buyListing,
  createListing,
  type ListingRepository,
} from '@micow/application';
import { asPublicKey, type Listing, type ListingStatus } from '@micow/domain';

import { UmiListingGateway } from '../src/umi-listing';
import { createUmiClient } from '../src/umi-client';

const ENDPOINT = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const KEYPAIR = process.env.SOLANA_KEYPAIR ?? `${process.env.HOME}/.config/solana/devnet.json`;

/** Metadata URI for the throwaway asset (a real, valid data URI). */
const METADATA_URI =
  'data:application/json;base64,' +
  Buffer.from(
    JSON.stringify({
      name: 'MICOW Listing E2E',
      description: 'throwaway asset for the listing e2e probe',
      image:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    }),
    'utf8',
  ).toString('base64');

/** Minimal in-memory ListingRepository — enough for the create/buy path. */
class MemListings implements ListingRepository {
  private rows = new Map<string, Listing>();
  async findActiveByAsset(asset: string) {
    return [...this.rows.values()].find((l) => l.asset === asset && l.status === 'ACTIVE') ?? null;
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listActiveBySeller(seller: string) {
    return [...this.rows.values()].filter((l) => l.seller === seller && l.status === 'ACTIVE');
  }
  async listActive(opts: { limit?: number; offset?: number } = {}) {
    const all = [...this.rows.values()].filter((l) => l.status === 'ACTIVE');
    return all.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? all.length));
  }
  async create(listing: Listing) {
    this.rows.set(listing.id, listing);
  }
  async updateStatus(id: string, status: ListingStatus) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, status });
  }
}

/** Build an unsigned tx to base64 (mirrors the gateway's non-signing serialization). */
async function toBase64(umi: Umi, builder: TransactionBuilder): Promise<string> {
  const tx = (await builder.setLatestBlockhash(umi)).build(umi);
  return Buffer.from(umi.transactions.serialize(tx)).toString('base64');
}

/** Sign a base64 tx with the given signer(s) and send it; return the signature. */
async function signAndSend(umi: Umi, base64Tx: string, signers: Signer[]): Promise<string> {
  const bytes = new Uint8Array(Buffer.from(base64Tx, 'base64'));
  const tx = umi.transactions.deserialize(bytes);
  const signed = await umiSignTransaction(tx, signers);
  const signature = await umi.rpc.sendTransaction(signed, {
    preflightCommitment: 'confirmed',
  });
  const latest = await umi.rpc.getLatestBlockhash();
  await umi.rpc.confirmTransaction(signature, {
    strategy: { type: 'blockhash', ...latest },
    commitment: 'confirmed',
  });
  return String(signature);
}

/** Return every signer in `pool` that the (deserialized) tx requires. */
function requiredSigners(umi: Umi, base64Tx: string, pool: Signer[]): Signer[] {
  const tx = umi.transactions.deserialize(new Uint8Array(Buffer.from(base64Tx, 'base64')));
  // In a serialized Solana message, the first `numRequiredSignatures` account
  // keys are the required signers (in order).
  const n = tx.message.header.numRequiredSignatures;
  const required = new Set(tx.message.accounts.slice(0, n).map((k) => k.toString()));
  return pool.filter((s) => required.has(s.publicKey.toString()));
}

async function main() {
  const umi = createUmiClient({ endpoint: ENDPOINT, keypairPath: KEYPAIR });
  console.log('endpoint :', umi.rpc.getEndpoint());
  console.log('funder   :', umi.identity.publicKey);

  // Fresh keys, funded by airdrop (devnet only).
  const seller = generateSigner(umi);
  const delegateKp = generateSigner(umi);
  const buyer = generateSigner(umi);
  console.log('seller   :', seller.publicKey);
  console.log('delegate :', delegateKp.publicKey);
  console.log('buyer    :', buyer.publicKey);

  // Fresh keys, funded by a transfer from the funder. (The public devnet faucet
  // is rate-limited and returns "Internal error" — the funder already holds SOL.)
  for (const [label, kp] of [
    ['seller', seller],
    ['delegate', delegateKp],
    ['buyer', buyer],
  ] as const) {
    const fundBuilder = transferSol(umi, {
      source: umi.identity,
      destination: kp.publicKey,
      amount: sol(0.5),
    });
    const sig = await signAndSend(umi, await toBase64(umi, fundBuilder), [umi.identity]);
    console.log(`funded   : ${label} +0.5 SOL (${sig.slice(0, 8)}…)`);
  }

  // ── Create a Core asset owned by the seller ────────────────────────────────
  // The asset address must be a FRESH keypair (the seller's key already exists
  // as a funded wallet). `owner` is set explicitly to the seller.
  const assetSigner = generateSigner(umi);
  const createBuilder = create(umi, {
    asset: assetSigner,
    owner: seller.publicKey,
    updateAuthority: seller.publicKey,
    name: 'MICOW Listing E2E',
    uri: METADATA_URI,
  });
  const createSig = await signAndSend(umi, await toBase64(umi, createBuilder), [
    umi.identity,
    assetSigner,
  ]);
  const assetAddress = assetSigner.publicKey;
  console.log('asset    :', assetAddress, '(create sig:', createSig.slice(0, 8) + '…)');

  // ── LIST ───────────────────────────────────────────────────────────────────
  // Real gateway bound to the DELEGATE keypair so the built buy tx's authority
  // is the delegate (the only valid signer for the transfer).
  const delegateUmi = umi.use(keypairIdentity(delegateKp));
  const gateway = new UmiListingGateway(delegateUmi, String(delegateKp.publicKey));

  const deps = { listings: new MemListings(), gateway, platformBps: 250 };

  const { listing, serializedTx: listTx } = await createListing(deps, {
    asset: asPublicKey(String(assetAddress)),
    seller: asPublicKey(String(seller.publicKey)),
    delegate: asPublicKey(String(delegateKp.publicKey)),
    priceLamports: 10_000_000n, // 0.01 SOL
    royaltyBps: 0,
  });
  console.log('listing  :', listing.id, listing.status);

  // The list tx is paid by the gateway identity (delegate) but authorized by the
  // seller (owner). Sign with every required signer we hold.
  const listPool = [umi.identity, seller];
  const listSigners = requiredSigners(umi, listTx, listPool);
  console.log(
    'listTx signers:',
    listSigners.map((s) => s.publicKey.toString().slice(0, 6)).join(', ') || '(none)',
  );
  const listSig = await signAndSend(umi, listTx, listSigners);
  console.log('listSig  :', listSig);

  // Verify the asset is still owned by the seller and now carries the plugin.
  // NOTE: Core returns plugins as KEYED properties (asset.transferDelegate), not
  // an array — `asset.plugins` does not exist. Use `deriveAssetPlugins` to get
  // the effective plugin set the program enforces.
  const assetAfterList = deriveAssetPlugins(await fetchAsset(umi, publicKey(assetAddress)));
  const delegateAuthority = assetAfterList.transferDelegate?.authority;
  const isDelegated =
    delegateAuthority?.type === 'Address' &&
    String((delegateAuthority as { address: unknown }).address) === String(delegateKp.publicKey);
  console.log(
    'owner    :',
    assetAfterList.owner,
    '(still seller:',
    (String(assetAfterList.owner) === String(seller.publicKey)) + ',',
    'TransferDelegate→delegate:',
    isDelegated + ')',
  );
  if (String(assetAfterList.owner) !== String(seller.publicKey)) {
    throw new Error('after LIST: asset owner changed (expected: still seller)');
  }
  if (!isDelegated) {
    throw new Error(
      `after LIST: TransferDelegate authority is not the delegate (got ${JSON.stringify(delegateAuthority)})`,
    );
  }

  // ── BUY ────────────────────────────────────────────────────────────────────
  const {
    listing: filled,
    split,
    serializedTx: buyTx,
  } = await buyListing(deps, {
    listingId: listing.id,
    buyer: asPublicKey(String(buyer.publicKey)),
    delegate: asPublicKey(String(delegateKp.publicKey)),
  });
  console.log('buy      :', filled.status, 'split=', {
    platformFee: split.platformFee.toString(),
    creatorRoyalty: split.creatorRoyalty.toString(),
    sellerProceeds: split.sellerProceeds.toString(),
  });

  // The DELEGATE signs the transfer (this is the property unit tests can't show).
  const buyPool = [umi.identity, delegateKp];
  const buySigners = requiredSigners(umi, buyTx, buyPool);
  console.log(
    'buyTx signers:',
    buySigners.map((s) => s.publicKey.toString().slice(0, 6)).join(', ') || '(none)',
  );
  const buySig = await signAndSend(umi, buyTx, buySigners);
  console.log('buySig   :', buySig);

  // Verify ownership moved to the buyer AND the delegate authority was reset.
  const assetAfterBuy = deriveAssetPlugins(await fetchAsset(umi, publicKey(assetAddress)));
  const ownerIsBuyer = String(assetAfterBuy.owner) === String(buyer.publicKey);
  // FINDING: Core does NOT remove the TransferDelegate plugin on transfer — it
  // RESETS its authority back to the owner ({ type: 'Owner' }). The plugin
  // record persists. We assert the delegate no longer holds authority.
  const afterBuyAuthority = assetAfterBuy.transferDelegate?.authority;
  const delegateStillHolds =
    afterBuyAuthority?.type === 'Address' &&
    String((afterBuyAuthority as { address: unknown }).address) === String(delegateKp.publicKey);
  console.log(
    'newOwner :',
    ownerIsBuyer ? 'BUYER ✅' : assetAfterBuy.owner,
    '| delegate authority after buy:',
    delegateStillHolds ? 'STILL DELEGATE ❌' : 'reset to owner ✅',
  );
  if (!ownerIsBuyer) throw new Error('after BUY: owner is not the buyer');
  if (delegateStillHolds) throw new Error('after BUY: delegate still holds TransferDelegate authority');

  console.log('OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e?.stack ?? e?.message ?? e);
  process.exit(1);
});

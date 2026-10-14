import { type Activity, ActivityType, asLamports, asPublicKey, type Lamports } from '@micow/domain';

/**
 * Mapping from Helius "enhanced" / raw webhook transaction payloads to domain
 * `Activity` rows.
 *
 * Design notes:
 * - The mapper is a *pure function*: no network, no DB, no clock. Everything it
 *   needs is derived from the payload, so it is trivially unit-testable and
 *   replay-safe.
 * - `id` is derived deterministically from `{signature}:{mint}:{type}` so that a
 *   duplicate delivery (Helius retries, overlapping backfill) upserts to the
 *   same row instead of creating a phantom second event.
 * - We only classify events we actually understand. Unknown transaction types
 *   return `[]` rather than guessing — the read model must never contain
 *   fabricated history.
 */

/** A subset of the Helius enhanced webhook transaction shape that we consume. */
export interface HeliusEnhancedTransaction {
  signature?: string;
  slot?: number | string;
  timestamp?: number | string;
  type?: string;
  description?: string;
  feePayer?: string;
  /** NFT-specific event block, present for nft-sale/nft-mint style events. */
  events?: {
    nft?: {
      mint?: string;
      seller?: string;
      buyer?: string;
      /** Price in lamports as a string (Helius sends big integers as strings). */
      amount?: string | number;
      source?: string;
    };
  };
  /** Token transfers (used to infer transfers/mints when `events.nft` is absent). */
  tokenTransfers?: {
    mint?: string;
    fromUserAccount?: string;
    toUserAccount?: string;
    fromTokenAccount?: string;
    toTokenAccount?: string;
    tokenAmount?: number;
    tokenStandard?: string;
  }[];
  /** Native SOL transfers — used to recover sale price when nft.amount is absent. */
  nativeTransfers?: {
    fromUserAccount?: string;
    toUserAccount?: string;
    amount?: number;
  }[];
}

export interface MapContext {
  /**
   * Collection address resolver. The webhook payload does not always include
   * the collection grouping, so callers may inject a lookup (mint → collection).
   * Must be synchronous/cheap; return null when unknown.
   */
  collectionOf?: (mint: string) => string | null;
}

const isPubkey = (v: unknown): v is string =>
  typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

const isSig = (v: unknown): v is string =>
  typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(v);

/** Deterministic, replay-stable activity id. */
export function activityId(signature: string, mint: string, type: ActivityType): string {
  return `${signature}:${mint}:${type}`;
}

/** Normalise the various int-like encodings Helius uses (string | number). */
function toBigInt(v: string | number | undefined | null): bigint | null {
  if (v === undefined || v === null || v === '') return null;
  try {
    const n = typeof v === 'bigint' ? v : BigInt(v);
    return n < 0n ? null : n;
  } catch {
    return null;
  }
}

/** Best-effort sale price in lamports from nft.amount or the largest SOL transfer. */
function salePrice(
  tx: HeliusEnhancedTransaction,
  buyer: string | null,
  seller: string | null,
): Lamports | null {
  const fromEvent = toBigInt(tx.events?.nft?.amount);
  if (fromEvent !== null && fromEvent > 0n) return asLamports(fromEvent);

  const transfers = tx.nativeTransfers ?? [];
  let best: bigint | null = null;
  for (const t of transfers) {
    const amount = toBigInt(t.amount);
    if (amount === null || amount <= 0n) continue;
    // Prefer a transfer from the buyer to the seller when we know both.
    const matchesParties =
      (!buyer || t.fromUserAccount === buyer) && (!seller || t.toUserAccount === seller);
    if (matchesParties && (best === null || amount > best)) best = amount;
  }
  return best !== null ? asLamports(best) : null;
}

/**
 * Map a single Helius enhanced transaction to zero or more activities.
 * Returns `[]` when the payload is not a recognisable, well-formed NFT event.
 */
export function mapHeliusTransaction(
  tx: HeliusEnhancedTransaction,
  ctx: MapContext = {},
): Activity[] {
  const { signature } = tx;
  if (!isSig(signature)) return [];

  const slot = toBigInt(tx.slot);
  if (slot === null) return [];

  const blockTimeSeconds = toBigInt(tx.timestamp);
  if (blockTimeSeconds === null) return [];
  const blockTime = new Date(Number(blockTimeSeconds) * 1000);
  if (Number.isNaN(blockTime.getTime())) return [];

  const type = (tx.type ?? '').toUpperCase();
  const out: Activity[] = [];

  const push = (mint: string, kind: ActivityType, from: string | null, to: string | null) => {
    if (!isPubkey(mint)) return;
    const collection = ctx.collectionOf?.(mint) ?? null;
    out.push({
      id: activityId(signature, mint, kind),
      type: kind,
      asset: asPublicKey(mint),
      collection: isPubkey(collection) ? asPublicKey(collection) : null,
      from: from && isPubkey(from) ? asPublicKey(from) : null,
      to: to && isPubkey(to) ? asPublicKey(to) : null,
      price: kind === ActivityType.SALE ? salePrice(tx, to, from) : null,
      txSignature: signature as Activity['txSignature'],
      blockTime,
      slot,
    });
  };

  const nft = tx.events?.nft;
  const nftMint = nft?.mint;

  // 1) Explicit NFT events (most reliable when present).
  if (nftMint && isPubkey(nftMint)) {
    if (type.includes('MINT')) {
      push(nftMint, ActivityType.MINT, null, nft?.buyer ?? tx.feePayer ?? null);
      return out;
    }
    if (type.includes('SALE') || type.includes('BUY')) {
      push(nftMint, ActivityType.SALE, nft?.seller ?? null, nft?.buyer ?? null);
      return out;
    }
    if (type.includes('TRANSFER')) {
      push(nftMint, ActivityType.TRANSFER, nft?.seller ?? null, nft?.buyer ?? null);
      return out;
    }
  }

  // 2) Fall back to token transfers carrying an NFT mint (amount 1, no decimals).
  for (const t of tx.tokenTransfers ?? []) {
    const mint = t.mint;
    if (!isPubkey(mint)) continue;
    const from = t.fromUserAccount ?? null;
    const to = t.toUserAccount ?? null;

    if (type.includes('MINT')) {
      push(mint, ActivityType.MINT, null, to ?? tx.feePayer ?? null);
      continue;
    }
    if (type.includes('BURN')) continue; // burns are not tracked in the feed yet
    if (from && to) push(mint, ActivityType.TRANSFER, from, to);
  }

  return out;
}

/** Map a full webhook delivery (an array of transactions) to activities. */
export function mapHeliusWebhook(
  payload: readonly HeliusEnhancedTransaction[],
  ctx: MapContext = {},
): Activity[] {
  const out: Activity[] = [];
  for (const tx of payload) out.push(...mapHeliusTransaction(tx, ctx));
  return out;
}

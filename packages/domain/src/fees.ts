import { asLamports, type Lamports } from './primitives';

/**
 * Deterministic fee split for a sale (BLUEPRINT §6, invariant I5).
 *
 * The three parts MUST sum exactly to the price — never more, never less.
 * Rounding is resolved by giving the seller the remainder, so the platform and
 * creator take the *floor* of their share. This guarantees:
 *   platformFee + creatorRoyalty + sellerProceeds === price   (always)
 *
 * All inputs are basis points (1 bps = 0.01%). `platformBps` and
 * `royaltyBps` must be within [0, 10_000] and their sum must not exceed
 * 10_000 (the seller must not get a negative amount).
 */
export interface FeeSplit {
  readonly platformFee: Lamports;
  readonly creatorRoyalty: Lamports;
  readonly sellerProceeds: Lamports;
}

export function computeFeeSplit(
  price: Lamports,
  opts: { platformBps: number; royaltyBps: number },
): FeeSplit {
  const { platformBps, royaltyBps } = opts;
  if (!Number.isInteger(platformBps) || platformBps < 0 || platformBps > 10_000) {
    throw new Error(`computeFeeSplit: platformBps out of range (0-10000): ${platformBps}`);
  }
  if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 10_000) {
    throw new Error(`computeFeeSplit: royaltyBps out of range (0-10000): ${royaltyBps}`);
  }
  if (platformBps + royaltyBps > 10_000) {
    throw new Error(
      `computeFeeSplit: platformBps + royaltyBps must be <= 10000 (got ${platformBps} + ${royaltyBps})`,
    );
  }
  if (price < 0n) throw new Error(`computeFeeSplit: negative price ${price}`);

  const BPS = 10_000n;
  const platformFee = (price * BigInt(platformBps)) / BPS; // floor
  const creatorRoyalty = (price * BigInt(royaltyBps)) / BPS; // floor
  const sellerProceeds = price - platformFee - creatorRoyalty; // remainder → seller

  return {
    platformFee: asLamports(platformFee),
    creatorRoyalty: asLamports(creatorRoyalty),
    sellerProceeds: asLamports(sellerProceeds),
  };
}

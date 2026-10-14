import { z } from 'zod';

/** Shared validation schemas used by both server handlers and client forms. */

export const base58Pubkey = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key');

export const txSignature = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/, 'Invalid transaction signature');

/**
 * Create-listing input (non-custodial model, ADR-0005 rev).
 * The seller grants MICOW's delegate authority over the asset; the asset stays
 * in the seller's wallet.
 */
export const createListingInput = z.object({
  asset: base58Pubkey,
  /** Price in lamports as a string (avoid JS number precision loss). */
  priceLamports: z
    .string()
    .regex(/^\d+$/, 'priceLamports must be a non-negative integer string')
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n, 'Price must be greater than zero'),
  /** Optional expiry (ISO-8601 string). */
  expiresAt: z.coerce.date().optional(),
  /** Royalty basis points for this asset (defaults to 0). */
  royaltyBps: z.coerce.number().int().min(0).max(10_000).optional(),
});

/** Cancel-listing input — only the seller may cancel (I4). */
export const cancelListingInput = z.object({
  listingId: z.string().uuid('listingId must be a UUID'),
});

/** Buy-listing input — the buyer's wallet. */
export const buyListingInput = z.object({
  listingId: z.string().uuid('listingId must be a UUID'),
  buyer: base58Pubkey,
});

export const paginationInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const sellerQuery = z.object({
  seller: base58Pubkey,
});

export type CreateListingInput = z.infer<typeof createListingInput>;
export type CancelListingInput = z.infer<typeof cancelListingInput>;
export type BuyListingInput = z.infer<typeof buyListingInput>;
export type PaginationInput = z.infer<typeof paginationInput>;

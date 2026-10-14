import { z } from 'zod';

/** Shared validation schemas used by both server handlers and client forms. */

export const base58Pubkey = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key');

export const txSignature = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/, 'Invalid transaction signature');

export const createListingInput = z.object({
  asset: base58Pubkey,
  priceLamports: z.coerce.bigint().positive('Price must be greater than zero'),
  expiresAt: z.coerce.date().optional(),
});

export const paginationInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export type CreateListingInput = z.infer<typeof createListingInput>;
export type PaginationInput = z.infer<typeof paginationInput>;

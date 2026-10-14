import {
  buyListing as buyListingUseCase,
  cancelListing as cancelListingUseCase,
  createListing as createListingUseCase,
  type ListingDeps,
} from '@micow/application';
import { asPublicKey, type PublicKeyString } from '@micow/domain';
import { UmiListingGateway, createUmiClient } from '@micow/solana';

import { readModel } from './read-model';
import { serverEnv } from './server-env';

/**
 * Server-side listing service — the composition root for the non-custodial
 * listing flow (ADR-0005 rev).
 *
 * Wiring: read model (container) + `UmiListingGateway` (Core Transfer Delegate)
 * → application use cases. The web layer stays thin: it validates input, calls a
 * use case, and returns the unsigned transaction for the wallet to sign.
 *
 * Degrades safely: when the DB or the platform delegate is not configured we do
 * NOT fabricate state — the route returns a clear 503 so misconfiguration is
 * obvious (a listing that "succeeds" without a delegate would be a silent trap).
 */

export interface ListingService {
  deps: ListingDeps;
}

/**
 * Build the listing service from server config, or throw a descriptive error
 * when required configuration is missing (surfaced as HTTP 503 by callers).
 */
export function listingService(): ListingService {
  const container = readModel();
  if (!container) {
    throw new Error('listing unavailable: DATABASE_URL is not configured');
  }

  const env = serverEnv();
  const delegate = env.PLATFORM_DELEGATE;
  if (!delegate) {
    throw new Error('listing unavailable: PLATFORM_DELEGATE is not configured');
  }

  // The gateway builds unsigned transactions; the identity here is only used to
  // compute the payer/fee — the user's wallet signs the final message.
  const umi = createUmiClient({
    endpoint:
      env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    keypairPath: env.SOLANA_KEYPAIR_PATH,
  });

  const deps: ListingDeps = {
    listings: container.listings,
    gateway: new UmiListingGateway(umi, delegate),
    platformBps: env.PLATFORM_FEE_BPS,
  };

  return { deps };
}

/** The configured platform delegate (for diagnostics / client hints). */
export function platformDelegate(): string | undefined {
  try {
    return serverEnv().PLATFORM_DELEGATE;
  } catch {
    return undefined;
  }
}

export async function createListing(input: {
  asset: PublicKeyString;
  seller: PublicKeyString;
  delegate: PublicKeyString;
  priceLamports: bigint;
  royaltyBps?: number;
  expiresAt?: Date;
}) {
  const { deps } = listingService();
  return createListingUseCase(deps, input);
}

export async function cancelListing(input: {
  listingId: string;
  caller: PublicKeyString;
  delegate: PublicKeyString;
}) {
  const { deps } = listingService();
  return cancelListingUseCase(deps, input);
}

export async function buyListing(input: {
  listingId: string;
  buyer: PublicKeyString;
  delegate: PublicKeyString;
}) {
  const { deps } = listingService();
  return buyListingUseCase(deps, input);
}

/** Read helpers (no gateway needed). */
export async function listActiveListings(opts: { limit?: number; offset?: number } = {}) {
  const c = readModel();
  if (!c) return { items: [], enabled: false };
  const items = await c.listings.listActive(opts);
  return { items, enabled: true };
}

export async function getListing(id: string) {
  const c = readModel();
  if (!c) return null;
  return c.listings.findById(id);
}

/** Re-export for route handlers that need the delegate address. */
export { asPublicKey };

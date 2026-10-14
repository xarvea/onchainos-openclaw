/**
 * Branded primitive types for domain identifiers.
 * Branding prevents accidentally passing a "seller" where an "owner" is expected.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Base58-encoded Solana public key (mint, collection, wallet, program). */
export type PublicKeyString = Brand<string, 'PublicKeyString'>;

/** Solana transaction signature. */
export type TxSignature = Brand<string, 'TxSignature'>;

/** Lamports (1 SOL = 1_000_000_000 lamports), integer. */
export type Lamports = Brand<bigint, 'Lamports'>;

export const SOL_DECIMALS = 9;
export const LAMPORTS_PER_SOL = 1_000_000_000n;

export function isPlausiblePublicKey(value: string): boolean {
  // Base58, 32-44 chars. Does not validate checksum — that's done by the SDK.
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export function asPublicKey(value: string): PublicKeyString {
  if (!isPlausiblePublicKey(value)) {
    throw new Error(`Invalid public key: ${value}`);
  }
  return value as PublicKeyString;
}

export function lamportsFromSol(sol: number): Lamports {
  if (!Number.isFinite(sol) || sol < 0) throw new Error(`Invalid SOL amount: ${sol}`);
  return BigInt(Math.round(sol * Number(LAMPORTS_PER_SOL))) as Lamports;
}

/** Brand a raw bigint as Lamports (e.g. when reading from the database). */
export function asLamports(value: bigint): Lamports {
  if (value < 0n) throw new Error(`Invalid lamports: ${value}`);
  return value as Lamports;
}

export function lamportsToSol(lamports: Lamports): number {
  return Number(lamports) / Number(LAMPORTS_PER_SOL);
}

/**
 * Pure helpers for the launch/mint flow (Candy Machine v3 + Metaplex Core).
 *
 * Everything here is deterministic — no network, no Umi context, no clock — so
 * it is cheap to unit-test. The Umi-backed orchestration lives in
 * `umi-minter.ts` and consumes these.
 */

export interface ConfigLine {
  name: string;
  uri: string;
}

export interface ConfigLineSettings {
  prefixName: string;
  nameLength: number;
  prefixUri: string;
  uriLength: number;
  isSequential: boolean;
}

/**
 * Derive ConfigLineSettings lengths from the actual items.
 *
 * Candy Machine validates that each item's `name`/`uri` fits within
 * `prefix + length`, and the Core CM program is strict about it — deriving a
 * "common prefix" and shrinking the suffix is fragile (an off-by-one trips
 * `ExceededLengthError`). So we use an EMPTY prefix and the full string lengths,
 * which is unambiguous and verified against devnet.
 */
export function computeConfigLineSettings(items: ConfigLine[]): ConfigLineSettings {
  if (items.length === 0) {
    throw new Error('computeConfigLineSettings: at least one item is required');
  }

  const nameLength = items.reduce((m, i) => Math.max(m, i.name.length), 0);
  const uriLength = items.reduce((m, i) => Math.max(m, i.uri.length), 0);

  return { prefixName: '', nameLength, prefixUri: '', uriLength, isSequential: false };
}

export interface MintEconomics {
  /** Price in lamports; 0 disables the solPayment guard (free mint). */
  priceLamports: bigint;
  /** Treasury that receives mint proceeds. */
  destination: string;
  /** Max mints per wallet; 0 disables the mintLimit guard. */
  mintLimitPerWallet: number;
}

/**
 * Build the guard config for the public mint. Returns a plain object of the
 * guards we enable; the Umi layer wraps each in `some(...)`. Kept pure so the
 * fee/limit rules are testable without touching chain code.
 */
export function buildMintGuards(econ: MintEconomics): {
  solPayment?: { lamports: bigint; destination: string };
  mintLimit?: { id: number; limit: number };
} {
  const guards: {
    solPayment?: { lamports: bigint; destination: string };
    mintLimit?: { id: number; limit: number };
  } = {};

  if (econ.priceLamports > 0n) {
    if (!econ.destination) {
      throw new Error('buildMintGuards: destination is required when price > 0');
    }
    guards.solPayment = { lamports: econ.priceLamports, destination: econ.destination };
  }

  if (econ.mintLimitPerWallet > 0) {
    guards.mintLimit = { id: 1, limit: econ.mintLimitPerWallet };
  }

  return guards;
}

/** Validate items before sending anything on-chain (fail fast, save fees). */
export function assertValidItems(items: ConfigLine[]): void {
  if (items.length === 0) throw new Error('assertValidItems: no items');
  for (const [i, item] of items.entries()) {
    if (!item.name.trim()) throw new Error(`assertValidItems: item ${i} has an empty name`);
    if (!/^https?:\/\//.test(item.uri)) {
      throw new Error(`assertValidItems: item ${i} uri must be http(s): ${item.uri}`);
    }
  }
}

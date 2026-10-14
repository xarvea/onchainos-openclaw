import type { PublicKeyString } from './primitives';

/**
 * On-chain asset representations. MICOW targets Metaplex Core as the primary
 * standard, with Token Metadata supported for legacy assets surfaced via DAS.
 */
export type AssetStandard = 'core' | 'token-metadata' | 'compressed';

export interface AssetAttribute {
  readonly traitType: string;
  readonly value: string;
}

export interface Asset {
  readonly mint: PublicKeyString;
  readonly name: string;
  readonly uri: string;
  readonly image: string | null;
  readonly standard: AssetStandard;
  readonly collection: PublicKeyString | null;
  readonly owner: PublicKeyString;
  readonly creator: PublicKeyString | null;
  readonly attributes: readonly AssetAttribute[];
  readonly compressed: boolean;
  readonly frozen: boolean;
}

export interface Collection {
  readonly address: PublicKeyString;
  readonly name: string;
  readonly image: string | null;
  readonly description: string | null;
  readonly verified: boolean;
  readonly size: number;
  readonly standard: AssetStandard;
  readonly creator: PublicKeyString | null;
}

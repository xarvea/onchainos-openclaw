import type { Asset } from '@micow/domain';

/**
 * Port for an on-chain indexer (DAS implementation lives in @micow/solana).
 * Declared here so the worker doesn't import the Solana SDK directly at the
 * use-case boundary; the concrete client is injected at the composition root.
 */
export interface AssetIndexer {
  getAsset(mint: string): Promise<Asset | null>;
  getAssetsByOwner(owner: string): Promise<Asset[]>;
  getAssetsByCollection(collection: string): Promise<Asset[]>;
}

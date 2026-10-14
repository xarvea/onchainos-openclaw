import type { Asset, Collection } from '@micow/domain';

/**
 * Port for an on-chain indexer (DAS implementation lives in @micow/solana).
 * Declared here so the worker doesn't import the Solana SDK directly at the
 * use-case boundary; the concrete client is injected at the composition root.
 *
 * The shape mirrors {@link import('@micow/solana').IndexerProvider} closely
 * enough that `HeliusDasIndexer` satisfies it structurally — but the worker
 * only declares what it actually uses.
 */
export interface AssetIndexer {
  getAsset(mint: string): Promise<Asset | null>;
  getAssetsByOwner(owner: string): Promise<Asset[]>;
  getAssetsByCollection(
    collection: string,
    opts?: { limit?: number; page?: number },
  ): Promise<Asset[]>;
  getAssetsByCreator?(creator: string): Promise<Asset[]>;
  getCollection?(address: string): Promise<Collection | null>;
}

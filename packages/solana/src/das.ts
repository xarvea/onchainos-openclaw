import { asPublicKey, type Asset, type AssetStandard, type Collection } from '@micow/domain';

/**
 * Provider-agnostic indexer interface. MVP implementation hits Helius DAS;
 * this interface lets us swap to a custom Geyser indexer later without
 * touching the rest of the app (see ADR-0003).
 */
export interface IndexerProvider {
  getAsset(mint: string): Promise<Asset | null>;
  getAssetsByOwner(owner: string): Promise<Asset[]>;
  getAssetsByCollection(collection: string, opts?: { limit?: number; page?: number }): Promise<Asset[]>;
  getAssetsByCreator(creator: string): Promise<Asset[]>;
  getCollection(address: string): Promise<Collection | null>;
}

/** Minimal shape of a Helius DAS getAsset response (subset we consume). */
export interface DasAsset {
  id: string;
  content?: {
    metadata?: { name?: string; description?: string; attributes?: { trait_type?: string; value?: string }[] };
    links?: { image?: string };
  };
  compression?: { compressed?: boolean };
  grouping?: { group_key: string; group_value: string }[];
  creators?: { address: string; verified: boolean }[];
  ownership?: { owner?: string; frozen?: boolean };
  interface?: string;
  token_info?: { symbol?: string };
}

export function dasInterfaceToStandard(iface?: string): AssetStandard {
  if (!iface) return 'token-metadata';
  if (iface.startsWith('MplCore')) return 'core';
  if (iface === 'ProgrammableNFT' || iface === 'V1_NFT') return 'token-metadata';
  if (iface === 'CompressedNFT' || iface.includes('Bubblegum')) return 'compressed';
  return 'token-metadata';
}

export function dasAssetToDomain(a: DasAsset): Asset {
  const standard = dasInterfaceToStandard(a.interface);
  const attrs =
    a.content?.metadata?.attributes?.map((x) => ({
      traitType: x.trait_type ?? '',
      value: String(x.value ?? ''),
    })) ?? [];
  const collection = a.grouping?.find((g) => g.group_key === 'collection')?.group_value ?? null;
  return {
    mint: asPublicKey(a.id),
    name: a.content?.metadata?.name ?? '',
    uri: '',
    image: a.content?.links?.image ?? null,
    standard,
    collection: collection ? asPublicKey(collection) : null,
    owner: a.ownership?.owner ? asPublicKey(a.ownership.owner) : asPublicKey(a.id),
    creator: a.creators?.[0]?.address ? asPublicKey(a.creators[0].address) : null,
    attributes: attrs,
    compressed: a.compression?.compressed ?? false,
    frozen: a.ownership?.frozen ?? false,
  };
}

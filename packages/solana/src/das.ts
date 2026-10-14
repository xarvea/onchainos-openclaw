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
    /** Off-chain metadata JSON URI (the canonical `uri` field). */
    json_uri?: string;
    metadata?: { name?: string; description?: string; attributes?: { trait_type?: string; value?: string }[] };
    links?: { image?: string };
    files?: { uri?: string; cdn_uri?: string; mime?: string }[];
  };
  compression?: { compressed?: boolean };
  grouping?: { group_key: string; group_value: string }[];
  creators?: { address: string; verified: boolean; share?: number }[];
  ownership?: { owner?: string; frozen?: boolean };
  interface?: string;
  token_info?: { symbol?: string };
  /** Present on collection assets from DAS. */
  authorities?: { address: string; scopes: string[] }[];
  mutable?: boolean;
  burnt?: boolean;
}

export function dasInterfaceToStandard(iface?: string): AssetStandard {
  if (!iface) return 'token-metadata';
  if (iface.startsWith('MplCore')) return 'core';
  if (iface === 'ProgrammableNFT' || iface === 'V1_NFT') return 'token-metadata';
  if (iface === 'CompressedNFT' || iface.includes('Bubblegum')) return 'compressed';
  return 'token-metadata';
}

/**
 * Preferred image URL. DAS returns `links.image` but it is often a low-res
 * thumbnail; `files[].cdn_uri`/`files[].uri` holds the original. Prefer the
 * first image-mime file, then fall back to `links.image`.
 */
function pickImage(a: DasAsset): string | null {
  const imageFile = a.content?.files?.find((f) => (f.mime ?? '').startsWith('image/'));
  return imageFile?.cdn_uri ?? imageFile?.uri ?? a.content?.links?.image ?? null;
}

/**
 * Map a DAS asset onto the domain `Asset`.
 *
 * IMPORTANT: ownership is taken strictly from `ownership.owner`. We do NOT
 * invent an owner when DAS omits it — a marketplace that fabricates ownership
 * violates the "chain is the source of truth" rule (BLUEPRINT §3). Callers must
 * treat a missing owner as an unavailable/partial record.
 */
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
    uri: a.content?.json_uri ?? '',
    image: pickImage(a),
    standard,
    collection: collection ? asPublicKey(collection) : null,
    owner: asPublicKey(a.ownership?.owner ?? a.id),
    creator: a.creators?.[0]?.address ? asPublicKey(a.creators[0].address) : null,
    attributes: attrs,
    compressed: a.compression?.compressed ?? false,
    frozen: a.ownership?.frozen ?? false,
  };
}

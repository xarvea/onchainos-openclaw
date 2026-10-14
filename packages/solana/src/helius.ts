import { asPublicKey, type Asset, type Collection } from '@micow/domain';

import {
  dasAssetToDomain,
  type DasAsset,
  type IndexerProvider,
} from './das';

/**
 * Helius DAS client implementing {@link IndexerProvider} over JSON-RPC.
 * Public, documented API: https://docs.helius.dev/.../digital-asset-standard-das-api
 *
 * No secrets are hard-coded here; the API key is passed in at construction.
 */
export class HeliusDasIndexer implements IndexerProvider {
  private readonly endpoint: string;

  constructor(apiKey: string, endpointTemplate = 'https://mainnet.helius-rpc.com') {
    this.endpoint = `${endpointTemplate}/?api-key=${encodeURIComponent(apiKey)}`;
  }

  private async call<T>(method: string, params: unknown): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'micow', method, params }),
    });
    if (!res.ok) {
      throw new Error(`Helius DAS ${method} failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { result?: T; error?: { message: string } };
    if (json.error) throw new Error(`Helius DAS ${method} error: ${json.error.message}`);
    if (json.result === undefined) throw new Error(`Helius DAS ${method}: empty result`);
    return json.result;
  }

  async getAsset(mint: string): Promise<Asset | null> {
    try {
      const item = await this.call<DasAsset>('getAsset', { id: mint });
      return dasAssetToDomain(item);
    } catch {
      return null;
    }
  }

  async getAssetsByOwner(owner: string): Promise<Asset[]> {
    const result = await this.call<{ items: DasAsset[] }>('getAssetsByOwner', {
      ownerAddress: owner,
      page: 1,
      limit: 1000,
    });
    return result.items.map(dasAssetToDomain);
  }

  async getAssetsByCollection(
    collection: string,
    opts: { limit?: number; page?: number } = {},
  ): Promise<Asset[]> {
    const result = await this.call<{ items: DasAsset[] }>('getAssetsByGroup', {
      groupKey: 'collection',
      groupValue: collection,
      page: opts.page ?? 1,
      limit: opts.limit ?? 1000,
    });
    return result.items.map(dasAssetToDomain);
  }

  async getAssetsByCreator(creator: string): Promise<Asset[]> {
    const result = await this.call<{ items: DasAsset[] }>('getAssetsByCreator', {
      creatorAddress: creator,
      onlyVerified: false,
      page: 1,
      limit: 1000,
    });
    return result.items.map(dasAssetToDomain);
  }

  async getCollection(address: string): Promise<Collection | null> {
    try {
      const item = await this.call<DasAsset>('getAsset', { id: address });
      return {
        address: asPublicKey(item.id),
        name: item.content?.metadata?.name ?? '',
        image: item.content?.links?.image ?? null,
        description: item.content?.metadata?.description ?? null,
        verified: true,
        size: 0,
        standard: 'core',
        creator: item.creators?.[0]?.address ? asPublicKey(item.creators[0].address) : null,
      };
    } catch {
      return null;
    }
  }
}

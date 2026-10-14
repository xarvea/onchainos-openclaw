import { asPublicKey, type Asset, type Collection } from '@micow/domain';

import {
  dasAssetToDomain,
  dasInterfaceToStandard,
  type DasAsset,
  type IndexerProvider,
} from './das';

/** Hard cap per DAS page (Helius allows up to 1000). */
const MAX_PAGE_SIZE = 1000;
/** Safety valve so a mis-paginating endpoint can never loop forever. */
const MAX_PAGES = 100;

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

  /**
   * Fetch every page of a DAS query that returns `{ items }`. Without this,
   * wallets/collections larger than one page (1000) are silently truncated —
   * a correctness bug for portfolios and big collections.
   */
  private async callAllPages(method: string, baseParams: Record<string, unknown>): Promise<DasAsset[]> {
    const out: DasAsset[] = [];
    const limit = MAX_PAGE_SIZE;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await this.call<{ items?: DasAsset[] }>(method, {
        ...baseParams,
        page,
        limit,
      });
      const items = result.items ?? [];
      out.push(...items);
      if (items.length < limit) break; // last page
    }
    return out;
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
    const items = await this.callAllPages('getAssetsByOwner', { ownerAddress: owner });
    return items.map(dasAssetToDomain);
  }

  async getAssetsByCollection(
    collection: string,
    opts: { limit?: number; page?: number } = {},
  ): Promise<Asset[]> {
    // Explicit single-page request when the caller pins limit/page…
    if (opts.limit !== undefined || opts.page !== undefined) {
      const result = await this.call<{ items?: DasAsset[] }>('getAssetsByGroup', {
        groupKey: 'collection',
        groupValue: collection,
        page: opts.page ?? 1,
        limit: Math.min(opts.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
      });
      return (result.items ?? []).map(dasAssetToDomain);
    }
    // …otherwise transparently page through the whole collection.
    const items = await this.callAllPages('getAssetsByGroup', {
      groupKey: 'collection',
      groupValue: collection,
    });
    return items.map(dasAssetToDomain);
  }

  async getAssetsByCreator(creator: string): Promise<Asset[]> {
    const items = await this.callAllPages('getAssetsByCreator', {
      creatorAddress: creator,
      onlyVerified: false,
    });
    return items.map(dasAssetToDomain);
  }

  async getCollection(address: string): Promise<Collection | null> {
    try {
      const item = await this.call<DasAsset>('getAsset', { id: address });
      // `authorities` on a DAS collection asset indicate verified/managed status.
      // We surface what DAS actually reports — never a hardcoded `true`.
      const verified = (item.authorities?.length ?? 0) > 0;
      return {
        address: asPublicKey(item.id),
        name: item.content?.metadata?.name ?? '',
        image: item.content?.links?.image ?? null,
        description: item.content?.metadata?.description ?? null,
        verified,
        // DAS getAsset does not return collection size; a real count requires
        // getAssetsByGroup. 0 means "unknown here", filled in by the indexer.
        size: 0,
        standard: dasInterfaceToStandard(item.interface),
        creator: item.creators?.[0]?.address ? asPublicKey(item.creators[0].address) : null,
      };
    } catch {
      return null;
    }
  }
}

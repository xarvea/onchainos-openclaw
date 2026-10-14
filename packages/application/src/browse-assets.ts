import type { Asset } from '@micow/domain';

import type { AssetRepository, CollectionRepository } from './ports';

export interface BrowseDeps {
  assets: AssetRepository;
  collections: CollectionRepository;
}

export async function getPortfolio(deps: BrowseDeps, owner: string): Promise<Asset[]> {
  return deps.assets.findByOwner(owner);
}

export async function browseCollection(
  deps: BrowseDeps,
  collection: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Asset[]> {
  return deps.assets.findByCollection(collection, opts);
}

import { NextResponse, type NextRequest } from 'next/server';
import { base58Pubkey, paginationInput } from '@micow/validation';

import { listAssetsByCollection, listAssetsByOwner } from '@/lib/read-model';

/**
 * GET /api/assets?collection=<pubkey> | ?owner=<pubkey>  [&page&limit]
 *
 * Reads assets from the read model (Postgres). At least one of `collection` or
 * `owner` is required — an unfiltered dump of the table is not exposed.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const collection = sp.get('collection');
  const owner = sp.get('owner');

  if (!collection && !owner) {
    return NextResponse.json(
      { error: 'provide ?collection= or ?owner=' },
      { status: 400 },
    );
  }

  const target = collection ?? owner!;
  if (!base58Pubkey.safeParse(target).success) {
    return NextResponse.json({ error: 'invalid public key' }, { status: 400 });
  }

  const parsed = paginationInput.safeParse({
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid pagination' }, { status: 400 });
  }
  const { page, limit } = parsed.data;

  try {
    const { items, enabled } = collection
      ? await listAssetsByCollection(collection, { limit, offset: (page - 1) * limit })
      : await listAssetsByOwner(owner!);
    return NextResponse.json({ enabled, page, limit, count: items.length, items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'read model error' },
      { status: 500 },
    );
  }
}

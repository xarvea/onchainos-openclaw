import { NextResponse, type NextRequest } from 'next/server';
import type { Activity } from '@micow/domain';
import { base58Pubkey, paginationInput } from '@micow/validation';

import { listActivitiesByAsset, listRecentActivities } from '@/lib/read-model';

/**
 * JSON.stringify replacer: `Activity.price` (lamports) and `.slot` are bigints,
 * which JSON cannot represent natively. Emit them as **strings** to avoid
 * precision loss for values > 2^53 — clients parse them with BigInt().
 */
function jsonSafe(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function serialize(items: Activity[]) {
  return JSON.parse(JSON.stringify(items, jsonSafe));
}

/**
 * GET /api/activities [&asset=<pubkey>] [&page&limit]
 *
 * Recent on-chain activity from the read model. With `asset`, scopes to one
 * NFT; without it, returns the global feed. Returns { enabled:false } (not an
 * error) when no DATABASE_URL is configured.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const asset = sp.get('asset');

  if (asset && !base58Pubkey.safeParse(asset).success) {
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
    const { items, enabled } = asset
      ? await listActivitiesByAsset(asset, { limit })
      : await listRecentActivities({ limit, offset: (page - 1) * limit });
    return NextResponse.json({
      enabled,
      page,
      limit,
      count: items.length,
      items: serialize(items),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'read model error' },
      { status: 500 },
    );
  }
}

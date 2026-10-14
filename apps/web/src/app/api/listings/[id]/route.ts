import { NextResponse, type NextRequest } from 'next/server';

import { getListing } from '@/lib/listings';

/**
 * GET /api/listings/[id] — single listing from the read model.
 *
 * Returns 404 when the listing is unknown, 503 when the read model is disabled
 * (DATABASE_URL not configured) so a misconfigured deployment is obvious rather
 * than silently reporting "not found".
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const listing = await getListing(id);
    if (!listing) {
      return NextResponse.json({ error: 'listing not found' }, { status: 404 });
    }
    return NextResponse.json({ listing });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'read model error' },
      { status: 500 },
    );
  }
}

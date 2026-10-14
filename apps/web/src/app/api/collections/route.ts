import { NextResponse, type NextRequest } from 'next/server';
import { paginationInput } from '@micow/validation';

import { listCollections, readModelEnabled } from '@/lib/read-model';

/**
 * GET /api/collections — collections from the read model.
 * Returns { enabled:false } (not an error) when no DATABASE_URL is configured,
 * so the client can render a setup hint rather than an error state.
 */
export async function GET(req: NextRequest) {
  const parsed = paginationInput.safeParse({
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid pagination' }, { status: 400 });
  }
  const { page, limit } = parsed.data;

  try {
    const { items, enabled } = await listCollections({ limit, offset: (page - 1) * limit });
    return NextResponse.json({
      enabled: enabled && readModelEnabled(),
      page,
      limit,
      count: items.length,
      items,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'read model error' },
      { status: 500 },
    );
  }
}

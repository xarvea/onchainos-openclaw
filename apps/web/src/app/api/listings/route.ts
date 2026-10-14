import { createListingInput, paginationInput } from '@micow/validation';
import { asPublicKey } from '@micow/domain';
import { NextResponse, type NextRequest } from 'next/server';

import { createListing, listActiveListings, platformDelegate } from '@/lib/listings';

/**
 * GET /api/listings — active listings from the read model.
 * POST /api/listings — create a listing (non-custodial, ADR-0005 rev).
 *
 * A POST requires an authenticated seller. For the MVP the seller address is
 * taken from the request body and the returned transaction is **unsigned**; the
 * seller's wallet must sign it. We therefore do NOT trust the body to move
 * funds — the on-chain delegate grant is the real authorization. (A signature
 * challenge/verification is a hardening step tracked for a later milestone.)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const { items, enabled } = await listActiveListings({ limit, offset: (page - 1) * limit });
    return NextResponse.json({ enabled, page, limit, count: items.length, items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'read model error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  // `seller` is required by the use case but not part of the storage schema; it
  // is passed alongside the validated listing input.
  const sellerRaw = (body as { seller?: unknown })?.seller;
  if (typeof sellerRaw !== 'string') {
    return NextResponse.json({ error: 'seller is required' }, { status: 400 });
  }

  const parsed = createListingInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const delegate = platformDelegate();
  if (!delegate) {
    return NextResponse.json(
      { error: 'listing unavailable: PLATFORM_DELEGATE is not configured' },
      { status: 503 },
    );
  }

  try {
    const { listing, serializedTx } = await createListing({
      asset: asPublicKey(parsed.data.asset),
      seller: asPublicKey(sellerRaw),
      delegate: asPublicKey(delegate),
      priceLamports: parsed.data.priceLamports,
      royaltyBps: parsed.data.royaltyBps,
      expiresAt: parsed.data.expiresAt,
    });
    return NextResponse.json({ listing, serializedTx }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to create listing';
    const unavailable = message.includes('unavailable') || message.includes('not configured');
    return NextResponse.json({ error: message }, { status: unavailable ? 503 : 422 });
  }
}

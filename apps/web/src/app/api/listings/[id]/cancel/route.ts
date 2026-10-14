import { cancelListingInput } from '@micow/validation';
import { asPublicKey, InvariantViolation } from '@micow/domain';
import { NextResponse, type NextRequest } from 'next/server';

import { cancelListing, platformDelegate } from '@/lib/listings';

/** Map domain invariant codes to HTTP status (see BLUEPRINT §6). */
function statusForError(err: unknown): number {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('not found')) return 404;
  if (message.includes('unavailable') || message.includes('not configured')) return 503;
  if (err instanceof InvariantViolation) {
    // I4 — caller is not the seller (or listing is terminal) → conflict/forbidden.
    return err.code === 'I4' ? 403 : 409;
  }
  return 422;
}

/**
 * POST /api/listings/[id]/cancel — seller cancels an active listing (I4).
 *
 * Returns the **unsigned** revoke-transaction; the seller's wallet signs it.
 * The body must carry the `seller` address (must match the listing's seller —
 * enforced by the use case's `assertCanCancel`); we never trust it to move
 * funds, only to identify the caller.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = cancelListingInput.safeParse({ ...(body as object), listingId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sellerRaw = (body as { seller?: unknown })?.seller;
  if (typeof sellerRaw !== 'string') {
    return NextResponse.json({ error: 'seller is required' }, { status: 400 });
  }

  const delegate = platformDelegate();
  if (!delegate) {
    return NextResponse.json(
      { error: 'listing unavailable: PLATFORM_DELEGATE is not configured' },
      { status: 503 },
    );
  }

  try {
    const { listing, serializedTx } = await cancelListing({
      listingId: parsed.data.listingId,
      caller: asPublicKey(sellerRaw),
      delegate: asPublicKey(delegate),
    });
    return NextResponse.json({ listing, serializedTx });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to cancel listing' },
      { status: statusForError(err) },
    );
  }
}

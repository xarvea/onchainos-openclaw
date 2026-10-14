import { buyListingInput } from '@micow/validation';
import { asPublicKey, InvariantViolation } from '@micow/domain';
import { NextResponse, type NextRequest } from 'next/server';

import { buyListing, platformDelegate } from '@/lib/listings';

/** Map domain invariant codes to HTTP status (see BLUEPRINT §6). */
function statusForError(err: unknown): number {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('not found')) return 404;
  if (message.includes('unavailable') || message.includes('not configured')) return 503;
  if (message.includes('seller cannot buy')) return 409;
  if (err instanceof InvariantViolation) {
    // I6 — listing not ACTIVE or expired → conflict.
    return 409;
  }
  return 422;
}

/**
 * POST /api/listings/[id]/buy — buyer purchases an active listing (I6).
 *
 * Returns the **unsigned** transfer-transaction plus the deterministic fee
 * split (I5) so the client can display exactly where the money goes. The
 * buyer's wallet signs; the platform never custodies the asset or the funds.
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

  const parsed = buyListingInput.safeParse({ ...(body as object), listingId: id });
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
    const { listing, split, serializedTx } = await buyListing({
      listingId: parsed.data.listingId,
      buyer: asPublicKey(parsed.data.buyer),
      delegate: asPublicKey(delegate),
    });
    // bigints don't survive JSON.stringify — serialize the split as strings.
    return NextResponse.json({
      listing,
      split: {
        platformFee: split.platformFee.toString(),
        creatorRoyalty: split.creatorRoyalty.toString(),
        sellerProceeds: split.sellerProceeds.toString(),
      },
      serializedTx,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to buy listing' },
      { status: statusForError(err) },
    );
  }
}

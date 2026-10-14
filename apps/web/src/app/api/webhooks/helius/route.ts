import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';
import { mapHeliusWebhook } from '@micow/solana/helius-webhook';

import { recordActivities } from '@/lib/read-model';
import { serverEnv } from '@/lib/server-env';

/**
 * POST /api/webhooks/helius — ingest Helius enhanced transaction deliveries.
 *
 * Auth: Helius is configured with a shared secret sent either as
 * `Authorization: <secret>` or `?auth=<secret>` (both are supported because the
 * Helius dashboard offers both). We compare in constant time and **fail closed**
 * when no secret is configured — an unauthenticated write path into the read
 * model would let anyone forge marketplace history.
 *
 * Idempotency: activities are keyed by `{signature}:{mint}:{type}` and inserted
 * with ON CONFLICT DO NOTHING, so Helius retries and overlapping backfills are
 * safe no-ops. We return 200 on an empty-but-valid delivery so Helius does not
 * disable the webhook, and 500 on a genuine write failure so it *does* retry.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function extractSecret(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    // Accept both the raw secret and a "Bearer <secret>" form.
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    return bearer;
  }
  return req.nextUrl.searchParams.get('auth');
}

export async function POST(req: NextRequest) {
  let expected: string | undefined;
  try {
    expected = serverEnv().HELIUS_WEBHOOK_SECRET;
  } catch (err) {
    // Invalid/missing server config (e.g. DATABASE_URL) — fail closed, retryably.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'server not configured' },
      { status: 503 },
    );
  }

  if (!expected) {
    return NextResponse.json(
      { error: 'webhook not configured (HELIUS_WEBHOOK_SECRET unset)' },
      { status: 503 },
    );
  }

  const provided = extractSecret(req);
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  // Helius sends an array of transactions for enhanced webhooks, but a bare
  // object is accepted defensively (single-tx deliveries / manual replay).
  const transactions = Array.isArray(payload) ? payload : [payload];

  const activities = mapHeliusWebhook(transactions);
  if (activities.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0, recorded: false });
  }

  try {
    const recorded = await recordActivities(activities);
    if (!recorded) {
      return NextResponse.json(
        { error: 'read model unavailable (DATABASE_URL unset)' },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, accepted: activities.length, recorded: true });
  } catch (err) {
    // 500 → Helius retries. Do not swallow: a failed write must not look like success.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to record activities' },
      { status: 500 },
    );
  }
}

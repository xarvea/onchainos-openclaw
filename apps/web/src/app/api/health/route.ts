import { NextResponse } from 'next/server';

import { serverEnv } from '@/lib/server-env';

/** Health/readiness endpoint. Confirms server config parses and cluster is set. */
export async function GET() {
  try {
    const env = serverEnv();
    return NextResponse.json({
      ok: true,
      service: 'micow-web',
      cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? 'devnet',
      hasHelius: Boolean(env.HELIUS_API_KEY),
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'config error' },
      { status: 500 },
    );
  }
}

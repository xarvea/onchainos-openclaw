import { ImageResponse } from 'next/og';

/**
 * Shared Open Graph image renderer (1200×630) so every route produces a
 * consistent brand card. Uses only inline styles — `next/og` runs in a
 * constrained runtime and does not load the app's Tailwind CSS.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

export interface OgCardOptions {
  title: string;
  subtitle?: string;
  /** Small pill of text, e.g. "Collection" or a truncated address. */
  badge?: string;
}

export function ogCard({ title, subtitle, badge }: OgCardOptions): ImageResponse {
  const cleaned = (title ?? '').slice(0, 90);
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#07070a',
          backgroundImage:
            'radial-gradient(circle at 80% 0%, rgba(109,40,217,0.35), transparent 55%)',
          padding: '72px',
          color: '#ededf2',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#6d28d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            M
          </div>
          <span style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em' }}>MICOW</span>
          {badge ? (
            <span
              style={{
                marginLeft: '8px',
                fontSize: '20px',
                color: '#a1a1aa',
                border: '1px solid #27272a',
                borderRadius: '999px',
                padding: '6px 18px',
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '68px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
            {cleaned || 'MICOW'}
          </div>
          {subtitle ? (
            <div style={{ fontSize: '30px', color: '#a1a1aa' }}>{subtitle.slice(0, 140)}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', fontSize: '24px', color: '#a1a1aa' }}>
          Marketplace NFT di Solana — standar terbuka.
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

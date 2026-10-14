import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/lib/og';

export const alt = 'MICOW — Marketplace NFT di Solana';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Default Open Graph card for the site root. */
export default function OpengraphImage() {
  return ogCard({
    title: 'Marketplace NFT di Solana, dibangun dari standar terbuka.',
    subtitle: 'Mint murah · listing aman · royalti jujur',
    badge: 'micow',
  });
}

import type { Metadata } from 'next';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'MICOW — NFT Marketplace on Solana',
    template: '%s · MICOW',
  },
  description:
    'MICOW is a self-built NFT marketplace on Solana. Launch collections, list, and trade — built on open Metaplex standards.',
  openGraph: {
    title: 'MICOW — NFT Marketplace on Solana',
    description: 'Launch collections, list, and trade on Solana.',
    type: 'website',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micow.example'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

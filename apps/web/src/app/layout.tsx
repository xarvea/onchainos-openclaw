import type { Metadata } from 'next';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micow.example'),
  title: {
    default: 'MICOW — NFT Marketplace on Solana',
    template: '%s · MICOW',
  },
  description:
    'MICOW is a self-built NFT marketplace on Solana. Launch collections, list, and trade — built on open Metaplex standards.',
  applicationName: 'MICOW',
  keywords: ['Solana', 'NFT', 'marketplace', 'Metaplex', 'Core', 'Candy Machine', 'web3'],
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    siteName: 'MICOW',
    title: 'MICOW — NFT Marketplace on Solana',
    description: 'Launch collections, list, and trade on Solana.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MICOW — NFT Marketplace on Solana',
    description: 'Launch collections, list, and trade on Solana.',
  },
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

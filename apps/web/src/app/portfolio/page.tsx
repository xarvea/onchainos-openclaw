import type { Metadata } from 'next';

import { SiteHeader } from '@/components/site-header';
import { WalletPortfolio } from '@/components/wallet-portfolio';

export const metadata: Metadata = {
  title: 'Portofolio',
  description: 'NFT yang kamu miliki di MICOW.',
};

export default function PortfolioPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20">
        <h1 className="mt-6 text-2xl font-semibold">Portofolio</h1>
        <p className="mt-1 mb-8 text-sm text-[var(--micow-muted)]">
          Aset dimiliki dibaca dari read model berdasarkan wallet yang terhubung.
        </p>
        <WalletPortfolio />
      </main>
    </>
  );
}

import Link from 'next/link';

import { WalletButton } from '@/components/wallet-button';

/** Site header with nav + wallet connect. Used by all top-level pages. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
      <nav className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          MICOW
        </Link>
        <Link href="/explore" className="text-sm text-[var(--micow-muted)] hover:text-[var(--micow-fg)]">
          Jelajahi
        </Link>
        <Link
          href="/portfolio"
          className="text-sm text-[var(--micow-muted)] hover:text-[var(--micow-fg)]"
        >
          Portofolio
        </Link>
      </nav>
      <WalletButton />
    </header>
  );
}

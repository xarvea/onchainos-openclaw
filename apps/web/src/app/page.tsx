import { Button, Card } from '@micow/ui';
import Link from 'next/link';

import { WalletButton } from '@/components/wallet-button';

const FEATURES = [
  {
    title: 'Mint murah',
    body: 'Launch koleksi dengan Metaplex Core + Candy Machine v3 — biaya rendah, guard fleksibel.',
  },
  {
    title: 'Trading aman',
    body: 'Listing fixed-price dengan escrow on-chain standar terbuka. Non-custodial.',
  },
  {
    title: 'Royalty jelas',
    body: 'Royalti kreator transparan lewat plugin Core — bukan opsi tersembunyi.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">MICOW</span>
        <WalletButton />
      </header>

      <section className="mt-20 max-w-2xl">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Marketplace NFT di Solana, dibangun dari standar terbuka.
        </h1>
        <p className="mt-4 text-lg text-[var(--micow-muted)]">
          MICOW fokus pada hal-hal yang penting: mint murah, listing aman, dan royalti yang jujur.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/explore">
            <Button size="lg">Jelajahi koleksi</Button>
          </Link>
          <Link href="/create">
            <Button size="lg" variant="outline">
              Buat koleksi
            </Button>
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-6">
            <h2 className="text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-[var(--micow-muted)]">{f.body}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}

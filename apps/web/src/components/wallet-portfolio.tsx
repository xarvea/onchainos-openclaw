'use client';

import type { Asset } from '@micow/domain';
import { Card } from '@micow/ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';

import { AssetCard } from '@/components/asset-grid';
import { WalletButton } from '@/components/wallet-button';

interface AssetsResponse {
  enabled: boolean;
  items: Asset[];
}

/**
 * Portfolio view: when a wallet is connected, fetch its NFTs from the read
 * model via /api/assets?owner=<pubkey>. This demonstrates the end-to-end
 * wallet → server flow (the wallet only ever signs client-side; the server
 * just reads the indexer-fed read model by owner).
 */
export function WalletPortfolio() {
  const { publicKey, connected } = useWallet();
  const owner = publicKey?.toBase58();

  const { data, isLoading, error } = useQuery<AssetsResponse>({
    queryKey: ['assets', 'owner', owner],
    enabled: Boolean(owner),
    queryFn: async () => {
      const res = await fetch(`/api/assets?owner=${owner}`);
      if (!res.ok) throw new Error(`request failed: ${res.status}`);
      return (await res.json()) as AssetsResponse;
    },
  });

  if (!connected) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-[var(--micow-muted)]">
          Hubungkan wallet untuk melihat NFT yang kamu miliki.
        </p>
        <div className="mt-4 flex justify-center">
          <WalletButton />
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-[var(--micow-muted)]">Memuat aset…</p>;
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-red-400">
          Gagal memuat: {error instanceof Error ? error.message : 'unknown error'}
        </p>
      </Card>
    );
  }

  const items = data?.items ?? [];

  return (
    <div>
      <p className="mb-4 font-mono text-xs text-[var(--micow-muted)]">
        {owner?.slice(0, 6)}…{owner?.slice(-6)} · {items.length} aset
      </p>
      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-[var(--micow-muted)]">
            {data?.enabled
              ? 'Tidak ada aset untuk wallet ini di read model. Sync indexer (syncOwner) untuk mengisinya.'
              : 'Read model tidak aktif — set DATABASE_URL agar portofolio bisa dibaca.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((a) => (
            <AssetCard key={a.mint} asset={a} />
          ))}
        </div>
      )}
    </div>
  );
}

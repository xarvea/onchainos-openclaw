import type { Metadata } from 'next';

import { ActivityFeed } from '@/components/activity-feed';
import { EmptyState } from '@/components/asset-grid';
import { SiteHeader } from '@/components/site-header';
import { listRecentActivities } from '@/lib/read-model';

export const revalidate = 15;

export const metadata: Metadata = {
  title: 'Aktivitas',
  description: 'Feed aktivitas on-chain terbaru: mint, penjualan, transfer, dan listing di MICOW.',
  alternates: { canonical: '/activity' },
  openGraph: {
    title: 'Aktivitas · MICOW',
    description: 'Feed aktivitas on-chain terbaru: mint, penjualan, transfer, dan listing di MICOW.',
    url: '/activity',
  },
};

export default async function ActivityPage() {
  const { items: activities, enabled } = await listRecentActivities({ limit: 50 });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <div className="mt-6 mb-6">
          <h1 className="text-2xl font-semibold">Aktivitas</h1>
          <p className="mt-1 text-sm text-[var(--micow-muted)]">
            Feed on-chain terbaru — diisi otomatis oleh webhook Helius.
          </p>
        </div>

        {activities.length === 0 ? (
          <EmptyState
            enabled={enabled}
            hint="Belum ada aktivitas di read model. Webhook Helius akan mengisinya saat ada mint/penjualan/transfer."
          />
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </main>
    </>
  );
}

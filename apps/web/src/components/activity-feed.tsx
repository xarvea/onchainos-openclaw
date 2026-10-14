import { lamportsToSol, type Activity } from '@micow/domain';
import { Card } from '@micow/ui';
import Link from 'next/link';

/** Human labels + accent colours per activity type. */
const META: Record<string, { label: string; className: string }> = {
  MINT: { label: 'Mint', className: 'bg-emerald-500/10 text-emerald-400' },
  SALE: { label: 'Sale', className: 'bg-violet-500/10 text-violet-400' },
  LIST: { label: 'List', className: 'bg-amber-500/10 text-amber-400' },
  TRANSFER: { label: 'Transfer', className: 'bg-sky-500/10 text-sky-400' },
  CANCEL: { label: 'Cancel', className: 'bg-rose-500/10 text-rose-400' },
};

function short(pk: string): string {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

/** Trim trailing zeros from a SOL amount (1.5, not 1.500000000). */
function formatSol(sol: number): string {
  return String(Number(sol.toFixed(9)));
}

function when(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/** A compact row describing a single on-chain event from the read model. */
function ActivityRow({ activity }: { activity: Activity }) {
  const meta = META[activity.type] ?? {
    label: activity.type,
    className: 'bg-[#1c1c24] text-[var(--micow-muted)]',
  };
  return (
    <Card className="flex items-center justify-between gap-4 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.className}`}
        >
          {meta.label}
        </span>
        <div className="min-w-0">
          <Link
            href={`/collection/${activity.collection ?? activity.asset}`}
            className="block truncate font-mono text-xs text-[var(--micow-fg)] hover:text-[var(--micow-accent)]"
          >
            {short(activity.asset)}
          </Link>
          <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--micow-muted)]">
            {activity.from ? short(activity.from) : '—'} → {activity.to ? short(activity.to) : '—'}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {activity.price !== null && (
          <p className="text-sm font-medium">{formatSol(lamportsToSol(activity.price))} SOL</p>
        )}
        <p className="text-[10px] text-[var(--micow-muted)]">{when(activity.blockTime)}</p>
      </div>
    </Card>
  );
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="flex flex-col gap-2">
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </div>
  );
}

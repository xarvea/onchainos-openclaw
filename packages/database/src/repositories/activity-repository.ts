import type { Activity, ActivityRepository, ActivityType } from '@micow/application';
import { asLamports, asPublicKey } from '@micow/domain';
import { desc, eq } from 'drizzle-orm';

import type { Db } from '../index';
import { activities } from '../schema/index';

/** Drizzle-backed implementation of the application ActivityRepository port. */
export class DrizzleActivityRepository implements ActivityRepository {
  constructor(private readonly db: Db) {}

  async record(activity: Activity): Promise<void> {
    await this.recordMany([activity]);
  }

  /**
   * Batch idempotent insert. Conflicts on `id` are ignored (not updated): the
   * activity feed is append-only history, so a replay of the same event must be
   * a no-op rather than rewrite history. `DO NOTHING` also keeps the write cheap.
   */
  async recordMany(items: Activity[]): Promise<void> {
    if (items.length === 0) return;
    await this.db
      .insert(activities)
      .values(items.map(toRow))
      .onConflictDoNothing({ target: activities.id });
  }

  async listByAsset(
    asset: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<Activity[]> {
    const rows = await this.db
      .select()
      .from(activities)
      .where(eq(activities.asset, asset))
      .orderBy(desc(activities.blockTime))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
    return rows.map(toActivity);
  }

  async listByCollection(
    collection: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<Activity[]> {
    const rows = await this.db
      .select()
      .from(activities)
      .where(eq(activities.collection, collection))
      .orderBy(desc(activities.blockTime))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
    return rows.map(toActivity);
  }

  async listRecent(opts: { limit?: number; offset?: number } = {}): Promise<Activity[]> {
    const rows = await this.db
      .select()
      .from(activities)
      .orderBy(desc(activities.blockTime))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
    return rows.map(toActivity);
  }
}

type ActivityRow = typeof activities.$inferSelect;

function toRow(a: Activity) {
  return {
    id: a.id,
    type: a.type,
    asset: a.asset,
    collection: a.collection,
    from: a.from,
    to: a.to,
    price: a.price,
    txSignature: a.txSignature,
    blockTime: a.blockTime,
    slot: a.slot,
  };
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    type: row.type as ActivityType,
    asset: asPublicKey(row.asset),
    collection: row.collection ? asPublicKey(row.collection) : null,
    from: row.from ? asPublicKey(row.from) : null,
    to: row.to ? asPublicKey(row.to) : null,
    price: row.price !== null ? asLamports(row.price) : null,
    txSignature: row.txSignature as Activity['txSignature'],
    blockTime: row.blockTime,
    slot: row.slot,
  };
}

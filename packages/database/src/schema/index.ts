import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Read model tables. Every row here must be reproducible from on-chain data /
 * DAS — the database is NOT a source of truth for ownership or balances.
 */

export const collections = pgTable(
  'collections',
  {
    address: text('address').primaryKey(),
    name: text('name').notNull(),
    image: text('image'),
    description: text('description'),
    verified: boolean('verified').notNull().default(false),
    size: integer('size').notNull().default(0),
    standard: text('standard').notNull(), // core | token-metadata | compressed
    creator: text('creator'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('collections_creator_idx').on(t.creator)],
);

export const assets = pgTable(
  'assets',
  {
    mint: text('mint').primaryKey(),
    name: text('name').notNull(),
    uri: text('uri').notNull(),
    image: text('image'),
    standard: text('standard').notNull(),
    collection: text('collection'),
    owner: text('owner').notNull(),
    creator: text('creator'),
    attributes: jsonb('attributes').$type<{ traitType: string; value: string }[]>().default([]),
    compressed: boolean('compressed').notNull().default(false),
    frozen: boolean('frozen').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('assets_owner_idx').on(t.owner),
    index('assets_collection_idx').on(t.collection),
    index('assets_creator_idx').on(t.creator),
  ],
);

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    asset: text('asset').notNull(),
    seller: text('seller').notNull(),
    price: bigint('price', { mode: 'bigint' }).notNull(),
    platformFee: bigint('platform_fee', { mode: 'bigint' }).notNull(),
    creatorRoyalty: bigint('creator_royalty', { mode: 'bigint' }).notNull(),
    status: text('status').notNull().default('ACTIVE'),
    txSignature: text('tx_signature'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('listings_asset_status_idx').on(t.asset, t.status),
    index('listings_seller_idx').on(t.seller),
  ],
);

export const activities = pgTable(
  'activities',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    asset: text('asset').notNull(),
    collection: text('collection'),
    from: text('from'),
    to: text('to'),
    price: bigint('price', { mode: 'bigint' }),
    txSignature: text('tx_signature').notNull(),
    blockTime: timestamp('block_time', { withTimezone: true }).notNull(),
    slot: bigint('slot', { mode: 'bigint' }).notNull(),
  },
  (t) => [
    index('activities_asset_idx').on(t.asset),
    index('activities_collection_idx').on(t.collection),
    index('activities_blocktime_idx').on(t.blockTime),
  ],
);

/** Checkpoint + idempotency for the indexer (replayable backfill). */
export const syncJobs = pgTable('sync_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  cursor: text('cursor'),
  status: text('status').notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

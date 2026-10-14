import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql as rawSql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createContainer } from './container';
import * as schema from './schema/index';

/**
 * REAL Postgres integration test for the Drizzle repositories.
 *
 * Runs only when DATABASE_URL is set (skipped in CI without a DB / on machines
 * without Postgres). It applies the actual migration SQL into an isolated
 * throwaway schema, then exercises the repositories against real SQL — this
 * catches query/type bugs that the in-memory repos cannot (bigint handling,
 * jsonb, onConflictDoUpdate, uuid defaults, ordering).
 *
 * Run it locally:
 *   DATABASE_URL=postgres://micow:...@127.0.0.1:5432/micow pnpm test
 */

const DATABASE_URL = process.env.DATABASE_URL;
const suite = DATABASE_URL ? describe : describe.skip;

// Isolated schema so we never touch the app's public tables.
const SCHEMA = `micow_test_${Date.now().toString(36)}`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = join(__dirname, '..', 'migrations', '0000_sparkling_beyonder.sql');

suite('Drizzle repositories (real Postgres)', () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    // Pin search_path at the connection level (not via a one-off SET) so every
    // pooled connection resolves unqualified names inside our throwaway schema.
    const url = new URL(DATABASE_URL as string);
    url.searchParams.set('options', `-c search_path=${SCHEMA}`);
    client = postgres(url.toString(), { max: 2 });
    await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);

    // Apply the real migration SQL (split on drizzle's statement separator).
    const migration = readFileSync(MIGRATION_FILE, 'utf8');
    for (const stmt of migration.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) await client.unsafe(trimmed);
    }

    db = drizzle(client, { schema });
  }, 30_000);

  afterAll(async () => {
    if (client) {
      await client.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await client.end({ timeout: 5 });
    }
  });

  it('assets: upsert is idempotent and preserves bigint-free fields', async () => {
    const container = createContainer(db);
    const mint = 'So11111111111111111111111111111111111111112';
    const owner = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';

    await container.assets.upsert({
      mint: mint as never,
      name: 'Roundtrip #1',
      uri: 'https://arweave.net/one.json',
      image: 'https://cdn/one.png',
      standard: 'core',
      collection: null,
      owner: owner as never,
      creator: null,
      attributes: [{ traitType: 'Background', value: 'Blue' }],
      compressed: false,
      frozen: false,
    });
    // Second upsert with the same mint must UPDATE, not duplicate.
    await container.assets.upsert({
      mint: mint as never,
      name: 'Roundtrip #1 (updated)',
      uri: 'https://arweave.net/one.json',
      image: 'https://cdn/one.png',
      standard: 'core',
      collection: null,
      owner: owner as never,
      creator: null,
      attributes: [{ traitType: 'Background', value: 'Blue' }],
      compressed: false,
      frozen: false,
    });

    const found = await container.assets.findByMint(mint);
    expect(found?.name).toBe('Roundtrip #1 (updated)');
    expect(found?.attributes).toEqual([{ traitType: 'Background', value: 'Blue' }]);

    const byOwner = await container.assets.findByOwner(owner);
    expect(byOwner).toHaveLength(1); // no duplicate row
  });

  it('listings: bigint price round-trips and status updates', async () => {
    const container = createContainer(db);
    const asset = 'So11111111111111111111111111111111111111113';
    const seller = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
    const price = 1_500_000_000n; // 1.5 SOL in lamports — exceeds 2^31

    await container.listings.create({
      id: '11111111-1111-1111-1111-111111111111',
      asset: asset as never,
      seller: seller as never,
      price: price as never,
      platformFee: 30_000_000n as never,
      creatorRoyalty: 75_000_000n as never,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: null,
      txSignature: null,
    });

    const active = await container.listings.findActiveByAsset(asset);
    expect(active?.price).toBe(price); // bigint preserved exactly
    expect(active?.status).toBe('ACTIVE');

    await container.listings.updateStatus('11111111-1111-1111-1111-111111111111', 'CANCELLED');
    expect(await container.listings.findActiveByAsset(asset)).toBeNull();
  });

  it('raw smoke: the migration actually created all 5 tables', async () => {
    const res = await db.execute(
      rawSql`select tablename from pg_tables where schemaname = current_schema() order by tablename`,
    );
    const names = (res as unknown as { tablename: string }[]).map((r) => r.tablename);
    expect(names).toEqual(['activities', 'assets', 'collections', 'listings', 'sync_jobs']);
  });
});

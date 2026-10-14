import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index';

let client: ReturnType<typeof postgres> | null = null;

/**
 * Create a Postgres client + Drizzle instance. Call once per process.
 * Prefer a small `max` on serverless; raise for workers.
 */
export function createDb(databaseUrl: string, options: { max?: number } = {}) {
  const sql = postgres(databaseUrl, { max: options.max ?? 5 });
  client = sql;
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
  }
}

export * as schema from './schema/index';
export * from './repositories/index';
export * from './container';

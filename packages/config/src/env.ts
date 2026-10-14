import { z } from 'zod';

/**
 * Central, validated environment schema for the MICOW monorepo.
 *
 * Rules (enforced by convention + this schema):
 * - Server-only secrets (API keys, DB URLs) are read ONLY on the server.
 * - Anything prefixed with NEXT_PUBLIC_ is exposed to the browser — never put
 *   secrets there.
 * - Parse once at process start; fail fast on invalid config.
 */

/** Variables safe to expose to the browser (must be prefixed NEXT_PUBLIC_). */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SOLANA_CLUSTER: z
    .enum(['devnet', 'testnet', 'mainnet-beta'])
    .default('devnet'),
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  /** Canonical public origin, used for metadata/OG/sitemap absolute URLs. */
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),

  // Launch / mint economics exposed to the UI (safe — no secrets).
  NEXT_PUBLIC_ASSET_BASE_URI: z.string().url().optional(),
  NEXT_PUBLIC_MINT_PRICE_SOL: z.coerce.number().min(0).default(0.01),
  NEXT_PUBLIC_MINT_LIMIT_PER_WALLET: z.coerce.number().int().min(0).default(2),
  NEXT_PUBLIC_ROYALTY_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
  NEXT_PUBLIC_TREASURY_WALLET: z.string().optional(),
});

/** Variables that must NEVER reach the browser. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Cache / queue
  REDIS_URL: z.string().url().optional(),

  // Solana infrastructure
  HELIUS_API_KEY: z.string().min(1).optional(),
  HELIUS_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Launch / mint (Candy Machine v3 + Core) — server-only admin ops
  SOLANA_KEYPAIR_PATH: z.string().min(1).optional(),
  SOLANA_RPC_URL: z.string().url().optional(),
  IRYS_SECRET_KEY: z.string().min(1).optional(),
  IRYS_NODE_URL: z.string().url().optional(),

  // Object storage (asset caching)
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parse and validate server env. Throws with a readable message listing all
 * invalid/missing variables, so misconfiguration fails fast and loudly.
 */
export function parseServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }
  return result.data;
}

/** Parse client (public) env, used from Next.js. */
export function parseClientEnv(
  source: Record<string, string | undefined> = process.env,
): ClientEnv {
  const result = clientEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid client environment configuration:\n${issues}`);
  }
  return result.data;
}

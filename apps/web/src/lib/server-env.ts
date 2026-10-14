import { parseServerEnv, type ServerEnv } from '@micow/config';

/**
 * Server-only environment accessor. Throws on invalid/missing config.
 * Import ONLY from server components / route handlers.
 */
let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (!cached) cached = parseServerEnv();
  return cached;
}

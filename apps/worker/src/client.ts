import { Inngest } from 'inngest';

/**
 * Inngest client for MICOW background jobs (metadata sync, reconcile, backfill).
 * Inngest avoids needing a long-running worker on serverless hosts; swap to
 * BullMQ when self-hosting (see BLUEPRINT stack table).
 */
export const inngest = new Inngest({ id: 'micow-worker' });

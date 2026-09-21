/** Postgres client for harness only; API uses artifact. */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

let cached: ReturnType<typeof create> | null = null;

function create(url: string) {
  const client = postgres(url, {
    max: Number(process.env.PG_POOL_MAX ?? 8),
    idle_timeout: 20,
    connect_timeout: 15,
    // The harness bulk-inserts tens of thousands of rows; prepared statements
    // buy nothing there and interact badly with pgbouncer in transaction mode.
    prepare: false
  });
  return { client, db: drizzle(client, { schema }) };
}

/**
 * Lazily connects. Throws only when actually used without a DATABASE_URL, so
 * that importing harness modules for tests or `--help` never needs a database.
 */
export function getDb() {
  if (cached) return cached.db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The curation pipeline needs Postgres; the serving API does not. ' +
        'Copy .env.example to .env and fill it in.'
    );
  }
  cached = create(url);
  return cached.db;
}

export async function closeDb(): Promise<void> {
  if (!cached) return;
  await cached.client.end({ timeout: 5 });
  cached = null;
}

export type Db = ReturnType<typeof getDb>;
export { schema };

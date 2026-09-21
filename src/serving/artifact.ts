/**
 * The serving artifact.
 *
 * Opens the compiled SQLite file read-only and keeps it open for the process
 * lifetime. There is no connection pool, no socket, and no retry logic, because
 * there is no network involved: the file is baked into the container image and
 * the OS page cache holds the hot pages after the first few requests.
 *
 * This is the single most important property of the V2 design. "API is down"
 * was filed eleven times against V1 (#239, #234, #233, #232, #225, #216, #203,
 * #202, #201, #90, #88) and every instance traced to a runtime dependency
 * rather than to the code. A replica here has nothing to be down *to*.
 */

import { Database } from 'bun:sqlite';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface ArtifactMeta {
  schemaVersion: number;
  datasetVersion: string;
  builtAt: string;
  sourceVersions: Record<string, string>;
  path: string;
  bytes: number;
  /** Strong ETag for every response served from this artifact. */
  etag: string;
}

let db: Database | null = null;
let meta: ArtifactMeta | null = null;

/**
 * Locate the artifact.
 *
 * COUNTRIESNOW_ARTIFACT wins if set; otherwise the newest
 * `countriesnow-*.sqlite` under the artifact directory. Deployments pin the
 * path explicitly, so the directory scan is a development convenience.
 */
export function findArtifact(dir = join(process.cwd(), 'data', 'artifacts')): string | null {
  const explicit = process.env.COUNTRIESNOW_ARTIFACT;
  if (explicit) {
    const path = resolve(explicit);
    return existsSync(path) ? path : null;
  }

  if (!existsSync(dir)) return null;

  const candidates = readdirSync(dir)
    .filter((f) => f.startsWith('countriesnow-') && f.endsWith('.sqlite'))
    .map((f) => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return candidates[0]?.path ?? null;
}

export class ArtifactMissingError extends Error {
  constructor(searched: string) {
    super(
      `No serving artifact found (looked in ${searched}). ` +
        `Build one with: bun run harness:pull && bun run harness:resolve && bun run harness:publish`
    );
    this.name = 'ArtifactMissingError';
  }
}

export function openArtifact(path?: string): { db: Database; meta: ArtifactMeta } {
  if (db && meta) return { db, meta };

  const dir = join(process.cwd(), 'data', 'artifacts');
  const found = path ?? findArtifact(dir);
  if (!found) throw new ArtifactMissingError(process.env.COUNTRIESNOW_ARTIFACT ?? dir);

  // readonly plus a shared cache: several replicas may map the same file, and
  // nothing in the request path ever writes.
  const handle = new Database(found, { readonly: true });
  handle.exec('PRAGMA query_only = ON');
  handle.exec('PRAGMA cache_size = -64000'); // 64 MB of page cache
  handle.exec('PRAGMA mmap_size = 268435456'); // 256 MB memory-mapped
  handle.exec('PRAGMA temp_store = MEMORY');

  const rows = handle.query('SELECT key, value FROM meta').all() as Array<{
    key: string;
    value: string;
  }>;
  const kv = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const datasetVersion = kv.dataset_version ?? 'unknown';
  const bytes = statSync(found).size;

  db = handle;
  meta = {
    schemaVersion: Number(kv.schema_version ?? 0),
    datasetVersion,
    builtAt: kv.built_at ?? new Date().toISOString(),
    sourceVersions: kv.source_versions ? JSON.parse(kv.source_versions) : {},
    path: found,
    bytes,
    // Derived from the dataset version, so it is stable across replicas and
    // across restarts. A CDN can therefore treat any replica's response as
    // interchangeable, which is what makes the cache actually work.
    etag: `"${datasetVersion}"`
  };

  return { db, meta };
}

export function getDb(): Database {
  return openArtifact().db;
}

export function getMeta(): ArtifactMeta {
  return openArtifact().meta;
}

export function closeArtifact(): void {
  db?.close();
  db = null;
  meta = null;
}

/** True when an artifact is present. Used by the readiness probe. */
export function isReady(): boolean {
  try {
    openArtifact();
    return true;
  } catch {
    return false;
  }
}

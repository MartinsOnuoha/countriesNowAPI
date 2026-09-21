/** Read-only SQLite artifact for the request path; no network at runtime. */

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

/** COUNTRIESNOW_ARTIFACT or newest countriesnow-*.sqlite in data/artifacts. */
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
    // ETag = quoted dataset version (stable across replicas).
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

/**
 * Content-addressed snapshot store.
 *
 * Every upstream file we ever read is written to
 * `data/snapshots/<source>/<sha256>.<ext>` alongside a small JSON sidecar, and
 * an index maps (source, artifact) to the most recent hash.
 *
 * The reason is auditability. When the agent later says "Bulgaria's currency
 * changed because the SIX register published EUR on 2026-01-01", the exact
 * bytes it read are still on disk under their own hash and can be re-parsed.
 * V1 had the opposite property: its 33.7 MB of data files recorded no upstream,
 * no version, and no date, so nobody could tell a stale value from a chosen one.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { config, formatBytes, userAgent } from '../config.ts';
import type { Logger, Snapshot, SourceId } from '../types.ts';

export function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

interface IndexEntry {
  sha256: string;
  version: string;
  url: string;
  bytes: number;
  fetchedAt: string;
  file: string;
  meta?: Record<string, unknown>;
}

type SourceIndex = Record<string, IndexEntry>;

function indexPath(source: SourceId): string {
  return join(config.snapshotDir, source, 'index.json');
}

async function readIndex(source: SourceId): Promise<SourceIndex> {
  const path = indexPath(source);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, 'utf8')) as SourceIndex;
  } catch {
    return {};
  }
}

async function writeIndex(source: SourceId, index: SourceIndex): Promise<void> {
  await mkdir(join(config.snapshotDir, source), { recursive: true });
  await writeFile(indexPath(source), `${JSON.stringify(index, null, 2)}\n`);
}

export interface StoreOptions {
  source: SourceId;
  artifact: string;
  url: string;
  version?: string;
  meta?: Record<string, unknown>;
}

/** Write bytes into the store and update the index. Idempotent by hash. */
export async function store(bytes: Uint8Array, opts: StoreOptions): Promise<Snapshot> {
  const hash = sha256(bytes);
  const dir = join(config.snapshotDir, opts.source);
  await mkdir(dir, { recursive: true });

  const ext = extname(opts.artifact) || '.bin';
  const file = join(dir, `${hash}${ext}`);
  if (!existsSync(file)) await writeFile(file, bytes);

  const fetchedAt = new Date().toISOString();
  const version = opts.version ?? fetchedAt.slice(0, 10);

  const index = await readIndex(opts.source);
  index[opts.artifact] = {
    sha256: hash,
    version,
    url: opts.url,
    bytes: bytes.byteLength,
    fetchedAt,
    file,
    meta: opts.meta
  };
  await writeIndex(opts.source, index);

  return {
    source: opts.source,
    artifact: opts.artifact,
    version,
    url: opts.url,
    sha256: hash,
    bytes: bytes.byteLength,
    fetchedAt,
    path: file,
    meta: opts.meta
  };
}

/** Most recent snapshot for an artifact, or null if never fetched. */
export async function latest(source: SourceId, artifact: string): Promise<Snapshot | null> {
  const index = await readIndex(source);
  const entry = index[artifact];
  if (!entry || !existsSync(entry.file)) return null;
  return {
    source,
    artifact,
    version: entry.version,
    url: entry.url,
    sha256: entry.sha256,
    bytes: entry.bytes,
    fetchedAt: entry.fetchedAt,
    path: entry.file,
    meta: entry.meta
  };
}

/**
 * The snapshot immediately preceding the current one, found by scanning the
 * source directory for other hashes of the same extension. DETECT diffs these
 * two to find what changed upstream.
 */
export async function previous(source: SourceId, artifact: string): Promise<Snapshot | null> {
  const current = await latest(source, artifact);
  if (!current) return null;

  const dir = join(config.snapshotDir, source);
  if (!existsSync(dir)) return null;

  const ext = extname(artifact) || '.bin';
  const candidates: Array<{ file: string; mtime: number }> = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith(ext) || name === `${current.sha256}${ext}`) continue;
    const full = join(dir, name);
    candidates.push({ file: full, mtime: (await stat(full)).mtimeMs });
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.mtime - a.mtime);
  const prev = candidates[0]!;
  const bytes = (await stat(prev.file)).size;
  return {
    source,
    artifact,
    version: 'previous',
    url: current.url,
    sha256: prev.file.split('/').pop()!.replace(ext, ''),
    bytes,
    fetchedAt: new Date((await stat(prev.file)).mtimeMs).toISOString(),
    path: prev.file
  };
}

export async function readSnapshot(snap: Snapshot): Promise<Uint8Array> {
  return new Uint8Array(await readFile(snap.path));
}

export async function readSnapshotText(snap: Snapshot): Promise<string> {
  return readFile(snap.path, 'utf8');
}

export async function readSnapshotJson<T>(snap: Snapshot): Promise<T> {
  return JSON.parse(await readSnapshotText(snap)) as T;
}

/* -------------------------------------------------------------------------- */
/* Fetching                                                                    */
/* -------------------------------------------------------------------------- */

export interface FetchOptions extends StoreOptions {
  offline: boolean;
  log: Logger;
  /** Extra request headers, e.g. Accept for content negotiation. */
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Derive the upstream's own version marker from the response body. */
  versionFrom?: (body: Uint8Array, res: Response) => string | undefined;
}

/**
 * Fetch an upstream artifact into the store.
 *
 * In offline mode, or when the network fails and we already hold a copy, the
 * cached snapshot is returned instead. That keeps CI reproducible and means a
 * flaky upstream degrades the pipeline rather than breaking it — V1's
 * population endpoints, by contrast, fetched once at boot and stayed broken
 * until the dyno restarted if that single request failed.
 */
export async function fetchArtifact(opts: FetchOptions): Promise<Snapshot> {
  const cached = await latest(opts.source, opts.artifact);

  if (opts.offline) {
    if (!cached) {
      throw new Error(
        `offline: no cached snapshot for ${opts.source}/${opts.artifact}. ` +
          `Run \`bun run harness:pull\` with network access first.`
      );
    }
    opts.log.debug(`${opts.source}/${opts.artifact} — cached ${cached.sha256.slice(0, 12)}`);
    return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);

  try {
    const res = await fetch(opts.url, {
      headers: { 'user-agent': userAgent(), ...opts.headers },
      signal: controller.signal,
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const bytes = new Uint8Array(await res.arrayBuffer());
    const version = opts.versionFrom?.(bytes, res) ?? opts.version;

    const hash = sha256(bytes);
    if (cached?.sha256 === hash) {
      opts.log.debug(`${opts.source}/${opts.artifact} — unchanged (${formatBytes(bytes.length)})`);
      return cached;
    }

    const snap = await store(bytes, { ...opts, version });
    opts.log.info(
      `${opts.source}/${opts.artifact} — ${formatBytes(snap.bytes)} @ ${snap.version} ` +
        `(${snap.sha256.slice(0, 12)})`
    );
    return snap;
  } catch (err) {
    if (cached) {
      opts.log.warn(
        `${opts.source}/${opts.artifact} fetch failed (${(err as Error).message}); using cached copy`
      );
      return cached;
    }
    throw new Error(`${opts.source}/${opts.artifact}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

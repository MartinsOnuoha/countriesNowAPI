/**
 * Capture golden responses from the live V1 API.
 *
 *   bun run goldens:capture
 *
 * Writes one JSON file per case into tests/goldens/v1/. Those files are
 * committed: they are the record of what V1 actually returned, and the shim is
 * tested against them offline so CI never depends on V1 being up — which,
 * given eleven separate "API is down" issues, it frequently is not.
 *
 * Re-run this only when you intend to move the baseline, and read the diff.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GOLDEN_CASES } from './endpoints.ts';

const BASE = process.env.V1_BASE_URL ?? 'https://countriesnow.space/api/v0.1';
const OUT = join(import.meta.dir, 'v1');
const CONCURRENCY = 4;
const TIMEOUT_MS = 60_000;

export interface Golden {
  id: string;
  path: string;
  status: number;
  /** Parsed body. Stored parsed rather than raw so diffs are readable. */
  body: unknown;
  capturedAt: string;
  capturedFrom: string;
}

async function capture(id: string, path: string): Promise<Golden | null> {
  const url = `${BASE}${path}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        // V1 returns an HTML error page for some 5xx. Record it verbatim so the
        // golden still says "this endpoint was broken on this date".
        body = { __nonJson: text.slice(0, 2000) };
      }
      return {
        id,
        path,
        status: res.status,
        body,
        capturedAt: new Date().toISOString(),
        capturedFrom: BASE
      };
    } catch (err) {
      if (attempt === 3) {
        console.error(`  ✗ ${id}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
      await Bun.sleep(attempt * 2000);
    }
  }
  return null;
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  console.log(`Capturing ${GOLDEN_CASES.length} goldens from ${BASE}\n`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < GOLDEN_CASES.length; i += CONCURRENCY) {
    const batch = GOLDEN_CASES.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((c) => capture(c.id, c.path)));
    for (const g of results) {
      if (!g) {
        failed++;
        continue;
      }
      await writeFile(join(OUT, `${g.id}.json`), `${JSON.stringify(g, null, 2)}\n`);
      const size = JSON.stringify(g.body).length;
      console.log(`  ✓ ${g.id.padEnd(32)} ${String(g.status).padStart(3)}  ${fmt(size)}`);
      ok++;
    }
  }

  console.log(`\n${ok} captured, ${failed} failed → ${OUT}`);
  if (failed > 0) {
    console.log('\nFailures are usually V1 being down. Re-run; do not commit a partial set.');
    process.exit(1);
  }
}

const fmt = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

if (import.meta.main) await main();

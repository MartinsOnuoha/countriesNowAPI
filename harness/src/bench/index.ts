/**
 * Latency benchmark, wired as a blocking CI check.
 *
 * The point is not to produce an impressive number. It is to make a performance
 * regression fail a build the same way a data regression does. Serving from an
 * embedded artifact means p99 is measured in microseconds; if a change makes a
 * lookup do a table scan, that shows up here immediately instead of in
 * production.
 *
 * Thresholds are deliberately loose enough to survive a shared CI runner and
 * tight enough that a missing index cannot pass.
 */

import { getDb, getMeta } from '../../../src/serving/artifact.ts';
import { resolveCountry, resolvePlace, resolveSubdivision } from '../../../src/serving/resolve.ts';
import type { Logger } from '../types.ts';

export interface BenchCase {
  name: string;
  iterations: number;
  p50Us: number;
  p95Us: number;
  p99Us: number;
  maxUs: number;
  opsPerSec: number;
  /** Fails the build when exceeded. */
  budgetUs: number;
  passed: boolean;
}

export interface BenchmarkResult {
  datasetVersion: string;
  artifactBytes: number;
  ranAt: string;
  cases: BenchCase[];
  passed: boolean;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function measure(name: string, iterations: number, budgetUs: number, fn: () => void): BenchCase {
  // Warm up: the first calls pay for statement preparation and page faults, and
  // including them would measure startup rather than steady state.
  for (let i = 0; i < Math.min(200, iterations); i++) fn();

  const samples = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples[i] = (performance.now() - t0) * 1000;
  }

  const sorted = Array.from(samples).sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  return {
    name,
    iterations,
    p50Us: p50,
    p95Us: p95,
    p99Us: p99,
    maxUs: sorted[sorted.length - 1] ?? 0,
    opsPerSec: p50 > 0 ? Math.round(1_000_000 / p50) : 0,
    budgetUs,
    passed: p99 <= budgetUs
  };
}

export async function runBenchmark(log: Logger): Promise<BenchmarkResult> {
  const db = getDb();
  const meta = getMeta();

  log.step(`Benchmarking ${meta.datasetVersion} (${(meta.bytes / 1024 / 1024).toFixed(1)} MB)`);

  // Real inputs, including the ones that used to be bugs. Benchmarking only the
  // happy path would hide a regression in exactly the code that fixes #242 and
  // the Réunion accent case.
  const countryRefs = ['US', 'FRA', 'Nigeria', 'Réunion', 'Reunion', 'Ivory Coast', 'Türkiye'];
  const subRefs = ['FR-PAC', 'Lagos', 'California', 'Western Province'];
  const placeRefs = ['Marseille', 'Lagos', 'Tokyo', 'São Paulo'];

  let i = 0;
  const cases: BenchCase[] = [
    measure('resolve country by code or name', 20_000, 250, () => {
      resolveCountry(db, countryRefs[i++ % countryRefs.length]!);
    }),
    measure('resolve subdivision', 10_000, 400, () => {
      resolveSubdivision(db, subRefs[i++ % subRefs.length]!);
    }),
    measure('resolve place', 10_000, 500, () => {
      resolvePlace(db, placeRefs[i++ % placeRefs.length]!);
    }),
    measure('list all countries', 2_000, 25_000, () => {
      db.query('SELECT * FROM countries ORDER BY display_name').all();
    }),
    measure("list a country's subdivisions", 10_000, 1_500, () => {
      db.query('SELECT * FROM subdivisions WHERE country_iso2 = ? ORDER BY name').all('FR');
    }),
    measure("list a subdivision's cities", 10_000, 1_500, () => {
      db.query(
        'SELECT * FROM places WHERE subdivision_id = (SELECT id FROM subdivisions WHERE iso_3166_2 = ?) AND is_city = 1 ORDER BY population DESC LIMIT 100'
      ).all('FR-PAC');
    }),
    measure('paginated city page', 10_000, 1_500, () => {
      db.query(
        'SELECT * FROM places WHERE country_iso2 = ? AND is_city = 1 ORDER BY geonames_id LIMIT 50'
      ).all('US');
    })
  ];

  return {
    datasetVersion: meta.datasetVersion,
    artifactBytes: meta.bytes,
    ranAt: new Date().toISOString(),
    cases,
    passed: cases.every((c) => c.passed)
  };
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export function formatBenchmark(result: BenchmarkResult): string {
  const colour = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code: string, s: string) => (colour ? `${code}${s}${RESET}` : s);
  const us = (n: number) => (n < 1000 ? `${n.toFixed(1)}µs` : `${(n / 1000).toFixed(2)}ms`);

  const lines = [
    '',
    `Benchmark — dataset ${result.datasetVersion}, artifact ${(result.artifactBytes / 1024 / 1024).toFixed(1)} MB`,
    '',
    `  ${'case'.padEnd(34)} ${'p50'.padStart(9)} ${'p95'.padStart(9)} ${'p99'.padStart(9)} ${'ops/s'.padStart(10)}`,
    `  ${'-'.repeat(34)} ${'-'.repeat(9)} ${'-'.repeat(9)} ${'-'.repeat(9)} ${'-'.repeat(10)}`
  ];

  for (const b of result.cases) {
    const mark = b.passed ? c(GREEN, '✓') : c(RED, '✗');
    lines.push(
      `  ${mark} ${b.name.padEnd(32)} ${us(b.p50Us).padStart(9)} ${us(b.p95Us).padStart(9)} ` +
        `${us(b.p99Us).padStart(9)} ${b.opsPerSec.toLocaleString().padStart(10)}` +
        (b.passed ? '' : c(RED, `  over budget ${us(b.budgetUs)}`))
    );
  }

  lines.push(
    '',
    `  ${c(DIM, 'Budgets are p99. Numbers are in-process query time; add HTTP overhead for end-to-end.')}`,
    ''
  );

  return lines.join('\n');
}

import { resolve } from 'node:path';
import type { Logger } from './types.ts';

export const GEONAMES_TIERS = [
  'cities15000',
  'cities5000',
  'cities1000',
  'cities500',
  'allCountries'
] as const;
export type GeonamesTier = (typeof GEONAMES_TIERS)[number];

function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() || fallback;
}

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const dataDir = resolve(process.cwd(), env('DATA_DIR', 'data'));

export const config = {
  dataDir,
  snapshotDir: resolve(dataDir, 'snapshots'),
  artifactDir: resolve(dataDir, 'artifacts'),
  tmpDir: resolve(dataDir, 'tmp'),

  /**
   * cities15000 is 3 MB and enough to exercise every code path, so CI and local
   * development use it. Production releases set allCountries (400 MB).
   */
  geonamesTier: (env('GEONAMES_TIER', 'cities15000') as GeonamesTier) satisfies GeonamesTier,

  agent: {
    apiKey: env('HARNESS_API_KEY'),
    baseUrl: env('HARNESS_BASE_URL', 'https://openrouter.ai/api/v1'),
    hypothesisModel: env('HARNESS_HYPOTHESIS_MODEL', 'openai/gpt-4o-mini'),
    verifyModel: env('HARNESS_VERIFY_MODEL', 'anthropic/claude-sonnet-4.5'),
    minConfidence: num('HARNESS_MIN_CONFIDENCE', 0.6),
    /** Wikidata blocks anonymous SPARQL clients; this goes in the User-Agent. */
    contact: env('HARNESS_CONTACT', 'countriesnow@example.com'),
    maxCandidates: num('HARNESS_MAX_CANDIDATES', 40)
  },

  github: {
    token: env('GITHUB_TOKEN'),
    repository: env('GITHUB_REPOSITORY', 'MartinsOnuoha/countriesNowAPI')
  }
};

export function userAgent(): string {
  return `CountriesNow-Harness/2.0 (+https://countriesnow.space; ${config.agent.contact})`;
}

/** True when the agent stages can run. Everything else works without a key. */
export function agentEnabled(): boolean {
  return config.agent.apiKey.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Logger                                                                      */
/* -------------------------------------------------------------------------- */

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColour ? `${code}${s}${RESET}` : s);

/**
 * Progress output goes to stderr, always.
 *
 * stdout is reserved for the thing a caller might pipe — `harness detect
 * --json > anomalies.json`, `harness dataset-version` in a shell substitution.
 * Interleaving progress lines into that stream turns valid JSON into a parse
 * error, and the failure only shows up in CI.
 */
export function createLogger(verbose = false): Logger {
  const write = (line: string, ...rest: unknown[]) => console.error(line, ...rest);
  return {
    step: (msg) => write(`\n${c(CYAN, '›')} ${msg}`),
    info: (msg, ...rest) => write(`  ${msg}`, ...rest),
    warn: (msg, ...rest) => write(`  ${c(YELLOW, 'warn')} ${msg}`, ...rest),
    error: (msg, ...rest) => write(`  ${c(RED, 'error')} ${msg}`, ...rest),
    debug: (msg, ...rest) => {
      if (verbose) write(`  ${c(DIM, msg)}`, ...rest);
    }
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

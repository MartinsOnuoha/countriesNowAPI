/**
 * Shared vocabulary for the curation pipeline.
 *
 * The pipeline is five stages, and the boundary between them is data, not
 * function calls — every stage writes something a human can read and a later
 * run can replay:
 *
 *   PULL     upstream bytes            -> Snapshot (content-addressed on disk)
 *   RESOLVE  Snapshot[]                -> ResolvedDataset (+ per-field provenance)
 *   DETECT   ResolvedDataset           -> Anomaly[]
 *   PROPOSE  Anomaly[]                 -> Proposal[]  (the only LLM stage)
 *   GATE     ResolvedDataset + Patch   -> GateReport
 *
 * Only PROPOSE involves a model, and its output cannot become data without
 * clearing GATE and a human review.
 */

import type { EntityType } from '../../src/db/schema.ts';

export type { EntityType };

/* -------------------------------------------------------------------------- */
/* Sources                                                                     */
/* -------------------------------------------------------------------------- */

/** Stable identifiers for every upstream. Used as provenance strings. */
export const SOURCE_IDS = [
  'iso-codes',
  'country-codes',
  'geonames',
  'six-4217',
  'libphonenumber',
  'cldr',
  'flag-icons',
  'world-bank',
  'wikidata',
  // Not an upstream. Values this project decides itself — the Kosovo entry, and
  // anything else in harness/policy/. Recorded like any other source so a
  // hand-made decision is as traceable as a fetched one, and so "who says?"
  // never has the answer "nobody, it just appeared".
  'policy',
  // Quarantined: ODbL share-alike. Read by the QA lane only; never written to
  // published tables. See docs/ATTRIBUTION.md.
  'dr5hn',
  'mledoze'
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/** ODbL sources whose output may inform reconciliation but never publication. */
export const QUARANTINED_SOURCES: ReadonlySet<SourceId> = new Set<SourceId>(['dr5hn', 'mledoze']);

export interface SourceLicense {
  spdx: string;
  url: string;
  /** Attribution line required in docs/ATTRIBUTION.md and the API footer. */
  attribution: string;
  /** True for ODbL and friends: share-alike would propagate to our output. */
  shareAlike: boolean;
}

/**
 * A single fetched file, addressed by the SHA-256 of its bytes.
 *
 * Content addressing is what makes "the agent claimed X because source Y said
 * Z" checkable months later: the snapshot that produced the claim is still on
 * disk under its own hash, byte for byte.
 */
export interface Snapshot {
  source: SourceId;
  /** Logical name within the source, e.g. 'iso_3166-2.json'. */
  artifact: string;
  /** Upstream's own version marker where one exists, else the fetch date. */
  version: string;
  url: string;
  sha256: string;
  bytes: number;
  fetchedAt: string;
  /** Absolute path to the stored bytes. */
  path: string;
  meta?: Record<string, unknown>;
}

export interface FetchContext {
  /** Reuse a cached snapshot when the upstream ETag/content is unchanged. */
  offline: boolean;
  dataDir: string;
  log: Logger;
}

/**
 * Every upstream implements this. Adapters do exactly two things: fetch bytes
 * and parse them into normalised records. They never merge, never resolve
 * conflicts, and never decide precedence — that is the resolver's job, driven
 * by policy rather than by whichever adapter happened to run last.
 */
export interface SourceAdapter<T = unknown> {
  id: SourceId;
  title: string;
  license: SourceLicense;
  /** Human note on cadence, shown by `harness sources`. */
  cadence: string;
  fetch(ctx: FetchContext): Promise<Snapshot[]>;
  parse(snapshots: Snapshot[], ctx: FetchContext): Promise<T>;
}

/* -------------------------------------------------------------------------- */
/* Resolved dataset                                                            */
/* -------------------------------------------------------------------------- */

export interface CurrencyLink {
  code: string;
  isFund: boolean;
  isPrimary: boolean;
}

export interface NameRecord {
  locale: string;
  name: string;
  folded: string;
  kind:
    | 'iso-official'
    | 'cldr-display'
    | 'common'
    | 'short'
    | 'variant'
    | 'historical'
    | 'alias'
    | 'ascii';
  isPreferred: boolean;
  source: SourceId;
}

export interface ResolvedCountry {
  iso2: string;
  iso3: string | null;
  isoNumeric: string | null;
  geonamesId: number | null;
  wikidataQid: string | null;
  m49: string | null;

  isoOfficialName: string;
  displayName: string;
  commonName: string | null;

  isoStatus: string | null;
  /** False only for user-assigned codes we choose to emit, i.e. XK. */
  isoAssigned: boolean;
  independent: boolean | null;
  unMember: boolean | null;
  sovereigntyNote: string | null;
  administeredBy: string | null;

  capital: string | null;
  capitalGeonamesId: number | null;
  continentCode: string | null;
  region: string | null;
  subregion: string | null;
  tld: string | null;
  latitude: number | null;
  longitude: number | null;
  areaKm2: number | null;

  dialCode: string | null;
  dialRoot: string | null;
  dialSuffixes: string[] | null;

  primaryCurrency: string | null;
  currencies: CurrencyLink[];

  flagEmoji: string | null;
  flagSvgUrl: string | null;
  flagSvgSquareUrl: string | null;

  population: number | null;
  populationYear: number | null;

  names: NameRecord[];
}

export interface ResolvedSubdivision {
  countryIso2: string;
  iso3166_2: string | null;
  code: string;
  parentCode: string | null;
  level: number;
  type: string | null;
  name: string;
  displayName: string | null;
  geonamesId: number | null;
  geonamesAdmin1: string | null;
  wikidataQid: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  population: number | null;
  populationYear: number | null;
  names: NameRecord[];
}

export interface ResolvedPlace {
  geonamesId: number;
  countryIso2: string;
  subdivisionCode: string | null;
  parentGeonamesId: number | null;
  name: string;
  asciiName: string | null;
  featureClass: string;
  featureCode: string;
  /** Decided by harness/policy/places.ts, not by the adapter. */
  isCity: boolean;
  admin1Code: string | null;
  admin2Code: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  timezone: string | null;
  population: number | null;
  populationYear: number | null;
  names: NameRecord[];
}

export interface ResolvedCurrency {
  code: string;
  numericCode: string | null;
  name: string;
  minorUnits: number | null;
  symbol: string | null;
  isHistorical: boolean;
  withdrawnDate: string | null;
}

/** One row per (entity, field): where the value came from and how sure we are. */
export interface ProvenanceRecord {
  entityType: EntityType;
  entityRef: string;
  field: string;
  valueText: string | null;
  source: SourceId;
  sourceVersion: string | null;
  sourceUrl: string | null;
  retrievedAt: string;
  confidence: number;
}

export interface ResolvedDataset {
  version: string;
  builtAt: string;
  sourceVersions: Record<string, string>;
  countries: ResolvedCountry[];
  subdivisions: ResolvedSubdivision[];
  places: ResolvedPlace[];
  currencies: ResolvedCurrency[];
  provenance: ProvenanceRecord[];
  /** Non-fatal problems recorded during resolution, surfaced by DETECT. */
  notes: ResolveNote[];
}

export interface ResolveNote {
  level: 'info' | 'warn' | 'error';
  source: SourceId | 'resolver';
  message: string;
  entityRef?: string;
}

/* -------------------------------------------------------------------------- */
/* Detect / propose                                                            */
/* -------------------------------------------------------------------------- */

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Anomaly {
  fingerprint: string;
  kind: string;
  entityType: EntityType;
  entityRef: string;
  field: string | null;
  severity: AnomalySeverity;
  summary: string;
  observed: unknown;
  expected: unknown;
  /** Raw values keyed by source, so the model sees the disagreement verbatim. */
  sources: Record<string, unknown>;
}

/** RFC 6902 operation, restricted to what the resolver knows how to apply. */
export interface PatchOp {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?: unknown;
}

export interface EvidenceItem {
  source: string;
  url: string;
  /** The exact text or value that supports (or undercuts) the claim. */
  excerpt: string;
  retrievedAt: string;
}

export interface Proposal {
  anomalyFingerprint: string;
  /** The falsifiable statement VERIFY is asked to knock down. */
  claim: string;
  rationale: string;
  patch: PatchOp[];
  evidence: EvidenceItem[];
  verdict?: 'upheld' | 'refuted' | 'inconclusive';
  refutation?: string;
  confidence?: number;
  hypothesisModel?: string;
  verifyModel?: string;
  /**
   * How the candidate dataset scored once the patch was applied. A reviewer
   * seeing "31/31" knows the change survived every rule derived from a bug the
   * project has already been bitten by.
   */
  gatesPassed?: number;
  gatesRun?: number;
}

/* -------------------------------------------------------------------------- */
/* Gates                                                                       */
/* -------------------------------------------------------------------------- */

export interface InvariantContext {
  dataset: ResolvedDataset;
  byIso2: Map<string, ResolvedCountry>;
}

export interface InvariantViolation {
  entityRef?: string;
  detail: string;
}

/**
 * A rule that must hold for any publishable dataset.
 *
 * Most of these encode a specific bug from V1's tracker, cited in `issue`.
 * Once a rule is here the bug cannot come back without failing CI, which is the
 * difference between fixing data and fixing a process.
 */
export interface Invariant {
  id: string;
  title: string;
  severity: 'error' | 'warn';
  /** GitHub issue this rule retires, where there is one. */
  issue?: string;
  check(ctx: InvariantContext): InvariantViolation[] | Promise<InvariantViolation[]>;
}

export interface GateResult {
  id: string;
  title: string;
  severity: 'error' | 'warn';
  issue?: string;
  passed: boolean;
  violations: InvariantViolation[];
  durationMs: number;
}

export interface GateReport {
  datasetVersion: string;
  ranAt: string;
  passed: boolean;
  errors: number;
  warnings: number;
  results: GateResult[];
}

/* -------------------------------------------------------------------------- */
/* Logging                                                                     */
/* -------------------------------------------------------------------------- */

export interface Logger {
  info(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
  debug(msg: string, ...rest: unknown[]): void;
  step(msg: string): void;
}

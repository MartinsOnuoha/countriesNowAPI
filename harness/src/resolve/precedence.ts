/**
 * Loads harness/policy/precedence.yaml and turns it into the small API the
 * resolver actually needs.
 *
 * Keeping precedence in data rather than in code is the point: changing which
 * source wins for a field is a one-line diff that a reviewer can read, not an
 * archaeology exercise across adapter files.
 */

import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { parse } from 'yaml';
import type { ProvenanceRecord, SourceId } from '../types.ts';
import { QUARANTINED_SOURCES } from '../types.ts';
import type { EntityType } from '../../../src/db/schema.ts';

interface FieldRule {
  sources: SourceId[];
  crosscheck?: SourceId[];
  exclude?: SourceId[];
}

interface PolicyFile {
  version: number;
  quarantined: SourceId[];
  country: Record<string, FieldRule>;
  subdivision: Record<string, FieldRule>;
  place: Record<string, FieldRule>;
  currency: Record<string, FieldRule>;
  names: Record<string, { sources: SourceId[] }>;
}

const POLICY_PATH = resolvePath(process.cwd(), 'harness/policy/precedence.yaml');

let cached: PolicyFile | null = null;

export function loadPolicy(): PolicyFile {
  if (cached) return cached;
  cached = parse(readFileSync(POLICY_PATH, 'utf8')) as PolicyFile;
  return cached;
}

/** Rule for a field, falling back to the entity's `'*'` wildcard. */
export function ruleFor(entity: EntityType, field: string): FieldRule | null {
  const policy = loadPolicy();
  const section = policy[entity] as Record<string, FieldRule> | undefined;
  if (!section) return null;
  return section[field] ?? section['*'] ?? null;
}

export interface Candidate<T> {
  source: SourceId;
  value: T | null | undefined;
  sourceVersion?: string;
  sourceUrl?: string;
}

export interface PickResult<T> {
  value: T | null;
  source: SourceId | null;
  /** Sources that held a different value and are flagged for cross-checking. */
  conflicts: Array<{ source: SourceId; value: T }>;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * Choose a value for one field.
 *
 * Walks the precedence chain and takes the first source that actually has a
 * value. Anything from a quarantined (ODbL) source or an explicit `exclude` is
 * dropped outright rather than used as a late fallback — a share-alike value
 * must not reach the output even when nothing better exists.
 *
 * Disagreements are returned rather than resolved. DETECT turns them into
 * anomalies, which is how a stale value like GeoNames' BGN for Bulgaria becomes
 * a visible question instead of a silent overwrite.
 */
export function pick<T>(
  entity: EntityType,
  field: string,
  candidates: Array<Candidate<T>>
): PickResult<T> {
  const rule = ruleFor(entity, field);
  const chain = rule?.sources ?? [];
  const excluded = new Set<SourceId>(rule?.exclude ?? []);
  const crosscheck = new Set<SourceId>(rule?.crosscheck ?? []);

  const usable = candidates.filter(
    (c) => !isEmpty(c.value) && !excluded.has(c.source) && !QUARANTINED_SOURCES.has(c.source)
  );

  let chosen: Candidate<T> | null = null;
  for (const source of chain) {
    const hit = usable.find((c) => c.source === source);
    if (hit) {
      chosen = hit;
      break;
    }
  }

  // No rule matched but exactly one source has an opinion: take it rather than
  // dropping data on the floor. This keeps the policy file from having to
  // enumerate every incidental field.
  if (!chosen && chain.length === 0 && usable.length > 0) chosen = usable[0]!;

  if (!chosen) return { value: null, source: null, conflicts: [] };

  const conflicts = candidates
    .filter(
      (c) =>
        c.source !== chosen!.source &&
        !isEmpty(c.value) &&
        (crosscheck.has(c.source) || excluded.has(c.source) || chain.includes(c.source)) &&
        !sameValue(c.value, chosen!.value)
    )
    .map((c) => ({ source: c.source, value: c.value as T }));

  return { value: chosen.value as T, source: chosen.source, conflicts };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Build the provenance row that must accompany every picked value. */
export function provenanceFor(
  entityType: EntityType,
  entityRef: string,
  field: string,
  result: PickResult<unknown>,
  meta: { sourceVersion?: string; sourceUrl?: string; retrievedAt: string }
): ProvenanceRecord | null {
  if (!result.source) return null;
  return {
    entityType,
    entityRef,
    field,
    valueText: result.value === null ? null : String(result.value),
    source: result.source,
    sourceVersion: meta.sourceVersion ?? null,
    sourceUrl: meta.sourceUrl ?? null,
    retrievedAt: meta.retrievedAt,
    // A contested field is still published, but at reduced confidence, so the
    // agent knows where to look first.
    confidence: result.conflicts.length > 0 ? 0.75 : 1
  };
}

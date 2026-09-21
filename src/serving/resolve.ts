/** Single name/code resolver; 409 on ambiguity, 404 on miss. */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import { classifyRef, fold, foldTight } from './normalize.ts';
import { ENTITY_COUNTRY, ENTITY_PLACE, ENTITY_SUBDIVISION } from './constants.ts';

export interface CountryRow {
  iso2: string;
  iso3: string | null;
  iso_numeric: string | null;
  m49: string | null;
  geonames_id: number | null;
  wikidata_qid: string | null;
  iso_official_name: string;
  display_name: string;
  common_name: string | null;
  iso_status: string | null;
  iso_assigned: number;
  independent: number | null;
  un_member: number | null;
  sovereignty_note: string | null;
  capital: string | null;
  continent_code: string | null;
  region: string | null;
  subregion: string | null;
  tld: string | null;
  area_km2: number | null;
  latitude: number | null;
  longitude: number | null;
  dial_code: string | null;
  dial_root: string | null;
  dial_suffixes: string | null;
  primary_currency: string | null;
  currencies: string | null;
  flag_emoji: string | null;
  flag_svg_url: string | null;
  flag_svg_square_url: string | null;
  population: number | null;
  population_year: number | null;
}

export interface SubdivisionRow {
  id: number;
  country_iso2: string;
  iso_3166_2: string | null;
  code: string;
  parent_code: string | null;
  level: number;
  type: string | null;
  name: string;
  display_name: string | null;
  geonames_id: number | null;
  geonames_admin1: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  population: number | null;
}

export interface PlaceRow {
  geonames_id: number;
  country_iso2: string;
  subdivision_id: number | null;
  parent_place_id: number | null;
  name: string;
  ascii_name: string | null;
  feature_class: string;
  feature_code: string;
  is_city: number;
  admin1_code: string | null;
  admin2_code: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  timezone: string | null;
  population: number | null;
  population_year: number | null;
}

export interface Candidate {
  key: string;
  label: string;
  hint: string;
}

export type Resolution<T> =
  | { ok: true; value: T; matchedOn: 'code' | 'name' | 'alias' | 'id' }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'ambiguous'; candidates: Candidate[] };

/** Thrown by route handlers; the error mapper turns it into 404 or 409. */
export class ResolutionError extends Error {
  constructor(
    readonly status: 404 | 409,
    readonly detail: string,
    readonly candidates?: Candidate[]
  ) {
    super(detail);
    this.name = 'ResolutionError';
  }
}

/* -------------------------------------------------------------------------- */
/* Countries                                                                   */
/* -------------------------------------------------------------------------- */

export function resolveCountry(db: Database, ref: string): Resolution<CountryRow> {
  const trimmed = ref?.trim() ?? '';
  if (!trimmed) return { ok: false, reason: 'not-found' };

  const kind = classifyRef(trimmed);

  if (kind === 'iso2') {
    const row = db
      .query('SELECT * FROM countries WHERE iso2 = ?')
      .get(trimmed.toUpperCase()) as CountryRow | null;
    if (row) return { ok: true, value: row, matchedOn: 'code' };
  }

  if (kind === 'iso3') {
    const row = db
      .query('SELECT * FROM countries WHERE iso3 = ?')
      .get(trimmed.toUpperCase()) as CountryRow | null;
    if (row) return { ok: true, value: row, matchedOn: 'code' };
  }

  if (kind === 'geonames') {
    const row = db
      .query('SELECT * FROM countries WHERE geonames_id = ?')
      .get(Number(trimmed)) as CountryRow | null;
    if (row) return { ok: true, value: row, matchedOn: 'id' };
  }

  // Still try name lookup for code-shaped refs (e.g. aliases).
  return resolveByName<CountryRow>(db, ENTITY_COUNTRY, trimmed, (keys) =>
    db
      .query(`SELECT * FROM countries WHERE iso2 IN (${keys.map(() => '?').join(',')})`)
      .all(...keys) as CountryRow[],
    (row) => ({ key: row.iso2, label: row.display_name, hint: `${row.iso2} · ${row.region ?? ''}`.trim() })
  );
}

/* -------------------------------------------------------------------------- */
/* Subdivisions                                                                */
/* -------------------------------------------------------------------------- */

export function resolveSubdivision(
  db: Database,
  ref: string,
  countryIso2?: string
): Resolution<SubdivisionRow> {
  const trimmed = ref?.trim() ?? '';
  if (!trimmed) return { ok: false, reason: 'not-found' };

  // Full ISO 3166-2 code, e.g. "FR-PAC".
  if (/^[A-Za-z]{2}-[A-Za-z0-9]{1,3}$/.test(trimmed)) {
    const row = db
      .query('SELECT * FROM subdivisions WHERE iso_3166_2 = ?')
      .get(trimmed.toUpperCase()) as SubdivisionRow | null;
    if (row) return { ok: true, value: row, matchedOn: 'code' };
  }

  // Local code within a known country, e.g. "PAC" given FR.
  if (countryIso2) {
    const row = db
      .query('SELECT * FROM subdivisions WHERE country_iso2 = ? AND code = ?')
      .get(countryIso2.toUpperCase(), trimmed.toUpperCase()) as SubdivisionRow | null;
    if (row) return { ok: true, value: row, matchedOn: 'code' };
  }

  return resolveByName<SubdivisionRow>(
    db,
    ENTITY_SUBDIVISION,
    trimmed,
    (keys) => {
      const ids = keys.map(Number).filter(Number.isFinite);
      if (ids.length === 0) return [];
      const params: SQLQueryBindings[] = [...ids];
      let sql = `SELECT * FROM subdivisions WHERE id IN (${ids.map(() => '?').join(',')})`;
      // Optional country scope disambiguates subdivision names.
      if (countryIso2) {
        sql += ' AND country_iso2 = ?';
        params.push(countryIso2.toUpperCase());
      }
      return db.query(sql).all(...params) as SubdivisionRow[];
    },
    (row) => ({
      key: row.iso_3166_2 ?? `${row.country_iso2}-${row.code}`,
      label: row.name,
      hint: `${row.country_iso2} · ${row.type ?? 'subdivision'}`
    })
  );
}

/* -------------------------------------------------------------------------- */
/* Places                                                                      */
/* -------------------------------------------------------------------------- */

export function resolvePlace(
  db: Database,
  ref: string,
  scope?: { countryIso2?: string; subdivisionId?: number }
): Resolution<PlaceRow> {
  const trimmed = ref?.trim() ?? '';
  if (!trimmed) return { ok: false, reason: 'not-found' };

  if (/^\d+$/.test(trimmed)) {
    const row = db
      .query('SELECT * FROM places WHERE geonames_id = ?')
      .get(Number(trimmed)) as PlaceRow | null;
    if (row) return { ok: true, value: row, matchedOn: 'id' };
  }

  return resolveByName<PlaceRow>(
    db,
    ENTITY_PLACE,
    trimmed,
    (keys) => {
      const ids = keys.map(Number).filter(Number.isFinite);
      if (ids.length === 0) return [];
      const params: SQLQueryBindings[] = [...ids];
      let sql = `SELECT * FROM places WHERE geonames_id IN (${ids.map(() => '?').join(',')})`;
      if (scope?.countryIso2) {
        sql += ' AND country_iso2 = ?';
        params.push(scope.countryIso2.toUpperCase());
      }
      if (scope?.subdivisionId !== undefined) {
        sql += ' AND subdivision_id = ?';
        params.push(scope.subdivisionId);
      }
      // Cities outrank neighbourhoods, then bigger outranks smaller. Without
      // this, "Marseille" could resolve to an arrondissement.
      sql += ' ORDER BY is_city DESC, population DESC NULLS LAST';
      return db.query(sql).all(...params) as PlaceRow[];
    },
    (row) => ({
      key: String(row.geonames_id),
      label: row.name,
      hint: `${row.country_iso2} · ${row.feature_code}${row.population ? ` · pop ${row.population.toLocaleString()}` : ''}`
    }),
    pickDominantPlace
  );
}

const DOMINANCE_RATIO = 10;

/** pickDominantPlace: one clear city or 10× population gap; else ambiguous. */
function pickDominantPlace(rows: PlaceRow[]): PlaceRow | null {
  const cities = rows.filter((r) => r.is_city === 1);
  if (cities.length === 0) return null;
  if (cities.length === 1) return cities[0]!;

  const [first, second] = cities as [PlaceRow, PlaceRow];
  const top = first.population ?? 0;
  const next = second.population ?? 0;
  if (top > 0 && top >= next * DOMINANCE_RATIO) return first;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Shared name resolution                                                      */
/* -------------------------------------------------------------------------- */

function resolveByName<T>(
  db: Database,
  entityType: number,
  ref: string,
  load: (keys: string[]) => T[],
  describe: (row: T) => Candidate,
  /**
   * Optional tie-break. Returning a row means "these candidates have an
   * unambiguous intended answer"; returning null keeps the 409.
   */
  pickDominant?: (rows: T[]) => T | null
): Resolution<T> {
  const folded = fold(ref);
  if (!folded) return { ok: false, reason: 'not-found' };

  let keys = distinctKeys(
    db
      .query('SELECT DISTINCT entity_key FROM names WHERE entity_type = ? AND folded = ?')
      .all(entityType, folded) as Array<{ entity_key: string }>
  );

  // Punctuation-insensitive pass. Only consulted on a miss, because it is more
  // collision-prone: "St Kitts" and "StKitts" should agree, but forcing that
  // equivalence first would let unrelated names collide.
  if (keys.length === 0) {
    keys = distinctKeys(
      db
        .query('SELECT DISTINCT entity_key FROM names WHERE entity_type = ? AND folded_tight = ?')
        .all(entityType, foldTight(ref)) as Array<{ entity_key: string }>
    );
  }

  if (keys.length === 0) return { ok: false, reason: 'not-found' };

  const rows = load(keys);
  if (rows.length === 0) return { ok: false, reason: 'not-found' };
  if (rows.length === 1) return { ok: true, value: rows[0]!, matchedOn: 'name' };

  const dominant = pickDominant?.(rows);
  if (dominant) return { ok: true, value: dominant, matchedOn: 'name' };

  return { ok: false, reason: 'ambiguous', candidates: rows.map(describe) };
}

function distinctKeys(rows: Array<{ entity_key: string }>): string[] {
  return [...new Set(rows.map((r) => r.entity_key))];
}

/* -------------------------------------------------------------------------- */
/* Route helper                                                                */
/* -------------------------------------------------------------------------- */

/** "city" -> "cities", "country" -> "countries", "subdivision" -> "subdivisions". */
function plural(word: string): string {
  return /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`;
}

/** Unwrap a resolution or throw the right HTTP error. */
export function unwrap<T>(resolution: Resolution<T>, what: string, ref: string): T {
  if (resolution.ok) return resolution.value;

  if (resolution.reason === 'ambiguous') {
    throw new ResolutionError(
      409,
      `"${ref}" matches ${resolution.candidates.length} ${plural(what)}. Use a code or an exact name.`,
      resolution.candidates
    );
  }

  throw new ResolutionError(404, `No ${what} matches "${ref}".`);
}

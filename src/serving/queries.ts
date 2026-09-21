/**
 * Read queries and response shaping.
 *
 * Every list endpoint is paginated and every response supports sparse
 * fieldsets. Both are reactions to V1: `/population/cities` returns 1.86 MB in
 * one unbounded array, and issue #121 asked for GraphQL essentially because
 * there was no way to ask for less than everything.
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import { ENTITY_COUNTRY, ENTITY_PLACE, ENTITY_SUBDIVISION } from './constants.ts';
import type { CountryRow, PlaceRow, SubdivisionRow } from './resolve.ts';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;

export interface Page<T> {
  data: T[];
  /** Opaque cursor for the next page, or null at the end. */
  nextCursor: string | null;
  total: number;
}

/**
 * Cursors are keyset, not offset.
 *
 * OFFSET makes page N cost O(N) and, worse, silently skips or repeats rows when
 * the underlying set changes. Our data is immutable per release, so the second
 * problem does not bite — but the first does, and encoding the last key keeps
 * every page the same cost.
 */
/**
 * A tag so a cursor is recognisably ours. Base64url decoding almost never
 * throws — arbitrary text decodes to arbitrary bytes — so without a marker a
 * typo'd cursor is indistinguishable from a valid key and the caller silently
 * gets the wrong page. Failing loudly is the whole point.
 */
const CURSOR_PREFIX = 'cn1:';

export class InvalidCursorError extends Error {
  constructor(readonly cursor: string) {
    super(`"${cursor}" is not a valid cursor. Use the nextCursor from a previous page.`);
    this.name = 'InvalidCursorError';
  }
}

export function encodeCursor(value: string | number): string {
  return Buffer.from(`${CURSOR_PREFIX}${value}`).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new InvalidCursorError(cursor);
  }

  if (!decoded.startsWith(CURSOR_PREFIX)) throw new InvalidCursorError(cursor);
  return decoded.slice(CURSOR_PREFIX.length);
}

export function clampLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(raw)));
}

/* -------------------------------------------------------------------------- */
/* Shaping                                                                     */
/* -------------------------------------------------------------------------- */

export interface Country {
  iso2: string;
  iso3: string | null;
  isoNumeric: string | null;
  m49: string | null;
  geonamesId: number | null;
  wikidataQid: string | null;
  name: string;
  officialName: string;
  commonName: string | null;
  isoStatus: string | null;
  isoAssigned: boolean;
  independent: boolean | null;
  unMember: boolean | null;
  sovereigntyNote: string | null;
  capital: string | null;
  continent: string | null;
  region: string | null;
  subregion: string | null;
  tld: string | null;
  areaKm2: number | null;
  latitude: number | null;
  longitude: number | null;
  dialCode: string | null;
  dialRoot: string | null;
  dialSuffixes: string[] | null;
  currency: string | null;
  currencies: Array<{ code: string; isFund: boolean; isPrimary: boolean }>;
  flag: { emoji: string | null; svg: string | null; svgSquare: string | null };
  population: { value: number; year: number | null } | null;
}

export function shapeCountry(row: CountryRow, displayName?: string): Country {
  return {
    iso2: row.iso2,
    iso3: row.iso3,
    isoNumeric: row.iso_numeric,
    m49: row.m49,
    geonamesId: row.geonames_id,
    wikidataQid: row.wikidata_qid,
    name: displayName ?? row.display_name,
    officialName: row.iso_official_name,
    commonName: row.common_name,
    isoStatus: row.iso_status,
    isoAssigned: row.iso_assigned === 1,
    independent: row.independent === null ? null : row.independent === 1,
    unMember: row.un_member === null ? null : row.un_member === 1,
    sovereigntyNote: row.sovereignty_note,
    capital: row.capital,
    continent: row.continent_code,
    region: row.region,
    subregion: row.subregion,
    tld: row.tld,
    areaKm2: row.area_km2,
    latitude: row.latitude,
    longitude: row.longitude,
    dialCode: row.dial_code,
    dialRoot: row.dial_root,
    dialSuffixes: row.dial_suffixes ? JSON.parse(row.dial_suffixes) : null,
    currency: row.primary_currency,
    currencies: row.currencies ? JSON.parse(row.currencies) : [],
    flag: { emoji: row.flag_emoji, svg: row.flag_svg_url, svgSquare: row.flag_svg_square_url },
    // Population always travels with its year, or not at all. An undated number
    // presented as current is the shape of V1's population endpoints.
    population:
      row.population === null ? null : { value: row.population, year: row.population_year }
  };
}

export interface Subdivision {
  code: string;
  iso3166_2: string | null;
  countryIso2: string;
  name: string;
  type: string | null;
  level: number;
  parentCode: string | null;
  geonamesId: number | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  population: number | null;
}

export function shapeSubdivision(row: SubdivisionRow, displayName?: string): Subdivision {
  return {
    code: row.code,
    iso3166_2: row.iso_3166_2,
    countryIso2: row.country_iso2,
    name: displayName ?? row.display_name ?? row.name,
    type: row.type,
    level: row.level,
    parentCode: row.parent_code,
    geonamesId: row.geonames_id,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
    population: row.population
  };
}

export interface Place {
  geonamesId: number;
  name: string;
  countryIso2: string;
  subdivisionCode: string | null;
  featureCode: string;
  /** False for neighbourhoods and contained arrondissements. See issue #242. */
  isCity: boolean;
  parentPlaceId: number | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  timezone: string | null;
  population: number | null;
}

export function shapePlace(
  row: PlaceRow & { subdivision_code?: string | null },
  displayName?: string
): Place {
  return {
    geonamesId: row.geonames_id,
    name: displayName ?? row.name,
    countryIso2: row.country_iso2,
    subdivisionCode: row.subdivision_code ?? null,
    featureCode: row.feature_code,
    isCity: row.is_city === 1,
    parentPlaceId: row.parent_place_id,
    latitude: row.latitude,
    longitude: row.longitude,
    elevation: row.elevation,
    timezone: row.timezone,
    population: row.population
  };
}

/**
 * Sparse fieldsets: `?fields=iso2,name,currency`.
 *
 * Applied after shaping rather than pushed into SQL. The artifact rows are
 * already in memory and narrow, so the win here is transfer size, not query
 * cost — and doing it in one place means every endpoint gets it for free.
 */
export function project<T extends object>(item: T, fields: string[] | null): Partial<T> {
  if (!fields || fields.length === 0) return item;
  const out: Partial<T> = {};
  for (const f of fields) {
    if (f in item) out[f as keyof T] = item[f as keyof T];
  }
  return out;
}

export function parseFields(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const fields = raw
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  return fields.length > 0 ? fields : null;
}

/* -------------------------------------------------------------------------- */
/* Localized names                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Look up display names for a batch of entities in one query.
 *
 * Batched because the alternative — one query per row while rendering a page of
 * 50 cities — is the classic N+1 that makes an otherwise fast endpoint slow.
 */
export function localizedNames(
  db: Database,
  entityType: number,
  keys: string[],
  locale: string
): Map<string, string> {
  const out = new Map<string, string>();
  if (keys.length === 0 || !locale || locale === 'en') return out;

  const base = locale.split('-')[0]!.toLowerCase();
  const placeholders = keys.map(() => '?').join(',');
  const rows = db
    .query(
      `SELECT entity_key, name, locale FROM names
       WHERE entity_type = ? AND entity_key IN (${placeholders}) AND locale IN (?, ?)
       ORDER BY CASE locale WHEN ? THEN 0 ELSE 1 END, is_preferred DESC`
    )
    .all(entityType, ...keys, locale, base, locale) as Array<{
    entity_key: string;
    name: string;
  }>;

  // ORDER BY put the exact locale first, so the first row per key wins.
  for (const r of rows) if (!out.has(r.entity_key)) out.set(r.entity_key, r.name);
  return out;
}

/**
 * The single-entity form of `localizedNames`. Kept so the detail routes honour
 * `?locale=` exactly as the list routes do — an endpoint that quietly ignores a
 * documented cross-cutting parameter is worse than one that rejects it.
 */
export function localizedName(
  db: Database,
  entityType: number,
  key: string,
  locale: string | undefined
): string | null {
  if (!locale) return null;
  return localizedNames(db, entityType, [key], locale).get(key) ?? null;
}

/** Every name we hold for one entity, for the `?include=names` expansion. */
export function allNames(
  db: Database,
  entityType: number,
  key: string
): Array<{ locale: string; name: string; kind: string }> {
  return db
    .query(
      `SELECT locale, name, kind FROM names
       WHERE entity_type = ? AND entity_key = ?
       ORDER BY is_preferred DESC, locale, name`
    )
    .all(entityType, key) as Array<{ locale: string; name: string; kind: string }>;
}

/** Provenance for one entity — where each of its fields came from. */
export function provenanceFor(
  db: Database,
  entityType: string,
  ref: string
): Array<{ field: string; source: string; sourceVersion: string | null; retrievedAt: string; confidence: number }> {
  return db
    .query(
      `SELECT field, source, source_version AS sourceVersion, retrieved_at AS retrievedAt, confidence
       FROM provenance WHERE entity_type = ? AND entity_ref = ? ORDER BY field`
    )
    .all(entityType, ref) as Array<{
    field: string;
    source: string;
    sourceVersion: string | null;
    retrievedAt: string;
    confidence: number;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

export interface ListOptions {
  limit?: number;
  cursor?: string;
  locale?: string;
  fields?: string[] | null;
}

export function listCountries(db: Database, opts: ListOptions = {}): Page<Partial<Country>> {
  const limit = clampLimit(opts.limit);
  const after = decodeCursor(opts.cursor);

  const total = (db.query('SELECT count(*) AS n FROM countries').get() as { n: number }).n;

  const rows = (
    after
      ? db
          .query('SELECT * FROM countries WHERE iso2 > ? ORDER BY iso2 LIMIT ?')
          .all(after, limit + 1)
      : db.query('SELECT * FROM countries ORDER BY iso2 LIMIT ?').all(limit + 1)
  ) as CountryRow[];

  // Fetching limit+1 tells us whether another page exists without a second
  // count query.
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const names = opts.locale
    ? localizedNames(
        db,
        ENTITY_COUNTRY,
        page.map((r) => r.iso2),
        opts.locale
      )
    : new Map<string, string>();

  return {
    data: page.map((r) => project(shapeCountry(r, names.get(r.iso2)), opts.fields ?? null)),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]!.iso2) : null,
    total
  };
}

export function listSubdivisions(
  db: Database,
  countryIso2: string,
  opts: ListOptions & { level?: number; parentCode?: string } = {}
): Page<Partial<Subdivision>> {
  const limit = clampLimit(opts.limit);
  const after = decodeCursor(opts.cursor);

  const filters: string[] = ['country_iso2 = ?'];
  const params: SQLQueryBindings[] = [countryIso2.toUpperCase()];

  if (opts.level !== undefined) {
    filters.push('level = ?');
    params.push(opts.level);
  }
  if (opts.parentCode !== undefined) {
    filters.push('parent_code = ?');
    params.push(opts.parentCode.toUpperCase());
  }

  const where = filters.join(' AND ');
  const total = (
    db.query(`SELECT count(*) AS n FROM subdivisions WHERE ${where}`).get(...params) as {
      n: number;
    }
  ).n;

  const pageParams: SQLQueryBindings[] = [...params];
  let sql = `SELECT * FROM subdivisions WHERE ${where}`;
  if (after) {
    sql += ' AND code > ?';
    pageParams.push(after);
  }
  sql += ' ORDER BY code LIMIT ?';
  pageParams.push(limit + 1);

  const rows = db.query(sql).all(...pageParams) as SubdivisionRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const names = opts.locale
    ? localizedNames(
        db,
        ENTITY_SUBDIVISION,
        page.map((r) => String(r.id)),
        opts.locale
      )
    : new Map<string, string>();

  return {
    data: page.map((r) =>
      project(shapeSubdivision(r, names.get(String(r.id))), opts.fields ?? null)
    ),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]!.code) : null,
    total
  };
}

export interface PlaceFilter extends ListOptions {
  countryIso2?: string;
  subdivisionId?: number;
  /** Default true: callers asking for cities should not get neighbourhoods. */
  citiesOnly?: boolean;
  parentPlaceId?: number;
  minPopulation?: number;
  search?: string;
}

export function listPlaces(db: Database, filter: PlaceFilter = {}): Page<Partial<Place>> {
  const limit = clampLimit(filter.limit);
  const after = decodeCursor(filter.cursor);

  const filters: string[] = [];
  const params: SQLQueryBindings[] = [];

  if (filter.countryIso2) {
    filters.push('p.country_iso2 = ?');
    params.push(filter.countryIso2.toUpperCase());
  }
  if (filter.subdivisionId !== undefined) {
    filters.push('p.subdivision_id = ?');
    params.push(filter.subdivisionId);
  }
  if (filter.parentPlaceId !== undefined) {
    filters.push('p.parent_place_id = ?');
    params.push(filter.parentPlaceId);
  }
  if (filter.citiesOnly !== false) filters.push('p.is_city = 1');
  if (filter.minPopulation !== undefined) {
    filters.push('p.population >= ?');
    params.push(filter.minPopulation);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const total = (
    db.query(`SELECT count(*) AS n FROM places p ${where}`).get(...params) as { n: number }
  ).n;

  const pageParams: SQLQueryBindings[] = [...params];
  let sql = `
    SELECT p.*, s.code AS subdivision_code
    FROM places p LEFT JOIN subdivisions s ON s.id = p.subdivision_id
    ${where}`;
  if (after) {
    sql += `${where ? ' AND' : ' WHERE'} p.geonames_id > ?`;
    pageParams.push(Number(after));
  }
  sql += ' ORDER BY p.geonames_id LIMIT ?';
  pageParams.push(limit + 1);

  const rows = db.query(sql).all(...pageParams) as Array<
    PlaceRow & { subdivision_code: string | null }
  >;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const names = filter.locale
    ? localizedNames(
        db,
        ENTITY_PLACE,
        page.map((r) => String(r.geonames_id)),
        filter.locale
      )
    : new Map<string, string>();

  return {
    data: page.map((r) =>
      project(shapePlace(r, names.get(String(r.geonames_id))), filter.fields ?? null)
    ),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]!.geonames_id) : null,
    total
  };
}

/**
 * Prefix search over the name index, for typeaheads.
 *
 * Backed by the same `folded` column the resolver uses, so a search and a
 * lookup can never disagree about whether a name exists.
 */
export function searchPlaces(
  db: Database,
  query: string,
  opts: { countryIso2?: string; limit?: number } = {}
): Place[] {
  const limit = clampLimit(opts.limit);
  const folded = query.trim().toLowerCase();
  if (!folded) return [];

  const params: SQLQueryBindings[] = [ENTITY_PLACE, `${folded}%`];
  let sql = `
    SELECT DISTINCT p.*, s.code AS subdivision_code
    FROM names n
    JOIN places p ON p.geonames_id = CAST(n.entity_key AS INTEGER)
    LEFT JOIN subdivisions s ON s.id = p.subdivision_id
    WHERE n.entity_type = ? AND n.folded LIKE ? AND p.is_city = 1`;

  if (opts.countryIso2) {
    sql += ' AND p.country_iso2 = ?';
    params.push(opts.countryIso2.toUpperCase());
  }
  sql += ' ORDER BY p.population DESC NULLS LAST LIMIT ?';
  params.push(limit);

  const rows = db.query(sql).all(...params) as Array<
    PlaceRow & { subdivision_code: string | null }
  >;
  return rows.map((r) => shapePlace(r));
}

export function listCurrencies(db: Database) {
  return db
    .query(
      `SELECT code, numeric_code AS numericCode, name, minor_units AS minorUnits, symbol,
              is_historical AS isHistorical, withdrawn_date AS withdrawnDate
       FROM currencies ORDER BY code`
    )
    .all() as Array<{
    code: string;
    numericCode: string | null;
    name: string;
    minorUnits: number | null;
    symbol: string | null;
    isHistorical: number;
    withdrawnDate: string | null;
  }>;
}

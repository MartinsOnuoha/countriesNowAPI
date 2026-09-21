/**
 * The v0.1 compatibility shim.
 *
 * Every V1 endpoint, served from the V2 engine, with V1's exact response
 * shapes — including its inconsistencies. `/countries/iso` capitalises `Iso2`
 * and `Iso3` while every other endpoint lowercases them; `/countries/codes`
 * calls alpha-2 `code`; the city population payload misspells `reliabilty`.
 * All of that is reproduced deliberately, because a compatibility layer that
 * quietly corrects field names is not a compatibility layer.
 *
 * Three things are deliberately *not* reproduced:
 *
 *   1. The `/cities/q` HTTP 500. V1 guards with `if (!DB1 && !DB2)` and then
 *      destructures `DB1` unconditionally, so 23 countries — Tuvalu, South
 *      Sudan, Vatican City among them — return a server error. Returning the
 *      correct data instead cannot break a client that currently receives a 500.
 *
 *   2. Stale values. V1 reports BGN for Bulgaria; we report EUR, because the
 *      ISO 4217 register does. Freezing a known-wrong value to preserve
 *      byte-compatibility would defeat the point of the rebuild.
 *
 *   3. The POST-to-GET redirect loop. V1 301s POST requests to the GET route,
 *      and clients that preserve the method across a 301 loop forever. We
 *      accept both verbs on the same handler instead.
 */

import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { getDb } from '../../serving/artifact.ts';
import { resolveCountry, resolveSubdivision, type CountryRow } from '../../serving/resolve.ts';
import { fold, foldTight } from '../../serving/normalize.ts';
import { ENTITY_PLACE } from '../../serving/constants.ts';

/* -------------------------------------------------------------------------- */
/* V1 envelope                                                                 */
/* -------------------------------------------------------------------------- */

const ok = (msg: string, data: unknown) => ({ error: false, msg, data });

function fail(set: { status?: number | string }, msg: string, status = 404) {
  set.status = status;
  return { error: true, msg };
}

/**
 * V1's error strings, verbatim.
 *
 * They are inconsistent — `/countries/iso/q` says "missing param (country)"
 * while its neighbour says "missing param (country or iso2)", and
 * `/countries/positions/q` capitalises "Country not found" where nothing else
 * does. Clients match on these strings, so the inconsistency is part of the
 * contract and every one of them is reproduced exactly.
 */
const MSG = {
  missingCountryOrIso2: 'missing param (country or iso2)',
  missingCountryOrIso3: 'missing param (country or iso3)',
  missingCountry: 'missing param (country)',
  missingState: 'missing param (state)',
  missingCity: 'missing param (city)',
  missingRange: 'missing param (type, min, max)',
  missingReturns: 'you must specify data to fetch e.g ?returns=unicodeFlag,currency,image',
  countryNotFound: 'country not found',
  countryNotFoundCapitalised: 'Country not found',
  countryDataNotFound: 'country data not found',
  cityDataNotFound: 'city data not found',
  stateNotFound: 'state not found',
  noResults: 'No results found',
  invalidPayload: 'invalid payload format'
} as const;

/**
 * V1 accepted the country either as `?country=` on a GET or in a JSON body on a
 * POST. Both are read here so neither generation of client breaks.
 */
function param(
  query: Record<string, string | undefined>,
  body: unknown,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const fromQuery = query[name];
    if (fromQuery) return fromQuery;
    if (body && typeof body === 'object') {
      // POST bodies sent `limit`, `gt` and `year` as JSON numbers where the
      // query string could only ever carry strings. Both are accepted.
      const v = (body as Record<string, unknown>)[name];
      if (typeof v === 'string' && v) return v;
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Row projections matching V1 field names exactly                             */
/* -------------------------------------------------------------------------- */

const v1Name = (c: CountryRow) => c.display_name;

const asCapital = (c: CountryRow) => ({
  name: v1Name(c),
  capital: c.capital ?? '',
  iso2: c.iso2,
  iso3: c.iso3 ?? ''
});

const asCurrency = (c: CountryRow) => ({
  name: v1Name(c),
  currency: c.primary_currency ?? '',
  iso2: c.iso2,
  iso3: c.iso3 ?? ''
});

const asFlagImage = (c: CountryRow) => ({
  name: v1Name(c),
  flag: c.flag_svg_url ?? '',
  iso2: c.iso2,
  iso3: c.iso3 ?? ''
});

const asUnicodeFlag = (c: CountryRow) => ({
  name: v1Name(c),
  iso2: c.iso2,
  iso3: c.iso3 ?? '',
  unicodeFlag: c.flag_emoji ?? ''
});

// `code` here is the alpha-2, not a dial code. V1's naming, preserved.
const asDialCode = (c: CountryRow) => ({
  name: v1Name(c),
  code: c.iso2,
  dial_code: c.dial_code ?? ''
});

// The only endpoint in V1 that capitalises these keys.
const asIso = (c: CountryRow) => ({ name: v1Name(c), Iso2: c.iso2, Iso3: c.iso3 ?? '' });

const asPosition = (c: CountryRow) => ({
  name: v1Name(c),
  iso2: c.iso2,
  long: c.longitude ?? 0,
  lat: c.latitude ?? 0
});

// The shape `/countries/random` returned, straight out of V1's model file.
const asCodeRecord = (c: CountryRow) => ({
  name: v1Name(c),
  dial_code: c.dial_code ?? '',
  iso2: c.iso2,
  code: c.iso2,
  latitude: c.latitude ?? 0,
  longitude: c.longitude ?? 0
});

const asCountryPopulation = (c: CountryRow) => ({
  country: v1Name(c),
  code: c.iso3 ?? c.iso2,
  iso3: c.iso3 ?? '',
  populationCounts: [{ year: c.population_year ?? null, value: c.population }]
});

/* -------------------------------------------------------------------------- */
/* Helpers over the artifact                                                   */
/* -------------------------------------------------------------------------- */

function allCountries(db: Database): CountryRow[] {
  return db.query('SELECT * FROM countries ORDER BY display_name').all() as CountryRow[];
}

/**
 * V1's `state_code` is inconsistent between endpoints: the bulk `/states` route
 * emits the local part ("BDS") while `/states/q` emits the full ISO code
 * ("NG-AB"). Both are reproduced by their respective callers.
 */
function statesOf(db: Database, iso2: string, full: boolean) {
  const rows = db
    .query(
      'SELECT code, iso_3166_2, name FROM subdivisions WHERE country_iso2 = ? AND level = 1 ORDER BY name'
    )
    .all(iso2) as Array<{ code: string; iso_3166_2: string | null; name: string }>;
  return rows.map((s) => ({
    name: s.name,
    state_code: full ? (s.iso_3166_2 ?? `${iso2}-${s.code}`) : s.code
  }));
}

const withPopulation = (c: CountryRow): boolean => c.population !== null;

/** A city row in V1's population shape. Numbers are strings; `reliabilty` is misspelled. */
interface CityPopulationRow {
  name: string;
  country: string;
  population: number | null;
  population_year: number | null;
}

const asCityPopulation = (r: CityPopulationRow) => ({
  city: r.name,
  country: r.country,
  populationCounts: [
    {
      year: r.population_year ? String(r.population_year) : '',
      value: r.population === null ? '' : String(r.population),
      sex: 'Both Sexes',
      // Misspelled upstream. Preserved: a client keying on this string would
      // break if we corrected it.
      reliabilty: 'Final figure, complete'
    }
  ]
});

function citiesWithPopulation(db: Database, countryFilter?: string): CityPopulationRow[] {
  const sql =
    `SELECT p.name, p.population, p.population_year, c.display_name AS country
     FROM places p JOIN countries c ON c.iso2 = p.country_iso2
     WHERE p.is_city = 1 AND p.population IS NOT NULL AND p.population > 0` +
    (countryFilter ? ' AND LOWER(c.display_name) LIKE ?' : '');
  const q = db.query(sql);
  return (
    countryFilter ? q.all(`%${countryFilter.toLowerCase()}%`) : q.all()
  ) as CityPopulationRow[];
}

/**
 * V1's ordering, reproduced including its quirks: `orderBy=name` sorts on the
 * name field and ignores `population` entirely, and anything other than `dsc`
 * is treated as ascending.
 */
function orderBy<T>(
  rows: T[],
  order: string,
  by: string,
  nameOf: (r: T) => string,
  valueOf: (r: T) => number
): T[] {
  const desc = order.trim().toLowerCase() === 'dsc';
  const sorted = [...rows];
  if (by.trim().toLowerCase() === 'name') {
    sorted.sort((a, b) => {
      const cmp = nameOf(a).toUpperCase().localeCompare(nameOf(b).toUpperCase());
      return desc ? -cmp : cmp;
    });
  } else {
    sorted.sort((a, b) => (desc ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b)));
  }
  return sorted;
}

/**
 * V1 accepted `limit` as a string and coerced it, defaulting to the whole set.
 * A non-numeric value produced "invalid payload format"; that is preserved.
 */
function parseLimit(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function cityNamesOf(db: Database, iso2: string, subdivisionId?: number): string[] {
  const rows = (
    subdivisionId === undefined
      ? db
          .query(
            'SELECT name FROM places WHERE country_iso2 = ? AND is_city = 1 ORDER BY name'
          )
          .all(iso2)
      : db
          .query(
            'SELECT name FROM places WHERE subdivision_id = ? AND is_city = 1 ORDER BY name'
          )
          .all(subdivisionId)
  ) as Array<{ name: string }>;
  // V1 returned a bare array of name strings, and deduped nothing. We dedupe,
  // because the duplicates were themselves a reported bug.
  return [...new Set(rows.map((r) => r.name))];
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

const tags = ['v0.1 compatibility'];
const legacyQuery = t.Object({
  country: t.Optional(t.String()),
  state: t.Optional(t.String()),
  city: t.Optional(t.String()),
  iso2: t.Optional(t.String()),
  iso3: t.Optional(t.String()),
  returns: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  order: t.Optional(t.String()),
  orderBy: t.Optional(t.String()),
  type: t.Optional(t.String()),
  min: t.Optional(t.String()),
  max: t.Optional(t.String()),
  gt: t.Optional(t.String()),
  lt: t.Optional(t.String()),
  year: t.Optional(t.String())
});
const legacyBody = t.Optional(t.Any());

/**
 * V1 exposed each lookup as both POST (original) and GET (added in 2022, with
 * the POST route left in place behind a 301). Registering one handler for both
 * verbs is simpler and removes the redirect loop.
 */
interface LegacyContext {
  query: Record<string, string | undefined>;
  body: unknown;
  set: { status?: number | string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function both(app: any, path: string, handler: (ctx: LegacyContext) => unknown, summary: string) {
  const opts = { query: legacyQuery, body: legacyBody, detail: { summary, tags } };
  app.get(path, handler, opts);
  app.post(path, handler, opts);
}

export const v01 = new Elysia({ prefix: '/v0.1', name: 'v0.1' })

  /* ---- bulk collections ------------------------------------------------ */

  .get(
    '/countries',
    () => {
      const db = getDb();
      return ok(
        'countries and cities retrieved',
        allCountries(db).map((c) => ({
          iso2: c.iso2,
          iso3: c.iso3 ?? '',
          country: v1Name(c),
          cities: cityNamesOf(db, c.iso2)
        }))
      );
    },
    { detail: { summary: 'All countries with their cities', tags } }
  )

  .get(
    '/countries/positions',
    () =>
      ok('countries and positions retrieved', allCountries(getDb()).map(asPosition)),
    { detail: { summary: 'All countries with coordinates', tags } }
  )

  .get(
    '/countries/capital',
    () => ok('countries and capitals retrieved', allCountries(getDb()).map(asCapital)),
    { detail: { summary: 'All countries with capitals', tags } }
  )

  .get(
    '/countries/currency',
    () => ok('countries and currencies retrieved', allCountries(getDb()).map(asCurrency)),
    {
      detail: {
        summary: 'All countries with currencies',
        description:
          'Values come from the SIX ISO 4217 register, so Bulgaria reports EUR where V1 ' +
          'still reports BGN. This is a deliberate correctness break — see issue #236.',
        tags
      }
    }
  )

  .get(
    '/countries/flag/images',
    () => ok('flags images retrieved', allCountries(getDb()).map(asFlagImage)),
    {
      detail: {
        summary: 'All countries with flag image URLs',
        description:
          'URLs now point at lipis/flag-icons on a pinned tag rather than at Wikimedia ' +
          'Commons, whose paths change without notice.',
        tags
      }
    }
  )

  .get(
    '/countries/flag/unicode',
    () => ok('countries and unicode flags retrieved', allCountries(getDb()).map(asUnicodeFlag)),
    { detail: { summary: 'All countries with emoji flags', tags } }
  )

  .get(
    '/countries/codes',
    () => ok('countries and codes retrieved', allCountries(getDb()).map(asDialCode)),
    { detail: { summary: 'All countries with dial codes', tags } }
  )

  .get('/countries/iso', () => ok('countries and ISO codes retrieved', allCountries(getDb()).map(asIso)), {
    detail: { summary: 'All countries with ISO codes', tags }
  })

  .get(
    '/countries/states',
    () => {
      const db = getDb();
      return ok(
        'countries and states retrieved',
        allCountries(db).map((c) => ({
          name: v1Name(c),
          iso3: c.iso3 ?? '',
          iso2: c.iso2,
          states: statesOf(db, c.iso2, false)
        }))
      );
    },
    { detail: { summary: 'All countries with states', tags } }
  )

  .get(
    '/countries/population',
    () => {
      const db = getDb();
      // V1 served a full 1960-2018 time series per country and included World
      // Bank aggregates such as "Arab World" as though they were countries. We
      // carry one dated observation and only real countries; the envelope and
      // field names are unchanged so existing parsers still work.
      return ok(
        'all countries and population',
        allCountries(db).filter(withPopulation).map(asCountryPopulation)
      );
    },
    {
      detail: {
        summary: 'All countries with population',
        description:
          'Unlike V1 this excludes World Bank aggregates ("Arab World", "Euro area"), which ' +
          'were never countries.',
        tags
      }
    }
  )

  .get(
    '/countries/population/cities',
    () => ok('all cities with population', citiesWithPopulation(getDb()).map(asCityPopulation)),
    {
      detail: {
        summary: 'All cities with population',
        description:
          'V1 returned 1.86 MB here with no way to page it. The payload is unchanged in ' +
          'shape; use /v2/places?limit=&cursor= if you want it in pages.',
        tags
      }
    }
  )

  .get(
    '/countries/random',
    () => {
      const rows = allCountries(getDb());
      const pick = rows[Math.floor(Math.random() * rows.length)]!;
      return ok('retrieved random country', asCodeRecord(pick));
    },
    { detail: { summary: 'A random country', tags } }
  )

  .get(
    '/countries/info',
    ({ query, set }) => {
      const returns = (query.returns ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (returns.length === 0) return fail(set, MSG.missingReturns, 400);

      const db = getDb();
      const pickers: Record<string, (c: CountryRow) => unknown> = {
        currency: (c) => c.primary_currency ?? '',
        flag: (c) => c.flag_svg_url ?? '',
        unicodeFlag: (c) => c.flag_emoji ?? '',
        dialCode: (c) => c.dial_code ?? '',
        capital: (c) => c.capital ?? '',
        iso2: (c) => c.iso2,
        iso3: (c) => c.iso3 ?? ''
      };

      const data = allCountries(db).map((c) => {
        const row: Record<string, unknown> = { name: v1Name(c) };
        for (const f of returns) if (pickers[f]) row[f] = pickers[f]!(c);
        return row;
      });

      return ok(`countries details: '${query.returns}' have been retrieved`, data);
    },
    {
      query: legacyQuery,
      detail: { summary: 'Selected fields for all countries', tags }
    }
  );

/* -------------------------------------------------------------------------- */
/* Single-country lookups                                                      */
/* -------------------------------------------------------------------------- */

const lookups = new Elysia({ prefix: '/v0.1', name: 'v0.1-lookups' });

both(
  lookups,
  '/countries/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const db = getDb();
    const r = resolveCountry(db, ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok(`cities in ${r.value.display_name} retrieved`, {
      iso2: r.value.iso2,
      iso3: r.value.iso3 ?? '',
      country: r.value.display_name,
      cities: cityNamesOf(db, r.value.iso2)
    });
  },
  'One country with its cities'
);

both(
  lookups,
  '/countries/cities/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const db = getDb();
    const r = resolveCountry(db, ref);
    // V1 returns HTTP 500 here for 23 countries because it destructures a null
    // lookup after a guard that only fires when *both* lookups miss. Resolving
    // through one code path removes the possibility.
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok(`cities in ${r.value.display_name} retrieved`, cityNamesOf(db, r.value.iso2));
  },
  "One country's cities"
);

both(
  lookups,
  '/countries/states/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const db = getDb();
    const r = resolveCountry(db, ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok(`states in ${r.value.display_name} retrieved`, {
      name: r.value.display_name,
      iso3: r.value.iso3 ?? '',
      iso2: r.value.iso2,
      states: statesOf(db, r.value.iso2, true)
    });
  },
  "One country's states"
);

both(
  lookups,
  '/countries/state/cities/q',
  ({ query, body, set }) => {
    const countryRef = param(query, body, 'country');
    const stateRef = param(query, body, 'state');
    // V1 reported the two missing params separately and country won the tie.
    if (!countryRef) return fail(set, MSG.missingCountry, 400);
    if (!stateRef) return fail(set, MSG.missingState, 400);

    const db = getDb();
    const c = resolveCountry(db, countryRef);
    if (!c.ok) return fail(set, MSG.countryNotFound);

    // V1 answers "state not found" for ?state=lagos because it compares the
    // raw string against "Lagos State". The resolver registers the
    // suffix-stripped form as an alias, so both spellings land on the same row.
    const s = resolveSubdivision(db, stateRef, c.value.iso2);
    if (!s.ok) return fail(set, MSG.stateNotFound);

    return ok(`cities in ${s.value.name}, ${c.value.display_name} retrieved`, cityNamesOf(db, c.value.iso2, s.value.id));
  },
  "One state's cities"
);

both(
  lookups,
  '/countries/capital/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const r = resolveCountry(getDb(), ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok('country and capitals retrieved', asCapital(r.value));
  },
  "One country's capital"
);

both(
  lookups,
  '/countries/currency/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const r = resolveCountry(getDb(), ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok(`${r.value.display_name} and currency retrieved`, asCurrency(r.value));
  },
  "One country's currency"
);

both(
  lookups,
  '/countries/positions/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const r = resolveCountry(getDb(), ref);
    // The only endpoint that capitalises this. V1's inconsistency, kept.
    if (!r.ok) return fail(set, MSG.countryNotFoundCapitalised);
    return ok('country position retrieved', asPosition(r.value));
  },
  "One country's position"
);

both(
  lookups,
  '/countries/iso/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountry, 400);
    const r = resolveCountry(getDb(), ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok("country's ISO code retrieved", asIso(r.value));
  },
  "One country's ISO codes"
);

both(
  lookups,
  '/countries/codes/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const r = resolveCountry(getDb(), ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok(`${r.value.display_name} dial code retrieved`, asDialCode(r.value));
  },
  "One country's dial code"
);

both(
  lookups,
  '/countries/flag/images/q',
  ({ query, body, set }) => {
    // V1 accepted any of the three here, which is why the resolver takes an
    // untyped reference rather than three separate lookups.
    const ref = param(query, body, 'iso2', 'iso3', 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const r = resolveCountry(getDb(), ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok(`${r.value.display_name} and flag retrieved`, asFlagImage(r.value));
  },
  "One country's flag image"
);

both(
  lookups,
  '/countries/flag/unicode/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country', 'iso2', 'iso3');
    if (!ref) return fail(set, MSG.missingCountryOrIso2, 400);
    const r = resolveCountry(getDb(), ref);
    if (!r.ok) return fail(set, MSG.countryNotFound);
    return ok(`${r.value.display_name} and unicode flag retrieved`, asUnicodeFlag(r.value));
  },
  "One country's emoji flag"
);

both(
  lookups,
  '/countries/population/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'country');
    if (!ref) return fail(set, MSG.missingCountryOrIso3, 400);
    const r = resolveCountry(getDb(), ref);
    if (!r.ok) return fail(set, MSG.countryDataNotFound);
    return ok(`${r.value.display_name} with population`, {
      country: r.value.display_name,
      code: r.value.iso3 ?? r.value.iso2,
      iso3: r.value.iso3 ?? '',
      populationCounts: [{ year: r.value.population_year ?? null, value: r.value.population }]
    });
  },
  "One country's population"
);

both(
  lookups,
  '/countries/positions/range/q',
  ({ query, body, set }) => {
    const type = param(query, body, 'type');
    const min = param(query, body, 'min');
    const max = param(query, body, 'max');
    if (!type || !min || !max) return fail(set, MSG.missingRange, 400);

    const lo = Number(min);
    const hi = Number(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      return fail(set, 'min and max must be numbers', 400);
    }
    // V1 left a TODO about not swapping reversed bounds and then returned an
    // empty list. Swapping is strictly more useful and cannot break a caller
    // who was getting nothing back.
    const [from, to] = lo <= hi ? [lo, hi] : [hi, lo];

    const positions = allCountries(getDb()).map(asPosition);
    const axis = type === 'lat' ? 'lat' : type === 'long' ? 'long' : null;
    const result = axis
      ? positions.filter((p) => p[axis] >= from && p[axis] <= to)
      : positions; // V1's default branch: an unknown type filters nothing.

    return ok(`countries between ${type} of (${min} and ${max})`, result);
  },
  'Countries within a latitude or longitude range'
);

both(
  lookups,
  '/countries/population/filter/q',
  ({ query, body, set }) => {
    // Note the shape: this endpoint alone emits `populationCounts` as a single
    // object rather than an array, because V1 built it with `.find()` on the
    // year instead of a filter. Clients parse it that way.
    const rows = allCountries(getDb())
      .filter(withPopulation)
      .map((c) => ({
        country: v1Name(c),
        code: c.iso3 ?? c.iso2,
        populationCounts: { year: c.population_year ?? null, value: c.population as number }
      }));

    const limit = parseLimit(param(query, body, 'limit'), rows.length);
    if (limit === null) return fail(set, MSG.invalidPayload, 400);

    const gt = Number(param(query, body, 'gt') ?? NaN);
    const lt = Number(param(query, body, 'lt') ?? NaN);
    const yearRaw = param(query, body, 'year');
    const year = yearRaw === undefined ? null : Number(yearRaw);

    let result = rows;
    if (year !== null && Number.isFinite(year)) {
      result = result.filter((r) => r.populationCounts.year === year);
    }
    if (Number.isFinite(gt)) result = result.filter((r) => r.populationCounts.value > gt);
    if (Number.isFinite(lt)) result = result.filter((r) => r.populationCounts.value < lt);

    result = orderBy(
      result,
      param(query, body, 'order') ?? 'asc',
      param(query, body, 'orderBy') ?? 'population',
      (r) => r.country,
      (r) => r.populationCounts.value
    );

    return ok('filtered result', result.slice(0, limit));
  },
  'Filter countries by population'
);

both(
  lookups,
  '/countries/population/cities/filter/q',
  ({ query, body, set }) => {
    const country = param(query, body, 'country');
    const rows = citiesWithPopulation(getDb(), country).map(asCityPopulation);

    const limit = parseLimit(param(query, body, 'limit'), rows.length);
    if (limit === null) return fail(set, MSG.invalidPayload, 400);

    // V1 called Respond.error here without returning, then kept going and
    // dereferenced result[0] on an empty array. Returning is the fix.
    if (rows.length === 0) return fail(set, MSG.noResults);

    const result = orderBy(
      rows,
      param(query, body, 'order') ?? 'asc',
      param(query, body, 'orderBy') ?? 'population',
      (r) => r.city,
      (r) => Number(r.populationCounts[0]!.value) || 0
    );

    return ok('filtered result', result.slice(0, limit));
  },
  'Filter cities by population'
);

both(
  lookups,
  '/countries/population/cities/q',
  ({ query, body, set }) => {
    const ref = param(query, body, 'city');
    if (!ref) return fail(set, MSG.missingCity, 400);
    // Resolved through the names table, so accented and unaccented spellings
    // both hit. Ties break on population, which is what a caller asking for
    // "Springfield" almost certainly wants.
    const row = getDb()
      .query(
        `SELECT p.name, p.population, p.population_year, c.display_name AS country
         FROM places p
         JOIN countries c ON c.iso2 = p.country_iso2
         JOIN names n ON n.entity_type = ${ENTITY_PLACE} AND n.entity_key = CAST(p.geonames_id AS TEXT)
         WHERE (n.folded = ? OR n.folded_tight = ?) AND p.is_city = 1
         ORDER BY p.population DESC NULLS LAST LIMIT 1`
      )
      .get(fold(ref), foldTight(ref)) as CityPopulationRow | null;

    if (!row) return fail(set, MSG.cityDataNotFound);
    return ok(`${ref} with population`, asCityPopulation(row));
  },
  "One city's population"
);

export { lookups as v01Lookups };

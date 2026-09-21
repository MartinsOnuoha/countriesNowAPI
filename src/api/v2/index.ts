/**
 * The v2 API.
 *
 * Schemas are declared once with TypeBox and Elysia derives runtime validation,
 * TypeScript types and the OpenAPI document from them. V1 hand-wrote 33 files
 * under `swagger/` and they drifted so far that the published docs still
 * describe POST endpoints replaced by GET in 2022. Schema-derived docs make
 * that class of drift impossible rather than merely discouraged.
 */

import { Elysia, t } from 'elysia';
import { getDb, getMeta } from '../../serving/artifact.ts';
import {
  ENTITY_COUNTRY,
  ENTITY_PLACE,
  ENTITY_SUBDIVISION
} from '../../serving/constants.ts';
import {
  allNames,
  listCountries,
  listCurrencies,
  localizedName,
  listPlaces,
  listSubdivisions,
  parseFields,
  project,
  provenanceFor,
  searchPlaces,
  shapeCountry,
  shapePlace,
  shapeSubdivision
} from '../../serving/queries.ts';
import { resolveCountry, resolvePlace, resolveSubdivision, unwrap } from '../../serving/resolve.ts';

/* -------------------------------------------------------------------------- */
/* Shared query schema                                                         */
/* -------------------------------------------------------------------------- */

const listQuery = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500, description: 'Page size (max 500).' })),
  cursor: t.Optional(t.String({ description: 'Opaque keyset cursor from `nextCursor`.' })),
  fields: t.Optional(
    t.String({
      description: 'Comma-separated field allowlist, e.g. `iso2,name,currency`.',
      examples: ['iso2,name,flag']
    })
  ),
  locale: t.Optional(
    t.String({
      description: 'BCP-47 tag. Names fall back to English where a locale is missing.',
      examples: ['fr', 'ja', 'pt-BR']
    })
  )
});

const detailQuery = t.Object({
  fields: t.Optional(t.String()),
  locale: t.Optional(t.String()),
  include: t.Optional(
    t.String({
      description: 'Comma-separated expansions: `names`, `provenance`.',
      examples: ['names,provenance']
    })
  )
});

function wants(include: string | undefined, what: string): boolean {
  return (include ?? '')
    .split(',')
    .map((s) => s.trim())
    .includes(what);
}

/** Every response carries the dataset version it was served from. */
function envelope<T>(data: T, extra: Record<string, unknown> = {}) {
  const meta = getMeta();
  return { data, meta: { datasetVersion: meta.datasetVersion, ...extra } };
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

export const v2 = new Elysia({ prefix: '/v2', name: 'v2' })

  /* ---- countries ------------------------------------------------------- */

  .get(
    '/countries',
    ({ query }) => {
      const page = listCountries(getDb(), {
        limit: query.limit,
        cursor: query.cursor,
        locale: query.locale,
        fields: parseFields(query.fields)
      });
      return envelope(page.data, { total: page.total, nextCursor: page.nextCursor });
    },
    {
      query: listQuery,
      detail: {
        summary: 'List countries',
        description:
          'Membership follows ISO 3166-1 exactly, with documented exceptions flagged via ' +
          '`isoAssigned`. See docs/DATA_POLICY.md.',
        tags: ['Countries']
      }
    }
  )

  .get(
    '/countries/:ref',
    ({ params, query }) => {
      const db = getDb();
      // One resolver for every kind of reference: alpha-2, alpha-3, GeoNames
      // id, official name, CLDR name, historical name or alias.
      const row = unwrap(resolveCountry(db, params.ref), 'country', params.ref);

      const country = shapeCountry(row);
      country.name = localizedName(db, ENTITY_COUNTRY, row.iso2, query.locale) ?? country.name;
      const body: Record<string, unknown> = project(country, parseFields(query.fields));

      if (wants(query.include, 'names')) {
        body.names = allNames(db, ENTITY_COUNTRY, row.iso2);
      }
      if (wants(query.include, 'provenance')) {
        body.provenance = provenanceFor(db, 'country', row.iso2);
      }

      return envelope(body);
    },
    {
      params: t.Object({
        ref: t.String({
          description: 'ISO alpha-2, alpha-3, GeoNames id, or any recorded name.',
          examples: ['NG', 'FRA', 'Côte d’Ivoire', 'Reunion', '2635167']
        })
      }),
      query: detailQuery,
      detail: {
        summary: 'Get one country',
        description:
          'Accepts any recorded name, accented or not. An ambiguous name returns 409 with ' +
          'the candidates rather than silently picking one.',
        tags: ['Countries']
      }
    }
  )

  .get(
    '/countries/:ref/subdivisions',
    ({ params, query }) => {
      const db = getDb();
      const country = unwrap(resolveCountry(db, params.ref), 'country', params.ref);
      const page = listSubdivisions(db, country.iso2, {
        limit: query.limit,
        cursor: query.cursor,
        locale: query.locale,
        fields: parseFields(query.fields),
        level: query.level,
        parentCode: query.parent
      });
      return envelope(page.data, {
        country: country.iso2,
        total: page.total,
        nextCursor: page.nextCursor
      });
    },
    {
      params: t.Object({ ref: t.String() }),
      query: t.Composite([
        listQuery,
        t.Object({
          level: t.Optional(
            t.Numeric({
              description:
                'Administrative depth. 1 is the top level. Sri Lanka has 9 provinces at ' +
                'level 1 and 25 districts at level 2.'
            })
          ),
          parent: t.Optional(
            t.String({ description: 'Only children of this subdivision code.' })
          )
        })
      ]),
      detail: {
        summary: "List a country's subdivisions",
        description:
          'ISO 3166-2, with the hierarchy ISO publishes via its `parent` field. Filter by ' +
          '`level` to get only top-level divisions.',
        tags: ['Subdivisions']
      }
    }
  )

  .get(
    '/countries/:ref/cities',
    ({ params, query }) => {
      const db = getDb();
      const country = unwrap(resolveCountry(db, params.ref), 'country', params.ref);
      const page = listPlaces(db, {
        countryIso2: country.iso2,
        limit: query.limit,
        cursor: query.cursor,
        locale: query.locale,
        fields: parseFields(query.fields),
        citiesOnly: query.includeNeighbourhoods !== true,
        minPopulation: query.minPopulation
      });
      return envelope(page.data, {
        country: country.iso2,
        total: page.total,
        nextCursor: page.nextCursor
      });
    },
    {
      params: t.Object({ ref: t.String() }),
      query: t.Composite([
        listQuery,
        t.Object({
          minPopulation: t.Optional(t.Numeric()),
          includeNeighbourhoods: t.Optional(
            t.Boolean({
              description:
                'Include GeoNames PPLX sections and contained arrondissements. Off by ' +
                'default: returning them as cities was issue #242.'
            })
          )
        })
      ]),
      detail: { summary: "List a country's cities", tags: ['Places'] }
    }
  )

  /* ---- subdivisions ---------------------------------------------------- */

  .get(
    '/subdivisions/:ref',
    ({ params, query }) => {
      const db = getDb();
      const row = unwrap(resolveSubdivision(db, params.ref), 'subdivision', params.ref);
      const subdivision = shapeSubdivision(row);
      subdivision.name =
        localizedName(db, ENTITY_SUBDIVISION, String(row.id), query.locale) ?? subdivision.name;
      const body: Record<string, unknown> = project(subdivision, parseFields(query.fields));
      if (wants(query.include, 'names')) {
        body.names = allNames(db, ENTITY_SUBDIVISION, String(row.id));
      }
      return envelope(body);
    },
    {
      params: t.Object({
        ref: t.String({ description: 'ISO 3166-2 code or name.', examples: ['FR-PAC', 'Lagos'] })
      }),
      query: detailQuery,
      detail: { summary: 'Get one subdivision', tags: ['Subdivisions'] }
    }
  )

  .get(
    '/subdivisions/:ref/cities',
    ({ params, query }) => {
      const db = getDb();
      const sub = unwrap(resolveSubdivision(db, params.ref), 'subdivision', params.ref);
      const page = listPlaces(db, {
        subdivisionId: sub.id,
        limit: query.limit,
        cursor: query.cursor,
        locale: query.locale,
        fields: parseFields(query.fields),
        citiesOnly: query.includeNeighbourhoods !== true
      });
      return envelope(page.data, {
        subdivision: sub.iso_3166_2 ?? `${sub.country_iso2}-${sub.code}`,
        total: page.total,
        nextCursor: page.nextCursor
      });
    },
    {
      params: t.Object({ ref: t.String() }),
      query: t.Composite([
        listQuery,
        t.Object({ includeNeighbourhoods: t.Optional(t.Boolean()) })
      ]),
      detail: {
        summary: "List a subdivision's cities",
        description:
          'Excludes neighbourhoods and contained arrondissements by default. Asking ' +
          'V1 for cities in Provence-Alpes-Côte d’Azur returned 170 PPLX sections of ' +
          'Marseille alongside the real cities.',
        tags: ['Places']
      }
    }
  )

  /* ---- places ---------------------------------------------------------- */

  .get(
    '/cities/:ref',
    ({ params, query }) => {
      const db = getDb();
      const row = unwrap(
        resolvePlace(db, params.ref, { countryIso2: query.country }),
        'city',
        params.ref
      );
      const place = shapePlace(row);
      place.name =
        localizedName(db, ENTITY_PLACE, String(row.geonames_id), query.locale) ?? place.name;
      const body: Record<string, unknown> = project(place, parseFields(query.fields));
      if (wants(query.include, 'names')) {
        body.names = allNames(db, ENTITY_PLACE, String(row.geonames_id));
      }
      return envelope(body);
    },
    {
      params: t.Object({ ref: t.String({ examples: ['Marseille', '2995469'] }) }),
      query: t.Composite([
        detailQuery,
        t.Object({
          country: t.Optional(
            t.String({ description: 'Scope the lookup, which usually resolves ambiguity.' })
          )
        })
      ]),
      detail: { summary: 'Get one city', tags: ['Places'] }
    }
  )

  .get(
    '/cities/:ref/neighbourhoods',
    ({ params, query }) => {
      const db = getDb();
      const city = unwrap(resolvePlace(db, params.ref), 'city', params.ref);
      const page = listPlaces(db, {
        parentPlaceId: city.geonames_id,
        citiesOnly: false,
        limit: query.limit,
        cursor: query.cursor,
        fields: parseFields(query.fields)
      });
      return envelope(page.data, {
        city: city.geonames_id,
        total: page.total,
        nextCursor: page.nextCursor
      });
    },
    {
      params: t.Object({ ref: t.String() }),
      query: listQuery,
      detail: {
        summary: "List a city's neighbourhoods and arrondissements",
        description:
          'The places excluded from the city list. Keeping them addressable here is why ' +
          'the fix for issue #242 loses no data: Marseille has 16 arrondissements and ' +
          'they are reachable, just not as cities.',
        tags: ['Places']
      }
    }
  )

  .get(
    '/search/cities',
    ({ query }) => {
      const results = searchPlaces(getDb(), query.q, {
        countryIso2: query.country,
        limit: query.limit
      });
      return envelope(results, { query: query.q });
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1, description: 'Prefix, matched accent-insensitively.' }),
        country: t.Optional(t.String()),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 }))
      }),
      detail: { summary: 'Search cities by name prefix', tags: ['Places'] }
    }
  )

  /* ---- reference ------------------------------------------------------- */

  .get('/currencies', () => envelope(listCurrencies(getDb())), {
    detail: {
      summary: 'List ISO 4217 currencies',
      description:
        'From the SIX register, the ISO 4217 maintenance agency. Includes withdrawn codes, ' +
        'flagged with `isHistorical` and `withdrawnDate`.',
      tags: ['Reference']
    }
  })

  .get(
    '/dataset',
    () => {
      const meta = getMeta();
      return {
        version: meta.datasetVersion,
        builtAt: meta.builtAt,
        schemaVersion: meta.schemaVersion,
        sourceVersions: meta.sourceVersions,
        artifactBytes: meta.bytes
      };
    },
    {
      detail: {
        summary: 'Dataset provenance',
        description:
          'Which version is being served and which upstream snapshot each source came from. ' +
          'The ETag on every response is derived from `version`.',
        tags: ['Reference']
      }
    }
  );

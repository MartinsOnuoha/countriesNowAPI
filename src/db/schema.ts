/** Postgres curation schema; releases compile to SQLite artifact. */

import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/* Shared column helpers                                                       */
/* -------------------------------------------------------------------------- */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
};

/** Entity kinds addressable by the `names` and `field_provenance` tables. */
export const ENTITY_TYPES = ['country', 'subdivision', 'place', 'currency'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Countries                                                                   */
/* -------------------------------------------------------------------------- */

export const countries = pgTable(
  'countries',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Identity. iso2 is the natural key; everything else joins through it.
    iso2: char('iso2', { length: 2 }).notNull(),
    iso3: char('iso3', { length: 3 }),
    isoNumeric: char('iso_numeric', { length: 3 }),
    geonamesId: integer('geonames_id'),
    wikidataQid: text('wikidata_qid'),
    m49: char('m49', { length: 3 }),

    // Names are kept apart on purpose. ISO's wording is politically loaded
    // ("Taiwan, Province of China"); CLDR's is what a UI should render. Serving
    // `displayName` by default lets us cite a standards body either way instead
    // of taking a position. See docs/DATA_POLICY.md.
    isoOfficialName: text('iso_official_name').notNull(),
    displayName: text('display_name').notNull(),
    commonName: text('common_name'),

    // Status. `isoAssigned` is false only for user-assigned codes such as XK,
    // which we emit because GeoNames/CLDR/libphonenumber/ITU all effectively do.
    isoStatus: text('iso_status'),
    isoAssigned: boolean('iso_assigned').notNull().default(true),
    independent: boolean('independent'),
    unMember: boolean('un_member'),
    sovereigntyNote: text('sovereignty_note'),
    administeredBy: char('administered_by', { length: 2 }),

    // Geography
    capital: text('capital'),
    capitalGeonamesId: integer('capital_geonames_id'),
    continentCode: char('continent_code', { length: 2 }),
    region: text('region'),
    subregion: text('subregion'),
    tld: text('tld'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    areaKm2: doublePrecision('area_km2'),

    // Telephony (libphonenumber). `dialRoot` + `dialSuffixes` models shared
    // codes such as +1 correctly; `dialCode` is the flat form v0.1 clients want.
    dialCode: text('dial_code'),
    dialRoot: text('dial_root'),
    dialSuffixes: jsonb('dial_suffixes').$type<string[]>(),

    // Currency. The full set lives in country_currencies; this is the one a
    // single-valued response should show.
    primaryCurrency: char('primary_currency', { length: 3 }),

    // Flags are always URLs, never bytes. Serving SVG payloads inline would
    // undo the "lighter application sizes" promise the project is built on.
    flagEmoji: text('flag_emoji'),
    flagSvgUrl: text('flag_svg_url'),
    flagSvgSquareUrl: text('flag_svg_square_url'),

    // Population always travels with its year. Unlabelled numbers were one of
    // V1's biggest credibility problems.
    population: bigint('population', { mode: 'number' }),
    populationYear: integer('population_year'),

    ...timestamps
  },
  (t) => [
    uniqueIndex('countries_iso2_key').on(t.iso2),
    uniqueIndex('countries_iso3_key').on(t.iso3),
    uniqueIndex('countries_geonames_key').on(t.geonamesId),
    index('countries_display_name_idx').on(t.displayName)
  ]
);

/* -------------------------------------------------------------------------- */
/* Currencies (ISO 4217, from the SIX register)                                */
/* -------------------------------------------------------------------------- */

export const currencies = pgTable('currencies', {
  code: char('code', { length: 3 }).primaryKey(),
  numericCode: char('numeric_code', { length: 3 }),
  name: text('name').notNull(),
  minorUnits: integer('minor_units'),
  symbol: text('symbol'),
  /** True once the code moves to SIX "List Three" (historical). */
  isHistorical: boolean('is_historical').notNull().default(false),
  withdrawnDate: text('withdrawn_date'),
  ...timestamps
});

/**
 * A country can legitimately have several currencies — 14 entities in the SIX
 * register do, and some of those are funds codes (CLF, MXV, USN) rather than
 * circulating cash. V1 modelled this as a single string, which is why it could
 * not represent the change cleanly.
 */
export const countryCurrencies = pgTable(
  'country_currencies',
  {
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    currencyCode: char('currency_code', { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: 'restrict', onUpdate: 'cascade' }),
    isFund: boolean('is_fund').notNull().default(false),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps
  },
  (t) => [
    primaryKey({ columns: [t.countryId, t.currencyCode] }),
    index('country_currencies_currency_idx').on(t.currencyCode)
  ]
);

/* -------------------------------------------------------------------------- */
/* Subdivisions (ISO 3166-2)                                                   */
/* -------------------------------------------------------------------------- */

export const subdivisions = pgTable(
  'subdivisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    /** Full ISO 3166-2 code, e.g. "FR-PAC". Globally unique. */
    iso3166_2: text('iso_3166_2'),
    /** Local part of the code, e.g. "PAC". Unique within the country. */
    code: text('code').notNull(),

    /**
     * Self-reference gives us the hierarchy ISO does not publish. This is what
     * lets Sri Lanka expose 9 provinces at level 1 with districts beneath them
     * rather than flattening both into one list (issue #229), and what keeps
     * French departments from masquerading as regions (issue #227).
     */
    parentId: uuid('parent_id').references((): AnyPgColumn => subdivisions.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
    level: integer('level').notNull().default(1),
    /** ISO's own category string, e.g. "metropolitan region", "province". */
    type: text('type'),

    name: text('name').notNull(),
    displayName: text('display_name'),

    geonamesId: integer('geonames_id'),
    geonamesAdmin1: text('geonames_admin1'),
    wikidataQid: text('wikidata_qid'),

    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    timezone: text('timezone'),
    population: bigint('population', { mode: 'number' }),
    populationYear: integer('population_year'),

    ...timestamps
  },
  (t) => [
    uniqueIndex('subdivisions_iso_key').on(t.iso3166_2),
    uniqueIndex('subdivisions_country_code_key').on(t.countryId, t.code),
    index('subdivisions_country_idx').on(t.countryId),
    index('subdivisions_parent_idx').on(t.parentId),
    index('subdivisions_admin1_idx').on(t.countryId, t.geonamesAdmin1)
  ]
);

/* -------------------------------------------------------------------------- */
/* Places (GeoNames P-class)                                                   */
/* -------------------------------------------------------------------------- */

export const places = pgTable(
  'places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    geonamesId: integer('geonames_id').notNull(),

    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    subdivisionId: uuid('subdivision_id').references(() => subdivisions.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),

    /**
     * Set when this place sits inside a larger populated place — a PPLX
     * neighbourhood or a PPLA5 arrondissement. Issue #242 ("API returns
     * neighborhoods instead of cities") is exactly a missing distinction here:
     * Marseille's Mazargues is PPLX and Marseille 08 is PPLA5, and V1 returned
     * both as cities. We keep them and expose them as children instead of
     * deleting them.
     */
    parentPlaceId: uuid('parent_place_id').references((): AnyPgColumn => places.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),

    name: text('name').notNull(),
    asciiName: text('ascii_name'),

    featureClass: char('feature_class', { length: 1 }).notNull(),
    featureCode: text('feature_code').notNull(),
    /** Result of the feature-code policy in harness/policy/places.ts. */
    isCity: boolean('is_city').notNull().default(false),

    admin1Code: text('admin1_code'),
    admin2Code: text('admin2_code'),

    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    elevation: integer('elevation'),
    timezone: text('timezone'),

    population: bigint('population', { mode: 'number' }),
    populationYear: integer('population_year'),

    ...timestamps
  },
  (t) => [
    uniqueIndex('places_geonames_key').on(t.geonamesId),
    index('places_country_idx').on(t.countryId),
    index('places_subdivision_idx').on(t.subdivisionId),
    index('places_parent_idx').on(t.parentPlaceId),
    index('places_city_idx').on(t.countryId, t.isCity),
    index('places_feature_idx').on(t.featureCode)
  ]
);

/* -------------------------------------------------------------------------- */
/* Names: aliases and localization in one table                                */
/* -------------------------------------------------------------------------- */

export const NAME_KINDS = [
  'iso-official',
  'cldr-display',
  'common',
  'short',
  'variant',
  'historical',
  'alias',
  'ascii'
] as const;
export type NameKind = (typeof NAME_KINDS)[number];

/**
 * One table serving three jobs that V1 handled with none:
 *
 *   - localization (issue #215) via `locale`
 *   - alias resolution, so "Ivory Coast" and "Côte d'Ivoire" agree
 *   - accent-insensitive lookup via `folded`
 *
 * `folded` is the NFKD-normalised, mark-stripped, casefolded, punctuation-
 * collapsed form produced by src/serving/normalize.ts. V1 compared with
 * `.toLowerCase()` only, which is why `?country=Réunion` worked and
 * `?country=Reunion` returned 404.
 *
 * `locale` is 'und' for entries that are not language-specific (aliases,
 * ASCII forms, historical spellings).
 */
export const names = pgTable(
  'names',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').$type<EntityType>().notNull(),
    entityId: uuid('entity_id').notNull(),

    locale: text('locale').notNull().default('und'),
    name: text('name').notNull(),
    folded: text('folded').notNull(),
    kind: text('kind').$type<NameKind>().notNull(),
    isPreferred: boolean('is_preferred').notNull().default(false),
    source: text('source').notNull(),

    ...timestamps
  },
  (t) => [
    // The hot lookup path: fold the caller's input, probe this index.
    index('names_lookup_idx').on(t.entityType, t.folded),
    index('names_entity_idx').on(t.entityType, t.entityId),
    index('names_locale_idx').on(t.entityType, t.locale),
    uniqueIndex('names_unique_key').on(t.entityType, t.entityId, t.locale, t.kind, t.name)
  ]
);

/* -------------------------------------------------------------------------- */
/* Provenance                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One row per (entity, field). This is what makes the AI layer auditable rather
 * than just another source of drift: a proposal can be rejected on the grounds
 * that the field it wants to change came from a more authoritative source more
 * recently than the evidence it cites.
 */
export const fieldProvenance = pgTable(
  'field_provenance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').$type<EntityType>().notNull(),
    entityId: uuid('entity_id').notNull(),
    field: text('field').notNull(),

    valueText: text('value_text'),
    source: text('source').notNull(),
    sourceVersion: text('source_version'),
    sourceUrl: text('source_url'),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
    confidence: real('confidence').notNull().default(1),

    ...timestamps
  },
  (t) => [
    uniqueIndex('field_provenance_key').on(t.entityType, t.entityId, t.field),
    index('field_provenance_source_idx').on(t.source)
  ]
);

/* -------------------------------------------------------------------------- */
/* Pipeline bookkeeping                                                        */
/* -------------------------------------------------------------------------- */

/** One row per upstream pull. Content-addressed, so every claim is replayable. */
export const snapshots = pgTable(
  'snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: text('source').notNull(),
    version: text('version').notNull(),
    url: text('url'),
    sha256: char('sha256', { length: 64 }).notNull(),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    ...timestamps
  },
  (t) => [
    uniqueIndex('snapshots_source_sha_key').on(t.source, t.sha256),
    index('snapshots_source_idx').on(t.source, t.fetchedAt)
  ]
);

/** One row per published release. */
export const datasets = pgTable(
  'datasets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    version: text('version').notNull(),
    builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
    artifactSha256: char('artifact_sha256', { length: 64 }),
    artifactBytes: bigint('artifact_bytes', { mode: 'number' }),
    sourceVersions: jsonb('source_versions').$type<Record<string, string>>(),
    gateReport: jsonb('gate_report').$type<Record<string, unknown>>(),
    published: boolean('published').notNull().default(false),
    ...timestamps
  },
  (t) => [uniqueIndex('datasets_version_key').on(t.version)]
);

export const ANOMALY_STATUSES = ['open', 'proposed', 'accepted', 'rejected', 'suppressed'] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

/** Output of the deterministic DETECT stage. No model has run at this point. */
export const anomalies = pgTable(
  'anomalies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Stable hash of (kind, entityRef, field) so re-runs do not duplicate. */
    fingerprint: text('fingerprint').notNull(),
    kind: text('kind').notNull(),
    entityType: text('entity_type').$type<EntityType>().notNull(),
    entityRef: text('entity_ref').notNull(),
    field: text('field'),
    severity: text('severity').notNull().default('medium'),
    summary: text('summary').notNull(),
    observed: jsonb('observed').$type<unknown>(),
    expected: jsonb('expected').$type<unknown>(),
    sources: jsonb('sources').$type<Record<string, unknown>>(),
    status: text('status').$type<AnomalyStatus>().notNull().default('open'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (t) => [
    uniqueIndex('anomalies_fingerprint_key').on(t.fingerprint),
    index('anomalies_status_idx').on(t.status, t.severity)
  ]
);

export const PROPOSAL_VERDICTS = ['upheld', 'refuted', 'inconclusive'] as const;
export type ProposalVerdict = (typeof PROPOSAL_VERDICTS)[number];

/**
 * Output of the agent. Note there is no path from here into the entity tables:
 * a proposal becomes data only by being applied as a patch, surviving the
 * deterministic gates, and being merged by a human.
 */
export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    anomalyId: uuid('anomaly_id')
      .notNull()
      .references(() => anomalies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    /** RFC 6902 JSON Patch against the canonical dataset. */
    patch: jsonb('patch').$type<unknown[]>().notNull(),
    rationale: text('rationale').notNull(),
    /** The falsifiable claim the HYPOTHESIZE stage committed to. */
    claim: text('claim').notNull(),
    evidence: jsonb('evidence').$type<unknown[]>(),

    verdict: text('verdict').$type<ProposalVerdict>(),
    refutation: text('refutation'),
    confidence: real('confidence'),

    hypothesisModel: text('hypothesis_model'),
    verifyModel: text('verify_model'),

    gatePassed: boolean('gate_passed'),
    gateReport: jsonb('gate_report').$type<Record<string, unknown>>(),
    prUrl: text('pr_url'),
    status: text('status').notNull().default('draft'),
    ...timestamps
  },
  (t) => [index('proposals_anomaly_idx').on(t.anomalyId), index('proposals_status_idx').on(t.status)]
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

export const countriesRelations = relations(countries, ({ many }) => ({
  subdivisions: many(subdivisions),
  places: many(places),
  currencies: many(countryCurrencies)
}));

export const subdivisionsRelations = relations(subdivisions, ({ one, many }) => ({
  country: one(countries, { fields: [subdivisions.countryId], references: [countries.id] }),
  parent: one(subdivisions, {
    fields: [subdivisions.parentId],
    references: [subdivisions.id],
    relationName: 'subdivision_parent'
  }),
  children: many(subdivisions, { relationName: 'subdivision_parent' }),
  places: many(places)
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  country: one(countries, { fields: [places.countryId], references: [countries.id] }),
  subdivision: one(subdivisions, {
    fields: [places.subdivisionId],
    references: [subdivisions.id]
  }),
  parent: one(places, {
    fields: [places.parentPlaceId],
    references: [places.id],
    relationName: 'place_parent'
  }),
  children: many(places, { relationName: 'place_parent' })
}));

export const countryCurrenciesRelations = relations(countryCurrencies, ({ one }) => ({
  country: one(countries, { fields: [countryCurrencies.countryId], references: [countries.id] }),
  currency: one(currencies, {
    fields: [countryCurrencies.currencyCode],
    references: [currencies.code]
  })
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  anomaly: one(anomalies, { fields: [proposals.anomalyId], references: [anomalies.id] })
}));

/** Convenience for `drizzle(client, { schema })`. */
export const schema = {
  countries,
  currencies,
  countryCurrencies,
  subdivisions,
  places,
  names,
  fieldProvenance,
  snapshots,
  datasets,
  anomalies,
  proposals,
  countriesRelations,
  subdivisionsRelations,
  placesRelations,
  countryCurrenciesRelations,
  proposalsRelations
};

/** Emitted so the harness can reference the same literal SQL Drizzle will. */
export const NOW = sql`now()`;

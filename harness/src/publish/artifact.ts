/** Build denormalized read-only SQLite artifact for API. */

import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import { foldTight } from '../../../src/serving/normalize.ts';
import type { Logger, ResolvedDataset } from '../types.ts';

export const ARTIFACT_SCHEMA_VERSION = 1;

const SCHEMA = `
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE countries (
  iso2               TEXT PRIMARY KEY,
  iso3               TEXT,
  iso_numeric        TEXT,
  m49                TEXT,
  geonames_id        INTEGER,
  wikidata_qid       TEXT,
  iso_official_name  TEXT NOT NULL,
  display_name       TEXT NOT NULL,
  common_name        TEXT,
  iso_status         TEXT,
  iso_assigned       INTEGER NOT NULL DEFAULT 1,
  independent        INTEGER,
  un_member          INTEGER,
  sovereignty_note   TEXT,
  capital            TEXT,
  continent_code     TEXT,
  region             TEXT,
  subregion          TEXT,
  tld                TEXT,
  area_km2           REAL,
  latitude           REAL,
  longitude          REAL,
  dial_code          TEXT,
  dial_root          TEXT,
  dial_suffixes      TEXT,
  primary_currency   TEXT,
  currencies         TEXT,
  flag_emoji         TEXT,
  flag_svg_url       TEXT,
  flag_svg_square_url       TEXT,
  population         INTEGER,
  population_year    INTEGER
);

CREATE TABLE currencies (
  code          TEXT PRIMARY KEY,
  numeric_code  TEXT,
  name          TEXT NOT NULL,
  minor_units   INTEGER,
  symbol        TEXT,
  is_historical INTEGER NOT NULL DEFAULT 0,
  withdrawn_date TEXT
);

CREATE TABLE subdivisions (
  id            INTEGER PRIMARY KEY,
  country_iso2  TEXT NOT NULL,
  iso_3166_2    TEXT,
  code          TEXT NOT NULL,
  parent_code   TEXT,
  level         INTEGER NOT NULL DEFAULT 1,
  type          TEXT,
  name          TEXT NOT NULL,
  display_name  TEXT,
  geonames_id   INTEGER,
  geonames_admin1 TEXT,
  latitude      REAL,
  longitude     REAL,
  timezone      TEXT,
  population    INTEGER
);

CREATE TABLE places (
  geonames_id     INTEGER PRIMARY KEY,
  country_iso2    TEXT NOT NULL,
  subdivision_id  INTEGER,
  parent_place_id INTEGER,
  name            TEXT NOT NULL,
  ascii_name      TEXT,
  feature_class   TEXT NOT NULL,
  feature_code    TEXT NOT NULL,
  is_city         INTEGER NOT NULL DEFAULT 0,
  admin1_code     TEXT,
  admin2_code     TEXT,
  latitude        REAL,
  longitude       REAL,
  elevation       INTEGER,
  timezone        TEXT,
  population      INTEGER,
  population_year INTEGER
);

-- entity_type: 0 country, 1 subdivision, 2 place, 3 currency.
-- Integers rather than strings: this is the largest table in the artifact and
-- the lookup index is the hottest path in the API.
CREATE TABLE names (
  entity_type  INTEGER NOT NULL,
  entity_key   TEXT NOT NULL,
  locale       TEXT NOT NULL,
  name         TEXT NOT NULL,
  folded       TEXT NOT NULL,
  folded_tight TEXT NOT NULL,
  kind         TEXT NOT NULL,
  is_preferred INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE provenance (
  entity_type    TEXT NOT NULL,
  entity_ref     TEXT NOT NULL,
  field          TEXT NOT NULL,
  value_text     TEXT,
  source         TEXT NOT NULL,
  source_version TEXT,
  retrieved_at   TEXT NOT NULL,
  confidence     REAL NOT NULL DEFAULT 1
);
`;

const INDEXES = `
CREATE INDEX idx_countries_iso3        ON countries(iso3);
CREATE INDEX idx_countries_geonames    ON countries(geonames_id);

CREATE INDEX idx_sub_country           ON subdivisions(country_iso2);
CREATE INDEX idx_sub_iso               ON subdivisions(iso_3166_2);
CREATE INDEX idx_sub_country_code      ON subdivisions(country_iso2, code);
CREATE INDEX idx_sub_parent            ON subdivisions(country_iso2, parent_code);

CREATE INDEX idx_places_country_city   ON places(country_iso2, is_city);
CREATE INDEX idx_places_sub_city       ON places(subdivision_id, is_city);
CREATE INDEX idx_places_parent         ON places(parent_place_id);
CREATE INDEX idx_places_name           ON places(name);

CREATE INDEX idx_names_lookup          ON names(entity_type, folded);
CREATE INDEX idx_names_tight           ON names(entity_type, folded_tight);
CREATE INDEX idx_names_entity          ON names(entity_type, entity_key);
CREATE INDEX idx_names_locale          ON names(entity_type, entity_key, locale);

CREATE INDEX idx_prov_entity           ON provenance(entity_type, entity_ref);
`;

export const ENTITY_COUNTRY = 0;
export const ENTITY_SUBDIVISION = 1;
export const ENTITY_PLACE = 2;
export const ENTITY_CURRENCY = 3;

export interface PublishResult {
  path: string;
  version: string;
  sha256: string;
  bytes: number;
  counts: Record<string, number>;
  durationMs: number;
}

export async function publish(
  dataset: ResolvedDataset,
  log: Logger,
  outDir = config.artifactDir
): Promise<PublishResult> {
  const started = Date.now();
  await mkdir(outDir, { recursive: true });

  const finalPath = join(outDir, `countriesnow-${dataset.version}.sqlite`);
  const tmpPath = join(outDir, `.building-${dataset.version}.sqlite`);

  // Build to a temp path and rename at the end. A half-written artifact must
  // never be visible to the loader, which picks the newest matching file.
  for (const p of [tmpPath, `${tmpPath}-journal`, `${tmpPath}-wal`, `${tmpPath}-shm`]) {
    if (existsSync(p)) await rm(p, { force: true });
  }

  const db = new Database(tmpPath, { create: true });
  db.exec(SCHEMA);

  const tx = db.transaction(() => {
    /* -- meta ------------------------------------------------------------ */
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    meta.run('schema_version', String(ARTIFACT_SCHEMA_VERSION));
    meta.run('dataset_version', dataset.version);
    meta.run('built_at', dataset.builtAt);
    meta.run('source_versions', JSON.stringify(dataset.sourceVersions));
    meta.run('notes', JSON.stringify(dataset.notes.slice(0, 500)));

    /* -- countries ------------------------------------------------------- */
    const insCountry = db.prepare(`
      INSERT INTO countries (
        iso2, iso3, iso_numeric, m49, geonames_id, wikidata_qid,
        iso_official_name, display_name, common_name,
        iso_status, iso_assigned, independent, un_member, sovereignty_note,
        capital, continent_code, region, subregion, tld, area_km2,
        latitude, longitude,
        dial_code, dial_root, dial_suffixes, primary_currency, currencies,
        flag_emoji, flag_svg_url, flag_svg_square_url, population, population_year
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insName = db.prepare(`
      INSERT INTO names (entity_type, entity_key, locale, name, folded, folded_tight, kind, is_preferred)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of dataset.countries) {
      insCountry.run(
        c.iso2,
        c.iso3,
        c.isoNumeric,
        c.m49,
        c.geonamesId,
        c.wikidataQid,
        c.isoOfficialName,
        c.displayName,
        c.commonName,
        c.isoStatus,
        c.isoAssigned ? 1 : 0,
        c.independent === null ? null : c.independent ? 1 : 0,
        c.unMember === null ? null : c.unMember ? 1 : 0,
        c.sovereigntyNote,
        c.capital,
        c.continentCode,
        c.region,
        c.subregion,
        c.tld,
        c.areaKm2,
        c.latitude,
        c.longitude,
        c.dialCode,
        c.dialRoot,
        c.dialSuffixes ? JSON.stringify(c.dialSuffixes) : null,
        c.primaryCurrency,
        c.currencies.length ? JSON.stringify(c.currencies) : null,
        c.flagEmoji,
        c.flagSvgUrl,
        c.flagSvgSquareUrl,
        c.population,
        c.populationYear
      );

      for (const n of c.names) {
        insName.run(
          ENTITY_COUNTRY,
          c.iso2,
          n.locale,
          n.name,
          n.folded,
          foldTight(n.name),
          n.kind,
          n.isPreferred ? 1 : 0
        );
      }
    }

    /* -- currencies ------------------------------------------------------ */
    const insCurrency = db.prepare(`
      INSERT INTO currencies (code, numeric_code, name, minor_units, symbol, is_historical, withdrawn_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of dataset.currencies) {
      insCurrency.run(
        c.code,
        c.numericCode,
        c.name,
        c.minorUnits,
        c.symbol,
        c.isHistorical ? 1 : 0,
        c.withdrawnDate
      );
      insName.run(
        ENTITY_CURRENCY,
        c.code,
        'en',
        c.name,
        c.name.toLowerCase(),
        c.name.toLowerCase().replace(/\s/g, ''),
        'common',
        1
      );
    }

    /* -- subdivisions ---------------------------------------------------- */
    const insSub = db.prepare(`
      INSERT INTO subdivisions (
        id, country_iso2, iso_3166_2, code, parent_code, level, type,
        name, display_name, geonames_id, geonames_admin1, latitude, longitude,
        timezone, population
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Dense integer ids keep the places.subdivision_id join cheap; the stable
    // external identifier remains iso_3166_2.
    const subIds = new Map<string, number>();
    dataset.subdivisions.forEach((s, i) => subIds.set(`${s.countryIso2}|${s.code}`, i + 1));

    for (const [i, s] of dataset.subdivisions.entries()) {
      const id = i + 1;
      insSub.run(
        id,
        s.countryIso2,
        s.iso3166_2,
        s.code,
        s.parentCode,
        s.level,
        s.type,
        s.name,
        s.displayName,
        s.geonamesId,
        s.geonamesAdmin1,
        s.latitude,
        s.longitude,
        s.timezone,
        s.population
      );
      for (const n of s.names) {
        insName.run(
          ENTITY_SUBDIVISION,
          String(id),
          n.locale,
          n.name,
          n.folded,
          foldTight(n.name),
          n.kind,
          n.isPreferred ? 1 : 0
        );
      }
    }

    /* -- places ---------------------------------------------------------- */
    const insPlace = db.prepare(`
      INSERT INTO places (
        geonames_id, country_iso2, subdivision_id, parent_place_id, name, ascii_name,
        feature_class, feature_code, is_city, admin1_code, admin2_code,
        latitude, longitude, elevation, timezone, population, population_year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of dataset.places) {
      const subId = p.subdivisionCode
        ? (subIds.get(`${p.countryIso2}|${p.subdivisionCode}`) ?? null)
        : null;
      insPlace.run(
        p.geonamesId,
        p.countryIso2,
        subId,
        p.parentGeonamesId,
        p.name,
        p.asciiName,
        p.featureClass,
        p.featureCode,
        p.isCity ? 1 : 0,
        p.admin1Code,
        p.admin2Code,
        p.latitude,
        p.longitude,
        p.elevation,
        p.timezone,
        p.population,
        p.populationYear
      );
      for (const n of p.names) {
        insName.run(
          ENTITY_PLACE,
          String(p.geonamesId),
          n.locale,
          n.name,
          n.folded,
          foldTight(n.name),
          n.kind,
          n.isPreferred ? 1 : 0
        );
      }
    }

    /* -- provenance ------------------------------------------------------ */
    const insProv = db.prepare(`
      INSERT INTO provenance (entity_type, entity_ref, field, value_text, source, source_version, retrieved_at, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of dataset.provenance) {
      insProv.run(
        p.entityType,
        p.entityRef,
        p.field,
        p.valueText,
        p.source,
        p.sourceVersion,
        p.retrievedAt,
        p.confidence
      );
    }
  });

  tx();

  log.debug('building indexes');
  db.exec(INDEXES);

  // ANALYZE lets the query planner pick the right index for the name lookup,
  // which matters because `folded` is highly selective and `entity_type` is not.
  db.exec('ANALYZE');
  db.exec('VACUUM');

  const counts = {
    countries: (db.query('SELECT count(*) AS n FROM countries').get() as { n: number }).n,
    subdivisions: (db.query('SELECT count(*) AS n FROM subdivisions').get() as { n: number }).n,
    places: (db.query('SELECT count(*) AS n FROM places').get() as { n: number }).n,
    cities: (db.query('SELECT count(*) AS n FROM places WHERE is_city = 1').get() as { n: number })
      .n,
    currencies: (db.query('SELECT count(*) AS n FROM currencies').get() as { n: number }).n,
    names: (db.query('SELECT count(*) AS n FROM names').get() as { n: number }).n,
    provenance: (db.query('SELECT count(*) AS n FROM provenance').get() as { n: number }).n
  };

  db.close();

  const bytes = (await stat(tmpPath)).size;
  const hash = createHash('sha256');
  hash.update(new Uint8Array(await Bun.file(tmpPath).arrayBuffer()));
  const sha256 = hash.digest('hex');

  if (existsSync(finalPath)) await rm(finalPath, { force: true });
  await rename(tmpPath, finalPath);

  const result: PublishResult = {
    path: finalPath,
    version: dataset.version,
    sha256,
    bytes,
    counts,
    durationMs: Date.now() - started
  };

  await Bun.write(
    join(outDir, `countriesnow-${dataset.version}.json`),
    `${JSON.stringify(
      {
        version: result.version,
        builtAt: dataset.builtAt,
        sha256: result.sha256,
        bytes: result.bytes,
        counts: result.counts,
        sourceVersions: dataset.sourceVersions
      },
      null,
      2
    )}\n`
  );

  return result;
}

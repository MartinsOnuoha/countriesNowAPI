/** GeoNames places/hierarchy; currency/names excluded per precedence.yaml. */

import { fold } from '../../../src/serving/normalize.ts';
import { config } from '../config.ts';
import { fetchArtifact, readSnapshot, readSnapshotText } from '../snapshot/store.ts';
import { extractOne } from '../snapshot/zip.ts';
import { decideCity, SUBPLACE_FEATURE_CODES } from '../../policy/places.ts';
import type { FetchContext, NameRecord, Snapshot, SourceAdapter } from '../types.ts';

const BASE = 'https://download.geonames.org/export/dump';

export interface GeoCountryInfo {
  iso2: string;
  iso3: string | null;
  isoNumeric: string | null;
  name: string;
  capital: string | null;
  areaKm2: number | null;
  population: number | null;
  continent: string | null;
  tld: string | null;
  phone: string | null;
  languages: string[];
  geonamesId: number | null;
  neighbours: string[];
}

export interface GeoAdmin1 {
  /** "FR.93" — country code and the GeoNames admin1 code. */
  key: string;
  countryIso2: string;
  admin1Code: string;
  name: string;
  asciiName: string;
  geonamesId: number;
}

export interface GeoPlace {
  geonamesId: number;
  name: string;
  asciiName: string;
  alternateNames: string[];
  latitude: number | null;
  longitude: number | null;
  featureClass: string;
  featureCode: string;
  countryIso2: string;
  admin1Code: string | null;
  admin2Code: string | null;
  population: number | null;
  elevation: number | null;
  timezone: string | null;
  modifiedAt: string | null;
  /** Filled in from hierarchy.txt, then fed to the city policy. */
  parentGeonamesId: number | null;
  isCity: boolean;
  cityReason: string;
}

export interface GeonamesData {
  version: string;
  tier: string;
  countries: GeoCountryInfo[];
  admin1: GeoAdmin1[];
  places: GeoPlace[];
}

const nz = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};
const numOrNull = (v: string | undefined): number | null => {
  const t = v?.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export const geonames: SourceAdapter<GeonamesData> = {
  id: 'geonames',
  title: 'GeoNames',
  cadence: 'daily, with modifications-*.txt / deletes-*.txt deltas',
  license: {
    spdx: 'CC-BY-4.0',
    url: 'https://www.geonames.org/',
    attribution: 'Place data from GeoNames (https://www.geonames.org/), CC BY 4.0.',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    const tier = config.geonamesTier;
    const out: Snapshot[] = [];

    for (const [artifact, url] of [
      ['countryInfo.txt', `${BASE}/countryInfo.txt`],
      ['admin1CodesASCII.txt', `${BASE}/admin1CodesASCII.txt`],
      [`${tier}.zip`, `${BASE}/${tier}.zip`],
      ['hierarchy.zip', `${BASE}/hierarchy.zip`]
    ] as const) {
      out.push(
        await fetchArtifact({
          source: 'geonames',
          artifact,
          url,
          offline: ctx.offline,
          log: ctx.log,
          // allCountries.zip is 400 MB and the mirror is not always quick.
          timeoutMs: 15 * 60_000
        })
      );
    }
    return out;
  },

  async parse(snapshots: Snapshot[], ctx: FetchContext): Promise<GeonamesData> {
    const by = (name: string) => {
      const s = snapshots.find((x) => x.artifact === name);
      if (!s) throw new Error(`geonames: missing snapshot ${name}`);
      return s;
    };

    const tier = config.geonamesTier;

    const countries = parseCountryInfo(await readSnapshotText(by('countryInfo.txt')));
    const admin1 = parseAdmin1(await readSnapshotText(by('admin1CodesASCII.txt')));

    const placesZip = await readSnapshot(by(`${tier}.zip`));
    const placesTsv = new TextDecoder().decode(extractOne(placesZip, `${tier}.txt`).data);
    const places = parsePlaces(placesTsv);

    // Apply hierarchy.txt before city policy (#242 containment).
    const hierarchyZip = await readSnapshot(by('hierarchy.zip'));
    const hierarchyTsv = new TextDecoder().decode(extractOne(hierarchyZip, 'hierarchy.txt').data);
    applyHierarchy(places, hierarchyTsv);

    const cityCount = places.filter((p) => p.isCity).length;
    ctx.log.debug(
      `geonames: ${places.length} places from ${tier}, ${cityCount} classified as cities ` +
        `(${places.length - cityCount} excluded as neighbourhoods, arrondissements or non-places)`
    );

    return {
      version: by(`${tier}.zip`).version,
      tier,
      countries,
      admin1,
      places
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Parsers                                                                     */
/* -------------------------------------------------------------------------- */

export function parseCountryInfo(text: string): GeoCountryInfo[] {
  const out: GeoCountryInfo[] = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    const iso2 = nz(f[0]);
    if (!iso2) continue;
    out.push({
      iso2: iso2.toUpperCase(),
      iso3: nz(f[1]),
      isoNumeric: nz(f[2]),
      name: nz(f[4]) ?? iso2,
      capital: nz(f[5]),
      areaKm2: numOrNull(f[6]),
      population: numOrNull(f[7]),
      continent: nz(f[8]),
      tld: nz(f[9]),
      // f[10] CurrencyCode and f[11] CurrencyName are read but never used —
      // see the note at the top of this file and precedence.yaml.
      phone: nz(f[12]),
      languages: nz(f[15])?.split(',').filter(Boolean) ?? [],
      geonamesId: numOrNull(f[16]),
      neighbours: nz(f[17])?.split(',').filter(Boolean) ?? []
    });
  }
  return out;
}

export function parseAdmin1(text: string): GeoAdmin1[] {
  const out: GeoAdmin1[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const f = line.split('\t');
    const key = nz(f[0]);
    const id = numOrNull(f[3]);
    if (!key || id === null) continue;
    const [country, admin1] = key.split('.');
    if (!country || !admin1) continue;
    out.push({
      key,
      countryIso2: country.toUpperCase(),
      admin1Code: admin1,
      name: nz(f[1]) ?? admin1,
      asciiName: nz(f[2]) ?? admin1,
      geonamesId: id
    });
  }
  return out;
}

/** The 19-column GeoNames dump format. */
export function parsePlaces(text: string): GeoPlace[] {
  const out: GeoPlace[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    const id = numOrNull(f[0]);
    const iso2 = nz(f[8]);
    const featureClass = nz(f[6]);
    const featureCode = nz(f[7]);
    if (id === null || !iso2 || !featureClass || !featureCode) continue;

    const place: GeoPlace = {
      geonamesId: id,
      name: nz(f[1]) ?? '',
      asciiName: nz(f[2]) ?? '',
      alternateNames: nz(f[3])?.split(',').filter(Boolean) ?? [],
      latitude: numOrNull(f[4]),
      longitude: numOrNull(f[5]),
      featureClass,
      featureCode,
      countryIso2: iso2.toUpperCase(),
      admin1Code: nz(f[10]),
      admin2Code: nz(f[11]),
      population: numOrNull(f[14]),
      elevation: numOrNull(f[15]),
      timezone: nz(f[17]),
      modifiedAt: nz(f[18]),
      parentGeonamesId: null,
      isCity: false,
      cityReason: 'not yet classified'
    };
    if (!place.name) continue;
    out.push(place);
  }
  return out;
}

/**
 * Link sub-places to their containing city, then classify.
 *
 * hierarchy.txt is `parentId <tab> childId <tab> type`, covering the whole
 * GeoNames graph. We only care about edges whose child is one of the sub-place
 * codes (PPLX, PPLA4, PPLA5) and whose parent is a populated place we also
 * hold — that is precisely the Marseille-and-its-arrondissements relationship
 * behind issue #242.
 */
export function applyHierarchy(places: GeoPlace[], hierarchyTsv: string): void {
  const byId = new Map<number, GeoPlace>();
  for (const p of places) byId.set(p.geonamesId, p);

  for (const line of hierarchyTsv.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    const parentId = numOrNull(f[0]);
    const childId = numOrNull(f[1]);
    if (parentId === null || childId === null) continue;

    const child = byId.get(childId);
    if (!child || !SUBPLACE_FEATURE_CODES.has(child.featureCode)) continue;

    const parent = byId.get(parentId);
    if (!parent || parent.featureClass !== 'P') continue;

    child.parentGeonamesId = parentId;
  }

  for (const p of places) {
    const decision = decideCity({
      featureClass: p.featureClass,
      featureCode: p.featureCode,
      containedInPopulatedPlace: p.parentGeonamesId !== null
    });
    p.isCity = decision.isCity;
    p.cityReason = decision.reason;
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A place's own names. The comma-separated `alternatenames` column in the main
 * dump is unlabelled by language, so entries land as locale-neutral aliases;
 * the properly tagged forms come from alternateNamesV2 in the Tier 1 adapter.
 */
export function placeNames(place: GeoPlace, limit = 12): NameRecord[] {
  const out: NameRecord[] = [];
  const seen = new Set<string>();

  const add = (name: string, kind: NameRecord['kind'], preferred = false) => {
    const folded = fold(name);
    if (!folded || seen.has(folded)) return;
    seen.add(folded);
    out.push({ locale: 'und', name, folded, kind, isPreferred: preferred, source: 'geonames' });
  };

  add(place.name, 'common', true);
  if (place.asciiName && place.asciiName !== place.name) add(place.asciiName, 'ascii');
  // Capped: a large city can carry hundreds of alternates, and the tail is
  // mostly transliterations that alternateNamesV2 covers with proper locales.
  for (const alt of place.alternateNames.slice(0, limit)) add(alt, 'alias');

  return out;
}

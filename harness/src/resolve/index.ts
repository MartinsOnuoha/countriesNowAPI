/** Merge source adapters into one dataset via precedence.yaml. */

import { fold } from '../../../src/serving/normalize.ts';
import {
  MANUAL_ALIASES,
  POLICY_VERSION,
  SUPPRESSED_ENTITIES,
  TERRITORY_EXCEPTIONS
} from '../../policy/territories.ts';
import type {
  CurrencyLink,
  Logger,
  NameRecord,
  ProvenanceRecord,
  ResolveNote,
  ResolvedCountry,
  ResolvedCurrency,
  ResolvedDataset,
  ResolvedPlace,
  ResolvedSubdivision,
  SourceId
} from '../types.ts';
import { pick, provenanceFor } from './precedence.ts';
import {
  isoCountryNames,
  retiredNames,
  splitSubdivisionCode,
  type IsoCodesData
} from '../sources/iso-codes.ts';
import { crosswalkNames, type CountryCodesData } from '../sources/country-codes.ts';
import { placeNames, type GeoAdmin1, type GeonamesData } from '../sources/geonames.ts';
import type { SixData } from '../sources/six-4217.ts';
import type { LibPhoneData } from '../sources/libphonenumber.ts';
import type { CldrData } from '../sources/cldr.ts';
import type { FlagIconsData } from '../sources/flag-icons.ts';
import type { WorldBankData } from '../sources/world-bank.ts';

export interface ResolveInput {
  isoCodes: IsoCodesData;
  countryCodes: CountryCodesData;
  geonames: GeonamesData;
  six?: SixData;
  libphone?: LibPhoneData;
  cldr?: CldrData;
  flags?: FlagIconsData;
  worldBank?: WorldBankData;
  log: Logger;
  version?: string;
}

/** A calendar-based release version, e.g. "2026.08.0". */
export function nextVersion(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}.${m}.0`;
}

export function resolveDataset(input: ResolveInput): ResolvedDataset {
  const { isoCodes, countryCodes, geonames, log } = input;
  const retrievedAt = new Date().toISOString();
  const notes: ResolveNote[] = [];
  const provenance: ProvenanceRecord[] = [];

  const record = (
    entityType: 'country' | 'subdivision' | 'place' | 'currency',
    ref: string,
    field: string,
    result: ReturnType<typeof pick>,
    sourceVersions: Partial<Record<SourceId, string>>
  ) => {
    const row = provenanceFor(entityType, ref, field, result, {
      sourceVersion: result.source ? sourceVersions[result.source] : undefined,
      retrievedAt
    });
    if (row) provenance.push(row);
    for (const conflict of result.conflicts) {
      notes.push({
        level: 'warn',
        source: 'resolver',
        entityRef: ref,
        message:
          `${entityType}.${field}: ${result.source} says ${JSON.stringify(result.value)}, ` +
          `${conflict.source} says ${JSON.stringify(conflict.value)}`
      });
    }
  };

  const sourceVersions: Record<string, string> = {
    'iso-codes': isoCodes.version,
    'country-codes': countryCodes.version,
    geonames: geonames.version,
    policy: POLICY_VERSION
  };
  if (input.six) sourceVersions['six-4217'] = input.six.version;
  if (input.libphone) sourceVersions['libphonenumber'] = input.libphone.version;
  if (input.cldr) sourceVersions['cldr'] = input.cldr.version;
  if (input.flags) sourceVersions['flag-icons'] = input.flags.version;
  if (input.worldBank) sourceVersions['world-bank'] = input.worldBank.version;

  /* ---------------------------------------------------------------------- */
  /* Index every source by ISO alpha-2                                       */
  /* ---------------------------------------------------------------------- */

  const isoByIso2 = new Map(isoCodes.countries.map((c) => [c.alpha_2.toUpperCase(), c]));
  const cwByIso2 = new Map(countryCodes.rows.map((r) => [r.iso2, r]));
  const geoByIso2 = new Map(geonames.countries.map((c) => [c.iso2, c]));
  const sixByIso2 = input.six?.byCountryIso2 ?? new Map();
  const phoneByIso2 = input.libphone?.byRegion ?? new Map();
  const flagByIso2 = input.flags?.byIso2 ?? new Map();
  const wbByIso3 = input.worldBank?.byIso3 ?? new Map();

  /* ---------------------------------------------------------------------- */
  /* Countries                                                               */
  /* ---------------------------------------------------------------------- */

  // ISO 3166-1 + policy exceptions; see territories.ts.
  const memberCodes = new Set<string>(isoByIso2.keys());
  for (const ex of TERRITORY_EXCEPTIONS) memberCodes.add(ex.iso2);
  for (const suppressed of SUPPRESSED_ENTITIES) memberCodes.delete(suppressed);

  const retiredByIso2 = new Map<string, NameRecord[]>();
  for (const { iso2, name } of retiredNames(isoCodes.retired)) {
    const list = retiredByIso2.get(iso2) ?? [];
    list.push(name);
    retiredByIso2.set(iso2, list);
  }

  const countries: ResolvedCountry[] = [];

  for (const iso2 of [...memberCodes].sort()) {
    const iso = isoByIso2.get(iso2);
    const cw = cwByIso2.get(iso2);
    const geo = geoByIso2.get(iso2);
    const exception = TERRITORY_EXCEPTIONS.find((t) => t.iso2 === iso2);
    const cldrNames = input.cldr?.territories.get(iso2);

    const f = <T>(field: string, candidates: Array<{ source: SourceId; value: T | null }>) => {
      const result = pick<T>('country', field, candidates);
      record('country', iso2, field, result, sourceVersions);
      return result.value;
    };

    // Policy/GeoNames names in precedence chain (provenance required).
    const isoOfficialName =
      f<string>('isoOfficialName', [
        { source: 'iso-codes', value: iso?.official_name ?? iso?.name ?? null },
        { source: 'country-codes', value: cw?.officialNameEn ?? null },
        { source: 'policy', value: exception?.isoOfficialName ?? null },
        { source: 'geonames', value: geo?.name ?? null }
      ]) ?? iso2;

    const displayName =
      f<string>('displayName', [
        { source: 'cldr', value: cldrNames?.en ?? null },
        { source: 'country-codes', value: cw?.cldrDisplayName ?? null },
        { source: 'iso-codes', value: iso?.common_name ?? iso?.name ?? null },
        { source: 'policy', value: exception?.displayName ?? null }
      ]) ?? isoOfficialName;

    const iso3 = f<string>('iso3', [
      { source: 'iso-codes', value: iso?.alpha_3 ?? null },
      { source: 'country-codes', value: cw?.iso3 ?? null },
      { source: 'geonames', value: geo?.iso3 ?? null }
    ]);

    const currencyLinks: CurrencyLink[] = sixByIso2.get(iso2) ?? [];
    const primaryCurrency =
      currencyLinks.find((c) => c.isPrimary)?.code ?? currencyLinks[0]?.code ?? null;
    if (currencyLinks.length > 0) {
      record(
        'country',
        iso2,
        'primaryCurrency',
        { value: primaryCurrency, source: 'six-4217', conflicts: [] },
        sourceVersions
      );
    }

    const phone = phoneByIso2.get(iso2);
    const flag = flagByIso2.get(iso2);
    const wb = iso3 ? wbByIso3.get(iso3) : undefined;

    const population = f<number>('population', [
      { source: 'world-bank', value: wb?.population ?? null },
      { source: 'geonames', value: geo?.population ?? null }
    ]);

    /* -- names ----------------------------------------------------------- */

    const names: NameRecord[] = [];
    const seen = new Set<string>();
    const addName = (n: NameRecord) => {
      const key = `${n.locale}|${n.folded}`;
      if (!n.folded || seen.has(key)) return;
      seen.add(key);
      names.push(n);
    };

    if (iso) isoCountryNames(iso).forEach(addName);
    if (cw) crosswalkNames(cw).forEach(addName);
    if (cldrNames) {
      for (const [locale, name] of Object.entries(cldrNames)) {
        addName({
          locale,
          name,
          folded: fold(name),
          kind: 'cldr-display',
          isPreferred: locale === 'en',
          source: 'cldr'
        });
      }
    }
    if (geo?.name) {
      addName({
        locale: 'und',
        name: geo.name,
        folded: fold(geo.name),
        kind: 'alias',
        isPreferred: false,
        source: 'geonames'
      });
    }
    retiredByIso2.get(iso2)?.forEach(addName);
    for (const alias of MANUAL_ALIASES[iso2] ?? []) {
      addName({
        locale: 'und',
        name: alias,
        folded: fold(alias),
        kind: 'alias',
        isPreferred: false,
        source: 'iso-codes'
      });
    }
    if (exception) {
      addName({
        locale: 'en',
        name: exception.displayName,
        folded: fold(exception.displayName),
        kind: 'common',
        isPreferred: true,
        source: 'geonames'
      });
    }

    countries.push({
      iso2,
      iso3,
      isoNumeric: f<string>('isoNumeric', [
        { source: 'iso-codes', value: iso?.numeric ?? null },
        { source: 'country-codes', value: cw?.isoNumeric ?? null }
      ]),
      geonamesId: f<number>('geonamesId', [
        { source: 'country-codes', value: cw?.geonamesId ?? null },
        { source: 'geonames', value: geo?.geonamesId ?? null }
      ]),
      wikidataQid: f<string>('wikidataQid', [
        { source: 'country-codes', value: cw?.wikidataQid ?? null }
      ]),
      m49: f<string>('m49', [{ source: 'country-codes', value: cw?.m49 ?? null }]),

      isoOfficialName,
      displayName,
      commonName: f<string>('commonName', [
        { source: 'iso-codes', value: iso?.common_name ?? null },
        { source: 'cldr', value: cldrNames?.en ?? null }
      ]),

      isoStatus: exception ? 'user-assigned' : iso ? 'officially-assigned' : null,
      isoAssigned: !exception,
      independent: cw?.isIndependent ? /^yes/i.test(cw.isIndependent) : null,
      unMember: cw?.isIndependent ? /^yes/i.test(cw.isIndependent) : null,
      sovereigntyNote: exception?.note ?? null,
      administeredBy: null,

      capital: f<string>('capital', [
        { source: 'geonames', value: geo?.capital ?? null },
        { source: 'country-codes', value: cw?.capital ?? null }
      ]),
      capitalGeonamesId: null,
      continentCode: f<string>('continentCode', [
        { source: 'geonames', value: geo?.continent ?? null },
        { source: 'country-codes', value: cw?.continent ?? null }
      ]),
      region: f<string>('region', [{ source: 'country-codes', value: cw?.regionName ?? null }]),
      subregion: f<string>('subregion', [
        { source: 'country-codes', value: cw?.subregionName ?? null }
      ]),
      tld: f<string>('tld', [
        { source: 'geonames', value: geo?.tld ?? null },
        { source: 'country-codes', value: cw?.tld ?? null }
      ]),
      latitude: null,
      longitude: null,
      areaKm2: f<number>('areaKm2', [{ source: 'geonames', value: geo?.areaKm2 ?? null }]),

      dialCode: f<string>('dialCode', [
        { source: 'libphonenumber', value: phone?.dialCode ?? null },
        { source: 'country-codes', value: cw?.dial ? `+${cw.dial.replace(/^\+/, '')}` : null },
        { source: 'geonames', value: geo?.phone ? `+${geo.phone.split(',')[0]}` : null }
      ]),
      dialRoot: phone?.root ?? null,
      dialSuffixes: phone?.suffixes ?? null,

      primaryCurrency,
      currencies: currencyLinks,

      flagEmoji: f<string>('flagEmoji', [
        { source: 'flag-icons', value: flag?.emoji ?? null },
        { source: 'iso-codes', value: iso?.flag ?? null }
      ]),
      flagSvgUrl: f<string>('flagSvgUrl', [{ source: 'flag-icons', value: flag?.svgUrl ?? null }]),
      flagSvgSquareUrl: f<string>('flagSvgSquareUrl', [{ source: 'flag-icons', value: flag?.svgSquareUrl ?? null }]),

      population,
      populationYear: wb?.year ?? null,

      names
    });
  }

  log.debug(`resolved ${countries.length} countries`);

  /* ---------------------------------------------------------------------- */
  /* Subdivisions                                                            */
  /* ---------------------------------------------------------------------- */

  const admin1ByCountry = new Map<string, typeof geonames.admin1>();
  for (const a of geonames.admin1) {
    const list = admin1ByCountry.get(a.countryIso2) ?? [];
    list.push(a);
    admin1ByCountry.set(a.countryIso2, list);
  }

  const subdivisions: ResolvedSubdivision[] = [];
  const subByIsoCode = new Map<string, ResolvedSubdivision>();

  for (const row of isoCodes.subdivisions) {
    const split = splitSubdivisionCode(row.code);
    if (!split) continue;
    if (!memberCodes.has(split.country)) continue;

    const cldrName = input.cldr?.subdivisions.get(row.code.toLowerCase().replace('-', ''));

    const sub: ResolvedSubdivision = {
      countryIso2: split.country,
      iso3166_2: row.code,
      code: split.local,
      parentCode: row.parent ? (splitSubdivisionCode(row.parent)?.local ?? null) : null,
      // ISO's own `parent` field gives the hierarchy directly: a French
      // department nests under its region, a Sri Lankan district under its
      // province. Respecting it is what retires issues #227 and #229.
      level: row.parent ? 2 : 1,
      type: row.type ?? null,
      name: row.name,
      displayName: cldrName ?? row.name,
      // Filled by the admin1 reconciliation pass below, which matches on name
      // rather than on code.
      geonamesId: null,
      geonamesAdmin1: null,
      wikidataQid: null,
      latitude: null,
      longitude: null,
      timezone: null,
      population: null,
      populationYear: null,
      names: []
    };

    const names: NameRecord[] = [];
    const seen = new Set<string>();
    const add = (name: string, locale: string, kind: NameRecord['kind'], source: SourceId) => {
      const folded = fold(name);
      const key = `${locale}|${folded}`;
      if (!folded || seen.has(key)) return;
      seen.add(key);
      names.push({ locale, name, folded, kind, isPreferred: kind === 'iso-official', source });
    };

    add(row.name, 'en', 'iso-official', 'iso-codes');
    if (cldrName) add(cldrName, 'en', 'cldr-display', 'cldr');
    // #42/#112/#143: register "X State" and bare ISO names as aliases.
    const SUBDIVISION_SUFFIX =
      /\s+(State|Province|Region|District|County|Prefecture|Governorate|Oblast|Department|Territory|Municipality|Parish|Canton|Emirate)$/i;

    const stripped = row.name.replace(SUBDIVISION_SUFFIX, '');
    if (stripped !== row.name && stripped.length > 1) add(stripped, 'und', 'variant', 'iso-codes');

    // Also alias suffixed forms callers stored from V1.
    if (row.type && !SUBDIVISION_SUFFIX.test(row.name)) {
      const suffixed = `${row.name} ${row.type}`;
      if (SUBDIVISION_SUFFIX.test(suffixed)) add(suffixed, 'und', 'variant', 'iso-codes');
    }

    sub.names = names;
    subdivisions.push(sub);
    subByIsoCode.set(row.code, sub);
  }

  log.debug(`resolved ${subdivisions.length} subdivisions`);

  /* ---------------------------------------------------------------------- */
  /* GeoNames admin1 reconciliation                                          */
  /* ---------------------------------------------------------------------- */

  reconcileAdmin1(subdivisions, admin1ByCountry, log);

  /* ---------------------------------------------------------------------- */
  /* Places                                                                  */
  /* ---------------------------------------------------------------------- */

  // admin1 -> ISO 3166-2 local code, per country. Built once so place linking
  // stays O(1) rather than rescanning subdivisions for every city.
  const admin1ToSub = new Map<string, string>();
  for (const sub of subdivisions) {
    if (sub.geonamesAdmin1) admin1ToSub.set(`${sub.countryIso2}.${sub.geonamesAdmin1}`, sub.code);
  }

  const places: ResolvedPlace[] = [];
  let orphaned = 0;

  for (const p of geonames.places) {
    if (!memberCodes.has(p.countryIso2)) continue;

    const subCode = p.admin1Code ? admin1ToSub.get(`${p.countryIso2}.${p.admin1Code}`) : undefined;
    if (!subCode && p.admin1Code) orphaned++;

    places.push({
      geonamesId: p.geonamesId,
      countryIso2: p.countryIso2,
      subdivisionCode: subCode ?? null,
      parentGeonamesId: p.parentGeonamesId,
      name: p.name,
      asciiName: p.asciiName || null,
      featureClass: p.featureClass,
      featureCode: p.featureCode,
      isCity: p.isCity,
      admin1Code: p.admin1Code,
      admin2Code: p.admin2Code,
      latitude: p.latitude,
      longitude: p.longitude,
      elevation: p.elevation,
      timezone: p.timezone,
      population: p.population,
      // GeoNames does not date its population figures. Recording null rather
      // than inventing a year is the honest option, and the API exposes the
      // difference instead of implying currency it cannot support.
      populationYear: null,
      names: placeNames(p)
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Country coordinates                                                     */
  /* ---------------------------------------------------------------------- */

  // Country coords: capital else population-weighted city centroid.
  const placesByCountry = new Map<string, ResolvedPlace[]>();
  for (const p of places) {
    if (!p.isCity) continue;
    const list = placesByCountry.get(p.countryIso2) ?? [];
    list.push(p);
    placesByCountry.set(p.countryIso2, list);
  }

  let fromCapital = 0;
  let fromCentroid = 0;

  for (const c of countries) {
    const cities = placesByCountry.get(c.iso2);
    if (!cities || cities.length === 0) continue;

    const capitalFolded = c.capital ? fold(c.capital) : null;
    const capital = capitalFolded
      ? cities.find((p) => fold(p.name) === capitalFolded || p.featureCode === 'PPLC')
      : cities.find((p) => p.featureCode === 'PPLC');

    if (capital?.latitude != null && capital.longitude != null) {
      c.latitude = capital.latitude;
      c.longitude = capital.longitude;
      c.capitalGeonamesId = capital.geonamesId;
      fromCapital++;
      provenance.push({
        entityType: 'country',
        entityRef: c.iso2,
        field: 'latitude',
        valueText: String(c.latitude),
        source: 'geonames',
        sourceVersion: sourceVersions.geonames ?? null,
        sourceUrl: `https://www.geonames.org/${capital.geonamesId}`,
        retrievedAt,
        confidence: 1
      });
      continue;
    }

    const withCoords = cities.filter((p) => p.latitude != null && p.longitude != null);
    if (withCoords.length === 0) continue;

    let weight = 0;
    let lat = 0;
    let lon = 0;
    for (const p of withCoords) {
      const w = Math.max(1, p.population ?? 1);
      lat += p.latitude! * w;
      lon += p.longitude! * w;
      weight += w;
    }
    c.latitude = Number((lat / weight).toFixed(4));
    c.longitude = Number((lon / weight).toFixed(4));
    fromCentroid++;
    provenance.push({
      entityType: 'country',
      entityRef: c.iso2,
      field: 'latitude',
      valueText: String(c.latitude),
      source: 'geonames',
      sourceVersion: sourceVersions.geonames ?? null,
      sourceUrl: null,
      retrievedAt,
      // Lower confidence for computed vs capital coords.
      confidence: 0.5
    });
  }

  log.debug(
    `country coordinates: ${fromCapital} from the capital, ${fromCentroid} from a weighted centroid`
  );

  if (orphaned > 0) {
    notes.push({
      level: 'info',
      source: 'resolver',
      message:
        `${orphaned} places have a GeoNames admin1 code with no ISO 3166-2 counterpart. ` +
        `They are kept and attached to their country; the admin1-to-ISO crosswalk is incomplete.`
    });
  }

  log.debug(`resolved ${places.length} places (${places.filter((p) => p.isCity).length} cities)`);

  /* ---------------------------------------------------------------------- */
  /* Currencies                                                              */
  /* ---------------------------------------------------------------------- */

  const currencies: ResolvedCurrency[] = [];
  const seenCurrency = new Set<string>();

  for (const c of input.six?.currencies ?? []) {
    if (seenCurrency.has(c.code)) continue;
    seenCurrency.add(c.code);
    currencies.push({
      ...c,
      symbol: input.cldr?.currencySymbols.get(c.code) ?? null
    });
  }
  // iso-codes fills in any code SIX names differently or omits.
  for (const c of isoCodes.currencies) {
    if (seenCurrency.has(c.alpha_3)) continue;
    seenCurrency.add(c.alpha_3);
    currencies.push({
      code: c.alpha_3,
      numericCode: c.numeric ?? null,
      name: c.name,
      minorUnits: null,
      symbol: input.cldr?.currencySymbols.get(c.alpha_3) ?? null,
      isHistorical: false,
      withdrawnDate: null
    });
  }

  return {
    version: input.version ?? nextVersion(),
    builtAt: retrievedAt,
    sourceVersions,
    countries,
    subdivisions,
    places,
    currencies,
    provenance,
    notes
  };
}

/* -------------------------------------------------------------------------- */
/* GeoNames admin1 reconciliation                                              */
/* -------------------------------------------------------------------------- */

/** Match admin1 to ISO subdivisions by name at level 1 only (not FR-93 vs FR.93). */
function reconcileAdmin1(
  subdivisions: ResolvedSubdivision[],
  admin1ByCountry: Map<string, GeoAdmin1[]>,
  log: Logger
): void {
  const level1 = new Map<string, ResolvedSubdivision[]>();
  for (const sub of subdivisions) {
    if (sub.level !== 1) continue;
    const list = level1.get(sub.countryIso2) ?? [];
    list.push(sub);
    level1.set(sub.countryIso2, list);
  }

  let byName = 0;
  let byCode = 0;
  let unmatched = 0;

  for (const [countryIso2, entries] of admin1ByCountry) {
    const candidates = level1.get(countryIso2);
    if (!candidates || candidates.length === 0) continue;

    // A subdivision can only be claimed once, so a second admin1 entry that
    // folds to the same name does not overwrite the first.
    const taken = new Set<ResolvedSubdivision>();

    const byFoldedName = new Map<string, ResolvedSubdivision[]>();
    for (const sub of candidates) {
      for (const name of [sub.name, sub.displayName]) {
        if (!name) continue;
        const key = fold(name);
        if (!key) continue;
        const list = byFoldedName.get(key) ?? [];
        if (!list.includes(sub)) list.push(sub);
        byFoldedName.set(key, list);
      }
    }

    for (const entry of entries) {
      let match: ResolvedSubdivision | undefined;

      for (const candidateName of [entry.name, entry.asciiName]) {
        const hits = byFoldedName.get(fold(candidateName))?.filter((s) => !taken.has(s));
        if (hits?.length === 1) {
          match = hits[0];
          break;
        }
      }
      if (match) byName++;

      // Code equality is a last resort and still restricted to level 1, which
      // is what makes it safe: FR-93 is a department and never reaches here.
      if (!match) {
        const hits = candidates.filter((s) => s.code === entry.admin1Code && !taken.has(s));
        if (hits.length === 1) {
          match = hits[0];
          byCode++;
        }
      }

      if (!match) {
        unmatched++;
        continue;
      }

      taken.add(match);
      match.geonamesAdmin1 = entry.admin1Code;
      match.geonamesId = entry.geonamesId;

      // GeoNames still calls FR-BFC "Bourgogne" and FR-ARA "Rhône-Alpes".
      // Those names are wrong to *return* (#227) but right to *accept*: a
      // caller holding a pre-2016 name should still find the region.
      addGeonamesAlias(match, entry.name, 'alias');
      addGeonamesAlias(match, entry.asciiName, 'ascii');
    }
  }

  log.debug(
    `admin1 reconciliation: ${byName} matched by name, ${byCode} by code, ${unmatched} unmatched`
  );
}

function addGeonamesAlias(
  sub: ResolvedSubdivision,
  name: string | null | undefined,
  kind: NameRecord['kind']
): void {
  if (!name) return;
  const folded = fold(name);
  if (!folded) return;
  if (sub.names.some((n) => n.folded === folded)) return;
  sub.names.push({
    locale: 'und',
    name,
    folded,
    kind,
    isPreferred: false,
    source: 'geonames'
  });
}

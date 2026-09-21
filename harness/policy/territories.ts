/** Country list = ISO 3166-1 + documented exceptions. */

/**
 * Bump when a decision in this file changes.
 *
 * Values chosen here are published with `source: 'policy'` and this string as
 * their source version, so a provenance row can point at the revision of the
 * policy that produced it the same way it points at an upstream release.
 */
export const POLICY_VERSION = '1';

export interface TerritoryException {
  iso2: string;
  isoOfficialName: string;
  displayName: string;
  /** False for user-assigned codes. Surfaced to clients as `isoAssigned`. */
  isoAssigned: false;
  note: string;
  /** The downstream registries that already emit this code. */
  emittedBy: string[];
}

/** XK exception: emit with isoAssigned false. */
export const TERRITORY_EXCEPTIONS: readonly TerritoryException[] = [
  {
    iso2: 'XK',
    isoOfficialName: 'Kosovo',
    displayName: 'Kosovo',
    isoAssigned: false,
    note:
      'User-assigned code. Not present in ISO 3166-1. Emitted because GeoNames, CLDR, ' +
      'libphonenumber and ITU E.164 all publish it. See docs/DATA_POLICY.md.',
    emittedBy: ['geonames', 'cldr', 'libphonenumber', 'itu']
  }
];

export const EXCEPTION_CODES: ReadonlySet<string> = new Set(
  TERRITORY_EXCEPTIONS.map((t) => t.iso2)
);

/** SUPPRESSED_ENTITIES: reserved for upstream/ISO conflicts (currently empty). */
export const SUPPRESSED_ENTITIES: ReadonlySet<string> = new Set<string>([]);

/** REQUIRED_PRESENT: gate asserts these ISO2 codes exist. */
export const REQUIRED_PRESENT: ReadonlyArray<{ iso2: string; why: string }> = [
  { iso2: 'PS', why: 'issue #224 — Palestine missing from /countries' },
  { iso2: 'SX', why: 'issue #226 — Sint Maarten (Dutch part) missing' },
  { iso2: 'CD', why: 'DR Congo was unreachable by name in V1 (duplicate "Congo" records)' },
  { iso2: 'CG', why: 'Republic of the Congo, the other half of the same bug' },
  { iso2: 'MF', why: 'Saint-Martin (French part), the counterpart to SX' },
  { iso2: 'CI', why: "Côte d'Ivoire — 404'd under its accented official name in V1" },
  { iso2: 'RE', why: 'Réunion — the accent-folding regression case' }
];

/**
 * Names that must resolve, whatever spelling a caller uses. Seeded from real
 * V1 failures and asserted by an invariant.
 */
export const REQUIRED_ALIASES: ReadonlyArray<{ query: string; iso2: string; why: string }> = [
  { query: 'Reunion', iso2: 'RE', why: 'unaccented spelling 404d in V1' },
  { query: 'Réunion', iso2: 'RE', why: 'accented spelling' },
  { query: 'Ivory Coast', iso2: 'CI', why: 'common English name' },
  { query: "Côte d'Ivoire", iso2: 'CI', why: 'official French name; 404d in V1' },
  { query: 'Cote dIvoire', iso2: 'CI', why: 'punctuation-stripped form' },
  { query: 'South Korea', iso2: 'KR', why: 'V1 population endpoint required "Korea, Rep."' },
  { query: 'Russia', iso2: 'RU', why: 'V1 population endpoint 404d on this' },
  { query: 'Egypt', iso2: 'EG', why: 'V1 population endpoint 404d on this' },
  { query: 'DR Congo', iso2: 'CD', why: 'unreachable by name in V1' },
  { query: 'Democratic Republic of the Congo', iso2: 'CD', why: 'unreachable by name in V1' },
  { query: 'Congo', iso2: 'CG', why: 'must resolve to exactly one country, not silently pick' },
  { query: 'Turkey', iso2: 'TR', why: 'V1 had a hardcoded per-request patch for Turkey' },
  { query: 'Türkiye', iso2: 'TR', why: 'current official name' },
  { query: 'Palestine', iso2: 'PS', why: 'issue #224' },
  { query: 'Sint Maarten', iso2: 'SX', why: 'issue #226' },
  { query: 'Czechia', iso2: 'CZ', why: 'renamed from Czech Republic' },
  { query: 'Czech Republic', iso2: 'CZ', why: 'former name must keep working' },
  { query: 'Holland', iso2: 'NL', why: 'colloquial name' },
  { query: 'UAE', iso2: 'AE', why: 'common abbreviation' },
  { query: 'USA', iso2: 'US', why: 'common abbreviation' },
  { query: 'UK', iso2: 'GB', why: 'common abbreviation; alpha-2 is GB, not UK' },
  { query: 'Great Britain', iso2: 'GB', why: 'common name' },
  { query: 'Vatican', iso2: 'VA', why: 'common short name' },
  { query: 'Swaziland', iso2: 'SZ', why: 'renamed to Eswatini in 2018' },
  { query: 'Eswatini', iso2: 'SZ', why: 'current name' },
  { query: 'Macedonia', iso2: 'MK', why: 'renamed to North Macedonia in 2019' },
  { query: 'Burma', iso2: 'MM', why: 'former name of Myanmar' },
  { query: 'Cape Verde', iso2: 'CV', why: 'English name; official is Cabo Verde' },
  { query: 'East Timor', iso2: 'TL', why: 'English name; official is Timor-Leste' },
  { query: 'Laos', iso2: 'LA', why: 'common name' },
  { query: 'Syria', iso2: 'SY', why: 'common name' },
  { query: 'Iran', iso2: 'IR', why: 'common name' },
  { query: 'Bolivia', iso2: 'BO', why: 'common name; issue #152 reported it missing' },
  { query: 'Brunei', iso2: 'BN', why: 'issue #218 — endpoints disagreed on this name' },
  { query: 'Greece', iso2: 'GR', why: 'issue #218 — one V1 endpoint returned iso2 "EL"' },
  { query: 'Anguilla', iso2: 'AI', why: 'issue #26 reported it missing' },
  { query: 'Tuvalu', iso2: 'TV', why: 'V1 returns HTTP 500 for this country today' },
  { query: 'South Sudan', iso2: 'SS', why: 'V1 returns HTTP 500 for this country today' }
];

/** MANUAL_ALIASES: extra names only; cannot add/remove countries. */
export const MANUAL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  AE: ['UAE', 'Emirates'],
  BO: ['Bolivia'],
  BN: ['Brunei'],
  CD: ['DR Congo', 'DRC', 'Democratic Republic of the Congo', 'Congo-Kinshasa', 'Zaire'],
  CG: ['Congo-Brazzaville', 'Republic of the Congo'],
  CI: ['Ivory Coast'],
  CV: ['Cape Verde'],
  CZ: ['Czech Republic'],
  GB: ['UK', 'Great Britain', 'Britain', 'England'],
  IR: ['Iran'],
  KP: ['North Korea'],
  KR: ['South Korea'],
  LA: ['Laos'],
  MK: ['Macedonia'],
  MM: ['Burma'],
  NL: ['Holland'],
  PS: ['Palestine'],
  RU: ['Russia'],
  SY: ['Syria'],
  SZ: ['Swaziland'],
  TL: ['East Timor'],
  TR: ['Turkey', 'Türkiye'],
  TW: ['Taiwan'],
  TZ: ['Tanzania'],
  US: ['USA', 'United States', 'America'],
  VA: ['Vatican', 'Vatican City'],
  VE: ['Venezuela'],
  VN: ['Vietnam']
};

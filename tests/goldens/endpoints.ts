/**
 * The v0.1 surface, as V1 actually shipped it.
 *
 * This list is the contract. Every entry is replayed against both the live V1
 * (to capture a golden) and the shim (to check it), so adding a case here is
 * the way to widen compatibility coverage.
 *
 * `shapeOnly` marks responses whose *values* legitimately differ from V1 —
 * corrected currencies, deduplicated cities, populations from a different
 * vintage. Those are compared on structure: same envelope, same keys, same
 * types, same array-ness. Everything else is compared on exact bytes.
 *
 * Every bulk collection is shape-compared for one shared reason: V1 returns
 * rows in the order they happen to sit in its JavaScript data file, which is
 * neither alphabetical nor stable — `/countries/iso` starts at Afghanistan
 * while `/countries/flag/unicode` starts at Bangladesh. We sort by name. There
 * is no version of "byte-compatible" that includes reproducing an accident.
 */

export interface GoldenCase {
  /** Stable filename-safe identifier. */
  id: string;
  path: string;
  /**
   * Compare keys and types rather than values. Set this only when V1's value
   * is known-wrong or known-stale, and say why.
   */
  shapeOnly?: string;
  /** V1 answers this with a 5xx. We answer correctly; nothing to compare. */
  v1Broken?: string;
}

export const GOLDEN_CASES: GoldenCase[] = [
  /* ---- bulk collections ------------------------------------------------ */
  {
    id: 'countries',
    path: '/countries',
    shapeOnly: 'City lists are deduplicated and neighbourhood entries removed (#242).'
  },
  {
    id: 'countries-iso',
    path: '/countries/iso',
    shapeOnly: 'Row order (see above).'
  },
  {
    id: 'countries-codes',
    path: '/countries/codes',
    shapeOnly: 'Dial codes come from libphonenumber, which formats NANP suffixes differently.'
  },
  {
    id: 'countries-currency',
    path: '/countries/currency',
    shapeOnly: 'Currencies track the ISO 4217 register, so Bulgaria is EUR not BGN (#236).'
  },
  {
    id: 'countries-capital',
    path: '/countries/capital',
    shapeOnly: 'Row order, and capitals come from GeoNames rather than a hand-maintained list.'
  },
  {
    id: 'countries-flag-images',
    path: '/countries/flag/images',
    shapeOnly: 'Flag URLs point at lipis/flag-icons rather than Wikimedia Commons.'
  },
  {
    id: 'countries-flag-unicode',
    path: '/countries/flag/unicode',
    shapeOnly: 'Row order (see above).'
  },
  {
    id: 'countries-positions',
    path: '/countries/positions',
    shapeOnly: 'Coordinates are derived from GeoNames capitals rather than hand-entered.'
  },
  {
    id: 'countries-states',
    path: '/countries/states',
    shapeOnly: 'Subdivisions come from ISO 3166-2, which fixes France (#227) and Sri Lanka (#229).'
  },
  {
    id: 'countries-population',
    path: '/countries/population',
    shapeOnly: 'One dated observation per country, and World Bank aggregates are excluded.'
  },
  {
    id: 'countries-population-cities',
    path: '/countries/population/cities',
    shapeOnly: 'Sourced from GeoNames rather than the DataHub city file.'
  },
  {
    id: 'countries-info-currency',
    path: '/countries/info?returns=currency',
    shapeOnly: 'Same currency correction as /countries/currency.'
  },
  {
    id: 'countries-info-multi',
    path: '/countries/info?returns=capital,iso2,unicodeFlag',
    shapeOnly: 'Row order (see above).'
  },

  /* ---- single lookups -------------------------------------------------- */
  {
    id: 'q-nigeria',
    path: '/countries/q?country=nigeria',
    v1Broken: 'V1 has no /countries/q at all — it answers "you seem to be lost". Added in v2.'
  },
  { id: 'capital-nigeria', path: '/countries/capital/q?country=nigeria' },
  {
    id: 'capital-iso2',
    path: '/countries/capital/q?country=NG',
    v1Broken:
      'V1 404s: the param is named `country` so an ISO code never matches, despite the ' +
      'error message promising "country or iso2".'
  },
  {
    id: 'currency-bulgaria',
    path: '/countries/currency/q?country=Bulgaria',
    shapeOnly: 'BGN → EUR (#236).'
  },
  { id: 'iso-germany', path: '/countries/iso/q?country=Germany' },
  {
    id: 'codes-canada',
    path: '/countries/codes/q?country=Canada',
    shapeOnly: 'Dial code formatting.'
  },
  { id: 'flag-image-ng', path: '/countries/flag/images/q?iso2=NG', shapeOnly: 'Flag URL host.' },
  { id: 'flag-unicode-ng', path: '/countries/flag/unicode/q?country=Nigeria' },
  { id: 'position-japan', path: '/countries/positions/q?country=Japan', shapeOnly: 'Coordinates.' },
  {
    id: 'states-sri-lanka',
    path: '/countries/states/q?country=Sri%20Lanka',
    shapeOnly: 'Nine provinces, districts nested a level down (#229).'
  },
  {
    id: 'states-france',
    path: '/countries/states/q?country=France',
    shapeOnly: 'Post-2016 regions (#227).'
  },
  {
    id: 'cities-nigeria',
    path: '/countries/cities/q?country=Nigeria',
    shapeOnly: 'Deduplicated, neighbourhoods removed (#242).'
  },
  {
    id: 'state-cities-lagos',
    path: '/countries/state/cities/q?country=Nigeria&state=Lagos',
    v1Broken:
      'V1 404s "state not found": its data says "Lagos State" and the suffix stripper it ' +
      'wrote to handle that was a no-op. Issues #42, #112, #143.'
  },
  {
    id: 'population-nigeria',
    path: '/countries/population/q?country=Nigeria',
    shapeOnly: 'One dated observation rather than a 1960-2018 series.'
  },
  {
    id: 'population-city-lagos',
    path: '/countries/population/cities/q?city=Lagos',
    shapeOnly: 'GeoNames figure rather than the DataHub one.'
  },

  /* ---- filters --------------------------------------------------------- */
  {
    id: 'population-filter',
    path: '/countries/population/filter/q?limit=5&order=dsc&orderBy=population',
    shapeOnly: 'Different population vintage changes the ordering.'
  },
  {
    id: 'population-cities-filter',
    path: '/countries/population/cities/filter/q?limit=5&order=dsc',
    shapeOnly: 'Different population source.'
  },
  {
    id: 'positions-range',
    path: '/countries/positions/range/q?type=lat&min=0&max=10',
    shapeOnly: 'Derived coordinates change which countries fall in the band.'
  },

  /* ---- error paths ----------------------------------------------------- */
  { id: 'err-missing-country', path: '/countries/capital/q' },
  { id: 'err-unknown-country', path: '/countries/capital/q?country=Atlantis' },
  { id: 'err-info-no-returns', path: '/countries/info' },
  {
    id: 'err-range-missing-param',
    path: '/countries/positions/range/q?type=lat'
  },

  /* ---- the 23-country 500 --------------------------------------------- */
  {
    id: 'cities-tuvalu',
    path: '/countries/cities/q?country=Tuvalu',
    v1Broken: 'V1 returns HTTP 500: the !DB1 && !DB2 guard, then an unguarded DB1 destructure.'
  },
  {
    id: 'cities-south-sudan',
    path: '/countries/cities/q?country=South%20Sudan',
    v1Broken: 'Same 500.'
  },

  /* ---- lookups V1 could not do ---------------------------------------- */
  {
    id: 'unaccented-reunion',
    path: '/countries/capital/q?country=Reunion',
    v1Broken: 'V1 404s: it lowercases but never folds combining marks.'
  },
  {
    id: 'drc-by-name',
    path: '/countries/capital/q?country=Democratic%20Republic%20of%20the%20Congo',
    v1Broken: 'V1 has two records literally named "Congo", so the DRC is unreachable by name.'
  }
];

/** `/countries/random` is excluded from goldens on purpose: it is not deterministic. */
export const NON_DETERMINISTIC = ['/countries/random'];

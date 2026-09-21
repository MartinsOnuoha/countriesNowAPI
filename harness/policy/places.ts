/**
 * What counts as a city.
 *
 * This file exists because of issue #242, "API returns neighborhoods instead of
 * cities". Asking V1 for cities in Provence-Alpes-Côte d'Azur returned
 * Mazargues, La Blancarde and Sainte-Marguerite — all *neighbourhoods of
 * Marseille* — plus "Marseille 08" and "Marseille 13", which are
 * arrondissements. GeoNames already distinguishes these precisely; V1 simply
 * never looked at the feature code.
 *
 * Filtering the real PACA data shows the shape of it: 2,886 PPL against 170
 * PPLX and 16 PPLA5. And the common shortcut of "just use cities15000" does not
 * help — that file is 34,076 rows of which 2,365 are PPLX.
 *
 * We keep the excluded places rather than dropping them. A neighbourhood is
 * real, it is just not a city, so it is stored with `parentPlaceId` set and
 * exposed as a child resource. That also retires the duplicate-city reports,
 * since Marseille stops appearing seventeen times.
 *
 * Reference: https://www.geonames.org/export/codes.html
 */

/** Feature codes that are cities in the sense a location picker means. */
export const CITY_FEATURE_CODES: ReadonlySet<string> = new Set([
  'PPL', // populated place — a city, town or village
  'PPLA', // seat of a first-order administrative division
  'PPLA2', // seat of a second-order division
  'PPLA3', // seat of a third-order division
  'PPLC', // capital of a political entity
  'PPLG' // seat of government of a political entity
]);

/**
 * Admitted only when the place is not contained in a larger populated place.
 * A standalone PPLA4 is a real town; a PPLA5 inside Marseille is an
 * arrondissement. Containment comes from GeoNames hierarchy.zip.
 */
export const CONDITIONAL_FEATURE_CODES: ReadonlySet<string> = new Set(['PPLA4', 'PPLA5']);

/**
 * Never cities. Each entry maps to a real complaint against V1.
 *
 *   PPLX   section of a populated place — the neighbourhood bug, #242
 *   PPLH   historical, no longer exists
 *   PPLQ   abandoned
 *   PPLW   destroyed
 *   PPLCH  former capital
 *   PPLS   a plural aggregate, not a single place
 *   PPLL   a handful of dwellings
 *   PPLF   farm village
 *   PPLR   religious populated place
 *   STLMT  israeli settlement — a policy decision, see docs/DATA_POLICY.md
 */
export const EXCLUDED_FEATURE_CODES: ReadonlySet<string> = new Set([
  'PPLX',
  'PPLH',
  'PPLQ',
  'PPLW',
  'PPLCH',
  'PPLS',
  'PPLL',
  'PPLF',
  'PPLR',
  'STLMT'
]);

/** Codes that denote a part of a bigger place, used to build `parentPlaceId`. */
export const SUBPLACE_FEATURE_CODES: ReadonlySet<string> = new Set(['PPLX', 'PPLA4', 'PPLA5']);

export interface CityDecision {
  isCity: boolean;
  /** Why, in a form fit for a gate report or a PR comment. */
  reason: string;
}

export interface PlaceLike {
  featureClass: string;
  featureCode: string;
  /** True when GeoNames hierarchy places this inside another populated place. */
  containedInPopulatedPlace?: boolean;
}

/**
 * The single decision point. The GeoNames adapter calls this; nothing else
 * decides what a city is, so the rule can be changed in one place and the
 * invariant in harness/src/gates can assert against the same constant.
 */
export function decideCity(place: PlaceLike): CityDecision {
  if (place.featureClass !== 'P') {
    return { isCity: false, reason: `feature class ${place.featureClass} is not a populated place` };
  }

  if (EXCLUDED_FEATURE_CODES.has(place.featureCode)) {
    return { isCity: false, reason: `${place.featureCode} is excluded by policy` };
  }

  if (CITY_FEATURE_CODES.has(place.featureCode)) {
    return { isCity: true, reason: `${place.featureCode} is a city feature code` };
  }

  if (CONDITIONAL_FEATURE_CODES.has(place.featureCode)) {
    return place.containedInPopulatedPlace
      ? { isCity: false, reason: `${place.featureCode} contained in a larger populated place` }
      : { isCity: true, reason: `${place.featureCode} is standalone` };
  }

  return { isCity: false, reason: `${place.featureCode} is not a recognised city code` };
}

/** SQL form of the same rule, for the artifact build and for documentation. */
export const CITY_FILTER_SQL = `
  feature_class = 'P'
  AND feature_code NOT IN (${[...EXCLUDED_FEATURE_CODES].map((c) => `'${c}'`).join(', ')})
  AND (
    feature_code IN (${[...CITY_FEATURE_CODES].map((c) => `'${c}'`).join(', ')})
    OR (feature_code IN (${[...CONDITIONAL_FEATURE_CODES].map((c) => `'${c}'`).join(', ')})
        AND parent_place_id IS NULL)
  )
`.trim();

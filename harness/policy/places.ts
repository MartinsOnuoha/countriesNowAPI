/** City vs neighbourhood rules (#242); see GeoNames feature codes. */

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

/** EXCLUDED_FEATURE_CODES — not cities (see list / #242). */
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

/** isCity() is the only city classifier; gates import same constants. */
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

/**
 * Entity-type discriminators in the artifact's `names` table.
 *
 * Integers rather than strings because `names` is by far the largest table and
 * `(entity_type, folded)` is the hottest index in the process. Shared between
 * the publisher and the server so the two cannot drift.
 */
export const ENTITY_COUNTRY = 0;
export const ENTITY_SUBDIVISION = 1;
export const ENTITY_PLACE = 2;
export const ENTITY_CURRENCY = 3;

export type EntityTypeCode =
  | typeof ENTITY_COUNTRY
  | typeof ENTITY_SUBDIVISION
  | typeof ENTITY_PLACE
  | typeof ENTITY_CURRENCY;

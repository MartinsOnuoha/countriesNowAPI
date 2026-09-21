/** Integer entity_type for names index; shared with publisher. */
export const ENTITY_COUNTRY = 0;
export const ENTITY_SUBDIVISION = 1;
export const ENTITY_PLACE = 2;
export const ENTITY_CURRENCY = 3;

export type EntityTypeCode =
  | typeof ENTITY_COUNTRY
  | typeof ENTITY_SUBDIVISION
  | typeof ENTITY_PLACE
  | typeof ENTITY_CURRENCY;

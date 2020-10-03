/**
 * @module
 * @description entry import and export for schemas
 */

const lt = require('./lt');
const gt = require('./gt');
const year = require('./year');
const limit = require('./limit');
const order = require('./order');
const orderBy = require('./orderBy');
const cityName = require('./cityName');
const countryName = require('./countryName');
const countryCities = require('./countryCities');
const countryPayload = require('./countryPayload');
const returns = require('./returns');
const positionRange = require('./positionRange');
const cityPayload = require('./cityPayload');
const countryPopulationFilterPayload = require('./countryPopulationFilterPayload');
const cityPopulationFilterPayload = require('./cityPopulationFilterPayload');
const countryStatePayload = require('./countryStatePayload');
const stateName = require('./stateName');

module.exports = {
  lt,
  gt,
  limit,
  year,
  cityName,
  orderBy,
  order,
  countryName,
  countryCities,
  countryPayload,
  returns,
  positionRange,
  cityPayload,
  countryPopulationFilterPayload,
  cityPopulationFilterPayload,
  countryStatePayload,
  stateName,
};

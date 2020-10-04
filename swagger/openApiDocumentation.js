// const { USER_TYPES, REGULAR } = require('./config/constants');
const SERVERS = require('./servers');
const { CONTACT, LICENCE } = require('./info');
const SCHEMAS = require('./schemas');

const CITIES_METHODS = require('./paths/cities');
const CODE_METHODS = require('./paths/codes');
const FILTER_METHODS = require('./paths/filter');
const CAPITAL_METHODS = require('./paths/capital');
const CURRENCY_METHODS = require('./paths/currency');
const FLAG_METHODS = require('./paths/flags');
const LOCATION_METHODS = require('./paths/location');
const POPULATION_METHODS = require('./paths/population');
const STATE_METHODS = require('./paths/states');
const COUNTRY_STATE_CITY_METHOD = require('./paths/countriesStateCity');
const RANDOM_METHODS = require('./paths/random');

module.exports = {
  openapi: '3.0.1',
  info: {
    title: 'CountriesNow API',
    version: '0.1.0',
    description: 'Official Swagger documentation for countriesNow API',
    contact: CONTACT,
    license: LICENCE,
  },
  servers: SERVERS,
  paths: {
    '/': {
      get: CITIES_METHODS.getCountriesAndCities,
    },
    '/cities': {
      post: CITIES_METHODS.getCities,
    },
    '/codes': {
      get: CODE_METHODS.getCodes,
      post: CODE_METHODS.getCodesSingle,
    },
    '/iso': {
      get: CODE_METHODS.getISO,
      post: CODE_METHODS.getISOSingle,
    },
    '/info': {
      get: FILTER_METHODS.getProps,
    },
    '/capital': {
      get: CAPITAL_METHODS.getCapitals,
      post: CAPITAL_METHODS.getCapitalSingle,
    },
    '/currency': {
      get: CURRENCY_METHODS.getCurrencies,
      post: CURRENCY_METHODS.getSingleCurrency,
    },
    '/flag/images': {
      get: FLAG_METHODS.getFlagImages,
      post: FLAG_METHODS.getFlagImagesSingle,
    },
    '/flag/unicode': {
      get: FLAG_METHODS.getFlagUnicode,
      post: FLAG_METHODS.getFlagUnicodeSingle,
    },
    '/positions': {
      get: LOCATION_METHODS.getPosition,
      post: LOCATION_METHODS.getPositionSingle,
    },
    '/positions/range': {
      post: LOCATION_METHODS.getPositionRange,
    },
    '/population': {
      get: POPULATION_METHODS.getCountryPopulation,
      post: POPULATION_METHODS.getSingleCountryPopulation,
    },
    '/population/cities': {
      get: POPULATION_METHODS.getCityPopulation,
      post: POPULATION_METHODS.getSingleCityPopulation,
    },
    '/population/filter': {
      post: POPULATION_METHODS.filterCountryPopulation,
    },
    '/population/cities/filter': {
      post: POPULATION_METHODS.filterCityPopulation,
    },
    '/states': {
      get: STATE_METHODS.getCountriesStates,
      post: STATE_METHODS.getSingleCountryStates,
    },
    '/state/cities': {
      post: COUNTRY_STATE_CITY_METHOD.getStateCities
    },
    '/random':{
      get: RANDOM_METHODS.getRandomCountry,
    },
  },
  components: {
    schemas: SCHEMAS,
  },
};

/* eslint-disable no-nested-ternary */
let CountriesAndCities = require('../model/countriesAndCities');
const CountriesAndUnicodes = require('../model/countriesAndUnicodes');
let CountriesAndFlag = require('../model/countriesAndFlag');
const CountriesAndCodes = require('../model/countriesAndCodes');
const CountriesAndStates = require('../model/countriesAndState');
const CountriesStateCity = require('../model/countriesStateCity');
// const Finder = require('../helpers/finder');
const Respond = require('../helpers/respond');
const { getCountriesPopulation, getCitiesPopulation } = require('./dataHub');
const GithubService = require('./github');
const {
  latestYear, greaterThan, lessThan, withRange, orderCountryData, orderCityData,
} = require('../helpers/utils');

const countryPopulation = getCountriesPopulation();
const citiesPopulation = getCitiesPopulation();
const positions = CountriesAndCodes.map((x) => ({
  name: x.name, iso2: x.iso2, long: x.longitude, lat: x.latitude,
}));

CountriesAndCities = CountriesAndCities.map((x) => {
  const countryIso = CountriesAndUnicodes.find((country) => country.Name.trim().toLowerCase() === x.country.trim().toLowerCase());
  const dataObj = {
    iso2: countryIso ? countryIso.Iso2 : null,
    iso3: countryIso ? countryIso.Iso3 : null,
    ...x,
  };
  return dataObj;
});

CountriesAndFlag = CountriesAndFlag.map((x) => {
  const countryIso = CountriesAndUnicodes.find((country) => country.Name.trim().toLowerCase() === x.name.trim().toLowerCase());
  const dataObj = {
    name: x.name,
    flag: x.flag,
    iso2: countryIso ? countryIso.Iso2 : null,
    iso3: countryIso ? countryIso.Iso3 : null,
  };
  return dataObj;
});

const CountriesAndISO = CountriesAndFlag.map((x) => ({
  name: x.name,
  Iso2: x.iso2,
  Iso3: x.iso3,
}));

const CountriesAndCurrencies = CountriesAndUnicodes.map((x) => ({
  name: x.Name, currency: x.Currency, iso2: x.Iso2, iso3: x.Iso3,
}));

const CountriesAndStatesFormatted = CountriesAndStates.map((x) => ({
  name: x.name,
  iso3: x.iso3,
  iso2: x.iso2,
  states: x.states.map((y) => ({ name: y.name, state_code: y.state_code })),
}));
const CountriesStateCityFormatted = CountriesStateCity.map((x) => ({
  name: x.name,
  iso2: x.iso2,
  iso3: x.iso3,
  states: x.states,
}));

class CountryController {
  /**
   * Get all countries and cities
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesAndCities(req, res, next) {
    try {
      return Respond.success(res, 'countries and cities retrieved', CountriesAndCities);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get cities of a specified country
   * @param {RequestObject} req request obeject
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCitiesByCountry(req, res, next) {
    try {
      const { country, iso2 } = req.query;
      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      let DB1 = null;
      let DB2 = null;

      if (country) {
        DB1 = CountriesAndCities.find((x) => x.country.toLowerCase() === country.toLowerCase());
        DB2 = CountriesStateCityFormatted.find((x) => x.name.toLowerCase() === country.toLowerCase());
      }
      if (iso2) {
        DB1 = CountriesAndCities.find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
        DB2 = CountriesStateCityFormatted.find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
      }

      if (!DB1 && !DB2) {
        return Respond.error(res, 'country not found', 404);
      }
      const { country: countryName } = DB1;
      DB1 = DB1 ? DB1.cities : [];
      DB2 = DB2 ? DB2.states.reduce((acc, state) => acc.concat(state.cities), []).map((x) => x.name) : [];

      if (country === 'Turkey') {
        DB2 = [];
      }

      const cities = [...new Set(DB1.concat(DB2))];
      return Respond.success(res, `cities in ${countryName} retrieved`, cities);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get all countries, code and dial codes
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesAndCodes(req, res, next) {
    try {
      const data = CountriesAndCodes.map((x) => ({ name: x.name, code: x.code, dial_code: x.dial_code }));
      return Respond.success(res, 'countries and codes retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get a single country and it's dial code
   *
   * @static
   * @param {Request} req
   * @param {Response} res
   * @param {Callback} next callback function that invokes the next express middleware function
   * @returns Object
   * @memberof CountryController
   */
  static getSingleCountryAndDialCode(req, res, next) {
    try {
      const { country, iso2 } = req.query;
      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      let data = null;
      const CountriesCodes = CountriesAndCodes.map((x) => ({ name: x.name, code: x.code, dial_code: x.dial_code }));

      if (country) {
        data = CountriesCodes.find((x) => x.name.toLowerCase().trim() === country.trim().toLowerCase());
      }
      if (iso2) {
        data = CountriesCodes.find((x) => x.code.toLowerCase().trim() === iso2.trim().toLowerCase());
      }

      if (data) {
        return Respond.success(res, `${data.name} dial code retrieved`, data);
      }
      return Respond.error(res, 'country not found', 404);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get countries and positions
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesPosition(req, res, next) {
    try {
      return Respond.success(res, 'countries and positions retrieved', positions);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get a single country's position
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getSinglePosition(req, res, next) {
    try {
      const { country, iso2 } = req.query;
      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      let data = null;
      if (country) {
        data = positions.find((x) => x.name.trim().toLowerCase() === country.trim().toLowerCase());
      }
      if (iso2) {
        data = positions.find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
      }
      if (!data) {
        return Respond.error(res, 'Country not found', 404);
      }
      return Respond.success(res, 'country position retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get countries by position range
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getPositionRange(req, res, next) {
    // TODO: Ensure min is less than max, swap values if not the case
    // TODO: Ensure type is 'lat' or 'long' - default makes this the same as GET /api/v0.1/countries/positions

    try {
      const { type, min, max } = req.query;
      if (!type || !min || !max) {
        return Respond.error(res, 'missing param (type, min, max)', 400);
      }
      let result = positions;
      switch (type) {
        case 'lat':
          result = positions.filter((x) => Number(x.lat) >= Number(min) && Number(x.lat) <= Number(max));
          break;
        case 'long':
          result = positions.filter((x) => Number(x.long) >= Number(min) && Number(x.long) <= Number(max));
          break;
        default:
          result = positions;
          break;
      }
      return Respond.success(res, `countries between ${type} of (${min} and ${max})`, result);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get all countries and their ISON Code
   * @param {RequestObject} req
   * @param {ResponseObject} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesAndISO(req, res, next) {
    try {
      const data = CountriesAndISO;
      return Respond.success(res, 'countries and ISO codes retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   *
   * @param {*} req
   * @param {*} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getSingleCountryAndISO(req, res, next) {
    try {
      let { country } = req.query;
      if (!country) {
        return Respond.error(res, 'missing param (country)', 400);
      }
      country = country.toLowerCase().trim();
      const data = CountriesAndISO.find((x) => x.name.toLowerCase().trim() === country);

      if (!data) {
        return Respond.error(res, 'country not found', 404);
      }
      return Respond.success(res, 'country\'s ISO code retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get all countries with their flag images
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesFlagImages(req, res, next) {
    try {
      const data = CountriesAndFlag.map((x) => {
        const countryIso = CountriesAndUnicodes.find((country) => country.Name.trim().toLowerCase() === x.name.trim().toLowerCase());
        const dataObj = {
          name: x.name,
          flag: x.flag,
          iso2: countryIso ? countryIso.Iso2 : null,
          iso3: countryIso ? countryIso.Iso3 : null,
        };
        return dataObj;
      });
      return Respond.success(res, 'flags images retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get single country with flag image
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountryFlagImage(req, res, next) {
    try {
      const { country, iso2 } = req.query;

      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      let data = null;

      if (country) {
        data = CountriesAndFlag.find((x) => x.name.trim().toLowerCase() === country.trim().toLowerCase());
      }
      if (iso2) {
        data = CountriesAndFlag.find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
      }
      if (!data) {
        return Respond.error(res, 'country not found', 404);
      }
      return Respond.success(res, `${data.name} and flag retrieved`, data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get countries and unicode flags
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesUnicodeFlag(req, res, next) {
    try {
      const data = CountriesAndUnicodes.map((x) => ({
        name: x.Name, iso2: x.Iso2, iso3: x.Iso3, unicodeFlag: x.Unicode,
      }));
      return Respond.success(res, 'countries and unicode flags retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get a country and unicode flag
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async getCountryUnicodeFlag(req, res, next) {
    try {
      const { country, iso2 } = req.query;
      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      const mappedCountriesAndFlags = await CountriesAndUnicodes.map((x) => ({
        name: x.Name,
        iso2: x.Iso2,
        iso3: x.Iso3,
        unicodeFlag: x.Unicode,
      }));
      let data = null;

      if (country) {
        data = mappedCountriesAndFlags.find((x) => x.name.trim().toLowerCase() === country.trim().toLowerCase());
      }
      if (iso2) {
        data = mappedCountriesAndFlags.find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
      }

      if (!data) {
        return Respond.error(res, 'country not found', 404);
      }
      return Respond.success(res, `${data.name} and unicode flag retrieved`, data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get countries and their capital
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesCapital(req, res, next) {
    try {
      const data = orderCountryData(CountriesAndUnicodes.map((x) => ({
        name: x.Name, capital: x.Capital, iso2: x.Iso2, iso3: x.Iso3,
      })), 'asc', 'name', 'name');
      return Respond.success(res, 'countries and capitals retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get single country and capital
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountryCapital(req, res, next) {
    try {
      const { country, iso2 } = req.query;
      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      const mappedValues = CountriesAndUnicodes.map((x) => ({
        name: x.Name, capital: x.Capital, iso2: x.Iso2, iso3: x.Iso3,
      }));

      let data = null;
      if (country) {
        data = mappedValues.find((x) => x.name.trim().toLowerCase() === country.trim().toLowerCase());
      }
      if (iso2) {
        data = mappedValues.find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
      }
      if (!data) {
        return Respond.error(res, 'country not found', 404);
      }
      return Respond.success(res, 'country and capitals retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get countries and their currencies
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesAndCurrency(req, res, next) {
    try {
      const data = CountriesAndCurrencies;
      return Respond.success(res, 'countries and currencies retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get a single country and it's currency
   * @param {Request} req
   * @param {Response} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getSingleCountryAndCurrency(req, res, next) {
    try {
      const { country, iso2 } = req.query;
      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      let data = null;

      if (country) {
        data = CountriesAndCurrencies.find((x) => x.name.trim().toLowerCase() === country.trim().toLowerCase());
      }
      if (iso2) {
        data = CountriesAndCurrencies.find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
      }
      if (!data) {
        Respond.error(res, 'country not found', 404);
      }
      return Respond.success(res, `${data.name} and currency retrieved`, data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get countries information by specifying required data
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesInfo(req, res, next) {
    try {
      const { returns = '' } = req.query;

      if (!returns) return Respond.error(res, 'you must specify data to fetch e.g ?returns=unicodeFlag,currency,image', 400);
      const params = returns.trim().split(',').map((x) => x.trim());

      // TODO: Add more data selectors
      const fetchCapital = params.includes('capital');
      const fetchCurrency = params.includes('currency');
      const fetchImage = params.includes('flag');
      const fetchDialCode = params.includes('dialCode');
      const fetchUnicode = params.includes('unicodeFlag');
      const fetchCities = params.includes('cities');
      const fetchIso2 = params.includes('iso2');
      const fetchIso3 = params.includes('iso3');

      const data = CountriesAndUnicodes.map((x) => {
        const countryAndFlag = fetchImage && CountriesAndFlag.find((c) => c.name.toLowerCase() === x.Name.toLowerCase());

        const Country = CountriesAndCities.find(({ country }) => country === x.Name);

        return ({
          name: x.Name,
          currency: (fetchCurrency && x.Currency) || undefined,
          unicodeFlag: (fetchUnicode && x.Unicode) || undefined,
          capital: (fetchCapital && x.Capital) || undefined,
          flag: (countryAndFlag && countryAndFlag.flag) || undefined,
          dialCode: (fetchDialCode && x.Dial) || undefined,
          cities: (fetchCities && Country && Country.cities) || undefined,
          iso2: (fetchIso2 && x.Iso2) || undefined,
          iso3: (fetchIso3 && x.Iso3) || undefined,
        });
      });
      return Respond.success(res, `countries details: '${returns}' have been retrieved`, data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get all countries and respective population
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async getPopulation(req, res, next) {
    try {
      const data = await countryPopulation;
      return Respond.success(res, 'all countries and population 1961 - 2018', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get population of a specific country
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async getPopulationByCountry(req, res, next) {
    // TODO: Make this work with iso2 instead of iso3 so it matches other functions

    try {
      const { country, iso3 } = req.query;
      if (!country && !iso3) {
        return Respond.error(res, 'missing param (country or iso3)', 400);
      }
      const data = await countryPopulation;
      let filtered = null;
      if (country) {
        filtered = data.find((x) => country.trim().toLowerCase() === x.country.trim().toLowerCase());
      }
      if (iso3) {
        filtered = data.find((x) => iso3.trim().toLowerCase() === x.iso3.trim().toLowerCase());
      }
      if (!filtered) return Respond.error(res, 'country data not found', 404);
      return Respond.success(res, `${filtered.country} with population`, filtered);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Filter countries population data
   * allowed queries { year: Number, limit: Number, gt: Number, lt: Number, order: String, orderBy: String }
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async filterCountryPopulation(req, res, next) {
    try {
      // Shim to make the limit parameter a number instead of a string
      if (req.query.limit && !Number.isNaN(req.query.limit)) req.query.limit = Number(req.query.limit);

      const data = await countryPopulation;
      const {
        year = latestYear(data),
        limit = data.length,
        gt = false,
        lt = false,
        order = 'asc',
        orderBy = 'population',
      } = req.query;

      if (typeof limit !== 'number') return Respond.error(res, 'invalid payload format');

      const mappedPopulation = data.map((x) => ({
        country: x.country,
        code: x.code,
        populationCounts: x.populationCounts.find((y) => y.year === year) || { year, value: -1 },
      }));

      const selectedYear = orderCountryData(mappedPopulation, order, orderBy)
        .filter((obj) => obj.populationCounts.value !== -1);

      const result = gt && !lt ? greaterThan(selectedYear, gt) : lt && !gt ? lessThan(selectedYear, lt) : gt && lt ? withRange(selectedYear, gt, lt) : selectedYear;
      const applyLimit = result.splice(0, limit);

      return Respond.success(res, 'filtered result', applyLimit);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get cities and population data
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async getCitiesPopulation(req, res, next) {
    try {
      const data = await citiesPopulation;
      return Respond.success(res, 'all cities with population', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get single city and its population data
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async getPopulationByCity(req, res, next) {
    try {
      const { city } = req.query;
      if (!city) {
        return Respond.error(res, 'missing param (city)', 400);
      }
      const data = await citiesPopulation;
      const filtered = data.find((x) => city.trim().toLowerCase() === x.city.trim().toLowerCase());
      if (!filtered) {
        return Respond.error(res, 'city data not found', 404);
      }
      return Respond.success(res, `${city} with population`, filtered);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * filter cities and population data
   * @param {RequestObject} req
   * @param {ResponseObject} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async filterCitiesPopulation(req, res, next) {
    try {
      // Shim to make the limit parameter a number instead of a string.
      if (req.query.limit && !Number.isNaN(req.query.limit)) req.query.limit = Number(req.query.limit);

      const data = await citiesPopulation;
      const {
        limit = data.length,
        order = 'asc',
        orderBy = 'population',
        country = false,
      } = req.query;

      if (typeof limit !== 'number') return Respond.error(res, 'invalid payload format');

      let result = orderCityData(data.map((x) => ({
        city: x.city,
        country: x.country,
        populationCounts: x.populationCounts,
      })), order, orderBy);

      if (country) {
        // TODO: check datahub to get correct countries names.
        result = result.filter((x) => x.country.toLowerCase().includes(country.toLowerCase()));
      }

      // Handle empty results
      if (!result.length) Respond.error(res, 'No results found', 404);

      // remove unnecessary information from dataHub
      if (result[0].city === 'null') { result.shift(); }
      // add limit
      result = result.splice(0, limit);

      return Respond.success(res, 'filtered result', result);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get Countries Cities and States
   *
   * @static
   * @param {Request} req
   * @param {Response} res
   * @returns {JSON}
   * @memberof CountryController
   */
  static async countriesCitiesStates(req, res) {
    const data = await GithubService.getCountriesStateCities();
    // eslint-disable-next-line no-console

    // TODO: implement
    return Respond.success(res, 'countries state and cities', data);
  }

  /**
   * get countries and their states
   * @param {Request} req
   * @param {Response} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getCountriesState(req, res, next) {
    try {
      const data = CountriesAndStatesFormatted;
      return Respond.success(res, 'countries and states retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * get a single country's states
   * @param {Request} req
   * @param {Response} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getSingleCountryStates(req, res, next) {
    try {
      const { country, iso2 } = req.query;
      if (!country && !iso2) {
        return Respond.error(res, 'missing param (country or iso2)', 400);
      }
      let data = null;
      if (country) {
        data = Object.values(CountriesAndStatesFormatted).find((x) => x.name.trim().toLowerCase() === country.trim().toLowerCase());
      }
      if (iso2) {
        data = Object.values(CountriesAndStatesFormatted).find((x) => x.iso2.trim().toLowerCase() === iso2.trim().toLowerCase());
      }
      if (!data) {
        return Respond.error(res, 'country not found', 404);
      }
      return Respond.success(res, `states in ${data.name} retrieved`, data);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get list of cities in a state
   * @param {Request} req
   * @param {Response} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static async getStateCities(req, res, next) {
    try {
      const { country, state } = req.query;
      if (!country) {
        return Respond.error(res, 'missing param (country)', 400);
      }
      if (!state) {
        return Respond.error(res, 'missing param (state)', 400);
      }

      const countryData = Object.values(CountriesStateCityFormatted).find((x) => x.name.toLowerCase() === country.toLowerCase());
      if (!countryData) {
        return Respond.error(res, 'country not found', 404);
      }
      const statesInCountry = countryData.states;
      const statesFormatted = statesInCountry.map((x) => ({
        name: x.name.trim().toLowerCase().endsWith('state') ? x.name.toLowerCase().trim() : x.name,
        cities: x.cities,
      }));
      const stateData = Object.values(statesFormatted).find((x) => x.name.toLowerCase() === state.toLowerCase());
      if (!stateData) {
        return Respond.error(res, 'state not found', 404);
      }
      const cityList = stateData.cities.map((city) => city.name);
      return Respond.success(res, `cities in state ${state} of country ${country} retrieved`, cityList);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get list of cities in a state
   * @param {Request} req
   * @param {Response} res
   * @param {Callback} next callback function that invokes the next express middleware function
   */
  static getRandomCountry(req, res, next) {
    try {
      const randomCountry = CountriesAndCodes[Math.floor(Math.random() * CountriesAndCodes.length)];
      return Respond.success(res, 'retrieved random country', randomCountry);
    } catch (err) {
      return next(err);
    }
  }
}
module.exports = CountryController;

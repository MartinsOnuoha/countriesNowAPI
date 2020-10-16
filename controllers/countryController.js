/* eslint-disable no-nested-ternary */
const CountriesAndCities = require('../model/countriesAndCities');
const CountriesAndUnicodes = require('../model/countriesAndUnicodes');
const CountriesAndFlag = require('../model/countriesAndFlag');
const CountriesAndCodes = require('../model/countriesAndCodes');
const CountriesAndStates = require('../model/countriesAndState');
const CountriesStateCity = require('../model/countriesStateCity');
const Finder = require('../helpers/finder');
const Respond = require('../helpers/respond');
const { getCountriesPopulation, getCitiesPopulation } = require('./dataHub');
const { getCountriesStateCities } = require('./github');
const {
  latestYear, greaterThan, lessThan, withRange, orderCountryData, orderCityData,
} = require('../helpers/utils');

const countryPopulation = getCountriesPopulation();
const citiesPopulation = getCitiesPopulation();
const positions = CountriesAndCodes.map((x) => ({ name: x.name, long: x.longitude, lat: x.latitude }));

const CountriesAndISO = CountriesAndFlag.map((x) => {
  const code = Finder.findCountryByParam(x.name, CountriesAndUnicodes, 'Name');
  const dataObj = {
    name: x.name,
    Iso2: code ? code.Iso2 : null,
    Iso3: code ? code.Iso3 : null,
  };
  return dataObj;
});
const CountriesAndCurrencies = CountriesAndUnicodes.map((x) => ({ name: x.Name, currency: x.Currency }));
const CountriesAndStatesFormatted = CountriesAndStates.map((x) => ({ name: x.name, iso3: x.iso3, states: x.states.map((y) => ({ name: y.name, state_code: y.state_code })) }));
const CountriesStateCityFormatted = CountriesStateCity.map((x) => ({ name: x.name, states: x.states }));
class CountryController {
  /**
   * Get all countries and cities
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesAndCities(req, res) {
    return Respond.success(res, 'countries and cities retrieved', CountriesAndCities);
  }

  /**
   * Get cities of a specified country
   * @param {RequestObject} req request obeject
   * @param {ResponseObject} res response object
   */
  static getCitiesByCountry(req, res) {
    const { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    const data = CountriesAndCities.find((x) => x.country.toLowerCase() === country.toLowerCase());

    if (!data) {
      return Respond.error(res, 'country not found', 404);
    }
    return Respond.success(res, `cities in ${country} retrieved`, data.cities);
  }

  /**
   * Get all countries, code and dial codes
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesAndCodes(req, res) {
    const data = CountriesAndCodes.map((x) => ({ name: x.name, code: x.code, dial_code: x.dial_code }));
    return Respond.success(res, 'countries and codes retrieved', data);
  }

  /**
   * get a single country and it's dial code
   *
   * @static
   * @param {Request} req
   * @param {Response} res
   * @returns Object
   * @memberof CountryController
   */
  static getSingleCountryAndDialCode(req, res) {
    let { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }

    country = country.toLowerCase().trim();
    const CountriesCodes = CountriesAndCodes.map((x) => ({ name: x.name, code: x.code, dial_code: x.dial_code }));
    const data = CountriesCodes.find((x) => x.name.toLowerCase().trim() === country);

    if (data) {
      return Respond.success(res, `${country} dail code retrieved`, data);
    }
    return Respond.error(res, 'country not found', 404);
  }

  /**
   * Get countries and positions
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesPosition(req, res) {
    return Respond.success(res, 'countries and positions retrieved', positions);
  }

  /**
   * Get a single country's position
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getSinglePosition(req, res) {
    const { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    const data = positions.find((x) => x.name.toLowerCase() === country.toLowerCase());
    if (!data) {
      return Respond.error(res, 'Country not found', 404);
    }
    return Respond.success(res, 'country position retrieved', data);
  }

  /**
   * Get countries by position range
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getPositionRange(req, res) {
    const { type, min, max } = req.body;
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
  }

  /**
   * get all countries and their ISON Code
   * @param {RequestObject} req
   * @param {ResponseObject} res
   */
  static getCountriesAndISO(req, res) {
    const data = CountriesAndISO;
    return Respond.success(res, 'countries and ISO codes retrieved', data);
  }

  /**
   *
   * @param {*} req
   * @param {*} res
   */
  static getSingleCountryAndISO(req, res) {
    let { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    country = country.toLowerCase().trim();
    const data = CountriesAndISO.find((x) => x.name.toLowerCase().trim() === country);

    if (!data) {
      return Respond.error(res, 'country not found', 404);
    }
    return Respond.success(res, 'country\'s ISO code retrieved', data);
  }

  /**
   * get all countries with their flag images
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesFlagImages(req, res) {
    const data = CountriesAndFlag.map((x) => {
      const dataObj = {
        name: x.name,
        flag: x.flag,
      };
      return dataObj;
    });
    return Respond.success(res, 'flags images retrieved', data);
  }

  /**
   * Get single country with flag image
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountryFlagImage(req, res) {
    const { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    const data = CountriesAndFlag.map((x) => ({ name: x.name, flag: x.flag })).find((x) => x.name.toLowerCase() === country.toLowerCase());
    if (!data) {
      return Respond.error(res, 'country not found', 404);
    }
    return Respond.success(res, 'country and flag retrieved', data);
  }

  /**
   * Get countries and unicode flags
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesUnicodeFlag(req, res) {
    const data = CountriesAndUnicodes.map((x) => ({ name: x.Name, unicodeFlag: x.Unicode }));
    return Respond.success(res, 'countries and unicode flags retrieved', data);
  }

  /**
   * Get a country and unicode flag
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountryUnicodeFlag(req, res) {
    const { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    const data = CountriesAndUnicodes.map((x) => ({ name: x.Name, unicodeFlag: x.Unicode })).find((x) => x.name.toLowerCase() === country.toLowerCase());
    return Respond.success(res, 'countries and unicode flags retrieved', data);
  }

  /**
   * Get countries and their capital
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesCapital(req, res) {
    const data = CountriesAndUnicodes.map((x) => ({ name: x.Name, capital: x.Capital }));
    return Respond.success(res, 'countries and capitals retrieved', data);
  }

  /**
   * Get single country and capital
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountryCapital(req, res) {
    const { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    const data = CountriesAndUnicodes.map((x) => ({ name: x.Name, capital: x.Capital })).find((x) => x.name.trim().toLowerCase() === country.trim().toLowerCase());
    if (!data) {
      return Respond.error(res, 'country not found', 404);
    }
    return Respond.success(res, 'country and capitals retrieved', data);
  }

  /**
   * Get countries and their currencies
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesAndCurrency(req, res) {
    const data = CountriesAndCurrencies;
    return Respond.success(res, 'countries and currencies retrieved', data);
  }

  /**
   * get a single country and it's currency
   * @param {Request} req
   * @param {Response} res
   */
  static getSingleCountryAndCurrency(req, res) {
    let { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    country = country.trim().toLowerCase();
    const data = CountriesAndCurrencies.find((x) => x.name.trim().toLowerCase() === country);

    if (!data) {
      Respond.error(res, 'country not found', 404);
    }
    return Respond.success(res, 'country and currency retrieved', data);
  }

  /**
   * Get countries information by specifying required data
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static getCountriesInfo(req, res) {
    const { returns = '' } = req.query;

    if (!returns) return Respond.error(res, 'you must specify data to fetch e.g ?returns=unicode,currency,image', 400);
    const params = returns.trim().split(',').map((x) => x.trim());

    // TODO: Add more data selectors
    const fetchCurrency = params.includes('currency');
    const fetchImage = params.includes('flag');
    const fetchUnicode = params.includes('unicodeFlag');

    const data = CountriesAndUnicodes.map((x) => {
      const countryAndFlag = fetchImage && CountriesAndFlag.find((c) => c.name.toLowerCase() === x.Name.toLowerCase());
      return ({
        name: x.Name,
        currency: (fetchCurrency && x.Currency) || undefined,
        unicodeFlag: (fetchUnicode && x.Unicode) || undefined,
        flag: (countryAndFlag && countryAndFlag.flag) || undefined,
      });
    });
    return Respond.success(res, `countries details: '${returns}' have been retrieved`, data);
  }

  /**
   * Get all countries and respective population
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static async getPopulation(req, res) {
    const data = await countryPopulation;
    return Respond.success(res, 'all countries and population 1961 - 2018', data);
  }

  /**
   * Get population of a specific country
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static async getPopulationByCountry(req, res) {
    const { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    const data = await countryPopulation;
    const filtered = data.find((x) => country.trim().toLowerCase() === x.country.trim().toLowerCase());
    if (!filtered) return Respond.error(res, 'country data not found', 404);
    return Respond.success(res, `${country} with population`, filtered);
  }

  /**
   * Filter countries population data
   * allowed queries { year: Number, limit: Number, gt: Number, lt: Number, order: String, orderBy: String }
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static async filterCountryPopulation(req, res) {
    const data = await countryPopulation;
    const {
      year = latestYear(data),
      limit = data.length,
      gt = false,
      lt = false,
      order = 'asc',
      orderBy = 'population',
    } = req.body;

    if (typeof limit !== 'number') return Respond.error(res, 'invalid payload format');

    const selectedYear = orderCountryData(data.map((x) => ({
      country: x.country,
      code: x.code,
      populationCounts: x.populationCounts.find((y) => y.year === year),
    })), order, orderBy);
    const result = gt && !lt ? greaterThan(selectedYear, gt) : lt && !gt ? lessThan(selectedYear, lt) : gt && lt ? withRange(selectedYear, gt, lt) : selectedYear;
    const applyLimit = result.splice(0, limit);

    return Respond.success(res, 'filtered result', applyLimit);
  }

  /**
   * get cities and population data
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static async getCitiesPopulation(req, res) {
    const data = await citiesPopulation;
    return Respond.success(res, 'all cities with population', data);
  }

  /**
   * get single city and its population data
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   */
  static async getPopulationByCity(req, res) {
    const { city } = req.body;
    if (!city) {
      return Respond.error(res, 'missing param (city)', 400);
    }
    const data = await citiesPopulation;
    const filtered = data.find((x) => city.trim().toLowerCase() === x.city.trim().toLowerCase());
    if (!filtered) {
      return Respond.error(res, 'city data not found', 404);
    }
    return Respond.success(res, `${city} with population`, filtered);
  }

  /**
   * filter cities and population data
   * @param {RequestObject} req
   * @param {ResponseObject} res
   */
  static async filterCitiesPopulation(req, res) {
    const data = await citiesPopulation;
    const {
      limit = data.length,
      order = 'asc',
      orderBy = 'population',
      country = false,
    } = req.body;

    if (typeof limit !== 'number') return Respond.error(res, 'invalid payload format');

    let result = orderCityData(data.map((x) => ({
      city: x.city,
      country: x.country,
      populationCounts: x.populationCounts,
    })), order, orderBy);
    if (country) {
      result = result.filter((x) => x.country.toLowerCase() === country.toLowerCase());
    }
    // remove unnecessary information from dataHub
    if (result[0].city === 'null') { result.shift(); }
    // add limit
    result = result.splice(0, limit);

    return Respond.success(res, 'filtered result', result);
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
    const data = await getCountriesStateCities();
    // eslint-disable-next-line no-console
    console.log(data);
    return Respond.success(res, 'countries state and cities', data);
  }

  /**
   * get countries and their states
   * @param {Request} req
   * @param {Response} res
   */
  static getCountriesState(req, res) {
    const data = CountriesAndStatesFormatted;
    return Respond.success(res, 'countries and states retrieved', data);
  }

  /**
   * get a single country's states
   * @param {Request} req
   * @param {Response} res
   */
  static getSingleCountryStates(req, res) {
    const { country } = req.body;
    if (!country) {
      return Respond.error(res, 'missing param (country)', 400);
    }
    const data = Object.values(CountriesAndStatesFormatted).find((x) => x.name.toLowerCase() === country.toLowerCase());
    if (!data) {
      return Respond.error(res, 'country not found', 404);
    }
    return Respond.success(res, `states in ${country} retrieved`, data);
  }

  /**
   * Get list of cities in a state
   * @param {Request} req 
   * @param {Response} res 
   */
  static async getStateCities(req, res) {
    let { country, state } = req.body;
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
      name: x.name.trim().toLowerCase().endsWith('state') ? x.name.toLowerCase().replace('state', '').trim() : x.name, 
      cities: x.cities 
    }));
    const stateData = Object.values(statesFormatted).find((x) => x.name.toLowerCase() === state.toLowerCase());
    if (!stateData) {
      return Respond.error(res, 'state not found', 404);
    }
    const cityList = stateData.cities.map((city) => city.name);
    return Respond.success(res, `cities in state ${state} of country ${country} retrieved`, cityList);
  }
  
  static getRandomCountry(req,res){
    const randomCountry = CountriesAndCodes[Math.floor(Math.random()*CountriesAndCodes.length)];
    return Respond.success(res,"retrieved random country",randomCountry);
  }

}
module.exports = CountryController;

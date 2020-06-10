const CountriesAndCities = require('../model/countriesAndCities')
const CountriesAndUnicodes = require('../model/countriesAndUnicodes')
const CountriesAndFlag = require('../model/countriesAndFlag')
const CountriesAndCodes = require('../model/countriesAndCodes');
const Finder = require('../helpers/finder');
const Respond = require('../helpers/respond');
const { getCountriesPopulation } = require('./dataHub/apiController');

const countryPopulation = getCountriesPopulation();
const positions = CountriesAndCodes.map(x => ({ name: x.name, long: x.longitude, lat: x.latitude }))

class CountryController {
    /**
     * Get all countries and cities
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesAndCities(req, res) {
        return Respond.success(res, 'countries and cities retrieved', CountriesAndCities);
    }
    /**
     * Get cities of a specified country
     * @param {Object} req request obeject
     * @param {Object} res response object
     */
    static getCitiesByCountry(req, res) {
        const { country } = req.body
        if (!country) {
            return Respond.error(res, 'missing param (country)', 400);
        }
        const data = CountriesAndCities.find(x => x.country.toLowerCase() == country.toLowerCase())

        if (!data) {
            return Respond.error(res, 'country not found', 404);
        }
        return Respond.success(res, `cities in ${country} retrieved`, data.cities);
    }
    /**
     * Get all countries, code and dial codes
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesAndCodes(req, res) {
        const data = CountriesAndCodes.map(x => ({ name: x.name, code: x.code, dial_code: x.dial_code }));
        return Respond.success(res, 'countries and codes retrieved', data);
    }
    /**
     * Get countries and positions
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesPosition(req, res) {
        return Respond.success(res, 'countries and positions retrieved', positions);
    }
    /**
     * Get a single country's position
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getSinglePosition(req, res) {
        const { country } = req.body;
        if (!country) {
            return Respond.error(res, 'missing param (country)', 400);
        }
        const data = positions.find(x => x.name.toLowerCase() === country.toLowerCase())
        if (!data) {
            return Respond.error(res, 'Country not found', 404);
        }
        return Respond.success(res, 'country position retrieved', data);
    }
    /**
     * Get countries by position range
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getPositionRange(req, res) {
        const { type, min, max } = req.body;
        if (!type || !min || !max) {
            return Respond.error(res, 'missing param (type, min, max)', 400)
        }
        let result = positions;
        switch (type) {
            case 'lat':
                result = positions.filter(x => Number(x.lat) >= Number(min) && Number(x.lat) <= Number(max) )
                break;
            case 'long':
                result = positions.filter(x => Number(x.long) >= Number(min) && Number(x.long) <= Number(max) )
                break;
            default:
                result = positions
                break;
        }
        return Respond.success(res, `countries between ${type} of (${min} and ${max})`, result);
    }
    /**
     * get all countries with their flag images
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesFlagImages(req, res) {
        const data = CountriesAndFlag.map(x => {
            let code = Finder.findCountryByName(x.name, CountriesAndUnicodes, 'Name')
            const dataObj = {
                name: x.name,
                flag: x.flag,
                Iso2: code ? code.Iso2 : null,
                Iso3: code ? code.Iso3 : null,
            }
            return dataObj

        });
        return Respond.success(res, 'flags images retrieved', data);
    }
    /**
     * Get single country with flag image
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountryFlagImage(req, res) {
        const { country } = req.body;
        if (!country) {
            return Respond.error(res, 'missing param (country)', 400)
        }
        const data = CountriesAndFlag.map(x => ({ name: x.name, flag: x.flag })).find(x => x.name.toLowerCase() === country.toLowerCase());
        if (!data) {
            return Respond.error(res, 'no records found', 404)
        }
        return Respond.success(res, 'country and flag retrieved', data);
    }
    /**
     * Get countries and unicode flags
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesUnicodeFlag(req, res) {
        const data = CountriesAndUnicodes.map(x => ({ name: x.Name, unicodeFlag: x.Unicode }));
        return Respond.success(res, 'countries and unicode flags retrieved', data);
    }
    /**
     * Get a country and unicode flag
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountryUnicodeFlag(req, res) {
        const { country } = req.body;
        if (!country) {
            return Respond.error(res, 'missing param (country)', 400);
        }
        const data = CountriesAndUnicodes.map(x => ({ name: x.Name, unicodeFlag: x.Unicode })).find(x => x.name.toLowerCase() === country.toLowerCase())
        return Respond.success(res, 'countries and unicode flags retrieved', data)
    }
    /**
     * Get countries and their capital
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesCapital(req, res) {
        const data = CountriesAndUnicodes.map(x => ({ name: x.Name, capital: x.Capital }));
        return Respond.success(res, 'countries and capitals retrieved', data)
    }
    /**
     * Get single country and capital
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountryCapital(req, res) {
        const { country } = req.body;
        if (!country) {
            return Respond.error(res, 'missing param (country)', 400);
        }
        const data = CountriesAndUnicodes.map(x => ({ name: x.Name, capital: x.Capital })).find(x => x.name.toLowerCase() === country.toLowerCase())
        return Respond.success(res, 'countries and capitals retrieved', data);
    }
    /**
     * Get countries and their currencies
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesAndCurrency(req, res) {
        const data = CountriesAndUnicodes.map(x => ({ name: x.Name, currency: x.Currency }))
        return Respond.success(res, 'countries and currencies retrieved', data);
    }
    /**
     * Get countries information by specifying required data
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesInfo(req, res) {
        const {returns = ""} = req.query;

        if(!returns) return Respond.error(res, "you must specify data to fetch e.g ?returns=unicode,currency,image", 400);
        const params = returns.trim().split(",").map(x => x.trim());

        // TODO: Add more data selectors
        const fetchCurrency = params.includes("currency");
        const fetchImage = params.includes("flag");
        const fetchUnicode = params.includes("unicodeFlag");

        const data = CountriesAndUnicodes.map(x => {
            const countryAndFlag = fetchImage && CountriesAndFlag.find(c => c.name.toLowerCase() === x.Name.toLowerCase());
            return ({
                name: x.Name,
                currency: (fetchCurrency && x.Currency) || undefined,
                unicodeFlag: (fetchUnicode && x.Unicode) || undefined,
                flag: (countryAndFlag && countryAndFlag.flag) || undefined,
            })
        })
        return Respond.success(res, `countries details: '${returns}' have been retrieved`, data);
    }
    /**
     * Get all countries and respective population
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static async getPopulation(req, res) {
        const data = await countryPopulation;
        return Respond.success(res, 'all countries and population 1961 - 2018', data);
    }
    /**
     * Get population of a specific country
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static async getPopulationByCountry(req, res) {
        const { country } = req.body;
        if (!country) {
            return Respond.error(res, 'missing param (country)', 404);
        }
        const data = await countryPopulation;
        const filtered = data.find(x => country.trim().toLowerCase() === x.country.trim().toLowerCase());
        return Respond.success(res, `${country} with population`, filtered);
    }
}

module.exports = CountryController

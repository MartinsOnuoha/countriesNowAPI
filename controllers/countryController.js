const CountriesAndCities = require('../model/countriesAndCities')
const CountriesAndUnicodes = require('../model/countriesAndUnicodes')
const CountriesAndFlag = require('../model/countriesAndFlag')
const CountriesAndCodes = require('../model/countriesAndCodes');
const Finder = require('../helpers/finder');
const positions = CountriesAndCodes.map(x => ({ name: x.name, long: x.longitude, lat: x.latitude }))

const Respond = require('../helpers/respond');

class CountryController {
    /**
     * Get all countries and cities
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesAndCities(req, res) {
        return res.status(200).json({
            error: false,
            msg: 'countries and cities retrieved',
            data: CountriesAndCities
        })
    }
    /**
     * Get cities of a specified country
     * @param {Object} req request obeject
     * @param {Object} res response object
     */
    static getCitiesByCountry(req, res) {
        const { country } = req.body
        if (!country) {
            return res.status(400).json({
                error: true,
                msg: 'missing param (country)'
            })
        }
        const countryFound = CountriesAndCities.find(x => x.country.toLowerCase() == country.toLowerCase())

        if (!countryFound) {
            return res.status(404).json({
                error: true,
                msg: 'country not found'
            })
        }
        return res.status(200).json({
            error: false,
            msg: `cities in ${country} retrieved`,
            data: countryFound.cities
        })
    }
    /**
     * Get all countries, code and dial codes
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesAndCodes(req, res) {
        return res.status(200).json({
            error: false,
            msg: 'countries and codes retrieved',
            data: CountriesAndCodes.map(x => ({ name: x.name, code: x.code, dial_code: x.dial_code }))
        });
    }
    /**
     * Get countries and positions
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesPosition(req, res) {
        return res.status(200).json({
            error: false,
            msg: 'countries and positions retrieved',
            data: positions
        })
    }
    /**
     * Get a single country's position
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getSinglePosition(req, res) {
        const { country } = req.body;
        if (!country) {
            return res.status(400).json({
                error: true,
                msg: 'missing param (country)'
            })
        }
        return res.status(200).json({
            error: false,
            msg: 'country position retrieved',
            data: positions.find(x => x.name.toLowerCase() === country)
        });
    }
    /**
     * Get countries by position range
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getPositionRange(req, res) {
        const { type, min, max } = req.body;
        !type || !min || !max ? res.status(400).json({
            error: true,
            msg: 'missing param (type, min, max)'
        }) : false
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

        return res.status(200).json({
            error: true,
            msg: `countries between ${type} of (${min} and ${max})`,
            data: result
        });
    }
    /**
     * get all countries with their flag images
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesFlagImages(req, res) {

        return res.status(200).json({
            error: false,
            msg: 'flags images retrieved',
            // data: CountriesAndFlag.map(x => ({
            //     name: x.name,
            //     flag: x.flag,
            // })),
            data: CountriesAndFlag.map(x => {

                let code = Finder.findCountryByName(x.name, CountriesAndUnicodes, 'Name')

                const dataObj = {
                    name: x.name,
                    flag: x.flag,
                    Iso2: code ? code.Iso2 : null,
                    Iso3: code ? code.Iso3 : null,
                }
                return dataObj
                // code: Finder.findCountryByName(x.name, ).

            })
        });
    }
    /**
     * Get single country with flag image
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountryFlagImage(req, res) {
        const { country } = req.body;
        if (!country) {
            return res.status(400).json({
                error: true,
                msg: 'missing param (country)'
            })
        }

        return res.status(200).json({
            error: false,
            msg: 'country and flag retrieved',
            data: CountriesAndFlag.map(x => ({ name: x.name, flag: x.flag })).find(x => x.name.toLowerCase() === country.toLowerCase())
        });
    }
    /**
     * Get countries and unicode flags
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesUnicodeFlag(req, res) {
        return res.status(200).json({
            error: false,
            msg: 'countries and unicode flags retrieved',
            data: CountriesAndUnicodes.map(x => ({ name: x.Name, unicodeFlag: x.Unicode }))
        });
    }
    /**
     * Get a country and unicode flag
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountryUnicodeFlag(req, res) {
        const { country } = req.body;
        if (!country) {
            return res.status(400).json({
                error: true,
                msg: 'missing param (country)'
            });
        }
        return res.status(200).json({
            error: false,
            msg: 'countries and unicode flags retrieved',
            data: CountriesAndUnicodes.map(x => ({ name: x.Name, unicodeFlag: x.Unicode })).find(x => x.name.toLowerCase() === country.toLowerCase())
        });
    }
    /**
     * Get countries and their capital
     * @param {Object} req request object
     * @param {Object} res response object
     */
    static getCountriesCapital(req, res) {
        return res.status(200).json({
            error: false,
            msg: 'countries and capitals retrieved',
            data: CountriesAndUnicodes.map(x => ({ name: x.Name, capital: x.Capital }))
        });
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
}

module.exports = CountryController

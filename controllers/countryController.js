const CountriesAndCities = require('../model/countriesAndCities')
const CountriesAndUnicodes = require('../model/countriesAndUnicodes')
const CountriesAndFlag = require('../model/countriesAndFlag')
const CountriesAndCodes = require('../model/countriesAndCodes')
const positions = CountriesAndCodes.map(x => ({ name: x.name, long: x.longitude, lat: x.latitude }))

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
        })
    }
}

module.exports = CountryController

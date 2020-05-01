const CountriesAndCities = require('../model/countriesAndCities')
const CountriesAndUnicodes = require('../model/countriesAndUnicodes')
const CountriesAndFlag = require('../model/countriesAndFlag')
const CountriesAndCodes = require('../model/countriesAndCodes')

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
}

module.exports = CountryController

const CountriesAndCities = require('../model/countriesAndCities')

class CountryController {
    static getAll(req, res) {
        return res.status(200).json({
            error: false,
            msg: 'countries and cities retrieved',
            data: CountriesAndCities
        })
    }

    static getCitiesByCountry(req, res) {
        const { country } = req.body
        if (!country) {
            return res.status(400).json({
                error: true,
                msg: 'missing param (country)'
            })
        }
        const countryFound = CountriesAndCities.find(x => x.country == country)

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
}

module.exports = CountryController

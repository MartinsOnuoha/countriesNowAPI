const express = require('express')
const router = express.Router()

const CountryController  = require('../controllers/countryController')

router.get('/', CountryController.getCountriesAndCities)
router.post('/cities', CountryController.getCitiesByCountry)
router.get('/codes', CountryController.getCountriesAndCodes)

module.exports = router;

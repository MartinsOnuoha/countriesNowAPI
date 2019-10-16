const express = require('express')
const router = express.Router()

const CountryController  = require('../controllers/countryController')

router.get('/', CountryController.getAll)
router.get('/cities-by-country', CountryController.getCitiesByCountry)

module.exports = router;

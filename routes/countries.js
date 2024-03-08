const express = require('express');
const apicache = require('apicache');
const apicacheConfig = require('../config/apicache');

const router = express.Router();
const CountryController = require('../controllers/countryController');
const redirectPostToGet = require('../middlewares/redirectPostToGet');

const cache = apicache.options(apicacheConfig).middleware;
const cacheOnlyGET = cache('1 day', (req) => req.method === 'GET');
router.use(cacheOnlyGET);

// Redirect all POST requests to GET requests by appending /q and the request body as query parameters
router.use(redirectPostToGet);

router.get('/', CountryController.getCountriesAndCities);

router.get('/cities/q', CountryController.getCitiesByCountry);

router.get('/codes', CountryController.getCountriesAndCodes);
router.get('/codes/q', CountryController.getSingleCountryAndDialCode);

router.get('/iso', CountryController.getCountriesAndISO);
router.get('/iso/q', CountryController.getSingleCountryAndISO);

router.get('/currency', CountryController.getCountriesAndCurrency);
router.get('/currency/q', CountryController.getSingleCountryAndCurrency);

router.get('/info', CountryController.getCountriesInfo);

router.get('/capital', CountryController.getCountriesCapital);
router.get('/capital/q', CountryController.getCountryCapital);

router.get('/flag/images', CountryController.getCountriesFlagImages);
router.get('/flag/images/q', CountryController.getCountryFlagImage);
router.get('/flag/unicode', CountryController.getCountriesUnicodeFlag);
router.get('/flag/unicode/q', CountryController.getCountryUnicodeFlag);

router.get('/positions', CountryController.getCountriesPosition);
router.get('/positions/q', CountryController.getSinglePosition);
router.get('/positions/range/q', CountryController.getPositionRange);

router.get('/population', CountryController.getPopulation);
router.get('/population/q', CountryController.getPopulationByCountry);
router.get('/population/filter/q', CountryController.filterCountryPopulation);
router.get('/population/cities', CountryController.getCitiesPopulation);
router.get('/population/cities/q', CountryController.getPopulationByCity);
router.get('/population/cities/filter/q', CountryController.filterCitiesPopulation);

router.get('/states', CountryController.getCountriesState);
router.get('/states/q', CountryController.getSingleCountryStates);
router.get('/state/cities/q', CountryController.getStateCities);

router.get('/random', CountryController.getRandomCountry);

module.exports = router;

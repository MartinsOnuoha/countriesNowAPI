const express = require('express');

const router = express.Router();
const CountryController = require('../controllers/countryController');

router.get('/', CountryController.getCountriesAndCities);
router.post('/cities', CountryController.getCitiesByCountry);
router.get('/codes', CountryController.getCountriesAndCodes);
router.post('/codes', CountryController.getSingleCountryAndDialCode);
router.get('/iso', CountryController.getCountriesAndISO);
router.post('/iso', CountryController.getSingleCountryAndISO);
router.get('/currency', CountryController.getCountriesAndCurrency);
router.post('/currency', CountryController.getSingleCountryAndCurrency);
router.get('/info', CountryController.getCountriesInfo);
router.get('/capital', CountryController.getCountriesCapital);
router.post('/capital', CountryController.getCountryCapital);
router.get('/flag/images', CountryController.getCountriesFlagImages);
router.post('/flag/images', CountryController.getCountryFlagImage);
router.get('/flag/unicode', CountryController.getCountriesUnicodeFlag);
router.post('/flag/unicode', CountryController.getCountryUnicodeFlag);

router.get('/positions', CountryController.getCountriesPosition);
router.post('/positions', CountryController.getSinglePosition);
router.post('/positions/range', CountryController.getPositionRange);

router.get('/population', CountryController.getPopulation);
router.post('/population', CountryController.getPopulationByCountry);
router.post('/population/filter', CountryController.filterCountryPopulation);
router.get('/population/cities', CountryController.getCitiesPopulation);
router.post('/population/cities', CountryController.getPopulationByCity);
router.post('/population/cities/filter', CountryController.filterCitiesPopulation);
router.get('/states', CountryController.getCountriesState);
router.post('/states', CountryController.getSingleCountryStates);
router.post('/state/cities', CountryController.getStateCities);

router.get("/random",CountryController.getRandomCountry);

module.exports = router;

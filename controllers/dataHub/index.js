/* eslint-disable */

const ApiService = require('../../services/apiService');

const dataHubBaseUrl = process.env.DATA_HUB;

/**
 * get countries and population data
 */
const getCountriesPopulation = () => {
  const endpoint = 'population/population_json/data/315178266aa86b71057e993f98faf886/population_json.json';
  const apiService = new ApiService(dataHubBaseUrl);

  return apiService.getData(endpoint).then((data) => {
    // format data
    const result = data.reduce((accumulator, item) => {
      const key = item['Country Name'];
      !accumulator[key] ? accumulator[key] = [item] : accumulator[key].push(item);
      return accumulator;
    }, {});
    const final = Object.entries(result).map((x, i) => ({ country: x[0], code: x[1][0]['Country Code'], populationCounts: x[1].map((y) => ({ year: y.Year, value: y.Value })) }));
    return final;
  });
};
/**
 * get cities and population data
 */
const getCitiesPopulation = () => {
  const endpoint = 'population-city/unsd-citypopulation-year-both_json/data/063b2f68e9867349c11dd88bb311c0d9/unsd-citypopulation-year-both_json.json';
  const apiService = new ApiService(dataHubBaseUrl);

  return apiService.getData(endpoint).then((data) => {
    // format data
    const result = data.reduce((accumulator, item) => {
      const key = item.City;
      !accumulator[key] ? accumulator[key] = [item] : accumulator[key].push(item);
      return accumulator;
    }, {});
    const final = Object.entries(result).map((x, i) => ({
      city: x[0],
      country: x[1][0]['Country or Area'],
      populationCounts: x[1].map((y) => ({
        year: y.Year, value: y.Value, sex: y.Sex, reliabilty: y.Reliability,
      })),
    }));
    return final;
  });
};

module.exports = {
  getCountriesPopulation,
  getCitiesPopulation,
};

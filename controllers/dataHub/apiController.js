const ApiService = require('../../services/apiService');
const dataHubBaseUrl = 'https://pkgstore.datahub.io/core/';

const getCountriesPopulation = () => {
  const url = 'population/population_json/data/315178266aa86b71057e993f98faf886/population_json.json'
  const apiService = new ApiService(dataHubBaseUrl);

  return apiService.getData(url).then((data) => {
      // format data
      const result = data.reduce((accumulator, item) => {
          let key = item['Country Name']
          !accumulator[key] ? accumulator[key] = [] : accumulator[key].push(item);
          return accumulator;
        }, {});
      const final = Object.entries(result).map((x, i) => ({ country: x[0], code: x[1][0]['Country Code'], populationCounts: x[1].map(y => ({ year: y.Year, value: y.Value })) }))
      return final;
  })
}

module.exports = {
  getCountriesPopulation
}

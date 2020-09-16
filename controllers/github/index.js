const ApiService = require('../../services/apiService');

const BaseUrl = process.env.GITHUB_URL;

const getCountriesStateCities = () => {
  const endpoint = 'dr5hn/countries-states-cities-database/master/countries%2Bstates%2Bcities.json';
  const apiService = new ApiService(BaseUrl);

  return apiService.getData(endpoint).then((data) => {
    // eslint-disable-next-line no-console
    console.log(data);
    return data;
  })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.log(err);
    });
};

module.exports = {
  getCountriesStateCities,
};

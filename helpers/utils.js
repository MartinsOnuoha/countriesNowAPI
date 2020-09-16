/* eslint-disable no-nested-ternary */
/**
 * Get the latest year provided by API
 * @param {Array} data array object
 */
const latestYear = (data) => data[0].populationCounts[data[0].populationCounts.length - 1].year;
/**
 * Order country data
 * @param {Array} data array object to sort
 * @param {String} type sort type (asc, dsc)
 * @param {String} orderBy parameter to sort by (population, name)
 */
const orderCountryData = (data, type = 'asc', orderBy = 'population') => {
  if (orderBy.trim().toLowerCase() === 'name') {
    return data.sort((a, b) => {
      const casedA = a.country.toUpperCase();
      const casedB = b.country.toUpperCase();

      return (casedA < casedB) && type === 'asc' ? -1
        : (casedA > casedB) && type === 'asc' ? 1
          : (casedA < casedB) && type === 'dsc' ? 1
            : (casedA > casedB) && type === 'dsc' ? -1
              : 0;
    });
  }
  if (type.trim().toLowerCase() === 'dsc') {
    return data.sort((a, b) => b.populationCounts.value - a.populationCounts.value);
  }
  return data.sort((a, b) => a.populationCounts.value - b.populationCounts.value);
};
/**
 * Order City data
 * @param {Array} data array object to sort
 * @param {String} type sort type (asc, dsc)
 * @param {String} orderBy parameter to sort by (population, name)
 */
const orderCityData = (data, type = 'asc', orderBy = 'population') => {
  if (orderBy.trim().toLowerCase() === 'name') {
    return data.sort((a, b) => {
      const casedA = a.city.toUpperCase();
      const casedB = b.city.toUpperCase();

      return (casedA < casedB) && type === 'asc' ? -1
        : (casedA > casedB) && type === 'asc' ? 1
          : (casedA < casedB) && type === 'dsc' ? 1
            : (casedA > casedB) && type === 'dsc' ? -1
              : 0;
    });
  }
  if (type.trim().toLowerCase() === 'dsc') {
    return data.sort((a, b) => b.populationCounts[0].value - a.populationCounts[0].value);
  }
  return data.sort((a, b) => a.populationCounts[0].value - b.populationCounts[0].value);
};
/**
 * get population data greater than provided range
 * @param {Array} data array object to filters
 * @param {Number} range value to filter by
 */
const greaterThan = (data, range) => data.filter((x) => x.populationCounts.value > range);
/**
 * get population data less than provided range
 * @param {Array} data array object to filter
 * @param {Number} range
 */
const lessThan = (data, range) => data.filter((x) => x.populationCounts.value < range);
/**
 * get population data within a range
 * @param {Array} data array object to filters
 * @param {Number} gt values in array should be greater than gt
 * @param {Number} lt values in array should be less than lt
 */
const withRange = (data, gt, lt) => data.filter((x) => x.populationCounts.value > gt && x.populationCounts.value < lt);

module.exports = {
  latestYear,
  orderCountryData,
  orderCityData,
  greaterThan,
  lessThan,
  withRange,
};

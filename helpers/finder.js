class Finder {
  /**
     * Due to the inconsistency of naming in the provided data, we need to
     * specify what param to search by
     * @param {string} name your query
     * @param {Array} arr the array to check
     * @param {param} param the parameter
     */
  static findCountryByParam(name, arr, param) {
    return arr.find((x) => x[`${param}`].toLowerCase() === name.toLowerCase());
  }
}

module.exports = Finder;

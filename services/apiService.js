const axios = require('axios');
/**
 * ApiService Class
 */
class ApiService {
  /**
   * constructor function
   * @param {String} baseUrl API base URL
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.api = axios.create({
      baseURL: baseUrl,
      timeout: 40000,
    });
  }

  /**
   * fetch data from endpoint
   * @param {String} endpoint url endpoint to access
   */
  async getData(endpoint) {
    const response = await this.api.get(endpoint);
    return response.data;
  }
}

module.exports = ApiService;

const axios = require('axios')

class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.api = axios.create({
      baseURL: baseUrl,
      timeout: 5000
    })
  }

  async getData(endpoint) {
    const response = await this.api.get(endpoint)
    return response.data;
  }
}

module.exports = ApiService;

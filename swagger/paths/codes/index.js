const methods = {
  getCodes: {
    tags: ['Codes'],
    description: 'Get cities and dial codes',
    parameters: [],
    responses: {
      '200': {
        description: 'Cities and dial codes retrieved'
      }
    }
  },
  getISO: {
    tags: ['Codes'],
    description: 'get all countries with their ISO2&3 Codes',
    parameters: [],
    responses: {
      '200': {
        description: 'countries and ISO codes retrieved'
      }
    }
  }
}

module.exports = methods

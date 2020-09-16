const methods = {
  getCountriesStates: {
    tags: ['States'],
    description: 'get all countries with their states',
    parameters: [],
    responses: {
      200: {
        description: 'countries and states retrieved',
      },
    },
  },
  getSingleCountryStates: {
    tags: ['States'],
    description: 'Get a single country and its states',
    parameters: [],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/countryPayload',
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'states in {country} retrieved',
      },
    },
  },
};

module.exports = methods;

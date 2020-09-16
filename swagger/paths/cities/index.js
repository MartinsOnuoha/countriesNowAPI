const methods = {
  getCountriesAndCities: {
    tags: ['Cities'],
    description: 'Get all countries and thier cities',
    responses: {
      200: {
        description: 'countries and cities retrieved',
      },
    },
  },
  getCities: {
    tags: ['Cities'],
    description: 'Get cities of a specified country',
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
        description: 'cities in Nigeria retrieved',
      },
    },
  },
};

module.exports = methods;

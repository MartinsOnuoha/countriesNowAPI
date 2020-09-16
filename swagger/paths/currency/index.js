const methods = {
  getCurrencies: {
    tags: ['Currencies'],
    description: 'Get countries and their currencies',
    responses: {
      200: {
        description: 'countries and currencies retrieved',
      },
    },
  },
  getSingleCurrency: {
    tags: ['Currencies'],
    description: 'Get a single country and its currency',
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
        description: 'country and currency retrieved',
      },
      404: {
        description: 'country not found',
      },
      400: {
        description: 'missing param (country)',
      },
    },
  },
};

module.exports = methods;

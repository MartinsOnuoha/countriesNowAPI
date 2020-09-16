const methods = {
  getCapitals: {
    tags: ['Capital'],
    description: 'Get all countries and thier capital',
    responses: {
      200: {
        description: 'countries and capitals retrieved',
      },
    },
  },
  getCapitalSingle: {
    tags: ['Capital'],
    description: 'Get a specific country and its capital',
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
        description: 'country and capitals retrieved',
      },
    },
  },
};

module.exports = methods;

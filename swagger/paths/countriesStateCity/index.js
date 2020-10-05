const methods = {
  getStateCities: {
    tags: ['Cities'],
    description: 'Get all cities in a state',
    parameters: [],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/countryStatePayload',
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'cities in state {state} of country {country} retrieved',
      },
    },
  },
};
  
module.exports = methods;

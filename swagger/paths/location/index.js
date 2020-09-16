const methods = {
  getPosition: {
    tags: ['Location'],
    description: 'get all countries with their longitude and latitude',
    parameters: [],
    responses: {
      200: {
        description: 'countries and positions retrieved',
      },
    },
  },
  getPositionSingle: {
    tags: ['Location'],
    description: 'Get single country and its positions',
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
        description: 'country position retrieved',
      },
    },
  },
  getPositionRange: {
    tags: ['Location'],
    description: 'Get countries by position range',
    parameters: [],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/positionRange',
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'countries between long of (1 and 40)',
      },
    },
  },
};

module.exports = methods;

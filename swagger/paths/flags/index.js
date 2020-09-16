const methods = {
  getFlagImages: {
    tags: ['Flag'],
    description: 'get all countries with their flag images url',
    parameters: [],
    responses: {
      200: {
        description: 'flags images retrieved',
      },
    },
  },
  getFlagImagesSingle: {
    tags: ['Flag'],
    description: 'Get single country with flag image',
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
        description: 'country and flag retrieved',
      },
    },
  },
  getFlagUnicode: {
    tags: ['Flag'],
    description: 'get all countries with their flag in unicode format',
    parameters: [],
    responses: {
      200: {
        description: 'countries and unicode flags retrieved',
      },
    },
  },
  getFlagUnicodeSingle: {
    tags: ['Flag'],
    description: 'get a single country with its flag in unicode format',
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
        description: 'countries and unicode flags retrieved',
      },
    },
  },
};

module.exports = methods;

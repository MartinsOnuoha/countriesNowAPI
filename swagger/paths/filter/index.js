const methods = {
  getProps: {
    tags: ['Filter'],
    description: 'Get only specified countries information',
    parameters: [
      {
        name: 'returns',
        in: 'query',
        required: true,
        schema: {
          $ref: '#/components/schemas/returns',
        },
      },
    ],
    responses: {
      200: {
        description: 'countries details: \'currency,flag,unicodeFlag\' have been retrieved',
      },
    },
  },
};

module.exports = methods;

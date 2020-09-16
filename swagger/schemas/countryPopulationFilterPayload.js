module.exports = {
  type: 'object',
  description: 'payload for single country',
  properties: {
    year: {
      $ref: '#/components/schemas/year',
    },
    limit: {
      $ref: '#/components/schemas/limit',
    },
    lt: {
      $ref: '#/components/schemas/lt',
    },
    gt: {
      $ref: '#/components/schemas/gt',
    },
    orderBy: {
      $ref: '#/components/schemas/orderBy',
    },
    order: {
      $ref: '#/components/schemas/order',
    },
  },
  example: {
    year: 2000,
    limit: 10,
    lt: 651348588,
    gt: 6513485,
    orderBy: 'name',
    order: 'dsc',
  },
};

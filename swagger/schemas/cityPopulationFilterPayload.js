module.exports = {
  type: 'object',
  description: 'payload for single country',
  properties: {
    country: {
      $ref: '#/components/schemas/countryName',
    },
    limit: {
      $ref: '#/components/schemas/limit',
    },
    orderBy: {
      $ref: '#/components/schemas/orderBy',
    },
    order: {
      $ref: '#/components/schemas/order',
    },
  },
  example: {
    country: 'nigeria',
    limit: 10,
    orderBy: 'name',
    order: 'asc',
  },
};

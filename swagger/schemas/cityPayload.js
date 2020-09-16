module.exports = {
  type: 'object',
  description: 'payload for single city',
  properties: {
    country: {
      $ref: '#/components/schemas/cityName',
    },
  },
  example: {
    city: 'lagos',
  },
};

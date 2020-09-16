module.exports = {
  type: 'object',
  description: 'payload for single country',
  properties: {
    country: {
      $ref: '#/components/schemas/countryName',
    },
  },
  example: {
    country: 'Nigeria',
  },
};

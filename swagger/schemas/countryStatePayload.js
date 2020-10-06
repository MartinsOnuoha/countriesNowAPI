module.exports = {
  type: 'object',
  description: 'payload for country and state',
  properties: {
    country: {
      $ref: '#/components/schemas/countryName',
    },
    state: {
      $ref: '#/components/schemas/stateName',
    }
  },
  example: {
    country: 'Afghanistan',
    state: 'Badakhshan'
  },
};

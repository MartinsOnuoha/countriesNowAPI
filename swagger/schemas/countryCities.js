module.exports = {
  type: 'object',
  properties: {
    country: {
      $ref: '#/components/schemas/countryName',
    },
    cities: {
      type: 'array',
      description: 'array of cities',
      items: {
        $ref: '#/components/schemas/cityName',
      },
      example: ['Aba', 'Abakaliki', 'Abeokuta'],
    },
  },
};

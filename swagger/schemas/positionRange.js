module.exports = {
  type: 'object',
  description: '',
  properties: {
    type: {
      type: 'string',
      description: 'the position type to get (long or lat)',
      example: 'long',
    },
    min: {
      type: 'number',
      description: 'the minimum range value',
      example: 1,
    },
    max: {
      type: 'number',
      description: 'the maximum range value',
      example: 400,
    },
  },
  example: {
    type: 'long',
    min: 1,
    max: 40,
  },
};

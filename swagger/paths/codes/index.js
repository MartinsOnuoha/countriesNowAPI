const methods = {
  getCodes: {
    tags: ['Codes'],
    description: 'Get cities and dial codes',
    parameters: [],
    responses: {
      200: {
        description: 'Cities and dial codes retrieved',
      },
    },
  },
  getCodesSingle: {
    tags: ['Codes'],
    description: 'Get a single country and its dial code',
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
        description: 'nigeria dail code retrieved',
      },
      404: {
        description: 'country not found',
      },
      400: {
        description: 'missing param (country)',
      },
    },
  },
  getSingleContryDialCode: {
    tags: ['Codes'],
    description: 'get a single country\'s dail code',
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
        description: 'country\'s dial code retrieved',
      },
    },
  },
  getISO: {
    tags: ['Codes'],
    description: 'get all countries with their ISO2&3 Codes',
    parameters: [],
    responses: {
      200: {
        description: 'countries and ISO codes retrieved',
      },
    },
  },
  getISOSingle: {
    tags: ['Codes'],
    description: 'Get a single country and its ISO code',
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
        description: 'country\'s ISO code retrieved',
      },
      404: {
        description: 'country not found',
      },
      400: {
        description: 'missing param (country)',
      },
    },
  },
};

module.exports = methods;

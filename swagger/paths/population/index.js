const methods = {
  getCityPopulation: {
    tags: ['Population'],
    description: 'get all countries with their longitude and latitude',
    parameters: [],
    responses: {
      200: {
        description: 'countries and positions retrieved',
      },
    },
  },
  getSingleCityPopulation: {
    tags: ['Population'],
    description: 'Get a single city and its population data',
    parameters: [],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/cityPayload',
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'single city and its population data retrieved',
      },
    },
  },
  getCountryPopulation: {
    tags: ['Population'],
    description: 'Get all countries and respective population',
    parameters: [],
    responses: {
      200: {
        description: 'countries and population retrieved',
      },
    },
  },
  getSingleCountryPopulation: {
    tags: ['Population'],
    description: 'Get single country and population data',
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
        description: 'single country and population data retrieved',
      },
    },
  },
  filterCountryPopulation: {
    tags: ['Population'],
    description: 'Filter countries population data',
    parameters: [],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/countryPopulationFilterPayload',
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'filtered result',
      },
    },
  },
  filterCityPopulation: {
    tags: ['Population'],
    description: 'Filter cities and population data',
    parameters: [],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/cityPopulationFilterPayload',
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'filtered result',
      },
    },
  },
};

module.exports = methods;

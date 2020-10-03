const methods = {
    getRandomCountry: {
      tags: ['Random'],
      description: 'Get one random country and its dial code, country code, latitude and longitude',
      responses: {
        200: {
          description: 'retrieved random country',
        },
      },
    }
};
module.exports = methods;
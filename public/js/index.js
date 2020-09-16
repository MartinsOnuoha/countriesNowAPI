// eslint-disable-next-line no-undef
renderjson.set_show_to_level('all');

// eslint-disable-next-line func-names
(function () {
  document.getElementById('json').appendChild(
    // eslint-disable-next-line no-undef
    renderjson({
      error: false,
      msg: 'lagos with population',
      data: {
        city: 'Lagos',
        country: 'Nigeria',
        populationCounts: [
          {
            year: '1991',
            value: '5195247',
            sex: 'Both Sexes',
            reliabilty: 'Final figure, complete',
          },
        ],
      },
    }),
  );
}());

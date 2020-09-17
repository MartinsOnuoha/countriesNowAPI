# [CountriesNow API](https://countriesnow.space/)

[![CountriesNow](https://circleci.com/gh/MartinsOnuoha/countriesNowAPI.svg?style=svg)](https://circleci.com/gh/circleci/circleci-docs)

> A curation of Countries data including (dial codes, states, cities, currencies, capitals etc) served over a REST API so you don't have to have them locally in your applications.
> This means lighter application sizes as you wouldn't have to install another package to use geo data.
> Please note that this doesn't guarantee complete or correct data, feel free to raise issues where necessary.
>

![landing page](https://raw.githubusercontent.com/MartinsOnuoha/countriesAndCitiesAPI/chore/update-readme/public/img/landing.png)

## USAGE

> The API does not require any form of Authentication or token.

```javascript

const BASE_URL = 'https://countriesnow.space/api/v0.1/countries'

let getCountries = async () => {
  const response = await fetch(`${BASE_URL}`).then(response => response.json())
  const { data } = response

  data.forEach((country) => {
    console.log(country) // {"country": "Afghanistan", "cities": [ "Herat", "Kabul", "Kandahar", "Molah", ...]}
  })
}
```

The API does not require any form of Authentication or token.

- Read Docs on: [Postman](https://documenter.getpostman.com/view/1134062/T1LJjU52?version=latest)
- Try it out on: [Swagger](https://countriesnow.space/swagger-docs)

---------------------------------------------

## Local Setup

```sh
git clone https://github.com/YourName/countriesNowAPI.git
```

### Change directory

```sh
cd countriesNowAPI
```

### Install packages

```sh
npm i
```

### Start Project

```sh
npm start
```

### Run test

```sh
npm run integration:test
```

## Contribution

> Please read the contribution guide [here](https://github.com/MartinsOnuoha/countriesNowAPI/blob/master/docs/contribution.md)
>

✨ All thanks to [this gist](https://gist.github.com/keeguon/2310008), [datahub](https://pkgstore.datahub.io/core/), and [this repository](www.github.com/dr5hn/countries-states-cities-database) for the data curated.

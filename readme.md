# [CountriesNow API](https://countriesnow.space/)

> A curation of Countries data including (dial codes, states, cities, currencies, capitals etc) served over a REST API so you don't have to have them locally in your applications.
> This means lighter application sizes as you wouldn't have to install another package to use geo data.

![landing page](https://raw.githubusercontent.com/MartinsOnuoha/countriesAndCitiesAPI/chore/update-readme/public/img/landing.png)

## USAGE

The API does not require any form of Authentication or token.

- Read Docs on: [Postman](https://documenter.getpostman.com/view/1134062/T1LJjU52?version=latest)
- Try it out on: [Swagger](https://countriesnow.space/swagger-docs)

-------------------------

## Table of Endpoints

> **NOTE**: We have moved API documentation to [Postman](https://documenter.getpostman.com/view/1134062/T1LJjU52?version=latest).
> Test Endpoints with Swagger [Here](https://countriesnow.space/swagger-docs)
> Feel free to keep using this readme (documentation might be discontinued on the readme in the future)

- [CountriesNow API](#countriesnow-api)
  - [USAGE](#usage)
  - [Table of Endpoints](#table-of-endpoints)
    - [Get All Countries and Cities](#get-all-countries-and-cities)
    - [Get Cities By Country Name](#get-cities-by-country-name)
    - [Get Countries And Dial Codes](#get-countries-and-dial-codes)
    - [Get Single Country's Dial Codes](#get-single-countrys-dial-codes)
    - [Get Countries And Positions (Longitude, Latitude)](#get-countries-and-positions-longitude-latitude)
    - [Get Single Country's Position](#get-single-countrys-position)
    - [Get All Countries Within Specific Longitude / Latitude Range](#get-all-countries-within-specific-longitude--latitude-range)
    - [Get All Countries With Flag Images](#get-all-countries-with-flag-images)
    - [Get Single Country With Flag Image](#get-single-country-with-flag-image)
    - [Get Countries With Unicode Flag](#get-countries-with-unicode-flag)
    - [Get Single Country With Unicode Flag](#get-single-country-with-unicode-flag)
    - [Get Countries With Capital](#get-countries-with-capital)
    - [Get Single Country With Capital](#get-single-country-with-capital)
    - [Get Countries and Currencies](#get-countries-and-currencies)
    - [Get Countries Information With Selectors](#get-countries-information-with-selectors)
  - [Population (Countries)](#population-countries)
    - [Get All Countries and Population Count From (1961) - (2018)](#get-all-countries-and-population-count-from-1961---2018)
    - [Get Single Country and Population Count From (1961) - (2018)](#get-single-country-and-population-count-from-1961---2018)
    - [Filter Countries Population Data](#filter-countries-population-data)
  - [Population (Cities)](#population-cities)
    - [Get All Cities and Population Count](#get-all-cities-and-population-count)
    - [Get Single City and Population Count](#get-single-city-and-population-count)
    - [Filter Cities Population Data](#filter-cities-population-data)

-------------------------

### Get All Countries and Cities

- Endpoint: `/api/v0.1/countries`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json
{
    "error": false,
    "msg": "countries and cities retrieved",
    "data": [
        {
            "country": "Afghanistan",
            "cities": [
                "Herat",
                "Kabul",
                "Kandahar",
                "Molah",
                "Rana",
                "Shar",
                "Sharif",
                "Wazir Akbar Khan"
            ]
        },
        {
            "country": "Albania",
            "cities": [
                "Elbasan",
                "Petran",
                "Pogradec",
                "Shkoder",
                "Tirana",
                "Ura Vajgurore"
            ]
        },
    ]
}
```

-------------------------

### Get Cities By Country Name

- Endpoint: `/api/v0.1/countries/cities`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
    "country": "Nigeria"
}
```

- RESPONSE:

```json
{
    "error": false,
    "msg": "cities in Nigeria retrieved",
    "data": [
        "Aba",
        "Abakaliki",
        "Abeokuta",
        "Abraka",
        "Abraka",
        "Abuja",
        "Ado-Ekiti",
        "Adodo",
        "Aganga",
        "Agege",
        "Agidingbi",
        "Ajegunle",
        "Ajuwon",
        "Akure",
        "Alimosho",
        "Anambra",
        "Apapa",
        "Ayobo",
        "Benin City",
        "Birnin Kebbi",
        "Bonny",
        "Burutu",
        "Bwari",
        "Calabar",
        "Chafe",
        "Damaturu",
        "Egbeda",
        "Ekpoma",
        "Enugu",
        "Forum",
        "Funtua",
        "Ibadan",
        "Ido",
        "Ifako",
        "Igando",
        "Igueben",
        "Ikeja",
        "Ikorodu",
        "Ikotun",
        "Ile-Ife",
        "Ilesa",
        "Ilorin",
        "Ipaja",
        "Iseri-Oke",
        "Isolo",
        "Jalingo",
        "Jos",
        "Kaduna",
        "Kano",
        "Kebbi",
        "Lagos",
        "Lekki",
        "Lokoja",
        "Magodo",
        "Makurdi",
        "Maryland",
        "Minna",
        "Mogho",
        "Mowe",
        "Mushin",
        "Nsukka",
        "Obafemi",
        "Obudu",
        "Odau",
        "Ojo",
        "Ojota",
        "Ondo",
        "Onigbongbo",
        "Orile Oshodi",
        "Oshodi",
        "Osogbo",
        "Ota",
        "Owerri",
        "Oworonsoki",
        "Port Harcourt",
        "Shomolu",
        "Suleja",
        "Suru-Lere",
        "Tara",
        "Ughelli",
        "Ungwan Madaki",
        "Uyo",
        "Warri",
        "Warri",
        "Yaba",
        "Yola",
        "Zaria"
    ]
}

```

-------------------------

### Get Countries And Dial Codes

- Endpoint: `/api/v0.1/countries/codes`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json
{
  "error": false,
  "msg": "countries and codes retrieved",
  "data": [
    {
      "name": "Afghanistan",
      "code": "AF",
      "dial_code": "+93"
    },
    {
      "name": "Albania",
      "code": "AL",
      "dial_code": "+355"
    },
    {
      "name": "Algeria",
      "code": "DZ",
      "dial_code": "+213"
    },
    {
      "name": "AmericanSamoa",
      "code": "AS",
      "dial_code": "+1 684"
    },
    {
      "name": "Andorra",
      "code": "AD",
      "dial_code": "+376"
    },
    {
      "name": "Angola",
      "code": "AO",
      "dial_code": "+244"
    },
    {
      "name": "Anguilla",
    ...

```

-------------------------

### Get Single Country's Dial Codes

- Endpoint: `/api/v0.1/countries/codes`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
  "country": "Nigeria"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "Nigeria dial code retrieved",
  "data": {
    "name": "Nigeria",
    "code": "NG",
    "dial_code": "+234"
  }
}

```

-------------------------

### Get Countries And Positions (Longitude, Latitude)

- Endpoint: `/api/v0.1/countries/positions`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json

{
  "error": false,
  "msg": "countries and positions retrieved",
  "data": [
    {
      "name": "Afghanistan",
      "long": 65,
      "lat": 33
    },
    {
      "name": "Albania",
      "long": 20,
      "lat": 41
    },
    {
      "name": "Algeria",
      "long": 3,
      "lat": 28
    },
    {
      "name": "AmericanSamoa",
      "long": -170,
      "lat": -14.3333
    },
    {
      "name": "Andorra",
      "long": 1.6,
      "lat": 42.5
    },

    ...

```

-------------------------

### Get Single Country's Position

- Endpoint: `/api/v0.1/countries/positions`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
    "country": "Nigeria"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "country position retrieved",
  "data": {
    "name": "Nigeria",
    "long": 8,
    "lat": 10
  }
}

```

-------------------------

### Get All Countries Within Specific Longitude / Latitude Range

- Endpoint: `/api/v0.1/countries/positions/range`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
 "type": "long",
 "min": 1,
 "max": 40
}
```

OR

```json
{
 "type": "lat",
 "min": 1,
 "max": 40
}
```

- RESPONSE:

```json
{
  "error": true,
  "msg": "countries between long of (1 and 40)",
  "data": [
    {
      "name": "Albania",
      "long": 20,
      "lat": 41
    },
    {
      "name": "Algeria",
      "long": 3,
      "lat": 28
    },
    {
      "name": "Andorra",
      "long": 1.6,
      "lat": 42.5
    },
    {
      "name": "Angola",
      "long": 18.5,
      "lat": -12.5
    },
    {
      "name": "Austria",
      "long": 13.3333,
      "lat": 47.3333
    },
    {
      "name": "Belarus",
      "long": 28,
      "lat": 53
    },
    {
      "name": "Belgium",
      "long": 4,
      "lat": 50.8333
    },
    ...

```

-------------------------

### Get All Countries With Flag Images

- Endpoint: `/api/v0.1/countries/flag/images`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json
{
  "error": false,
  "msg": "flags images retrieved",
  "data": [
    {
      "name": "Afghanistan",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Afghanistan.svg",
      "Iso2": "AF",
      "Iso3": "AFG"
    },
    {
      "name": "Albania",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/3/36/Flag_of_Albania.svg",
      "Iso2": "AL",
      "Iso3": "ALB"
    },
    {
      "name": "Algeria",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/7/77/Flag_of_Algeria.svg",
      "Iso2": "DZ",
      "Iso3": "DZA"
    },
    {
      "name": "Andorra",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/1/19/Flag_of_Andorra.svg",
      "Iso2": "AD",
      "Iso3": "AND"
    },
```

-------------------------

### Get Single Country With Flag Image

- Endpoint: `/api/v0.1/countries/flag/images`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
 "country": "nigeria"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "country and flag retrieved",
  "data": {
    "name": "Nigeria",
    "flag": "https://upload.wikimedia.org/wikipedia/commons/7/79/Flag_of_Nigeria.svg"
  }
}
```

-------------------------

### Get Countries With Unicode Flag

- Endpoint: `/api/v0.1/countries/flag/unicode`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json
{
  "error": false,
  "msg": "countries and unicode flags retrieved",
  "data": [
    {
      "name": "Bangladesh",
      "unicodeFlag": "🇧🇩"
    },
    {
      "name": "Belgium",
      "unicodeFlag": "🇧🇪"
    },
    {
      "name": "Burkina Faso",
      "unicodeFlag": "🇧🇫"
    },
    {
      "name": "Bulgaria",
      "unicodeFlag": "🇧🇬"
    },
    {
      "name": "Bosnia and Herzegovina",
      "unicodeFlag": "🇧🇦"
    },
    {
      "name": "Barbados",
      "unicodeFlag": "🇧🇧"
    },
  ]
}
```

-------------------------

### Get Single Country With Unicode Flag

- Endpoint: `/api/v0.1/countries/flag/unicode`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
 "country": "nigeria"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "countries and unicode flags retrieved",
  "data": {
    "name": "Nigeria",
    "unicodeFlag": "🇳🇬"
  }
}
```

-------------------------

### Get Countries With Capital

- Endpoint: `/api/v0.1/countries/capital`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json
{
  "error": false,
  "msg": "countries and capitals retrieved",
  "data": [
    {
      "name": "Bangladesh",
      "capital": "Dhaka"
    },
    {
      "name": "Belgium",
      "capital": "Brussels"
    },
    {
      "name": "Burkina Faso",
      "capital": "Ouagadougou"
    },
    {
      "name": "Bulgaria",
      "capital": "Sofia"
    },
    {
      "name": "Bosnia and Herzegovina",
      "capital": "Sarajevo"
    },
    {
      "name": "Barbados",
      "capital": "Bridgetown"
    },
    {
      "name": "Wallis and Futuna",
      "capital": "Mata Utu"
    },
    ...
```

-------------------------

### Get Single Country With Capital

- Endpoint: `/api/v0.1/countries/capital`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
 "country": "nigeria"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "countries and capitals retrieved",
  "data": {
    "name": "Nigeria",
    "capital": "Abuja"
  }
}
```

-------------------------

### Get Countries and Currencies

- Endpoint: `/api/v0.1/countries/currency`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json
{
  "error": false,
  "msg": "countries and currencies retrieved",
  "data": [
    {
      "name": "Bangladesh",
      "currency": "BDT"
    },
    {
      "name": "Belgium",
      "currency": "EUR"
    },
    {
      "name": "Burkina Faso",
      "currency": "XOF"
    },
    {
      "name": "Bulgaria",
      "currency": "BGN"
    },
    ...

```

-------------------------

### Get Countries Information With Selectors

- Endpoint: `/api/v0.1/countries/info?returns=unicodeFlag,currency,flag`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- QUERY: the returns parameter must be a comma-separated list of data attributes. e.g unicodeFlag,currency,flag. unicodeFlag fetches unicode flag, currency fetches currency, flag fetches link to svg image of flag.
- RESPONSE:

```json
{
  "error": false,
  "msg": "countries details: 'unicodeFlag,currency,flag' have been retrieved",
  "data": [
    {
      "name": "Bangladesh",
      "currency": "BDT",
      "unicodeFlag": "🇧🇩",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Flag_of_Bangladesh.svg"
    },
    {
      "name": "Belgium",
      "currency": "EUR",
      "unicodeFlag": "🇧🇪",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg"
    },
    {
      "name": "Burkina Faso",
      "currency": "XOF",
      "unicodeFlag": "🇧🇫",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/3/31/Flag_of_Burkina_Faso.svg"
    },
    {
      "name": "Bulgaria",
      "currency": "BGN",
      "unicodeFlag": "🇧🇬",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Bulgaria.svg"
    },
    ...
```

-------------------------

## Population (Countries)

> Data related to country and population

### Get All Countries and Population Count From (1961) - (2018)

- Endpoint: `/api/v0.1/countries/population`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json
{
    "error": false,
    "msg": "all countries and population 1961 - 2018",
    "data": [
        {
            "country": "Arab World",
            "code": "ARB",
            "populationCounts": [
                {
                    "year": 1961,
                    "value": 94724510
                },
                {
                    "year": 1984,
                    "value": 186035305
                },
                {
                    "year": 1985,
                    "value": 191650331
                },
                {
                    "year": 1986,
                    "value": 197338142
                },

                {
                    "year": 2004,
                    "value": 307862843
                },
                {
                    "year": 2005,
                    "value": 314965793
                },
                {
                    "year": 2006,
                    "value": 322452754
                },
                {
                    "year": 2007,
                    "value": 330290716
                },
                {
                    "year": 2008,
                    "value": 338395961
                },
                {
                    "year": 2009,
                    "value": 346629220
                },
                {
                    "year": 2010,
                    "value": 354890042
                },
                {
                    "year": 2011,
                    "value": 363158703
                },
                {
                    "year": 2012,
                    "value": 371443547
                },
                {
                    "year": 2013,
                    "value": 379705719
                },
                {
                    "year": 2014,
                    "value": 387907748
                },
                {
                    "year": 2015,
                    "value": 396028278
                },
                {
                    "year": 2016,
                    "value": 404024433
                },
                {
                    "year": 2017,
                    "value": 411898965
                },
                {
                    "year": 2018,
                    "value": 419790588
                }
            ]
        },
        {
            "country": "Caribbean small states",
            "code": "CSS",
            "populationCounts": [
                {
                    "year": 1961,
                    "value": 4274060
                },
                {
                    "year": 1962,
                    "value": 4353628
                },
                {
                    "year": 1963,
                    "value": 4432217
                },
                {
                    "year": 1964,
                    "value": 4508198
                },
                {
                    "year": 1965,
                    "value": 4580374
                },
                {
                    "year": 1966,
                    "value": 4648367
                },
                {
                    "year": 1967,
                    "value": 4712526
                },
                {
                    "year": 1968,
                    "value": 4773902
                },
                {
                    "year": 1969,
                    "value": 4833842
                },
                {
                    "year": 1970,
                    "value": 4893454
                },
                {
                    "year": 1971,
                    "value": 4953087
                },
                {
                    "year": 1972,
                    "value": 5012612
                },
                {
                    "year": 1973,
                    "value": 5071954
                },
                {
                    "year": 1974,
                    "value": 5130833
                },
                {
                    "year": 1975,
                    "value": 5189153
                },
                {
                    "year": 1976,
                    "value": 5246563
                },
                {
                    "year": 1977,
                    "value": 5303307
                },
                {
                    "year": 1978,
                    "value": 5360561
                },
                {
                    "year": 1979,
                    "value": 5419884
                },
                {
                    "year": 1980,
                    "value": 5482206
                },
                {
                    "year": 1981,
                    "value": 5548512
                },
                {
                    "year": 2009,
                    "value": 6925452
                },
                {
                    "year": 2010,
                    "value": 6973206
                },
                {
                    "year": 2011,
                    "value": 7022387
                },
                {
                    "year": 2012,
                    "value": 7072665
                },
                {
                    "year": 2013,
                    "value": 7123332
                },
                {
                    "year": 2014,
                    "value": 7173435
                },
                {
                    "year": 2015,
                    "value": 7222212
                },
                {
                    "year": 2016,
                    "value": 7269386
                },
                {
                    "year": 2017,
                    "value": 7314990
                },
                {
                    "year": 2018,
                    "value": 7358965
                }
            ]
        },
        {
            "country": "Central Europe and the Baltics",
            "code": "CEB",
            "populationCounts": [
                {
                    "year": 1961,
                    "value": 92232738
                },
                {
                    "year": 1962,
                    "value": 93009498
                },
                {
                    "year": 1963,
                    "value": 93840016
                },
                {
                    "year": 1964,
                    "value": 94715795
                },
                {
                    "year": 1965,
                    "value": 95440988
                },
                {
                    "year": 1966,
                    "value": 96146336
                },
                {
                    "year": 1967,
                    "value": 97043270
                },
                {
                    "year": 1968,
                    "value": 97884022
                },
                {
                    "year": 1969,
                    "value": 98606630
                },
                {
                    "year": 1970,
                    "value": 99134548
                },
                {
                    "year": 1971,
                    "value": 99635258
                },
                {
                    "year": 1972,
                    "value": 100357161
                },
                {
                    "year": 1973,
                    "value": 101112680
                },
                {
                    "year": 1974,
                    "value": 101939916
                },
                {
                    "year": 1975,
                    "value": 102860571
                },
                {
                    "year": 1976,
                    "value": 103776068
                },
                {
                    "year": 1977,
                    "value": 104616884
                },
                {
                    "year": 1978,
                    "value": 105329397
                },
                {
                    "year": 1979,
                    "value": 105948616
                },
                {
                    "year": 1980,
                    "value": 106576687
                },
                {
                    "year": 1981,
                    "value": 107191491
                },
                {
                    "year": 1982,
                    "value": 107770028
                },
                {
                    "year": 1983,
                    "value": 108326149
                },
                {
                    "year": 1984,
                    "value": 108853466
                },
                {
                    "year": 1985,
                    "value": 109360713
                },
                {
                    "year": 1993,
                    "value": 110041924
                },
                {
                    "year": 1994,
                    "value": 110021594
                },
            ]
        },
```

-------------------------

### Get Single Country and Population Count From (1961) - (2018)

- Endpoint: `/api/v0.1/countries/population`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
  "country": "Nigeria"
}
```

- RESPONSE:

```json

{
    "error": false,
    "msg": "Nigeria with population",
    "data": {
        "country": "Nigeria",
        "code": "NGA",
        "populationCounts": [
            {
                "year": 1961,
                "value": 46063563
            },
            {
                "year": 1962,
                "value": 47029822
            },
            {
                "year": 1963,
                "value": 48032934
            },
            {
                "year": 1964,
                "value": 49066760
            },
            {
                "year": 1965,
                "value": 50127921
            },
            {
                "year": 1966,
                "value": 51217973
            },
            {
                "year": 1967,
                "value": 52342233
            },
            {
                "year": 1968,
                "value": 53506196
            },
            {
                "year": 1969,
                "value": 54717039
            },
            {
                "year": 1970,
                "value": 55982144
            },
            {
                "year": 1971,
                "value": 57296983
            },
            {
                "year": 1972,
                "value": 58665808
            },
            {
                "year": 1973,
                "value": 60114625
            },
            {
                "year": 1974,
                "value": 61677177
            },
            {
                "year": 1975,
                "value": 63374298
            },
            {
                "year": 1976,
                "value": 65221378
            },
            {
                "year": 1977,
                "value": 67203128
            },
            {
                "year": 1978,
                "value": 69271917
            },
            {
                "year": 1979,
                "value": 71361131
            },
            {
                "year": 1980,
                "value": 73423633
            },
            {
                "year": 1981,
                "value": 75440502
            },
            {
                "year": 1982,
                "value": 77427546
            },
            {
                "year": 1983,
                "value": 79414840
            },
            {
                "year": 1984,
                "value": 81448755
            },
            {
                "year": 1985,
                "value": 83562785
            },
            {
                "year": 1986,
                "value": 85766399
            },
            {
                "year": 1987,
                "value": 88048032
            },
            {
                "year": 1988,
                "value": 90395271
            },
            {
                "year": 1989,
                "value": 92788027
            },
            {
                "year": 1990,
                "value": 95212450
            },
            {
                "year": 1991,
                "value": 97667632
            },
            {
                "year": 1992,
                "value": 100161710
            },
            {
                "year": 1993,
                "value": 102700753
            },
            {
                "year": 1994,
                "value": 105293700
            },
            {
                "year": 1995,
                "value": 107948335
            },
            {
                "year": 1996,
                "value": 110668794
            },
            {
                "year": 1997,
                "value": 113457663
            },
            {
                "year": 1998,
                "value": 116319759
            },
            {
                "year": 1999,
                "value": 119260063
            },
            {
                "year": 2000,
                "value": 122283850
            },
            {
                "year": 2001,
                "value": 125394046
            },
            {
                "year": 2002,
                "value": 128596076
            },
            {
                "year": 2003,
                "value": 131900631
            },
            {
                "year": 2004,
                "value": 135320422
            },
            {
                "year": 2005,
                "value": 138865016
            },
            {
                "year": 2006,
                "value": 142538308
            },
            {
                "year": 2007,
                "value": 146339977
            },
            {
                "year": 2008,
                "value": 150269623
            },
            {
                "year": 2009,
                "value": 154324933
            },
            {
                "year": 2010,
                "value": 158503197
            },
            {
                "year": 2011,
                "value": 162805071
            },
            {
                "year": 2012,
                "value": 167228767
            },
            {
                "year": 2013,
                "value": 171765769
            },
            {
                "year": 2014,
                "value": 176404902
            },
            {
                "year": 2015,
                "value": 181137448
            },
            {
                "year": 2016,
                "value": 185960289
            },
            {
                "year": 2017,
                "value": 190873311
            },
            {
                "year": 2018,
                "value": 195874740
            }
        ]
    }
}
```

-------------------------

### Filter Countries Population Data

> This endpoint allows you filter what you want from the long response of population data.
> Parameters:
>
> - year (Number): You can get the population for a particular year
> - limit (Number): Don't want all of the countries? You can limit the response to the first 2, 3, 10, 20 etc.
> - lt (Number): this field represents "less than", you can get only countries with a population less than the "lt" value
> - gt (Number): this field represents "greater than", you can get only countries with a population greater than the "lt" value
> - lt, gt (Number): When both fields are provided, the endpoint returns a range between (lt, gt): with the formular gt < population < lt
> - orderBy (String): You can order the response by country name or population value by providing "name" or "population"
>   - allowed: ['name', 'population']
>   - default: 'population'
> - order (String): specify the order you'd like the response in by providing "asc" or "dsc" (ascending and descending respectively)
>

- Endpoint: `/api/v0.1/countries/population/filter`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
 "year": 2000,
 "limit": 40,
 "lt": 651348588,
 "gt": 6513485,
 "orderBy": "name",
 "order": "dsc"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "filtered result",
  "data": [
    {
      "country": "Zimbabwe",
      "code": "ZWE",
      "populationCounts": {
        "year": 2000,
        "value": 11881477
      }
    },
    {
      "country": "Zambia",
      "code": "ZMB",
      "populationCounts": {
        "year": 2000,
        "value": 10415944
      }
    },
    {
      "country": "Yemen, Rep.",
      "code": "YEM",
      "populationCounts": {
        "year": 2000,
        "value": 17409072
      }
    },
    {
      "country": "Vietnam",
      "code": "VNM",
      "populationCounts": {
        "year": 2000,
        "value": 79910412
      }
    },
    {
      "country": "Venezuela, RB",
      "code": "VEN",
      "populationCounts": {
        "year": 2000,
        "value": 24192446
      }
    },
    {
      "country": "Uzbekistan",
      "code": "UZB",
      "populationCounts": {
        "year": 2000,
        "value": 24650400
      }
    },
    {
      "country": "United States",
      "code": "USA",
      "populationCounts": {
        "year": 2000,
        "value": 282162411
      }
    },
    {
      "country": "United Kingdom",
      "code": "GBR",
      "populationCounts": {
        "year": 2000,
        "value": 58892514
      }
    },
    {
      "country": "Ukraine",
      "code": "UKR",
      "populationCounts": {
        "year": 2000,
        "value": 49175848
      }
    },
    {
      "country": "Uganda",
      "code": "UGA",
      "populationCounts": {
        "year": 2000,
        "value": 23650172
      }
    }
  ]
}
```

-------------------------

## Population (Cities)

> Date related to Cities and Population

### Get All Cities and Population Count

- Endpoint: `/api/v0.1/countries/population/cities`
- Action: `GET`
- HEADERS: `{'Content-Type': 'application/json'}`
- RESPONSE:

```json

{
  "error": false,
  "msg": "all cities with population",
  "data": [
    {
      "city": "MARIEHAMN",
      "country": "Åland Islands",
      "populationCounts": [
        {
          "year": "2013",
          "value": "11370",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        },
        {
          "year": "2000",
          "value": "10488",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Durrës",
      "country": "Albania",
      "populationCounts": [
        {
          "year": "2011",
          "value": "113249",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "TIRANA",
      "country": "Albania",
      "populationCounts": [
        {
          "year": "2011",
          "value": "418495",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        },
        {
          "year": "2003",
          "value": "392863",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Annaba",
      "country": "Algeria",
      "populationCounts": [
        {
          "year": "1998",
          "value": "352523",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
```

-------------------------

### Get Single City and Population Count

- Endpoint: `/api/v0.1/countries/population/cities`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
    "city": "Enugu"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "Enugu with population",
  "data": {
    "city": "Enugu",
    "country": "Nigeria",
    "populationCounts": [
      {
        "year": "1991",
        "value": "407756",
        "sex": "Both Sexes",
        "reliabilty": "Final figure, complete"
      }
    ]
  }
}
```

-------------------------

### Filter Cities Population Data

> This endpoint allows you filter what you want from the long response of population data.
> Parameters:
>
> - limit (Number): Don't want all of the countries? You can limit the response to the first 2, 3, 10, 20 etc.
> - orderBy (String): You can order the response by country name or population value by providing "name" or "population"
>   - allowed: ['name', 'population']
>   - default: 'population'
> - order (String): specify the order you'd like the response in by providing "asc" or "dsc" (ascending and descending respectively)
> - country (String): show only cities that belong to a country

- Endpoint: `/api/v0.1/countries/population/cities/filter`
- Action: `POST`
- HEADERS: `{'Content-Type': 'application/json'}`
- PARAMS:

```json
{
 "limit": 10,
 "orderBy": "population",
 "order": "dsc",
 "country": "nigeria"
}
```

- RESPONSE:

```json
{
  "error": false,
  "msg": "filtered result",
  "data": [
    {
      "city": "Damaturu",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "141897",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Effon-Alaiye",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "158977",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Enugu",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "407756",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Gboko",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "101281",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Gombe",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "163604",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Gusau",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "132393",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Ibadan",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "1835300",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Ife",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "186856",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Ijebu-Ode",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "124313",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Ikare",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "103843",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    },
    {
      "city": "Ikire",
      "country": "Nigeria",
      "populationCounts": [
        {
          "year": "1991",
          "value": "111435",
          "sex": "Both Sexes",
          "reliabilty": "Final figure, complete"
        }
      ]
    }

```

# Countries Data API

>A curation of Countries data including (dial codes, states, cities, currencies, capitals etc) served over a REST API so you don't have to have them locally in your applications.
>This means lighter application sizes.

## USAGE
The API does not require any form of Authentication or token.


------------------------- 


## Table of Endpoints
- [Countries Data API](#countries-data-api)
  - [USAGE](#usage)
  - [Table of Endpoints](#table-of-endpoints)
    - [Get All Countries and Cities](#get-all-countries-and-cities)
    - [Get Cities By Country Name](#get-cities-by-country-name)
    - [Get Countries And Dial Codes](#get-countries-and-dial-codes)
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



---------------------

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
-----------------------------------

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


-----------------------------------

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

--------------------------------------------------------


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


--------------------------------------------------------


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

--------------------------------------------------------


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

OR

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


--------------------------------------------------------


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

--------------------------------------------------------


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

--------------------------------------------------------


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

--------------------------------------------------------


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


--------------------------------------------------------


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


--------------------------------------------------------


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



--------------------------------------------------------


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


--------------------------------------------------------


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

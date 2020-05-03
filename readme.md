# COUNTRIES AND CITIES API

A curation of Countries data including (dial codes, states, cities, currencies, capitals etc) served over a REST API so you don't have to have them locally in your applications.
This means lighter application sizes.
## SETUP LOCALLY
```sh
$ git clone https://github.com/MartinsOnuoha/countriesAndCitiesAPI countries

$ cd countries

$ npm i

$ npm start
```
now visit the site on port 3000 (default) or whatever port was set as the `PORT` environment variable

## USAGE
The API does not require any form of Authentication or token.

---------------------
### GET ALL COUNTRIES AND CITIES

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

### GET CITIES BY COUNTRY

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

### GET COUNTRIES AND DIAL CODES

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


### GET COUNTRIES AND POSITIONS (Longitude, Latitude)

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


### GET SINGLE COUNTRY'S POSITION

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


### GET ALL COUNTRIES WITHIN SPECIFIC LONGITUDE / LATITUDE RANGE

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


### GET ALL COUNTRIES WITH FLAG IMAGES

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
      "flag": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Afghanistan.svg"
    },
    {
      "name": "Albania",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/3/36/Flag_of_Albania.svg"
    },
    {
      "name": "Algeria",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/7/77/Flag_of_Algeria.svg"
    },
    {
      "name": "Andorra",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/1/19/Flag_of_Andorra.svg"
    },
    {
      "name": "Angola",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/9/9d/Flag_of_Angola.svg"
    },
    {
      "name": "Anguilla",
      "flag": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Flag_of_Anguilla.svg"
    },
    ...
```

--------------------------------------------------------


### GET SINGLE COUNTRY WITH FLAG IMAGE

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


### GET COUNTRIES WITH UNICODE FLAG

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


### GET SINGLE COUNTRY WITH UNICODE FLAG

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


### GET COUNTRIES WITH CAPITAL

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


### GET SINGLE COUNTRY WITH CAPITAL

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

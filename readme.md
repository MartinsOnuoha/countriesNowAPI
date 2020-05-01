# COUNTRIES AND CITIES API

## SETUP LOCALLY
```sh
git clone https://github.com/MartinsOnuoha/countriesAndCitiesAPI countries
cd countries
npm i
npm start
```
now visit the site on port 3000 (default) or whatever port was set as the `PORT` environment variable

## USAGE
The API does not require any form of Authentication or token.

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

### GET COUNTRIES AND CODES

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

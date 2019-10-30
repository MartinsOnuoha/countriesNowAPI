# COUNTRIES AND CITIES API

### SETUP LOCALLY
```sh
git clone https://github.com/MartinsOnuoha/countriesAndCitiesAPI countries
cd countries
npm i
npm start
```
now visit the site on port 3000 (default) or whatever port was set as the `PORT` environment variable

### HOW TO USE
Make a `GET` request to `/api/v0.1/countries` to get the full list of country information
To get subsequent pages, add a query parameter `page` with the page number as its value e.g `/api/v0.1/countries?page=4`

To get details about a specific country in the list:
```
GET /api/v0.1/countries/cities-by-country

# body of request
{
    "country": "<country name>"
}
```
# Contribution Guideline

> Here's an easy enough guide to making contributions to the project

## Setup Locally

First create a fork of the project from the original `https://github.com/MartinsOnuoha/countriesNowAPI.git`

### Clone the fork

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

now visit the site on port 3000 (default) or whatever port was set as the `PORT` environment variable

## Making Changes

> - Create a new branch for each change prefixing branch name with the type of change
> - e.g feat/get-houses, chore/update-readme

## Adding New Endpoints

> - Add new endpoints in the `./routes/countries.js` file
> - The `./controllers` folder holds the `countryController.js` file where each endpoint method lives
> - Create a method for every new endpoint within this file
> - Add a test suite for each endpoint within the `./test/`
> - Update the openApi Documentation in `./swagger` to reflect the new endpoints

## Commit Messages

> - Currently the project uses [commitizen](https://github.com/commitizen/cz-cli) style for making Commits.
> - Since you already ran the `npm i` command, you should have everything setup to use commitizen.
> - Once you're ready to make that awesome change, do:
>
> ```sh
> git add .
> ```
>
> Then run the commitizen npm script with:
>
> ```sh
> npm run make:commit
> ```
>
> - You can now make a push to your branch

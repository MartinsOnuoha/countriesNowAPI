# Migrating from v0.1 to v2

## You do not have to

Every V1 route still answers, at `/v0.1`, with the same response shape. If your client
works today it will keep working. Compatibility is proven by replaying responses captured
from the live V1 service against the new engine, so the shim reproduces V1's
inconsistencies deliberately — `populationCounts` is an array on one endpoint and a bare
object on another because that is what V1 returned.

The only base-URL change is the path prefix:

```diff
- https://countriesnow.space/api/v0.1/countries
+ https://countriesnow.space/v0.1/countries
```

Both `GET` and `POST` still work on the `/q` lookups.

Read on if you want the newer surface, or if you are relying on behaviour listed under
"deliberate deviations" below.

## What v2 gives you

**Sparse fieldsets.** V1's `/population/cities` returns 1.86 MB. Ask for what you need:

```bash
curl "https://countriesnow.space/v2/countries?fields=iso2,name,capital&limit=250"
```

**Real pagination.** Keyset cursors, and no endpoint returns an unbounded collection.

```bash
curl "https://countriesnow.space/v2/countries/IN/cities?limit=100"
# -> { "data": [ ...100 cities... ], "meta": { "total": 3717, "nextCursor": "Y24xOjEy..." } }
```

**Localization** (#215), for 21 locales:

```bash
curl "https://countriesnow.space/v2/countries/DE?locale=de"   # "Deutschland"
```

**Provenance.** Where every value came from, at which source version, retrieved when:

```bash
curl "https://countriesnow.space/v2/countries/BG?include=provenance"
```

**Stable identifiers.** ISO 3166-2 codes on subdivisions and GeoNames ids on places,
which V1 had for neither. You can now join our data with anyone else's.

**Caching that works.** A strong `ETag` equal to the dataset version, identical across
replicas, with `Cache-Control: public, max-age=86400`.

## Endpoint mapping

| v0.1 | v2 |
| --- | --- |
| `GET /countries` (every country with its cities, 1.9 MB) | `GET /v2/countries`, then `/v2/countries/{ref}/cities` per country |
| `GET /countries/q?country=X` | `GET /v2/countries/{ref}` |
| `GET /countries/capital/q?country=X` | `GET /v2/countries/{ref}?fields=capital` |
| `GET /countries/currency/q?country=X` | `GET /v2/countries/{ref}?fields=currency,currencies` |
| `GET /countries/iso/q?country=X` | `GET /v2/countries/{ref}?fields=iso2,iso3` |
| `GET /countries/flag/images/q?country=X` | `GET /v2/countries/{ref}?fields=flag` |
| `GET /countries/flag/unicode/q?country=X` | `GET /v2/countries/{ref}?fields=flag` |
| `GET /countries/positions/q?country=X` | `GET /v2/countries/{ref}?fields=latitude,longitude` |
| `GET /countries/population/q?country=X` | `GET /v2/countries/{ref}?fields=population` |
| `GET /countries/states/q?country=X` | `GET /v2/countries/{ref}/subdivisions` |
| `GET /countries/state/cities/q?country=X&state=Y` | `GET /v2/subdivisions/{ref}/cities` |
| `GET /countries/cities/q?country=X` | `GET /v2/countries/{ref}/cities` |
| `GET /countries/population/cities/q?city=X` | `GET /v2/cities/{ref}?fields=population` |
| `GET /countries/codes` | `GET /v2/countries?fields=iso2,iso3,dialCode` |
| `GET /countries/info?returns=X` | `GET /v2/countries?fields=X` |
| `GET /countries/random` | no equivalent; pick client-side |
| `GET /countries/population/filter/q` | no equivalent yet; filter client-side |

`{ref}` is an ISO alpha-2, alpha-3, name, alias or GeoNames id. All of them work
everywhere, which is the main ergonomic difference: V1 required a different identifier
per endpoint, and the population endpoint famously required `Korea, Rep.`.

## Response shape

v0.1:

```json
{ "error": false, "msg": "country and capitals retrieved", "data": { ... } }
```

v2:

```json
{ "data": { ... }, "meta": { "datasetVersion": "2026.08.0" } }
```

Collections add `meta.total` and `meta.nextCursor`. Errors drop the envelope entirely and
use the status code plus a typed body:

```json
{ "error": "not_found", "message": "No country matches \"Wakanda\"." }
```

V1 returned HTTP 404 with `error: true` in a 200-shaped body for some routes and a real
404 for others. v2 is consistent: the status code is the error.

Status codes you may not have seen from V1:

- **409** — the reference matches several entities. The body lists every candidate with a
  directly fetchable key. V1 silently returned the first match.
- **400** — invalid cursor or out-of-range limit. V1 silently truncated.
- **503** — the replica has no artifact loaded. Retry; another replica has one.

## Deliberate deviations in the shim

Three V1 behaviours are **not** reproduced, because they are defects rather than
contracts. If your client depends on any of these, it depends on a bug.

**1. `/cities/q` no longer returns HTTP 500 for 23 countries.**

V1's guard was `if (!DB1 && !DB2)` and the next line destructured `DB1`, so any country
present in `countriesAndStates.js` but absent from `countriesAndCities.js` crashed the
handler. Tuvalu, South Sudan, Holy See, Sint Maarten, Curaçao, Antarctica, Bouvet Island
and sixteen others. All return 200 with a city array now.

**2. Unaccented spellings resolve.**

`?country=Reunion` returned 404 in V1 while `?country=Réunion` worked. Both work now, as
do `Cote dIvoire`, `Curacao` and `Aland Islands`. This can only add results, never change
one.

**3. City lists are deduplicated and exclude neighbourhoods.**

Marseille appeared seventeen times in V1's French city list — once as the city and
sixteen times as its arrondissements. It appears once now. Issue #242. Neighbourhoods are
still reachable at `GET /v2/cities/{ref}/neighbourhoods`.

If you were counting the length of a city array as a proxy for anything, the number has
changed. It was wrong before.

Beyond those three, values change when upstream changes — Bulgaria reports `EUR` rather
than `BGN` (#236), French regions are the post-2016 thirteen rather than the pre-2016
twenty-two (#227), and Palestine and Sint Maarten now exist (#224, #226).

## A worked example

```js
// v0.1
const res = await fetch('https://countriesnow.space/v0.1/countries/state/cities/q', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ country: 'Nigeria', state: 'Lagos' })
});
const { data } = await res.json();  // string[]

// v2
const res = await fetch('https://countriesnow.space/v2/subdivisions/NG-LA/cities?limit=100');
const { data, meta } = await res.json();
// data: [{ geonamesId, name, population, latitude, longitude, ... }]
// meta: { total, nextCursor, datasetVersion }
```

`NG-LA` is the ISO 3166-2 code. `/v2/subdivisions/Lagos/cities` also works, and so does
`Lagos State`.

## Timeline

`/v0.1` has no removal date. It is a thin layer over the same engine, it is covered by
the golden regression suite on every build, and it costs almost nothing to keep. It will
not be removed without a long, loud deprecation period.

New endpoints will only be added to `/v2`.

## If something is different

Open an issue with the request and both responses. If the shim diverges from V1 in a way
not listed above, that is a bug in the shim and it will be fixed — the golden suite exists
precisely so that divergence is detectable rather than reported by users.

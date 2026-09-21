# CountriesNow

Countries, subdivisions and cities over a free REST API. No key, no auth, no rate limit.

V2 is a rebuild. The data is compiled from pinned upstream snapshots into an immutable
SQLite artifact that ships inside the container image, so a replica has no database to
connect to and nothing to be down to. A curation harness watches the upstreams, and an
agent proposes fixes that must survive a refutation pass and a suite of deterministic
invariants before a human ever sees them.

```bash
curl https://countriesnow.space/v2/countries/NG
curl "https://countriesnow.space/v2/countries/NG/cities?limit=20"
curl "https://countriesnow.space/v2/countries/DE?locale=de"
```

Existing clients need no changes: every V1 route still answers at `/v0.1`, byte-compatible,
proven against responses captured from the live V1 service.

## What changed, and why you might care

| | V1 | V2 |
| --- | --- | --- |
| Storage | six JS files, 33.7 MB, no shared key | one keyed dataset, per-field provenance |
| Lookup | linear `.find()` with `.toLowerCase()` | indexed, NFKD-folded, alias-aware |
| `?country=Reunion` | 404 | resolves |
| `Congo` | two identical rows, DR Congo unreachable by name | ISO's `Congo` is CG; DR Congo answers to 5 aliases |
| Marseille | appears 17 times, once plus 16 arrondissements | once, arrondissements are a child resource |
| Runtime deps | database on the request path | none |
| Docs | 33 hand-written files, drifted since 2022 | generated from the route schemas |
| Where a value came from | unrecorded | `?include=provenance` |

Median query time is 11–13 µs for a resolve and 313 µs to list every country, measured
in-process against the artifact. `bun run harness:bench` reproduces it.

## The API

Full reference at [`/openapi`](https://countriesnow.space/openapi). The shape:

```
GET /v2/countries                       ?limit= &cursor= &fields= &locale=
GET /v2/countries/{ref}                 ref = iso2 | iso3 | name | geonameid
GET /v2/countries/{ref}/subdivisions
GET /v2/countries/{ref}/cities
GET /v2/subdivisions/{ref}              ref = ISO 3166-2 code or name
GET /v2/subdivisions/{ref}/cities
GET /v2/cities/{ref}
GET /v2/cities/{ref}/neighbourhoods
GET /v2/search/cities                   ?q=
GET /v2/currencies
GET /v2/dataset                         which version you are reading
```

Three query parameters work everywhere. `?fields=` trims the response to the keys you
name, `?locale=` returns names in one of 21 languages, and `?limit=`/`?cursor=` page
through collections by keyset — no endpoint returns an unbounded list.

`ref` is resolved through a single normalization layer: Unicode-folded, accent-stripped,
case-folded, then matched against a table of official names, aliases and localizations.
`Reunion`, `Réunion`, `RE`, `REU` and `La Réunion` all reach the same row. When a name
genuinely matches several entities you get a 409 naming them rather than a quiet guess,
and every candidate key is directly fetchable:

```json
{
  "error": "ambiguous_reference",
  "message": "\"Springfield\" matches 9 cities. Use a code or an exact name.",
  "candidates": [
    { "key": "4409896", "label": "Springfield", "hint": "US · PPLA2 · pop 170,188" },
    { "key": "4951788", "label": "Springfield", "hint": "US · PPL · pop 154,341" }
  ]
}
```

Responses carry a strong `ETag` equal to the dataset version, identical across every
replica, so a conditional request costs a 304.

## Using the data without the API

Every release attaches the SQLite file it serves. It is a normal read-only database:

```bash
gh release download dataset-2026.08.0 --pattern '*.sqlite'
sqlite3 countriesnow.sqlite "SELECT iso2, display_name, primary_currency FROM countries LIMIT 5"
```

Data is CC BY 4.0. Attribution requirements per upstream are in
[docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

## Running it locally

Needs [Bun](https://bun.sh) 1.2 or newer. Building the dataset the first time downloads
roughly 100 MB of upstream sources.

```bash
bun install
bun run harness:pull       # fetch upstreams into a content-addressed snapshot store
bun run harness:resolve    # merge them under the precedence policy
bun run harness:publish    # compile the serving artifact
bun run dev
```

Then `http://localhost:3000/openapi`.

`GEONAMES_TIER` controls how many places are ingested. It defaults to `cities15000`
(34k places, ~36 MB, a few seconds to build); releases use `allCountries`. Everything
else works identically at either tier.

```bash
bun test                   # 126 tests, including the v0.1 golden replays
bun run harness:gate       # the invariant suite
bun run harness:bench      # latency budgets
bun run harness:detect     # what disagrees between sources right now
```

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — the two planes, the data model, why the
  database is not on the request path
- [HARNESS.md](docs/HARNESS.md) — the curation pipeline and the agent stages
- [DATA_POLICY.md](docs/DATA_POLICY.md) — membership, disputed territories, naming
- [ATTRIBUTION.md](docs/ATTRIBUTION.md) — per-source licences and credit
- [MIGRATION.md](docs/MIGRATION.md) — moving from v0.1 to v2
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — running it yourself

## Contributing

Data corrections are the most useful contribution, and the fastest route is an issue
naming the field and a primary source. The harness will usually pick it up on the next
run and open a pull request with the evidence attached.

Code changes need `bun run lint`, `bun run typecheck` and `bun test` to pass. If you are
fixing a data bug, add the invariant that would have caught it to
`harness/src/gates/invariants.ts` — that file is the project's bug history made
executable, and it is the reason old bugs stay fixed.

## Licence

Code is MIT. Data is CC BY 4.0. See [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

Built on the original [CountriesNow API](https://github.com/MartinsOnuoha/countriesNowAPI)
by [Martins Onuoha](https://github.com/MartinsOnuoha).

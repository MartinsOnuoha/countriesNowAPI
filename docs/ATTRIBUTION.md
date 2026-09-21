# Attribution

## Licence

**Code** in this repository is MIT.

**Data** published by this API — every response, and the SQLite artifact attached to each
release — is licensed **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.

You may use it commercially, redistribute it, and build on it. You must give credit. The
short form:

> Data from [CountriesNow](https://countriesnow.space), CC BY 4.0, compiled from
> GeoNames, Unicode CLDR, the Debian iso-codes project, SIX Group, libphonenumber and
> the World Bank.

The long form is the table below, reproducible at any time with `bun run harness sources`.

## Sources

Every source that supplies a published value, with the licence it is used under.

### GeoNames — CC BY 4.0

Places, coordinates, hierarchy, country-level fallbacks and alternate names.

> Place data from [GeoNames](https://www.geonames.org/), CC BY 4.0.

CC BY 4.0 is the reason this project's output is also CC BY 4.0 — attribution propagates
downstream, so a permissive-but-attributed licence is the strictest term in the chain.

### Unicode CLDR — Unicode-3.0

Localized territory names, and the display names returned by default.

> Localized names from the [Unicode CLDR](https://cldr.unicode.org/), Unicode-3.0 licence.

### Debian `iso-codes` — LGPL-2.1-or-later

ISO 3166-1, ISO 3166-2, ISO 3166-3 and ISO 4217 code lists, plus translations.

> ISO code lists from the [Debian iso-codes project](https://salsa.debian.org/iso-codes-team/iso-codes),
> LGPL-2.1-or-later.

LGPL is a library licence and applies awkwardly to data. We treat the code lists as
factual content — ISO code assignments are facts, not creative expression — and credit
the project regardless. The `iso-codes` maintainers do the work of tracking ISO
newsletters, which is the part that has value.

### SIX Group — ISO 4217 Maintenance Agency

The official currency register, `list-one.xml`.

> Currency data from the ISO 4217 Maintenance Agency
> ([SIX Group](https://www.six-group.com/en/products-services/financial-information/data-standards.html)).

SIX publishes the register free and without a key. The content is factual — currency code
assignments and their effective dates — and is used as such.

### `google/libphonenumber` — Apache-2.0

International calling codes, including correct handling of shared codes like the +1 NANP.

> Calling-code metadata from [google/libphonenumber](https://github.com/google/libphonenumber),
> Apache-2.0.

### `datasets/country-codes` — ODC-PDDL-1.0

The identifier crosswalk: alpha-2, alpha-3, numeric, M49, GeoNames id and Wikidata QID.

> Country code crosswalk from [datasets/country-codes](https://github.com/datasets/country-codes),
> ODC-PDDL-1.0 (public domain).

PDDL is a public-domain dedication and imposes no requirement. Credited anyway.

### `lipis/flag-icons` — MIT

Flag image URLs, pinned to a release tag.

> Flag images from [lipis/flag-icons](https://github.com/lipis/flag-icons), MIT.

We serve URLs into a CDN, never the bytes. The images stay with their project.

### World Bank Open Data — CC BY 4.0

Country population, indicator `SP.POP.TOTL`, with its reference year.

> Population data from the [World Bank Open Data](https://datacatalog.worldbank.org/public-licenses),
> CC BY 4.0.

### Wikidata — CC0 (evidence only)

Used by the curation harness during verification, for claims with `P248` stated-in
citations. **No Wikidata value is ever published.** It is the reconciliation layer, not a
source of truth, and it appears in proposal pull requests as evidence rather than in the
dataset.

Credited here because it does real work even though it supplies no published field.

## Quarantined sources

These are **not** used. They are listed because their absence is deliberate and the
reasoning is worth stating.

| Source | Licence | Why not |
| --- | --- | --- |
| [`dr5hn/countries-states-cities-database`](https://github.com/dr5hn/countries-states-cities-database) | ODbL 1.0 | share-alike |
| [`mledoze/countries`](https://github.com/mledoze/countries) | ODbL 1.0 | share-alike |
| Overture Maps divisions | ODbL 1.0 | share-alike |

ODbL 1.0 propagates. If any of these fed the published database, CountriesNow's output
would plausibly become a Derivative Database and have to be released under ODbL itself —
which would then bind every downstream consumer of a free public API. For a project whose
value proposition is "use this without thinking about it", that is the wrong trade.

They may be read by the QA lane to cross-check our output. They may never supply a
published value, and an invariant (`no-quarantined-sources-in-output`) asserts it on every
build rather than trusting it.

Original V1 credited `dr5hn/countries-states-cities-database` as a data source. V2 does
not use it.

## Verifying this

The attribution table is generated from adapter metadata, not maintained by hand:

```bash
bun run harness sources
```

Per-field provenance is in the data itself:

```bash
curl "https://countriesnow.space/v2/countries/BG?include=provenance"
```

Every published value names its source, that source's version, and when it was retrieved.

## Predecessor

CountriesNow V1 was created by [Martins Onuoha](https://github.com/MartinsOnuoha) and is
at [MartinsOnuoha/countriesNowAPI](https://github.com/MartinsOnuoha/countriesNowAPI). V2
is a rebuild, and the `/v0.1` compatibility surface exists so V1's users are not stranded
by it.

# Data policy

Reference geo-data attracts arguments that have nothing to do with software. This
document exists so those arguments can be answered by pointing at a rule instead of
relitigating each time.

The rules here are mechanical. Where the project has to make a judgement, the judgement
is written down, tagged in the output, and recorded in the data with
`source: 'policy'` so a client can tell a standards decision from ours.

## Membership

**A country is an ISO 3166-1 entry. No editorial additions, no editorial removals.**

That is the whole rule. It is defensible in a way that curation is not: a report can be
answered with "we follow ISO 3166-1, here is the entry" rather than with an argument
about recognition.

Applying it mechanically also fixed two open V1 issues on its own. Palestine (`PS`, #224)
and Sint Maarten (`SX`, #226) have both had ISO codes for years. Their absence from V1
was a data-entry failure, not a position. Both are asserted present by an invariant now,
so they cannot silently disappear again.

The rule cuts both ways. Entities without an ISO 3166-1 entry are not countries here,
however strongly anyone feels about it. Northern Cyprus gets no separate entity. Somaliland
gets no separate entity. Neither statement is a political claim; both are a consequence
of the rule.

### The one exception

**Kosovo (`XK`)** is emitted with `isoAssigned: false` and `isoStatus: "user-assigned"`.

Kosovo has no ISO 3166-1 entry. But GeoNames publishes `XK`/`XKX`, CLDR maps `XK` to
"Kosovo", libphonenumber has a region `XK`, and the ITU has assigned +383. Omitting it
would make this API less useful than every dataset it is built from. Emitting it silently
would misrepresent what ISO says.

So it is emitted, and it is tagged. `isoAssigned: false` is the machine-readable form of
"this is a pragmatic code, not a standard one", and `sovereigntyNote` carries the
explanation. A client that wants strict ISO 3166-1 filters on `isoAssigned`.

This exception is defined in one place, `harness/policy/territories.ts`, and adding a
second one requires editing that file — which is the point.

### Territories some sources model differently

GeoNames splits France's overseas departments (`GP`, `MQ`, `RE`, `YT`, `GF`) into separate
countries while ISO 3166-2:FR also lists them as French subdivisions. Both models are
defensible. What breaks clients is holding both at once, which is what V1 did.

We follow ISO 3166-1: each has its own alpha-2, so each is a country. `SUPPRESSED_ENTITIES`
exists as the recorded place for future divergences and is currently empty.

## Names

Three name fields, three different authorities, on purpose:

| Field | Source | What it is |
| --- | --- | --- |
| `officialName` | ISO 3166-1 | ISO's exact wording, for compliance use |
| `name` | CLDR | the display name, returned by default |
| `commonName` | ISO, then CLDR | the short colloquial form |

Returning CLDR's wording by default defuses most naming reports without the project
taking a position: we are quoting a standards body, and the field name says which one.
Someone who needs ISO's exact string can ask for `officialName` and get it.

Naming changes are followed, not debated. Türkiye, Eswatini, North Macedonia, Czechia and
Cabo Verde are all current in `name`, and every former name still resolves — a rename
should never break a client.

### Aliases

`MANUAL_ALIASES` in `harness/policy/territories.ts` is the one place hand curation is
still allowed, and it is deliberately narrow: **alternative names for an entity that
already exists.** It cannot add, remove or re-key a country, so it cannot reintroduce the
drift that made V1's six data files disagree with each other.

`REQUIRED_ALIASES` is stronger — a list of query strings that must resolve to a specific
country, enforced by an invariant. Every entry is a real V1 failure:

- `Reunion` (unaccented) 404'd; `Réunion` worked
- `Cote d'Ivoire` and `Côte d'Ivoire` both 404'd
- The population endpoint required `Korea, Rep.` and 404'd on `South Korea`, `Russia`
  and `Egypt`
- `Greece` returned `iso2: "EL"` from one endpoint and `"GR"` from another (#218)
- V1 carried a hardcoded per-request patch for Turkey

### Congo

V1's `countriesAndState.js` held two records both literally named `Congo`, so the DRC was
permanently unreachable by name.

ISO names `CG` "Congo" and `CD` "Congo, The Democratic Republic of the", so bare `Congo`
resolves to `CG` — unambiguously, per the standard, not by picking the first array match.
The DRC answers to `CD`, `COD`, `DR Congo`, `DRC`, `Democratic Republic of the Congo`,
`Congo-Kinshasa` and `Zaire`. Both are asserted present and distinctly reachable by
invariant.

Where a name genuinely is ambiguous, the answer is a 409 listing every candidate with a
directly fetchable key. Ambiguity is an answer, not a coin flip.

## What counts as a city

GeoNames feature codes, filtered by policy in `harness/policy/places.ts`:

```sql
feature_class = 'P'
AND feature_code IN ('PPL','PPLA','PPLA2','PPLA3','PPLC','PPLG')
-- PPLA4/PPLA5 admitted only when not contained in a larger PPL* per hierarchy.zip
```

Excluded: `PPLX` (neighbourhoods), `PPLA5` where contained (arrondissements), `PPLH`
(historical), `PPLQ` (abandoned), `PPLW` (destroyed), `PPLCH` (former capitals), `PPLS`
(clusters), `STLMT` (Israeli settlements in the West Bank — modelled as places rather
than as cities, consistent with excluding other sub-place types, and not a statement
about their status).

This is issue #242. Filtering Provence-Alpes-Côte d'Azur returned 170 Marseille
neighbourhoods and 16 arrondissements alongside the actual cities. Marseille appeared
seventeen times.

Excluded places are not deleted. They are reachable as
`GET /v2/cities/{ref}/neighbourhoods`, because a caller who genuinely wants Mazargues
should be able to get it — just not in a list of French cities.

## Population

The World Bank's `SP.POP.TOTL` is authoritative and carries a reference year, which is
returned as `population.year`.

Roughly 35 small territories are not covered by the World Bank and fall back to GeoNames
`countryInfo.txt`, which publishes a bare integer with no reference period. For those,
`population.year` is `null` all the way out to the response.

**We do not invent a year.** Stamping the snapshot date on an undated figure would make a
2011 estimate look current, which is the exact defect V1 had. `null` is the honest
answer and an invariant enforces that the only undated figures are the ones whose source
publishes no date.

Movement of more than ±20% between releases is flagged as an anomaly and requires a cited
source before it can be published.

## Currency

The SIX `list-one.xml` ISO 4217 register is authoritative, diffed on its `Pblshd`
attribute. Nothing else may supply a currency.

This is issue #236. GeoNames `countryInfo.txt` still lists `BGN` for Bulgaria; SIX lists
`EUR`, effective 2026-01-01. An invariant asserts Bulgaria is EUR, so a source that lags
cannot quietly win.

Where a country has several currencies, exactly one is primary and it is never a fund
code (`XDR`, `XAU` and similar).

## Licensing as policy

Ingest is permissive-only. `dr5hn/countries-states-cities-database`, `mledoze/countries`
and Overture divisions are ODbL 1.0 with share-alike; if they fed the published database,
our output would plausibly become a Derivative Database and every downstream consumer of
a free public API would inherit the copyleft.

They are quarantined: readable for reconciliation, never publishable. An invariant
asserts no published value carries a quarantined source, so the boundary is checked
rather than trusted.

See [ATTRIBUTION.md](ATTRIBUTION.md).

## Changing this document

Policy changes need a pull request that edits both this file and the code that implements
it, and `POLICY_VERSION` in `harness/policy/territories.ts` gets bumped. That version is
recorded in `field_provenance` for every policy-sourced value, so it is always possible
to say which revision of the policy produced a given row.

The AI agent cannot change policy. It proposes data corrections within the policy;
the policy itself is a human decision.

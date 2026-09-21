# The curation harness

`harness/` is a standalone package that keeps the dataset current. It is the answer to
the second half of V1's problem: not "the API is down" but "the data is wrong and nobody
can say where it came from."

The governing rule is that **the LLM never writes to published data.** It proposes.
Deterministic gates reject. A human merges. Every stage below exists to make the pull
request at the end worth reading, not to make it unnecessary.

## Layout

```
harness/
  src/
    sources/     one adapter per upstream, each returning a normalized Snapshot
    snapshot/    content-addressed storage of raw pulls, so every claim is replayable
    resolve/     deterministic merge under policy/precedence.yaml
    detect/      diff snapshot N against N+1, plus cross-source contradiction rules
    agent/       llm.ts, retrieve.ts, apply.ts, pr.ts, index.ts
    gates/       invariants the agent output must survive
    publish/     compile the immutable serving artifact
  policy/
    precedence.yaml   which source wins for which field
    territories.ts    membership, exceptions, required aliases
    places.ts         which GeoNames feature codes count as a city
```

## Commands

```bash
bun run harness sources     # every upstream, its licence and its cadence
bun run harness pull        # fetch into the content-addressed store
bun run harness resolve     # merge under the precedence policy
bun run harness publish     # compile the SQLite artifact
bun run harness detect      # what disagrees right now
bun run harness gate        # the invariant suite
bun run harness bench       # latency budgets
bun run harness propose     # the agent (needs HARNESS_API_KEY)
bun run harness all         # pull -> resolve -> publish -> gate
```

`--offline` uses cached snapshots and never touches the network, which makes a rebuild
fully deterministic. `--json` emits machine-readable output on stdout; all progress
output goes to stderr, so `harness detect --json > anomalies.json` is a valid file.

## Sources, and why each one

Permissive licences only. See [ATTRIBUTION.md](ATTRIBUTION.md) for the full list and the
share-alike reasoning.

**Tier 0 — the spine.**

- **`iso-codes`** (LGPL-2.1+) is the canonical registry for ISO 3166-1, 3166-2, 3166-3
  and 4217, with gettext translations in 159 languages for countries and 70 for
  subdivisions. Its `iso_3166-2.json` carries 124 French subdivisions with correct
  post-2016 names, which is issue #227 fixed structurally rather than by hand.
- **`datasets/country-codes`** (PDDL) is the crosswalk that makes everything else cheap:
  alpha-2, alpha-3, numeric, M49, **geonameid** and **Wikidata QID** in one row.
- **GeoNames** (CC BY 4.0) supplies cities, coordinates and hierarchy, and critically the
  daily `modifications-*.txt` / `deletes-*.txt` deltas that make "continuously updating"
  real rather than aspirational.

**Tier 1 — per-domain authorities.** Each of these exists because the general-purpose
sources are wrong in a specific, known way.

- **SIX `list-one.xml`** is the official ISO 4217 register, free and keyless, with a
  `Pblshd` attribute to diff on. It says `BULGARIA → EUR` today. GeoNames
  `countryInfo.txt` still says `BGN`. Never take currency from GeoNames.
- **`google/libphonenumber`** (Apache-2.0) for dial codes, because it handles shared
  codes like the +1 NANP properly.
- **CLDR** (Unicode-3.0) for 311 territory names across 100+ locales — half of #215.
- **GeoNames `alternateNamesV2`** for city localization — the other half.
- **`lipis/flag-icons`** (MIT, pinned to a tag), served as URLs, never bytes.
- **World Bank `SP.POP.TOTL`** (CC BY 4.0, keyless) for country population, which is the
  only one of these that carries a reference year.

**Tier 2 — evidence only.** **Wikidata** (CC0) is the reconciliation layer. Its `P1082`
population values carry `P585` point-in-time and `P248` stated-in qualifiers, which is
the best free provenance available and exactly what the verify stage needs to cite. It
never supplies a published value.

`restcountries.com` is dead — v1 through v4 return deprecation errors and v5 needs a key.
Do not plan around it.

## The snapshot store

Every fetch is written under the SHA-256 of its bytes. That is what makes "the agent
claimed X because source Y said Z" checkable months later: the exact bytes that produced
the claim are still on disk. It also makes `--offline` rebuilds bit-identical and turns a
re-pull that changed nothing into a no-op.

## The resolver

`policy/precedence.yaml` names exactly one authoritative source per field, with a
fallback chain and a set of cross-checks:

```yaml
country:
  isoOfficialName: { sources: [iso-codes, policy, geonames] }
  displayName: { sources: [cldr, iso-codes, policy] }
  primaryCurrency: { sources: [six-4217], crosscheck: [geonames, country-codes] }
```

A source listed under `crosscheck` is never published. When it disagrees with the
authority, the disagreement is recorded instead. A recent run recorded 492 of them, which
is the raw material DETECT works from.

Every published value writes a `field_provenance` row: source, source version, retrieval
time, confidence. Values the project decides itself are recorded with `source: 'policy'`
and the policy revision, so a hand-made decision is as traceable as a fetched one.

## The agent

The pipeline shape is borrowed from [Aster](https://github.com/Zfinix/aster)'s code-review
algorithm: HYPOTHESIZE → RETRIEVE → VERIFY → SHAPE, where a cheap model over-produces
candidates, targeted evidence is pulled for each, and a stronger model *prompted
specifically to refute* kills the plausible-but-wrong ones.

The algorithm is worth copying and free to copy. The dependency is not: Aster's retrieval
layer is a *code* index — SQLite FTS5, ripgrep, tree-sitter symbols over source files —
and we need a *data* index of upstream snapshots, a provenance graph and SPARQL. Same
architecture, wrong tools. It is also ~30 stars and self-described as early, which is
fine for a dev tool and not fine for production data infrastructure. Worth trying as
`aster review --pr N` in CI on the API code itself; not worth wiring into the data plane.

Why the refutation framing matters: an LLM asked "is Bulgaria's currency right?" will
confabulate. An LLM handed a specific contradiction, the SIX register row, the Wikidata
claim with its `P248` citation, and an instruction to *disprove the proposed change* is
doing something much closer to verifiable work.

### DETECT — no model

Structural diff between the previous dataset and the current one, plus contradiction
rules across sources. Emits an anomaly queue with a stable fingerprint per anomaly so the
same finding is not re-proposed every night.

Known-explainable differences are filtered out. GeoNames and World Bank disagreeing on
population by 3% is a vintage difference, not an error, and paying a model to say so is a
poor trade.

### HYPOTHESIZE — cheap model

Each anomaly becomes at most one candidate change, and only if the model can state a
falsifiable claim: something a specific document could confirm or contradict.

> Good: "Bulgaria adopted the euro on 2026-01-01, so its ISO 4217 code is EUR."
> Bad: "The value looks wrong."

`needsChange: false` is the expected answer most of the time and costs nothing. Three
rules are enforced in code rather than requested in the prompt: a candidate with no
claim is dropped, a candidate targeting an identifier (`iso2`, `iso3`, `geonamesId`,
`wikidataQid`, `m49`) is dropped, and a malformed response costs one candidate rather
than the run.

Low-severity anomalies never reach a model at all. They are almost always coverage gaps.

### RETRIEVE — no model

Deterministic tool calls, not model discretion. Wikidata SPARQL for the relevant claim
with its `P248` citation, the raw upstream rows on both sides of the contradiction, and
the relevant register entry. The model sees evidence it did not choose.

### VERIFY — strong model

Prompted to refute, not to approve. It must find the strongest argument against, and the
proposal survives only if it cannot. Three filters follow, in code:

- verdict must be `upheld` — `inconclusive` is not approval
- confidence must clear `HARNESS_MIN_CONFIDENCE` (default 0.6)
- at least one **primary** source must be cited — an aggregator repeating someone else
  does not count

The refutation is carried into the pull request even when the proposal is upheld, so a
reviewer sees the best argument against the change they are approving.

### GATE — no model

The patch is applied to a cloned dataset and the full invariant suite runs against the
result. This is the stage that makes the pipeline safe to leave running unattended.

Both models can be wrong in the same direction — a cheap one proposing something
plausible and a strong one failing to find the counter-argument is not a rare event — and
neither of them is checking whether ISO codes are still unique or France still has
thirteen regions. The invariant suite is, and it has no opinions.

Results are compared against a baseline taken before the patch, so a proposal is judged
on what it changes rather than what it inherits. A failure is silent rejection, not a
warning on a pull request.

### SHAPE

A draft pull request on a branch named for the dataset version, carrying the JSON Patch,
an evidence table with retrieval dates, the verifier's refutation, the confidence against
the floor, and which gates passed. One branch per version, so a second run updates the
existing PR rather than turning the pull request list into a log file.

## The gates

Three, all blocking in CI.

**Invariants** (`harness/src/gates/invariants.ts`) — 30 rules, each one a closed-forever
guarantee, most derived from a specific historical bug:

- Every country has a unique alpha-2; no duplicate names within a level and type *(the
  `Congo` bug)*
- No `PPLX`, `PPLH`, `PPLQ`, `PPLW`, `PPLCH` or `PPLS` in the cities table *(#242)*
- No sub-place contained in a larger populated place is itself a city *(#242)*
- France has exactly 13 metropolitan regions and 95 metropolitan departments *(#227)*
- `PS` and `SX` are present *(#224, #226)*
- Every currency matches SIX `list-one.xml` at its current `Pblshd` date; Bulgaria is
  EUR *(#236)*
- Sri Lanka exposes 9 provinces with districts at a separate level *(#229)*
- Every entity resolves by name, iso2, iso3 and NFKD-folded name *(the Réunion bug)*
- Every accented country name also resolves unaccented
- Population is never negative, and an undated figure comes only from a source that
  publishes no date
- No published value came from a share-alike source *(the licence firewall, asserted
  rather than assumed)*

**Goldens** — responses captured from the live V1 service, replayed against the shim.
Deliberately offline: V1's uptime is the problem being solved, not a dependency to take
on.

**Bench** — p99 latency budgets per query class. `--ci` fails on regression.

When you fix a data bug, add the invariant that would have caught it. That file is the
project's bug history made executable, and it is the reason old bugs stay fixed.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `GEONAMES_TIER` | `cities15000` | `cities1000`, `cities5000`, `cities15000` or `allCountries` |
| `DATA_DIR` | `data` | Where snapshots and artifacts live |
| `HARNESS_API_KEY` | — | Enables the agent. Everything else works without it |
| `HARNESS_BASE_URL` | OpenRouter | Any OpenAI-compatible endpoint |
| `HARNESS_HYPOTHESIS_MODEL` | `openai/gpt-4o-mini` | The cheap one |
| `HARNESS_VERIFY_MODEL` | `anthropic/claude-sonnet-4.5` | The refuter |
| `HARNESS_MIN_CONFIDENCE` | `0.6` | Confidence floor |
| `HARNESS_MAX_CANDIDATES` | `40` | Cap per run |
| `HARNESS_CONTACT` | — | Goes in the User-Agent; Wikidata blocks anonymous SPARQL |
| `GITHUB_TOKEN` | — | Needed to open the proposal PR |

## Schedule

`.github/workflows/curate.yml` runs daily: pull, resolve, publish, gate, detect, propose,
open the PR. `--dry-run` runs every stage and writes the proposals to disk without
touching GitHub.

Merging a proposal PR is what triggers a release. See [DEPLOYMENT.md](DEPLOYMENT.md).

/**
 * The invariant suite.
 *
 * Most of these encode a specific bug from V1's tracker. Once a rule is here,
 * that bug cannot come back without failing CI — which is the difference
 * between fixing data and fixing a process. V1 fixed "duplicate Warsaw",
 * "duplicate Myanmar", "duplicate Jordan" and "make Bahamas uniform" as four
 * separate hand-authored pull requests over two years; a primary key and a
 * uniqueness check would have made all four structurally impossible.
 *
 * Rules are `error` when a violation must block a release and `warn` when it
 * should be visible but is not disqualifying (usually because upstream coverage
 * is genuinely incomplete rather than wrong).
 */

import { fold, foldTight } from '../../../src/serving/normalize.ts';
import { EXCLUDED_FEATURE_CODES } from '../../policy/places.ts';
import { REQUIRED_ALIASES, REQUIRED_PRESENT } from '../../policy/territories.ts';
import type { Invariant, InvariantViolation } from '../types.ts';

export const INVARIANTS: Invariant[] = [
  /* ---------------------------------------------------------------------- */
  /* Identity and uniqueness                                                 */
  /* ---------------------------------------------------------------------- */
  {
    id: 'country-iso2-unique',
    title: 'Every country has a unique ISO alpha-2 code',
    severity: 'error',
    check({ dataset }) {
      const seen = new Map<string, number>();
      const out: InvariantViolation[] = [];
      for (const c of dataset.countries) {
        if (!/^[A-Z]{2}$/.test(c.iso2)) {
          out.push({ entityRef: c.iso2, detail: `"${c.iso2}" is not a valid alpha-2 code` });
        }
        seen.set(c.iso2, (seen.get(c.iso2) ?? 0) + 1);
      }
      for (const [code, n] of seen) {
        if (n > 1) out.push({ entityRef: code, detail: `alpha-2 ${code} appears ${n} times` });
      }
      return out;
    }
  },

  {
    id: 'country-iso3-unique',
    title: 'ISO alpha-3 codes are unique where present',
    severity: 'error',
    check({ dataset }) {
      const seen = new Map<string, string[]>();
      for (const c of dataset.countries) {
        if (!c.iso3) continue;
        seen.set(c.iso3, [...(seen.get(c.iso3) ?? []), c.iso2]);
      }
      return [...seen.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([code, list]) => ({
          entityRef: code,
          detail: `alpha-3 ${code} is claimed by ${list.join(', ')}`
        }));
    }
  },

  {
    id: 'country-display-name-unique',
    title: 'No two countries share a display name',
    severity: 'error',
    // V1's countriesAndState.js held two records both named "Congo" (iso2 CG
    // and CD). Because lookup was a linear .find() on the name, the DRC was
    // permanently unreachable via ?country=Congo. A uniqueness check on the
    // folded display name makes that shape of data unpublishable.
    check({ dataset }) {
      const seen = new Map<string, string[]>();
      for (const c of dataset.countries) {
        const key = fold(c.displayName);
        seen.set(key, [...(seen.get(key) ?? []), c.iso2]);
      }
      return [...seen.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([name, list]) => ({
          entityRef: list.join(','),
          detail: `display name "${name}" is shared by ${list.join(', ')}`
        }));
    }
  },

  {
    id: 'subdivision-code-unique-per-country',
    title: 'Subdivision codes are unique within their country',
    severity: 'error',
    check({ dataset }) {
      const seen = new Map<string, number>();
      for (const s of dataset.subdivisions) {
        const key = `${s.countryIso2}-${s.code}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      return [...seen.entries()]
        .filter(([, n]) => n > 1)
        .map(([key, n]) => ({ entityRef: key, detail: `${key} appears ${n} times` }));
    }
  },

  {
    id: 'subdivision-name-unique-per-level',
    title: 'No duplicate subdivision names within a country, level and type',
    severity: 'warn',
    // Genuine same-name subdivisions at different levels exist (a French
    // department often shares its region's name), so this is scoped to a level.
    // Type is part of the key too, because ISO 3166-2 deliberately assigns a
    // city and the region around it the same name: AZ-LA is the municipality of
    // Lənkəran and AZ-LAN is the rayon, TW-CYI the city and TW-CYQ the county.
    // Those are two real places, not a data error. Two entries sharing a level,
    // a type and a name is the Congo failure and is what this catches.
    check({ dataset }) {
      const seen = new Map<string, string[]>();
      for (const s of dataset.subdivisions) {
        const key = `${s.countryIso2}|${s.level}|${fold(s.type ?? '')}|${fold(s.name)}`;
        seen.set(key, [...(seen.get(key) ?? []), s.code]);
      }
      return [...seen.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([key, list]) => ({ entityRef: key, detail: `shared by codes ${list.join(', ')}` }));
    }
  },

  {
    id: 'place-geonames-id-unique',
    title: 'Every place has a unique GeoNames id',
    severity: 'error',
    check({ dataset }) {
      const seen = new Set<number>();
      const dupes: InvariantViolation[] = [];
      for (const p of dataset.places) {
        if (seen.has(p.geonamesId)) {
          dupes.push({ entityRef: String(p.geonamesId), detail: `${p.name} is duplicated` });
        }
        seen.add(p.geonamesId);
      }
      return dupes;
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Cities: issue #242                                                      */
  /* ---------------------------------------------------------------------- */
  {
    id: 'no-neighbourhoods-as-cities',
    title: 'No neighbourhood, arrondissement or defunct place is marked a city',
    severity: 'error',
    issue: '#242',
    // Asking V1 for cities in Provence-Alpes-Côte d'Azur returned Mazargues and
    // Sainte-Marguerite (PPLX neighbourhoods of Marseille) and "Marseille 08"
    // (a PPLA5 arrondissement). This is that report, as a rule.
    check({ dataset }) {
      return dataset.places
        .filter((p) => p.isCity && EXCLUDED_FEATURE_CODES.has(p.featureCode))
        .slice(0, 50)
        .map((p) => ({
          entityRef: String(p.geonamesId),
          detail: `${p.name} (${p.countryIso2}) is ${p.featureCode} but marked isCity`
        }));
    }
  },

  {
    id: 'cities-are-populated-places',
    title: 'Everything marked a city is a GeoNames P-class feature',
    severity: 'error',
    check({ dataset }) {
      return dataset.places
        .filter((p) => p.isCity && p.featureClass !== 'P')
        .slice(0, 50)
        .map((p) => ({
          entityRef: String(p.geonamesId),
          detail: `${p.name} has feature class ${p.featureClass}`
        }));
    }
  },

  {
    id: 'contained-subplaces-not-cities',
    title: 'A sub-place inside a larger populated place is not itself a city',
    severity: 'error',
    issue: '#242',
    check({ dataset }) {
      return dataset.places
        .filter((p) => p.isCity && p.parentGeonamesId !== null)
        .slice(0, 50)
        .map((p) => ({
          entityRef: String(p.geonamesId),
          detail: `${p.name} (${p.featureCode}) is contained in ${p.parentGeonamesId} but marked isCity`
        }));
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Membership: issues #224, #226                                           */
  /* ---------------------------------------------------------------------- */
  {
    id: 'required-countries-present',
    title: 'Countries whose absence was a reported bug are present',
    severity: 'error',
    issue: '#224, #226',
    check({ byIso2 }) {
      return REQUIRED_PRESENT.filter((r) => !byIso2.has(r.iso2)).map((r) => ({
        entityRef: r.iso2,
        detail: `${r.iso2} is missing — ${r.why}`
      }));
    }
  },

  {
    id: 'user-assigned-codes-flagged',
    title: 'Codes not assigned by ISO are marked as such',
    severity: 'error',
    // Emitting XK is a pragmatic choice; letting a client mistake it for a
    // standard code is not. See docs/DATA_POLICY.md.
    check({ dataset }) {
      return dataset.countries
        .filter((c) => !c.isoAssigned && !c.sovereigntyNote)
        .map((c) => ({
          entityRef: c.iso2,
          detail: `${c.iso2} is user-assigned but carries no sovereignty note`
        }));
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Currency: issue #236                                                    */
  /* ---------------------------------------------------------------------- */
  {
    id: 'currency-codes-resolvable',
    title: 'Every country currency resolves to a known ISO 4217 code',
    severity: 'error',
    check({ dataset }) {
      const known = new Set(dataset.currencies.map((c) => c.code));
      const out: InvariantViolation[] = [];
      for (const c of dataset.countries) {
        for (const link of c.currencies) {
          if (!known.has(link.code)) {
            out.push({ entityRef: c.iso2, detail: `unknown currency code ${link.code}` });
          }
        }
      }
      return out;
    }
  },

  {
    id: 'bulgaria-uses-eur',
    title: 'Bulgaria uses EUR',
    severity: 'error',
    issue: '#236',
    // Deliberately specific. Bulgaria adopted the euro on 2026-01-01 and the
    // SIX register reflects it; GeoNames countryInfo.txt still says BGN months
    // later. This asserts the pipeline took the value from the right source,
    // and it is the canary for the whole precedence policy.
    check({ byIso2 }) {
      const bg = byIso2.get('BG');
      if (!bg) return [{ entityRef: 'BG', detail: 'Bulgaria is missing entirely' }];
      if (bg.primaryCurrency !== 'EUR') {
        return [
          {
            entityRef: 'BG',
            detail:
              `primary currency is ${bg.primaryCurrency}, expected EUR. ` +
              `A stale value here means GeoNames overrode the SIX register.`
          }
        ];
      }
      return [];
    }
  },

  {
    id: 'multi-currency-has-one-primary',
    title: 'A country with several currencies has exactly one primary, and it is not a fund',
    severity: 'error',
    check({ dataset }) {
      const out: InvariantViolation[] = [];
      for (const c of dataset.countries) {
        if (c.currencies.length === 0) continue;
        const primaries = c.currencies.filter((x) => x.isPrimary);
        if (primaries.length !== 1) {
          out.push({
            entityRef: c.iso2,
            detail: `${primaries.length} primary currencies among ${c.currencies.length}`
          });
        } else if (primaries[0]!.isFund && c.currencies.some((x) => !x.isFund)) {
          out.push({
            entityRef: c.iso2,
            detail: `primary currency ${primaries[0]!.code} is a funds code`
          });
        }
      }
      return out;
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Subdivision hierarchy: issues #227, #229                                */
  /* ---------------------------------------------------------------------- */
  {
    id: 'france-subdivisions-current',
    title: 'French subdivisions reflect the post-2016 regions',
    severity: 'error',
    issue: '#227',
    // France merged 22 metropolitan regions into 13 in 2016. ISO 3166-2:FR now
    // lists 12 as "Metropolitan region" plus Corse as a collectivity with
    // special status, and 95 metropolitan departments beneath them. V1 carried
    // both "Nord-Pas-De-Calais" and "Hauts-de-France" at once.
    check({ dataset }) {
      const fr = dataset.subdivisions.filter((s) => s.countryIso2 === 'FR');
      const out: InvariantViolation[] = [];

      const regions = fr.filter((s) => s.type === 'Metropolitan region');
      if (regions.length !== 12) {
        out.push({
          entityRef: 'FR',
          detail: `${regions.length} metropolitan regions, expected 12 (plus Corse as a special-status collectivity)`
        });
      }

      const departments = fr.filter((s) => s.type === 'Metropolitan department');
      if (departments.length !== 95) {
        out.push({
          entityRef: 'FR',
          detail: `${departments.length} metropolitan departments, expected 95`
        });
      }

      // The pre-2016 names are the actual regression signature.
      const retired = ['Nord-Pas-de-Calais', 'Picardie', 'Aquitaine', 'Bourgogne', 'Rhône-Alpes'];
      for (const name of retired) {
        const hit = fr.find((s) => fold(s.name) === fold(name) && s.type === 'Metropolitan region');
        if (hit) {
          out.push({
            entityRef: `FR-${hit.code}`,
            detail: `"${name}" was merged away in 2016 but is still listed as a region`
          });
        }
      }

      for (const modern of ['Hauts-de-France', 'Nouvelle-Aquitaine', 'Auvergne-Rhône-Alpes']) {
        if (!fr.some((s) => fold(s.name) === fold(modern))) {
          out.push({ entityRef: 'FR', detail: `current region "${modern}" is missing` });
        }
      }

      return out;
    }
  },

  {
    id: 'sri-lanka-province-district-hierarchy',
    title: 'Sri Lanka exposes 9 provinces with districts nested beneath them',
    severity: 'error',
    issue: '#229',
    // V1 flattened provinces and districts into one `states` list. Sri Lanka is
    // province > district > city, so a location picker built on V1 offered 34
    // undifferentiated options where it should have offered 9.
    check({ dataset }) {
      const lk = dataset.subdivisions.filter((s) => s.countryIso2 === 'LK');
      const out: InvariantViolation[] = [];

      const provinces = lk.filter((s) => s.type === 'Province');
      if (provinces.length !== 9) {
        out.push({ entityRef: 'LK', detail: `${provinces.length} provinces, expected 9` });
      }

      const districts = lk.filter((s) => s.type === 'District');
      const orphans = districts.filter((d) => !d.parentCode);
      if (orphans.length > 0) {
        out.push({
          entityRef: 'LK',
          detail: `${orphans.length} districts have no parent province: ${orphans
            .slice(0, 5)
            .map((d) => d.name)
            .join(', ')}`
        });
      }

      if (provinces.some((p) => p.level !== 1)) {
        out.push({ entityRef: 'LK', detail: 'provinces must be level 1' });
      }
      if (districts.some((d) => d.level !== 2)) {
        out.push({ entityRef: 'LK', detail: 'districts must be level 2' });
      }

      return out;
    }
  },

  {
    id: 'subdivision-parents-resolve',
    title: 'Every subdivision parent code refers to a real sibling',
    severity: 'error',
    check({ dataset }) {
      const index = new Set(dataset.subdivisions.map((s) => `${s.countryIso2}|${s.code}`));
      return dataset.subdivisions
        .filter((s) => s.parentCode && !index.has(`${s.countryIso2}|${s.parentCode}`))
        .slice(0, 50)
        .map((s) => ({
          entityRef: s.iso3166_2 ?? `${s.countryIso2}-${s.code}`,
          detail: `parent ${s.parentCode} does not exist in ${s.countryIso2}`
        }));
    }
  },

  {
    id: 'subdivisions-belong-to-known-countries',
    title: 'Every subdivision belongs to a country in the dataset',
    severity: 'error',
    check({ dataset, byIso2 }) {
      const bad = new Set(
        dataset.subdivisions.filter((s) => !byIso2.has(s.countryIso2)).map((s) => s.countryIso2)
      );
      return [...bad].map((iso2) => ({
        entityRef: iso2,
        detail: `subdivisions reference unknown country ${iso2}`
      }));
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Name resolution                                                         */
  /* ---------------------------------------------------------------------- */
  {
    id: 'required-aliases-resolve',
    title: 'Historically failing name lookups all resolve',
    severity: 'error',
    // Every entry in REQUIRED_ALIASES is a spelling that 404'd against V1 or a
    // rename that broke clients. "Reunion" without the accent is the canonical
    // case: V1 compared with .toLowerCase() only.
    check({ dataset }) {
      // Mirrors the two-tier lookup in src/serving/resolve.ts: exact fold
      // first, punctuation-insensitive fold only on a miss. Testing just the
      // exact index would fail inputs the API actually resolves, and — worse —
      // could pass inputs it does not.
      const exact = new Map<string, Set<string>>();
      const tight = new Map<string, Set<string>>();
      for (const c of dataset.countries) {
        for (const n of c.names) {
          const e = exact.get(n.folded) ?? new Set<string>();
          e.add(c.iso2);
          exact.set(n.folded, e);

          const tk = foldTight(n.name);
          const t = tight.get(tk) ?? new Set<string>();
          t.add(c.iso2);
          tight.set(tk, t);
        }
      }

      const out: InvariantViolation[] = [];
      for (const alias of REQUIRED_ALIASES) {
        const hits = exact.get(fold(alias.query)) ?? tight.get(foldTight(alias.query));
        if (!hits || hits.size === 0) {
          out.push({
            entityRef: alias.iso2,
            detail: `"${alias.query}" resolves to nothing — ${alias.why}`
          });
        } else if (!hits.has(alias.iso2)) {
          out.push({
            entityRef: alias.iso2,
            detail: `"${alias.query}" resolves to ${[...hits].join(', ')}, expected ${alias.iso2}`
          });
        }
      }
      return out;
    }
  },

  {
    id: 'accent-folded-names-resolve',
    title: 'Every accented country name also resolves unaccented',
    severity: 'error',
    check({ dataset }) {
      const folded = new Set<string>();
      for (const c of dataset.countries) for (const n of c.names) folded.add(n.folded);

      return dataset.countries
        .filter((c) => /[^\p{ASCII}]/u.test(c.displayName))
        .filter((c) => !folded.has(fold(c.displayName)))
        .map((c) => ({
          entityRef: c.iso2,
          detail: `"${c.displayName}" has no ASCII-foldable name entry`
        }));
    }
  },

  {
    id: 'every-country-has-a-preferred-name',
    title: 'Every country has at least one preferred English name',
    severity: 'error',
    check({ dataset }) {
      return dataset.countries
        .filter((c) => !c.names.some((n) => n.isPreferred))
        .map((c) => ({ entityRef: c.iso2, detail: 'no preferred name' }));
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Localization: issue #215                                                */
  /* ---------------------------------------------------------------------- */
  {
    id: 'localization-coverage',
    title: 'Country names are localized into a useful number of locales',
    severity: 'warn',
    issue: '#215',
    check({ dataset }) {
      const thin = dataset.countries.filter((c) => {
        const locales = new Set(c.names.filter((n) => n.locale !== 'und').map((n) => n.locale));
        return locales.size < 5;
      });
      if (thin.length === 0) return [];
      return [
        {
          detail:
            `${thin.length} of ${dataset.countries.length} countries have fewer than 5 locales. ` +
            `Examples: ${thin
              .slice(0, 5)
              .map((c) => c.iso2)
              .join(', ')}`
        }
      ];
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Referential integrity and sanity                                        */
  /* ---------------------------------------------------------------------- */
  {
    id: 'places-belong-to-known-countries',
    title: 'Every place belongs to a country in the dataset',
    severity: 'error',
    check({ dataset, byIso2 }) {
      const bad = new Set(
        dataset.places.filter((p) => !byIso2.has(p.countryIso2)).map((p) => p.countryIso2)
      );
      return [...bad].map((iso2) => ({
        entityRef: iso2,
        detail: `places reference unknown country ${iso2}`
      }));
    }
  },

  {
    id: 'place-parents-resolve',
    title: 'Every place parent reference resolves',
    severity: 'error',
    check({ dataset }) {
      const ids = new Set(dataset.places.map((p) => p.geonamesId));
      return dataset.places
        .filter((p) => p.parentGeonamesId !== null && !ids.has(p.parentGeonamesId))
        .slice(0, 25)
        .map((p) => ({
          entityRef: String(p.geonamesId),
          detail: `parent ${p.parentGeonamesId} is not in the dataset`
        }));
    }
  },

  {
    id: 'coordinates-in-range',
    title: 'Latitude and longitude are within valid bounds',
    severity: 'error',
    check({ dataset }) {
      const out: InvariantViolation[] = [];
      for (const p of dataset.places) {
        if (p.latitude !== null && (p.latitude < -90 || p.latitude > 90)) {
          out.push({ entityRef: String(p.geonamesId), detail: `latitude ${p.latitude}` });
        }
        if (p.longitude !== null && (p.longitude < -180 || p.longitude > 180)) {
          out.push({ entityRef: String(p.geonamesId), detail: `longitude ${p.longitude}` });
        }
      }
      return out.slice(0, 25);
    }
  },

  {
    id: 'population-non-negative',
    title: 'Populations are never negative',
    severity: 'error',
    check({ dataset }) {
      const out: InvariantViolation[] = [];
      for (const c of dataset.countries) {
        if (c.population !== null && c.population < 0) {
          out.push({ entityRef: c.iso2, detail: `population ${c.population}` });
        }
      }
      for (const p of dataset.places) {
        if (p.population !== null && p.population < 0) {
          out.push({ entityRef: String(p.geonamesId), detail: `population ${p.population}` });
        }
      }
      return out.slice(0, 25);
    }
  },

  {
    id: 'population-has-a-year',
    title: 'An undated population comes from a source that publishes no date',
    severity: 'warn',
    // V1 served unlabelled population numbers, so a 2011 census and a 2024
    // estimate looked identical. Being unable to date a figure is acceptable;
    // presenting it as though it were current is not, and neither is inventing
    // a year from the snapshot date.
    //
    // World Bank figures carry a reference year and must keep it — a dated
    // figure silently losing its year is the regression worth catching. The
    // ~35 territories World Bank does not cover fall back to GeoNames
    // countryInfo.txt, which ships a bare integer with no reference period. For
    // those, populationYear stays null all the way out to the response.
    check({ dataset }) {
      const DATELESS = new Set(['geonames']);
      const source = new Map(
        dataset.provenance.filter((p) => p.field === 'population').map((p) => [p.entityRef, p.source])
      );

      return dataset.countries
        .filter((c) => c.population !== null && !c.populationYear)
        .filter((c) => !DATELESS.has(source.get(c.iso2) ?? ''))
        .map((c) => ({
          entityRef: c.iso2,
          detail: `population ${c.population} has no year, and ${
            source.get(c.iso2) ?? 'its source'
          } publishes one`
        }));
    }
  },

  {
    id: 'provenance-coverage',
    title: 'Published fields carry provenance',
    severity: 'warn',
    check({ dataset }) {
      const covered = new Set(dataset.provenance.map((p) => `${p.entityRef}|${p.field}`));
      const missing = dataset.countries.filter((c) => !covered.has(`${c.iso2}|isoOfficialName`));
      if (missing.length === 0) return [];
      return [
        {
          detail: `${missing.length} countries have no provenance for isoOfficialName`
        }
      ];
    }
  },

  {
    id: 'no-quarantined-sources-in-output',
    title: 'No published value came from a share-alike source',
    severity: 'error',
    // The licence firewall, asserted rather than assumed. If an ODbL value ever
    // reaches the published tables, our output arguably becomes a derivative
    // database and every downstream consumer inherits the copyleft.
    check({ dataset }) {
      const banned = new Set(['dr5hn', 'mledoze']);
      const hits = dataset.provenance.filter((p) => banned.has(p.source));
      return hits.slice(0, 10).map((p) => ({
        entityRef: p.entityRef,
        detail: `${p.field} was sourced from quarantined ${p.source}`
      }));
    }
  },

  {
    id: 'dataset-not-empty',
    title: 'The dataset has a plausible amount of data',
    severity: 'error',
    // A cheap tripwire. A parser regression that silently produces zero rows is
    // otherwise easy to publish, since every other rule passes vacuously.
    check({ dataset }) {
      const out: InvariantViolation[] = [];
      if (dataset.countries.length < 200) {
        out.push({ detail: `only ${dataset.countries.length} countries, expected 240+` });
      }
      if (dataset.subdivisions.length < 3000) {
        out.push({ detail: `only ${dataset.subdivisions.length} subdivisions, expected 4500+` });
      }
      if (dataset.places.filter((p) => p.isCity).length < 1000) {
        out.push({ detail: `only ${dataset.places.filter((p) => p.isCity).length} cities` });
      }
      if (dataset.currencies.length < 100) {
        out.push({ detail: `only ${dataset.currencies.length} currencies` });
      }
      return out;
    }
  }
];

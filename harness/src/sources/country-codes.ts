/**
 * datasets/country-codes — the crosswalk.
 *
 * This is the cheapest source in the pipeline and one of the most valuable: a
 * single 249-row CSV that carries alpha-2, alpha-3, numeric, M49, the GeoNames
 * id and the Wikidata QID on the same line. Every later join — GeoNames places
 * to countries, Wikidata evidence to entities — goes through those two
 * identifier columns, so having them pre-matched removes the name-based joining
 * that was V1's original sin.
 *
 * It is also public domain (ODC-PDDL-1.0), so nothing here constrains our
 * output licence.
 *
 * Its currency columns are deliberately ignored. They are single-valued, which
 * cannot represent the 14 countries that legitimately have more than one
 * currency, and they lag the register. Currency comes from SIX; see
 * harness/policy/precedence.yaml.
 */

import { fold } from '../../../src/serving/normalize.ts';
import { fetchArtifact, readSnapshotText } from '../snapshot/store.ts';
import type { FetchContext, NameRecord, Snapshot, SourceAdapter } from '../types.ts';

const URL =
  'https://raw.githubusercontent.com/datasets/country-codes/master/data/country-codes.csv';

export interface CrosswalkRow {
  iso2: string;
  iso3: string | null;
  isoNumeric: string | null;
  m49: string | null;
  geonamesId: number | null;
  wikidataQid: string | null;
  cldrDisplayName: string | null;
  officialNameEn: string | null;
  /** UN official names in the other five UN languages, keyed by locale. */
  officialNames: Record<string, string>;
  dial: string | null;
  capital: string | null;
  continent: string | null;
  tld: string | null;
  regionName: string | null;
  subregionName: string | null;
  intermediateRegionName: string | null;
  isIndependent: string | null;
  languages: string[];
}

export interface CountryCodesData {
  version: string;
  rows: CrosswalkRow[];
}

/**
 * RFC 4180 CSV parser. The file contains quoted fields with embedded commas
 * (country names such as "Korea, Republic of") and embedded newlines, so
 * splitting on commas is not an option.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      // Skip blank trailing lines rather than emitting a one-empty-field row.
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const nz = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * The crosswalk stores Wikidata as an entity URL. We want the bare QID, because
 * that is what SPARQL binds and what the evidence tables in a proposal cite.
 */
const qid = (v: string | null): string | null => {
  if (!v) return null;
  const m = /(Q\d+)\s*$/.exec(v);
  return m?.[1] ?? (/^Q\d+$/.test(v) ? v : null);
};

export const countryCodes: SourceAdapter<CountryCodesData> = {
  id: 'country-codes',
  title: 'datasets/country-codes (DataHub)',
  cadence: 'irregular; a build product, so freshness varies by column',
  license: {
    spdx: 'ODC-PDDL-1.0',
    url: 'https://github.com/datasets/country-codes',
    attribution: 'Country code crosswalk from datasets/country-codes (ODC-PDDL-1.0, public domain).',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    return [
      await fetchArtifact({
        source: 'country-codes',
        artifact: 'country-codes.csv',
        url: URL,
        offline: ctx.offline,
        log: ctx.log
      })
    ];
  },

  async parse(snapshots: Snapshot[]): Promise<CountryCodesData> {
    const snap = snapshots[0]!;
    const grid = parseCsv(await readSnapshotText(snap));
    const header = grid[0] ?? [];
    const idx = (name: string) => header.indexOf(name);

    const c = {
      iso2: idx('ISO3166-1-Alpha-2'),
      iso3: idx('ISO3166-1-Alpha-3'),
      num: idx('ISO3166-1-numeric'),
      m49: idx('M49'),
      geo: idx('Geoname ID'),
      wd: idx('wikidata_id'),
      cldr: idx('CLDR display name'),
      en: idx('official_name_en'),
      fr: idx('official_name_fr'),
      es: idx('official_name_es'),
      ru: idx('official_name_ru'),
      ar: idx('official_name_ar'),
      cn: idx('official_name_cn'),
      dial: idx('Dial'),
      capital: idx('Capital'),
      continent: idx('Continent'),
      tld: idx('TLD'),
      region: idx('Region Name'),
      subregion: idx('Sub-region Name'),
      intermediate: idx('Intermediate Region Name'),
      independent: idx('is_independent'),
      languages: idx('Languages')
    };

    const rows: CrosswalkRow[] = [];
    for (const r of grid.slice(1)) {
      const iso2 = nz(r[c.iso2]);
      if (!iso2) continue;

      const officialNames: Record<string, string> = {};
      for (const [locale, col] of [
        ['fr', c.fr],
        ['es', c.es],
        ['ru', c.ru],
        ['ar', c.ar],
        ['zh', c.cn]
      ] as const) {
        const v = nz(r[col]);
        if (v) officialNames[locale] = v;
      }

      const geoRaw = nz(r[c.geo]);
      rows.push({
        iso2: iso2.toUpperCase(),
        iso3: nz(r[c.iso3])?.toUpperCase() ?? null,
        isoNumeric: nz(r[c.num])?.padStart(3, '0') ?? null,
        m49: nz(r[c.m49])?.padStart(3, '0') ?? null,
        geonamesId: geoRaw && /^\d+$/.test(geoRaw) ? Number(geoRaw) : null,
        wikidataQid: qid(nz(r[c.wd])),
        cldrDisplayName: nz(r[c.cldr]),
        officialNameEn: nz(r[c.en]),
        officialNames,
        dial: nz(r[c.dial]),
        capital: nz(r[c.capital]),
        continent: nz(r[c.continent]),
        tld: nz(r[c.tld]),
        regionName: nz(r[c.region]),
        subregionName: nz(r[c.subregion]),
        intermediateRegionName: nz(r[c.intermediate]),
        isIndependent: nz(r[c.independent]),
        languages:
          nz(r[c.languages])
            ?.split(',')
            .map((s) => s.trim())
            .filter(Boolean) ?? []
      });
    }

    return { version: snap.version, rows };
  }
};

/**
 * The UN official names, as localised name records.
 *
 * Six languages is thin next to CLDR's hundred, but these arrive for free with
 * the crosswalk and cover the UN languages, so the localisation feature in
 * issue #215 has something to serve even before the CLDR adapter runs.
 */
export function crosswalkNames(row: CrosswalkRow): NameRecord[] {
  const out: NameRecord[] = [];
  const add = (name: string | null, locale: string, kind: NameRecord['kind']) => {
    if (!name) return;
    const folded = fold(name);
    if (!folded) return;
    if (out.some((n) => n.folded === folded && n.locale === locale)) return;
    out.push({ locale, name, folded, kind, isPreferred: false, source: 'country-codes' });
  };

  add(row.cldrDisplayName, 'en', 'cldr-display');
  add(row.officialNameEn, 'en', 'iso-official');
  for (const [locale, name] of Object.entries(row.officialNames)) add(name, locale, 'iso-official');
  return out;
}

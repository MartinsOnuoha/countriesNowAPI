/**
 * Debian iso-codes — the canonical registry.
 *
 * ISO is the maintenance agency for 3166 and 4217, but its own machine-readable
 * product is a paid subscription and the free Online Browsing Platform has no
 * bulk export. iso-codes is the practical answer: a permissively licensed
 * project that tracks the OBP and ISO newsletters by hand, ships JSON, and
 * carries gettext translations in 159 languages for country names and 70 for
 * subdivisions — broader subdivision coverage than CLDR, which has three
 * entries in its French subdivision file.
 *
 * Two things here matter more than they look:
 *
 *   - `iso_3166-2.json` carries a `parent` field on 1,456 of its 5,046 rows.
 *     That is the administrative hierarchy ISO is often said not to publish,
 *     and it is what lets Sri Lanka expose 9 provinces above 25 districts
 *     (issue #229) rather than flattening both into one list.
 *
 *   - The French subdivisions are current. ISO lists 12 metropolitan regions
 *     plus Corse as a collectivity with special status, with all 95 departments
 *     correctly parented beneath them. GeoNames, by contrast, still calls
 *     FR-27 "Bourgogne" and FR-84 "Rhône-Alpes" — the pre-2016 names behind
 *     issue #227.
 */

import { fold } from '../../../src/serving/normalize.ts';
import { fetchArtifact, readSnapshotJson } from '../snapshot/store.ts';
import type { FetchContext, NameRecord, Snapshot, SourceAdapter } from '../types.ts';

const BASE = 'https://salsa.debian.org/iso-codes-team/iso-codes/-/raw/main/data';

interface Iso3166_1Row {
  alpha_2: string;
  alpha_3?: string;
  numeric?: string;
  name: string;
  official_name?: string;
  common_name?: string;
  /** Emoji flag, already present upstream — no extra source needed. */
  flag?: string;
}

interface Iso3166_2Row {
  code: string;
  name: string;
  type?: string;
  /** Full parent code, e.g. "FR-ARA". Present on ~29% of rows. */
  parent?: string;
}

interface Iso3166_3Row {
  alpha_2?: string;
  alpha_3?: string;
  alpha_4: string;
  name: string;
  comment?: string;
  withdrawal_date?: string;
}

interface Iso4217Row {
  alpha_3: string;
  numeric?: string;
  name: string;
}

export interface IsoCodesData {
  version: string;
  countries: Iso3166_1Row[];
  subdivisions: Iso3166_2Row[];
  /** Withdrawn codes. Used to keep historical names resolvable. */
  retired: Iso3166_3Row[];
  currencies: Iso4217Row[];
}

export const isoCodes: SourceAdapter<IsoCodesData> = {
  id: 'iso-codes',
  title: 'Debian iso-codes',
  cadence: '2-4 releases per year, tracking ISO newsletters',
  license: {
    spdx: 'LGPL-2.1-or-later',
    url: 'https://salsa.debian.org/iso-codes-team/iso-codes',
    attribution: 'ISO code lists from the Debian iso-codes project (LGPL-2.1-or-later).',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    const files = ['iso_3166-1.json', 'iso_3166-2.json', 'iso_3166-3.json', 'iso_4217.json'];
    const out: Snapshot[] = [];
    for (const artifact of files) {
      out.push(
        await fetchArtifact({
          source: 'iso-codes',
          artifact,
          url: `${BASE}/${artifact}`,
          offline: ctx.offline,
          log: ctx.log
        })
      );
    }
    return out;
  },

  async parse(snapshots: Snapshot[]): Promise<IsoCodesData> {
    const by = (name: string) => {
      const s = snapshots.find((x) => x.artifact === name);
      if (!s) throw new Error(`iso-codes: missing snapshot ${name}`);
      return s;
    };

    const c1 = await readSnapshotJson<{ '3166-1': Iso3166_1Row[] }>(by('iso_3166-1.json'));
    const c2 = await readSnapshotJson<{ '3166-2': Iso3166_2Row[] }>(by('iso_3166-2.json'));
    const c3 = await readSnapshotJson<{ '3166-3': Iso3166_3Row[] }>(by('iso_3166-3.json'));
    const c4 = await readSnapshotJson<{ '4217': Iso4217Row[] }>(by('iso_4217.json'));

    return {
      version: by('iso_3166-1.json').version,
      countries: c1['3166-1'] ?? [],
      subdivisions: c2['3166-2'] ?? [],
      retired: c3['3166-3'] ?? [],
      currencies: c4['4217'] ?? []
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Derived helpers used by the resolver                                        */
/* -------------------------------------------------------------------------- */

export function isoCountryNames(row: Iso3166_1Row): NameRecord[] {
  const out: NameRecord[] = [];
  const add = (name: string | undefined, kind: NameRecord['kind'], preferred = false) => {
    if (!name) return;
    const folded = fold(name);
    if (!folded) return;
    if (out.some((n) => n.folded === folded && n.kind === kind)) return;
    out.push({ locale: 'en', name, folded, kind, isPreferred: preferred, source: 'iso-codes' });
  };

  add(row.name, 'iso-official', true);
  add(row.official_name, 'iso-official');
  add(row.common_name, 'common');
  return out;
}

/**
 * Names of codes ISO has withdrawn, mapped onto their successor.
 *
 * Keeps "Burma", "Zaire" and "Netherlands Antilles" resolvable. A caller with
 * an old database should get an answer and a note, not a 404.
 */
export function retiredNames(rows: Iso3166_3Row[]): Array<{ iso2: string; name: NameRecord }> {
  const out: Array<{ iso2: string; name: NameRecord }> = [];
  for (const row of rows) {
    // alpha_4 is the transitional code: the first two characters are the
    // withdrawn alpha-2, the last two the successor's.
    const successor = row.alpha_4?.slice(2, 4);
    if (!successor || successor.length !== 2 || !/^[A-Z]{2}$/.test(successor)) continue;
    const folded = fold(row.name);
    if (!folded) continue;
    out.push({
      iso2: successor,
      name: {
        locale: 'und',
        name: row.name,
        folded,
        kind: 'historical',
        isPreferred: false,
        source: 'iso-codes'
      }
    });
  }
  return out;
}

/** Split "FR-ARA" into its country and local parts. */
export function splitSubdivisionCode(code: string): { country: string; local: string } | null {
  const idx = code.indexOf('-');
  if (idx !== 2) return null;
  return { country: code.slice(0, 2), local: code.slice(idx + 1) };
}

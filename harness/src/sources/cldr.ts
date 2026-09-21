/** CLDR territory names (#215); subdivision coverage thin — iso-codes primary. */

import { fetchArtifact, readSnapshotJson } from '../snapshot/store.ts';
import type { FetchContext, Snapshot, SourceAdapter } from '../types.ts';

const BASE = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json';

/**
 * The locales we ship. Chosen for coverage of the widely-spoken languages plus
 * the six UN languages. Extend freely — each is one small JSON file.
 */
export const DEFAULT_LOCALES = [
  'en',
  'fr',
  'es',
  'de',
  'pt',
  'it',
  'nl',
  'ru',
  'zh',
  'ja',
  'ko',
  'ar',
  'hi',
  'tr',
  'pl',
  'sv',
  'id',
  'vi',
  'th',
  'uk'
] as const;

export interface CldrData {
  version: string;
  /** iso2 -> { locale -> name }. */
  territories: Map<string, Record<string, string>>;
  /** Lowercased ISO 3166-2 code without the hyphen, e.g. "gbeng" -> name. */
  subdivisions: Map<string, string>;
  currencySymbols: Map<string, string>;
}

interface TerritoriesFile {
  main: Record<
    string,
    { localeDisplayNames?: { territories?: Record<string, string> }; identity?: unknown }
  >;
}

interface CurrenciesFile {
  main: Record<
    string,
    { numbers?: { currencies?: Record<string, { symbol?: string; displayName?: string }> } }
  >;
}

/**
 * The subdivisions package nests one level shallower than every other CLDR
 * package: `{ subdivisions: { localeDisplayNames: { subdivisions: {...} } } }`
 * rather than `{ main: { <locale>: ... } }`. Both shapes are accepted so a
 * future upstream realignment does not silently produce zero names.
 */
interface SubdivisionsFile {
  subdivisions?: { localeDisplayNames?: { subdivisions?: Record<string, string> } };
  main?: Record<string, { localeDisplayNames?: { subdivisions?: Record<string, string> } }>;
}

export const cldr: SourceAdapter<CldrData> = {
  id: 'cldr',
  title: 'Unicode CLDR (cldr-json)',
  cadence: 'two releases per year on a published schedule',
  license: {
    spdx: 'Unicode-3.0',
    url: 'https://github.com/unicode-org/cldr-json',
    attribution: 'Localized names from the Unicode CLDR (Unicode-3.0 licence).',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    const out: Snapshot[] = [];

    // Per-locale fetch failures are non-fatal.
    const tryFetch = async (artifact: string, url: string) => {
      try {
        out.push(
          await fetchArtifact({ source: 'cldr', artifact, url, offline: ctx.offline, log: ctx.log })
        );
      } catch (err) {
        ctx.log.warn(`cldr: skipping ${artifact} (${(err as Error).message})`);
      }
    };

    for (const locale of DEFAULT_LOCALES) {
      await tryFetch(
        `territories-${locale}.json`,
        `${BASE}/cldr-localenames-full/main/${locale}/territories.json`
      );
    }

    await tryFetch('currencies-en.json', `${BASE}/cldr-numbers-full/main/en/currencies.json`);

    // Subdivisions use subdivisions/<locale>/ layout, not main/.
    await tryFetch(
      'subdivisions-en.json',
      `${BASE}/cldr-subdivisions-full/subdivisions/en/en.json`
    );

    return out;
  },

  async parse(snapshots: Snapshot[], ctx: FetchContext): Promise<CldrData> {
    const territories = new Map<string, Record<string, string>>();

    for (const locale of DEFAULT_LOCALES) {
      const snap = snapshots.find((s) => s.artifact === `territories-${locale}.json`);
      if (!snap) continue;
      try {
        const doc = await readSnapshotJson<TerritoriesFile>(snap);
        const node = doc.main?.[locale]?.localeDisplayNames?.territories ?? {};
        for (const [code, name] of Object.entries(node)) {
          // CLDR keys include UN M49 numeric regions ("015" = Northern Africa)
          // and "-alt-" variants ("CD-alt-variant" = "Congo (DRC)"). Only plain
          // alpha-2 keys are countries.
          if (!/^[A-Z]{2}$/.test(code)) continue;
          const entry = territories.get(code) ?? {};
          entry[locale] = name;
          territories.set(code, entry);
        }
      } catch (err) {
        ctx.log.warn(`cldr: could not parse ${locale} territories (${(err as Error).message})`);
      }
    }

    const currencySymbols = new Map<string, string>();
    const curSnap = snapshots.find((s) => s.artifact === 'currencies-en.json');
    if (curSnap) {
      try {
        const doc = await readSnapshotJson<CurrenciesFile>(curSnap);
        const node = doc.main?.en?.numbers?.currencies ?? {};
        for (const [code, v] of Object.entries(node)) {
          if (v.symbol) currencySymbols.set(code, v.symbol);
        }
      } catch (err) {
        ctx.log.warn(`cldr: could not parse currency symbols (${(err as Error).message})`);
      }
    }

    const subdivisions = new Map<string, string>();
    const subSnap = snapshots.find((s) => s.artifact === 'subdivisions-en.json');
    if (subSnap) {
      try {
        const doc = await readSnapshotJson<SubdivisionsFile>(subSnap);
        const node =
          doc.subdivisions?.localeDisplayNames?.subdivisions ??
          doc.main?.en?.localeDisplayNames?.subdivisions ??
          {};
        // Keys arrive as "ad02" / "gbeng": lowercased ISO 3166-2 with the
        // hyphen dropped, which is the form the resolver looks them up by.
        for (const [key, name] of Object.entries(node)) subdivisions.set(key.toLowerCase(), name);
      } catch (err) {
        ctx.log.warn(`cldr: could not parse subdivisions (${(err as Error).message})`);
      }
    }

    const version =
      snapshots.find((s) => s.artifact === 'territories-en.json')?.version ??
      new Date().toISOString().slice(0, 10);

    ctx.log.debug(
      `cldr: ${territories.size} territories across ${DEFAULT_LOCALES.length} locales, ` +
        `${subdivisions.size} subdivision names (en), ${currencySymbols.size} currency symbols`
    );

    return { version, territories, subdivisions, currencySymbols };
  }
};

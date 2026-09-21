/**
 * SIX Group — the ISO 4217 register.
 *
 * SIX is the maintenance agency for ISO 4217 and publishes the official lists
 * as XML with no key, no auth and no rate limit. This is the source of truth
 * for which currency a country uses, and it is the direct fix for issue #236:
 * `list-one.xml` carries `Pblshd="2026-01-01"` and says
 *
 *     <CcyNtry><CtryNm>BULGARIA</CtryNm><CcyNm>Euro</CcyNm>
 *       <Ccy>EUR</Ccy><CcyNbr>978</CcyNbr><CcyMnrUnts>2</CcyMnrUnts></CcyNtry>
 *
 * while GeoNames still reports BGN. The `Pblshd` attribute is also the change
 * trigger DETECT diffs on, so the next changeover raises an anomaly by itself
 * instead of waiting for a bug report.
 *
 * Two shapes the parser has to handle that a naive reader gets wrong:
 *
 *   - Entries with no <Ccy> at all. Antarctica and Palestine are listed as
 *     "No universal currency". They are entities without a currency, not
 *     parse errors.
 *
 *   - Multiple currencies per entity. 280 rows cover 261 entities; 14 have more
 *     than one, and several of those are funds codes (CLF, MXV, USN, CHE/CHW)
 *     rather than circulating cash. Funds are marked and never chosen as the
 *     primary.
 */

import { XMLParser } from 'fast-xml-parser';
import { fold } from '../../../src/serving/normalize.ts';
import { fetchArtifact, readSnapshotText } from '../snapshot/store.ts';
import type {
  CurrencyLink,
  FetchContext,
  ResolvedCurrency,
  Snapshot,
  SourceAdapter
} from '../types.ts';

// The triple-r in "iso-currrency" is genuinely part of the upstream path.
const BASE =
  'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists';

/**
 * Funds codes: units of account rather than money you can hold. Never primary.
 * Identified by ISO's own convention that they occupy the X-series alongside
 * the entity's real currency.
 */
const FUND_CODES = new Set([
  'BOV',
  'CHE',
  'CHW',
  'CLF',
  'COU',
  'MXV',
  'USN',
  'UYI',
  'UYW',
  'XSU',
  'XUA',
  'XAU',
  'XAG',
  'XPD',
  'XPT',
  'XDR',
  'XBA',
  'XBB',
  'XBC',
  'XBD',
  'XTS',
  'XXX'
]);

export interface SixData {
  version: string;
  /** The register's own publication date; the change trigger for DETECT. */
  publishedAt: string;
  currencies: ResolvedCurrency[];
  /** Currency links keyed by SIX's own entity name, e.g. "BULGARIA". */
  entityLinks: Map<string, CurrencyLink[]>;
  /** Keyed by ISO alpha-2 once entity names have been matched to countries. */
  byCountryIso2: Map<string, CurrencyLink[]>;
  /** Entity names SIX uses that we could not match. Surfaced as anomalies. */
  unmatchedEntities: string[];
}

interface CcyNtry {
  CtryNm?: string;
  CcyNm?: string | { '#text'?: string };
  Ccy?: string;
  CcyNbr?: string | number;
  CcyMnrUnts?: string | number;
}

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    const t = (v as Record<string, unknown>)['#text'];
    return t === null || t === undefined ? null : String(t).trim();
  }
  const s = String(v).trim();
  return s || null;
};

/**
 * SIX entity names are SHOUTY and ISO-3166-*style* without being codes:
 * "BOLIVIA (PLURINATIONAL STATE OF)", "UNITED STATES OF AMERICA (THE)". They
 * have to be matched against country names by folding, with the parenthetical
 * and the trailing article removed.
 */
export function normaliseEntityName(name: string): string[] {
  const base = name.trim();
  const variants = new Set<string>([base]);

  // "UNITED STATES OF AMERICA (THE)" -> "UNITED STATES OF AMERICA"
  const noArticle = base.replace(/\s*\(THE\)\s*$/i, '').trim();
  if (noArticle) variants.add(noArticle);

  // "KOREA (THE REPUBLIC OF)" -> "KOREA, REPUBLIC OF", which is exactly ISO's
  // comma form. Without this both Koreas collapse to "KOREA" and neither gets
  // a currency, because the parenthetical is the only thing telling them apart.
  const commaForm = base.replace(/\s*\((?:THE\s+)?(.+?)\)\s*$/i, ', $1').trim();
  if (commaForm !== base) variants.add(commaForm);

  // Bare form, for entities whose parenthetical is genuinely incidental.
  const noParen = base.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (noParen) variants.add(noParen);

  return [...variants].map(fold).filter(Boolean);
}

export const six4217: SourceAdapter<SixData> = {
  id: 'six-4217',
  title: 'SIX Group — ISO 4217 register',
  cadence: 'republished on amendment; the Pblshd attribute is the change trigger',
  license: {
    spdx: 'LicenseRef-SIX-ISO4217',
    url: 'https://www.six-group.com/en/products-services/financial-information/data-standards.html',
    attribution: 'Currency data from the ISO 4217 Maintenance Agency (SIX Group).',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    const out: Snapshot[] = [];
    for (const artifact of ['list-one.xml', 'list-three.xml']) {
      out.push(
        await fetchArtifact({
          source: 'six-4217',
          artifact,
          url: `${BASE}/${artifact}`,
          offline: ctx.offline,
          log: ctx.log,
          // The SIX endpoint is reliable but slow; ~25 s is normal.
          timeoutMs: 180_000,
          versionFrom: (bytes) => {
            const head = new TextDecoder().decode(bytes.subarray(0, 512));
            return /Pblshd="([^"]+)"/.exec(head)?.[1];
          }
        })
      );
    }
    return out;
  },

  async parse(snapshots: Snapshot[], ctx: FetchContext): Promise<SixData> {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });

    const one = snapshots.find((s) => s.artifact === 'list-one.xml');
    if (!one) throw new Error('six-4217: missing list-one.xml');
    const doc = parser.parse(await readSnapshotText(one)) as {
      ISO_4217?: { '@Pblshd'?: string; CcyTbl?: { CcyNtry?: CcyNtry | CcyNtry[] } };
    };

    const publishedAt = doc.ISO_4217?.['@Pblshd'] ?? one.version;
    const raw = doc.ISO_4217?.CcyTbl?.CcyNtry ?? [];
    const entries = Array.isArray(raw) ? raw : [raw];

    const currencies = new Map<string, ResolvedCurrency>();
    const byEntity = new Map<string, CurrencyLink[]>();

    for (const e of entries) {
      const entity = text(e.CtryNm);
      const code = text(e.Ccy);
      if (!entity) continue;

      // "No universal currency" — a real state of affairs, not a parse failure.
      if (!code) continue;

      const name = text(e.CcyNm) ?? code;
      const minor = text(e.CcyMnrUnts);
      if (!currencies.has(code)) {
        currencies.set(code, {
          code,
          numericCode: text(e.CcyNbr),
          name,
          minorUnits: minor && /^\d+$/.test(minor) ? Number(minor) : null,
          symbol: null,
          isHistorical: false,
          withdrawnDate: null
        });
      }

      const list = byEntity.get(entity) ?? [];
      list.push({ code, isFund: FUND_CODES.has(code), isPrimary: false });
      byEntity.set(entity, list);
    }

    // The first non-fund currency for an entity is its primary. For the 14
    // multi-currency entities this picks the circulating one; for the rest it
    // is the only one.
    for (const list of byEntity.values()) {
      const primary = list.find((c) => !c.isFund) ?? list[0];
      if (primary) primary.isPrimary = true;
    }

    // list-three.xml is the historical register. Codes there are marked so a
    // client can still resolve BGN and be told when it was withdrawn.
    const three = snapshots.find((s) => s.artifact === 'list-three.xml');
    if (three) {
      try {
        const hist = parser.parse(await readSnapshotText(three)) as {
          ISO_4217?: { HstrcCcyTbl?: { HstrcCcyNtry?: unknown } };
        };
        const hraw = hist.ISO_4217?.HstrcCcyTbl?.HstrcCcyNtry ?? [];
        for (const h of (Array.isArray(hraw) ? hraw : [hraw]) as Array<
          CcyNtry & { WthdrwlDt?: string }
        >) {
          const code = text(h.Ccy);
          if (!code || currencies.has(code)) continue;
          currencies.set(code, {
            code,
            numericCode: text(h.CcyNbr),
            name: text(h.CcyNm) ?? code,
            minorUnits: null,
            symbol: null,
            isHistorical: true,
            withdrawnDate: text(h.WthdrwlDt)
          });
        }
      } catch (err) {
        ctx.log.warn(`six-4217: could not parse list-three.xml (${(err as Error).message})`);
      }
    }

    return {
      version: publishedAt,
      publishedAt,
      currencies: [...currencies.values()],
      entityLinks: byEntity,
      // Entity-name matching needs the country list, which the resolver has and
      // the adapter does not. linkToCountries() completes this map.
      byCountryIso2: new Map(),
      unmatchedEntities: [...byEntity.keys()]
    };
  }
};

/**
 * Match SIX entity names onto ISO alpha-2 codes.
 *
 * Called by the pipeline once countries are known. Anything left unmatched is
 * returned rather than dropped, so a renamed entity surfaces as an anomaly
 * instead of a country quietly losing its currency.
 */
export function linkToCountries(
  data: SixData,
  candidates: Array<{ iso2: string; names: string[] }>
): SixData {
  const index = new Map<string, string>();
  for (const c of candidates) {
    for (const n of c.names) {
      const f = fold(n);
      if (f && !index.has(f)) index.set(f, c.iso2);
    }
  }

  const byCountryIso2 = new Map<string, CurrencyLink[]>();
  const unmatched: string[] = [];

  for (const [entity, links] of data.entityLinks) {
    const iso2 = normaliseEntityName(entity)
      .map((f) => index.get(f))
      .find(Boolean);
    if (!iso2) {
      unmatched.push(entity);
      continue;
    }
    // An entity can appear more than once (multi-currency); merge rather than
    // overwrite, or the second row would silently drop the first.
    const existing = byCountryIso2.get(iso2) ?? [];
    for (const link of links) {
      if (!existing.some((e) => e.code === link.code)) existing.push(link);
    }
    byCountryIso2.set(iso2, existing);
  }

  return { ...data, byCountryIso2, unmatchedEntities: unmatched };
}

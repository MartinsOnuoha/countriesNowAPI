/** World Bank population with year; drop non-country aggregates. */

import { fetchArtifact, readSnapshotJson } from '../snapshot/store.ts';
import type { FetchContext, Snapshot, SourceAdapter } from '../types.ts';

const URL =
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL' +
  '?format=json&mrv=1&per_page=400';

export interface WorldBankPopulation {
  iso3: string;
  population: number;
  year: number;
}

export interface WorldBankData {
  version: string;
  byIso3: Map<string, WorldBankPopulation>;
  /** Aggregate rows we deliberately discarded, kept for the gate report. */
  droppedAggregates: string[];
}

type WbResponse = [
  { lastupdated?: string; total?: number } | null,
  Array<{
    countryiso3code?: string;
    country?: { id?: string; value?: string };
    date?: string;
    value?: number | null;
  }> | null
];

export const worldBank: SourceAdapter<WorldBankData> = {
  id: 'world-bank',
  title: 'World Bank Open Data (SP.POP.TOTL)',
  cadence: 'annual per indicator; the API is always on',
  license: {
    spdx: 'CC-BY-4.0',
    url: 'https://datacatalog.worldbank.org/public-licenses',
    attribution: 'Population data from the World Bank Open Data (CC BY 4.0).',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    return [
      await fetchArtifact({
        source: 'world-bank',
        artifact: 'population.json',
        url: URL,
        offline: ctx.offline,
        log: ctx.log,
        timeoutMs: 120_000,
        versionFrom: (bytes) => {
          try {
            const doc = JSON.parse(new TextDecoder().decode(bytes)) as WbResponse;
            return doc[0]?.lastupdated;
          } catch {
            return undefined;
          }
        }
      })
    ];
  },

  async parse(snapshots: Snapshot[], ctx: FetchContext): Promise<WorldBankData> {
    const snap = snapshots[0]!;
    const doc = await readSnapshotJson<WbResponse>(snap);
    const rows = doc[1] ?? [];

    const byIso3 = new Map<string, WorldBankPopulation>();
    const droppedAggregates: string[] = [];

    for (const row of rows) {
      const iso3 = row.countryiso3code?.trim().toUpperCase();
      const year = row.date ? Number(row.date) : NaN;
      if (!iso3 || iso3.length !== 3 || row.value == null || !Number.isFinite(year)) {
        if (row.country?.value) droppedAggregates.push(row.country.value);
        continue;
      }
      // Keep the most recent observation per country; `mrv=1` should already
      // guarantee one row each, but the API is not contractual about it.
      const existing = byIso3.get(iso3);
      if (!existing || existing.year < year) {
        byIso3.set(iso3, { iso3, population: row.value, year });
      }
    }

    ctx.log.debug(
      `world-bank: ${byIso3.size} population observations, ` +
        `${droppedAggregates.length} rows without a usable ISO3 skipped`
    );

    return { version: doc[0]?.lastupdated ?? snap.version, byIso3, droppedAggregates };
  }
};

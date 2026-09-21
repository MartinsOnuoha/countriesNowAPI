/** pull → resolve orchestration; policy lives elsewhere. */

import { mkdir } from 'node:fs/promises';
import { config } from './config.ts';
import type { FetchContext, Logger, ResolvedDataset, Snapshot, SourceAdapter } from './types.ts';

import { isoCodes, type IsoCodesData } from './sources/iso-codes.ts';
import { countryCodes, type CountryCodesData } from './sources/country-codes.ts';
import { geonames, type GeonamesData } from './sources/geonames.ts';
import { six4217, linkToCountries, type SixData } from './sources/six-4217.ts';
import { libphonenumber, type LibPhoneData } from './sources/libphonenumber.ts';
import { cldr, type CldrData } from './sources/cldr.ts';
import { flagIcons, buildFlagIndex, type FlagIconsData } from './sources/flag-icons.ts';
import { worldBank, type WorldBankData } from './sources/world-bank.ts';
import { resolveDataset } from './resolve/index.ts';

/** Every adapter, in the order `harness sources` lists them. */
export const ADAPTERS: SourceAdapter<unknown>[] = [
  isoCodes as SourceAdapter<unknown>,
  countryCodes as SourceAdapter<unknown>,
  geonames as SourceAdapter<unknown>,
  six4217 as SourceAdapter<unknown>,
  libphonenumber as SourceAdapter<unknown>,
  cldr as SourceAdapter<unknown>,
  flagIcons as SourceAdapter<unknown>,
  worldBank as SourceAdapter<unknown>
];

export interface PullResult {
  snapshots: Record<string, Snapshot[]>;
  failures: Array<{ source: string; error: string }>;
}

async function ensureDirs(): Promise<void> {
  await mkdir(config.snapshotDir, { recursive: true });
  await mkdir(config.artifactDir, { recursive: true });
  await mkdir(config.tmpDir, { recursive: true });
}

/** Failed source uses cache; tier-0 failure handled in resolve. */
export async function pull(log: Logger, offline = false): Promise<PullResult> {
  await ensureDirs();
  const ctx: FetchContext = { offline, dataDir: config.dataDir, log };

  const snapshots: Record<string, Snapshot[]> = {};
  const failures: Array<{ source: string; error: string }> = [];

  for (const adapter of ADAPTERS) {
    log.step(`${adapter.title} (${adapter.license.spdx})`);
    try {
      snapshots[adapter.id] = await adapter.fetch(ctx);
    } catch (err) {
      const message = (err as Error).message;
      log.error(`${adapter.id}: ${message}`);
      failures.push({ source: adapter.id, error: message });
    }
  }

  return { snapshots, failures };
}

export interface BuildOptions {
  log: Logger;
  offline?: boolean;
  version?: string;
}

/** Tier 0 required; tier 1 optional; gates decide publish. */
export async function build(options: BuildOptions): Promise<ResolvedDataset> {
  const { log } = options;
  const offline = options.offline ?? false;
  await ensureDirs();
  const ctx: FetchContext = { offline, dataDir: config.dataDir, log };

  const parseOne = async <T>(adapter: SourceAdapter<T>, required: boolean): Promise<T | null> => {
    try {
      const snaps = await adapter.fetch(ctx);
      return await adapter.parse(snaps, ctx);
    } catch (err) {
      const message = (err as Error).message;
      if (required) throw new Error(`${adapter.id} is required for a build: ${message}`);
      log.warn(`${adapter.id} unavailable, continuing without it: ${message}`);
      return null;
    }
  };

  log.step('Parsing sources');

  const iso = (await parseOne(isoCodes, true)) as IsoCodesData;
  log.info(
    `iso-codes: ${iso.countries.length} countries, ${iso.subdivisions.length} subdivisions, ` +
      `${iso.retired.length} retired codes, ${iso.currencies.length} currencies`
  );

  const cw = (await parseOne(countryCodes, true)) as CountryCodesData;
  log.info(`country-codes: ${cw.rows.length} crosswalk rows`);

  const geo = (await parseOne(geonames, true)) as GeonamesData;
  log.info(
    `geonames: ${geo.countries.length} countries, ${geo.admin1.length} admin1, ` +
      `${geo.places.length} places (${geo.places.filter((p) => p.isCity).length} cities) from ${geo.tier}`
  );

  let six = (await parseOne(six4217, false)) as SixData | null;
  const phone = (await parseOne(libphonenumber, false)) as LibPhoneData | null;
  const cldrData = (await parseOne(cldr, false)) as CldrData | null;
  await parseOne(flagIcons, false);
  const wb = (await parseOne(worldBank, false)) as WorldBankData | null;

  // Flags are derived from the code list rather than fetched per country.
  const flags: FlagIconsData = buildFlagIndex(iso.countries.map((c) => c.alpha_2));

  // SIX identifies entities by name, so linking needs the country names, which
  // only exist once iso-codes and the crosswalk are parsed.
  if (six) {
    const candidates = iso.countries.map((c) => ({
      iso2: c.alpha_2.toUpperCase(),
      names: [c.name, c.official_name, c.common_name].filter(Boolean) as string[]
    }));
    for (const row of cw.rows) {
      const hit = candidates.find((c) => c.iso2 === row.iso2);
      if (hit) {
        for (const n of [row.officialNameEn, row.cldrDisplayName]) if (n) hit.names.push(n);
      }
    }
    six = linkToCountries(six, candidates);
    log.info(
      `six-4217: published ${six.publishedAt}, ${six.currencies.length} currencies, ` +
        `${six.byCountryIso2.size} countries linked` +
        (six.unmatchedEntities.length
          ? `, ${six.unmatchedEntities.length} entities unmatched`
          : '')
    );
  }
  if (phone) log.info(`libphonenumber: ${phone.byRegion.size} regions`);
  if (cldrData) log.info(`cldr: ${cldrData.territories.size} territories localized`);
  if (wb) log.info(`world-bank: ${wb.byIso3.size} population observations`);

  log.step('Resolving');

  const dataset = resolveDataset({
    isoCodes: iso,
    countryCodes: cw,
    geonames: geo,
    six: six ?? undefined,
    libphone: phone ?? undefined,
    cldr: cldrData ?? undefined,
    flags,
    worldBank: wb ?? undefined,
    log,
    version: options.version
  });

  log.info(
    `dataset ${dataset.version}: ${dataset.countries.length} countries, ` +
      `${dataset.subdivisions.length} subdivisions, ${dataset.places.length} places ` +
      `(${dataset.places.filter((p) => p.isCity).length} cities), ` +
      `${dataset.currencies.length} currencies, ${dataset.provenance.length} provenance rows`
  );

  const warnings = dataset.notes.filter((n) => n.level === 'warn');
  if (warnings.length > 0) {
    log.info(`${warnings.length} cross-source disagreements recorded for DETECT`);
  }

  return dataset;
}

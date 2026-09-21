/** Deterministic anomalies: resolver conflicts, gaps, release drift. */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.ts';
import type { Anomaly, AnomalySeverity, Logger, ResolvedDataset } from '../types.ts';

function fingerprint(kind: string, ref: string, field: string | null): string {
  return createHash('sha256').update(`${kind}|${ref}|${field ?? ''}`).digest('hex').slice(0, 16);
}

/** How much a country's population may move between releases before we ask. */
const POPULATION_DRIFT_THRESHOLD = 0.2;

/** POPULATION_AGREEMENT_TOLERANCE avoids noise between years/methods. */
const POPULATION_AGREEMENT_TOLERANCE = 0.1;

/** Filter cross-source noise before enqueueing anomalies. */
function isExplainable(field: string, a: string, b: string): boolean {
  const x = a.replace(/^"|"$/g, '').trim();
  const y = b.replace(/^"|"$/g, '').trim();

  if (field === 'population') {
    const na = Number(x);
    const nb = Number(y);
    if (Number.isFinite(na) && Number.isFinite(nb) && na > 0 && nb > 0) {
      return Math.abs(na - nb) / Math.max(na, nb) <= POPULATION_AGREEMENT_TOLERANCE;
    }
    return false;
  }

  if (field === 'dialCode') {
    // "+1" versus "+1268" is the shared-root question, not a disagreement:
    // libphonenumber gives Antigua the full +1268 while flatter sources give
    // the NANP root. Both are correct at different granularities.
    const da = x.replace(/[^\d]/g, '');
    const db = y.replace(/[^\d]/g, '');
    return da.startsWith(db) || db.startsWith(da);
  }

  if (field === 'displayName' || field === 'commonName' || field === 'isoOfficialName') {
    // Name differences are almost always wording, not fact: "St. Barthélemy"
    // against "Saint Barthélemy". Only flag when the names share no prefix at
    // all, which catches genuine renames.
    const fa = x.toLowerCase().replace(/[^a-z]/g, '');
    const fb = y.toLowerCase().replace(/[^a-z]/g, '');
    if (fa === fb) return true;
    const shorter = fa.length < fb.length ? fa : fb;
    const longer = fa.length < fb.length ? fb : fa;
    return longer.includes(shorter) && shorter.length >= 4;
  }

  if (field === 'capital' || field === 'tld' || field === 'continentCode') {
    return x.toLowerCase().replace(/[^a-z]/g, '') === y.toLowerCase().replace(/[^a-z]/g, '');
  }

  return false;
}

export async function detect(dataset: ResolvedDataset, log: Logger): Promise<Anomaly[]> {
  const out: Anomaly[] = [];

  const add = (
    kind: string,
    entityType: Anomaly['entityType'],
    ref: string,
    field: string | null,
    severity: AnomalySeverity,
    summary: string,
    observed: unknown,
    expected: unknown,
    sources: Record<string, unknown> = {}
  ) => {
    out.push({
      fingerprint: fingerprint(kind, ref, field),
      kind,
      entityType,
      entityRef: ref,
      field,
      severity,
      summary,
      observed,
      expected,
      sources
    });
  };

  /* ---------------------------------------------------------------------- */
  /* 1. Cross-source contradictions surfaced by the resolver                 */
  /* ---------------------------------------------------------------------- */

  let explained = 0;

  for (const note of dataset.notes) {
    if (note.level !== 'warn') continue;
    const match = /^(\w+)\.(\w+): (\w[\w-]*) says (.+), ([\w-]+) says (.+)$/.exec(note.message);
    if (!match) continue;

    const [, entityType, field, winner, winnerValue, loser, loserValue] = match;

    if (isExplainable(field!, winnerValue!, loserValue!)) {
      explained++;
      continue;
    }

    add(
      'source-contradiction',
      entityType as Anomaly['entityType'],
      note.entityRef ?? 'unknown',
      field ?? null,
      // A currency disagreement is how issue #236 would have been caught
      // automatically, so it outranks a cosmetic name difference.
      field === 'primaryCurrency' || field === 'currencies' ? 'high' : 'medium',
      `${entityType}.${field}: sources disagree`,
      { source: winner, value: winnerValue },
      { source: loser, value: loserValue },
      { [winner!]: winnerValue, [loser!]: loserValue }
    );
  }

  if (explained > 0) {
    log.debug(`${explained} cross-source differences suppressed as modelling artefacts`);
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Structural gaps                                                      */
  /* ---------------------------------------------------------------------- */

  for (const c of dataset.countries) {
    if (c.currencies.length === 0 && c.isoAssigned) {
      // Antarctica and Palestine genuinely have no universal currency in the
      // ISO register, so this is a question rather than an error.
      add(
        'missing-currency',
        'country',
        c.iso2,
        'currencies',
        'medium',
        `${c.displayName} has no currency`,
        null,
        'at least one ISO 4217 code, or confirmation that none applies',
        { 'six-4217': 'no entry matched this country' }
      );
    }

    if (!c.dialCode) {
      add(
        'missing-dial-code',
        'country',
        c.iso2,
        'dialCode',
        'low',
        `${c.displayName} has no dial code`,
        null,
        'an E.164 calling code',
        {}
      );
    }

    if (c.population === null) {
      add(
        'missing-population',
        'country',
        c.iso2,
        'population',
        'low',
        `${c.displayName} has no population figure`,
        null,
        'a dated population estimate',
        {}
      );
    }

    const locales = new Set(c.names.filter((n) => n.locale !== 'und').map((n) => n.locale));
    if (locales.size < 3) {
      add(
        'thin-localization',
        'country',
        c.iso2,
        'names',
        'low',
        `${c.displayName} is localized into only ${locales.size} locales`,
        [...locales],
        'at least 3 locales',
        {}
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 3. Countries with no subdivisions or no cities                          */
  /* ---------------------------------------------------------------------- */

  const subsByCountry = new Map<string, number>();
  for (const s of dataset.subdivisions) {
    subsByCountry.set(s.countryIso2, (subsByCountry.get(s.countryIso2) ?? 0) + 1);
  }
  const citiesByCountry = new Map<string, number>();
  for (const p of dataset.places) {
    if (p.isCity) citiesByCountry.set(p.countryIso2, (citiesByCountry.get(p.countryIso2) ?? 0) + 1);
  }

  for (const c of dataset.countries) {
    if (!subsByCountry.has(c.iso2)) {
      // Many microstates legitimately have none, so this is informational.
      add(
        'no-subdivisions',
        'country',
        c.iso2,
        null,
        'low',
        `${c.displayName} has no subdivisions`,
        0,
        'ISO 3166-2 entries, or confirmation the country has none',
        {}
      );
    }
    if (!citiesByCountry.has(c.iso2)) {
      add(
        'no-cities',
        'country',
        c.iso2,
        null,
        'medium',
        `${c.displayName} has no cities`,
        0,
        'at least one populated place',
        { geonames: `tier ${config.geonamesTier} contains no qualifying place` }
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 4. Drift against the previous release                                   */
  /* ---------------------------------------------------------------------- */

  const previous = await loadPreviousDataset(dataset.version);
  if (previous) {
    log.debug(`comparing against previous release ${previous.version}`);

    const prevByIso2 = new Map(previous.countries.map((c) => [c.iso2, c]));
    const currentCodes = new Set(dataset.countries.map((c) => c.iso2));

    for (const prev of previous.countries) {
      if (!currentCodes.has(prev.iso2)) {
        add(
          'country-disappeared',
          'country',
          prev.iso2,
          null,
          'critical',
          `${prev.displayName} was in ${previous.version} but is gone`,
          null,
          prev.displayName,
          {}
        );
      }
    }

    for (const c of dataset.countries) {
      const prev = prevByIso2.get(c.iso2);
      if (!prev) {
        add(
          'country-appeared',
          'country',
          c.iso2,
          null,
          'high',
          `${c.displayName} is new since ${previous.version}`,
          c.displayName,
          null,
          {}
        );
        continue;
      }

      if (prev.primaryCurrency && c.primaryCurrency !== prev.primaryCurrency) {
        add(
          'currency-changed',
          'country',
          c.iso2,
          'primaryCurrency',
          'high',
          `${c.displayName} changed currency from ${prev.primaryCurrency} to ${c.primaryCurrency}`,
          c.primaryCurrency,
          prev.primaryCurrency,
          { previous: previous.version }
        );
      }

      if (prev.displayName !== c.displayName) {
        add(
          'name-changed',
          'country',
          c.iso2,
          'displayName',
          'medium',
          `${c.iso2} renamed from "${prev.displayName}" to "${c.displayName}"`,
          c.displayName,
          prev.displayName,
          { previous: previous.version }
        );
      }

      if (prev.population && c.population) {
        const drift = Math.abs(c.population - prev.population) / prev.population;
        if (drift > POPULATION_DRIFT_THRESHOLD) {
          add(
            'population-jump',
            'country',
            c.iso2,
            'population',
            'high',
            `${c.displayName} population moved ${(drift * 100).toFixed(0)}%`,
            c.population,
            prev.population,
            { previous: previous.version }
          );
        }
      }
    }
  } else {
    log.debug('no previous release on disk; drift rules skipped');
  }

  // Dedupe anomalies by fingerprint; merge source evidence.
  const unique = new Map<string, Anomaly>();
  for (const a of out) {
    const existing = unique.get(a.fingerprint);
    if (!existing) {
      unique.set(a.fingerprint, a);
      continue;
    }
    // Merge the extra source evidence into the surviving copy.
    existing.sources = { ...existing.sources, ...a.sources };
  }

  const deduped = [...unique.values()];
  const bySeverity = (s: AnomalySeverity) => deduped.filter((a) => a.severity === s).length;
  log.info(
    `${deduped.length} anomalies: ${bySeverity('critical')} critical, ${bySeverity('high')} high, ` +
      `${bySeverity('medium')} medium, ${bySeverity('low')} low`
  );

  return deduped;
}

/** Previous release on disk, if any (skipped on first run). */
async function loadPreviousDataset(currentVersion: string): Promise<ResolvedDataset | null> {
  const path = join(config.artifactDir, 'dataset.previous.json');
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as ResolvedDataset;
    return parsed.version === currentVersion ? null : parsed;
  } catch {
    return null;
  }
}

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export function formatAnomalies(anomalies: Anomaly[]): string {
  const colour = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code: string, s: string) => (colour ? `${code}${s}${RESET}` : s);

  if (anomalies.length === 0) return '\n  No anomalies.\n';

  const order: AnomalySeverity[] = ['critical', 'high', 'medium', 'low'];
  const lines: string[] = ['', `${anomalies.length} anomalies`, ''];

  for (const severity of order) {
    const group = anomalies.filter((a) => a.severity === severity);
    if (group.length === 0) continue;

    const label =
      severity === 'critical' || severity === 'high'
        ? c(RED, severity.toUpperCase())
        : severity === 'medium'
          ? c(YELLOW, severity)
          : c(DIM, severity);

    lines.push(`  ${label} (${group.length})`);
    for (const a of group.slice(0, 12)) {
      lines.push(`    ${a.entityRef.padEnd(8)} ${a.summary}`);
    }
    if (group.length > 12) lines.push(`    ${c(DIM, `... and ${group.length - 12} more`)}`);
    lines.push('');
  }

  return lines.join('\n');
}

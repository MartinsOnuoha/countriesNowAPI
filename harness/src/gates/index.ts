/** Run invariants on candidate dataset; agent boundary. */

import type { GateReport, GateResult, Invariant, Logger, ResolvedDataset } from '../types.ts';
import { INVARIANTS } from './invariants.ts';

export { INVARIANTS };

export async function runGates(
  dataset: ResolvedDataset,
  log: Logger,
  invariants: Invariant[] = INVARIANTS
): Promise<GateReport> {
  const byIso2 = new Map(dataset.countries.map((c) => [c.iso2, c]));
  const ctx = { dataset, byIso2 };

  log.step(`Running ${invariants.length} invariants against ${dataset.version}`);

  const results: GateResult[] = [];

  for (const inv of invariants) {
    const started = performance.now();
    let violations;
    try {
      violations = await inv.check(ctx);
    } catch (err) {
      // A rule that throws is a failed rule, not a crashed pipeline — otherwise
      // one bad invariant blocks every release.
      violations = [{ detail: `invariant threw: ${(err as Error).message}` }];
    }
    results.push({
      id: inv.id,
      title: inv.title,
      severity: inv.severity,
      issue: inv.issue,
      passed: violations.length === 0,
      violations,
      durationMs: performance.now() - started
    });
  }

  const errors = results.filter((r) => !r.passed && r.severity === 'error').length;
  const warnings = results.filter((r) => !r.passed && r.severity === 'warn').length;

  return {
    datasetVersion: dataset.version,
    ranAt: new Date().toISOString(),
    passed: errors === 0,
    errors,
    warnings,
    results
  };
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export function formatGateReport(report: GateReport): string {
  const colour = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code: string, s: string) => (colour ? `${code}${s}${RESET}` : s);

  const lines: string[] = ['', `Gate report — dataset ${report.datasetVersion}`, ''];

  for (const r of report.results) {
    const mark = r.passed
      ? c(GREEN, 'pass')
      : r.severity === 'error'
        ? c(RED, 'FAIL')
        : c(YELLOW, 'warn');
    const issue = r.issue ? c(DIM, ` ${r.issue}`) : '';
    lines.push(`  ${mark}  ${r.title}${issue}`);

    if (!r.passed) {
      for (const v of r.violations.slice(0, 8)) {
        const ref = v.entityRef ? `${v.entityRef}: ` : '';
        lines.push(`        ${c(DIM, `${ref}${v.detail}`)}`);
      }
      if (r.violations.length > 8) {
        lines.push(`        ${c(DIM, `... and ${r.violations.length - 8} more`)}`);
      }
    }
  }

  const passed = report.results.filter((r) => r.passed).length;
  lines.push(
    '',
    `  ${passed}/${report.results.length} passed` +
      (report.errors ? c(RED, `, ${report.errors} blocking`) : '') +
      (report.warnings ? c(YELLOW, `, ${report.warnings} warnings`) : ''),
    ''
  );

  return lines.join('\n');
}

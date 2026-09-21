#!/usr/bin/env bun
/**
 * countriesnow-harness.
 *
 * Every stage is a separate subcommand that reads and writes files, so any of
 * them can be run in isolation, inspected, and re-run. That is deliberate: a
 * pipeline whose intermediate state you cannot look at is a pipeline you cannot
 * trust to change your data.
 */

import { agentEnabled, config, createLogger, formatBytes } from './config.ts';
import { ADAPTERS, build, pull } from './pipeline.ts';
import { publish } from './publish/artifact.ts';
import { runGates, formatGateReport } from './gates/index.ts';
import { detect, formatAnomalies } from './detect/index.ts';
import { formatProposalsAsMarkdown, propose } from './agent/index.ts';
import { openProposalPullRequest } from './agent/pr.ts';
import { runBenchmark, formatBenchmark } from './bench/index.ts';
import { QUARANTINED_SOURCES } from './types.ts';

const USAGE = `
countriesnow-harness — the curation pipeline for CountriesNow V2

  bun run harness <command> [options]

Commands
  sources            List every upstream, its licence and cadence
  pull               Fetch all upstreams into the content-addressed store
  resolve            Parse and merge into a dataset; writes data/artifacts/dataset.json
  publish            Compile the dataset into the immutable SQLite artifact
  detect             Diff sources and apply contradiction rules; emits anomalies
  propose            Run the agent over open anomalies (needs HARNESS_API_KEY)
  gate               Run the invariant suite against the current artifact
  bench              Measure serving latency against the current artifact
  dataset-version    Print the resolved dataset version and exit
  all                pull -> resolve -> publish -> gate

Options
  --offline          Use cached snapshots only; never touch the network
  --version <v>      Override the dataset version (default: calendar-based)
  --verbose          Show per-source detail
  --ci               Machine-readable output, non-zero exit on failure
  --json             Emit JSON instead of formatted text
  --limit <n>        Cap the number of anomalies the agent considers
  --dry-run          Run every agent stage but do not open a pull request
`;

/**
 * Write to stdout and wait for it to land.
 *
 * `console.log` of a multi-megabyte anomaly list into a pipe does not finish
 * before the process does, and the redirect silently produces truncated JSON.
 * Awaiting the write is the difference between a valid file and one that only
 * fails later, somewhere else.
 */
async function emit(text: string): Promise<void> {
  await Bun.write(Bun.stdout, `${text}\n`);
}

interface Args {
  command: string;
  offline: boolean;
  verbose: boolean;
  ci: boolean;
  dryRun: boolean;
  json: boolean;
  version?: string;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    command: argv[0] ?? 'help',
    offline: argv.includes('--offline'),
    verbose: argv.includes('--verbose'),
    ci: argv.includes('--ci'),
    dryRun: argv.includes('--dry-run'),
    json: argv.includes('--json')
  };
  const vIdx = argv.indexOf('--version');
  if (vIdx >= 0 && argv[vIdx + 1]) out.version = argv[vIdx + 1];
  const lIdx = argv.indexOf('--limit');
  if (lIdx >= 0 && argv[lIdx + 1]) out.limit = Number(argv[lIdx + 1]);
  return out;
}

const DATASET_PATH = () => `${config.artifactDir}/dataset.json`;

async function loadDataset() {
  const file = Bun.file(DATASET_PATH());
  if (!(await file.exists())) {
    throw new Error(`no dataset at ${DATASET_PATH()}. Run \`bun run harness:resolve\` first.`);
  }
  return file.json();
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const log = createLogger(args.verbose);

  switch (args.command) {
    /* ---------------------------------------------------------------- */
    case 'sources': {
      console.log('\nUpstream sources\n');
      for (const a of ADAPTERS) {
        const quarantined = QUARANTINED_SOURCES.has(a.id) ? '  [QUARANTINED: ODbL]' : '';
        console.log(`  ${a.id.padEnd(16)} ${a.license.spdx.padEnd(22)} ${a.title}${quarantined}`);
        console.log(`  ${''.padEnd(16)} ${a.cadence}`);
        console.log(`  ${''.padEnd(16)} ${a.license.url}\n`);
      }
      console.log(
        'Sources marked QUARANTINED are share-alike. They may inform reconciliation\n' +
          'but never supply a published value. See harness/policy/precedence.yaml.\n'
      );
      return 0;
    }

    /* ---------------------------------------------------------------- */
    case 'pull': {
      const result = await pull(log, args.offline);
      const total = Object.values(result.snapshots).flat();
      const bytes = total.reduce((n, s) => n + s.bytes, 0);
      log.step(`Pulled ${total.length} artifacts, ${formatBytes(bytes)}`);
      if (result.failures.length > 0) {
        for (const f of result.failures) log.error(`${f.source}: ${f.error}`);
        return args.ci ? 1 : 0;
      }
      return 0;
    }

    /* ---------------------------------------------------------------- */
    case 'resolve': {
      const dataset = await build({ log, offline: args.offline, version: args.version });
      await Bun.write(DATASET_PATH(), JSON.stringify(dataset));
      log.step(`Wrote ${DATASET_PATH()}`);
      return 0;
    }

    /* ---------------------------------------------------------------- */
    case 'publish': {
      const dataset = await loadDataset();
      const result = await publish(dataset, log);
      log.step(`Published ${result.path}`);
      log.info(`${formatBytes(result.bytes)}, sha256 ${result.sha256.slice(0, 16)}`);
      for (const [k, v] of Object.entries(result.counts)) {
        log.info(`${k.padEnd(14)} ${v.toLocaleString()}`);
      }
      log.info(`built in ${(result.durationMs / 1000).toFixed(1)}s`);
      return 0;
    }

    /* ---------------------------------------------------------------- */
    // Bare version string on stdout, for shell substitution in CI.
    case 'dataset-version': {
      const dataset = await loadDataset();
      await emit(dataset.version);
      return 0;
    }

    /* ---------------------------------------------------------------- */
    case 'gate': {
      const dataset = await loadDataset();
      const report = await runGates(dataset, log);
      if (args.json) {
        await emit(JSON.stringify(report, null, 2));
      } else {
        await emit(formatGateReport(report));
      }
      await Bun.write(
        `${config.artifactDir}/gate-report.json`,
        `${JSON.stringify(report, null, 2)}\n`
      );
      return report.passed ? 0 : 1;
    }

    /* ---------------------------------------------------------------- */
    case 'detect': {
      const dataset = await loadDataset();
      const anomalies = await detect(dataset, log);
      await Bun.write(
        `${config.artifactDir}/anomalies.json`,
        `${JSON.stringify(anomalies, null, 2)}\n`
      );
      if (args.json) {
        await emit(JSON.stringify(anomalies, null, 2));
      } else {
        await emit(formatAnomalies(anomalies));
      }
      return 0;
    }

    /* ---------------------------------------------------------------- */
    case 'propose': {
      if (!agentEnabled()) {
        log.error(
          'HARNESS_API_KEY is not set. DETECT, gate and bench all work without it; ' +
            'only the hypothesize and verify stages need a model.'
        );
        return 1;
      }
      const dataset = await loadDataset();
      const anomalies = await detect(dataset, log);
      const proposals = await propose(anomalies, dataset, log, args.limit);

      const markdown = formatProposalsAsMarkdown(proposals, dataset.version);
      await Bun.write(
        `${config.artifactDir}/proposals.json`,
        `${JSON.stringify(proposals, null, 2)}\n`
      );
      await Bun.write(`${config.artifactDir}/proposals.md`, markdown);

      log.step(`${proposals.length} proposals survived verification and the gate`);
      for (const p of proposals) {
        log.info(`[${(p.confidence ?? 0).toFixed(2)}] ${p.claim}`);
      }

      // Opening the PR is the last step and deliberately separate: --dry-run
      // gives the full pipeline with nothing pushed, which is what you want the
      // first few times you change a prompt.
      if (args.dryRun) {
        log.info('dry run: no pull request opened');
        return 0;
      }

      const pr = await openProposalPullRequest(proposals, dataset.version, markdown, log);
      if (pr) log.step(`Pull request ${pr.url}`);
      return 0;
    }

    /* ---------------------------------------------------------------- */
    case 'bench': {
      const result = await runBenchmark(log);
      if (args.json) {
        await emit(JSON.stringify(result, null, 2));
      } else {
        await emit(formatBenchmark(result));
      }
      return result.passed ? 0 : args.ci ? 1 : 0;
    }

    /* ---------------------------------------------------------------- */
    case 'all': {
      await pull(log, args.offline);
      const dataset = await build({ log, offline: true, version: args.version });
      await Bun.write(DATASET_PATH(), JSON.stringify(dataset));
      const published = await publish(dataset, log);
      log.step(`Published ${formatBytes(published.bytes)} artifact`);
      const report = await runGates(dataset, log);
      await emit(formatGateReport(report));
      return report.passed ? 0 : 1;
    }

    /* ---------------------------------------------------------------- */
    default:
      console.log(USAGE);
      return args.command === 'help' || args.command === '--help' ? 0 : 1;
  }
}

// Setting exitCode rather than calling process.exit() so buffered stdout is
// flushed first. `harness detect --json > anomalies.json` on a large dataset
// loses its tail otherwise, and the resulting file is truncated JSON that only
// fails when something tries to read it.
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(`\n\x1b[31merror\x1b[0m ${(err as Error).message}`);
    if (process.argv.includes('--verbose')) console.error(err);
    process.exitCode = 1;
  });

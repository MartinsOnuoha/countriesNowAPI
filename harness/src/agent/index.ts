/** Agent pipeline: hypothesize → retrieve → verify → gate → proposals. */

import { config } from '../config.ts';
import type {
  Anomaly,
  EvidenceItem,
  GateReport,
  Logger,
  PatchOp,
  Proposal,
  ResolvedDataset
} from '../types.ts';
import { runGates } from '../gates/index.ts';
import { applyPatch, describePatch } from './apply.ts';
import { chat, parseJson } from './llm.ts';
import { retrieveEvidence } from './retrieve.ts';

/* -------------------------------------------------------------------------- */
/* HYPOTHESIZE                                                                 */
/* -------------------------------------------------------------------------- */

const HYPOTHESIZE_SYSTEM = `You triage data anomalies in a reference dataset of countries, subdivisions and cities.

For each anomaly you receive, propose at most one change, and only if you can state a FALSIFIABLE CLAIM about the real world that would justify it — something a specific document could confirm or contradict.

Good claim:  "Bulgaria adopted the euro on 2026-01-01, so its ISO 4217 code is EUR."
Bad claim:   "The value looks wrong." / "GeoNames is usually outdated."

If the anomaly has no real-world explanation you can name — it is a coverage gap, a modelling artefact, or you simply do not know — return needsChange: false. That is the expected answer most of the time and costs nothing. Guessing is expensive, because a wrong proposal consumes a reviewer's attention.

Never propose changing an identifier (iso2, iso3, geonamesId, wikidataQid). Those are keys.

Respond with JSON only:
{
  "needsChange": boolean,
  "claim": "the falsifiable statement, or empty",
  "rationale": "why you believe it",
  "field": "the field to change",
  "newValue": <the proposed value>,
  "priorConfidence": 0.0-1.0
}`;

interface Hypothesis {
  needsChange: boolean;
  claim: string;
  rationale: string;
  field?: string;
  newValue?: unknown;
  priorConfidence?: number;
}

/** Identifiers the agent may never touch. Enforced here, not just requested. */
const IMMUTABLE_FIELDS = new Set(['iso2', 'iso3', 'isoNumeric', 'geonamesId', 'wikidataQid', 'm49']);

async function hypothesize(
  anomaly: Anomaly,
  dataset: ResolvedDataset,
  log: Logger
): Promise<Hypothesis | null> {
  const country = dataset.countries.find((c) => c.iso2 === anomaly.entityRef);

  const prompt = [
    `Anomaly: ${anomaly.kind}`,
    `Entity: ${anomaly.entityType} ${anomaly.entityRef}${country ? ` (${country.displayName})` : ''}`,
    `Field: ${anomaly.field ?? '(none)'}`,
    `Summary: ${anomaly.summary}`,
    `Observed: ${JSON.stringify(anomaly.observed)}`,
    `Expected: ${JSON.stringify(anomaly.expected)}`,
    `Source values: ${JSON.stringify(anomaly.sources)}`,
    country ? `Current record: ${JSON.stringify(compactCountry(country))}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await chat({
      model: config.agent.hypothesisModel,
      json: true,
      maxTokens: 800,
      messages: [
        { role: 'system', content: HYPOTHESIZE_SYSTEM },
        { role: 'user', content: prompt }
      ]
    });
    return parseJson<Hypothesis>(res.content);
  } catch (err) {
    log.warn(`hypothesize failed for ${anomaly.entityRef}: ${(err as Error).message}`);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* VERIFY                                                                      */
/* -------------------------------------------------------------------------- */

const VERIFY_SYSTEM = `You are a skeptical reviewer. Your job is to REFUTE the proposed data change below, not to approve it.

Assume the proposal is wrong and look for the reason. Consider in order:

1. Does the evidence actually support the claim, or is it merely consistent with it?
2. Is any cited source primary (a maintenance agency, a regulator, a statistical office) rather than an aggregator repeating someone else?
3. Could the disagreement be a modelling difference rather than an error — different vintages, different definitions, one source counting something the other does not?
4. Does the evidence carry a date, and is that date after the value currently held?
5. Would the change break a documented policy? Membership follows ISO 3166-1. Currency follows the SIX ISO 4217 register. Cities exclude GeoNames PPLX and contained PPLA5.

Uphold the proposal ONLY if you cannot refute it and at least one primary source directly supports it. "The proposal is plausible" is a refutation, not an endorsement.

Respond with JSON only:
{
  "verdict": "upheld" | "refuted" | "inconclusive",
  "refutation": "the strongest argument against, even when upholding",
  "confidence": 0.0-1.0,
  "primarySourceCited": boolean,
  "citedUrl": "the single best supporting URL, or empty"
}`;

interface Verification {
  verdict: 'upheld' | 'refuted' | 'inconclusive';
  refutation: string;
  confidence: number;
  primarySourceCited: boolean;
  citedUrl?: string;
}

async function verify(
  anomaly: Anomaly,
  hypothesis: Hypothesis,
  evidence: Awaited<ReturnType<typeof retrieveEvidence>>,
  log: Logger
): Promise<Verification | null> {
  const prompt = [
    `Proposed change: ${anomaly.entityType} ${anomaly.entityRef}.${hypothesis.field} = ${JSON.stringify(hypothesis.newValue)}`,
    `Claim: ${hypothesis.claim}`,
    `Rationale: ${hypothesis.rationale}`,
    '',
    'Evidence retrieved:',
    ...evidence.map((e, i) => `  [${i + 1}] (${e.source}) ${e.excerpt}\n      ${e.url}`),
    evidence.length === 0 ? '  (none — retrieval returned nothing)' : ''
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await chat({
      model: config.agent.verifyModel,
      json: true,
      maxTokens: 1200,
      messages: [
        { role: 'system', content: VERIFY_SYSTEM },
        { role: 'user', content: prompt }
      ]
    });
    return parseJson<Verification>(res.content);
  } catch (err) {
    log.warn(`verify failed for ${anomaly.entityRef}: ${(err as Error).message}`);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* GATE                                                                        */
/* -------------------------------------------------------------------------- */

/** Gate patched dataset; reject if new invariant errors vs baseline. */
async function gateProposal(
  dataset: ResolvedDataset,
  patch: PatchOp[],
  baseline: Set<string>,
  log: Logger
): Promise<{ ok: true; report: GateReport } | { ok: false; reason: string }> {
  let candidate: ResolvedDataset;
  try {
    candidate = applyPatch(dataset, patch);
  } catch (err) {
    return { ok: false, reason: `patch did not apply — ${(err as Error).message}` };
  }

  const report = await runGates(candidate, silentLogger(log));

  // Ignore pre-existing invariant failures when judging a patch.
  const introduced = report.results
    .filter((r) => !r.passed && r.severity === 'error' && !baseline.has(r.id))
    .map((r) => r.title);

  if (introduced.length > 0) {
    return { ok: false, reason: `would break: ${introduced.join(', ')}` };
  }

  return { ok: true, report };
}

/** Which invariants are already failing, so a proposal is not blamed for them. */
function failingIds(report: GateReport): Set<string> {
  return new Set(report.results.filter((r) => !r.passed).map((r) => r.id));
}

/** Suppress gate step noise; errors still surface via report. */
function silentLogger(base: Logger): Logger {
  return {
    info: () => {},
    warn: () => {},
    debug: () => {},
    step: () => {},
    error: (msg, ...rest) => base.error(msg, ...rest)
  };
}

/* -------------------------------------------------------------------------- */
/* SHAPE                                                                       */
/* -------------------------------------------------------------------------- */

function shapePatch(anomaly: Anomaly, hypothesis: Hypothesis): PatchOp[] {
  const collection =
    anomaly.entityType === 'country'
      ? 'countries'
      : anomaly.entityType === 'subdivision'
        ? 'subdivisions'
        : 'places';

  return [
    {
      op: 'replace',
      path: `/${collection}/${anomaly.entityRef}/${hypothesis.field}`,
      value: hypothesis.newValue
    }
  ];
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                               */
/* -------------------------------------------------------------------------- */

/** Anomalies worth spending a model on, most consequential first. */
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export async function propose(
  anomalies: Anomaly[],
  dataset: ResolvedDataset,
  log: Logger,
  limit = config.agent.maxCandidates
): Promise<Proposal[]> {
  const queue = [...anomalies]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    // Skip low severity (usually coverage gaps).
    .filter((a) => a.severity !== 'low')
    .slice(0, limit);

  log.step(`HYPOTHESIZE — ${queue.length} anomalies via ${config.agent.hypothesisModel}`);

  const candidates: Array<{ anomaly: Anomaly; hypothesis: Hypothesis }> = [];
  for (const anomaly of queue) {
    const hypothesis = await hypothesize(anomaly, dataset, log);
    if (!hypothesis?.needsChange) continue;

    if (!hypothesis.claim?.trim()) {
      log.debug(`${anomaly.entityRef}: dropped, no falsifiable claim`);
      continue;
    }
    if (!hypothesis.field || IMMUTABLE_FIELDS.has(hypothesis.field)) {
      log.debug(`${anomaly.entityRef}: dropped, targets identifier ${hypothesis.field}`);
      continue;
    }
    candidates.push({ anomaly, hypothesis });
  }

  log.info(`${candidates.length} candidates carry a falsifiable claim`);

  log.step(`RETRIEVE — gathering evidence for ${candidates.length} candidates`);
  const withEvidence = [];
  for (const c of candidates) {
    withEvidence.push({ ...c, evidence: await retrieveEvidence(c.anomaly, dataset) });
  }

  log.step(`VERIFY — refutation pass via ${config.agent.verifyModel}`);

  const survivors: Array<{ anomaly: Anomaly; hypothesis: Hypothesis; evidence: EvidenceItem[] }> =
    [];
  let refuted = 0;
  let belowFloor = 0;
  const verdicts = new Map<string, Verification>();

  for (const c of withEvidence) {
    const verification = await verify(c.anomaly, c.hypothesis, c.evidence, log);
    if (!verification) continue;

    if (verification.verdict !== 'upheld') {
      refuted++;
      log.debug(`${c.anomaly.entityRef}: ${verification.verdict} — ${verification.refutation}`);
      continue;
    }
    if (verification.confidence < config.agent.minConfidence) {
      belowFloor++;
      log.debug(
        `${c.anomaly.entityRef}: upheld at ${verification.confidence.toFixed(2)}, below floor ${config.agent.minConfidence}`
      );
      continue;
    }
    // Reject upheld proposals without a primary source citation.
    if (!verification.primarySourceCited) {
      refuted++;
      log.debug(`${c.anomaly.entityRef}: upheld but no primary source cited`);
      continue;
    }

    verdicts.set(c.anomaly.fingerprint, verification);
    survivors.push(c);
  }

  log.info(
    `${survivors.length} upheld, ${refuted} refuted or unsourced, ${belowFloor} below the confidence floor`
  );

  /* ---- GATE ------------------------------------------------------------ */

  log.step(`GATE — applying ${survivors.length} patches to a candidate dataset`);

  const baseline = failingIds(await runGates(dataset, silentLogger(log)));

  const proposals: Proposal[] = [];
  let gateRejected = 0;

  for (const c of survivors) {
    const patch = shapePatch(c.anomaly, c.hypothesis);
    const gated = await gateProposal(dataset, patch, baseline, log);

    if (!gated.ok) {
      gateRejected++;
      log.debug(`${c.anomaly.entityRef}: rejected at the gate — ${gated.reason}`);
      continue;
    }

    const verification = verdicts.get(c.anomaly.fingerprint)!;
    proposals.push({
      anomalyFingerprint: c.anomaly.fingerprint,
      claim: c.hypothesis.claim,
      rationale: c.hypothesis.rationale,
      patch,
      evidence: c.evidence,
      verdict: verification.verdict,
      refutation: verification.refutation,
      confidence: verification.confidence,
      hypothesisModel: config.agent.hypothesisModel,
      verifyModel: config.agent.verifyModel,
      gatesPassed: gated.report.results.filter((r) => r.passed).length,
      gatesRun: gated.report.results.length
    });

    log.debug(`${c.anomaly.entityRef}: gated clean — ${describePatch(patch)}`);
  }

  log.info(
    `${proposals.length} proposals cleared every gate, ${gateRejected} rejected before review`
  );

  return proposals;
}

/** Trim a country to what a model needs, to keep prompts small and focused. */
function compactCountry(c: ResolvedDataset['countries'][number]) {
  return {
    iso2: c.iso2,
    iso3: c.iso3,
    displayName: c.displayName,
    isoOfficialName: c.isoOfficialName,
    primaryCurrency: c.primaryCurrency,
    currencies: c.currencies.map((x) => x.code),
    dialCode: c.dialCode,
    capital: c.capital,
    population: c.population,
    populationYear: c.populationYear
  };
}

/** PR body includes claim, evidence, refutation, gate scores. */
export function formatProposalsAsMarkdown(proposals: Proposal[], datasetVersion: string): string {
  if (proposals.length === 0) return '_No proposals survived verification._\n';

  const lines = [
    `## Data proposals for ${datasetVersion}`,
    '',
    `${proposals.length} change${proposals.length === 1 ? '' : 's'} survived the refutation pass.`,
    'Every one is a hypothesis that a stronger model tried and failed to disprove,',
    'and that passed the deterministic invariant gates. Review the evidence before merging.',
    ''
  ];

  for (const [i, p] of proposals.entries()) {
    const op = p.patch[0];
    lines.push(
      `### ${i + 1}. \`${op?.path ?? 'unknown'}\` → \`${JSON.stringify(op?.value)}\``,
      '',
      `**Claim.** ${p.claim}`,
      '',
      `**Rationale.** ${p.rationale}`,
      '',
      `**Strongest argument against** (from the verifier, which still upheld it): ${p.refutation}`,
      '',
      `**Confidence.** ${(p.confidence ?? 0).toFixed(2)} (floor ${config.agent.minConfidence})`,
      '',
      p.gatesRun
        ? `**Gates.** ${p.gatesPassed}/${p.gatesRun} passed with this patch applied, and it introduced no new failure.`
        : '**Gates.** not run',
      '',
      '**Evidence.**',
      '',
      '| Source | Excerpt | Retrieved |',
      '| --- | --- | --- |',
      ...(p.evidence.length > 0
        ? p.evidence.map(
            (e) =>
              `| [${e.source}](${e.url}) | ${e.excerpt.replace(/\|/g, '\\|')} | ${e.retrievedAt.slice(0, 10)} |`
          )
        : ['| _none_ | retrieval returned nothing | |']),
      '',
      '<details><summary>JSON Patch</summary>',
      '',
      '```json',
      JSON.stringify(p.patch, null, 2),
      '```',
      '',
      '</details>',
      ''
    );
  }

  return lines.join('\n');
}

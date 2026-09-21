/**
 * The agent pipeline end to end, with the two models and the network stubbed.
 *
 * What is worth testing here is not whether a model gives good answers — it is
 * whether a *bad* answer can reach a reviewer. Every drop rule in
 * HYPOTHESIZE -> RETRIEVE -> VERIFY -> GATE is a filter that only matters when
 * the model on the other side of it is wrong, so each one gets a model response
 * engineered to be wrong in precisely the way that filter exists to catch.
 *
 * The stub also keeps `bun test` offline and free. Running the real pipeline
 * needs HARNESS_API_KEY and is the curate workflow's job, not CI's.
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Anomaly, EvidenceItem, Logger, ResolvedDataset } from '../harness/src/types.ts';

/* -------------------------------------------------------------------------- */
/* Stubs                                                                       */
/* -------------------------------------------------------------------------- */

/** Queued model replies, consumed in order: hypothesize, then verify. */
let replies: string[] = [];
let calls: Array<{ model: string; system: string; user: string }> = [];

await mock.module('../harness/src/agent/llm.ts', () => ({
  chat: async (options: { model: string; messages: Array<{ role: string; content: string }> }) => {
    calls.push({
      model: options.model,
      system: options.messages[0]?.content ?? '',
      user: options.messages[1]?.content ?? ''
    });
    const content = replies.shift();
    if (content === undefined) throw new Error('stub exhausted: unexpected model call');
    return { content, model: options.model };
  },
  parseJson: <T,>(content: string): T | null => {
    try {
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }
}));

/** RETRIEVE hits Wikidata over SPARQL. Tests do not. */
const EVIDENCE: EvidenceItem[] = [
  {
    source: 'wikidata',
    url: 'https://www.wikidata.org/wiki/Q219',
    excerpt: 'currency: euro (P38), point in time 2026-01-01, stated in Council Decision',
    retrievedAt: '2026-08-07T00:00:00.000Z'
  }
];

await mock.module('../harness/src/agent/retrieve.ts', () => ({
  retrieveEvidence: async () => EVIDENCE,
  wikidataCurrency: async () => EVIDENCE,
  wikidataPopulation: async () => EVIDENCE,
  wikidataNames: async () => EVIDENCE
}));

// Imported after the mocks are registered so the module graph picks them up.
const { propose } = await import('../harness/src/agent/index.ts');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const silent: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  step: () => {}
};

let dataset: ResolvedDataset;

beforeAll(async () => {
  const path = join(process.cwd(), 'data', 'artifacts', 'dataset.json');
  dataset = JSON.parse(await readFile(path, 'utf8')) as ResolvedDataset;
});

afterAll(() => {
  mock.restore();
});

const anomaly = (over: Partial<Anomaly> = {}): Anomaly => ({
  fingerprint: 'test0000',
  kind: 'source-contradiction',
  entityType: 'country',
  entityRef: 'BG',
  field: 'primaryCurrency',
  severity: 'high',
  summary: 'six-4217 says EUR, geonames says BGN',
  observed: 'EUR',
  expected: 'agreement across sources',
  sources: { 'six-4217': 'EUR', geonames: 'BGN' },
  ...over
});

const hypothesis = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    needsChange: true,
    claim: 'Bulgaria adopted the euro on 2026-01-01.',
    rationale: 'The SIX ISO 4217 register lists EUR for Bulgaria.',
    field: 'primaryCurrency',
    newValue: 'EUR',
    priorConfidence: 0.9,
    ...over
  });

const verification = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    verdict: 'upheld',
    refutation: 'The register could lag, but its Pblshd date is after the change.',
    confidence: 0.95,
    primarySourceCited: true,
    citedUrl: 'https://www.six-group.com/dam/download/financial-information/list-one.xml',
    ...over
  });

/** Run the pipeline over a single anomaly with a scripted pair of replies. */
async function run(queued: string[], a: Anomaly = anomaly()) {
  replies = queued;
  calls = [];
  return propose([a], dataset, silent, 10);
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe('a clean run', () => {
  test('produces a proposal carrying its claim, evidence and gate result', async () => {
    // Bulgaria already holds EUR, so this is a no-op patch that clears the
    // gate — the point is the shape of what comes out, not the change.
    const proposals = await run([hypothesis(), verification()]);

    expect(proposals).toHaveLength(1);
    const p = proposals[0]!;
    expect(p.anomalyFingerprint).toBe('test0000');
    expect(p.claim).toContain('euro');
    expect(p.confidence).toBe(0.95);
    expect(p.patch).toEqual([
      { op: 'replace', path: '/countries/BG/primaryCurrency', value: 'EUR' }
    ]);
    expect(p.evidence).toHaveLength(1);
    expect(p.gatesRun).toBeGreaterThan(0);
    expect(p.gatesPassed).toBe(p.gatesRun);
  });

  test('the cheap model triages and the strong model is told to refute', async () => {
    await run([hypothesis(), verification()]);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.system).toContain('FALSIFIABLE CLAIM');
    expect(calls[1]!.system).toContain('REFUTE');
    // The verifier must see the evidence, not just the claim.
    expect(calls[1]!.user).toContain('wikidata.org/wiki/Q219');
  });
});

describe('HYPOTHESIZE drops what cannot be checked', () => {
  test('needsChange: false costs nothing downstream', async () => {
    const proposals = await run([hypothesis({ needsChange: false })]);
    expect(proposals).toEqual([]);
    // Never reached the expensive model.
    expect(calls).toHaveLength(1);
  });

  test('an empty claim is dropped even when the model wants the change', async () => {
    const proposals = await run([hypothesis({ claim: '   ' })]);
    expect(proposals).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  test('a proposal targeting an identifier is refused in code, not in the prompt', async () => {
    for (const field of ['iso2', 'iso3', 'geonamesId', 'wikidataQid', 'm49']) {
      const proposals = await run([hypothesis({ field, newValue: 'XX' })]);
      expect(proposals, field).toEqual([]);
    }
  });

  test('a malformed model response drops one candidate, not the run', async () => {
    const proposals = await run(['not json at all']);
    expect(proposals).toEqual([]);
  });
});

describe('VERIFY is a filter, not a formality', () => {
  test('a refuted proposal never reaches a human', async () => {
    const proposals = await run([
      hypothesis(),
      verification({ verdict: 'refuted', refutation: 'The register predates the change.' })
    ]);
    expect(proposals).toEqual([]);
  });

  test('inconclusive is not upheld', async () => {
    const proposals = await run([hypothesis(), verification({ verdict: 'inconclusive' })]);
    expect(proposals).toEqual([]);
  });

  test('an upheld proposal below the confidence floor is dropped', async () => {
    const proposals = await run([hypothesis(), verification({ confidence: 0.2 })]);
    expect(proposals).toEqual([]);
  });

  test('upheld with no primary source is exactly the case this exists to catch', async () => {
    const proposals = await run([
      hypothesis(),
      verification({ primarySourceCited: false, confidence: 0.99 })
    ]);
    expect(proposals).toEqual([]);
  });
});

describe('GATE overrides both models', () => {
  test('a confident, sourced, upheld proposal that breaks an invariant is rejected', async () => {
    // #236 in reverse. Both models agree, the verifier is at 0.99, and it is
    // still wrong — the invariant suite is the only thing that knows.
    const proposals = await run([
      hypothesis({ newValue: 'BGN', claim: 'Bulgaria still uses the lev.' }),
      verification({ confidence: 0.99 })
    ]);
    expect(proposals).toEqual([]);
  });

  test('a patch that does not apply is rejected rather than thrown', async () => {
    const proposals = await run(
      [hypothesis({ field: 'noSuchField', newValue: 1 }), verification()],
      anomaly({ entityRef: 'BG' })
    );
    expect(proposals).toEqual([]);
  });

  test('an unknown entity is rejected at the gate', async () => {
    const proposals = await run(
      [hypothesis({ field: 'capital', newValue: 'Nowhere' }), verification()],
      anomaly({ entityRef: 'ZZ' })
    );
    expect(proposals).toEqual([]);
  });
});

describe('queue policy', () => {
  test('low-severity anomalies are not worth a model call', async () => {
    replies = [];
    calls = [];
    const proposals = await propose([anomaly({ severity: 'low' })], dataset, silent, 10);
    expect(proposals).toEqual([]);
    expect(calls).toEqual([]);
  });

  test('the queue is capped and the most severe go first', async () => {
    replies = [hypothesis({ needsChange: false })];
    calls = [];
    await propose(
      [
        anomaly({ fingerprint: 'a', severity: 'medium' }),
        anomaly({ fingerprint: 'b', severity: 'critical', summary: 'critical one' })
      ],
      dataset,
      silent,
      1
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.user).toContain('critical one');
  });
});

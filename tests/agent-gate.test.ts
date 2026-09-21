/**
 * The agent's safety boundary.
 *
 * Everything upstream of this point is a model making a judgement call. These
 * tests cover the parts that are not: the patch applier, which must refuse
 * anything it does not understand rather than guessing, and the invariant gate,
 * which must reject a change that breaks a rule no matter how confident the
 * verifier was.
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyPatch, describePatch, PatchError } from '../harness/src/agent/apply.ts';
import { runGates } from '../harness/src/gates/index.ts';
import type { Logger, PatchOp, ResolvedDataset } from '../harness/src/types.ts';

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

const patch = (path: string, value: unknown, op: PatchOp['op'] = 'replace'): PatchOp[] => [
  { op, path, value }
];

describe('applyPatch', () => {
  test('applies a change to the addressed row and nothing else', () => {
    const next = applyPatch(dataset, patch('/countries/BG/primaryCurrency', 'XTS'));

    const changed = next.countries.find((c) => c.iso2 === 'BG')!;
    expect(changed.primaryCurrency).toBe('XTS');

    // Every other country is untouched.
    for (const before of dataset.countries) {
      if (before.iso2 === 'BG') continue;
      const after = next.countries.find((c) => c.iso2 === before.iso2)!;
      expect(after.primaryCurrency, before.iso2).toBe(before.primaryCurrency);
    }
  });

  test('does not mutate the dataset it was given', () => {
    const before = dataset.countries.find((c) => c.iso2 === 'NG')!.capital;
    applyPatch(dataset, patch('/countries/NG/capital', 'Nowhere'));
    expect(dataset.countries.find((c) => c.iso2 === 'NG')!.capital).toBe(before);
  });

  test('addresses rows by stable key, not by array position', () => {
    // Reversing the array must not change what the patch hits. This is the
    // whole reason paths are keyed rather than indexed.
    const shuffled: ResolvedDataset = {
      ...structuredClone(dataset),
      countries: [...structuredClone(dataset).countries].reverse()
    };
    const next = applyPatch(shuffled, patch('/countries/BG/primaryCurrency', 'XTS'));
    expect(next.countries.find((c) => c.iso2 === 'BG')!.primaryCurrency).toBe('XTS');
  });

  test('rejects a path it cannot resolve rather than creating anything', () => {
    const bad: Array<[string, PatchOp[]]> = [
      ['unknown collection', patch('/planets/EARTH/name', 'Earth')],
      ['unknown key', patch('/countries/ZZ/capital', 'Nowhere')],
      ['too few segments', patch('/countries/BG', 'x')],
      ['replace of a field that does not exist', patch('/countries/BG/madeUpField', 1)]
    ];
    for (const [why, ops] of bad) {
      expect(() => applyPatch(dataset, ops), why).toThrow(PatchError);
    }
  });

  test('all ops apply or none do', () => {
    const ops: PatchOp[] = [
      { op: 'replace', path: '/countries/BG/primaryCurrency', value: 'XTS' },
      { op: 'replace', path: '/countries/ZZ/capital', value: 'Nowhere' }
    ];
    expect(() => applyPatch(dataset, ops)).toThrow(PatchError);
    // The clone is discarded on throw, so the original is necessarily clean.
    expect(dataset.countries.find((c) => c.iso2 === 'BG')!.primaryCurrency).not.toBe('XTS');
  });

  test('describePatch reads as a change summary', () => {
    expect(describePatch(patch('/countries/BG/primaryCurrency', 'EUR'))).toBe(
      '/countries/BG/primaryCurrency → "EUR"'
    );
  });
});

describe('the gate rejects what the models might not', () => {
  test('the unpatched dataset passes every error-severity invariant', async () => {
    const report = await runGates(dataset, silent);
    const failed = report.results.filter((r) => !r.passed && r.severity === 'error');
    expect(failed.map((r) => r.title)).toEqual([]);
  });

  test('a patch that breaks an invariant is caught', async () => {
    // Bulgaria back to BGN is the #236 regression, and the invariant suite
    // encodes it explicitly. A confident verifier could still propose this.
    const candidate = applyPatch(dataset, patch('/countries/BG/primaryCurrency', 'BGN'));
    const report = await runGates(candidate, silent);
    expect(report.passed).toBe(false);
    expect(report.results.some((r) => !r.passed && r.issue?.includes('236'))).toBe(true);
  });

  test('a duplicate alpha-2 is caught', async () => {
    const candidate = structuredClone(dataset);
    // The Congo bug: two rows that cannot be told apart.
    candidate.countries.find((c) => c.iso2 === 'CD')!.iso2 = 'CG';
    const report = await runGates(candidate, silent);
    expect(report.passed).toBe(false);
  });

  test('a benign patch clears the gate', async () => {
    const candidate = applyPatch(
      dataset,
      patch('/countries/NG/capital', 'Abuja') // already the value; a no-op change
    );
    const report = await runGates(candidate, silent);
    expect(report.passed).toBe(true);
  });
});

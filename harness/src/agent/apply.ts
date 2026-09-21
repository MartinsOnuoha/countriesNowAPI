/**
 * Applying a proposal's JSON Patch to a candidate dataset.
 *
 * The patch paths are JSON Pointers keyed by a stable identifier rather than an
 * array index — `/countries/BG/primaryCurrency`, not `/countries/23/...` — so a
 * proposal written against yesterday's dataset still targets the right row
 * after the resolver reorders things. That costs a lookup here and buys
 * patches that do not silently hit the wrong country.
 *
 * Everything is applied to a deep clone. The gate needs to run invariants
 * against a dataset that includes the change without the change ever touching
 * the real one — if a patch fails its gate, the only trace it leaves is a log
 * line.
 */

import type { PatchOp, ResolvedDataset } from '../types.ts';

export class PatchError extends Error {
  constructor(
    readonly op: PatchOp,
    reason: string
  ) {
    super(`${op.op} ${op.path}: ${reason}`);
    this.name = 'PatchError';
  }
}

type Collection = 'countries' | 'subdivisions' | 'places' | 'currencies';

const KEY_OF: Record<Collection, (row: Record<string, unknown>) => string> = {
  countries: (r) => String(r.iso2),
  subdivisions: (r) => String(r.iso3166_2 ?? `${r.countryIso2}-${r.code}`),
  places: (r) => String(r.geonamesId),
  currencies: (r) => String(r.code)
};

/**
 * Apply every op, or none.
 *
 * A partially applied patch is worse than a rejected one: it produces a dataset
 * that matches no proposal and no upstream, which is exactly the state V1's
 * hand-edited data files were permanently in.
 */
export function applyPatch(dataset: ResolvedDataset, ops: PatchOp[]): ResolvedDataset {
  const next = structuredClone(dataset) as ResolvedDataset;

  for (const op of ops) {
    const segments = op.path.split('/').filter(Boolean);
    if (segments.length < 3) {
      throw new PatchError(op, 'expected /<collection>/<key>/<field>');
    }

    const [collection, key, ...fieldPath] = segments as [string, string, ...string[]];
    if (!(collection in KEY_OF)) throw new PatchError(op, `unknown collection "${collection}"`);

    const rows = next[collection as Collection] as unknown as Array<Record<string, unknown>>;
    const keyOf = KEY_OF[collection as Collection];
    const row = rows.find((r) => keyOf(r) === key);
    if (!row) throw new PatchError(op, `no ${collection} row with key "${key}"`);

    applyToRow(op, row, fieldPath);
  }

  return next;
}

function applyToRow(op: PatchOp, row: Record<string, unknown>, fieldPath: string[]): void {
  const leaf = fieldPath.at(-1)!;
  let target = row;

  for (const segment of fieldPath.slice(0, -1)) {
    const child = target[segment];
    if (child === null || typeof child !== 'object') {
      throw new PatchError(op, `"${segment}" is not a container`);
    }
    target = child as Record<string, unknown>;
  }

  switch (op.op) {
    case 'replace':
      // Replace means replace. Creating a field that was not there is `add`,
      // and conflating the two is how a typo'd path silently becomes a new key.
      if (!(leaf in target)) throw new PatchError(op, `field "${leaf}" does not exist`);
      target[leaf] = op.value;
      return;

    case 'add':
      target[leaf] = op.value;
      return;

    case 'remove':
      if (!(leaf in target)) throw new PatchError(op, `field "${leaf}" does not exist`);
      delete target[leaf];
      return;

    default:
      throw new PatchError(op, `unsupported op "${String(op.op)}"`);
  }
}

/** A one-line human summary of what a patch does, for logs and PR titles. */
export function describePatch(ops: PatchOp[]): string {
  return ops
    .map((o) =>
      o.op === 'remove' ? `remove ${o.path}` : `${o.path} → ${JSON.stringify(o.value)}`
    )
    .join('; ');
}

/**
 * Structural comparison for responses whose values legitimately changed.
 *
 * A shape is the recursive type skeleton of a value: objects become a sorted
 * map of key to shape, arrays become the union of their elements' shapes, and
 * scalars become their type name. Comparing shapes catches every kind of
 * contract break we care about — a renamed key, a value that turned from a
 * number into a string, an array that became an object — while ignoring the
 * corrected currency or the different population figure.
 */

export type Shape =
  | { kind: 'scalar'; type: string }
  | { kind: 'array'; of: Shape[] }
  | { kind: 'object'; fields: Record<string, Shape> };

export function shapeOf(value: unknown): Shape {
  if (Array.isArray(value)) {
    // Union the element shapes rather than sampling the first: V1 responses
    // are not always homogeneous, and a nullable field that happens to be set
    // in element 0 would otherwise be recorded as always-present.
    const seen: Shape[] = [];
    for (const item of value) {
      const s = shapeOf(item);
      if (!seen.some((existing) => shapesEqual(existing, s))) seen.push(s);
    }
    return { kind: 'array', of: seen };
  }

  if (value !== null && typeof value === 'object') {
    const fields: Record<string, Shape> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      fields[key] = shapeOf((value as Record<string, unknown>)[key]);
    }
    return { kind: 'object', fields };
  }

  // null is its own type here. A field that was null in the golden and a
  // string now is a widening, not a break, so nulls unify below.
  return { kind: 'scalar', type: value === null ? 'null' : typeof value };
}

function shapesEqual(a: Shape, b: Shape): boolean {
  return describeShapeDiff(a, b) === null;
}

/**
 * Returns null when `actual` satisfies `expected`, otherwise a human-readable
 * description of the first incompatibility.
 *
 * The relation is deliberately asymmetric in two places. A scalar that was
 * `null` in the golden accepts any type now, because V1 emitted null for
 * "unknown" and we may have filled it in. And an array's element shapes need
 * only be *compatible*, not identical, so a longer or shorter list passes.
 */
export function describeShapeDiff(expected: Shape, actual: Shape, path = '$'): string | null {
  if (expected.kind === 'scalar' && actual.kind === 'scalar') {
    if (expected.type === 'null' || actual.type === 'null') return null;
    if (expected.type !== actual.type) {
      return `${path}: expected ${expected.type}, got ${actual.type}`;
    }
    return null;
  }

  if (expected.kind !== actual.kind) {
    if (expected.kind === 'scalar' && expected.type === 'null') return null;
    return `${path}: expected ${expected.kind}, got ${actual.kind}`;
  }

  if (expected.kind === 'array' && actual.kind === 'array') {
    if (expected.of.length === 0 || actual.of.length === 0) return null;
    // Every shape we now emit must be satisfiable by some shape V1 emitted.
    for (const [i, a] of actual.of.entries()) {
      const compatible = expected.of.some((e) => describeShapeDiff(e, a) === null);
      if (!compatible) {
        const why = describeShapeDiff(expected.of[0]!, a, `${path}[${i}]`);
        return why ?? `${path}[${i}]: no compatible element shape in the golden`;
      }
    }
    return null;
  }

  if (expected.kind === 'object' && actual.kind === 'object') {
    for (const key of Object.keys(expected.fields)) {
      if (!(key in actual.fields)) return `${path}.${key}: missing from the response`;
      const why = describeShapeDiff(expected.fields[key]!, actual.fields[key]!, `${path}.${key}`);
      if (why) return why;
    }
    // Extra keys are additive and cannot break a client, so they pass.
    return null;
  }

  return null;
}

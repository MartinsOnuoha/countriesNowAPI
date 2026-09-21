/**
 * Tests read the same serving artifact the API does. If it has not been built
 * they fail loudly with the command to build it, rather than skipping quietly.
 */

import { findArtifact } from '../../src/serving/artifact.ts';

export function requireArtifact(): string {
  const path = findArtifact();
  if (!path) {
    throw new Error(
      'No serving artifact found under data/artifacts/.\n' +
        'Build one first:\n' +
        '  bun run harness:pull && bun run harness:resolve && bun run harness:publish'
    );
  }
  return path;
}

/** Startup opens embedded artifact only. */

import { createApp } from './app.ts';
import { getMeta, isReady } from './serving/artifact.ts';

const port = Number(process.env.PORT ?? 3000);
const app = createApp().listen(port);

if (isReady()) {
  const meta = getMeta();
  console.info(
    `CountriesNow v2 on :${port} — dataset ${meta.datasetVersion} ` +
      `(${(meta.bytes / 1024 / 1024).toFixed(1)} MB, built ${meta.builtAt.slice(0, 10)})`
  );
  console.info(`  docs      http://localhost:${port}/openapi`);
  console.info(`  v2        http://localhost:${port}/v2/countries`);
  console.info(`  legacy    http://localhost:${port}/v0.1/countries`);
} else {
  // Deliberately not fatal. The process stays up and /ready reports 503, so an
  // orchestrator can hold traffic back instead of crash-looping the container.
  console.warn(
    `CountriesNow v2 on :${port} — no serving artifact found; /ready will report 503.\n` +
      `  Build one with: bun run harness:pull && bun run harness:resolve && bun run harness:publish`
  );
}

const shutdown = (signal: string) => {
  console.info(`\n${signal} received, closing`);
  app.stop();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Deliberately no default export. Bun auto-serves a default-exported object
// that has a `fetch` method, and an Elysia instance has one — combined with the
// explicit `.listen()` above that binds the port twice and fails with
// EADDRINUSE. Tests import `createApp` from src/app.ts instead.
export { app };

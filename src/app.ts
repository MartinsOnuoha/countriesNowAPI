/**
 * The Elysia application.
 *
 * Separated from src/index.ts so tests can mount the app without binding a
 * port. Nothing here opens a socket.
 */

import cors from '@elysiajs/cors';
import openapi from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { v2 } from './api/v2/index.ts';
import { v01, v01Lookups } from './api/v01/index.ts';
import { ArtifactMissingError, getMeta, isReady } from './serving/artifact.ts';
import { ResolutionError } from './serving/resolve.ts';
import { InvalidCursorError } from './serving/queries.ts';

const CACHE_MAX_AGE = Number(process.env.CACHE_MAX_AGE ?? 86_400);

/**
 * HEAD counts. A cache that validates with HEAD and gets no ETag back has to
 * treat the entry as unvalidatable and refetch the body, which quietly turns
 * the cheapest request we serve into the most expensive one.
 */
const isCacheable = (method: string): boolean => method === 'GET' || method === 'HEAD';

export function createApp() {
  const app = new Elysia({ name: 'countriesnow' });

  return (
    app
      .use(cors())

      // Elysia routes HEAD separately from GET, so without this every HEAD is
      // a 404 — including the ones a CDN sends to revalidate. Re-dispatching as
      // GET and dropping the body is what RFC 9110 asks for, and it keeps the
      // ETag and Cache-Control identical to the GET they describe.
      //
      // Chaining mutates in place, so `app` here is the same instance the rest
      // of this builder returns.
      .onRequest(async ({ request }): Promise<Response | undefined> => {
        if (request.method !== 'HEAD') return undefined;

        const res = await app.handle(
          new Request(request.url, { method: 'GET', headers: request.headers })
        );
        return new Response(null, { status: res.status, headers: res.headers });
      })

      .use(
        openapi({
          // The plugin drops any path that looks like a static file, and
          // `/v0.1/countries` looks like one because of the dot in the version.
          // Without this the entire compatibility surface is undocumented.
          exclude: { staticFile: false },
          documentation: {
            info: {
              title: 'CountriesNow API',
              version: '2.0.0',
              description: [
                'Countries, subdivisions and cities, served from an immutable artifact.',
                '',
                'Every response is generated from a versioned dataset compiled by the curation',
                'harness. `GET /v2/dataset` reports which version you are reading and which',
                'upstream snapshot each field came from; `?include=provenance` gives the same',
                'detail per country.',
                '',
                'The `/v0.1` routes are a byte-compatible shim over the same engine, kept so',
                'existing clients need no changes. New work should use `/v2`.',
                '',
                'Data is CC BY 4.0. See ATTRIBUTION.md for per-source credit.'
              ].join('\n')
            },
            tags: [
              { name: 'Countries', description: 'ISO 3166-1 entities' },
              { name: 'Subdivisions', description: 'ISO 3166-2 entities' },
              { name: 'Places', description: 'Cities, towns and their sub-places' },
              { name: 'Reference', description: 'Currencies and dataset metadata' },
              { name: 'v0.1 compatibility', description: 'Byte-compatible legacy surface' }
            ]
          }
        })
      )

      /* ---- caching ----------------------------------------------------- */

      // The dataset is immutable between releases, so responses are too. A
      // strong ETag derived from the dataset version means every replica emits
      // the same validator for the same content, which is what lets a CDN
      // absorb the traffic instead of the origin.
      .onAfterHandle(({ set, request }) => {
        if (!isCacheable(request.method)) return;
        if (new URL(request.url).pathname.startsWith('/health')) return;

        try {
          const meta = getMeta();
          set.headers['etag'] = meta.etag;
          set.headers['cache-control'] = `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=604800`;
          set.headers['x-dataset-version'] = meta.datasetVersion;
        } catch {
          /* no artifact: the health endpoint will say so */
        }
      })

      // Conditional GET, answered before the body is ever built. With a CDN in
      // front this is what most revalidation traffic costs us.
      .onRequest(({ request }): Response | undefined => {
        if (!isCacheable(request.method)) return undefined;
        const inm = request.headers.get('if-none-match');
        if (!inm) return undefined;
        try {
          const { etag } = getMeta();
          if (inm === etag) return new Response(null, { status: 304, headers: { etag } });
        } catch {
          /* no artifact yet; fall through to the readiness probe */
        }
        return undefined;
      })

      /* ---- errors ------------------------------------------------------ */

      .onError(({ code, error, set }) => {
        if (error instanceof ResolutionError) {
          set.status = error.status;
          return {
            error: error.status === 409 ? 'ambiguous_reference' : 'not_found',
            message: error.detail,
            // 409 is the interesting one. V1 silently returned the first
            // array match for "Congo", which made the DRC unreachable. Naming
            // both candidates turns a wrong answer into an answerable question.
            ...(error.candidates ? { candidates: error.candidates } : {})
          };
        }

        if (error instanceof InvalidCursorError) {
          set.status = 400;
          return { error: 'invalid_cursor', message: error.message };
        }

        if (error instanceof ArtifactMissingError) {
          set.status = 503;
          return { error: 'artifact_unavailable', message: error.message };
        }

        if (code === 'VALIDATION') {
          set.status = 400;
          return { error: 'invalid_request', message: String(error.message ?? error) };
        }

        if (code === 'NOT_FOUND') {
          set.status = 404;
          return { error: 'not_found', message: 'No such route. See /openapi for the surface.' };
        }

        set.status = 500;
        console.error('unhandled', error);
        return { error: 'internal_error', message: 'Unexpected error.' };
      })

      /* ---- health ------------------------------------------------------ */

      // Liveness is separate from readiness on purpose. A replica with no
      // artifact is alive but must not receive traffic, and conflating the two
      // is how a bad deploy takes down a healthy fleet.
      .get('/health', () => ({ status: 'ok' }), {
        detail: { summary: 'Liveness', tags: ['Reference'] }
      })

      .get(
        '/ready',
        ({ set }) => {
          if (!isReady()) {
            set.status = 503;
            return { status: 'no_artifact' };
          }
          const meta = getMeta();
          return {
            status: 'ready',
            datasetVersion: meta.datasetVersion,
            builtAt: meta.builtAt,
            artifactBytes: meta.bytes
          };
        },
        { detail: { summary: 'Readiness', tags: ['Reference'] } }
      )

      .get(
        '/',
        () => ({
          name: 'CountriesNow',
          version: '2.0.0',
          docs: '/openapi',
          current: '/v2',
          legacy: '/v0.1',
          dataset: '/v2/dataset',
          license: 'CC BY 4.0 — see ATTRIBUTION.md'
        }),
        { detail: { summary: 'Service index', tags: ['Reference'] } }
      )

      .use(v2)
      // The v0.1 surface is split in two: bulk collections, and the `/q`
      // lookups that V1 exposed under both GET and POST.
      .use(v01)
      .use(v01Lookups)
  );
}

export type App = ReturnType<typeof createApp>;

/** Elysia app factory — exported separately so tests can mount without binding a port. */

import cors from '@elysiajs/cors';
import openapi from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { v2 } from './api/v2/index.ts';
import { v01, v01Lookups } from './api/v01/index.ts';
import { ArtifactMissingError, getMeta, isReady } from './serving/artifact.ts';
import { ResolutionError } from './serving/resolve.ts';
import { InvalidCursorError } from './serving/queries.ts';
import { DEFAULT_LANDING_DESIGN, isLandingDesign, renderLanding } from './landing.ts';
import { join } from 'node:path';

const FAVICON = join(import.meta.dir, '..', 'public', 'img', '1.png');

const CACHE_MAX_AGE = Number(process.env.CACHE_MAX_AGE ?? 86_400);

/** HEAD must share GET ETag/Cache-Control or CDNs refetch bodies. */
const isCacheable = (method: string): boolean => method === 'GET' || method === 'HEAD';

export function createApp() {
  const app = new Elysia({ name: 'countriesnow' });

  return (
    app
      .use(cors())

      // Re-dispatch HEAD as GET (RFC 9110); Elysia treats HEAD separately.
      .onRequest(async ({ request }): Promise<Response | undefined> => {
        if (request.method !== 'HEAD') return undefined;

        const res = await app.handle(
          new Request(request.url, { method: 'GET', headers: request.headers })
        );
        return new Response(null, { status: res.status, headers: res.headers });
      })

      .use(
        openapi({
          // openapi exclude.staticFile: false — v0.1 paths look like static files.
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

      // Immutable dataset → versioned ETag + Cache-Control on GET/HEAD.
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
            // 409 lists ambiguous country candidates (V1 picked first "Congo").
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

      // /health = liveness; /ready = artifact readiness (503 without artifact).
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
      // Same PNG as V1 /img/1.png; /favicon.ico aliases it.
      .get('/img/1.png', () => new Response(Bun.file(FAVICON)), {
        detail: { hide: true }
      })
      .get('/favicon.ico', () => new Response(Bun.file(FAVICON), {
        headers: { 'content-type': 'image/png' }
      }), { detail: { hide: true } })

      // HTML landing; ?design= previews variants (see landing.ts).
      .get(
        '/',
        ({ query, set }) => {
          set.headers['content-type'] = 'text/html; charset=utf-8';
          const design = isLandingDesign(query.design) ? query.design : DEFAULT_LANDING_DESIGN;
          let datasetVersion: string | undefined;
          try {
            datasetVersion = getMeta().datasetVersion;
          } catch {
            /* no artifact yet — the page renders fine without a version badge */
          }
          return renderLanding(design, { datasetVersion });
        },
        { detail: { hide: true } }
      )

      .use(v2)
      .use(v01)
      .use(v01Lookups)
  );
}

export type App = ReturnType<typeof createApp>;

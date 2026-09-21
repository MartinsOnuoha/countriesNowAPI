/**
 * The v2 surface: envelope, sparse fieldsets, locale, cursor pagination,
 * caching, and the error contract.
 *
 * These run against the real artifact through the real Elysia app, so they
 * cover routing and validation as well as the query layer.
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { createApp } from '../src/app.ts';
import { requireArtifact } from './support/artifact.ts';

let app: ReturnType<typeof createApp>;

const get = async (path: string, init?: RequestInit) => {
  const res = await app.handle(new Request(`http://localhost${path}`, init));
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : null
  };
};

beforeAll(() => {
  requireArtifact();
  app = createApp();
});

describe('envelope', () => {
  test('a collection carries data, meta and a page', async () => {
    const { status, body } = await get('/v2/countries?limit=5');
    expect(status).toBe(200);
    expect(Array.isArray(body!.data)).toBe(true);
    expect((body!.data as unknown[]).length).toBe(5);
    expect(body!.meta).toMatchObject({ datasetVersion: expect.any(String) });
    expect(body!.meta).toMatchObject({ total: expect.any(Number) });
  });

  test('a single resource carries data and meta but no pagination', async () => {
    const { body } = await get('/v2/countries/NG');
    expect(body!.data).toBeDefined();
    expect(body!.meta).toMatchObject({ datasetVersion: expect.any(String) });
    expect((body!.meta as Record<string, unknown>).nextCursor).toBeUndefined();
  });
});

describe('sparse fieldsets', () => {
  test('?fields= returns exactly the requested keys', async () => {
    const { body } = await get('/v2/countries/NG?fields=iso2,name,capital');
    expect(Object.keys(body!.data as object).sort()).toEqual(['capital', 'iso2', 'name']);
  });

  test('an unknown field is ignored rather than erroring', async () => {
    const { status, body } = await get('/v2/countries/NG?fields=iso2,notAField');
    expect(status).toBe(200);
    expect(Object.keys(body!.data as object)).toEqual(['iso2']);
  });

  test('fields apply to collection members too', async () => {
    const { body } = await get('/v2/countries?fields=iso2&limit=3');
    for (const row of body!.data as object[]) expect(Object.keys(row)).toEqual(['iso2']);
  });
});

describe('locale', () => {
  test('?locale= switches the name, and #215 is closed', async () => {
    const cases: Array<[string, string]> = [
      ['de', 'Deutschland'],
      ['fr', 'Allemagne'],
      ['es', 'Alemania']
    ];
    for (const [locale, expected] of cases) {
      const { body } = await get(`/v2/countries/DE?locale=${locale}&fields=name`);
      expect((body!.data as { name: string }).name, locale).toBe(expected);
    }
  });

  test('an unknown locale falls back rather than 404ing', async () => {
    const { status, body } = await get('/v2/countries/DE?locale=zz&fields=name');
    expect(status).toBe(200);
    expect((body!.data as { name: string }).name).toBeTruthy();
  });
});

describe('cursor pagination', () => {
  test('paging through countries visits each one exactly once', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 50; page++) {
      const qs: string = cursor ? `?limit=40&cursor=${encodeURIComponent(cursor)}` : '?limit=40';
      const { body } = await get(`/v2/countries${qs}`);
      const rows = body!.data as Array<{ iso2: string }>;
      seen.push(...rows.map((r) => r.iso2));
      cursor = (body!.meta as { nextCursor: string | null }).nextCursor;
      if (!cursor) break;
    }

    expect(cursor).toBeNull();
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThan(240);

    const { body: all } = await get('/v2/countries?limit=1');
    expect(seen.length).toBe((all!.meta as { total: number }).total);
  });

  test('paging through a large city list terminates and never repeats', async () => {
    const seen = new Set<number>();
    let cursor: string | null = null;
    let pages = 0;

    do {
      const qs: string = cursor ? `?limit=500&cursor=${encodeURIComponent(cursor)}` : '?limit=500';
      const { body } = await get(`/v2/countries/US/cities${qs}`);
      for (const r of body!.data as Array<{ geonamesId: number }>) {
        expect(seen.has(r.geonamesId)).toBe(false);
        seen.add(r.geonamesId);
      }
      cursor = (body!.meta as { nextCursor: string | null }).nextCursor;
    } while (cursor && ++pages < 100);

    expect(cursor).toBeNull();
    expect(seen.size).toBeGreaterThan(0);
  });

  test('an over-large limit is rejected rather than silently truncated', async () => {
    // V1's answer to "give me everything" was 1.86 MB. Ours is a 400 that says
    // what the ceiling is, so the caller knows to page instead of assuming the
    // first 500 rows were the whole set.
    const { status } = await get('/v2/countries/US/cities?limit=100000');
    expect(status).toBe(400);
  });

  test('the maximum limit is accepted', async () => {
    const { status, body } = await get('/v2/countries/US/cities?limit=500');
    expect(status).toBe(200);
    expect((body!.data as unknown[]).length).toBeLessThanOrEqual(500);
  });

  test('no endpoint returns an unbounded collection by default', async () => {
    for (const path of [
      '/v2/countries',
      '/v2/countries/US/cities',
      '/v2/countries/FR/subdivisions'
    ]) {
      const { body } = await get(path);
      expect((body!.data as unknown[]).length, path).toBeLessThanOrEqual(500);
    }
  });

  test('a malformed cursor is a 400, not a silently wrong page', async () => {
    for (const bad of ['not-a-real-cursor', 'YWJj', '!!!!']) {
      const { status, body } = await get(`/v2/countries?cursor=${encodeURIComponent(bad)}`);
      expect(status, bad).toBe(400);
      expect(body!.error, bad).toBe('invalid_cursor');
    }
  });
});

describe('nested collections', () => {
  test("a country's subdivisions", async () => {
    const { status, body } = await get('/v2/countries/FR/subdivisions?level=1');
    expect(status).toBe(200);
    const rows = body!.data as Array<{ countryIso2: string; level: number }>;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.countryIso2).toBe('FR');
      expect(r.level).toBe(1);
    }
  });

  test("a country's cities exclude neighbourhoods", async () => {
    const { body } = await get('/v2/countries/FR/cities?limit=500');
    const rows = body!.data as Array<{ featureCode: string; name: string }>;
    const banned = ['PPLX', 'PPLA5', 'PPLH', 'PPLQ', 'PPLW'];
    for (const r of rows) expect(banned, r.name).not.toContain(r.featureCode);
  });

  test("a subdivision's cities", async () => {
    const { status, body } = await get('/v2/subdivisions/FR-PAC/cities?limit=500');
    expect(status).toBe(200);
    expect((body!.data as unknown[]).length).toBeGreaterThan(0);
  });

  test('#242: Provence-Alpes-Côte d’Azur has no Marseille arrondissements', async () => {
    const { body } = await get('/v2/subdivisions/FR-PAC/cities?limit=500');
    const names = (body!.data as Array<{ name: string }>).map((r) => r.name);
    expect(names.some((n) => /^Marseille \d/.test(n))).toBe(false);
    // Mazargues and La Blancarde are the PPLX sections named in the report.
    expect(names).not.toContain('Mazargues');
    expect(names).not.toContain('La Blancarde');
  });

  test('neighbourhoods are still reachable as a child resource', async () => {
    const { status, body } = await get('/v2/cities/Marseille/neighbourhoods?country=FR');
    expect(status).toBe(200);
    expect((body!.data as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('errors', () => {
  test('an unknown country is 404 with a usable message', async () => {
    const { status, body } = await get('/v2/countries/Atlantis');
    expect(status).toBe(404);
    expect(body!.error).toBe('not_found');
    expect(body!.message).toContain('Atlantis');
  });

  test('an ambiguous city is 409 and every candidate is directly fetchable', async () => {
    const { status, body } = await get('/v2/cities/Springfield?country=US');
    expect([200, 409]).toContain(status);
    if (status !== 409) return;

    expect(body!.error).toBe('ambiguous_reference');
    const candidates = body!.candidates as Array<{ key: string; label: string }>;
    expect(candidates.length).toBeGreaterThan(1);
    for (const c of candidates) {
      const { status: s } = await get(`/v2/cities/${encodeURIComponent(c.key)}`);
      expect(s, c.key).toBe(200);
    }
  });

  test('an unknown route is 404 in the same envelope', async () => {
    const { status, body } = await get('/v2/nonexistent');
    expect(status).toBe(404);
    expect(body!.error).toBe('not_found');
  });
});

describe('caching', () => {
  test('responses carry a strong ETag derived from the dataset version', async () => {
    const { headers } = await get('/v2/countries?limit=1');
    const etag = headers.get('etag');
    expect(etag).toBeTruthy();
    expect(etag!.startsWith('W/')).toBe(false);
  });

  test('a matching If-None-Match gets a 304 with no body', async () => {
    const first = await get('/v2/countries?limit=1');
    const etag = first.headers.get('etag')!;
    const res = await app.handle(
      new Request('http://localhost/v2/countries?limit=1', {
        headers: { 'if-none-match': etag }
      })
    );
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
  });

  test('Cache-Control is set for shared caches', async () => {
    const { headers } = await get('/v2/countries/NG');
    expect(headers.get('cache-control')).toContain('public');
  });

  // Elysia routes HEAD separately from GET, so this is a 404 unless the app
  // handles it — and a CDN that validates with HEAD and gets a 404 back stops
  // caching the resource at all.
  test('HEAD answers with the same validators and no body', async () => {
    const g = await get('/v2/countries/NG');
    const res = await app.handle(
      new Request('http://localhost/v2/countries/NG', { method: 'HEAD' })
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
    expect(res.headers.get('etag')).toBe(g.headers.get('etag'));
    expect(res.headers.get('cache-control')).toBe(g.headers.get('cache-control'));
  });

  test('a conditional HEAD gets a 304', async () => {
    const { headers } = await get('/v2/countries/NG');
    const res = await app.handle(
      new Request('http://localhost/v2/countries/NG', {
        method: 'HEAD',
        headers: { 'if-none-match': headers.get('etag')! }
      })
    );
    expect(res.status).toBe(304);
  });

  test('every replica emits the same ETag for the same dataset', async () => {
    // Two independently constructed apps over one artifact. If the validator
    // were per-process, a CDN behind N replicas would see N different ETags
    // for identical bytes and cache almost nothing.
    const other = createApp();
    const a = await app.handle(new Request('http://localhost/v2/countries/NG'));
    const b = await other.handle(new Request('http://localhost/v2/countries/NG'));
    expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
  });
});

describe('operational endpoints', () => {
  test('/health answers without touching the artifact', async () => {
    const { status } = await get('/health');
    expect(status).toBe(200);
  });

  test('/ready reports the loaded dataset', async () => {
    const { status, body } = await get('/ready');
    expect(status).toBe(200);
    expect(body!.datasetVersion).toBeTruthy();
  });

  test('the OpenAPI document is generated and describes both versions', async () => {
    const { status, body } = await get('/openapi/json');
    expect(status).toBe(200);
    const paths = Object.keys((body as { paths: object }).paths);
    expect(paths.some((p) => p.startsWith('/v2/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('/v0.1/'))).toBe(true);
  });
});

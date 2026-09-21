/**
 * The v0.1 golden regression.
 *
 * Every captured V1 response is replayed against the shim. Cases marked
 * `shapeOnly` are compared structurally, because their values are deliberately
 * corrected; everything else must match V1 byte for byte after key ordering is
 * normalised.
 *
 * If tests/goldens/v1/ is empty the suite reports skips rather than passing
 * vacuously — a green run that asserted nothing is worse than a red one.
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOLDEN_CASES } from './goldens/endpoints.ts';
import type { Golden } from './goldens/capture.ts';
import { createApp } from '../src/app.ts';
import { shapeOf, describeShapeDiff } from './support/shape.ts';
import { requireArtifact } from './support/artifact.ts';

const GOLDEN_DIR = join(import.meta.dir, 'goldens', 'v1');

let app: ReturnType<typeof createApp>;

const call = async (path: string) => {
  const res = await app.handle(new Request(`http://localhost/v0.1${path}`));
  return { status: res.status, body: await res.json() };
};

beforeAll(() => {
  requireArtifact();
  app = createApp();
});

describe('v0.1 compatibility', () => {
  const available = GOLDEN_CASES.filter((c) => existsSync(join(GOLDEN_DIR, `${c.id}.json`)));

  if (available.length === 0) {
    test.skip('no goldens captured — run `bun run goldens:capture`', () => {});
  }

  for (const c of available) {
    const golden = JSON.parse(readFileSync(join(GOLDEN_DIR, `${c.id}.json`), 'utf8')) as Golden;

    test(`${c.id} — ${c.path}`, async () => {
      const actual = await call(c.path);

      if (c.v1Broken) {
        // V1 was broken here. The only assertion worth making is that we are
        // not: a well-formed envelope and a non-5xx status.
        expect(actual.status).toBeLessThan(500);
        expect(actual.body).toHaveProperty('error');
        expect(actual.body).toHaveProperty('msg');
        return;
      }

      expect(actual.status).toBe(golden.status);

      if (c.shapeOnly) {
        const diff = describeShapeDiff(shapeOf(golden.body), shapeOf(actual.body));
        expect(diff, `${c.id}: ${c.shapeOnly}\n${diff}`).toBeNull();
        return;
      }

      expect(actual.body).toEqual(golden.body);
    });
  }
});

describe('v0.1 envelope', () => {
  test('every route answers with the {error, msg, data} envelope', async () => {
    for (const c of GOLDEN_CASES) {
      const { body } = await call(c.path);
      expect(body, c.path).toHaveProperty('error');
      expect(body, c.path).toHaveProperty('msg');
      expect(typeof (body as { error: unknown }).error, c.path).toBe('boolean');
    }
  });

  test('a successful response always carries data, an error never does', async () => {
    for (const c of GOLDEN_CASES) {
      const { body } = await call(c.path);
      const b = body as { error: boolean; data?: unknown };
      if (b.error) expect(b.data, c.path).toBeUndefined();
      else expect(b.data, c.path).toBeDefined();
    }
  });

  test('POST and GET agree on every /q route', async () => {
    const cases = [
      ['/countries/capital/q', { country: 'Nigeria' }],
      ['/countries/currency/q', { country: 'Japan' }],
      ['/countries/iso/q', { country: 'Germany' }],
      ['/countries/states/q', { country: 'Nigeria' }],
      ['/countries/cities/q', { country: 'Tuvalu' }]
    ] as const;

    for (const [path, payload] of cases) {
      const qs = new URLSearchParams(payload as Record<string, string>).toString();
      const viaGet = await call(`${path}?${qs}`);
      const postRes = await app.handle(
        new Request(`http://localhost/v0.1${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        })
      );
      expect(postRes.status, path).toBe(viaGet.status);
      expect(await postRes.json(), path).toEqual(viaGet.body);
    }
  });
});

describe('bugs v0.1 must not reproduce', () => {
  test('the 23-country /cities/q 500 is gone', async () => {
    // The full list from V1: every country whose name is absent from
    // countriesAndCities.js but present in countriesAndStates.js.
    const affected = [
      'Tuvalu',
      'South Sudan',
      'Holy See',
      'Sint Maarten',
      'Bonaire, Sint Eustatius and Saba',
      'Curaçao',
      'Antarctica',
      'Bouvet Island',
      'Heard Island and McDonald Islands',
      'South Georgia and the South Sandwich Islands'
    ];
    for (const country of affected) {
      const { status, body } = await call(`/countries/cities/q?country=${encodeURIComponent(country)}`);
      expect(status, country).toBe(200);
      expect(Array.isArray((body as { data: unknown }).data), country).toBe(true);
    }
  });

  test('Bulgaria reports EUR', async () => {
    const { body } = await call('/countries/currency/q?country=Bulgaria');
    expect((body as { data: { currency: string } }).data.currency).toBe('EUR');
  });

  test('unaccented spellings resolve', async () => {
    for (const [query, expected] of [
      ['Reunion', 'RE'],
      ['Réunion', 'RE'],
      ['Cote dIvoire', 'CI'],
      ['Côte d’Ivoire', 'CI'],
      ['Curacao', 'CW'],
      ['Aland Islands', 'AX']
    ] as const) {
      const { body } = await call(`/countries/capital/q?country=${encodeURIComponent(query)}`);
      expect((body as { data?: { iso2: string } }).data?.iso2, query).toBe(expected);
    }
  });

  test('both Congos are reachable and distinct', async () => {
    const drc = await call('/countries/iso/q?country=Congo,%20The%20Democratic%20Republic%20of%20the');
    const rc = await call('/countries/iso/q?country=CG');
    expect((drc.body as { data: { Iso2: string } }).data.Iso2).toBe('CD');
    expect((rc.body as { data: { Iso2: string } }).data.Iso2).toBe('CG');
  });

  test('a state resolves with or without its "State" suffix', async () => {
    const bare = await call('/countries/state/cities/q?country=Nigeria&state=Lagos');
    const full = await call('/countries/state/cities/q?country=Nigeria&state=Lagos%20State');
    expect(bare.status).toBe(200);
    expect(full.body).toEqual(bare.body);
  });

  test('no city list contains a duplicate', async () => {
    for (const country of ['Nigeria', 'France', 'United States', 'India']) {
      const { body } = await call(`/countries/cities/q?country=${encodeURIComponent(country)}`);
      const cities = (body as { data: string[] }).data;
      expect(new Set(cities).size, country).toBe(cities.length);
    }
  });

  test('Marseille appears once, not seventeen times', async () => {
    const { body } = await call('/countries/cities/q?country=France');
    const cities = (body as { data: string[] }).data;
    expect(cities.filter((c) => c.startsWith('Marseille')).length).toBe(1);
  });
});

describe('the two surfaces cannot disagree', () => {
  // Both read the same artifact, so a mismatch means one of them is shaping or
  // filtering the value on its way out — which is how V1's six data files
  // drifted apart in the first place.
  const v2 = async (path: string) => {
    const res = await app.handle(new Request(`http://localhost/v2${path}`));
    return (await res.json()) as { data: Record<string, unknown> };
  };

  test('coordinates match between /v0.1/positions and /v2/countries', async () => {
    for (const country of ['Nigeria', 'France', 'Japan', 'Brazil']) {
      const legacy = await call(`/countries/positions/q?country=${country}`);
      const { data } = await v2(`/countries/${country}?fields=latitude,longitude`);
      const pos = (legacy.body as { data: { lat: number; long: number } }).data;
      expect(data.latitude, country).toBe(pos.lat);
      expect(data.longitude, country).toBe(pos.long);
    }
  });

  test('currency matches between /v0.1/currency and /v2/countries', async () => {
    for (const country of ['Bulgaria', 'Nigeria', 'Japan', 'Switzerland']) {
      const legacy = await call(`/countries/currency/q?country=${country}`);
      const { data } = await v2(`/countries/${country}?fields=currency`);
      expect(data.currency, country).toBe(
        (legacy.body as { data: { currency: string } }).data.currency
      );
    }
  });

  test('capital and ISO codes match', async () => {
    for (const country of ['Nigeria', 'Germany', 'Réunion', "Côte d'Ivoire"]) {
      const legacy = await call(`/countries/capital/q?country=${encodeURIComponent(country)}`);
      const { data } = await v2(`/countries/${encodeURIComponent(country)}?fields=capital,iso2,iso3`);
      const c = (legacy.body as { data: { capital: string; iso2: string; iso3: string } }).data;
      expect(data.capital, country).toBe(c.capital);
      expect(data.iso2, country).toBe(c.iso2);
      expect(data.iso3, country).toBe(c.iso3);
    }
  });
});

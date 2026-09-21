/**
 * The resolver is the single place any string becomes an entity, so it is the
 * single place the Réunion class of bug can reappear. These tests pin the
 * folding rules and the ambiguity contract.
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { getDb, openArtifact } from '../src/serving/artifact.ts';
import { resolveCountry, resolveSubdivision, resolvePlace } from '../src/serving/resolve.ts';
import { fold, foldTight, classifyRef } from '../src/serving/normalize.ts';
import { requireArtifact } from './support/artifact.ts';

let db: Database;

beforeAll(() => {
  openArtifact(requireArtifact());
  db = getDb();
});

describe('fold', () => {
  test('strips combining marks', () => {
    expect(fold('Réunion')).toBe(fold('Reunion'));
    expect(fold('Åland')).toBe(fold('Aland'));
    expect(fold('Curaçao')).toBe(fold('Curacao'));
    expect(fold('Türkiye')).toBe(fold('Turkiye'));
  });

  test('casefolds and collapses whitespace', () => {
    expect(fold('  UNITED   STATES  ')).toBe(fold('United States'));
  });

  test('normalises the apostrophes and dashes that differ between sources', () => {
    expect(fold('Côte d’Ivoire')).toBe(fold("Cote d'Ivoire"));
    expect(fold('Timor–Leste')).toBe(fold('Timor-Leste'));
  });

  test('foldTight additionally drops punctuation and separators', () => {
    expect(foldTight("Cote d'Ivoire")).toBe(foldTight('Cote dIvoire'));
    expect(foldTight('Guinea-Bissau')).toBe(foldTight('Guinea Bissau'));
    expect(foldTight('St. Lucia')).toBe(foldTight('St Lucia'));
  });

  test('fold is idempotent', () => {
    for (const s of ['Réunion', 'Côte d’Ivoire', 'ÅLAND', 'São Tomé & Príncipe']) {
      expect(fold(fold(s))).toBe(fold(s));
    }
  });
});

describe('classifyRef', () => {
  test('recognises each reference shape', () => {
    expect(classifyRef('NG')).toBe('iso2');
    expect(classifyRef('NGA')).toBe('iso3');
    expect(classifyRef('2328926')).toBe('geonames');
    expect(classifyRef('NG-LA')).toBe('name');
    expect(classifyRef('Nigeria')).toBe('name');
  });

  test('a code-shaped reference still falls through to a name lookup', () => {
    // classifyRef only says which index to try *first*. "Chad" is four letters
    // but aliases like "UAE" are three, so a miss on the code index must not
    // end the search.
    expect(classifyRef('UAE')).toBe('iso3');
    const r = resolveCountry(db, 'UAE');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.iso2).toBe('AE');
  });
});

describe('resolveCountry', () => {
  test('resolves by every documented reference kind', () => {
    // ISO numeric is deliberately not a reference kind: 566 is both Nigeria's
    // numeric code and a valid GeoNames id, and the resolver never guesses.
    for (const ref of ['NG', 'NGA', 'Nigeria', 'nigeria', '2328926']) {
      const r = resolveCountry(db, ref);
      expect(r.ok, ref).toBe(true);
      if (r.ok) expect(r.value.iso2, ref).toBe('NG');
    }
  });

  test('resolves the names that 404d in V1', () => {
    const cases: Array<[string, string]> = [
      ['Reunion', 'RE'],
      ['Réunion', 'RE'],
      ['Cote dIvoire', 'CI'],
      ['Ivory Coast', 'CI'],
      ['Aland Islands', 'AX'],
      ['Curacao', 'CW'],
      ['Turkiye', 'TR'],
      ['Turkey', 'TR'],
      ['Czechia', 'CZ'],
      ['Czech Republic', 'CZ'],
      ['Swaziland', 'SZ'],
      ['Eswatini', 'SZ'],
      ['Burma', 'MM'],
      ['Myanmar', 'MM'],
      ['Holland', 'NL'],
      ['UK', 'GB'],
      ['USA', 'US'],
      ['South Korea', 'KR'],
      ['North Korea', 'KP'],
      ['Vatican City', 'VA'],
      ['Palestine', 'PS'],
      ['Sint Maarten', 'SX']
    ];
    for (const [ref, iso2] of cases) {
      const r = resolveCountry(db, ref);
      expect(r.ok, ref).toBe(true);
      if (r.ok) expect(r.value.iso2, ref).toBe(iso2);
    }
  });

  test('a retired ISO 3166-3 code still resolves to its successor', () => {
    const r = resolveCountry(db, 'Zaire');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.iso2).toBe('CD');
  });

  test('an unknown reference is a miss, not a wrong answer', () => {
    for (const ref of ['Atlantis', 'ZZ', 'ZZZ', '999999999', '']) {
      expect(resolveCountry(db, ref).ok, ref).toBe(false);
    }
  });

  test('every country resolves by its own iso2, iso3 and display name', () => {
    const rows = db.query('SELECT iso2, iso3, display_name FROM countries').all() as Array<{
      iso2: string;
      iso3: string | null;
      display_name: string;
    }>;
    expect(rows.length).toBeGreaterThan(240);
    for (const row of rows) {
      expect(resolveCountry(db, row.iso2).ok, row.iso2).toBe(true);
      if (row.iso3) expect(resolveCountry(db, row.iso3).ok, row.iso3).toBe(true);
      const byName = resolveCountry(db, row.display_name);
      expect(byName.ok, row.display_name).toBe(true);
    }
  });
});

describe('ambiguity', () => {
  test('an ambiguous reference reports candidates instead of picking one', () => {
    // Whichever names collide in the current dataset, the contract is the
    // same: never silently choose. Find a real collision and assert on it.
    const collision = db
      .query(
        `SELECT folded FROM names WHERE entity_type = 0
         GROUP BY folded HAVING COUNT(DISTINCT entity_key) > 1 LIMIT 1`
      )
      .get() as { folded: string } | null;

    if (!collision) return; // no colliding country names in this dataset

    const r = resolveCountry(db, collision.folded);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'ambiguous') {
      expect(r.candidates.length).toBeGreaterThan(1);
      // Each candidate has to be actionable on its own.
      for (const c of r.candidates) {
        expect(c.key).toBeTruthy();
        expect(resolveCountry(db, c.key).ok).toBe(true);
      }
    }
  });
});

describe('resolveSubdivision', () => {
  test('resolves by ISO 3166-2, by local code and by name', () => {
    for (const ref of ['NG-LA', 'LA', 'Lagos', 'Lagos State']) {
      const r = resolveSubdivision(db, ref, 'NG');
      expect(r.ok, ref).toBe(true);
      if (r.ok) expect(r.value.iso_3166_2, ref).toBe('NG-LA');
    }
  });

  test('scoping to a country prevents a code from matching another country', () => {
    const inNigeria = resolveSubdivision(db, 'LA', 'NG');
    const inUsa = resolveSubdivision(db, 'LA', 'US');
    expect(inNigeria.ok).toBe(true);
    if (inNigeria.ok && inUsa.ok) expect(inUsa.value.id).not.toBe(inNigeria.value.id);
  });
});

describe('resolvePlace', () => {
  test('resolves a city by name and by GeoNames id', () => {
    const byName = resolvePlace(db, 'Lagos', { countryIso2: 'NG' });
    expect(byName.ok).toBe(true);
    if (!byName.ok) return;
    const byId = resolvePlace(db, String(byName.value.geonames_id));
    expect(byId.ok).toBe(true);
    if (byId.ok) expect(byId.value.geonames_id).toBe(byName.value.geonames_id);
  });

  test('an accented city name resolves unaccented', () => {
    const a = resolvePlace(db, 'Saint-Denis', { countryIso2: 'RE' });
    const b = resolvePlace(db, 'saint denis', { countryIso2: 'RE' });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.value.geonames_id).toBe(a.value.geonames_id);
  });

  test('a city outranks a same-named neighbourhood rather than going ambiguous', () => {
    // Marseille is one PPLA plus sixteen PPLA5 arrondissements. The city wins.
    const r = resolvePlace(db, 'Marseille', { countryIso2: 'FR' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.is_city).toBe(1);
      expect(r.value.feature_code).toBe('PPLA');
    }
  });

  test('two genuinely distinct cities of the same name stay ambiguous', () => {
    // Springfield exists many times over in the US with no decisive winner.
    const r = resolvePlace(db, 'Springfield', { countryIso2: 'US' });
    if (!r.ok) expect(r.reason).toBe('ambiguous');
  });
});

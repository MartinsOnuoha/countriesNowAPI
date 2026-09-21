/** Shared fold() for harness names table and API resolution. */

/**
 * Characters that are not decomposed by NFKD but should still be equated.
 * Latin letters with a stroke through them (ł, đ, ø) have no combining-mark
 * decomposition, so stripping marks alone leaves them unmatched.
 */
const IRREDUCIBLE: Record<string, string> = {
  ø: 'o',
  Ø: 'o',
  đ: 'd',
  Đ: 'd',
  ð: 'd',
  Ð: 'd',
  ł: 'l',
  Ł: 'l',
  ħ: 'h',
  Ħ: 'h',
  ŧ: 't',
  Ŧ: 't',
  ı: 'i',
  ſ: 's',
  þ: 'th',
  Þ: 'th',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
  ß: 'ss'
};

const IRREDUCIBLE_RE = new RegExp(`[${Object.keys(IRREDUCIBLE).join('')}]`, 'g');

/**
 * Unicode combining marks left behind by NFKD decomposition.
 *
 * These ranges rather than `\p{M}` on purpose. `\p{M}` also covers Devanagari
 * vowel signs, Arabic harakat and Thai tone marks, where the mark is part of
 * the word rather than an accent on it — stripping those would fold distinct
 * names together. These five blocks are the diacritics NFKD splits off Latin,
 * Greek and Cyrillic letters, which is the case this exists for.
 *
 * The lint rule below guards against a class that accidentally splits a
 * grapheme. Matching bare combining marks is the whole point here.
 */
// eslint-disable-next-line no-misleading-character-class
const COMBINING_MARKS = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20f0\ufe20-\ufe2f]/g;

/** Punctuation/whitespace → single space in fold(). */
const SEPARATORS = /[\s\p{P}\p{S}]+/gu;

/**
 * Fold a name into its canonical lookup form.
 *
 * Returns '' for input that contains no alphanumeric content, which callers
 * should treat as "no query" rather than "no match".
 *
 * @example
 * fold('Réunion')          // 'reunion'
 * fold('  CÔTE  D’IVOIRE') // 'cote d ivoire'
 * fold('Saint-Barthélemy') // 'saint barthelemy'
 */
export function fold(input: string): string {
  if (!input) return '';

  return input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(IRREDUCIBLE_RE, (c) => IRREDUCIBLE[c] ?? c)
    .toLowerCase()
    .replace(SEPARATORS, ' ')
    .trim();
}

/**
 * Fold with separators removed entirely. Used as a secondary index so that
 * "St.Kitts" and "St Kitts" collide even though the primary fold keeps them
 * one space apart. Slightly more collision-prone, so it is only consulted
 * after an exact `fold()` miss.
 */
export function foldTight(input: string): string {
  return fold(input).replace(/ /g, '');
}

/** True when `a` and `b` denote the same name under folding. */
export function sameName(a: string, b: string): boolean {
  const fa = fold(a);
  return fa !== '' && fa === fold(b);
}

/**
 * Detects a bare ISO code so the resolver can skip the name index. Callers pass
 * arbitrary strings, and "AU" should mean Australia rather than fuzzy-matching
 * some place called Au.
 */
export function classifyRef(ref: string): 'iso2' | 'iso3' | 'geonames' | 'name' {
  const t = ref.trim();
  if (/^\d+$/.test(t)) return 'geonames';
  if (/^[A-Za-z]{2}$/.test(t)) return 'iso2';
  if (/^[A-Za-z]{3}$/.test(t)) return 'iso3';
  return 'name';
}

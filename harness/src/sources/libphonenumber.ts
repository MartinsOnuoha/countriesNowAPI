/** Dial codes from libphonenumber; root + suffixes for shared codes. */

import { XMLParser } from 'fast-xml-parser';
import { fetchArtifact, readSnapshotText } from '../snapshot/store.ts';
import type { FetchContext, Snapshot, SourceAdapter } from '../types.ts';

const URL =
  'https://raw.githubusercontent.com/google/libphonenumber/master/resources/PhoneNumberMetadata.xml';

export interface PhoneRegion {
  region: string;
  countryCode: string;
  /** "+1" — the shared root. */
  root: string;
  /** "+1684" — root plus this region's distinguishing prefix, when it has one. */
  dialCode: string;
  /** Leading digits that pick this region out of a shared root. */
  suffixes: string[];
  isMainForCode: boolean;
}

export interface LibPhoneData {
  version: string;
  byRegion: Map<string, PhoneRegion>;
}

interface TerritoryEl {
  '@id'?: string;
  '@countryCode'?: string | number;
  '@mainCountryForCode'?: string | boolean;
  '@leadingDigits'?: string | number;
}

export const libphonenumber: SourceAdapter<LibPhoneData> = {
  id: 'libphonenumber',
  title: 'google/libphonenumber metadata',
  cadence: 'several releases per year, tracking national regulators',
  license: {
    spdx: 'Apache-2.0',
    url: 'https://github.com/google/libphonenumber',
    attribution: 'Calling-code metadata from google/libphonenumber (Apache-2.0).',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    return [
      await fetchArtifact({
        source: 'libphonenumber',
        artifact: 'PhoneNumberMetadata.xml',
        url: URL,
        offline: ctx.offline,
        log: ctx.log,
        timeoutMs: 180_000
      })
    ];
  },

  async parse(snapshots: Snapshot[]): Promise<LibPhoneData> {
    const snap = snapshots[0]!;
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
      isArray: (name) => name === 'territory'
    });

    // The file opens with a large internal DTD subset. fast-xml-parser copes,
    // but stripping it keeps the parse cheap and the output shape predictable.
    const xml = (await readSnapshotText(snap)).replace(/<!DOCTYPE[\s\S]*?\]>/, '');

    const doc = parser.parse(xml) as {
      phoneNumberMetadata?: { territories?: { territory?: TerritoryEl[] } };
    };
    const territories = doc.phoneNumberMetadata?.territories?.territory ?? [];

    // Group by calling code first: a region is only "shared" if another region
    // uses the same code, and that decides whether suffixes matter.
    const byCode = new Map<string, TerritoryEl[]>();
    for (const t of territories) {
      const code = t['@countryCode'] === undefined ? null : String(t['@countryCode']);
      if (!code) continue;
      const list = byCode.get(code) ?? [];
      list.push(t);
      byCode.set(code, list);
    }

    const byRegion = new Map<string, PhoneRegion>();

    for (const [code, group] of byCode) {
      const shared = group.length > 1;
      for (const t of group) {
        const region = t['@id'];
        // "001" is libphonenumber's pseudo-region for non-geographic numbers
        // (satellite, shared-cost). It is not a country.
        if (!region || region === '001' || region.length !== 2) continue;

        const isMain =
          String(t['@mainCountryForCode'] ?? '').toLowerCase() === 'true' || group.length === 1;

        const leading =
          t['@leadingDigits'] === undefined
            ? []
            : String(t['@leadingDigits'])
                .replace(/\s+/g, '')
                .split('|')
                .filter((d) => /^\d+$/.test(d));

        const root = `+${code}`;
        byRegion.set(region.toUpperCase(), {
          region: region.toUpperCase(),
          countryCode: code,
          root,
          // A shared root only becomes a usable dial code once the region's
          // own prefix is appended — +1684 for American Samoa, not +1.
          dialCode: shared && !isMain && leading[0] ? `${root}${leading[0]}` : root,
          suffixes: leading,
          isMainForCode: isMain
        });
      }
    }

    return { version: snap.version, byRegion };
  }
};

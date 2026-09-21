/**
 * lipis/flag-icons — flags as URLs.
 *
 * MIT-licensed SVG flags for every ISO 3166-1 code, which is the cleanest
 * licence story available; the flag *designs* themselves are separately in the
 * public domain. The alternative, hampusborgos/country-flags, has no licence
 * file at all despite the README asserting public domain, which is a
 * procurement risk we do not need to take.
 *
 * We emit URLs, never bytes. Inlining SVG payloads would undo the "lighter
 * application sizes" promise the project exists for, and a URL lets flags be
 * cached and versioned independently of the data pipeline. The tag is pinned so
 * an upstream flag redesign cannot silently change API output.
 *
 * Emoji flags need no upstream at all — they are derived from the alpha-2 code
 * by regional-indicator arithmetic.
 */

import { fetchArtifact, readSnapshotJson } from '../snapshot/store.ts';
import type { FetchContext, Snapshot, SourceAdapter } from '../types.ts';

const PKG_URL = 'https://raw.githubusercontent.com/lipis/flag-icons/main/package.json';

/** Pinned so releases are reproducible. Bump deliberately, never automatically. */
export const FLAG_ICONS_TAG = 'v7.5.0';

const cdn = (path: string) =>
  `https://cdn.jsdelivr.net/gh/lipis/flag-icons@${FLAG_ICONS_TAG}/${path}`;

export interface FlagRecord {
  iso2: string;
  emoji: string;
  svgUrl: string;
  /** 1x1 variant. flag-icons ships SVG only, so there is no raster URL to give. */
  svgSquareUrl: string;
}

export interface FlagIconsData {
  version: string;
  byIso2: Map<string, FlagRecord>;
}

/**
 * Regional indicator symbols: 'US' becomes U+1F1FA U+1F1F8. Every valid alpha-2
 * maps to an emoji flag, so no lookup table is needed.
 */
export function emojiFlag(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((ch) => 0x1f1e6 + (ch.charCodeAt(0) - 'A'.charCodeAt(0)))
  );
}

export const flagIcons: SourceAdapter<FlagIconsData> = {
  id: 'flag-icons',
  title: 'lipis/flag-icons',
  cadence: 'active; pinned to a tag on our side',
  license: {
    spdx: 'MIT',
    url: 'https://github.com/lipis/flag-icons',
    attribution: 'Flag images from lipis/flag-icons (MIT).',
    shareAlike: false
  },

  async fetch(ctx: FetchContext): Promise<Snapshot[]> {
    // Only the package manifest is fetched, to record which upstream version
    // exists. The images are referenced by URL and never downloaded.
    return [
      await fetchArtifact({
        source: 'flag-icons',
        artifact: 'package.json',
        url: PKG_URL,
        offline: ctx.offline,
        log: ctx.log,
        versionFrom: (bytes) => {
          try {
            return (JSON.parse(new TextDecoder().decode(bytes)) as { version?: string }).version;
          } catch {
            return undefined;
          }
        }
      })
    ];
  },

  async parse(snapshots: Snapshot[], ctx: FetchContext): Promise<FlagIconsData> {
    const snap = snapshots[0]!;
    let upstream = snap.version;
    try {
      upstream = (await readSnapshotJson<{ version?: string }>(snap)).version ?? snap.version;
    } catch {
      /* the manifest is advisory; the pinned tag is what we actually serve */
    }

    if (`v${upstream}` !== FLAG_ICONS_TAG) {
      ctx.log.debug(
        `flag-icons: upstream is v${upstream}, we serve ${FLAG_ICONS_TAG} (pinned deliberately)`
      );
    }

    // Built from the code list rather than the file listing: flag-icons has a
    // file for every ISO 3166-1 code, so enumeration adds a network round trip
    // for no information.
    return { version: FLAG_ICONS_TAG, byIso2: new Map() };
  }
};

/** Build a flag record for a code. Called by the pipeline once codes are known. */
export function flagFor(iso2: string): FlagRecord {
  const code = iso2.toLowerCase();
  return {
    iso2: iso2.toUpperCase(),
    emoji: emojiFlag(iso2),
    svgUrl: cdn(`flags/4x3/${code}.svg`),
    svgSquareUrl: cdn(`flags/1x1/${code}.svg`)
  };
}

export function buildFlagIndex(iso2Codes: string[]): FlagIconsData {
  const byIso2 = new Map<string, FlagRecord>();
  for (const code of iso2Codes) byIso2.set(code.toUpperCase(), flagFor(code));
  return { version: FLAG_ICONS_TAG, byIso2 };
}

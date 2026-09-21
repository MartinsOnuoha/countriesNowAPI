/**
 * Minimal ZIP reader for the GeoNames dumps.
 *
 * GeoNames ships everything as single-entry deflate archives. Shelling out to
 * `unzip` would work locally but adds a system dependency to CI and to the
 * container; a full zip library is a lot of surface area for one file format we
 * only ever read. This handles exactly the two storage methods GeoNames uses.
 */

import { inflateRawSync } from 'node:zlib';

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;

export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  localHeaderOffset: number;
}

/** Read the central directory. Throws if this is not a ZIP. */
export function listEntries(buf: Uint8Array): ZipEntry[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // The end-of-central-directory record sits at the tail, after a comment of
  // up to 64 KB, so scan backwards for its signature.
  let eocd = -1;
  const floor = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === END_OF_CENTRAL) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip archive: no end-of-central-directory record');

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_HEADER) {
      throw new Error(`corrupt central directory at entry ${i}`);
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const name = new TextDecoder().decode(buf.subarray(offset + 46, offset + 46 + nameLen));
    entries.push({ name, compressedSize, uncompressedSize, method, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Extract one entry's bytes. */
export function extract(buf: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const off = entry.localHeaderOffset;
  if (view.getUint32(off, true) !== LOCAL_HEADER) {
    throw new Error(`corrupt local header for ${entry.name}`);
  }

  // The local header repeats the name and extra-field lengths, and they can
  // differ from the central directory's, so read them here rather than reusing.
  const nameLen = view.getUint16(off + 26, true);
  const extraLen = view.getUint16(off + 28, true);
  const start = off + 30 + nameLen + extraLen;
  const body = buf.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return body;
  if (entry.method === 8) return new Uint8Array(inflateRawSync(body));
  throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`);
}

/**
 * Extract a single member by name, or the only member if `name` is omitted.
 * GeoNames archives are always one file, so callers rarely need to be specific.
 */
export function extractOne(buf: Uint8Array, name?: string): { name: string; data: Uint8Array } {
  const entries = listEntries(buf).filter((e) => !e.name.endsWith('/'));
  const entry = name
    ? entries.find((e) => e.name === name || e.name.endsWith(`/${name}`))
    : entries[0];
  if (!entry) {
    throw new Error(
      `zip member ${name ?? '<first>'} not found; archive holds: ${entries.map((e) => e.name).join(', ')}`
    );
  }
  return { name: entry.name, data: extract(buf, entry) };
}

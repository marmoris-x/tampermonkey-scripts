/**
 * Zero-dependency STORE (no-compression) ZIP archive builder.
 * Standalone copy — no external dependencies.
 *
 * Builds a valid ZIP file with local file headers, central directory,
 * and end-of-central-directory (EOCD) record. Uses CRC-32 for integrity
 * verification. All binary segments use Uint8Array for minimal allocation.
 *
 * Adapted from the proven reference implementation (v5.3).
 *
 * @param {Array<{ name: string, text: string }>} files - Array of {name, text}
 * @returns {Blob} ZIP archive as a Blob (ready for download)
 */
'use strict';

// CRC-32 lookup table — computed once, cached
const crcTable = new Uint32Array(256);
(function buildCRCTable() {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c;
  }
})();

function crc32(u8) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ u8[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }

export const enc = new TextEncoder();

export function buildStoreZip(files) {
  const localParts = [];
  const centralParts = [];
  const entries = [];
  let localOffset = 0;

  for (let f = 0; f < files.length; f++) {
    const nameBytes = enc.encode(files[f].name);
    const data = files[f].data || enc.encode(files[f].text);
    const crc = crc32(data);

    // Local file header (30 bytes + filename)
    const local = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04,  // signature
      20, 0,                    // version needed
      ...u16(0x0800),           // flags: Language Encoding Flag (UTF-8 filenames)
      0, 0,                     // compression: STORE
      0, 0, 0, 0,               // mod time + mod date
      ...u32(crc),
      ...u32(data.length),      // compressed size (= uncompressed for STORE)
      ...u32(data.length),      // uncompressed size
      ...u16(nameBytes.length),
      0, 0,                     // extra field length
    ]);

    entries.push({ offset: localOffset, nameBytes, crc, size: data.length });
    localParts.push(local, nameBytes, data);
    localOffset += local.length + nameBytes.length + data.length;
  }

  // Central directory
  let centralSize = 0;
  for (let f = 0; f < entries.length; f++) {
    const e = entries[f];
    const ch = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,  // signature
      20, 0,                    // version made by
      20, 0,                    // version needed
      ...u16(0x0800),           // flags: Language Encoding Flag (UTF-8 filenames)
      0, 0,                     // compression: STORE
      0, 0, 0, 0,               // mod time + mod date
      ...u32(e.crc),
      ...u32(e.size),           // compressed size
      ...u32(e.size),           // uncompressed size
      ...u16(e.nameBytes.length),
      0, 0,                     // extra length
      0, 0,                     // comment length
      0, 0,                     // disk number start
      0, 0,                     // internal file attributes
      0, 0, 0, 0,               // external file attributes
      ...u32(e.offset),         // local header offset
    ]);
    centralParts.push(ch, e.nameBytes);
    centralSize += ch.length + e.nameBytes.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06,  // signature
    0, 0,                     // disk number
    0, 0,                     // disk with central dir
    ...u16(entries.length),   // entries on this disk
    ...u16(entries.length),   // total entries
    ...u32(centralSize),
    ...u32(localOffset),      // central dir offset
    0, 0,                     // comment length
  ]);

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

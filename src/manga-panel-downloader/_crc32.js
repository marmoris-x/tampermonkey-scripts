'use strict';

/* --- CRC-32 Table (lazily initialized) --- */

/** @type {Uint32Array|null} */
let crcTable = null;

/**
 * Builds (or returns cached) CRC-32 lookup table.
 * Uses Uint32Array for raw binary performance.
 * @returns {Uint32Array} 256-entry CRC-32 lookup table
 */
function buildCRCTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  return crcTable;
}

/**
 * Computes CRC-32 checksum for a byte array.
 * @param {Uint8Array|number[]} data - Input bytes
 * @returns {number} CRC-32 checksum (unsigned 32-bit)
 */
function crc32(data) {
  const table = buildCRCTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export { buildCRCTable, crc32 };

// Local copy of buildStoreZip from src/shared/zip-builder.js
// Side-effect-free extraction for Manga Panel Downloader.

/* --- CRC-32 Table (lazily initialized) --- */

let crcTable = null;
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

function crc32(data) {
  const table = buildCRCTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const encoder = new TextEncoder();

/**
 * Builds a STORE (no-compression) ZIP archive.
 * @param {{ name: string, data: Uint8Array }[]} files - Array of {name, data} objects
 * @returns {Uint8Array} Complete ZIP file as bytes
 */
export function buildStoreZip(files) {
  const localHeaders = [];
  const centralEntries = [];
  const offsets = [];
  let offset = 0;

  for (let f = 0; f < files.length; f++) {
    const nameBytes = encoder.encode(files[f].name);
    const data = files[f].data;
    const crc = crc32(data);
    const nameLen = nameBytes.length;
    const dataLen = data.length;

    // Local file header
    const lh = new ArrayBuffer(30 + nameLen);
    const lv = new DataView(lh);
    lv.setUint32(0, 0x04034b50, true);  // signature
    lv.setUint16(4, 20, true);           // version needed
    lv.setUint16(6, 0x0800, true);       // flags: UTF-8
    lv.setUint16(8, 0, true);            // compression: STORE
    lv.setUint16(10, 0, true);           // mod time
    lv.setUint16(12, 0, true);           // mod date
    lv.setUint32(14, crc, true);         // CRC-32
    lv.setUint32(18, dataLen, true);     // compressed size
    lv.setUint32(22, dataLen, true);     // uncompressed size
    lv.setUint16(26, nameLen, true);     // filename length
    lv.setUint16(28, 0, true);           // extra field length
    const lhBytes = new Uint8Array(lh);
    lhBytes.set(nameBytes, 30);
    localHeaders.push(lhBytes);

    offsets.push(offset);
    offset += lhBytes.length + dataLen;
  }

  // Central directory
  let cdTotal = 0;
  const cdOffset = offset;
  for (let f = 0; f < files.length; f++) {
    const cdNameBytes = encoder.encode(files[f].name);
    const cdNameLen = cdNameBytes.length;
    const cd = new ArrayBuffer(46 + cdNameLen);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true);   // central dir signature
    cv.setUint16(4, 20, true);            // version made by
    cv.setUint16(6, 20, true);            // version needed
    cv.setUint16(8, 0x0800, true);        // flags: UTF-8
    cv.setUint16(10, 0, true);            // compression: STORE
    cv.setUint16(12, 0, true);            // mod time
    cv.setUint16(14, 0, true);            // mod date
    cv.setUint32(16, crc32(files[f].data), true); // CRC-32
    cv.setUint32(20, files[f].data.length, true); // compressed size
    cv.setUint32(24, files[f].data.length, true); // uncompressed size
    cv.setUint16(28, cdNameLen, true);    // filename length
    cv.setUint16(30, 0, true);            // extra field length
    cv.setUint16(32, 0, true);            // file comment length
    cv.setUint16(34, 0, true);            // disk number start
    cv.setUint16(36, 0, true);            // internal attrs
    cv.setUint32(38, 0, true);            // external attrs
    cv.setUint32(42, offsets[f], true);   // local header offset
    const cdBytes = new Uint8Array(cd);
    cdBytes.set(cdNameBytes, 46);
    centralEntries.push(cdBytes);
    cdTotal += cdBytes.length;
  }

  // EOCD
  const totalSize = offset + cdTotal + 22;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (let f = 0; f < files.length; f++) {
    out.set(localHeaders[f], pos); pos += localHeaders[f].length;
    out.set(files[f].data, pos);   pos += files[f].data.length;
  }
  for (let f = 0; f < centralEntries.length; f++) {
    out.set(centralEntries[f], pos); pos += centralEntries[f].length;
  }
  const eocd = new DataView(out.buffer, pos, 22);
  eocd.setUint32(0, 0x06054b50, true);   // EOCD signature
  eocd.setUint16(4, 0, true);             // disk number
  eocd.setUint16(6, 0, true);             // disk with CD
  eocd.setUint16(8, files.length, true);  // entries on disk
  eocd.setUint16(10, files.length, true); // total entries
  eocd.setUint32(12, cdTotal, true);      // CD size
  eocd.setUint32(16, cdOffset, true);     // CD offset
  eocd.setUint16(20, 0, true);            // comment length
  return out;
}

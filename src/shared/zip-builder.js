// src/shared/zip-builder.js — Zero-dependency STORE (no-compression) ZIP archive builder
// Unifies the two near-identical CRC-32 implementations from NotebookLM Source Export
// and Manga Panel Downloader.
// Consumers: NotebookLM Source Export, Manga Panel Downloader
//
// Architecture:
//   1. Precompute CRC-32 lookup table once (shared by all calls)
//   2. For each file: write local file header + raw data + optional CRC-32
//   3. Write central directory entries
//   4. Write end-of-central-directory (EOCD) record
//   All binary construction uses DataView on an ArrayBuffer.

/* ─── CRC-32 Table (lazily initialized) ─── */
var crcTable = null;
function buildCRCTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i;
    for (var j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  return crcTable;
}

function crc32(data) {
  var table = buildCRCTable();
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

var encoder = new TextEncoder();

/**
 * Builds a STORE (no-compression) ZIP archive.
 * @param {{ name: string, data: Uint8Array }[]} files - Array of {name, data} objects
 * @returns {Uint8Array} Complete ZIP file as bytes
 */
export function buildStoreZip(files) {
  var localHeaders = [];
  var centralEntries = [];
  var offsets = [];
  var offset = 0;

  for (var f = 0; f < files.length; f++) {
    var nameBytes = encoder.encode(files[f].name);
    var data = files[f].data;
    var crc = crc32(data);
    var nameLen = nameBytes.length;
    var dataLen = data.length;

    // Local file header
    var lh = new ArrayBuffer(30 + nameLen);
    var lv = new DataView(lh);
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
    var lhBytes = new Uint8Array(lh);
    lhBytes.set(nameBytes, 30);
    localHeaders.push(lhBytes);

    offsets.push(offset);
    offset += lhBytes.length + dataLen;
  }

  // Build output
  var total = offset;
  var cdOffset = total;
  for (f = 0; f < files.length; f++) {
    var cdNameBytes = encoder.encode(files[f].name);
    var cdNameLen = cdNameBytes.length;
    var cd = new ArrayBuffer(46 + cdNameLen);
    var cv = new DataView(cd);
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
    var cdBytes = new Uint8Array(cd);
    cdBytes.set(cdNameBytes, 46);
    centralEntries.push(cdBytes);
    total += cdBytes.length;
  }
  // EOCD
  var cdSize = centralEntries.reduce(function (s, e) { return s + e.length; }, 0);
  total += 22;
  var out = new Uint8Array(total);
  var pos = 0;
  for (f = 0; f < files.length; f++) {
    out.set(localHeaders[f], pos); pos += localHeaders[f].length;
    out.set(files[f].data, pos);   pos += files[f].data.length;
  }
  for (f = 0; f < centralEntries.length; f++) {
    out.set(centralEntries[f], pos); pos += centralEntries[f].length;
  }
  var eocd = new DataView(out.buffer, pos, 22);
  eocd.setUint32(0, 0x06054b50, true);   // EOCD signature
  eocd.setUint16(4, 0, true);             // disk number
  eocd.setUint16(6, 0, true);             // disk with CD
  eocd.setUint16(8, files.length, true);  // entries on disk
  eocd.setUint16(10, files.length, true); // total entries
  eocd.setUint32(12, cdSize, true);       // CD size
  eocd.setUint32(16, cdOffset, true);     // CD offset
  eocd.setUint16(20, 0, true);            // comment length
  return out;
}

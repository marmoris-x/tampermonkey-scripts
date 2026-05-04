// src/manga-panel-downloader/image-processor.js — Image download and processing
// Downloads images via a 5-fallback fetch chain (GM_xmlhttpRequest with varying
// headers, native fetch, canvas redraw). Splits tall panels into 3500px segments.

var MAX_SEG_H = 3500;
var MIN_SEG_H = 600;
var FETCH_RETRY_COUNT = 2;

/**
 * Sleep helper for retry delays.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

/**
 * Fetches a blob via GM_xmlhttpRequest with custom headers.
 * @param {string} url
 * @param {Object} [extraHeaders]
 * @returns {Promise<Blob>}
 */
function fetchBlob(url, extraHeaders) {
  extraHeaders = extraHeaders || {};
  // Build headers object merging Referer, Origin, and extraHeaders
  var headers = {};
  headers.Referer = location.href;
  headers.Origin = location.origin;
  for (var key in extraHeaders) {
    if (extraHeaders.hasOwnProperty(key)) {
      headers[key] = extraHeaders[key];
    }
  }
  // Remove null/undefined values
  var cleanHeaders = {};
  for (var k in headers) {
    if (headers.hasOwnProperty(k) && headers[k] != null) {
      cleanHeaders[k] = headers[k];
    }
  }

  return new Promise(function (resolve, reject) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      responseType: 'blob',
      headers: cleanHeaders,
      onload: function (r) {
        if (r.status === 200 && r.response && r.response.size > 100) {
          resolve(r.response);
        } else {
          reject(new Error('HTTP ' + r.status));
        }
      },
      onerror: function () { reject(new Error('Network error')); },
      ontimeout: function () { reject(new Error('Timeout')); },
      timeout: 20000
    });
  });
}

/**
 * 5-step fallback chain for fetching an image blob.
 * @param {string} src - Image URL
 * @param {Element|null} el - Source DOM element (for canvas fallback)
 * @returns {Promise<Blob>}
 */
async function fetchBlobWithFallbacks(src, el) {
  if (src && src.startsWith('data:')) {
    var resp = await fetch(src);
    return resp.blob();
  }

  var errs = [];

  try { return await fetchBlob(src); }
  catch (e) { errs.push(e.message); }

  try { return await fetchBlob(src, { Origin: null }); }
  catch (e) { errs.push(e.message); }

  try { return await fetchBlob(src, { Referer: null, Origin: null }); }
  catch (e) { errs.push(e.message); }

  try {
    var r = await fetch(src, { credentials: 'include' });
    if (r.ok) return r.blob();
    throw new Error('HTTP ' + r.status);
  } catch (e) { errs.push(e.message); }

  try {
    if (el && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) {
      var c = document.createElement('canvas');
      c.width = el.naturalWidth;
      c.height = el.naturalHeight;
      c.getContext('2d').drawImage(el, 0, 0);
      return await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.92); });
    }
    throw new Error('Not a loaded img');
  } catch (e) { errs.push(e.message); }

  throw new Error(errs.join(' | '));
}

/**
 * Fetches an image with retry and exponential backoff.
 * @param {string} src
 * @param {Element|null} el
 * @param {Function} isAborted - Returns true if operation was aborted
 * @returns {Promise<Blob>}
 */
async function fetchWithRetry(src, el, isAborted) {
  var lastErr;
  for (var attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
    if (isAborted && isAborted()) throw new Error('Aborted');
    try {
      return await fetchBlobWithFallbacks(src, el);
    } catch (e) {
      lastErr = e;
      if (attempt < FETCH_RETRY_COUNT) {
        await sleep(600 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

/**
 * Finds split points for tall panels.
 * @param {number} h - Image height in pixels
 * @returns {number[]} Array of y-coordinate split points
 */
export function findSplitPoints(h) {
  if (h <= MAX_SEG_H) return [0, h];
  var pts = [0];
  for (var y = MAX_SEG_H; y < h; y += MAX_SEG_H) pts.push(y);
  pts.push(h);
  if (pts.length > 2 && pts[pts.length - 1] - pts[pts.length - 2] < MIN_SEG_H) {
    pts.splice(pts.length - 2, 1);
  }
  return pts;
}

/**
 * Downloads an image and processes it into one or more segments.
 * Tall images are split at MAX_SEG_H intervals.
 * @param {string} url - Image URL
 * @param {number} pageNum - Sequential page number (for filename)
 * @param {Element|null} srcEl - Source DOM element for canvas fallback
 * @param {Function} isAborted - Returns true if operation was aborted
 * @returns {Promise<Array<{filename: string, blob: Blob, previewUrl: string, w: number, h: number}>>}
 */
export async function processImage(url, pageNum, srcEl, isAborted) {
  var blob = await fetchWithRetry(url, srcEl, isAborted);

  // Fast path: known dimensions, no split needed, already JPEG/PNG
  var ew = srcEl ? srcEl.naturalWidth : 0;
  var eh = srcEl ? srcEl.naturalHeight : 0;
  if (ew > 0 && eh > 0 && eh <= MAX_SEG_H && blob.type !== 'image/webp') {
    var ext = blob.type === 'image/png' ? 'png' : 'jpg';
    var pad = ('000' + pageNum).slice(-3);
    return [{
      filename: 'page_' + pad + '.' + ext,
      blob: blob,
      previewUrl: URL.createObjectURL(blob),
      w: ew,
      h: eh
    }];
  }

  // Decode via ObjectURL to get dimensions
  var objUrl = URL.createObjectURL(blob);
  var img;
  try {
    img = await new Promise(function (res, rej) {
      var el = new Image();
      el.onload = function () { res(el); };
      el.onerror = function () { rej(new Error('Decode failed')); };
      el.src = objUrl;
    });
  } finally {
    URL.revokeObjectURL(objUrl);
  }

  var w = img.naturalWidth;
  var h = img.naturalHeight;
  var pts = findSplitPoints(h);
  var srcExt = (pts.length === 2 && blob.type === 'image/png') ? 'png' : 'jpg';
  var pad2 = ('000' + pageNum).slice(-3);
  var results = [];

  for (var i = 0; i < pts.length - 1; i++) {
    var y0 = pts[i];
    var segH = pts[i + 1] - y0;
    var suffix = pts.length === 2 ? '' : '_part' + (i + 1);
    var filename = 'page_' + pad2 + suffix + '.' + srcExt;

    if (pts.length === 2 && blob.type !== 'image/webp') {
      // No split needed and not WebP — reuse original blob
      results.push({
        filename: filename,
        blob: blob,
        previewUrl: URL.createObjectURL(blob),
        w: w,
        h: segH
      });
    } else {
      // Need to split or re-encode — use canvas
      var segBlob = await new Promise(function (r) {
        var cv = document.createElement('canvas');
        cv.width = w;
        cv.height = segH;
        cv.getContext('2d').drawImage(img, 0, y0, w, segH, 0, 0, w, segH);
        cv.toBlob(r, 'image/jpeg', 0.92);
      });
      results.push({
        filename: filename,
        blob: segBlob,
        previewUrl: URL.createObjectURL(segBlob),
        w: w,
        h: segH
      });
    }
  }

  return results;
}

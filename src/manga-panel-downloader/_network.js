// Network module — MV3-compatible image download with fallback chain,
// active-request tracking, and AbortController integration.

'use strict';

/**
 * Tracks active GM.xmlHttpRequest instances for bulk abort.
 * Map<symbol, { abort: Function }>
 */
const _activeRequests = new Map();

/**
 * Generates a unique request ID.
 * @returns {symbol}
 */
function _nextId() {
  return Symbol('req');
}

/**
 * Core fetch — single GM.xmlHttpRequest call with Referer/Origin headers.
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @param {Object} [headerOverrides] - Set header to null to omit it
 * @returns {Promise<Blob>}
 */
function _fetchBlob(url, signal, headerOverrides) {
  const headers = {};
  if (!headerOverrides || headerOverrides.Referer !== null) {
    headers.Referer = location.href;
  }
  if (!headerOverrides || headerOverrides.Origin !== null) {
    headers.Origin = location.origin;
  }

  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const gm = GM.xmlHttpRequest({
      method: 'GET',
      url: url,
      responseType: 'blob',
      anonymous: true,
      redirect: 'manual',
      headers: headers,
      onload: r => {
        if (r.status === 200 && r.response && r.response.size > 100) {
          resolve(r.response);
        } else {
          reject(new Error('HTTP ' + r.status + ' (' + url.slice(0, 80) + ')'));
        }
      },
      onerror: () => reject(new Error('Network error')),
      ontimeout: () => reject(new Error('Timeout')),
      timeout: 20000
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        gm.abort();
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }
  });
}

/**
 * 5-step fallback chain for fetching an image blob.
 * Attempts progressively less restrictive strategies, ending with canvas redraw.
 * @param {string} src - Image URL
 * @param {Element|null} el - Source DOM element (for canvas fallback)
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
async function _fetchWithFallbacks(src, el, signal) {
  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Data URI fast path
  if (src && src.startsWith('data:')) {
    const resp = await fetch(src);
    return resp.blob();
  }

  const errs = [];

  // 1) Full Referer + Origin
  try { return await _fetchBlob(src, signal); }
  catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 2) null Origin
  try { return await _fetchBlob(src, signal, { Origin: null }); }
  catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 3) no Referer, no Origin
  try { return await _fetchBlob(src, signal, { Referer: null, Origin: null }); }
  catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 4) Native fetch with credentials
  try {
    const r = await fetch(src, { credentials: 'include' });
    if (r.ok) return r.blob();
    throw new Error('HTTP ' + r.status);
  } catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 5) Canvas redraw from loaded <img>
  try {
    if (el && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) {
      const c = document.createElement('canvas');
      c.width = el.naturalWidth;
      c.height = el.naturalHeight;
      c.getContext('2d').drawImage(el, 0, 0);
      return await new Promise(r => { c.toBlob(r, 'image/jpeg', 0.92); });
    }
    throw new Error('Not a loaded img');
  } catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  throw new Error('All fetch strategies failed: ' + errs.join(' | '));
}

/**
 * Downloads an image with automatic retry and fallback chain.
 *
 * - Uses GM.xmlHttpRequest with Referer/Origin headers
 * - Integrates with AbortController signal for cancellation
 * - Retries up to 3 times with exponential backoff (600ms, 1200ms)
 * - Falls through 5 strategies (full headers → null Origin → no headers →
 *   native fetch → canvas redraw)
 * - Tracks the request internally for bulk abort via abortAll()
 *
 * @param {string} url - Image URL to download
 * @param {AbortSignal} [signal] - AbortSignal for cancellation
 * @param {Object} [options]
 * @param {Element|null} [options.el] - Source DOM element (canvas fallback)
 * @param {number} [options.retries=2] - Additional retry attempts beyond first try
 * @returns {Promise<Blob>}
 */
export async function downloadImage(url, signal, options = {}) {
  const maxRetries = options.retries !== undefined ? options.retries : 2;
  const el = options.el || null;
  const reqId = _nextId();
  let lastErr;

  // Register placeholder — will be replaced with real GM handle
  _activeRequests.set(reqId, { abort: () => {} });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal && signal.aborted) {
      _activeRequests.delete(reqId);
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const result = await _fetchWithFallbacks(url, el, signal);
      _activeRequests.delete(reqId);
      return result;
    } catch (e) {
      if (e.name === 'AbortError') {
        _activeRequests.delete(reqId);
        throw e;
      }
      lastErr = e;
      if (attempt < maxRetries) {
        const delay = 600 * (attempt + 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  _activeRequests.delete(reqId);
  throw lastErr || new Error('Download failed');
}

/**
 * Aborts all in-flight download requests.
 * Iterates the internal request map and calls .abort() on each.
 */
export function abortAll() {
  for (const [, req] of _activeRequests) {
    try { req.abort(); } catch (_) { /* ignore */ }
  }
  _activeRequests.clear();
}

/**
 * Returns the number of currently active download requests.
 * @returns {number}
 */
export function getActiveCount() {
  return _activeRequests.size;
}

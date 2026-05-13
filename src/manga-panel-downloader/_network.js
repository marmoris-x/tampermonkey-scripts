// Network module — image download with fallback chain, concurrency control,
// and AbortController integration for GM_xmlhttpRequest.

'use strict';

/**
 * Semaphore for limiting concurrent downloads.
 * Ensures at most `max` simultaneous GM_xmlhttpRequest calls.
 */
class Semaphore {
  /** @param {number} max - Maximum concurrent acquisitions */
  constructor(max) {
    this._max = max;
    this._current = 0;
    this._queue = [];
  }

  /**
   * Acquires a permit. Resolves when a slot is available.
   * @returns {Promise<void>}
   */
  acquire() {
    if (this._current < this._max) {
      this._current++;
      return Promise.resolve();
    }
    return new Promise(resolve => { this._queue.push(resolve); });
  }

  /** Releases a permit, allowing the next waiter to proceed. */
  release() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._current--;
    }
  }
}

/**
 * Shared download semaphore — max 6 concurrent requests (matching CONCURRENT_DL).
 * @type {Semaphore}
 */
const downloadSemaphore = new Semaphore(6);

/**
 * Fetches a blob via GM_xmlhttpRequest with custom headers.
 * Supports AbortController signal and semaphore-based concurrency limiting.
 * @param {string} url - Image URL to fetch
 * @param {Object} [extraHeaders] - Extra headers to merge (set null to omit default)
 * @param {AbortSignal} [signal] - AbortSignal for cancellation
 * @param {Function} [onProgress] - Progress callback (receives {loaded, total} or undefined)
 * @returns {Promise<Blob>}
 */
function fetchBlob(url, extraHeaders, signal, onProgress) {
  const extra = extraHeaders || {};
  const headers = {};
  headers.Referer = location.href;
  headers.Origin = location.origin;
  for (const key in extra) {
    if (extra.hasOwnProperty(key)) {
      headers[key] = extra[key];
    }
  }
  const cleanHeaders = {};
  for (const k in headers) {
    if (headers.hasOwnProperty(k) && headers[k] != null) {
      cleanHeaders[k] = headers[k];
    }
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
      headers: cleanHeaders,
      onload: r => {
        if (r.status === 200 && r.response && r.response.size > 100) {
          resolve(r.response);
        } else {
          reject(new Error('HTTP ' + r.status));
        }
      },
      onerror: () => reject(new Error('Network error')),
      ontimeout: () => reject(new Error('Timeout')),
      timeout: 20000
    });

    // Wire AbortController signal to GM_xmlhttpRequest.abort()
    if (signal) {
      signal.addEventListener('abort', () => {
        gm.abort();
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }

    // MV3: GM_xmlhttpRequest does not support progress events on Chrome
    // Pass-through for potential future compatibility
    if (onProgress) {
      onProgress(undefined);
    }
  });
}

/**
 * 5-step fallback chain for fetching an image blob.
 * Attempts progressively less restrictive fetch strategies, ending with canvas redraw.
 * @param {string} src - Image URL
 * @param {Element|null} el - Source DOM element (for canvas fallback)
 * @param {AbortSignal} [signal] - AbortSignal for cancellation
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<Blob>}
 */
async function fetchBlobWithFallbacks(src, el, signal, onProgress) {
  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  if (src && src.startsWith('data:')) {
    const resp = await fetch(src);
    return resp.blob();
  }

  const errs = [];

  try { return await fetchBlob(src, {}, signal, onProgress); }
  catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  try { return await fetchBlob(src, { Origin: null }, signal, onProgress); }
  catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  try { return await fetchBlob(src, { Referer: null, Origin: null }, signal, onProgress); }
  catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

  try {
    const r = await fetch(src, { credentials: 'include' });
    if (r.ok) return r.blob();
    throw new Error('HTTP ' + r.status);
  } catch (e) { if (e.name === 'AbortError') throw e; errs.push(e.message); }

  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

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

  throw new Error(errs.join(' | '));
}

/**
 * Fetches an image with retry and exponential backoff.
 * @param {string} src - Image URL
 * @param {Element|null} el - Source DOM element for canvas fallback
 * @param {Function} isAborted - Returns true if operation was aborted
 * @param {AbortSignal} [signal] - AbortSignal for cancellation
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<Blob>}
 */
async function fetchWithRetry(src, el, isAborted, signal, onProgress) {
  const FETCH_RETRY_COUNT = 2;
  let lastErr;
  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
    if (isAborted && isAborted()) throw new Error('Aborted');
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      await downloadSemaphore.acquire();
      const result = await fetchBlobWithFallbacks(src, el, signal, onProgress);
      downloadSemaphore.release();
      return result;
    } catch (e) {
      downloadSemaphore.release();
      if (e.name === 'AbortError') throw e;
      lastErr = e;
      if (attempt < FETCH_RETRY_COUNT) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export { Semaphore, downloadSemaphore, fetchBlob, fetchBlobWithFallbacks, fetchWithRetry };

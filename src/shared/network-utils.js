// src/shared/network-utils.js — Promise-based GM_xmlhttpRequest wrappers with retry
// Standardizes fetch patterns across all network-heavy scripts.
// Consumers: AniSearch, Manga Panel, Recaptcha Solver, Marketplace Deal Finder, Copy as Markdown

/**
 * Performs an HTTP GET via GM_xmlhttpRequest and returns the responseText parsed as a Document.
 * @param {string} url
 * @param {{ retries?: number, timeout?: number, anonymous?: boolean }} [opts]
 * @returns {Promise<Document>}
 */
globalThis.TM = globalThis.TM || {};
globalThis.TM.network = {
  fetchPage: fetchPage,
  fetchJSON: fetchJSON,
  fetchBlob: fetchBlob
};

export function fetchPage(url, opts) {
  opts = opts || {};
  var retries = opts.retries || 0;
  var timeout = opts.timeout || 15000;
  return new Promise(function (resolve, reject) {
    function attempt(n) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        timeout: timeout,
        anonymous: opts.anonymous !== false,
        onload: function (r) {
          if (r.status >= 200 && r.status < 300) {
            try {
              var parser = new DOMParser();
              var doc = parser.parseFromString(r.responseText, 'text/html');
              resolve(doc);
            } catch (e) { reject(new Error('DOMParser failed: ' + e.message)); }
          } else if (n < retries) {
            attempt(n + 1);
          } else {
            reject(new Error('HTTP ' + r.status + ' for ' + url));
          }
        },
        onerror: function () {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Network error for ' + url));
        },
        ontimeout: function () {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Timeout for ' + url));
        }
      });
    }
    attempt(0);
  });
}

/**
 * Performs an HTTP GET via GM_xmlhttpRequest and returns parsed JSON.
 * @param {string} url
 * @param {{ retries?: number, timeout?: number, anonymous?: boolean }} [opts]
 * @returns {Promise<*>}
 */
export function fetchJSON(url, opts) {
  opts = opts || {};
  var retries = opts.retries || 0;
  var timeout = opts.timeout || 15000;
  return new Promise(function (resolve, reject) {
    function attempt(n) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        timeout: timeout,
        anonymous: opts.anonymous !== false,
        onload: function (r) {
          if (r.status >= 200 && r.status < 300) {
            try { resolve(JSON.parse(r.responseText)); }
            catch (e) { reject(new Error('JSON parse failed: ' + e.message)); }
          } else if (n < retries) {
            attempt(n + 1);
          } else {
            reject(new Error('HTTP ' + r.status + ' for ' + url));
          }
        },
        onerror: function () {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Network error for ' + url));
        },
        ontimeout: function () {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Timeout for ' + url));
        }
      });
    }
    attempt(0);
  });
}

/**
 * Fetches a binary blob via GM_xmlhttpRequest.
 * @param {string} url
 * @param {{ retries?: number, timeout?: number }} [opts]
 * @returns {Promise<{blob: Blob, headers: Object}>}
 */
export function fetchBlob(url, opts) {
  opts = opts || {};
  var retries = opts.retries || 2;
  var timeout = opts.timeout || 30000;
  return new Promise(function (resolve, reject) {
    function attempt(n) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        timeout: timeout,
        responseType: 'blob',
        onload: function (r) {
          if (r.status >= 200 && r.status < 300) resolve({ blob: r.response, headers: r.responseHeaders });
          else if (n < retries) attempt(n + 1);
          else reject(new Error('HTTP ' + r.status + ' for ' + url));
        },
        onerror: function () {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Network error for ' + url));
        },
        ontimeout: function () {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Timeout for ' + url));
        }
      });
    }
    attempt(0);
  });
}

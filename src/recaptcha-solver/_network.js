/**
 * Performs an HTTP GET via GM_xmlhttpRequest and returns parsed JSON.
 * @param {string} url
 * @param {{ retries?: number, timeout?: number, anonymous?: boolean }} [opts]
 * @returns {Promise<*>}
 */
export function fetchJSON(url, opts) {
  opts = opts || {};
  const retries = opts.retries || 0;
  const timeout = opts.timeout || 15000;
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

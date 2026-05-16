'use strict';

import { createLogger } from './_logger.js';

/**
 * Performs an HTTP GET via GM_xmlhttpRequest and returns parsed JSON.
 * @param {string} url
 * @param {{ retries?: number, timeout?: number, anonymous?: boolean }} [opts]
 * @returns {Promise<*>}
 */
export function fetchJSON(url, opts = {}) {
  const retries = opts.retries || 0;
  const timeout = opts.timeout || 15000;

  return new Promise((resolve, reject) => {
    function attempt(n) {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout,
        anonymous: opts.anonymous !== false,
        onload(r) {
          if (r.status >= 200 && r.status < 300) {
            try { resolve(JSON.parse(r.responseText)); }
            catch (e) { reject(new Error('JSON parse failed: ' + e.message)); }
          } else if (n < retries) {
            attempt(n + 1);
          } else {
            reject(new Error('HTTP ' + r.status + ' for ' + url));
          }
        },
        onerror() {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Network error for ' + url));
        },
        ontimeout() {
          if (n < retries) attempt(n + 1);
          else reject(new Error('Timeout for ' + url));
        }
      });
    }
    attempt(0);
  });
}

// ── Server Latency Measurement ─────────────────────────────────────────────────

/** @type {number[]} Latency measurements for each server (index-matched to SERVERS) */
export let latencies = [];

/**
 * Measures latency to all configured servers via lightweight GET.
 * Stores results in the module-level `latencies` array (index-matched to `servers`).
 * Non-blocking — resolves when all pings complete.
 * @param {string[]} servers - Array of server URLs to ping
 * @returns {Promise<number[]>} Resolves with the latencies array
 */
export function measureServerLatencies(servers) {
  const log = createLogger('Recaptcha Solver');
  latencies = servers.map(() => Infinity);

  return Promise.all(servers.map((url, i) => {
    const t0 = Date.now();
    return fetchJSON(url, { timeout: 8000 })
      .then(() => {
        latencies[i] = Date.now() - t0;
        log.log(`Ping ${url}: ${latencies[i]}ms`);
      })
      .catch(() => {
        latencies[i] = Infinity;
      });
  }));
}

/**
 * Selects the best (lowest latency) server, optionally excluding one.
 * Falls back to first non-excluded server if no latency data available.
 * @param {string[]} servers - Server URLs
 * @param {number[]} latenciesArr - Matching latency measurements
 * @param {string} [exclude] - Server URL to exclude (previously failed)
 * @returns {string} Best server URL
 */
export function getBestServer(servers, latenciesArr, exclude) {
  let best = null;
  let bestMs = Infinity;

  for (let i = 0; i < servers.length; i++) {
    if (servers[i] === exclude) continue;
    if (latenciesArr[i] < bestMs) {
      bestMs = latenciesArr[i];
      best = servers[i];
    }
  }
  return best || servers.filter(s => s !== exclude)[0] || servers[0];
}

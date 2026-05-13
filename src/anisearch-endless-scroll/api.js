/**
 * Custom error classes for fetch operations.
 */
export class NetworkError extends Error {
  constructor(url, message = 'Network error') {
    super(`${message} for ${url}`);
    this.name = 'NetworkError';
  }
}
export class HttpStatusError extends Error {
  constructor(url, status) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}
export class TimeoutError extends Error {
  constructor(url) {
    super(`Timeout for ${url}`);
    this.name = 'TimeoutError';
  }
}

/**
 * Performs an HTTP GET via GM_xmlhttpRequest and returns the responseText parsed as a Document.
 * @param {string} url
 * @param {{ retries?: number, timeout?: number, anonymous?: boolean }} [opts]
 * @returns {Promise<Document>}
 */
export function fetchPage(url, opts = {}) {
  const retries = opts.retries ?? 2;
  const timeout = opts.timeout ?? 15000;
  const anonymous = opts.anonymous !== false;

  return new Promise((resolve, reject) => {
    function attempt(n) {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout,
        anonymous,
        onload(r) {
          if (r.status >= 200 && r.status < 300) {
            try {
              const doc = new DOMParser().parseFromString(r.responseText, 'text/html');
              resolve(doc);
            } catch (e) {
              reject(new Error(`DOMParser failed: ${e.message}`));
            }
          } else if (n < retries) {
            attempt(n + 1);
          } else {
            reject(new HttpStatusError(url, r.status));
          }
        },
        onerror() {
          if (n < retries) attempt(n + 1);
          else reject(new NetworkError(url));
        },
        ontimeout() {
          if (n < retries) attempt(n + 1);
          else reject(new TimeoutError(url));
        },
      });
    }
    attempt(0);
  });
}

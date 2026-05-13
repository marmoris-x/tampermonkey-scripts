'use strict';

/**
 * Navigation module for Manga Panel Downloader.
 * Handles page-to-page navigation for manga reading sites.
 * Uses window.onurlchange when available (TM SPA support), falls back to polling.
 * @module _navigation
 */

/**
 * Sleep helper.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Derives the next page URL from common page-number patterns.
 * Supports ?page=N (query parameter) and /path/N/ (path segment) patterns.
 * @param {string} url - Current page URL
 * @returns {string|null} Next page URL or null if not detectable
 */
function guessNextUrl(url) {
  try {
    const u = new URL(url);
    if (u.searchParams.has('page')) {
      const n = parseInt(u.searchParams.get('page'), 10);
      if (!isNaN(n)) {
        const next = new URL(url);
        next.searchParams.set('page', n + 1);
        return next.href;
      }
    }
    const m = u.pathname.match(/^(.*\/)(\d+)(\/?)$/);
    if (m) {
      const pn = parseInt(m[2], 10);
      if (!isNaN(pn) && pn > 0 && pn < 10000) {
        return u.origin + m[1] + (pn + 1) + m[3] + u.search;
      }
    }
  } catch (_) {
    // Invalid URL — silently ignore
  }
  return null;
}

/**
 * Finds and clicks the next-page button using common CSS selectors and text content.
 * Tests selectors first (rel, class, aria-label, title), then falls back to
 * text content matching on all <a> and <button> elements.
 * @returns {boolean} True if a next-page button was found and clicked
 */
function clickNextPage() {
  const selectors = [
    'a[rel="next"]',
    '[class*="next"]:not([disabled])',
    '[aria-label*="next" i]',
    '[title*="next" i]',
    '[aria-label*="weiter" i]',
    '[title*="weiter" i]',
  ];
  for (let i = 0; i < selectors.length; i++) {
    const el = document.querySelector(selectors[i]);
    if (el) { el.click(); return true; }
  }

  const links = document.querySelectorAll('a, button');
  for (let j = 0; j < links.length; j++) {
    const t = (links[j].textContent || '').trim().toLowerCase();
    if (t === 'next' || t === 'weiter' || t === '>' || t === '›' || t === '→') {
      links[j].click();
      return true;
    }
  }
  return false;
}

/**
 * Navigates to the next page.
 * Tries SPA-friendly button click first, then falls back to URL-based navigation.
 */
export function navigateNext() {
  if (clickNextPage()) return;
  const nextUrl = guessNextUrl(location.href);
  if (nextUrl) location.href = nextUrl;
}

/**
 * Waits for the page URL to change from prevUrl within a timeout.
 * Uses `window.onurlchange` (TM SPA API) when available for efficient detection.
 * Falls back to polling at 80ms intervals.
 * @param {string} prevUrl - The previous URL to compare against
 * @param {number} [timeout=5000] - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} True if the URL changed within the timeout
 */
export function waitForUrlChange(prevUrl, timeout = 5000) {
  return new Promise((resolve) => {
    // window.onurlchange is null when granted via @grant — use SPA event
    if (window.onurlchange === null) {
      const handler = (info) => {
        if (info.url !== prevUrl) {
          window.removeEventListener('urlchange', handler);
          resolve(true);
        }
      };
      window.addEventListener('urlchange', handler);
      setTimeout(() => {
        window.removeEventListener('urlchange', handler);
        resolve(false);
      }, timeout);
    } else {
      // Fallback: poll location.href at 80ms intervals
      const id = setInterval(() => {
        if (location.href !== prevUrl) {
          clearInterval(id);
          resolve(true);
        }
      }, 80);
      setTimeout(() => {
        clearInterval(id);
        resolve(false);
      }, timeout);
    }
  });
}

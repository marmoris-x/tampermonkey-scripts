// src/anisearch-endless-scroll/endless-loop.js — Core pagination loop
// No external shared dependencies.

import { createLogger } from './logger.js';
import { fetchPage, NetworkError, HttpStatusError, TimeoutError } from './api.js';
import { passesRating } from './rating-filter.js';
import { setStatus, showLoader, removeStatus, hidePagination } from './ui.js';

const log = createLogger('AniSearch Endless Scroll');

// ---- Constants ----

const FETCH_DELAY_MS     = 800;   // Base pause between page requests (+ up to 400ms jitter)
const MAX_PAGES          = 200;   // Absolute safety limit
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RETRIES        = 3;

// All AniSearch view modes
const CONTAINER_SELECTORS = [
  'ul.gallery',
  'ul.covers',
  'ul.list',
  'table.table tbody',
];

const ITEM_SELECTOR_MAP = {
  'ul.gallery':        'li',
  'ul.covers':         'li',
  'ul.list':           'li',
  'table.table tbody': 'tr',
};

// ---- Run-ID management for SPA safety ----

let _currentRunId = 0;

/**
 * Increments and returns a new run ID, invalidating any in-progress loops.
 * @returns {number} New run ID
 */
export function newRun() {
  return ++_currentRunId;
}

/**
 * Checks whether a run ID is still current (loop not superseded).
 * @param {number} runId - The run ID to check
 * @returns {boolean}
 */
export function isCurrentRun(runId) {
  return runId === _currentRunId;
}

// ---- DOM Helpers ----

/**
 * Finds the content container and its selector for the current page.
 * @param {Document} [doc] - Document to search (defaults to current)
 * @returns {{ container: Element, selector: string } | null}
 */
export function findContainer(doc = document) {
  for (const sel of CONTAINER_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el) return { container: el, selector: sel };
  }
  return null;
}

/**
 * Returns the item selector for a given container selector.
 * @param {string} containerSelector - The container CSS selector
 * @returns {string} The item CSS selector
 */
function getItemSel(containerSelector) {
  return ITEM_SELECTOR_MAP[containerSelector] || 'li';
}

/**
 * Returns the absolute next page URL from the document or null.
 * Handles absolute, relative-with-slash, and relative-without-slash URL formats.
 * @param {Document} [doc] - Document to search (defaults to current)
 * @returns {string|null}
 */
export function findNextUrl(doc = document) {
  const candidates = [
    '.pagenav a.pagenav-next',
    'a.pagenav-next',
    'nav.pagination a[rel="next"]',
    '.pagination a[rel="next"]',
    'a[rel="next"]',
  ];

  for (const sel of candidates) {
    const el = doc.querySelector(sel);
    if (!el) continue;

    const raw = (el.getAttribute('href') || '').trim();
    if (!raw || raw === '#') continue;

    try {
      if (/^https?:\/\//i.test(raw)) {
        const u = new URL(raw);
        if (u.href !== window.location.href) return u.href;
        continue;
      }

      if (raw.startsWith('/')) {
        return new URL(raw, window.location.origin).href;
      }

      // Relative WITHOUT leading slash (e.g. "anime/index/page-2?...")
      // Resolve against origin + '/' to prevent path duplication
      return new URL(`/${raw}`, window.location.origin).href;

    } catch {
      // Malformed URL — try next candidate
    }
  }
  return null;
}

/**
 * Promise-based delay for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Appends a cloned item element to a container using rAF for batch DOM timing.
 * @param {Element} container - Target container
 * @param {Element} itemEl - Item element to clone and append
 */
function appendItem(container, itemEl) {
  requestAnimationFrame(() => {
    container.appendChild(document.importNode(itemEl, true));
  });
}

// ---- Core: Endless Fetch Loop ----

/**
 * Main pagination loop: fetches all available pages and appends items.
 * Filters each page by rating and respects the stale-loop guard.
 * @param {number|null} ratingMin - Minimum rating filter (null = no filter)
 * @param {{ container: Element, selector: string }} found - Container info
 * @param {number} runId - Current run ID for staleness checking
 */
export async function runEndlessLoop(ratingMin, found, runId) {
  const container = found.container;
  const selector = found.selector;
  const itemSel = getItemSel(selector);

  // Step 1: Filter current page
  const existingItems = Array.from(container.querySelectorAll(itemSel));
  let filteredCount = 0;

  for (const item of existingItems) {
    if (!passesRating(item, ratingMin)) {
      item.style.display = 'none';
      item.setAttribute('data-as-hidden', 'rating');
      filteredCount++;
    }
  }

  const visibleOnPage1 = existingItems.length - filteredCount;

  // Hide pagination — we take control
  hidePagination();

  let nextUrl = findNextUrl(document);

  if (!nextUrl) {
    setStatus(
      `✔ All entries loaded\n  ${visibleOnPage1} items` +
      (ratingMin !== null ? `\n  Rating ≥ ${ratingMin}` : '')
    );
    return;
  }

  setStatus(
    `⟳ Page 1 — ${visibleOnPage1} items\n  Loading page 2…`
  );
  showLoader(true, container);

  // Step 2: Fetch all subsequent pages
  let currentPage  = 2;
  let totalVisible = visibleOnPage1;
  let totalHidden  = filteredCount;
  const visitedUrls = new Set([window.location.href]);

  while (nextUrl && currentPage <= MAX_PAGES) {
    // Loop guard: URL already visited?
    if (visitedUrls.has(nextUrl)) {
      log.warn('Loop detected, stopping:', nextUrl);
      break;
    }
    visitedUrls.add(nextUrl);

    log.log('Fetching page', currentPage, '→', nextUrl);

    let fetchedDoc;
    try {
      fetchedDoc = await fetchPage(nextUrl, {
        retries: MAX_RETRIES - 1,
        timeout: REQUEST_TIMEOUT_MS,
      });
    } catch (err) {
      let reason;
      if (err instanceof NetworkError) reason = 'Network error';
      else if (err instanceof TimeoutError) reason = 'Timeout';
      else if (err instanceof HttpStatusError) reason = `HTTP ${err.status}`;
      else reason = err.message || 'Unknown error';

      log.warn(`Page ${currentPage} failed after ${MAX_RETRIES} attempts:`, reason);
      setStatus(`⚠ Page ${currentPage} failed\n  ${reason}`);
      showLoader(false);
      break;
    }

    // Stale? (user navigated to a different page)
    if (!isCurrentRun(runId)) {
      showLoader(false);
      removeStatus();
      return;
    }

    // Extract items from fetched page
    const fetchedFound = findContainer(fetchedDoc);
    if (!fetchedFound) {
      log.warn(`Container on page ${currentPage} not found.`);
      break;
    }

    const newItems = Array.from(
      fetchedFound.container.querySelectorAll(getItemSel(fetchedFound.selector))
    );

    if (newItems.length === 0) {
      // Empty page → truly last page
      break;
    }

    // Apply rating filter and append items
    showLoader(false);

    for (const item of newItems) {
      if (passesRating(item, ratingMin)) {
        appendItem(container, item);
        totalVisible++;
      } else {
        totalHidden++;
      }
    }

    // Read next page from fetched document
    nextUrl = findNextUrl(fetchedDoc);

    setStatus(
      `⟳ Page ${currentPage} loaded\n` +
      `  Shown: ${totalVisible}  (${totalHidden} filtered)\n` +
      (nextUrl ? `  Loading page ${currentPage + 1}…` : '  Last page reached')
    );

    if (nextUrl) {
      showLoader(true, container);
      await delay(FETCH_DELAY_MS + Math.random() * 400);
      if (!isCurrentRun(runId)) {
        showLoader(false);
        removeStatus();
        return;
      }
    }

    currentPage++;
  }

  // Step 3: Completion
  showLoader(false);

  const cappedByLimit = currentPage > MAX_PAGES;
  setStatus(
    `${cappedByLimit ? '⚠' : '✔'} Done!` +
    `\n  ${totalVisible} entries visible` +
    (totalHidden > 0 ? `\n  ${totalHidden} hidden by rating filter` : '') +
    (ratingMin !== null ? `\n  Rating ≥ ${ratingMin}` : '') +
    `\n  ${currentPage - 1} pages scanned` +
    (cappedByLimit ? '\n  ⚠ Page limit reached!' : '')
  );
}

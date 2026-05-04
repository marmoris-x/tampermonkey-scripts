// src/anisearch-endless-scroll/endless-loop.js — Core pagination loop
// Provides: findContainer, findNextUrl, runEndlessLoop, runId management

import { createLogger } from '../shared/logging-utils.js';
import { fetchPage } from '../shared/network-utils.js';
import { passesRating } from './rating-filter.js';
import { setStatus, showLoader, removeStatus } from './ui-statusbar.js';

var log = createLogger('AniSearch Endless Scroll');

// ---- Constants ----

var FETCH_DELAY_MS     = 800;   // Base pause between page requests (+ up to 400ms jitter)
var MAX_PAGES          = 200;   // Absolute safety limit
var REQUEST_TIMEOUT_MS = 20000;
var MAX_RETRIES        = 3;

// All AniSearch view modes
var CONTAINER_SELECTORS = [
  'ul.gallery',
  'ul.covers',
  'ul.list',
  'table.table tbody',
];

var ITEM_SELECTOR_MAP = {
  'ul.gallery':        'li',
  'ul.covers':         'li',
  'ul.list':           'li',
  'table.table tbody': 'tr',
};

// ---- Run-ID management for SPA safety ----

var _currentRunId = 0;

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
export function findContainer(doc) {
  doc = doc || document;
  for (var i = 0; i < CONTAINER_SELECTORS.length; i++) {
    var el = doc.querySelector(CONTAINER_SELECTORS[i]);
    if (el) return { container: el, selector: CONTAINER_SELECTORS[i] };
  }
  return null;
}

/**
 * Returns the item selector for a given container selector.
 * @param {string} containerSelector - The container CSS selector
 * @returns {string} The item CSS selector
 */
export function getItemSel(containerSelector) {
  return ITEM_SELECTOR_MAP[containerSelector] || 'li';
}

/**
 * Returns the absolute next page URL from the document or null.
 * Handles absolute, relative-with-slash, and relative-without-slash URL formats.
 * @param {Document} [doc] - Document to search (defaults to current)
 * @returns {string|null}
 */
export function findNextUrl(doc) {
  doc = doc || document;
  var candidates = [
    '.pagenav a.pagenav-next',
    'a.pagenav-next',
    'nav.pagination a[rel="next"]',
    '.pagination a[rel="next"]',
    'a[rel="next"]',
  ];
  for (var i = 0; i < candidates.length; i++) {
    var el = doc.querySelector(candidates[i]);
    if (!el) continue;

    var raw = (el.getAttribute('href') || '').trim();
    if (!raw || raw === '#') continue;

    try {
      if (/^https?:\/\//i.test(raw)) {
        var u = new URL(raw);
        if (u.href !== window.location.href) return u.href;
        continue;
      }

      if (raw.startsWith('/')) {
        return new URL(raw, window.location.origin).href;
      }

      // Relative WITHOUT leading slash (e.g. "anime/index/page-2?...")
      // Resolve against origin + '/' to prevent path duplication
      return new URL('/' + raw, window.location.origin).href;

    } catch (e) {
      continue;
    }
  }
  return null;
}

/**
 * Hides all elements matching the given selectors.
 * @param {string[]} selectors - CSS selector array
 */
export function hideElements(selectors) {
  for (var i = 0; i < selectors.length; i++) {
    var els = document.querySelectorAll(selectors[i]);
    for (var j = 0; j < els.length; j++) {
      els[j].style.display = 'none';
    }
  }
}

/**
 * Hides all pagination elements on the page.
 */
export function hidePagination() {
  hideElements([
    '.pagenav', '.pagination', 'nav.pagination',
    '[class*="pagenav"]', '[class*="pagination"]',
  ]);
}

/**
 * Promise-based sleep for a given number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

/**
 * Appends a cloned item element to a container.
 * Uses importNode to avoid modifying the source document's DOM.
 * @param {Element} container - Target container
 * @param {Element} itemEl - Item element to clone and append
 */
function appendItem(container, itemEl) {
  container.appendChild(document.importNode(itemEl, true));
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
  var container = found.container;
  var selector = found.selector;
  var itemSel = getItemSel(selector);

  // Step 1: Filter current page
  var existingItems = Array.from(container.querySelectorAll(itemSel));
  var filteredCount = 0;

  for (var i = 0; i < existingItems.length; i++) {
    if (!passesRating(existingItems[i], ratingMin)) {
      existingItems[i].style.display = 'none';
      existingItems[i].setAttribute('data-as-hidden', 'rating');
      filteredCount++;
    }
  }

  var visibleOnPage1 = existingItems.length - filteredCount;

  // Hide pagination — we take control
  hidePagination();

  var nextUrl = findNextUrl(document);

  if (!nextUrl) {
    setStatus(
      '✔ Alle Einträge geladen\n  ' + visibleOnPage1 + ' Items' +
      (ratingMin !== null ? '\n  Rating ≥ ' + ratingMin : '')
    );
    return;
  }

  setStatus(
    '⟳ Seite 1 — ' + visibleOnPage1 + ' Items\n  Lade Seite 2…'
  );
  showLoader(true, container);

  // Step 2: Fetch all subsequent pages
  var currentPage  = 2;
  var totalVisible = visibleOnPage1;
  var totalHidden  = filteredCount;
  var visitedUrls  = new Set([window.location.href]);

  while (nextUrl && currentPage <= MAX_PAGES) {
    // Loop guard: URL already visited?
    if (visitedUrls.has(nextUrl)) {
      log.warn('Loop detected, stopping:', nextUrl);
      break;
    }
    visitedUrls.add(nextUrl);

    log.log('Fetching page', currentPage, '→', nextUrl);

    var fetchedDoc;
    try {
      fetchedDoc = await fetchPage(nextUrl, {
        retries: MAX_RETRIES - 1,
        timeout: REQUEST_TIMEOUT_MS
      });
    } catch (err) {
      log.warn('Page ' + currentPage + ' failed after ' + MAX_RETRIES + ' attempts:', err.message);
      setStatus(
        '⚠ Seite ' + currentPage + ' fehlgeschlagen\n  ' + err.message
      );
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
    var fetchedFound = findContainer(fetchedDoc);
    if (!fetchedFound) {
      log.warn('Container on page', currentPage, 'not found.');
      break;
    }

    var newItems = Array.from(
      fetchedFound.container.querySelectorAll(getItemSel(fetchedFound.selector))
    );

    if (newItems.length === 0) {
      // Empty page -> truly last page
      break;
    }

    // Apply rating filter and append items
    showLoader(false);

    for (var j = 0; j < newItems.length; j++) {
      if (passesRating(newItems[j], ratingMin)) {
        appendItem(container, newItems[j]);
        totalVisible++;
      } else {
        totalHidden++;
      }
    }

    // Read next page from fetched document
    nextUrl = findNextUrl(fetchedDoc);

    setStatus(
      '⟳ Seite ' + currentPage + ' geladen\n' +
      '  Sichtbar: ' + totalVisible + '  (' + totalHidden + ' gefiltert)\n' +
      (nextUrl ? '  Lade Seite ' + (currentPage + 1) + '…' : '  Letzte Seite erreicht')
    );

    if (nextUrl) {
      showLoader(true, container);
      await sleep(FETCH_DELAY_MS + Math.random() * 400);
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

  var cappedByLimit = currentPage > MAX_PAGES;
  setStatus(
    (cappedByLimit ? '⚠' : '✔') + ' Fertig!' +
    '\n  ' + totalVisible + ' Einträge sichtbar' +
    (totalHidden > 0 ? '\n  ' + totalHidden + ' via Rating-Filter entfernt' : '') +
    (ratingMin !== null ? '\n  Rating ≥ ' + ratingMin : '') +
    '\n  ' + (currentPage - 1) + ' Seiten durchsucht' +
    (cappedByLimit ? '\n  ⚠ Seiten-Limit erreicht!' : '')
  );
}

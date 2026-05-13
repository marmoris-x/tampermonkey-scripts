'use strict';

/**
 * Manga Mode module for Manga Panel Downloader.
 * Orchestrates multi-page image harvesting as an async generator.
 * Handles: scroll-loading, image extraction, page navigation, and abort control.
 * @module _manga-mode
 */

import { navigateNext, waitForUrlChange } from './_navigation.js';

/* --- Constants --- */

/** Maximum number of pages to scan in manga mode */
export const MAX_PAGES = 200;

/** Maximum concurrent downloads (informational — used by controller) */
export const CONCURRENT_DL = 6;

/** Navigation timing constants (ms) — matching _download-controller */
const NAV_CLICK_WAIT_MS = 50;
const NAV_LOAD_WAIT_MS = 150;

/* --- Abort Control --- */

let aborted = false;

/**
 * Resets the internal abort signal.
 * Call before starting a new harvest cycle.
 */
export function resetAbort() {
  aborted = false;
}

/**
 * Signals abort to stop any active harvest.
 * The harvest generator will stop on the next iteration check.
 */
export function abort() {
  aborted = true;
}

/**
 * Checks whether the harvest has been aborted.
 * @returns {boolean}
 */
function isAborted() {
  return aborted;
}

/**
 * Promise-based sleep.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* --- Harvest Generator --- */

/**
 * Harvests images across multiple manga pages.
 *
 * For each page in sequence:
 * 1. Triggers lazy image loading via scrollLoad
 * 2. Extracts image data via the getPageImages callback
 * 3. Yields the page result
 * 4. Navigates to the next page and waits for URL change
 *
 * The generator stops when any of these conditions are met:
 * - maxPages is reached
 * - abort() is called externally
 * - getPageImages returns an empty array (no images found)
 * - waitForUrlChange times out (navigation failed)
 *
 * @param {Object} options
 * @param {() => Promise<Array<Object>>} options.getPageImages
 *   Callback that extracts and returns image segment data for the current page.
 *   Called after scroll loading completes on each page.
 * @param {number} [options.maxPages=200] - Maximum number of pages to scan
 * @param {() => boolean} [options.externalAbort] - External abort check function
 * @yields {{ page: number, images: Array<Object>, status?: string, stop?: boolean }}
 *   - success: { page, images }
 *   - no images: { page, images: [], status: 'no-images', stop: true }
 *   - navigation timeout: { page, status: 'nav-timeout', stop: true }
 */
export async function* harvestPages({ getPageImages, maxPages = MAX_PAGES, externalAbort }) {
  let page = 1;
  let currentUrl = location.href;

  while (page <= maxPages) {
    // Check abort signals before processing a page
    if (externalAbort && externalAbort()) return;
    if (aborted) return;

    // Step 1: Extract images from the current page.
    // scrollLoad is intentionally NOT called here — in manga mode the
    // aggressive scrolling interferes with SPA readers (triggers unintended
    // page navigation). The getPageImages callback's internal poll loop
    // waits for images to appear without touching scroll position.
    const images = await getPageImages();

    // Check abort after potentially long-running getPageImages
    if (aborted || (externalAbort && externalAbort())) return;

    // Step 3: Yield page result or stop if no images found
    if (!images || images.length === 0) {
      yield { page, images: [], status: 'no-images', stop: true };
      return;
    }

    yield { page, images };

    // Step 4: Navigate to the next page
    navigateNext();
    await sleep(NAV_CLICK_WAIT_MS);

    // Step 5: Wait for URL change (with timeout)
    const changed = await waitForUrlChange(currentUrl);

    if (!changed) {
      yield { page, status: 'nav-timeout', stop: true };
      return;
    }

    // Brief pause for the new page to render images
    await sleep(NAV_LOAD_WAIT_MS);

    currentUrl = location.href;
    page++;
  }
}

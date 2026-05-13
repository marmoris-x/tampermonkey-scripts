// src/manga-panel-downloader/_scroll-loader.js — Scroll-based lazy image loading
// Implements a 4-pass scroll strategy to trigger lazy-loaded manga images:
// 1. Force all lazy attributes immediately
// 2. Scroll to each unloaded image individually
// 3. Full-page sweep for stragglers
// 4. Poll until all images loaded or timeout

'use strict';

import { triggerLazy, extractLazySrc } from './_dom.js';

const SCROLL_TIMEOUT_MS = 3000;

/**
 * Sleep helper for scroll delays.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Returns all img elements that are not yet fully loaded.
 * @returns {HTMLImageElement[]}
 */
function getUnloaded() {
  const result = [];
  const imgs = document.querySelectorAll('img');
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    if ((!img.complete || !img.naturalWidth) &&
        (img.src && (img.src.startsWith('http') || extractLazySrc(img)))) {
      result.push(img);
    }
  }
  return result;
}

/**
 * Counts fully loaded images on the page.
 * @returns {number}
 */
function countLoadedImages() {
  const imgs = document.querySelectorAll('img');
  let count = 0;
  for (let i = 0; i < imgs.length; i++) {
    if (imgs[i].complete && imgs[i].naturalWidth > 0) count++;
  }
  return count;
}

/**
 * Scrolls the page to trigger lazy image loading.
 *
 * 4-pass strategy:
 * 1. Force all lazy attributes immediately
 * 2. Scroll to each unloaded image individually
 * 3. Full-page sweep for stragglers
 * 4. Poll until all images loaded or timeout
 *
 * @param {Function} isAborted - Returns true if the operation should be cancelled
 * @yields {{ type: string, passNumber?: number, imagesFound?: number, totalLoaded?: number }}
 */
export async function* scrollLoad(isAborted) {
  // Pass 1: force all lazy attributes immediately
  triggerLazy(document);
  await sleep(150);
  yield { type: 'pass', passNumber: 1, imagesFound: countLoadedImages() };

  if (isAborted && isAborted()) return;

  // Pass 2: scroll directly to each unloaded image
  const unloaded = getUnloaded();
  for (let u = 0; u < unloaded.length; u++) {
    if (isAborted && isAborted()) return;
    unloaded[u].scrollIntoView({ block: 'center', behavior: 'instant' });
    triggerLazy(document);
    await sleep(60);
  }
  yield { type: 'pass', passNumber: 2, imagesFound: countLoadedImages() };

  if (isAborted && isAborted()) return;

  // Pass 3: full-page sweep for stragglers
  const pageH = document.documentElement.scrollHeight;
  for (let y = 0; y <= pageH; y += window.innerHeight) {
    if (isAborted && isAborted()) return;
    window.scrollTo(0, y);
    triggerLazy(document);
    await sleep(40);
  }
  yield { type: 'pass', passNumber: 3, imagesFound: countLoadedImages() };

  if (isAborted && isAborted()) return;

  // Pass 4: poll until all loaded, max SCROLL_TIMEOUT_MS
  const deadline = Date.now() + SCROLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (isAborted && isAborted()) return;
    triggerLazy(document);
    if (getUnloaded().length === 0) break;
    await sleep(150);
  }

  window.scrollTo(0, 0);

  const totalLoaded = countLoadedImages();
  yield { type: 'complete', totalLoaded };
}

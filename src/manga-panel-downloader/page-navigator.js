// src/manga-panel-downloader/page-navigator.js — Page navigation and scroll loading
// Handles scrolling to trigger lazy-loaded images, navigating to the next manga
// page (both via button clicks and URL guessing), and SPA navigation utilities.

import { triggerLazy, extractLazySrc } from './image-finder.js';

var SCROLL_TIMEOUT_MS = 3000;

/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

/**
 * Scrolls the page to trigger lazy image loading.
 * Pass 1: force all lazy attributes immediately.
 * Pass 2: scroll to each unloaded image individually.
 * Pass 3: full-page sweep for stragglers.
 * Pass 4: poll until all images loaded or timeout.
 * @returns {Promise<void>}
 */
export async function scrollLoad() {
  triggerLazy(document);
  await sleep(150);

  function getUnloaded() {
    var result = [];
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if ((!img.complete || !img.naturalWidth) &&
          (img.src && (img.src.startsWith('http') || extractLazySrc(img)))) {
        result.push(img);
      }
    }
    return result;
  }

  // Pass 2: scroll directly to each unloaded image
  var unloaded = getUnloaded();
  for (var u = 0; u < unloaded.length; u++) {
    unloaded[u].scrollIntoView({ block: 'center', behavior: 'instant' });
    triggerLazy(document);
    await sleep(60);
  }

  // Pass 3: full-page sweep for stragglers
  var pageH = document.documentElement.scrollHeight;
  for (var y = 0; y <= pageH; y += window.innerHeight) {
    window.scrollTo(0, y);
    triggerLazy(document);
    await sleep(40);
  }

  // Pass 4: poll until all loaded, max SCROLL_TIMEOUT_MS
  var deadline = Date.now() + SCROLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    triggerLazy(document);
    if (getUnloaded().length === 0) break;
    await sleep(150);
  }

  window.scrollTo(0, 0);
  await sleep(100);
}

/**
 * Derives the next page URL from common page-number patterns.
 * @param {string} url
 * @returns {string|null}
 */
function guessNextUrl(url) {
  try {
    var u = new URL(url);
    if (u.searchParams.has('page')) {
      var n = parseInt(u.searchParams.get('page'), 10);
      if (!isNaN(n)) {
        var next = new URL(url);
        next.searchParams.set('page', n + 1);
        return next.href;
      }
    }
    var m = u.pathname.match(/^(.*\/)(\d+)(\/?)$/);
    if (m) {
      var pn = parseInt(m[2], 10);
      if (!isNaN(pn) && pn > 0 && pn < 10000) {
        return u.origin + m[1] + (pn + 1) + m[3] + u.search;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Finds and clicks the next-page button using common selectors and text.
 * @returns {boolean} True if a button was found and clicked
 */
function clickNextPage() {
  var selectors = [
    'a[rel="next"]',
    '[class*="next"]:not([disabled])',
    '[aria-label*="next" i]', '[title*="next" i]',
    '[aria-label*="weiter" i]', '[title*="weiter" i]',
  ];
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el) { el.click(); return true; }
  }
  var links = document.querySelectorAll('a, button');
  for (var j = 0; j < links.length; j++) {
    var t = (links[j].textContent || '').trim().toLowerCase();
    if (t === 'next' || t === 'weiter' || t === '>' || t === '›' || t === '→') {
      links[j].click(); return true;
    }
  }
  return false;
}

/**
 * Navigates to the next page. Tries SPA-friendly click first, then URL fallback.
 */
export function navigateNext() {
  if (clickNextPage()) return;
  var nextUrl = guessNextUrl(location.href);
  if (nextUrl) location.href = nextUrl;
}

/**
 * Polls until the URL changes from prevUrl, with timeout.
 * @param {string} prevUrl
 * @param {number} timeout - Max wait in ms
 * @returns {Promise<boolean>} True if URL changed within timeout
 */
export function waitForUrlChange(prevUrl, timeout) {
  return new Promise(function (resolve) {
    var start = Date.now();
    var id = setInterval(function () {
      if (location.href !== prevUrl) { clearInterval(id); resolve(true); return; }
      if (Date.now() - start > timeout) { clearInterval(id); resolve(false); }
    }, 80);
  });
}

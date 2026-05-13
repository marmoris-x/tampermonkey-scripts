// src/manga-panel-downloader/_dom.js — DOM image detection and URL extraction
// Finds manga page images in the DOM, extracts URLs from various attributes
// (lazy-load, srcset, data-src, etc.), and triggers lazy-loading.

'use strict';

const MIN_IMG_PX = 400;

/**
 * Extracts lazy-load source from data attributes.
 * @param {Element} el
 * @returns {string|null}
 */
export function extractLazySrc(el) {
  return el.dataset.src
    || el.dataset.lazySrc
    || el.dataset.original
    || el.dataset.url
    || el.dataset.imgSrc
    || el.dataset.lazyload
    || el.getAttribute('data-cfsrc')
    || el.getAttribute('data-echo')
    || null;
}

/**
 * Extracts image URL from an element, handling lazy-load attributes.
 * @param {Element} el
 * @returns {string}
 */
export function getSrc(el) {
  const raw = el.src
    || el.currentSrc
    || extractLazySrc(el)
    || (el.getAttribute('data-srcset') || '').split(/[\s,]+/)[0]
    || (el.getAttribute('srcset') || '').split(/[\s,]+/)[0]
    || '';
  if (!raw || raw.startsWith('data:') || raw.startsWith('http')) return raw;
  try { return new URL(raw, location.href).href; } catch (e) { return raw; }
}

/**
 * Collects all possible URLs from an image element (raw + absolute variants).
 * @param {Element|null} el
 * @returns {Set<string>}
 */
export function allSrcsOf(el) {
  const srcs = new Set();
  function add(v) {
    if (!v || typeof v !== 'string' || v.length < 5) return;
    srcs.add(v);
  }
  if (!el) return srcs;
  add(el.src);
  add(el.currentSrc);
  add(extractLazySrc(el));
  add((el.getAttribute && el.getAttribute('data-srcset') || '').split(/[\s,]+/)[0]);
  add((el.getAttribute && el.getAttribute('srcset') || '').split(/[\s,]+/)[0]);
  const arr = [];
  srcs.forEach(function (s) { arr.push(s); });
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    if (s && !s.startsWith('data:') && !s.startsWith('http')) {
      try { add(new URL(s, location.href).href); } catch (e) {}
    }
  }
  return srcs;
}

/**
 * Finds all manga image elements in the given container.
 * @param {Element} container - Root element to search within
 * @returns {Array<{el: Element, src: string}>}
 */
export function findImages(container) {
  const seen = new Set();
  const results = [];

  function tryAdd(el, src) {
    if (!src || (el && el.dataset && el.dataset.mpdProcessed)) return;
    if (seen.has(src)) return;
    if (/\.(svg|gif)(\?|#|$)/i.test(src)) return;
    if (src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) return;

    const parentTag = el.parentElement && el.parentElement.tagName
      ? el.parentElement.tagName.toLowerCase() : '';
    if (parentTag === 'nav' || parentTag === 'header' || parentTag === 'footer') return;

    if (el.nodeType === Node.ELEMENT_NODE) {
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.tagName === 'IMG' && el.offsetWidth === 0 && el.offsetHeight === 0) return;
    }

    const nw = el.naturalWidth || parseInt(el.getAttribute && el.getAttribute('width')) || el.offsetWidth || 0;
    const nh = el.naturalHeight || parseInt(el.getAttribute && el.getAttribute('height')) || el.offsetHeight || 0;
    if (nw > 0 && nw < 100 && nh > 0 && nh < 100) return;

    seen.add(src);
    results.push({ el: el, src: src });
  }

  const imgs = container.querySelectorAll('img');
  for (let i = 0; i < imgs.length; i++) {
    tryAdd(imgs[i], getSrc(imgs[i]));
  }

  const sources = container.querySelectorAll('picture source');
  for (let j = 0; j < sources.length; j++) {
    const s = sources[j];
    const url = (s.srcset || '').split(/[\s,]+/)[0];
    if (url) {
      const picture = s.closest('picture');
      tryAdd(picture ? picture.querySelector('img') : s, url);
    }
  }

  const bgEls = container.querySelectorAll('[style*="background"]');
  for (let k = 0; k < bgEls.length; k++) {
    const bgEl = bgEls[k];
    const match = bgEl.style.backgroundImage
      ? bgEl.style.backgroundImage.match(/url\(['"]?([^'")\s]+)['"]?\)/) : null;
    if (match && bgEl.offsetWidth >= MIN_IMG_PX && bgEl.offsetHeight >= MIN_IMG_PX) {
      tryAdd(bgEl, match[1]);
    }
  }

  const canvases = container.querySelectorAll('canvas');
  for (let l = 0; l < canvases.length; l++) {
    const c = canvases[l];
    if (c.width < MIN_IMG_PX || c.height < MIN_IMG_PX) continue;
    try {
      const d = c.toDataURL('image/jpeg', 0.92);
      if (d && d.length > 1000) tryAdd(c, d);
    } catch (e) {}
  }

  return results;
}

/**
 * Triggers lazy-loading on all img elements in the container.
 * @param {Element} container
 */
export function triggerLazy(container) {
  const imgs = container.querySelectorAll('img');
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const lazy = extractLazySrc(img);
    if (lazy && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
      img.src = lazy;
    }
  }
}

// src/manga-panel-downloader/image-finder.js — Image detection and URL extraction
// Finds manga page images in the DOM, extracts URLs from various attributes
// (lazy-load, srcset, data-src, etc.), and triggers lazy-loading.
// Consumers: Manga Panel Downloader (entry file)
(function () {
  'use strict';

  var MIN_IMG_PX = 400;

  /**
   * Extracts lazy-load source from data attributes.
   * @param {Element} el
   * @returns {string|null}
   */
  function extractLazySrc(el) {
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
   * Strips query string and hash from a URL for deduplication.
   * @param {string} url
   * @returns {string}
   */
  function normalizeUrl(url) {
    if (!url || url.startsWith('data:')) return url || '';
    try {
      var u = new URL(url, location.href);
      return u.origin + u.pathname;
    } catch (e) {
      return url.split('?')[0].split('#')[0];
    }
  }

  /**
   * Extracts image URL from an element, handling lazy-load attributes.
   * @param {Element} el
   * @returns {string}
   */
  function getSrc(el) {
    var raw = el.src
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
  function allSrcsOf(el) {
    var srcs = new Set();
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
    var arr = [];
    srcs.forEach(function (s) { arr.push(s); });
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
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
  function findImages(container) {
    var seen = new Set();
    var results = [];

    function tryAdd(el, src) {
      if (!src || (el && el.dataset && el.dataset.mpdProcessed)) return;
      if (seen.has(src)) return;
      if (/\.(svg|gif)(\?|#|$)/i.test(src)) return;
      if (src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) return;

      var parentTag = el.parentElement && el.parentElement.tagName
        ? el.parentElement.tagName.toLowerCase() : '';
      if (parentTag === 'nav' || parentTag === 'header' || parentTag === 'footer') return;

      if (el.nodeType === Node.ELEMENT_NODE) {
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (el.tagName === 'IMG' && el.offsetWidth === 0 && el.offsetHeight === 0) return;
      }

      var nw = el.naturalWidth || parseInt(el.getAttribute && el.getAttribute('width')) || el.offsetWidth || 0;
      var nh = el.naturalHeight || parseInt(el.getAttribute && el.getAttribute('height')) || el.offsetHeight || 0;
      if (nw > 0 && nw < 100 && nh > 0 && nh < 100) return;

      seen.add(src);
      results.push({ el: el, src: src });
    }

    var imgs = container.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      tryAdd(imgs[i], getSrc(imgs[i]));
    }

    var sources = container.querySelectorAll('picture source');
    for (var j = 0; j < sources.length; j++) {
      var s = sources[j];
      var url = (s.srcset || '').split(/[\s,]+/)[0];
      if (url) {
        var picture = s.closest('picture');
        tryAdd(picture ? picture.querySelector('img') : s, url);
      }
    }

    var bgEls = container.querySelectorAll('[style*="background"]');
    for (var k = 0; k < bgEls.length; k++) {
      var bgEl = bgEls[k];
      var match = bgEl.style.backgroundImage
        ? bgEl.style.backgroundImage.match(/url\(['"]?([^'")\s]+)['"]?\)/) : null;
      if (match && bgEl.offsetWidth >= MIN_IMG_PX && bgEl.offsetHeight >= MIN_IMG_PX) {
        tryAdd(bgEl, match[1]);
      }
    }

    var canvases = container.querySelectorAll('canvas');
    for (var l = 0; l < canvases.length; l++) {
      var c = canvases[l];
      if (c.width < MIN_IMG_PX || c.height < MIN_IMG_PX) return;
      try {
        var d = c.toDataURL('image/jpeg', 0.92);
        if (d && d.length > 1000) tryAdd(c, d);
      } catch (e) {}
    }

    return results;
  }

  /**
   * Triggers lazy-loading on all img elements in the container.
   * @param {Element} container
   */
  function triggerLazy(container) {
    var imgs = container.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var lazy = extractLazySrc(img);
      if (lazy && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
        img.src = lazy;
      }
    }
  }

  // Export
  window.__MPD__ = window.__MPD__ || {};
  window.__MPD__.findImages = findImages;
  window.__MPD__.getSrc = getSrc;
  window.__MPD__.triggerLazy = triggerLazy;
  window.__MPD__.allSrcsOf = allSrcsOf;
  window.__MPD__.normalizeUrl = normalizeUrl;
  window.__MPD__.extractLazySrc = extractLazySrc;
})();

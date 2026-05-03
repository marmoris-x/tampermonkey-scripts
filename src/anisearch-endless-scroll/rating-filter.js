// src/anisearch-endless-scroll/rating-filter.js — Rating extraction and filtering
// Provides: extractRating, passesRating, parseRatingMin
// Exports via window.__AES__

(function () {
  'use strict';

  var log = TM.createLogger('AniSearch Endless Scroll');

  var STORAGE_KEY_RATING = 'anisearch_rating_min';

  var STAR_SELS = [
    '[class*="star"]',
    '[class*="rating"]',
    '[class*="score"]',
    '.rating', '.score',
  ];

  /**
   * Extracts a precise float rating from an item element.
   * AniSearch format: <div class="star0" title="3.66 / 5.00 (1234 votes)">
   * Falls back through title, textContent, and data attributes.
   * @param {Element} itemEl - The item DOM element
   * @returns {number|null} The rating value, or null if not found
   */
  function extractRating(itemEl) {
    for (var i = 0; i < STAR_SELS.length; i++) {
      var el = itemEl.querySelector(STAR_SELS[i]);
      if (!el) continue;

      // 1) title attribute (most precise source), 2) textContent fallback
      var title = el.getAttribute('title') || '';
      var txt   = (el.textContent || '').trim();
      var sources = [title, txt];
      for (var s = 0; s < sources.length; s++) {
        var m = sources[s].match(/(\d+(?:[.,]\d+)?)/);
        if (m) {
          var v = parseFloat(m[1].replace(',', '.'));
          if (!isNaN(v) && v > 0) return v;
        }
      }
    }

    // 3) data attributes
    var dataEl = itemEl.querySelector('[data-rating],[data-score],[data-average]');
    if (dataEl) {
      var raw = dataEl.getAttribute('data-rating')
                || dataEl.getAttribute('data-score')
                || dataEl.getAttribute('data-average')
                || '';
      var v2 = parseFloat(raw);
      if (!isNaN(v2) && v2 > 0) return v2;
    }

    return null; // no rating found -> keep item
  }

  /**
   * Checks whether an item's rating meets the minimum threshold.
   * Items with no rating are kept (benefit of the doubt).
   * @param {Element} itemEl - The item DOM element
   * @param {number|null} ratingMin - Minimum rating, or null for no filter
   * @returns {boolean}
   */
  function passesRating(itemEl, ratingMin) {
    if (ratingMin === null) return true;
    var r = extractRating(itemEl);
    if (r === null) return true; // unknown -> benefit of the doubt
    return r >= ratingMin;
  }

  /**
   * Determines the minimum rating filter from URL parameter or stored value.
   * Priority: URL parameter > stored value > null (no filter).
   * If found in URL, persists to storage for future sessions.
   * @returns {Promise<number|null>}
   */
  async function parseRatingMin() {
    // 1. URL parameter (most precise, e.g. rating_min=3.25)
    var raw = new URLSearchParams(location.search).get('rating_min');
    if (raw !== null) {
      var v = parseFloat(raw);
      if (!isNaN(v)) {
        await TM.storage.saveSetting(STORAGE_KEY_RATING, v);
        return v;
      }
    }

    // 2. Stored value
    var stored = await TM.storage.loadSetting(STORAGE_KEY_RATING, null);
    if (stored !== null) {
      var v2 = parseFloat(stored);
      if (!isNaN(v2)) return v2;
    }

    return null;
  }

  window.__AES__ = window.__AES__ || {};
  window.__AES__.extractRating = extractRating;
  window.__AES__.passesRating = passesRating;
  window.__AES__.parseRatingMin = parseRatingMin;
})();

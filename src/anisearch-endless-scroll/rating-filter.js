// src/anisearch-endless-scroll/rating-filter.js — Rating extraction and filtering
// No external shared dependencies.

import { loadSetting, saveSetting } from './storage.js';

const STORAGE_KEY_RATING = 'anisearch_rating_min';

const STAR_SELS = [
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
export function extractRating(itemEl) {
  for (const sel of STAR_SELS) {
    const el = itemEl.querySelector(sel);
    if (!el) continue;

    // 1) title attribute (most precise source), 2) textContent fallback
    const sources = [el.getAttribute('title') || '', (el.textContent || '').trim()];
    for (const src of sources) {
      const m = src.match(/(\d+(?:[.,]\d+)?)/);
      if (m) {
        const v = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(v) && v > 0) return v;
      }
    }
  }

  // 3) data attributes
  const dataEl = itemEl.querySelector('[data-rating],[data-score],[data-average]');
  if (dataEl) {
    const raw = dataEl.getAttribute('data-rating')
              || dataEl.getAttribute('data-score')
              || dataEl.getAttribute('data-average')
              || '';
    const v2 = parseFloat(raw);
    if (!isNaN(v2) && v2 > 0) return v2;
  }

  return null; // no rating found → keep item
}

/**
 * Checks whether an item's rating meets the minimum threshold.
 * Items with no rating are kept (benefit of the doubt).
 * @param {Element} itemEl - The item DOM element
 * @param {number|null} ratingMin - Minimum rating, or null for no filter
 * @returns {boolean}
 */
export function passesRating(itemEl, ratingMin) {
  if (ratingMin === null) return true;
  const r = extractRating(itemEl);
  if (r === null) return true; // unknown → benefit of the doubt
  return r >= ratingMin;
}

/**
 * Determines the minimum rating filter from URL parameter or stored value.
 * Priority: URL parameter > stored value > null (no filter).
 * If found in URL, persists to storage for future sessions.
 * @returns {Promise<number|null>}
 */
export async function parseRatingMin() {
  // 1. URL parameter (most precise, e.g. rating_min=3.25)
  const raw = new URLSearchParams(location.search).get('rating_min');
  if (raw !== null) {
    const v = parseFloat(raw);
    if (!isNaN(v)) {
      await saveSetting(STORAGE_KEY_RATING, v);
      return v;
    }
  }

  // 2. Stored value
  const stored = await loadSetting(STORAGE_KEY_RATING, null);
  if (stored !== null) {
    const v2 = parseFloat(stored);
    if (!isNaN(v2)) return v2;
  }

  return null;
}

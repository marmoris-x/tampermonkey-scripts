'use strict';

/* --- Internal Regex Constants --- */

/** @constant {RegExp} */
const WHITESPACE_REGEX_G = /\s/g;
/** @constant {RegExp} */
const THOUSAND_DOT_REGEX_G = /\./g;
/** @constant {RegExp} */
const COMMA_REGEX_G = /,/g;
/** @constant {RegExp} */
const DECIMAL_NUMBER_REGEX = /(\d+(?:\.\d+)?)/;

/* --- HTML Escaping --- */

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {*} str - Value to escape
 * @returns {string} Escaped string
 */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --- Score Utilities --- */

/**
 * Returns a valid numeric score, or null if invalid.
 * @param {*} score
 * @returns {number|null}
 */
export function getValidScore(score) {
  const num = Number(score);
  return Number.isFinite(num) ? num : null;
}

/**
 * Checks if score is a valid finite number.
 * @param {*} score
 * @returns {boolean}
 */
export function isValidScore(score) {
  return getValidScore(score) !== null;
}

/* --- Price Parsing --- */

/**
 * Parses a price string (European/international formats) to a numeric value.
 * Handles "1.234,56 EUR", "350 EUR VB", "$1,234.56" etc.
 * @param {string} priceStr - Raw price text
 * @returns {number|null} Parsed numeric price or null
 */
export function parsePriceText(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return null;
  let normalized = priceStr.replace(WHITESPACE_REGEX_G, '');
  const hasComma = normalized.indexOf(',') !== -1;
  const hasDot = normalized.indexOf('.') !== -1;
  if (hasComma) {
    normalized = normalized.replace(THOUSAND_DOT_REGEX_G, '');
    normalized = normalized.replace(COMMA_REGEX_G, '.');
  } else if (hasDot) {
    const parts = normalized.split('.');
    if (parts.length > 1) {
      normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
  }
  const match = normalized.match(DECIMAL_NUMBER_REGEX);
  return match ? parseFloat(match[1]) : null;
}

/* --- Text Utilities --- */

/**
 * Checks if text consists only of a price (e.g. "12,50 EUR" or "350 EUR VB").
 * @param {string} text
 * @returns {boolean}
 */
export function isPriceOnlyText(text) {
  return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
}

/* --- Collection Utilities --- */

/**
 * Creates a Set from an array by extracting a key.
 * @param {Array} arr
 * @param {string} key
 * @returns {Set}
 */
export function extractSet(arr, key) {
  return new Set(arr.map(function (item) { return item[key]; }));
}

/**
 * Adds positive jitter to a base value.
 * @param {number} base - Base value
 * @param {number} percent - Jitter fraction (e.g. 0.2 for +0-20%)
 * @returns {number}
 */
export function addJitter(base, percent) {
  return base * (1 + Math.random() * percent);
}

/**
 * Normalizes a URL by removing hash fragment.
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return url;
  return url.split('#')[0];
}

/* --- Deal Processing --- */

/**
 * Deduplicates deals by URL, keeping the first occurrence.
 * @param {Array} deals
 * @returns {Array} Deduplicated array
 */
export function deduplicateDeals(deals) {
  const seen = new Map();
  for (let i = 0; i < deals.length; i++) {
    const d = deals[i];
    if (!seen.has(d.url)) seen.set(d.url, d);
  }
  return Array.from(seen.values());
}

/**
 * Sorts deals by validated score descending (highest first).
 * @param {Array} deals
 * @returns {Array} New sorted array
 */
export function sortDealsByScore(deals) {
  return deals.slice().sort(function (a, b) {
    return (getValidScore(b.score) ?? 0) - (getValidScore(a.score) ?? 0);
  });
}

/**
 * Merges new deals into existing array, deduplicating by URL.
 * @param {Array} existingDeals
 * @param {Array} newDeals
 * @returns {Array} Merged array
 */
export function mergeDeals(existingDeals, newDeals) {
  const combined = (existingDeals || []).concat(newDeals || []);
  return deduplicateDeals(combined);
}

/* --- Price Statistics --- */

/**
 * Computes price statistics (min, max, mean, median, count) from ad data.
 * @param {Array} adsData - Array of ad objects with .price strings
 * @returns {{ min: number, max: number, mean: number, median: number, count: number }|null}
 */
export function computePriceStats(adsData) {
  const prices = [];
  for (let ai = 0; ai < adsData.length; ai++) {
    const ad = adsData[ai];
    const match = (ad.price || '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const p = parseFloat(match[1]);
      if (p > 0) prices.push(p);
    }
  }
  if (prices.length === 0) return null;
  const sorted = prices.slice().sort(function (a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  let sum = 0;
  for (let si = 0; si < prices.length; si++) sum += prices[si];
  const mean = sum / prices.length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean),
    median: Math.round(median),
    count: prices.length
  };
}

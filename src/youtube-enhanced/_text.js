// src/youtube-enhanced/_text.js — Text normalization and matching utilities
'use strict';

/**
 * Normalizes text for case-insensitive, diacritic-insensitive matching.
 * Converts to lowercase, replaces umlauts/accents, collapses whitespace.
 * @param {string} str - Raw text
 * @returns {string} Normalized text
 */
export function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[äæ]/g, 'ae').replace(/[öœ]/g, 'oe').replace(/[ü]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[àáâãå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõ]/g, 'o').replace(/[ùúû]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[-_.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if `text` matches any term in `terms` after normalization.
 * @param {string} text - Text to search within
 * @param {string[]} terms - Array of search terms
 * @returns {boolean} True if any term matches
 */
export function matchAnyTerm(text, terms) {
  const n = normalizeText(text);
  for (let i = 0; i < terms.length; i++) {
    if (n.indexOf(normalizeText(terms[i])) !== -1) return true;
  }
  return false;
}

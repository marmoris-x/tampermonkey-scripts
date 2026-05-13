// Local copies of normalizeText and matchAnyTerm from shared/i18n-utils.js
// Converted from var to let/const for YouTube Enhanced module isolation.

/**
 * Normalizes text for comparison: lowercase, remove diacritics, collapse whitespace,
 * trim separators (hyphens, underscores, dots).
 * @param {string} str
 * @returns {string}
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
 * @param {string} text
 * @param {string[]} terms
 * @returns {boolean}
 */
export function matchAnyTerm(text, terms) {
  const n = normalizeText(text);
  for (let i = 0; i < terms.length; i++) {
    if (n.indexOf(normalizeText(terms[i])) !== -1) return true;
  }
  return false;
}

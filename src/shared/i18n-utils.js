// src/shared/i18n-utils.js — Text normalization and multi-language term matching
// Consumers: Gutefrage Smart Filters, YouTube Enhanced, Crunchyroll Enhanced,
//            Manga Panel Downloader, AniSearch Endless Scroll
(function () {
  'use strict';

  /**
   * Normalizes text for comparison: lowercase, remove diacritics, collapse whitespace,
   * trim separators (hyphens, underscores, dots).
   * @param {string} str
   * @returns {string}
   */
  function normalizeText(str) {
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
  function matchAnyTerm(text, terms) {
    var n = normalizeText(text);
    for (var i = 0; i < terms.length; i++) {
      if (n.indexOf(normalizeText(terms[i])) !== -1) return true;
    }
    return false;
  }

  /**
   * Checks if `text` exactly matches `term` after normalization.
   * @param {string} text
   * @param {string} term
   * @returns {boolean}
   */
  function matchTerm(text, term) {
    return normalizeText(text) === normalizeText(term);
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.i18n = {
    normalizeText: normalizeText,
    matchAnyTerm: matchAnyTerm,
    matchTerm: matchTerm
  };
})();

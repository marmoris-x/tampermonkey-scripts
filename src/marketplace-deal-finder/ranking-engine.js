// src/marketplace-deal-finder/ranking-engine.js — Deal processing, storage, helpers
// Provides constants, utility functions, storage operations, and deal merging/ranking logic.
// Consumers: Marketplace Deal Finder entry file, scraper modules

import { loadSetting, saveSetting } from './_storage.js';
import { callGeminiAPI } from './api-gemini.js';

/* ─── Constants ─── */

var SHIPPING_REGEX = /versand|shipping|porto|lieferung/i;
var WHITESPACE_REGEX_G = /\s/g;
var THOUSAND_DOT_REGEX_G = /\./g;
var COMMA_REGEX_G = /,/g;
var DECIMAL_NUMBER_REGEX = /(\d+(?:\.\d+)?)/;

export var INITIAL_BATCH_SIZE = 8;
export var MAX_RETRIES = 2;
export var RATE_LIMIT_MAX_RETRIES = 5;
export var DESCRIPTION_PREVIEW_LENGTH = 150;
export var SETTINGS_VERSION = 1;
export var MAX_CACHE_SIZE = 100;
export var REQUEST_TIMEOUT = 15000;
export var GEMINI_API_TIMEOUT = 60000;
export var RETRY_BASE_DELAY = 2000;
export var RATE_LIMIT_BASE_DELAY = 5000;
export var MAX_RATE_LIMIT_DELAY = 300000;
export var RE_RANK_MAX_DEALS = 30;
export var PAUSE_POLL_INTERVAL = 500;
export var JITTER_FACTOR = 0.2;
export var MIN_TITLE_LENGTH = 5;
export var SAME_PAGE_INCREMENT = 0;
export var NEW_PAGE_INCREMENT = 1;
export var MAX_INIT_RETRIES = 5;

export var DEAL_KEYS = {
  URL: 'url',
  TITLE: 'title',
  PRICE: 'price',
  DESCRIPTION: 'description',
  SCORE: 'score',
  REASON: 'reason',
  PAGE: 'page'
};

export var DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  apiKey: '',
  searchContext: '',
  topX: 3,
  model: 'flash',
  modelMapping: {
    flash: 'gemini-2.0-flash',
    pro: 'gemini-1.5-pro',
    nano: 'gemini-2.0-flash-lite'
  },
  maxPages: 10
};

/* ─── Helper Functions ─── */

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

/**
 * Returns a valid numeric score, or null if invalid.
 * @param {*} score
 * @returns {number|null}
 */
export function getValidScore(score) {
  var num = Number(score);
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

/**
 * Parses a price string (European/international formats) to a numeric value.
 * Handles "1.234,56 EUR", "350 € VB", "$1,234.56" etc.
 * @param {string} priceStr - Raw price text
 * @returns {number|null} Parsed numeric price or null
 */
export function parsePriceText(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return null;
  var normalized = priceStr.replace(WHITESPACE_REGEX_G, '');
  var hasComma = normalized.indexOf(',') !== -1;
  var hasDot = normalized.indexOf('.') !== -1;
  if (hasComma) {
    normalized = normalized.replace(THOUSAND_DOT_REGEX_G, '');
    normalized = normalized.replace(COMMA_REGEX_G, '.');
  } else if (hasDot) {
    var parts = normalized.split('.');
    if (parts.length > 1) {
      normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
  }
  var match = normalized.match(DECIMAL_NUMBER_REGEX);
  return match ? parseFloat(match[1]) : null;
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
 * Checks if text consists only of a price (e.g. "12,50 €" or "350 € VB").
 * @param {string} text
 * @returns {boolean}
 */
export function isPriceOnlyText(text) {
  return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
}

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

/**
 * Creates a deep copy of settings object.
 * @param {Object} settings
 * @returns {Object}
 */
export function deepCopySettings(settings) {
  return {
    ...settings,
    modelMapping: { ...(settings.modelMapping || DEFAULT_SETTINGS.modelMapping) }
  };
}

/* ─── Storage Functions ─── */

/**
 * Loads settings from storage. Uses cached value on subsequent calls.
 * @param {string} storagePrefix - Site prefix ("wh" or "ka")
 * @param {Object|null} cachedSettings - In-memory cache reference (mutated in place)
 * @returns {Promise<{settings: Object, cachedSettings: Object}>}
 */
export async function loadSettings(storagePrefix, cachedSettings) {
  if (cachedSettings !== null) {
    return { settings: deepCopySettings(cachedSettings), cachedSettings: cachedSettings };
  }
  var saved = await loadSetting(storagePrefix + '_dealfinder_settings', null);
  if (!saved) {
    var defaults = deepCopySettings(DEFAULT_SETTINGS);
    return { settings: deepCopySettings(defaults), cachedSettings: defaults };
  }
  try {
    var loaded = (typeof saved === 'string') ? JSON.parse(saved) : saved;
    if (loaded.model && !{ flash: 1, pro: 1, nano: 1 }[loaded.model]) {
      loaded.model = 'flash';
    }
    var merged = Object.assign({}, DEFAULT_SETTINGS, loaded);
    var cs = deepCopySettings(merged);
    return { settings: deepCopySettings(cs), cachedSettings: cs };
  } catch (e) {
    console.warn('[MDF] Corrupted settings storage, resetting to defaults');
    await saveSetting(storagePrefix + '_dealfinder_settings', null);
    var defs = deepCopySettings(DEFAULT_SETTINGS);
    return { settings: deepCopySettings(defs), cachedSettings: defs };
  }
}

/**
 * Persists settings to storage. Caller manages its own cache.
 * @param {Object} settings
 * @param {string} storagePrefix
 */
export async function saveSettings(settings, storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_settings', JSON.stringify(settings));
}

/**
 * Saves crawl state (persisted before navigation).
 * @param {{ currentPage: number, currentUrl: string, allTopDeals: Array, maxPages: number }} state
 * @param {string} storagePrefix
 */
export async function saveCrawlState(state, storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_crawl_state', JSON.stringify(state));
}

/**
 * Loads persisted crawl state.
 * @param {string} storagePrefix
 * @returns {Promise<Object|null>}
 */
export async function loadCrawlState(storagePrefix) {
  var saved = await loadSetting(storagePrefix + '_dealfinder_crawl_state', null);
  if (!saved) return null;
  try {
    return (typeof saved === 'string') ? JSON.parse(saved) : saved;
  } catch (e) {
    await saveSetting(storagePrefix + '_dealfinder_crawl_state', null);
    return null;
  }
}

/**
 * Clears persisted crawl state.
 * @param {string} storagePrefix
 */
export async function clearCrawlState(storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_crawl_state', null);
}

/**
 * Saves results for display after crawl completes.
 * @param {{ deals: Array, pages: number, timestamp: string }} results
 * @param {string} storagePrefix
 */
export async function saveResults(results, storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_results', JSON.stringify(results));
}

/**
 * Loads persisted results.
 * @param {string} storagePrefix
 * @returns {Promise<Object|null>}
 */
export async function loadResults(storagePrefix) {
  var saved = await loadSetting(storagePrefix + '_dealfinder_results', null);
  if (!saved) return null;
  try {
    return (typeof saved === 'string') ? JSON.parse(saved) : saved;
  } catch (e) {
    await saveSetting(storagePrefix + '_dealfinder_results', null);
    return null;
  }
}

/**
 * Clears persisted results.
 * @param {string} storagePrefix
 */
export async function clearResults(storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_results', null);
}

/**
 * Saves available models list to storage.
 * @param {string[]} models
 * @param {string} storagePrefix
 */
export async function saveAvailableModels(models, storagePrefix) {
  await saveSetting(storagePrefix + '_available_models', JSON.stringify(models));
}

/**
 * Loads available models from storage.
 * @param {string} storagePrefix
 * @returns {Promise<string[]|null>}
 */
export async function loadAvailableModels(storagePrefix) {
  var saved = await loadSetting(storagePrefix + '_available_models', null);
  if (!saved) return null;
  try { return (typeof saved === 'string') ? JSON.parse(saved) : saved; } catch (e) { return null; }
}

/**
 * Synchronously saves crawl state (used before window.location navigation).
 * @param {{ currentPage: number, currentUrl: string, allTopDeals: Array, maxPages: number }} state
 * @param {string} storagePrefix
 */
export async function saveCrawlStateSync(state, storagePrefix) {
  await GM.setValue(storagePrefix + '_dealfinder_crawl_state', JSON.stringify(state));
}

/* ─── Deal Processing ─── */

/**
 * Deduplicates deals by URL, keeping the first occurrence.
 * @param {Array} deals
 * @returns {Array} Deduplicated array
 */
export function deduplicateDeals(deals) {
  var seen = new Map();
  for (var i = 0; i < deals.length; i++) {
    var d = deals[i];
    if (!seen.has(d.url)) seen.set(d.url, d);
  }
  return Array.from(seen.values());
}

/**
 * Merges new deals into existing array, deduplicating by URL.
 * @param {Array} existingDeals
 * @param {Array} newDeals
 * @returns {Array} Merged array
 */
export function mergeDeals(existingDeals, newDeals) {
  var combined = (existingDeals || []).concat(newDeals || []);
  return deduplicateDeals(combined);
}

/**
 * Performs global re-ranking of top deals via Gemini API, then merges
 * remaining unranked deals sorted by their original score.
 * @param {Array} allTopDeals - All collected deals
 * @param {string} apiKey - Gemini API key
 * @param {string} searchContext - User's search context
 * @param {string} model - Model key (flash/pro/nano)
 * @param {Function} logFn - Logger instance
 * @returns {Promise<Array>} Re-ranked deals array
 */
export async function reRankGlobal(allTopDeals, apiKey, searchContext, model, logFn) {
  var log = logFn || console;
  if (!allTopDeals || allTopDeals.length <= 1) return allTopDeals || [];

  var sortedTopDeals = sortDealsByScore(allTopDeals);
  var dealsToReRank = sortedTopDeals.slice(0, RE_RANK_MAX_DEALS);

  try {
    var onRetry = function (status, retryNum, delaySeconds) {
      log.warn('Global Re-Ranking: API ' + status + ' - Retry ' + retryNum + ' in ' + delaySeconds + 's...');
    };

    var reRankResult = await callGeminiAPI(
      dealsToReRank.map(function (d) {
        return {
          title: d.title,
          price: d.price,
          description: (d.description || '').substring(0, 400),
          url: d.url
        };
      }),
      searchContext || '',
      dealsToReRank.length,
      apiKey,
      model,
      0,
      onRetry
    );

    if (reRankResult && reRankResult.topDeals && reRankResult.topDeals.length > 0) {
      var urlToDeal = new Map();
      var titleToDeal = new Map();
      for (var ri = 0; ri < dealsToReRank.length; ri++) {
        urlToDeal.set(dealsToReRank[ri].url, dealsToReRank[ri]);
        titleToDeal.set(dealsToReRank[ri].title, dealsToReRank[ri]);
      }

      var reRankedDeals = reRankResult.topDeals.map(function (rd) {
        var orig = urlToDeal.get(rd.url) || titleToDeal.get(rd.title);
        return {
          title: (orig && orig.title) || rd.title,
          price: rd.price,
          description: (orig && orig.description) || rd.description,
          url: (orig && orig.url) || rd.url,
          score: rd.score,
          reasoning: rd.reasoning,
          page: (orig && orig.page) || 'unknown'
        };
      });

      var reRankedUrls = extractSet(reRankedDeals, DEAL_KEYS.URL);
      var remainingDeals = sortedTopDeals.filter(function (d) { return !reRankedUrls.has(d.url); });
      var result = sortDealsByScore(reRankedDeals.concat(remainingDeals));
      log.log('Global re-ranking complete (' + reRankedDeals.length + ' deals re-ranked, ' + remainingDeals.length + ' deals kept)');
      return result;
    }
  } catch (e) {
    log.warn('Global re-ranking failed:', e);
  }
  return allTopDeals;
}

/**
 * Generates a formatted Markdown string from the final ranking.
 * @param {Array} deals - Array of deal objects
 * @param {number} pages - Total pages analyzed
 * @param {string} timestamp - ISO timestamp
 * @param {string} siteName - "WILLHABEN" or "KLEINANZEIGEN"
 * @returns {string} Markdown content
 */
export function generateMarkdown(deals, pages, timestamp, siteName) {
  timestamp = timestamp || new Date().toISOString();
  var md = '# 🏆 ' + siteName + ' DEAL FINDER - FINALE RANKING\n\n';
  md += '**Gefunden:** ' + deals.length + ' Top-Deals  \n';
  md += '**Analysierte Seiten:** ' + pages + '  \n';
  md += '**Erstellt:** ' + timestamp + '\n\n';

  for (var i = 0; i < deals.length; i++) {
    var deal = deals[i];
    var rank = i + 1;
    var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + rank;
    md += '## ' + medal + ' RANG ' + rank + ' (Seite ' + deal.page + ')\n\n';
    md += '**Titel:** ' + (deal.title || 'Unbekannt') + '  \n';
    md += '**Preis:** ' + (deal.price || 'Unbekannt') + '  \n';
    if (deal.score !== undefined && isValidScore(deal.score)) {
      md += '**Score:** ' + deal.score + '/100  \n';
    }
    md += '**Begründung:** ' + (deal.reasoning || 'Keine Begründung') + '  \n\n';
    if (deal.description) {
      md += '**Beschreibung:**\n> ' +
        deal.description.substring(0, DESCRIPTION_PREVIEW_LENGTH) +
        (deal.description.length > DESCRIPTION_PREVIEW_LENGTH ? '...' : '') + '\n\n';
    }
    md += '**Link:** [Anzeige öffnen](' + deal.url + ')\n\n';
  }
  return md;
}

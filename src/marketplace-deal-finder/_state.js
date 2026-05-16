// src/marketplace-deal-finder/_state.js — Centralized crawl state
'use strict';

/**
 * Mutable state object — used by _crawler.js and other modules that need
 * to reassign state properties. Individual named exports also provided for
 * direct reads in non-import-* contexts.
 * @type {{
 *   isRunning: boolean,
 *   isPaused: boolean,
 *   shouldStop: boolean,
 *   captchaPaused: boolean,
 *   allTopDeals: Array<Object>,
 *   currentPage: number,
 *   initRetries: number,
 *   descriptionCache: Map<string, string>,
 *   cachedSettings: Object|null,
 *   scraper: Object|null
 * }}
 */
export const S = {
  isRunning: false,
  isPaused: false,
  shouldStop: false,
  captchaPaused: false,
  allTopDeals: [],
  currentPage: 1,
  initRetries: 0,
  descriptionCache: new Map(),
  cachedSettings: null,
  scraper: null
};

/**
 * Resets all state variables to their default/initial values.
 */
export function resetState() {
  S.isRunning = false;
  S.isPaused = false;
  S.shouldStop = false;
  S.captchaPaused = false;
  S.allTopDeals = [];
  S.currentPage = 1;
  S.initRetries = 0;
  S.descriptionCache.clear();
  S.cachedSettings = null;
  S.scraper = null;
}

/** @param {boolean} val */
export function setRunning(val) { S.isRunning = val; }
/** @param {boolean} val */
export function setPaused(val) { S.isPaused = val; }
/** @param {boolean} val */
export function setShouldStop(val) { S.shouldStop = val; }
/** @param {boolean} val */
export function setCaptchaPaused(val) { S.captchaPaused = val; }
/** @param {Array<Object>} val */
export function setAllTopDeals(val) { S.allTopDeals = val; }
/** @param {number} val */
export function setCurrentPage(val) { S.currentPage = val; }
/** @param {number} val */
export function setInitRetries(val) { S.initRetries = val; }
/** @param {Object|null} val */
export function setCachedSettings(val) { S.cachedSettings = val; }
/** @param {Object|null} val */
export function setScraper(val) { S.scraper = val; }

/**
 * Adds deals to the allTopDeals array, deduplicating by URL.
 * @param {Array<Object>} deals - Array of deal objects with `.url` property
 */
export function addDeals(deals) {
  if (!deals || deals.length === 0) return;
  const seen = new Set(S.allTopDeals.map(function (d) { return d.url; }));
  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    if (!seen.has(deal.url)) {
      seen.add(deal.url);
      S.allTopDeals.push(deal);
    }
  }
}

/** Increments currentPage by 1. */
export function incrementPage() { S.currentPage++; }

/** Default export is the mutable state bag S. */
export default S;

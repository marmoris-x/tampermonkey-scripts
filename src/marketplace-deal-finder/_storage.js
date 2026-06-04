// src/marketplace-deal-finder/_storage.js — GM storage wrappers
'use strict';

import { createLogger } from './_logger.js';
const Logger = createLogger('MDF Storage');

/* ─── Basic Key-Value Storage ─── */

/**
 * Loads a value from GM storage.
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key not found
 * @returns {Promise<*>} Stored value or default
 */
export async function loadSetting(key, defaultValue) {
  try {
    const raw = await GM.getValue(key);
    if (raw === undefined || raw === null) return defaultValue;
    return raw;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Saves a value to GM storage.
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON-serialized by GM)
 */
export async function saveSetting(key, value) {
  try {
    await GM.setValue(key, value);
  } catch (e) {
    Logger.error('Failed to save setting:', key, e.message || e);
  }
}

/* ─── Crawl State ─── */

/**
 * Saves crawl state (persisted before page navigation).
 * @param {{ currentPage: number, currentUrl: string, allTopDeals: Array, maxPages: number }} state
 * @param {string} storagePrefix - Site prefix ("wh" or "ka")
 */
export async function saveCrawlState(state, storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_crawl_state', JSON.stringify(state));
}

/**
 * Loads persisted crawl state.
 * @param {string} storagePrefix - Site prefix
 * @returns {Promise<Object|null>}
 */
export async function loadCrawlState(storagePrefix) {
  const saved = await loadSetting(storagePrefix + '_dealfinder_crawl_state', null);
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
 * @param {string} storagePrefix - Site prefix
 */
export async function clearCrawlState(storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_crawl_state', null);
}

/* ─── Results Storage ─── */

/**
 * Saves results for display after crawl completes.
 * @param {{ deals: Array, pages: number, timestamp: string }} results
 * @param {string} storagePrefix - Site prefix
 */
export async function saveResults(results, storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_results', JSON.stringify(results));
}

/**
 * Loads persisted results.
 * @param {string} storagePrefix - Site prefix
 * @returns {Promise<Object|null>}
 */
export async function loadResults(storagePrefix) {
  const saved = await loadSetting(storagePrefix + '_dealfinder_results', null);
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
 * @param {string} storagePrefix - Site prefix
 */
export async function clearResults(storagePrefix) {
  await saveSetting(storagePrefix + '_dealfinder_results', null);
}

/* ─── Settings Helpers ─── */

/**
 * Creates a deep copy of a settings object.
 * Handles nested `provider` and `providers` map.
 * @param {Object} settings - Settings object to copy
 * @returns {Object} Deep copy
 */
export function deepCopySettings(settings) {
  if (!settings) return settings;
  const copy = { ...settings };
  if (copy.provider) {
    copy.provider = { ...copy.provider };
    if (copy.provider.options) copy.provider.options = { ...copy.provider.options };
  }
  if (copy.providers) {
    copy.providers = { ...copy.providers };
    Object.keys(copy.providers).forEach(function (k) {
      copy.providers[k] = { ...copy.providers[k] };
      if (copy.providers[k].options) copy.providers[k].options = { ...copy.providers[k].options };
    });
  }
  return copy;
}

// Local copies of loadSetting and saveSetting from shared/storage-utils.js
// Converted from var to let/const for YouTube Enhanced module isolation.
'use strict';

/**
 * Loads a single setting with fallback default.
 * @template T
 * @param {string} key - Storage key
 * @param {T} [defaultValue] - Fallback if key is absent
 * @returns {Promise<T>} Parsed value or default
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
 * Persists a single value.
 * @param {string} key
 * @param {*} value - Objects are JSON-stringified automatically
 * @returns {Promise<void>}
 */
export async function saveSetting(key, value) {
  await GM.setValue(key, value);
}

// src/crunchyroll-enhanced/_storage.js — GM storage wrapper utilities
// Provides: loadSetting, saveSetting

'use strict';

/**
 * Loads a setting from GM storage with a default fallback.
 * Transparently handles JSON-serialized objects and raw values.
 * @param {string} key - Storage key
 * @param {*} [defaultValue=null] - Default value if key not found
 * @returns {Promise<*>} Stored value or default
 */
export async function loadSetting(key, defaultValue = null) {
  try {
    const raw = await GM.getValue(key);
    if (raw === undefined || raw === null) return defaultValue;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (_) { return raw; }
    }
    return raw;
  } catch (_) {
    return defaultValue;
  }
}

/**
 * Saves a setting to GM storage. Objects and arrays are JSON-serialized.
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {Promise<void>}
 */
export async function saveSetting(key, value) {
  await GM.setValue(key,
    typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : value
  );
}

// src/shared/storage-utils.js — Async storage wrappers for GM_getValue/GM_setValue
// Consolidates JSON parsing, default values, and bulk writes into single-call helpers.
// Consumers: Marketplace Deal Finder, Crunchyroll, Gutefrage, YouTube, AniSearch, Reddit,
//            Global Speed Controller, Copy as Markdown
(function () {
  'use strict';

  /**
   * Loads a single setting with fallback default.
   * @param {string} key - Storage key
   * @param {*} [defaultValue] - Fallback if key is absent
   * @returns {Promise<*>} Parsed value or default
   */
  async function loadSetting(key, defaultValue) {
    try {
      var raw = await GM.getValue(key);
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
  async function saveSetting(key, value) {
    await GM.setValue(key, value);
  }

  /**
   * Loads multiple settings at once, merging with defaults.
   * @param {Object<string,*>} defaults - Key/defaultValue map
   * @returns {Promise<Object>} Resolved settings object with defaults applied
   */
  async function loadSettings(defaults) {
    var keys = Object.keys(defaults);
    var result = {};
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = await loadSetting(keys[i], defaults[keys[i]]);
    }
    return result;
  }

  /**
   * Persists multiple settings in a single bulk operation.
   * @param {Object<string,*>} obj - Key/value map
   * @returns {Promise<void>}
   */
  async function saveSettings(obj) {
    await GM.setValues(obj);
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.storage = {
    loadSetting: loadSetting,
    saveSetting: saveSetting,
    loadSettings: loadSettings,
    saveSettings: saveSettings
  };
})();

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

// ─── Anti-Translate Settings ───────────────────────────────────────────────

/** Default settings for Anti-Translate feature */
export const AT_DEFAULTS = {
  disabled: false,
  untranslateTitle: true,
  untranslateAudio: true,
  untranslateAudioOnlyAI: false,
  untranslateDescription: true,
  untranslateChapters: true,
  untranslateChannelBranding: true,
  untranslateNotification: true,
  untranslateThumbnail: true,
  subtitlesLanguage: 'original',
  subtitlesEnabled: true,
  whiteListUntranslateTitle: [],
  whiteListUntranslateAudio: [],
  whiteListUntranslateDescription: [],
  whiteListUntranslateChapters: [],
  whiteListUntranslateChannelBranding: [],
  whiteListUntranslateThumbnail: [],
};

const AT_STORAGE_KEY = 'yt_anti_translate_settings';

/** Load anti-translate settings from GM storage, merging with defaults */
export async function loadATSettings() {
  try {
    const raw = await GM.getValue(AT_STORAGE_KEY, null);
    if (!raw) return { ...AT_DEFAULTS };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...AT_DEFAULTS, ...parsed };
  } catch {
    return { ...AT_DEFAULTS };
  }
}

/** Persist anti-translate settings to GM storage */
export async function saveATSettings(settings) {
  await GM.setValue(AT_STORAGE_KEY, JSON.stringify(settings));
}

/** In-memory settings cache, populated by boot.js at startup */
let _cachedATSettings = null;

export function getATSettingsSync() {
  return _cachedATSettings || { ...AT_DEFAULTS };
}

export function setATSettingsCache(settings) {
  _cachedATSettings = settings;
}

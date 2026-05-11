import { CONST } from './_constants.js';

/**
 * Loads a setting from GM storage with fallback to default.
 * Uses the modern async GM.getValue API.
 *
 * @template T
 * @param {string} key - GM storage key
 * @param {T} defaultValue - Fallback if not found
 * @returns {Promise<T>}
 */
export async function loadSetting(key, defaultValue) {
  try {
    const raw = await GM.getValue(key);
    return (raw === undefined || raw === null) ? defaultValue : raw;
  } catch (e) {
    console.warn('[GlobalSpeed-Storage] loadSetting failed, using default:', e);
    return defaultValue;
  }
}

/**
 * Persists a setting to GM storage.
 * @param {string} key
 * @param {*} value
 */
export async function saveSetting(key, value) {
  try {
    await GM.setValue(key, value);
  } catch (e) {
    console.error('[GlobalSpeed-Storage] saveSetting failed:', e);
  }
}

/**
 * Loads both speed and enabled state from storage.
 * @returns {Promise<{speed: number, enabled: boolean}>}
 */
export async function loadAllSettings() {
  const [speed, enabled] = await Promise.all([
    loadSetting(CONST.STORAGE_KEY_SPEED, CONST.SPEED_DEFAULT),
    loadSetting(CONST.STORAGE_KEY_ENABLED, CONST.ENABLED_DEFAULT)
  ]);
  return { speed, enabled };
}

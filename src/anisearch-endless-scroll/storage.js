/**
 * Loads a single setting with fallback default.
 * @param {string} key - Storage key
 * @param {*} [defaultValue] - Fallback if key is absent
 * @returns {Promise<*>} Parsed value or default
 */
export async function loadSetting(key, defaultValue) {
  try {
    const raw = await GM.getValue(key);
    if (raw === undefined || raw === null) return defaultValue;
    return raw;
  } catch {
    return defaultValue;
  }
}

/**
 * Persists a single value.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function saveSetting(key, value) {
  await GM.setValue(key, value);
}

// src/marketplace-deal-finder/_storage.js — Local copy of loadSetting + saveSetting

export async function loadSetting(key, defaultValue) {
  try {
    const raw = await GM.getValue(key);
    if (raw === undefined || raw === null) return defaultValue;
    return raw;
  } catch (e) {
    return defaultValue;
  }
}

export async function saveSetting(key, value) {
  await GM.setValue(key, value);
}

// src/marketplace-deal-finder/_settings.js — Settings schema v3 + migration
'use strict';

import { SETTINGS_VERSION, PROVIDER_TYPES } from './_constants.js';
import { loadSetting, saveSetting, deepCopySettings } from './_storage.js';

/* ─── Default Settings (v3 schema) ─── */

/** @constant {Object} */
export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION, // 3
  currentProvider: PROVIDER_TYPES.GEMINI,
  providers: {
    gemini: { type: 'gemini', apiKey: '', modelId: 'gemini-2.5-flash-lite', baseUrl: '', options: {} },
    openai: { type: 'openai', apiKey: '', modelId: 'gpt-5.4-nano', baseUrl: '', options: {} },
    deepseek: { type: 'deepseek', apiKey: '', modelId: 'deepseek-v4-flash', baseUrl: '', options: {} },
    claude: { type: 'claude', apiKey: '', modelId: 'claude-sonnet-4-6', baseUrl: '', options: {} },
    openrouter: { type: 'openrouter', apiKey: '', modelId: 'google/gemini-3.1-flash-lite', baseUrl: '', options: {} },
    portkey: { type: 'portkey', apiKey: '', modelId: 'gpt-5.4-nano', baseUrl: '', options: {} }
  },
  searchContext: '',
  topX: 3,
  maxPages: 10
};

/* ─── Detection ─── */

function isV1Settings(settings) {
  if (!settings || typeof settings !== 'object') return false;
  return settings.version === 1 || (typeof settings.apiKey === 'string' && !settings.provider && !settings.providers);
}

function isV2Settings(settings) {
  if (!settings || typeof settings !== 'object') return false;
  return settings.version === 2 || (settings.provider && !settings.providers);
}

/* ─── Migrations ─── */

function migrateV1toV2(v1) {
  const modelMap = v1.modelMapping || {};
  const modelKey = v1.model || 'flash';
  const modelId = modelMap[modelKey] || 'gemini-2.5-flash';
  return {
    version: 2,
    provider: {
      type: PROVIDER_TYPES.GEMINI,
      apiKey: v1.apiKey || '',
      modelId: modelId,
      baseUrl: '',
      options: {}
    },
    searchContext: v1.searchContext || '',
    topX: v1.topX ?? 3,
    maxPages: v1.maxPages ?? 10
  };
}

function migrateV2toV3(v2) {
  const type = v2.provider ? v2.provider.type : PROVIDER_TYPES.GEMINI;
  const v3 = {
    version: SETTINGS_VERSION,
    currentProvider: type,
    providers: {
      gemini: { type: 'gemini', apiKey: '', modelId: 'gemini-2.5-flash-lite', baseUrl: '', options: {} },
      openai: { type: 'openai', apiKey: '', modelId: 'gpt-5.4-nano', baseUrl: '', options: {} },
      deepseek: { type: 'deepseek', apiKey: '', modelId: 'deepseek-v4-flash', baseUrl: '', options: {} },
      claude: { type: 'claude', apiKey: '', modelId: 'claude-sonnet-4-6', baseUrl: '', options: {} },
      openrouter: { type: 'openrouter', apiKey: '', modelId: 'google/gemini-3.1-flash-lite', baseUrl: '', options: {} },
      portkey: { type: 'portkey', apiKey: '', modelId: 'gpt-5.4-nano', baseUrl: '', options: {} }
    },
    searchContext: v2.searchContext || '',
    topX: v2.topX ?? 3,
    maxPages: v2.maxPages ?? 10
  };
  // Copy v2's active provider into the providers map
  if (v2.provider) {
    const p = v2.provider;
    if (v3.providers[p.type]) {
      v3.providers[p.type] = { ...p };
    }
    // Initialize other providers from defaults above
  }
  return v3;
}

/* ─── Settings Load ─── */

/**
 * Loads settings from GM storage with migration chain v1→v2→v3.
 * Resolves settings.provider from providers[currentProvider].
 * @param {string} storagePrefix - Site prefix ("wh" or "ka")
 * @param {Object|null} cachedSettings - In-memory cache (mutated via reference)
 * @returns {Promise<{settings: Object, cachedSettings: Object}>}
 */
export async function loadSettings(storagePrefix, cachedSettings) {
  if (cachedSettings != null) {
    const copy = deepCopySettings(cachedSettings);
    // Resolve transient provider reference
    if (copy.providers && copy.currentProvider) {
      copy.provider = copy.providers[copy.currentProvider] || {};
    }
    return { settings: copy, cachedSettings };
  }

  const raw = await loadSetting(storagePrefix + '_dealfinder_settings', null);
  if (!raw) {
    const defaults = deepCopySettings(DEFAULT_SETTINGS);
    if (defaults.providers && defaults.currentProvider) {
      defaults.provider = defaults.providers[defaults.currentProvider] || {};
    }
    return { settings: deepCopySettings(defaults), cachedSettings: defaults };
  }

  try {
    let parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;

    // Remember original version before migration (check gets reset by chain)
    const needsMigration = isV1Settings(parsed) || isV2Settings(parsed);

    // Migration chain
    if (isV1Settings(parsed)) parsed = migrateV1toV2(parsed);
    if (isV2Settings(parsed)) parsed = migrateV2toV3(parsed);

    // Merge with defaults
    const merged = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      providers: { ...DEFAULT_SETTINGS.providers, ...(parsed.providers || {}) }
    };

    // If migration happened, persist
    if (needsMigration) {
      const toStore = { ...merged };
      delete toStore.provider; // transient
      await saveSetting(storagePrefix + '_dealfinder_settings', JSON.stringify(toStore));
    }

    const cs = deepCopySettings(merged);
    // Resolve transient provider reference
    cs.provider = cs.providers[cs.currentProvider] || {};
    const copy = deepCopySettings(cs);
    copy.provider = copy.providers[copy.currentProvider] || {};
    return { settings: copy, cachedSettings: cs };
  } catch (e) {
    console.warn('[MDF] Corrupted settings storage, resetting to defaults');
    await saveSetting(storagePrefix + '_dealfinder_settings', null);
    const defs = deepCopySettings(DEFAULT_SETTINGS);
    defs.provider = defs.providers[defs.currentProvider] || {};
    return { settings: deepCopySettings(defs), cachedSettings: defs };
  }
}

/**
 * Persists settings to GM storage.
 * Syncs provider→providers[currentProvider] and strips transient provider.
 * @param {string} storagePrefix - Site prefix ("wh" or "ka")
 * @param {Object} settings - Settings object to save
 */
export async function saveSettings(storagePrefix, settings) {
  const toStore = { ...settings, providers: { ...settings.providers } };
  // Sync transient provider back into providers map
  if (toStore.provider && toStore.currentProvider && toStore.providers) {
    toStore.providers[toStore.currentProvider] = { ...toStore.provider };
  }
  delete toStore.provider; // transient — reconstructed on load
  await saveSetting(storagePrefix + '_dealfinder_settings', JSON.stringify(toStore));
}

/* ─── Validation ─── */

export function validateProviderConfig(provider) {
  const errors = [];
  if (!provider || typeof provider !== 'object') {
    errors.push('Provider configuration is missing');
    return { valid: false, errors };
  }
  if (provider.apiKey === undefined) {
    // apiKey can be empty string, just check it exists
  }
  if (!provider.modelId || typeof provider.modelId !== 'string' || provider.modelId.trim().length === 0) {
    errors.push('Model ID is required');
  }
  return { valid: errors.length === 0, errors };
}

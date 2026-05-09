'use strict';

/**
 * GM-based storage adapter that mimics chrome.storage.local/sync API.
 * Both adapters use GM storage since Tampermonkey has no cross-device sync.
 */

const syncStorage = {
  async get(key) {
    try {
      return await GM.getValue(key, null);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    await GM.setValue(key, value);
  },
  async remove(key) {
    await GM.deleteValue(key);
  },
};

const localStorage = { ...syncStorage };

export { syncStorage, localStorage };

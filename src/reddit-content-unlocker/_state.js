/**
 * @fileoverview Persistent state management for Reddit Content Unlocker.
 * Stores master toggle, NSFW toggle, and spoiler toggle in GM storage.
 * Uses synchronous GM_getValue/GM_setValue for instant reads.
 *
 * @module _state
 */

/** @typedef {{ state: boolean, nsfw: boolean, spoiler: boolean }} UnblurState */

const STORAGE_KEY = 'states';

/** @type {UnblurState} */
const DEFAULTS = {
  state: true,    // Master toggle — enable/disable all unblurring
  nsfw: true,     // Unblur NSFW-tagged content
  spoiler: false  // Unblur spoiler-tagged content (default: off)
};

/** @type {UnblurState} */
let currentState;

/** @type {Array<function(UnblurState):void>} */
const listeners = [];

/**
 * Loads state from GM storage, falling back to defaults.
 * @returns {UnblurState}
 */
function loadState() {
  try {
    const stored = GM_getValue(STORAGE_KEY, false);
    if (stored && typeof stored === 'object') {
      return {
        state: stored.state ?? DEFAULTS.state,
        nsfw: stored.nsfw ?? DEFAULTS.nsfw,
        spoiler: stored.spoiler ?? DEFAULTS.spoiler
      };
    }
  } catch (e) {
    // Storage corrupted or unavailable — use defaults
    console.warn('[RedditUnlocker] Failed to load state, using defaults:', e);
  }
  return { ...DEFAULTS };
}

// Initialize state
currentState = loadState();

/**
 * Persists current state to GM storage.
 */
function saveState() {
  try {
    GM_setValue(STORAGE_KEY, { ...currentState });
  } catch (e) {
    console.error('[RedditUnlocker] Failed to save state:', e);
  }
}

/**
 * State manager with getters/setters and change listeners.
 */
export const stateManager = {
  /** @returns {boolean} Master toggle state */
  getState() {
    return currentState.state;
  },

  /** @returns {boolean} NSFW unblur toggle */
  getNsfw() {
    return currentState.nsfw;
  },

  /** @returns {boolean} Spoiler unblur toggle */
  getSpoiler() {
    return currentState.spoiler;
  },

  /** @returns {UnblurState} Full state object (read-only) */
  getAll() {
    return { ...currentState };
  },

  /**
   * Updates one or more state properties.
   * @param {Partial<UnblurState>} updates
   */
  update(updates) {
    Object.assign(currentState, updates);
    saveState();
    notifyListeners();
  },

  /**
   * Registers a change listener.
   * @param {function(UnblurState):void} fn
   */
  onChange(fn) {
    listeners.push(fn);
  }
};

/**
 * Notifies all registered listeners of state change.
 */
function notifyListeners() {
  const snapshot = { ...currentState };
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch (e) {
      console.error('[RedditUnlocker] Listener error:', e);
    }
  }
}

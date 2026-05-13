// src/crunchyroll-enhanced/state.js — Centralized state management and event emitter
// Provides: createState, createEmitter, queryById

'use strict';

/**
 * Creates the application state object.
 * All mutable state lives here — not on a class instance.
 * @returns {object} State object with cards, origOrder, flags, and sidebar ref
 */
export function createState() {
  return {
    /** @type {Map<Element, object>} Card elements mapped to extracted info objects */
    cards: new Map(),
    /** @type {Element[]} Cards in original DOM order (stable sort anchor) */
    origOrder: [],
    /** @type {boolean} Scan currently in progress */
    isScanning: false,
    /** @type {boolean} Sidebar open/closed */
    isOpen: false,
    /** @type {boolean} Badge visibility toggle */
    showBadges: true,
    /** @type {object|null} Sidebar API reference (set by buildSidebar) */
    sidebar: null,
    /** @type {MutationObserver|null} Card container mutation observer */
    _observer: null,
    /** @type {boolean} Observer paused during filter apply */
    _observerPaused: false,
    /** @type {number|null} Observer debounce timer ID */
    _observerTimer: null
  };
}

/**
 * Creates a simple event emitter for cross-module communication.
 * @returns {{ on: Function, off: Function, emit: Function, clear: Function }}
 */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    /**
     * Register an event listener.
     * @param {string} event - Event name
     * @param {Function} fn - Callback
     */
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },

    /**
     * Unregister an event listener.
     * @param {string} event - Event name
     * @param {Function} fn - Previously registered callback
     */
    off(event, fn) {
      const set = listeners.get(event);
      if (set) set.delete(fn);
    },

    /**
     * Emit an event, calling all registered listeners.
     * @param {string} event - Event name
     * @param {...unknown} args - Arguments forwarded to listeners
     */
    emit(event, ...args) {
      const set = listeners.get(event);
      if (set) set.forEach((fn) => fn(...args));
    },

    /** Removes all listeners. */
    clear() {
      listeners.clear();
    }
  };
}

/**
 * Creates a shadow-root query helper.
 * @param {ShadowRoot} root - The sidebar's shadow root
 * @returns {(id: string) => Element|null} Function that queries by escaped ID
 */
export function queryById(root) {
  return (id) => root.querySelector('#' + CSS.escape(id));
}

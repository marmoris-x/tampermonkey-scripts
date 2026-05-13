// src/crunchyroll-enhanced/app.js — Application orchestrator (replaces CrunchyrollEnhanced class)
// Provides: init
// Consumers: Entry file

'use strict';

import { createLogger } from './_logger.js';
import { waitForElement, debounce } from './_dom.js';
import { createState, createEmitter, queryById } from './state.js';
import { scanCards } from './scanner.js';
import { applyFilterAndSort } from './filters.js';
import { buildSidebar, attachEvents, updateStatus, updateStats,
         saveFilters, loadSavedFilters } from './ui-panel.js';
import { loadSetting } from './_storage.js';

const log = createLogger('Crunchyroll Enhanced');

// Guard: prevent duplicate init (from bootstrap + urlchange + menu command)
let _initialized = false;
let _state = null;
let _emitter = null;

/**
 * Initializes the Crunchyroll Enhanced application.
 * Creates state, event bus, builds UI, and wires everything together.
 * On subsequent calls (e.g., SPA navigation), just re-scans without rebuilding.
 * @param {object} [opts={}] - Options
 * @param {number} [opts.sidebarWidth=360] - Sidebar width in px
 * @returns {Promise<{ state: object, emitter: object }>}
 */
export async function init(opts = {}) {
  // Guard: on repeated calls, just re-scan to refresh card data
  if (_initialized) {
    if (_state && _state._scan && !_state.isScanning) {
      _state._scan();
    }
    return { state: _state, emitter: _emitter };
  }

  const sidebarWidth = opts.sidebarWidth ?? 360;

  // State + Event bus
  const state = createState();
  const emitter = createEmitter();

  // Debounced apply: save filters, then apply filter+sort to DOM
  const debouncedApply = debounce(() => {
    if (!state.sidebar) return;
    const _$ = queryById(state.sidebar.root);
    saveFilters(state, _$, emitter, log);
    applyFilterAndSort(createCtx(state, _$, emitter, debouncedApply));
  }, 280);

  // Create context object for legacy module functions that expect ctx
  function createCtx(st, _$, _em, da) {
    return {
      cards: st.cards,
      origOrder: st.origOrder,
      isScanning: st.isScanning,
      showBadges: st.showBadges,
      sidebar: st.sidebar,
      _observer: st._observer,
      _observerPaused: st._observerPaused,
      _observerTimer: st._observerTimer,
      _$: _$,
      log: log,
      _status: (msg) => updateStatus(st, msg),
      _updateStats: (v, t, wd) => updateStats(st, v, t, wd),
      _sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      _apply: () => da(),
      _debounceApply: () => da()
    };
  }

  // Wire scan function onto state (called by sidebar scan button)
  state._scan = async () => {
    if (!state.sidebar) return;
    const _$ = queryById(state.sidebar.root);
    const ctx = createCtx(state, _$, emitter, debouncedApply);
    await scanCards(ctx);
  };

  // Warte auf .browse-card Elemente
  await waitForElement('.browse-card', 0).catch(() => {});

  // UI aufbauen
  state.isOpen = await loadSetting('cr_sidebar_open', false);
  state.showBadges = await loadSetting('cr_show_badges', true);
  buildSidebar(state, sidebarWidth);

  const _$ = queryById(state.sidebar.root);
  await loadSavedFilters(state, _$, emitter, log);
  attachEvents(state, _$, emitter, debouncedApply);

  // Initial scan (mit Verzögerung für Hover-Panels)
  setTimeout(() => {
    const ctx = createCtx(state, _$, emitter, debouncedApply);
    scanCards(ctx);
  }, 1200);

  // Cross-module events
  emitter.on('scan:complete', () => debouncedApply());
  emitter.on('filter:changed', () => debouncedApply());

  // Mark initialized for guard
  _initialized = true;
  _state = state;
  _emitter = emitter;

  return { state, emitter };
}

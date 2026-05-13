// src/anisearch-endless-scroll/history-patch.js — History API patching for SPA navigation
// Inline module — no shared dependencies.

let _active = false;
let _navTimer = null;
let _origPush = null;
let _origReplace = null;

/**
 * Installs History API monkey-patches to detect SPA navigation on AniSearch.
 * Calls `onNavigate()` when the URL changes via pushState, replaceState, or popstate.
 * Safe to call multiple times — previous patches are cleaned up.
 *
 * Note: This is a monkey-patch approach. An alternative is `@grant window.onurlchange`
 * with `window.addEventListener('urlchange', ...)`, which requires Tampermonkey's
 * "UserScripts API Dynamic" setting but avoids direct History API modification.
 *
 * @param {Function} onNavigate - Callback fired ~600ms after navigation is detected
 */
export function patchHistory(onNavigate) {
  // Clean up previous patch if re-installing
  if (_active) {
    if (_navTimer) clearTimeout(_navTimer);
    history.pushState = _origPush;
    history.replaceState = _origReplace;
  }

  _origPush = history.pushState.bind(history);
  _origReplace = history.replaceState.bind(history);

  function scheduleNavigate() {
    if (_navTimer) clearTimeout(_navTimer);
    _navTimer = setTimeout(onNavigate, 600);
  }

  history.pushState = function (...args) {
    _origPush.apply(history, args);
    scheduleNavigate();
  };

  history.replaceState = function (...args) {
    const before = location.href;
    _origReplace.apply(history, args);
    if (location.href !== before) scheduleNavigate();
  };

  window.addEventListener('popstate', scheduleNavigate);
  _active = true;
}

/**
 * Removes the History API patches, restoring original implementations.
 */
export function unpatchHistory() {
  if (!_active) return;
  if (_navTimer) clearTimeout(_navTimer);
  if (_origPush) history.pushState = _origPush;
  if (_origReplace) history.replaceState = _origReplace;
  _active = false;
  _navTimer = null;
}

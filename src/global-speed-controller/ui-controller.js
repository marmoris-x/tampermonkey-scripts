// src/global-speed-controller/ui-controller.js — Speed indicator, menu commands, CSS
// User interface for Global Video Speed Controller.
// Handles Tampermonkey menu commands, the on-screen speed indicator,
// cross-tab synchronization, and CSS injection.

import { state, CONST, log } from './page-script-builder.js';
import { sendCmd, fallbackApply } from './injection-strategies.js';

// =========================================================
// Speed indicator (on-screen overlay)
// =========================================================

var indicator = null;

/**
 * Shows a floating speed indicator (e.g. "1.50x") in the top-right corner
 * of the page. Auto-hides after 1500ms.
 */
export function showIndicator() {
  if (!state.enabled) return;
  try {
    var doc = unsafeWindow.document;
    if (!doc.body) return;
    if (!indicator) {
      indicator = doc.createElement('div');
      indicator.id = 'gm-speed-indicator';
      doc.body.appendChild(indicator);
    }
    indicator.textContent = state.speed.toFixed(2) + 'x';
    indicator.style.display = 'block';
    clearTimeout(indicator._timeout);
    indicator._timeout = setTimeout(function () {
      if (indicator) indicator.style.display = 'none';
    }, 1500);
  } catch (e) { /* body not ready yet */ }
}

// =========================================================
// Apply helper
// =========================================================

/**
 * Sends the current speed/enabled state to all active strategies
 * (page script, unsafeWindow fallback) and updates menu labels.
 */
export function applyAll() {
  sendCmd(state.speed, state.enabled);
  fallbackApply();
  updateSetSpeedLabel();
}

// =========================================================
// Menu label management
// =========================================================

/**
 * Re-registers the "Set speed" menu command with the current speed value
 * shown in its label. Called after every speed change.
 */
export function updateSetSpeedLabel() {
  if (window.__gsUpdateSetSpeedLabel) window.__gsUpdateSetSpeedLabel();
}

// =========================================================
// Menu commands
// =========================================================

/**
 * Registers Tampermonkey menu commands for speed control:
 * - Set speed (prompt for value)
 * - Reset to 1.0x
 * - Toggle enable/disable
 */
export function setupMenuCommands() {
  var setSpeedHandler = async function () {
    var input = prompt('Playback speed (0.07 - 16):', String(state.speed));
    var val = parseFloat(input);
    if (input !== null && !isNaN(val) && val > 0) {
      state.speed = Math.max(0.07, Math.min(16, val));
      await GM.setValue(CONST.STORAGE_KEY_SPEED, state.speed);
      applyAll();
      showIndicator();
    }
  };

  var setSpeedId = GM_registerMenuCommand(
    'Set speed (' + state.speed.toFixed(2) + 'x)', setSpeedHandler
  );

  // Update label when speed changes
  window.__gsUpdateSetSpeedLabel = function () {
    if (window !== window.top) return;
    try { GM_unregisterMenuCommand(setSpeedId); } catch (_) {}
    setSpeedId = GM_registerMenuCommand(
      'Set speed (' + state.speed.toFixed(2) + 'x)', setSpeedHandler
    );
  };
  updateSetSpeedLabel();

  GM_registerMenuCommand('Reset (1.0x)', async function () {
    state.speed = 1.0;
    await GM.setValue(CONST.STORAGE_KEY_SPEED, state.speed);
    applyAll();
    showIndicator();
  });

  var label = function () { return state.enabled ? 'Disable Global Speed' : 'Enable Global Speed'; };

  var onToggle = async function () {
    state.enabled = !state.enabled;
    await GM.setValue(CONST.STORAGE_KEY_ENABLED, state.enabled);
    applyAll();
    try {
      GM_unregisterMenuCommand(toggleId);
      toggleId = GM_registerMenuCommand(label(), onToggle);
    } catch (_) {}
    if (state.enabled) showIndicator();
    else if (indicator) indicator.style.display = 'none';
  };

  var toggleId = GM_registerMenuCommand(label(), onToggle);
}

// =========================================================
// CSS
// =========================================================

/**
 * Injects styles for the on-screen speed indicator.
 */
export function addStyles() {
  GM_addStyle(
    '#gm-speed-indicator{position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.78);color:#fff;padding:7px 15px;border-radius:6px;font:bold 16px/1 sans-serif;z-index:2147483647;display:none;pointer-events:none;user-select:none}'
  );
}

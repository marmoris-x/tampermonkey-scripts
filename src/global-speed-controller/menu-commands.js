import { state } from './_state.js';
import { CONST } from './_constants.js';
import { saveSetting } from './_storage.js';

let _applyAllCallback = null;

/**
 * Registers all TM menu commands (Set Speed, Reset, Toggle Enable).
 *
 * @param {Function} applyAllFn - Reference to the applyAll function from boot
 * @param {Function} showIndicatorFn - Reference to showIndicator
 * @param {Function} hideIndicatorFn - Reference to hideIndicator
 */
export function setupMenuCommands(applyAllFn, showIndicatorFn, hideIndicatorFn) {
  _applyAllCallback = applyAllFn;

  let setSpeedId = null;
  let toggleId = null;

  const setSpeedHandler = async function() {
    const input = prompt('Playback speed (0.07 - 16):', String(state.speed));
    const val = parseFloat(input);
    if (input !== null && !isNaN(val) && val > 0) {
      state.setSpeed(val);
      await saveSetting(CONST.STORAGE_KEY_SPEED, state.speed);
      _applyAllCallback();
      showIndicatorFn();
    }
  };

  setSpeedId = GM_registerMenuCommand(
    'Set speed (' + state.speed.toFixed(2) + 'x)',
    setSpeedHandler
  );

  // Update label helper
  window.__gsUpdateSetSpeedLabel = function() {
    if (window !== window.top) return;
    try { GM_unregisterMenuCommand(setSpeedId); } catch (_) { /* ignore */ }
    setSpeedId = GM_registerMenuCommand(
      'Set speed (' + state.speed.toFixed(2) + 'x)',
      setSpeedHandler
    );
  };
  window.__gsUpdateSetSpeedLabel();

  // Reset command
  GM_registerMenuCommand('Reset (1.0x)', async function() {
    state.setSpeed(1);
    await saveSetting(CONST.STORAGE_KEY_SPEED, state.speed);
    _applyAllCallback();
    showIndicatorFn();
  });

  // Toggle command
  const label = function() {
    return state.enabled ? 'Disable Global Speed' : 'Enable Global Speed';
  };

  const onToggle = async function() {
    state.setEnabled(!state.enabled);
    await saveSetting(CONST.STORAGE_KEY_ENABLED, state.enabled);
    _applyAllCallback();
    try {
      GM_unregisterMenuCommand(toggleId);
      toggleId = GM_registerMenuCommand(label(), onToggle);
    } catch (_) { /* ignore */ }
    if (state.enabled) showIndicatorFn();
    else hideIndicatorFn();
  };

  toggleId = GM_registerMenuCommand(label(), onToggle);
}

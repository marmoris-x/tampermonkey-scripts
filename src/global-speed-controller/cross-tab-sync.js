import { createLogger } from './_logger.js';
import { state } from './_state.js';
import { CONST } from './_constants.js';

const log = createLogger('GlobalSpeed-Sync');

/**
 * Sets up cross-tab synchronization via GM_addValueChangeListener.
 * When another tab changes the speed or enabled state, this tab reacts.
 *
 * @param {Function} applyAllFn - Function to apply state to page
 */
export function setupCrossTabSync(applyAllFn) {
  GM_addValueChangeListener(CONST.STORAGE_KEY_SPEED, function(_key, _old, newVal, remote) {
    if (!remote) return;
    state.setSpeed(newVal);
    applyAllFn();
    log.log('Cross-tab: speed set to ' + newVal + 'x.');
  });

  GM_addValueChangeListener(CONST.STORAGE_KEY_ENABLED, function(_key, _old, newVal, remote) {
    if (!remote) return;
    state.setEnabled(newVal);
    applyAllFn();
    log.log('Cross-tab: enabled set to ' + newVal + '.');
  });

  log.log('Cross-tab synchronization active.');
}

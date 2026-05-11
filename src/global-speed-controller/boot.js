import { createLogger } from './_logger.js';
import { state } from './_state.js';
import { CONST } from './_constants.js';
import { loadAllSettings } from './_storage.js';
import { injectPageScript } from './page-injector.js';
import { setupUnsafeWindowFallback, fallbackApply } from './unsafe-window-fallback.js';
import { startDirectPolling } from './direct-polling.js';
import { showIndicator, hideIndicator } from './speed-indicator.js';
import { setupMenuCommands } from './menu-commands.js';
import { setupCrossTabSync } from './cross-tab-sync.js';
import { injectStyles } from './styles.js';

const log = createLogger('GlobalSpeed-Boot');

/**
 * Sends the current state to the page context via CustomEvent.
 * This is the primary communication channel to the injected page script.
 */
function sendCommand(speed, enabled) {
  try {
    unsafeWindow.dispatchEvent(
      new unsafeWindow.CustomEvent(CONST.CMD_EVENT, { detail: { speed, enabled } })
    );
    log.debug('Command sent:', { speed, enabled });
  } catch (e) {
    log.error('sendCommand failed:', e);
  }
}

/**
 * Applies the current state through ALL active paths:
 * 1. CustomEvent to page script (primary)
 * 2. unsafeWindow fallback (if active)
 * 3. Updates menu command labels
 */
export function applyAll() {
  sendCommand(state.speed, state.enabled);
  fallbackApply();
  if (window.__gsUpdateSetSpeedLabel) window.__gsUpdateSetSpeedLabel();
}

/**
 * Main initialization function.
 * Called once at script startup.
 */
export async function init() {
  log.log('init() — readyState:', document.readyState);

  // Phase 1: Inject page script with defaults (before async storage load)
  const injected = injectPageScript(CONST.SPEED_DEFAULT, CONST.ENABLED_DEFAULT);

  // Phase 2: Load persisted settings
  try {
    const { speed, enabled } = await loadAllSettings();
    state.setSpeed(speed);
    state.setEnabled(enabled);
    log.log('Loaded from storage: speed=' + state.speed + ', enabled=' + state.enabled);
  } catch (e) {
    log.error('loadSettings error (using defaults):', e);
  }

  // Phase 3: Send loaded settings to page context
  sendCommand(state.speed, state.enabled);

  // Phase 4: Activate fallbacks if primary injection failed
  if (!injected) {
    log.warn('Primary injection failed → activating unsafeWindow fallback...');
    const fallbackOk = setupUnsafeWindowFallback();
    if (!fallbackOk) {
      log.warn('unsafeWindow fallback failed → activating direct polling...');
      startDirectPolling();
    } else {
      fallbackApply();
    }
  }

  // Phase 5: Setup UI (only in top-level window)
  const setupUI = function() {
    if (window !== window.top) return;
    injectStyles();
    setupMenuCommands(applyAll, showIndicator, hideIndicator);
    setupCrossTabSync(applyAll);
    log.log('UI ready.');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUI, { once: true });
  } else {
    setupUI();
  }
}

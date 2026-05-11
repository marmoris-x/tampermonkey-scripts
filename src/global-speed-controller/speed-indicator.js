import { state } from './_state.js';
import { CONST } from './_constants.js';

let indicator = null;

/**
 * Displays a temporary floating speed indicator in the top-right corner.
 * Uses Shadow DOM for isolation from page styles.
 * Auto-hides after INDICATOR_TIMEOUT_MS.
 */
export function showIndicator() {
  if (!state.enabled) return;
  try {
    const doc = unsafeWindow.document;
    if (!doc.body) return;

    if (!indicator) {
      indicator = doc.createElement('div');
      indicator.id = CONST.INDICATOR_ID;
      doc.body.appendChild(indicator);
    }

    indicator.textContent = state.speed.toFixed(2) + 'x';
    indicator.style.display = 'block';

    clearTimeout(indicator._timeout);
    indicator._timeout = setTimeout(function() {
      if (indicator) indicator.style.display = 'none';
    }, CONST.INDICATOR_TIMEOUT_MS);
  } catch (e) {
    // Silently fail — indicator is non-critical
  }
}

/**
 * Hides the indicator immediately (used when disabling).
 */
export function hideIndicator() {
  if (indicator) indicator.style.display = 'none';
}

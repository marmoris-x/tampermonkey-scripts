import { createLogger } from './_logger.js';
import { buildPageScript } from './page-script-builder.js';

const log = createLogger('GlobalSpeed-Injector');

/**
 * Injects the page-context script using GM_addElement.
 * This bypasses page CSP restrictions that would block inline scripts.
 *
 * Falls back to document.createElement if GM_addElement is unavailable
 * (e.g., older TM versions or other script managers).
 *
 * @param {number} speed - Initial speed
 * @param {boolean} enabled - Initial enabled state
 * @returns {boolean} Whether injection succeeded
 */
export function injectPageScript(speed, enabled) {
  try {
    const scriptContent = buildPageScript(speed, enabled);

    // Primary path: GM_addElement bypasses CSP (TM 4.11+)
    if (typeof GM_addElement !== 'undefined') {
      GM_addElement('script', {
        type: 'text/javascript',
        textContent: scriptContent
      });
      log.log('Page script injected via GM_addElement.');
      return true;
    }

    // Fallback: traditional DOM injection (may be blocked by CSP)
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.textContent = scriptContent;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    log.log('Page script injected via DOM (CSP may block this).');
    return true;

  } catch (e) {
    log.error('Page script injection failed (CSP likely):', e);
    return false;
  }
}

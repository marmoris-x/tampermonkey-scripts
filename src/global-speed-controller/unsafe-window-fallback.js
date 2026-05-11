import { createLogger } from './_logger.js';
import { state } from './_state.js';

const log = createLogger('GlobalSpeed-Fallback');

let fallbackOrigDesc = null;

/**
 * Sets up the prototype override via unsafeWindow when page script injection fails.
 * This is the SECOND fallback tier.
 *
 * @returns {boolean} Whether fallback was successfully set up
 */
export function setupUnsafeWindowFallback() {
  try {
    const uw = unsafeWindow;
    if (!uw || !uw.HTMLMediaElement) {
      log.warn('Fallback: unsafeWindow.HTMLMediaElement not available.');
      return false;
    }

    fallbackOrigDesc = Object.getOwnPropertyDescriptor(
      uw.HTMLMediaElement.prototype,
      'playbackRate'
    );

    if (!fallbackOrigDesc || !fallbackOrigDesc.get || !fallbackOrigDesc.set) {
      log.warn('Fallback: descriptor not usable.');
      return false;
    }

    const fd = fallbackOrigDesc;
    let isApplying = false;

    Object.defineProperty(uw.HTMLMediaElement.prototype, 'playbackRate', {
      configurable: true,
      enumerable: true,
      get() {
        return state.enabled ? state.speed : fd.get.call(this);
      },
      set(rate) {
        if (isApplying || !state.enabled) fd.set.call(this, rate);
      }
    });

    // Expose apply function for external calls
    unsafeWindow.__gsFallbackApply = function() {
      const elements = uw.document.querySelectorAll('video, audio');
      elements.forEach(function(el) {
        try {
          isApplying = true;
          fd.set.call(el, state.enabled ? state.speed : 1);
        } finally {
          isApplying = false;
        }
      });
    };

    log.log('unsafeWindow fallback active.');
    return true;
  } catch (e) {
    log.error('unsafeWindow fallback error:', e);
    return false;
  }
}

/**
 * Triggers the unsafeWindow fallback apply function.
 */
export function fallbackApply() {
  try {
    if (unsafeWindow.__gsFallbackApply) {
      unsafeWindow.__gsFallbackApply();
    }
  } catch (e) {
    log.error('fallbackApply error:', e);
  }
}

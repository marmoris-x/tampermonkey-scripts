import { createLogger } from './_logger.js';
import { state } from './_state.js';
import { CONST } from './_constants.js';

const log = createLogger('GlobalSpeed-Polling');

let pollingActive = false;

/**
 * Starts direct polling as the LAST RESORT fallback.
 * Repeatedly sets playbackRate on all media elements via setInterval.
 * Automatically stops after MAX_TICKS iterations.
 */
export function startDirectPolling() {
  if (pollingActive) return;
  pollingActive = true;
  log.log('Direct polling started (last resort).');

  let ticks = 0;
  const id = setInterval(function() {
    if (!state.enabled) return;
    try {
      const els = unsafeWindow.document.querySelectorAll('video, audio');
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (Math.abs(el.playbackRate - state.speed) > 1e-3) {
          log.log('Polling: Set rate', state.speed, 'on', el.tagName);
          el.playbackRate = state.speed;
        }
      }
    } catch (e) {
      log.error('Polling error:', e);
    }
    if (++ticks >= CONST.POLLING_MAX_TICKS) clearInterval(id);
  }, CONST.POLLING_INTERVAL_MS);
}

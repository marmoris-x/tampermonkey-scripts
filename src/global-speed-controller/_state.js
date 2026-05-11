import { createLogger } from './_logger.js';

const log = createLogger('GlobalSpeed-State');

/**
 * Reactive application state singleton.
 * Acts as the single source of truth for speed and enabled status.
 * All mutations flow through setSpeed() and setEnabled().
 */
export const state = {
  /** @type {number} */
  speed: 1,
  /** @type {boolean} */
  enabled: true,

  /**
   * Set playback speed with bounds validation.
   * @param {number} newSpeed - Must be between 0.07 and 16
   */
  setSpeed(newSpeed) {
    const clamped = Math.max(0.07, Math.min(16, newSpeed));
    if (clamped !== this.speed) {
      this.speed = clamped;
      log.debug('Speed changed:', clamped);
      return true;
    }
    return false;
  },

  /**
   * Enable or disable the global speed override.
   * @param {boolean} flag
   */
  setEnabled(flag) {
    const bool = Boolean(flag);
    if (bool !== this.enabled) {
      this.enabled = bool;
      log.debug('Enabled changed:', bool);
      return true;
    }
    return false;
  }
};

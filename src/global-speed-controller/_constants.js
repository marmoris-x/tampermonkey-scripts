/**
 * Application-wide constants for Global Video Speed Controller.
 * All storage keys and event names are centralized here.
 */
export const CONST = Object.freeze({
  PAGE_LOG:            '[GlobalSpeed-Page]',
  CMD_EVENT:           '__GS_CMD__',
  STORAGE_KEY_SPEED:   'global_video_speed',
  STORAGE_KEY_ENABLED: 'global_video_speed_enabled',
  SPEED_MIN:           0.07,
  SPEED_MAX:           16,
  SPEED_DEFAULT:       1,
  ENABLED_DEFAULT:     true,
  INDICATOR_ID:        'gm-speed-indicator',
  POLLING_INTERVAL_MS: 500,
  POLLING_MAX_TICKS:   60,
  PERIODIC_SCAN_MAX:   30,
  INDICATOR_TIMEOUT_MS: 1500
});

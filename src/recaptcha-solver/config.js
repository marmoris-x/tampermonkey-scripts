'use strict';

// ── CSS Selectors ──────────────────────────────────────────────────────────────

/** @type {Record<string, string>} CSS selectors for reCAPTCHA DOM elements */
export const SEL = {
  AUDIO_BUTTON:   '#recaptcha-audio-button',
  AUDIO_SOURCE:   '#audio-source',
  IMAGE_SELECT:   '#rc-imageselect',
  RESPONSE_FIELD: '.rc-audiochallenge-response-field',
  AUDIO_ERROR:    '.rc-audiochallenge-error-message',
  AUDIO_RESPONSE: '#audio-response',
  RELOAD_BUTTON:  '#recaptcha-reload-button',
  STATUS:         '#recaptcha-accessible-status',
  DOSCAPTCHA:     '.rc-doscaptcha-body',
  VERIFY_BUTTON:  '#recaptcha-verify-button',
  RC_BUTTONS:     '.rc-buttons',
  HELP_HOLDER:    '.help-button-holder'
};

// ── Solver Configuration ──────────────────────────────────────────────────────

/** @type {number} Max challenge attempts before giving up */
export const MAX_ATTEMPTS = 5;

/** @type {number} Solver loop polling interval in ms */
export const INTERVAL_MS = 1000;

/** @type {number} Grace period after submit before reloading */
export const SUBMIT_GRACE_MS = 3500;

/** @type {number} Timeout for stuck XHR requests */
export const STUCK_TIMEOUT_MS = 45000;

/** @type {number} Maximum valid response text length */
export const MAX_RESPONSE_LEN = 100;

/** @type {number} Debounce delay for audio button clicks */
export const AUDIO_BTN_DEBOUNCE_MS = 4000;

// ── Servers ───────────────────────────────────────────────────────────────────

/** @type {string[]} Speech recognition server URLs */
export const SERVERS = [
  'https://engageub.pythonanywhere.com',
  'https://engageub1.pythonanywhere.com'
];

// ── UI Element IDs ────────────────────────────────────────────────────────────

/** @type {string} Solve button element ID */
export const BUTTON_ID = 'rs-solve-btn';

/** @type {string} Shadow DOM host element ID */
export const HOST_ID = 'rs-solve-host';

/** @type {string} Selector for the help button holder anchor */
export const HELP_SEL = '.help-button-holder';

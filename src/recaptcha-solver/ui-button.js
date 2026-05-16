'use strict';

import { createLogger } from './_logger.js';
import { qs } from './_dom.js';
import { BUTTON_ID, HOST_ID, HELP_SEL } from './config.js';
import { BTN_STATES, createStyleSheet } from './ui-styles.js';

// ── Logger ────────────────────────────────────────────────────────────────────

const log = createLogger('Recaptcha Solver');

// ── Button State Management ────────────────────────────────────────────────────

/**
 * Updates the button's appearance based on state name.
 * Uses innerHTML for SVG icons — safe because SVGs are hardcoded constants
 * in ui-styles.js (not user data) and the button lives inside a closed Shadow DOM.
 * @param {HTMLElement} btn - The solve button element
 * @param {string} stateName - One of: ready, working, success, failed, dos
 */
export function setButtonState(btn, stateName) {
  if (!btn) return;
  const s = BTN_STATES[stateName] || BTN_STATES.ready;
  btn.innerHTML      = s[0];
  btn.title          = s[1];
  btn.disabled       = s[3];
  btn.className      = 'rc-button goog-inline-block rs-btn' + (s[2] ? ' ' + s[2] : '');
}

// ── Button Injection ───────────────────────────────────────────────────────────

/**
 * Creates and injects the solve button into the reCAPTCHA challenge footer.
 * Uses closed Shadow DOM for complete style isolation from the page.
 * @param {Object} opts
 * @param {() => void} opts.onClick - Click handler (wired by boot.js)
 * @returns {{ host: HTMLDivElement, button: HTMLButtonElement, shadowRoot: ShadowRoot } | null}
 */
export function injectButton({ onClick }) {
  const helpHolder = qs(HELP_SEL);
  if (!helpHolder) return null;

  // Prevent double injection
  if (document.getElementById(HOST_ID)) return null;

  // ── Shadow DOM host ────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = HOST_ID;

  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.adoptedStyleSheets = [createStyleSheet()];

  // ── Button inside shadow ───────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.tabIndex = 0;
  setButtonState(btn, 'ready');

  btn.addEventListener('click', onClick);

  // ── Wrapper inside shadow (for flex layout) ────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = 'rs-btn-holder';
  wrapper.appendChild(btn);
  shadow.appendChild(wrapper);

  // ── Inject host into page ──────────────────────────────────────────────────
  helpHolder.insertAdjacentElement('afterend', host);
  log.log('Solve button injected');

  return { host, button: btn, shadowRoot: shadow };
}

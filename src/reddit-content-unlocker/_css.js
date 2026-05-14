/**
 * @fileoverview CSS constants and injection utilities.
 * All styles are injected via GM_addElement to bypass page CSP.
 *
 * @module _css
 */

import { SELECTORS, SHADOW_STYLE_IDS } from './_selectors.js';

/**
 * Global CSS injected at document-start.
 * Hides NSFW modals, removes image filters, reveals blurred slots.
 * Uses !important to override Reddit's inline styles.
 */
export const GLOBAL_CSS = `
  faceplate-modal[blocking],
  faceplate-modal#blocking-modal,
  faceplate-dialog[id*="nsfw"],
  faceplate-dialog[id*="qr"],
  div.prompt,
  xpromo-nsfw-blocking-container a[slot="view-in-app-button"],
  div[style*="backdrop-filter: blur"] {
    display: none !important;
  }

  img {
    filter: none !important;
  }

  [slot="blurred"] img {
    opacity: 1 !important;
    filter: none !important;
  }
`;

/**
 * CSS for the inline Unblur toggle menu.
 * Uses Reddit-compatible dark theme colors.
 * All styles are self-contained — no external dependencies.
 */
export const MENU_CSS = `
  #menu-unblur {
    position: relative;
    display: flex;
    align-items: center;
    margin: 0 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    z-index: 9999;
  }

  #popup-toggle {
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: #ff4500;
    user-select: none;
    white-space: nowrap;
    transition: background 0.2s;
  }

  #popup-toggle:hover,
  #menu-unblur.active #popup-toggle {
    background: #e03d00;
  }

  #status-container {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #1a1a1b;
    border: 1px solid #343536;
    border-radius: 8px;
    padding: 10px 14px;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    color: #d7dadc;
  }

  #menu-unblur.active #status-container {
    display: block;
  }

  #container-toggle {
    display: flex;
    justify-content: center;
    margin-bottom: 10px;
  }

  #container-toggle label {
    cursor: pointer;
  }

  #container-toggle svg {
    width: 28px;
    height: 28px;
    fill: #ff4500;
    transition: fill 0.2s;
  }

  #container-toggle input {
    display: none;
  }

  #container-toggle input:not(:checked) + svg {
    fill: #818384;
  }

  #selected-ops {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #selected-ops label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 13px;
  }

  #selected-ops input[type="checkbox"] {
    display: none;
  }

  .slider {
    position: relative;
    display: inline-block;
    width: 34px;
    height: 18px;
    background: #343536;
    border-radius: 18px;
    flex-shrink: 0;
    transition: background 0.2s;
  }

  .slider::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }

  input[type="checkbox"]:checked + .slider {
    background: #ff4500;
  }

  input[type="checkbox"]:checked + .slider::after {
    transform: translateX(16px);
  }

  .slider-label {
    color: #d7dadc;
  }
`;

/** @type {boolean} Track whether global CSS has been injected */
let globalCSSInjected = false;

/** @type {boolean} Track whether menu CSS has been injected */
let menuCSSInjected = false;

/**
 * Injects global hide/unblur CSS into document head.
 * Uses GM_addElement to bypass Content Security Policy.
 * Idempotent — safe to call multiple times.
 */
export function injectGlobalCSS() {
  if (globalCSSInjected) return;
  globalCSSInjected = true;

  const style = GM_addElement('style', {
    id: SHADOW_STYLE_IDS.UNBLUR_CSS,
    textContent: GLOBAL_CSS
  });
  document.head.appendChild(style);
}

/**
 * Injects menu CSS into document head.
 * Idempotent — safe to call multiple times.
 */
export function injectMenuCSS() {
  if (menuCSSInjected) return;
  menuCSSInjected = true;

  const style = GM_addElement('style', {
    textContent: MENU_CSS
  });
  document.head.appendChild(style);
}

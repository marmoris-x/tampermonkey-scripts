/**
 * @fileoverview CSS constants and injection utilities.
 * All styles are injected via GM_addElement to bypass page CSP.
 *
 * @module _css
 */

import { SHADOW_STYLE_IDS } from './_selectors.js';

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
  div[style*="backdrop-filter: blur"],
  rpl-dialog[blocking],
  rpl-dialog[open],
  auth-flow-manager {
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

/** @type {boolean} Track whether global CSS has been injected */
let globalCSSInjected = false;

/**
 * Injects global hide/unblur CSS into document head.
 * Uses document.createElement (NOT GM_addElement) to match
 * the old script's behavior exactly.
 * Idempotent — safe to call multiple times.
 */
export function injectGlobalCSS() {
  if (globalCSSInjected) return;
  globalCSSInjected = true;

  const style = document.createElement('style');
  style.id = SHADOW_STYLE_IDS.UNBLUR_CSS;
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
}

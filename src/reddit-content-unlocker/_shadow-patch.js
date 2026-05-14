/**
 * @fileoverview Monkey-patches Element.prototype.attachShadow to inject
 * reveal CSS the instant Reddit attaches a shadow root to
 * <shreddit-blurred-container>. This eliminates the need to scan
 * all elements on every MutationObserver tick.
 *
 * CRITICAL: This patch runs at document-start, before any Reddit
 * web components are defined. The patch must be in place before
 * the first <shreddit-blurred-container> is created.
 *
 * @module _shadow-patch
 */

import { SHADOW_STYLE_IDS, SLOTS } from './_selectors.js';

/**
 * CSS injected into every shreddit-blurred-container shadow root.
 * Hides the blurred slot, reveals the actual content, hides prompts.
 */
const REVEAL_SHADOW_CSS = [
  `slot[name="${SLOTS.REVEALED}"]{display:block!important;opacity:1!important;height:100%!important}`,
  'div.prompt{display:none!important}'
].join('');

/** @type {typeof Element.prototype.attachShadow} */
const originalAttachShadow = Element.prototype.attachShadow;

/**
 * Patched attachShadow that intercepts shreddit-blurred-container
 * shadow root creation.
 *
 * @this {Element}
 * @param {ShadowRootInit} init - Shadow root initialization options
 * @returns {ShadowRoot} The created shadow root
 */
function patchedAttachShadow(init) {
  // Call original method
  const shadowRoot = originalAttachShadow.call(this, init);

  // Intercept shreddit-blurred-container shadow roots
  const tagName = this.tagName?.toLowerCase();
  if (tagName === 'shreddit-blurred-container') {
    const style = document.createElement('style');
    style.id = SHADOW_STYLE_IDS.U_REVEAL;
    style.textContent = REVEAL_SHADOW_CSS;
    shadowRoot.appendChild(style);
  }

  return shadowRoot;
}

/**
 * Installs the attachShadow monkey-patch.
 * Must be called at document-start, before any Reddit components load.
 */
export function patchAttachShadow() {
  Element.prototype.attachShadow = patchedAttachShadow;
}

/**
 * Restores the original attachShadow. Useful for cleanup/testing.
 * Not normally called in production.
 */
export function unpatchAttachShadow() {
  Element.prototype.attachShadow = originalAttachShadow;
}

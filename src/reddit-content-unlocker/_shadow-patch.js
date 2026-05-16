/**
 * @fileoverview Monkey-patches Element.prototype.attachShadow to inject
 * reveal CSS the instant Reddit attaches a shadow root. For ALL custom
 * elements, injects div.prompt{display:none!important} to hide NSFW
 * blocking overlays. For shreddit-blurred-container specifically, also
 * injects the full reveal CSS (slot visibility, etc.).
 *
 * CRITICAL: This patch runs at document-start, before any Reddit
 * web components are defined. The patch must be in place before
 * the first Element.attachShadow call.
 *
 * @module _shadow-patch
 */

import { SHADOW_STYLE_IDS, SLOTS } from './_selectors.js';

/**
 * CSS injected into every shreddit-blurred-container shadow root.
 * Hides the blurred slot, reveals the actual content, hides prompts.
 */
const REVEAL_SHADOW_CSS = [
  `slot[name="${SLOTS.BLURRED}"]{display:none!important}`,
  `slot[name="${SLOTS.REVEALED}"]{display:block!important;opacity:1!important;height:100%!important}`,
  'div.prompt{display:none!important}'
].join('');

/**
 * CSS injected into ALL shadow roots to hide NSFW blocking prompts.
 * div.prompt lives inside various Reddit custom elements' shadow DOMs
 * where global CSS can't reach.
 */
export const PROMPT_HIDE_CSS = 'div.prompt{display:none!important}';

/** @type {typeof Element.prototype.attachShadow} */
const originalAttachShadow = Element.prototype.attachShadow;

/**
 * Patched attachShadow that injects prompt-hiding CSS into every
 * shadow root, plus full reveal CSS for shreddit-blurred-container.
 *
 * @this {Element}
 * @param {ShadowRootInit} init - Shadow root initialization options
 * @returns {ShadowRoot} The created shadow root
 */
function patchedAttachShadow(init) {
  // Call original method
  const shadowRoot = originalAttachShadow.call(this, init);

  // Inject prompt-hide CSS into EVERY shadow root.
  // div.prompt cannot be reached by global CSS (shadow DOM isolation)
  // so we inject it at creation time for all custom elements.
  const style = document.createElement('style');
  const tagName = this.tagName?.toLowerCase();

  if (tagName === 'shreddit-blurred-container') {
    style.id = SHADOW_STYLE_IDS.U_REVEAL;
    style.textContent = REVEAL_SHADOW_CSS;
  } else {
    style.textContent = PROMPT_HIDE_CSS;
  }
  shadowRoot.appendChild(style);

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

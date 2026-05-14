/**
 * @fileoverview Bootstrap module for Reddit Content Unlocker.
 * Initializes the shadow DOM patch, CSS injection, menu UI,
 * and mutation observer for continuous content unblurring.
 * Handles SPA navigation via window.onurlchange.
 *
 * @module boot
 */

import { stateManager } from './_state.js';
import { SELECTORS } from './_selectors.js';
import { injectGlobalCSS, injectMenuCSS } from './_css.js';
import { patchAttachShadow } from './_shadow-patch.js';
import { observeMutations, debounce } from './_dom-utils.js';
import { unblurCallback } from './_unblur-engine.js';
import { initMenu } from './_menu-ui.js';

/** @type {MutationObserver|null} */
let observer = null;

/** @type {boolean} */
let menuInitialized = false;

/**
 * Main initialization routine.
 * Called once at document-start.
 */
export function registerBoot() {
  // 1. Patch attachShadow BEFORE any Reddit web components load
  patchAttachShadow();

  // 2. Inject global CSS immediately (hides modals before paint)
  injectGlobalCSS();

  // 3. Start mutation observer for dynamic content
  const debouncedCallback = debounce(handleMutations, 150);
  observer = observeMutations(debouncedCallback, document);

  // 4. Set up SPA navigation handler
  window.addEventListener('urlchange', onUrlChange);

  // 5. Safety timeout: disconnect observer if Reddit app never loads
  setTimeout(() => {
    if (!document.querySelector(SELECTORS.REDDIT_APP)) {
      observer?.disconnect();
    }
  }, 8000);
}

/**
 * Handles each mutation batch.
 * Ensures menu is initialized once, then delegates to unblur engine.
 * @param {Element} node - Added element node
 * @param {MutationObserver} obs - The observer instance
 */
function handleMutations(node, obs) {
  // Initialize menu on first mutation (when header is available)
  if (!menuInitialized) {
    menuInitialized = true;
    injectMenuCSS();
    initMenu();
  }

  // Skip unblur if master toggle is off
  if (!stateManager.getState()) return;

  unblurCallback();
}

/**
 * Handles SPA navigation within Reddit.
 * Re-runs unblur logic for newly loaded pages.
 */
function onUrlChange() {
  // Run unblur immediately on navigation
  if (stateManager.getState()) {
    unblurCallback();
  }
}

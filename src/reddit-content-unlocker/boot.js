/**
 * @fileoverview Bootstrap module for Reddit Content Unlocker.
 * Initializes the shadow DOM patch, CSS injection, menu UI,
 * and mutation observer for continuous content unblurring.
 * Handles SPA navigation via MutationObserver.
 *
 * @module boot
 */

import { stateManager } from './_state.js';
import { SELECTORS } from './_selectors.js';
import { injectGlobalCSS, injectMenuCSS } from './_css.js';
import { patchAttachShadow, PROMPT_HIDE_CSS } from './_shadow-patch.js';
import { observeMutations, debounce } from './_dom-utils.js';
import { unblurCallback } from './_unblur-engine.js';
import { initMenu } from './_menu-ui.js';
import { extractPostInfo, checkNsfw, performRedirect, setupSPAListener, handleAgeGate } from './_redirect.js';

/** @type {MutationObserver|null} */
let observer = null;

/** @type {boolean} */
let menuInitialized = false;

/**
 * Main initialization routine.
 * Called once at document-start.
 */
export function registerBoot() {
  // 0. On old.reddit.com, only handle age gate — no unblur needed
  if (location.hostname === 'old.reddit.com') {
    handleAgeGate();
    return;
  }

  // 0.5. For post detail pages, fire async NSFW check in parallel with init.
  // If the API confirms NSFW, we redirect after init completes.
  const postInfo = extractPostInfo(location.href);
  const nsfwPromise = postInfo
    ? checkNsfw(postInfo.subreddit, postInfo.postId)
    : Promise.resolve(false);

  // 1. Patch attachShadow BEFORE any Reddit web components load
  patchAttachShadow();

  // 1.5. Inject prompt-hide CSS into any shadow roots that were created
  // before our patch was installed (e.g. server-rendered components).
  // This is a one-time scan — new shadow roots are handled by the patch.
  injectPromptCSS();

  // 2. Inject global CSS immediately (hides modals before paint)
  injectGlobalCSS();

  // 3. Start mutation observer for dynamic content
  const debouncedCallback = debounce(handleMutations, 150);
  observer = observeMutations(debouncedCallback, document);

  // 4. Initial scan: handle elements that already exist
  // For document-start this is a no-op (DOM is empty).
  // For late injection, this unblurs existing content immediately.
  unblurCallback();

  // 4.5. Re-scan when HTML is fully parsed — catches server-rendered content
  // that may not have been in the DOM during the initial synchronous scan.
  document.addEventListener('DOMContentLoaded', () => {
    unblurCallback();
  }, { once: true });

  // 5. Delayed init: ensure menu + full scan even if no mutations fire
  setTimeout(() => {
    initMenuWithFallback();
    unblurCallback();
  }, 1500);

  // 6. Safety timeout: disconnect observer if Reddit app never loads
  setTimeout(() => {
    if (!document.querySelector(SELECTORS.REDDIT_APP)) {
      observer?.disconnect();
    }
  }, 8000);

  // 7. SPA navigation listener — checks NSFW status via API when Reddit's
  // router navigates to a post detail page without a full page load
  setupSPAListener();

  // 8. NSFW redirect check — runs after all init, redirects only if NSFW.
  // If the URL wasn't a post detail page, the promise resolves false immediately.
  nsfwPromise.then((isNsfw) => {
    if (isNsfw) {
      performRedirect(location.href);
    }
  });
}

/**
 * One-time scan: inject prompt-hiding CSS into shadow roots of
 * elements that were created before our attachShadow patch was in
 * place. After this, the attachShadow patch handles all new elements.
 */
function injectPromptCSS() {
  document.querySelectorAll('*').forEach((el) => {
    const sr = el.shadowRoot;
    if (!sr) return;
    // Check if our CSS is already injected (via attachShadow patch)
    for (const child of sr.children) {
      if (child.tagName === 'STYLE' && child.textContent.includes('div.prompt{display:none}')) {
        return;
      }
    }
    // Need to inject — check if div.prompt exists in this shadow root
    if (sr.querySelector('div.prompt')) {
      const s = document.createElement('style');
      s.textContent = 'div.prompt{display:none!important}';
      sr.appendChild(s);
    }
  });
}

/**
 * Handles each mutation batch.
 * Ensures menu is initialized once, then delegates to unblur engine.
 * @param {Element} node - Added element node
 * @param {MutationObserver} obs - The observer instance
 */
function handleMutations(_node, _obs) {
  initMenuWithFallback();

  // Skip unblur if master toggle is off
  if (!stateManager.getState()) return;

  unblurCallback();
}

/**
 * Initialize menu UI if not already done.
 * Safe to call after SPA navigation when the header is replaced.
 */
function initMenuWithFallback() {
  if (!menuInitialized) {
    menuInitialized = true;
    injectMenuCSS();
    initMenu();
  }
}

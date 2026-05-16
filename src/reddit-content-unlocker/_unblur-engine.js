/**
 * @fileoverview Core unblur engine.
 * Orchestrates all DOM manipulation to remove NSFW popups,
 * unblur content, and reveal hidden media on Reddit.
 *
 * This is the main callback invoked by the MutationObserver on every
 * DOM change batch.
 *
 * @module _unblur-engine
 */

import { SELECTORS, ATTRS, SLOTS, BUNDLE_PATTERNS } from './_selectors.js';
import { injectGlobalCSS } from './_css.js';
import { removeAll, reveal, unblurImgs } from './_dom-utils.js';
import { removeImageBlur } from './_image-cleaner.js';
import { stateManager } from './_state.js';

/**
 * Main unblur callback. Performs all DOM cleanup operations.
 *
 * Execution order is optimized:
 * 1. Quick CSS injection (hides elements before they paint)
 * 2. Remove blocking modals/dialogs
 * 3. Clean backdrop-filter overlays
 * 4. Handle shadow DOM blurred containers
 * 5. Remove blur attributes from elements
 * 6. Click-through NSFW/spoiler containers
 * 7. Clean images
 * 8. Restore scroll
 */
export function unblurCallback() {
  // Skip if master toggle is off
  if (!stateManager.getState()) return;

  // Ensure global CSS is injected (idempotent)
  injectGlobalCSS();

  // --- Phase 1: Remove blocking modals and dialogs ---
  removeAll(SELECTORS.FACEPLATE_MODAL_BLOCKING);
  removeAll(SELECTORS.FACEPLATE_MODAL_ID);
  removeAll(SELECTORS.FACEPLATE_DIALOG_NSFW_QR);
  removeAll(SELECTORS.FACEPLATE_DIALOG_NSFW);
  removeAll(SELECTORS.FACEPLATE_DIALOG_QR);

  // --- Phase 2: Remove overlay/shadow/prompt elements ---
  removeAll(SELECTORS.DIV_PROMPT);
  removeAll(SELECTORS.THUMBNAIL_SHADOW);
  removeAll(SELECTORS.BG_MEDIA_BACKGROUND);
  removeAll(SELECTORS.VIEW_IN_APP_BUTTON);

  // --- Phase 3: Clean backdrop-filter fixed overlays ---
  document.querySelectorAll(SELECTORS.BACKDROP_FILTER_FIXED).forEach((el) => {
    if (el.style.position === 'fixed') {
      el.remove();
    }
  });

  // --- Phase 4: Clean color-scrim elements ---
  document.querySelectorAll(SELECTORS.COLOR_SCRIM).forEach((el) => {
    el.style.removeProperty('box-shadow');
    el.removeAttribute(ATTRS.OPEN);
  });

  // --- Phase 5: Remove NSFW async loaders ---
  const asyncLoaders = document.getElementsByTagName('shreddit-async-loader');
  for (const loader of [...asyncLoaders]) {
    const bundleName = loader.getAttribute(ATTRS.BUNDLENAME);
    if (bundleName?.includes(BUNDLE_PATTERNS.NSFW)) {
      loader.remove();
    }
  }

  // --- Phase 6: Patch shadow roots of blurred containers ---
  // Some containers may have been created before our attachShadow patch
  const blurredContainers = document.getElementsByTagName('shreddit-blurred-container');
  for (const container of [...blurredContainers]) {
    const shadowRoot = container.shadowRoot;
    if (!shadowRoot || shadowRoot.querySelector('#u-reveal')) continue;

    const style = document.createElement('style');
    style.id = 'u-reveal';
    style.textContent = [
      `slot[name="${SLOTS.BLURRED}"]{display:none!important}`,
      `slot[name="${SLOTS.REVEALED}"]{display:block!important;opacity:1!important;height:100%!important}`,
      'div.prompt{display:none!important}'
    ].join('');
    shadowRoot.appendChild(style);
  }

  // --- Phase 7: Remove blocking attributes ---
  document.querySelectorAll(`[${ATTRS.IS_NSFW_BLOCKED}]`).forEach((el) => {
    el.removeAttribute(ATTRS.IS_NSFW_BLOCKED);
  });

  document.querySelectorAll(`[${ATTRS.BLURRED}]`).forEach((el) => {
    el.removeAttribute(ATTRS.BLURRED);
  });

  // --- Phase 8: Click-through NSFW/spoiler blurred containers ---
  // Simulate user clicking "View" on blurred content
  const state = stateManager.getAll();
  for (const blurred of [...blurredContainers]) {
    const reason = blurred.getAttribute(ATTRS.REASON);

    // Skip if this reason type is disabled in settings
    if (reason === 'nsfw' && !state.nsfw) continue;
    if (reason === 'spoiler' && !state.spoiler) continue;

    // Remove blur and mark as clicked
    blurred.removeAttribute(ATTRS.BLURRED);
    blurred.setAttribute(ATTRS.CLICKED, '');

    // Trigger Reddit's own reveal handler via click simulation
    try { blurred.click(); } catch {}
    try { blurred.firstElementChild?.click(); } catch {}

    // Handle slotted content
    const blurredSlot = blurred.querySelector(`[slot="${SLOTS.BLURRED}"]`);
    const revealedSlot = blurred.querySelector(`[slot="${SLOTS.REVEALED}"]`);

    if (revealedSlot) {
      // Hide blurred slot, reveal the actual content
      blurredSlot?.style.setProperty('display', 'none', 'important');
      reveal(revealedSlot);
    } else if (blurredSlot) {
      // No separate revealed slot — just reveal what's there
      reveal(blurredSlot);
      unblurImgs(blurredSlot);
    }

  }

  // --- Phase 9: Handle blurred slots in aspect-ratio containers ---
  document.querySelectorAll(SELECTORS.ASPECT_RATIO_BLURRED).forEach((el) => {
    reveal(el);
    unblurImgs(el);
  });

  // --- Phase 10: Remove blur from images with blur URL params and inline styles ---
  // Removes ?blur=N from image URLs AND inline filter:blur(N) styles.
  // Works on ALL image domains (preview.redd.it, v.redd.it, etc.) —
  // unlike a domain swap (preview→i.redd.it) which breaks external
  // video link thumbnails with 404s.
  removeImageBlur();

  // --- Phase 11: Restore page scrolling ---
  if (document.body) {
    document.body.style.removeProperty('overflow');
  }
  if (document.documentElement) {
    document.documentElement.style.removeProperty('overflow');
  }
}

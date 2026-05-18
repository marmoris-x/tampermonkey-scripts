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
import { logPhase, scanRemaining } from './_debug.js';

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
  // Ensure global CSS is injected (idempotent)
  injectGlobalCSS();

  // --- Phase 1: Remove blocking modals and dialogs ---
  logPhase('Ph1', 'Modals/Dialogs...');
  const p1 = [
    [SELECTORS.FACEPLATE_MODAL_BLOCKING, 'FACEPLATE_MODAL_BLOCKING'],
    [SELECTORS.FACEPLATE_MODAL_ID, 'FACEPLATE_MODAL_ID'],
    [SELECTORS.FACEPLATE_DIALOG_NSFW_QR, 'FACEPLATE_DIALOG_NSFW_QR'],
    [SELECTORS.FACEPLATE_DIALOG_NSFW, 'FACEPLATE_DIALOG_NSFW'],
    [SELECTORS.FACEPLATE_DIALOG_QR, 'FACEPLATE_DIALOG_QR'],
    [SELECTORS.RPL_DIALOG_BLOCKING, 'RPL_DIALOG_BLOCKING'],
    [SELECTORS.AUTH_FLOW_MANAGER, 'AUTH_FLOW_MANAGER'],
  ];
  for (const [sel, name] of p1) {
    const n = document.querySelectorAll(sel).length;
    if (n > 0) logPhase('Ph1', `removing ${name}`, n);
    removeAll(sel);
  }

  // --- Phase 2: Remove overlay/shadow/prompt elements ---
  logPhase('Ph2', 'Overlays...');
  const p2 = [
    [SELECTORS.DIV_PROMPT, 'DIV_PROMPT'],
    [SELECTORS.THUMBNAIL_SHADOW, 'THUMBNAIL_SHADOW'],
    [SELECTORS.BG_MEDIA_BACKGROUND, 'BG_MEDIA_BACKGROUND'],
    [SELECTORS.VIEW_IN_APP_BUTTON, 'VIEW_IN_APP_BUTTON'],
  ];
  for (const [sel, name] of p2) {
    const n = document.querySelectorAll(sel).length;
    if (n > 0) logPhase('Ph2', `removing ${name}`, n);
    removeAll(sel);
  }

  // --- Phase 3: Clean backdrop-filter fixed overlays ---
  logPhase('Ph3', 'backdrop-filter fixed...');
  let removedBd = 0;
  document.querySelectorAll(SELECTORS.BACKDROP_FILTER_FIXED).forEach((el) => {
    if (el.style.position === 'fixed') {
      el.remove();
      removedBd++;
    }
  });
  if (removedBd > 0) logPhase('Ph3', 'removed fixed overlays', removedBd);

  // --- Phase 4: Clean color-scrim elements ---
  logPhase('Ph4', 'color-scrim...');
  document.querySelectorAll(SELECTORS.COLOR_SCRIM).forEach((el) => {
    el.style.removeProperty('box-shadow');
    el.removeAttribute(ATTRS.OPEN);
  });
  logPhase('Ph4', 'cleaned');

  // --- Phase 5: Remove NSFW async loaders ---
  logPhase('Ph5', 'NSFW async loaders...');
  const asyncLoaders = document.getElementsByTagName('shreddit-async-loader');
  let removedAsync = 0;
  for (const loader of [...asyncLoaders]) {
    const bundleName = loader.getAttribute(ATTRS.BUNDLENAME);
    if (bundleName?.includes(BUNDLE_PATTERNS.NSFW)) {
      loader.remove();
      removedAsync++;
    }
  }
  if (removedAsync > 0) logPhase('Ph5', 'removed NSFW loaders', removedAsync);

  // --- Phase 6: Patch shadow roots of blurred containers ---
  logPhase('Ph6', 'shadow root patching...');
  let patchedCount = 0;
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
    patchedCount++;
  }
  if (patchedCount > 0) logPhase('Ph6', 'patched containers', patchedCount);

  // --- Phase 7: Remove blocking attributes ---
  logPhase('Ph7', 'removing attributes...');
  let removedNsfl = 0;
  document.querySelectorAll(`[${ATTRS.IS_NSFW_BLOCKED}]`).forEach((el) => {
    el.removeAttribute(ATTRS.IS_NSFW_BLOCKED);
    removedNsfl++;
  });
  if (removedNsfl > 0) logPhase('Ph7', 'is-nsfw-blocked', removedNsfl);

  document.querySelectorAll(`[${ATTRS.BLURRED}]`).forEach((el) => {
    el.removeAttribute(ATTRS.BLURRED);
  });

  // --- Phase 8: Click-through NSFW/spoiler blurred containers ---
  logPhase('Ph8', 'click-through blurred...');
  // Simulate user clicking "View" on blurred content
  let blurredDone = 0;
  for (const blurred of [...blurredContainers]) {
    const reason = blurred.getAttribute(ATTRS.REASON);
    logPhase('Ph8', 'reason=' + reason);

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
    blurredDone++;
  }
  if (blurredDone > 0) logPhase('Ph8', 'processed containers', blurredDone);

  // --- Phase 9: Handle blurred slots in aspect-ratio containers ---
  logPhase('Ph9', 'aspect-ratio blurred...');
  let arCount = 0;
  document.querySelectorAll(SELECTORS.ASPECT_RATIO_BLURRED).forEach((el) => {
    reveal(el);
    unblurImgs(el);
    arCount++;
  });
  if (arCount > 0) logPhase('Ph9', 'revealed', arCount);

  // --- Phase 10: Remove blur from images with blur URL params and inline styles ---
  logPhase('Ph10', 'image blur removal...');
  removeImageBlur();
  logPhase('Ph10', 'done');

  // --- Phase 11: Restore page scrolling ---
  logPhase('Ph11', 'restore scroll...');
  if (document.body) {
    document.body.style.removeProperty('overflow');
  }
  if (document.documentElement) {
    document.documentElement.style.removeProperty('overflow');
  }
  logPhase('Ph11', 'done');

  // --- Final: scan for remaining blocking elements ---
  scanRemaining();
}

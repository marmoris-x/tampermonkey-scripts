/**
 * @fileoverview DOM manipulation utilities.
 * Provides mutation observation, debouncing, element removal,
 * and content revealing functions used by the unblur engine.
 *
 * @module _dom-utils
 */

import { ATTRS, OPACITY_CLASSES } from './_selectors.js';

/**
 * Creates a MutationObserver that invokes the callback for each
 * added element node. Filters out text and comment nodes for performance.
 *
 * @param {function(Element, MutationObserver):void} callback - Called with each added element
 * @param {Node} [root=document.body] - Root node to observe
 * @returns {MutationObserver} The created observer (already observing)
 */
export function observeMutations(callback, root = document.body) {
  const observer = new MutationObserver((mutations) => {
    for (let m = 0; m < mutations.length; m++) {
      const addedNodes = mutations[m].addedNodes;
      for (let i = 0; i < addedNodes.length; i++) {
        const node = addedNodes[i];
        // Only process element nodes — skip text, comment, etc.
        if (node.nodeType === Node.ELEMENT_NODE) {
          callback(/** @type {Element} */ (node), observer);
        }
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true
  });

  return observer;
}

/**
 * Creates a debounced version of a function.
 * Delays execution until `ms` milliseconds have passed since the last call.
 *
 * @param {Function} fn - Function to debounce
 * @param {number} [ms=200] - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms = 200) {
  let timer = 0;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, ms);
  };
}

/**
 * Removes all elements matching a CSS selector from the DOM.
 *
 * @param {string} selector - CSS selector string
 */
export function removeAll(selector) {
  document.querySelectorAll(selector).forEach((el) => el.remove());
}

/**
 * Forces an element to be visible by setting display, opacity,
 * filter, and height with !important priority.
 *
 * @param {Element} el - Element to reveal
 */
export function reveal(el) {
  el.style.setProperty('display', 'block', 'important');
  el.style.setProperty('opacity', '1', 'important');
  el.style.setProperty('filter', 'none', 'important');
  el.style.setProperty('height', '100%', 'important');
}

/**
 * Removes blur from all images within a root element.
 * Marks processed images with data-unblurred attribute to avoid re-processing.
 * Removes opacity-reducing CSS classes.
 *
 * @param {Element} root - Root element to search within
 */
export function unblurImgs(root) {
  const images = root.querySelectorAll('img:not([data-unblurred])');
  images.forEach((img) => {
    img.setAttribute(ATTRS.DATA_UNBLURRED, '1');
    // Remove opacity reduction classes
    img.classList.remove(...OPACITY_CLASSES);
    // Override inline styles
    img.style.setProperty('opacity', '1', 'important');
    img.style.setProperty('filter', 'none', 'important');
  });
}

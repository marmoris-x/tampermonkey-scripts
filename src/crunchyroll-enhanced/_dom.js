// src/crunchyroll-enhanced/_dom.js — DOM utilities (waitForElement, debounce)
// Provides: waitForElement, debounce

'use strict';

/**
 * Waits for an element matching `selector` to appear in the DOM.
 * @param {string} selector - CSS selector
 * @param {number} [timeout=10000] - Max wait time in ms (0 = infinite)
 * @param {Element|Document} [root=document.body] - Root element to observe
 * @returns {Promise<Element>} Resolves with the found element, rejects on timeout
 */
export function waitForElement(selector, timeout = 10000, root = document.body) {
  return new Promise((resolve, reject) => {
    const existing = root.querySelector(selector);
    if (existing) return resolve(existing);

    let timer = null;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches && node.matches(selector)) { cleanup(); return resolve(node); }
          if (node.querySelector && node.querySelector(selector)) { cleanup(); return resolve(node.querySelector(selector)); }
        }
      }
    });

    const cleanup = () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
    };

    observer.observe(root, { childList: true, subtree: true });

    if (timeout > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`waitForElement timeout: ${selector}`));
      }, timeout);
    }
  });
}

/**
 * Creates a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} [ms=200] - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms = 200) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

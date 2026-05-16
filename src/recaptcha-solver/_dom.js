'use strict';

/**
 * Waits for an element to appear in the DOM using MutationObserver.
 * @param {string} selector - CSS selector to watch for
 * @param {number} [timeout=10000] - Milliseconds before rejecting (0 = no timeout)
 * @param {Element} [root=document.body] - Root element to observe
 * @returns {Promise<Element>} Resolves with the found element
 * @throws {Error} If element not found within timeout
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
          if (node.matches?.(selector)) {
            cleanup();
            return resolve(node);
          }
          const child = node.querySelector?.(selector);
          if (child) {
            cleanup();
            return resolve(child);
          }
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
 * Observes added elements in the DOM and invokes callback for each.
 * Call observer.disconnect() to stop observing.
 * @param {(element: Element, observer: MutationObserver) => void} callback
 * @param {Element} [root=document.body]
 * @returns {MutationObserver}
 */
export function observeMutations(callback, root = document.body) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          callback(node, observer);
        }
      }
    }
  });

  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

/**
 * Checks if an element is visible (not display:none, visibility:hidden, or detached).
 * @param {Element} el
 * @returns {boolean}
 */
export function isVisible(el) {
  if (!el || el.offsetParent === null) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * Safe querySelector shorthand.
 * @param {string} selector
 * @param {Document|Element} [root=document]
 * @returns {Element|null}
 */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

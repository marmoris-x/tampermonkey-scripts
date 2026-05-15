// Local copy of observeMutations from shared/dom-utils.js
// Converted from var to let/const for YouTube Enhanced module isolation.
'use strict';

/**
 * Observes `root` for added elements. Calls `callback` with each added Element node.
 * Returns the MutationObserver instance for .disconnect() when no longer needed.
 * @param {Function} callback - Called with each added Element
 * @param {Element} [root=document.body] - Root element to observe
 * @returns {MutationObserver}
 */
export function observeMutations(callback, root) {
  root = root || document.body;
  const observer = new MutationObserver(function (mutations) {
    for (let m = 0; m < mutations.length; m++) {
      const nodes = mutations[m].addedNodes;
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

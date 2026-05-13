/**
 * Returns a promise that resolves when an element matching `selector` appears in the DOM.
 * Uses MutationObserver internally; disconnects immediately upon match.
 * @param {string} selector - CSS selector string
 * @param {number} [timeout=10000] - Max wait time in ms (0 = no timeout)
 * @param {Element} [root=document.body] - Root element to observe
 * @returns {Promise<Element>} Resolves with the found element, rejects on timeout
 */
export function waitForElement(selector, timeout, root) {
  timeout = timeout || 10000;
  root = root || document.body;
  return new Promise(function (resolve, reject) {
    const existing = root.querySelector(selector);
    if (existing) return resolve(existing);
    let timer;
    const observer = new MutationObserver(function (mutations) {
      for (let m = 0; m < mutations.length; m++) {
        const nodes = mutations[m].addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
          if (nodes[i].matches && nodes[i].matches(selector)) { cleanup(); return resolve(nodes[i]); }
          const child = nodes[i].querySelector && nodes[i].querySelector(selector);
          if (child) { cleanup(); return resolve(child); }
        }
      }
    });
    function cleanup() {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    }
    observer.observe(root, { childList: true, subtree: true });
    if (timeout > 0) {
      timer = setTimeout(function () { cleanup(); reject(new Error('waitForElement timeout: ' + selector)); }, timeout);
    }
  });
}

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

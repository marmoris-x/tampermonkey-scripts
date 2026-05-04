// src/shared/dom-utils.js — DOM observation and timing utilities for Tampermonkey scripts
// Provides Promise-based element waiting, debounce/throttle, and MutationObserver helpers.
// Consumers: 15 of 17 scripts (all except Picture-in-Picture, Copy as Markdown)

/**
 * Returns a promise that resolves when an element matching `selector` appears in the DOM.
 * Uses MutationObserver internally; disconnects immediately upon match.
 * @param {string} selector - CSS selector string
 * @param {number} [timeout=10000] - Max wait time in ms (0 = no timeout)
 * @param {Element} [root=document.body] - Root element to observe
 * @returns {Promise<Element>} Resolves with the found element, rejects on timeout
 */
globalThis.TM = globalThis.TM || {};
globalThis.TM.dom = {
  waitForElement: waitForElement,
  debounce: debounce,
  throttle: throttle,
  observeMutations: observeMutations
};

export function waitForElement(selector, timeout, root) {
  timeout = timeout || 10000;
  root = root || document.body;
  return new Promise(function (resolve, reject) {
    var existing = root.querySelector(selector);
    if (existing) return resolve(existing);
    var timer;
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var nodes = mutations[m].addedNodes;
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
          if (nodes[i].matches && nodes[i].matches(selector)) { cleanup(); return resolve(nodes[i]); }
          var child = nodes[i].querySelector && nodes[i].querySelector(selector);
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
 * Creates a debounced version of `fn`. The returned function delays invocation until
 * `ms` milliseconds have elapsed since the last call.
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds (default 200)
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms) {
  ms = ms || 200;
  var timer = 0;
  return function () {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
  };
}

/**
 * Creates a throttled version of `fn`. The returned function invokes `fn` at most once
 * per `ms` milliseconds.
 * @param {Function} fn - Function to throttle
 * @param {number} ms - Minimum interval in milliseconds (default 200)
 * @returns {Function} Throttled function
 */
export function throttle(fn, ms) {
  ms = ms || 200;
  var last = 0;
  return function () {
    var now = Date.now();
    if (now - last >= ms) { last = now; fn.apply(this, arguments); }
  };
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
  var observer = new MutationObserver(function (mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var nodes = mutations[m].addedNodes;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

// src/marketplace-deal-finder/_dom.js — Local copy of waitForElement

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

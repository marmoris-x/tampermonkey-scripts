// ==UserScript==
// @name         BotGhost Bulk Choice Extractor
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.8.0
// @author       marmoris-x
// @description  Adds a "Copy Bulk" button next to "Clear All Choices" to copy label/value pairs.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=botghost.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @match        https://dashboard.botghost.com/*
// @sandbox      JavaScript
// @grant        GM_setClipboard
// @inject-into  content
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.createLogger = createLogger;
  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    var tag = "[" + prefix + "]";
    return {
      log: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          var args = [tag];
          for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  globalThis.TM = globalThis.TM || {};
  globalThis.TM.dom = {
    waitForElement,
    debounce,
    throttle,
    observeMutations
  };
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 1e4;
    root = root || document.body;
    return new Promise(function(resolve, reject) {
      var existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      var timer;
      var observer = new MutationObserver(function(mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var nodes = mutations[m].addedNodes;
          for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
            if (nodes[i].matches && nodes[i].matches(selector)) {
              cleanup();
              return resolve(nodes[i]);
            }
            var child = nodes[i].querySelector && nodes[i].querySelector(selector);
            if (child) {
              cleanup();
              return resolve(child);
            }
          }
        }
      });
      function cleanup() {
        observer.disconnect();
        if (timer) clearTimeout(timer);
      }
      observer.observe(root, { childList: true, subtree: true });
      if (timeout > 0) {
        timer = setTimeout(function() {
          cleanup();
          reject(new Error("waitForElement timeout: " + selector));
        }, timeout);
      }
    });
  }
  function debounce(fn, ms) {
    ms = ms || 200;
    var timer = 0;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(ctx, args);
      }, ms);
    };
  }
  function throttle(fn, ms) {
    ms = ms || 200;
    var last = 0;
    return function() {
      var now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }
  function observeMutations(callback, root) {
    root = root || document.body;
    var observer = new MutationObserver(function(mutations) {
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
  // @license      MIT
  createLogger("BotGhost Bulk Choice Extractor");
  function createAndInjectButton() {
    const clearAllButton = Array.from(document.querySelectorAll("button")).find((btn) => btn.textContent.trim() === "Clear All Choices");
    if (clearAllButton) {
      const targetContainer = clearAllButton.parentElement;
      if (targetContainer && !document.getElementById("bulk-copy-button")) {
        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy Bulk";
        copyButton.id = "bulk-copy-button";
        copyButton.className = "ml-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#ffb296] hover:bg-[#4d352a] transition-colors";
        copyButton.style.color = "#ffb296";
        copyButton.addEventListener("click", () => {
          const choiceContainers = document.querySelectorAll('.space-y-2 > div[class*="bg-"]');
          const lines = [];
          choiceContainers.forEach((container) => {
            const inputs = container.querySelectorAll('input[type="text"]');
            if (inputs.length === 2) {
              const label = inputs[0].value.trim();
              const value = inputs[1].value.trim();
              if (label && value) {
                lines.push(`${label},${value}`);
              }
            }
          });
          if (lines.length > 0) {
            const outputString = lines.join("\n");
            GM_setClipboard(outputString);
            copyButton.textContent = `Copied ${lines.length} items!`;
          } else {
            copyButton.textContent = "Nothing to copy!";
          }
          setTimeout(() => {
            copyButton.textContent = "Copy Bulk";
          }, 2500);
        });
        targetContainer.appendChild(copyButton);
      }
    }
  }
  observeMutations(() => {
    createAndInjectButton();
  }, document.body);
  createAndInjectButton();

})();
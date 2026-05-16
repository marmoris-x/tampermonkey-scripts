// ==UserScript==
// @name         BotGhost Bulk Choice Extractor
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.9.7
// @author       marmoris-x
// @description  Adds a "Copy Bulk" button to copy label/value pairs from choice options.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=botghost.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @match        https://dashboard.botghost.com/*
// @sandbox      JavaScript
// @grant        GM_setClipboard
// @inject-into  content
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  
  function csvEscape(str) {
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }
  function findChoiceContainers(scope) {
    const seen = new Set();
    const result = [];
    const inputs = scope.querySelectorAll('input[type="text"]');
    for (let i = 0; i < inputs.length; i++) {
      let container = inputs[i].parentElement;
      for (let depth = 0; depth < 5 && container; depth++) {
        if (container.querySelectorAll('input[type="text"]').length >= 2) break;
        container = container.parentElement;
      }
      if (!container || seen.has(container)) continue;
      seen.add(container);
      result.push(container);
    }
    return result;
  }
  function getSectionScope(button) {
    const structural = button.closest('section, [class*="modal"], [class*="panel"]');
    if (structural) return structural;
    let el = button.parentElement;
    for (let i = 0; i < 4 && el; i++) {
      if (el.querySelectorAll('input[type="text"]').length >= 2) return el;
      el = el.parentElement;
    }
    return document;
  }
  function extractChoice(container) {
    const inputs = Array.from(container.querySelectorAll('input[type="text"]'));
    if (inputs.length < 2) return null;
    let labelInput = null;
    let valueInput = null;
    for (let i = 0; i < inputs.length; i++) {
      const attrs = ((inputs[i].name || "") + " " + (inputs[i].placeholder || "")).toLowerCase();
      if (!labelInput && attrs.indexOf("label") !== -1) labelInput = inputs[i];
      else if (!valueInput && (attrs.indexOf("value") !== -1 || attrs.indexOf("key") !== -1)) valueInput = inputs[i];
    }
    const unmatched = inputs.filter(function(inp) {
      return inp !== labelInput && inp !== valueInput;
    });
    if (!labelInput && unmatched.length > 0) {
      labelInput = unmatched.shift();
    }
    if (!valueInput && unmatched.length > 0) {
      valueInput = unmatched.shift();
    }
    if (!valueInput && labelInput && inputs.length >= 2) {
      valueInput = inputs[0] === labelInput ? inputs[1] : inputs[0];
    }
    const label = labelInput ? labelInput.value.trim() : "";
    const value = valueInput ? valueInput.value.trim() : "";
    if (!label || !value) return null;
    return { label, value };
  }
  function injectCopyButtons() {
    const clearButtons = Array.from(document.querySelectorAll("button")).filter(function(btn) {
      return btn.textContent.trim().toLowerCase().indexOf("clear all") !== -1;
    });
    let injected = false;
    clearButtons.forEach(function(clearBtn) {
      const container = clearBtn.parentElement;
      if (!container) return;
      if (container.querySelector(".bulk-copy-btn")) return;
      injected = true;
      const scope = getSectionScope(clearBtn);
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy Bulk";
      copyBtn.className = "bulk-copy-btn ml-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#ffb296] hover:bg-[#4d352a] transition-colors";
      copyBtn.style.color = "#ffb296";
      let feedbackTimer = null;
      copyBtn.addEventListener("click", function() {
        const containers = findChoiceContainers(scope);
        const lines = [];
        for (let c = 0; c < containers.length; c++) {
          const pair = extractChoice(containers[c]);
          if (pair) lines.push(csvEscape(pair.label) + "," + csvEscape(pair.value));
        }
        if (lines.length > 0) {
          GM_setClipboard(lines.join("\n"));
          copyBtn.textContent = "Copied " + lines.length + " items!";
        } else {
          copyBtn.textContent = "Nothing to copy!";
        }
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(function() {
          copyBtn.textContent = "Copy Bulk";
        }, 2500);
      });
      container.appendChild(copyBtn);
    });
    return injected;
  }
  function nodeContainsClearAll(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.matches && node.matches("button") && node.textContent.trim().toLowerCase().indexOf("clear all") !== -1) {
      return true;
    }
    const buttons = node.querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent.trim().toLowerCase().indexOf("clear all") !== -1) return true;
    }
    return false;
  }
  let observerTimer = null;
  let idleCycles = 0;
  let observerActive = true;
  const observer = new MutationObserver(function(mutations) {
    let relevant = false;
    for (let m = 0; m < mutations.length && !relevant; m++) {
      const nodes = mutations[m].addedNodes;
      for (let n = 0; n < nodes.length && !relevant; n++) {
        if (nodeContainsClearAll(nodes[n])) relevant = true;
      }
    }
    if (!relevant) return;
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = setTimeout(function() {
      const changed = injectCopyButtons();
      if (!changed) {
        idleCycles++;
        if (idleCycles >= 5) {
          observer.disconnect();
          observerActive = false;
        }
      } else {
        idleCycles = 0;
      }
    }, 200);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  function reconnectObserver() {
    if (!observerActive) {
      observerActive = true;
      idleCycles = 0;
      observer.observe(document.body, { childList: true, subtree: true });
      injectCopyButtons();
    }
  }
  window.addEventListener("popstate", reconnectObserver);
  const origPushState = history.pushState.bind(history);
  history.pushState = function() {
    origPushState.apply(history, arguments);
    reconnectObserver();
  };
  const origReplaceState = history.replaceState.bind(history);
  history.replaceState = function() {
    origReplaceState.apply(history, arguments);
    reconnectObserver();
  };
  injectCopyButtons();

})();
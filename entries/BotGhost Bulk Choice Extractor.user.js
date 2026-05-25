// ==UserScript==
// @name         BotGhost Bulk Choice Extractor
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.9.9
// @description  Adds a "Copy Bulk" button to copy label/value pairs from choice options.
// @author       marmoris-x
// @match        https://dashboard.botghost.com/*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=botghost.com
// @sandbox      JavaScript
// @grant        GM_setClipboard
// @noframes
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

function createLogger(prefix, debugMode) {
  debugMode = debugMode || false;
  const tag = '[' + prefix + ']';
  return {
    log:   function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.log.apply(console, args); },
    warn:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.warn.apply(console, args); },
    error: function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.error.apply(console, args); },
    info:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.info.apply(console, args); },
    debug: function () { if (debugMode) { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.debug.apply(console, args); } }
  };
}

const log = createLogger('BotGhost Bulk Choice Extractor');

/**
 * Escapes a string for CSV: wraps in quotes if it contains commas, quotes, or newlines.
 */
function csvEscape(str) {
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

/**
 * Finds all choice-container elements within the given scope using structural
 * detection (elements containing at least 2 text inputs) — no fragile CSS classes.
 * Walks up from each text input to handle wrapped input layouts (e.g., each
 * input nested in its own <div> within the choice row).
 */
function findChoiceContainers(scope) {
  const seen = new Set();
  const result = [];
  const inputs = scope.querySelectorAll('input[type="text"]');
  for (let i = 0; i < inputs.length; i++) {
    // Walk up from the input to find the closest ancestor with >= 2 text inputs
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

/**
 * Determines the search scope for a "Clear All Choices" button.
 * Navigates upward to find a container that includes both the button and the
 * choice items (which may be siblings deeper in the tree).
 */
function getSectionScope(button) {
  // Try structural containers first
  const structural = button.closest('section, [class*="modal"], [class*="panel"]');
  if (structural) return structural;

  // Walk up from the button's parent to find a container that encompasses
  // the choice area (detected via >= 2 text inputs in the subtree).
  let el = button.parentElement;
  for (let i = 0; i < 4 && el; i++) {
    if (el.querySelectorAll('input[type="text"]').length >= 2) return el;
    el = el.parentElement;
  }

  return document;
}

/**
 * Extracts label and value from a choice container using name/placeholder
 * attribute matching first, falling back to position (first two text inputs).
 */
function extractChoice(container) {
  const inputs = Array.from(container.querySelectorAll('input[type="text"]'));
  if (inputs.length < 2) return null;

  // Phase 1: try name/placeholder-based identification
  let labelInput = null;
  let valueInput = null;
  for (let i = 0; i < inputs.length; i++) {
    const attrs = ((inputs[i].name || '') + ' ' + (inputs[i].placeholder || '')).toLowerCase();
    if (!labelInput && attrs.indexOf('label') !== -1) labelInput = inputs[i];
    else if (!valueInput && (attrs.indexOf('value') !== -1 || attrs.indexOf('key') !== -1)) valueInput = inputs[i];
  }

  // Phase 2: fill remaining slots from first-unmatched inputs
  const unmatched = inputs.filter(function (inp) {
    return inp !== labelInput && inp !== valueInput;
  });
  if (!labelInput && unmatched.length > 0) { labelInput = unmatched.shift(); }
  if (!valueInput && unmatched.length > 0) { valueInput = unmatched.shift(); }
  // If still missing a value, use the remaining unmatched even if it was label-matched
  if (!valueInput && labelInput && inputs.length >= 2) {
    valueInput = inputs[0] === labelInput ? inputs[1] : inputs[0];
  }

  const label = labelInput ? labelInput.value.trim() : '';
  const value = valueInput ? valueInput.value.trim() : '';
  if (!label || !value) return null;
  return { label: label, value: value };
}

/**
 * Injects "Copy Bulk" buttons next to all "Clear All Choices" buttons.
 * Returns true if at least one new button was injected.
 */
function injectCopyButtons() {
  const clearButtons = Array.from(document.querySelectorAll('button'))
    .filter(function (btn) {
      return btn.textContent.trim().toLowerCase().indexOf('clear all') !== -1;
    });

  let injected = false;

  clearButtons.forEach(function (clearBtn) {
    const container = clearBtn.parentElement;
    if (!container) return;
    // Skip if this clear button already has a bulk-copy sibling
    if (container.querySelector('.bulk-copy-btn')) return;

    injected = true;
    const scope = getSectionScope(clearBtn);
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Bulk';
    copyBtn.className = 'bulk-copy-btn ml-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#ffb296] hover:bg-[#4d352a] transition-colors';
    copyBtn.style.color = '#ffb296';

    let feedbackTimer = null;
    copyBtn.addEventListener('click', function () {
      const containers = findChoiceContainers(scope);
      const lines = [];

      for (let c = 0; c < containers.length; c++) {
        const pair = extractChoice(containers[c]);
        if (pair) lines.push(csvEscape(pair.label) + ',' + csvEscape(pair.value));
      }

      if (lines.length > 0) {
        GM_setClipboard(lines.join('\n'));
        copyBtn.textContent = 'Copied ' + lines.length + ' items!';
      } else {
        copyBtn.textContent = 'Nothing to copy!';
      }

      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(function () {
        copyBtn.textContent = 'Copy Bulk';
      }, 2500);
    });

    container.appendChild(copyBtn);
  });

  return injected;
}

// ── MutationObserver with node-level pre-filtering ─────────────────────────

/**
 * Returns true if the node (at any depth) contains a "Clear All" button.
 * Checks ALL buttons in the subtree (not just the first).
 */
function nodeContainsClearAll(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.matches && node.matches('button') &&
      node.textContent.trim().toLowerCase().indexOf('clear all') !== -1) {
    return true;
  }
  const buttons = node.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    if (buttons[i].textContent.trim().toLowerCase().indexOf('clear all') !== -1) return true;
  }
  return false;
}

let observerTimer = null;
let idleCycles = 0;
let observerActive = true;

const observer = new MutationObserver(function (mutations) {
  // Short-circuit if nothing relevant changed
  let relevant = false;
  for (let m = 0; m < mutations.length && !relevant; m++) {
    const nodes = mutations[m].addedNodes;
    for (let n = 0; n < nodes.length && !relevant; n++) {
      if (nodeContainsClearAll(nodes[n])) relevant = true;
    }
  }
  if (!relevant) return;

  // Debounce: reset timer so rapid mutations trigger only one scan
  if (observerTimer) clearTimeout(observerTimer);
  observerTimer = setTimeout(function () {
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

// ── SPA reconnect: re-observe when the URL changes ─────────────────────────

function reconnectObserver() {
  if (!observerActive) {
    observerActive = true;
    idleCycles = 0;
    observer.observe(document.body, { childList: true, subtree: true });
    injectCopyButtons();
  }
}

window.addEventListener('popstate', reconnectObserver);
const origPushState = history.pushState.bind(history);
history.pushState = function () {
  origPushState.apply(history, arguments);
  reconnectObserver();
};
const origReplaceState = history.replaceState.bind(history);
history.replaceState = function () {
  origReplaceState.apply(history, arguments);
  reconnectObserver();
};

// ── Initial injection on page load ─────────────────────────────────────────
injectCopyButtons();

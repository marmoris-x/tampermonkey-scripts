// src/anisearch-endless-scroll/ui-statusbar.js — Status bar, loader, and UI unlock
// Provides: setStatus, ensureBar, removeStatus, showLoader, removeLoader, unlockUI

import { createStatusBar } from '../shared/ui-components.js';
import { hideElements } from './endless-loop.js';

// ---- Loader ----

var LOADER_ID = 'as-es-loader';
var _statusBar = null;

/**
 * Ensures the status bar exists, creating one if needed.
 * @returns {object} Status bar API with setText, setProgress, remove
 */
export function ensureBar() {
  if (!_statusBar) {
    _statusBar = createStatusBar({ accentColor: '#6366f1' });
  }
  return _statusBar;
}

/**
 * Updates the status bar text. Creates the bar if it does not exist.
 * @param {string} message - The message text to display
 */
export function setStatus(message) {
  ensureBar().setText(message);
}

/**
 * Removes the status bar from the DOM.
 */
export function removeStatus() {
  if (_statusBar) {
    _statusBar.remove();
    _statusBar = null;
  }
}

/**
 * Creates a loading indicator inside a container if one does not already exist.
 * @param {Element} container - The container element for the loader
 */
function ensureLoader(container) {
  if (document.getElementById(LOADER_ID)) return;
  var loader = document.createElement('div');
  loader.id = LOADER_ID;
  loader.style.textAlign = 'center';
  loader.style.padding = '24px';
  loader.style.color = '#6366f1';
  loader.style.fontSize = '13px';
  loader.style.fontFamily = '"Segoe UI",system-ui,sans-serif';
  loader.style.fontWeight = '500';
  loader.style.letterSpacing = '0.3px';
  loader.style.gridColumn = '1 / -1';
  loader.innerHTML =
    '<span style="display:inline-block;animation:as-spin 1s linear infinite;font-size:18px;margin-right:8px">⟳</span>' +
    'Lädt weitere Einträge…';

  // For table container -> tr > td wrapper
  if (container.tagName === 'TBODY') {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 99;
    td.appendChild(loader);
    tr.id = LOADER_ID + '-row';
    tr.appendChild(td);
    container.appendChild(tr);
  } else {
    container.appendChild(loader);
  }
}

/**
 * Removes the loading indicator from the DOM.
 */
export function removeLoader() {
  var ids = [LOADER_ID, LOADER_ID + '-row'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
}

/**
 * Shows or hides the loading indicator in the given container.
 * @param {boolean} visible - Whether to show the loader
 * @param {Element} [container] - Container element (required when showing)
 */
export function showLoader(visible, container) {
  if (visible && container) {
    ensureLoader(container);
  } else {
    removeLoader();
  }
}

// ---- UI Unlock (remove premium restrictions) ----

var PREMIUM_TEXTS = new Set([
  'premium only', 'premium-only',
  'nur fur premium', 'nur premium',
  'upgrade to premium',
]);

var _limitObserver = null;

/**
 * Removes premium restrictions and disabled state from the AniSearch UI.
 * Unlocks the #limit field and hides premium-only notices.
 */
export function unlockUI() {
  // Unlock #limit field (if present)
  var limitInput = document.querySelector('#limit');
  if (limitInput) {
    limitInput.removeAttribute('disabled');
    limitInput.removeAttribute('readonly');
    limitInput.style.opacity = '1';
    limitInput.style.cursor  = 'text';

    if (_limitObserver) _limitObserver.disconnect();
    // Monitor attribute changes
    _limitObserver = new MutationObserver(function () {
      limitInput.removeAttribute('disabled');
      limitInput.removeAttribute('readonly');
    });
    _limitObserver.observe(limitInput, { attributes: true });
  }

  // Hide "Premium only" / "Nur fur Premium" notices
  hideElements([
    '.premium-only', '.premium-badge', '.locked',
    '.lock-icon', '[class*="premium-lock"]',
  ]);

  // Text-based premium search — only in form groups
  var groups = document.querySelectorAll('.form-group, .filter-group, label, .input-group');
  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
    var allEls = group.querySelectorAll('*');
    for (var e = 0; e < allEls.length; e++) {
      if (allEls[e].children.length > 0) continue;
      if (PREMIUM_TEXTS.has(allEls[e].textContent.trim().toLowerCase())) {
        group.style.display = 'none';
        break;
      }
    }
  }
}

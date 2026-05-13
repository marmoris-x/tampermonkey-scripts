// src/anisearch-endless-scroll/ui.js — Status bar, loader, and UI unlock
// No external dependencies — everything inline for isolation.

/* ─── Status Bar ─── */

let _statusBar = null;

/**
 * Creates a refined status bar using direct inline styles (no Shadow DOM).
 * Dark charcoal background, warm coral accent, subtle gradient progress.
 * @returns {{ setText: Function, setProgress: Function, remove: Function }}
 */
function createStatusBar() {
  const host = document.createElement('div');

  host.style.cssText = [
    'position:fixed;bottom:0;right:0;z-index:2147483646;',
    'background:#12121f;color:#e8e4f0;',
    'font:11px/1.5 system-ui,sans-serif;',
    'padding:8px 14px;min-width:180px;max-width:320px;',
    'border-radius:8px 0 0 0;border-left:3px solid #f472b6;',
    'box-shadow:-2px 0 16px rgba(244,114,182,0.12);',
    'user-select:none;',
  ].join('');

  const textEl = document.createElement('div');
  textEl.style.cssText = [
    'margin-bottom:5px;white-space:pre;overflow:hidden;',
    'text-overflow:ellipsis;letter-spacing:0.15px;',
  ].join('');

  const fillEl = document.createElement('div');
  fillEl.style.cssText = [
    'height:100%;width:0%;',
    'background:linear-gradient(90deg,#f472b6,#fb923c);',
    'transition:width 0.3s ease;border-radius:1px;',
  ].join('');

  const barEl = document.createElement('div');
  barEl.style.cssText = [
    'height:2px;background:rgba(255,255,255,0.06);',
    'border-radius:1px;overflow:hidden;',
  ].join('');
  barEl.appendChild(fillEl);

  host.appendChild(textEl);
  host.appendChild(barEl);
  document.body.appendChild(host);

  return {
    setText(msg) { textEl.textContent = msg; },
    setProgress(pct) { fillEl.style.width = `${Math.min(100, Math.max(0, pct))}%`; },
    remove() { if (host.parentNode) host.parentNode.removeChild(host); },
  };
}

/**
 * Ensures the status bar exists, creating one if needed.
 * @returns {object}
 */
export function ensureBar() {
  if (!_statusBar) {
    _statusBar = createStatusBar();
  }
  return _statusBar;
}

/**
 * Updates the status bar text. Creates the bar if needed.
 * @param {string} message
 */
export function setStatus(message) {
  ensureBar().setText(message);
}

/**
 * Removes the status bar from the DOM with a fade-out.
 */
export function removeStatus() {
  if (_statusBar) {
    _statusBar.remove();
    _statusBar = null;
  }
}

/* ─── Loader (CSS ring spinner instead of unicode ⟳) ─── */

const LOADER_ID = 'as-es-loader';

/**
 * Creates a loading indicator with a CSS ring spinner inside a container.
 * @param {Element} container
 */
function ensureLoader(container) {
  if (document.getElementById(LOADER_ID)) return;

  const loader = document.createElement('div');
  loader.id = LOADER_ID;
  loader.style.textAlign = 'center';
  loader.style.padding = '20px';
  loader.style.gridColumn = '1 / -1';

  // CSS ring spinner
  const spinner = document.createElement('div');
  spinner.style.cssText = [
    'width:18px;height:18px;margin:0 auto 8px;',
    'border:2px solid rgba(244,114,182,0.15);',
    'border-top-color:#f472b6;border-radius:50%;',
    'animation:as-ring 0.7s linear infinite;',
  ].join('');

  const label = document.createElement('div');
  label.style.cssText = [
    'color:#f472b6;font:11px/1.4 system-ui,sans-serif;',
    'letter-spacing:0.3px;opacity:0.7;',
  ].join('');
  label.textContent = 'Loading more entries…';

  loader.appendChild(spinner);
  loader.appendChild(label);

  // For table container → tr > td wrapper
  if (container.tagName === 'TBODY') {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 99;
    td.appendChild(loader);
    tr.id = `${LOADER_ID}-row`;
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
  for (const id of [LOADER_ID, `${LOADER_ID}-row`]) {
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
}

/**
 * Shows or hides the loading indicator.
 * @param {boolean} visible
 * @param {Element} [container]
 */
export function showLoader(visible, container) {
  if (visible && container) {
    ensureLoader(container);
  } else {
    removeLoader();
  }
}

/* ─── UI Unlock (remove premium restrictions) ─── */

const PREMIUM_TEXTS = new Set([
  'premium only', 'premium-only',
  'nur fur premium', 'nur premium',
  'upgrade to premium',
]);

/* ─── DOM Helpers (inlined to avoid circular deps with endless-loop.js) ─── */

/**
 * Hides all elements matching the given selectors.
 * @param {string[]} selectors
 */
function hideElements(selectors) {
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; });
  }
}

/**
 * Hides all pagination elements on the page.
 */
export function hidePagination() {
  hideElements([
    '.pagenav', '.pagination', 'nav.pagination',
    '[class*="pagenav"]', '[class*="pagination"]',
  ]);
}

let _limitObserver = null;

/**
 * Removes premium restrictions and disabled state from the AniSearch UI.
 */
export function unlockUI() {
  // Unlock #limit field
  const limitInput = document.querySelector('#limit');
  if (limitInput) {
    limitInput.removeAttribute('disabled');
    limitInput.removeAttribute('readonly');
    limitInput.style.opacity = '1';
    limitInput.style.cursor = 'text';

    if (_limitObserver) _limitObserver.disconnect();
    _limitObserver = new MutationObserver(() => {
      limitInput.removeAttribute('disabled');
      limitInput.removeAttribute('readonly');
    });
    _limitObserver.observe(limitInput, { attributes: true });
  }

  // Hide premium-only elements
  hideElements([
    '.premium-only', '.premium-badge', '.locked',
    '.lock-icon', '[class*="premium-lock"]',
  ]);

  // Text-based premium detection in form groups
  const groups = document.querySelectorAll('.form-group, .filter-group, label, .input-group');
  for (const group of groups) {
    const allEls = group.querySelectorAll('*');
    const hasPremiumText = Array.from(allEls).some(
      (el) => el.children.length === 0 && PREMIUM_TEXTS.has(el.textContent.trim().toLowerCase())
    );
    if (hasPremiumText) {
      group.style.display = 'none';
    }
  }
}

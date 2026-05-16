'use strict';

// ── SVG Icons ──────────────────────────────────────────────────────────────────

/**
 * SVG icon strings for button states.
 * Hardcoded constants — not user data, safe for innerHTML usage.
 * @type {Record<string, string>}
 */
export const SVG = {
  bolt:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M13 2 3 14h9l-1 8L21 10h-9l1-8z"/></svg>',
  spin:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="rs-spin" style="display:block"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="20 6 9 17 4 12"/></svg>',
  retry: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.95"/></svg>',
  warn:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>'
};

// ── Button State Configuration ─────────────────────────────────────────────────

/**
 * Button state configurations: [svg, title, cssClass, disabled]
 * @type {Record<string, [string, string, string, boolean]>}
 */
export const BTN_STATES = {
  ready:   [SVG.bolt,  'Solve automatically',           '',           false],
  working: [SVG.spin,  'Solving...',                    'rs-working',  true ],
  success: [SVG.check, 'Solved!',                       'rs-success',  true ],
  failed:  [SVG.retry, 'Failed — click to retry',       'rs-failed',   false],
  dos:     [SVG.warn,  'Automated query limit reached', 'rs-dos',      true ]
};

// ── Style Sheet ───────────────────────────────────────────────────────────────

let _styleSheet = null;

/**
 * Creates and caches a CSSStyleSheet for Shadow DOM usage.
 * Uses `replaceSync` — runs once, cached for reuse across shadow roots.
 * @returns {CSSStyleSheet}
 */
export function createStyleSheet() {
  if (_styleSheet) return _styleSheet;

  _styleSheet = new CSSStyleSheet();
  _styleSheet.replaceSync(`
    :host {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
    }
    .rs-btn-holder {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }
    .rs-btn {
      background-image: none;
      background-color: #1a73e8;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      line-height: 0;
      vertical-align: middle;
      transition: background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      outline: none;
      user-select: none;
    }
    .rs-btn:not(:disabled):hover {
      background-color: #1558b0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transform: translateY(-1px);
    }
    .rs-btn:not(:disabled):active {
      transform: translateY(0) scale(0.96);
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    .rs-btn:disabled {
      cursor: default;
      opacity: 0.80;
    }
    .rs-btn.rs-working { background-color: #f29900; }
    .rs-btn.rs-success { background-color: #1e8e3e; }
    .rs-btn.rs-failed  { background-color: #d93025; }
    .rs-btn.rs-failed:not(:disabled):hover { background-color: #b71c1c; }
    .rs-btn.rs-dos     { background-color: #e37400; }
    .rs-spin {
      animation: rs-rotate 0.9s linear infinite;
      transform-origin: center;
    }
    @keyframes rs-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .rs-btn:focus-visible {
      outline: 2px solid #1a73e8;
      outline-offset: 2px;
    }
  `);

  return _styleSheet;
}

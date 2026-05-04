// ==UserScript==
// @name         Crunchyroll Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.0
// @description  Sidebar (page-push) with multi-filter & sort for Crunchyroll browse — auto-scan, retry, export/clipboard, data-only filter
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @match        https://*.crunchyroll.com/*
// @grant        GM_addStyle
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-idle
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

import { createLogger } from './src/shared/logging-utils.js';
import { waitForElement, debounce } from './src/shared/dom-utils.js';
import { scanCards } from './src/crunchyroll-enhanced/scanner.js';
import { applyFilterAndSort } from './src/crunchyroll-enhanced/filters.js';
import { buildSidebar, attachEvents, toggle, updateStatus, updateStats, resetFilters, saveFilters, loadSavedFilters } from './src/crunchyroll-enhanced/ui-panel.js';

var SW = 360;
var log = createLogger('Crunchyroll Enhanced');

// ── Page-level styles ──
GM_addStyle([
  'html { transition: margin-right 0.32s ease !important; }',

  '.cr-overlay { position:absolute; top:5px; right:5px; z-index:3; display:flex; flex-direction:column; gap:2px; pointer-events:none; }',
  '.cr-badge { display:inline-block; padding:2px 5px; border-radius:3px; font-size:9px; font-weight:700; line-height:1.4; white-space:nowrap; }',
  '.cr-b-rating   { background:rgba(230,140,10,0.9); color:#fff; }',
  '.cr-b-votes    { background:rgba(130,60,160,0.9); color:#fff; }',
  '.cr-b-seasons  { background:rgba(30,150,80,0.9);  color:#fff; }',
  '.cr-b-episodes { background:rgba(40,120,200,0.9); color:#fff; }',
  '.cr-b-sub      { background:rgba(20,50,80,0.92);  color:#6bb5e0; }',
  '.cr-b-dub      { background:rgba(20,50,80,0.92);  color:#9ecfec; }',
  '.cr-b-wl       { background:rgba(200,40,40,0.88); color:#fff; }',

  '.cr-hidden { display: none !important; }',

  '@keyframes cr-spin { to { transform: rotate(360deg); } }',
  '@keyframes cr-new-card { from { outline: 2px solid #f47521; } to { outline: 2px solid transparent; } }',
  '.cr-new-card { animation: cr-new-card 1.2s ease-out forwards; }'
].join('\n'));

// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main application class — stateful orchestrator that delegates to imported modules.
 */
class CrunchyrollEnhanced {
  constructor() {
    this.cards      = new Map();
    this.origOrder  = [];
    this.isScanning = false;
    this.isOpen     = false;
    this.showBadges = true;
    this.log        = log;

    var self = this;
    this._debounceApply = debounce(function () {
      saveFilters(self);
      self._apply();
    }, 280);

    this._waitForCards().then(function () {
      self._buildUI();
      setTimeout(function () { self._scan(); }, 1200);
    });
  }

  // ── Bootstrap ──

  _waitForCards() {
    return waitForElement('.browse-card', 0)
      .catch(function () {});
  }

  async _buildUI() {
    this.isOpen = await GM.getValue('cr_sidebar_open', false);
    this.showBadges = await GM.getValue('cr_show_badges', true);
    buildSidebar(this, SW);
    // Wait for sidebar to be ready, then load saved filters
    await loadSavedFilters(this);
    attachEvents(this);
  }

  // ── Selector helper (inside sidebar shadow root) ──

  _$(id) {
    return this.sidebar.root.querySelector('#' + CSS.escape(id));
  }

  // ── Delegated methods ──

  _scan() {
    scanCards(this);
  }

  _apply() {
    applyFilterAndSort(this);
  }

  _toggle(forceTo) {
    toggle(this, forceTo);
  }

  _reset() {
    resetFilters(this);
  }

  _status(msg) {
    updateStatus(this, msg);
  }

  _updateStats(visible, total, wd) {
    updateStats(this, visible, total, wd);
  }

  _saveFilters() {
    saveFilters(this);
  }

  _sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }
}

// ── PiP Unlock (SPA-safe) ──
setInterval(function () {
  var v = document.querySelector('video[disablePictureInPicture]');
  if (v) v.removeAttribute('disablePictureInPicture');
}, 1000);

// ── Bootstrap (only on /videos/popular) ──
if (/\/videos\/popular/.test(location.pathname))
  new CrunchyrollEnhanced();

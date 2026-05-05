/**
 * Copy as Markdown — Sidebar UI Module
 *
 * Builds and manages the sidebar DOM (Shadow DOM), options panel, history panel,
 * theme toggling, clipboard helpers, and all sidebar event wiring.
 */

import { loadSetting, saveSetting } from '../shared/storage-utils.js';
import { createToast, createSidebar } from '../shared/ui-components.js';
import { convertPage, convertSelection, fetchUrlAsMarkdown } from './converter-integration.js';
import { startClickMode, stopClickMode, activeClickMode } from './click-modes.js';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'mds_history';
const MAX_HISTORY = 10;
export const SIDEBAR_WIDTH = 380;
const OPTS_KEY = 'mds_opts';
const DEFAULT_OPTS = { title: true, nolinks: false, clean: true };

// ============================================================
// State
// ============================================================

/** @type {string} */
let currentMarkdown = '';

/** @type {string} */
let currentTheme = 'dark';

/** @type {Object|null} */
let sidebar = null;

/** @type {Element|null} */
export let _sidebarHost = null;

// ============================================================
// Options
// ============================================================

/**
 * Load saved options from storage.
 * @returns {Promise<{ title: boolean, nolinks: boolean, clean: boolean }>}
 */
export async function loadOpts() {
  const stored = await loadSetting(OPTS_KEY, null);
  if (!stored) return Object.assign({}, DEFAULT_OPTS);
  try {
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return Object.assign({}, DEFAULT_OPTS, parsed);
  } catch (e) {
    return Object.assign({}, DEFAULT_OPTS);
  }
}

/**
 * Save current options to storage.
 * @returns {Promise<{ title: boolean, nolinks: boolean, clean: boolean }>}
 */
export async function saveOpts() {
  const o= getOpts();
  await saveSetting(OPTS_KEY, o);
  return o;
}

/**
 * Read current option values from the sidebar DOM.
 * @returns {{ title: boolean, nolinks: boolean, clean: boolean }}
 */
export function getOpts() {
  const r= sidebar ? sidebar.root : null;
  if (!r) return { title: true, nolinks: false, clean: true };
  function cb(id, def) { const el= r.querySelector(id); return el ? el.checked : def; }
  return {
    title:   cb('#mds-opt-title',   true),
    nolinks: cb('#mds-opt-nolinks', false),
    clean:   cb('#mds-opt-clean',   true),
  };
}

// ============================================================
// Clipboard
// ============================================================

/**
 * Copy text to clipboard with multiple fallback strategies.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try { GM_setClipboard(text, 'text'); return true; } catch (e) {}
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

// ============================================================
// History
// ============================================================

/**
 * Save a conversion result to history.
 * @param {string} markdown
 * @param {string} copyType
 * @param {string} [title]
 * @param {string} [url]
 */
export async function saveToHistory(markdown, copyType, title, url) {
  const stored = await loadSetting(STORAGE_KEY, []);
  const history = Array.isArray(stored) ? stored : [];
  history.unshift({
    id: Date.now().toString(),
    markdown: markdown,
    title: title || document.title,
    url: url || location.href,
    copyType: copyType,
    timestamp: Date.now()
  });
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  await saveSetting(STORAGE_KEY, history);
}

/**
 * Load conversion history from storage.
 * @returns {Promise<Array>}
 */
export async function getHistory() {
  const stored = await loadSetting(STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

/**
 * Delete a single history item by ID.
 * @param {string} id
 */
export async function deleteHistoryItem(id) {
  const history = await getHistory();
  await saveSetting(STORAGE_KEY, history.filter(function (item) { return item.id !== id; }));
}

// ============================================================
// Helpers
// ============================================================

/**
 * HTML-escape text for safe innerHTML assignment.
 * @param {*} text
 * @returns {string}
 */
function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Format a timestamp as a relative time string.
 * @param {number} ts - Unix timestamp in ms
 * @returns {string}
 */
function formatTime(ts) {
  const d= Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
  return new Date(ts).toLocaleDateString();
}

/**
 * Convert internal copy type to a human-readable label.
 * @param {string} t
 * @returns {string}
 */
function typeLabel(t) {
  return { copyPage: 'Page', copySelection: 'Selection', copyImage: 'Image', copyLink: 'Link', copyUrl: 'URL' }[t] || t;
}

// ============================================================
// Preview rendering
// ============================================================

/**
 * Set the preview panel content.
 * @param {string} md - Markdown text
 * @param {string} [sourceLabel] - Source label (e.g. hostname)
 */
export function setPreview(md, sourceLabel) {
  currentMarkdown = md;
  const r= sidebar ? sidebar.root : null;
  if (!r) return;
  const el= r.querySelector('#mds-preview');
  const src = r.querySelector('#mds-preview-source');
  if (el) el.textContent = md;
  if (src) src.textContent = sourceLabel || '';
}

/**
 * Show a loading indicator in the preview panel.
 */
export function setPreviewLoading() {
  const r= sidebar ? sidebar.root : null;
  if (!r) return;
  const el= r.querySelector('#mds-preview');
  if (el) el.innerHTML = '<span class="mds-loading"></span>';
}

/**
 * Show an error message in the preview panel.
 * @param {string} msg
 */
export function setPreviewError(msg) {
  const r= sidebar ? sidebar.root : null;
  if (!r) return;
  const el= r.querySelector('#mds-preview');
  if (el) el.innerHTML = '<span style="color:var(--red,#f87171)">' + esc(msg) + '</span>';
}

/**
 * Generate a preview of the current page in the sidebar.
 */
export function generatePagePreview() {
  setPreviewLoading();
  function run() {
    try {
      const md = convertPage(getOpts());
      setPreview(md, location.hostname);
    } catch (e) {
      setPreviewError('Error: ' + e.message);
    }
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}

// ============================================================
// History rendering
// ============================================================

/**
 * Render the history list panel.
 */
export function renderHistory() {
  const r= sidebar ? sidebar.root : null;
  if (!r) return;
  const listEl = r.querySelector('#mds-history-list');
  if (!listEl) return;
  getHistory().then(function (history) {
    if (!history.length) {
      listEl.innerHTML = '<div class="mds-empty">No history yet</div>';
      return;
    }
    listEl.innerHTML = history.map(function (item) {
      return '<div class="mds-hist-item">' +
        '<div class="mds-hist-row1">' +
          '<span class="mds-hist-badge">' + esc(typeLabel(item.copyType)) + '</span>' +
          '<span class="mds-hist-time">' + esc(formatTime(item.timestamp)) + '</span>' +
        '</div>' +
        '<div class="mds-hist-title">' + esc(item.title || item.url || '') + '</div>' +
        '<div class="mds-hist-preview">' + esc(item.markdown.slice(0, 110)) + (item.markdown.length > 110 ? '&hellip;' : '') + '</div>' +
        '<div class="mds-hist-actions">' +
          '<button class="mds-hist-btn" data-id="' + esc(item.id) + '">Copy</button>' +
          '<button class="mds-hist-btn del" data-id="' + esc(item.id) + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.mds-hist-btn:not(.del)').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        const id = e.currentTarget.dataset.id;
        const items = await getHistory();
        const item = items.find(function (h) { return h.id === id; });
        if (!item) { createToast('Not found', { type: 'error', duration: 2200 }); return; }
        const ok = await copyToClipboard(item.markdown);
        createToast(ok ? 'Copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
      });
    });
    listEl.querySelectorAll('.mds-hist-btn.del').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        await deleteHistoryItem(e.currentTarget.dataset.id);
        renderHistory();
      });
    });
  });
}

// ============================================================
// Theme
// ============================================================

/**
 * Apply a theme ('dark' or 'light') to the sidebar.
 * @param {string} theme
 */
export function applyTheme(theme) {
  currentTheme = theme;
  saveSetting('mds_theme', theme);
  if (sidebar) {
    sidebar.host.setAttribute('data-theme', theme);
    const btn = sidebar.root.querySelector('#mds-theme-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
  }
}

// ============================================================
// Sidebar visibility
// ============================================================

/**
 * Show the sidebar (build if needed).
 */
export function showSidebar() {
  if (!sidebar) sidebar = buildSidebar();
  sidebar.open();
}

/**
 * Hide the sidebar.
 */
export function hideSidebar() {
  if (sidebar) sidebar.close();
}

// ============================================================
// Tab switching
// ============================================================

/**
 * Switch between preview and history tabs.
 * @param {string} which - 'preview' or 'history'
 */
export function switchTab(which) {
  const r= sidebar ? sidebar.root : null;
  if (!r) return;
  r.querySelector('#mds-tab-preview').classList.toggle('active', which === 'preview');
  r.querySelector('#mds-tab-history').classList.toggle('active', which === 'history');
  r.querySelector('#mds-panel-preview').classList.toggle('hidden', which !== 'preview');
  r.querySelector('#mds-panel-history').classList.toggle('hidden', which !== 'history');
  if (which === 'history') renderHistory();
}

// ============================================================
// Sidebar CSS
// ============================================================

const ADAPTED_CSS = [
  ':host {',
  '  --bg:        #0e0c09;',
  '  --surface:   #181510;',
  '  --surface2:  #211d16;',
  '  --border:    #2d2820;',
  '  --border2:   #3d3628;',
  '  --accent:    #f59e0b;',
  '  --accent-dim:#7c5109;',
  '  --accent-lo: #1a1105;',
  '  --text:      #f0ebe0;',
  '  --text-dim:  #7a7060;',
  '  --text-mid:  #b0a890;',
  '  --green:     #34d399;',
  '  --red:       #f87171;',
  '  --mono:      ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;',
  '  --sans:      system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  '}',
  '*, *::before, *::after {',
  '  box-sizing: border-box !important;',
  '  font-family: inherit !important;',
  '}',
  'button, div, span {',
  '  all: revert;',
  '  box-sizing: border-box !important;',
  '  margin: 0 !important;',
  '  line-height: normal !important;',
  '  font-family: var(--sans) !important;',
  '}',
  'input {',
  '  all: revert;',
  '  box-sizing: border-box !important;',
  '  margin: 0 !important;',
  '  font-family: var(--sans) !important;',
  '}',
  'label {',
  '  all: revert;',
  '  box-sizing: border-box !important;',
  '  margin: 0 !important;',
  '  font-family: var(--sans) !important;',
  '}',
  'button {',
  '  appearance: none !important;',
  '  text-transform: none !important;',
  '  letter-spacing: normal !important;',
  '  line-height: 1 !important;',
  '}',
  '',
  '/* ---- Header ---- */',
  '#mds-header {',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: space-between !important;',
  '  padding: 0 14px !important;',
  '  height: 46px !important;',
  '  background: var(--surface) !important;',
  '  border-bottom: 1px solid var(--border) !important;',
  '  flex-shrink: 0 !important;',
  '}',
  '#mds-logo {',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  gap: 8px !important;',
  '  font-family: var(--mono) !important;',
  '  font-size: 12px !important;',
  '  font-weight: 500 !important;',
  '  color: var(--accent) !important;',
  '  letter-spacing: 0.08em !important;',
  '  text-transform: uppercase !important;',
  '}',
  '#mds-logo-icon {',
  '  width: 22px !important;',
  '  height: 22px !important;',
  '  background: var(--accent) !important;',
  '  border-radius: 4px !important;',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: center !important;',
  '  font-size: 11px !important;',
  '  color: var(--bg) !important;',
  '  font-weight: 700 !important;',
  '  flex-shrink: 0 !important;',
  '}',
  '#mds-close {',
  '  width: 28px !important;',
  '  height: 28px !important;',
  '  border: none !important;',
  '  background: var(--surface2) !important;',
  '  color: var(--text-dim) !important;',
  '  border-radius: 6px !important;',
  '  cursor: pointer !important;',
  '  font-size: 14px !important;',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: center !important;',
  '  transition: background 0.15s, color 0.15s !important;',
  '  padding: 0 !important;',
  '}',
  '#mds-close:hover {',
  '  background: var(--border2) !important;',
  '  color: var(--text) !important;',
  '}',
  '',
  '/* ---- Section label ---- */',
  '.mds-label {',
  '  font-family: var(--mono) !important;',
  '  font-size: 9px !important;',
  '  font-weight: 600 !important;',
  '  letter-spacing: 0.16em !important;',
  '  text-transform: uppercase !important;',
  '  color: var(--text-dim) !important;',
  '  padding: 12px 14px 5px !important;',
  '  display: block !important;',
  '}',
  '',
  '/* ---- Copy action buttons ---- */',
  '#mds-actions {',
  '  display: grid !important;',
  '  grid-template-columns: 1fr 1fr !important;',
  '  gap: 6px !important;',
  '  padding: 0 14px 10px !important;',
  '}',
  '.mds-action-btn {',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: center !important;',
  '  gap: 6px !important;',
  '  padding: 8px 10px !important;',
  '  background: var(--surface2) !important;',
  '  border: 1px solid var(--border) !important;',
  '  border-radius: 7px !important;',
  '  color: var(--text-mid) !important;',
  '  cursor: pointer !important;',
  '  font-size: 12px !important;',
  '  font-weight: 500 !important;',
  '  transition: background 0.15s, border-color 0.15s, color 0.15s !important;',
  '  white-space: nowrap !important;',
  '  overflow: hidden !important;',
  '  line-height: 1 !important;',
  '}',
  '.mds-action-btn:hover {',
  '  background: var(--border) !important;',
  '  border-color: var(--border2) !important;',
  '  color: var(--text) !important;',
  '}',
  '.mds-action-btn.mds-active-mode {',
  '  background: var(--accent-lo) !important;',
  '  border-color: var(--accent-dim) !important;',
  '  color: var(--accent) !important;',
  '  animation: mds-pulse 1.5s ease-in-out infinite !important;',
  '}',
  '@keyframes mds-pulse {',
  '  0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }',
  '  50%       { box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }',
  '}',
  '.mds-action-icon {',
  '  font-size: 13px !important;',
  '  flex-shrink: 0 !important;',
  '  line-height: 1 !important;',
  '}',
  '',
  '/* ---- Divider ---- */',
  '.mds-divider {',
  '  height: 1px !important;',
  '  background: var(--border) !important;',
  '  margin: 4px 0 !important;',
  '  flex-shrink: 0 !important;',
  '}',
  '',
  '/* ---- Options toggles ---- */',
  '#mds-options {',
  '  padding: 0 14px 10px !important;',
  '  display: flex !important;',
  '  flex-direction: column !important;',
  '  gap: 2px !important;',
  '}',
  '.mds-toggle-row {',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: space-between !important;',
  '  padding: 6px 8px !important;',
  '  border-radius: 6px !important;',
  '  cursor: pointer !important;',
  '  transition: background 0.12s !important;',
  '  user-select: none !important;',
  '}',
  '.mds-toggle-row:hover {',
  '  background: var(--surface2) !important;',
  '}',
  '.mds-toggle-row input[type="checkbox"] {',
  '  display: none !important;',
  '  visibility: hidden !important;',
  '  width: 0 !important;',
  '  height: 0 !important;',
  '  position: absolute !important;',
  '  pointer-events: none !important;',
  '}',
  '.mds-toggle-label {',
  '  font-size: 12px !important;',
  '  color: var(--text-mid) !important;',
  '  line-height: 1.4 !important;',
  '  flex: 1 !important;',
  '}',
  '.mds-switch {',
  '  width: 30px !important;',
  '  height: 16px !important;',
  '  background: var(--border2) !important;',
  '  border-radius: 8px !important;',
  '  position: relative !important;',
  '  transition: background 0.2s !important;',
  '  flex-shrink: 0 !important;',
  '  display: block !important;',
  '}',
  '.mds-switch::after {',
  "  content: '' !important;",
  '  position: absolute !important;',
  '  top: 2px !important;',
  '  left: 2px !important;',
  '  width: 12px !important;',
  '  height: 12px !important;',
  '  border-radius: 50% !important;',
  '  background: var(--text-dim) !important;',
  '  transition: transform 0.2s, background 0.2s !important;',
  '}',
  '.mds-toggle-row input[type="checkbox"]:checked + .mds-switch {',
  '  background: var(--accent-dim) !important;',
  '}',
  '.mds-toggle-row input[type="checkbox"]:checked + .mds-switch::after {',
  '  transform: translateX(14px) !important;',
  '  background: var(--accent) !important;',
  '}',
  '',
  '/* ---- URL fetch ---- */',
  '#mds-url-section {',
  '  padding: 0 14px 10px !important;',
  '}',
  '#mds-url-row {',
  '  display: flex !important;',
  '  gap: 6px !important;',
  '}',
  '#mds-url-input {',
  '  flex: 1 !important;',
  '  padding: 6px 10px !important;',
  '  background: var(--surface2) !important;',
  '  border: 1px solid var(--border) !important;',
  '  border-radius: 7px !important;',
  '  color: var(--text) !important;',
  '  font-size: 12px !important;',
  '  font-family: var(--mono) !important;',
  '  outline: none !important;',
  '  transition: border-color 0.15s !important;',
  '  min-width: 0 !important;',
  '}',
  '#mds-url-input::placeholder {',
  '  color: var(--text-dim) !important;',
  '  opacity: 1 !important;',
  '}',
  '#mds-url-input:focus {',
  '  border-color: var(--accent-dim) !important;',
  '}',
  '#mds-url-fetch {',
  '  padding: 6px 12px !important;',
  '  background: var(--accent) !important;',
  '  color: var(--bg) !important;',
  '  border: none !important;',
  '  border-radius: 7px !important;',
  '  cursor: pointer !important;',
  '  font-size: 12px !important;',
  '  font-weight: 600 !important;',
  '  transition: opacity 0.15s !important;',
  '  white-space: nowrap !important;',
  '  flex-shrink: 0 !important;',
  '}',
  '#mds-url-fetch:hover { opacity: 0.85 !important; }',
  '#mds-url-fetch:disabled { opacity: 0.4 !important; cursor: default !important; }',
  '',
  '/* ---- Content tabs ---- */',
  '#mds-tabs {',
  '  display: flex !important;',
  '  border-bottom: 1px solid var(--border) !important;',
  '  padding: 0 14px !important;',
  '  gap: 0 !important;',
  '  flex-shrink: 0 !important;',
  '}',
  '.mds-tab {',
  '  padding: 8px 12px !important;',
  '  background: transparent !important;',
  '  border: none !important;',
  '  border-bottom: 2px solid transparent !important;',
  '  color: var(--text-dim) !important;',
  '  cursor: pointer !important;',
  '  font-size: 12px !important;',
  '  font-weight: 500 !important;',
  '  margin-bottom: -1px !important;',
  '  transition: color 0.15s, border-color 0.15s !important;',
  '  outline: none !important;',
  '}',
  '.mds-tab:hover { color: var(--text-mid) !important; }',
  '.mds-tab.active {',
  '  color: var(--accent) !important;',
  '  border-bottom-color: var(--accent) !important;',
  '}',
  '',
  '/* ---- Preview ---- */',
  '#mds-panel-preview {',
  '  flex: 1 !important;',
  '  display: flex !important;',
  '  flex-direction: column !important;',
  '  overflow: hidden !important;',
  '}',
  '#mds-panel-preview.hidden { display: none !important; }',
  '#mds-preview-toolbar {',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: flex-end !important;',
  '  padding: 6px 14px !important;',
  '  flex-shrink: 0 !important;',
  '  gap: 6px !important;',
  '}',
  '#mds-preview-source {',
  '  font-family: var(--mono) !important;',
  '  font-size: 10px !important;',
  '  color: var(--text-dim) !important;',
  '  flex: 1 !important;',
  '  overflow: hidden !important;',
  '  text-overflow: ellipsis !important;',
  '  white-space: nowrap !important;',
  '}',
  '#mds-copy-preview {',
  '  padding: 4px 12px !important;',
  '  background: var(--surface2) !important;',
  '  border: 1px solid var(--border) !important;',
  '  border-radius: 5px !important;',
  '  color: var(--text-mid) !important;',
  '  cursor: pointer !important;',
  '  font-size: 11px !important;',
  '  font-weight: 500 !important;',
  '  transition: background 0.15s, color 0.15s, border-color 0.15s !important;',
  '}',
  '#mds-copy-preview:hover {',
  '  background: var(--accent) !important;',
  '  color: var(--bg) !important;',
  '  border-color: var(--accent) !important;',
  '}',
  '#mds-preview {',
  '  flex: 1 !important;',
  '  overflow-y: auto !important;',
  '  padding: 12px 14px !important;',
  '  font-family: var(--mono) !important;',
  '  font-size: 11.5px !important;',
  '  line-height: 1.7 !important;',
  '  color: var(--text-mid) !important;',
  '  white-space: pre-wrap !important;',
  '  word-break: break-word !important;',
  '  scrollbar-width: thin !important;',
  '  scrollbar-color: var(--border2) transparent !important;',
  '}',
  '#mds-preview::-webkit-scrollbar { width: 4px !important; }',
  '#mds-preview::-webkit-scrollbar-thumb { background: var(--border2) !important; border-radius: 4px !important; }',
  '.mds-loading {',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: center !important;',
  '  height: 80px !important;',
  '  color: var(--text-dim) !important;',
  '  font-size: 12px !important;',
  '  font-style: italic !important;',
  '  gap: 8px !important;',
  '}',
  ".mds-loading::before {",
  "  content: '' !important;",
  '  width: 12px !important;',
  '  height: 12px !important;',
  '  border: 2px solid var(--border2) !important;',
  '  border-top-color: var(--accent) !important;',
  '  border-radius: 50% !important;',
  '  animation: mds-spin 0.8s linear infinite !important;',
  '}',
  '@keyframes mds-spin { to { transform: rotate(360deg); } }',
  '',
  '/* ---- History ---- */',
  '#mds-panel-history {',
  '  flex: 1 !important;',
  '  display: flex !important;',
  '  flex-direction: column !important;',
  '  overflow: hidden !important;',
  '}',
  '#mds-panel-history.hidden { display: none !important; }',
  '#mds-history-list {',
  '  flex: 1 !important;',
  '  overflow-y: auto !important;',
  '  padding: 10px 14px !important;',
  '  display: flex !important;',
  '  flex-direction: column !important;',
  '  gap: 6px !important;',
  '  scrollbar-width: thin !important;',
  '  scrollbar-color: var(--border2) transparent !important;',
  '}',
  '#mds-history-list::-webkit-scrollbar { width: 4px !important; }',
  '#mds-history-list::-webkit-scrollbar-thumb { background: var(--border2) !important; border-radius: 4px !important; }',
  '.mds-empty {',
  '  color: var(--text-dim) !important;',
  '  font-style: italic !important;',
  '  text-align: center !important;',
  '  padding: 24px 0 !important;',
  '  font-size: 12px !important;',
  '}',
  '.mds-hist-item {',
  '  background: var(--surface) !important;',
  '  border: 1px solid var(--border) !important;',
  '  border-left: 3px solid var(--accent-dim) !important;',
  '  border-radius: 7px !important;',
  '  padding: 10px 11px !important;',
  '  transition: border-left-color 0.15s !important;',
  '}',
  '.mds-hist-item:hover { border-left-color: var(--accent) !important; }',
  '.mds-hist-row1 {',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: space-between !important;',
  '  margin-bottom: 4px !important;',
  '}',
  '.mds-hist-badge {',
  '  font-family: var(--mono) !important;',
  '  font-size: 9px !important;',
  '  font-weight: 500 !important;',
  '  letter-spacing: 0.1em !important;',
  '  text-transform: uppercase !important;',
  '  color: var(--accent) !important;',
  '  background: var(--accent-lo) !important;',
  '  padding: 2px 6px !important;',
  '  border-radius: 3px !important;',
  '  border: 1px solid var(--accent-dim) !important;',
  '}',
  '.mds-hist-time {',
  '  font-size: 10px !important;',
  '  color: var(--text-dim) !important;',
  '}',
  '.mds-hist-title {',
  '  font-size: 12px !important;',
  '  font-weight: 500 !important;',
  '  color: var(--text) !important;',
  '  white-space: nowrap !important;',
  '  overflow: hidden !important;',
  '  text-overflow: ellipsis !important;',
  '  margin-bottom: 3px !important;',
  '}',
  '.mds-hist-preview {',
  '  font-family: var(--mono) !important;',
  '  font-size: 10.5px !important;',
  '  color: var(--text-dim) !important;',
  '  line-height: 1.5 !important;',
  '  overflow: hidden !important;',
  '  max-height: 32px !important;',
  '  margin-bottom: 8px !important;',
  '  word-break: break-all !important;',
  '}',
  '.mds-hist-actions {',
  '  display: flex !important;',
  '  gap: 5px !important;',
  '}',
  '.mds-hist-btn {',
  '  padding: 3px 10px !important;',
  '  border-radius: 4px !important;',
  '  border: 1px solid var(--border2) !important;',
  '  background: var(--surface2) !important;',
  '  color: var(--text-mid) !important;',
  '  font-size: 11px !important;',
  '  cursor: pointer !important;',
  '  transition: background 0.12s, color 0.12s, border-color 0.12s !important;',
  '}',
  '.mds-hist-btn:hover {',
  '  background: var(--accent) !important;',
  '  color: var(--bg) !important;',
  '  border-color: var(--accent) !important;',
  '}',
  '.mds-hist-btn.del:hover {',
  '  background: var(--red) !important;',
  '  color: white !important;',
  '  border-color: var(--red) !important;',
  '}',
  '',
  '/* ---- Theme button ---- */',
  '#mds-theme-btn {',
  '  width: 28px !important;',
  '  height: 28px !important;',
  '  border: none !important;',
  '  background: var(--surface2) !important;',
  '  color: var(--text-dim) !important;',
  '  border-radius: 6px !important;',
  '  cursor: pointer !important;',
  '  font-size: 14px !important;',
  '  display: flex !important;',
  '  align-items: center !important;',
  '  justify-content: center !important;',
  '  transition: background 0.15s, color 0.15s !important;',
  '  padding: 0 !important;',
  '}',
  '#mds-theme-btn:hover { background: var(--border2) !important; color: var(--text) !important; }',
  '',
  '/* ---- Light theme overrides ---- */',
  ':host([data-theme="light"]) {',
  '  --bg:        #ffffff;',
  '  --surface:   #f5f5f4;',
  '  --surface2:  #ebe9e6;',
  '  --border:    #ddd8d0;',
  '  --border2:   #c9c4bc;',
  '  --accent:    #c77c00;',
  '  --accent-dim:#c77c00;',
  '  --accent-lo: #fff8ec;',
  '  --text:      #1c1a17;',
  '  --text-dim:  #9a9080;',
  '  --text-mid:  #5a5248;',
  '  --green:     #16a34a;',
  '  --red:       #dc2626;',
  '}',
  ':host([data-theme="light"]) #mds-preview { color: var(--text-mid) !important; }',
  ':host([data-theme="light"]) .mds-hist-item { border-left-color: var(--accent-dim) !important; }',
].join('\n');

// ============================================================
// Sidebar HTML template
// ============================================================

const SIDEBAR_HTML = [
  '<div id="mds-header">',
  '  <div id="mds-logo">',
  '    <span id="mds-logo-icon">M↓</span>',
  '    <span>Markdown</span>',
  '  </div>',
  '  <div style="display:flex;gap:4px;align-items:center">',
  '    <button id="mds-theme-btn" title="Toggle dark/light mode">☀</button>',
  '    <button id="mds-close" title="Close sidebar">✕</button>',
  '  </div>',
  '</div>',
  '',
  '<div class="mds-label">Copy as</div>',
  '<div id="mds-actions">',
  '  <button class="mds-action-btn" id="mds-act-page">',
  '    <span class="mds-action-icon">📄</span> Page',
  '  </button>',
  '  <button class="mds-action-btn" id="mds-act-sel">',
  '    <span class="mds-action-icon">✂️</span> Selection',
  '  </button>',
  '  <button class="mds-action-btn" id="mds-act-img">',
  '    <span class="mds-action-icon">🖼</span> Image',
  '  </button>',
  '  <button class="mds-action-btn" id="mds-act-link">',
  '    <span class="mds-action-icon">🔗</span> Link',
  '  </button>',
  '</div>',
  '',
  '<div class="mds-divider"></div>',
  '<div class="mds-label">Options</div>',
  '<div id="mds-options">',
  '  <label class="mds-toggle-row">',
  '    <span class="mds-toggle-label">Include Title</span>',
  '    <input type="checkbox" id="mds-opt-title" checked>',
  '    <span class="mds-switch"></span>',
  '  </label>',
  '  <label class="mds-toggle-row">',
  '    <span class="mds-toggle-label">Ignore Links &amp; Images</span>',
  '    <input type="checkbox" id="mds-opt-nolinks">',
  '    <span class="mds-switch"></span>',
  '  </label>',
  '  <label class="mds-toggle-row">',
  '    <span class="mds-toggle-label">Clean / Filter</span>',
  '    <input type="checkbox" id="mds-opt-clean" checked>',
  '    <span class="mds-switch"></span>',
  '  </label>',
  '</div>',
  '',
  '<div class="mds-divider"></div>',
  '<div class="mds-label">Fetch URL</div>',
  '<div id="mds-url-section">',
  '  <div id="mds-url-row">',
  '    <input type="url" id="mds-url-input" placeholder="https://example.com/article">',
  '    <button id="mds-url-fetch">Fetch →</button>',
  '  </div>',
  '</div>',
  '',
  '<div class="mds-divider"></div>',
  '<div id="mds-tabs">',
  '  <button class="mds-tab active" id="mds-tab-preview">Preview</button>',
  '  <button class="mds-tab" id="mds-tab-history">History</button>',
  '</div>',
  '',
  '<div id="mds-panel-preview">',
  '  <div id="mds-preview-toolbar">',
  '    <span id="mds-preview-source"></span>',
  '    <button id="mds-copy-preview">Copy</button>',
  '  </div>',
  '  <pre id="mds-preview"><span class="mds-loading"></span></pre>',
  '</div>',
  '<div id="mds-panel-history" class="hidden">',
  '  <div id="mds-history-list"></div>',
  '</div>',
].join('\n');

// ============================================================
// Sidebar builder
// ============================================================

/**
 * Build the sidebar (once) with all event wiring.
 * @returns {Object} The sidebar object from TM.ui.createSidebar
 */
export function buildSidebar() {
  if (sidebar) return sidebar;

  const sb = createSidebar({
    width: SIDEBAR_WIDTH,
    title: 'Markdown',
    accentColor: '#f59e0b',
    cssOverrides: [
      ':host { background: #0e0c09; color: #f0ebe0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 2147483646; border-left: 1px solid #2d2820; box-shadow: -8px 0 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; }',
      '.header { display: none !important; }',
      '.body { padding: 0 !important; display: flex; flex-direction: column; overflow: hidden !important; }',
    ].join(' '),
    onOpen: function () {
      loadOpts().then(function (savedOpts) {
        const r= sb.root;
        const setCheck = function (id, val) { const el= r.querySelector(id); if (el) el.checked = val; };
        setCheck('#mds-opt-title', savedOpts.title);
        setCheck('#mds-opt-nolinks', savedOpts.nolinks);
        setCheck('#mds-opt-clean', savedOpts.clean);
      });
      sb.host.setAttribute('data-theme', currentTheme);
      generatePagePreview();
      setTimeout(function () { const inp = sb.root.querySelector('#mds-url-input'); if (inp) inp.focus(); }, 300);
    },
    onClose: function () { stopClickMode(); }
  });

  sidebar = sb;

  // Store sidebar host reference for cross-module use (convertSelection checks it)
  _sidebarHost = sb.host;

  // Inject full custom CSS into shadow root
  const style = document.createElement('style');
  style.textContent = ADAPTED_CSS;
  sb.root.appendChild(style);

  // Populate inner content
  sb.bodyEl.innerHTML = SIDEBAR_HTML;

  const r= sb.root;

  // Close button
  r.querySelector('#mds-close').addEventListener('click', function () { sb.close(); });

  // Theme toggle
  const themeBtn = r.querySelector('#mds-theme-btn');
  if (themeBtn) {
    themeBtn.textContent = currentTheme === 'dark' ? '☀' : '☾';
    themeBtn.addEventListener('click', function () {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // Copy page
  r.querySelector('#mds-act-page').addEventListener('click', async function () {
    try {
      const md = convertPage(getOpts());
      const ok = await copyToClipboard(md);
      if (ok) saveToHistory(md, 'copyPage');
      createToast(ok ? 'Page copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
      setPreview(md, location.hostname);
    } catch (e) { createToast(e.message, { type: 'error', duration: 2200 }); }
  });

  // Copy selection
  r.querySelector('#mds-act-sel').addEventListener('click', async function () {
    const md = convertSelection(getOpts());
    if (!md) { createToast('No text selected', { type: 'error', duration: 2200 }); return; }
    const ok = await copyToClipboard(md);
    if (ok) saveToHistory(md, 'copySelection');
    createToast(ok ? 'Selection copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
    setPreview(md, 'selection');
  });

  // Copy image — click mode
  r.querySelector('#mds-act-img').addEventListener('click', function () {
    if (activeClickMode === 'img') { stopClickMode(); return; }
    startClickMode({
      mode: 'img',
      hint: 'Click any image to copy as Markdown',
      targetSelector: 'img',
      handler: function (imgEl) {
        const alt = imgEl.alt || imgEl.src.split('/').pop()?.split('?')[0] || 'image';
        return '![' + alt + '](' + imgEl.src + ')';
      },
      onResult: async function (md) {
        const ok = await copyToClipboard(md);
        if (ok) saveToHistory(md, 'copyImage');
        createToast(ok ? 'Copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
        setPreview(md, 'image');
      },
      onCancel: function () { createToast('Cancelled', { type: 'info', duration: 2000 }); },
      getSidebarHost: function () { return sb.host; },
      getModeButton: function () { return r.querySelector('#mds-act-img'); },
    });
  });

  // Copy link — click mode
  r.querySelector('#mds-act-link').addEventListener('click', function () {
    if (activeClickMode === 'link') { stopClickMode(); return; }
    startClickMode({
      mode: 'link',
      hint: 'Click any link to copy as Markdown',
      targetSelector: 'a[href]',
      handler: function (aEl) {
        const text = aEl.textContent.trim() || aEl.href;
        return '[' + text + '](' + aEl.href + ')';
      },
      onResult: async function (md) {
        const ok = await copyToClipboard(md);
        if (ok) saveToHistory(md, 'copyLink');
        createToast(ok ? 'Copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
        setPreview(md, 'link');
      },
      onCancel: function () { createToast('Cancelled', { type: 'info', duration: 2000 }); },
      getSidebarHost: function () { return sb.host; },
      getModeButton: function () { return r.querySelector('#mds-act-link'); },
    });
  });

  // Options changes
  ['mds-opt-title', 'mds-opt-nolinks', 'mds-opt-clean'].forEach(function (id) {
    const el= r.querySelector('#' + id);
    if (el) {
      el.addEventListener('change', function () {
        saveOpts();
        const previewPanel = r.querySelector('#mds-panel-preview');
        if (previewPanel && !previewPanel.classList.contains('hidden')) {
          generatePagePreview();
        }
      });
    }
  });

  // URL fetch
  const urlInput = r.querySelector('#mds-url-input');
  const fetchBtn = r.querySelector('#mds-url-fetch');
  const doFetch = async function () {
    const url= urlInput.value.trim();
    if (!url) return;
    fetchBtn.disabled = true;
    fetchBtn.textContent = '…';
    setPreviewLoading();
    try {
      const result = await fetchUrlAsMarkdown(url, getOpts());
      await saveToHistory(result.markdown, 'copyUrl', result.title, url);
      setPreview(result.markdown, new URL(url).hostname);
      switchTab('preview');
      const ok = await copyToClipboard(result.markdown);
      createToast(ok ? 'Fetched & copied' : 'Fetched', { type: 'success', duration: 2200 });
    } catch (e) {
      setPreviewError('Fetch failed: ' + e.message);
      createToast(e.message, { type: 'error', duration: 2200 });
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = 'Fetch →';
    }
  };
  fetchBtn.addEventListener('click', doFetch);
  urlInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });

  // Tabs
  r.querySelector('#mds-tab-preview').addEventListener('click', function () { switchTab('preview'); });
  r.querySelector('#mds-tab-history').addEventListener('click', function () { switchTab('history'); });

  // Copy preview button
  r.querySelector('#mds-copy-preview').addEventListener('click', async function () {
    if (!currentMarkdown) return;
    const ok = await copyToClipboard(currentMarkdown);
    await saveToHistory(currentMarkdown, 'copyPage');
    createToast(ok ? 'Copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
  });

  return sb;
}

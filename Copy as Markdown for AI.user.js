// ==UserScript==
// @name         Copy as Markdown for AI
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.3.0
// @description  Convert web pages, selections, images, and links to Markdown for AI usage with sidebar preview and history
// @author       marmoris-x
// @match        *://*/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @noframes
// @inject-into  content
// @sandbox      JavaScript
// @icon         https://lh3.googleusercontent.com/kOVdqiI3s3rT4RlNWeY-dZ61BIuZ63bT2Ou_4rGsk47FDpVxaudzPrdO-AfC6hTj3lqn7IefPYHIXDivJpuT1b8fPA=s60
// @connect      *
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Copy%20as%20Markdown%20for%20AI.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Copy%20as%20Markdown%20for%20AI.meta.js
// @run-at       document-idle
// @unwrap
// ==/UserScript==

/**
 * Copy as Markdown for AI — Entry Point
 *
 * Thin orchestrator that wires together sub-modules from src/copy-as-markdown/:
 *   - converter-integration.js  (TurndownService, page/selection conversion)
 *   - click-modes.js            (interactive image/link selection)
 *   - ui-sidebar.js             (sidebar, history, options, clipboard)
 */

import { createLogger } from './src/shared/logging-utils.js';
import { loadSetting } from './src/shared/storage-utils.js';
import { applyTheme, showSidebar } from './src/copy-as-markdown/ui-sidebar.js';

// Only run in the top-level frame — @noframes handles Tampermonkey, this guards edge cases
if (window.top !== window.self) throw new Error();
// Prevent double-init on SPA navigations
if (window.__mdsLoaded) throw new Error();
window.__mdsLoaded = true;

const log = createLogger('Copy as Markdown');

// ── Initialisation ──────────────────────────────────────────

async function init() {
  // Restore saved theme — applyTheme sets both the local var and storage
  const savedTheme = await loadSetting('mds_theme', 'dark');
  applyTheme(savedTheme || 'dark');

  // Register Tampermonkey menu command
  GM_registerMenuCommand('↓ Markdown Sidebar', function () {
    showSidebar();
  });

  log.info('Initialized (v2.3.0)');
}

init().catch(function (err) {
  console.error('[Copy as Markdown] Init failed:', err);
});

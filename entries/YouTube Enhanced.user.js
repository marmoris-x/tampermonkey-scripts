// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.9.1
// @author       marmoris-x
// @description  Auto max video quality, per-channel playback speed control & auto-stop on page load.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @match        *://*.youtube.com/*
// @sandbox      JavaScript
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @inject-into  content
// @run-at       document-start
// @noframes
// @unwrap
// ==/UserScript==

/*
 * YouTube Enhanced — modular ESM build
 *   auto-hd.js         — Patches localStorage & YouTube player for max quality
 *   channel-speed.js   — Per-channel speed control with native-UI panel
 *   auto-stop.js       — Pauses auto-play on video pages
 *   boot.js            — Orchestrator for boot and SPA navigation
 *
 * All modules use ES module imports/exports instead of window.__YTE__.
 * This entry file imports boot and bootstraps.
 */

import { boot } from '../src/youtube-enhanced/boot.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { boot(); });
} else {
  boot();
}

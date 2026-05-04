// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.7.0
// @description  Auto max video quality, per-channel playback speed control & auto-stop on page load.
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @match        *://*.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-start
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/YouTube%20Enhanced.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/YouTube%20Enhanced.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

/*
 * YouTube Enhanced -- three modules:
 *   auto-hd.js         -- Patches localStorage & YouTube player for max quality
 *   channel-speed.js   -- Per-channel speed control with native-UI panel
 *   auto-stop.js       -- Pauses auto-play on video pages
 *
 * All modules use ES module imports/exports instead of window.__YTE__.
 * This entry file imports from all three and bootstraps.
 */

import { createLogger } from '../shared/logging-utils.js';
import { CFG, patchQuality, resetHDTrackers } from '../youtube-enhanced/auto-hd.js';
import { loadSpeedData, initSpeed, cleanupSpeed } from '../youtube-enhanced/channel-speed.js';
import { initAutoStop, cleanupAutoStop, resetStopTrackers } from '../youtube-enhanced/auto-stop.js';

var log = createLogger('YouTube Enhanced', CFG.debug);

// ─────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────

patchQuality();

window.addEventListener('yt-navigate-finish', async function () {
  resetHDTrackers(); // Mandatory for SPAs so auto-stop and HD apply to subsequent videos
  resetStopTrackers();
  await loadSpeedData();
  patchQuality();

  cleanupSpeed();
  if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
    initSpeed();
  }

  cleanupAutoStop();
  initAutoStop();
});

async function boot() {
  await loadSpeedData();
  if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
    initSpeed();
  }
  initAutoStop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { boot(); });
} else {
  boot();
}

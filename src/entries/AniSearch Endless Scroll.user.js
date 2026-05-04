// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.3.0
// @description  Infinite scroll pagination for AniSearch with rating filter
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=anisearch.de
// @match        https://www.anisearch.de/anime*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      anisearch.de
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/AniSearch%20Endless%20Scroll.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/AniSearch%20Endless%20Scroll.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

import { createLogger } from '../shared/logging-utils.js';
import { newRun, findContainer, isCurrentRun, runEndlessLoop } from '../anisearch-endless-scroll/endless-loop.js';
import { parseRatingMin } from '../anisearch-endless-scroll/rating-filter.js';
import { setStatus, removeStatus, unlockUI } from '../anisearch-endless-scroll/ui-statusbar.js';

var log = createLogger('AniSearch Endless Scroll');

// ── Main Entry ──

async function main() {
  // Invalidate previous run — loop checks its own runId on each iteration
  var runId = newRun();

  setStatus('⟳ AniSearch Endless Scroll startet…');

  // Remove UI locks immediately
  unlockUI();
  // Retry after 1.5s in case site JS restores them
  setTimeout(unlockUI, 1500);

  // Determine rating minimum
  var ratingMin = await parseRatingMin();
  log.log('Rating min:', ratingMin || 'no filter');

  // Quick check whether any list exists (before the sleep)
  if (!findContainer(document)) {
    setStatus('✔ UI entsperrt. (Keine Liste erkannt)');
    setTimeout(function () { removeStatus(); }, 4000);
    return;
  }

  // Brief wait for site JS to finish rendering, then determine container fresh
  await new Promise(function (r) { setTimeout(r, 250); });
  if (!isCurrentRun(runId)) {
    removeStatus();
    return;
  }

  var found = findContainer(document);
  if (!found) {
    setStatus('✔ UI entsperrt. (Keine Liste erkannt)');
    setTimeout(function () { removeStatus(); }, 4000);
    return;
  }

  // Main loop
  await runEndlessLoop(ratingMin, found, runId);

  // Auto-remove status bar after completion
  setTimeout(function () { removeStatus(); }, 8000);
}

// ── Boot & SPA Support ──

function boot() {
  // Inject spinner keyframe (used by the loader indicator)
  var style = document.createElement('style');
  style.textContent = '@keyframes as-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
}

// Patch History API for SPA navigation support
(function patchHistory() {
  var _push    = history.pushState.bind(history);
  var _replace = history.replaceState.bind(history);
  var navTimer;

  function scheduleMain() {
    clearTimeout(navTimer);
    navTimer = setTimeout(main, 600);
  }

  history.pushState = function () {
    _push.apply(history, arguments);
    scheduleMain();
  };
  history.replaceState = function () {
    var before = location.href;
    _replace.apply(history, arguments);
    if (location.href !== before) scheduleMain();
  };
  window.addEventListener('popstate', scheduleMain);
})();

boot();

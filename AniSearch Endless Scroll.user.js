// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.2.0
// @description  Infinite scroll pagination for AniSearch with rating filter
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=anisearch.de
// @match        https://www.anisearch.de/anime*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/dom-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/storage-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/network-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/ui-components.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/anisearch-endless-scroll/endless-loop.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/anisearch-endless-scroll/rating-filter.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/anisearch-endless-scroll/ui-statusbar.js
// @connect      anisearch.de
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/AniSearch%20Endless%20Scroll.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/AniSearch%20Endless%20Scroll.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var log = TM.createLogger('AniSearch Endless Scroll');
  var AES = window.__AES__;

  // ── Main Entry ──

  async function main() {
    // Invalidate previous run — loop checks its own runId on each iteration
    var runId = AES.newRun();

    AES.setStatus('⟳ AniSearch Endless Scroll startet…');

    // Remove UI locks immediately
    AES.unlockUI();
    // Retry after 1.5s in case site JS restores them
    setTimeout(AES.unlockUI, 1500);

    // Determine rating minimum
    var ratingMin = await AES.parseRatingMin();
    log.log('Rating min:', ratingMin || 'no filter');

    // Quick check whether any list exists (before the sleep)
    if (!AES.findContainer(document)) {
      AES.setStatus('✔ UI entsperrt. (Keine Liste erkannt)');
      setTimeout(function () { AES.removeStatus(); }, 4000);
      return;
    }

    // Brief wait for site JS to finish rendering, then determine container fresh
    await new Promise(function (r) { setTimeout(r, 250); });
    if (!AES.isCurrentRun(runId)) {
      AES.removeStatus();
      return;
    }

    var found = AES.findContainer(document);
    if (!found) {
      AES.setStatus('✔ UI entsperrt. (Keine Liste erkannt)');
      setTimeout(function () { AES.removeStatus(); }, 4000);
      return;
    }

    // Main loop
    await AES.runEndlessLoop(ratingMin, found, runId);

    // Auto-remove status bar after completion
    setTimeout(function () { AES.removeStatus(); }, 8000);
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
})();

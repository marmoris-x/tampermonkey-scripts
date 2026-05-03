// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.1.3
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

  // ── Logger ──
  const log = TM.createLogger('AniSearch Endless Scroll');

  // ── Config ──

  const STORAGE_KEY_RATING = 'anisearch_rating_min';
  const FETCH_DELAY_MS     = 800;   // Base pause between page requests (+ up to 400ms jitter)
  const MAX_PAGES          = 200;   // Absolute safety limit
  const REQUEST_TIMEOUT_MS = 20000;
  const MAX_RETRIES        = 3;

  // All AniSearch view modes
  const CONTAINER_SELECTORS = [
    'ul.gallery',
    'ul.covers',
    'ul.list',
    'table.table tbody',
  ];

  const ITEM_SELECTOR_MAP = {
    'ul.gallery':        'li',
    'ul.covers':         'li',
    'ul.list':           'li',
    'table.table tbody': 'tr',
  };

  // ── DOM Helpers ──

  function findContainer(doc) {
    doc = doc || document;
    for (var i = 0; i < CONTAINER_SELECTORS.length; i++) {
      var el = doc.querySelector(CONTAINER_SELECTORS[i]);
      if (el) return { container: el, selector: CONTAINER_SELECTORS[i] };
    }
    return null;
  }

  function getItemSel(containerSelector) {
    return ITEM_SELECTOR_MAP[containerSelector] || 'li';
  }

  /** Returns the absolute next page URL or null */
  function findNextUrl(doc) {
    doc = doc || document;
    var candidates = [
      '.pagenav a.pagenav-next',
      'a.pagenav-next',
      'nav.pagination a[rel="next"]',
      '.pagination a[rel="next"]',
      'a[rel="next"]',
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = doc.querySelector(candidates[i]);
      if (!el) continue;

      var raw = (el.getAttribute('href') || '').trim();
      if (!raw || raw === '#') continue;

      try {
        // Already absolute?
        if (/^https?:\/\//i.test(raw)) {
          var u = new URL(raw);
          if (u.href !== window.location.href) return u.href;
          continue;
        }

        // Relative with leading slash -> resolve against origin
        if (raw.startsWith('/')) {
          return new URL(raw, window.location.origin).href;
        }

        // Relative WITHOUT leading slash (e.g. "anime/index/page-2?...")
        // -> always resolve against origin + '/', never against href
        // (prevents path duplication like /anime/index/anime/index/page-2)
        return new URL('/' + raw, window.location.origin).href;

      } catch (e) {
        continue;
      }
    }
    return null;
  }

  function hideElements(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        els[j].style.display = 'none';
      }
    }
  }

  function hidePagination() {
    hideElements([
      '.pagenav', '.pagination', 'nav.pagination',
      '[class*="pagenav"]', '[class*="pagination"]',
    ]);
  }

  // ── Rating Filter ──

  var STAR_SELS = [
    '[class*="star"]',
    '[class*="rating"]',
    '[class*="score"]',
    '.rating', '.score',
  ];

  /**
   * Extracts a precise float rating from an item element.
   * AniSearch: <div class="star0" title="3.66 / 5.00 (1234 votes)">
   */
  function extractRating(itemEl) {
    for (var i = 0; i < STAR_SELS.length; i++) {
      var el = itemEl.querySelector(STAR_SELS[i]);
      if (!el) continue;

      // 1) title attribute (most precise source), 2) textContent fallback
      var title = el.getAttribute('title') || '';
      var txt   = (el.textContent || '').trim();
      var sources = [title, txt];
      for (var s = 0; s < sources.length; s++) {
        var m = sources[s].match(/(\d+(?:[.,]\d+)?)/);
        if (m) {
          var v = parseFloat(m[1].replace(',', '.'));
          if (!isNaN(v) && v > 0) return v;
        }
      }
    }

    // 3) data attributes
    var dataEl = itemEl.querySelector('[data-rating],[data-score],[data-average]');
    if (dataEl) {
      var raw = dataEl.getAttribute('data-rating')
                || dataEl.getAttribute('data-score')
                || dataEl.getAttribute('data-average')
                || '';
      var v2 = parseFloat(raw);
      if (!isNaN(v2) && v2 > 0) return v2;
    }

    return null; // no rating found -> keep item
  }

  function passesRating(itemEl, ratingMin) {
    if (ratingMin === null) return true;
    var r = extractRating(itemEl);
    if (r === null) return true; // unknown -> benefit of the doubt
    return r >= ratingMin;
  }

  // ── Rating Min Parser ──

  async function parseRatingMin() {
    // 1. URL parameter (most precise, e.g. rating_min=3.25)
    var raw = new URLSearchParams(location.search).get('rating_min');
    if (raw !== null) {
      var v = parseFloat(raw);
      if (!isNaN(v)) {
        await TM.storage.saveSetting(STORAGE_KEY_RATING, v);
        return v;
      }
    }

    // 2. Stored value
    var stored = await TM.storage.loadSetting(STORAGE_KEY_RATING, null);
    if (stored !== null) {
      var v2 = parseFloat(stored);
      if (!isNaN(v2)) return v2;
    }

    return null;
  }

  // ── Utilities ──

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ── Item Append (safe for all container types) ──

  function appendItem(container, itemEl) {
    container.appendChild(document.importNode(itemEl, true));
  }

  // ── UI Unlock (remove premium restrictions) ──

  var PREMIUM_TEXTS = new Set([
    'premium only', 'premium-only',
    'nur für premium', 'nur premium',
    'upgrade to premium',
  ]);

  var _limitObserver = null;

  function unlockUI() {
    // Unlock #limit field (if present)
    var limitInput = document.querySelector('#limit');
    if (limitInput) {
      limitInput.removeAttribute('disabled');
      limitInput.removeAttribute('readonly');
      limitInput.style.opacity = '1';
      limitInput.style.cursor  = 'text';

      if (_limitObserver) _limitObserver.disconnect();
      // Custom observer for attribute changes — TM.dom.observeMutations
      // only watches addedNodes, not attribute mutations
      _limitObserver = new MutationObserver(function () {
        limitInput.removeAttribute('disabled');
        limitInput.removeAttribute('readonly');
      });
      _limitObserver.observe(limitInput, { attributes: true });
    }

    // Hide "Premium only" / "Nur für Premium" notices
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

  // ── Loader (visual indicator inside container) ──

  var LOADER_ID = 'as-es-loader';

  function showLoader(container) {
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

  function removeLoader() {
    var ids = [LOADER_ID, LOADER_ID + '-row'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }

  // ── Core: Endless Fetch Loop ──
  // Fetches all available pages and appends items without gaps

  var _currentRunId = 0;

  async function runEndlessLoop(ratingMin, found, runId, statusBar) {
    var container = found.container;
    var selector = found.selector;
    var itemSel = getItemSel(selector);

    // Step 1: Filter current page
    var existingItems = Array.from(container.querySelectorAll(itemSel));
    var filteredCount = 0;

    for (var i = 0; i < existingItems.length; i++) {
      if (!passesRating(existingItems[i], ratingMin)) {
        existingItems[i].style.display = 'none';
        existingItems[i].setAttribute('data-as-hidden', 'rating');
        filteredCount++;
      }
    }

    var visibleOnPage1 = existingItems.length - filteredCount;

    // Hide pagination — we take control
    hidePagination();

    var nextUrl = findNextUrl(document);

    if (!nextUrl) {
      statusBar.setText(
        '✔ Alle Einträge geladen\n  ' + visibleOnPage1 + ' Items' +
        (ratingMin !== null ? '\n  Rating ≥ ' + ratingMin : '')
      );
      return;
    }

    statusBar.setText(
      '⟳ Seite 1 — ' + visibleOnPage1 + ' Items\n  Lade Seite 2…'
    );
    showLoader(container);

    // Step 2: Fetch all subsequent pages
    var currentPage  = 2;
    var totalVisible = visibleOnPage1;
    var totalHidden  = filteredCount;
    var visitedUrls  = new Set([window.location.href]);

    while (nextUrl && currentPage <= MAX_PAGES) {
      // Loop guard: URL already visited?
      if (visitedUrls.has(nextUrl)) {
        log.warn('Loop detected, stopping:', nextUrl);
        break;
      }
      visitedUrls.add(nextUrl);

      log.log('Fetching page', currentPage, '→', nextUrl);

      var fetchedDoc;
      try {
        fetchedDoc = await TM.network.fetchPage(nextUrl, {
          retries: MAX_RETRIES - 1,
          timeout: REQUEST_TIMEOUT_MS
        });
      } catch (err) {
        log.warn('Page ' + currentPage + ' failed after ' + MAX_RETRIES + ' attempts:', err.message);
        statusBar.setText(
          '⚠ Seite ' + currentPage + ' fehlgeschlagen\n  ' + err.message
        );
        removeLoader();
        break;
      }

      // Stale? (user navigated to a different page)
      if (runId !== _currentRunId) {
        removeLoader();
        statusBar.remove();
        return;
      }

      // Extract items from fetched page
      var fetchedFound = findContainer(fetchedDoc);
      if (!fetchedFound) {
        log.warn('Container on page', currentPage, 'not found.');
        break;
      }

      var newItems = Array.from(
        fetchedFound.container.querySelectorAll(getItemSel(fetchedFound.selector))
      );

      if (newItems.length === 0) {
        // Empty page -> truly last page
        break;
      }

      // Apply rating filter and append items
      removeLoader();

      for (var j = 0; j < newItems.length; j++) {
        if (passesRating(newItems[j], ratingMin)) {
          appendItem(container, newItems[j]);
          totalVisible++;
        } else {
          totalHidden++;
        }
      }

      // Read next page from fetched document
      nextUrl = findNextUrl(fetchedDoc);

      statusBar.setText(
        '⟳ Seite ' + currentPage + ' geladen\n' +
        '  Sichtbar: ' + totalVisible + '  (' + totalHidden + ' gefiltert)\n' +
        (nextUrl ? '  Lade Seite ' + (currentPage + 1) + '…' : '  Letzte Seite erreicht')
      );

      if (nextUrl) {
        showLoader(container);
        await sleep(FETCH_DELAY_MS + Math.random() * 400);
        if (runId !== _currentRunId) {
          removeLoader();
          statusBar.remove();
          return;
        }
      }

      currentPage++;
    }

    // Step 3: Completion
    removeLoader();

    var cappedByLimit = currentPage > MAX_PAGES;
    statusBar.setText(
      (cappedByLimit ? '⚠' : '✔') + ' Fertig!' +
      '\n  ' + totalVisible + ' Einträge sichtbar' +
      (totalHidden > 0 ? '\n  ' + totalHidden + ' via Rating-Filter entfernt' : '') +
      (ratingMin !== null ? '\n  Rating ≥ ' + ratingMin : '') +
      '\n  ' + (currentPage - 1) + ' Seiten durchsucht' +
      (cappedByLimit ? '\n  ⚠ Seiten-Limit erreicht!' : '')
    );
  }

  // ── Entry Point ──

  async function main() {
    // Invalidate previous run — loop checks its own runId on each iteration
    var runId = ++_currentRunId;

    var statusBar = TM.ui.createStatusBar({ accentColor: '#6366f1' });
    statusBar.setText('⟳ AniSearch Endless Scroll startet…');

    // Remove UI locks immediately
    unlockUI();
    // Retry after 1.5s in case site JS restores them
    setTimeout(unlockUI, 1500);

    // Determine rating minimum
    var ratingMin = await parseRatingMin();
    log.log('Rating min:', ratingMin || 'no filter');

    // Quick check whether any list exists (before the sleep)
    if (!findContainer(document)) {
      statusBar.setText('✔ UI entsperrt. (Keine Liste erkannt)');
      setTimeout(function () { statusBar.remove(); }, 4000);
      return;
    }

    // Brief wait for site JS to finish rendering, then determine container fresh
    await sleep(250);
    if (runId !== _currentRunId) {
      statusBar.remove();
      return;
    }

    var found = findContainer(document);
    if (!found) {
      statusBar.setText('✔ UI entsperrt. (Keine Liste erkannt)');
      setTimeout(function () { statusBar.remove(); }, 4000);
      return;
    }

    // Main loop
    await runEndlessLoop(ratingMin, found, runId, statusBar);

    // Auto-remove status bar after completion
    setTimeout(function () { statusBar.remove(); }, 8000);
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

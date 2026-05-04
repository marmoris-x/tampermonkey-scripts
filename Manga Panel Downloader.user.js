// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.4.0
// @description  Downloads manga/manhwa panels as ZIP — pipeline download, retry, abort, fast scrolling
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_deleteValue
// @connect      *
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

import { createLogger } from './src/shared/logging-utils.js';
import { findImages, allSrcsOf } from './src/manga-panel-downloader/image-finder.js';
import { processImage } from './src/manga-panel-downloader/image-processor.js';
import { scrollLoad, navigateNext, waitForUrlChange } from './src/manga-panel-downloader/page-navigator.js';
import { buildUI, setScanBtn, addSegmentsToUI, buildZipBlob, triggerDownload } from './src/manga-panel-downloader/ui-panel.js';

var log = createLogger('Manga Panel Downloader');

// ── One-time cleanup of legacy storage keys ───────────────────────────────
GM_deleteValue('mpd-allowed-sites');
GM_deleteValue('mpd-manga-mode');

// ── Session-based activation (no persistent storage) ────────────────────────
window.mpd_enabled = window.mpd_enabled || false;
var downloader = null;

function initDownloader() {
  if (downloader) return;
  downloader = new MangaDownloader();
}

function toggleDownloader() {
  window.mpd_enabled = !window.mpd_enabled;
  if (window.mpd_enabled) {
    initDownloader();
  } else if (downloader) {
    var host = downloader.ui.sidebar.host;
    if (host.parentNode) host.parentNode.removeChild(host);
    downloader = null;
  }
}

GM_registerMenuCommand(
  window.mpd_enabled ? 'Manga Downloader deaktivieren' : 'Manga Downloader aktivieren',
  toggleDownloader
);

if (window.mpd_enabled) {
  initDownloader();
}

// ── Constants ─────────────────────────────────────────────────────────────
var CONCURRENT_DL     = 6;
var MAX_PAGES         = 200;
var NAV_CLICK_WAIT_MS = 50;
var NAV_LOAD_WAIT_MS  = 150;
var NAV_TIMEOUT_MS    = 5000;
var MANGA_POLL_MS     = 50;
var MANGA_MAX_WAIT_MS = 3000;

// ── MangaDownloader class ────────────────────────────────────────────────

function MangaDownloader() {
  this.segments          = [];
  this.errors            = [];
  this.scanning          = false;
  this.aborted           = false;
  this.mangaMode         = window.mpd_mangaMode || false;
  this.scannedUrls       = new Set();
  this.previewRevokeTimer = null;

  // Build UI (Shadow DOM sidebar).
  // All element queries use this.ui.root.querySelector() — never document.getElementById().
  this.ui = buildUI(this.mangaMode);
  this._initUI();
  this._watchUrlChanges();
}

// ── UI event wiring ─────────────────────────────────────────────────────

MangaDownloader.prototype._initUI = function () {
  var self = this;
  self.ui.scanBtn.addEventListener('click', function () {
    if (self.scanning) self._abort();
    else self._scan();
  });
  self.ui.dlBtn.addEventListener('click', function () { self._download(); });
  self.ui.mangaCheck.addEventListener('change', function (e) {
    self.mangaMode = e.target.checked;
    window.mpd_mangaMode = self.mangaMode;
  });
};

// ── URL-change watcher (SPA navigation) ─────────────────────────────────

MangaDownloader.prototype._watchUrlChanges = function () {
  var self = this;
  var lastUrl = location.href;
  function onChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    if (self.scanning) return;
    if (self.segments.length > 0) return;
    self._reset();
  }
  window.addEventListener('popstate', onChange);
  window.addEventListener('hashchange', onChange);
  setInterval(onChange, 1000);
};

MangaDownloader.prototype._reset = function () {
  if (this.scanning) return;
  clearTimeout(this.previewRevokeTimer);
  this.previewRevokeTimer = null;
  this._revokeAllPreviews();
  this.segments = [];
  this.errors = [];
  this.ui.resultsEl.innerHTML = '';
  this.ui.footerEl.textContent = '';
  this.ui.dlBtn.disabled = true;
  this._setStatus('Ready.');
  this._setProgress(0);
};

MangaDownloader.prototype._revokeAllPreviews = function () {
  for (var i = 0; i < this.segments.length; i++) {
    try { URL.revokeObjectURL(this.segments[i].previewUrl); } catch (e) {}
  }
};

// ── UI helpers ──────────────────────────────────────────────────────────

MangaDownloader.prototype._setStatus = function (msg) {
  this.ui.statusEl.textContent = msg;
};

MangaDownloader.prototype._setProgress = function (pct) {
  this.ui.progressEl.style.display = (pct > 0 && pct < 100) ? 'block' : 'none';
  this.ui.progressBar.style.width = pct + '%';
};

// ── Abort ───────────────────────────────────────────────────────────────

MangaDownloader.prototype._abort = function () {
  this.aborted = true;
  this._setStatus('Aborting...');
};

// ── Page URL collection ─────────────────────────────────────────────────

MangaDownloader.prototype._collectPageUrls = function () {
  var self = this;
  var findAndSort = function () {
    var candidates = findImages(document);
    var withY = candidates.map(function (c) {
      return { c: c, y: (c.el.getBoundingClientRect ? c.el.getBoundingClientRect().top : 0) + window.scrollY };
    });
    withY.sort(function (a, b) { return a.y - b.y; });
    var sorted = withY.map(function (w) { return w.c; });

    var fresh = [];
    for (var i = 0; i < sorted.length; i++) {
      var c = sorted[i];
      if (self.scannedUrls.has(c.src)) continue;
      var srcs = allSrcsOf(c.el);
      var seen = false;
      srcs.forEach(function (v) { if (self.scannedUrls.has(v)) seen = true; });
      if (seen) continue;
      self.scannedUrls.add(c.src);
      srcs.forEach(function (v) { self.scannedUrls.add(v); });
      fresh.push(c);
    }
    return fresh;
  };

  if (this.mangaMode) {
    var deadline = Date.now() + MANGA_MAX_WAIT_MS;
    function poll() {
      if (Date.now() >= deadline) return Promise.resolve(findAndSort());
      var imgs = findImages(document);
      if (imgs.length > 0) return Promise.resolve(findAndSort());
      return self._sleep(MANGA_POLL_MS).then(poll);
    }
    return poll();
  } else {
    return scrollLoad().then(findAndSort);
  }
};

// ── Main scan (producer-consumer pipeline) ─────────────────────────────

MangaDownloader.prototype._scan = function () {
  var self = this;
  if (self.scanning) return;

  self.scanning = true;
  self.aborted = false;

  clearTimeout(self.previewRevokeTimer);
  self.previewRevokeTimer = null;
  self._revokeAllPreviews();
  self.segments = [];
  self.errors = [];
  self.scannedUrls.clear();

  var processedEls = document.querySelectorAll('[data-mpd-processed]');
  for (var pe = 0; pe < processedEls.length; pe++) {
    processedEls[pe].removeAttribute('data-mpd-processed');
  }

  self.ui.resultsEl.innerHTML = '';
  self.ui.footerEl.textContent = '';
  self.ui.dlBtn.disabled = true;
  setScanBtn(self.ui.scanBtn, true);
  self._setProgress(0);
  self._setStatus('Starting...');

  var queue        = [];
  var producerDone = false;
  var totalExpected = 0;
  var dlDone       = 0;

  // ── Producer ────────────────────────────────────────────────────
  function producer() {
    var seqNum = 0;
    var page = 1;

    function runProducer() {
      if (self.aborted) return Promise.resolve();

      if (self.mangaMode && page > MAX_PAGES) return Promise.resolve();

      self._setStatus('Page ' + page + ': scanning... (' + totalExpected + ' so far)');

      var prevUrl = location.href;
      return self._collectPageUrls().then(function (found) {
        found.forEach(function (c) { c.num = ++seqNum; });
        queue.push.apply(queue, found);
        totalExpected += found.length;

        self._setStatus('Page ' + page + ' OK — ' + totalExpected + ' panel(s) found');

        if (found.length === 0) {
          self._setStatus('Page ' + page + ': no panels. Finished.');
          return;
        }

        if (!self.mangaMode) return;

        navigateNext();
        return self._sleep(NAV_CLICK_WAIT_MS).then(function () {
          return waitForUrlChange(prevUrl, NAV_TIMEOUT_MS).then(function (changed) {
            if (!changed) return;
            return self._sleep(NAV_LOAD_WAIT_MS).then(function () {
              page++;
              return runProducer();
            });
          });
        });
      });
    }

    return runProducer().then(function () {
      producerDone = true;
    });
  }

  // ── Consumer ────────────────────────────────────────────────────
  function consumer() {
    var running = new Set();
    var allTasks = [];

    function spawn(candidate) {
      var task = (function () {
        return Promise.resolve().then(function () {
          if (self.aborted) return;
          return processImage(
            candidate.src, candidate.num, candidate.el,
            function () { return self.aborted; }
          );
        }).then(function (segs) {
          if (self.aborted || !segs) return;
          segs.forEach(function (seg) { self.segments.push(seg); });
          if (candidate.el) candidate.el.dataset.mpdProcessed = 'true';
        }).catch(function (e) {
          self.errors.push({ src: candidate.src, message: e.message });
          log.warn('Failed:', candidate.src ? candidate.src.slice(0, 80) : '', e.message);
        }).then(function () {
          dlDone++;
          running.delete(task);
          var pct = totalExpected > 0 ? (dlDone / totalExpected) * 100 : 0;
          var errStr = self.errors.length ? ' (' + self.errors.length + ' errors)' : '';
          self._setProgress(pct);
          self._setStatus('Downloading: ' + dlDone + '/' + totalExpected + errStr);
        });
      })();
      running.add(task);
      allTasks.push(task);
    }

    function consumerLoop() {
      if (self.aborted) return Promise.resolve();

      while (queue.length > 0 && running.size < CONCURRENT_DL) {
        spawn(queue.shift());
      }

      if (producerDone && queue.length === 0 && running.size === 0) {
        return Promise.resolve();
      }

      return self._sleep(40).then(consumerLoop);
    }

    return consumerLoop().then(function () {
      if (allTasks.length > 0) {
        // Wait for all to settle, ignoring individual rejections
        return Promise.all(allTasks.map(function (t) {
          return t.catch(function () {});
        }));
      }
    });
  }

  // ── Run phases ────────────────────────────────────────────────
  var phase;
  if (self.mangaMode) {
    phase = producer().then(function () {
      self._setStatus(totalExpected + ' panels found. Downloading...');
      return consumer();
    });
  } else {
    phase = Promise.all([producer(), consumer()]);
  }

  return phase.then(function () {
    self._renderResults();
    self._setProgress(0);
    var errStr = self.errors.length ? ' | ' + self.errors.length + ' errors' : '';
    self.ui.footerEl.textContent = self.segments.length + ' Segmente' + errStr;
    self._setStatus(
      self.aborted
        ? 'Aborted. ' + self.segments.length + ' files loaded.'
        : 'Done. ' + self.segments.length + ' files ready.'
    );
    if (self.segments.length > 0) self.ui.dlBtn.disabled = false;
  }).catch(function (e) {
    self._setStatus('Error: ' + (e && e.message || e));
    log.error(e);
  }).then(function () {
    self.scanning = false;
    setScanBtn(self.ui.scanBtn, false);
  });
};

// ── Render results ────────────────────────────────────────────────────

MangaDownloader.prototype._renderResults = function () {
  this.segments.sort(function (a, b) { return a.filename.localeCompare(b.filename); });
  addSegmentsToUI(this.segments, this.ui.resultsEl);
};

// ── Download ZIP ──────────────────────────────────────────────────────

MangaDownloader.prototype._download = function () {
  var self = this;
  var checkboxes = self.ui.root.querySelectorAll('#mpd-results input[type=checkbox]:checked');
  var checked = [];
  for (var i = 0; i < checkboxes.length; i++) {
    var seg = self.segments[parseInt(checkboxes[i].dataset.idx)];
    if (seg && seg.blob) checked.push(seg);
  }

  if (!checked.length) { self._setStatus('Nothing selected.'); return; }

  self.ui.dlBtn.disabled = true;

  var host = location.hostname;
  var date = new Date().toISOString().slice(0, 10);
  var chapter = location.pathname.replace(/\//g, '_').slice(1, 40) || 'chapter';
  var name = host + '_' + chapter + '_' + date + '.zip';

  var finish = function (zipBlob) {
    triggerDownload(zipBlob, name);
    self.segments.forEach(function (seg) { seg.blob = null; });
    self.ui.dlBtn.disabled = true;
    clearTimeout(self.previewRevokeTimer);
    self.previewRevokeTimer = setTimeout(function () { self._revokeAllPreviews(); }, 30000);
    self._setStatus('Downloaded: ' + name);
  };

  // Attempt 1: build STORE ZIP
  self._setStatus('Building ZIP (' + checked.length + ' files)...');
  buildZipBlob(checked).then(finish).catch(function (e) {
    log.warn('Manual ZIP failed, downloading individually:', e.message);
    // Attempt 2: individual file downloads
    var individual = function (idx) {
      if (idx >= checked.length) {
        self.segments.forEach(function (seg) { seg.blob = null; });
        self.ui.dlBtn.disabled = true;
        clearTimeout(self.previewRevokeTimer);
        self.previewRevokeTimer = setTimeout(function () { self._revokeAllPreviews(); }, 30000);
        self._setStatus(checked.length + ' files downloaded individually.');
        return;
      }
      var seg = checked[idx];
      self._setStatus('Downloading ' + (idx + 1) + '/' + checked.length + ': ' + seg.filename);
      triggerDownload(seg.blob, seg.filename);
      self._sleep(300).then(function () { individual(idx + 1); });
    };
    try {
      individual(0);
    } catch (e2) {
      self._setStatus('Error: ' + e2.message);
      log.error('Download:', e2);
      self.ui.dlBtn.disabled = false;
    }
  });
};

// ── Utility ───────────────────────────────────────────────────────────

MangaDownloader.prototype._sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

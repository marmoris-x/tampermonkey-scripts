// src/manga-panel-downloader/_download-controller.js — MangaDownloader class
// Orchestrates UI, image scanning (producer-consumer), download, and ZIP creation.
// All module dependencies are imported at the top — the entry script only bootstraps.

'use strict';

import { findImages, allSrcsOf } from './_dom.js';
import { processImage } from './_image-processing.js';
import { scrollLoad } from './_scroll-loader.js';
import { harvestPages } from './_manga-mode.js';
import { buildUI, setScanBtn, addSegmentsToUI, triggerDownload } from './_ui.js';
import { buildZipBlob } from './_zip.js';

/* --- Constants --- */

const CONCURRENT_DL = 6;
const MAX_PAGES = 200;
const NAV_CLICK_WAIT_MS = 50;
const NAV_LOAD_WAIT_MS = 150;
const NAV_TIMEOUT_MS = 5000;
const MANGA_POLL_MS = 50;
const MANGA_MAX_WAIT_MS = 3000;

/**
 * Main download controller for Manga Panel Downloader.
 * Manages the full lifecycle: UI, scanning, downloading, and ZIP export.
 */
export class MangaDownloader {
  /**
   * @param {Object} logger - Logger instance from createLogger
   */
  constructor(logger) {
    /** @private */
    this.log = logger;

    /** @private */
    this.segments = [];
    /** @private */
    this.errors = [];
    /** @private */
    this.scanning = false;
    /** @private */
    this.mangaMode = false;
    /** @private */
    this.scannedUrls = new Set();
    /** @private */
    this.previewRevokeTimer = null;

    /** @private @type {AbortController|null} */
    this.abortController = null;

    /** @private */
    this._enabled = false;
    /** @private */
    this._menuId = null;

    /** @private @type {Object|null} lazily built on first toggle */
    this.ui = null;

    // Register menu command immediately — nothing else runs until toggle
    this._registerMenuCommand();
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * No-op — kept for backward compatibility with entry bootstrap.
   * Menu command is already registered in the constructor.
   */
  init() {}

  // ── Menu command ────────────────────────────────────────────────────

  /**
   * Registers (or re-registers) the Tampermonkey menu command with current state label.
   * @private
   */
  _registerMenuCommand() {
    if (this._menuId !== null) {
      /* GM.unregisterMenuCommand not granted — skip unregister */
    }
    const label = this._enabled
      ? 'Manga Downloader deaktivieren'
      : 'Manga Downloader aktivieren';
    this._menuId = GM.registerMenuCommand(label, () => this._toggle());
  }

  /**
   * Builds UI lazily on first enable.
   * @private
   */
  _ensureUI() {
    if (this.ui) return;
    this.ui = buildUI(this.mangaMode);
    this._initUI();
    this._watchUrlChanges();
  }

  /**
   * Toggles the downloader on/off, building UI on first enable.
   * @private
   */
  _toggle() {
    this._enabled = !this._enabled;
    if (this._enabled) {
      this._ensureUI();
      this.ui.sidebar.open();
    } else if (this.ui) {
      this.ui.sidebar.close();
    }
  }

  // ── UI event wiring ─────────────────────────────────────────────────

  /**
   * Wires scan and download button click handlers.
   * @private
   */
  _initUI() {
    this.ui.scanBtn.addEventListener('click', () => {
      if (this.scanning) this._abort();
      else this._scan();
    });
    this.ui.dlBtn.addEventListener('click', () => this._download());
    this.ui.mangaCheck.addEventListener('change', (e) => {
      this.mangaMode = e.target.checked;
    });
  }

  // ── URL-change watcher (SPA navigation) ─────────────────────────────

  /**
   * Watches for SPA URL changes via window.onurlchange where available,
   * falling back to popstate/hashchange events.
   * Resets state on navigation unless a scan is active or segments exist.
   * @private
   */
  _watchUrlChanges() {
    const handler = () => {
      if (this.scanning) return;
      if (this.segments.length > 0) return;
      this._reset();
    };

    // Use TM's SPA API when available (null = granted via @grant)
    if (window.onurlchange === null) {
      window.addEventListener('urlchange', handler);
    } else {
      window.addEventListener('popstate', handler);
      window.addEventListener('hashchange', handler);
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────

  /**
   * Resets all scan state and clears results UI.
   * @private
   */
  _reset() {
    if (this.scanning) return;
    clearTimeout(this.previewRevokeTimer);
    this.previewRevokeTimer = null;
    this._revokeAllPreviews();
    this.segments = [];
    this.errors = [];
    this._clearResults();
    this.ui.dlBtn.disabled = true;
    this._setStatus('Ready.');
    this._setProgress(0);
  }

  /**
   * Clears results list content safely.
   * @private
   */
  _clearResults() {
    const el = this.ui.resultsEl;
    while (el.firstChild) el.removeChild(el.firstChild);
    this.ui.footerEl.textContent = '';
  }

  /**
   * Revokes all preview object URLs to free memory.
   * @private
   */
  _revokeAllPreviews() {
    for (let i = 0; i < this.segments.length; i++) {
      try { URL.revokeObjectURL(this.segments[i].previewUrl); } catch (_) {}
    }
  }

  // ── UI helpers ──────────────────────────────────────────────────────

  /**
   * Updates the status bar text.
   * @param {string} msg
   * @private
   */
  _setStatus(msg) {
    this.ui.statusEl.textContent = msg;
  }

  /**
   * Updates the progress bar width and visibility.
   * @param {number} pct - 0–100 percentage
   * @private
   */
  _setProgress(pct) {
    this.ui.progressEl.style.display = (pct > 0 && pct < 100) ? 'block' : 'none';
    this.ui.progressBar.style.width = pct + '%';
  }

  // ── Abort ───────────────────────────────────────────────────────────

  /**
   * Aborts the current scan operation via AbortController.
   * @private
   */
  _abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this._setStatus('Aborting...');
  }

  // ── Image collection helpers ────────────────────────────────────────

  /**
   * Finds and deduplicates image candidates on the current page,
   * sorted by vertical position.
   * In manga mode, polls briefly for images to appear (SPA lazy-load).
   * @returns {Promise<Array<{el: Element, src: string}>>}
   * @private
   */
  async _collectPageUrls() {
    // In manga mode, wait for images to appear (single-panel pages may
    // take a moment to load the image after navigation)
    if (this.mangaMode) {
      const deadline = Date.now() + MANGA_MAX_WAIT_MS;
      while (Date.now() < deadline) {
        const imgs = findImages(document);
        if (imgs.length > 0) break;
        await this._sleep(MANGA_POLL_MS);
      }
    }

    const candidates = findImages(document);
    const withY = candidates.map(c => ({
      c,
      y: (c.el.getBoundingClientRect ? c.el.getBoundingClientRect().top : 0) + window.scrollY
    }));
    withY.sort((a, b) => a.y - b.y);
    const sorted = withY.map(w => w.c);

    const fresh = [];
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      if (this.scannedUrls.has(c.src)) continue;
      const srcs = allSrcsOf(c.el);
      let seen = false;
      srcs.forEach(v => { if (this.scannedUrls.has(v)) seen = true; });
      if (seen) continue;
      this.scannedUrls.add(c.src);
      srcs.forEach(v => this.scannedUrls.add(v));
      fresh.push(c);
    }
    return fresh;
  }

  // ── Main scan (producer-consumer pipeline) ──────────────────────────

  /**
   * Starts the scan: resets state, runs producer-consumer pipeline.
   * @returns {Promise<void>}
   * @private
   */
  async _scan() {
    if (this.scanning) return;

    this.scanning = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    clearTimeout(this.previewRevokeTimer);
    this.previewRevokeTimer = null;
    this._revokeAllPreviews();
    this.segments = [];
    this.errors = [];
    this.scannedUrls.clear();
    this._clearResults();
    this.ui.dlBtn.disabled = true;
    setScanBtn(this.ui.scanBtn, true);
    this._setProgress(0);
    this._setStatus('Starting...');

    // Clean data-mpd-processed markers from previous runs
    const processedEls = document.querySelectorAll('[data-mpd-processed]');
    for (let pe = 0; pe < processedEls.length; pe++) {
      processedEls[pe].removeAttribute('data-mpd-processed');
    }

    const queue = [];
    let producerDone = false;
    let totalExpected = 0;
    let dlDone = 0;

    // ── Producer ────────────────────────────────────────────────────
    const producer = async () => {
      let seqNum = 0;

      if (this.mangaMode) {
        // Multi-page manga mode via harvestPages generator
        const getPageImages = async () => this._collectPageUrls();

        const harvest = harvestPages({
          getPageImages,
          externalAbort: () => signal.aborted,
        });

        for await (const pageResult of harvest) {
          if (signal.aborted) return;
          if (pageResult.images) {
            pageResult.images.forEach(c => { c.num = ++seqNum; });
            queue.push(...pageResult.images);
            totalExpected += pageResult.images.length;
            this._setStatus(`Page ${pageResult.page} OK — ${totalExpected} panel(s) found`);
          }
          if (pageResult.stop) break;
        }
      } else {
        // Single-page mode: scroll-load current page, then collect
        const scrollGen = scrollLoad(() => signal.aborted);
        for await (const scrollEvent of scrollGen) {
          if (signal.aborted) return;
        }

        const found = await this._collectPageUrls();
        found.forEach(c => { c.num = ++seqNum; });
        queue.push(...found);
        totalExpected += found.length;
        this._setStatus(`Page OK — ${totalExpected} panel(s) found`);
      }

      producerDone = true;
    };

    // ── Consumer ────────────────────────────────────────────────────
    const consumer = async () => {
      const running = new Set();
      const allTasks = [];

      const spawn = (candidate) => {
        const task = (async () => {
          try {
            if (signal.aborted) return;
            const segs = await processImage(
              candidate.src,
              candidate.num,
              candidate.el,
              signal
            );
            if (signal.aborted || !segs) return;
            segs.forEach(seg => { this.segments.push(seg); });
            if (candidate.el) candidate.el.dataset.mpdProcessed = 'true';
          } catch (e) {
            this.errors.push({ src: candidate.src, message: e.message });
            this.log.warn('Failed:', candidate.src ? candidate.src.slice(0, 80) : '', e.message);
          } finally {
            dlDone++;
            running.delete(task);
            const pct = totalExpected > 0 ? (dlDone / totalExpected) * 100 : 0;
            const errStr = this.errors.length ? ` (${this.errors.length} errors)` : '';
            this._setProgress(pct);
            this._setStatus(`Downloading: ${dlDone}/${totalExpected}${errStr}`);
          }
        })();
        running.add(task);
        allTasks.push(task);
      };

      const consumerLoop = async () => {
        while (!signal.aborted) {
          while (queue.length > 0 && running.size < CONCURRENT_DL) {
            spawn(queue.shift());
          }
          if (producerDone && queue.length === 0 && running.size === 0) {
            return;
          }
          await this._sleep(40);
        }
      };

      await consumerLoop();

      // Wait for all in-flight tasks to settle
      if (allTasks.length > 0) {
        await Promise.all(allTasks.map(t => t.catch(() => {})));
      }
    };

    // ── Run phases ─────────────────────────────────────────────────
    try {
      if (this.mangaMode) {
        // Sequential: produce all pages first, then download
        await producer();
        if (!signal.aborted) {
          this._setStatus(`${totalExpected} panels found. Downloading...`);
          await consumer();
        }
      } else {
        // Concurrent: produce and consume simultaneously
        await Promise.all([producer(), consumer()]);
      }

      // ── Render results ───────────────────────────────────────────
      if (!signal.aborted || this.segments.length > 0) {
        this._renderResults();
      }
      this._setProgress(0);

      const errStr = this.errors.length ? ` | ${this.errors.length} errors` : '';
      this.ui.footerEl.textContent = this.segments.length + ' Segmente' + errStr;

      if (signal.aborted) {
        this._setStatus(`Aborted. ${this.segments.length} files loaded.`);
      } else {
        this._setStatus(`Done. ${this.segments.length} files ready.`);
      }
      if (this.segments.length > 0) this.ui.dlBtn.disabled = false;
    } catch (e) {
      this._setStatus('Error: ' + (e && e.message || e));
      this.log.error(e);
    } finally {
      this.scanning = false;
      this.abortController = null;
      setScanBtn(this.ui.scanBtn, false);
    }
  }

  /**
   * Sorts segments and renders them in the results list.
   * @private
   */
  _renderResults() {
    this.segments.sort((a, b) => a.filename.localeCompare(b.filename));
    addSegmentsToUI(this.segments, this.ui.resultsEl);
  }

  // ── Download ZIP ─────────────────────────────────────────────────────

  /**
   * Builds and triggers a ZIP download of selected segments.
   * Falls back to individual file downloads if ZIP creation fails.
   * @private
   */
  _download() {
    const checkboxes = this.ui.root.querySelectorAll('#mpd-results input[type=checkbox]:checked');
    const checked = [];
    for (let i = 0; i < checkboxes.length; i++) {
      const seg = this.segments[parseInt(checkboxes[i].dataset.idx)];
      if (seg && seg.blob) checked.push(seg);
    }

    if (!checked.length) { this._setStatus('Nothing selected.'); return; }

    this.ui.dlBtn.disabled = true;

    const host = location.hostname;
    const date = new Date().toISOString().slice(0, 10);
    const chapter = location.pathname.replace(/\//g, '_').slice(1, 40) || 'chapter';
    const name = `${host}_${chapter}_${date}.zip`;

    const finish = (zipBlob) => {
      triggerDownload(zipBlob, name);
      this.segments.forEach(seg => { seg.blob = null; });
      this.ui.dlBtn.disabled = true;
      clearTimeout(this.previewRevokeTimer);
      this.previewRevokeTimer = setTimeout(() => { this._revokeAllPreviews(); }, 30000);
      this._setStatus('Downloaded: ' + name);
    };

    // Attempt 1: build STORE ZIP
    this._setStatus(`Building ZIP (${checked.length} files)...`);
    buildZipBlob(checked).then(finish).catch((e) => {
      this.log.warn('Manual ZIP failed, downloading individually:', e.message);

      // Attempt 2: individual file downloads
      const individual = (idx) => {
        if (idx >= checked.length) {
          this.segments.forEach(seg => { seg.blob = null; });
          this.ui.dlBtn.disabled = true;
          clearTimeout(this.previewRevokeTimer);
          this.previewRevokeTimer = setTimeout(() => { this._revokeAllPreviews(); }, 30000);
          this._setStatus(`${checked.length} files downloaded individually.`);
          return;
        }
        const seg = checked[idx];
        this._setStatus(`Downloading ${idx + 1}/${checked.length}: ${seg.filename}`);
        triggerDownload(seg.blob, seg.filename);
        this._sleep(300).then(() => individual(idx + 1));
      };
      try {
        individual(0);
      } catch (e2) {
        this._setStatus('Error: ' + e2.message);
        this.log.error('Download:', e2);
        this.ui.dlBtn.disabled = false;
      }
    });
  }

  // ── Utility ─────────────────────────────────────────────────────────

  /**
   * Promise-based sleep.
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

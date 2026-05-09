/**
 * Core extraction engine for NotebookLM Source Export.
 *
 * Architecture:
 *   CONFIG  — Timing, DOM selectors, audio settings
 *   STATE   — Mutable runtime state (cancellation, audio, menu IDs)
 *   SoundFX — Audio feedback (start/error/complete tones via Web Audio API)
 *   KeepAlive — Inaudible audio loop to prevent browser throttling
 *   MenuCommands — GM_registerMenuCommand wrappers
 *   ExtractionLoop — Sequential source iteration: open → convert → collect → close
 *
 * Dependencies: converter.js, zip.js, logger.js (all standalone, no shared/).
 */
'use strict';

import { htmlToMarkdown, resetLiCache } from './converter.js';
import { buildStoreZip, enc } from './zip.js';
import { createLogger } from './logger.js';

export const log = createLogger('NotebookLM Source Export');

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  audio: { enabled: true, vol: 0.15 },
  /** DOM selectors for NotebookLM interface elements.
   *  These may change when Google updates the NotebookLM UI.
   *  Update selectors by inspecting the current NotebookLM DOM.
   *  Reference: HTML ELEMENT OF SOURCE LIST.md (source list structure)
   *  Reference: HTML ELEMENT OF SOURCE CONTENT.md (content panel structure)
   *  Reference: HTML ELEMENT OF PROJECT TITLE.md (notebook title structure)
   */
  selectors: {
    /** Close button — matched by tooltip attribute (language-independent). */
    closeBtn: 'button[mattooltip*="schließen"], button[mattooltip*="close"], button[aria-label*="Close"], button[aria-label*="Schließen"]',
    /** Content panel — scoped to .elements-container to exclude chat content.
     *  Chat messages also use labs-tailwind-doc-viewer > element-list-renderer >
     *  labs-tailwind-structural-element-view-v2. Only the source panel wraps
     *  everything in .elements-container. */
    content: '.elements-container labs-tailwind-structural-element-view-v2',
    /** Notebook title in the header area. */
    notebookTitle: '.title-label-inner.mat-title-large',
    /** Individual source items in the source list. */
    sourceContainer: '.single-source-container',
    /** Source title element within each source container. */
    sourceTitle: '.source-title'
  }
};

export const LOG_LEVEL = { INFO: 'info', SUCCESS: 'success', WARN: 'warn', ERROR: 'error' };

export const TIMING = {
  CONTENT_POLL_ATTEMPTS: 30,
  CONTENT_POLL_INTERVAL_MS: 100,
  CONTENT_STABLE_POLLS: 2,
  CONTENT_GONE_ATTEMPTS: 5,  // reduced from 30 — close is near-instant in most cases
  MIN_CONTENT_LENGTH_CHARS: 20,
  KEEP_ALIVE_VOLUME: 0.001,
  LOG_MAX_ENTRIES: 50,
  AUDIO_NOTE_DELAYS_MS: [0, 100, 200]
};

// ── Runtime State ────────────────────────────────────────────────────────────

export const STATE = {
  isCancelled: false,
  keepAliveAudio: null,
  menuStartId: null,
  menuStopId: null,
  /** @type {number|null} Timer ID for delayed SoundFX.close(), cleared on new run. */
  soundFXCloseTimer: null
};

// ── Audio Feedback Engine ────────────────────────────────────────────────────

const SoundFX = {
  _ctx: null,
  get ctx() {
    if (!this._ctx && CONFIG.audio.enabled) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { log.warn('AudioContext creation failed: ' + e.message); }
    }
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(function () {});
    }
    return this._ctx;
  },

  /**
   * Plays a single oscillator tone.
   * @param {number} freq - Frequency in Hz
   * @param {OscillatorType} type - Waveform type
   * @param {number} duration - Seconds
   * @param {number} [vol] - Volume 0–1, defaults to CONFIG.audio.vol
   */
  playTone: function (freq, type, duration, vol) {
    vol = vol || CONFIG.audio.vol;
    if (!CONFIG.audio.enabled) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (_) { /* AudioContext may be denied by browser */ }
  },

  playStart: function () { this.playTone(600, 'sine', 0.15); },
  playError: function () { this.playTone(150, 'sawtooth', 0.3); },

  /** Three-note ascending completion chime. */
  playComplete: function () {
    const delays = TIMING.AUDIO_NOTE_DELAYS_MS;
    const notes = [
      { freq: 440, duration: 0.6, delay: delays[0] },
      { freq: 554, duration: 0.6, delay: delays[1] },
      { freq: 659, duration: 0.8, delay: delays[2] }
    ];
    notes.forEach((n) => {
      setTimeout(() => { this.playTone(n.freq, 'sine', n.duration); }, n.delay);
    });
  },

  /**
   * Closes and releases the AudioContext to free system audio resources.
   * Safe to call multiple times — no-op if already closed or never opened.
   */
  close: function () {
    if (this._ctx) {
      try { this._ctx.close(); } catch (_) { /* already closed or denied */ }
      this._ctx = null;
    }
  },

  /**
   * Ensures the AudioContext is created and resumed before playing tones.
   * Must be awaited before any playTone call.
   * @returns {Promise<void>}
   */
  ensureReady: async function () {
    if (!CONFIG.audio.enabled) return;
    try {
      const c = this.ctx; // triggers creation if needed
      if (c && c.state === 'suspended') {
        await c.resume();
      }
    } catch (_) { /* AudioContext may be denied by browser */ }
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Promise-based delay.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Waits for a DOM element matching `selector` to appear and its text to stabilize.
 * Uses MutationObserver for instant detection — no timer polling.
 * @param {string} selector - CSS selector for the content element
 * @param {number} timeoutMs - Max time before resolving with null
 * @returns {Promise<Element|null>}
 */
function waitForContent(selector, timeoutMs) {
  return new Promise((resolve) => {
    let stabilityTimer = null;
    let contentObserver = null;
    const rootObserver = new MutationObserver(checkAppear);

    function cleanup() {
      if (contentObserver) { contentObserver.disconnect(); contentObserver = null; }
      if (stabilityTimer) { clearTimeout(stabilityTimer); stabilityTimer = null; }
      rootObserver.disconnect();
    }

    function done(el) { cleanup(); resolve(el || null); }

    function watchStability(el) {
      let lastText = el.textContent;
      contentObserver = new MutationObserver(() => {
        const cur = el.textContent;
        if (cur !== lastText) {
          lastText = cur;
          if (stabilityTimer) clearTimeout(stabilityTimer);
          if (cur.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
            stabilityTimer = setTimeout(() => done(el), 300);
          }
        }
      });
      contentObserver.observe(el, { childList: true, subtree: true, characterData: true });
      // Trigger initial stability timer if content already sufficient
      if (el.textContent.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
        stabilityTimer = setTimeout(() => done(el), 300);
      }
    }

    function checkAppear() {
      const el = document.querySelector(selector);
      if (!el) return;
      // Element found — stop watching for appearance, start stability check
      rootObserver.disconnect();
      watchStability(el);
    }

    // Immediate check (element may already exist)
    checkAppear();

    // Only start observing if element wasn't already found by checkAppear.
    // Otherwise a later DOM mutation could trigger checkAppear again,
    // creating a second contentObserver without disconnecting the first
    // (orphaned observer leak).
    if (!contentObserver) {
      rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Safety timeout
    setTimeout(() => done(null), timeoutMs);
  });
}

/**
 * Waits for a DOM element matching `selector` to be removed from the DOM.
 * Uses MutationObserver for instant detection.
 * @param {string} selector - CSS selector
 * @param {number} timeoutMs - Max wait time
 * @returns {Promise<boolean>} true if element was removed, false on timeout
 */
function waitForContentGone(selector, timeoutMs) {
  return new Promise((resolve) => {
    // Immediate check — content already gone
    if (!document.querySelector(selector)) { resolve(true); return; }

    // Scope observer to the parent of the panel container.
    // Using only .elements-container would miss removal events when the container
    // itself is deleted from the DOM (removal fires on the PARENT, not the removed node).
    let observeTarget = document.querySelector('.elements-container');
    if (observeTarget) {
      observeTarget = observeTarget.parentElement || observeTarget;
    } else {
      const el = document.querySelector(selector);
      observeTarget = (el && el.parentElement) || document.documentElement;
    }

    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(observeTarget, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      // Polling fallback: check removal 5x every 100ms
      let pollAttempts = 0;
      const pollTimer = setInterval(() => {
        if (!document.querySelector(selector)) { clearInterval(pollTimer); resolve(true); return; }
        pollAttempts++;
        if (pollAttempts >= 5) { clearInterval(pollTimer); resolve(false); }
      }, 100);
    }, timeoutMs);
  });
}

/*
// ── Diagnostic Logging (commented out — uncomment to debug selector matching) ──
function diagnosticSnapshot(label) {
  const all = document.querySelectorAll('*');
  const tags = {};
  for (let i = 0; i < all.length; i++) {
    const tag = all[i].tagName.toLowerCase();
    tags[tag] = (tags[tag] || 0) + 1;
  }
  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  log.log('[DIAG] ' + label + ' — total elements: ' + all.length);
  log.log('[DIAG]   top tags: ' + sorted.slice(0, 10).map(t => t[0] + ' (' + t[1] + ')').join(', '));
}
*/

// ── Keep-Alive ───────────────────────────────────────────────────────────────

/** Starts an inaudible audio loop to prevent browser from throttling timers. */
function startKeepAlive() {
  STATE.keepAliveAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA');
  STATE.keepAliveAudio.loop = true;
  STATE.keepAliveAudio.volume = TIMING.KEEP_ALIVE_VOLUME;
  STATE.keepAliveAudio.play().catch(() => {
    log.warn('Keep-alive audio blocked by browser. Background tab may throttle timers.');
  });
}

/** Stops and releases the keep-alive audio element. */
function stopKeepAlive() {
  if (STATE.keepAliveAudio) {
    STATE.keepAliveAudio.pause();
    STATE.keepAliveAudio = null;
  }
}

// ── Menu Commands ────────────────────────────────────────────────────────────

/**
 * Registers the "Start Export" menu command.
 * @param {Function} onStart - Callback to initialize UI and begin export
 */
/**
 * Registers (or updates) the "Start Export" menu command.
 * Uses { id } for in-place updates — no unregister/re-register needed.
 * @param {Function} onStart - Callback when menu item is clicked
 * @param {string} [label] - Optional label override (defaults to 'Start Export')
 */
export function registerMenuStart(onStart, label) {
  const opts = STATE.menuStartId ? { id: STATE.menuStartId } : {};
  STATE.menuStartId = GM_registerMenuCommand(label || 'Start Export', onStart, opts);
}

/**
 * Registers the "Stop Export" menu command.
 * Sets STATE.isCancelled = true to halt the extraction loop.
 */
function registerMenuStop() {
  STATE.menuStopId = GM_registerMenuCommand('Stop Export', () => {
    STATE.isCancelled = true;
    log.warn('Stop requested via menu.');
  });
}

// ── Close Content Panel ──────────────────────────────────────────────────────

/**
 * Attempts to close the source content panel using multiple fallback strategies.
 * Each strategy is verified — if the panel isn't actually closed, falls through
 * to the next strategy.
 * @returns {Promise<boolean>} true if any close strategy succeeded
 */
async function attemptClose() {
  async function tryStrategy(description, actionFn) {
    actionFn();
    const gone = await waitForContentGone(CONFIG.selectors.content, 300);
    if (gone) {
      log.log('[Close] ' + description + ' — panel closed.');
      return true;
    }
    return false;
  }

  // Strategy 1: Icon-based buttons (language-independent, most reliable).
  // Material icons render as text ligatures — check for close/cancel/back icon names.
  // Note: 'collapse_content' and 'expand_content' are intentionally excluded — they
  // collapse the panel instead of closing it, leaving it in the DOM.
  const closeIcons = ['close', 'cancel', 'arrow_back', 'chevron_left'];
  const buttons = document.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    const txt = buttons[i].textContent || '';
    for (let j = 0; j < closeIcons.length; j++) {
      if (txt.indexOf(closeIcons[j]) !== -1) {
        const btn = buttons[i];
        if (await tryStrategy('Strategy 1: icon "' + closeIcons[j] + '"', function () { btn.click(); })) return true;
      }
    }
  }

  // Strategy 2: Tooltip/aria-label based selector (language-dependent)
  const localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
  if (localizedBtn) {
    if (await tryStrategy('Strategy 2: tooltip-based button', function () { localizedBtn.click(); })) return true;
  }

  // Strategy 3: Look for any button inside a panel/dialog header
  const panelHeaderBtns = document.querySelectorAll('[class*="panel"] button, [class*="dialog"] button, [class*="drawer"] button, [class*="sidebar"] button');
  for (let k = 0; k < panelHeaderBtns.length; k++) {
    const btn = panelHeaderBtns[k];
    const aria = btn.getAttribute('aria-label') || '';
    if (aria.toLowerCase().indexOf('close') !== -1 || aria.toLowerCase().indexOf('schließen') !== -1) {
      if (await tryStrategy('Strategy 3: panel header button', function () { btn.click(); })) return true;
    }
  }

  // Strategy 4: Escape key fallback
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  log.log('[Close] Strategy 4: Escape key dispatched.');
  return true;
}

// ── UI Callbacks (set by ui.js) ─────────────────────────────────────────────

/** Hooks for UI feedback during extraction. Set by ui.js before starting. */
export const uiCallbacks = {
  /** @type {Function} addLog(message, level) — append terminal log entry */
  addLog: null,
  /** @type {Function} updateProgress(current, total) — update progress bar */
  updateProgress: null,
  /** @type {Function} setStatusText(text) — update status bar */
  setStatusText: null,
  /** @type {Function} setStartBtnState(disabled, text) — update start button */
  setStartBtnState: null,
  /** @type {Function} setStopBtnVisible(visible) — show/hide stop button */
  setStopBtnVisible: null,
  /** @type {Function} restartUI() — re-initialize the sidebar UI after cleanup */
  restartUI: null
};

// ── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Resets UI and state after extraction completes or is cancelled.
 * Releases AudioContext and keep-alive audio resources.
 */
function cleanupRun() {
  stopKeepAlive();
  // Close AudioContext with delay to let any pending sound effects finish naturally.
  // The longest sound is the completion chime (~1s from start), so 2000ms is safe.
  // This handles all exit paths: no-sources (playError 0.3s), crash (no sound),
  // cancel (no sound), and success (playComplete ~1s chime which plays after cleanupRun
  // in the finally → success path).
  STATE.soundFXCloseTimer = setTimeout(() => {
    SoundFX.close();
    STATE.soundFXCloseTimer = null;
  }, 2000);
  GM_unregisterMenuCommand(STATE.menuStopId);
  registerMenuStart(() => {
    // Re-initialize UI via the callback set by ui.js
    if (typeof uiCallbacks.restartUI === 'function') uiCallbacks.restartUI();
  });
}

// ── Core Extraction Loop ─────────────────────────────────────────────────────

/**
 * Main extraction loop — opens each source, converts to Markdown, collects files,
 * builds a ZIP archive, and triggers download.
 *
 * Process:
 *   1. Disable start button, show stop button
 *   2. Register stop menu command
 *   3. Start keep-alive audio
 *   4. For each source: scroll into view → click → wait for content → convert → close
 *   5. Build ZIP from collected files → download
 *   6. Cleanup (stop keep-alive, re-register start command)
 *
 * Error handling: Each source is processed in a try/catch. A single source
 * failure does not abort the entire extraction.
 */
export async function runProcess() {
  // Clear any pending AudioContext close from a previous run to prevent
  // a stale timeout from closing the new run's AudioContext (race condition
  // when user clicks Retry within 2 seconds of a previous run ending).
  if (STATE.soundFXCloseTimer) {
    clearTimeout(STATE.soundFXCloseTimer);
    STATE.soundFXCloseTimer = null;
    SoundFX.close();
  }
  STATE.isCancelled = false;
  uiCallbacks.updateProgress && uiCallbacks.updateProgress(0, 1);
  uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(true, 'Running...');
  uiCallbacks.setStopBtnVisible && uiCallbacks.setStopBtnVisible(true);

  registerMenuStop();
  // Update start entry to show "Export Running..." with a no-op callback
  registerMenuStart(function noop() {}, 'Export Running...');
  if (navigator.connection?.saveData) {
    log.warn('Save-Data mode active — keep-alive audio disabled.');
    uiCallbacks.addLog && uiCallbacks.addLog('>> Save-Data mode active — keep-alive disabled.', LOG_LEVEL.WARN);
  } else {
    startKeepAlive();
  }
  await SoundFX.ensureReady();
  SoundFX.playStart();

  const totalSources = document.querySelectorAll(CONFIG.selectors.sourceContainer).length;

  if (totalSources === 0) {
    log.error('No sources found.');
    uiCallbacks.addLog && uiCallbacks.addLog('Error: No sources found.', LOG_LEVEL.ERROR);
    SoundFX.playError();
    cleanupRun();
    uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, 'Retry');
    return;
  }

  log.log('Scan complete. Found ' + totalSources + ' items.');
  uiCallbacks.addLog && uiCallbacks.addLog('Scan complete. Found ' + totalSources + ' items.', LOG_LEVEL.SUCCESS);
  log.warn('Keep this tab active — background tabs may throttle timers.');
  uiCallbacks.addLog && uiCallbacks.addLog('Keep this tab active — background tabs may throttle timers.', LOG_LEVEL.WARN);

  const collectedFiles = [];
  const usedNames = new Set();
  let crashed = false;

  function processContent(text, fileName, linesCount, conversionTimeMs, collectedFiles) {
    if (conversionTimeMs > 5000) {
      log.warn('Slow conversion (' + Math.round(conversionTimeMs) + 'ms for ' + linesCount + ' elements)');
    }
    if (text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
      const data = enc.encode(text);
      collectedFiles.push({ name: fileName, data: data });
      log.log('Queued: ' + fileName + ' (' + text.length + ' chars)');
      uiCallbacks.addLog && uiCallbacks.addLog('>> Queued: ' + fileName + ' (' + text.length + ' chars)', LOG_LEVEL.SUCCESS);
    } else {
      log.warn('Content empty for: ' + fileName);
      uiCallbacks.addLog && uiCallbacks.addLog('>> Warning: Content empty', LOG_LEVEL.WARN);
    }
  }

  try {
    for (let i = 0; i < totalSources; i++) {
      if (STATE.isCancelled) break;
      uiCallbacks.updateProgress && uiCallbacks.updateProgress(i + 1, totalSources);

      // Re-query source fresh each iteration — Angular may re-render the list after close
      const source = document.querySelectorAll(CONFIG.selectors.sourceContainer)[i];
      if (!source) {
        log.error('Source ' + (i + 1) + ' not found in DOM. Skipping.');
        uiCallbacks.addLog && uiCallbacks.addLog('Source ' + (i + 1) + ' not found. Skipping.', LOG_LEVEL.ERROR);
        continue;
      }

      const titleEl = source.querySelector(CONFIG.selectors.sourceTitle);
      let fileName = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : 'Source_' + (i + 1))
        .replace(/[\\/:*?"<>|]/g, '_')
        .substring(0, 120)
        .trim();
      if (!fileName.endsWith('.md')) fileName += '.md';
      if (usedNames.has(fileName)) {
        const baseName = fileName.replace(/\.md$/, '');
        let counter = 2;
        while (usedNames.has(baseName + '_' + counter + '.md')) counter++;
        fileName = baseName + '_' + counter + '.md';
      }
      usedNames.add(fileName);

      try {
        log.log('Opening: ' + fileName);
        uiCallbacks.addLog && uiCallbacks.addLog('Opening: ' + fileName, LOG_LEVEL.INFO);
        uiCallbacks.setStatusText && uiCallbacks.setStatusText((i + 1) + '/' + totalSources + ': ' + fileName);

        source.scrollIntoView({ block: 'center' });
        await wait(100);

        // Click the stretched button to open source content panel
        const stretchBtn = source.querySelector('.source-stretched-button');
        if (stretchBtn) stretchBtn.click();
        else (titleEl || source).click();

        // Detect content appearance and stability via MutationObserver
        const contentEl = await waitForContent(CONFIG.selectors.content, 15000);
        if (STATE.isCancelled) { await attemptClose(); continue; }
        if (contentEl) {
          // Scope content extraction to the current source's visible panel only
          const container = contentEl.closest('.elements-container');
          const allInContainer = container
            ? container.querySelectorAll('labs-tailwind-structural-element-view-v2')
            : document.querySelectorAll(CONFIG.selectors.content);
          // Filter to top-level content elements only (exclude nested inside others)
          const lines = Array.from(allInContainer).filter(
            function (el) { return !el.parentElement.closest(CONFIG.selectors.content); }
          );
          const t0 = performance.now();
          const textLines = lines.map(function (l) { return htmlToMarkdown(l); });
          const t1 = performance.now();
          const text = textLines.join('\n\n');

          processContent(text, fileName, lines.length, t1 - t0, collectedFiles);
        } else {
          // Timeout — content not found in main document.
          // Check if it's inside an iframe (website-link sources).
          const panel = document.querySelector('.elements-container');
          const iframe = panel && panel.querySelector('iframe');
          if (iframe) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                const iframeLines = iframeDoc.querySelectorAll('labs-tailwind-structural-element-view-v2');
                if (iframeLines.length > 0) {
                  log.log('Content found in iframe — extracting...');
                  uiCallbacks.addLog && uiCallbacks.addLog('>> Content found in iframe...', LOG_LEVEL.INFO);
                  const lines = Array.from(iframeLines).filter(
                    function (el) { return !el.parentElement.closest('labs-tailwind-structural-element-view-v2'); }
                  );
                  const t0 = performance.now();
                  const textLines = lines.map(function (l) { return htmlToMarkdown(l); });
                  const t1 = performance.now();
                  const text = textLines.join('\n\n');

                  processContent(text, fileName, lines.length, t1 - t0, collectedFiles);
                } else {
                  log.error('No content elements found in iframe for: ' + fileName);
                  uiCallbacks.addLog && uiCallbacks.addLog('>> Timeout: Content load failed (iframe empty)', LOG_LEVEL.ERROR);
                }
              } else {
                log.error('Cannot access iframe document for: ' + fileName);
                uiCallbacks.addLog && uiCallbacks.addLog('>> Timeout: Cannot access iframe document', LOG_LEVEL.ERROR);
              }
            } catch (_) {
              log.error('Cross-origin iframe — cannot extract content for: ' + fileName);
              uiCallbacks.addLog && uiCallbacks.addLog('>> Timeout: Cross-origin iframe, cannot extract', LOG_LEVEL.ERROR);
            }
          } else {
            // No iframe — try generic text extraction from the panel.
            // NotebookLM may render certain sources (error states, links, etc.)
            // without the standard content element structure.
            let fallbackText = '';
            if (panel) {
              const directChildren = panel.children;
              for (let b = 0; b < directChildren.length; b++) {
                const txt = directChildren[b].textContent.trim();
                if (txt.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
                  fallbackText += txt + '\n\n';
                }
              }
            }
            processContent(fallbackText, fileName, 0, 0, collectedFiles);
          }
        }

        await attemptClose();
        resetLiCache();
      } catch (sourceErr) {
        log.error('Error processing source ' + (i + 1) + ': ' + sourceErr.message);
        uiCallbacks.addLog && uiCallbacks.addLog('Error: ' + sourceErr.message, LOG_LEVEL.ERROR);
        // Continue to next source — don't abort the entire extraction
      }
    }
  } catch (e) {
    log.error('Unexpected error: ' + e.message);
    uiCallbacks.addLog && uiCallbacks.addLog('Unexpected error: ' + e.message, LOG_LEVEL.ERROR);
    crashed = true;
  } finally {
    cleanupRun();
  }

  if (crashed) {
    uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, 'Retry');
    return;
  }

  if (STATE.isCancelled) {
    log.warn('Extraction stopped by user.');
    uiCallbacks.addLog && uiCallbacks.addLog('Extraction stopped by user.', LOG_LEVEL.WARN);
    uiCallbacks.setStatusText && uiCallbacks.setStatusText('Stopped');
    uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, 'Start Extraction');
  } else {
    uiCallbacks.updateProgress && uiCallbacks.updateProgress(totalSources, totalSources);

    if (collectedFiles.length > 0) {
      log.log('Building ZIP with ' + collectedFiles.length + ' file(s)...');
      uiCallbacks.addLog && uiCallbacks.addLog('Building ZIP with ' + collectedFiles.length + ' file(s)...', LOG_LEVEL.INFO);

      const notebookTitleEl = document.querySelector(CONFIG.selectors.notebookTitle);
      const notebookTitle = (notebookTitleEl ? notebookTitleEl.textContent.trim() : 'NotebookLM');
      const zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + '.zip';

      let zipBlob;
      try {
        zipBlob = buildStoreZip(collectedFiles);
      } catch (zipErr) {
        log.error('ZIP build failed: ' + zipErr.message);
        uiCallbacks.addLog && uiCallbacks.addLog('ZIP build failed: ' + zipErr.message, LOG_LEVEL.ERROR);
        uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, 'Retry');
        return;
      }

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
      log.log('ZIP downloaded: ' + zipName);
      uiCallbacks.addLog && uiCallbacks.addLog('ZIP downloaded.', LOG_LEVEL.SUCCESS);
    } else {
      log.warn('No files to export.');
      uiCallbacks.addLog && uiCallbacks.addLog('No files to export.', LOG_LEVEL.WARN);
    }

    log.log('Process completed successfully.');
    uiCallbacks.addLog && uiCallbacks.addLog('Process completed successfully.', LOG_LEVEL.SUCCESS);
    uiCallbacks.setStatusText && uiCallbacks.setStatusText('Complete');
    uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, 'Done');
    SoundFX.playComplete();
    // Auto-hide status bar after completion
    setTimeout(() => { if (uiCallbacks.removeStatusBar) uiCallbacks.removeStatusBar(); }, 3000);
  }
}

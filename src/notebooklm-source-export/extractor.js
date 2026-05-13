/**
 * Core extraction engine for NotebookLM Source Export.
 *
 * Architecture:
 *   CONFIG  — Timing, DOM selectors, audio settings
 *   STATE   — Mutable runtime state (cancellation, audio, stop menu id)
 *   SoundFX — Audio feedback (start/error/complete tones via Web Audio API)
 *   KeepAlive — Inaudible audio loop to prevent browser throttling
 *   ExportChat — Bundles chat as .md + .html + .txt into one ZIP
 *   ExportSources — Sequential source iteration: open → convert → collect → ZIP
 *
 * Dependencies: converter.js, zip.js, logger.js, chat-extractor.js
 */
'use strict';

import { htmlToMarkdown, resetLiCache } from './converter.js';
import { buildStoreZip, enc } from './zip.js';
import { createLogger } from './logger.js';
import { extractChatToMarkdown, extractChatMessages, buildChatHTMLDocument, extractChatToText } from './chat-extractor.js';

export const log = createLogger('NotebookLM Source Export');

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  audio: { enabled: true, vol: 0.15 },
  selectors: {
    closeBtn: 'button[mattooltip*="schließen"], button[mattooltip*="close"], button[aria-label*="Close"], button[aria-label*="Schließen"]',
    content: '.elements-container labs-tailwind-structural-element-view-v2',
    notebookTitle: '.title-label-inner.mat-title-large',
    sourceContainer: '.single-source-container',
    sourceTitle: '.source-title'
  }
};

export const LOG_LEVEL = { INFO: 'info', SUCCESS: 'success', WARN: 'warn', ERROR: 'error' };

export const TIMING = {
  CONTENT_POLL_ATTEMPTS: 30,
  CONTENT_POLL_INTERVAL_MS: 100,
  CONTENT_STABLE_POLLS: 2,
  CONTENT_GONE_ATTEMPTS: 5,
  MIN_CONTENT_LENGTH_CHARS: 20,
  KEEP_ALIVE_VOLUME: 0.001,
  LOG_MAX_ENTRIES: 50,
  AUDIO_NOTE_DELAYS_MS: [0, 100, 200]
};

// ── Runtime State ────────────────────────────────────────────────────────────

export const STATE = {
  isCancelled: false,
  keepAliveNode: null,
  menuStopId: null,
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

  playComplete: function () {
    const delays = TIMING.AUDIO_NOTE_DELAYS_MS;
    const notes = [
      { freq: 440, duration: 0.6, delay: delays[0] },
      { freq: 554, duration: 0.6, delay: delays[1] },
      { freq: 659, duration: 0.8, delay: delays[2] }
    ];
    notes.forEach(function (n) {
      setTimeout(function () { SoundFX.playTone(n.freq, 'sine', n.duration); }, n.delay);
    });
  },

  close: function () {
    if (this._ctx) {
      try { this._ctx.close(); } catch (_) { /* already closed or denied */ }
      this._ctx = null;
    }
  },

  ensureReady: async function () {
    if (!CONFIG.audio.enabled) return;
    try {
      const c = this.ctx;
      if (c && c.state === 'suspended') {
        await c.resume();
      }
    } catch (_) { /* AudioContext may be denied by browser */ }
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function wait(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function waitForContent(selector, timeoutMs) {
  return new Promise(function (resolve) {
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
      contentObserver = new MutationObserver(function () {
        const cur = el.textContent;
        if (cur !== lastText) {
          lastText = cur;
          if (stabilityTimer) clearTimeout(stabilityTimer);
          if (cur.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
            stabilityTimer = setTimeout(function () { done(el); }, 300);
          }
        }
      });
      contentObserver.observe(el, { childList: true, subtree: true, characterData: true });
      if (el.textContent.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
        stabilityTimer = setTimeout(function () { done(el); }, 300);
      }
    }

    function checkAppear() {
      const el = document.querySelector(selector);
      if (!el) return;
      rootObserver.disconnect();
      watchStability(el);
    }

    checkAppear();

    if (!contentObserver) {
      rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    setTimeout(function () { done(null); }, timeoutMs);
  });
}

function waitForContentGone(selector, timeoutMs) {
  return new Promise(function (resolve) {
    if (!document.querySelector(selector)) { resolve(true); return; }

    let observeTarget = document.querySelector('.elements-container');
    if (observeTarget) {
      observeTarget = observeTarget.parentElement || observeTarget;
    } else {
      const el = document.querySelector(selector);
      observeTarget = (el && el.parentElement) || document.documentElement;
    }

    const observer = new MutationObserver(function () {
      if (!document.querySelector(selector)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(observeTarget, { childList: true, subtree: true });

    setTimeout(function () {
      observer.disconnect();
      let pollAttempts = 0;
      const pollTimer = setInterval(function () {
        if (!document.querySelector(selector)) { clearInterval(pollTimer); resolve(true); return; }
        pollAttempts++;
        if (pollAttempts >= 5) { clearInterval(pollTimer); resolve(false); }
      }, 100);
    }, timeoutMs);
  });
}

// ── Keep-Alive ───────────────────────────────────────────────────────────────

function startKeepAlive() {
  try {
    var ctx = SoundFX.ctx;
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    gain.gain.value = 0.000001;
    osc.type = 'sine';
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    STATE.keepAliveNode = { osc: osc, gain: gain };
  } catch (e) {
    log.warn('Keep-alive audio failed: ' + e.message);
  }
}

function stopKeepAlive() {
  if (STATE.keepAliveNode) {
    try { STATE.keepAliveNode.osc.stop(); } catch (_) {}
    try { STATE.keepAliveNode.gain.disconnect(); } catch (_) {}
    STATE.keepAliveNode = null;
  }
}

// ── Close Content Panel ──────────────────────────────────────────────────────

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

  const localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
  if (localizedBtn) {
    if (await tryStrategy('Strategy 2: tooltip-based button', function () { localizedBtn.click(); })) return true;
  }

  const panelHeaderBtns = document.querySelectorAll('[class*="panel"] button, [class*="dialog"] button, [class*="drawer"] button, [class*="sidebar"] button');
  for (let k = 0; k < panelHeaderBtns.length; k++) {
    const btn = panelHeaderBtns[k];
    const aria = btn.getAttribute('aria-label') || '';
    if (aria.toLowerCase().indexOf('close') !== -1 || aria.toLowerCase().indexOf('schließen') !== -1) {
      if (await tryStrategy('Strategy 3: panel header button', function () { btn.click(); })) return true;
    }
  }

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  log.log('[Close] Strategy 4: Escape key dispatched.');
  return true;
}

// ── Download Helper ──────────────────────────────────────────────────────────

function downloadZip(blob, name) {
  try {
    GM_download({ url: blob, name: name, saveAs: true });
  } catch (fallbackErr) {
    log.warn('Direct Blob download failed, using createObjectURL: ' + fallbackErr.message);
    try {
      const url = URL.createObjectURL(blob);
      GM_download({ url: url, name: name, saveAs: true });
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    } catch (e) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 2000);
    }
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

function cleanupRun() {
  stopKeepAlive();
  STATE.soundFXCloseTimer = setTimeout(function () {
    SoundFX.close();
    STATE.soundFXCloseTimer = null;
  }, 2000);
  if (STATE.menuStopId != null) {
    try { GM_unregisterMenuCommand(STATE.menuStopId); } catch (_) {}
    STATE.menuStopId = null;
  }
}

// ── Chat Export ──────────────────────────────────────────────────────────────

/**
 * Exports the current notebook's chat as a ZIP containing
 * chat.md (markdown), chat.html (styled), and chat.txt (plain text).
 *
 * @param {{
 *   onStatus?: (text: string) => void,
 *   onComplete?: (message: string) => void,
 *   onError?: (message: string) => void
 * }} options
 */
export async function exportChat(options) {
  const onStatus = options.onStatus || function () {};
  const onComplete = options.onComplete || function () {};
  const onError = options.onError || function () {};

  try {
    onStatus('Extracting chat messages...');

    const markdown = extractChatToMarkdown(htmlToMarkdown);
    const messagesData = extractChatMessages();

    if (!markdown && !messagesData) {
      onError('No chat messages found.');
      return;
    }

    let html = '';
    let text = '';
    if (messagesData) {
      html = buildChatHTMLDocument(messagesData, {});
      text = extractChatToText();
    }

    const files = [];
    if (markdown) files.push({ name: 'chat.md', data: enc.encode(markdown) });
    if (html) files.push({ name: 'chat.html', data: enc.encode(html) });
    if (text) files.push({ name: 'chat.txt', data: enc.encode(text) });

    if (files.length === 0) {
      onError('No chat messages found.');
      return;
    }

    onStatus('Building ZIP archive...');

    const title = messagesData ? messagesData.notebookTitle : 'NotebookLM Chat';
    const zipName = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + ' - chat.zip';

    const zipBlob = buildStoreZip(files);
    downloadZip(zipBlob, zipName);

    log.log('Chat ZIP downloaded: ' + zipName);
    onComplete('Chat export complete!');
  } catch (err) {
    log.error('Chat export failed: ' + err.message);
    onError('Chat export failed: ' + err.message);
  }
}

// ── Sources Export ───────────────────────────────────────────────────────────

/**
 * Exports all notebook sources as markdown files in a ZIP archive.
 * Sequential extraction: open each source → convert → collect → close → ZIP.
 *
 * @param {{
 *   onProgress?: (current: number, total: number, filename?: string) => void,
 *   onComplete?: (message: string) => void,
 *   onError?: (message: string) => void,
 *   onCancelled?: (message: string) => void
 * }} options
 */
export async function exportSources(options) {
  const onProgress = options.onProgress || function () {};
  const onComplete = options.onComplete || function () {};
  const onError = options.onError || function () {};
  const onCancelled = options.onCancelled || function () {};

  if (STATE.soundFXCloseTimer) {
    clearTimeout(STATE.soundFXCloseTimer);
    STATE.soundFXCloseTimer = null;
    SoundFX.close();
  }
  STATE.isCancelled = false;
  onProgress(0, 1, '');

  // Register stop menu command
  STATE.menuStopId = GM_registerMenuCommand('Stop Export', function () {
    STATE.isCancelled = true;
    log.warn('Stop requested via menu.');
  });

  if (navigator.connection && navigator.connection.saveData) {
    log.warn('Save-Data mode active — keep-alive audio disabled.');
  } else {
    startKeepAlive();
  }
  await SoundFX.ensureReady();
  SoundFX.playStart();

  const totalSources = document.querySelectorAll(CONFIG.selectors.sourceContainer).length;

  if (totalSources === 0) {
    log.error('No sources found.');
    SoundFX.playError();
    cleanupRun();
    onError('No sources found.');
    return;
  }

  log.log('Scan complete. Found ' + totalSources + ' items.');
  log.warn('Keep this tab active — background tabs may throttle timers.');

  const collectedFiles = [];
  const usedNames = new Set();
  let crashed = false;

  function processContent(text, fileName, linesCount, conversionTimeMs) {
    if (conversionTimeMs > 5000) {
      log.warn('Slow conversion (' + Math.round(conversionTimeMs) + 'ms for ' + linesCount + ' elements)');
    }
    if (text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
      const data = enc.encode(text);
      collectedFiles.push({ name: fileName, data: data });
      log.log('Queued: ' + fileName + ' (' + text.length + ' chars)');
    } else {
      log.warn('Content empty for: ' + fileName);
    }
  }

  try {
    for (let i = 0; i < totalSources; i++) {
      if (STATE.isCancelled) break;
      onProgress(i + 1, totalSources, '');

      const source = document.querySelectorAll(CONFIG.selectors.sourceContainer)[i];
      if (!source) {
        log.error('Source ' + (i + 1) + ' not found in DOM. Skipping.');
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
        onProgress(i + 1, totalSources, fileName);

        source.scrollIntoView({ block: 'center' });
        await wait(100);

        const stretchBtn = source.querySelector('.source-stretched-button');
        if (stretchBtn) stretchBtn.click();
        else (titleEl || source).click();

        const contentEl = await waitForContent(CONFIG.selectors.content, 15000);
        if (STATE.isCancelled) { await attemptClose(); continue; }
        if (contentEl) {
          const container = contentEl.closest('.elements-container');
          const allInContainer = container
            ? container.querySelectorAll('labs-tailwind-structural-element-view-v2')
            : document.querySelectorAll(CONFIG.selectors.content);
          const lines = Array.from(allInContainer).filter(
            function (el) { return !el.parentElement.closest(CONFIG.selectors.content); }
          );
          const t0 = performance.now();
          const textLines = lines.map(function (l) { return htmlToMarkdown(l); });
          const t1 = performance.now();
          const text = textLines.join('\n\n');

          processContent(text, fileName, lines.length, t1 - t0);
        } else {
          const panel = document.querySelector('.elements-container');
          const iframe = panel && panel.querySelector('iframe');
          if (iframe) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                const iframeLines = iframeDoc.querySelectorAll('labs-tailwind-structural-element-view-v2');
                if (iframeLines.length > 0) {
                  log.log('Content found in iframe — extracting...');
                  const lines = Array.from(iframeLines).filter(
                    function (el) { return !el.parentElement.closest('labs-tailwind-structural-element-view-v2'); }
                  );
                  const t0 = performance.now();
                  const textLines = lines.map(function (l) { return htmlToMarkdown(l); });
                  const t1 = performance.now();
                  const text = textLines.join('\n\n');

                  processContent(text, fileName, lines.length, t1 - t0);
                } else {
                  log.error('No content elements found in iframe for: ' + fileName);
                }
              } else {
                log.error('Cannot access iframe document for: ' + fileName);
              }
            } catch (_) {
              log.error('Cross-origin iframe — cannot extract content for: ' + fileName);
            }
          } else {
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
            processContent(fallbackText, fileName, 0, 0);
          }
        }

        await attemptClose();
        resetLiCache();
      } catch (sourceErr) {
        log.error('Error processing source ' + (i + 1) + ': ' + sourceErr.message);
      }
    }
  } catch (e) {
    log.error('Unexpected error: ' + e.message);
    crashed = true;
  } finally {
    cleanupRun();
  }

  if (crashed) {
    onError('An unexpected error occurred.');
    return;
  }

  if (STATE.isCancelled) {
    log.warn('Extraction stopped by user.');
    onCancelled('Export stopped.');
    return;
  }

  onProgress(totalSources, totalSources, '');

  if (collectedFiles.length > 0) {
    log.log('Building ZIP with ' + collectedFiles.length + ' file(s)...');

    const notebookTitleEl = document.querySelector(CONFIG.selectors.notebookTitle);
    const notebookTitle = (notebookTitleEl ? notebookTitleEl.textContent.trim() : 'NotebookLM');
    const zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + '.zip';

    let zipBlob;
    try {
      zipBlob = buildStoreZip(collectedFiles);
    } catch (zipErr) {
      log.error('ZIP build failed: ' + zipErr.message);
      onError('ZIP build failed.');
      return;
    }

    downloadZip(zipBlob, zipName);
    log.log('ZIP downloaded: ' + zipName);

    log.log('Process completed successfully.');
    SoundFX.playComplete();

    try {
      GM_notification({
        title: 'NotebookLM Source Export',
        text: 'Exported ' + collectedFiles.length + ' source' + (collectedFiles.length !== 1 ? 's' : '') + ' successfully.',
        timeout: 5000
      });
    } catch (_) { /* notification may not be supported */ }

    onComplete('Exported ' + collectedFiles.length + ' source' + (collectedFiles.length !== 1 ? 's' : '') + '.');
  } else {
    log.warn('No files to export.');
    onError('No files to export.');
  }
}

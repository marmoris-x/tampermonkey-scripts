// src/notebooklm-source-export/extractor.js — Core extraction process, close, keep-alive, menus
// Provides: runProcess, attemptClose, startKeepAlive, stopKeepAlive,
//           cleanupRun, registerMenuCommands, wait

import { createLogger } from '../shared/logging-utils.js';
import { htmlToMarkdown } from '../shared/markdown-converter.js';
import { buildStoreZip } from '../shared/zip-builder.js';
import { CONFIG, TIMING, STATE, LOG_LEVEL, ui, SoundFX, initUI, addLog, updateProgress } from './ui-panel.js';

var log = createLogger('NotebookLM Source Export');

// ── Helpers ──

/**
 * Promise-based delay.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

// ── Keep Alive ──

/** Starts an inaudible audio loop to prevent browser throttling. */
export function startKeepAlive() {
  STATE.keepAliveAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA');
  STATE.keepAliveAudio.loop = true;
  STATE.keepAliveAudio.volume = TIMING.KEEP_ALIVE_VOLUME;
  STATE.keepAliveAudio.play().catch(function () {
    log.warn('Keep-alive audio blocked by browser. Tab may throttle if left in background.');
    addLog('Keep-alive audio blocked by browser. Tab may throttle if left in background.', LOG_LEVEL.WARN);
  });
}

/** Stops the keep-alive audio. */
export function stopKeepAlive() {
  if (STATE.keepAliveAudio) {
    STATE.keepAliveAudio.pause();
    STATE.keepAliveAudio = null;
  }
}

// ── Menu Commands ──

/**
 * Registers the "Start Export" Tampermonkey menu command.
 * Creates sidebar UI on click.
 */
export function registerMenuCommands() {
  STATE.menuStartId = GM_registerMenuCommand('Start Export', function () {
    initUI();
  });
}

/**
 * Registers the "Stop Export" menu command.
 */
function registerMenuStop() {
  STATE.menuStopId = GM_registerMenuCommand('Stop Export', function () {
    STATE.isCancelled = true;
    log.warn('Stop requested via menu.');
    addLog('Stop requested via menu.', LOG_LEVEL.WARN);
  });
}

// ── Cleanup ──

/**
 * Cleans up after a run completes or is cancelled.
 * @param {HTMLElement} startBtn - The Start Extraction button
 */
export function cleanupRun(startBtn) {
  stopKeepAlive();
  if (ui.stopBtn) ui.stopBtn.style.display = 'none';
  GM_unregisterMenuCommand(STATE.menuStopId);
  // Re-register the start command so user can restart
  registerMenuCommands();
  if (startBtn) startBtn.disabled = false;
}

// ── Close Content Panel ──

/**
 * Attempts to close the source content panel via multiple strategies.
 * 1. Icon-based close button (language-independent)
 * 2. Locale-specific tooltip button
 * 3. Escape key fallback
 */
export function attemptClose() {
  // Icon-based close button (language-independent)
  var buttons = document.querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].textContent.indexOf('collapse_content') !== -1) {
      buttons[i].click();
      return;
    }
  }
  // Locale-specific tooltip
  var localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
  if (localizedBtn) {
    localizedBtn.click();
    return;
  }
  // Escape key fallback
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

// ── Core Extraction Process ──

/**
 * Main extraction loop — opens each source, converts to markdown, collects files,
 * then builds and downloads a ZIP archive.
 * @param {HTMLElement} startBtn - The Start Extraction button
 */
export async function runProcess(startBtn) {
  STATE.isCancelled = false;
  updateProgress(0, 1);
  startBtn.disabled = true;
  startBtn.textContent = 'Running...';
  ui.stopBtn.style.display = 'block';

  GM_unregisterMenuCommand(STATE.menuStartId);
  registerMenuStop();

  startKeepAlive();
  SoundFX.playStart();

  var totalSources = document.querySelectorAll('.single-source-container').length;

  if (totalSources === 0) {
    log.error('No sources found.');
    addLog('Error: No sources found.', LOG_LEVEL.ERROR);
    SoundFX.playError();
    cleanupRun(startBtn);
    startBtn.textContent = 'Retry';
    return;
  }

  log.log('Scan complete. Found ' + totalSources + ' items.');
  addLog('Scan complete. Found ' + totalSources + ' items.', LOG_LEVEL.SUCCESS);
  log.warn('Keep this tab active — background tabs may throttle timers.');
  addLog('Keep this tab active — background tabs may throttle timers.', LOG_LEVEL.WARN);

  var collectedFiles = [];
  var crashed = false;

  try {
    for (var i = 0; i < totalSources; i++) {
      if (STATE.isCancelled) break;
      updateProgress(i + 1, totalSources);

      var source = document.querySelectorAll('.single-source-container')[i];
      if (!source) {
        log.error('Source index ' + (i + 1) + ' not found. Skipping.');
        addLog('Source index ' + (i + 1) + ' not found. Skipping.', LOG_LEVEL.ERROR);
        continue;
      }

      var titleEl = source.querySelector('.source-title');
      var fileName = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : 'Source_' + (i + 1))
        .replace(/[\\/:*?"<>|]/g, '_')
        .substring(0, 120)
        .trim();
      if (fileName.indexOf('.md') !== fileName.length - 3) fileName += '.md';

      log.log('Opening: ' + fileName);
      addLog('Opening: ' + fileName, LOG_LEVEL.INFO);
      if (ui.statusBar) ui.statusBar.setText((i + 1) + '/' + totalSources + ': ' + fileName);

      source.scrollIntoView({ block: 'center' });
      await wait(100);
      (titleEl || source).click();

      // Wait for content panel to appear
      var found = false;
      for (var a = 0; a < TIMING.CONTENT_POLL_ATTEMPTS; a++) {
        await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
        if (document.querySelector(CONFIG.selectors.content)) {
          found = true;
          break;
        }
      }

      if (found) {
        await wait(TIMING.CONTENT_RENDER_DELAY_MS);
        var allContent = document.querySelectorAll(CONFIG.selectors.content);
        var lines = Array.from(allContent).filter(
          function (el) { return !el.parentElement.closest(CONFIG.selectors.content); }
        );
        var textLines = lines.map(function (l) { return htmlToMarkdown(l); });
        var text = textLines.join('\n\n');

        if (text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
          collectedFiles.push({ name: fileName, data: text });
          log.log('Queued: ' + fileName + ' (' + text.length + ' chars)');
          addLog('>> Queued: ' + fileName + ' (' + text.length + ' chars)', LOG_LEVEL.SUCCESS);
        } else {
          log.warn('Content empty for: ' + fileName);
          addLog('>> Warning: Content empty', LOG_LEVEL.WARN);
        }
      } else {
        log.error('Timeout loading content for: ' + fileName);
        addLog('>> Timeout: Content load failed', LOG_LEVEL.ERROR);
      }

      attemptClose();
      // Wait for content to fully leave the DOM
      for (var b = 0; b < TIMING.CONTENT_GONE_ATTEMPTS; b++) {
        await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
        if (!document.querySelector(CONFIG.selectors.content)) break;
      }
    }
  } catch (e) {
    log.error('Unexpected error: ' + e.message);
    addLog('Unexpected error: ' + e.message, LOG_LEVEL.ERROR);
    startBtn.textContent = 'Retry';
    crashed = true;
  } finally {
    cleanupRun(startBtn);
  }

  if (crashed) return;

  if (STATE.isCancelled) {
    log.warn('Extraction stopped by user.');
    addLog('Extraction stopped by user.', LOG_LEVEL.WARN);
    if (ui.statusBar) ui.statusBar.setText('Stopped');
    startBtn.textContent = 'Start Extraction';
  } else {
    updateProgress(totalSources, totalSources);

    if (collectedFiles.length > 0) {
      log.log('Building ZIP with ' + collectedFiles.length + ' file(s)...');
      addLog('Building ZIP with ' + collectedFiles.length + ' file(s)...', LOG_LEVEL.INFO);

      var notebookTitleEl = document.querySelector(CONFIG.selectors.notebookTitle);
      var notebookTitle = (notebookTitleEl ? notebookTitleEl.textContent.trim() : 'NotebookLM');
      var zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + '.zip';

      var zipBlob;
      try {
        var converted = collectedFiles.map(function (f) {
          return { name: f.name, data: new TextEncoder().encode(f.data) };
        });
        var zipBytes = buildStoreZip(converted);
        zipBlob = new Blob([zipBytes], { type: 'application/zip' });
      } catch (e) {
        log.error('ZIP build failed: ' + e.message);
        addLog('ZIP build failed: ' + e.message, LOG_LEVEL.ERROR);
        startBtn.textContent = 'Retry';
        return;
      }

      var url = URL.createObjectURL(zipBlob);
      var a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 2000);
      log.log('ZIP downloaded: ' + zipName);
      addLog('ZIP downloaded.', LOG_LEVEL.SUCCESS);
    } else {
      log.warn('No files to export.');
      addLog('No files to export.', LOG_LEVEL.WARN);
    }

    log.log('Process completed successfully.');
    addLog('Process completed successfully.', LOG_LEVEL.SUCCESS);
    if (ui.statusBar) ui.statusBar.setText('Complete');
    startBtn.textContent = 'Done';
    SoundFX.playComplete();
  }
}

// src/notebooklm-source-export/extractor.js — Core extraction process, close, keep-alive, menus
// Provides: runProcess, attemptClose, startKeepAlive, stopKeepAlive,
//           cleanupRun, registerMenuCommands, wait
// Consumers: NotebookLM Source Export (entry orchestrator, ui-panel)
(function () {
  'use strict';

  var _NLM = globalThis.__NLM__ = globalThis.__NLM__ || {};
  var log = TM.createLogger('NotebookLM Source Export');

  // ── Helpers ──

  /**
   * Promise-based delay.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _NLM.wait = function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  };

  // ── Keep Alive ──

  /** Starts an inaudible audio loop to prevent browser throttling. */
  _NLM.startKeepAlive = function startKeepAlive() {
    _NLM.STATE.keepAliveAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA');
    _NLM.STATE.keepAliveAudio.loop = true;
    _NLM.STATE.keepAliveAudio.volume = _NLM.TIMING.KEEP_ALIVE_VOLUME;
    _NLM.STATE.keepAliveAudio.play().catch(function () {
      log.warn('Keep-alive audio blocked by browser. Tab may throttle if left in background.');
      _NLM.addLog('Keep-alive audio blocked by browser. Tab may throttle if left in background.', _NLM.LOG_LEVEL.WARN);
    });
  };

  /** Stops the keep-alive audio. */
  _NLM.stopKeepAlive = function stopKeepAlive() {
    if (_NLM.STATE.keepAliveAudio) {
      _NLM.STATE.keepAliveAudio.pause();
      _NLM.STATE.keepAliveAudio = null;
    }
  };

  // ── Menu Commands ──

  /**
   * Registers the "Start Export" Tampermonkey menu command.
   * Creates sidebar UI on click.
   */
  _NLM.registerMenuCommands = function registerMenuCommands() {
    _NLM.STATE.menuStartId = GM_registerMenuCommand('Start Export', function () {
      _NLM.initUI();
    });
  };

  /**
   * Registers the "Stop Export" menu command.
   */
  function registerMenuStop() {
    _NLM.STATE.menuStopId = GM_registerMenuCommand('Stop Export', function () {
      _NLM.STATE.isCancelled = true;
      log.warn('Stop requested via menu.');
      _NLM.addLog('Stop requested via menu.', _NLM.LOG_LEVEL.WARN);
    });
  }

  // ── Cleanup ──

  /**
   * Cleans up after a run completes or is cancelled.
   * @param {HTMLElement} startBtn - The Start Extraction button
   */
  _NLM.cleanupRun = function cleanupRun(startBtn) {
    _NLM.stopKeepAlive();
    if (_NLM.ui.stopBtn) _NLM.ui.stopBtn.style.display = 'none';
    GM_unregisterMenuCommand(_NLM.STATE.menuStopId);
    // Re-register the start command so user can restart
    _NLM.registerMenuCommands();
    if (startBtn) startBtn.disabled = false;
  };

  // ── Close Content Panel ──

  /**
   * Attempts to close the source content panel via multiple strategies.
   * 1. Icon-based close button (language-independent)
   * 2. Locale-specific tooltip button
   * 3. Escape key fallback
   */
  _NLM.attemptClose = function attemptClose() {
    // Icon-based close button (language-independent)
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent.indexOf('collapse_content') !== -1) {
        buttons[i].click();
        return;
      }
    }
    // Locale-specific tooltip
    var localizedBtn = document.querySelector(_NLM.CONFIG.selectors.closeBtn);
    if (localizedBtn) {
      localizedBtn.click();
      return;
    }
    // Escape key fallback
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  };

  // ── Core Extraction Process ──

  /**
   * Main extraction loop — opens each source, converts to markdown, collects files,
   * then builds and downloads a ZIP archive.
   * @param {HTMLElement} startBtn - The Start Extraction button
   */
  _NLM.runProcess = async function runProcess(startBtn) {
    _NLM.STATE.isCancelled = false;
    _NLM.updateProgress(0, 1);
    startBtn.disabled = true;
    startBtn.textContent = 'Running...';
    _NLM.ui.stopBtn.style.display = 'block';

    GM_unregisterMenuCommand(_NLM.STATE.menuStartId);
    registerMenuStop();

    _NLM.startKeepAlive();
    _NLM.SoundFX.playStart();

    var totalSources = document.querySelectorAll('.single-source-container').length;

    if (totalSources === 0) {
      log.error('No sources found.');
      _NLM.addLog('Error: No sources found.', _NLM.LOG_LEVEL.ERROR);
      _NLM.SoundFX.playError();
      _NLM.cleanupRun(startBtn);
      startBtn.textContent = 'Retry';
      return;
    }

    log.log('Scan complete. Found ' + totalSources + ' items.');
    _NLM.addLog('Scan complete. Found ' + totalSources + ' items.', _NLM.LOG_LEVEL.SUCCESS);
    log.warn('Keep this tab active — background tabs may throttle timers.');
    _NLM.addLog('Keep this tab active — background tabs may throttle timers.', _NLM.LOG_LEVEL.WARN);

    var collectedFiles = [];
    var crashed = false;

    try {
      for (var i = 0; i < totalSources; i++) {
        if (_NLM.STATE.isCancelled) break;
        _NLM.updateProgress(i + 1, totalSources);

        var source = document.querySelectorAll('.single-source-container')[i];
        if (!source) {
          log.error('Source index ' + (i + 1) + ' not found. Skipping.');
          _NLM.addLog('Source index ' + (i + 1) + ' not found. Skipping.', _NLM.LOG_LEVEL.ERROR);
          continue;
        }

        var titleEl = source.querySelector('.source-title');
        var fileName = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : 'Source_' + (i + 1))
          .replace(/[\\/:*?"<>|]/g, '_')
          .substring(0, 120)
          .trim();
        if (fileName.indexOf('.md') !== fileName.length - 3) fileName += '.md';

        log.log('Opening: ' + fileName);
        _NLM.addLog('Opening: ' + fileName, _NLM.LOG_LEVEL.INFO);
        if (_NLM.ui.statusBar) _NLM.ui.statusBar.setText((i + 1) + '/' + totalSources + ': ' + fileName);

        source.scrollIntoView({ block: 'center' });
        await _NLM.wait(100);
        (titleEl || source).click();

        // Wait for content panel to appear
        var found = false;
        for (var a = 0; a < _NLM.TIMING.CONTENT_POLL_ATTEMPTS; a++) {
          await _NLM.wait(_NLM.TIMING.CONTENT_POLL_INTERVAL_MS);
          if (document.querySelector(_NLM.CONFIG.selectors.content)) {
            found = true;
            break;
          }
        }

        if (found) {
          await _NLM.wait(_NLM.TIMING.CONTENT_RENDER_DELAY_MS);
          var allContent = document.querySelectorAll(_NLM.CONFIG.selectors.content);
          var lines = Array.from(allContent).filter(
            function (el) { return !el.parentElement.closest(_NLM.CONFIG.selectors.content); }
          );
          var textLines = lines.map(function (l) { return TM.markdown.htmlToMarkdown(l); });
          var text = textLines.join('\n\n');

          if (text.length > _NLM.TIMING.MIN_CONTENT_LENGTH_CHARS) {
            collectedFiles.push({ name: fileName, data: text });
            log.log('Queued: ' + fileName + ' (' + text.length + ' chars)');
            _NLM.addLog('>> Queued: ' + fileName + ' (' + text.length + ' chars)', _NLM.LOG_LEVEL.SUCCESS);
          } else {
            log.warn('Content empty for: ' + fileName);
            _NLM.addLog('>> Warning: Content empty', _NLM.LOG_LEVEL.WARN);
          }
        } else {
          log.error('Timeout loading content for: ' + fileName);
          _NLM.addLog('>> Timeout: Content load failed', _NLM.LOG_LEVEL.ERROR);
        }

        _NLM.attemptClose();
        // Wait for content to fully leave the DOM
        for (var b = 0; b < _NLM.TIMING.CONTENT_GONE_ATTEMPTS; b++) {
          await _NLM.wait(_NLM.TIMING.CONTENT_POLL_INTERVAL_MS);
          if (!document.querySelector(_NLM.CONFIG.selectors.content)) break;
        }
      }
    } catch (e) {
      log.error('Unexpected error: ' + e.message);
      _NLM.addLog('Unexpected error: ' + e.message, _NLM.LOG_LEVEL.ERROR);
      startBtn.textContent = 'Retry';
      crashed = true;
    } finally {
      _NLM.cleanupRun(startBtn);
    }

    if (crashed) return;

    if (_NLM.STATE.isCancelled) {
      log.warn('Extraction stopped by user.');
      _NLM.addLog('Extraction stopped by user.', _NLM.LOG_LEVEL.WARN);
      if (_NLM.ui.statusBar) _NLM.ui.statusBar.setText('Stopped');
      startBtn.textContent = 'Start Extraction';
    } else {
      _NLM.updateProgress(totalSources, totalSources);

      if (collectedFiles.length > 0) {
        log.log('Building ZIP with ' + collectedFiles.length + ' file(s)...');
        _NLM.addLog('Building ZIP with ' + collectedFiles.length + ' file(s)...', _NLM.LOG_LEVEL.INFO);

        var notebookTitleEl = document.querySelector(_NLM.CONFIG.selectors.notebookTitle);
        var notebookTitle = (notebookTitleEl ? notebookTitleEl.textContent.trim() : 'NotebookLM');
        var zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + '.zip';

        var zipBlob;
        try {
          var converted = collectedFiles.map(function (f) {
            return { name: f.name, data: new TextEncoder().encode(f.data) };
          });
          var zipBytes = TM.zip.buildStoreZip(converted);
          zipBlob = new Blob([zipBytes], { type: 'application/zip' });
        } catch (e) {
          log.error('ZIP build failed: ' + e.message);
          _NLM.addLog('ZIP build failed: ' + e.message, _NLM.LOG_LEVEL.ERROR);
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
        _NLM.addLog('ZIP downloaded.', _NLM.LOG_LEVEL.SUCCESS);
      } else {
        log.warn('No files to export.');
        _NLM.addLog('No files to export.', _NLM.LOG_LEVEL.WARN);
      }

      log.log('Process completed successfully.');
      _NLM.addLog('Process completed successfully.', _NLM.LOG_LEVEL.SUCCESS);
      if (_NLM.ui.statusBar) _NLM.ui.statusBar.setText('Complete');
      startBtn.textContent = 'Done';
      _NLM.SoundFX.playComplete();
    }
  };
})();

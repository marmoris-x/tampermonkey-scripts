// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.3.1
// @description  Export NotebookLM sources as organized ZIP with markdown conversion
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @match        https://notebooklm.google.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/ui-components.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/zip-builder.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/markdown-converter.js
// @connect      notebooklm.google.com
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const log = TM.createLogger('NotebookLM Source Export');

    // ── Configuration ──
    const CONFIG = {
        selectors: {
            list: '.single-source-container',
            title: '.source-title',
            closeBtn: 'button[mattooltip="Quellenansicht schließen"]',
            content: 'labs-tailwind-structural-element-view-v2',
            notebookTitle: '.title-label-inner.mat-title-large'
        },
        audio: {
            enabled: true,
            vol: 0.15
        }
    };

    // ── Timing Constants ──
    const TIMING = {
        CONTENT_POLL_ATTEMPTS: 15,
        CONTENT_POLL_INTERVAL_MS: 200,
        CONTENT_RENDER_DELAY_MS: 1200,
        CONTENT_GONE_ATTEMPTS: 15,
        MIN_CONTENT_LENGTH_CHARS: 20,
        SOURCE_CLOSE_WAIT_MS: 1500,
        KEEP_ALIVE_VOLUME: 0.001,
        LOG_MAX_ENTRIES: 50,
        AUDIO_NOTE_DELAYS_MS: [0, 100, 200]
    };

    // ── Log Levels ──
    const LOG_LEVEL = { INFO: 'info', SUCCESS: 'success', WARN: 'warn', ERROR: 'error' };

    // ── App State ──
    const STATE = {
        isCancelled: false,
        keepAliveAudio: null,
        menuStartId: null,
        menuStopId: null
    };

    // ── UI State ──
    let sidebar = null;
    let statusBar = null;
    let terminalEl = null;
    let stopBtn = null;

    // ── Audio Feedback Engine ──
    const SoundFX = {
        _ctx: null,
        get ctx() {
            if (!this._ctx && CONFIG.audio.enabled) {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            return this._ctx;
        },
        playTone: function(freq, type, duration, vol) {
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
            } catch (_) { /* AudioContext may not be available */ }
        },
        playStart: function() { this.playTone(600, 'sine', 0.15); },
        playError: function() { this.playTone(150, 'sawtooth', 0.3); },
        playComplete: function() {
            const notes = [
                { freq: 440, duration: 0.6, delay: TIMING.AUDIO_NOTE_DELAYS_MS[0] },
                { freq: 554, duration: 0.6, delay: TIMING.AUDIO_NOTE_DELAYS_MS[1] },
                { freq: 659, duration: 0.8, delay: TIMING.AUDIO_NOTE_DELAYS_MS[2] }
            ];
            notes.forEach(n => setTimeout(() => this.playTone(n.freq, 'sine', n.duration), n.delay));
        }
    };

    // ── Terminal Log ──
    function addLog(msg, level) {
        if (!terminalEl) return;
        const entry = document.createElement('div');
        entry.className = 'log-entry log-' + (level || LOG_LEVEL.INFO);
        entry.textContent = '[' + new Date().toLocaleTimeString(undefined, { hour12: false }) + '] ' + msg;
        terminalEl.appendChild(entry);
        while (terminalEl.children.length > TIMING.LOG_MAX_ENTRIES) {
            terminalEl.removeChild(terminalEl.firstChild);
        }
        terminalEl.scrollTop = terminalEl.scrollHeight;
    }

    // ── Progress ──
    function updateProgress(current, total) {
        const percent = Math.round((current / total) * 100);
        if (statusBar) {
            statusBar.setProgress(percent);
            statusBar.setText('Processing: ' + current + '/' + total);
        }
    }

    const wait = ms => new Promise(r => setTimeout(r, ms));

    // ── Keep Alive ──
    function startKeepAlive() {
        STATE.keepAliveAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA');
        STATE.keepAliveAudio.loop = true;
        STATE.keepAliveAudio.volume = TIMING.KEEP_ALIVE_VOLUME;
        STATE.keepAliveAudio.play().catch(() => {
            log.warn('Keep-alive audio blocked by browser. Tab may throttle if left in background.');
            addLog('Keep-alive audio blocked by browser. Tab may throttle if left in background.', LOG_LEVEL.WARN);
        });
    }

    function stopKeepAlive() {
        if (STATE.keepAliveAudio) {
            STATE.keepAliveAudio.pause();
            STATE.keepAliveAudio = null;
        }
    }

    // ── Menu Commands ──
    function registerMenuStart() {
        STATE.menuStartId = GM_registerMenuCommand('Start Export', () => init());
    }

    function registerMenuStop() {
        STATE.menuStopId = GM_registerMenuCommand('Stop Export', () => {
            STATE.isCancelled = true;
            log.warn('Stop requested via menu.');
            addLog('Stop requested via menu.', LOG_LEVEL.WARN);
        });
    }

    // ── Run Cleanup ──
    function cleanupRun(startBtn) {
        stopKeepAlive();
        if (stopBtn) stopBtn.style.display = 'none';
        GM_unregisterMenuCommand(STATE.menuStopId);
        registerMenuStart();
        if (startBtn) startBtn.disabled = false;
    }

    // ── UI Initialization ──
    function init() {
        if (sidebar) return;

        sidebar = TM.ui.createSidebar({
            title: 'NotebookLM Export',
            width: 420,
            accentColor: '#3b82f6'
        });

        // Content styles inside sidebar Shadow DOM
        const styleEl = document.createElement('style');
        styleEl.textContent = [
            '.btn { width:100%; padding:10px; border-radius:4px; font:600 12px/1 system-ui,sans-serif;',
            '  text-transform:uppercase; letter-spacing:0.5px; cursor:pointer; margin-top:8px; }',
            '.btn-primary { background:#3b82f6; color:#fff; border:1px solid #2563eb; }',
            '.btn-primary:hover { background:#2563eb; }',
            '.btn-primary:disabled { background:#1e293b; border-color:#334155; color:#475569; cursor:not-allowed; }',
            '.btn-stop { background:transparent; color:#ef4444; border:1px solid #ef4444; display:none; }',
            '.btn-stop:hover { background:rgba(239,68,68,0.1); }',
            '.terminal { height:140px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05);',
            '  border-radius:4px; padding:10px; overflow-y:auto; font:11px/1.4 monospace; color:#94a3b8; }',
            '.log-entry { margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.log-info { color:#94a3b8; } .log-success { color:#4ade80; }',
            '.log-warn { color:#fbbf24; } .log-error { color:#f87171; }',
            '.terminal::-webkit-scrollbar { width:4px; }',
            '.terminal::-webkit-scrollbar-track { background:transparent; }',
            '.terminal::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }'
        ].join('\n');
        sidebar.root.appendChild(styleEl);

        // Terminal log panel
        terminalEl = document.createElement('div');
        terminalEl.className = 'terminal';
        sidebar.bodyEl.appendChild(terminalEl);
        addLog('Interface loaded.', LOG_LEVEL.INFO);
        addLog('Waiting for user command...', LOG_LEVEL.INFO);

        // Start button
        const startBtn = document.createElement('button');
        startBtn.className = 'btn btn-primary';
        startBtn.textContent = 'Start Extraction';
        startBtn.onclick = () => runProcess(startBtn);
        sidebar.bodyEl.appendChild(startBtn);

        // Stop button
        stopBtn = document.createElement('button');
        stopBtn.className = 'btn btn-stop';
        stopBtn.textContent = 'Stop';
        stopBtn.onclick = () => {
            STATE.isCancelled = true;
            log.warn('Stop requested by user.');
            addLog('Stop requested by user.', LOG_LEVEL.WARN);
        };
        sidebar.bodyEl.appendChild(stopBtn);

        sidebar.open();

        // Bottom-right progress bar
        statusBar = TM.ui.createStatusBar({ accentColor: '#3b82f6' });
        statusBar.setText('Ready');
    }

    // ── Core Extraction Process ──
    async function runProcess(startBtn) {
        STATE.isCancelled = false;
        updateProgress(0, 1);
        startBtn.disabled = true;
        startBtn.textContent = 'Running...';
        stopBtn.style.display = 'block';

        GM_unregisterMenuCommand(STATE.menuStartId);
        registerMenuStop();

        startKeepAlive();
        SoundFX.playStart();

        const totalSources = document.querySelectorAll(CONFIG.selectors.list).length;

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

        const collectedFiles = []; // { name, data: string }
        let crashed = false;

        try {
            for (let i = 0; i < totalSources; i++) {
                if (STATE.isCancelled) break;
                updateProgress(i + 1, totalSources);

                // Re-query each iteration — Angular may re-render the list after open/close
                const source = document.querySelectorAll(CONFIG.selectors.list)[i];
                if (!source) {
                    log.error('Source index ' + (i + 1) + ' not found. Skipping.');
                    addLog('Source index ' + (i + 1) + ' not found. Skipping.', LOG_LEVEL.ERROR);
                    continue;
                }

                const titleEl = source.querySelector(CONFIG.selectors.title);
                let fileName = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : 'Source_' + (i + 1))
                    .replace(/[\\/:*?"<>|]/g, '_')
                    .substring(0, 120)
                    .trim();
                if (!fileName.endsWith('.md')) fileName += '.md';

                log.log('Opening: ' + fileName);
                addLog('Opening: ' + fileName, LOG_LEVEL.INFO);
                if (statusBar) statusBar.setText((i + 1) + '/' + totalSources + ': ' + fileName);

                source.scrollIntoView({ block: 'center' });
                await wait(100);
                (titleEl || source).click();

                // Wait for content panel to appear
                let found = false;
                for (let a = 0; a < TIMING.CONTENT_POLL_ATTEMPTS; a++) {
                    await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
                    if (document.querySelector(CONFIG.selectors.content)) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    await wait(TIMING.CONTENT_RENDER_DELAY_MS);
                    const allContent = document.querySelectorAll(CONFIG.selectors.content);
                    const lines = Array.from(allContent).filter(
                        el => !el.parentElement.closest(CONFIG.selectors.content)
                    );
                    const textLines = lines.map(l => TM.markdown.htmlToMarkdown(l));
                    const text = textLines.join('\n\n');

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
                for (let a = 0; a < TIMING.CONTENT_GONE_ATTEMPTS; a++) {
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
            if (statusBar) statusBar.setText('Stopped');
            startBtn.textContent = 'Start Extraction';
        } else {
            updateProgress(totalSources, totalSources);

            if (collectedFiles.length > 0) {
                log.log('Building ZIP with ' + collectedFiles.length + ' file(s)...');
                addLog('Building ZIP with ' + collectedFiles.length + ' file(s)...', LOG_LEVEL.INFO);

                const notebookTitleEl = document.querySelector(CONFIG.selectors.notebookTitle);
                const notebookTitle = (notebookTitleEl ? notebookTitleEl.textContent.trim() : 'NotebookLM');
                const zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + '.zip';

                let zipBlob;
                try {
                    const converted = collectedFiles.map(f => ({
                        name: f.name,
                        data: new TextEncoder().encode(f.data)
                    }));
                    const zipBytes = TM.zip.buildStoreZip(converted);
                    zipBlob = new Blob([zipBytes], { type: 'application/zip' });
                } catch (e) {
                    log.error('ZIP build failed: ' + e.message);
                    addLog('ZIP build failed: ' + e.message, LOG_LEVEL.ERROR);
                    startBtn.textContent = 'Retry';
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
                addLog('ZIP downloaded.', LOG_LEVEL.SUCCESS);
            } else {
                log.warn('No files to export.');
                addLog('No files to export.', LOG_LEVEL.WARN);
            }

            log.log('Process completed successfully.');
            addLog('Process completed successfully.', LOG_LEVEL.SUCCESS);
            if (statusBar) statusBar.setText('Complete');
            startBtn.textContent = 'Done';
            SoundFX.playComplete();
        }
    }

    // ── Close Content Panel ──
    function attemptClose() {
        // Icon-based close button (language-independent)
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].textContent.includes('collapse_content')) {
                buttons[i].click();
                return;
            }
        }
        // Locale-specific tooltip
        const localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
        if (localizedBtn) {
            localizedBtn.click();
            return;
        }
        // Escape key fallback
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    }

    // ── Bootstrap ──
    registerMenuStart();

})();

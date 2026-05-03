// src/notebooklm-source-export/ui-panel.js — Sidebar UI, SoundFX, terminal log, progress
// Provides: SoundFX, initUI, addLog, updateProgress
// Consumers: NotebookLM Source Export (entry orchestrator, extractor)
(function () {
  'use strict';

  var _NLM = globalThis.__NLM__ = globalThis.__NLM__ || {};

  // ── Configuration (shared with entry + extractor) ──
  _NLM.CONFIG = {
    audio: { enabled: true, vol: 0.15 },
    selectors: {
      closeBtn: 'button[mattooltip="Quellenansicht schließen"]',
      content: 'labs-tailwind-structural-element-view-v2',
      notebookTitle: '.title-label-inner.mat-title-large'
    }
  };

  _NLM.LOG_LEVEL = { INFO: 'info', SUCCESS: 'success', WARN: 'warn', ERROR: 'error' };

  // ── Timing Constants ──
  _NLM.TIMING = {
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

  // ── App State ──
  _NLM.STATE = {
    isCancelled: false,
    keepAliveAudio: null,
    menuStartId: null,
    menuStopId: null
  };

  // ── Audio Feedback Engine ──
  var SoundFX = {
    _ctx: null,
    get ctx() {
      if (!this._ctx && _NLM.CONFIG.audio.enabled) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this._ctx;
    },

    /**
     * Plays a single tone.
     * @param {number} freq - Frequency in Hz
     * @param {OscillatorType} type - Waveform type
     * @param {number} duration - Duration in seconds
     * @param {number} [vol] - Volume (0-1)
     */
    playTone: function (freq, type, duration, vol) {
      vol = vol || _NLM.CONFIG.audio.vol;
      if (!_NLM.CONFIG.audio.enabled) return;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
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

    /** Short start tone. */
    playStart: function () { this.playTone(600, 'sine', 0.15); },

    /** Error tone. */
    playError: function () { this.playTone(150, 'sawtooth', 0.3); },

    /** Three-note ascending completion chime. */
    playComplete: function () {
      var delays = _NLM.TIMING.AUDIO_NOTE_DELAYS_MS;
      var notes = [
        { freq: 440, duration: 0.6, delay: delays[0] },
        { freq: 554, duration: 0.6, delay: delays[1] },
        { freq: 659, duration: 0.8, delay: delays[2] }
      ];
      notes.forEach(function (n) {
        setTimeout(function () { SoundFX.playTone(n.freq, 'sine', n.duration); }, n.delay);
      });
    }
  };
  _NLM.SoundFX = SoundFX;

  // ── UI element references (set by initUI) ──
  _NLM.ui = {
    sidebar: null,
    statusBar: null,
    terminalEl: null,
    stopBtn: null
  };

  /**
   * Adds a log entry to the terminal panel.
   * @param {string} msg - Log message
   * @param {string} [level] - Log level from LOG_LEVEL
   */
  _NLM.addLog = function addLog(msg, level) {
    var terminalEl = _NLM.ui.terminalEl;
    if (!terminalEl) return;
    var entry = document.createElement('div');
    entry.className = 'log-entry log-' + (level || _NLM.LOG_LEVEL.INFO);
    entry.textContent = '[' + new Date().toLocaleTimeString(undefined, { hour12: false }) + '] ' + msg;
    terminalEl.appendChild(entry);
    while (terminalEl.children.length > _NLM.TIMING.LOG_MAX_ENTRIES) {
      terminalEl.removeChild(terminalEl.firstChild);
    }
    terminalEl.scrollTop = terminalEl.scrollHeight;
  };

  /**
   * Updates the progress bar and status text.
   * @param {number} current - Current item index
   * @param {number} total - Total items
   */
  _NLM.updateProgress = function updateProgress(current, total) {
    var percent = Math.round((current / total) * 100);
    var statusBar = _NLM.ui.statusBar;
    if (statusBar) {
      statusBar.setProgress(percent);
      statusBar.setText('Processing: ' + current + '/' + total);
    }
  };

  /**
   * Creates the sidebar, terminal, buttons, and status bar.
   * Called once from the menu command or entry orchestrator.
   */
  _NLM.initUI = function initUI() {
    if (_NLM.ui.sidebar) return; // Guard: already initialized

    var sidebar = TM.ui.createSidebar({
      title: 'NotebookLM Export',
      width: 420,
      accentColor: '#3b82f6'
    });
    _NLM.ui.sidebar = sidebar;

    // Content styles inside sidebar Shadow DOM
    var styleEl = document.createElement('style');
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
    var terminalEl = document.createElement('div');
    terminalEl.className = 'terminal';
    _NLM.ui.terminalEl = terminalEl;
    sidebar.bodyEl.appendChild(terminalEl);
    _NLM.addLog('Interface loaded.', _NLM.LOG_LEVEL.INFO);
    _NLM.addLog('Waiting for user command...', _NLM.LOG_LEVEL.INFO);

    // Start button
    var startBtn = document.createElement('button');
    startBtn.className = 'btn btn-primary';
    startBtn.textContent = 'Start Extraction';
    startBtn.onclick = function () { _NLM.runProcess(startBtn); };
    sidebar.bodyEl.appendChild(startBtn);

    // Stop button
    var stopBtn = document.createElement('button');
    stopBtn.className = 'btn btn-stop';
    stopBtn.textContent = 'Stop';
    stopBtn.onclick = function () {
      _NLM.STATE.isCancelled = true;
      TM.createLogger('NotebookLM Source Export').warn('Stop requested by user.');
      _NLM.addLog('Stop requested by user.', _NLM.LOG_LEVEL.WARN);
    };
    _NLM.ui.stopBtn = stopBtn;
    sidebar.bodyEl.appendChild(stopBtn);

    sidebar.open();

    // Bottom-right progress bar
    var statusBar = TM.ui.createStatusBar({ accentColor: '#3b82f6' });
    _NLM.ui.statusBar = statusBar;
    statusBar.setText('Ready');
  };
})();

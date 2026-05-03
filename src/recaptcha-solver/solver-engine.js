// src/recaptcha-solver/solver-engine.js — Solver state machine and main loop
// Implements the state machine (ready -> working -> success/failed/dos) and
// the interval-based solver loop that switches to audio challenges, detects
// solved state, and manages retry limits.
// Consumers: Recaptcha Solver (entry file)
(function () {
  'use strict';

  var log = TM.createLogger('Recaptcha Solver');

  // ── Selectors ──────────────────────────────────────────────────────────────

  var SEL = {
    AUDIO_BUTTON:   '#recaptcha-audio-button',
    AUDIO_SOURCE:   '#audio-source',
    IMAGE_SELECT:   '#rc-imageselect',
    RESPONSE_FIELD: '.rc-audiochallenge-response-field',
    AUDIO_ERROR:    '.rc-audiochallenge-error-message',
    AUDIO_RESPONSE: '#audio-response',
    RELOAD_BUTTON:  '#recaptcha-reload-button',
    STATUS:         '#recaptcha-accessible-status',
    DOSCAPTCHA:     '.rc-doscaptcha-body',
    VERIFY_BUTTON:  '#recaptcha-verify-button',
    RC_BUTTONS:     '.rc-buttons',
    HELP_HOLDER:    '.help-button-holder'
  };

  // ── Config ─────────────────────────────────────────────────────────────────

  var CFG = {
    MAX_ATTEMPTS:          5,
    INTERVAL_MS:           1000,
    SUBMIT_GRACE_MS:       3500,
    STUCK_TIMEOUT_MS:      45000,
    MAX_RESPONSE_LEN:      100,
    AUDIO_BTN_DEBOUNCE_MS: 4000
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────

  function qs(sel) { return document.querySelector(sel); }

  function isVisible(el) {
    if (!el || el.offsetParent === null) return false;
    var s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  }

  // ── State ──────────────────────────────────────────────────────────────────

  /**
   * Creates a fresh solver state object.
   * @returns {Object}
   */
  function freshState() {
    return {
      stopped:         false,
      solved:          false,
      waiting:         false,
      waitingStart:    0,
      audioUrl:        '',
      requestCount:    0,
      submittedAt:     0,
      audioBtnClickAt: 0,
      initialStatus:   qs(SEL.STATUS) ? qs(SEL.STATUS).innerText : ''
    };
  }

  /**
   * Starts the solver loop. Sets up an interval that monitors the challenge
   * state, switches to audio mode, requests transcription, and detects completion.
   * @param {Element} btn - The solve button element
   */
  function startSolver(btn) {
    window.__RCS__.state = freshState();
    window.__RCS__.setButtonState(btn, 'working');

    window.__RCS__.solverInterval = setInterval(function () {
      try {
        var st = window.__RCS__.state;
        if (!st) return;

        // Check for DoS protection page
        var dosEl = qs(SEL.DOSCAPTCHA);
        if (dosEl && dosEl.innerText.length > 0) {
          log.warn('DoS protection triggered — stopping');
          stopSolver(btn, 'dos');
          return;
        }

        if (st.solved || st.stopped) return;

        // Detect solved state via status element change
        var statusEl = qs(SEL.STATUS);
        if (statusEl && statusEl.innerText !== st.initialStatus) {
          log.log('Solved');
          st.solved = true;
          stopSolver(btn, 'success');
          return;
        }

        // Max attempts reached
        if (st.requestCount >= CFG.MAX_ATTEMPTS) {
          log.warn('Max attempts (' + CFG.MAX_ATTEMPTS + ') reached');
          st.stopped = true;
          stopSolver(btn, 'failed');
          return;
        }

        // Stuck XHR recovery
        if (st.waiting && (Date.now() - st.waitingStart) > CFG.STUCK_TIMEOUT_MS) {
          log.warn('XHR appears stuck — releasing lock');
          st.waiting = false;
        }

        var now = Date.now();
        var audioBtn = qs(SEL.AUDIO_BUTTON);
        var imageSelect = qs(SEL.IMAGE_SELECT);

        // Switch to audio challenge when image selection is visible
        if (
          audioBtn && isVisible(audioBtn) &&
          imageSelect && isVisible(imageSelect) &&
          (now - st.audioBtnClickAt) > CFG.AUDIO_BTN_DEBOUNCE_MS
        ) {
          log.log('Switching to audio challenge');
          audioBtn.click();
          st.audioBtnClickAt = now;
          return;
        }

        var audioSrcEl = qs(SEL.AUDIO_SOURCE);
        var reloadBtn = qs(SEL.RELOAD_BUTTON);
        var audioErrEl = qs(SEL.AUDIO_ERROR);

        // Check for stale audio (same URL as before) or error state
        var inGrace = st.submittedAt > 0 && (now - st.submittedAt) < CFG.SUBMIT_GRACE_MS;
        var isStale = !st.waiting && !inGrace &&
          audioSrcEl && audioSrcEl.src &&
          st.audioUrl === audioSrcEl.src && reloadBtn;
        var hasError = audioErrEl && audioErrEl.innerText.length > 0 &&
          reloadBtn && !reloadBtn.disabled;

        if (isStale || hasError) {
          log.log(hasError ? 'Error detected — reloading' : 'Stale audio — reloading');
          reloadBtn.click();
          return;
        }

        // New audio available — request transcription
        var responseField = qs(SEL.RESPONSE_FIELD);
        var audioRespEl = qs(SEL.AUDIO_RESPONSE);

        if (
          !st.waiting &&
          responseField && isVisible(responseField) &&
          audioRespEl && !audioRespEl.value &&
          audioSrcEl && audioSrcEl.src && audioSrcEl.src.length > 0 &&
          st.audioUrl !== audioSrcEl.src
        ) {
          st.audioUrl = audioSrcEl.src;
          st.waiting = true;
          window.__RCS__.getTextFromAudio(st.audioUrl);
        }

      } catch (err) {
        log.error('Interval error: ' + err.message);
        stopSolver(btn, 'failed');
      }
    }, CFG.INTERVAL_MS);
  }

  /**
   * Stops the solver loop and sets the button to the final state.
   * @param {Element} btn - The solve button element
   * @param {string} result - One of: success, failed, dos
   */
  function stopSolver(btn, result) {
    if (window.__RCS__.solverInterval) {
      clearInterval(window.__RCS__.solverInterval);
      window.__RCS__.solverInterval = null;
    }
    window.__RCS__.setButtonState(btn, result);
  }

  // ── Namespace Registration ─────────────────────────────────────────────────

  window.__RCS__ = window.__RCS__ || {};
  window.__RCS__.state = null;
  window.__RCS__.solverInterval = null;
  window.__RCS__.freshState = freshState;
  window.__RCS__.startSolver = startSolver;
  window.__RCS__.stopSolver = stopSolver;
})();

'use strict';

import { createLogger } from './_logger.js';
import { qs, isVisible } from './_dom.js';
import { getBestServer, latencies } from './_network.js';
import { getLang } from './_i18n.js';
import {
  SEL, MAX_ATTEMPTS, INTERVAL_MS, SUBMIT_GRACE_MS,
  STUCK_TIMEOUT_MS, MAX_RESPONSE_LEN, AUDIO_BTN_DEBOUNCE_MS, SERVERS
} from './config.js';

// ── Logger ────────────────────────────────────────────────────────────────────

const log = createLogger('Recaptcha Solver');

// ── Internal: finish solver (replaces exported stopSolver) ────────────────────

/**
 * Stops the solver loop and signals the final state to the UI.
 * @param {string} result - 'success' | 'failed' | 'dos'
 * @param {(name: string) => void} onStateChange - UI callback
 * @param {number|null} interval - The setInterval ID to clear
 */
function finish(result, onStateChange, interval) {
  if (interval) clearInterval(interval);
  onStateChange(result);
}

// ── Internal: getTextFromAudio (moved from audio-api.js) ──────────────────────

/**
 * Sends an audio URL to the speech recognition server and handles the response.
 * On success fills the response field and clicks verify.
 * On failure retries with the fallback server.
 * Uses raw GM_xmlhttpRequest POST (fetchJSON only does GET).
 * @param {string} srcUrl - Audio source URL
 * @param {Object} solverState - Current solver state (mutated in place)
 * @param {string} [excludeServer] - Server to exclude (used on retry)
 */
function getTextFromAudio(srcUrl, solverState, excludeServer) {
  const normalizedUrl = srcUrl.replace(/recaptcha\.net/g, 'google.com');
  const lang = getLang();
  const server = getBestServer(SERVERS, latencies, excludeServer);

  if (!excludeServer) solverState.requestCount++;
  solverState.waitingStart = Date.now();
  log.log(`Request to ${server} | lang:${lang} | attempt:${solverState.requestCount}${excludeServer ? ' [retry]' : ''}`);

  GM_xmlhttpRequest({
    method: 'POST',
    url: server,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: 'input=' + encodeURIComponent(normalizedUrl) + '&lang=' + encodeURIComponent(lang),
    timeout: 30000,

    onload(response) {
      try {
        const text = (response.responseText || '').trim();
        log.log('Response: "' + text.substring(0, 80) + '"');

        const invalid =
          !text ||
          text === '0' ||
          text.length < 2 ||
          text.length > MAX_RESPONSE_LEN ||
          /<[a-z][\s\S]*?>/i.test(text);

        if (invalid) {
          log.log('Invalid response — will reload on next tick');
          solverState.waiting = false;
          return;
        }

        const audioBtn    = qs(SEL.AUDIO_BUTTON);
        const audioSrcEl  = qs(SEL.AUDIO_SOURCE);
        const audioRespEl = qs(SEL.AUDIO_RESPONSE);
        const verifyBtn   = qs(SEL.VERIFY_BUTTON);

        const inAudioMode = audioBtn &&
          window.getComputedStyle(audioBtn).display === 'none';

        if (inAudioMode && audioSrcEl && audioSrcEl.src === srcUrl &&
            audioRespEl && !audioRespEl.value && verifyBtn) {
          audioRespEl.value = text;
          audioRespEl.dispatchEvent(new Event('input',  { bubbles: true }));
          audioRespEl.dispatchEvent(new Event('change', { bubbles: true }));
          verifyBtn.click();
          solverState.submittedAt = Date.now();
          log.log('Submitted: "' + text + '"');
        } else {
          log.log('Page state changed — will retry on next challenge');
        }
      } catch (err) {
        log.error('Response handler error: ' + err.message);
      } finally {
        solverState.waiting = false;
      }
    },

    onerror() {
      log.warn('Network error from ' + server);
      if (!excludeServer) {
        getTextFromAudio(srcUrl, solverState, server);
      } else {
        log.warn('Both servers failed — releasing lock');
        solverState.waiting = false;
      }
    },

    ontimeout() {
      log.warn('Timeout from ' + server);
      if (!excludeServer) {
        getTextFromAudio(srcUrl, solverState, server);
      } else {
        log.warn('Both servers failed — releasing lock');
        solverState.waiting = false;
      }
    }
  });
}

// ── Public API: startSolver ───────────────────────────────────────────────────

/**
 * Starts the reCAPTCHA solving interval.
 * Polls for audio challenges, sends recognition requests, submits answers.
 * @param {Object} opts
 * @param {Object} opts.state - Fresh solver state (from createFreshState)
 * @param {(name: string) => void} opts.onStateChange - Called on each UI-relevant state change
 */
export function startSolver({ state, onStateChange }) {
  onStateChange('working');

  const interval = setInterval(function () {
    try {
      const st = state;
      if (!st) return;

      // Check for DoS protection page
      const dosEl = qs(SEL.DOSCAPTCHA);
      if (dosEl && dosEl.innerText.length > 0) {
        log.warn('DoS protection triggered — stopping');
        finish('dos', onStateChange, interval);
        return;
      }

      if (st.solved || st.stopped) return;

      // Detect solved state via status element change
      const statusEl = qs(SEL.STATUS);
      if (statusEl && statusEl.innerText !== st.initialStatus) {
        log.log('Solved');
        st.solved = true;
        finish('success', onStateChange, interval);
        return;
      }

      // Max attempts reached
      if (st.requestCount >= MAX_ATTEMPTS) {
        log.warn(`Max attempts (${MAX_ATTEMPTS}) reached`);
        st.stopped = true;
        finish('failed', onStateChange, interval);
        return;
      }

      // Stuck XHR recovery
      if (st.waiting && (Date.now() - st.waitingStart) > STUCK_TIMEOUT_MS) {
        log.warn('XHR appears stuck — releasing lock');
        st.waiting = false;
      }

      const now = Date.now();
      const audioBtn = qs(SEL.AUDIO_BUTTON);
      const imageSelect = qs(SEL.IMAGE_SELECT);

      // Switch to audio challenge when image selection is visible
      if (
        audioBtn && isVisible(audioBtn) &&
        imageSelect && isVisible(imageSelect) &&
        (now - st.audioBtnClickAt) > AUDIO_BTN_DEBOUNCE_MS
      ) {
        log.log('Switching to audio challenge');
        audioBtn.click();
        st.audioBtnClickAt = now;
        return;
      }

      const audioSrcEl = qs(SEL.AUDIO_SOURCE);
      const reloadBtn  = qs(SEL.RELOAD_BUTTON);
      const audioErrEl = qs(SEL.AUDIO_ERROR);

      // Check for stale audio or error state
      const inGrace = st.submittedAt > 0 && (now - st.submittedAt) < SUBMIT_GRACE_MS;
      const isStale = !st.waiting && !inGrace &&
        audioSrcEl && audioSrcEl.src &&
        st.audioUrl === audioSrcEl.src && reloadBtn;
      const hasError = audioErrEl && audioErrEl.innerText.length > 0 &&
        reloadBtn && !reloadBtn.disabled;

      if (isStale || hasError) {
        log.log(hasError ? 'Error detected — reloading' : 'Stale audio — reloading');
        reloadBtn.click();
        return;
      }

      // New audio available — request transcription
      const responseField = qs(SEL.RESPONSE_FIELD);
      const audioRespEl   = qs(SEL.AUDIO_RESPONSE);

      if (
        !st.waiting &&
        responseField && isVisible(responseField) &&
        audioRespEl && !audioRespEl.value &&
        audioSrcEl && audioSrcEl.src && audioSrcEl.src.length > 0 &&
        st.audioUrl !== audioSrcEl.src
      ) {
        st.audioUrl = audioSrcEl.src;
        st.waiting = true;
        getTextFromAudio(st.audioUrl, st);
      }

    } catch (err) {
      log.error('Interval error: ' + err.message);
      finish('failed', onStateChange, interval);
    }
  }, INTERVAL_MS);
}

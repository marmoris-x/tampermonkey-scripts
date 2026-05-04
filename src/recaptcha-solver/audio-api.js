// src/recaptcha-solver/audio-api.js — Audio transcription via external API
// Handles server selection with latency measurement, language detection, and
// the audio transcription request with dual-server failover.
// Consumers: Recaptcha Solver (solver-engine)

import { createLogger } from '../shared/logging-utils.js';
import { fetchJSON } from '../shared/network-utils.js';
import { state } from './solver-engine.js';

var log = createLogger('Recaptcha Solver');

// ── Selectors (subset needed for response handling) ─────────────────────────

var SEL = {
  AUDIO_BUTTON:   '#recaptcha-audio-button',
  AUDIO_SOURCE:   '#audio-source',
  AUDIO_RESPONSE: '#audio-response',
  VERIFY_BUTTON:  '#recaptcha-verify-button'
};

var MAX_RESPONSE_LEN = 100;

// ── Servers ─────────────────────────────────────────────────────────────────

var SERVERS = [
  'https://engageub.pythonanywhere.com',
  'https://engageub1.pythonanywhere.com'
];
var latencies = SERVERS.map(function () { return Infinity; });

// ── Passive background ping tests ───────────────────────────────────────────

SERVERS.forEach(function (url, i) {
  var t0 = Date.now();
  fetchJSON(url, { timeout: 8000 })
    .then(function () {
      latencies[i] = Date.now() - t0;
      log.log('Ping ' + url + ': ' + latencies[i] + 'ms');
    })
    .catch(function () {
      latencies[i] = Infinity;
    });
});

// ── Language detection ─────────────────────────────────────────────────────

/**
 * Detects the page language and maps it to a locale string for the API.
 * @returns {string}
 */
export function getLang() {
  var raw = (document.querySelector('html') ? document.querySelector('html').getAttribute('lang') : null)
    || navigator.language || 'en-US';
  var map = {
    af:'af-ZA', am:'am-ET', ar:'ar-SA', az:'az-AZ', be:'be-BY',
    bg:'bg-BG', bn:'bn-BD', bs:'bs-BA', ca:'ca-ES', cs:'cs-CZ',
    cy:'cy-GB', da:'da-DK', de:'de-DE', el:'el-GR', es:'es-ES',
    et:'et-EE', eu:'eu-ES', fa:'fa-IR', fi:'fi-FI', fr:'fr-FR',
    ga:'ga-IE', gl:'gl-ES', gu:'gu-IN', he:'he-IL', hi:'hi-IN',
    hr:'hr-HR', hu:'hu-HU', hy:'hy-AM', id:'id-ID', is:'is-IS',
    it:'it-IT', ja:'ja-JP', ka:'ka-GE', kk:'kk-KZ', km:'km-KH',
    kn:'kn-IN', ko:'ko-KR', lt:'lt-LT', lv:'lv-LV', mk:'mk-MK',
    ml:'ml-IN', mn:'mn-MN', mr:'mr-IN', ms:'ms-MY', my:'my-MM',
    nb:'nb-NO', ne:'ne-NP', nl:'nl-NL', pa:'pa-IN', pl:'pl-PL',
    pt:'pt-BR', ro:'ro-RO', ru:'ru-RU', si:'si-SK', sk:'sk-SK',
    sl:'sl-SI', sq:'sq-AL', sr:'sr-RS', sv:'sv-SE', sw:'sw-KE',
    ta:'ta-IN', te:'te-IN', th:'th-TH', tl:'tl-PH', tr:'tr-TR',
    uk:'uk-UA', ur:'ur-PK', uz:'uz-UZ', vi:'vi-VN', zh:'zh-CN',
    zu:'zu-ZA'
  };
  return map[raw] || raw;
}

// ── Server selection ───────────────────────────────────────────────────────

/**
 * Selects the best server by latency, optionally excluding one.
 * @param {string} [exclude] - Server URL to exclude (previously failed)
 * @returns {string}
 */
export function getBestServer(exclude) {
  var best = null;
  var bestMs = Infinity;
  for (var i = 0; i < SERVERS.length; i++) {
    if (SERVERS[i] === exclude) continue;
    if (latencies[i] < bestMs) {
      bestMs = latencies[i];
      best = SERVERS[i];
    }
  }
  return best || SERVERS.filter(function (s) { return s !== exclude; })[0] || SERVERS[0];
}

// ── Transcription request ───────────────────────────────────────────────────

/**
 * Sends an audio URL to the transcription server and handles the response.
 * On success, fills the response field and clicks verify.
 * On failure, retries with the fallback server.
 * Uses raw GM_xmlhttpRequest POST (TM.network only supports GET).
 * @param {string} srcUrl - Audio source URL
 * @param {string} [retry] - Server to exclude (used on retry attempts)
 */
export function getTextFromAudio(srcUrl, retry) {
  var normalizedUrl = srcUrl.replace(/recaptcha\.net/g, 'google.com');
  var lang = getLang();
  var server = getBestServer(retry);

  if (!retry) state.requestCount++;
  state.waitingStart = Date.now();
  log.log('Request to ' + server + ' | lang:' + lang + ' | attempt:' + state.requestCount +
    (retry ? ' [retry]' : ''));

  GM_xmlhttpRequest({
    method: 'POST',
    url: server,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: 'input=' + encodeURIComponent(normalizedUrl) + '&lang=' + encodeURIComponent(lang),
    timeout: 30000,

    onload: function (response) {
      try {
        var text = (response.responseText || '').trim();
        log.log('Response: "' + text.substring(0, 80) + '"');

        var invalid =
          !text ||
          text === '0' ||
          text.length < 2 ||
          text.length > MAX_RESPONSE_LEN ||
          /<[a-z][\s\S]*?>/i.test(text);

        if (invalid) {
          log.log('Invalid response — will reload on next tick');
          state.waiting = false;
          return;
        }

        var audioBtn    = document.querySelector(SEL.AUDIO_BUTTON);
        var audioSrcEl  = document.querySelector(SEL.AUDIO_SOURCE);
        var audioRespEl = document.querySelector(SEL.AUDIO_RESPONSE);
        var verifyBtn   = document.querySelector(SEL.VERIFY_BUTTON);

        var inAudioMode = audioBtn &&
          window.getComputedStyle(audioBtn).display === 'none';

        if (inAudioMode && audioSrcEl && audioSrcEl.src === srcUrl &&
            audioRespEl && !audioRespEl.value && verifyBtn) {
          audioRespEl.value = text;
          audioRespEl.dispatchEvent(new Event('input',  { bubbles: true }));
          audioRespEl.dispatchEvent(new Event('change', { bubbles: true }));
          verifyBtn.click();
          state.submittedAt = Date.now();
          log.log('Submitted: "' + text + '"');
        } else {
          log.log('Page state changed — will retry on next challenge');
        }
      } catch (err) {
        log.error('Response handler error: ' + err.message);
      } finally {
        state.waiting = false;
      }
    },

    onerror: function () {
      log.warn('Network error from ' + server);
      if (!retry) {
        getTextFromAudio(srcUrl, server);
      } else {
        log.warn('Both servers failed — releasing lock');
        state.waiting = false;
      }
    },

    ontimeout: function () {
      log.warn('Timeout from ' + server);
      if (!retry) {
        getTextFromAudio(srcUrl, server);
      } else {
        log.warn('Both servers failed — releasing lock');
        state.waiting = false;
      }
    }
  });
}

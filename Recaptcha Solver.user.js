// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.9.1
// @description  Recaptcha Solver in Browser | Start button in challenge footer
// @author       marmoris-x
// @match        https://www.google.com/recaptcha/*
// @match        https://google.com/recaptcha/*
// @match        https://www.recaptcha.net/recaptcha/*
// @match        https://recaptcha.net/recaptcha/*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/network-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/dom-utils.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Recaptcha%20Solver.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Recaptcha%20Solver.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @run-at       document-idle
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════════════
    //  CONTEXT GUARD
    //  Only run inside the bframe (challenge iframe).
    //  The anchor frame (checkbox) is left completely untouched — no
    //  auto-clicking, no observers, nothing.  Everything is manual.
    // ════════════════════════════════════════════════════════════════════════
    if (!window.location.href.includes('bframe')) return;

    var { log, warn, error } = TM.createLogger('Recaptcha Solver');

    // ════════════════════════════════════════════════════════════════════════
    //  SELECTORS
    // ════════════════════════════════════════════════════════════════════════

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

    // ════════════════════════════════════════════════════════════════════════
    //  CONFIG
    // ════════════════════════════════════════════════════════════════════════

    var CFG = {
        MAX_ATTEMPTS:          5,
        INTERVAL_MS:           1000,
        SUBMIT_GRACE_MS:       3500,
        STUCK_TIMEOUT_MS:      45000,
        MAX_RESPONSE_LEN:      100,
        AUDIO_BTN_DEBOUNCE_MS: 4000
    };

    // ════════════════════════════════════════════════════════════════════════
    //  SERVERS
    // ════════════════════════════════════════════════════════════════════════

    var SERVERS   = [
        'https://engageub.pythonanywhere.com',
        'https://engageub1.pythonanywhere.com'
    ];
    var latencies = SERVERS.map(function () { return Infinity; });

    // ════════════════════════════════════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════════════════════════════════════

    var state          = null;
    var solverInterval = null;

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

    // ════════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════════════════════════

    function qs(sel) { return document.querySelector(sel); }

    function isVisible(el) {
        if (!el || el.offsetParent === null) return false;
        var s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden';
    }

    function getLang() {
        var raw = (qs('html') ? qs('html').getAttribute('lang') : null) || navigator.language || 'en-US';
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
            pt:'pt-BR', ro:'ro-RO', ru:'ru-RU', si:'si-LK', sk:'sk-SK',
            sl:'sl-SI', sq:'sq-AL', sr:'sr-RS', sv:'sv-SE', sw:'sw-KE',
            ta:'ta-IN', te:'te-IN', th:'th-TH', tl:'tl-PH', tr:'tr-TR',
            uk:'uk-UA', ur:'ur-PK', uz:'uz-UZ', vi:'vi-VN', zh:'zh-CN',
            zu:'zu-ZA'
        };
        return map[raw] || raw;
    }

    function getBestServer(exclude) {
        var best = null, bestMs = Infinity;
        for (var i = 0; i < SERVERS.length; i++) {
            if (SERVERS[i] === exclude) continue;
            if (latencies[i] < bestMs) { bestMs = latencies[i]; best = SERVERS[i]; }
        }
        return best || SERVERS.filter(function (s) { return s !== exclude; })[0] || SERVERS[0];
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PING TESTS  (passive background latency measurement only)
    // ════════════════════════════════════════════════════════════════════════

    SERVERS.forEach(function (url, i) {
        var t0 = Date.now();
        TM.network.fetchJSON(url, { timeout: 8000 })
            .then(function () { latencies[i] = Date.now() - t0; log('Ping ' + url + ': ' + latencies[i] + 'ms'); })
            .catch(function () { latencies[i] = Infinity; });
    });

    // ════════════════════════════════════════════════════════════════════════
    //  TRANSCRIPTION REQUEST
    //  Uses raw GM_xmlhttpRequest POST (TM.network.fetchJSON only supports GET)
    // ════════════════════════════════════════════════════════════════════════

    function getTextFromAudio(srcUrl, retry) {
        var normalizedUrl = srcUrl.replace(/recaptcha\.net/g, 'google.com');
        var lang          = getLang();
        var server        = getBestServer(retry);

        if (!retry) state.requestCount++;
        state.waitingStart = Date.now();
        log('→ ' + server + ' | lang:' + lang + ' | attempt:' + state.requestCount + (retry ? ' [retry]' : ''));

        GM_xmlhttpRequest({
            method:  'POST',
            url:     server,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data:    'input=' + encodeURIComponent(normalizedUrl) + '&lang=' + encodeURIComponent(lang),
            timeout: 30000,

            onload: function (response) {
                try {
                    var text = (response.responseText || '').trim();
                    log('← "' + text.substring(0, 80) + '"');

                    var invalid =
                        !text ||
                        text === '0' ||
                        text.length < 2 ||
                        text.length > CFG.MAX_RESPONSE_LEN ||
                        /<[a-z][\s\S]*?>/i.test(text);

                    if (invalid) {
                        log('Invalid response — will reload on next tick');
                        return;
                    }

                    var audioBtn    = qs(SEL.AUDIO_BUTTON);
                    var audioSrcEl  = qs(SEL.AUDIO_SOURCE);
                    var audioRespEl = qs(SEL.AUDIO_RESPONSE);
                    var verifyBtn   = qs(SEL.VERIFY_BUTTON);

                    var inAudioMode = audioBtn &&
                        window.getComputedStyle(audioBtn).display === 'none';

                    if (inAudioMode && audioSrcEl && audioSrcEl.src === srcUrl && audioRespEl && !audioRespEl.value && verifyBtn) {
                        audioRespEl.value = text;
                        audioRespEl.dispatchEvent(new Event('input',  { bubbles: true }));
                        audioRespEl.dispatchEvent(new Event('change', { bubbles: true }));
                        verifyBtn.click();
                        state.submittedAt = Date.now();
                        log('✓ Submitted: "' + text + '"');
                    } else {
                        log('Page state changed — will retry on next challenge');
                    }
                } catch (err) {
                    error('Response handler error: ' + err.message);
                } finally {
                    state.waiting = false;
                }
            },

            onerror: function () {
                warn('✗ Network error from ' + server);
                if (!retry) { getTextFromAudio(srcUrl, server); }
                else { warn('Both servers failed — releasing lock'); state.waiting = false; }
            },

            ontimeout: function () {
                warn('✗ Timeout from ' + server);
                if (!retry) { getTextFromAudio(srcUrl, server); }
                else { warn('Both servers failed — releasing lock'); state.waiting = false; }
            }
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SOLVER LOOP
    // ════════════════════════════════════════════════════════════════════════

    function startSolver(btn) {
        state = freshState();
        setButtonState(btn, 'working');

        solverInterval = setInterval(function () {
            try {
                var dosEl = qs(SEL.DOSCAPTCHA);
                if (dosEl && dosEl.innerText.length > 0) {
                    warn('DoS protection triggered — stopping');
                    stopSolver(btn, 'dos');
                    return;
                }

                if (state.solved || state.stopped) return;

                var statusEl = qs(SEL.STATUS);
                if (statusEl && statusEl.innerText !== state.initialStatus) {
                    log('SOLVED ✓');
                    state.solved = true;
                    stopSolver(btn, 'success');
                    return;
                }

                if (state.requestCount >= CFG.MAX_ATTEMPTS) {
                    warn('Max attempts (' + CFG.MAX_ATTEMPTS + ') reached');
                    state.stopped = true;
                    stopSolver(btn, 'failed');
                    return;
                }

                if (state.waiting && (Date.now() - state.waitingStart) > CFG.STUCK_TIMEOUT_MS) {
                    warn('XHR appears stuck — releasing lock');
                    state.waiting = false;
                }

                var now         = Date.now();
                var audioBtn    = qs(SEL.AUDIO_BUTTON);
                var imageSelect = qs(SEL.IMAGE_SELECT);

                if (
                    audioBtn    && isVisible(audioBtn)    &&
                    imageSelect && isVisible(imageSelect) &&
                    (now - state.audioBtnClickAt) > CFG.AUDIO_BTN_DEBOUNCE_MS
                ) {
                    log('Switching to audio challenge');
                    audioBtn.click();
                    state.audioBtnClickAt = now;
                    return;
                }

                var audioSrcEl = qs(SEL.AUDIO_SOURCE);
                var reloadBtn  = qs(SEL.RELOAD_BUTTON);
                var audioErrEl = qs(SEL.AUDIO_ERROR);

                var inGrace = state.submittedAt > 0 &&
                    (now - state.submittedAt) < CFG.SUBMIT_GRACE_MS;

                var isStale =
                    !state.waiting && !inGrace &&
                    audioSrcEl && audioSrcEl.src &&
                    state.audioUrl === audioSrcEl.src &&
                    reloadBtn;

                var hasError =
                    audioErrEl && audioErrEl.innerText.length > 0 &&
                    reloadBtn && !reloadBtn.disabled;

                if (isStale || hasError) {
                    log(hasError ? 'Error detected — reloading' : 'Stale audio — reloading');
                    reloadBtn.click();
                    return;
                }

                var responseField = qs(SEL.RESPONSE_FIELD);
                var audioRespEl   = qs(SEL.AUDIO_RESPONSE);

                if (
                    !state.waiting &&
                    responseField && isVisible(responseField) &&
                    audioRespEl   && !audioRespEl.value &&
                    audioSrcEl && audioSrcEl.src && audioSrcEl.src.length > 0 &&
                    state.audioUrl !== audioSrcEl.src
                ) {
                    state.audioUrl = audioSrcEl.src;
                    state.waiting  = true;
                    getTextFromAudio(state.audioUrl);
                }

            } catch (err) {
                error('Interval error: ' + err.message);
                stopSolver(btn, 'failed');
            }
        }, CFG.INTERVAL_MS);
    }

    function stopSolver(btn, result) {
        if (solverInterval) {
            clearInterval(solverInterval);
            solverInterval = null;
        }
        setButtonState(btn, result);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SVG ICONS
    // ════════════════════════════════════════════════════════════════════════

    var SVG = {
        bolt:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M13 2 3 14h9l-1 8L21 10h-9l1-8z"/></svg>',
        spin:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="rs-spin" style="display:block"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>',
        check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="20 6 9 17 4 12"/></svg>',
        retry: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.95"/></svg>',
        warn:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>'
    };

    // ════════════════════════════════════════════════════════════════════════
    //  BUTTON STATES
    // ════════════════════════════════════════════════════════════════════════

    var BUTTON_ID  = 'rs-solve-btn';
    var WRAPPER_ID = 'rs-solve-wrapper';

    var BTN_STATES = {
        ready:   [SVG.bolt,  'Solve automatically',           '',           false],
        working: [SVG.spin,  'Solving…',                     'rs-working',  true ],
        success: [SVG.check, 'Solved!',                      'rs-success',  true ],
        failed:  [SVG.retry, 'Failed — click to retry',      'rs-failed',   false],
        dos:     [SVG.warn,  'Automated query limit reached', 'rs-dos',      true ]
    };

    function setButtonState(btn, stateName) {
        if (!btn) return;
        var s = BTN_STATES[stateName] || BTN_STATES.ready;
        btn.innerHTML = s[0];
        btn.title     = s[1];
        btn.disabled  = s[3];
        btn.className = 'rc-button goog-inline-block rs-btn' + (s[2] ? ' ' + s[2] : '');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  STYLES
    // ════════════════════════════════════════════════════════════════════════

    function injectStyles() {
        var style = document.createElement('style');
        style.textContent =
            '.rs-btn-holder{display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important}' +
            '.rs-btn{background-image:none!important;background-color:#1a73e8!important;color:#fff!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;border:none!important;border-radius:4px!important;cursor:pointer!important;line-height:0!important;vertical-align:middle!important;transition:background-color 0.15s ease,transform 0.1s ease,box-shadow 0.15s ease!important;box-shadow:0 1px 3px rgba(0,0,0,0.25)!important;outline:none!important;user-select:none!important}' +
            '.rs-btn:not(:disabled):hover{background-color:#1558b0!important;box-shadow:0 2px 6px rgba(0,0,0,0.3)!important;transform:translateY(-1px)!important}' +
            '.rs-btn:not(:disabled):active{transform:translateY(0) scale(0.96)!important;box-shadow:0 1px 2px rgba(0,0,0,0.2)!important}' +
            '.rs-btn:disabled{cursor:default!important;opacity:0.80!important}' +
            '.rs-btn.rs-working{background-color:#f29900!important}' +
            '.rs-btn.rs-success{background-color:#1e8e3e!important}' +
            '.rs-btn.rs-failed{background-color:#d93025!important}' +
            '.rs-btn.rs-failed:not(:disabled):hover{background-color:#b71c1c!important}' +
            '.rs-btn.rs-dos{background-color:#e37400!important}' +
            '.rs-spin{animation:rs-rotate 0.9s linear infinite!important;transform-origin:center!important}' +
            '@keyframes rs-rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
            '.rs-btn:focus-visible{outline:2px solid #1a73e8!important;outline-offset:2px!important}';
        document.head.appendChild(style);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BUTTON INJECTION
    // ════════════════════════════════════════════════════════════════════════

    function injectButton() {
        if (document.getElementById(BUTTON_ID)) return;

        var helpHolder = qs(SEL.HELP_HOLDER);
        if (!helpHolder) return;

        var btn = document.createElement('button');
        btn.id       = BUTTON_ID;
        btn.tabIndex = 0;
        setButtonState(btn, 'ready');

        btn.addEventListener('click', function () {
            if (state && state.stopped && !state.solved) {
                log('Retrying solver…');
                startSolver(btn);
                return;
            }
            if (solverInterval || (state && state.solved)) return;
            log('Solver started by user');
            startSolver(btn);
        });

        var wrapper = document.createElement('div');
        wrapper.id        = WRAPPER_ID;
        wrapper.className = 'button-holder rs-btn-holder';
        wrapper.appendChild(btn);

        helpHolder.insertAdjacentElement('afterend', wrapper);
        log('Solve button injected');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BOOT
    // ════════════════════════════════════════════════════════════════════════

    injectStyles();

    TM.dom.waitForElement(SEL.HELP_HOLDER, 0).then(function () {
        injectButton();
    });

    TM.dom.observeMutations(function () {
        if (!document.getElementById(BUTTON_ID) && qs(SEL.HELP_HOLDER)) {
            log('Button lost — re-injecting');
            injectButton();
        }
    });

})();

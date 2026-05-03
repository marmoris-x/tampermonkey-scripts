// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.10.0
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
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/recaptcha-solver/ui-button.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/recaptcha-solver/audio-api.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/recaptcha-solver/solver-engine.js
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

    // ── Context Guard ──────────────────────────────────────────────────────────
    // Only run inside the bframe (challenge iframe).
    // The anchor frame (checkbox) is left completely untouched — no
    // auto-clicking, no observers, nothing. Everything is manual.
    if (!window.location.href.includes('bframe')) return;

    var log = TM.createLogger('Recaptcha Solver');

    // ── Boot ──────────────────────────────────────────────────────────────────
    // Inject CSS, wait for the help button holder to appear, then inject the
    // solve button. A MutationObserver rebuilds the button if the DOM resets.

    window.__RCS__.injectStyles();

    TM.dom.waitForElement('.help-button-holder', 0).then(function () {
        window.__RCS__.injectButton();
    });

    TM.dom.observeMutations(function () {
        if (!document.getElementById('rs-solve-btn') && document.querySelector('.help-button-holder')) {
            log.log('Button lost — re-injecting');
            window.__RCS__.injectButton();
        }
    });

})();

// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.11.0
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
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @run-at       document-idle
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @license      MIT
// ==/UserScript==

import { createLogger } from '../src/shared/logging-utils.js';
import { waitForElement, observeMutations } from '../src/shared/dom-utils.js';
import { injectStyles, injectButton } from '../src/recaptcha-solver/ui-button.js';

// ── Context Guard ──────────────────────────────────────────────────────────
// Only run inside the bframe (challenge iframe).
// The anchor frame (checkbox) is left completely untouched — no
// auto-clicking, no observers, nothing. Everything is manual.
if (window.location.href.includes('bframe')) {

var log = createLogger('Recaptcha Solver');

// ── Boot ──────────────────────────────────────────────────────────────────
// Inject CSS, wait for the help button holder to appear, then inject the
// solve button. A MutationObserver rebuilds the button if the DOM resets.

injectStyles();

waitForElement('.help-button-holder', 0).then(function () {
  injectButton();
});

observeMutations(function () {
    if (!document.getElementById('rs-solve-btn') && document.querySelector('.help-button-holder')) {
      log.log('Button lost — re-injecting');
      injectButton();
    }
  });

}

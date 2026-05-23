// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.0.5
// @author       marmoris-x
// @description  Automatically solves reCAPTCHA v2 audio challenges via speech recognition
// @license      MIT
// @icon         https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/RecaptchaLogo.svg/1280px-RecaptchaLogo.svg.png
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Recaptcha%20Solver.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Recaptcha%20Solver.user.js
// @match        https://www.google.com/recaptcha/*
// @match        https://google.com/recaptcha/*
// @match        https://www.recaptcha.net/recaptcha/*
// @match        https://recaptcha.net/recaptcha/*
// @match        https://www.google.com/sorry/index*
// @sandbox      raw
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addElement
// @run-at       document-idle
// ==/UserScript==

'use strict';

import { registerBoot } from '../src/recaptcha-solver/boot.js';

// Only execute in bframe (the actual reCAPTCHA challenge iframe).
// The anchor frame (checkbox) is left completely untouched.
if (window.location.href.includes('bframe')) {
  registerBoot();
}

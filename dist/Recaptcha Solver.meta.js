// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.11.0
// @author       marmoris-x
// @description  Recaptcha Solver in Browser | Start button in challenge footer
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.meta.js
// @match        https://www.google.com/recaptcha/*
// @match        https://google.com/recaptcha/*
// @match        https://www.recaptcha.net/recaptcha/*
// @match        https://recaptcha.net/recaptcha/*
// @sandbox      JavaScript
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @inject-into  content
// @run-at       document-idle
// @noframes
// @unwrap
// ==/UserScript==
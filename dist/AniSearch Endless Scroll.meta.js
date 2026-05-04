// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.3.0
// @author       marmoris-x
// @description  Infinite scroll pagination for AniSearch with rating filter
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=anisearch.de
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/AniSearch%20Endless%20Scroll.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/AniSearch%20Endless%20Scroll.user.js
// @match        https://www.anisearch.de/anime*
// @sandbox      JavaScript
// @connect      anisearch.de
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @inject-into  content
// @run-at       document-idle
// ==/UserScript==
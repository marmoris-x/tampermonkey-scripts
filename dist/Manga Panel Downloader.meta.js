// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.4.0
// @author       marmoris-x
// @description  Downloads manga/manhwa panels as ZIP — pipeline download, retry, abort, fast scrolling
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// @match        *://*/*
// @sandbox      JavaScript
// @connect      *
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @inject-into  content
// @run-at       document-idle
// ==/UserScript==
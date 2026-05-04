// ==UserScript==
// @name         Marketplace Deal Finder
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      30.0
// @author       marmoris
// @description  Cross-platform deal aggregator for Willhaben and Kleinanzeigen with AI-powered price analysis. Multi-page crawling with Gemini AI.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=willhaben.at
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.meta.js
// @match        https://www.willhaben.at/iad/kaufen-und-verkaufen/*
// @match        https://www.kleinanzeigen.de/s-*
// @match        https://www.kleinanzeigen.de/z-*
// @sandbox      JavaScript
// @connect      willhaben.at
// @connect      kleinanzeigen.de
// @connect      generativelanguage.googleapis.com
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_xmlhttpRequest
// @inject-into  content
// @run-at       document-idle
// ==/UserScript==
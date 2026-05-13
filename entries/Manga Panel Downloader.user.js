// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.5.0
// @description  Downloads manga/manhwa panels as ZIP — pipeline download, retry, abort, fast scrolling
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @match        *://*/*
// @grant        GM.addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.registerMenuCommand
// @grant        GM.deleteValue
// @grant        GM.setValue
// @connect      self
// (was @connect * — broad connectivity needed for diverse manga sites; restricted to self for MV3)
// @run-at       document-idle
// @sandbox      raw
// @noframes
// @grant        window.onurlchange
// @require      https://raw.githubusercontent.com/Tampermonkey/utils/refs/heads/main/requires/gh_2215_make_GM_xhr_more_parallel_again.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

'use strict';

import { MangaDownloader } from '../src/manga-panel-downloader/_download-controller.js';
import { createLogger } from '../src/manga-panel-downloader/_logger.js';

const logger = createLogger('MPD');
const downloader = new MangaDownloader(logger);
downloader.init();

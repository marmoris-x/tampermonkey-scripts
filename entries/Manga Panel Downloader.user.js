// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.5.1
// @description  Downloads manga/manhwa panels as ZIP — pipeline download, retry, abort, fast scrolling
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @match        *://*/*
// @grant        GM.xmlHttpRequest
// @grant        GM.registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// Required: manga images served from arbitrary CDNs (cloudfront, img-*.cdn, etc.)
// Cannot enumerate — @connect * is the pragmatic choice for this downloader.
// @run-at       document-idle
// @sandbox      raw
// @noframes
// @grant        window.onurlchange
// @require      https://raw.githubusercontent.com/Tampermonkey/utils/refs/heads/main/requires/gh_2215_make_GM_xhr_more_parallel_again.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Manga%20Panel%20Downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Manga%20Panel%20Downloader.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

'use strict';

import { MangaDownloader } from '../src/manga-panel-downloader/_download-controller.js';
import { createLogger } from '../src/manga-panel-downloader/_logger.js';

const logger = createLogger('MPD');
const downloader = new MangaDownloader(logger);
downloader.init();

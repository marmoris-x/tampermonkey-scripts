// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.5.2
// @description  Infinite scroll pagination for AniSearch with rating filter
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=anisearch.de
// @match        https://www.anisearch.de/anime*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @connect      anisearch.de
// @run-at       document-idle
// @sandbox      JavaScript
// @noframes
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/AniSearch%20Endless%20Scroll.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/AniSearch%20Endless%20Scroll.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

'use strict';

import { registerBoot } from '../src/anisearch-endless-scroll/boot.js';

registerBoot();

// ==UserScript==
// @name         Reddit Content Unlocker
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.0.0
// @author       marmoris-x
// @description  Removes NSFW popup, un-blurs content, and makes Reddit accessible
// @homepage     https://github.com/marmoris-x/tampermonkey-scripts
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @sandbox      JavaScript
// @grant        GM_addElement
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        window.onurlchange
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

'use strict';

import { registerBoot } from '../src/reddit-content-unlocker/boot.js';
registerBoot();

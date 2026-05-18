// ==UserScript==
// @name         Reddit Content Unlocker
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.4.0
// @author       marmoris-x
// @description  Removes NSFW popup, un-blurs content, and makes Reddit accessible
// @homepage     https://github.com/marmoris-x/tampermonkey-scripts
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Reddit%20Content%20Unlocker.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Reddit%20Content%20Unlocker.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @match        https://old.reddit.com/*
// @grant        window.onurlchange
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

'use strict';

import { registerBoot } from '../src/reddit-content-unlocker/boot.js';
registerBoot();

// ==UserScript==
// @name         PromptInjector
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.0.0
// @author       marmoris-x
// @description  Injects structured, multi-lingual prompt prefixes into any AI chat input
// @homepage     https://github.com/marmoris-x/tampermonkey-scripts
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/PromptInjector.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/PromptInjector.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @match        *://*/*
// @run-at       document-idle
// @sandbox      JavaScript
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM.unregisterMenuCommand
// @grant        GM.addElement
// @grant        unsafeWindow
// @grant        window.onurlchange
// @tag          ai
// @tag          chat
// @tag          prompt
// @tag          productivity
// @compatible   firefox chrome edge
// @license      MIT
// ==/UserScript==

'use strict';

import { registerBoot } from '../src/prompt-injector/boot.js';
registerBoot();

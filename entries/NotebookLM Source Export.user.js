// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.18
// @description  Export NotebookLM sources as organized ZIP with markdown conversion
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @match        https://notebooklm.google.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addElement
// @run-at       document-idle
// @noframes
// @sandbox       JavaScript
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

'use strict';

import { registerMenuStart } from '../src/notebooklm-source-export/extractor.js';
import { initUI } from '../src/notebooklm-source-export/ui.js';

registerMenuStart(() => { initUI(); });

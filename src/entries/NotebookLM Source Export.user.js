// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.5
// @description  Export NotebookLM sources as organized ZIP with markdown conversion
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @match        https://notebooklm.google.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

import { createLogger } from '../shared/logging-utils.js';
import { registerMenuCommands } from '../notebooklm-source-export/extractor.js';

// Logger for the entry orchestrator
createLogger('NotebookLM Source Export');

// Bootstrap: register the menu command that creates the UI on demand
registerMenuCommands();

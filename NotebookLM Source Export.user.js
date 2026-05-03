// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.4
// @description  Export NotebookLM sources as organized ZIP with markdown conversion
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @match        https://notebooklm.google.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/ui-components.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/zip-builder.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/markdown-converter.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/notebooklm-source-export/ui-panel.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/notebooklm-source-export/extractor.js
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // Logger for the entry orchestrator
    TM.createLogger('NotebookLM Source Export');

    // Bootstrap: register the menu command that creates the UI on demand
    globalThis.__NLM__.registerMenuCommands();

})();

// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      6.1
// @description  Export NotebookLM sources and chat as ZIP archives
// @author       marmoris-x
// @icon          https://www.google.com/s2/favicons?sz=64&domain=https://notebooklm.google/
// @match        https://notebooklm.google.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addElement
// @grant        GM_download
// @grant        GM_notification
// @run-at       document-idle
// @noframes
// @sandbox      JavaScript
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

'use strict';

import { exportSources, exportChat, STATE } from '../src/notebooklm-source-export/extractor.js';
import { createProgress } from '../src/notebooklm-source-export/progress.js';

var _busy = false;

GM_registerMenuCommand('Export Chat', function () {
  if (_busy) return;
  _busy = true;
  var progress = createProgress('chat', null);
  exportChat({
    onStatus: function (t) { progress.setStatus(t); },
    onComplete: function (m) { progress.complete(m); _busy = false; },
    onError: function (m) { progress.error(m); _busy = false; }
  });
});

GM_registerMenuCommand('Export Sources', function () {
  if (_busy) return;
  _busy = true;
  var progress = createProgress('sources', function () { STATE.isCancelled = true; });
  exportSources({
    onProgress: function (c, t, f) { progress.update(c, t, f); },
    onComplete: function (m) { progress.complete(m); _busy = false; },
    onError: function (m) { progress.error(m); _busy = false; },
    onCancelled: function (m) { progress.cancel(m); _busy = false; }
  });
});

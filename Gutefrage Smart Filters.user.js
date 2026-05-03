// ==UserScript==
// @name         Gutefrage Smart Filters
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.9
// @description  Enhanced filtering options and automatic tag management for gutefrage.net
// @author       marmoris
// @match        https://www.gutefrage.net/*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=gutefrage.net
// @grant        GM_addStyle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_openInTab
// @grant        window.close
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/dom-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/storage-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/ui-components.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/i18n-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/gutefrage-smart-filters/tag-remover.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/gutefrage-smart-filters/filter-engine.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/gutefrage-smart-filters/feed-navigation.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/gutefrage-smart-filters/ui-panel.js
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Gutefrage%20Smart%20Filters.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Gutefrage%20Smart%20Filters.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var log = TM.createLogger('Gutefrage Smart Filters');
  var GSF = window.__GSF__;

  // ---- Native FilterMenu improvements ----
  GM_addStyle([
    '.FilterMenu { max-height:60vh !important; overflow-y:auto !important; overflow-x:hidden !important; padding-right:10px !important; position:relative !important; scrollbar-width:thin; scrollbar-color:rgba(0,0,0,0.3) rgba(0,0,0,0.1); }',
    '.FilterMenu::-webkit-scrollbar { width:6px; }',
    '.FilterMenu::-webkit-scrollbar-track { background:rgba(0,0,0,0.1); border-radius:3px; }',
    '.FilterMenu::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.3); border-radius:3px; }',
    '.FilterMenu::-webkit-scrollbar-thumb:hover { background:rgba(0,0,0,0.5); }',
    '.Toggletip-content { max-height:70vh !important; }',
    '.FilterMenu-section { position:sticky; top:-1px; background:inherit; z-index:1; padding-bottom:5px; }'
  ].join('\n'));

  log.log('Initializing...');

  new GSF.TagRemover();

  var filterIntegration = new GSF.EnhancedFilterIntegration();
  filterIntegration.init().then(function () {
    new GSF.SidebarPanel(filterIntegration);
  });

  log.log('Ready!');
})();

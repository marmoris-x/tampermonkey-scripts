// ==UserScript==
// @name           TikTok Link Fixer
// @name:de        TikTok-Link-Reparatur
// @namespace      https://github.com/marmoris-x/tampermonkey-scripts
// @version        6.0.0
// @author         marmoris-x
// @description    Restores middle-click and right-click functionality on TikTok video links. Makes non-clickable links behave normally.
// @description:de Stellt die Mittelklick- und Rechtsklick-Funktion auf TikTok-Videolinks wieder her. Macht nicht anklickbare Links wieder normal bedienbar.
// @license        MIT
// @homepageURL    https://github.com/marmoris-x/tampermonkey-scripts
// @supportURL     https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/tiktok-link-fixer.user.js
// @updateURL      https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/tiktok-link-fixer.user.js
// @icon           https://www.google.com/s2/favicons?sz=64&domain=tiktok.com
// @tag            social
// @tag            video
// @match          *://*.tiktok.com/*
// @grant          GM_addStyle
// @grant          window.onurlchange
// @run-at         document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Logger
  // ---------------------------------------------------------------------------
  var LOG_PREFIX = '[TikTok Link Fixer]';

  function createLogger() {
    var debugMode = false;
    return {
      log: function () {
        var args = [LOG_PREFIX];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      info: function () {
        var args = [LOG_PREFIX];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      warn: function () {
        var args = [LOG_PREFIX];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function () {
        var args = [LOG_PREFIX];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      debug: function () {
        if (!debugMode) return;
        var args = [LOG_PREFIX];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.debug.apply(console, args);
      },
      setDebug: function (v) { debugMode = !!v; }
    };
  }

  var log = createLogger();

  // ---------------------------------------------------------------------------
  // CSS — force pointer events on video links, remove blocking overlays
  // ---------------------------------------------------------------------------
  var CSS_RULES = [
    'a[class*="LinkNonClickable"],',
    'a[data-e2e="feed-video"],',
    'a[href*="/video/"]:not([class*="LinkNonClickable"]) {',
    '  pointer-events: auto !important;',
    '  cursor: pointer !important;',
    '}',
    '.event-delegate-mask,',
    'div[class*="DivPlayerContainer"] {',
    '  pointer-events: none !important;',
    '}'
  ].join('\n');

  function injectStyles() {
    GM_addStyle(CSS_RULES);
    log.info('Styles injected');
  }

  // ---------------------------------------------------------------------------
  // Find the nearest video link (handles TikTok's deep nesting)
  // ---------------------------------------------------------------------------
  function findVideoLink(target) {
    var link = target.closest('a[href*="/video/"]');
    if (link) return link;

    var current = target;
    var MAX_DEPTH = 10;
    for (var depth = 0; current && depth < MAX_DEPTH; depth++) {
      link = current.querySelector('a[href*="/video/"]');
      if (link) return link;
      current = current.parentElement;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  function onAuxClick(event) {
    if (event.button !== 1) return;
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.preventDefault();

    var link = findVideoLink(event.target);
    if (link && link.href) {
      window.open(link.href, '_blank');
      log.debug('Middle-click opened: ' + link.href);
    }
  }

  function onContextMenu(event) {
    // Let the native context menu appear — just stop TikTok from capturing
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function onMouseDown(event) {
    if (event.button === 1) {
      event.preventDefault(); // prevent the scroll icon / auto-scroll cursor
    }
  }

  function attachInterceptors() {
    window.addEventListener('auxclick', onAuxClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('mousedown', onMouseDown, true);
    log.info('Event interceptors attached');
  }

  // ---------------------------------------------------------------------------
  // SPA navigation support
  // ---------------------------------------------------------------------------
  var initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    log.info('Starting TikTok Link Fixer v6.0.0');
    injectStyles();
    attachInterceptors();
    log.info('Initialization complete');
  }

  init();

  // Re-init on SPA navigation (TikTok uses client-side routing)
  // The `initialized` flag ensures we only run once until a navigation occurs.
  if (typeof window.onurlchange !== 'undefined') {
    window.addEventListener('urlchange', function () {
      initialized = false;
      init();
    });
  }
})();

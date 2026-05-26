// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.0.2
// @author       marmoris-x
// @description  Auto max video quality, per-channel playback speed control, auto-stop & anti-translate (titles, descriptions, audio, subtitles, notifications, channel branding, thumbnails).
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @match        *://*.youtube.com/*
// @match        *://*.youtube-nocookie.com/*
// @sandbox      raw
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM.registerMenuCommand
// @run-at       document-start
// ==/UserScript==

/*
 * YouTube Enhanced — modular ESM build
 *   auto-hd.js              — Patches localStorage & YouTube player for max quality
 *   channel-speed.js        — Per-channel speed control with native-UI panel
 *   auto-stop.js            — Pauses auto-play on video pages
 *   _anti-translate-core.js — Core namespace (window.YoutubeAntiTranslate)
 *   anti-translate-titles.js— Title/thumbnail/snippet untranslation
 *   anti-translate-audio.js — Original audio track restoration
 *   anti-translate-description.js — Description/chapter/snippet untranslation
 *   anti-translate-notifications.js — Notification title untranslation
 *   anti-translate-subtitles.js — Subtitle track selection
 *   anti-translate-channelbranding.js — Channel branding restoration
 *   boot.js                 — Orchestrator for boot and SPA navigation
 *
 * All modules use ES module imports/exports instead of window.__YTE__.
 * This entry file imports boot and bootstraps.
 */

import { boot } from '../src/youtube-enhanced/boot.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { boot(); });
} else {
  boot();
}

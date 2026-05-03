// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.6.0
// @description  Auto max video quality, per-channel playback speed control & auto-stop on page load.
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @match        *://*.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-start
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/dom-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/storage-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/i18n-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/youtube-enhanced/auto-hd.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/youtube-enhanced/channel-speed.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/youtube-enhanced/auto-stop.js
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

/*
 * YouTube Enhanced -- three modules:
 *   auto-hd.js         -- Patches localStorage & YouTube player for max quality
 *   channel-speed.js   -- Per-channel speed control with native-UI panel
 *   auto-stop.js       -- Pauses auto-play on video pages
 *
 * All modules are loaded via @require and extend window.__YTE__.
 * This entry file sets up shared config, language strings, and bootstraps.
 */

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // NAMESPACE SETUP (extends what sub-modules already registered)
    // ─────────────────────────────────────────────────────────────────────────

    var YTE = window.__YTE__;

    YTE.CFG = {
        debug: false,
        preferredQuality: 8,    // Fallback: 0=Auto  5=720p  6=1080p  7=1440p  8=2160p/4K
        SPEED_KEY:    'yt_suite_channel_speeds',
        MENU_DELAY:   50,
        SPEED_RETRY:  1000,
        INIT_TIMEOUT: 15000,
    };

    YTE.QUALITY_MAP = {
        0: 'auto',
        5: 'hd720',
        6: 'hd1080',
        7: 'hd1440',
        8: 'hd2160'
    };

    YTE.log = TM.createLogger('YouTube Enhanced', YTE.CFG.debug);

    function getLanguage() {
        var browserLang = navigator.language;
        if (browserLang && browserLang.toLowerCase().startsWith('de')) {
            return 'de';
        }
        return 'en';
    }

    YTE.LANG = (function () {
        var isGerman = getLanguage() === 'de';

        return {
            isGerman: isGerman,
            backToPreviousMenu: isGerman ? 'Zuruck zum vorherigen Menu' : 'Back to previous menu',
            channelSpeed: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed',
            decreaseSpeed: isGerman ? 'Kanalgeschwindigkeit reduzieren 0.05' : 'Decrease speed 0.05',
            increaseSpeed: isGerman ? 'Kanalgeschwindigkeit erhoben 0.05' : 'Increase speed 0.05',
            standard: isGerman ? 'Standard' : 'Normal',
            channelSpeedLabel: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed'
        };
    })();

    // Trackers for SPAs (YouTube recycles the <video> tag)
    YTE.handledVidsHD = new WeakSet();
    YTE.handledVids   = new WeakSet();

    YTE.resetVideoTrackers = function () {
        YTE.handledVidsHD = new WeakSet();
        YTE.handledVids   = new WeakSet();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // BOOTSTRAP
    // ─────────────────────────────────────────────────────────────────────────

    YTE.patchQuality();

    window.addEventListener('yt-navigate-finish', async function () {
        YTE.resetVideoTrackers(); // Mandatory for SPAs so auto-stop and HD apply to subsequent videos
        await YTE.loadSpeedData();
        YTE.patchQuality();

        YTE.cleanupSpeed();
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            YTE.initSpeed();
        }

        YTE.cleanupAutoStop();
        YTE.initAutoStop();
    });

    async function boot() {
        await YTE.loadSpeedData();
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            YTE.initSpeed();
        }
        YTE.initAutoStop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { boot(); });
    } else {
        boot();
    }

})();

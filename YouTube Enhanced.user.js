// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.5.3
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
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // SHARED CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    const CFG = {
        debug: false,
        preferredQuality: 8,    // Fallback: 0=Auto  5=720p  6=1080p  7=1440p  8=2160p/4K
        SPEED_KEY:    'yt_suite_channel_speeds',
        MENU_DELAY:   50,
        SPEED_RETRY:  1000,
        INIT_TIMEOUT: 15000,
    };

    const QUALITY_MAP = {
        0: 'auto',
        5: 'hd720',
        6: 'hd1080',
        7: 'hd1440',
        8: 'hd2160'
    };

    const log = TM.createLogger('YouTube Enhanced', CFG.debug);

    function getLanguage() {
        const browserLang = navigator.language;
        if (browserLang && browserLang.toLowerCase().startsWith('de')) {
            return 'de';
        }
        return 'en';
    }

    const LANG = (function () {
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

    var THIRTY_DAYS_MS = 2592000000;
    var PS_PLAYING     = 1; // YouTube player state: PLAYING
    var PS_BUFFERING   = 3; // YouTube player state: BUFFERING

    function roundSpeed(v) { return Math.round(v * 100) / 100; }
    function clampSpeed(v) { return Math.max(0.25, Math.min(3, v)); }

    // Trackers for SPAs (YouTube recycles the <video> tag)
    var handledVidsHD = new WeakSet();
    var handledVids   = new WeakSet();

    function resetVideoTrackers() {
        handledVidsHD = new WeakSet();
        handledVids   = new WeakSet();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 1 - AUTO HD / 4K (API + LocalStorage Fallback)
    // ═════════════════════════════════════════════════════════════════════════

    function patchQuality() {
        try {
            var KEY = 'yt-player-user-settings';
            var us = {};
            try {
                var raw = localStorage.getItem(KEY);
                if (raw) {
                    var p = JSON.parse(raw);
                    if (p && p.data) us = JSON.parse(p.data);
                }
            } catch (_) { }

            var now = Date.now();
            us['482'] = { intValue: CFG.preferredQuality };
            localStorage.setItem(KEY, JSON.stringify({
                creation:   now,
                data:       JSON.stringify(us),
                expiration: now + THIRTY_DAYS_MS,
            }));

            // New YouTube quality key — forces player to preferred quality
            localStorage.setItem('yt-player-quality', JSON.stringify({
                data: JSON.stringify({ quality: QUALITY_MAP[CFG.preferredQuality], previousQuality: "auto" }),
                expiration: now + THIRTY_DAYS_MS,
                creation: now
            }));
        } catch (e) { log.debug('patchQuality error:', e); }
    }

    // Intervenes via native player API to force highest available quality
    function applyAutoHD(ytPlayer) {
        try {
            if (!ytPlayer || typeof ytPlayer.getAvailableQualityLevels !== 'function') return;

            var levels = ytPlayer.getAvailableQualityLevels();
            if (!levels || levels.length === 0) return;

            var desired = QUALITY_MAP[CFG.preferredQuality];
            var targetQuality = null;

            if (desired && desired !== 'auto') {
                targetQuality = levels.find(function (q) { return q === desired; });
            }

            if (!targetQuality) {
                // Fallback: highest non-auto quality
                targetQuality = levels.find(function (q) { return q && q !== 'auto'; });
            }

            if (targetQuality) {
                if (typeof ytPlayer.setPlaybackQualityRange === 'function') {
                    ytPlayer.setPlaybackQualityRange(targetQuality, targetQuality); // Sets both min and max
                }
                log.debug('AutoHD: Set to', targetQuality);
            }
        } catch (e) { log.debug('applyAutoHD error:', e); }
    }

    function initAutoHD(ytPlayer, vid) {
        if (!ytPlayer || !vid || handledVidsHD.has(vid)) return;
        handledVidsHD.add(vid);

        var force = function () { return applyAutoHD(ytPlayer); };

        force(); // Apply immediately
        vid.addEventListener('loadedmetadata', force, { once: true }); // When resolution data is available
        vid.addEventListener('playing', function () { setTimeout(force, 100); }, { once: true }); // Safety catch when playback starts
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 2 - CHANNEL SPEED CONTROLLER (STRICT 1:1 NATIVE UI & ANIMATION)
    // ═════════════════════════════════════════════════════════════════════════

    var speedCache      = {};
    var speedObs        = new Set();
    var speedAbort      = null;
    var speedRetryTimeout = null;
    var speedInitTimeout  = null;
    var currentChannelId  = null;
    var isApplyingSpeed   = false;
    var menuPanel         = null;
    var customPanel       = null;
    var inCustomPanel     = false;

    var origMenuWidth  = '';
    var origMenuHeight = '';

    function getSpeeds() { return speedCache; }

    async function loadSpeedData() {
        try {
            speedCache = await TM.storage.loadSetting(CFG.SPEED_KEY, {});
        } catch (_) { speedCache = {}; }
    }

    async function saveSpeed(cid, val) {
        try {
            speedCache[cid] = val;
            await TM.storage.saveSetting(CFG.SPEED_KEY, speedCache);
        } catch (e) { log.debug('saveSpeed error:', e); }
    }

    function applySpeed(val) {
        try {
            var vid = document.querySelector('.html5-main-video');
            if (vid && Math.abs(vid.playbackRate - val) > 0.001) {
                isApplyingSpeed = true;
                try {
                    vid.playbackRate = val;
                } finally {
                    isApplyingSpeed = false;
                }
            }
        } catch (e) { log.debug('applySpeed error:', e); }
    }

    function getChannelId() {
        try {
            // Try regular video page channel link
            var a = document.querySelector('#upload-info #channel-name #text a');
            if (a) return new URL(a.href).pathname.split('/').pop();

            // Try Shorts page channel link
            var shortsChannel = document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a');
            if (shortsChannel) return new URL(shortsChannel.href).pathname.split('/').pop();

            // Try any channel link as fallback (prefer @handle over /channel/)
            var anyChannel = document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
            if (anyChannel) return new URL(anyChannel.href).pathname.split('/').pop();
        } catch (_) {}
        return null;
    }

    function buildSpeedPanel(settingsMenu) {
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = '<div class="ytp-panel" style="width: 330px; height: 250px;"><div class="ytp-panel-header"><div class="ytp-panel-back-button-container"><button class="ytp-button ytp-panel-back-button" aria-label="' + LANG.backToPreviousMenu + '"></button></div><span class="ytp-panel-title" role="heading" aria-level="2">' + LANG.channelSpeed + '</span></div><div class="ytp-variable-speed-panel-content" tabindex="0" style="height: 193px;"><div class="ytp-speed-display-container"><div class="ytp-variable-speed-panel-display" aria-live="polite"><div class="ytp-variable-speed-panel-premium-badge" tabindex="-1"><div class="ytp-variable-speed-panel-badge"></div></div><span>1.00x</span></div></div><div class="ytp-variable-speed-panel-slider-container"><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="' + LANG.decreaseSpeed + '"><span>-</span></button><div class="ytp-input-slider-section"><div class="ytp-speedslider-indicator-container"><div class="ytp-speedslider-badge" aria-label=""><\/div><p class="ytp-speedslider-text">1.00x<\/p><\/div><input class="ytp-input-slider ytp-speedslider ytp-varispeed-input-slider" role="slider" tabindex="0" type="range" min="0.25" max="3" step="0.05" value="1" aria-valuenow="1" aria-valuemin="0.25" aria-valuemax="3" aria-valuetext="1.00" style="--yt-slider-shape-gradient-percent: 42.857142857142854%;"><\/div><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="' + LANG.increaseSpeed + '"><span>+<\/span><\/button><\/div><div class="ytp-variable-speed-panel-chips"><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="5" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1<\/span><\/button><div class="ytp-variable-speed-panel-preset-button-label-text">' + LANG.standard + '<\/div><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="2" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,25<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="3" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,5<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="0" aria-hidden="true" style="display: none;"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,75<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="4" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>2<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="1" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><div class="ytp-variable-speed-panel-premium-upsell-icon"><\/div><span>3.0<\/span><\/button><\/div><\/div><\/div><\/div>';
        var panel = tempDiv.firstChild;

        var cid = currentChannelId;
        if (!cid) cid = getChannelId();
        var stored = getSpeeds();
        var curSpeed = cid && stored[cid] ? stored[cid] : 1.0;

        var backBtn = panel.querySelector('.ytp-panel-back-button');
        var displayTxt = panel.querySelector('.ytp-variable-speed-panel-display span');
        var sliderTxt = panel.querySelector('.ytp-speedslider-text');
        var slider = panel.querySelector('input[type="range"]');
        var btns = panel.querySelectorAll('.ytp-variable-speed-panel-increment-button');
        var btnDec = btns[0];
        var btnInc = btns[1];
        var chips = panel.querySelectorAll('.ytp-variable-speed-panel-preset-button-wrapper button');

        // Localize chip numbers based on language
        if (!LANG.isGerman) {
            chips.forEach(function (btn) {
                var span = btn.querySelector('span');
                if (!span) return;
                span.textContent = span.textContent.replace(',', '.');
            });
        } else {
            chips.forEach(function (btn) {
                var span = btn.querySelector('span');
                if (!span) return;
                span.textContent = span.textContent.replace('.', ',');
            });
        }

        backBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            closeSpeedPanel(settingsMenu);
        });

        function getSliderPercent(v) {
            var clamped = clampSpeed(v);
            return (Math.max(0, Math.min(1, (clamped - 0.25) / (3 - 0.25))) * 100).toFixed(6) + '%';
        }

        function refreshUI(v) {
            curSpeed = v;
            var strVal = v.toFixed(2) + 'x';
            if (displayTxt) displayTxt.textContent = strVal;
            if (sliderTxt) sliderTxt.textContent = strVal;

            var clampedSlider = clampSpeed(v);
            if (slider) {
                slider.value = String(clampedSlider);
                slider.setAttribute('aria-valuenow', String(v));
                slider.setAttribute('aria-valuetext', v.toFixed(2));
                slider.style.setProperty('--yt-slider-shape-gradient-percent', getSliderPercent(v));
            }

            chips.forEach(function (btn) {
                var span = btn.querySelector('span');
                if (!span) return;
                var btnVal = parseFloat(span.textContent.replace(',', '.'));
                if (Math.abs(btnVal - v) < 0.001) {
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                } else {
                    btn.style.backgroundColor = 'transparent';
                }
            });
        }

        function commit(v) {
            var rounded = roundSpeed(v);
            refreshUI(rounded);
            if (cid) {
                saveSpeed(cid, rounded);
            }
            applySpeed(rounded);
            updateMenuItemText(rounded);
        }

        if (slider) {
            slider.addEventListener('input', function (e) { commit(parseFloat(e.target.value)); });
        }
        if (btnDec) {
            btnDec.addEventListener('click', function (e) {
                e.stopPropagation();
                commit(Math.max(0.25, roundSpeed(curSpeed - 0.05)));
            });
        }
        if (btnInc) {
            btnInc.addEventListener('click', function (e) {
                e.stopPropagation();
                commit(Math.min(3.0, roundSpeed(curSpeed + 0.05)));
            });
        }

        chips.forEach(function (btn) {
            var span = btn.querySelector('span');
            if (!span) return;
            var speedVal = parseFloat(span.textContent.replace(',', '.'));
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                commit(speedVal);
            });
        });

        refreshUI(curSpeed);
        return panel;
    }

    function openSpeedPanel(settingsMenu) {
        if (inCustomPanel) return;
        menuPanel = settingsMenu.querySelector('.ytp-panel');
        if (!menuPanel) return;

        origMenuWidth = settingsMenu.style.width;
        origMenuHeight = settingsMenu.style.height;

        inCustomPanel = true;
        customPanel = buildSpeedPanel(settingsMenu);
        settingsMenu.appendChild(customPanel);

        menuPanel.style.display = 'none';
        settingsMenu.style.width = '330px';
        settingsMenu.style.height = '250px';
    }

    function closeSpeedPanel(settingsMenu) {
        if (!inCustomPanel) return;

        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }

        settingsMenu.style.width = origMenuWidth;
        settingsMenu.style.height = origMenuHeight;

        inCustomPanel = false;
    }

    function updateMenuItemText(speed) {
        var el = document.querySelector('#yts-chan-speed .ytp-menuitem-content');
        if (el) el.textContent = speed === 1 ? LANG.standard : speed.toFixed(2) + 'x';
    }

    var SPEED_TERMS = ['speed','geschwindigkeit','velocidad','vitesse','速度','속도','velocita','hizi','snelheid','kecepatan','toc do','ความเร็ว','predkosc','скорость','سرعة','velocidade','hastighet','rychlost'];

    function insertSpeedMenuItem() {
        var menu = document.querySelector('.ytp-settings-menu');
        if (!menu) return false;
        var panelMenu = menu.querySelector('.ytp-panel-menu');
        if (!panelMenu) return false;

        if (document.querySelector('#yts-chan-speed')) return true;

        var ytSpeedItem = null;
        var items = panelMenu.querySelectorAll('.ytp-menuitem');
        for (var i = 0; i < items.length; i++) {
            var lbl = items[i].querySelector('.ytp-menuitem-label');
            if (lbl && TM.i18n.matchAnyTerm(lbl.textContent, SPEED_TERMS)) {
                ytSpeedItem = items[i];
                break;
            }
        }
        if (!ytSpeedItem) return false;

        var cid   = getChannelId();
        var stored = getSpeeds();
        var saved = cid ? stored[cid] : undefined;
        var label = saved && saved !== 1 ? saved.toFixed(2) + 'x' : LANG.standard;

        var item = document.createElement('div');
        item.id        = 'yts-chan-speed';
        item.className = 'ytp-menuitem';
        item.setAttribute('role',         'menuitem');
        item.setAttribute('tabindex',     '0');
        item.setAttribute('aria-haspopup','true');
        item.innerHTML = '<div class="ytp-menuitem-icon"><svg height="24" viewBox="0 0 24 24" width="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M9.5 16.5v-9l7 4.5z"/></svg></div><div class="ytp-menuitem-label">' + LANG.channelSpeedLabel + '</div><div class="ytp-menuitem-content">' + label + '</div>';

        item.addEventListener('click', function (e) {
            e.stopPropagation();
            openSpeedPanel(menu);
        });

        ytSpeedItem.insertAdjacentElement('afterend', item);
        return true;
    }

    function syncSpeedMenuDisplay() {
        insertSpeedMenuItem();
        var s = getSpeeds()[getChannelId()];
        if (s) updateMenuItemText(s);
    }

    function watchSettingsMenu(signal, retryCount) {
        if (retryCount === undefined) retryCount = 3;
        var menu = document.querySelector('.ytp-settings-menu');
        var btn  = document.querySelector('.ytp-settings-button');
        if (!menu || !btn) {
            if (retryCount > 0) {
                setTimeout(function () { watchSettingsMenu(signal, retryCount - 1); }, 500);
            }
            return;
        }

        var obs = new MutationObserver(function () {
            if (menu.style.display === 'none') {
                if (inCustomPanel) closeSpeedPanel(menu);
            } else {
                setTimeout(syncSpeedMenuDisplay, CFG.MENU_DELAY);
            }
        });
        obs.observe(menu, { attributes: true, attributeFilter: ['style'] });
        speedObs.add(obs);

        btn.addEventListener('click', function () {
            setTimeout(function () {
                var m = document.querySelector('.ytp-settings-menu');
                if (m && m.style.display !== 'none') syncSpeedMenuDisplay();
            }, CFG.MENU_DELAY);
        }, { signal: signal });
    }

    function initSpeed() {
        if (speedRetryTimeout) clearTimeout(speedRetryTimeout);
        if (speedInitTimeout) clearTimeout(speedInitTimeout);

        function checkAndSetup(obs) {
            try {
                var vid = document.querySelector('.html5-main-video');
                var chan = document.querySelector('#upload-info #channel-name #text a') ||
                             document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a') ||
                             document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
                if (!vid || !chan) return;

                obs.disconnect();
                speedObs.delete(obs);

                var cid = new URL(chan.href).pathname.split('/').pop();
                var stored = getSpeeds();
                var saved = stored[cid];
                currentChannelId = cid;

                if (speedAbort) speedAbort.abort();
                speedAbort = new AbortController();

                vid.addEventListener('ratechange', function () {
                    if (isApplyingSpeed) return;
                    var currentSaved = getSpeeds()[currentChannelId];
                    if (currentSaved && Math.abs(vid.playbackRate - currentSaved) > 0.01) {
                        isApplyingSpeed = true;
                        vid.playbackRate = currentSaved;
                        isApplyingSpeed = false;
                    }
                }, { signal: speedAbort.signal });

                if (saved) {
                    applySpeed(saved);
                    speedRetryTimeout = setTimeout(function () { applySpeed(saved); }, CFG.SPEED_RETRY);
                }

                watchSettingsMenu(speedAbort.signal);
            } catch (e) { log.debug('initSpeed error:', e); }
        }

        var obs = TM.dom.observeMutations(function (addedNode, obs) {
            checkAndSetup(obs);
        }, document.documentElement);
        speedObs.add(obs);

        // Immediate check for already-present elements
        checkAndSetup(obs);

        speedInitTimeout = setTimeout(function () {
            obs.disconnect();
            speedObs.delete(obs);
            log.debug('initSpeed: Timeout reached, no channel found');
        }, CFG.INIT_TIMEOUT);
    }

    function cleanupSpeed() {
        speedObs.forEach(function (o) { try { o.disconnect(); } catch (_) {} });
        speedObs.clear();

        if (speedAbort) { speedAbort.abort(); speedAbort = null; }
        if (speedRetryTimeout) { clearTimeout(speedRetryTimeout); speedRetryTimeout = null; }
        if (speedInitTimeout) { clearTimeout(speedInitTimeout); speedInitTimeout = null; }
        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }
        currentChannelId = null;
        inCustomPanel = false;
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 3 - AUTO-STOP PLAYBACK
    // ═════════════════════════════════════════════════════════════════════════

    var STOP_PATHS  = ['/channel','/watch','/shorts','/@','/playlist','/live'];
    var stopObs     = null;

    function stopVideoPlayback(youtubePlayer, videoElement) {
        if (!youtubePlayer || !videoElement || handledVids.has(videoElement)) return;

        handledVids.add(videoElement);

        try {
            var playerState = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : undefined;
            if (playerState === PS_PLAYING || playerState === PS_BUFFERING) {
                youtubePlayer.pauseVideo();
            }
        } catch (error) {
            log.warn('Error pausing video:', error);
        }

        // One-time event listener to catch auto-play
        var hasIntercepted = false;

        var handleAutoPlay = function () {
            if (hasIntercepted) return;

            try {
                var state = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : undefined;
                if (state === PS_PLAYING || state === PS_BUFFERING) {
                    hasIntercepted = true;
                    youtubePlayer.pauseVideo();

                    videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                    videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
                }
            } catch (error) {
                log.warn('Error in event handler:', error);
            }
        };

        videoElement.addEventListener('play', handleAutoPlay, { capture: true });
        videoElement.addEventListener('playing', handleAutoPlay, { capture: true });

        // Fallback: remove listeners after short delay to allow manual play
        setTimeout(function () {
            if (!hasIntercepted) {
                videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
            }
        }, 2000);
    }

    function checkForPlayer() {
        var playerElement = document.querySelector('ytd-player');
        var videoElement = document.querySelector('.html5-main-video');

        // Bugfix: removed "|| document.getElementById('movie_player')".
        // Requiring the player API on the element prevents ghost players
        // from prior videos triggering too early.
        var youtubePlayer = playerElement ? playerElement.player_ : undefined;

        if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
            stopVideoPlayback(youtubePlayer, videoElement);
            initAutoHD(youtubePlayer, videoElement); // Couples API-driven Auto-HD directly here
            cleanupAutoStop();
            return true;
        }
        return false;
    }

    function initAutoStop() {
        if (!STOP_PATHS.some(function (p) { return location.pathname.startsWith(p); })) {
            cleanupAutoStop();
            return;
        }

        if (checkForPlayer()) return;

        if (stopObs) stopObs.disconnect();
        stopObs = TM.dom.observeMutations(function (addedNode, obs) {
            if (checkForPlayer()) obs.disconnect();
        }, document.documentElement);

        setTimeout(checkForPlayer, 100);
    }

    function cleanupAutoStop() {
        if (stopObs) { stopObs.disconnect(); stopObs = null; }
    }


    // ═════════════════════════════════════════════════════════════════════════
    // BOOTSTRAP
    // ═════════════════════════════════════════════════════════════════════════

    patchQuality();

    window.addEventListener('yt-navigate-finish', async function () {
        resetVideoTrackers(); // Mandatory for SPAs so auto-stop and HD apply to subsequent videos
        await loadSpeedData();
        patchQuality();

        cleanupSpeed();
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            initSpeed();
        }

        cleanupAutoStop();
        initAutoStop();
    });


    async function boot() {
        await loadSpeedData();
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            initSpeed();
        }
        initAutoStop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { boot(); });
    } else {
        boot();
    }

})();

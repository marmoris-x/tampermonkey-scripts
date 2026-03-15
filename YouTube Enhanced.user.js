// ==UserScript==
// @name         YouTube Enhanced
// @namespace    http://tampermonkey.net/
// @version      1.5.1
// @description  Auto max video quality, per-channel playback speed control & auto-stop on page load.
// @author       marmoris
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @icon         https://www.youtube.com/favicon.ico
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
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

    const log = (...a) => { if (CFG.debug) console.log('[YT-Suite]', ...a); };

    function getLanguage() {
        // Check browser UI language (primary preference)
        const browserLang = navigator.language;
        if (browserLang && browserLang.toLowerCase().startsWith('de')) {
            return 'de';
        }

        return 'en'; // Default
    }

    // Language configuration
    const LANG = (() => {
        const isGerman = getLanguage() === 'de';

        return {
            isGerman,
            // Panel and menu labels
            backToPreviousMenu: isGerman ? 'Zurück zum vorherigen Menü' : 'Back to previous menu',
            channelSpeed: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed',
            decreaseSpeed: isGerman ? 'Kanalgeschwindigkeit reduzieren 0.05' : 'Decrease speed 0.05',
            increaseSpeed: isGerman ? 'Kanalgeschwindigkeit erhöhen 0.05' : 'Increase speed 0.05',
            standard: isGerman ? 'Standard' : 'Normal',
            channelSpeedLabel: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed'
        };
    })();

    const THIRTY_DAYS_MS = 2592000000;
    const PS_PLAYING    = 1; // YouTube player state: PLAYING
    const PS_BUFFERING  = 3; // YouTube player state: BUFFERING

    function roundSpeed(v) { return Math.round(v * 100) / 100; }
    function clampSpeed(v) { return Math.max(0.25, Math.min(3, v)); }

    // Trackers for SPAs (YouTube recycles the <video> tag)
    let handledVidsHD = new WeakSet();
    let handledVids   = new WeakSet();

    function resetVideoTrackers() {
        handledVidsHD = new WeakSet();
        handledVids   = new WeakSet();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 1 · AUTO HD / 4K (API + LocalStorage Fallback)
    // ═════════════════════════════════════════════════════════════════════════

    function patchQuality() {
        try {
            // Alter YouTube Quality Key
            const KEY = 'yt-player-user-settings';
            let us = {};
            try {
                const raw = localStorage.getItem(KEY);
                if (raw) {
                    const p = JSON.parse(raw);
                    if (p && p.data) us = JSON.parse(p.data);
                }
            } catch (_) { }

            const now = Date.now();
            us['482'] = { intValue: CFG.preferredQuality };
            localStorage.setItem(KEY, JSON.stringify({
                creation:   now,
                data:       JSON.stringify(us),
                expiration: now + THIRTY_DAYS_MS,
            }));

            // Neuer YouTube Quality Key (zwingt den Player auf die bevorzugte Qualität)
            localStorage.setItem('yt-player-quality', JSON.stringify({
                data: JSON.stringify({ quality: QUALITY_MAP[CFG.preferredQuality], previousQuality: "auto" }),
                expiration: now + THIRTY_DAYS_MS,
                creation: now
            }));
        } catch (e) { log('patchQuality error:', e); }
    }

    // Greift über die native Player-API ein und zwingt die höchste verfügbare Qualität
    function applyAutoHD(ytPlayer) {
        try {
            if (!ytPlayer || typeof ytPlayer.getAvailableQualityLevels !== 'function') return;

            const levels = ytPlayer.getAvailableQualityLevels();
            if (!levels || levels.length === 0) return;

            const desired = QUALITY_MAP[CFG.preferredQuality];
            let targetQuality = null;

            if (desired && desired !== 'auto') {
                targetQuality = levels.find(q => q === desired);
            }

            if (!targetQuality) {
                // Fallback: highest non-auto quality
                targetQuality = levels.find(q => q && q !== 'auto');
            }

            if (targetQuality) {
                if (typeof ytPlayer.setPlaybackQualityRange === 'function') {
                    ytPlayer.setPlaybackQualityRange(targetQuality, targetQuality); // Setzt Min und Max
                }
                log('AutoHD: Set to', targetQuality);
            }
        } catch (e) { log('applyAutoHD error:', e); }
    }

    function initAutoHD(ytPlayer, vid) {
        if (!ytPlayer || !vid || handledVidsHD.has(vid)) return;
        handledVidsHD.add(vid);

        const force = () => applyAutoHD(ytPlayer);

        force(); // Sofort anwenden
        vid.addEventListener('loadedmetadata', force, { once: true }); // Wenn Auflösungsdaten da sind
        vid.addEventListener('playing', () => setTimeout(force, 100), { once: true }); // Sicherheit beim Loslaufen
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 2 · CHANNEL SPEED CONTROLLER (STRICT 1:1 NATIVE UI & ANIMATION)
    // ═════════════════════════════════════════════════════════════════════════

    let speedCache      = null;
    let speedObs        = new Set();
    let speedAbort      = null;
    let speedRetryTimeout = null;
    let speedInitTimeout  = null;
    let currentChannelId = null;
    let isApplyingSpeed = false;
    let menuPanel       = null;
    let customPanel     = null;
    let inCustomPanel   = false;

    let origMenuWidth  = '';
    let origMenuHeight = '';

    function getSpeeds() {
        if (!speedCache) {
            try { speedCache = GM_getValue(CFG.SPEED_KEY, {}); }
            catch (_) { speedCache = {}; }
        }
        return speedCache;
    }

    function saveSpeed(cid, val) {
        try {
            const s = getSpeeds();
            s[cid] = val;
            speedCache = s;
            GM_setValue(CFG.SPEED_KEY, s);
        } catch (e) { log('saveSpeed error:', e); }
    }

    function applySpeed(val) {
        try {
            const vid = document.querySelector('.html5-main-video');
            if (vid && Math.abs(vid.playbackRate - val) > 0.001) {
                isApplyingSpeed = true;
                try {
                    vid.playbackRate = val;
                } finally {
                    isApplyingSpeed = false;
                }
            }
        } catch (e) { log('applySpeed error:', e); }
    }

    function getChannelId() {
        try {
            // Try regular video page channel link
            const a = document.querySelector('#upload-info #channel-name #text a');
            if (a) return new URL(a.href).pathname.split('/').pop();

            // Try Shorts page channel link
            const shortsChannel = document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a');
            if (shortsChannel) return new URL(shortsChannel.href).pathname.split('/').pop();

            // Try any channel link as fallback (prefer @handle over /channel/)
            const anyChannel = document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
            if (anyChannel) return new URL(anyChannel.href).pathname.split('/').pop();
        } catch (_) {}
        return null;
    }

    function buildSpeedPanel(settingsMenu) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `<div class="ytp-panel" style="width: 330px; height: 250px;"><div class="ytp-panel-header"><div class="ytp-panel-back-button-container"><button class="ytp-button ytp-panel-back-button" aria-label="${LANG.backToPreviousMenu}"></button></div><span class="ytp-panel-title" role="heading" aria-level="2">${LANG.channelSpeed}</span></div><div class="ytp-variable-speed-panel-content" tabindex="0" style="height: 193px;"><div class="ytp-speed-display-container"><div class="ytp-variable-speed-panel-display" aria-live="polite"><div class="ytp-variable-speed-panel-premium-badge" tabindex="-1"><div class="ytp-variable-speed-panel-badge"></div></div><span>1.00x</span></div></div><div class="ytp-variable-speed-panel-slider-container"><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="${LANG.decreaseSpeed}"><span>-</span></button><div class="ytp-input-slider-section"><div class="ytp-speedslider-indicator-container"><div class="ytp-speedslider-badge" aria-label=""></div><p class="ytp-speedslider-text">1.00x</p></div><input class="ytp-input-slider ytp-speedslider ytp-varispeed-input-slider" role="slider" tabindex="0" type="range" min="0.25" max="3" step="0.05" value="1" aria-valuenow="1" aria-valuemin="0.25" aria-valuemax="3" aria-valuetext="1.00" style="--yt-slider-shape-gradient-percent: 42.857142857142854%;"></div><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="${LANG.increaseSpeed}"><span>+</span></button></div><div class="ytp-variable-speed-panel-chips"><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="5" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1</span></button><div class="ytp-variable-speed-panel-preset-button-label-text">${LANG.standard}</div></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="2" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,25</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="3" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,5</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="0" aria-hidden="true" style="display: none;"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,75</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="4" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>2</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="1" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><div class="ytp-variable-speed-panel-premium-upsell-icon"></div><span>3.0</span></button></div></div></div></div>`;
        const panel = tempDiv.firstChild;

        let cid = currentChannelId;
        if (!cid) cid = getChannelId();
        const isGerman = LANG.isGerman;
        let curSpeed = cid ? (getSpeeds()[cid] ?? 1.0) : 1.0;

        const backBtn = panel.querySelector('.ytp-panel-back-button');
        const displayTxt = panel.querySelector('.ytp-variable-speed-panel-display span');
        const sliderTxt = panel.querySelector('.ytp-speedslider-text');
        const slider = panel.querySelector('input[type="range"]');
        const btns = panel.querySelectorAll('.ytp-variable-speed-panel-increment-button');
        const btnDec = btns[0];
        const btnInc = btns[1];
        const chips = panel.querySelectorAll('.ytp-variable-speed-panel-preset-button-wrapper button');

        // Localize chip numbers based on language
        if (!isGerman) {
            chips.forEach(btn => {
                const span = btn.querySelector('span');
                if (!span) return;
                // Replace comma with dot for English/international format
                span.textContent = span.textContent.replace(',', '.');
            });
        } else {
            // In German mode, ensure decimal point is comma (for 3.0 chip)
            chips.forEach(btn => {
                const span = btn.querySelector('span');
                if (!span) return;
                span.textContent = span.textContent.replace('.', ',');
            });
        }

        backBtn.addEventListener('click', e => {
            e.stopPropagation();
            closeSpeedPanel(settingsMenu);
        });

        function getSliderPercent(v) {
            const clamped = clampSpeed(v);
            return (Math.max(0, Math.min(1, (clamped - 0.25) / (3 - 0.25))) * 100).toFixed(6) + '%';
        }

        function refreshUI(v) {
            curSpeed = v;
            const strVal = v.toFixed(2) + 'x';
            if (displayTxt) displayTxt.textContent = strVal;
            if (sliderTxt) sliderTxt.textContent = strVal;

            const clampedSlider = clampSpeed(v);
            if (slider) {
                slider.value = String(clampedSlider);
                slider.setAttribute('aria-valuenow', String(v));
                slider.setAttribute('aria-valuetext', v.toFixed(2));
                slider.style.setProperty('--yt-slider-shape-gradient-percent', getSliderPercent(v));
            }

            chips.forEach(btn => {
                const span = btn.querySelector('span');
                if (!span) return;
                const btnVal = parseFloat(span.textContent.replace(',', '.'));
                if (Math.abs(btnVal - v) < 0.001) {
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                } else {
                    btn.style.backgroundColor = 'transparent';
                }
            });
        }

        function commit(v) {
            const rounded = roundSpeed(v);
            refreshUI(rounded);
            if (cid) {
                saveSpeed(cid, rounded);
            }
            applySpeed(rounded);
            updateMenuItemText(rounded);
        }

        if (slider) {
            slider.addEventListener('input', e => commit(parseFloat(e.target.value)));
        }
        if (btnDec) {
            btnDec.addEventListener('click', e => {
                e.stopPropagation();
                commit(Math.max(0.25, roundSpeed(curSpeed - 0.05)));
            });
        }
        if (btnInc) {
            btnInc.addEventListener('click', e => {
                e.stopPropagation();
                commit(Math.min(3.0, roundSpeed(curSpeed + 0.05)));
            });
        }

        chips.forEach(btn => {
            const span = btn.querySelector('span');
            if (!span) return;
            const speedVal = parseFloat(span.textContent.replace(',', '.'));
            btn.addEventListener('click', e => {
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
        const el = document.querySelector('#yts-chan-speed .ytp-menuitem-content');
        if (el) el.textContent = speed === 1 ? LANG.standard : speed.toFixed(2) + 'x';
    }

    const SPEED_TERMS =['speed','geschwindigkeit','velocidad','vitesse','速度','속도','velocità','hızı','snelheid','kecepatan','tốc độ','ความเร็ว','prędkość','скорость','سرعة','velocidade','hastighet','rychlost'];

    function insertSpeedMenuItem() {
        const menu = document.querySelector('.ytp-settings-menu');
        if (!menu) return false;
        const panelMenu = menu.querySelector('.ytp-panel-menu');
        if (!panelMenu) return false;

        if (document.querySelector('#yts-chan-speed')) return true;

        const ytSpeedItem =[...panelMenu.querySelectorAll('.ytp-menuitem')].find(el => {
            const lbl = el.querySelector('.ytp-menuitem-label');
            return lbl && SPEED_TERMS.some(t => lbl.textContent.toLowerCase().includes(t));
        });
        if (!ytSpeedItem) return false;

        const cid   = getChannelId();
        const saved = getSpeeds()[cid];
        const label = saved && saved !== 1 ? saved.toFixed(2) + 'x' : LANG.standard;

        const item = document.createElement('div');
        item.id        = 'yts-chan-speed';
        item.className = 'ytp-menuitem';
        item.setAttribute('role',         'menuitem');
        item.setAttribute('tabindex',     '0');
        item.setAttribute('aria-haspopup','true');
        item.innerHTML = `
            <div class="ytp-menuitem-icon">
                <svg height="24" viewBox="0 0 24 24" width="24" fill="white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M9.5 16.5v-9l7 4.5z"/>
                </svg>
            </div>
            <div class="ytp-menuitem-label">${LANG.channelSpeedLabel}</div>
            <div class="ytp-menuitem-content">${label}</div>`;

        item.addEventListener('click', e => {
            e.stopPropagation();
            openSpeedPanel(menu);
        });

        ytSpeedItem.insertAdjacentElement('afterend', item);
        return true;
    }

    function syncSpeedMenuDisplay() {
        insertSpeedMenuItem();
        const s = getSpeeds()[getChannelId()];
        if (s) updateMenuItemText(s);
    }

    function watchSettingsMenu(signal, retryCount = 3) {
        const menu = document.querySelector('.ytp-settings-menu');
        const btn  = document.querySelector('.ytp-settings-button');
        if (!menu || !btn) {
            if (retryCount > 0) {
                setTimeout(() => watchSettingsMenu(signal, retryCount - 1), 500);
            }
            return;
        }

        const obs = new MutationObserver(() => {
            if (menu.style.display === 'none') {
                if (inCustomPanel) closeSpeedPanel(menu);
            } else {
                setTimeout(syncSpeedMenuDisplay, CFG.MENU_DELAY);
            }
        });
        obs.observe(menu, { attributes: true, attributeFilter: ['style'] });
        speedObs.add(obs);

        btn.addEventListener('click', () => setTimeout(() => {
            const m = document.querySelector('.ytp-settings-menu');
            if (m && m.style.display !== 'none') syncSpeedMenuDisplay();
        }, CFG.MENU_DELAY), { signal });
    }

    function initSpeed() {
        if (speedRetryTimeout) clearTimeout(speedRetryTimeout);
        if (speedInitTimeout) clearTimeout(speedInitTimeout);
        const obs = new MutationObserver(() => {
            try {
                const vid = document.querySelector('.html5-main-video');
                // Wait for actual channel link in DOM, not just any ID
                const chan = document.querySelector('#upload-info #channel-name #text a') ||
                             document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a') ||
                             document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
                if (!vid || !chan) return;

                obs.disconnect();
                speedObs.delete(obs);

                const cid = new URL(chan.href).pathname.split('/').pop();
                const saved = getSpeeds()[cid];
                currentChannelId = cid;

                if (speedAbort) speedAbort.abort();
                speedAbort = new AbortController();

                vid.addEventListener('ratechange', () => {
                    if (isApplyingSpeed) return;
                    const currentSaved = getSpeeds()[currentChannelId];
                    if (currentSaved && Math.abs(vid.playbackRate - currentSaved) > 0.01) {
                        isApplyingSpeed = true;
                        vid.playbackRate = currentSaved;
                        isApplyingSpeed = false;
                    }
                }, { signal: speedAbort.signal });

                if (saved) {
                    applySpeed(saved);
                    speedRetryTimeout = setTimeout(() => applySpeed(saved), CFG.SPEED_RETRY);
                }

                watchSettingsMenu(speedAbort.signal);
            } catch (e) { log('initSpeed error:', e); }
        });

        obs.observe(document.documentElement, { childList: true, subtree: true });
        speedObs.add(obs);

        speedInitTimeout = setTimeout(() => {
            obs.disconnect();
            speedObs.delete(obs);
            log('initSpeed: Timeout reached, no channel found');
        }, CFG.INIT_TIMEOUT);
    }

    function cleanupSpeed() {
        speedObs.forEach(o => { try { o.disconnect(); } catch (_) {} });
        speedObs.clear();

        if (speedAbort) { speedAbort.abort(); speedAbort = null; }
        if (speedRetryTimeout) { clearTimeout(speedRetryTimeout); speedRetryTimeout = null; }
        if (speedInitTimeout) { clearTimeout(speedInitTimeout); speedInitTimeout = null; }
        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }
        currentChannelId = null;
        speedCache = null;
        inCustomPanel = false;
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 3 · AUTO-STOP PLAYBACK (Original Logic)
    // ═════════════════════════════════════════════════════════════════════════

    const STOP_PATHS  =['/channel','/watch','/shorts','/@','/playlist','/live'];
    let   stopObs     = null;

    function stopVideoPlayback(youtubePlayer, videoElement) {
        if (!youtubePlayer || !videoElement || handledVids.has(videoElement)) return;

        handledVids.add(videoElement);

        try {
            // Immediately pause if playing
            const playerState = youtubePlayer.getPlayerState?.();
            if (playerState === PS_PLAYING || playerState === PS_BUFFERING) {
                youtubePlayer.pauseVideo();
            }
        } catch (error) {
            log('[YouTube Auto-Stop] Error pausing video:', error);
        }

        // Set up ONE-TIME event listener to catch auto-play
        let hasIntercepted = false;

        const handleAutoPlay = () => {
            if (hasIntercepted) return;

            try {
                const state = youtubePlayer.getPlayerState?.();
                if (state === PS_PLAYING || state === PS_BUFFERING) {
                    hasIntercepted = true;
                    youtubePlayer.pauseVideo();

                    videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                    videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
                }
            } catch (error) {
                log('[YouTube Auto-Stop] Error in event handler:', error);
            }
        };

        videoElement.addEventListener('play', handleAutoPlay, { capture: true });
        videoElement.addEventListener('playing', handleAutoPlay, { capture: true });

        // Fallback: Remove listeners after short delay to allow manual play
        setTimeout(() => {
            if (!hasIntercepted) {
                videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
            }
        }, 2000);
    }

    function checkForPlayer() {
        const playerElement = document.querySelector('ytd-player');
        const videoElement = document.querySelector('.html5-main-video');

        // BUGFIX: "|| document.getElementById('movie_player')" entfernt.
        // Das Original wartet zwingend auf die Player-API am Element, was verhindert,
        // dass "Geister-Player" vom vorherigen Video zu früh getriggert werden!
        const youtubePlayer = playerElement?.player_;

        if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
            stopVideoPlayback(youtubePlayer, videoElement);
            initAutoHD(youtubePlayer, videoElement); // Koppelt hier direkt das API-gesteuerte Auto-HD ein
            cleanupAutoStop(); // Stop observer after successful detection
            return true;
        }
        return false;
    }

    function initAutoStop() {
        if (!STOP_PATHS.some(p => location.pathname.startsWith(p))) {
            cleanupAutoStop(); // BUGFIX: Sauberer Abbruch wie im Original
            return;
        }

        // Try immediate check first
        if (checkForPlayer()) return;

        if (!stopObs) {
            stopObs = new MutationObserver(() => checkForPlayer());
        }
        stopObs.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(checkForPlayer, 100);
    }

    function cleanupAutoStop() {
        if (stopObs) { stopObs.disconnect(); stopObs = null; }
    }


    // ═════════════════════════════════════════════════════════════════════════
    // BOOTSTRAP
    // ═════════════════════════════════════════════════════════════════════════

    patchQuality();

    window.addEventListener('yt-navigate-finish', () => {
        resetVideoTrackers(); // Zwingend für SPAs, damit Auto-Stop und HD bei Folgevideos greifen
        patchQuality();

        cleanupSpeed();
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            initSpeed();
        }

        cleanupAutoStop();
        initAutoStop();
    });


    function boot() {
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            initSpeed();
        }
        initAutoStop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
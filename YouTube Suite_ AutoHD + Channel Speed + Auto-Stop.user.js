// ==UserScript==
// @name         YouTube Suite: AutoHD + Channel Speed + Auto-Stop
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  Auto max video quality via API, per-channel playback speed with native-style UI, auto-stop on page load
// @author       marmoris
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @icon         https://www.youtube.com/favicon.ico
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

    const log = (...a) => { if (CFG.debug) console.log('[YT-Suite]', ...a); };

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

            us['482'] = { intValue: CFG.preferredQuality };
            localStorage.setItem(KEY, JSON.stringify({
                creation:   Date.now(),
                data:       JSON.stringify(us),
                expiration: Date.now() + 2592000000,
            }));

            // Neuer YouTube Quality Key (zwingt den Player bevorzugt auf 4K/Premium)
            localStorage.setItem('yt-player-quality', JSON.stringify({
                data: JSON.stringify({ quality: "hd2160", previousQuality: "auto" }),
                expiration: Date.now() + 2592000000,
                creation: Date.now()
            }));
        } catch (e) { log('patchQuality error:', e); }
    }

    // Greift über die native Player-API ein und zwingt die höchste verfügbare Qualität
    function applyAutoHD(ytPlayer) {
        try {
            if (!ytPlayer || typeof ytPlayer.getAvailableQualityLevels !== 'function') return;

            const levels = ytPlayer.getAvailableQualityLevels();
            // Sucht die erste Qualität, die nicht 'auto' ist (die Liste ist absteigend sortiert)
            const bestQuality = levels.find(q => q && q !== 'auto');

            if (bestQuality) {
                if (typeof ytPlayer.setPlaybackQualityRange === 'function') {
                    ytPlayer.setPlaybackQualityRange(bestQuality, bestQuality); // Setzt Min und Max
                }
                if (typeof ytPlayer.setPlaybackQuality === 'function') {
                    ytPlayer.setPlaybackQuality(bestQuality);
                }
                log('AutoHD: Set to', bestQuality);
            }
        } catch (e) { log('applyAutoHD error:', e); }
    }

    function initAutoHD(ytPlayer, vid) {
        if (!ytPlayer || !vid || handledVidsHD.has(vid)) return;
        handledVidsHD.add(vid);

        const force = () => applyAutoHD(ytPlayer);

        force(); // Sofort anwenden
        vid.addEventListener('loadedmetadata', force); // Wenn Auflösungsdaten da sind
        vid.addEventListener('playing', () => setTimeout(force, 100), { once: true }); // Sicherheit beim Loslaufen
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 2 · CHANNEL SPEED CONTROLLER (STRICT 1:1 NATIVE UI & ANIMATION)
    // ═════════════════════════════════════════════════════════════════════════

    let speedCache    = null;
    let speedObs      = new Set();
    let speedAbort    = null;
    let menuPanel     = null;
    let customPanel   = null;
    let inCustomPanel = false;

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
            const vid = document.querySelector('video');
            if (vid && Math.abs(vid.playbackRate - val) > 0.001) {
                vid.playbackRate = val;
            }
        } catch (e) { }
    }

    function getChannelId() {
        try {
            const a = document.querySelector('#upload-info #channel-name #text a');
            if (a) return a.href.split('/').pop();
        } catch (_) {}
        return new URLSearchParams(location.search).get('v') || location.href;
    }

    function buildSpeedPanel(settingsMenu) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `<div class="ytp-panel" style="width: 330px; height: 250px;"><div class="ytp-panel-header"><div class="ytp-panel-back-button-container"><button class="ytp-button ytp-panel-back-button" aria-label="Zurück zum vorherigen Menü"></button></div><span class="ytp-panel-title" role="heading" aria-level="2">Kanalgeschwindigkeit</span></div><div class="ytp-variable-speed-panel-content" tabindex="0" style="height: 193px;"><div class="ytp-speed-display-container"><div class="ytp-variable-speed-panel-display" aria-live="polite"><div class="ytp-variable-speed-panel-premium-badge" tabindex="-1"><div class="ytp-variable-speed-panel-badge"></div></div><span>1.00x</span></div></div><div class="ytp-variable-speed-panel-slider-container"><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="Kanalgeschwindigkeit reduzieren 0.05"><span>-</span></button><div class="ytp-input-slider-section"><div class="ytp-speedslider-indicator-container"><div class="ytp-speedslider-badge" aria-label=""></div><p class="ytp-speedslider-text">1.00x</p></div><input class="ytp-input-slider ytp-speedslider ytp-varispeed-input-slider" role="slider" tabindex="0" type="range" min="0.25" max="2" step="0.05" value="1" aria-valuenow="1" aria-valuemin="0.25" aria-valuemax="2" aria-valuetext="1.00" style="--yt-slider-shape-gradient-percent: 42.857142857142854%;"></div><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="Kanalgeschwindigkeit erhöhen 0.05"><span>+</span></button></div><div class="ytp-variable-speed-panel-chips"><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="5" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1</span></button><div class="ytp-variable-speed-panel-preset-button-label-text">Standard</div></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="2" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,25</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="3" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,5</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="0" aria-hidden="true" style="display: none;"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,75</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="4" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>2</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="1" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><div class="ytp-variable-speed-panel-premium-upsell-icon"></div><span>3.0</span></button></div></div></div></div>`;
        const panel = tempDiv.firstChild;

        const cid = getChannelId();
        let curSpeed = getSpeeds()[cid] ?? 1.0;

        const backBtn = panel.querySelector('.ytp-panel-back-button');
        const displayTxt = panel.querySelector('.ytp-variable-speed-panel-display span');
        const sliderTxt = panel.querySelector('.ytp-speedslider-text');
        const slider = panel.querySelector('input[type="range"]');
        const btns = panel.querySelectorAll('.ytp-variable-speed-panel-increment-button');
        const btnDec = btns[0];
        const btnInc = btns[1];
        const chips = panel.querySelectorAll('.ytp-variable-speed-panel-preset-button-wrapper button');

        backBtn.addEventListener('click', e => {
            e.stopPropagation();
            closeSpeedPanel(settingsMenu);
        });

        function getSliderPercent(v) {
            const clamped = Math.max(0.25, Math.min(2, v));
            return (Math.max(0, Math.min(1, (clamped - 0.25) / (2 - 0.25))) * 100).toFixed(6) + '%';
        }

        function refreshUI(v) {
            curSpeed = v;
            const strVal = v.toFixed(2) + 'x';
            if (displayTxt) displayTxt.textContent = strVal;
            if (sliderTxt) sliderTxt.textContent = strVal;

            const clampedSlider = Math.min(2, Math.max(0.25, v));
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
            const rounded = Math.round(v * 100) / 100;
            refreshUI(rounded);
            applySpeed(rounded);
            saveSpeed(cid, rounded);
            updateMenuItemText(rounded);
        }

        if (slider) {
            slider.addEventListener('input', e => commit(parseFloat(e.target.value)));
        }
        if (btnDec) {
            btnDec.addEventListener('click', e => {
                e.stopPropagation();
                commit(Math.max(0.25, Math.round((curSpeed - 0.05) * 100) / 100));
            });
        }
        if (btnInc) {
            btnInc.addEventListener('click', e => {
                e.stopPropagation();
                commit(Math.min(3.0, Math.round((curSpeed + 0.05) * 100) / 100));
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

        if (origMenuWidth && origMenuHeight) {
            settingsMenu.style.width = origMenuWidth;
            settingsMenu.style.height = origMenuHeight;
        }

        inCustomPanel = false;
    }

    function updateMenuItemText(speed) {
        const el = document.querySelector('#yts-chan-speed .ytp-menuitem-content');
        if (el) el.textContent = speed === 1 ? 'Standard' : speed.toFixed(2) + 'x';
    }

    const SPEED_TERMS =['speed','geschwindigkeit','velocidad','vitesse','速度','속도','velocità','hızı','snelheid','kecepatan','tốc độ','ความเร็ว'];

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
        const label = saved && saved !== 1 ? saved.toFixed(2) + 'x' : 'Standard';

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
            <div class="ytp-menuitem-label">Kanalgeschwindigkeit</div>
            <div class="ytp-menuitem-content">${label}</div>`;

        item.addEventListener('click', e => {
            e.stopPropagation();
            openSpeedPanel(menu);
        });

        ytSpeedItem.insertAdjacentElement('afterend', item);
        return true;
    }

    function watchSettingsMenu() {
        const menu = document.querySelector('.ytp-settings-menu');
        const btn  = document.querySelector('.ytp-settings-button');
        if (!menu || !btn) return;

        const obs = new MutationObserver(() => {
            if (menu.style.display === 'none') {
                if (inCustomPanel) closeSpeedPanel(menu);
            } else {
                setTimeout(() => {
                    insertSpeedMenuItem();
                    const s = getSpeeds()[getChannelId()];
                    if (s) updateMenuItemText(s);
                }, CFG.MENU_DELAY);
            }
        });
        obs.observe(menu, { attributes: true, attributeFilter: ['style'] });
        speedObs.add(obs);

        btn.addEventListener('click', () => setTimeout(() => {
            const m = document.querySelector('.ytp-settings-menu');
            if (m && m.style.display !== 'none') {
                insertSpeedMenuItem();
                const s = getSpeeds()[getChannelId()];
                if (s) updateMenuItemText(s);
            }
        }, CFG.MENU_DELAY));
    }

    function initSpeed() {
        const obs = new MutationObserver(() => {
            try {
                const vid  = document.querySelector('video');
                const chan = document.querySelector('#upload-info #channel-name #text a');
                if (!vid || !chan) return;

                obs.disconnect();
                speedObs.delete(obs);

                const cid   = chan.href.split('/').pop();
                const saved = getSpeeds()[cid];

                if (saved) {
                    applySpeed(saved);
                    setTimeout(() => applySpeed(saved), CFG.SPEED_RETRY);

                    if (speedAbort) speedAbort.abort();
                    speedAbort = new AbortController();
                    vid.addEventListener('ratechange', () => {
                        if (Math.abs(vid.playbackRate - saved) > 0.01) {
                            vid.playbackRate = saved;
                        }
                    }, { signal: speedAbort.signal });
                }

                watchSettingsMenu();
            } catch (e) { log('initSpeed error:', e); }
        });

        obs.observe(document.documentElement, { childList: true, subtree: true });
        speedObs.add(obs);

        setTimeout(() => {
            obs.disconnect();
            speedObs.delete(obs);
        }, CFG.INIT_TIMEOUT);
    }

    function cleanupSpeed() {
        speedObs.forEach(o => { try { o.disconnect(); } catch (_) {} });
        speedObs.clear();

        if (speedAbort) { speedAbort.abort(); speedAbort = null; }
        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }
        inCustomPanel = false;
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 3 · AUTO-STOP PLAYBACK (Original Logic)
    // ═════════════════════════════════════════════════════════════════════════

    const STOP_PATHS  =['/channel','/watch','/shorts','/@','/playlist','/live','/embed'];
    let   stopObs     = null;

    function stopVideoPlayback(youtubePlayer, videoElement) {
        if (!youtubePlayer || !videoElement || handledVids.has(videoElement)) return;

        handledVids.add(videoElement);

        try {
            // Immediately pause if playing
            const playerState = youtubePlayer.getPlayerState?.();
            if (playerState === 1 || playerState === 3) { // PLAYING or BUFFERING
                youtubePlayer.pauseVideo();
            }
        } catch (error) {
            log('[YouTube Auto-Stop] Error pausing video:', error);
        }

        // Set up ONE-TIME event listener to catch auto-play
        let hasIntercepted = false;

        const handleAutoPlay = (event) => {
            if (hasIntercepted) return;

            try {
                const state = youtubePlayer.getPlayerState?.();
                if (state === 1 || state === 3) { // PLAYING or BUFFERING
                    hasIntercepted = true;
                    youtubePlayer.pauseVideo();

                    videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                    videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
                }
            } catch (error) {
                log('[YouTube Auto-Stop] Error in event handler:', error);
            }
        };

        videoElement.addEventListener('play', handleAutoPlay, { capture: true, passive: true });
        videoElement.addEventListener('playing', handleAutoPlay, { capture: true, passive: true });

        // Fallback: Remove listeners after short delay
        setTimeout(() => {
            if (!hasIntercepted) {
                videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
            }
        }, 2000);
    }

    function checkForPlayer() {
        const playerElement = document.querySelector('ytd-player');
        const videoElement = document.querySelector('video');

        // BUGFIX: "|| document.getElementById('movie_player')" entfernt.
        // Das Original wartet zwingend auf die Player-API am Element, was verhindert,
        // dass "Geister-Player" vom vorherigen Video zu früh getriggert werden!
        const youtubePlayer = playerElement?.player_;

        if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
            stopVideoPlayback(youtubePlayer, videoElement);
            initAutoHD(youtubePlayer, videoElement); // Koppelt hier direkt das API-gesteuerte Auto-HD ein
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

    window.addEventListener('popstate', () => {
        resetVideoTrackers();
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
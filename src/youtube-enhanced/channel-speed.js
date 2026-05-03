(function () {
    'use strict';

    /**
     * Per-channel speed control for YouTube Enhanced.
     * Injects a custom "Channel speed" menu item into YouTube's settings panel,
     * reads/stores per-channel speed preferences, and applies them to the
     * HTML5 <video> element whenever the channel or video changes.
     *
     * UI follows YouTube's native panel structure (ytp-panel) for seamless
     * integration with existing animations and navigation.
     */

    var YTE = window.__YTE__ = window.__YTE__ || {};

    // =========================================================
    // Utility helpers
    // =========================================================

    function roundSpeed(v) { return Math.round(v * 100) / 100; }
    function clampSpeed(v) { return Math.max(0.25, Math.min(3, v)); }

    // =========================================================
    // State
    // =========================================================

    var speedCache        = {};
    var speedObs          = new Set();
    var speedAbort        = null;
    var speedRetryTimeout = null;
    var speedInitTimeout  = null;
    var currentChannelId  = null;
    var isApplyingSpeed   = false;
    var menuPanel         = null;
    var customPanel       = null;
    var inCustomPanel     = false;

    var origMenuWidth  = '';
    var origMenuHeight = '';

    // =========================================================
    // Speed data persistence
    // =========================================================

    /**
     * Returns the current speed cache (channelId -> speed map).
     * @returns {object}
     */
    YTE.getSpeeds = function () { return speedCache; };

    /**
     * Loads saved per-channel speeds from storage.
     */
    YTE.loadSpeedData = async function () {
        try {
            speedCache = await TM.storage.loadSetting(YTE.CFG.SPEED_KEY, {});
        } catch (_) { speedCache = {}; }
    };

    /**
     * Saves a speed value for a specific channel to storage.
     * @param {string} cid - Channel ID
     * @param {number} val - Playback speed
     */
    async function saveSpeed(cid, val) {
        try {
            speedCache[cid] = val;
            await TM.storage.saveSetting(YTE.CFG.SPEED_KEY, speedCache);
        } catch (e) { YTE.log.debug('saveSpeed error:', e); }
    }

    // =========================================================
    // Speed application
    // =========================================================

    /**
     * Directly sets playbackRate on the main YouTube <video> element.
     * @param {number} val - Desired playback speed
     */
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
        } catch (e) { YTE.log.debug('applySpeed error:', e); }
    }

    /**
     * Extracts the current channel ID from YouTube's page DOM.
     * Tries several selectors in order of reliability.
     * @returns {string|null}
     */
    function getChannelId() {
        try {
            var a = document.querySelector('#upload-info #channel-name #text a');
            if (a) return new URL(a.href).pathname.split('/').pop();

            var shortsChannel = document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a');
            if (shortsChannel) return new URL(shortsChannel.href).pathname.split('/').pop();

            var anyChannel = document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
            if (anyChannel) return new URL(anyChannel.href).pathname.split('/').pop();
        } catch (_) {}
        return null;
    }

    // =========================================================
    // Speed Panel UI (native YouTube look & feel)
    // =========================================================

    /**
     * Builds the full speed control panel as a ytp-panel element with slider,
     * increment/decrement buttons, preset chips, and back navigation.
     * Mirrors YouTube's own variable-speed panel structure exactly.
     * @param {HTMLElement} settingsMenu - The YouTube settings menu container
     * @returns {HTMLElement} The constructed panel element
     */
    function buildSpeedPanel(settingsMenu) {
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = '<div class="ytp-panel" style="width: 330px; height: 250px;"><div class="ytp-panel-header"><div class="ytp-panel-back-button-container"><button class="ytp-button ytp-panel-back-button" aria-label="' + YTE.LANG.backToPreviousMenu + '"></button></div><span class="ytp-panel-title" role="heading" aria-level="2">' + YTE.LANG.channelSpeed + '</span></div><div class="ytp-variable-speed-panel-content" tabindex="0" style="height: 193px;"><div class="ytp-speed-display-container"><div class="ytp-variable-speed-panel-display" aria-live="polite"><div class="ytp-variable-speed-panel-premium-badge" tabindex="-1"><div class="ytp-variable-speed-panel-badge"></div></div><span>1.00x</span></div></div><div class="ytp-variable-speed-panel-slider-container"><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="' + YTE.LANG.decreaseSpeed + '"><span>-</span></button><div class="ytp-input-slider-section"><div class="ytp-speedslider-indicator-container"><div class="ytp-speedslider-badge" aria-label=""><\/div><p class="ytp-speedslider-text">1.00x<\/p><\/div><input class="ytp-input-slider ytp-speedslider ytp-varispeed-input-slider" role="slider" tabindex="0" type="range" min="0.25" max="3" step="0.05" value="1" aria-valuenow="1" aria-valuemin="0.25" aria-valuemax="3" aria-valuetext="1.00" style="--yt-slider-shape-gradient-percent: 42.857142857142854%;"><\/div><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="' + YTE.LANG.increaseSpeed + '"><span>+<\/span><\/button><\/div><div class="ytp-variable-speed-panel-chips"><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="5" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1<\/span><\/button><div class="ytp-variable-speed-panel-preset-button-label-text">' + YTE.LANG.standard + '<\/div><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="2" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,25<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="3" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,5<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="0" aria-hidden="true" style="display: none;"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,75<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="4" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>2<\/span><\/button><\/div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="1" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><div class="ytp-variable-speed-panel-premium-upsell-icon"><\/div><span>3.0<\/span><\/button><\/div><\/div><\/div><\/div>';
        var panel = tempDiv.firstChild;

        var cid = currentChannelId;
        if (!cid) cid = getChannelId();
        var stored = YTE.getSpeeds();
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
        if (!YTE.LANG.isGerman) {
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

    /**
     * Opens the speed panel inside YouTube's settings menu, hiding the
     * existing menu panel and resizing the container.
     * @param {HTMLElement} settingsMenu
     */
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

    /**
     * Closes the speed panel and restores YouTube's original settings menu.
     * @param {HTMLElement} settingsMenu
     */
    function closeSpeedPanel(settingsMenu) {
        if (!inCustomPanel) return;

        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }

        settingsMenu.style.width = origMenuWidth;
        settingsMenu.style.height = origMenuHeight;

        inCustomPanel = false;
    }

    /**
     * Updates the menu item text showing the current channel speed.
     * @param {number} speed
     */
    function updateMenuItemText(speed) {
        var el = document.querySelector('#yts-chan-speed .ytp-menuitem-content');
        if (el) el.textContent = speed === 1 ? YTE.LANG.standard : speed.toFixed(2) + 'x';
    }

    // =========================================================
    // Menu item injection
    // =========================================================

    var SPEED_TERMS = ['speed','geschwindigkeit','velocidad','vitesse','速度','속도','velocita','hizi','snelheid','kecepatan','toc do','ความเร็ว','predkosc','скорость','سرعة','velocidade','hastighet','rychlost'];

    /**
     * Inserts a "Channel speed" menu item into YouTube's settings panel,
     * positioned right after the native "Speed" item (matched language-agnostically).
     * @returns {boolean} true if the item was inserted (or already exists)
     */
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
        var stored = YTE.getSpeeds();
        var saved = cid ? stored[cid] : undefined;
        var label = saved && saved !== 1 ? saved.toFixed(2) + 'x' : YTE.LANG.standard;

        var item = document.createElement('div');
        item.id        = 'yts-chan-speed';
        item.className = 'ytp-menuitem';
        item.setAttribute('role',         'menuitem');
        item.setAttribute('tabindex',     '0');
        item.setAttribute('aria-haspopup','true');
        item.innerHTML = '<div class="ytp-menuitem-icon"><svg height="24" viewBox="0 0 24 24" width="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M9.5 16.5v-9l7 4.5z"/></svg></div><div class="ytp-menuitem-label">' + YTE.LANG.channelSpeedLabel + '</div><div class="ytp-menuitem-content">' + label + '</div>';

        item.addEventListener('click', function (e) {
            e.stopPropagation();
            openSpeedPanel(menu);
        });

        ytSpeedItem.insertAdjacentElement('afterend', item);
        return true;
    }

    /**
     * Ensures the speed menu item exists and its display matches the
     * currently loaded per-channel speed.
     */
    YTE.syncSpeedMenuDisplay = function () {
        insertSpeedMenuItem();
        var s = YTE.getSpeeds()[getChannelId()];
        if (s) updateMenuItemText(s);
    };

    // =========================================================
    // Settings menu observer
    // =========================================================

    /**
     * Observes YouTube's settings menu for visibility changes.
     * Opens/closes the speed sub-panel as needed and re-syncs the menu item.
     * @param {AbortSignal} signal - AbortSignal for cleanup
     * @param {number} [retryCount=3] - Number of retries if menu not found
     */
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
                setTimeout(YTE.syncSpeedMenuDisplay, YTE.CFG.MENU_DELAY);
            }
        });
        obs.observe(menu, { attributes: true, attributeFilter: ['style'] });
        speedObs.add(obs);

        btn.addEventListener('click', function () {
            setTimeout(function () {
                var m = document.querySelector('.ytp-settings-menu');
                if (m && m.style.display !== 'none') YTE.syncSpeedMenuDisplay();
            }, YTE.CFG.MENU_DELAY);
        }, { signal: signal });
    }

    // =========================================================
    // Initialization
    // =========================================================

    /**
     * Initializes per-channel speed control. Waits for the YouTube player
     * elements to appear, then applies the saved speed for the current channel.
     * Sets up MutationObserver-based monitoring and settings menu integration.
     */
    YTE.initSpeed = function () {
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
                var stored = YTE.getSpeeds();
                var saved = stored[cid];
                currentChannelId = cid;

                if (speedAbort) speedAbort.abort();
                speedAbort = new AbortController();

                vid.addEventListener('ratechange', function () {
                    if (isApplyingSpeed) return;
                    var currentSaved = YTE.getSpeeds()[currentChannelId];
                    if (currentSaved && Math.abs(vid.playbackRate - currentSaved) > 0.01) {
                        isApplyingSpeed = true;
                        vid.playbackRate = currentSaved;
                        isApplyingSpeed = false;
                    }
                }, { signal: speedAbort.signal });

                if (saved) {
                    applySpeed(saved);
                    speedRetryTimeout = setTimeout(function () { applySpeed(saved); }, YTE.CFG.SPEED_RETRY);
                }

                watchSettingsMenu(speedAbort.signal);
            } catch (e) { YTE.log.debug('initSpeed error:', e); }
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
            YTE.log.debug('initSpeed: Timeout reached, no channel found');
        }, YTE.CFG.INIT_TIMEOUT);
    };

    /**
     * Cleans up all speed-related observers, timers, and DOM elements.
     * Called on SPA navigation to reset state for the new page.
     */
    YTE.cleanupSpeed = function () {
        speedObs.forEach(function (o) { try { o.disconnect(); } catch (_) {} });
        speedObs.clear();

        if (speedAbort) { speedAbort.abort(); speedAbort = null; }
        if (speedRetryTimeout) { clearTimeout(speedRetryTimeout); speedRetryTimeout = null; }
        if (speedInitTimeout) { clearTimeout(speedInitTimeout); speedInitTimeout = null; }
        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }
        currentChannelId = null;
        inCustomPanel = false;
    };
})();

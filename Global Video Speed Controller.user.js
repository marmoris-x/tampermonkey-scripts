// ==UserScript==
// @name         Global Video Speed Controller
// @name:de      Globaler Video-Geschwindigkeitsregler
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.3
// @description  Sets a global playback speed for all HTML5 videos and audios.
// @description:de Setzt eine globale Wiedergabegeschwindigkeit fur alle HTML5-Videos und -Audios.
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=example.com
// @match        http://*/*
// @match        https://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @run-at       document-start
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/dom-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/storage-utils.js
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Global%20Video%20Speed%20Controller.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Global%20Video%20Speed%20Controller.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

/*
 * ARCHITECTURE:
 * Tampermonkey runs in an isolated sandbox. Changes to HTMLMediaElement.prototype
 * within the script only affect the sandbox context -- the page cannot see them.
 * Solution (same as the Chrome Extension): inject code via <script> tag directly
 * into the page context. Communication via CustomEvents on unsafeWindow (= real page window).
 *
 * Fallback chain:
 *   1. <script>-tag injection (primary, runs in page context)
 *   2. unsafeWindow prototype override (if CSP blocks inline scripts)
 *   3. Periodic direct setting via unsafeWindow (last resort)
 */

(function () {
    'use strict';

    // =========================================================
    // CONSTANTS & STATE (Tampermonkey context)
    // =========================================================

    var PAGE_LOG     = '[GlobalSpeed-Page]';
    var CMD_EVENT     = '__GS_CMD__';

    var STORAGE_KEY_SPEED   = 'global_video_speed';
    var STORAGE_KEY_ENABLED = 'global_video_speed_enabled';

    var log = TM.createLogger('Global Video Speed Controller');

    var tmState = {
        speed:   1.0,
        enabled: true,
    };

    // =========================================================
    // HELPER: Send command to page context
    // =========================================================

    function sendCmd(speed, enabled) {
        try {
            // unsafeWindow is the REAL window of the page -- events dispatched here
            // are received by the injected script.
            unsafeWindow.dispatchEvent(
                new unsafeWindow.CustomEvent(CMD_EVENT, { detail: { speed: speed, enabled: enabled } })
            );
            log.log('Command sent:', { speed: speed, enabled: enabled });
        } catch (e) {
            log.error('sendCmd failed:', e);
        }
    }

    // =========================================================
    // APPROACH 1: <script>-tag injection into page context
    // =========================================================
    //
    // This code runs in the real page JavaScript context and can therefore
    // modify HTMLMediaElement.prototype so the page sees the changes.
    //
    // This is exactly the principle the Global Speed Chrome Extension uses:
    // main.js runs as a Content Script in the "MAIN world" -- equivalent to this.

    function buildPageScript(initialSpeed, initialEnabled) {
        // IMPORTANT: This string is injected as JavaScript into the page.
        // It has NO access to Tampermonkey APIs or the TM context.
        // All values are interpolated at build time.
        return `
(function () {
    'use strict';
    if (window.__GS_ACTIVE__) {
        console.log('${PAGE_LOG}', 'Already active -- preventing double injection.');
        window.dispatchEvent(new CustomEvent('${CMD_EVENT}', {
            detail: { speed: window.__GS_SPEED__, enabled: window.__GS_ENABLED__ }
        }));
        return;
    }
    window.__GS_ACTIVE__  = true;
    window.__GS_SPEED__   = ${initialSpeed};
    window.__GS_ENABLED__ = ${initialEnabled};

    var LOG = '${PAGE_LOG}';

    // Save original descriptor BEFORE any page script can modify it.
    var origDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!origDesc || !origDesc.get || !origDesc.set) {
        console.error(LOG, 'FATAL: playbackRate descriptor not found or no getter/setter.', origDesc);
        return;
    }

    console.log(LOG, 'Initialization. speed=' + window.__GS_SPEED__ + ', enabled=' + window.__GS_ENABLED__);

    var isApplying = false;
    var seen = new WeakSet();

    // --------------------------------------------------
    // Prototype override (runs in page context)
    // --------------------------------------------------
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        configurable: true,
        enumerable:   true,
        get: function () {
            return window.__GS_ENABLED__ ? window.__GS_SPEED__ : origDesc.get.call(this);
        },
        set: function (rate) {
            // Only let our values through; ignore page script values
            if (isApplying || !window.__GS_ENABLED__) {
                origDesc.set.call(this, rate);
            }
        }
    });

    // --------------------------------------------------
    // Apply to single element
    // --------------------------------------------------
    function applyTo(el) {
        if (!(el instanceof HTMLMediaElement) || !window.__GS_ENABLED__) return;
        try {
            isApplying = true;
            origDesc.set.call(el, window.__GS_SPEED__);
            console.log(LOG, 'Applied:', window.__GS_SPEED__ + 'x',
                '<' + el.tagName.toLowerCase() + '>',
                (el.src || el.currentSrc || '').slice(0, 70) || '(no src)');
        } catch (e) {
            console.error(LOG, 'applyTo error:', e);
        } finally {
            isApplying = false;
        }
    }

    function resetTo(el, rate) {
        if (!(el instanceof HTMLMediaElement)) return;
        try {
            isApplying = true;
            origDesc.set.call(el, rate);
        } finally {
            isApplying = false;
        }
    }

    function applyToAll() {
        document.querySelectorAll('video, audio').forEach(function (el) { applyTo(el); });
    }

    function resetAll() {
        document.querySelectorAll('video, audio').forEach(function (el) { resetTo(el, 1.0); });
    }

    // --------------------------------------------------
    // Register element & attach events
    // --------------------------------------------------
    function register(el) {
        if (!(el instanceof HTMLMediaElement)) return;
        if (seen.has(el)) return;
        seen.add(el);

        applyTo(el);

        // If page changes rate -- correct immediately
        el.addEventListener('ratechange', function () {
            if (!isApplying && window.__GS_ENABLED__) {
                var real = origDesc.get.call(el);
                if (real !== window.__GS_SPEED__) {
                    console.log(LOG, 'ratechange correction:', real, '->', window.__GS_SPEED__);
                    applyTo(el);
                }
            }
        }, true);

        // Ensure correct rate on these events
        ['play', 'playing', 'loadedmetadata', 'canplay', 'seeked'].forEach(function (evt) {
            el.addEventListener(evt, function () { if (window.__GS_ENABLED__) applyTo(el); }, true);
        });
    }

    // --------------------------------------------------
    // MutationObserver for a root element
    // --------------------------------------------------
    function observeRoot(root) {
        new MutationObserver(function (mutations) {
            for (var m = 0; m < mutations.length; m++) {
                var nodes = mutations[m].addedNodes;
                for (var i = 0; i < nodes.length; i++) {
                    if (!nodes[i] || nodes[i].nodeType !== 1) continue;
                    if (nodes[i] instanceof HTMLMediaElement) {
                        register(nodes[i]);
                    } else if (nodes[i].querySelectorAll) {
                        var mediaEls = nodes[i].querySelectorAll('video, audio');
                        for (var j = 0; j < mediaEls.length; j++) {
                            register(mediaEls[j]);
                        }
                    }
                }
            }
        }).observe(root, { childList: true, subtree: true });
    }

    observeRoot(document.documentElement);

    // --------------------------------------------------
    // Shadow DOM: same approach as Global Speed
    // --------------------------------------------------
    var origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (opts) {
        var shadow = origAttachShadow.call(this, opts);
        observeRoot(shadow);
        setTimeout(function () { shadow.querySelectorAll('video, audio').forEach(function (el) { register(el); }); }, 0);
        setTimeout(function () { shadow.querySelectorAll('video, audio').forEach(function (el) { register(el); }); }, 500);
        return shadow;
    };

    // --------------------------------------------------
    // Immediate scan (elements already in DOM)
    // --------------------------------------------------
    applyToAll();

    // --------------------------------------------------
    // Periodic correction scan (30 s)
    // --------------------------------------------------
    var ticks = 0;
    var timer = setInterval(function () {
        if (window.__GS_ENABLED__) {
            document.querySelectorAll('video, audio').forEach(function (el) {
                if (!seen.has(el)) {
                    console.log(LOG, 'Periodic scan: new element found.');
                    register(el);
                } else {
                    var real = origDesc.get.call(el);
                    if (real !== window.__GS_SPEED__) {
                        console.log(LOG, 'Periodic scan: rate deviation corrected:', real, '->', window.__GS_SPEED__);
                        applyTo(el);
                    }
                }
            });
        }
        if (++ticks >= 30) clearInterval(timer);
    }, 1000);

    // --------------------------------------------------
    // Receive commands from Tampermonkey context
    // --------------------------------------------------
    window.addEventListener('${CMD_EVENT}', function (e) {
        var detail = e.detail || {};
        var speed = detail.speed;
        var enabled = detail.enabled;
        console.log(LOG, 'Command received: speed=' + speed + ', enabled=' + enabled);
        window.__GS_SPEED__   = speed;
        window.__GS_ENABLED__ = enabled;
        if (enabled) {
            applyToAll();
        } else {
            resetAll();
        }
    });

    console.log(LOG, 'Ready. Prototype override active in page context.');
})();
`;
    }

    function injectPageScript(speed, enabled) {
        try {
            var script = document.createElement('script');
            script.setAttribute('type', 'text/javascript');
            script.textContent = buildPageScript(speed, enabled);
            (document.head || document.documentElement).appendChild(script);
            script.remove();
            log.log('<script>-tag injection successful.');
            return true;
        } catch (e) {
            log.error('<script>-tag injection failed (CSP?):', e);
            return false;
        }
    }

    // =========================================================
    // APPROACH 2: unsafeWindow Prototype Override (CSP Fallback)
    // =========================================================
    // If the page blocks inline scripts via CSP, we can still modify
    // the prototype through unsafeWindow since Tampermonkey
    // with @grant unsafeWindow can bypass CSP restrictions.

    var fallbackOrigDesc   = null;
    var fallbackIsApplying = false;

    function setupUnsafeWindowFallback() {
        try {
            var uw = unsafeWindow;
            if (!uw || !uw.HTMLMediaElement) {
                log.warn('Fallback: unsafeWindow.HTMLMediaElement not available.');
                return false;
            }

            fallbackOrigDesc = Object.getOwnPropertyDescriptor(
                uw.HTMLMediaElement.prototype, 'playbackRate'
            );
            if (!fallbackOrigDesc || !fallbackOrigDesc.get || !fallbackOrigDesc.set) {
                log.warn('Fallback: descriptor not usable.');
                return false;
            }

            var s = tmState;
            var fd = fallbackOrigDesc;
            var fa = false; // isApplying

            Object.defineProperty(uw.HTMLMediaElement.prototype, 'playbackRate', {
                configurable: true,
                enumerable:   true,
                get: function () { return s.enabled ? s.speed : fd.get.call(this); },
                set: function (rate) { if (fa || !s.enabled) fd.set.call(this, rate); }
            });

            unsafeWindow.__gsFallbackApply = function () {
                var elements = uw.document.querySelectorAll('video, audio');
                elements.forEach(function (el) {
                    try {
                        fa = true;
                        fd.set.call(el, s.enabled ? s.speed : 1.0);
                    } finally {
                        fa = false;
                    }
                });
            };

            log.log('unsafeWindow fallback active.');
            return true;
        } catch (e) {
            log.error('unsafeWindow fallback error:', e);
            return false;
        }
    }

    function fallbackApply() {
        try {
            if (unsafeWindow.__gsFallbackApply) {
                unsafeWindow.__gsFallbackApply();
            }
        } catch (e) {
            log.error('fallbackApply error:', e);
        }
    }

    // =========================================================
    // APPROACH 3: Direct polling without prototype override
    // =========================================================
    // Last resort: simply force all videos every second.
    // No prototype override, so page scripts can overwrite between
    // intervals -- but better than nothing.

    var pollingActive = false;

    function startDirectPolling() {
        if (pollingActive) return;
        pollingActive = true;
        log.log('Direct polling started (last resort).');

        var ticks = 0;
        var id = setInterval(function () {
            if (!tmState.enabled) return;
            try {
                var els = unsafeWindow.document.querySelectorAll('video, audio');
                for (var i = 0; i < els.length; i++) {
                    var el = els[i];
                    if (Math.abs(el.playbackRate - tmState.speed) > 0.001) {
                        log.log('Polling: Set rate', tmState.speed, 'on', el.tagName);
                        el.playbackRate = tmState.speed;
                    }
                }
            } catch (e) {
                log.error('Polling error:', e);
            }
            if (++ticks >= 60) clearInterval(id);
        }, 500);
    }

    // =========================================================
    // UI (Tampermonkey context)
    // =========================================================

    var indicator = null;

    function showIndicator() {
        if (!tmState.enabled) return;
        try {
            var doc = unsafeWindow.document;
            if (!doc.body) return;
            if (!indicator) {
                indicator = doc.createElement('div');
                indicator.id = 'gm-speed-indicator';
                doc.body.appendChild(indicator);
            }
            indicator.textContent = tmState.speed.toFixed(2) + 'x';
            indicator.style.display = 'block';
            clearTimeout(indicator._timeout);
            indicator._timeout = setTimeout(function () {
                if (indicator) indicator.style.display = 'none';
            }, 1500);
        } catch (e) { /* body not ready yet */ }
    }

    function updateSetSpeedLabel() {
        if (window.__gsUpdateSetSpeedLabel) window.__gsUpdateSetSpeedLabel();
    }

    function applyAll() {
        sendCmd(tmState.speed, tmState.enabled);
        fallbackApply();
        updateSetSpeedLabel();
    }

    function setupMenuCommands() {
        var setSpeedHandler = async function () {
            var input = prompt('Playback speed (0.07 - 16):', String(tmState.speed));
            var val = parseFloat(input);
            if (input !== null && !isNaN(val) && val > 0) {
                tmState.speed = Math.max(0.07, Math.min(16, val));
                await TM.storage.saveSetting(STORAGE_KEY_SPEED, tmState.speed);
                applyAll();
                showIndicator();
            }
        };

        var setSpeedId = GM_registerMenuCommand(
            'Set speed (' + tmState.speed.toFixed(2) + 'x)', setSpeedHandler
        );

        // Update label when speed changes
        window.__gsUpdateSetSpeedLabel = function () {
            if (window !== window.top) return;
            try { GM_unregisterMenuCommand(setSpeedId); } catch (_) {}
            setSpeedId = GM_registerMenuCommand(
                'Set speed (' + tmState.speed.toFixed(2) + 'x)', setSpeedHandler
            );
        };
        updateSetSpeedLabel();

        GM_registerMenuCommand('Reset (1.0x)', async function () {
            tmState.speed = 1.0;
            await TM.storage.saveSetting(STORAGE_KEY_SPEED, tmState.speed);
            applyAll();
            showIndicator();
        });

        var label = function () { return tmState.enabled ? 'Disable Global Speed' : 'Enable Global Speed'; };

        var onToggle = async function () {
            tmState.enabled = !tmState.enabled;
            await TM.storage.saveSetting(STORAGE_KEY_ENABLED, tmState.enabled);
            applyAll();
            try {
                GM_unregisterMenuCommand(toggleId);
                toggleId = GM_registerMenuCommand(label(), onToggle);
            } catch (_) {}
            if (tmState.enabled) showIndicator();
            else if (indicator) indicator.style.display = 'none';
        };

        var toggleId = GM_registerMenuCommand(label(), onToggle);
    }

    function addStyles() {
        GM_addStyle(
            '#gm-speed-indicator{position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.78);color:#fff;padding:7px 15px;border-radius:6px;font:bold 16px/1 sans-serif;z-index:2147483647;display:none;pointer-events:none;user-select:none}'
        );
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================

    async function init() {
        log.log('init() -- readyState:', document.readyState);

        // STEP 1 -- Inject immediately with defaults (synchronous, before any await).
        // Even if the page has not loaded yet, the prototype override
        // must be active in page context before page scripts create videos.
        var injected = injectPageScript(1.0, true);

        // STEP 2 -- Load saved values.
        try {
            tmState.speed   = await TM.storage.loadSetting(STORAGE_KEY_SPEED,   1.0);
            tmState.enabled = await TM.storage.loadSetting(STORAGE_KEY_ENABLED, true);
            log.log('Loaded from storage: speed=' + tmState.speed + ', enabled=' + tmState.enabled);
        } catch (e) {
            log.error('loadSetting error (using defaults):', e);
        }

        // STEP 3 -- Send correct values to injected script.
        sendCmd(tmState.speed, tmState.enabled);

        // STEP 4 -- If injection failed (CSP): unsafeWindow fallback.
        if (!injected) {
            log.warn('Primary injection failed -> fallback 2 (unsafeWindow)...');
            var fallbackOk = setupUnsafeWindowFallback();
            if (!fallbackOk) {
                log.warn('Fallback 2 failed -> fallback 3 (polling)...');
                startDirectPolling();
            } else {
                fallbackApply();
            }
        }

        // STEP 5 -- Set up UI (wait for DOM).
        var setupUI = function () {
            // Only register menu and indicator in top frame.
            // The script runs in every iframe -- without this check,
            // GM_registerMenuCommand would be called multiple times
            // and the prompt would appear multiple times.
            if (window !== window.top) return;
            addStyles();
            setupMenuCommands();
            log.log('UI ready.');
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupUI, { once: true });
        } else {
            setupUI();
        }

        // STEP 6 -- Cross-tab synchronization.
        // When another tab calls GM_setValue, this callback fires immediately.
        // "remote" is true when the change comes from another tab.
        GM_addValueChangeListener(STORAGE_KEY_SPEED, function (_key, _old, newVal, remote) {
            if (!remote) return;
            tmState.speed = newVal;
            sendCmd(tmState.speed, tmState.enabled);
            fallbackApply();
            log.log('Cross-tab: speed set to ' + newVal + 'x.');
        });

        GM_addValueChangeListener(STORAGE_KEY_ENABLED, function (_key, _old, newVal, remote) {
            if (!remote) return;
            tmState.enabled = newVal;
            sendCmd(tmState.speed, tmState.enabled);
            fallbackApply();
            log.log('Cross-tab: enabled set to ' + newVal + '.');
        });
    }

    init().catch(function (e) { log.error('Critical error:', e); });

})();

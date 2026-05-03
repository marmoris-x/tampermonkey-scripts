// ==UserScript==
// @name         Global Video Speed Controller
// @name:de      Globaler Video-Geschwindigkeitsregler
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.4
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
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/global-speed-controller/page-script-builder.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/global-speed-controller/injection-strategies.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/global-speed-controller/ui-controller.js
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
 *
 * MODULES:
 *   page-script-builder.js   -- Generates the page-context script string
 *   injection-strategies.js  -- Three-tier fallback injection (script/unsafeWindow/polling)
 *   ui-controller.js         -- Menu commands, speed indicator, cross-tab sync
 */

(function () {
    'use strict';

    var GSC = window.__GSC__;
    var log = GSC.log;

    // =========================================================
    // INITIALIZATION
    // =========================================================

    /**
     * Bootstraps all three injection strategies and the UI.
     * Called once at document-start before page scripts create video elements.
     */
    async function init() {
        log.log('init() -- readyState:', document.readyState);

        // STEP 1 -- Inject immediately with defaults (synchronous, before any await).
        // Even if the page has not loaded yet, the prototype override
        // must be active in page context before page scripts create videos.
        var injected = GSC.injectPageScript(1.0, true);

        // STEP 2 -- Load saved values.
        try {
            GSC.state.speed   = await TM.storage.loadSetting(GSC.CONST.STORAGE_KEY_SPEED,   1.0);
            GSC.state.enabled = await TM.storage.loadSetting(GSC.CONST.STORAGE_KEY_ENABLED, true);
            log.log('Loaded from storage: speed=' + GSC.state.speed + ', enabled=' + GSC.state.enabled);
        } catch (e) {
            log.error('loadSetting error (using defaults):', e);
        }

        // STEP 3 -- Send correct values to injected script.
        GSC.sendCmd(GSC.state.speed, GSC.state.enabled);

        // STEP 4 -- If injection failed (CSP): unsafeWindow fallback.
        if (!injected) {
            log.warn('Primary injection failed -> fallback 2 (unsafeWindow)...');
            var fallbackOk = GSC.setupUnsafeWindowFallback();
            if (!fallbackOk) {
                log.warn('Fallback 2 failed -> fallback 3 (polling)...');
                GSC.startDirectPolling();
            } else {
                GSC.fallbackApply();
            }
        }

        // STEP 5 -- Set up UI (wait for DOM).
        var setupUI = function () {
            // Only register menu and indicator in top frame.
            // The script runs in every iframe -- without this check,
            // GM_registerMenuCommand would be called multiple times
            // and the prompt would appear multiple times.
            if (window !== window.top) return;
            GSC.addStyles();
            GSC.setupMenuCommands();
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
        GM_addValueChangeListener(GSC.CONST.STORAGE_KEY_SPEED, function (_key, _old, newVal, remote) {
            if (!remote) return;
            GSC.state.speed = newVal;
            GSC.sendCmd(GSC.state.speed, GSC.state.enabled);
            GSC.fallbackApply();
            log.log('Cross-tab: speed set to ' + newVal + 'x.');
        });

        GM_addValueChangeListener(GSC.CONST.STORAGE_KEY_ENABLED, function (_key, _old, newVal, remote) {
            if (!remote) return;
            GSC.state.enabled = newVal;
            GSC.sendCmd(GSC.state.speed, GSC.state.enabled);
            GSC.fallbackApply();
            log.log('Cross-tab: enabled set to ' + newVal + '.');
        });
    }

    init().catch(function (e) { log.error('Critical error:', e); });

})();

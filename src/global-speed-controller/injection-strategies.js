(function () {
    'use strict';

    /**
     * Three-tier fallback injection strategies for Global Video Speed Controller:
     *
     * 1. injectPageScript() -- <script>-tag into page context (primary)
     * 2. setupUnsafeWindowFallback() -- unsafeWindow prototype override (CSP fallback)
     * 3. startDirectPolling() -- periodic force-set via unsafeWindow (last resort)
     */

    var GSC = window.__GSC__ = window.__GSC__ || {};
    var log = GSC.log;

    // =========================================================
    // Helper: Send command to page context
    // =========================================================

    /**
     * Dispatches a CustomEvent to the real page window, carrying speed/enabled values.
     * The injected page script listens for this event to update its state.
     * @param {number} speed
     * @param {boolean} enabled
     */
    GSC.sendCmd = function (speed, enabled) {
        try {
            unsafeWindow.dispatchEvent(
                new unsafeWindow.CustomEvent(GSC.CONST.CMD_EVENT, { detail: { speed: speed, enabled: enabled } })
            );
            log.log('Command sent:', { speed: speed, enabled: enabled });
        } catch (e) {
            log.error('sendCmd failed:', e);
        }
    };

    // =========================================================
    // APPROACH 1: <script>-tag injection into page context
    // =========================================================

    /**
     * Injects a <script> tag containing the page-context code into the document.
     * This is the primary approach -- it allows modifying HTMLMediaElement.prototype
     * in the real page context where videos are created.
     * @param {number} speed
     * @param {boolean} enabled
     * @returns {boolean} true if injection succeeded
     */
    GSC.injectPageScript = function (speed, enabled) {
        try {
            var script = document.createElement('script');
            script.setAttribute('type', 'text/javascript');
            script.textContent = GSC.buildPageScript(speed, enabled);
            (document.head || document.documentElement).appendChild(script);
            script.remove();
            log.log('<script>-tag injection successful.');
            return true;
        } catch (e) {
            log.error('<script>-tag injection failed (CSP?):', e);
            return false;
        }
    };

    // =========================================================
    // APPROACH 2: unsafeWindow Prototype Override (CSP Fallback)
    // =========================================================

    var fallbackOrigDesc   = null;
    var fallbackIsApplying = false;

    /**
     * Sets up a prototype override via unsafeWindow, which Tampermonkey can access
     * even when CSP blocks inline scripts. Stores a global function on the page
     * for applying speed to all elements.
     * @returns {boolean} true if fallback was set up successfully
     */
    GSC.setupUnsafeWindowFallback = function () {
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

            var s = GSC.state;
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
    };

    /**
     * Calls the fallback apply function stored on the page window.
     */
    GSC.fallbackApply = function () {
        try {
            if (unsafeWindow.__gsFallbackApply) {
                unsafeWindow.__gsFallbackApply();
            }
        } catch (e) {
            log.error('fallbackApply error:', e);
        }
    };

    // =========================================================
    // APPROACH 3: Direct polling without prototype override
    // =========================================================

    var pollingActive = false;

    /**
     * Starts a 500ms polling interval that directly sets playbackRate on all
     * media elements. No prototype override -- page scripts can overwrite between
     * intervals, but this is better than nothing as a last resort.
     * Runs for a maximum of 60 ticks (30 seconds).
     */
    GSC.startDirectPolling = function () {
        if (pollingActive) return;
        pollingActive = true;
        log.log('Direct polling started (last resort).');

        var ticks = 0;
        var id = setInterval(function () {
            if (!GSC.state.enabled) return;
            try {
                var els = unsafeWindow.document.querySelectorAll('video, audio');
                for (var i = 0; i < els.length; i++) {
                    var el = els[i];
                    if (Math.abs(el.playbackRate - GSC.state.speed) > 0.001) {
                        log.log('Polling: Set rate', GSC.state.speed, 'on', el.tagName);
                        el.playbackRate = GSC.state.speed;
                    }
                }
            } catch (e) {
                log.error('Polling error:', e);
            }
            if (++ticks >= 60) clearInterval(id);
        }, 500);
    };
})();

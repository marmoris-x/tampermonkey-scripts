(function () {
    'use strict';

    /**
     * Builds the page-context script string that gets injected via <script> tag.
     * This code overrides HTMLMediaElement.prototype.playbackRate in the REAL page
     * context (not the Tampermonkey sandbox), using the same principle as the
     * Global Speed Chrome Extension.
     *
     * The injected script has NO access to GM APIs -- all values are interpolated
     * at build time. Communication back from TM context happens via CustomEvent.
     */

    var GSC = window.__GSC__ = window.__GSC__ || {};

    // Initialize shared state/constants (runs once, idempotent on re-require)
    if (!GSC.state) {
        GSC.state = {
            speed:   1.0,
            enabled: true,
        };
    }
    if (!GSC.CONST) {
        GSC.CONST = {
            PAGE_LOG:           '[GlobalSpeed-Page]',
            CMD_EVENT:          '__GS_CMD__',
            STORAGE_KEY_SPEED:   'global_video_speed',
            STORAGE_KEY_ENABLED: 'global_video_speed_enabled',
        };
    }
    if (!GSC.log) {
        GSC.log = TM.createLogger('Global Video Speed Controller');
    }

    /**
     * Generates the full page-context script as a string.
     * @param {number} initialSpeed - Starting playback speed
     * @param {boolean} initialEnabled - Whether speed control is active
     * @returns {string} Page-context JavaScript code
     */
    GSC.buildPageScript = function (initialSpeed, initialEnabled) {
        var PAGE_LOG  = GSC.CONST.PAGE_LOG;
        var CMD_EVENT = GSC.CONST.CMD_EVENT;

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
    };
})();

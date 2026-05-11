import { CONST } from './_constants.js';

/**
 * Builds the page-context injection script as a string.
 * This script runs in the MAIN_WORLD (page context) and overrides
 * HTMLMediaElement.prototype.playbackRate to enforce global speed.
 *
 * @param {number} initialSpeed - Initial playback speed
 * @param {boolean} initialEnabled - Initial enabled state
 * @returns {string} Complete IIFE script string for injection
 */
export function buildPageScript(initialSpeed, initialEnabled) {
  const { PAGE_LOG, CMD_EVENT } = CONST;

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

    const LOG = '${PAGE_LOG}';

    // Save original descriptor BEFORE any page script can modify it
    const origDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!origDesc || !origDesc.get || !origDesc.set) {
        console.error(LOG, 'FATAL: playbackRate descriptor not found or no getter/setter.', origDesc);
        return;
    }

    console.log(LOG, 'Initialization. speed=' + window.__GS_SPEED__ + ', enabled=' + window.__GS_ENABLED__);

    let isApplying = false;
    const seen = new WeakSet();

    // --------------------------------------------------
    // Prototype override (runs in page context)
    // --------------------------------------------------
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        configurable: true,
        enumerable:   true,
        get() {
            return window.__GS_ENABLED__ ? window.__GS_SPEED__ : origDesc.get.call(this);
        },
        set(rate) {
            // Only let our values through; ignore page script values
            if (isApplying || !window.__GS_ENABLED__) {
                origDesc.set.call(this, rate);
            }
        }
    });

    // --------------------------------------------------
    // Apply speed to a single media element
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
        document.querySelectorAll('video, audio').forEach(el => applyTo(el));
    }

    function resetAll() {
        document.querySelectorAll('video, audio').forEach(el => resetTo(el, 1.0));
    }

    // --------------------------------------------------
    // Register element & attach event listeners
    // --------------------------------------------------
    function register(el) {
        if (!(el instanceof HTMLMediaElement)) return;
        if (seen.has(el)) return;
        seen.add(el);

        applyTo(el);

        // If page changes rate -- correct immediately
        el.addEventListener('ratechange', function () {
            if (!isApplying && window.__GS_ENABLED__) {
                const real = origDesc.get.call(el);
                if (real !== window.__GS_SPEED__) {
                    console.log(LOG, 'ratechange correction:', real, '->', window.__GS_SPEED__);
                    applyTo(el);
                }
            }
        }, true);

        // Ensure correct rate on these lifecycle events
        ['play', 'playing', 'loadedmetadata', 'canplay', 'seeked'].forEach(function (evt) {
            el.addEventListener(evt, function () { if (window.__GS_ENABLED__) applyTo(el); }, true);
        });
    }

    // --------------------------------------------------
    // MutationObserver for dynamic media elements
    // --------------------------------------------------
    function observeRoot(root) {
        new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!node || node.nodeType !== 1) continue;
                    if (node instanceof HTMLMediaElement) {
                        register(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('video, audio').forEach(el => register(el));
                    }
                }
            }
        }).observe(root, { childList: true, subtree: true });
    }

    observeRoot(document.documentElement);

    // --------------------------------------------------
    // Shadow DOM interception
    // --------------------------------------------------
    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (opts) {
        const shadow = origAttachShadow.call(this, opts);
        observeRoot(shadow);
        setTimeout(() => { shadow.querySelectorAll('video, audio').forEach(el => register(el)); }, 0);
        setTimeout(() => { shadow.querySelectorAll('video, audio').forEach(el => register(el)); }, 500);
        return shadow;
    };

    // --------------------------------------------------
    // Immediate scan for existing media elements
    // --------------------------------------------------
    applyToAll();

    // --------------------------------------------------
    // Periodic correction scan (30 seconds)
    // --------------------------------------------------
    let ticks = 0;
    const timer = setInterval(function () {
        if (window.__GS_ENABLED__) {
            document.querySelectorAll('video, audio').forEach(function (el) {
                if (!seen.has(el)) {
                    console.log(LOG, 'Periodic scan: new element found.');
                    register(el);
                } else {
                    const real = origDesc.get.call(el);
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
    // Receive commands from Tampermonkey sandbox
    // --------------------------------------------------
    window.addEventListener('${CMD_EVENT}', function (e) {
        const { speed, enabled } = e.detail || {};
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

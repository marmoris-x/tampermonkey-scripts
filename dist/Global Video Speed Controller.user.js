// ==UserScript==
// @name            Global Video Speed Controller
// @name:de         Globaler Video-Geschwindigkeitsregler
// @namespace       https://github.com/marmoris-x/tampermonkey-scripts
// @version         2.6.2
// @author          marmoris-x
// @description     Sets a global playback speed for all HTML5 videos and audios.
// @description:de  Setzt eine globale Wiedergabegeschwindigkeit für alle HTML5-Videos und -Audios.
// @license         MIT
// @icon            https://lh3.googleusercontent.com/tPBNat6dgVmnj-qBCsqizbjByLu2x-XTgTFR7MGKWiPwDk422k5eF7_9B__pTlfm97JTt4X7YeIgq0za-3qaR6O6vQ=s60
// @supportURL      https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL     https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Global%20Video%20Speed%20Controller.user.js
// @updateURL       https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Global%20Video%20Speed%20Controller.user.js
// @match           http://*/*
// @match           https://*/*
// @sandbox         JavaScript
// @grant           GM.getValue
// @grant           GM.setValue
// @grant           GM_addElement
// @grant           GM_addStyle
// @grant           GM_addValueChangeListener
// @grant           GM_registerMenuCommand
// @grant           GM_unregisterMenuCommand
// @grant           unsafeWindow
// @run-at          document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  function createLogger(prefix, debugMode = false) {
    const isDebug = debugMode ?? false;
    const tag = `[${prefix}]`;
    return {
      log: (...args) => console.log(tag, ...args),
      warn: (...args) => console.warn(tag, ...args),
      error: (...args) => console.error(tag, ...args),
      info: (...args) => console.info(tag, ...args),
      debug: (...args) => {
        if (isDebug) console.debug(tag, ...args);
      }
    };
  }
  const log$5 = createLogger("GlobalSpeed-State");
  const state = {
speed: 1,
enabled: true,
setSpeed(newSpeed) {
      const clamped = Math.max(0.07, Math.min(16, newSpeed));
      if (clamped !== this.speed) {
        this.speed = clamped;
        log$5.debug("Speed changed:", clamped);
        return true;
      }
      return false;
    },
setEnabled(flag) {
      const bool = Boolean(flag);
      if (bool !== this.enabled) {
        this.enabled = bool;
        log$5.debug("Enabled changed:", bool);
        return true;
      }
      return false;
    }
  };
  const CONST = Object.freeze({
    PAGE_LOG: "[GlobalSpeed-Page]",
    CMD_EVENT: "__GS_CMD__",
    STORAGE_KEY_SPEED: "global_video_speed",
    STORAGE_KEY_ENABLED: "global_video_speed_enabled",
    SPEED_MIN: 0.07,
    SPEED_MAX: 16,
    SPEED_DEFAULT: 1,
    ENABLED_DEFAULT: true,
    INDICATOR_ID: "gm-speed-indicator",
    POLLING_INTERVAL_MS: 500,
    POLLING_MAX_TICKS: 60,
    PERIODIC_SCAN_MAX: 30,
    INDICATOR_TIMEOUT_MS: 1500
  });
  async function loadSetting(key, defaultValue) {
    try {
      const raw = await GM.getValue(key);
      return raw === void 0 || raw === null ? defaultValue : raw;
    } catch (e) {
      console.warn("[GlobalSpeed-Storage] loadSetting failed, using default:", e);
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    try {
      await GM.setValue(key, value);
    } catch (e) {
      console.error("[GlobalSpeed-Storage] saveSetting failed:", e);
    }
  }
  async function loadAllSettings() {
    const [speed, enabled] = await Promise.all([
      loadSetting(CONST.STORAGE_KEY_SPEED, CONST.SPEED_DEFAULT),
      loadSetting(CONST.STORAGE_KEY_ENABLED, CONST.ENABLED_DEFAULT)
    ]);
    return { speed, enabled };
  }
  function buildPageScript(initialSpeed, initialEnabled) {
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
  const log$4 = createLogger("GlobalSpeed-Injector");
  function injectPageScript(speed, enabled) {
    try {
      const scriptContent = buildPageScript(speed, enabled);
      if (typeof GM_addElement !== "undefined") {
        GM_addElement("script", {
          type: "text/javascript",
          textContent: scriptContent
        });
        log$4.log("Page script injected via GM_addElement.");
        return true;
      }
      const script = document.createElement("script");
      script.setAttribute("type", "text/javascript");
      script.textContent = scriptContent;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      log$4.log("Page script injected via DOM (CSP may block this).");
      return true;
    } catch (e) {
      log$4.error("Page script injection failed (CSP likely):", e);
      return false;
    }
  }
  const log$3 = createLogger("GlobalSpeed-Fallback");
  let fallbackOrigDesc = null;
  function setupUnsafeWindowFallback() {
    try {
      const uw = unsafeWindow;
      if (!uw || !uw.HTMLMediaElement) {
        log$3.warn("Fallback: unsafeWindow.HTMLMediaElement not available.");
        return false;
      }
      fallbackOrigDesc = Object.getOwnPropertyDescriptor(
        uw.HTMLMediaElement.prototype,
        "playbackRate"
      );
      if (!fallbackOrigDesc || !fallbackOrigDesc.get || !fallbackOrigDesc.set) {
        log$3.warn("Fallback: descriptor not usable.");
        return false;
      }
      const fd = fallbackOrigDesc;
      let isApplying = false;
      Object.defineProperty(uw.HTMLMediaElement.prototype, "playbackRate", {
        configurable: true,
        enumerable: true,
        get() {
          return state.enabled ? state.speed : fd.get.call(this);
        },
        set(rate) {
          if (isApplying || !state.enabled) fd.set.call(this, rate);
        }
      });
      unsafeWindow.__gsFallbackApply = function() {
        const elements = uw.document.querySelectorAll("video, audio");
        elements.forEach(function(el) {
          try {
            isApplying = true;
            fd.set.call(el, state.enabled ? state.speed : 1);
          } finally {
            isApplying = false;
          }
        });
      };
      log$3.log("unsafeWindow fallback active.");
      return true;
    } catch (e) {
      log$3.error("unsafeWindow fallback error:", e);
      return false;
    }
  }
  function fallbackApply() {
    try {
      if (unsafeWindow.__gsFallbackApply) {
        unsafeWindow.__gsFallbackApply();
      }
    } catch (e) {
      log$3.error("fallbackApply error:", e);
    }
  }
  const log$2 = createLogger("GlobalSpeed-Polling");
  let pollingActive = false;
  function startDirectPolling() {
    if (pollingActive) return;
    pollingActive = true;
    log$2.log("Direct polling started (last resort).");
    let ticks = 0;
    const id = setInterval(function() {
      if (!state.enabled) return;
      try {
        const els = unsafeWindow.document.querySelectorAll("video, audio");
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          if (Math.abs(el.playbackRate - state.speed) > 1e-3) {
            log$2.log("Polling: Set rate", state.speed, "on", el.tagName);
            el.playbackRate = state.speed;
          }
        }
      } catch (e) {
        log$2.error("Polling error:", e);
      }
      if (++ticks >= CONST.POLLING_MAX_TICKS) clearInterval(id);
    }, CONST.POLLING_INTERVAL_MS);
  }
  let indicator = null;
  function showIndicator() {
    if (!state.enabled) return;
    try {
      const doc = unsafeWindow.document;
      if (!doc.body) return;
      if (!indicator) {
        indicator = doc.createElement("div");
        indicator.id = CONST.INDICATOR_ID;
        doc.body.appendChild(indicator);
      }
      indicator.textContent = state.speed.toFixed(2) + "x";
      indicator.style.display = "block";
      clearTimeout(indicator._timeout);
      indicator._timeout = setTimeout(function() {
        if (indicator) indicator.style.display = "none";
      }, CONST.INDICATOR_TIMEOUT_MS);
    } catch (e) {
    }
  }
  function hideIndicator() {
    if (indicator) indicator.style.display = "none";
  }
  let _applyAllCallback = null;
  function setupMenuCommands(applyAllFn, showIndicatorFn, hideIndicatorFn) {
    _applyAllCallback = applyAllFn;
    let setSpeedId = null;
    let toggleId = null;
    const setSpeedHandler = async function() {
      const input = prompt("Playback speed (0.07 - 16):", String(state.speed));
      const val = parseFloat(input);
      if (input !== null && !isNaN(val) && val > 0) {
        state.setSpeed(val);
        await saveSetting(CONST.STORAGE_KEY_SPEED, state.speed);
        _applyAllCallback();
        showIndicatorFn();
      }
    };
    setSpeedId = GM_registerMenuCommand(
      "Set speed (" + state.speed.toFixed(2) + "x)",
      setSpeedHandler
    );
    window.__gsUpdateSetSpeedLabel = function() {
      if (window !== window.top) return;
      try {
        GM_unregisterMenuCommand(setSpeedId);
      } catch (_) {
      }
      setSpeedId = GM_registerMenuCommand(
        "Set speed (" + state.speed.toFixed(2) + "x)",
        setSpeedHandler
      );
    };
    window.__gsUpdateSetSpeedLabel();
    GM_registerMenuCommand("Reset (1.0x)", async function() {
      state.setSpeed(1);
      await saveSetting(CONST.STORAGE_KEY_SPEED, state.speed);
      _applyAllCallback();
      showIndicatorFn();
    });
    const label = function() {
      return state.enabled ? "Disable Global Speed" : "Enable Global Speed";
    };
    const onToggle = async function() {
      state.setEnabled(!state.enabled);
      await saveSetting(CONST.STORAGE_KEY_ENABLED, state.enabled);
      _applyAllCallback();
      try {
        GM_unregisterMenuCommand(toggleId);
        toggleId = GM_registerMenuCommand(label(), onToggle);
      } catch (_) {
      }
      if (state.enabled) showIndicatorFn();
      else hideIndicatorFn();
    };
    toggleId = GM_registerMenuCommand(label(), onToggle);
  }
  const log$1 = createLogger("GlobalSpeed-Sync");
  function setupCrossTabSync(applyAllFn) {
    GM_addValueChangeListener(CONST.STORAGE_KEY_SPEED, function(_key, _old, newVal, remote) {
      if (!remote) return;
      state.setSpeed(newVal);
      applyAllFn();
      log$1.log("Cross-tab: speed set to " + newVal + "x.");
    });
    GM_addValueChangeListener(CONST.STORAGE_KEY_ENABLED, function(_key, _old, newVal, remote) {
      if (!remote) return;
      state.setEnabled(newVal);
      applyAllFn();
      log$1.log("Cross-tab: enabled set to " + newVal + ".");
    });
    log$1.log("Cross-tab synchronization active.");
  }
  function injectStyles() {
    GM_addStyle(`
    #${CONST.INDICATOR_ID} {
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.78);
      color: #fff;
      padding: 7px 15px;
      border-radius: 6px;
      font: bold 16px/1 sans-serif;
      z-index: 2147483647;
      display: none;
      pointer-events: none;
      user-select: none;
    }
  `);
  }
  const log = createLogger("GlobalSpeed-Boot");
  function sendCommand(speed, enabled) {
    try {
      unsafeWindow.dispatchEvent(
        new unsafeWindow.CustomEvent(CONST.CMD_EVENT, { detail: { speed, enabled } })
      );
      log.debug("Command sent:", { speed, enabled });
    } catch (e) {
      log.error("sendCommand failed:", e);
    }
  }
  function applyAll() {
    sendCommand(state.speed, state.enabled);
    fallbackApply();
    if (window.__gsUpdateSetSpeedLabel) window.__gsUpdateSetSpeedLabel();
  }
  async function init() {
    log.log("init() — readyState:", document.readyState);
    const injected = injectPageScript(CONST.SPEED_DEFAULT, CONST.ENABLED_DEFAULT);
    try {
      const { speed, enabled } = await loadAllSettings();
      state.setSpeed(speed);
      state.setEnabled(enabled);
      log.log("Loaded from storage: speed=" + state.speed + ", enabled=" + state.enabled);
    } catch (e) {
      log.error("loadSettings error (using defaults):", e);
    }
    sendCommand(state.speed, state.enabled);
    if (!injected) {
      log.warn("Primary injection failed → activating unsafeWindow fallback...");
      const fallbackOk = setupUnsafeWindowFallback();
      if (!fallbackOk) {
        log.warn("unsafeWindow fallback failed → activating direct polling...");
        startDirectPolling();
      } else {
        fallbackApply();
      }
    }
    const setupUI = function() {
      if (window !== window.top) return;
      injectStyles();
      setupMenuCommands(applyAll, showIndicator, hideIndicator);
      setupCrossTabSync(applyAll);
      log.log("UI ready.");
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupUI, { once: true });
    } else {
      setupUI();
    }
  }
  
  init().catch(console.error);

})();
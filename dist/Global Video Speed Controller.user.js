// ==UserScript==
// @name         Global Video Speed Controller
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.5.0
// @author       marmoris-x
// @description  Sets a global playback speed for all HTML5 videos and audios.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=example.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Global%20Video%20Speed%20Controller.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Global%20Video%20Speed%20Controller.user.js
// @match        http://*/*
// @match        https://*/*
// @sandbox      JavaScript
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @inject-into  content
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.createLogger = createLogger;
  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    var tag = "[" + prefix + "]";
    return {
      log: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          var args = [tag];
          for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  var state = {
    speed: 1,
    enabled: true
  };
  var CONST = {
    PAGE_LOG: "[GlobalSpeed-Page]",
    CMD_EVENT: "__GS_CMD__",
    STORAGE_KEY_SPEED: "global_video_speed",
    STORAGE_KEY_ENABLED: "global_video_speed_enabled"
  };
  var log = createLogger("Global Video Speed Controller");
  function buildPageScript(initialSpeed, initialEnabled) {
    var PAGE_LOG = CONST.PAGE_LOG;
    var CMD_EVENT = CONST.CMD_EVENT;
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
  function sendCmd(speed, enabled) {
    try {
      unsafeWindow.dispatchEvent(
        new unsafeWindow.CustomEvent(CONST.CMD_EVENT, { detail: { speed, enabled } })
      );
      log.log("Command sent:", { speed, enabled });
    } catch (e) {
      log.error("sendCmd failed:", e);
    }
  }
  function injectPageScript(speed, enabled) {
    try {
      var script = document.createElement("script");
      script.setAttribute("type", "text/javascript");
      script.textContent = buildPageScript(speed, enabled);
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      log.log("<script>-tag injection successful.");
      return true;
    } catch (e) {
      log.error("<script>-tag injection failed (CSP?):", e);
      return false;
    }
  }
  var fallbackOrigDesc = null;
  function setupUnsafeWindowFallback() {
    try {
      var uw = unsafeWindow;
      if (!uw || !uw.HTMLMediaElement) {
        log.warn("Fallback: unsafeWindow.HTMLMediaElement not available.");
        return false;
      }
      fallbackOrigDesc = Object.getOwnPropertyDescriptor(
        uw.HTMLMediaElement.prototype,
        "playbackRate"
      );
      if (!fallbackOrigDesc || !fallbackOrigDesc.get || !fallbackOrigDesc.set) {
        log.warn("Fallback: descriptor not usable.");
        return false;
      }
      var fd = fallbackOrigDesc;
      var fa = false;
      Object.defineProperty(uw.HTMLMediaElement.prototype, "playbackRate", {
        configurable: true,
        enumerable: true,
        get: function() {
          return state.enabled ? state.speed : fd.get.call(this);
        },
        set: function(rate) {
          if (fa || !state.enabled) fd.set.call(this, rate);
        }
      });
      unsafeWindow.__gsFallbackApply = function() {
        var elements = uw.document.querySelectorAll("video, audio");
        elements.forEach(function(el) {
          try {
            fa = true;
            fd.set.call(el, state.enabled ? state.speed : 1);
          } finally {
            fa = false;
          }
        });
      };
      log.log("unsafeWindow fallback active.");
      return true;
    } catch (e) {
      log.error("unsafeWindow fallback error:", e);
      return false;
    }
  }
  function fallbackApply() {
    try {
      if (unsafeWindow.__gsFallbackApply) {
        unsafeWindow.__gsFallbackApply();
      }
    } catch (e) {
      log.error("fallbackApply error:", e);
    }
  }
  var pollingActive = false;
  function startDirectPolling() {
    if (pollingActive) return;
    pollingActive = true;
    log.log("Direct polling started (last resort).");
    var ticks = 0;
    var id = setInterval(function() {
      if (!state.enabled) return;
      try {
        var els = unsafeWindow.document.querySelectorAll("video, audio");
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (Math.abs(el.playbackRate - state.speed) > 1e-3) {
            log.log("Polling: Set rate", state.speed, "on", el.tagName);
            el.playbackRate = state.speed;
          }
        }
      } catch (e) {
        log.error("Polling error:", e);
      }
      if (++ticks >= 60) clearInterval(id);
    }, 500);
  }
  var indicator = null;
  function showIndicator() {
    if (!state.enabled) return;
    try {
      var doc = unsafeWindow.document;
      if (!doc.body) return;
      if (!indicator) {
        indicator = doc.createElement("div");
        indicator.id = "gm-speed-indicator";
        doc.body.appendChild(indicator);
      }
      indicator.textContent = state.speed.toFixed(2) + "x";
      indicator.style.display = "block";
      clearTimeout(indicator._timeout);
      indicator._timeout = setTimeout(function() {
        if (indicator) indicator.style.display = "none";
      }, 1500);
    } catch (e) {
    }
  }
  function applyAll() {
    sendCmd(state.speed, state.enabled);
    fallbackApply();
    updateSetSpeedLabel();
  }
  function updateSetSpeedLabel() {
    if (window.__gsUpdateSetSpeedLabel) window.__gsUpdateSetSpeedLabel();
  }
  function setupMenuCommands() {
    var setSpeedHandler = async function() {
      var input = prompt("Playback speed (0.07 - 16):", String(state.speed));
      var val = parseFloat(input);
      if (input !== null && !isNaN(val) && val > 0) {
        state.speed = Math.max(0.07, Math.min(16, val));
        await GM.setValue(CONST.STORAGE_KEY_SPEED, state.speed);
        applyAll();
        showIndicator();
      }
    };
    var setSpeedId = GM_registerMenuCommand(
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
    updateSetSpeedLabel();
    GM_registerMenuCommand("Reset (1.0x)", async function() {
      state.speed = 1;
      await GM.setValue(CONST.STORAGE_KEY_SPEED, state.speed);
      applyAll();
      showIndicator();
    });
    var label = function() {
      return state.enabled ? "Disable Global Speed" : "Enable Global Speed";
    };
    var onToggle = async function() {
      state.enabled = !state.enabled;
      await GM.setValue(CONST.STORAGE_KEY_ENABLED, state.enabled);
      applyAll();
      try {
        GM_unregisterMenuCommand(toggleId);
        toggleId = GM_registerMenuCommand(label(), onToggle);
      } catch (_) {
      }
      if (state.enabled) showIndicator();
      else if (indicator) indicator.style.display = "none";
    };
    var toggleId = GM_registerMenuCommand(label(), onToggle);
  }
  function addStyles() {
    GM_addStyle(
      "#gm-speed-indicator{position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.78);color:#fff;padding:7px 15px;border-radius:6px;font:bold 16px/1 sans-serif;z-index:2147483647;display:none;pointer-events:none;user-select:none}"
    );
  }
  globalThis.TM = globalThis.TM || {};
  globalThis.TM.storage = {
    loadSetting,
    saveSetting,
    loadSettings,
    saveSettings
  };
  async function loadSetting(key, defaultValue) {
    try {
      var raw = await GM.getValue(key);
      if (raw === void 0 || raw === null) return defaultValue;
      return raw;
    } catch (e) {
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    await GM.setValue(key, value);
  }
  async function loadSettings(defaults) {
    var keys = Object.keys(defaults);
    var result = {};
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = await loadSetting(keys[i], defaults[keys[i]]);
    }
    return result;
  }
  async function saveSettings(obj) {
    await GM.setValues(obj);
  }
  // @license      MIT
  async function init() {
    log.log("init() -- readyState:", document.readyState);
    var injected = injectPageScript(1, true);
    try {
      state.speed = await loadSetting(CONST.STORAGE_KEY_SPEED, 1);
      state.enabled = await loadSetting(CONST.STORAGE_KEY_ENABLED, true);
      log.log("Loaded from storage: speed=" + state.speed + ", enabled=" + state.enabled);
    } catch (e) {
      log.error("loadSetting error (using defaults):", e);
    }
    sendCmd(state.speed, state.enabled);
    if (!injected) {
      log.warn("Primary injection failed -> fallback 2 (unsafeWindow)...");
      var fallbackOk = setupUnsafeWindowFallback();
      if (!fallbackOk) {
        log.warn("Fallback 2 failed -> fallback 3 (polling)...");
        startDirectPolling();
      } else {
        fallbackApply();
      }
    }
    var setupUI = function() {
      if (window !== window.top) return;
      addStyles();
      setupMenuCommands();
      log.log("UI ready.");
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupUI, { once: true });
    } else {
      setupUI();
    }
    GM_addValueChangeListener(CONST.STORAGE_KEY_SPEED, function(_key, _old, newVal, remote) {
      if (!remote) return;
      state.speed = newVal;
      sendCmd(state.speed, state.enabled);
      fallbackApply();
      log.log("Cross-tab: speed set to " + newVal + "x.");
    });
    GM_addValueChangeListener(CONST.STORAGE_KEY_ENABLED, function(_key, _old, newVal, remote) {
      if (!remote) return;
      state.enabled = newVal;
      sendCmd(state.speed, state.enabled);
      fallbackApply();
      log.log("Cross-tab: enabled set to " + newVal + ".");
    });
  }
  init().catch(function(e) {
    log.error("Critical error:", e);
  });

})();
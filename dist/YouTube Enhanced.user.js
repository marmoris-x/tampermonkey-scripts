// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.9.0
// @author       marmoris-x
// @description  Auto max video quality, per-channel playback speed control & auto-stop on page load.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @match        *://*.youtube.com/*
// @sandbox      JavaScript
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @inject-into  content
// @run-at       document-start
// @noframes
// @unwrap
// ==/UserScript==

(function () {
  'use strict';

  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    const tag = "[" + prefix + "]";
    return {
      log: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          const args = [tag];
          for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  const log$2 = createLogger("YouTube Enhanced");
  const THIRTY_DAYS_MS = 2592e6;
  const CFG = {
    debug: false,
    preferredQuality: 8
};
  const QUALITY_MAP = {
    0: "auto",
    5: "hd720",
    6: "hd1080",
    7: "hd1440",
    8: "hd2160"
  };
  let handledVidsHD = new WeakSet();
  function resetHDTrackers() {
    handledVidsHD = new WeakSet();
  }
  function patchQuality() {
    try {
      const KEY = "yt-player-user-settings";
      let us = {};
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (p && p.data) us = JSON.parse(p.data);
        }
      } catch (_) {
      }
      const now = Date.now();
      us["482"] = { intValue: CFG.preferredQuality };
      localStorage.setItem(KEY, JSON.stringify({
        creation: now,
        data: JSON.stringify(us),
        expiration: now + THIRTY_DAYS_MS
      }));
      localStorage.setItem("yt-player-quality", JSON.stringify({
        data: JSON.stringify({ quality: QUALITY_MAP[CFG.preferredQuality], previousQuality: "auto" }),
        expiration: now + THIRTY_DAYS_MS,
        creation: now
      }));
    } catch (e) {
      log$2.debug("patchQuality error:", e);
    }
  }
  function applyAutoHD(ytPlayer) {
    try {
      if (!ytPlayer || typeof ytPlayer.getAvailableQualityLevels !== "function") return;
      const levels = ytPlayer.getAvailableQualityLevels();
      if (!levels || levels.length === 0) return;
      const desired = QUALITY_MAP[CFG.preferredQuality];
      let targetQuality = null;
      if (desired && desired !== "auto") {
        targetQuality = levels.find(function(q) {
          return q === desired;
        });
      }
      if (!targetQuality) {
        targetQuality = levels.find(function(q) {
          return q && q !== "auto";
        });
      }
      if (targetQuality) {
        if (typeof ytPlayer.setPlaybackQualityRange === "function") {
          ytPlayer.setPlaybackQualityRange(targetQuality, targetQuality);
        }
        log$2.debug("AutoHD: Set to", targetQuality);
      }
    } catch (e) {
      log$2.debug("applyAutoHD error:", e);
    }
  }
  function initAutoHD(ytPlayer, vid) {
    if (!ytPlayer || !vid || handledVidsHD.has(vid)) return;
    handledVidsHD.add(vid);
    const force = function() {
      return applyAutoHD(ytPlayer);
    };
    force();
    vid.addEventListener("loadedmetadata", force, { once: true });
    vid.addEventListener("playing", function() {
      setTimeout(force, 100);
    }, { once: true });
  }
  async function loadSetting(key, defaultValue) {
    try {
      const raw = await GM.getValue(key);
      if (raw === void 0 || raw === null) return defaultValue;
      return raw;
    } catch (e) {
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    await GM.setValue(key, value);
  }
  function observeMutations(callback, root) {
    root = root || document.body;
    const observer = new MutationObserver(function(mutations) {
      for (let m = 0; m < mutations.length; m++) {
        const nodes = mutations[m].addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  }
  function normalizeText(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[äæ]/g, "ae").replace(/[öœ]/g, "oe").replace(/[ü]/g, "ue").replace(/ß/g, "ss").replace(/[àáâãå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i").replace(/[òóôõ]/g, "o").replace(/[ùúû]/g, "u").replace(/[ñ]/g, "n").replace(/[ç]/g, "c").replace(/[-_.:]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function matchAnyTerm(text, terms) {
    const n = normalizeText(text);
    for (let i = 0; i < terms.length; i++) {
      if (n.indexOf(normalizeText(terms[i])) !== -1) return true;
    }
    return false;
  }
  function getLanguage() {
    const browserLang = navigator.language;
    if (browserLang && browserLang.toLowerCase().startsWith("de")) return "de";
    return "en";
  }
  const isGerman = getLanguage() === "de";
  const LANG = {
    isGerman,
    backToPreviousMenu: isGerman ? "Zurück zum vorherigen Menü" : "Back to previous menu",
    channelSpeed: isGerman ? "Kanalgeschwindigkeit" : "Channel speed",
    decreaseSpeed: isGerman ? "Kanalgeschwindigkeit reduzieren 0,05" : "Decrease speed 0.05",
    increaseSpeed: isGerman ? "Kanalgeschwindigkeit erhöhen 0,05" : "Increase speed 0.05",
    standard: isGerman ? "Normal" : "Normal",
    channelSpeedLabel: isGerman ? "Kanalgeschwindigkeit" : "Channel speed"
  };
  const log$1 = createLogger("YouTube Enhanced");
  function roundSpeed(v) {
    return Math.round(v * 100) / 100;
  }
  function clampSpeed(v) {
    return Math.max(0.25, Math.min(3, v));
  }
  const SPEED_KEY = "yt_suite_channel_speeds";
  const MENU_DELAY = 50;
  const SPEED_RETRY = 1e3;
  const INIT_TIMEOUT = 15e3;
  let speedCache = {};
  const speedObs = new Set();
  let speedAbort = null;
  let speedRetryTimeout = null;
  let speedInitTimeout = null;
  let currentChannelId = null;
  let activeChannelSpeed = null;
  let browserOrigDesc = null;
  let previousDescriptor = null;
  let menuPanel = null;
  let customPanel = null;
  let inCustomPanel = false;
  let origMenuWidth = "";
  let origMenuHeight = "";
  (function installPrototypeOverride() {
    try {
      var iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.documentElement.appendChild(iframe);
      browserOrigDesc = Object.getOwnPropertyDescriptor(
        iframe.contentWindow.HTMLMediaElement.prototype,
        "playbackRate"
      );
      iframe.remove();
      if (!browserOrigDesc || !browserOrigDesc.get || !browserOrigDesc.set) {
        log$1.error("Prototype override: could not capture browser descriptor");
        return;
      }
      previousDescriptor = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "playbackRate"
      );
      if (!previousDescriptor || !previousDescriptor.get || !previousDescriptor.set) {
        previousDescriptor = browserOrigDesc;
      }
      Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", {
        configurable: true,
        enumerable: true,
        get: function() {
          if (activeChannelSpeed !== null) return activeChannelSpeed;
          return previousDescriptor.get.call(this);
        },
        set: function(rate) {
          if (activeChannelSpeed !== null) {
            browserOrigDesc.set.call(this, activeChannelSpeed);
          } else {
            previousDescriptor.set.call(this, rate);
          }
        }
      });
      log$1.debug("Prototype override installed for channel speed protection");
    } catch (e) {
      log$1.error("Failed to install prototype override:", e);
    }
  })();
  function getSpeeds() {
    return speedCache;
  }
  async function loadSpeedData() {
    try {
      speedCache = await loadSetting(SPEED_KEY, {});
    } catch (_) {
      speedCache = {};
    }
  }
  async function saveSpeed(cid, val) {
    try {
      speedCache[cid] = val;
      await saveSetting(SPEED_KEY, speedCache);
    } catch (e) {
      log$1.debug("saveSpeed error:", e);
    }
  }
  function applySpeed(val) {
    try {
      const vid = document.querySelector(".html5-main-video");
      if (!vid) return;
      const realRate = browserOrigDesc ? browserOrigDesc.get.call(vid) : vid.playbackRate;
      if (Math.abs(realRate - val) < 1e-3) return;
      activeChannelSpeed = val;
      try {
        window.__GS_ENABLED__ = false;
      } catch (_) {
      }
      if (browserOrigDesc) {
        browserOrigDesc.set.call(vid, val);
      } else {
        vid.playbackRate = val;
      }
    } catch (e) {
      log$1.debug("applySpeed error:", e);
    }
  }
  function getChannelId() {
    try {
      const a = document.querySelector("#upload-info #channel-name #text a");
      if (a) return new URL(a.href).pathname.split("/").pop();
      const shortsChannel = document.querySelector("ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a");
      if (shortsChannel) return new URL(shortsChannel.href).pathname.split("/").pop();
      const anyChannel = document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
      if (anyChannel) return new URL(anyChannel.href).pathname.split("/").pop();
    } catch (_) {
    }
    return null;
  }
  function buildSpeedPanel(settingsMenu) {
    const panel = document.createElement("div");
    panel.className = "ytp-panel";
    panel.style.cssText = "width:330px;height:250px";
    const header = document.createElement("div");
    header.className = "ytp-panel-header";
    const backBtnContainer = document.createElement("div");
    backBtnContainer.className = "ytp-panel-back-button-container";
    const backBtn = document.createElement("button");
    backBtn.className = "ytp-button ytp-panel-back-button";
    backBtn.setAttribute("aria-label", LANG.backToPreviousMenu);
    backBtnContainer.appendChild(backBtn);
    header.appendChild(backBtnContainer);
    const title = document.createElement("span");
    title.className = "ytp-panel-title";
    title.setAttribute("role", "heading");
    title.setAttribute("aria-level", "2");
    title.textContent = LANG.channelSpeed;
    header.appendChild(title);
    panel.appendChild(header);
    const content = document.createElement("div");
    content.className = "ytp-variable-speed-panel-content";
    content.setAttribute("tabindex", "0");
    content.style.height = "193px";
    const displayContainer = document.createElement("div");
    displayContainer.className = "ytp-speed-display-container";
    const display = document.createElement("div");
    display.className = "ytp-variable-speed-panel-display";
    display.setAttribute("aria-live", "polite");
    const badge = document.createElement("div");
    badge.className = "ytp-variable-speed-panel-premium-badge";
    badge.setAttribute("tabindex", "-1");
    const badgeInner = document.createElement("div");
    badgeInner.className = "ytp-variable-speed-panel-badge";
    badge.appendChild(badgeInner);
    display.appendChild(badge);
    const displayText = document.createElement("span");
    displayText.textContent = "1.00x";
    display.appendChild(displayText);
    displayContainer.appendChild(display);
    content.appendChild(displayContainer);
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "ytp-variable-speed-panel-slider-container";
    const btnDec = document.createElement("button");
    btnDec.className = "ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button";
    btnDec.setAttribute("aria-label", LANG.decreaseSpeed);
    const decSpan = document.createElement("span");
    decSpan.textContent = "-";
    btnDec.appendChild(decSpan);
    sliderContainer.appendChild(btnDec);
    const sliderSection = document.createElement("div");
    sliderSection.className = "ytp-input-slider-section";
    const indicator = document.createElement("div");
    indicator.className = "ytp-speedslider-indicator-container";
    const sliderBadge = document.createElement("div");
    sliderBadge.className = "ytp-speedslider-badge";
    sliderBadge.setAttribute("aria-label", "");
    indicator.appendChild(sliderBadge);
    const sliderText = document.createElement("p");
    sliderText.className = "ytp-speedslider-text";
    sliderText.textContent = "1.00x";
    indicator.appendChild(sliderText);
    sliderSection.appendChild(indicator);
    const slider = document.createElement("input");
    slider.className = "ytp-input-slider ytp-speedslider ytp-varispeed-input-slider";
    slider.setAttribute("role", "slider");
    slider.setAttribute("tabindex", "0");
    slider.type = "range";
    slider.min = "0.25";
    slider.max = "3";
    slider.step = "0.05";
    slider.value = "1";
    slider.setAttribute("aria-valuenow", "1");
    slider.setAttribute("aria-valuemin", "0.25");
    slider.setAttribute("aria-valuemax", "3");
    slider.setAttribute("aria-valuetext", "1.00");
    slider.style.setProperty("--yt-slider-shape-gradient-percent", "42.857142857142854%");
    sliderSection.appendChild(slider);
    sliderContainer.appendChild(sliderSection);
    const btnInc = document.createElement("button");
    btnInc.className = "ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button";
    btnInc.setAttribute("aria-label", LANG.increaseSpeed);
    const incSpan = document.createElement("span");
    incSpan.textContent = "+";
    btnInc.appendChild(incSpan);
    sliderContainer.appendChild(btnInc);
    content.appendChild(sliderContainer);
    const chips = document.createElement("div");
    chips.className = "ytp-variable-speed-panel-chips";
    function makeChip(_value, labelText, priority, hidden) {
      const wrapper = document.createElement("div");
      wrapper.className = "ytp-variable-speed-panel-preset-button-wrapper";
      wrapper.setAttribute("data-priority", String(priority));
      wrapper.setAttribute("aria-hidden", hidden ? "true" : "false");
      if (hidden) wrapper.style.display = "none";
      const btn = document.createElement("button");
      btn.className = "ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button";
      const span = document.createElement("span");
      span.textContent = labelText;
      btn.appendChild(span);
      wrapper.appendChild(btn);
      if (labelText === "3.0") {
        const upsell = document.createElement("div");
        upsell.className = "ytp-variable-speed-panel-premium-upsell-icon";
        btn.insertBefore(upsell, span);
      }
      if (labelText === "1") {
        const lbl = document.createElement("div");
        lbl.className = "ytp-variable-speed-panel-preset-button-label-text";
        lbl.textContent = LANG.standard;
        wrapper.appendChild(lbl);
      }
      chips.appendChild(wrapper);
      return { wrapper, btn, span };
    }
    const chipDefs = [
      { value: "1", label: "1", priority: 5, hidden: false },
      { value: "1,25", label: "1,25", priority: 2, hidden: false },
      { value: "1,5", label: "1,5", priority: 3, hidden: false },
      { value: "1,75", label: "1,75", priority: 0, hidden: true },
      { value: "2", label: "2", priority: 4, hidden: false },
      { value: "3.0", label: "3.0", priority: 1, hidden: false }
    ];
    const chipElements = chipDefs.map(function(d) {
      return makeChip(d.value, d.label, d.priority, d.hidden);
    });
    content.appendChild(chips);
    panel.appendChild(content);
    let cid = currentChannelId;
    if (!cid) cid = getChannelId();
    const stored = getSpeeds();
    let curSpeed = cid && stored[cid] ? stored[cid] : 1;
    if (!LANG.isGerman) {
      chipElements.forEach(function(ce) {
        ce.span.textContent = ce.span.textContent.replace(",", ".");
      });
    } else {
      chipElements.forEach(function(ce) {
        ce.span.textContent = ce.span.textContent.replace(".", ",");
      });
    }
    backBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      closeSpeedPanel(settingsMenu);
    });
    function getSliderPercent(v) {
      const clamped = clampSpeed(v);
      return (Math.max(0, Math.min(1, (clamped - 0.25) / (3 - 0.25))) * 100).toFixed(6) + "%";
    }
    function refreshUI(v) {
      curSpeed = v;
      const strVal = v.toFixed(2) + "x";
      displayText.textContent = strVal;
      sliderText.textContent = strVal;
      const clampedSlider = clampSpeed(v);
      slider.value = String(clampedSlider);
      slider.setAttribute("aria-valuenow", String(v));
      slider.setAttribute("aria-valuetext", v.toFixed(2));
      slider.style.setProperty("--yt-slider-shape-gradient-percent", getSliderPercent(v));
      chipElements.forEach(function(ce) {
        const btnVal = parseFloat(ce.span.textContent.replace(",", "."));
        if (Math.abs(btnVal - v) < 1e-3) {
          ce.btn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
        } else {
          ce.btn.style.backgroundColor = "transparent";
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
    slider.addEventListener("input", function(e) {
      commit(parseFloat(e.target.value));
    });
    btnDec.addEventListener("click", function(e) {
      e.stopPropagation();
      commit(Math.max(0.25, roundSpeed(curSpeed - 0.05)));
    });
    btnInc.addEventListener("click", function(e) {
      e.stopPropagation();
      commit(Math.min(3, roundSpeed(curSpeed + 0.05)));
    });
    chipElements.forEach(function(ce) {
      const speedVal = parseFloat(ce.span.textContent.replace(",", "."));
      ce.btn.addEventListener("click", function(e) {
        e.stopPropagation();
        commit(speedVal);
      });
    });
    refreshUI(curSpeed);
    return panel;
  }
  function openSpeedPanel(settingsMenu) {
    if (inCustomPanel) return;
    menuPanel = settingsMenu.querySelector(".ytp-panel");
    if (!menuPanel) return;
    origMenuWidth = settingsMenu.style.width;
    origMenuHeight = settingsMenu.style.height;
    inCustomPanel = true;
    customPanel = buildSpeedPanel(settingsMenu);
    settingsMenu.appendChild(customPanel);
    menuPanel.style.display = "none";
    settingsMenu.style.width = "330px";
    settingsMenu.style.height = "250px";
  }
  function closeSpeedPanel(settingsMenu) {
    if (!inCustomPanel) return;
    if (customPanel) {
      customPanel.remove();
      customPanel = null;
    }
    if (menuPanel) {
      menuPanel.style.display = "";
      menuPanel = null;
    }
    settingsMenu.style.width = origMenuWidth;
    settingsMenu.style.height = origMenuHeight;
    inCustomPanel = false;
  }
  function updateMenuItemText(speed) {
    const el = document.querySelector("#yts-chan-speed .ytp-menuitem-content");
    if (el) el.textContent = speed === 1 ? LANG.standard : speed.toFixed(2) + "x";
  }
  const SPEED_TERMS = ["speed", "geschwindigkeit", "velocidad", "vitesse", "速度", "속도", "velocita", "hizi", "snelheid", "kecepatan", "toc do", "ความเร็ว", "predkosc", "скорость", "سرعة", "velocidade", "hastighet", "rychlost"];
  function insertSpeedMenuItem() {
    const menu = document.querySelector(".ytp-settings-menu");
    if (!menu) return false;
    const panelMenu = menu.querySelector(".ytp-panel-menu");
    if (!panelMenu) return false;
    if (document.querySelector("#yts-chan-speed")) return true;
    let ytSpeedItem = null;
    const items = panelMenu.querySelectorAll(".ytp-menuitem");
    for (let i = 0; i < items.length; i++) {
      const lbl = items[i].querySelector(".ytp-menuitem-label");
      if (lbl && matchAnyTerm(lbl.textContent, SPEED_TERMS)) {
        ytSpeedItem = items[i];
        break;
      }
    }
    if (!ytSpeedItem) return false;
    const cid = getChannelId();
    const stored = getSpeeds();
    const saved = cid ? stored[cid] : void 0;
    const label = saved && saved !== 1 ? saved.toFixed(2) + "x" : LANG.standard;
    const item = document.createElement("div");
    item.id = "yts-chan-speed";
    item.className = "ytp-menuitem";
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-haspopup", "true");
    const iconDiv = document.createElement("div");
    iconDiv.className = "ytp-menuitem-icon";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("fill", "white");
    const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path1.setAttribute("d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z");
    svg.appendChild(path1);
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path2.setAttribute("d", "M9.5 16.5v-9l7 4.5z");
    svg.appendChild(path2);
    iconDiv.appendChild(svg);
    item.appendChild(iconDiv);
    const labelDiv = document.createElement("div");
    labelDiv.className = "ytp-menuitem-label";
    labelDiv.textContent = LANG.channelSpeedLabel;
    item.appendChild(labelDiv);
    const contentDiv = document.createElement("div");
    contentDiv.className = "ytp-menuitem-content";
    contentDiv.textContent = label;
    item.appendChild(contentDiv);
    item.addEventListener("click", function(e) {
      e.stopPropagation();
      openSpeedPanel(menu);
    });
    ytSpeedItem.insertAdjacentElement("afterend", item);
    return true;
  }
  function syncSpeedMenuDisplay() {
    insertSpeedMenuItem();
    const s = getSpeeds()[getChannelId()];
    if (s) updateMenuItemText(s);
  }
  function watchSettingsMenu(signal, retryCount) {
    if (retryCount === void 0) retryCount = 3;
    const menu = document.querySelector(".ytp-settings-menu");
    const btn = document.querySelector(".ytp-settings-button");
    if (!menu || !btn) {
      if (retryCount > 0) {
        setTimeout(function() {
          watchSettingsMenu(signal, retryCount - 1);
        }, 500);
      }
      return;
    }
    const obs = new MutationObserver(function() {
      if (menu.style.display === "none") {
        if (inCustomPanel) closeSpeedPanel(menu);
      } else {
        setTimeout(syncSpeedMenuDisplay, MENU_DELAY);
      }
    });
    obs.observe(menu, { attributes: true, attributeFilter: ["style"] });
    speedObs.add(obs);
    btn.addEventListener("click", function() {
      setTimeout(function() {
        const m = document.querySelector(".ytp-settings-menu");
        if (m && m.style.display !== "none") syncSpeedMenuDisplay();
      }, MENU_DELAY);
    }, { signal });
  }
  function initSpeed() {
    if (speedRetryTimeout) clearTimeout(speedRetryTimeout);
    if (speedInitTimeout) clearTimeout(speedInitTimeout);
    function checkAndSetup(obs2) {
      try {
        const vid = document.querySelector(".html5-main-video");
        const chan = document.querySelector("#upload-info #channel-name #text a") || document.querySelector("ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a") || document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
        if (!vid || !chan) return;
        obs2.disconnect();
        speedObs.delete(obs2);
        const cid = new URL(chan.href).pathname.split("/").pop();
        const stored = getSpeeds();
        const saved = stored[cid];
        currentChannelId = cid;
        if (speedAbort) speedAbort.abort();
        speedAbort = new AbortController();
        vid.addEventListener("ratechange", function() {
          var currentSaved = getSpeeds()[currentChannelId];
          if (!currentSaved) return;
          var realRate = browserOrigDesc ? browserOrigDesc.get.call(vid) : vid.playbackRate;
          if (activeChannelSpeed !== null && Math.abs(realRate - currentSaved) > 0.01) {
            if (browserOrigDesc) {
              browserOrigDesc.set.call(vid, currentSaved);
            } else {
              vid.playbackRate = currentSaved;
            }
          }
        }, { signal: speedAbort.signal });
        if (saved) {
          applySpeed(saved);
          speedRetryTimeout = setTimeout(function() {
            applySpeed(saved);
          }, SPEED_RETRY);
        }
        watchSettingsMenu(speedAbort.signal);
      } catch (e) {
        log$1.debug("initSpeed error:", e);
      }
    }
    const obs = observeMutations(function(_, obs2) {
      checkAndSetup(obs2);
    }, document.documentElement);
    speedObs.add(obs);
    checkAndSetup(obs);
    speedInitTimeout = setTimeout(function() {
      obs.disconnect();
      speedObs.delete(obs);
      log$1.debug("initSpeed: Timeout reached, no channel found");
    }, INIT_TIMEOUT);
  }
  function cleanupSpeed() {
    activeChannelSpeed = null;
    try {
      window.__GS_ENABLED__ = true;
    } catch (_) {
    }
    speedObs.forEach(function(o) {
      try {
        o.disconnect();
      } catch (_) {
      }
    });
    speedObs.clear();
    if (speedAbort) {
      speedAbort.abort();
      speedAbort = null;
    }
    if (speedRetryTimeout) {
      clearTimeout(speedRetryTimeout);
      speedRetryTimeout = null;
    }
    if (speedInitTimeout) {
      clearTimeout(speedInitTimeout);
      speedInitTimeout = null;
    }
    if (customPanel) {
      customPanel.remove();
      customPanel = null;
    }
    if (menuPanel) {
      menuPanel.style.display = "";
      menuPanel = null;
    }
    currentChannelId = null;
    inCustomPanel = false;
  }
  const log = createLogger("YouTube Enhanced");
  const PS_PLAYING = 1;
  const PS_BUFFERING = 3;
  const STOP_PATHS = ["/channel", "/watch", "/shorts", "/@", "/playlist", "/live"];
  let stopObs = null;
  let handledVids = new WeakSet();
  function resetStopTrackers() {
    handledVids = new WeakSet();
  }
  function stopVideoPlayback(youtubePlayer, videoElement) {
    if (!youtubePlayer || !videoElement || handledVids.has(videoElement)) return;
    handledVids.add(videoElement);
    try {
      const playerState = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : void 0;
      if (playerState === PS_PLAYING || playerState === PS_BUFFERING) {
        youtubePlayer.pauseVideo();
      }
    } catch (error) {
      log.warn("Error pausing video:", error);
    }
    let hasIntercepted = false;
    const handleAutoPlay = function() {
      if (hasIntercepted) return;
      try {
        const state = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : void 0;
        if (state === PS_PLAYING || state === PS_BUFFERING) {
          hasIntercepted = true;
          youtubePlayer.pauseVideo();
          videoElement.removeEventListener("play", handleAutoPlay, { capture: true });
          videoElement.removeEventListener("playing", handleAutoPlay, { capture: true });
        }
      } catch (error) {
        log.warn("Error in event handler:", error);
      }
    };
    videoElement.addEventListener("play", handleAutoPlay, { capture: true });
    videoElement.addEventListener("playing", handleAutoPlay, { capture: true });
    setTimeout(function() {
      if (!hasIntercepted) {
        videoElement.removeEventListener("play", handleAutoPlay, { capture: true });
        videoElement.removeEventListener("playing", handleAutoPlay, { capture: true });
      }
    }, 2e3);
  }
  function checkForPlayer() {
    const playerElement = document.querySelector("ytd-player");
    const videoElement = document.querySelector(".html5-main-video");
    const youtubePlayer = playerElement ? playerElement.player_ : void 0;
    if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
      stopVideoPlayback(youtubePlayer, videoElement);
      initAutoHD(youtubePlayer, videoElement);
      cleanupAutoStop();
      return true;
    }
    return false;
  }
  function initAutoStop() {
    if (!STOP_PATHS.some(function(p) {
      return location.pathname.startsWith(p);
    })) {
      cleanupAutoStop();
      return;
    }
    if (checkForPlayer()) return;
    if (stopObs) stopObs.disconnect();
    stopObs = observeMutations(function(_, obs) {
      if (checkForPlayer()) obs.disconnect();
    }, document.documentElement);
    setTimeout(checkForPlayer, 100);
  }
  function cleanupAutoStop() {
    if (stopObs) {
      stopObs.disconnect();
      stopObs = null;
    }
  }
  createLogger("YouTube Enhanced", false);
  patchQuality();
  async function boot() {
    await loadSpeedData();
    if (location.pathname.startsWith("/watch") || location.pathname.startsWith("/shorts")) {
      initSpeed();
    }
    initAutoStop();
  }
  window.addEventListener("yt-navigate-finish", async () => {
    resetHDTrackers();
    resetStopTrackers();
    await loadSpeedData();
    patchQuality();
    cleanupSpeed();
    if (location.pathname.startsWith("/watch") || location.pathname.startsWith("/shorts")) {
      initSpeed();
    }
    cleanupAutoStop();
    initAutoStop();
  });
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
    });
  } else {
    boot();
  }

})();
// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.0.2
// @author       marmoris-x
// @description  Auto max video quality, per-channel playback speed control, auto-stop & anti-translate (titles, descriptions, audio, subtitles, notifications, channel branding, thumbnails).
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/YouTube%20Enhanced.user.js
// @match        *://*.youtube.com/*
// @match        *://*.youtube-nocookie.com/*
// @sandbox      raw
// @grant        GM.getValue
// @grant        GM.registerMenuCommand
// @grant        GM.setValue
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
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
  const AT_DEFAULTS = {
    disabled: false,
    untranslateTitle: true,
    untranslateAudio: true,
    untranslateAudioOnlyAI: false,
    untranslateDescription: true,
    untranslateChapters: true,
    untranslateChannelBranding: true,
    untranslateNotification: true,
    untranslateThumbnail: true,
    subtitlesLanguage: "original",
    subtitlesEnabled: true,
    whiteListUntranslateTitle: [],
    whiteListUntranslateAudio: [],
    whiteListUntranslateDescription: [],
    whiteListUntranslateChapters: [],
    whiteListUntranslateChannelBranding: [],
    whiteListUntranslateThumbnail: []
  };
  const AT_STORAGE_KEY = "yt_anti_translate_settings";
  async function loadATSettings() {
    try {
      const raw = await GM.getValue(AT_STORAGE_KEY, null);
      if (!raw) return { ...AT_DEFAULTS };
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { ...AT_DEFAULTS, ...parsed };
    } catch {
      return { ...AT_DEFAULTS };
    }
  }
  async function saveATSettings(settings) {
    await GM.setValue(AT_STORAGE_KEY, JSON.stringify(settings));
  }
  let _cachedATSettings = null;
  function getATSettingsSync() {
    return _cachedATSettings || { ...AT_DEFAULTS };
  }
  function setATSettingsCache(settings) {
    _cachedATSettings = settings;
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
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      (document.documentElement || document).appendChild(iframe);
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
  function extractChannelIdFromUrl(href) {
    try {
      const url = new URL(href, location.origin);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return null;
      if (parts[0].startsWith("@")) {
        return parts[0];
      }
      if (parts[0] === "channel" && parts.length >= 2) {
        return parts[1];
      }
      if (parts[0] === "c" && parts.length >= 2) {
        return parts[1];
      }
      if (parts[0] === "user" && parts.length >= 2) {
        return parts[1];
      }
      return parts[parts.length - 1];
    } catch (_) {
      return null;
    }
  }
  function getChannelId() {
    var _a, _b;
    try {
      const watchChannelLink = document.querySelector(
        "#upload-info #channel-name #text a, #owner #channel-name a, ytd-video-owner-renderer #channel-name a"
      );
      if (watchChannelLink) {
        const id = extractChannelIdFromUrl(watchChannelLink.href);
        if (id) return id;
      }
      const shortsChannelBar = document.querySelector(
        "yt-reel-channel-bar-view-model a.ytAttributedStringLink[href*='/@'], yt-reel-channel-bar-view-model a.ytAttributedStringLink[href*='/channel/']"
      );
      if (shortsChannelBar) {
        const id = extractChannelIdFromUrl(shortsChannelBar.href);
        if (id) return id;
      }
      const shortsChannelLegacy = document.querySelector(
        "ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a"
      );
      if (shortsChannelLegacy) {
        const id = extractChannelIdFromUrl(shortsChannelLegacy.href);
        if (id) return id;
      }
      const shortsAvatar = document.querySelector(
        "yt-reel-channel-bar-view-model .ytSpecAvatarShapeHost[aria-label]"
      );
      if (shortsAvatar) {
        const match = (_a = shortsAvatar.getAttribute("aria-label")) == null ? void 0 : _a.match(/@(\w+)/);
        if (match) return "@" + match[1];
      }
      const anyChannelLink = document.querySelector(
        'a[href*="/@"]:not([href*="/shorts?"]):not([href*="/videos?"]), a[href*="/channel/"]'
      );
      if (anyChannelLink) {
        const id = extractChannelIdFromUrl(anyChannelLink.href);
        if (id) return id;
      }
      try {
        const playerResp = window.ytInitialPlayerResponse;
        if ((_b = playerResp == null ? void 0 : playerResp.videoDetails) == null ? void 0 : _b.channelId) {
          return playerResp.videoDetails.channelId;
        }
      } catch (_) {
      }
      return null;
    } catch (_) {
      return null;
    }
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
        const cid = extractChannelIdFromUrl(chan.href);
        const stored = getSpeeds();
        const saved = stored[cid];
        currentChannelId = cid;
        if (speedAbort) speedAbort.abort();
        speedAbort = new AbortController();
        vid.addEventListener("ratechange", function() {
          const currentSaved = getSpeeds()[currentChannelId];
          if (!currentSaved) return;
          const realRate = browserOrigDesc ? browserOrigDesc.get.call(vid) : vid.playbackRate;
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
  const pendingRequests = new Map();
  let cachedPlayer = null;
  let cachedPlayerSelector = null;
  let cachedPathname = null;
  class SessionLRUCache {
    constructor({
      maxBytes = 5 * 1024 * 1024,
      ns = "[YoutubeAntiTranslate]cache:"
    } = {}) {
      this.maxBytes = maxBytes;
      this.ns = ns;
    }
    set(key, value) {
      const entryKey = this.ns + key;
      const entry = { v: value, t: Date.now() };
      sessionStorage.setItem(entryKey, JSON.stringify(entry));
      this._evictIfNeeded();
    }
    get(key) {
      const entryKey = this.ns + key;
      const raw = sessionStorage.getItem(entryKey);
      if (!raw) return void 0;
      try {
        const entry = JSON.parse(raw);
        entry.t = Date.now();
        sessionStorage.setItem(entryKey, JSON.stringify(entry));
        return entry.v;
      } catch {
        sessionStorage.removeItem(entryKey);
        return void 0;
      }
    }
    delete(key) {
      sessionStorage.removeItem(this.ns + key);
    }
    clear() {
      this._eachEntry(({ k }) => sessionStorage.removeItem(k));
    }
    bytes() {
      let total = 0;
      this._eachEntry(({ k, v }) => {
        total += (k.length + v.length) * 2;
      });
      return total;
    }
    size() {
      let n = 0;
      this._eachEntry(() => {
        n += 1;
      });
      return n;
    }
    _eachEntry(cb) {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(this.ns)) {
          cb({ k, v: sessionStorage.getItem(k) });
        }
      }
    }
    _evictIfNeeded() {
      let usage = this.bytes();
      if (usage <= this.maxBytes) return;
      const items = [];
      this._eachEntry(({ k, v }) => {
        const { t } = JSON.parse(v || "{}");
        const bytes = (k.length + v.length) * 2;
        items.push({ k, bytes, t: t ?? 0 });
      });
      items.sort((a, b) => a.t - b.t);
      for (const item of items) {
        sessionStorage.removeItem(item.k);
        usage -= item.bytes;
        if (usage <= this.maxBytes) break;
      }
    }
  }
  const lruCache = new SessionLRUCache();
  window.YoutubeAntiTranslate = {
    VIEWPORT_EXTENSION_PERCENTAGE_FRACTION: 0.5,
    VIEWPORT_OUTSIDE_LIMIT_FRACTION: 0.5,
    MAX_ATTEMPTS: 2,
    LOG_PREFIX: "[YoutubeAntiTranslate]",
    LOG_LEVELS: {
      NONE: 0,
      ERROR: 1,
      WARN: 2,
      INFO: 3,
      DEBUG: 4
    },
    currentLogLevel: 2,
    QS_PROFILE_ENABLED: false,
    QS_PROFILE_CHECK_CORRECTNESS: false,
    setLogLevel: function(levelName) {
      const newLevel = this.LOG_LEVELS[levelName.toUpperCase()];
      if (typeof newLevel === "number") {
        this.currentLogLevel = newLevel;
        this.logDebug(`Log level set to ${levelName.toUpperCase()} (${newLevel})`);
      } else {
        this.logWarning(`Invalid log level: ${levelName}`);
      }
    },
    CORE_ATTRIBUTED_STRING_SELECTOR: ":is(.yt-core-attributed-string, .ytAttributedStringHost)",
    CORE_ATTRIBUTED_STRING_LINK_SELECTOR: "a:is(.yt-core-attributed-string__link, .ytAttributedStringLink)",
    CORE_ATTRIBUTED_STRING_PRE_WRAP_SELECTOR: ":is(.yt-core-attributed-string--white-space-pre-wrap, .ytAttributedStringWhiteSpacePreWrap)",
    ALL_ARRAYS_VIDEOS_SELECTOR: `ytd-video-renderer,
ytd-rich-item-renderer,
ytd-compact-video-renderer,
ytd-grid-video-renderer,
ytd-playlist-video-renderer,
ytd-playlist-panel-video-renderer,
ytm-playlist-panel-video-renderer,
yt-lockup-view-model,
ytm-compact-video-renderer,
ytm-rich-item-renderer,
ytm-video-with-context-renderer,
ytm-video-card-renderer,
ytm-media-item,
ytm-playlist-video-renderer,
a.ytp-videowall-still,
a.ytp-ce-covering-overlay,
a.ytp-suggestion-link,
div.fullscreen-recommendation,
ytd-structured-description-video-lockup-renderer,
a.ytp-autonav-endscreen-link-container,
a.autonav-endscreen-cued-video-container,
a.ytp-modern-videowall-still,

ytm-compact-playlist-renderer,
ytm-playlist-card-renderer`,
    ALL_ARRAYS_SHORTS_SELECTOR: `div.style-scope.ytd-rich-item-renderer,
ytm-shorts-lockup-view-model`,
    logWarning: function(...args) {
      if (this.currentLogLevel >= this.LOG_LEVELS.WARN) {
        console.log(`${this.LOG_PREFIX} [WARN ]`, ...args);
      }
    },
    logInfo: function(...args) {
      if (this.currentLogLevel >= this.LOG_LEVELS.INFO) {
        console.log(`${this.LOG_PREFIX} [INFO ]`, ...args);
      }
    },
    logError: function(...args) {
      if (this.currentLogLevel >= this.LOG_LEVELS.ERROR) {
        console.error(`${this.LOG_PREFIX} [ERROR]`, ...args);
      }
    },
    logDebug: function(...args) {
      if (this.currentLogLevel >= this.LOG_LEVELS.DEBUG) {
        console.debug(`${this.LOG_PREFIX} [DEBUG]`, ...args);
      }
    },
    debounce: function(func, waitMinMs = 90, includeArgsInSignature = false, getSignature = void 0) {
      if (!func["__debounceId"]) {
        Object.defineProperty(func, "__debounceId", {
          value: Symbol(),
          writable: false,
          configurable: false
        });
      }
      const signatures = new Map();
      function schedule(callback) {
        if (document.hidden || typeof requestAnimationFrame === "undefined") {
          return setTimeout(() => {
            const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
            callback(now);
          }, 16);
        }
        return requestAnimationFrame(callback);
      }
      function tickQueue(signature, time) {
        const entry = signatures.get(signature);
        if (!entry || !entry.queued) return;
        const elapsed = time - entry.lastExecTime;
        if (elapsed >= waitMinMs) {
          func.apply(entry.queued.context, entry.queued.args);
          entry.lastExecTime = time;
          entry.queued = null;
        } else {
          schedule((t) => tickQueue(signature, t));
        }
      }
      return function(...args) {
        const context = this;
        const signature = (getSignature == null ? void 0 : getSignature(context, args)) || (includeArgsInSignature ? `${String(func["__debounceId"])}::${JSON.stringify(args)}` : String(func["__debounceId"]));
        const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
        let entry = signatures.get(signature);
        if (!entry) {
          entry = { lastExecTime: now, queued: null };
          signatures.set(signature, entry);
          schedule((time) => {
            func.apply(context, args);
            entry.lastExecTime = time;
          });
        } else {
          if (!entry.queued) {
            entry.queued = { context, args };
            schedule((time) => tickQueue(signature, time));
          } else {
            entry.queued.context = context;
            entry.queued.args = args;
          }
        }
      };
    },
    getSessionCache: function(key) {
      return lruCache.get(key);
    },
    setSessionCache: function(key, value) {
      return lruCache.set(key, value);
    },
    getPlayerSelector: function() {
      if (window.location.hostname === "m.youtube.com") return "#player-container-id";
      if (window.location.pathname.startsWith("/embed")) return "#movie_player";
      const selector = window.location.pathname.startsWith("/shorts") ? "#shorts-player" : "ytd-player .html5-video-player";
      return selector;
    },
    getCachedPlayer: function() {
      const doProfile = this.QS_PROFILE_ENABLED;
      const t0 = doProfile ? performance.now() : 0;
      const currentPathname = window.location.pathname;
      if (cachedPathname !== currentPathname) {
        cachedPlayer = null;
        cachedPlayerSelector = null;
        cachedPathname = currentPathname;
      }
      if (cachedPlayer && document.contains(cachedPlayer)) {
        if (doProfile) {
          this.__recordQueryProfile("getCachedPlayer[hit]", document, cachedPlayerSelector || "(none)", performance.now() - t0);
        }
        return cachedPlayer;
      }
      cachedPlayerSelector = this.getPlayerSelector();
      cachedPlayer = this.querySelector(cachedPlayerSelector);
      if (doProfile) {
        this.__recordQueryProfile("getCachedPlayer[miss]", document, cachedPlayerSelector, performance.now() - t0);
      }
      return cachedPlayer;
    },
    isMobile: function() {
      return window.location.hostname === "m.youtube.com";
    },
    normalizeSpaces: function(str) {
      return str.replace(/\s+/g, " ").trim();
    },
    processString: function(str, options = {}) {
      const {
        ignoreCase = true,
        normalizeSpaces = true,
        normalizeNFKC = true,
        ignoreInvisible = true,
        trim = true,
        trimLeft = false,
        trimRight = false
      } = options;
      if (!str) return str;
      if (normalizeNFKC) str = str.normalize("NFKC");
      if (ignoreInvisible) str = str.replace(/[​-‏‪-‮⁠-⁯﻿]/g, "");
      if (normalizeSpaces) str = str.replace(/\s+/g, " ");
      if (trim) str = str.trim();
      else {
        if (trimLeft) str = str.trimStart();
        if (trimRight) str = str.trimEnd();
      }
      if (ignoreCase) str = str.toLowerCase();
      return str;
    },
    isStringEqual: function(str1, str2, options = {}) {
      return this.processString(str1, options) === this.processString(str2, options);
    },
    doesStringInclude: function(container, substring, options = {}) {
      return this.processString(container, options).includes(this.processString(substring, options));
    },
    stringReplaceWithOptions: function(input, pattern, replacement, options = {}) {
      const { ignoreCase = true } = options;
      const preprocessOptions = { ...options, ignoreCase: false };
      const processedInput = this.processString(input, preprocessOptions);
      if (!processedInput || replacement === null || replacement === void 0) return processedInput;
      let regex;
      if (typeof pattern === "string") {
        const processedPattern = this.processString(pattern, preprocessOptions);
        const escapedPattern = processedPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(escapedPattern, ignoreCase ? "gi" : "g");
      } else if (pattern instanceof RegExp) {
        const flags = pattern.flags.replace(/i?/, ignoreCase ? "i" : "");
        regex = new RegExp(pattern.source, flags);
      } else {
        throw new TypeError("pattern must be a string or RegExp");
      }
      return processedInput.replace(regex, replacement);
    },
    isVisible: function(node, shouldCheckViewport = true, onlyOutsideViewport = false, useOutsideLimit = false) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        this.logError("Provided node is not a valid Element.", window.location.href);
        return false;
      }
      const element = (
node
      );
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || parseFloat(style.opacity) === 0) return false;
      let parent = element.parentElement;
      let depth = 0;
      const MAX_PARENT_DEPTH = 25;
      while (parent && depth < MAX_PARENT_DEPTH) {
        const parentStyle = getComputedStyle(parent);
        if (parentStyle.display === "none" || parentStyle.visibility === "hidden" || parentStyle.visibility === "collapse" || parseFloat(parentStyle.opacity) === 0) return false;
        parent = parent.parentElement;
        depth++;
      }
      if (shouldCheckViewport) {
        const rect = element.getBoundingClientRect();
        const extendedHeight = window.innerHeight * this.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION;
        const extendedWidth = window.innerWidth * this.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION;
        const topBoundary = -extendedHeight;
        const bottomBoundary = window.innerHeight + extendedHeight;
        const leftBoundary = -extendedWidth;
        const rightBoundary = window.innerWidth + extendedWidth;
        if (onlyOutsideViewport) {
          const fullyOutside = rect.top > bottomBoundary || rect.bottom < topBoundary || rect.left > rightBoundary || rect.right < leftBoundary;
          if (!useOutsideLimit) return fullyOutside;
          const extraHeight = Math.max(window.innerHeight * this.VIEWPORT_OUTSIDE_LIMIT_FRACTION, 500);
          const extraWidth = Math.max(window.innerWidth * this.VIEWPORT_OUTSIDE_LIMIT_FRACTION, 500);
          const outerTopBoundary = topBoundary - extraHeight;
          const outerBottomBoundary = bottomBoundary + extraHeight;
          const outerLeftBoundary = leftBoundary - extraWidth;
          const outerRightBoundary = rightBoundary + extraWidth;
          const intersectsOuterLimitViewport = rect.top <= outerBottomBoundary && rect.bottom >= outerTopBoundary && rect.left <= outerRightBoundary && rect.right >= outerLeftBoundary;
          return fullyOutside && intersectsOuterLimitViewport;
        } else {
          return rect.top <= bottomBoundary && rect.bottom >= topBoundary && rect.left <= rightBoundary && rect.right >= leftBoundary;
        }
      }
      return true;
    },
    getFirstVisible: function(nodes, shouldBeInsideViewport = true) {
      if (!nodes && (!(nodes instanceof Element) || !(nodes instanceof NodeList))) return null;
      let nodeArray;
      if (nodes instanceof Element) nodeArray = [nodes];
      else nodeArray = Array.from(nodes);
      for (const node of nodeArray) {
        if (this.isVisible(node, shouldBeInsideViewport, false, false)) return node;
      }
      return null;
    },
    getAllVisibleNodes: function(nodes, shouldBeInsideViewport = true, lengthLimit = Number.MAX_VALUE) {
      if (!nodes && (!(nodes instanceof Element) || !(nodes instanceof NodeList))) return null;
      let nodeArray;
      if (nodes instanceof Element) nodeArray = [nodes];
      else nodeArray = Array.from(nodes);
      let visibleNodes = null;
      for (const node of nodeArray) {
        if (this.isVisible(node, shouldBeInsideViewport, false, false)) {
          if (visibleNodes) visibleNodes.push(node);
          else visibleNodes = [node];
          if (visibleNodes.length === lengthLimit) break;
        }
      }
      return visibleNodes;
    },
    getAllVisibleNodesOutsideViewport: function(nodes, useOutsideLimit = false) {
      if (!nodes && (!(nodes instanceof Element) || !(nodes instanceof NodeList))) return null;
      let nodeArray;
      if (nodes instanceof Node) nodeArray = [nodes];
      else nodeArray = Array.from(nodes);
      let visibleNodes = null;
      for (const node of nodeArray) {
        if (this.isVisible(node, true, true, useOutsideLimit)) {
          if (visibleNodes) visibleNodes.push(node);
          else visibleNodes = [node];
        }
      }
      return visibleNodes;
    },
    createLinkElement: function(url) {
      const link = document.createElement("a");
      link.href = url;
      link.textContent = url;
      link.rel = "nofollow";
      link.target = "_blank";
      link.dir = "auto";
      link.className = "yt-simple-endpoint style-scope yt-formatted-string";
      return link;
    },
    convertTimecodeToSeconds: function(timecode) {
      const parts = timecode.split(":").map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return 0;
    },
    stripNonEssentialParams: function(url) {
      if (!url.includes("/watch?")) return url;
      const searchParamsText = url.split("?")[1];
      const searchParams = new URLSearchParams(searchParamsText);
      const videoId = searchParams.get("v");
      return `${url.split("?")[0]}?v=${videoId}`;
    },
    isAdvertisementHref: function(href) {
      return href.includes("www.googleadservices.com");
    },
    getCurrentVideoId: function() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("v") || "";
    },
    isDarkTheme: function() {
      var _a;
      if (this.isMobile()) {
        return ((_a = this.querySelector("head > #theme-meta")) == null ? void 0 : _a.getAttribute("content")) === "rgba(15, 15, 15, 0.7)";
      }
      return document.documentElement.hasAttribute("dark");
    },
    createTimecodeLink: function(timecode) {
      const seconds = this.convertTimecodeToSeconds(timecode);
      const span = document.createElement("span");
      span.className = "yt-core-attributed-string--link-inherit-color ytAttributedStringLinkInheritColor";
      span.dir = "auto";
      span.style.color = this.isDarkTheme() ? "rgb(62, 166, 255)" : "rgb(6, 95, 212)";
      const link = document.createElement("a");
      link.className = "yt-core-attributed-string__link yt-core-attributed-string__link--call-to-action-color ytAttributedStringLink ytAttributedStringLinkCallToActionColor yt-timecode-link";
      link.tabIndex = 0;
      link.href = `/watch?v=${this.getCurrentVideoId()}&t=${seconds}s`;
      link.target = "";
      link.setAttribute("force-new-state", "true");
      link.setAttribute("data-seconds", seconds.toString());
      link.textContent = timecode;
      span.appendChild(link);
      return span;
    },
    createTagLink: function(type, value) {
      const span = document.createElement("span");
      span.className = "yt-core-attributed-string--link-inherit-color ytAttributedStringLinkInheritColor";
      span.dir = "auto";
      span.style.color = this.isDarkTheme() ? "rgb(62, 166, 255)" : "rgb(6, 95, 212)";
      const link = document.createElement("a");
      link.className = "yt-core-attributed-string__link yt-core-attributed-string__link--call-to-action-color ytAttributedStringLink ytAttributedStringLinkCallToActionColor";
      link.tabIndex = 0;
      if (type === "hashtag") {
        link.href = `/hashtag/${encodeURIComponent(value)}`;
        link.textContent = `#${value}`;
      } else if (type === "mention") {
        link.href = `/@${value}`;
        link.textContent = `@${value}`;
      }
      link.target = "";
      link.setAttribute("force-new-state", "true");
      span.appendChild(link);
      return span;
    },
    convertUrlsToLinks: function(text) {
      const container = document.createElement("span");
      const combinedPattern = /(https?:\/\/[^\s]+)|((?:^|\s)((?:\d{1,2}:)?\d{1,2}:\d{2}))(?=\s|$)|((?:^|\s)#([A-Za-z0-9_\--ʯͰ-῿⺀-⿟぀-﷿]{1,50}))|((?:^|\s)@([\w-]{3,100}))/g;
      let lastIndex = 0;
      let match;
      while ((match = combinedPattern.exec(text)) !== null) {
        const urlMatch = match[1];
        const timecodeFullMatch = match[2];
        const timecodeValue = match[3];
        const hashtagFullMatch = match[4];
        const hashtag = match[5];
        const mentionFullMatch = match[6];
        const mention = match[7];
        if (match.index > lastIndex) container.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        if (urlMatch) {
          container.appendChild(this.createLinkElement(urlMatch));
          lastIndex = combinedPattern.lastIndex;
        } else if (timecodeValue) {
          if (timecodeFullMatch.startsWith(" ")) container.appendChild(document.createTextNode(" "));
          container.appendChild(this.createTimecodeLink(timecodeValue));
          lastIndex = match.index + timecodeFullMatch.length;
          combinedPattern.lastIndex = lastIndex;
        } else if (hashtag) {
          if (hashtagFullMatch.startsWith(" ")) container.appendChild(document.createTextNode(" "));
          container.appendChild(this.createTagLink("hashtag", hashtag));
          lastIndex = match.index + hashtagFullMatch.length;
          combinedPattern.lastIndex = lastIndex;
        } else if (mention) {
          if (mentionFullMatch.startsWith(" ")) container.appendChild(document.createTextNode(" "));
          container.appendChild(this.createTagLink("mention", mention));
          lastIndex = match.index + mentionFullMatch.length;
          combinedPattern.lastIndex = lastIndex;
        }
      }
      if (lastIndex < text.length) container.appendChild(document.createTextNode(text.substring(lastIndex)));
      return container;
    },
    createFormattedContent: function(text) {
      const contentElement = document.createElement("span");
      contentElement.className = "yt-core-attributed-string yt-core-attributed-string--white-space-pre-wrap ytAttributedStringHost ytAttributedStringWhiteSpacePreWrap";
      contentElement.dir = "auto";
      const textLines = text.split("\n");
      textLines.forEach((line, index) => {
        const lineElement = this.convertUrlsToLinks(line);
        contentElement.appendChild(lineElement);
        if (index < textLines.length - 1) contentElement.appendChild(document.createElement("br"));
      });
      return contentElement;
    },
    replaceTextOnly: function(element, replaceText) {
      for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = replaceText;
          break;
        }
      }
    },
    getFirstTextNode: function(element) {
      for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) return node;
      }
      return null;
    },
    replaceContainerContent: function(container, newContent) {
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(newContent);
    },
    getArraysVideos: function(root = document) {
      const context = root || document;
      const doProfile = this.QS_PROFILE_ENABLED;
      const t0 = doProfile ? performance.now() : 0;
      const tagSelectors = [
        "ytd-video-renderer",
        "ytd-rich-item-renderer",
        "ytd-compact-video-renderer",
        "ytd-grid-video-renderer",
        "ytd-playlist-video-renderer",
        "ytd-playlist-panel-video-renderer",
        "ytm-playlist-panel-video-renderer",
        "yt-lockup-view-model",
        "ytm-compact-video-renderer",
        "ytm-rich-item-renderer",
        "ytm-video-with-context-renderer",
        "ytm-video-card-renderer",
        "ytm-media-item",
        "ytm-playlist-video-renderer",
        "ytd-structured-description-video-lockup-renderer",
        "ytm-compact-playlist-renderer",
        "ytm-playlist-card-renderer"
      ];
      const classQualifiedSelector = [
        "a.ytp-videowall-still",
        "a.ytp-ce-covering-overlay",
        "a.ytp-suggestion-link",
        "div.fullscreen-recommendation",
        "a.ytp-autonav-endscreen-link-container",
        "a.autonav-endscreen-cued-video-container",
        "a.ytp-modern-videowall-still"
      ].join(",");
      const resultSet = new Set();
      for (const tag of tagSelectors) {
        const list = context.getElementsByTagName(tag);
        for (let i = 0; i < list.length; i++) resultSet.add(list[i]);
      }
      if (classQualifiedSelector) {
        const extra = context.querySelectorAll(classQualifiedSelector);
        for (let i = 0; i < extra.length; i++) resultSet.add(extra[i]);
      }
      const optimized = Array.from(resultSet);
      if (doProfile) {
        const t1 = performance.now();
        this.__recordQueryProfile("getArraysVideos", context, this.ALL_ARRAYS_VIDEOS_SELECTOR, t1 - t0);
        if (this.QS_PROFILE_CHECK_CORRECTNESS) {
          const baseline = this.querySelectorAll(this.ALL_ARRAYS_VIDEOS_SELECTOR, context);
          if (baseline.length !== optimized.length) this.logError(`getArraysVideos count differs: optimized=${optimized.length}, baseline=${baseline.length}`);
        }
      }
      return optimized;
    },
    SUPPORTED_BCP47_CODES: new Set([
      "af-ZA",
      "az-AZ",
      "id-ID",
      "ms-MY",
      "bs-BA",
      "ca-ES",
      "cs-CZ",
      "da-DK",
      "de-DE",
      "et-EE",
      "en-IN",
      "en-GB",
      "en-US",
      "es-ES",
      "es-419",
      "es-US",
      "eu-ES",
      "fil-PH",
      "fr-FR",
      "fr-CA",
      "gl-ES",
      "hr-HR",
      "zu-ZA",
      "is-IS",
      "it-IT",
      "sw-TZ",
      "lv-LV",
      "lt-LT",
      "hu-HU",
      "nl-NL",
      "nb-NO",
      "uz-UZ",
      "pl-PL",
      "pt-PT",
      "pt-BR",
      "ro-RO",
      "sq-AL",
      "sk-SK",
      "sl-SI",
      "sr-RS",
      "fi-FI",
      "sv-SE",
      "vi-VN",
      "tr-TR",
      "be-BY",
      "bg-BG",
      "ky-KG",
      "kk-KZ",
      "mk-MK",
      "mn-MN",
      "ru-RU",
      "sr-BA",
      "uk-UA",
      "el-GR",
      "hy-AM",
      "he-IL",
      "ur-PK",
      "ar-SA",
      "fa-IR",
      "ne-NP",
      "mr-IN",
      "hi-IN",
      "as-IN",
      "bn-BD",
      "pa-IN",
      "gu-IN",
      "or-IN",
      "ta-IN",
      "te-IN",
      "kn-IN",
      "ml-IN",
      "si-LK",
      "th-TH",
      "lo-LA",
      "my-MM",
      "ka-GE",
      "am-ET",
      "km-KH",
      "zh-CN",
      "zh-TW",
      "zh-HK",
      "ja-JP",
      "ko-KR"
    ]),
    COMMON_BCP47_FALLBACKS: {
      af: "af-ZA",
      am: "am-ET",
      ar: "ar-SA",
      as: "as-IN",
      az: "az-AZ",
      be: "be-BY",
      bg: "bg-BG",
      bn: "bn-BD",
      bs: "bs-BA",
      ca: "ca-ES",
      cs: "cs-CZ",
      da: "da-DK",
      de: "de-DE",
      el: "el-GR",
      en: "en-US",
      es: "es-419",
      et: "et-EE",
      eu: "eu-ES",
      fa: "fa-IR",
      fi: "fi-FI",
      fil: "fil-PH",
      fr: "fr-FR",
      gl: "gl-ES",
      gu: "gu-IN",
      he: "he-IL",
      hi: "hi-IN",
      hr: "hr-HR",
      hu: "hu-HU",
      hy: "hy-AM",
      id: "id-ID",
      is: "is-IS",
      it: "it-IT",
      ja: "ja-JP",
      ka: "ka-GE",
      km: "km-KH",
      kn: "kn-IN",
      ko: "ko-KR",
      lo: "lo-LA",
      lt: "lt-LT",
      lv: "lv-LV",
      mk: "mk-MK",
      ml: "ml-IN",
      mn: "mn-MN",
      mr: "mr-IN",
      ms: "ms-MY",
      ne: "ne-NP",
      nl: "nl-NL",
      nb: "nb-NO",
      or: "or-IN",
      pa: "pa-IN",
      pl: "pl-PL",
      pt: "pt-BR",
      ro: "ro-RO",
      ru: "ru-RU",
      si: "si-LK",
      sk: "sk-SK",
      sl: "sl-SI",
      sq: "sq-AL",
      sr: "sr-RS",
      sv: "sv-SE",
      sw: "sw-TZ",
      ta: "ta-IN",
      te: "te-IN",
      th: "th-TH",
      tr: "tr-TR",
      uk: "uk-UA",
      ur: "ur-PK",
      uz: "uz-UZ",
      vi: "vi-VN",
      zh: "zh-CN",
      zu: "zu-ZA"
    },
detectSupportedLanguage: async function() {
      return null;
    },
    getSettings: async function() {
      return window.__YAT_getSettings ? window.__YAT_getSettings() : {};
    },
    cachedRequest: async function cachedRequest(url, postData = null, headersData = { "content-type": "application/json" }, doNotCache = false, cacheDotNotationProperty = null) {
      const cacheKey = url + "|" + postData + "|" + cacheDotNotationProperty;
      const storedResponse = this.getSessionCache(cacheKey);
      if (storedResponse) {
        if (cacheDotNotationProperty) {
          return { response: new Response(JSON.stringify({ data: null, cachedWithDotNotation: storedResponse }), { status: storedResponse.status || 200, headers: { "Content-Type": "application/json" } }), data: null, cachedWithDotNotation: storedResponse };
        } else {
          return { response: new Response(JSON.stringify({ data: storedResponse, cachedWithDotNotation: null }), { status: storedResponse.status || 200, headers: { "Content-Type": "application/json" } }), data: storedResponse, cachedWithDotNotation: null };
        }
      }
      if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);
      const requestPromise = (async () => {
        try {
          const response = await fetch(url, { method: postData ? "POST" : "GET", headers: headersData, body: postData ? postData : void 0 });
          if (!response.ok) {
            if (response.status === 404) {
              if (!doNotCache) this.setSessionCache(cacheKey, null);
              return null;
            } else if (response.status === 401) {
              if (!doNotCache) {
                if (url.includes("oembed?url=")) this.setSessionCache(cacheKey, { title: void 0, status: 401 });
                else this.setSessionCache(cacheKey, null);
              }
              return { response, data: null };
            }
            throw new Error(`HTTP error! status: ${response.status}, while fetching: ${url}`);
          }
          const data = await response.json();
          if (!doNotCache) {
            if (cacheDotNotationProperty) this.setSessionCache(cacheKey, this.getPropertyByDotNotation(data, cacheDotNotationProperty) || null);
            else this.setSessionCache(cacheKey, data);
          }
          return { response, data };
        } catch (error) {
          this.logWarning("Error fetching:", error);
          if (!doNotCache) this.setSessionCache(cacheKey, null);
          return null;
        } finally {
          pendingRequests.delete(cacheKey);
        }
      })();
      pendingRequests.set(cacheKey, requestPromise);
      return requestPromise;
    },
    jsonHierarchy: function(value, dotNotationProperty) {
      if (!dotNotationProperty.includes(".")) return { [dotNotationProperty]: value };
      const keys = dotNotationProperty.split(".");
      const result = {};
      let current = result;
      keys.forEach((key, index) => {
        if (index === keys.length - 1) current[key] = value;
        else {
          current[key] = {};
          current = current[key];
        }
      });
      return result;
    },
    getPropertyByDotNotation: function(json, dotNotationProperty) {
      if (!dotNotationProperty) return null;
      if (typeof json !== "object" || json === null) return null;
      const keys = dotNotationProperty.split(".");
      let current = json;
      for (const key of keys) {
        if (current && Object.prototype.hasOwnProperty.call(current, key)) current = current[key];
        else return null;
      }
      return current;
    },
    extractVideoIdFromUrl: function(url) {
      try {
        const u = new URL(url, window.location.origin);
        if (u.pathname === "/watch") return u.searchParams.get("v");
        if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
        if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
        if (u.hostname.includes("i.ytimg.com")) {
          const parts = u.pathname.split("/");
          if (parts.length >= 3 && (parts[1] === "vi_lc" || parts[1] === "vi")) return parts[2];
        }
        return null;
      } catch {
        return null;
      }
    },
    getVideoTitleFromYoutubeI: async function(videoId) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
      const body = {
        context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250731.09.00" } },
        videoId
      };
      const headers = await this.getYoutubeIHeadersWithCredentials();
      const response = await this.cachedRequest(
        `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/player?prettyPrint=false`,
        JSON.stringify(body),
        headers,
        false,
        "videoDetails"
      );
      const title = ((_a = response == null ? void 0 : response.cachedWithDotNotation) == null ? void 0 : _a.title) || ((_c = (_b = response == null ? void 0 : response.data) == null ? void 0 : _b.videoDetails) == null ? void 0 : _c.title) || null;
      const author_name = ((_d = response == null ? void 0 : response.cachedWithDotNotation) == null ? void 0 : _d.author) || ((_f = (_e = response == null ? void 0 : response.data) == null ? void 0 : _e.videoDetails) == null ? void 0 : _f.author) || null;
      const thumbnails = ((_h = (_g = response == null ? void 0 : response.cachedWithDotNotation) == null ? void 0 : _g.thumbnail) == null ? void 0 : _h.thumbnails) || ((_k = (_j = (_i = response == null ? void 0 : response.data) == null ? void 0 : _i.videoDetails) == null ? void 0 : _j.thumbnail) == null ? void 0 : _k.thumbnails) || null;
      let thumbnail_url = ((_l = thumbnails == null ? void 0 : thumbnails[0]) == null ? void 0 : _l.url) || null;
      const maxresdefault_url = ((_m = thumbnails == null ? void 0 : thumbnails.find((thumb) => thumb.url.includes("maxresdefault"))) == null ? void 0 : _m.url) || null;
      const channelId = ((_n = response == null ? void 0 : response.cachedWithDotNotation) == null ? void 0 : _n.channelId) || ((_p = (_o = response == null ? void 0 : response.data) == null ? void 0 : _o.videoDetails) == null ? void 0 : _p.channelId) || null;
      const author_url = channelId ? `https://www.youtube.com/channel/${channelId}` : null;
      if (thumbnail_url) {
        const urlObj = new URL(thumbnail_url);
        urlObj.search = "";
        thumbnail_url = urlObj.toString();
      }
      if (title) return { response: response.response, data: { title, author_name, author_url, thumbnail_url, maxresdefault_url } };
      return { response: response == null ? void 0 : response.response, data: null };
    },
    getSAPISID: function() {
      const match = document.cookie.match(/SAPISID=([^\s;]+)/);
      return match ? match[1] : null;
    },
    getSAPISIDHASH: async function(origin = this.isMobile() ? "https://m.youtube.com" : "https://www.youtube.com") {
      const sapisid = this.getSAPISID();
      if (!sapisid) {
        this.logWarning("SAPISID cookie not found.");
        return null;
      }
      const timestamp = Math.floor(Date.now() / 1e3);
      const message = `${timestamp} ${sapisid} ${origin}`;
      async function sha1Hash(msg) {
        const encoder = new TextEncoder();
        const data = encoder.encode(msg);
        const hashBuffer = await crypto.subtle.digest("SHA-1", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      const hash = await sha1Hash(message);
      return `SAPISIDHASH ${timestamp}_${hash}`;
    },
    getYoutubeIHeadersWithCredentials: async function(anonymously = false) {
      const sapisidhash = await this.getSAPISIDHASH();
      if (!sapisidhash || anonymously) return { "Content-Type": "application/json" };
      return {
        "Content-Type": "application/json",
        Authorization: sapisidhash,
        Origin: this.isMobile() ? "https://m.youtube.com" : "https://www.youtube.com",
        "X-Youtube-Client-Name": "1",
        "X-Youtube-Client-Version": "2.20250731.09.00"
      };
    },
    getOriginalCollaboratorsItemsWithYoutubeI: async function(search_query) {
      if (!search_query || search_query.trim() === "") return null;
      let decodedQuery;
      try {
        decodedQuery = decodeURIComponent(search_query);
      } catch {
        decodedQuery = search_query;
      }
      const body = {
        context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250527.00.00", hl: "lo" } },
        query: `${decodedQuery} ${decodedQuery}`
      };
      const requestIdentifier = `youtubei/v1/results_${JSON.stringify(body)}`;
      const storedResponse = this.getSessionCache(requestIdentifier);
      if (storedResponse && Array.isArray(storedResponse) && storedResponse.length > 0) return storedResponse;
      const search = `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/search?prettyPrint=false`;
      const response = await this.cachedRequest(search, JSON.stringify(body), await this.getYoutubeIHeadersWithCredentials(true), true);
      if (!(response == null ? void 0 : response.data)) {
        this.logWarning(`Failed to fetch ${search} or parse response`);
        return;
      }
      const result = this.extractCollaboratorsItemsFromSearch(response.data);
      if (!result) return;
      await this.setSessionCache(requestIdentifier, result);
      return result;
    },
    extractCollaboratorsItemsFromSearch: function(json) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J;
      const results = [];
      const sections = ((_d = (_c = (_b = (_a = json == null ? void 0 : json.contents) == null ? void 0 : _a.twoColumnSearchResultsRenderer) == null ? void 0 : _b.primaryContents) == null ? void 0 : _c.sectionListRenderer) == null ? void 0 : _d.contents) || ((_f = (_e = json == null ? void 0 : json.contents) == null ? void 0 : _e.sectionListRenderer) == null ? void 0 : _f.contents) || [];
      for (const section of sections) {
        const items = ((_g = section == null ? void 0 : section.itemSectionRenderer) == null ? void 0 : _g.contents) || [];
        for (const item of items) {
          const video = (item == null ? void 0 : item.videoRenderer) || (item == null ? void 0 : item.videoWithContextRenderer);
          if (!video) continue;
          const byline = video.shortBylineText || video.longBylineText;
          const runs = (byline == null ? void 0 : byline.runs) || [];
          for (const run of runs) {
            const showDialog = ((_h = run == null ? void 0 : run.navigationEndpoint) == null ? void 0 : _h.showDialogCommand) || ((_i = run == null ? void 0 : run.navigationEndpoint) == null ? void 0 : _i.showSheetCommand);
            if (!showDialog) continue;
            const listItems = ((_n = (_m = (_l = (_k = (_j = showDialog == null ? void 0 : showDialog.panelLoadingStrategy) == null ? void 0 : _j.inlineContent) == null ? void 0 : _k.dialogViewModel) == null ? void 0 : _l.customContent) == null ? void 0 : _m.listViewModel) == null ? void 0 : _n.listItems) || ((_s = (_r = (_q = (_p = (_o = showDialog == null ? void 0 : showDialog.panelLoadingStrategy) == null ? void 0 : _o.inlineContent) == null ? void 0 : _p.sheetViewModel) == null ? void 0 : _q.content) == null ? void 0 : _r.listViewModel) == null ? void 0 : _s.listItems);
            if (Array.isArray(listItems)) {
              for (const listItem of listItems) {
                const view = (listItem == null ? void 0 : listItem.listItemViewModel) || {};
                const name = ((_t = view.title) == null ? void 0 : _t.content) || null;
                const avatarImage = ((_y = (_x = (_w = (_v = (_u = view.leadingAccessory) == null ? void 0 : _u.avatarViewModel) == null ? void 0 : _v.image) == null ? void 0 : _w.sources) == null ? void 0 : _x[0]) == null ? void 0 : _y.url) || null;
                const url = ((_E = (_D = (_C = (_B = (_A = (_z = view.rendererContext) == null ? void 0 : _z.commandContext) == null ? void 0 : _A.onTap) == null ? void 0 : _B.innertubeCommand) == null ? void 0 : _C.commandMetadata) == null ? void 0 : _D.webCommandMetadata) == null ? void 0 : _E.url) || null;
                const navigationEndpointUrl = (_H = (_G = (_F = video.navigationEndpoint) == null ? void 0 : _F.commandMetadata) == null ? void 0 : _G.webCommandMetadata) == null ? void 0 : _H.url;
                const videoId = ((_J = (_I = video.navigationEndpoint) == null ? void 0 : _I.watchEndpoint) == null ? void 0 : _J.videoId) || this.extractVideoIdFromUrl(navigationEndpointUrl.startsWith("http") ? navigationEndpointUrl : window.location.origin + navigationEndpointUrl);
                results.push({ name, avatarImage, url, navigationEndpointUrl, videoId });
              }
            }
          }
        }
      }
      return results;
    },
    getLocalizedAnd: function(languageCode) {
      const andTranslations = {
        "af-ZA": "en",
        "az-AZ": "və",
        "id-ID": "dan",
        "ms-MY": "dan",
        "bs-BA": "i",
        "ca-ES": "i",
        "cs-CZ": "a",
        "da-DK": "og",
        "de-DE": "und",
        "et-EE": "ja",
        "en-IN": "and",
        "en-GB": "and",
        "en-US": "and",
        "es-ES": "y",
        "es-419": "y",
        "es-US": "y",
        "eu-ES": "eta",
        "fil-PH": "at",
        "fr-FR": "et",
        "fr-CA": "et",
        "gl-ES": "e",
        "hr-HR": "i",
        "zu-ZA": "futhi",
        "is-IS": "og",
        "it-IT": "e",
        "sw-TZ": "na",
        "lv-LV": "un",
        "lt-LT": "ir",
        "hu-HU": "és",
        "nl-NL": "en",
        "nb-NO": "og",
        "uz-UZ": "va",
        "pl-PL": "i",
        "pt-PT": "e",
        "pt-BR": "e",
        "ro-RO": "și",
        "sq-AL": "dhe",
        "sk-SK": "a",
        "sl-SI": "in",
        "sr-RS": "и",
        "fi-FI": "ja",
        "sv-SE": "och",
        "vi-VN": "và",
        "tr-TR": "ve",
        "be-BY": "і",
        "bg-BG": "и",
        "ky-KG": "жана",
        "kk-KZ": "және",
        "mk-MK": "и",
        "mn-MN": "ба",
        "ru-RU": "и",
        "sr-BA": "и",
        "uk-UA": "і",
        "el-GR": "και",
        "hy-AM": "եւ",
        "he-IL": "ו",
        "ur-PK": "اور",
        "ar-SA": "و",
        "fa-IR": "و",
        "ne-NP": "र",
        "mr-IN": "आणि",
        "hi-IN": "और",
        "as-IN": "আৰু",
        "bn-BD": "এবং",
        "pa-IN": "ਅਤੇ",
        "gu-IN": "અને",
        "or-IN": "ଏବଂ",
        "ta-IN": "மற்றும்",
        "te-IN": "మరియు",
        "kn-IN": "ಮತ್ತು",
        "ml-IN": "കൂടാതെ",
        "si-LK": "සහ",
        "th-TH": "และ",
        "lo-LA": "ແລະ",
        "my-MM": "နှင့်",
        "ka-GE": "და",
        "am-ET": "እና",
        "km-KH": "និង",
        "zh-CN": "和",
        "zh-TW": "和",
        "zh-HK": "和",
        "ja-JP": "と",
        "ko-KR": "그리고"
      };
      return andTranslations[languageCode] || "and";
    },
    getImageSize: async function(src) {
      if (!src) return { width: null, height: null };
      const img = new Image();
      img.src = src;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    },
    isFoundImageSrc: async function(src) {
      if (!src) return false;
      try {
        const response = await this.cachedRequest(src);
        return (response == null ? void 0 : response.response.ok) && (response == null ? void 0 : response.response.status) >= 200 && (response == null ? void 0 : response.response.status) < 300;
      } catch {
        return false;
      }
    },
    isWhitelistedChannel: async function(whiteStoragePropertyName, handle = null, channelUrl = null, channelId = null, channelName = null) {
      const settings = await this.getSettings();
      const whitelist = settings == null ? void 0 : settings[whiteStoragePropertyName];
      if (!whitelist) throw new Error(`Unsupported whiteListType: ${whiteStoragePropertyName}`);
      if (whitelist.length === 0) {
        this.logDebug(`isWhitelistedChannel: ${whiteStoragePropertyName} is empty`);
        return false;
      }
      const normalizeHandle = (value) => {
        let decodedValue = value;
        try {
          decodedValue = decodeURIComponent(value);
        } catch {
          decodedValue = value;
        }
        return this.processString(decodedValue, { normalizeSpaces: false });
      };
      const removeDiacritics = (value) => value.normalize("NFD").replace(new RegExp("\\p{M}", "gu"), "");
      const normalizedWhitelist = whitelist.map((item) => normalizeHandle(item));
      const normalizedWhitelistSet = new Set(normalizedWhitelist);
      const normalizedWhitelistNoMarksSet = new Set(normalizedWhitelist.map((item) => removeDiacritics(item)));
      const isWhitelistedHandle = (value) => {
        const normalized = normalizeHandle(value);
        return normalizedWhitelistSet.has(normalized) || normalizedWhitelistNoMarksSet.has(removeDiacritics(normalized));
      };
      if ((!handle || typeof handle !== "string" || handle.trim() === "") && (!channelId || typeof channelId !== "string" || channelId.trim() === "") && (!channelUrl || typeof channelUrl !== "string" || channelUrl.trim() === "") && (!channelName || typeof channelName !== "string" || channelName.trim() === "")) return false;
      let channelURL = null;
      if (channelUrl && typeof channelUrl === "string") {
        const url = channelUrl.startsWith("http") ? channelUrl : window.location.origin + channelUrl;
        try {
          channelURL = new URL(url);
        } catch {
          this.logWarning(`isWhitelistedChannel: invalid channelUrl: ${url}`);
        }
      }
      if (channelURL) {
        if (!channelId && channelURL.pathname.startsWith("/channel/")) {
          const match = channelURL.pathname.match(/\/channel\/([^/?]+)/);
          channelId = match ? match[1] : null;
        } else if (!handle && channelURL.pathname.startsWith("/@")) {
          const match = channelURL.pathname.match(/\/(@[^/?]+)/);
          handle = match ? match[1] : null;
        }
      }
      if (!handle || typeof handle !== "string" || handle.trim() === "" || !handle.trim().startsWith("@")) {
        if (handle) this.logInfo(`isWhitelistedChannel: invalid handle: ${handle}`);
        if ((!channelId || typeof channelId !== "string" || channelId.trim() === "") && (!channelName || typeof channelName !== "string" || channelName.trim() === "")) return false;
      } else {
        return isWhitelistedHandle(handle);
      }
      if (!channelId || typeof channelId !== "string" || channelId.trim() === "") {
        if (channelId) this.logInfo(`isWhitelistedChannel: invalid channelId: ${channelId}`);
        if (!channelName || typeof channelName !== "string" || channelName.trim() === "") return false;
      } else {
        const response = await this.getChannelBrandingWithYoutubeI(channelId);
        handle = (response == null ? void 0 : response.channelHandle) || null;
      }
      if (!handle) {
        this.logInfo(`isWhitelistedChannel: could not retrieve handle for channelId: ${channelId}`);
        if (!channelName || typeof channelName !== "string" || channelName.trim() === "") return false;
      } else {
        return isWhitelistedHandle(handle);
      }
      if (!channelName || typeof channelName !== "string" || channelName.trim() === "") {
        this.logInfo(`isWhitelistedChannel: invalid channelName: ${channelName}`);
        return false;
      } else {
        if (!channelName.trim().includes(" ") && (isWhitelistedHandle(`@${channelName}`) || channelName.startsWith("@") && isWhitelistedHandle(channelName))) return true;
        const lookupResult = await this.lookupChannelId(channelName);
        handle = lookupResult == null ? void 0 : lookupResult.channelHandle;
      }
      if (!handle) {
        this.logInfo(`isWhitelistedChannel: could not retrieve handle for channelName: ${channelName}`);
        return false;
      } else {
        return isWhitelistedHandle(handle);
      }
    },
    lookupChannelId: async function(query) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A;
      if (!query) return null;
      let decodedQuery;
      try {
        decodedQuery = decodeURIComponent(query);
      } catch {
        decodedQuery = query;
      }
      const body = {
        context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250527.00.00" } },
        query: `${decodedQuery} ${decodedQuery}`,
        params: "EgIQAg=="
      };
      const requestIdentifier = `youtubei/v1/search_${JSON.stringify(body)}`;
      const storedResponse = this.getSessionCache(requestIdentifier);
      if (storedResponse) return storedResponse;
      const search = `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/search?prettyPrint=false`;
      const result = await this.cachedRequest(search, JSON.stringify(body), await this.getYoutubeIHeadersWithCredentials(true), true);
      if (!result || !result.response || !result.response.ok) {
        this.logInfo(`Failed to fetch ${search}:`, ((_a = result == null ? void 0 : result.response) == null ? void 0 : _a.statusText) || "Unknown error");
        return;
      }
      const json = result.data;
      let channelUcid, channelHandle;
      for (const sectionContent of ((_e = (_d = (_c = (_b = json.contents) == null ? void 0 : _b.twoColumnSearchResultsRenderer) == null ? void 0 : _c.primaryContents) == null ? void 0 : _d.sectionListRenderer) == null ? void 0 : _e.contents) || []) {
        for (const itemRenderedContent of ((_f = sectionContent == null ? void 0 : sectionContent.itemSectionRenderer) == null ? void 0 : _f.contents) || []) {
          if (this.isStringEqual((_h = (_g = itemRenderedContent == null ? void 0 : itemRenderedContent.channelRenderer) == null ? void 0 : _g.title) == null ? void 0 : _h.simpleText, query) || this.isStringEqual((_j = (_i = itemRenderedContent == null ? void 0 : itemRenderedContent.channelRenderer) == null ? void 0 : _i.subscriberCountText) == null ? void 0 : _j.simpleText, query)) {
            channelUcid = (_k = itemRenderedContent == null ? void 0 : itemRenderedContent.channelRenderer) == null ? void 0 : _k.channelId;
            channelHandle = (_m = (_l = itemRenderedContent == null ? void 0 : itemRenderedContent.channelRenderer) == null ? void 0 : _l.subscriberCountText) == null ? void 0 : _m.simpleText;
            break;
          }
        }
      }
      for (const sectionContent of ((_o = (_n = json.contents) == null ? void 0 : _n.sectionListRenderer) == null ? void 0 : _o.contents) || []) {
        for (const itemRenderedContent of ((_p = sectionContent == null ? void 0 : sectionContent.itemSectionRenderer) == null ? void 0 : _p.contents) || []) {
          let itemMatchChannelName = false;
          for (const runs of ((_r = (_q = itemRenderedContent == null ? void 0 : itemRenderedContent.compactChannelRenderer) == null ? void 0 : _q.displayName) == null ? void 0 : _r.runs) || []) {
            if (this.isStringEqual(runs.text, query)) {
              itemMatchChannelName = true;
              break;
            }
          }
          let itemMatchChannelHandle = false;
          let itemMatchChannelHandleIndex = -1;
          for (const runs of ((_t = (_s = itemRenderedContent == null ? void 0 : itemRenderedContent.compactChannelRenderer) == null ? void 0 : _s.subscriberCountText) == null ? void 0 : _t.runs) || []) {
            if (this.isStringEqual(runs.text, query)) {
              itemMatchChannelHandle = true;
              itemMatchChannelHandleIndex = (_v = (_u = itemRenderedContent == null ? void 0 : itemRenderedContent.compactChannelRenderer) == null ? void 0 : _u.subscriberCountText) == null ? void 0 : _v.runs.indexOf(runs);
              break;
            }
          }
          if (itemMatchChannelName || itemMatchChannelHandle) {
            channelUcid = (_w = itemRenderedContent == null ? void 0 : itemRenderedContent.compactChannelRenderer) == null ? void 0 : _w.channelId;
            channelHandle = (_A = (_z = (_y = (_x = itemRenderedContent == null ? void 0 : itemRenderedContent.compactChannelRenderer) == null ? void 0 : _x.subscriberCountText) == null ? void 0 : _y.runs) == null ? void 0 : _z[itemMatchChannelHandleIndex]) == null ? void 0 : _A.text;
            break;
          }
        }
      }
      const response = { channelUcid, channelHandle };
      if (!response || !response.channelUcid) return;
      this.setSessionCache(requestIdentifier, response);
      return response;
    },
    getChannelUCIDFromHref: async function(href) {
      if (!href) return null;
      const channelMatch = href.match(/\/channel\/([^/?&#]+)/);
      if (channelMatch && channelMatch[1]) return channelMatch[1];
      const handleMatch = href.match(/\/(?:@|c\/|user\/)([^/?&#]+)/);
      if (handleMatch && handleMatch[1]) {
        let handle = handleMatch[1];
        if (!handle.startsWith("@")) handle = href.includes("/@") ? `@${handle}` : handle;
        const lookupResult = await this.lookupChannelId(handle);
        return lookupResult == null ? void 0 : lookupResult.channelUcid;
      }
      return null;
    },
    getChannelUCID: async function() {
      if (window.location.pathname.startsWith("/channel/")) {
        const match = window.location.pathname.match(/\/channel\/([^/?]+)/);
        return match ? `${match[1]}` : null;
      }
      let handle = null;
      if (window.location.pathname.startsWith("/c/")) {
        const match = window.location.pathname.match(/\/c\/([^/?]+)/);
        handle = match ? `${match[1]}` : null;
      } else if (window.location.pathname.startsWith("/@")) {
        const match = window.location.pathname.match(/\/(@[^/?]+)/);
        handle = match ? `${match[1]}` : null;
      } else if (window.location.pathname.startsWith("/user/")) {
        const match = window.location.pathname.match(/\/user\/([^/?]+)/);
        handle = match ? `${match[1]}` : null;
      }
      const lookupResult = await this.lookupChannelId(handle);
      return lookupResult == null ? void 0 : lookupResult.channelUcid;
    },
    getChannelBrandingWithYoutubeI: async function(ucid = null) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      if (!ucid) ucid = await this.getChannelUCID();
      if (!ucid) {
        this.logInfo("could not find channel UCID");
        return;
      }
      const body = {
        context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250527.00.00", hl: "lo" } },
        browseId: ucid
      };
      const requestIdentifier = `youtubei/v1/browse_${JSON.stringify(body)}`;
      const storedResponse = this.getSessionCache(requestIdentifier);
      if (storedResponse) return storedResponse;
      const browse = `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/browse?prettyPrint=false`;
      const response = await this.cachedRequest(browse, JSON.stringify(body), await this.getYoutubeIHeadersWithCredentials(), true);
      if (!(response == null ? void 0 : response.data)) {
        this.logWarning(`Failed to fetch ${browse} or parse response`);
        return;
      }
      const hdr = (_a = response.data.header) == null ? void 0 : _a.pageHeaderRenderer;
      const metadata = (_b = response.data.metadata) == null ? void 0 : _b.channelMetadataRenderer;
      const hdrMetadataRows = (_f = (_e = (_d = (_c = hdr == null ? void 0 : hdr.content) == null ? void 0 : _c.pageHeaderViewModel) == null ? void 0 : _d.metadata) == null ? void 0 : _e.contentMetadataViewModel) == null ? void 0 : _f.metadataRows;
      let channelHandle;
      for (const metadataRow of hdrMetadataRows || []) {
        for (const metadataPart of (metadataRow == null ? void 0 : metadataRow.metadataParts) || []) {
          if ((_h = (_g = metadataPart == null ? void 0 : metadataPart.text) == null ? void 0 : _g.content) == null ? void 0 : _h.startsWith("@")) {
            channelHandle = (_i = metadataPart == null ? void 0 : metadataPart.text) == null ? void 0 : _i.content;
            break;
          }
        }
      }
      const result = {
        title: metadata == null ? void 0 : metadata.title,
        truncatedDescription: (_n = (_m = (_l = (_k = (_j = hdr == null ? void 0 : hdr.content) == null ? void 0 : _j.pageHeaderViewModel) == null ? void 0 : _k.description) == null ? void 0 : _l.descriptionPreviewViewModel) == null ? void 0 : _m.description) == null ? void 0 : _n.content,
        description: metadata == null ? void 0 : metadata.description,
        channelHandle
      };
      if (!metadata || !hdr) return;
      this.setSessionCache(requestIdentifier, result);
      return result;
    },
    getPlayerResponseSafely: function(playerEl) {
      var _a, _b;
      let response = null;
      try {
        if (playerEl && playerEl["getPlayerResponse"] && typeof playerEl["getPlayerResponse"] === "function") response = playerEl["getPlayerResponse"]();
      } catch (err) {
        (_a = this == null ? void 0 : this.logDebug) == null ? void 0 : _a.call(this, "getPlayerResponse failed", err);
      }
      if (!response) {
        try {
          if (playerEl && playerEl["getEmbeddedPlayerResponse"] && typeof playerEl["getEmbeddedPlayerResponse"] === "function") response = playerEl["getEmbeddedPlayerResponse"]();
        } catch (err) {
          (_b = this == null ? void 0 : this.logDebug) == null ? void 0 : _b.call(this, "getEmbeddedPlayerResponse failed", err);
        }
      }
      if (!response && window["ytplayer"] && window["ytplayer"].config && window["ytplayer"].config.args && window["ytplayer"].config.args.player_response) {
        try {
          response = JSON.parse(window["ytplayer"].config.args.player_response);
        } catch (err) {
          this.logWarning("Failed to parse ytplayer.config.args.player_response", err);
        }
      }
      return response || null;
    },
    increaseVideoAttemptAttribute: function(element, attributeName, videoId) {
      var _a;
      const getCount = element.getAttribute(attributeName);
      const getCountNumber = parseInt(getCount ? ((_a = getCount.match(new RegExp(`^${videoId}__([0-9]+)$`))) == null ? void 0 : _a[1]) || "0" : "0");
      element.setAttribute(attributeName, `${videoId}__${getCountNumber >= this.MAX_ATTEMPTS ? this.MAX_ATTEMPTS : getCountNumber + 1}`);
    },
    __qsProfile: new Map(),
    __qsTotals: { calls: 0, totalMs: 0 },
    __formatRootLabel: function(root) {
      if (!root || root === document) return "document";
      if (root.nodeType === Node.ELEMENT_NODE) {
        const el = root;
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string" ? `.${el.className.split(/\s+/).slice(0, 2).join(".")}` : "";
        return `${el.tagName.toLowerCase()}${id}${cls}`;
      }
      return String(root.nodeName || "node").toLowerCase();
    },
    __recordQueryProfile: function(method, root, selector, durationMs) {
      if (!this.QS_PROFILE_ENABLED) return;
      const rootLabel = this.__formatRootLabel(root);
      const key = `${method}|${rootLabel}|${selector}`;
      const entry = this.__qsProfile.get(key) || { key, method, root: rootLabel, selector, calls: 0, totalMs: 0, maxMs: 0, minMs: Number.POSITIVE_INFINITY };
      entry.calls += 1;
      entry.totalMs += durationMs;
      if (durationMs > entry.maxMs) entry.maxMs = durationMs;
      if (durationMs < entry.minMs) entry.minMs = durationMs;
      this.__qsProfile.set(key, entry);
      this.__qsTotals.calls += 1;
      this.__qsTotals.totalMs += durationMs;
    },
    querySelector: function(selector, root = document) {
      const context = root || document;
      if (!this.QS_PROFILE_ENABLED) return context.querySelector(selector);
      const t0 = performance.now();
      const result = context.querySelector(selector);
      this.__recordQueryProfile("qs", context, selector, performance.now() - t0);
      return result;
    },
    querySelectorAll: function(selector, root = document) {
      const context = root || document;
      if (!this.QS_PROFILE_ENABLED) return context.querySelectorAll(selector);
      const t0 = performance.now();
      const result = context.querySelectorAll(selector);
      this.__recordQueryProfile("qsa", context, selector, performance.now() - t0);
      return result;
    },
    printProfile: function({ sortBy = "totalMs", limit = 50 } = {}) {
      if (!this.QS_PROFILE_ENABLED) {
        console.log("To enable query selector profiling, set QS_PROFILE_ENABLED to true");
        return;
      }
      const rows = Array.from(this.__qsProfile.values()).map((e) => ({ method: e.method, root: e.root, selector: e.selector, calls: e.calls, totalMs: Number(e.totalMs.toFixed(2)), avgMs: Number((e.totalMs / e.calls).toFixed(2)), pctTotal: this.__qsTotals.totalMs > 0 ? Number((e.totalMs / this.__qsTotals.totalMs * 100).toFixed(1)) : 0 }));
      const validSorts = new Set(["totalMs", "calls", "avgMs", "maxMs"]);
      const sortKey = validSorts.has(sortBy) ? sortBy : "totalMs";
      rows.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
      console.log(`${this.LOG_PREFIX} QuerySelector profile — calls=${this.__qsTotals.calls}, totalMs=${this.__qsTotals.totalMs.toFixed(2)}`);
      if (typeof console.table === "function") console.table(rows.slice(0, limit));
      else rows.slice(0, limit).forEach((r) => console.log(`${r.method} ${r.root} ${r.selector} → calls=${r.calls} totalMs=${r.totalMs} avgMs=${r.avgMs} (${r.pctTotal}%)`));
    },
    clearProfile: function() {
      this.__qsProfile.clear();
      this.__qsTotals.calls = 0;
      this.__qsTotals.totalMs = 0;
    }
  };
  function initAntiTranslateCore(getSettingsFn) {
    window.__YAT_getSettings = getSettingsFn;
  }
  const INTERSECTION_UPDATE_STEP_VIDEOS = 2;
  let allIntersectVideoElements = null;
  let intersectionObserverOtherVideos = null;
  const INTERSECTION_UPDATE_STEP_SHORTS = 2;
  let allIntersectShortElements = null;
  let intersectionObserverOtherShorts = null;
  let cachedRequest2 = null;
  async function untranslateCurrentShortVideo() {
    const fakeNodeID = "yt-anti-translate-fake-node-current-short-video";
    const originalNodeSelector = "yt-shorts-video-title-view-model > h2 > span:not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "span:not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, "span", true, true);
  }
  async function untranslateCurrentShortVideoDescriptionPanelHeader() {
    const fakeNodeID = "yt-anti-translate-fake-node-current-short-video-description-panel-header";
    const originalNodeSelector = "#anchored-panel ytd-video-description-header-renderer > #title > yt-formatted-string:not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "span:not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, "span", false);
  }
  function getShortUrlFromSource() {
    if (window.YoutubeAntiTranslate.isMobile()) {
      const sourceUrl = document.location.href;
      const match = sourceUrl.match(/\/source\/([^\\]+)\/shorts/);
      if (match) {
        const sourceVideoId = match[1];
        return "https://m.youtube.com/shorts/" + sourceVideoId;
      }
    }
    return document.location.href;
  }
  async function untranslateCurrentShortVideoEngagementPanel() {
    const fakeNodeID = "yt-anti-translate-fake-node-current-short-video-engagement-panel";
    const originalNodeSelector = "#anchored-panel #header yt-dynamic-text-view-model > h1 > span:not(#" + fakeNodeID + "), ytm-browse yt-dynamic-text-view-model > h1 > span:not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "span:not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, getShortUrlFromSource, "span", false, window.YoutubeAntiTranslate.isMobile());
  }
  async function untranslateCurrentShortVideoLinks() {
    const fakeNodeID = "yt-anti-translate-fake-node-current-short-video-links";
    const originalNodeSelector = ".ytReelMultiFormatLinkViewModelEndpoint span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ">span:not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "span:not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => {
      var _a, _b, _c;
      return (_c = (_b = (_a = el == null ? void 0 : el.parentElement) == null ? void 0 : _a.parentElement) == null ? void 0 : _b.parentElement) == null ? void 0 : _c.href;
    }, "span", false);
  }
  async function untranslateCurrentVideo() {
    if (!window.location.pathname.startsWith("/watch")) return;
    const fakeNodeID = "yt-anti-translate-fake-node-current-video";
    const originalNodeSelector = "#title > h1 > yt-formatted-string:not(#" + fakeNodeID + "), .slim-video-information-title " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "yt-formatted-string:not(#" + fakeNodeID + "), " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, "div", false, true);
  }
  async function untranslateCurrentVideoHeadLink() {
    const fakeNodeID = "yt-anti-translate-fake-node-video-head-link";
    const originalNodeSelector = window.YoutubeAntiTranslate.getPlayerSelector() + " a.ytp-title-link:not(#" + fakeNodeID + "), " + window.YoutubeAntiTranslate.getPlayerSelector() + " h2.ytPlayerOverlayVideoDetailsRendererTitle:not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "a.ytp-title-link:not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => {
      const videoLinkHead = el.href;
      if (!videoLinkHead || videoLinkHead.trim() === "") return document.location.href;
      return videoLinkHead;
    }, "a", false, document.location.href.includes("youtube-nocookie.com") || document.location.href.includes("youtube.com/embed/"));
  }
  async function untranslateCurrentVideoFullScreenEdu() {
    if (!window.location.pathname.startsWith("/watch")) return;
    const fakeNodeID = "yt-anti-translate-fake-node-fullscreen-edu";
    const originalNodeSelector = window.YoutubeAntiTranslate.getPlayerSelector() + " div.ytp-fullerscreen-edu-text:not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "div.ytp-fullerscreen-edu-text:not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, "div", false);
  }
  async function untranslateCurrentEmbeddedVideoMobileFullScreen() {
    const fakeNodeID = "yt-anti-translate-fake-node-embedded-mobilefullscreen-title";
    const originalNodeSelector = "#player-controls a.ytmVideoInfoVideoTitle > span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    const authorFakeNodeID = fakeNodeID + "-author";
    const videoAuthorSelector = "#player-controls a.ytmVideoInfoChannelTitle > span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + authorFakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => {
      var _a;
      return (_a = document.querySelector("#player-controls a.ytmVideoInfoVideoTitle")) == null ? void 0 : _a.getAttribute("href");
    }, "div", false, true, videoAuthorSelector, authorFakeNodeID, "span");
  }
  async function untranslateCurrentChannelEmbeddedVideoTitle() {
    const fakeNodeID = "yt-anti-translate-fake-node-channel-embedded-title";
    const originalNodeSelector = "div.ytd-channel-video-player-renderer #metadata-container.ytd-channel-video-player-renderer a:not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "a:not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => el.href, "a", false);
  }
  async function untranslateCurrentMobileVideoDescriptionHeader() {
    if (!window.YoutubeAntiTranslate.isMobile()) return;
    const fakeNodeID = "yt-anti-translate-fake-node-mobile-video-description";
    const originalNodeSelector = "ytm-video-description-header-renderer .title > span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, "span", true);
  }
  async function untranslateCurrentMobileFeaturedVideoChannel() {
    if (!window.YoutubeAntiTranslate.isMobile()) return;
    const fakeNodeID = "yt-anti-translate-fake-node-mobile-featured-video-channel";
    const originalNodeSelector = "ytm-channel-featured-video-renderer > a > h3 > span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = "span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => el.closest("a").href, "span", false, true);
  }
  async function untranslateCurrentMiniPlayerVideo() {
    if (window.YoutubeAntiTranslate.isMobile()) return;
    if (!window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("ytd-miniplayer " + window.YoutubeAntiTranslate.getPlayerSelector()))) return;
    const fakeNodeID = "yt-anti-translate-fake-node-mini-player-video-channel";
    const originalNodeSelector = "ytd-miniplayer-info-bar .ytdMiniplayerInfoBarTitle " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    const originalNodePartialSelector = window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + fakeNodeID + ")";
    const authorFakeNodeID = fakeNodeID + "-author";
    const videoAuthorSelector = "ytd-miniplayer-info-bar .ytdMiniplayerInfoBarSubtitle " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ":not(#" + authorFakeNodeID + ")";
    await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => {
      const miniPlayer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("ytd-miniplayer " + window.YoutubeAntiTranslate.getPlayerSelector()));
      const playerResponse = window.YoutubeAntiTranslate.getPlayerResponseSafely(miniPlayer);
      if (playerResponse && playerResponse["videoDetails"] && playerResponse["videoDetails"].videoId) return document.location.origin + "/watch?v=" + playerResponse["videoDetails"].videoId;
      return null;
    }, "span", true, false, videoAuthorSelector, authorFakeNodeID, "span");
  }
  async function createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, getUrl, createElementTag, requirePlayer = true, shouldSetDocumentTitle = false, videoAuthorSelector = null, authorFakeNodeID = null, authorCreateElementTag = null) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    if (!requirePlayer || window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()))) {
      const settings = await window.YoutubeAntiTranslate.getSettings();
      let translatedElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(originalNodeSelector));
      if (!translatedElement || !translatedElement.textContent) translatedElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(originalNodeSelector + ":not(.cbCustomTitle)"));
      const fakeNode = window.YoutubeAntiTranslate.querySelector("#" + fakeNodeID);
      if ((!fakeNode || !fakeNode.textContent) && (!translatedElement || !translatedElement.textContent)) return;
      const getUrlForElement = window.YoutubeAntiTranslate.stripNonEssentialParams(getUrl(translatedElement ?? fakeNode));
      if (window.YoutubeAntiTranslate.isAdvertisementHref(getUrlForElement)) return;
      const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(getUrlForElement.startsWith("http") ? getUrlForElement : window.location.origin + getUrlForElement);
      if (!videoId) return;
      let response = await cachedRequest2("https://www.youtube.com/oembed?url=" + getUrlForElement);
      if (!response || !response.response || !response.response.ok || !((_a = response.data) == null ? void 0 : _a.title)) {
        if (((_b = response == null ? void 0 : response.response) == null ? void 0 : _b.status) === 401) {
          response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
          if (!((_c = response == null ? void 0 : response.response) == null ? void 0 : _c.ok) || !((_d = response.data) == null ? void 0 : _d.title)) {
            window.YoutubeAntiTranslate.logWarning("YoutubeI title request failed for video " + videoId);
            return;
          }
        } else {
          return;
        }
      }
      const realTitle = response.data.title;
      if (!realTitle || !translatedElement && !fakeNode) return;
      if (settings.untranslateChannelBranding && videoAuthorSelector && authorFakeNodeID && authorCreateElementTag) {
        await createOrUpdateUntranslatedFakeNodeAuthor(response.data.author_url, response.data.author_name, videoAuthorSelector, authorFakeNodeID, authorCreateElementTag);
      }
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateTitle", null, response.data.author_url)) {
        window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video titles untranslation");
        return;
      }
      if (settings.untranslateTitle) {
        let oldTitle = translatedElement == null ? void 0 : translatedElement.textContent;
        if (!oldTitle && fakeNode) {
          const hiddenTranslatedElement = (_e = fakeNode.parentElement) == null ? void 0 : _e.querySelector(originalNodePartialSelector);
          oldTitle = ((_f = hiddenTranslatedElement == null ? void 0 : hiddenTranslatedElement.textContent) == null ? void 0 : _f.trim()) === "" ? null : hiddenTranslatedElement == null ? void 0 : hiddenTranslatedElement.textContent;
        }
        if (shouldSetDocumentTitle && oldTitle && window.YoutubeAntiTranslate.doesStringInclude(document.title, oldTitle)) document.title = window.YoutubeAntiTranslate.stringReplaceWithOptions(document.title, oldTitle, realTitle);
        if (fakeNode && window.YoutubeAntiTranslate.isVisible(fakeNode) && translatedElement && window.YoutubeAntiTranslate.isVisible(translatedElement)) {
          translatedElement["style"]["visibility"] = "hidden";
          translatedElement["style"]["display"] = "none";
        }
        if (window.YoutubeAntiTranslate.isStringEqual(fakeNode == null ? void 0 : fakeNode.textContent, realTitle)) return;
        if (window.YoutubeAntiTranslate.isStringEqual(realTitle, oldTitle)) return;
        window.YoutubeAntiTranslate.logInfo('translated title to "' + realTitle + '" from "' + oldTitle + '"');
        if (!fakeNode && translatedElement) {
          const existingFakeNode = translatedElement.parentElement.querySelector("#" + fakeNodeID);
          const newFakeNode = document.createElement(createElementTag);
          if (translatedElement.getAttribute("href")) newFakeNode.setAttribute("href", translatedElement.getAttribute("href"));
          newFakeNode.className = translatedElement.className;
          newFakeNode.setAttribute("target", translatedElement.getAttribute("target"));
          newFakeNode.tabIndex = parseInt(translatedElement.getAttribute("tabIndex") ?? "0");
          newFakeNode["data-sessionlink"] = translatedElement["data-sessionlink"];
          newFakeNode.id = fakeNodeID;
          newFakeNode.textContent = realTitle;
          newFakeNode.setAttribute("video-id", videoId);
          if (!existingFakeNode) {
            newFakeNode.style.visibility = ((_g = translatedElement["style"]) == null ? void 0 : _g["visibility"]) ?? "visible";
            newFakeNode.style.display = ((_h = translatedElement["style"]) == null ? void 0 : _h["display"]) ?? "block";
            translatedElement.after(newFakeNode);
          } else {
            newFakeNode.style.visibility = ((_i = existingFakeNode["style"]) == null ? void 0 : _i["visibility"]) ?? "visible";
            newFakeNode.style.display = ((_j = existingFakeNode["style"]) == null ? void 0 : _j["display"]) ?? "block";
            existingFakeNode.replaceWith(newFakeNode);
          }
          translatedElement["style"]["visibility"] = "hidden";
          translatedElement["style"]["display"] = "none";
        } else if (fakeNode) {
          fakeNode.textContent = realTitle;
          fakeNode.setAttribute("video-id", videoId);
        }
      }
    }
  }
  async function createOrUpdateUntranslatedFakeNodeAuthor(realAuthorUrl, realAuthor, videoAuthorSelector, authorFakeNodeID, authorCreateElementTag) {
    var _a, _b, _c, _d;
    const translatedElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(videoAuthorSelector));
    const fakeNode = window.YoutubeAntiTranslate.querySelector("#" + authorFakeNodeID);
    if ((!fakeNode || !fakeNode.textContent) && (!translatedElement || !translatedElement.textContent)) return;
    if (!realAuthor || !translatedElement && !fakeNode) return;
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, realAuthorUrl)) {
      window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping channel branding untranslation");
      return;
    }
    const oldAuthor = (translatedElement == null ? void 0 : translatedElement.textContent) || (fakeNode == null ? void 0 : fakeNode.textContent);
    if (fakeNode && window.YoutubeAntiTranslate.isVisible(fakeNode) && translatedElement && window.YoutubeAntiTranslate.isVisible(translatedElement)) {
      translatedElement["style"]["visibility"] = "hidden";
      translatedElement["style"]["display"] = "none";
    }
    if (window.YoutubeAntiTranslate.isStringEqual(fakeNode == null ? void 0 : fakeNode.textContent, realAuthor)) return;
    window.YoutubeAntiTranslate.logInfo('translated author to "' + realAuthor + '" from "' + oldAuthor + '"');
    if (!fakeNode && translatedElement) {
      const existingFakeNode = translatedElement.parentElement.querySelector("#" + authorFakeNodeID);
      const newFakeNode = document.createElement(authorCreateElementTag);
      if (translatedElement.getAttribute("href")) newFakeNode.setAttribute("href", translatedElement.getAttribute("href"));
      newFakeNode.className = translatedElement.className;
      newFakeNode.setAttribute("target", translatedElement.getAttribute("target"));
      newFakeNode.tabIndex = parseInt(translatedElement.getAttribute("tabIndex") ?? "0");
      newFakeNode["data-sessionlink"] = translatedElement["data-sessionlink"];
      newFakeNode.id = authorFakeNodeID;
      newFakeNode.textContent = realAuthor;
      if (!existingFakeNode) {
        newFakeNode.style.visibility = ((_a = translatedElement["style"]) == null ? void 0 : _a["visibility"]) ?? "visible";
        newFakeNode.style.display = ((_b = translatedElement["style"]) == null ? void 0 : _b["display"]) ?? "block";
        translatedElement.after(newFakeNode);
      } else {
        newFakeNode.style.visibility = ((_c = existingFakeNode["style"]) == null ? void 0 : _c["visibility"]) ?? "visible";
        newFakeNode.style.display = ((_d = existingFakeNode["style"]) == null ? void 0 : _d["display"]) ?? "block";
        existingFakeNode.replaceWith(newFakeNode);
      }
      translatedElement["style"]["visibility"] = "hidden";
      translatedElement["style"]["display"] = "none";
    } else if (fakeNode) {
      fakeNode.textContent = realAuthor;
    }
  }
  async function untranslateOtherVideos(intersectElements = null, mutations) {
    const player = window.YoutubeAntiTranslate.getCachedPlayer();
    const allMutationsAreInPlayer = player && mutations && mutations.every((e) => player.contains(e.target));
    if (allMutationsAreInPlayer) return;
    async function untranslateOtherVideosArray(otherVideos) {
      if (!otherVideos) return;
      const videosArray = Array.from(otherVideos);
      const settings = await window.YoutubeAntiTranslate.getSettings();
      await Promise.all(videosArray.map(async (video) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!video) return;
        const isPlaylist = video.querySelector('a[href*="/playlist?"]') || window.YoutubeAntiTranslate.getFirstVisible(video.querySelectorAll("yt-collection-thumbnail-view-model, .media-item-thumbnail-container.stacked"));
        if (isPlaylist && !settings.untranslateThumbnail) return;
        const hrefFilter = '[href*="/watch?v="]';
        let linkElement = video.querySelector("a#video-title-link" + hrefFilter) || video.querySelector("a#thumbnail" + hrefFilter) || video.querySelector("a.media-item-thumbnail-container" + hrefFilter) || video.querySelector("div.media-item-metadata > a" + hrefFilter) || video.querySelector("ytd-playlist-panel-video-renderer a" + hrefFilter) || video.querySelector("ytm-video-card-renderer a" + hrefFilter) || video.querySelector("a.yt-lockup-metadata-view-model__title" + hrefFilter) || video.querySelector("a.ytLockupMetadataViewModelTitle" + hrefFilter) || video.querySelector("a.yt-simple-endpoint" + hrefFilter);
        if (!linkElement) {
          let isMatches2 = function(v) {
            return v.matches("a.ytp-videowall-still" + hrefFilter) || v.matches("a.ytp-ce-covering-overlay" + hrefFilter) || v.matches("a.ytp-suggestion-link" + hrefFilter) || v.matches("a.ytp-autonav-endscreen-link-container" + hrefFilter) || v.matches("a.autonav-endscreen-cued-video-container" + hrefFilter) || v.matches("a.ytp-modern-videowall-still" + hrefFilter);
          };
          if (isMatches2(video)) {
            linkElement = video;
          }
          if (!linkElement) {
            linkElement = video.querySelector("ytd-thumbnail a" + hrefFilter) || video.querySelector("a" + hrefFilter);
            if (!linkElement) {
              const thumbnail = video.querySelector('img[src*="i.ytimg.com"]');
              if (thumbnail) {
                const videoId2 = window.YoutubeAntiTranslate.extractVideoIdFromUrl(thumbnail.src);
                if (videoId2) {
                  linkElement = document.createElement("a");
                  linkElement.href = "/watch?v=" + videoId2;
                }
              }
            }
          }
          if (!linkElement) return;
        }
        if (window.YoutubeAntiTranslate.isAdvertisementHref(linkElement.href)) return;
        const videoHref = window.YoutubeAntiTranslate.stripNonEssentialParams(linkElement.href);
        const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(videoHref.startsWith("http") ? videoHref : window.location.origin + videoHref);
        if (video.hasAttribute("data-ytat-untranslated-video-title") && video.getAttribute("data-ytat-untranslated-video-title") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS && video.hasAttribute("data-ytat-untranslated-video-thumbnail") && video.getAttribute("data-ytat-untranslated-video-thumbnail") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS && video.hasAttribute("data-ytat-untranslated-video-desc") && video.getAttribute("data-ytat-untranslated-video-desc") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS && video.hasAttribute("data-ytat-untranslated-video-channel-branding") && video.getAttribute("data-ytat-untranslated-video-channel-branding") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS || video.hasAttribute("data-ytat-untranslated-video-failed-attempts") && video.getAttribute("data-ytat-untranslated-video-failed-attempts") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS) return;
        let titleElement = video.querySelector("#video-title:not(.cbCustomTitle)") || video.querySelector(".compact-media-item-headline " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector(".YtmCompactMediaItemHeadline " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector("ytd-playlist-panel-video-renderer #video-title") || video.querySelector("ytm-video-card-renderer .video-card-title " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector(".media-item-headline " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector("div.media-item-metadata > a > h3.media-item-headline") || video.querySelector(".yt-lockup-metadata-view-model__heading-reset " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector(".ytLockupMetadataViewModelHeadingReset " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector("a.ytLockupMetadataViewModelTitle " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector("span.ytp-videowall-still-info-title") || video.querySelector("div.ytp-ce-video-title") || video.querySelector("div.ytp-suggestion-title") || video.querySelector("#title.ytd-structured-description-video-lockup-renderer") || video.querySelector("div.ytp-autonav-endscreen-upnext-title") || video.querySelector("div.autonav-endscreen-video-title > " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector("span.ytp-modern-videowall-still-info-title");
        if (!titleElement) {
          titleElement = video.querySelector("yt-formatted-string#video-title") || video.querySelector(".yt-lockup-metadata-view-model-wiz__title>" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector(".ytLockupMetadataViewModelTitle>" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector(".compact-media-item-headline " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector(".YtmCompactMediaItemHeadline " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR);
          if (!titleElement) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-title", videoId);
        }
        const thumbnailElements = video.querySelectorAll('yt-thumbnail-view-model img:not(.ytd-moving-thumbnail-renderer), img[src*="i.ytimg.com"]:not(.ytd-moving-thumbnail-renderer):not([src*="ytimg.com/an_webp/"]), div[style*="i.ytimg.com"][style*="background-image"]');
        if (!thumbnailElements || thumbnailElements.length === 0) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-thumbnail", videoId);
        const snippetElements = video.querySelectorAll(".metadata-snippet-text, .metadata-snippet-text-navigation, #dismissible #description-text");
        if (!snippetElements || snippetElements.length === 0) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-desc", videoId);
        const authorsElement = window.YoutubeAntiTranslate.getFirstVisible(video.querySelectorAll("#channel-info yt-formatted-string > a.yt-simple-endpoint, yt-content-metadata-view-model " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + " a, .ytd-channel-name a.yt-simple-endpoint, .ytd-playlist-panel-video-renderer #byline, div.media-item-metadata .YtmBadgeAndBylineRendererHost span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ", .YtmCompactMediaItemByline span" + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR));
        if (!authorsElement) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-channel-branding", videoId);
        if (!titleElement && (!thumbnailElements || thumbnailElements.length === 0) && (!snippetElements || snippetElements.length === 0) && !authorsElement) return;
        try {
          let response = await cachedRequest2("https://www.youtube.com/oembed?url=" + videoHref);
          if (!response || !response.response || !response.response.ok || !((_a = response.data) == null ? void 0 : _a.title)) {
            if (((_b = response == null ? void 0 : response.response) == null ? void 0 : _b.status) === 401) {
              response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
              if (!((_c = response == null ? void 0 : response.response) == null ? void 0 : _c.ok) || !((_d = response.data) == null ? void 0 : _d.title)) {
                window.YoutubeAntiTranslate.logWarning("YoutubeI title request failed for video " + videoId);
                window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-failed-attempts", videoId);
                return;
              }
            } else {
              window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-failed-attempts", videoId);
              return;
            }
          }
          const originalTitle = response.data.title;
          const currentTitle = ((_e = titleElement == null ? void 0 : titleElement.innerText) == null ? void 0 : _e.trim()) || ((_f = titleElement == null ? void 0 : titleElement.textContent) == null ? void 0 : _f.trim());
          if (!isPlaylist && settings.untranslateTitle && originalTitle && currentTitle && !window.YoutubeAntiTranslate.isStringEqual(originalTitle, currentTitle)) {
            if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateTitle", null, response.data.author_url)) {
              window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video titles untranslation for:", videoId, response.data.author_url);
              video.setAttribute("data-ytat-untranslated-video-title", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
            } else {
              window.YoutubeAntiTranslate.logInfo('Untranslating Video: "' + currentTitle + '" -> "' + originalTitle + '"');
              titleElement.innerText = originalTitle;
              titleElement.title = originalTitle;
              if (linkElement.matches("a#video-title-link:not(.cbCustomTitle)")) linkElement.title = originalTitle;
              video.setAttribute("data-ytat-untranslated-video-title", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
            }
          } else {
            window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-title", videoId);
          }
          const originalThumbnail = response.data.thumbnail_url;
          if (settings.untranslateThumbnail && originalThumbnail && thumbnailElements && thumbnailElements.length > 0) {
            if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateThumbnail", null, response.data.author_url)) {
              video.setAttribute("data-ytat-untranslated-video-thumbnail", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
            } else {
              for (const thumbnailElement of thumbnailElements) {
                if (thumbnailElement.closest("#mouseover-overlay")) continue;
                let imageSrc;
                if (thumbnailElement.matches("[style*='background-image']")) {
                  const currentStyle = ((_g = thumbnailElement["style"]) == null ? void 0 : _g["backgroundImage"]) || "";
                  imageSrc = (_h = currentStyle.match(/url\(["']?([^"']+)["']?\)/)) == null ? void 0 : _h[1];
                } else {
                  imageSrc = thumbnailElement.currentSrc || thumbnailElement.src;
                }
                if (!thumbnailElement || !imageSrc) continue;
                if (imageSrc.includes("https://i.ytimg.com/vi/") || imageSrc.includes("?youtube-anti-translate")) continue;
                if (!thumbnailElement.matches("[style*='background-image']") && thumbnailElement.style.width === "118%" && thumbnailElement.style.height === "118%" && thumbnailElement.style.position === "absolute" && thumbnailElement.style.top === "50%" && thumbnailElement.style.left === "50%") {
                  thumbnailElement.style.width = "";
                  thumbnailElement.style.height = "";
                  thumbnailElement.style.position = "";
                  thumbnailElement.style.top = "";
                  thumbnailElement.style.left = "";
                  thumbnailElement.style.transform = "";
                }
                if (!imageSrc.includes(originalThumbnail)) {
                  const { width, height } = await window.YoutubeAntiTranslate.getImageSize(imageSrc);
                  if (thumbnailElement.matches("[style*='background-image']")) thumbnailElement.style.backgroundImage = 'url("' + originalThumbnail + "?youtube-anti-translate=" + Date.now() + '")';
                  else thumbnailElement.src = originalThumbnail + "?youtube-anti-translate=" + Date.now();
                  if (width && height) {
                    const cropRatio = width / height;
                    if (cropRatio) {
                      thumbnailElement.style.aspectRatio = cropRatio;
                      thumbnailElement.style.objectFit = "cover";
                    }
                  }
                  video.setAttribute("data-ytat-untranslated-video-thumbnail", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
                }
              }
            }
          } else {
            window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-thumbnail", videoId);
          }
          if (!isPlaylist && settings.untranslateDescription && snippetElements && snippetElements.length > 0) {
            if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateDescription", null, response.data.author_url)) {
              video.setAttribute("data-ytat-untranslated-video-desc", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
            } else {
              const idMatch = videoHref.match(/[?&]v=([a-zA-Z0-9_-]+)/);
              if (idMatch && idMatch[1]) {
                const vId = idMatch[1];
                const originalDescription = await getOriginalVideoDescription(vId);
                if (originalDescription) {
                  const truncated = trimDescriptionByWords(originalDescription);
                  snippetElements.forEach((el) => {
                    var _a2;
                    const currentText = (_a2 = el.textContent) == null ? void 0 : _a2.trim();
                    if (truncated && currentText && !window.YoutubeAntiTranslate.isStringEqual(currentText, truncated)) {
                      el.textContent = truncated;
                      if (el.hasAttribute("is-empty")) el.removeAttribute("is-empty");
                      video.setAttribute("data-ytat-untranslated-video-desc", vId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
                    }
                  });
                }
              }
            }
          } else {
            window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-desc", videoId);
          }
          const mainAuthor = response.data.author_name;
          if (!isPlaylist && settings.untranslateChannelBranding && authorsElement && mainAuthor) {
            const authors = [];
            const avatarStacks = window.YoutubeAntiTranslate.getAllVisibleNodes(video.querySelectorAll("yt-avatar-stack-view-model yt-avatar-shape img"));
            if (avatarStacks && avatarStacks.length > 1) {
              for (const avatarImage of avatarStacks) {
                if (avatarImage instanceof HTMLImageElement === false) continue;
                const imgSrc = avatarImage.src;
                if (!imgSrc || imgSrc.trim() === "") continue;
                const originalCollaborators = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(mainAuthor + " " + originalTitle);
                const originalItem = originalCollaborators == null ? void 0 : originalCollaborators.find((item) => item.avatarImage === avatarImage.src);
                if (!originalItem) continue;
                authors.push(originalItem.name);
              }
            }
            if (authors.length === 0 && authorsElement.textContent.includes(" " + window.YoutubeAntiTranslate.getLocalizedAnd(document.documentElement.lang) + " ")) {
              const originalCollaborators = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(mainAuthor + " " + originalTitle);
              const originalItems = originalCollaborators == null ? void 0 : originalCollaborators.filter((item) => item.videoId === videoId);
              if (originalItems && originalItems.length > 0) {
                for (const originalItem of originalItems) authors.push(originalItem.name);
              }
            }
            if (authors.length > 0) {
              const collaboratorAuthorsOnly = authors.filter((name) => name !== mainAuthor);
              if (collaboratorAuthorsOnly && collaboratorAuthorsOnly.length === 1) {
                if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, null, null, collaboratorAuthorsOnly[0])) {
                  video.setAttribute("data-ytat-untranslated-video-channel-branding", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
                } else {
                  const authorsTooltipElements = video.querySelectorAll(".ytd-channel-name #tooltip");
                  const localizedAnd = window.YoutubeAntiTranslate.getLocalizedAnd(document.documentElement.lang);
                  const untranslatedAuthorText = mainAuthor + " " + localizedAnd + " " + collaboratorAuthorsOnly[0];
                  if (authorsElement && !authorsElement.textContent.includes(untranslatedAuthorText)) {
                    authorsElement.textContent = untranslatedAuthorText;
                    if (authorsTooltipElements && authorsTooltipElements.length > 0) {
                      for (const el of authorsTooltipElements) el.textContent = untranslatedAuthorText;
                    }
                    video.setAttribute("data-ytat-untranslated-video-channel-branding", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
                  }
                }
              }
            }
          } else {
            window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-channel-branding", videoId);
          }
        } catch (error) {
          window.YoutubeAntiTranslate.logInfo("Error processing video:", videoHref, error);
          window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, "data-ytat-untranslated-video-failed-attempts", videoId);
        }
      }));
    }
    if (intersectElements) {
      await untranslateOtherVideosArray(intersectElements);
      return;
    }
    await untranslateOtherVideosArray(window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.getArraysVideos()));
  }
  async function untranslateOtherShortsVideos(intersectElements = null, mutations) {
    window.YoutubeAntiTranslate.getCachedPlayer();
    async function untranslateOtherShortsArray(shortsItems) {
      if (!shortsItems) return;
      const shortsArray = Array.from(shortsItems);
      const settings = await window.YoutubeAntiTranslate.getSettings();
      await Promise.all(shortsArray.map(async (shortElement) => {
        var _a, _b, _c, _d, _e;
        if (!shortElement) return;
        const isPlaylist = shortElement.querySelector('a[href*="/playlist?"]') || window.YoutubeAntiTranslate.getFirstVisible(shortElement.querySelectorAll("yt-collection-thumbnail-view-model, .media-item-thumbnail-container.stacked"));
        if (isPlaylist && !settings.untranslateThumbnail) return;
        const isShortsLikeRenderer = shortElement.matches("ytm-shorts-lockup-view-model") || !!shortElement.querySelector("a.shortsLockupViewModelHostEndpoint, .shortsLockupViewModelHostMetadataTitle, .shortsLockupViewModelHostOutsideMetadataEndpoint, ytd-reel-item-renderer");
        if (!isShortsLikeRenderer) {
          const thumbnails = shortElement.querySelectorAll("img");
          for (const thumbnailElement of thumbnails) {
            if (thumbnailElement.style.width === "118%" && thumbnailElement.style.height === "118%" && thumbnailElement.style.position === "absolute" && thumbnailElement.style.top === "50%" && thumbnailElement.style.left === "50%") {
              thumbnailElement.style.width = "";
              thumbnailElement.style.height = "";
              thumbnailElement.style.position = "";
              thumbnailElement.style.top = "";
              thumbnailElement.style.left = "";
              thumbnailElement.style.transform = "";
            }
          }
          return;
        }
        let linkElement = shortElement.querySelector('a.shortsLockupViewModelHostEndpoint[href*="/shorts/"]') || shortElement.querySelector('a[href*="/shorts/"]');
        if (!linkElement && isShortsLikeRenderer) linkElement = shortElement.querySelector('a[href*="/watch?v="]');
        if (!linkElement || !linkElement.href) {
          if (!linkElement) {
            const thumbnail = shortElement.querySelector('img[src*="i.ytimg.com"]');
            if (thumbnail) {
              const videoId2 = window.YoutubeAntiTranslate.extractVideoIdFromUrl(thumbnail.src);
              if (videoId2) {
                linkElement = document.createElement("a");
                linkElement.href = "/shorts/" + videoId2;
              }
            }
          }
          if (!linkElement || !linkElement.href) return;
        }
        if (window.YoutubeAntiTranslate.isAdvertisementHref(linkElement.href)) return;
        const videoHref = linkElement.href;
        const videoIdMatch = videoHref.match(/shorts\/([a-zA-Z0-9_-]+)/) || videoHref.match(/[?&]v=([a-zA-Z0-9_-]+)/);
        if (!videoIdMatch || !videoIdMatch[1]) return;
        const videoId = videoIdMatch[1];
        if (shortElement.hasAttribute("data-ytat-untranslated-other-title") && shortElement.getAttribute("data-ytat-untranslated-other-title") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS && shortElement.hasAttribute("data-ytat-untranslated-other-thumbnail") && shortElement.getAttribute("data-ytat-untranslated-other-thumbnail") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS || shortElement.hasAttribute("data-ytat-untranslated-other-failed-attempts") && shortElement.getAttribute("data-ytat-untranslated-other-failed-attempts") === videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS) return;
        const shortTitleElement = shortElement.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_PRE_WRAP_SELECTOR) || shortElement.querySelector("a.shortsLockupViewModelHostOutsideMetadataEndpoint " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || shortElement.querySelector(".shortsLockupViewModelHostMetadataTitle " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || shortElement.querySelector(".ytLockupMetadataViewModelHeadingReset " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || shortElement.querySelector("a.ytLockupMetadataViewModelTitle " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR);
        if (!shortTitleElement) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, "data-ytat-untranslated-other-title", videoId);
        const thumbnailElements = shortElement.querySelectorAll('img[src*="i.ytimg.com"]');
        if (!thumbnailElements || thumbnailElements.length === 0) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, "data-ytat-untranslated-other-thumbnail", videoId);
        if (!shortTitleElement && (!thumbnailElements || thumbnailElements.length === 0)) return;
        const oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId;
        try {
          let response = await cachedRequest2(oembedUrl);
          if (!response || !response.response || !response.response.ok || !((_a = response.data) == null ? void 0 : _a.title)) {
            if (((_b = response == null ? void 0 : response.response) == null ? void 0 : _b.status) === 401) {
              response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
              if (!((_c = response == null ? void 0 : response.response) == null ? void 0 : _c.ok) || !((_d = response.data) == null ? void 0 : _d.title)) {
                window.YoutubeAntiTranslate.logWarning("YoutubeI title request failed for video " + videoId);
                window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, "data-ytat-untranslated-other-failed-attempts", videoId);
                return;
              }
            } else {
              window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, "data-ytat-untranslated-other-failed-attempts", videoId);
              return;
            }
          }
          if (settings.untranslateTitle || settings.untranslateThumbnail) {
            const realTitle = response.data.title;
            const currentTitle = (_e = shortTitleElement == null ? void 0 : shortTitleElement.textContent) == null ? void 0 : _e.trim();
            if (!isPlaylist && settings.untranslateTitle && realTitle && currentTitle && !window.YoutubeAntiTranslate.isStringEqual(realTitle, currentTitle)) {
              if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateTitle", null, response.data.author_url)) {
                shortElement.setAttribute("data-ytat-untranslated-other-title", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
              } else {
                shortTitleElement.textContent = realTitle;
                if (shortTitleElement.hasAttribute("title")) shortTitleElement.title = realTitle;
                const titleA = shortElement.querySelector("a.shortsLockupViewModelHostEndpoint.shortsLockupViewModelHostOutsideMetadataEndpoint");
                if (titleA) titleA.title = realTitle;
                shortElement.setAttribute("data-ytat-untranslated-other-title", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
              }
            } else {
              window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, "data-ytat-untranslated-other-title", videoId);
            }
            let originalThumbnail = response.data.thumbnail_url;
            if (settings.untranslateThumbnail && originalThumbnail && thumbnailElements && thumbnailElements.length > 0) {
              if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateThumbnail", null, response.data.author_url)) {
                shortElement.setAttribute("data-ytat-untranslated-other-thumbnail", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
              } else {
                for (const thumbnailElement of thumbnailElements) {
                  if (!thumbnailElement || !thumbnailElement.src) continue;
                  if (thumbnailElement.src.includes("https://i.ytimg.com/vi/") || thumbnailElement.src.includes("?youtube-anti-translate")) continue;
                  if (linkElement.href.includes("/shorts/")) {
                    for (const maxResName of ["maxresdefault", "oardefault"]) {
                      if (!originalThumbnail.includes(maxResName)) originalThumbnail = originalThumbnail.replace(/\/([^/_]+)\.(jpg|jpeg|png|gif|webp|avif)/, "/" + maxResName + ".$2");
                      if (await window.YoutubeAntiTranslate.isFoundImageSrc(originalThumbnail)) break;
                      else originalThumbnail = response.data.thumbnail_url;
                    }
                  }
                  if (!thumbnailElement.src.includes(originalThumbnail)) {
                    const { width, height } = await window.YoutubeAntiTranslate.getImageSize(thumbnailElement.src);
                    thumbnailElement.src = originalThumbnail + "?youtube-anti-translate=" + Date.now();
                    if (width && height) {
                      const cropRatio = width / height;
                      if (cropRatio) {
                        thumbnailElement.style.aspectRatio = cropRatio;
                        thumbnailElement.style.objectFit = "cover";
                        const { width: nw, height: nh } = await window.YoutubeAntiTranslate.getImageSize(originalThumbnail);
                        if (nw > nh) {
                          thumbnailElement.style.width = "118%";
                          thumbnailElement.style.height = "118%";
                          thumbnailElement.style.position = "absolute";
                          thumbnailElement.style.top = "50%";
                          thumbnailElement.style.left = "50%";
                          thumbnailElement.style.transform = "translate(-50%, -50%)";
                        }
                      }
                    }
                    shortElement.setAttribute("data-ytat-untranslated-other-thumbnail", videoId + "__" + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
                  }
                }
              }
            } else {
              window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, "data-ytat-untranslated-other-thumbnail", videoId);
            }
          }
        } catch (error) {
          window.YoutubeAntiTranslate.logInfo("Error fetching oEmbed for other Short:", videoId, error);
          window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, "data-ytat-untranslated-other-failed-attempts", videoId);
        }
      }));
    }
    if (intersectElements) {
      await untranslateOtherShortsArray(intersectElements);
      return;
    }
    await untranslateOtherShortsArray(window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.ALL_ARRAYS_SHORTS_SELECTOR)));
  }
  async function untranslateCurrentPlayerBackgroundThumbnail() {
    var _a, _b, _c, _d, _e, _f;
    const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()));
    if (!player) return;
    const thumbnailBackground = window.YoutubeAntiTranslate.querySelector(".ytp-cued-thumbnail-overlay-image[style*='i.ytimg.com'][style*='background-image'][style*='maxresdefault']");
    if (thumbnailBackground) {
      const currentStyle = ((_a = thumbnailBackground["style"]) == null ? void 0 : _a["backgroundImage"]) || "";
      const currentImageSrc = (_b = currentStyle.match(/url\(["']?([^"']+)["']?\)/)) == null ? void 0 : _b[1];
      if (!currentImageSrc || currentImageSrc.includes("https://i.ytimg.com/vi/") || currentImageSrc.includes("?youtube-anti-translate")) return;
      const currentVideo = document.location.href;
      const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(currentVideo);
      if (!videoId) return;
      const oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId;
      try {
        let response = await cachedRequest2(oembedUrl);
        if (!response || !response.response || !response.response.ok || !((_c = response.data) == null ? void 0 : _c.thumbnail_url)) {
          if (((_d = response == null ? void 0 : response.response) == null ? void 0 : _d.status) === 401) {
            response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
            if (!((_e = response == null ? void 0 : response.response) == null ? void 0 : _e.ok) || !((_f = response.data) == null ? void 0 : _f.title)) {
              window.YoutubeAntiTranslate.logWarning("YoutubeI title request failed for video " + videoId);
              return;
            }
          }
        }
        if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateThumbnail", null, response.data.author_url)) {
          window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video thumbnail untranslation");
          return;
        }
        let originalThumbnail = response.data.maxresdefault_url || response.data.thumbnail_url;
        if (originalThumbnail) {
          if (!originalThumbnail.includes("maxresdefault")) originalThumbnail = originalThumbnail.replace(/\/([^/]+)\.(jpg|jpeg|png|gif|webp|avif)/, "/maxresdefault.jpg");
          if (!await window.YoutubeAntiTranslate.isFoundImageSrc(originalThumbnail)) originalThumbnail = response.data.maxresdefault_url || response.data.thumbnail_url;
          if (!currentStyle || !currentStyle.includes(originalThumbnail)) {
            const { width, height } = await window.YoutubeAntiTranslate.getImageSize(currentImageSrc);
            thumbnailBackground["style"]["backgroundImage"] = 'url("' + originalThumbnail + "?youtube-anti-translate=" + Date.now() + '")';
            if (width && height) {
              const cropRatio = width / height;
              if (cropRatio) {
                thumbnailBackground["style"]["aspectRatio"] = cropRatio;
                thumbnailBackground["style"]["objectFit"] = "cover";
              }
            }
          }
        }
      } catch (error) {
        window.YoutubeAntiTranslate.logInfo("Error fetching oEmbed for current player thumbnail:", videoId, error);
        return;
      }
    }
  }
  async function untranslateCurrentPlaylistHeaderThumbnail() {
    var _a, _b, _c, _d;
    if (document.location.pathname !== "/playlist") return;
    const playlistHeadersImages = window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.querySelectorAll('yt-page-header-renderer img[src*="i.ytimg.com"]'));
    if (!playlistHeadersImages || playlistHeadersImages.length === 0) return;
    for (const playlistHeadersImage of playlistHeadersImages) {
      const imageSrc = playlistHeadersImage.getAttribute("src");
      if (!imageSrc || imageSrc.trim() === "") continue;
      if (imageSrc.includes("https://i.ytimg.com/vi/") || imageSrc.includes("?youtube-anti-translate")) continue;
      const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(imageSrc);
      if (!videoId) return;
      const oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId;
      try {
        let response = await cachedRequest2(oembedUrl);
        if (!response || !response.response || !response.response.ok || !((_a = response.data) == null ? void 0 : _a.thumbnail_url)) {
          if (((_b = response == null ? void 0 : response.response) == null ? void 0 : _b.status) === 401) {
            response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
            if (!((_c = response == null ? void 0 : response.response) == null ? void 0 : _c.ok) || !((_d = response.data) == null ? void 0 : _d.title)) {
              window.YoutubeAntiTranslate.logWarning("YoutubeI title request failed for video " + videoId);
              return;
            }
          }
        }
        if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateThumbnail", null, response.data.author_url)) {
          window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video thumbnail untranslation");
          continue;
        }
        if (response.data.thumbnail_url && !imageSrc.includes(response.data.thumbnail_url)) {
          const { width, height } = await window.YoutubeAntiTranslate.getImageSize(imageSrc);
          playlistHeadersImage.setAttribute("src", response.data.thumbnail_url + "?youtube-anti-translate=" + Date.now());
          if (width && height) {
            const cropRatio = width / height;
            if (cropRatio) {
              playlistHeadersImage["style"]["aspectRatio"] = cropRatio;
              playlistHeadersImage["style"]["objectFit"] = "cover";
            }
          }
        }
      } catch (error) {
        window.YoutubeAntiTranslate.logInfo("Error fetching oEmbed for current playlist header thumbnail:", videoId, error);
        return;
      }
    }
  }
  async function untranslateCurrentVideoPreviewThumbnail() {
    var _a, _b, _c, _d;
    const videoPreview = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("#video-preview-container a.ytd-video-preview"));
    if (!videoPreview) return;
    const thumbnailElements = window.YoutubeAntiTranslate.getAllVisibleNodes(videoPreview.querySelectorAll('img[src*="i.ytimg.com"]'));
    let thumbnailNeedsUpdate = false;
    if (thumbnailElements && thumbnailElements.length > 0) {
      for (const thumbnailElement of thumbnailElements) {
        if (!thumbnailElement || !thumbnailElement.getAttribute("src")) continue;
        const currentImageSrc = thumbnailElement.getAttribute("src");
        if (currentImageSrc.includes("https://i.ytimg.com/vi/") || currentImageSrc.includes("?youtube-anti-translate")) continue;
        thumbnailNeedsUpdate = true;
        break;
      }
      if (!thumbnailNeedsUpdate) return;
      const currentVideoHref = videoPreview.getAttribute("href");
      if (!currentVideoHref || currentVideoHref.trim() === "") return;
      const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(currentVideoHref);
      if (!videoId) return;
      const oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId;
      try {
        let response = await cachedRequest2(oembedUrl);
        if (!response || !response.response || !response.response.ok || !((_a = response.data) == null ? void 0 : _a.thumbnail_url)) {
          if (((_b = response == null ? void 0 : response.response) == null ? void 0 : _b.status) === 401) {
            response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
            if (!((_c = response == null ? void 0 : response.response) == null ? void 0 : _c.ok) || !((_d = response.data) == null ? void 0 : _d.title)) {
              window.YoutubeAntiTranslate.logWarning("YoutubeI title request failed for video " + videoId);
              return;
            }
          }
        }
        if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateThumbnail", null, response.data.author_url)) {
          window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video thumbnail untranslation");
          return;
        }
        const originalThumbnail = response.data.thumbnail_url;
        for (const thumbnailElement of thumbnailElements) {
          if (!thumbnailElement.getAttribute("src").includes(originalThumbnail)) {
            const { width, height } = await window.YoutubeAntiTranslate.getImageSize(thumbnailElement.getAttribute("src"));
            thumbnailElement.setAttribute("src", originalThumbnail + "?youtube-anti-translate=" + Date.now());
            if (width && height) {
              const cropRatio = width / height;
              if (cropRatio) {
                thumbnailElement["style"]["aspectRatio"] = cropRatio;
                thumbnailElement["style"]["objectFit"] = "cover";
              }
            }
          }
        }
      } catch (error) {
        window.YoutubeAntiTranslate.logInfo("Error fetching oEmbed for current player thumbnail:", videoId, error);
        return;
      }
    }
  }
  async function untranslate(mutations) {
    const settings = await window.YoutubeAntiTranslate.getSettings();
    await Promise.all([
      settings.untranslateTitle ? untranslateCurrentVideo() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentVideoHeadLink() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentVideoFullScreenEdu() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentChannelEmbeddedVideoTitle() : Promise.resolve(),
      settings.untranslateTitle || settings.untranslateDescription || settings.untranslateChannelBranding || settings.untranslateThumbnail ? untranslateOtherVideos(void 0, mutations) : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentShortVideo() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentShortVideoEngagementPanel() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentShortVideoDescriptionPanelHeader() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentShortVideoLinks() : Promise.resolve(),
      settings.untranslateTitle || settings.untranslateThumbnail ? untranslateOtherShortsVideos() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentMobileVideoDescriptionHeader() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentMobileFeaturedVideoChannel() : Promise.resolve(),
      settings.untranslateTitle || settings.untranslateChannelBranding ? untranslateCurrentEmbeddedVideoMobileFullScreen() : Promise.resolve(),
      settings.untranslateThumbnail ? untranslateCurrentPlayerBackgroundThumbnail() : Promise.resolve(),
      settings.untranslateThumbnail ? untranslateCurrentPlaylistHeaderThumbnail() : Promise.resolve(),
      settings.untranslateTitle ? untranslateCurrentMiniPlayerVideo() : Promise.resolve(),
      settings.untranslateThumbnail ? untranslateCurrentVideoPreviewThumbnail() : Promise.resolve()
    ]);
    if (settings.untranslateTitle || settings.untranslateDescription || settings.untranslateChannelBranding || settings.untranslateThumbnail) updateObserverOtherVideosOnIntersect(mutations);
    if (settings.untranslateTitle || settings.untranslateThumbnail) updateObserverOtherShortsOnIntersect();
  }
  let mutationIdxVideos = 0;
  async function untranslateOtherVideosOnIntersect(entries) {
    if (mutationIdxVideos % INTERSECTION_UPDATE_STEP_VIDEOS === 0) {
      if (!entries) return;
      const intersectElements = [];
      for (const entry of entries) {
        if (entry.isIntersecting) intersectElements.push(entry.target);
      }
      await untranslateOtherVideos(intersectElements);
      updateObserverOtherVideosOnIntersect();
    }
    mutationIdxVideos++;
  }
  function updateObserverOtherVideosOnIntersect(mutations) {
    const player = window.YoutubeAntiTranslate.getCachedPlayer();
    const allMutationsAreInPlayer = player && mutations && mutations.every((e) => player.contains(e.target));
    if (allMutationsAreInPlayer) return;
    for (const el of allIntersectVideoElements ?? []) intersectionObserverOtherVideos.unobserve(el);
    allIntersectVideoElements = window.YoutubeAntiTranslate.getAllVisibleNodesOutsideViewport(window.YoutubeAntiTranslate.getArraysVideos(), true);
    for (const el of allIntersectVideoElements ?? []) intersectionObserverOtherVideos.observe(el);
  }
  let mutationIdxShorts = 0;
  async function untranslateOtherShortsOnIntersect(entries) {
    if (mutationIdxShorts % INTERSECTION_UPDATE_STEP_SHORTS === 0) {
      if (!entries) return;
      const intersectElements = [];
      for (const entry of entries) {
        if (entry.isIntersecting) intersectElements.push(entry.target);
      }
      await untranslateOtherShortsVideos(intersectElements);
      updateObserverOtherShortsOnIntersect();
    }
    mutationIdxShorts++;
  }
  function updateObserverOtherShortsOnIntersect() {
    for (const el of allIntersectShortElements ?? []) intersectionObserverOtherShorts.unobserve(el);
    allIntersectShortElements = window.YoutubeAntiTranslate.getAllVisibleNodesOutsideViewport(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.ALL_ARRAYS_SHORTS_SELECTOR), true);
    for (const el of allIntersectShortElements ?? []) intersectionObserverOtherShorts.observe(el);
  }
  async function getOriginalVideoDescription(videoId) {
    var _a, _b;
    const body = {
      context: { client: { clientName: window.YoutubeAntiTranslate.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250527.00.00" } },
      videoId
    };
    const response = await cachedRequest2("https://" + (window.YoutubeAntiTranslate.isMobile() ? "m" : "www") + ".youtube.com/youtubei/v1/player?prettyPrint=false", JSON.stringify(body), await window.YoutubeAntiTranslate.getYoutubeIHeadersWithCredentials(), false, "videoDetails.shortDescription");
    return (response == null ? void 0 : response.cachedWithDotNotation) || ((_b = (_a = response == null ? void 0 : response.data) == null ? void 0 : _a.videoDetails) == null ? void 0 : _b.shortDescription) || null;
  }
  function trimDescriptionByWords(description) {
    if (!description) return "";
    let text = description || "";
    text = text.replace(/\s+/g, " ").trim();
    const MAX_LEN = 128;
    if (text.length <= MAX_LEN) return text;
    const words = text.split(" ");
    let truncated = "";
    const suffix = " ...";
    for (const word of words) {
      const testString = truncated + (truncated ? " " : "") + word;
      truncated = testString;
      if (testString.length + suffix.length > MAX_LEN) break;
    }
    if (truncated.length < text.length) truncated += suffix;
    return truncated;
  }
  function initAntiTranslateTitles() {
    var _a;
    if (!window.YoutubeAntiTranslate) {
      (_a = window.YoutubeAntiTranslate) == null ? void 0 : _a.logError("initAntiTranslateTitles: core not ready");
      return;
    }
    cachedRequest2 = window.YoutubeAntiTranslate.cachedRequest.bind(window.YoutubeAntiTranslate);
    intersectionObserverOtherVideos = new IntersectionObserver(untranslateOtherVideosOnIntersect, {
      root: null,
      rootMargin: window.YoutubeAntiTranslate.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION * 100 + "%",
      threshold: 0
    });
    intersectionObserverOtherShorts = new IntersectionObserver(untranslateOtherShortsOnIntersect, {
      root: null,
      rootMargin: window.YoutubeAntiTranslate.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION * 100 + "%",
      threshold: 0
    });
    const observer = new MutationObserver(window.YoutubeAntiTranslate.debounce(untranslate));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
    updateObserverOtherVideosOnIntersect();
    updateObserverOtherShortsOnIntersect();
  }
  function resetAntiTranslateTitles() {
    if (intersectionObserverOtherVideos) {
      for (const el of allIntersectVideoElements ?? []) intersectionObserverOtherVideos.unobserve(el);
    }
    if (intersectionObserverOtherShorts) {
      for (const el of allIntersectShortElements ?? []) intersectionObserverOtherShorts.unobserve(el);
    }
    allIntersectVideoElements = null;
    allIntersectShortElements = null;
  }
  const ORIGINAL_TRANSLATIONS = [
    "original",
    "оригинал",
    "オリジナル",
    "原始",
    "원본",
    "origineel",
    "original",
    "originale",
    "oryginał",
    "původní",
    "αρχικό",
    "orijinal",
    "原創",
    "gốc",
    "asli",
    "מקורי",
    "أصلي",
    "मूल",
    "मूळ",
    "ਪ੍ਰਮਾਣਿਕ",
    "అసలు",
    "மூலம்",
    "মূল",
    "അസലി",
    "ต้นฉบับ"
  ];
  function getTrackInfo(track) {
    const defaultInfo = { isOriginal: false, language: null, isDubbed: false, isAI: false };
    if (!track || !track.id || typeof track.id !== "string") return defaultInfo;
    const parts = track.id.split(";");
    if (parts.length < 2) return defaultInfo;
    try {
      const decoded = atob(parts[1]);
      const isOriginal = decoded.includes("original");
      const isAI = decoded.includes("dubbed-auto");
      const isDubbed = decoded.includes("dubbed") || isAI;
      const langMatch = decoded.match(/lang..([-a-zA-Z]+)/);
      const language = langMatch ? langMatch[1].toLowerCase() : null;
      return { isOriginal, language, isDubbed, isAI };
    } catch {
      return defaultInfo;
    }
  }
  function isOriginalTrack(track, languageFieldName) {
    if (!track) return false;
    if (languageFieldName && track[languageFieldName] && track[languageFieldName].name) {
      const trackName = track[languageFieldName].name.toLowerCase();
      for (const originalWord of ORIGINAL_TRANSLATIONS) {
        if (trackName.includes(originalWord.toLowerCase())) return true;
      }
    }
    return getTrackInfo(track).isOriginal;
  }
  function getOriginalTrack(tracks) {
    if (!tracks || !Array.isArray(tracks)) return null;
    let languageFieldName = null;
    for (const track of tracks) {
      if (!track || typeof track !== "object") continue;
      for (const [fieldName, field] of Object.entries(track)) {
        if (field && typeof field === "object" && field.name) {
          languageFieldName = fieldName;
          break;
        }
      }
      if (languageFieldName) break;
    }
    if (!languageFieldName) return;
    for (const track of tracks) {
      if (isOriginalTrack(track, languageFieldName)) {
        window.YoutubeAntiTranslate.logInfo(`setting original audio track with id ${track.id}`);
        return track;
      }
    }
    window.YoutubeAntiTranslate.logError(`
    The language you set YouTube to is not yet supported by YoutubeAntiTranslate.
    Please reach out to its authors on GitHub. Listing all audio tracks: ${tracks}
  `);
  }
  async function untranslateAudioTrack() {
    var _a, _b;
    const player = window.YoutubeAntiTranslate.getFirstVisible(
      window.YoutubeAntiTranslate.querySelectorAll(
        window.YoutubeAntiTranslate.getPlayerSelector()
      )
    );
    if (!player || !player["getPlayerResponse"] || typeof player["getPlayerResponse"] !== "function" || !player["getAvailableAudioTracks"] || typeof player["getAvailableAudioTracks"] !== "function" || !player["getAudioTrack"] || typeof player["getAudioTrack"] !== "function" || !player["setAudioTrack"] || typeof player["setAudioTrack"] !== "function") {
      return;
    }
    const playerResponse = await player["getPlayerResponse"]();
    const tracks = await player["getAvailableAudioTracks"]();
    const currentTrack = await player["getAudioTrack"]();
    if (!playerResponse || !tracks || !currentTrack) return;
    if (((_a = await window.YoutubeAntiTranslate.getSettings()) == null ? void 0 : _a.untranslateAudioOnlyAI) && !getTrackInfo(currentTrack).isAI) return;
    const currentVideoId = playerResponse.videoDetails.videoId;
    if (!currentVideoId || player["lastUntranslated"] === `${currentVideoId}+${currentTrack}`) return;
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateAudio", null, null, (_b = playerResponse.videoDetails) == null ? void 0 : _b.channelId)) {
      window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping audio dubbing untranslation");
      return;
    }
    const originalTrack = getOriginalTrack(tracks);
    if (originalTrack) {
      if (`${originalTrack}` === `${currentTrack}`) {
        if (player["lastUntranslated"] !== `${currentVideoId}+${currentTrack}`) player["lastUntranslated"] = `${currentVideoId}+${originalTrack}`;
        return;
      }
      const isAudioTrackSet = await player["setAudioTrack"](originalTrack);
      if (isAudioTrackSet) player["lastUntranslated"] = `${currentVideoId}+${originalTrack}`;
    }
  }
  function initAntiTranslateAudio() {
    if (!window.YoutubeAntiTranslate) return;
    const observer = new MutationObserver(
      window.YoutubeAntiTranslate.debounce(async () => {
        await untranslateAudioTrack();
      })
    );
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }
  const AUTHOR_SELECTOR = "#upload-info.ytd-video-owner-renderer, ytm-slim-owner-renderer div.slim-owner-bylines, div.cbox > a.reel-player-header-channel-endpoint.cbox";
  const ATTRIBUTED_STRING_SELECTOR = "yt-attributed-string";
  const FORMATTED_STRING_SELECTOR = "yt-formatted-string";
  const SNIPPET_TEXT_SELECTOR = "#attributed-snippet-text, #formatted-snippet-text, #plain-snippet-text";
  const HORIZONTAL_CHAPTERS_SELECTOR = "ytd-horizontal-card-list-renderer, ytd-macro-markers-list-renderer, ytm-macro-markers-list-renderer, ytm-horizontal-card-list-renderer";
  const CHAPTER_ITEM_SELECTOR = "ytd-macro-markers-list-item-renderer, ytm-macro-markers-list-item-renderer";
  const CHAPTER_TITLE_SELECTOR = "h4.macro-markers, h4.problem-walkthroughs, .ytm-macro-markers-list-item-title h4";
  const CHAPTER_TIME_SELECTOR = "div#time, p.ytm-macro-markers-list-item-time, p.ytm-macro-markers-list-item-time span";
  const CHAPTER_HEADER_SELECTOR = "ytd-rich-list-header-renderer yt-formatted-string#title, h2#engagement-panel-section-list-header, .ytm-rich-list-header-title";
  const CHAPTER_STYLE = `
.ytp-tooltip.ytp-bottom.ytp-preview .ytp-tooltip-title span[data-original-chapter]::after {
    content: attr(data-original-chapter);
    font-size: 12px !important;
    line-height: normal !important;
    color: inherit;
    font-family: inherit;
    display: inline !important;
}
.ytp-chapter-title-content[data-original-chapter-button] > * {
    display: none !important;
}
.ytp-chapter-title-content[data-original-chapter-button]::after {
    content: attr(title);
    font-size: var(--ytd-tab-system-font-size-body);
    line-height: var(--ytd-tab-system-line-height-body);
    font-family: var(--ytd-tab-system-font-family);
    color: inherit;
}
ytd-macro-markers-list-item-renderer h4[data-original-chapter-title] {
    visibility: hidden !important;
    position: relative;
}
ytd-macro-markers-list-item-renderer h4[data-original-chapter-title]::after {
    content: attr(data-original-chapter-title);
    visibility: visible !important;
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    color: inherit !important;
    font-size: inherit;
    line-height: inherit;
    font-family: inherit;
    font-weight: inherit;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-wrap: break-word;
    hyphens: auto;
}
`;
  let chaptersObserver = null;
  let chapterButtonObservers = [];
  let horizontalChaptersObserver = null;
  let cachedChapters = [];
  let lastDescription = "";
  let cachedChaptersVideoId = null;
  let chaptersInitInProgress = false;
  function getDescriptionNodes(root = document) {
    const context = root || document;
    const resultSet = new Set();
    for (const id of ["description-inline-expander", "description", "collapsed-string", "expanded-string"]) {
      const el = context.getElementById(id);
      if (el) resultSet.add(el);
    }
    for (const cls of ["expandable-video-description-body-main", "expandable-video-description-container"]) {
      const list = context.getElementsByClassName(cls);
      for (let i = 0; i < list.length; i++) resultSet.add(list[i]);
    }
    const anchored = context.getElementById("anchored-panel");
    if (anchored) {
      const list = anchored.getElementsByTagName("ytd-text-inline-expander");
      for (let i = 0; i < list.length; i++) resultSet.add(list[i]);
    }
    return Array.from(resultSet);
  }
  function timeStringToSeconds(timeString) {
    const parts = timeString.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }
  function parseChaptersFromDescription(description) {
    const TIMESTAMP_REGEX = /(\d{1,3}):(\d{2})(?::(\d{2}))?/;
    const TRIM_CHARS_REGEX = /^[–—•·▪▫‣⁃:→>-]+|[–—•·▪▫‣⁃:→>-]+$/g;
    const chapters = [];
    description.split("\n").forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      const tsMatch = line.match(TIMESTAMP_REGEX);
      if (!tsMatch) return;
      const [fullTs, part1, part2, part3] = tsMatch;
      const after = line.slice(tsMatch.index + fullTs.length).trim();
      let hours = 0, minutes = 0, seconds = 0;
      if (part3 !== void 0) {
        hours = parseInt(part1, 10);
        minutes = parseInt(part2, 10);
        seconds = parseInt(part3, 10);
      } else {
        minutes = parseInt(part1, 10);
        seconds = parseInt(part2, 10);
      }
      if (seconds >= 60) return;
      if (part3 !== void 0 && minutes >= 60) return;
      let title = after.length ? after : line.slice(0, tsMatch.index).trim();
      title = title.replace(TRIM_CHARS_REGEX, "").trim();
      if (title.length < 2) return;
      chapters.push({ startTime: hours * 3600 + minutes * 60 + seconds, title });
    });
    return chapters;
  }
  function findChapterByTime(timeInSeconds, chapters) {
    if (chapters.length === 0) return null;
    let targetChapter = chapters[0];
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (timeInSeconds >= chapters[i].startTime) {
        targetChapter = chapters[i];
        break;
      }
    }
    return targetChapter;
  }
  function getCurrentVideoId() {
    return window.YoutubeAntiTranslate.extractVideoIdFromUrl(document.location.href);
  }
  function updateTooltipChapter() {
    var _a;
    if (cachedChapters.length === 0) return;
    const visibleTooltip = window.YoutubeAntiTranslate.querySelector('.ytp-tooltip.ytp-bottom.ytp-preview:not([style*="display: none"])');
    if (!visibleTooltip) return;
    const timeElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(".ytp-tooltip-text, .ytp-tooltip-progress-bar-pill-time-stamp", visibleTooltip));
    const titleElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(".ytp-tooltip-title span, .ytp-tooltip-progress-bar-pill-title", visibleTooltip));
    if (timeElement && titleElement) {
      const timeString = (_a = timeElement.textContent) == null ? void 0 : _a.trim();
      if (timeString) {
        const targetChapter = findChapterByTime(timeStringToSeconds(timeString), cachedChapters);
        if (targetChapter) titleElement.textContent = targetChapter.title;
      }
    }
  }
  function updateStoryboardChapter() {
    var _a;
    if (cachedChapters.length === 0) return;
    const storyboard = window.YoutubeAntiTranslate.querySelector(".ytPlayerStoryboardHost");
    if (!storyboard) return;
    const timeElement = window.YoutubeAntiTranslate.querySelector(".ytPlayerStoryboardTimestamp", storyboard);
    const titleElement = window.YoutubeAntiTranslate.querySelector(".ytPlayerStoryboardTitle " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, storyboard) || window.YoutubeAntiTranslate.querySelector(".ytPlayerStoryboardTitle", storyboard);
    if (!timeElement || !titleElement) return;
    const timeString = (_a = timeElement.textContent) == null ? void 0 : _a.trim();
    if (!timeString) return;
    const targetChapter = findChapterByTime(timeStringToSeconds(timeString), cachedChapters);
    if (targetChapter && titleElement.textContent !== targetChapter.title) titleElement.textContent = targetChapter.title;
  }
  function getCurrentVideoTime() {
    const video = window.YoutubeAntiTranslate.querySelector("#movie_player video") || window.YoutubeAntiTranslate.querySelector("video");
    if (video && "currentTime" in video) return Math.floor(Number(video.currentTime));
    return 0;
  }
  function updateDesktopChapterButton(targetChapter, currentTime) {
    const chapterButton = window.YoutubeAntiTranslate.querySelector(".ytp-chapter-title .ytp-chapter-title-content");
    if (!chapterButton) return;
    let span = window.YoutubeAntiTranslate.querySelector("span[ynt-chapter-span]", chapterButton);
    if (!span) {
      span = document.createElement("span");
      span.setAttribute("ynt-chapter-span", "current");
      span.textContent = chapterButton.textContent;
      chapterButton.textContent = "";
      chapterButton.appendChild(span);
    } else {
      const currentYouTubeText = Array.from(chapterButton.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("");
      if (currentYouTubeText && currentYouTubeText.trim()) {
        span.textContent = currentYouTubeText;
        chapterButton.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) node.textContent = "";
        });
      }
    }
    chapterButton.setAttribute("title", targetChapter.title);
    chapterButton.setAttribute("data-original-chapter-button", targetChapter.title);
  }
  function updateMobileChapterButton(targetChapter, currentTime) {
    const mobileChapterButton = window.YoutubeAntiTranslate.querySelector(".ytwPlayerTimeDisplayChapterButton");
    if (!mobileChapterButton) return;
    const textContainer = window.YoutubeAntiTranslate.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, mobileChapterButton) || mobileChapterButton;
    if (textContainer.textContent !== targetChapter.title) textContainer.textContent = targetChapter.title;
    mobileChapterButton.setAttribute("title", targetChapter.title);
    mobileChapterButton.setAttribute("data-original-chapter-button", targetChapter.title);
  }
  function updateChapterButton() {
    if (cachedChapters.length === 0) return;
    const currentTime = getCurrentVideoTime();
    const targetChapter = findChapterByTime(currentTime, cachedChapters);
    if (!targetChapter) return;
    updateDesktopChapterButton(targetChapter);
    updateMobileChapterButton(targetChapter);
  }
  function setupChapterButtonObserver() {
    const chapterButtons = window.YoutubeAntiTranslate.querySelectorAll(".ytp-chapter-title, .ytwPlayerTimeDisplayChapterButton");
    if (!chapterButtons || chapterButtons.length === 0) return;
    chapterButtonObservers = [];
    chapterButtons.forEach((chapterButton) => {
      const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach((mutation) => {
          var _a, _b;
          if (mutation.type === "childList" || mutation.type === "characterData") {
            const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
            if (((_a = target == null ? void 0 : target.classList) == null ? void 0 : _a.contains("ytp-chapter-title-content")) || (target == null ? void 0 : target.closest(".ytp-chapter-title-content")) || ((_b = target == null ? void 0 : target.classList) == null ? void 0 : _b.contains("ytwPlayerTimeDisplayChapterButton")) || (target == null ? void 0 : target.closest(".ytwPlayerTimeDisplayChapterButton"))) shouldUpdate = true;
          }
        });
        if (shouldUpdate) setTimeout(updateChapterButton, 50);
      });
      observer.observe(chapterButton, { childList: true, subtree: true, characterData: true });
      chapterButtonObservers.push(observer);
    });
    updateChapterButton();
  }
  function cleanupChaptersObserver() {
    if (chaptersObserver) {
      chaptersObserver.disconnect();
      chaptersObserver = null;
    }
    if (chapterButtonObservers.length > 0) {
      chapterButtonObservers.forEach((o) => o.disconnect());
      chapterButtonObservers = [];
    }
    if (horizontalChaptersObserver) {
      horizontalChaptersObserver.disconnect();
      horizontalChaptersObserver = null;
    }
    const style = document.getElementById("ynt-chapters-style");
    if (style) style.remove();
    window.YoutubeAntiTranslate.querySelectorAll("[data-original-chapter]").forEach((el) => el.removeAttribute("data-original-chapter"));
    window.YoutubeAntiTranslate.querySelectorAll("[data-original-chapter-button]").forEach((el) => el.removeAttribute("data-original-chapter-button"));
    window.YoutubeAntiTranslate.querySelectorAll("[data-original-chapter-title]").forEach((el) => el.removeAttribute("data-original-chapter-title"));
    window.YoutubeAntiTranslate.querySelectorAll("[data-original-chapter-header]").forEach((el) => el.removeAttribute("data-original-chapter-header"));
    window.YoutubeAntiTranslate.querySelectorAll("[data-original-show-all]").forEach((el) => el.removeAttribute("data-original-show-all"));
  }
  function setupChapters(originalDescription, videoId = null) {
    const currentVideoId = videoId || getCurrentVideoId();
    if (originalDescription === lastDescription && (!currentVideoId || currentVideoId === cachedChaptersVideoId)) {
      window.YoutubeAntiTranslate.logDebug("Description unchanged, skipping chapters setup");
      return;
    }
    cleanupChaptersObserver();
    if (originalDescription !== lastDescription) {
      cachedChapters = parseChaptersFromDescription(originalDescription);
      lastDescription = originalDescription;
      cachedChaptersVideoId = currentVideoId;
    }
    cachedChapters.sort((a, b) => a.startTime - b.startTime);
    if (cachedChapters.length === 0) {
      window.YoutubeAntiTranslate.logInfo("No chapters found in description");
      return;
    }
    window.YoutubeAntiTranslate.logInfo("Found " + cachedChapters.length + " original chapters");
    GM_addStyle(CHAPTER_STYLE);
    chaptersObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach((mutation) => {
        var _a, _b, _c, _d, _e;
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            var _a2, _b2, _c2, _d2, _e2;
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              if (((_a2 = element.classList) == null ? void 0 : _a2.contains("ytp-tooltip")) && ((_b2 = element.classList) == null ? void 0 : _b2.contains("ytp-preview"))) shouldUpdate = true;
              if (((_c2 = element.classList) == null ? void 0 : _c2.contains("ytPlayerStoryboardHost")) || ((_d2 = element.classList) == null ? void 0 : _d2.contains("ytPlayerStoryboardMetadata")) || ((_e2 = element.classList) == null ? void 0 : _e2.contains("ytPlayerStoryboardTitle"))) shouldUpdate = true;
            }
          });
        }
        if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const target = mutation.target;
          if (((_a = target.classList) == null ? void 0 : _a.contains("ytp-tooltip")) && ((_b = target.classList) == null ? void 0 : _b.contains("ytp-preview")) && (mutation.attributeName === "style" || mutation.attributeName === "class")) shouldUpdate = true;
        }
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement;
          if (((_c = parent == null ? void 0 : parent.classList) == null ? void 0 : _c.contains("ytp-tooltip-text")) || ((_d = parent == null ? void 0 : parent.classList) == null ? void 0 : _d.contains("ytPlayerStoryboardTimestamp")) || ((_e = parent == null ? void 0 : parent.classList) == null ? void 0 : _e.contains("ytPlayerStoryboardTitle"))) shouldUpdate = true;
        }
      });
      if (shouldUpdate) requestAnimationFrame(() => {
        updateTooltipChapter();
        updateStoryboardChapter();
      });
    });
    const player = document.getElementById("movie_player");
    if (player) chaptersObserver.observe(player, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style", "class"] });
    setTimeout(() => {
      updateTooltipChapter();
      updateStoryboardChapter();
    }, 50);
    setupChapterButtonObserver();
    setupHorizontalChaptersObserver();
    window.YoutubeAntiTranslate.logInfo("Optimized chapters replacement initialized with chapter button and horizontal chapters support");
  }
  async function ensureChaptersInitialized() {
    const settings = await window.YoutubeAntiTranslate.getSettings();
    if (!settings.untranslateChapters) return;
    if (cachedChapters.length > 0) {
      const currentVideoId = getCurrentVideoId();
      if (currentVideoId && cachedChaptersVideoId && currentVideoId === cachedChaptersVideoId) {
        updateChapterButton();
        updateHorizontalChapters();
        updateStoryboardChapter();
        return;
      }
      cachedChapters = [];
      lastDescription = "";
      cachedChaptersVideoId = null;
      cleanupChaptersObserver();
    }
    if (chaptersInitInProgress) return;
    chaptersInitInProgress = true;
    try {
      const originalDescriptionData = await fetchOriginalDescription();
      const originalAuthor = fetchOriginalAuthor();
      if (!(originalDescriptionData == null ? void 0 : originalDescriptionData.shortDescription)) return;
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChapters", null, null, null, originalAuthor)) {
        window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video chapters untranslation");
        return;
      }
      setupChapters(originalDescriptionData.shortDescription, originalDescriptionData.videoId);
    } finally {
      chaptersInitInProgress = false;
    }
  }
  async function fetchOriginalDescription() {
    var _a, _b, _c, _d, _e;
    const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()), false);
    const playerResponse = window.YoutubeAntiTranslate.getPlayerResponseSafely(player);
    if (!playerResponse && window.YoutubeAntiTranslate.isMobile()) {
      const mobileDescription = await getDescriptionMobile();
      if (mobileDescription) return mobileDescription;
      return null;
    }
    return {
      shortDescription: ((_a = playerResponse == null ? void 0 : playerResponse["videoDetails"]) == null ? void 0 : _a.shortDescription) || ((_b = playerResponse == null ? void 0 : playerResponse["videoDetails"]) == null ? void 0 : _b.title) || null,
      title: ((_c = playerResponse == null ? void 0 : playerResponse["videoDetails"]) == null ? void 0 : _c.title) || null,
      channelId: ((_d = playerResponse == null ? void 0 : playerResponse["videoDetails"]) == null ? void 0 : _d.channelId) || null,
      videoId: ((_e = playerResponse == null ? void 0 : playerResponse["videoDetails"]) == null ? void 0 : _e.videoId) || getCurrentVideoId() || null
    };
  }
  function fetchOriginalAuthor() {
    var _a;
    const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()), false);
    const playerResponse = window.YoutubeAntiTranslate.getPlayerResponseSafely(player);
    if (!playerResponse && window.YoutubeAntiTranslate.isMobile()) {
      const mobileAuthor = getAuthorMobile();
      if (mobileAuthor) return mobileAuthor;
      return null;
    }
    return ((_a = playerResponse == null ? void 0 : playerResponse["videoDetails"]) == null ? void 0 : _a.author) || null;
  }
  async function restoreOriginalDescriptionAndAuthor() {
    const settings = await window.YoutubeAntiTranslate.getSettings();
    const originalDescriptionData = settings.untranslateDescription || settings.untranslateChapters ? await fetchOriginalDescription() : null;
    const originalAuthor = fetchOriginalAuthor();
    const originalTitle = settings.untranslateChannelBranding ? await getTitle(document.location.href) : null;
    if (!originalDescriptionData && !originalAuthor && !originalTitle) return;
    if (originalDescriptionData.shortDescription) {
      if (settings.untranslateDescription) {
        const descriptionCandidates = getDescriptionNodes();
        const descriptionContainer = descriptionCandidates.find((el) => window.YoutubeAntiTranslate.isVisible(el, true, false, false));
        if (descriptionContainer) {
          if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateDescription", null, null, originalDescriptionData.channelId)) {
            window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video description untranslation");
          } else {
            updateDescriptionContent(descriptionContainer, originalDescriptionData.shortDescription);
          }
        } else {
          window.YoutubeAntiTranslate.logWarning("Video Description container not found");
        }
      }
      if (settings.untranslateChapters) {
        if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChapters", null, null, null, originalAuthor)) {
          window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping video chapters untranslation");
        } else {
          setupChapters(originalDescriptionData.shortDescription, originalDescriptionData.videoId);
        }
      }
    }
    if (settings.untranslateChannelBranding && originalAuthor) await handleAuthor(originalAuthor, originalTitle);
  }
  async function restoreOriginalAuthorOnly() {
    const originalAuthor = fetchOriginalAuthor();
    if (!originalAuthor) return;
    await handleAuthor(originalAuthor);
  }
  async function handleAuthor(originalAuthor, originalTitle = null) {
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, null, null, originalAuthor)) {
      window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping channel branding untranslation");
    } else {
      const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()));
      if (player && player.id === "c4-player") return;
      const authorContainers = window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.querySelectorAll(AUTHOR_SELECTOR));
      if (authorContainers) {
        for (const authorContainer of authorContainers) updateAuthorContent(authorContainer, originalAuthor);
      } else {
        window.YoutubeAntiTranslate.logWarning("Video Author container not found");
      }
    }
    if (originalTitle) {
      const avatarStack = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("#owner #avatar-stack"));
      if (avatarStack) await updateCollaboratorAuthors(avatarStack, originalAuthor);
      else window.YoutubeAntiTranslate.logInfo("Video Avatar Stack container not found");
    }
  }
  function updateDescriptionContent(container, originalText) {
    const mainTextContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(ATTRIBUTED_STRING_SELECTOR + ", " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ", " + FORMATTED_STRING_SELECTOR, container));
    const snippetTextContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(SNIPPET_TEXT_SELECTOR, container));
    if (!mainTextContainer && !snippetTextContainer) {
      window.YoutubeAntiTranslate.logWarning("No video description text containers found");
      return;
    }
    let formattedContent = null;
    const originalTextFirstLine = originalText.split("\n")[0];
    function needsUpdate(textContainer) {
      if (!textContainer || !textContainer.hasChildNodes()) return false;
      if (textContainer.firstChild.hasChildNodes() && textContainer.firstChild.firstChild.textContent === originalTextFirstLine) {
        if (!formattedContent) formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalText);
        return textContainer.firstChild.textContent !== formattedContent.textContent;
      }
      return true;
    }
    const mainNeedsUpdate = mainTextContainer ? !mainTextContainer.closest(SNIPPET_TEXT_SELECTOR) && !mainTextContainer.querySelector("#description-placeholder") && (!window.YoutubeAntiTranslate.isMobile || window.YoutubeAntiTranslate.isDarkTheme() && !mainTextContainer.querySelector('[style="color: rgb(170, 170, 170);"]') || !window.YoutubeAntiTranslate.isDarkTheme() && !mainTextContainer.querySelector('[style="color: rgb(96, 96, 96);"]')) && needsUpdate(mainTextContainer) : false;
    const snippetNeedsUpdate = snippetTextContainer ? needsUpdate(snippetTextContainer) : false;
    if (!mainNeedsUpdate && !snippetNeedsUpdate) return;
    if (!formattedContent) formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalText);
    if (mainNeedsUpdate && mainTextContainer) window.YoutubeAntiTranslate.replaceContainerContent(mainTextContainer, formattedContent.cloneNode(true));
    if (snippetNeedsUpdate && snippetTextContainer) window.YoutubeAntiTranslate.replaceContainerContent(snippetTextContainer, formattedContent.cloneNode(true));
  }
  function updateAuthorContent(container, originalText) {
    const singularChannelNameTitleContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("#channel-name " + FORMATTED_STRING_SELECTOR, container));
    const singularChannelNameTextContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("#channel-name " + FORMATTED_STRING_SELECTOR + " a, #channel-name " + ATTRIBUTED_STRING_SELECTOR + ", #channel-name " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ", .slim-owner-channel-name > " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ", .reel-player-header-channel-title > " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, container));
    const multipleChannelNameContainers = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("#attributed-channel-name " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + " " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR, container));
    if (!singularChannelNameTitleContainer && !singularChannelNameTextContainer && !multipleChannelNameContainers) {
      window.YoutubeAntiTranslate.logInfo("No video author text containers found");
      return;
    }
    if (singularChannelNameTitleContainer && singularChannelNameTitleContainer.getAttribute("title") !== originalText) singularChannelNameTitleContainer.setAttribute("title", originalText);
    if (singularChannelNameTextContainer && singularChannelNameTextContainer.textContent !== originalText) {
      const storeStyleDisplay = singularChannelNameTextContainer.parentElement.style.display;
      singularChannelNameTextContainer.parentElement.style.display = "none";
      singularChannelNameTextContainer.textContent = originalText;
      setTimeout(() => {
        singularChannelNameTextContainer.parentElement.style.display = storeStyleDisplay;
      }, 50);
    }
    if (multipleChannelNameContainers) {
      const textNodes = Array.from(multipleChannelNameContainers.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
      const firstSpan = window.YoutubeAntiTranslate.querySelector("span[class='']", multipleChannelNameContainers);
      let firstSpanTextNodes;
      if (firstSpan) firstSpanTextNodes = Array.from(firstSpan.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
      if (!textNodes && !firstSpanTextNodes) return;
      if (textNodes && textNodes.length < 2 && firstSpanTextNodes && firstSpanTextNodes.length < 2) {
        window.YoutubeAntiTranslate.logDebug("Not enough text nodes found for this type of updateAuthorContent");
        return;
      }
      let firstTextNode;
      if (textNodes && textNodes.length >= 2) firstTextNode = window.YoutubeAntiTranslate.getFirstTextNode(multipleChannelNameContainers);
      else if (firstSpanTextNodes && firstSpanTextNodes.length >= 2) firstTextNode = window.YoutubeAntiTranslate.getFirstTextNode(firstSpan);
      if (firstTextNode && firstTextNode.textContent !== originalText) firstTextNode.textContent = originalText;
    }
  }
  async function updateCollaboratorAuthors(avatarStack, originalAuthor) {
    const avatarStackImages = window.YoutubeAntiTranslate.querySelectorAll("yt-avatar-shape img", avatarStack);
    const authors = [];
    if (avatarStackImages && avatarStackImages.length > 1) {
      for (const avatarImage of avatarStackImages) {
        const imgSrc = avatarImage.src;
        if (!imgSrc || imgSrc.trim() === "") continue;
        const originalDescriptionData = await fetchOriginalDescription();
        const originalCollaborators = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(originalAuthor + " " + originalDescriptionData.title);
        const originalItem = originalCollaborators == null ? void 0 : originalCollaborators.find((item) => item.avatarImage === avatarImage.src);
        if (!originalItem) continue;
        authors.push(originalItem.name);
      }
      if (authors.length > 0) {
        const collaboratorAuthorsOnly = authors.filter((name) => name !== originalAuthor);
        if (collaboratorAuthorsOnly && collaboratorAuthorsOnly.length === 1) {
          if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, null, null, collaboratorAuthorsOnly[0])) {
            return;
          }
          const multipleChannelNameContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll("#attributed-channel-name " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + " " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR, avatarStack.closest("#owner")));
          const localizedAnd = window.YoutubeAntiTranslate.getLocalizedAnd(document.documentElement.lang);
          const textNodes = Array.from(multipleChannelNameContainer.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
          const firstSpan = window.YoutubeAntiTranslate.querySelector("span[class='']", multipleChannelNameContainer);
          let firstSpanTextNodes;
          if (firstSpan) firstSpanTextNodes = Array.from(firstSpan.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
          if (!textNodes && !firstSpanTextNodes) return;
          let includeMainAuthor = false;
          if (textNodes && textNodes.length < 2 && firstSpanTextNodes && firstSpanTextNodes.length < 2) includeMainAuthor = true;
          const untranslatedCollaboratorText = (includeMainAuthor ? originalAuthor + " " : "") + localizedAnd + " " + collaboratorAuthorsOnly[0];
          if (textNodes && textNodes.length >= 2 && multipleChannelNameContainer && !multipleChannelNameContainer.textContent.includes(untranslatedCollaboratorText)) replaceTextNodeContent(multipleChannelNameContainer, includeMainAuthor ? 0 : 1, untranslatedCollaboratorText);
          else if (firstSpanTextNodes && firstSpanTextNodes.length >= 2 && firstSpan && !firstSpan.textContent.includes(untranslatedCollaboratorText)) replaceTextNodeContent(firstSpan, includeMainAuthor ? 0 : 1, untranslatedCollaboratorText);
        }
      }
    }
  }
  function replaceTextNodeContent(container, textNodeIndex, newText) {
    const textNodes = Array.from(container.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
    if (textNodes.length > textNodeIndex) {
      const targetTextNode = textNodes[textNodeIndex];
      if (targetTextNode.textContent !== newText) targetTextNode.textContent = newText;
    }
  }
  async function handleDescriptionMutation(mutations) {
    const settings = await window.YoutubeAntiTranslate.getSettings();
    if (!settings.untranslateDescription && !settings.untranslateChapters && !settings.untranslateChannelBranding) return;
    const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()), false);
    const allMutationsAreInPlayer = player && mutations && mutations.every((e) => player.contains(e.target));
    if (allMutationsAreInPlayer) {
      if (settings.untranslateChapters) await ensureChaptersInitialized();
      return;
    }
    if (settings.untranslateDescription || settings.untranslateChapters || settings.untranslateChannelBranding) {
      const descriptionElement = getDescriptionNodes().find((el) => window.YoutubeAntiTranslate.isVisible(el, true, false, false));
      if (descriptionElement && player) await restoreOriginalDescriptionAndAuthor();
    }
    if (settings.untranslateChapters) await ensureChaptersInitialized();
    if (window.YoutubeAntiTranslate.isMobile() && settings.untranslateChannelBranding) {
      const authorElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(AUTHOR_SELECTOR));
      if (authorElement && player) restoreOriginalAuthorOnly();
    }
  }
  function updateHorizontalChapters() {
    const horizontalChapters = window.YoutubeAntiTranslate.querySelectorAll(HORIZONTAL_CHAPTERS_SELECTOR);
    horizontalChapters.forEach((container) => {
      const chapterItems = window.YoutubeAntiTranslate.querySelectorAll(CHAPTER_ITEM_SELECTOR, container);
      chapterItems.forEach((item) => {
        var _a, _b;
        const isMobileChapterItem = ((_a = item.tagName) == null ? void 0 : _a.toLowerCase().startsWith("ytm-")) || item.closest("ytm-macro-markers-list-renderer");
        const timeElement = window.YoutubeAntiTranslate.querySelector(CHAPTER_TIME_SELECTOR, item);
        const titleElements = window.YoutubeAntiTranslate.querySelectorAll(CHAPTER_TITLE_SELECTOR, item);
        if (!timeElement || titleElements.length === 0) return;
        const timeString = (_b = timeElement.textContent) == null ? void 0 : _b.trim();
        if (!timeString) return;
        const timeInSeconds = timeStringToSeconds(timeString);
        const targetChapter = findChapterByTime(timeInSeconds, cachedChapters);
        if (targetChapter) {
          titleElements.forEach((titleElement) => {
            if (isMobileChapterItem) {
              const mobileTitleContainer = window.YoutubeAntiTranslate.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, titleElement) || titleElement;
              if (mobileTitleContainer.textContent !== targetChapter.title) mobileTitleContainer.textContent = targetChapter.title;
              titleElement.setAttribute("title", targetChapter.title);
              return;
            }
            const currentOriginalTitle = titleElement.getAttribute("data-original-chapter-title");
            if (currentOriginalTitle !== targetChapter.title) {
              titleElement.setAttribute("data-original-chapter-title", targetChapter.title);
              titleElement.setAttribute("title", targetChapter.title);
            }
          });
        }
      });
    });
  }
  function setupHorizontalChaptersObserver() {
    horizontalChaptersObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach((mutation) => {
        var _a, _b;
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            var _a2, _b2;
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              if (((_a2 = element.matches) == null ? void 0 : _a2.call(element, HORIZONTAL_CHAPTERS_SELECTOR)) || ((_b2 = element.querySelector) == null ? void 0 : _b2.call(element, HORIZONTAL_CHAPTERS_SELECTOR))) shouldUpdate = true;
            }
          });
        }
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement;
          if (((_a = parent == null ? void 0 : parent.matches) == null ? void 0 : _a.call(parent, CHAPTER_TITLE_SELECTOR)) || ((_b = parent == null ? void 0 : parent.matches) == null ? void 0 : _b.call(parent, CHAPTER_HEADER_SELECTOR))) shouldUpdate = true;
        }
      });
      if (shouldUpdate) setTimeout(() => {
        updateHorizontalChapters();
      }, 100);
    });
    horizontalChaptersObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style", "class"] });
    updateHorizontalChapters();
  }
  function extractVideoDataField(fieldName) {
    var _a, _b;
    try {
      let search2 = function(obj, depth = 0) {
        if (!obj || typeof obj !== "object" || depth > 20 || visited.has(obj)) return null;
        visited.add(obj);
        if (obj.videoData && typeof obj.videoData[fieldName] === "string") {
          const videoId = obj.videoData.videoId;
          const currentVideoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(document.location.href);
          if (videoId && typeof videoId === "string" && videoId !== currentVideoId) {
          } else {
            return obj.videoData[fieldName];
          }
        }
        const children = Array.isArray(obj) ? obj : Object.values(obj);
        for (const child of children) {
          const res = search2(child, depth + 1);
          if (res) return res;
        }
        return null;
      };
      var search = search2;
      const pubsub = window["ytPubsubPubsubInstance"];
      if (!pubsub) return null;
      const visited = new WeakSet();
      return search2(pubsub);
    } catch (err) {
      (_b = (_a = window.YoutubeAntiTranslate) == null ? void 0 : _a.logDebug) == null ? void 0 : _b.call(_a, "extractVideoDataField(" + fieldName + ") failed", err);
      return null;
    }
  }
  async function getTitle(url) {
    var _a, _b, _c, _d;
    const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(url);
    if (!videoId) return null;
    let response = await window.YoutubeAntiTranslate.cachedRequest("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId);
    if (!response || !response.response || !response.response.ok || !((_a = response.data) == null ? void 0 : _a.title)) {
      if (((_b = response == null ? void 0 : response.response) == null ? void 0 : _b.status) === 401) {
        response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
        if (!((_c = response == null ? void 0 : response.response) == null ? void 0 : _c.ok) || !((_d = response.data) == null ? void 0 : _d.title)) {
          window.YoutubeAntiTranslate.logWarning("YoutubeI title request failed for video " + videoId);
          return;
        }
      } else {
        return;
      }
    }
    return response.data.title;
  }
  async function getDescriptionMobile() {
    return {
      shortDescription: extractVideoDataField("shortDescription") || await getTitle(document.location.href),
      title: await getTitle(document.location.href) || null,
      channelId: extractVideoDataField("channelId") || null,
      videoId: getCurrentVideoId() || null
    };
  }
  function getAuthorMobile() {
    return extractVideoDataField("author");
  }
  function _timecodeClickHandler(event) {
    const link = event.target.closest(".yt-timecode-link");
    if (!link) return;
    event.preventDefault();
    const seconds = parseInt(link.getAttribute("data-seconds"), 10);
    if (isNaN(seconds)) return;
    const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()));
    if (player && typeof player["seekTo"] === "function") {
      try {
        player["seekTo"](seconds, true);
      } catch (error) {
        window.YoutubeAntiTranslate.logWarning("Error seeking to timestamp:", error);
      }
    } else {
      window.YoutubeAntiTranslate.logInfo("Player not found or seekTo not available");
    }
  }
  function initAntiTranslateDescription() {
    if (!window.YoutubeAntiTranslate) return;
    GM_addStyle(CHAPTER_STYLE);
    document.addEventListener("click", _timecodeClickHandler);
    const observer = new MutationObserver(window.YoutubeAntiTranslate.debounce(handleDescriptionMutation));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
    setupHorizontalChaptersObserver();
  }
  async function fetchOriginalTitle(videoId) {
    var _a, _b, _c, _d;
    const cacheKey = `ytat_oembed_${videoId}`;
    const cached = window.YoutubeAntiTranslate.getSessionCache(cacheKey);
    if (cached) return { originalTitle: cached };
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`;
    try {
      let response = await window.YoutubeAntiTranslate.cachedRequest(oembedUrl);
      if (!response || !response.response || !response.response.ok || !((_a = response.data) == null ? void 0 : _a.thumbnail_url)) {
        if (((_b = response == null ? void 0 : response.response) == null ? void 0 : _b.status) === 401) {
          response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
          if (!((_c = response == null ? void 0 : response.response) == null ? void 0 : _c.ok) || !((_d = response.data) == null ? void 0 : _d.title)) {
            window.YoutubeAntiTranslate.logWarning(`YoutubeI title request failed for video ${videoId}`);
            return;
          }
        }
      }
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateTitle", null, response.data.author_url)) {
        window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping notification titles untranslation");
        return { originalTitle: null };
      }
      return { originalTitle: response.data.title };
    } catch (err) {
      window.YoutubeAntiTranslate.logWarning(`oEmbed fetch error for video ${videoId}:`, err);
      window.YoutubeAntiTranslate.setSessionCache(cacheKey, null);
      return { originalTitle: null };
    }
  }
  let notificationMutationObserver = null;
  function setupNotificationTitlesObserver() {
    cleanupNotificationTitlesObserver();
    const dropdown = window.YoutubeAntiTranslate.getFirstVisible(
      window.YoutubeAntiTranslate.querySelectorAll(
        'ytd-popup-container tp-yt-iron-dropdown[vertical-align="top"]'
      )
    );
    if (!dropdown) return;
    refreshNotificationTitles();
    const contentWrapper = dropdown.querySelector("#contentWrapper");
    if (!contentWrapper) return;
    notificationMutationObserver = new MutationObserver(
      window.YoutubeAntiTranslate.debounce(() => {
        refreshNotificationTitles();
      })
    );
    notificationMutationObserver.observe(contentWrapper, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }
  function cleanupNotificationTitlesObserver() {
    if (notificationMutationObserver) {
      notificationMutationObserver.disconnect();
      notificationMutationObserver = null;
    }
  }
  function replaceVideoTitleInNotification(message, originalTitle) {
    if (!message) return originalTitle;
    let endIdx = message.lastIndexOf('"');
    if (endIdx !== -1) {
      const startIdx = message.lastIndexOf('"', endIdx - 1);
      if (startIdx !== -1) return message.slice(0, startIdx + 1) + originalTitle + message.slice(endIdx);
    }
    endIdx = message.lastIndexOf("»");
    if (endIdx !== -1) {
      const startIdx = message.lastIndexOf("«", endIdx - 1);
      if (startIdx !== -1) return message.slice(0, startIdx + 1) + originalTitle + message.slice(endIdx);
    }
    const colonIdx = message.indexOf(":");
    if (colonIdx !== -1) return message.slice(0, colonIdx + 1) + " " + originalTitle;
    return originalTitle;
  }
  async function refreshNotificationTitles() {
    const notificationTitleElements = window.YoutubeAntiTranslate.querySelectorAll(".ytd-notification-renderer .message");
    for (const titleElement of notificationTitleElements) {
      const anchor = titleElement.closest("a");
      if (!anchor) continue;
      const href = anchor.getAttribute("href");
      if (!href) continue;
      const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(
        href.startsWith("http") ? href : window.location.origin + href
      );
      if (!videoId) continue;
      const currentTitle = titleElement.textContent;
      const titleFetchResult = await fetchOriginalTitle(videoId);
      const originalTitle = titleFetchResult.originalTitle;
      if (!originalTitle) continue;
      if (originalTitle && !window.YoutubeAntiTranslate.doesStringInclude(currentTitle, originalTitle)) {
        const replaced = replaceVideoTitleInNotification(currentTitle, originalTitle);
        titleElement.textContent = replaced;
        window.YoutubeAntiTranslate.logInfo(`Updated notification title for video ${videoId}`, { before: currentTitle, after: replaced });
      }
    }
  }
  function initAntiTranslateNotifications() {
    if (!window.YoutubeAntiTranslate) return;
    const notificationDropdownObserver = new MutationObserver(
      window.YoutubeAntiTranslate.debounce(() => {
        const dropdownExists = window.YoutubeAntiTranslate.querySelector(
          'ytd-popup-container tp-yt-iron-dropdown[vertical-align="top"]'
        );
        if (dropdownExists) {
          setupNotificationTitlesObserver();
        } else {
          cleanupNotificationTitlesObserver();
        }
      })
    );
    if (document.body) {
      notificationDropdownObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    }
  }
  const RETRY_DELAY_MS = 150;
  const MAX_RETRIES = 12;
  function sameLang(code1, code2) {
    return (code1 ? code1.split("-")[0] : "") === (code2 ? code2.split("-")[0] : "");
  }
  function turnOffCaptions(player, reason) {
    if (reason) window.YoutubeAntiTranslate.logInfo(reason);
    player.setOption("captions", "track", {});
  }
  async function setSubtitles(attempt = 0) {
    var _a, _b;
    if (!window.YoutubeAntiTranslate.getSettings) {
      if (attempt < MAX_RETRIES) setTimeout(() => setSubtitles(attempt + 1), RETRY_DELAY_MS);
      return;
    }
    const settings = await window.YoutubeAntiTranslate.getSettings();
    if (!settings || settings.subtitlesEnabled !== true) return;
    const player = window.YoutubeAntiTranslate.getCachedPlayer();
    if (!player || typeof player.setOption !== "function") {
      if (attempt < MAX_RETRIES) setTimeout(() => setSubtitles(attempt + 1), RETRY_DELAY_MS);
      return;
    }
    const response = window.YoutubeAntiTranslate.getPlayerResponseSafely(player);
    const tracks = (_b = (_a = response == null ? void 0 : response.captions) == null ? void 0 : _a.playerCaptionsTracklistRenderer) == null ? void 0 : _b.captionTracks;
    if (!tracks) {
      if (attempt < MAX_RETRIES) setTimeout(() => setSubtitles(attempt + 1), RETRY_DELAY_MS);
      return;
    }
    const subtitlesLanguage = (settings.subtitlesLanguage || "original").toString().trim();
    if (subtitlesLanguage === "disabled") {
      turnOffCaptions(player, "Subtitles disabled.");
      return;
    }
    if (subtitlesLanguage === "original") {
      const asrTrack = tracks.find((track) => track.kind === "asr");
      if (!asrTrack) {
        turnOffCaptions(player, "Cannot determine original language (no ASR track).");
        return;
      }
      const originalTrack = tracks.find(
        (track) => sameLang(track.languageCode, asrTrack.languageCode) && !track.kind
      );
      if (originalTrack) {
        window.YoutubeAntiTranslate.logInfo(
          `Setting subtitles to original language: "${originalTrack.name.simpleText}" [${originalTrack.languageCode}]`
        );
        player.setOption("captions", "track", originalTrack);
        return;
      }
      turnOffCaptions(player, "No manual subtitles in original language.");
      return;
    }
    const languageTrack = tracks.find(
      (track) => sameLang(track.languageCode, subtitlesLanguage) && !track.kind
    );
    if (languageTrack) {
      window.YoutubeAntiTranslate.logInfo(
        `Setting subtitles to selected language: "${languageTrack.name.simpleText}" [${languageTrack.languageCode}]`
      );
      player.setOption("captions", "track", languageTrack);
      return;
    }
    turnOffCaptions(player, `Selected language "${subtitlesLanguage}" not available.`);
  }
  function initAntiTranslateSubtitles() {
    setSubtitles(0);
  }
  const CHANNELBRANDING_HEADER_SELECTOR = "#page-header-container #page-header .page-header-view-model-wiz__page-header-headline-info, .page-header-view-model-wiz__page-header-headline-info, .page-header-view-model__page-header-headline-info, .yt-page-header-view-model__page-header-headline-info, .ytPageHeaderViewModelHeadlineInfo, .ytPageHeaderViewModelHeadline, #page-header";
  const CHANNELBRANDING_ABOUT_SELECTOR = "ytd-engagement-panel-section-list-renderer, ytm-engagement-panel-section-list-renderer";
  const CHANNEL_LOCATION_REGEXES = [
    /:\/\/(?:www\.|m\.)?youtube\.com\/channel\//,
    /:\/\/(?:www\.|m\.)?youtube\.com\/c\//,
    /:\/\/(?:www\.|m\.)?youtube\.com\/@/,
    /:\/\/(?:www\.|m\.)?youtube\.com\/user\//
  ];
  function getChannelFilter() {
    if (window.location.pathname.startsWith("/channel/")) {
      const match = window.location.pathname.match(/\/channel\/([^/?]+)/);
      return match ? `id=${match[1]}` : null;
    }
    if (window.location.pathname.startsWith("/c/")) {
      const match = window.location.pathname.match(/\/c\/([^/?]+)/);
      return match ? `forHandle=${match[1]}` : null;
    } else if (window.location.pathname.startsWith("/@")) {
      const match = window.location.pathname.match(/\/(@[^/?]+)/);
      return match ? `forHandle=${match[1]}` : null;
    } else if (window.location.pathname.startsWith("/user/")) {
      const match = window.location.pathname.match(/\/user\/([^/?]+)/);
      return match ? `forUsername=${match[1]}` : null;
    }
  }
  async function getChannelBrandingWithYoutubeDataAPI() {
    const channelFilter = getChannelFilter();
    if (!channelFilter) {
      window.YoutubeAntiTranslate.logInfo("Channel ID not found");
      return null;
    }
    window.YoutubeAntiTranslate.logInfo("Missing YOUTUBE_API_KEY is not set — skipping Data API");
    return null;
  }
  async function restoreOriginalBrandingHeader() {
    if (window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(CHANNELBRANDING_HEADER_SELECTOR))) {
      let originalBrandingData = await getChannelBrandingWithYoutubeDataAPI();
      if (!originalBrandingData) {
        originalBrandingData = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI();
      }
      if (!originalBrandingData) {
        window.YoutubeAntiTranslate.logWarning("No original branding data found");
      } else if (!originalBrandingData.title && !originalBrandingData.description) {
        window.YoutubeAntiTranslate.logWarning("No original branding data found for title and description");
      } else {
        const brandingHeaderContainer = window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(CHANNELBRANDING_HEADER_SELECTOR));
        if (brandingHeaderContainer) {
          updateBrandingHeaderTitleContent(brandingHeaderContainer, originalBrandingData);
          updateBrandingHeaderDescriptionContent(brandingHeaderContainer, originalBrandingData);
        } else {
          window.YoutubeAntiTranslate.logWarning("Channel Branding Header container not found");
        }
      }
    }
  }
  function updateBrandingHeaderTitleContent(container, originalBrandingData) {
    if (originalBrandingData["title"]) {
      const titleTextContainer = container.querySelector(`h1 ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
      if (!titleTextContainer) {
        window.YoutubeAntiTranslate.logInfo("No branding header title text containers found");
      } else {
        const cachedOldTitle = window.YoutubeAntiTranslate.getSessionCache(`pageTitle_${document.location.href}`);
        if (cachedOldTitle && document.title.includes(cachedOldTitle)) {
          const normalizedDocumentTitle = window.YoutubeAntiTranslate.normalizeSpaces(document.title);
          const normalizedOldTitle = window.YoutubeAntiTranslate.normalizeSpaces(cachedOldTitle);
          const normalizeRealTitle = window.YoutubeAntiTranslate.normalizeSpaces(originalBrandingData["title"]);
          const realDocumentTitle = normalizedDocumentTitle.replace(normalizedOldTitle, normalizeRealTitle);
          if (normalizedDocumentTitle !== realDocumentTitle) document.title = realDocumentTitle;
        }
        if (titleTextContainer.textContent !== originalBrandingData["title"]) {
          window.YoutubeAntiTranslate.setSessionCache(`pageTitle_${document.location.href}`, titleTextContainer.textContent);
          window.YoutubeAntiTranslate.replaceTextOnly(titleTextContainer, originalBrandingData["title"]);
        }
      }
    }
  }
  function updateBrandingHeaderDescriptionContent(container, originalBrandingData) {
    var _a;
    if (originalBrandingData["description"]) {
      const selector = `yt-description-preview-view-model .yt-truncated-text__truncated-text-content > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1),
    yt-description-preview-view-model .truncated-text-wiz__truncated-text-content > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1),
    yt-description-preview-view-model truncated-text.ytTruncatedTextHost truncated-text-content.ytTruncatedTextTruncatedTextContent:not(.ytTruncatedTextHiddenTextContent) > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1)`;
      let descriptionTextContainer = container.querySelector(selector);
      if (!descriptionTextContainer) descriptionTextContainer = window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(selector));
      if (!descriptionTextContainer) {
        window.YoutubeAntiTranslate.logInfo("No branding header description text containers found");
      } else {
        const truncatedDescription = originalBrandingData["truncatedDescription"] || originalBrandingData["description"].split("\n")[0];
        if (((_a = descriptionTextContainer.textContent) == null ? void 0 : _a.trim()) !== (truncatedDescription == null ? void 0 : truncatedDescription.trim())) {
          const storeStyleDisplay = descriptionTextContainer.parentElement.style.display;
          descriptionTextContainer.parentElement.style.display = "none";
          window.YoutubeAntiTranslate.replaceTextOnly(descriptionTextContainer, truncatedDescription);
          setTimeout(() => {
            descriptionTextContainer.parentElement.style.display = storeStyleDisplay;
          }, 50);
        }
      }
    }
  }
  async function restoreOriginalBrandingAbout() {
    if (window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(CHANNELBRANDING_ABOUT_SELECTOR))) {
      let originalBrandingData = await getChannelBrandingWithYoutubeDataAPI();
      if (!originalBrandingData) originalBrandingData = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI();
      if (!originalBrandingData) {
        window.YoutubeAntiTranslate.logWarning("No original branding data found");
      } else if (!originalBrandingData.title && !originalBrandingData.description) {
        window.YoutubeAntiTranslate.logWarning("No original branding data found for title and description");
      } else {
        const aboutContainer = window.YoutubeAntiTranslate.getAllVisibleNodes(document.querySelectorAll(CHANNELBRANDING_ABOUT_SELECTOR));
        if (aboutContainer && aboutContainer.length > 0) {
          aboutContainer.forEach((element) => {
            updateBrandingAboutDescriptionContent(element, originalBrandingData);
            updateBrandingAboutTitleContent(element, originalBrandingData);
          });
        } else {
          window.YoutubeAntiTranslate.logInfo("Channel About container not found");
        }
      }
    }
  }
  function updateBrandingAboutTitleContent(container, originalBrandingData) {
    if (!originalBrandingData["title"]) return;
    let titleTextContainer = container.querySelector("#title-text");
    if (!titleTextContainer) titleTextContainer = container.querySelector(`.engagement-panel-section-list-header-title span${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
    if (!titleTextContainer) {
      window.YoutubeAntiTranslate.logInfo("No branding about title text containers found");
      return;
    }
    if (titleTextContainer.textContent !== originalBrandingData["title"]) window.YoutubeAntiTranslate.replaceTextOnly(titleTextContainer, originalBrandingData["title"]);
  }
  function updateBrandingAboutDescriptionContent(container, originalBrandingData) {
    var _a;
    if (!originalBrandingData["description"]) return;
    let descriptionTextContainer = container.querySelector(`#description-container > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1), #description-container ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
    if (!descriptionTextContainer) descriptionTextContainer = container.querySelector(`.user-text > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
    if (!descriptionTextContainer) {
      window.YoutubeAntiTranslate.logInfo("No branding about description text containers found");
      return;
    }
    let formattedContent;
    const originalTextFirstLine = originalBrandingData["truncatedDescription"] || originalBrandingData["description"].split("\n")[0];
    if (descriptionTextContainer.hasChildNodes() && descriptionTextContainer.firstChild && ((_a = (descriptionTextContainer.firstChild.firstChild || descriptionTextContainer.firstChild).textContent) == null ? void 0 : _a.trim()) === (originalTextFirstLine == null ? void 0 : originalTextFirstLine.trim())) {
      formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalBrandingData["description"]);
      if (descriptionTextContainer.hasChildNodes() && descriptionTextContainer.firstChild.textContent !== formattedContent.textContent) window.YoutubeAntiTranslate.replaceContainerContent(descriptionTextContainer, formattedContent.cloneNode(true));
    } else {
      formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalBrandingData["description"]);
      window.YoutubeAntiTranslate.replaceContainerContent(descriptionTextContainer, formattedContent.cloneNode(true));
    }
  }
  async function untranslateBranding() {
    const url = document.location.href;
    const isChannelPage = CHANNEL_LOCATION_REGEXES.some((regex) => regex.test(url));
    if (isChannelPage) {
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, document.location.href)) {
        window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping channel branding untranslation");
      } else {
        await Promise.all([
          restoreOriginalBrandingHeader(),
          restoreOriginalBrandingAbout(),
          restoreCollaboratorsDialog(),
          restoreOriginalBrandingChannelRenderers()
        ]);
      }
    } else {
      await Promise.all([restoreOriginalBrandingChannelRenderers(), restoreCollaboratorsDialog()]);
    }
  }
  function updateChannelRendererDescriptionContent(container, originalBrandingData) {
    var _a;
    if (!(originalBrandingData == null ? void 0 : originalBrandingData.description)) return;
    const descriptionTextContainer = container.querySelector("#info yt-formatted-string#description, yt-formatted-string#description, #description");
    if (!descriptionTextContainer) {
      window.YoutubeAntiTranslate.logDebug("No search result description container found");
      return;
    }
    const truncatedDescription = originalBrandingData.description;
    if (((_a = descriptionTextContainer.textContent) == null ? void 0 : _a.trim()) !== (truncatedDescription == null ? void 0 : truncatedDescription.trim())) descriptionTextContainer.textContent = truncatedDescription;
  }
  function updateChannelRendererAuthor(container, originalBrandingData) {
    if (!(originalBrandingData == null ? void 0 : originalBrandingData.title)) return;
    const authorTextContainer = container.querySelector(
      "#info ytd-channel-name#channel-title #text, #channel-title yt-formatted-string#text, #channel-title yt-formatted-string, #channel-info #title, #endpoint yt-formatted-string.title, h4.compact-media-item-headline > " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ", h4.YtmCompactMediaItemHeadline > " + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR
    );
    if (!authorTextContainer) {
      window.YoutubeAntiTranslate.logDebug("No search result channel author container found");
      return;
    }
    if (authorTextContainer.textContent !== originalBrandingData.title) authorTextContainer.textContent = originalBrandingData.title;
  }
  async function restoreOriginalBrandingChannelRenderers() {
    const channelRenderers = window.YoutubeAntiTranslate.getAllVisibleNodes(
      document.querySelectorAll("ytd-channel-renderer, ytd-grid-channel-renderer, ytm-compact-channel-renderer, ytd-guide-entry-renderer"),
      false,
      20
    );
    if (!channelRenderers || channelRenderers.length === 0) return;
    const tasks = channelRenderers.map(async (renderer) => {
      const linkElement = renderer.querySelector("a.channel-link") || renderer.querySelector("a#main-link") || renderer.querySelector("a.compact-media-item-image") || renderer.querySelector("a#channel-info") || renderer.querySelector("a.YtmCompactMediaItemImage") || renderer.querySelector("a.compact-media-item-metadata-content") || renderer.querySelector("a.YtmCompactMediaItemMetadataContent") || renderer.querySelector('a[href*="/channel/"]') || renderer.querySelector('a[href*="/c/"]') || renderer.querySelector('a[href*="/@"]') || renderer.querySelector('a[href*="/user/"]');
      if (!linkElement) return;
      const href = linkElement.getAttribute("href");
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, href)) {
        window.YoutubeAntiTranslate.logInfo("Channel is whitelisted, skipping channel branding untranslation");
        return;
      }
      const ucid = await window.YoutubeAntiTranslate.getChannelUCIDFromHref(href);
      if (!ucid) return;
      const originalBrandingData = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI(ucid);
      if (!originalBrandingData) return;
      updateChannelRendererDescriptionContent(renderer, originalBrandingData);
      updateChannelRendererAuthor(renderer, originalBrandingData);
    });
    await Promise.allSettled(tasks);
  }
  async function restoreCollaboratorsDialog() {
    const dialog = window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll("yt-dialog-view-model"));
    if (!dialog) return;
    const listItems = dialog.querySelectorAll("yt-list-item-view-model .yt-list-item-view-model__label");
    if (!listItems || listItems.length === 0) return;
    const tasks = Array.from(listItems).map(async (item) => {
      var _a, _b;
      if (item.getAttribute("data-ytat-collab-untranslated") === document.location.href) return;
      let linkEl = item.querySelector(`.yt-list-item-view-model__text-wrapper ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR}`) || item.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR);
      if (!linkEl) {
        const channelInfoEl = item.querySelector(`.yt-list-item-view-model__text-wrapper > span${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
        const channelNameEl = item.querySelector(`.yt-list-item-view-model__title-wrapper ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR} > span > span`);
        if (channelInfoEl) {
          const handleMatch = channelInfoEl.textContent.match(/^[ -ₙ]{0,3}(@[^  -ₙ]+)/);
          if (handleMatch) {
            const handle = handleMatch[1];
            const href2 = `https://www.youtube.com/${handle.trim()}`;
            if (channelNameEl) {
              channelNameEl.setAttribute("href", href2);
              linkEl = channelNameEl;
            } else {
              const a = document.createElement("a");
              a.href = href2;
              linkEl = a;
            }
          }
        }
        if (!linkEl && !channelNameEl && document.location.pathname.startsWith("/results") && document.location.search.includes("search_query=")) {
          const search_query = new URLSearchParams(document.location.search).get("search_query");
          const originalItems = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(search_query);
          const nameEl = item.parentElement.querySelector("yt-avatar-shape img");
          const imgSrc = (nameEl == null ? void 0 : nameEl.getAttribute("src")) || null;
          if (!imgSrc) return;
          const originalItem = originalItems == null ? void 0 : originalItems.find((item2) => item2.avatarImage === imgSrc);
          if (!(originalItem == null ? void 0 : originalItem.name) || !channelNameEl) return;
          if (!window.YoutubeAntiTranslate.isStringEqual((_a = channelNameEl.textContent) == null ? void 0 : _a.trim(), originalItem.name)) {
            if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, null, null, originalItem.name)) {
              return;
            }
            window.YoutubeAntiTranslate.replaceTextOnly(channelNameEl, originalItem.name);
          }
          return;
        }
        if (!linkEl) return;
      }
      const href = linkEl.getAttribute("href");
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel("whiteListUntranslateChannelBranding", null, href)) {
        return;
      }
      const ucid = await window.YoutubeAntiTranslate.getChannelUCIDFromHref(href);
      if (!ucid) return;
      const branding = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI(ucid);
      if (!branding || !branding.title) return;
      if (!window.YoutubeAntiTranslate.isStringEqual((_b = linkEl.textContent) == null ? void 0 : _b.trim(), branding.title)) window.YoutubeAntiTranslate.replaceTextOnly(linkEl, branding.title);
      item.setAttribute("data-ytat-collab-untranslated", document.location.href);
    });
    await Promise.allSettled(tasks);
  }
  function initAntiTranslateChannelBranding() {
    if (!window.YoutubeAntiTranslate) return;
    const isChannelPage = CHANNEL_LOCATION_REGEXES.some((re) => re.test(window.location.href));
    if (!isChannelPage) {
      const observerNonChannel = new MutationObserver(
        window.YoutubeAntiTranslate.debounce(untranslateBranding)
      );
      observerNonChannel.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
      return;
    }
    const observer = new MutationObserver(
      window.YoutubeAntiTranslate.debounce(untranslateBranding)
    );
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }
  const _isTopLevel = window === window.top;
  const _isEmbedFrame = window.location.pathname.startsWith("/embed/");
  const _isNocookieDomain = window.location.hostname.includes("youtube-nocookie.com");
  if (!_isTopLevel && !_isEmbedFrame && !_isNocookieDomain) {
    throw new Error("[YouTube Enhanced] Skipping internal iframe");
  }
  patchQuality();
  async function bootAntiTranslate(settings) {
    if (settings.disabled) return;
    initAntiTranslateCore(() => getATSettingsSync());
    if (settings.untranslateTitle || settings.untranslateDescription || settings.untranslateChannelBranding || settings.untranslateThumbnail) {
      initAntiTranslateTitles();
    }
    if (settings.untranslateAudio) {
      initAntiTranslateAudio();
    }
    if (settings.untranslateDescription || settings.untranslateChapters) {
      initAntiTranslateDescription();
    }
    if (settings.untranslateNotification) {
      initAntiTranslateNotifications();
    }
    if (settings.subtitlesEnabled) {
      initAntiTranslateSubtitles();
    }
    if (settings.untranslateChannelBranding) {
      initAntiTranslateChannelBranding();
    }
  }
  function registerSettingsMenu() {
    GM.registerMenuCommand("⚙ YT Anti-Translate Settings", () => {
      const s = getATSettingsSync();
      const json = prompt(
        "YT Anti-Translate Settings (JSON):\nEdit and click OK to save.\nKeys: untranslateTitle, untranslateAudio, untranslateDescription,\nuntranslateChapters, untranslateChannelBranding, untranslateNotification,\nuntranslateThumbnail, subtitlesEnabled, subtitlesLanguage,\nwhiteListUntranslateTitle (array of @handles)",
        JSON.stringify(s, null, 2)
      );
      if (json) {
        try {
          const parsed = JSON.parse(json);
          saveATSettings({ ...AT_DEFAULTS, ...parsed }).then(() => {
            setATSettingsCache({ ...AT_DEFAULTS, ...parsed });
            alert("Settings saved. Reload the page to apply.");
          });
        } catch {
          alert("Invalid JSON — settings not saved.");
        }
      }
    });
  }
  async function boot() {
    await loadSpeedData();
    if (location.pathname.startsWith("/watch") || location.pathname.startsWith("/shorts")) {
      initSpeed();
    }
    initAutoStop();
    const atSettings = await loadATSettings();
    setATSettingsCache(atSettings);
    await bootAntiTranslate(atSettings);
    registerSettingsMenu();
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
    const atSettings = await loadATSettings();
    setATSettingsCache(atSettings);
    resetAntiTranslateTitles();
    if (atSettings.subtitlesEnabled) {
      initAntiTranslateSubtitles();
    }
    if (atSettings.untranslateChannelBranding) {
      initAntiTranslateChannelBranding();
    }
  });
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
    });
  } else {
    boot();
  }

})();
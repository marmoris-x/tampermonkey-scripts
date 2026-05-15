// ==UserScript==
// @name         YouTube Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.8.0
// @author       marmoris-x
// @description  Auto max video quality, per-channel playback speed control & auto-stop on page load.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/YouTube%20Enhanced.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/YouTube%20Enhanced.user.js
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
  let isApplyingSpeed = false;
  let menuPanel = null;
  let customPanel = null;
  let inCustomPanel = false;
  let origMenuWidth = "";
  let origMenuHeight = "";
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
      if (vid && Math.abs(vid.playbackRate - val) > 1e-3) {
        isApplyingSpeed = true;
        try {
          vid.playbackRate = val;
        } finally {
          isApplyingSpeed = false;
        }
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
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = '<div class="ytp-panel" style="width: 330px; height: 250px;"><div class="ytp-panel-header"><div class="ytp-panel-back-button-container"><button class="ytp-button ytp-panel-back-button" aria-label="' + LANG.backToPreviousMenu + '"></button></div><span class="ytp-panel-title" role="heading" aria-level="2">' + LANG.channelSpeed + '</span></div><div class="ytp-variable-speed-panel-content" tabindex="0" style="height: 193px;"><div class="ytp-speed-display-container"><div class="ytp-variable-speed-panel-display" aria-live="polite"><div class="ytp-variable-speed-panel-premium-badge" tabindex="-1"><div class="ytp-variable-speed-panel-badge"></div></div><span>1.00x</span></div></div><div class="ytp-variable-speed-panel-slider-container"><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="' + LANG.decreaseSpeed + '"><span>-</span></button><div class="ytp-input-slider-section"><div class="ytp-speedslider-indicator-container"><div class="ytp-speedslider-badge" aria-label=""></div><p class="ytp-speedslider-text">1.00x</p></div><input class="ytp-input-slider ytp-speedslider ytp-varispeed-input-slider" role="slider" tabindex="0" type="range" min="0.25" max="3" step="0.05" value="1" aria-valuenow="1" aria-valuemin="0.25" aria-valuemax="3" aria-valuetext="1.00" style="--yt-slider-shape-gradient-percent: 42.857142857142854%;"></div><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="' + LANG.increaseSpeed + '"><span>+</span></button></div><div class="ytp-variable-speed-panel-chips"><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="5" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1</span></button><div class="ytp-variable-speed-panel-preset-button-label-text">' + LANG.standard + '</div></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="2" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,25</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="3" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,5</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="0" aria-hidden="true" style="display: none;"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,75</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="4" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>2</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="1" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><div class="ytp-variable-speed-panel-premium-upsell-icon"></div><span>3.0</span></button></div></div></div></div>';
    const panel = tempDiv.firstChild;
    let cid = currentChannelId;
    if (!cid) cid = getChannelId();
    const stored = getSpeeds();
    let curSpeed = cid && stored[cid] ? stored[cid] : 1;
    const backBtn = panel.querySelector(".ytp-panel-back-button");
    const displayTxt = panel.querySelector(".ytp-variable-speed-panel-display span");
    const sliderTxt = panel.querySelector(".ytp-speedslider-text");
    const slider = panel.querySelector('input[type="range"]');
    const btns = panel.querySelectorAll(".ytp-variable-speed-panel-increment-button");
    const btnDec = btns[0];
    const btnInc = btns[1];
    const chips = panel.querySelectorAll(".ytp-variable-speed-panel-preset-button-wrapper button");
    if (!LANG.isGerman) {
      chips.forEach(function(btn) {
        const span = btn.querySelector("span");
        if (!span) return;
        span.textContent = span.textContent.replace(",", ".");
      });
    } else {
      chips.forEach(function(btn) {
        const span = btn.querySelector("span");
        if (!span) return;
        span.textContent = span.textContent.replace(".", ",");
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
      if (displayTxt) displayTxt.textContent = strVal;
      if (sliderTxt) sliderTxt.textContent = strVal;
      const clampedSlider = clampSpeed(v);
      if (slider) {
        slider.value = String(clampedSlider);
        slider.setAttribute("aria-valuenow", String(v));
        slider.setAttribute("aria-valuetext", v.toFixed(2));
        slider.style.setProperty("--yt-slider-shape-gradient-percent", getSliderPercent(v));
      }
      chips.forEach(function(btn) {
        const span = btn.querySelector("span");
        if (!span) return;
        const btnVal = parseFloat(span.textContent.replace(",", "."));
        if (Math.abs(btnVal - v) < 1e-3) {
          btn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
        } else {
          btn.style.backgroundColor = "transparent";
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
    if (slider) {
      slider.addEventListener("input", function(e) {
        commit(parseFloat(e.target.value));
      });
    }
    if (btnDec) {
      btnDec.addEventListener("click", function(e) {
        e.stopPropagation();
        commit(Math.max(0.25, roundSpeed(curSpeed - 0.05)));
      });
    }
    if (btnInc) {
      btnInc.addEventListener("click", function(e) {
        e.stopPropagation();
        commit(Math.min(3, roundSpeed(curSpeed + 0.05)));
      });
    }
    chips.forEach(function(btn) {
      const span = btn.querySelector("span");
      if (!span) return;
      const speedVal = parseFloat(span.textContent.replace(",", "."));
      btn.addEventListener("click", function(e) {
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
    item.innerHTML = '<div class="ytp-menuitem-icon"><svg height="24" viewBox="0 0 24 24" width="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M9.5 16.5v-9l7 4.5z"/></svg></div><div class="ytp-menuitem-label">' + LANG.channelSpeedLabel + '</div><div class="ytp-menuitem-content">' + label + "</div>";
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
          if (isApplyingSpeed) return;
          const currentSaved = getSpeeds()[currentChannelId];
          if (currentSaved && Math.abs(vid.playbackRate - currentSaved) > 0.01) {
            isApplyingSpeed = true;
            vid.playbackRate = currentSaved;
            isApplyingSpeed = false;
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
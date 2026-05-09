// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.18
// @author       marmoris-x
// @description  Export NotebookLM sources as organized ZIP with markdown conversion
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @match        https://notebooklm.google.com/*
// @sandbox      JavaScript
// @grant        GM_addElement
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  let _liCache = new WeakMap();
  function getLiIndex(node) {
    let ancestor = node.parentElement;
    while (ancestor && !["ul", "ol"].includes(ancestor.tagName.toLowerCase())) {
      ancestor = ancestor.parentElement;
    }
    if (!ancestor || ancestor.tagName.toLowerCase() !== "ol") return -1;
    const cached = _liCache.get(node);
    if (cached && cached.ancestor === ancestor) return cached.index;
    const allLis = ancestor.querySelectorAll("li");
    for (let i = 0, idx = 1; i < allLis.length; i++) {
      let a = allLis[i].parentElement;
      while (a && !["ul", "ol"].includes(a.tagName.toLowerCase())) a = a.parentElement;
      if (a === ancestor) {
        _liCache.set(allLis[i], { ancestor, index: idx });
        idx++;
      }
    }
    return (_liCache.get(node) || {}).index || 1;
  }
  function resetLiCache() {
    _liCache = new WeakMap();
  }
  function htmlToMarkdown(el) {
    function convert(node) {
      var _a, _b;
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName.toLowerCase();
      function inner() {
        let result = "";
        for (let child = node.firstChild; child; child = child.nextSibling) {
          result += convert(child);
        }
        return result;
      }
      switch (tag) {
        case "h1":
          return "# " + inner() + "\n\n";
        case "h2":
          return "## " + inner() + "\n\n";
        case "h3":
          return "### " + inner() + "\n\n";
        case "h4":
          return "#### " + inner() + "\n\n";
        case "h5":
          return "##### " + inner() + "\n\n";
        case "h6":
          return "###### " + inner() + "\n\n";
        case "p":
          return inner() + "\n\n";
        case "br":
          return "\n";
        case "strong":
        case "b":
          return "**" + inner() + "**";
        case "em":
        case "i":
          return "*" + inner() + "*";
        case "a": {
          let href = node.getAttribute("href") || "";
          if (href.includes("google.com/url")) {
            try {
              href = new URL(href).searchParams.get("q") || href;
            } catch (_) {
            }
          }
          const text = inner();
          return href ? "[" + text + "](" + href + ")" : text;
        }
        case "ul":
          return inner() + "\n";
        case "ol":
          return inner() + "\n";
        case "li": {
          const index = getLiIndex(node);
          if (index > 0) return index + ". " + inner().trim() + "\n";
          return "- " + inner().trim() + "\n";
        }
        case "div": {
          const ariaLevel = node.getAttribute("aria-level");
          if (ariaLevel) {
            const hashes = "#".repeat(Math.min(parseInt(ariaLevel), 6));
            return hashes + " " + inner().trim() + "\n\n";
          }
          if (/^-{10,}$/.test(node.textContent.trim())) return "---\n\n";
          if (node.classList && node.classList.contains("code")) {
            const codeEl = node.querySelector("code");
            const lang = codeEl ? codeEl.getAttribute("data-language") || "" : "";
            const content = codeEl ? codeEl.textContent : node.textContent;
            return "```" + lang + "\n" + content + "\n```\n\n";
          }
          return inner();
        }
        case "s":
        case "del":
        case "strike":
          return "~~" + inner() + "~~";
        case "u":
          return "__" + inner() + "__";
        case "code": {
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") return inner();
          return "`" + inner() + "`";
        }
        case "pre": {
          const codeEl = node.querySelector("code");
          const langSource = codeEl || node;
          const lang = langSource.getAttribute("data-language") || langSource.className && ((_a = langSource.className.match(/language-(\S+)/)) == null ? void 0 : _a[1]) || langSource.className && ((_b = langSource.className.match(/lang-(\S+)/)) == null ? void 0 : _b[1]) || "";
          return "```" + lang + "\n" + (codeEl ? codeEl.textContent : inner()) + "\n```\n\n";
        }
        case "blockquote":
          return inner().trim().split("\n").map(function(l) {
            return "> " + l;
          }).join("\n") + "\n\n";
        case "hr":
          return "---\n\n";
        case "img": {
          const src = node.getAttribute("src") || "";
          const alt = node.getAttribute("alt") || "";
          return "![" + alt + "](" + src + ")";
        }
        case "table": {
          let toRow2 = function(cells) {
            return "| " + cells.map(function(c) {
              return c.textContent.trim().replace(/\|/g, "\\|");
            }).join(" | ") + " |";
          };
          const rows = Array.from(node.querySelectorAll("tr"));
          if (!rows.length) return inner();
          const headerCells = Array.from(rows[0].querySelectorAll("th, td"));
          const header = toRow2(headerCells);
          const separator = "| " + headerCells.map(function() {
            return "---";
          }).join(" | ") + " |";
          const body = rows.slice(1).map(function(r) {
            return toRow2(Array.from(r.querySelectorAll("td")));
          }).join("\n");
          return [header, separator, body].filter(Boolean).join("\n") + "\n\n";
        }
        default:
          return inner();
      }
    }
    return convert(el).replace(/\n{3,}/g, "\n\n").trim();
  }
  const crcTable = new Uint32Array(256);
  (function buildCRCTable() {
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      crcTable[i] = c;
    }
  })();
  function crc32(u8) {
    let crc = 4294967295;
    for (let i = 0; i < u8.length; i++) crc = crc >>> 8 ^ crcTable[(crc ^ u8[i]) & 255];
    return (crc ^ 4294967295) >>> 0;
  }
  function u16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }
  function u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }
  const enc = new TextEncoder();
  function buildStoreZip(files) {
    const localParts = [];
    const centralParts = [];
    const entries = [];
    let localOffset = 0;
    for (let f = 0; f < files.length; f++) {
      const nameBytes = enc.encode(files[f].name);
      const data = files[f].data || enc.encode(files[f].text);
      const crc = crc32(data);
      const local = new Uint8Array([
        80,
        75,
        3,
        4,
20,
        0,
...u16(2048),
0,
        0,
0,
        0,
        0,
        0,
...u32(crc),
        ...u32(data.length),
...u32(data.length),
...u16(nameBytes.length),
        0,
        0
]);
      entries.push({ offset: localOffset, nameBytes, crc, size: data.length });
      localParts.push(local, nameBytes, data);
      localOffset += local.length + nameBytes.length + data.length;
    }
    let centralSize = 0;
    for (let f = 0; f < entries.length; f++) {
      const e = entries[f];
      const ch = new Uint8Array([
        80,
        75,
        1,
        2,
20,
        0,
20,
        0,
...u16(2048),
0,
        0,
0,
        0,
        0,
        0,
...u32(e.crc),
        ...u32(e.size),
...u32(e.size),
...u16(e.nameBytes.length),
        0,
        0,
0,
        0,
0,
        0,
0,
        0,
0,
        0,
        0,
        0,
...u32(e.offset)
]);
      centralParts.push(ch, e.nameBytes);
      centralSize += ch.length + e.nameBytes.length;
    }
    const eocd = new Uint8Array([
      80,
      75,
      5,
      6,
0,
      0,
0,
      0,
...u16(entries.length),
...u16(entries.length),
...u32(centralSize),
      ...u32(localOffset),
0,
      0
]);
    return new Blob([...localParts, ...centralParts, eocd], { type: "application/zip" });
  }
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
  const log = createLogger("NotebookLM Source Export");
  const CONFIG = {
    audio: { enabled: true, vol: 0.15 },
selectors: {
closeBtn: 'button[mattooltip*="schließen"], button[mattooltip*="close"], button[aria-label*="Close"], button[aria-label*="Schließen"]',
content: ".elements-container labs-tailwind-structural-element-view-v2",
notebookTitle: ".title-label-inner.mat-title-large",
sourceContainer: ".single-source-container",
sourceTitle: ".source-title"
    }
  };
  const LOG_LEVEL = { INFO: "info", SUCCESS: "success", WARN: "warn", ERROR: "error" };
  const TIMING = {
    CONTENT_POLL_ATTEMPTS: 30,
    CONTENT_POLL_INTERVAL_MS: 100,
    CONTENT_STABLE_POLLS: 2,
    CONTENT_GONE_ATTEMPTS: 5,
MIN_CONTENT_LENGTH_CHARS: 20,
    KEEP_ALIVE_VOLUME: 1e-3,
    LOG_MAX_ENTRIES: 50,
    AUDIO_NOTE_DELAYS_MS: [0, 100, 200]
  };
  const STATE = {
    isCancelled: false,
    keepAliveAudio: null,
    menuStartId: null,
    menuStopId: null,
soundFXCloseTimer: null
  };
  const SoundFX = {
    _ctx: null,
    get ctx() {
      if (!this._ctx && CONFIG.audio.enabled) {
        try {
          this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          log.warn("AudioContext creation failed: " + e.message);
        }
      }
      if (this._ctx && this._ctx.state === "suspended") {
        this._ctx.resume().catch(function() {
        });
      }
      return this._ctx;
    },
playTone: function(freq, type, duration, vol) {
      vol = vol || CONFIG.audio.vol;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (_) {
      }
    },
    playStart: function() {
      this.playTone(600, "sine", 0.15);
    },
    playError: function() {
      this.playTone(150, "sawtooth", 0.3);
    },
playComplete: function() {
      const delays = TIMING.AUDIO_NOTE_DELAYS_MS;
      const notes = [
        { freq: 440, duration: 0.6, delay: delays[0] },
        { freq: 554, duration: 0.6, delay: delays[1] },
        { freq: 659, duration: 0.8, delay: delays[2] }
      ];
      notes.forEach((n) => {
        setTimeout(() => {
          this.playTone(n.freq, "sine", n.duration);
        }, n.delay);
      });
    },
close: function() {
      if (this._ctx) {
        try {
          this._ctx.close();
        } catch (_) {
        }
        this._ctx = null;
      }
    },
ensureReady: async function() {
      try {
        const c = this.ctx;
        if (c && c.state === "suspended") {
          await c.resume();
        }
      } catch (_) {
      }
    }
  };
  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function waitForContent(selector, timeoutMs) {
    return new Promise((resolve) => {
      let stabilityTimer = null;
      let contentObserver = null;
      const rootObserver = new MutationObserver(checkAppear);
      function cleanup() {
        if (contentObserver) {
          contentObserver.disconnect();
          contentObserver = null;
        }
        if (stabilityTimer) {
          clearTimeout(stabilityTimer);
          stabilityTimer = null;
        }
        rootObserver.disconnect();
      }
      function done(el) {
        cleanup();
        resolve(el || null);
      }
      function watchStability(el) {
        let lastText = el.textContent;
        contentObserver = new MutationObserver(() => {
          const cur = el.textContent;
          if (cur !== lastText) {
            lastText = cur;
            if (stabilityTimer) clearTimeout(stabilityTimer);
            if (cur.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
              stabilityTimer = setTimeout(() => done(el), 300);
            }
          }
        });
        contentObserver.observe(el, { childList: true, subtree: true, characterData: true });
        if (el.textContent.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
          stabilityTimer = setTimeout(() => done(el), 300);
        }
      }
      function checkAppear() {
        const el = document.querySelector(selector);
        if (!el) return;
        rootObserver.disconnect();
        watchStability(el);
      }
      checkAppear();
      if (!contentObserver) {
        rootObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
      setTimeout(() => done(null), timeoutMs);
    });
  }
  function waitForContentGone(selector, timeoutMs) {
    return new Promise((resolve) => {
      if (!document.querySelector(selector)) {
        resolve(true);
        return;
      }
      let observeTarget = document.querySelector(".elements-container");
      if (observeTarget) {
        observeTarget = observeTarget.parentElement || observeTarget;
      } else {
        const el = document.querySelector(selector);
        observeTarget = el && el.parentElement || document.documentElement;
      }
      const observer = new MutationObserver(() => {
        if (!document.querySelector(selector)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(observeTarget, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        let pollAttempts = 0;
        const pollTimer = setInterval(() => {
          if (!document.querySelector(selector)) {
            clearInterval(pollTimer);
            resolve(true);
            return;
          }
          pollAttempts++;
          if (pollAttempts >= 5) {
            clearInterval(pollTimer);
            resolve(false);
          }
        }, 100);
      }, timeoutMs);
    });
  }
  function startKeepAlive() {
    STATE.keepAliveAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA");
    STATE.keepAliveAudio.loop = true;
    STATE.keepAliveAudio.volume = TIMING.KEEP_ALIVE_VOLUME;
    STATE.keepAliveAudio.play().catch(() => {
      log.warn("Keep-alive audio blocked by browser. Background tab may throttle timers.");
    });
  }
  function stopKeepAlive() {
    if (STATE.keepAliveAudio) {
      STATE.keepAliveAudio.pause();
      STATE.keepAliveAudio = null;
    }
  }
  function registerMenuStart(onStart, label) {
    const opts = STATE.menuStartId ? { id: STATE.menuStartId } : {};
    STATE.menuStartId = GM_registerMenuCommand(label || "Start Export", onStart, opts);
  }
  function registerMenuStop() {
    STATE.menuStopId = GM_registerMenuCommand("Stop Export", () => {
      STATE.isCancelled = true;
      log.warn("Stop requested via menu.");
    });
  }
  async function attemptClose() {
    async function tryStrategy(description, actionFn) {
      actionFn();
      const gone = await waitForContentGone(CONFIG.selectors.content, 300);
      if (gone) {
        log.log("[Close] " + description + " — panel closed.");
        return true;
      }
      return false;
    }
    const closeIcons = ["close", "cancel", "arrow_back", "chevron_left"];
    const buttons = document.querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) {
      const txt = buttons[i].textContent || "";
      for (let j = 0; j < closeIcons.length; j++) {
        if (txt.indexOf(closeIcons[j]) !== -1) {
          const btn = buttons[i];
          if (await tryStrategy('Strategy 1: icon "' + closeIcons[j] + '"', function() {
            btn.click();
          })) return true;
        }
      }
    }
    const localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
    if (localizedBtn) {
      if (await tryStrategy("Strategy 2: tooltip-based button", function() {
        localizedBtn.click();
      })) return true;
    }
    const panelHeaderBtns = document.querySelectorAll('[class*="panel"] button, [class*="dialog"] button, [class*="drawer"] button, [class*="sidebar"] button');
    for (let k = 0; k < panelHeaderBtns.length; k++) {
      const btn = panelHeaderBtns[k];
      const aria = btn.getAttribute("aria-label") || "";
      if (aria.toLowerCase().indexOf("close") !== -1 || aria.toLowerCase().indexOf("schließen") !== -1) {
        if (await tryStrategy("Strategy 3: panel header button", function() {
          btn.click();
        })) return true;
      }
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    log.log("[Close] Strategy 4: Escape key dispatched.");
    return true;
  }
  const uiCallbacks = {
addLog: null,
updateProgress: null,
setStatusText: null,
setStartBtnState: null,
setStopBtnVisible: null,
restartUI: null
  };
  function cleanupRun() {
    stopKeepAlive();
    STATE.soundFXCloseTimer = setTimeout(() => {
      SoundFX.close();
      STATE.soundFXCloseTimer = null;
    }, 2e3);
    GM_unregisterMenuCommand(STATE.menuStopId);
    registerMenuStart(() => {
      if (typeof uiCallbacks.restartUI === "function") uiCallbacks.restartUI();
    });
  }
  async function runProcess() {
    var _a;
    if (STATE.soundFXCloseTimer) {
      clearTimeout(STATE.soundFXCloseTimer);
      STATE.soundFXCloseTimer = null;
      SoundFX.close();
    }
    STATE.isCancelled = false;
    uiCallbacks.updateProgress && uiCallbacks.updateProgress(0, 1);
    uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(true, "Running...");
    uiCallbacks.setStopBtnVisible && uiCallbacks.setStopBtnVisible(true);
    registerMenuStop();
    registerMenuStart(function noop() {
    }, "Export Running...");
    if ((_a = navigator.connection) == null ? void 0 : _a.saveData) {
      log.warn("Save-Data mode active — keep-alive audio disabled.");
      uiCallbacks.addLog && uiCallbacks.addLog(">> Save-Data mode active — keep-alive disabled.", LOG_LEVEL.WARN);
    } else {
      startKeepAlive();
    }
    await SoundFX.ensureReady();
    SoundFX.playStart();
    const totalSources = document.querySelectorAll(CONFIG.selectors.sourceContainer).length;
    if (totalSources === 0) {
      log.error("No sources found.");
      uiCallbacks.addLog && uiCallbacks.addLog("Error: No sources found.", LOG_LEVEL.ERROR);
      SoundFX.playError();
      cleanupRun();
      uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, "Retry");
      return;
    }
    log.log("Scan complete. Found " + totalSources + " items.");
    uiCallbacks.addLog && uiCallbacks.addLog("Scan complete. Found " + totalSources + " items.", LOG_LEVEL.SUCCESS);
    log.warn("Keep this tab active — background tabs may throttle timers.");
    uiCallbacks.addLog && uiCallbacks.addLog("Keep this tab active — background tabs may throttle timers.", LOG_LEVEL.WARN);
    const collectedFiles = [];
    const usedNames = new Set();
    let crashed = false;
    function processContent(text, fileName, linesCount, conversionTimeMs, collectedFiles2) {
      if (conversionTimeMs > 5e3) {
        log.warn("Slow conversion (" + Math.round(conversionTimeMs) + "ms for " + linesCount + " elements)");
      }
      if (text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
        const data = enc.encode(text);
        collectedFiles2.push({ name: fileName, data });
        log.log("Queued: " + fileName + " (" + text.length + " chars)");
        uiCallbacks.addLog && uiCallbacks.addLog(">> Queued: " + fileName + " (" + text.length + " chars)", LOG_LEVEL.SUCCESS);
      } else {
        log.warn("Content empty for: " + fileName);
        uiCallbacks.addLog && uiCallbacks.addLog(">> Warning: Content empty", LOG_LEVEL.WARN);
      }
    }
    try {
      for (let i = 0; i < totalSources; i++) {
        if (STATE.isCancelled) break;
        uiCallbacks.updateProgress && uiCallbacks.updateProgress(i + 1, totalSources);
        const source = document.querySelectorAll(CONFIG.selectors.sourceContainer)[i];
        if (!source) {
          log.error("Source " + (i + 1) + " not found in DOM. Skipping.");
          uiCallbacks.addLog && uiCallbacks.addLog("Source " + (i + 1) + " not found. Skipping.", LOG_LEVEL.ERROR);
          continue;
        }
        const titleEl = source.querySelector(CONFIG.selectors.sourceTitle);
        let fileName = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : "Source_" + (i + 1)).replace(/[\\/:*?"<>|]/g, "_").substring(0, 120).trim();
        if (!fileName.endsWith(".md")) fileName += ".md";
        if (usedNames.has(fileName)) {
          const baseName = fileName.replace(/\.md$/, "");
          let counter = 2;
          while (usedNames.has(baseName + "_" + counter + ".md")) counter++;
          fileName = baseName + "_" + counter + ".md";
        }
        usedNames.add(fileName);
        try {
          log.log("Opening: " + fileName);
          uiCallbacks.addLog && uiCallbacks.addLog("Opening: " + fileName, LOG_LEVEL.INFO);
          uiCallbacks.setStatusText && uiCallbacks.setStatusText(i + 1 + "/" + totalSources + ": " + fileName);
          source.scrollIntoView({ block: "center" });
          await wait(100);
          const stretchBtn = source.querySelector(".source-stretched-button");
          if (stretchBtn) stretchBtn.click();
          else (titleEl || source).click();
          const contentEl = await waitForContent(CONFIG.selectors.content, 15e3);
          if (STATE.isCancelled) {
            await attemptClose();
            continue;
          }
          if (contentEl) {
            const container = contentEl.closest(".elements-container");
            const allInContainer = container ? container.querySelectorAll("labs-tailwind-structural-element-view-v2") : document.querySelectorAll(CONFIG.selectors.content);
            const lines = Array.from(allInContainer).filter(
              function(el) {
                return !el.parentElement.closest(CONFIG.selectors.content);
              }
            );
            const t0 = performance.now();
            const textLines = lines.map(function(l) {
              return htmlToMarkdown(l);
            });
            const t1 = performance.now();
            const text = textLines.join("\n\n");
            processContent(text, fileName, lines.length, t1 - t0, collectedFiles);
          } else {
            const panel = document.querySelector(".elements-container");
            const iframe = panel && panel.querySelector("iframe");
            if (iframe) {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                  const iframeLines = iframeDoc.querySelectorAll("labs-tailwind-structural-element-view-v2");
                  if (iframeLines.length > 0) {
                    log.log("Content found in iframe — extracting...");
                    uiCallbacks.addLog && uiCallbacks.addLog(">> Content found in iframe...", LOG_LEVEL.INFO);
                    const lines = Array.from(iframeLines).filter(
                      function(el) {
                        return !el.parentElement.closest("labs-tailwind-structural-element-view-v2");
                      }
                    );
                    const t0 = performance.now();
                    const textLines = lines.map(function(l) {
                      return htmlToMarkdown(l);
                    });
                    const t1 = performance.now();
                    const text = textLines.join("\n\n");
                    processContent(text, fileName, lines.length, t1 - t0, collectedFiles);
                  } else {
                    log.error("No content elements found in iframe for: " + fileName);
                    uiCallbacks.addLog && uiCallbacks.addLog(">> Timeout: Content load failed (iframe empty)", LOG_LEVEL.ERROR);
                  }
                } else {
                  log.error("Cannot access iframe document for: " + fileName);
                  uiCallbacks.addLog && uiCallbacks.addLog(">> Timeout: Cannot access iframe document", LOG_LEVEL.ERROR);
                }
              } catch (_) {
                log.error("Cross-origin iframe — cannot extract content for: " + fileName);
                uiCallbacks.addLog && uiCallbacks.addLog(">> Timeout: Cross-origin iframe, cannot extract", LOG_LEVEL.ERROR);
              }
            } else {
              let fallbackText = "";
              if (panel) {
                const directChildren = panel.children;
                for (let b = 0; b < directChildren.length; b++) {
                  const txt = directChildren[b].textContent.trim();
                  if (txt.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
                    fallbackText += txt + "\n\n";
                  }
                }
              }
              processContent(fallbackText, fileName, 0, 0, collectedFiles);
            }
          }
          await attemptClose();
          resetLiCache();
        } catch (sourceErr) {
          log.error("Error processing source " + (i + 1) + ": " + sourceErr.message);
          uiCallbacks.addLog && uiCallbacks.addLog("Error: " + sourceErr.message, LOG_LEVEL.ERROR);
        }
      }
    } catch (e) {
      log.error("Unexpected error: " + e.message);
      uiCallbacks.addLog && uiCallbacks.addLog("Unexpected error: " + e.message, LOG_LEVEL.ERROR);
      crashed = true;
    } finally {
      cleanupRun();
    }
    if (crashed) {
      uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, "Retry");
      return;
    }
    if (STATE.isCancelled) {
      log.warn("Extraction stopped by user.");
      uiCallbacks.addLog && uiCallbacks.addLog("Extraction stopped by user.", LOG_LEVEL.WARN);
      uiCallbacks.setStatusText && uiCallbacks.setStatusText("Stopped");
      uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, "Start Extraction");
    } else {
      uiCallbacks.updateProgress && uiCallbacks.updateProgress(totalSources, totalSources);
      if (collectedFiles.length > 0) {
        log.log("Building ZIP with " + collectedFiles.length + " file(s)...");
        uiCallbacks.addLog && uiCallbacks.addLog("Building ZIP with " + collectedFiles.length + " file(s)...", LOG_LEVEL.INFO);
        const notebookTitleEl = document.querySelector(CONFIG.selectors.notebookTitle);
        const notebookTitle = notebookTitleEl ? notebookTitleEl.textContent.trim() : "NotebookLM";
        const zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, "_").substring(0, 100).trim() + ".zip";
        let zipBlob;
        try {
          zipBlob = buildStoreZip(collectedFiles);
        } catch (zipErr) {
          log.error("ZIP build failed: " + zipErr.message);
          uiCallbacks.addLog && uiCallbacks.addLog("ZIP build failed: " + zipErr.message, LOG_LEVEL.ERROR);
          uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, "Retry");
          return;
        }
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipName;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          URL.revokeObjectURL(url);
        }, 2e3);
        log.log("ZIP downloaded: " + zipName);
        uiCallbacks.addLog && uiCallbacks.addLog("ZIP downloaded.", LOG_LEVEL.SUCCESS);
      } else {
        log.warn("No files to export.");
        uiCallbacks.addLog && uiCallbacks.addLog("No files to export.", LOG_LEVEL.WARN);
      }
      log.log("Process completed successfully.");
      uiCallbacks.addLog && uiCallbacks.addLog("Process completed successfully.", LOG_LEVEL.SUCCESS);
      uiCallbacks.setStatusText && uiCallbacks.setStatusText("Complete");
      uiCallbacks.setStartBtnState && uiCallbacks.setStartBtnState(false, "Done");
      SoundFX.playComplete();
      setTimeout(() => {
        if (uiCallbacks.removeStatusBar) uiCallbacks.removeStatusBar();
      }, 3e3);
    }
  }
  const SELECTORS = {
    chatContainer: ".chat-panel-content",
    messagePair: ".chat-message-pair",
    userContent: ".from-user-container .message-text-content",
    aiContent: ".to-user-container labs-tailwind-doc-viewer",
    citationButton: ".citation-marker",
    notebookTitle: ".cover-title.mat-headline-medium",
    notebookDate: ".cover-subtitle-date",
    sourceCount: ".cover-subtitle-source-count"
  };
  const FALLBACK_SELECTORS = {
    userContent: '[class*="from-user"] [class*="message-text"]',
    aiContent: '[class*="to-user"] [class*="message-text"], [class*="to-user"] labs-tailwind-doc-viewer',
    notebookTitle: '[class*="title"] [class*="mat-title"], [class*="cover-title"]',
    notebookDate: '[class*="subtitle"] [class*="date"], .cover-subtitle-date',
    sourceCount: '[class*="subtitle"] [class*="source"], .cover-subtitle-source-count'
  };
  function queryFirst(root, selectors) {
    for (let i = 0; i < selectors.length; i++) {
      const el = root.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }
  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function removeCitations(el) {
    if (!el) return;
    const buttons = el.querySelectorAll(SELECTORS.citationButton);
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].remove();
    }
  }
  function extractMetadata() {
    let titleEl = document.querySelector(SELECTORS.notebookTitle);
    if (!titleEl) {
      titleEl = queryFirst(document, [FALLBACK_SELECTORS.notebookTitle]);
    }
    const title = titleEl ? titleEl.textContent.trim() : "NotebookLM Chat";
    let dateEl = document.querySelector(SELECTORS.notebookDate);
    if (!dateEl) {
      dateEl = queryFirst(document, [FALLBACK_SELECTORS.notebookDate]);
    }
    const dateStr = dateEl ? dateEl.textContent.trim() : todayISO();
    let sourceEl = document.querySelector(SELECTORS.sourceCount);
    if (!sourceEl) {
      sourceEl = queryFirst(document, [FALLBACK_SELECTORS.sourceCount]);
    }
    const sourceInfo = sourceEl ? sourceEl.textContent.trim() : null;
    return { title, dateStr, sourceInfo };
  }
  function extractChatToMarkdown(htmlToMarkdown2) {
    const container = document.querySelector(SELECTORS.chatContainer);
    if (!container) return "";
    const pairs = container.querySelectorAll(SELECTORS.messagePair);
    if (!pairs || pairs.length === 0) return "";
    const meta = extractMetadata();
    const lines = [
      "---",
      'title: "' + meta.title + '"',
      "date: " + meta.dateStr,
      "platform: NotebookLM"
    ];
    if (meta.sourceInfo) {
      lines.push("sources: " + meta.sourceInfo);
    }
    lines.push("---");
    lines.push("");
    lines.push("# NotebookLM Chat Export");
    lines.push("");
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      let userEl = pair.querySelector(SELECTORS.userContent);
      if (!userEl) {
        userEl = queryFirst(pair, [FALLBACK_SELECTORS.userContent]);
      }
      let aiEl = pair.querySelector(SELECTORS.aiContent);
      if (!aiEl) {
        aiEl = queryFirst(pair, [FALLBACK_SELECTORS.aiContent]);
      }
      const hasUserText = userEl && userEl.textContent.trim().length > 0;
      const hasAiResponse = aiEl && aiEl.textContent.trim().length > 0;
      if (!hasAiResponse) continue;
      lines.push("---");
      lines.push("");
      lines.push("## User");
      lines.push("");
      if (hasUserText) {
        lines.push(htmlToMarkdown2(userEl));
      } else {
        lines.push("*[non-text message]*");
      }
      lines.push("");
      lines.push("## NotebookLM");
      lines.push("");
      removeCitations(aiEl);
      lines.push(htmlToMarkdown2(aiEl));
      lines.push("");
    }
    return lines.join("\n");
  }
  function extractChatMessages() {
    const container = document.querySelector(SELECTORS.chatContainer);
    if (!container) return null;
    const pairs = container.querySelectorAll(SELECTORS.messagePair);
    if (!pairs || pairs.length === 0) return null;
    const meta = extractMetadata();
    const messages = [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      let userEl = pair.querySelector(SELECTORS.userContent);
      if (!userEl) {
        userEl = queryFirst(pair, [FALLBACK_SELECTORS.userContent]);
      }
      let aiEl = pair.querySelector(SELECTORS.aiContent);
      if (!aiEl) {
        aiEl = queryFirst(pair, [FALLBACK_SELECTORS.aiContent]);
      }
      const hasUserText = userEl && userEl.textContent.trim().length > 0;
      const hasAiResponse = aiEl && aiEl.textContent.trim().length > 0;
      if (!hasAiResponse) continue;
      let userHtml = null;
      if (userEl && hasUserText) {
        const userClone = userEl.cloneNode(true);
        userHtml = userClone.innerHTML;
      }
      let aiHtml = null;
      if (aiEl) {
        const aiClone = aiEl.cloneNode(true);
        removeCitations(aiClone);
        aiHtml = aiClone.innerHTML;
      }
      messages.push({
        userHtml,
        aiHtml,
        userText: userEl ? userEl.textContent.trim() : "",
        aiText: aiEl ? aiEl.textContent.trim() : ""
      });
    }
    if (messages.length === 0) return null;
    return {
      notebookTitle: meta.title,
      dateStr: meta.dateStr,
      sourceInfo: meta.sourceInfo,
      messages
    };
  }
  const EXPORT_CSS = [
    "*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }",
    'body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;',
    "  font-size:16px; line-height:1.6; color:#1e293b; background:#fff; padding:40px 24px; max-width:800px; margin:0 auto; }",
    "h1 { font-size:24px; font-weight:600; color:#0f172a; margin-bottom:4px; }",
    "h2 { font-size:17px; font-weight:600; color:#334155; margin-bottom:10px; }",
    "a { color:#6366f1; text-decoration:none; }",
    "a:hover { text-decoration:underline; }",
    'code { font-family:"SF Mono","Fira Code","Fira Mono","Roboto Mono",monospace; font-size:0.9em;',
    "  background:#f1f5f9; padding:2px 6px; border-radius:4px; }",
    "pre { background:#0f172a; color:#e2e8f0; padding:16px; border-radius:8px; overflow-x:auto;",
    "  font-size:14px; line-height:1.5; margin:12px 0; }",
    "pre code { background:transparent; padding:0; color:inherit; }",
    "blockquote { border-left:3px solid #6366f1; padding:8px 16px; margin:12px 0; background:#f8fafc;",
    "  border-radius:0 8px 8px 0; }",
    "blockquote p { margin:4px 0; }",
    "table { border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; }",
    "th, td { border:1px solid #e2e8f0; padding:8px 12px; text-align:left; }",
    "th { background:#f8fafc; font-weight:600; color:#334155; }",
    "tr:nth-child(even) { background:#f8fafc; }",
    "ul, ol { padding-left:24px; margin:8px 0; }",
    "li { margin:4px 0; }",
    "p { margin:8px 0; }",
    "hr { border:none; border-top:1px solid #e2e8f0; margin:16px 0; }",
    "img { max-width:100%; height:auto; border-radius:6px; }",
    ".metadata { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; margin:20px 0; }",
    ".metadata h1 { font-size:20px; margin-bottom:8px; }",
    ".metadata dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:14px; }",
    ".metadata dt { color:#64748b; font-weight:500; }",
    ".metadata dd { color:#1e293b; }",
    ".message { margin:24px 0; padding:16px 20px; border-radius:12px; }",
    ".user-message { background:#f1f5f9; border:1px solid #e2e8f0; }",
    ".ai-message { background:#faf5ff; border:1px solid #e8d5ff; }",
    ".message .label { font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }",
    ".user-message .label { color:#6366f1; }",
    ".ai-message .label { color:#a855f7; }",
    ".non-text { color:#94a3b8; font-style:italic; }",
    "@media print { body { padding:20px; font-size:13px; } .message { break-inside:avoid; } }",
"labs-tailwind-doc-viewer, paragraph-element-view { display:block; }",
".table-wrapper { overflow-x:auto; }"
  ].join("\n");
  function sanitizeHTML(html) {
    if (!html) return "";
    return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript\s*:/gi, "");
  }
  function buildChatHTMLDocument(messagesData, options) {
    options = options || {};
    const meta = messagesData;
    let bodyParts = "";
    for (let i = 0; i < meta.messages.length; i++) {
      const msg = meta.messages[i];
      bodyParts += '  <div class="message user-message">\n';
      bodyParts += '    <div class="label">User</div>\n';
      if (msg.userHtml) {
        bodyParts += '    <div class="content">' + sanitizeHTML(msg.userHtml) + "</div>\n";
      } else {
        bodyParts += '    <div class="content non-text">[non-text message]</div>\n';
      }
      bodyParts += "  </div>\n\n";
      bodyParts += '  <div class="message ai-message">\n';
      bodyParts += '    <div class="label">NotebookLM</div>\n';
      if (msg.aiHtml) {
        bodyParts += '    <div class="content">' + sanitizeHTML(msg.aiHtml) + "</div>\n";
      } else {
        bodyParts += '    <div class="content non-text">[empty response]</div>\n';
      }
      bodyParts += "  </div>\n\n";
    }
    const printScript = options.forPrint ? "  <script>window.onload=function(){setTimeout(function(){window.print()},500)};<\/script>\n" : "";
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>' + escapeHTML(meta.notebookTitle) + " - NotebookLM Chat Export</title>\n  <style>" + EXPORT_CSS + '</style>\n</head>\n<body>\n  <div class="metadata">\n    <h1>' + escapeHTML(meta.notebookTitle) + "</h1>\n    <dl>\n      <dt>Date</dt><dd>" + escapeHTML(meta.dateStr) + "</dd>\n      <dt>Platform</dt><dd>NotebookLM</dd>\n    </dl>\n  </div>\n\n" + bodyParts + printScript + "</body>\n</html>";
  }
  function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const ui = {
floatHost: null,
floatRoot: null,
overlayHost: null,
overlayRoot: null
  };
  const FLOAT_CSS = [
    ":host { position:fixed; bottom:24px; right:24px; z-index:2147483645; cursor:pointer; }",
    ".pill { display:flex; align-items:center; gap:10px; height:48px; padding:0 20px;",
    "  background:rgba(15,23,42,0.75); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);",
    "  border:1px solid rgba(255,255,255,0.08); border-radius:24px;",
    "  box-shadow:0 8px 32px rgba(0,0,0,0.35); transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);",
    "  font:500 13px/1 system-ui,sans-serif; color:#e2e8f0; white-space:nowrap; user-select:none; }",
    ".pill:hover { border-color:rgba(99,102,241,0.4); box-shadow:0 8px 40px rgba(99,102,241,0.15); }",
    ".dot { width:8px; height:8px; border-radius:50%; background:#4ade80;",
    "  animation:pulse 2s ease-in-out infinite; }",
    ".dot.active { background:linear-gradient(135deg,#6366f1,#c084fc); animation:none; }",
    ".dot.error { background:#f87171; animation:none; }",
    "@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }",
    ".label { flex:1; overflow:hidden; text-overflow:ellipsis; color:#94a3b8; }",
    ".label strong { color:#e2e8f0; font-weight:500; }",
    ".expand-icon { font-size:16px; color:#64748b; transition:transform 0.3s ease; }",
    ".pill:hover .expand-icon { transform:translateX(2px); }"
  ].join("\n");
  const PANEL_CSS = [
    ":host { position:fixed; bottom:24px; right:24px; z-index:2147483645; }",
    ".panel { width:360px; background:rgba(15,23,42,0.85); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);",
    "  border:1px solid rgba(255,255,255,0.08); border-radius:16px;",
    "  box-shadow:0 8px 32px rgba(0,0,0,0.4); overflow:hidden;",
    "  animation:panelIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }",
    "@keyframes panelIn { from { opacity:0; transform:translateY(12px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }",
    ".progress-row { display:flex; align-items:center; gap:14px; padding:16px 18px 8px; }",
    ".progress-ring { flex-shrink:0; width:48px; height:48px; }",
    ".progress-ring circle { transition:stroke-dashoffset 0.4s ease; }",
    ".meta { flex:1; min-width:0; }",
    ".meta .count { font:600 20px/1 system-ui,sans-serif; color:#e2e8f0; }",
    ".meta .count span { color:#64748b; font-weight:400; }",
    ".meta .file { font:11px/1.3 monospace; color:#94a3b8; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
    ".meta .progress-bar { height:3px; background:rgba(255,255,255,0.06); border-radius:2px; margin-top:8px; overflow:hidden; }",
    ".meta .progress-fill { height:100%; width:0%; background:linear-gradient(90deg,#6366f1,#c084fc,#f472b6);",
    "  border-radius:2px; transition:width 0.4s ease; }",
    ".log-area { padding:0 18px 8px; max-height:72px; overflow:hidden; }",
    ".log-line { font:11px/1.4 monospace; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
    ".log-line.info { color:#94a3b8; } .log-line.success { color:#4ade80; }",
    ".log-line.warn { color:#fbbf24; } .log-line.error { color:#f87171; }",
    ".footer { display:flex; justify-content:flex-end; padding:0 14px 12px; }",
    ".btn-stop { padding:6px 16px; border-radius:8px; border:1px solid rgba(248,113,113,0.3);",
    "  background:transparent; color:#f87171; font:500 12px/1 system-ui,sans-serif; cursor:pointer;",
    "  transition:all 0.2s ease; opacity:0.6; }",
    ".btn-stop:hover { opacity:1; background:rgba(248,113,113,0.1); border-color:#f87171; }",
    ".complete { text-align:center; padding:18px; }",
    ".complete .check { font-size:32px; line-height:1; margin-bottom:6px; }",
    ".complete .msg { font:500 14px/1 system-ui,sans-serif; color:#4ade80; }",
    ".complete .sub { font:12px/1 system-ui,sans-serif; color:#64748b; margin-top:4px; }"
  ].join("\n");
  const OVERLAY_CSS = [
    ":host { position:fixed; inset:0; z-index:2147483646; display:flex; align-items:center; justify-content:center; }",
    ".backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }",
    ".card { position:relative; width:480px; max-height:80vh; background:rgba(15,23,42,0.92); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);",
    "  border:1px solid rgba(255,255,255,0.08); border-radius:20px; box-shadow:0 16px 64px rgba(0,0,0,0.5);",
    "  display:flex; flex-direction:column; animation:overlayIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }",
    "@keyframes overlayIn { from { opacity:0; transform:scale(0.92) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }",
    ".header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06); }",
    ".header h2 { margin:0; font:600 15px/1 system-ui,sans-serif; color:#e2e8f0; }",
    ".header h2 span { color:#6366f1; }",
    ".btn-close { background:none; border:none; color:#64748b; font-size:20px; cursor:pointer; padding:0 4px; line-height:1; }",
    ".btn-close:hover { color:#e2e8f0; }",
    ".body { padding:18px 20px; flex:1; overflow-y:auto; }",
    ".body::-webkit-scrollbar { width:6px; }",
    ".body::-webkit-scrollbar-track { background:transparent; }",
    ".body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }",
    ".overlay-progress { display:flex; align-items:center; gap:16px; margin-bottom:18px; }",
    ".overlay-progress .progress-ring { width:56px; height:56px; flex-shrink:0; }",
    ".overlay-progress .progress-ring circle { transition:stroke-dashoffset 0.4s ease; }",
    ".overlay-progress .meta .count { font:600 22px/1 system-ui,sans-serif; color:#e2e8f0; }",
    ".overlay-progress .meta .file { font:12px/1.3 monospace; color:#94a3b8; margin-top:3px; }",
    ".overlay-progress .meta .progress-bar { height:4px; margin-top:10px; }",
    ".overlay-progress .meta .progress-fill { height:100%; width:0%; background:linear-gradient(90deg,#6366f1,#c084fc,#f472b6); border-radius:2px; transition:width 0.4s ease; }",
    ".terminal { background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); border-radius:10px;",
    "  padding:12px; overflow-y:auto; max-height:260px; font:12px/1.5 monospace; color:#94a3b8; }",
    ".terminal::-webkit-scrollbar { width:4px; }",
    ".terminal::-webkit-scrollbar-track { background:transparent; }",
    ".terminal::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }",
    ".log-entry { margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
    ".log-entry:last-child { margin-bottom:0; }",
    ".log-entry.info { color:#94a3b8; } .log-entry.success { color:#4ade80; }",
    ".log-entry.warn { color:#fbbf24; } .log-entry.error { color:#f87171; }",
    ".footer-btns { display:flex; gap:8px; margin-top:16px; justify-content:flex-end; }",
    ".btn { padding:8px 20px; border-radius:10px; font:600 13px/1 system-ui,sans-serif; cursor:pointer; transition:all 0.2s ease; }",
    ".btn-primary { background:linear-gradient(135deg,#6366f1,#a855f7); color:#fff; border:none; }",
    ".btn-primary:hover { box-shadow:0 4px 20px rgba(99,102,241,0.3); }",
    ".btn-primary:disabled { opacity:0.4; cursor:not-allowed; box-shadow:none; }",
    ".btn-stop { background:transparent; color:#f87171; border:1px solid rgba(248,113,113,0.3); }",
    ".btn-stop:hover { background:rgba(248,113,113,0.1); border-color:#f87171; }",
    ".tool-selector { display:flex; gap:12px; padding:12px 0; }",
    ".tool-card { flex:1; padding:20px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);",
    "  cursor:pointer; text-align:center; transition:all 0.2s ease; }",
    ".tool-card:hover { background:rgba(99,102,241,0.1); border-color:rgba(99,102,241,0.3); transform:translateY(-2px); }",
    ".tool-card .icon { font-size:32px; margin-bottom:8px; }",
    ".tool-card .name { font:500 14px/1 system-ui,sans-serif; color:#e2e8f0; }",
    ".tool-card .desc { font:12px/1.3 system-ui,sans-serif; color:#64748b; margin-top:4px; }",
    ".format-selector { display:flex; gap:8px; padding:12px 0; }",
    ".format-btn { flex:1; padding:8px 6px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);",
    "  background:rgba(255,255,255,0.02); color:#94a3b8; font:500 12px/1 system-ui,sans-serif; cursor:pointer;",
    "  text-align:center; transition:all 0.2s ease; }",
    ".format-btn:hover { border-color:rgba(99,102,241,0.25); color:#cbd5e1; }",
    ".format-btn.selected { background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.1));",
    "  border-color:rgba(99,102,241,0.4); color:#e2e8f0; }",
    ".format-btn .ext { font-size:10px; opacity:0.5; display:block; margin-top:2px; }"
  ].join("\n");
  const PROGRESS_SVG = [
    '<svg viewBox="0 0 120 120" class="progress-ring">',
    "  <defs>",
    '    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">',
    '      <stop offset="0%" stop-color="#6366f1"/>',
    '      <stop offset="50%" stop-color="#c084fc"/>',
    '      <stop offset="100%" stop-color="#f472b6"/>',
    "    </linearGradient>",
    '    <linearGradient id="pgSuccess" x1="0%" y1="0%" x2="100%" y2="0%">',
    '      <stop offset="0%" stop-color="#4ade80"/>',
    '      <stop offset="100%" stop-color="#22d3ee"/>',
    "    </linearGradient>",
    "  </defs>",
    '  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>',
    '  <circle class="ring-fg" cx="60" cy="60" r="50" fill="none" stroke="url(#pg)" stroke-width="6"',
    '    stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset="314.16"',
    '    transform="rotate(-90, 60, 60)"/>',
    '  <path class="checkmark" d="M48,62 L56,70 L74,48" fill="none" stroke="#4ade80" stroke-width="5"',
    '    stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="50" stroke-dashoffset="50" style="display:none"/>',
    "</svg>"
  ].join("\n");
  const CIRCUMFERENCE = 314.16;
  function createShadowContainer(styles) {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "closed" });
    if (styles) GM_addElement(root, "style", { textContent: styles });
    document.body.appendChild(host);
    return { host, root };
  }
  let currentState = "idle";
  let currentTool = null;
  let selectedFormat = "md";
  let lastLogLines = [];
  function createFloatPill() {
    const { host, root } = createShadowContainer(FLOAT_CSS);
    ui.floatHost = host;
    ui.floatRoot = root;
    const pill = document.createElement("div");
    pill.className = "pill";
    const dot = document.createElement("div");
    dot.className = "dot";
    pill.appendChild(dot);
    const label = document.createElement("div");
    label.className = "label";
    label.innerHTML = "<strong>NotebookLM</strong> Export";
    pill.appendChild(label);
    const expand = document.createElement("div");
    expand.className = "expand-icon";
    expand.textContent = "↗";
    pill.appendChild(expand);
    root.appendChild(pill);
    pill.addEventListener("click", function() {
      if (currentState === "running") {
        if (!root.querySelector(".panel")) showActivePanel();
        createOverlay(currentTool || "sources");
      } else if (currentState === "idle") {
        currentTool = null;
        createOverlay(null);
      } else {
        createOverlay(currentTool || "sources");
      }
    });
    return { host, root, pill, dot };
  }
  function showActivePanel() {
    if (!ui.floatRoot) return;
    const root = ui.floatRoot;
    root.innerHTML = "";
    GM_addElement(root, "style", { textContent: FLOAT_CSS + "\n" + PANEL_CSS });
    const panel = document.createElement("div");
    panel.className = "panel";
    const progressRow = document.createElement("div");
    progressRow.className = "progress-row";
    const svgWrapper = document.createElement("div");
    svgWrapper.className = "progress-ring";
    svgWrapper.innerHTML = PROGRESS_SVG;
    progressRow.appendChild(svgWrapper);
    const meta = document.createElement("div");
    meta.className = "meta";
    const countEl = document.createElement("div");
    countEl.className = "count";
    countEl.innerHTML = "0 <span>/ 0</span>";
    meta.appendChild(countEl);
    const fileEl = document.createElement("div");
    fileEl.className = "file";
    fileEl.textContent = "Waiting...";
    meta.appendChild(fileEl);
    const barOuter = document.createElement("div");
    barOuter.className = "progress-bar";
    const barFill = document.createElement("div");
    barFill.className = "progress-fill";
    barOuter.appendChild(barFill);
    meta.appendChild(barOuter);
    progressRow.appendChild(meta);
    panel.appendChild(progressRow);
    const logArea = document.createElement("div");
    logArea.className = "log-area";
    const recentLogs = lastLogLines.slice(-3);
    for (let i = 0; i < recentLogs.length; i++) {
      const line = document.createElement("div");
      line.className = "log-line " + recentLogs[i].level;
      line.textContent = recentLogs[i].text;
      logArea.appendChild(line);
    }
    panel.appendChild(logArea);
    const footer = document.createElement("div");
    footer.className = "footer";
    const stopBtn = document.createElement("button");
    stopBtn.className = "btn-stop";
    stopBtn.textContent = "■ Stop";
    stopBtn.onclick = function() {
      STATE.isCancelled = true;
      log.warn("Stop requested by user.");
      addLog("Stop requested by user.", LOG_LEVEL.WARN);
    };
    footer.appendChild(stopBtn);
    panel.appendChild(footer);
    root.appendChild(panel);
    ui.floatRoot._countEl = countEl;
    ui.floatRoot._fileEl = fileEl;
    ui.floatRoot._barFill = barFill;
    ui.floatRoot._logArea = logArea;
    ui.floatRoot._svgWrapper = svgWrapper;
    ui.floatRoot._stopBtn = stopBtn;
    ui.floatRoot._panel = panel;
  }
  function updateProgressRing(pct) {
    const svg = ui.floatRoot && ui.floatRoot._svgWrapper;
    if (svg) {
      const ring = svg.querySelector(".ring-fg");
      if (ring) ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct / 100);
    }
    if (ui.overlayRoot && ui.overlayRoot._ring) {
      ui.overlayRoot._ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct / 100);
    }
  }
  function showSuccess(totalCount) {
    if (!ui.floatRoot) return;
    currentState = "complete";
    const root = ui.floatRoot;
    root.innerHTML = "";
    GM_addElement(root, "style", { textContent: FLOAT_CSS + "\n" + PANEL_CSS });
    const panel = document.createElement("div");
    panel.className = "panel";
    const complete = document.createElement("div");
    complete.className = "complete";
    const check = document.createElement("div");
    check.className = "check";
    check.textContent = "✓";
    complete.appendChild(check);
    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = "Extraction Complete!";
    complete.appendChild(msg);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = totalCount + " source" + (totalCount !== 1 ? "s" : "") + " exported";
    complete.appendChild(sub);
    panel.appendChild(complete);
    root.appendChild(panel);
    setTimeout(function() {
      if (root._panel) {
        root._panel.style.opacity = "0";
        root._panel.style.transform = "scale(0.9)";
      }
      setTimeout(function() {
        currentState = "idle";
        root.innerHTML = "";
        GM_addElement(root, "style", { textContent: FLOAT_CSS });
        createFloatPill();
      }, 400);
    }, 6e3);
  }
  let overlayLogBuffer = [];
  function createOverlay(tool) {
    if (tool !== void 0) currentTool = tool;
    if (ui.overlayHost) {
      ui.overlayHost.remove();
      ui.overlayHost = null;
      ui.overlayRoot = null;
    }
    const { host, root } = createShadowContainer(OVERLAY_CSS);
    ui.overlayHost = host;
    ui.overlayRoot = root;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.addEventListener("click", closeOverlay);
    root.appendChild(backdrop);
    const card = document.createElement("div");
    card.className = "card";
    const header = document.createElement("div");
    header.className = "header";
    if (currentTool === null) {
      const h2 = document.createElement("h2");
      h2.innerHTML = "<span>NotebookLM</span> Export";
      header.appendChild(h2);
    } else {
      const h2 = document.createElement("h2");
      h2.innerHTML = "<span>NotebookLM</span> " + (currentTool === "chat" ? "Chat Export" : "Source Export");
      header.appendChild(h2);
      const backBtn = document.createElement("button");
      backBtn.className = "btn-close";
      backBtn.textContent = "←";
      backBtn.title = "Back to tool selection";
      backBtn.addEventListener("click", function() {
        createOverlay(null);
      });
      header.appendChild(backBtn);
    }
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", closeOverlay);
    header.appendChild(closeBtn);
    card.appendChild(header);
    const body = document.createElement("div");
    body.className = "body";
    if (currentTool === null) {
      const selector = document.createElement("div");
      selector.className = "tool-selector";
      const sourcesCard = document.createElement("div");
      sourcesCard.className = "tool-card";
      sourcesCard.innerHTML = '<div class="icon">📄</div><div class="name">Export Sources</div><div class="desc">Extract all source files as Markdown</div>';
      sourcesCard.addEventListener("click", function() {
        createOverlay("sources");
      });
      selector.appendChild(sourcesCard);
      const chatCard = document.createElement("div");
      chatCard.className = "tool-card";
      chatCard.innerHTML = '<div class="icon">💬</div><div class="name">Export Chat</div><div class="desc">Download chat as Markdown, HTML or PDF</div>';
      chatCard.addEventListener("click", function() {
        createOverlay("chat");
      });
      selector.appendChild(chatCard);
      body.appendChild(selector);
      if (overlayLogBuffer.length > 0) {
        const terminal2 = document.createElement("div");
        terminal2.className = "terminal";
        const termLog2 = document.createElement("div");
        termLog2.className = "terminal-log";
        for (let i = 0; i < overlayLogBuffer.length; i++) {
          const entry = overlayLogBuffer[i];
          const el = document.createElement("div");
          el.className = "log-entry " + entry.level;
          el.textContent = entry.text;
          termLog2.appendChild(el);
        }
        terminal2.appendChild(termLog2);
        terminal2.scrollTop = terminal2.scrollHeight;
        body.appendChild(terminal2);
      }
      card.appendChild(body);
      root.appendChild(card);
      ui.overlayRoot._card = card;
      return;
    }
    const ovProgress = document.createElement("div");
    ovProgress.className = "overlay-progress";
    const ovSvg = document.createElement("div");
    ovSvg.className = "progress-ring";
    ovSvg.innerHTML = PROGRESS_SVG;
    ovProgress.appendChild(ovSvg);
    const ovMeta = document.createElement("div");
    ovMeta.className = "meta";
    const ovCount = document.createElement("div");
    ovCount.className = "count";
    ovCount.innerHTML = "0 <span>/ 0</span>";
    ovMeta.appendChild(ovCount);
    const ovFile = document.createElement("div");
    ovFile.className = "file";
    ovFile.textContent = "";
    ovMeta.appendChild(ovFile);
    const ovBarOuter = document.createElement("div");
    ovBarOuter.className = "progress-bar";
    const ovBarFill = document.createElement("div");
    ovBarFill.className = "progress-fill";
    ovBarOuter.appendChild(ovBarFill);
    ovMeta.appendChild(ovBarOuter);
    ovProgress.appendChild(ovMeta);
    body.appendChild(ovProgress);
    let fmtStartBtn = null;
    if (currentTool === "chat") {
      const fmtSel = document.createElement("div");
      fmtSel.className = "format-selector";
      const formats = [
        { key: "md", label: "Markdown", ext: ".md" },
        { key: "html", label: "HTML", ext: ".html" },
        { key: "pdf", label: "PDF (Print)", ext: ".pdf" }
      ];
      for (let i = 0; i < formats.length; i++) {
        const btn = document.createElement("button");
        btn.className = "format-btn" + (formats[i].key === selectedFormat ? " selected" : "");
        btn.innerHTML = formats[i].label + '<span class="ext">' + formats[i].ext + "</span>";
        btn.dataset.format = formats[i].key;
        btn.addEventListener("click", function() {
          const parent = btn.parentNode;
          if (!parent) return;
          const allBtns = parent.querySelectorAll(".format-btn");
          for (let j = 0; j < allBtns.length; j++) {
            allBtns[j].className = "format-btn";
          }
          btn.className = "format-btn selected";
          selectedFormat = btn.dataset.format;
          if (fmtStartBtn && !fmtStartBtn.disabled) {
            fmtStartBtn.textContent = "▶ Export " + btn.dataset.format.toUpperCase();
          }
        });
        fmtSel.appendChild(btn);
      }
      body.appendChild(fmtSel);
    }
    const terminal = document.createElement("div");
    terminal.className = "terminal";
    const termLog = document.createElement("div");
    termLog.className = "terminal-log";
    terminal.appendChild(termLog);
    body.appendChild(terminal);
    const footerBtns = document.createElement("div");
    footerBtns.className = "footer-btns";
    const startBtn = document.createElement("button");
    startBtn.className = "btn btn-primary";
    if (currentTool === "chat") {
      fmtStartBtn = startBtn;
      startBtn.textContent = currentState === "running" ? "Running..." : "▶ Export " + selectedFormat.toUpperCase();
      startBtn.disabled = currentState === "running";
      startBtn.onclick = function() {
        closeOverlay();
        currentState = "running";
        showActivePanel();
        startChatExport(selectedFormat);
      };
    } else {
      startBtn.textContent = currentState === "running" ? "Running..." : "▶ Start Extraction";
      startBtn.disabled = currentState === "running";
      startBtn.onclick = function() {
        closeOverlay();
        currentState = "running";
        showActivePanel();
        runProcess();
      };
    }
    footerBtns.appendChild(startBtn);
    const stopBtn = document.createElement("button");
    stopBtn.className = "btn btn-stop";
    stopBtn.textContent = "■ Stop";
    stopBtn.style.display = currentState === "running" ? "block" : "none";
    stopBtn.onclick = function() {
      STATE.isCancelled = true;
      log.warn("Stop requested by user.");
      addLog("Stop requested by user.", LOG_LEVEL.WARN);
    };
    footerBtns.appendChild(stopBtn);
    body.appendChild(footerBtns);
    card.appendChild(body);
    root.appendChild(card);
    ui.overlayRoot._ring = ovSvg.querySelector(".ring-fg");
    ui.overlayRoot._countEl = ovCount;
    ui.overlayRoot._fileEl = ovFile;
    ui.overlayRoot._barFill = ovBarFill;
    ui.overlayRoot._termLog = termLog;
    ui.overlayRoot._startBtn = startBtn;
    ui.overlayRoot._stopBtn = stopBtn;
    ui.overlayRoot._terminal = terminal;
    ui.overlayRoot._card = card;
    for (let i = 0; i < overlayLogBuffer.length; i++) {
      const entry = overlayLogBuffer[i];
      const el = document.createElement("div");
      el.className = "log-entry " + entry.level;
      el.textContent = entry.text;
      termLog.appendChild(el);
    }
    terminal.scrollTop = terminal.scrollHeight;
    if (ui.floatRoot && currentState === "running") {
      const oldCount = ui.floatRoot._countEl;
      if (oldCount) {
        ovCount.innerHTML = oldCount.innerHTML;
      }
      const oldFile = ui.floatRoot._fileEl;
      if (oldFile && oldFile.textContent) {
        ovFile.textContent = oldFile.textContent;
      }
      const oldPct = ui.floatRoot._barFill ? ui.floatRoot._barFill.style.width : "0%";
      ovBarFill.style.width = oldPct;
    }
  }
  function startChatExport(format) {
    format = format || "md";
    currentTool = "chat";
    currentState = "running";
    showActivePanel();
    addLog("Starting chat export (" + format.toUpperCase() + ")...", LOG_LEVEL.INFO);
    try {
      if (format === "md") {
        const markdown = extractChatToMarkdown(htmlToMarkdown);
        if (!markdown) {
          addLog("No chat messages found.", LOG_LEVEL.ERROR);
          currentState = "idle";
          return;
        }
        downloadBlob(
          new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
          "NotebookLM Chat.md"
        );
      } else {
        const messagesData = extractChatMessages();
        if (!messagesData || messagesData.messages.length === 0) {
          addLog("No chat messages found.", LOG_LEVEL.ERROR);
          currentState = "idle";
          return;
        }
        const html = buildChatHTMLDocument(messagesData, { forPrint: format === "pdf" });
        if (format === "html") {
          downloadBlob(
            new Blob([html], { type: "text/html;charset=utf-8" }),
            "NotebookLM Chat.html"
          );
        } else {
          const blob = new Blob([html], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const printWindow = window.open(url, "_blank");
          if (!printWindow) {
            addLog("Popup blocked — downloading HTML instead. Use File > Print to save as PDF.", LOG_LEVEL.WARN);
            downloadBlob(blob, "NotebookLM Chat.html");
          }
          setTimeout(function() {
            URL.revokeObjectURL(url);
          }, 3e4);
        }
      }
      addLog("Chat exported successfully!", LOG_LEVEL.SUCCESS);
      showSuccess(1);
    } catch (err) {
      addLog("Chat export failed: " + err.message, LOG_LEVEL.ERROR);
      currentState = "idle";
    }
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      a.remove();
      URL.revokeObjectURL(url);
    }, 2e3);
  }
  function closeOverlay() {
    if (ui.overlayHost) {
      ui.overlayHost.remove();
      ui.overlayHost = null;
      ui.overlayRoot = null;
    }
  }
  let _lastTotal = 0;
  function addLog(msg, level) {
    level = level || LOG_LEVEL.INFO;
    const timestamp = "[" + ( new Date()).toLocaleTimeString(void 0, { hour12: false }) + "]";
    const text = timestamp + " " + msg;
    overlayLogBuffer.push({ text, level });
    while (overlayLogBuffer.length > 200) overlayLogBuffer.shift();
    if (ui.floatRoot && ui.floatRoot._logArea) {
      const line = document.createElement("div");
      line.className = "log-line " + level;
      line.textContent = text;
      ui.floatRoot._logArea.appendChild(line);
      while (ui.floatRoot._logArea.children.length > 3) {
        ui.floatRoot._logArea.removeChild(ui.floatRoot._logArea.firstChild);
      }
    }
    if (ui.overlayRoot && ui.overlayRoot._termLog) {
      const entry = document.createElement("div");
      entry.className = "log-entry " + level;
      entry.textContent = text;
      ui.overlayRoot._termLog.appendChild(entry);
      while (ui.overlayRoot._termLog.children.length > TIMING.LOG_MAX_ENTRIES) {
        ui.overlayRoot._termLog.removeChild(ui.overlayRoot._termLog.firstChild);
      }
      if (ui.overlayRoot._terminal) {
        ui.overlayRoot._terminal.scrollTop = ui.overlayRoot._terminal.scrollHeight;
      }
    }
    lastLogLines.push({ text, level });
    while (lastLogLines.length > 50) lastLogLines.shift();
  }
  function updateProgress(current, total) {
    _lastTotal = total;
    const pct = Math.round(current / total * 100);
    const label = current + " <span>/ " + total + "</span>";
    if (ui.floatRoot && ui.floatRoot._countEl) {
      ui.floatRoot._countEl.innerHTML = label;
    }
    if (ui.floatRoot && ui.floatRoot._barFill) {
      ui.floatRoot._barFill.style.width = pct + "%";
    }
    if (ui.overlayRoot && ui.overlayRoot._countEl) {
      ui.overlayRoot._countEl.innerHTML = label;
    }
    if (ui.overlayRoot && ui.overlayRoot._barFill) {
      ui.overlayRoot._barFill.style.width = pct + "%";
    }
    updateProgressRing(pct);
  }
  function initUI() {
    if (ui.floatHost) {
      ui.floatHost.remove();
      ui.floatHost = null;
      ui.floatRoot = null;
    }
    closeOverlay();
    currentState = "idle";
    overlayLogBuffer = [];
    lastLogLines = [];
    createFloatPill();
    uiCallbacks.addLog = addLog;
    uiCallbacks.updateProgress = updateProgress;
    uiCallbacks.setStatusText = function(text) {
      if (text === "Stopped") {
        currentState = "idle";
        if (ui.floatRoot) {
          ui.floatRoot.innerHTML = "";
          GM_addElement(ui.floatRoot, "style", { textContent: FLOAT_CSS });
          createFloatPill();
        }
        return;
      }
      if (ui.floatRoot && ui.floatRoot._fileEl) ui.floatRoot._fileEl.textContent = text;
      if (ui.overlayRoot && ui.overlayRoot._fileEl) ui.overlayRoot._fileEl.textContent = text;
    };
    uiCallbacks.setStartBtnState = function(disabled, text) {
      if (ui.overlayRoot && ui.overlayRoot._startBtn) {
        ui.overlayRoot._startBtn.disabled = disabled;
        ui.overlayRoot._startBtn.textContent = text;
      }
    };
    uiCallbacks.setStopBtnVisible = function(visible) {
      if (ui.overlayRoot && ui.overlayRoot._stopBtn) {
        ui.overlayRoot._stopBtn.style.display = visible ? "block" : "none";
      }
    };
    uiCallbacks.restartUI = function() {
      if (ui.floatHost) {
        ui.floatHost.style.transition = "opacity 0.3s ease";
        ui.floatHost.style.opacity = "0";
        setTimeout(function() {
          initUI();
        }, 350);
      } else {
        initUI();
      }
    };
    uiCallbacks.removeStatusBar = function() {
      if (currentState === "running") {
        showSuccess(_lastTotal);
      }
    };
  }
  
  registerMenuStart(() => {
    initUI();
  });

})();
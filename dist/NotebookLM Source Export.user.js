// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.5
// @author       marmoris-x
// @description  Export NotebookLM sources as organized ZIP with markdown conversion
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @match        https://notebooklm.google.com/*
// @sandbox      JavaScript
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @inject-into  content
// @run-at       document-idle
// @noframes
// @unwrap
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
  var HEADING_TAGS = { "H1": "#", "H2": "##", "H3": "###", "H4": "####", "H5": "#####", "H6": "######" };
  function htmlToMarkdown(el) {
    if (!el) return "";
    var out = "";
    walk(el);
    return out.trim().replace(/\n{3,}/g, "\n\n");
    function walk(node) {
      if (!node) return;
      var children = node.childNodes;
      if (!children || children.length === 0) {
        if (node.nodeType === Node.TEXT_NODE) {
          var text = node.textContent.replace(/\s+/g, " ");
          if (text && text !== " ") out += text;
        }
        return;
      }
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === Node.TEXT_NODE) {
          var t = child.textContent.replace(/\s+/g, " ");
          if (t && t !== " ") out += t;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        var tag = child.tagName.toUpperCase();
        if (tag === "BR") {
          out += "\n";
          continue;
        }
        if (tag === "HR") {
          out += "\n\n---\n\n";
          continue;
        }
        if (HEADING_TAGS[tag]) {
          out += "\n\n" + HEADING_TAGS[tag] + " ";
          walk(child);
          out += "\n\n";
          continue;
        }
        if (tag === "P" || tag === "DIV") {
          out += "\n\n";
          walk(child);
          out += "\n\n";
          continue;
        }
        if (tag === "PRE") {
          out += "\n\n```\n" + (child.textContent || "") + "\n```\n\n";
          continue;
        }
        if (tag === "BLOCKQUOTE") {
          out += "\n\n> ";
          walkInline(child);
          out += "\n\n";
          continue;
        }
        if (tag === "UL" || tag === "OL") {
          out += "\n\n";
          walkList(child, tag === "OL", 1);
          out += "\n\n";
          continue;
        }
        if (tag === "TABLE") {
          out += "\n\n";
          walkTable(child);
          out += "\n\n";
          continue;
        }
        if (tag === "IMG") {
          var src = child.getAttribute("src") || "";
          var alt = child.getAttribute("alt") || "";
          out += "![" + alt + "](" + src + ")";
          continue;
        }
        if (tag === "STRONG" || tag === "B") {
          out += "**";
          walk(child);
          out += "**";
          continue;
        }
        if (tag === "EM" || tag === "I") {
          out += "*";
          walk(child);
          out += "*";
          continue;
        }
        if (tag === "CODE") {
          out += "`" + (child.textContent || "") + "`";
          continue;
        }
        if (tag === "A") {
          var href = child.getAttribute("href") || "";
          out += "[";
          walk(child);
          out += "](" + href + ")";
          continue;
        }
        if (tag === "DEL" || tag === "S") {
          out += "~~";
          walk(child);
          out += "~~";
          continue;
        }
        if (tag === "U") {
          out += "<u>";
          walk(child);
          out += "</u>";
          continue;
        }
        walk(child);
      }
    }
    function walkInline(node) {
      if (!node) return;
      var children = node.childNodes;
      if (!children) return;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.textContent;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        var tag = child.tagName.toUpperCase();
        if (tag === "STRONG" || tag === "B") {
          out += "**";
          walkInline(child);
          out += "**";
        } else if (tag === "EM" || tag === "I") {
          out += "*";
          walkInline(child);
          out += "*";
        } else if (tag === "CODE") {
          out += "`" + (child.textContent || "") + "`";
        } else if (tag === "A") {
          var href = child.getAttribute("href") || "";
          out += "[";
          walkInline(child);
          out += "](" + href + ")";
        } else if (tag === "BR") {
          out += " ";
        } else if (tag === "IMG") {
          var src = child.getAttribute("src") || "";
          var alt = child.getAttribute("alt") || "";
          out += "![" + alt + "](" + src + ")";
        } else {
          walkInline(child);
        }
      }
    }
    function walkList(node, ordered, depth) {
      var items = node.querySelectorAll(":scope > li");
      for (var i = 0; i < items.length; i++) {
        var prefix = ordered ? i + 1 + ". " : "- ";
        out += "  ".repeat(depth - 1) + prefix;
        walkInline(items[i]);
        out += "\n";
      }
    }
    function walkTable(node) {
      var rows = node.querySelectorAll("tr");
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].querySelectorAll("td, th");
        out += "| ";
        for (var c = 0; c < cells.length; c++) {
          walkInline(cells[c]);
          out += " | ";
        }
        out += "\n";
        if (r === 0) {
          out += "| ";
          for (c = 0; c < cells.length; c++) {
            out += "--- | ";
          }
          out += "\n";
        }
      }
    }
  }
  var crcTable = null;
  function buildCRCTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var j = 0; j < 8; j++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      crcTable[i] = c;
    }
    return crcTable;
  }
  function crc32(data) {
    var table = buildCRCTable();
    var crc = 4294967295;
    for (var i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 255] ^ crc >>> 8;
    }
    return (crc ^ 4294967295) >>> 0;
  }
  var encoder = new TextEncoder();
  function buildStoreZip(files) {
    var localHeaders = [];
    var centralEntries = [];
    var offsets = [];
    var offset = 0;
    for (var f = 0; f < files.length; f++) {
      var nameBytes = encoder.encode(files[f].name);
      var data = files[f].data;
      var crc = crc32(data);
      var nameLen = nameBytes.length;
      var dataLen = data.length;
      var lh = new ArrayBuffer(30 + nameLen);
      var lv = new DataView(lh);
      lv.setUint32(0, 67324752, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 2048, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataLen, true);
      lv.setUint32(22, dataLen, true);
      lv.setUint16(26, nameLen, true);
      lv.setUint16(28, 0, true);
      var lhBytes = new Uint8Array(lh);
      lhBytes.set(nameBytes, 30);
      localHeaders.push(lhBytes);
      offsets.push(offset);
      offset += lhBytes.length + dataLen;
    }
    var total = offset;
    var cdOffset = total;
    for (f = 0; f < files.length; f++) {
      var cdNameBytes = encoder.encode(files[f].name);
      var cdNameLen = cdNameBytes.length;
      var cd = new ArrayBuffer(46 + cdNameLen);
      var cv = new DataView(cd);
      cv.setUint32(0, 33639248, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 2048, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc32(files[f].data), true);
      cv.setUint32(20, files[f].data.length, true);
      cv.setUint32(24, files[f].data.length, true);
      cv.setUint16(28, cdNameLen, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offsets[f], true);
      var cdBytes = new Uint8Array(cd);
      cdBytes.set(cdNameBytes, 46);
      centralEntries.push(cdBytes);
      total += cdBytes.length;
    }
    var cdSize = centralEntries.reduce(function(s, e) {
      return s + e.length;
    }, 0);
    total += 22;
    var out = new Uint8Array(total);
    var pos = 0;
    for (f = 0; f < files.length; f++) {
      out.set(localHeaders[f], pos);
      pos += localHeaders[f].length;
      out.set(files[f].data, pos);
      pos += files[f].data.length;
    }
    for (f = 0; f < centralEntries.length; f++) {
      out.set(centralEntries[f], pos);
      pos += centralEntries[f].length;
    }
    var eocd = new DataView(out.buffer, pos, 22);
    eocd.setUint32(0, 101010256, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, files.length, true);
    eocd.setUint16(10, files.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, cdOffset, true);
    eocd.setUint16(20, 0, true);
    return out;
  }
  function createShadowContainer(opts) {
    opts = opts || {};
    var host = document.createElement(opts.tag || "div");
    if (opts.id) host.id = opts.id;
    if (opts.className) host.className = opts.className;
    var root = host.attachShadow({ mode: "closed" });
    if (opts.styles) {
      var style = document.createElement("style");
      style.textContent = opts.styles;
      root.appendChild(style);
    }
    document.body.appendChild(host);
    return { host, root };
  }
  function createStatusBar(opts) {
    opts = opts || {};
    var accent = opts.accentColor || "#2196F3";
    var container = createShadowContainer({
      styles: [
        ":host { position:fixed; bottom:0; right:0; z-index:2147483646;",
        "background:#1e1e1e; color:#e0e0e0; font:12px system-ui,sans-serif;",
        "padding:8px 14px; border-radius:8px 0 0 0; min-width:200px; max-width:360px;",
        "border-top:3px solid " + accent + "; border-left:3px solid " + accent + "; }",
        ".text { margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
        ".bar { height:4px; background:#333; border-radius:2px; overflow:hidden; }",
        ".fill { height:100%; width:0%; background:" + accent + "; transition:width 0.3s ease; }"
      ].join("")
    });
    var textEl = document.createElement("div");
    textEl.className = "text";
    var fillEl = document.createElement("div");
    fillEl.className = "fill";
    var barEl = document.createElement("div");
    barEl.className = "bar";
    barEl.appendChild(fillEl);
    container.root.appendChild(textEl);
    container.root.appendChild(barEl);
    return {
      host: container.host,
      root: container.root,
      setText: function(msg) {
        textEl.textContent = msg;
      },
      setProgress: function(pct) {
        fillEl.style.width = Math.min(100, Math.max(0, pct)) + "%";
      },
      remove: function() {
        if (container.host.parentNode) container.host.parentNode.removeChild(container.host);
      }
    };
  }
  function createSidebar(opts) {
    opts = opts || {};
    var width = opts.width || 340;
    var accent = opts.accentColor || "#2196F3";
    var title = opts.title || "";
    var isOpen = false;
    var baseCSS = [
      ":host { position:fixed; top:0; right:0; width:" + width + "px; height:100vh; z-index:2147483645;",
      "background:#1a1a2e; color:#e0e0e0; font:13px/1.5 system-ui,sans-serif;",
      "transform:translateX(" + width + "px); transition:transform 0.3s ease;",
      "display:flex; flex-direction:column; }",
      ":host(.open) { transform:translateX(0); }",
      ".header { display:flex; align-items:center; padding:10px 14px; background:#16213e;",
      "border-bottom:1px solid #0f3460; cursor:move; user-select:none; flex-shrink:0; }",
      ".header h2 { margin:0; font-size:14px; font-weight:600; color:" + accent + "; flex:1; }",
      ".header button { background:none; border:none; color:#e0e0e0; cursor:pointer; font-size:18px;",
      "padding:0 4px; line-height:1; }",
      ".header button:hover { color:" + accent + "; }",
      ".body { flex:1; overflow-y:auto; padding:12px 14px; }",
      ".body::-webkit-scrollbar { width:6px; }",
      ".body::-webkit-scrollbar-track { background:transparent; }",
      ".body::-webkit-scrollbar-thumb { background:#0f3460; border-radius:3px; }",
      opts.cssOverrides || ""
    ].join("");
    var container = createShadowContainer({ styles: baseCSS });
    var root = container.root;
    var header = document.createElement("div");
    header.className = "header";
    var h2 = document.createElement("h2");
    h2.textContent = title;
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close sidebar");
    header.appendChild(h2);
    header.appendChild(closeBtn);
    root.appendChild(header);
    var body = document.createElement("div");
    body.className = "body";
    root.appendChild(body);
    var tab = document.createElement("div");
    var tabRoot = tab.attachShadow({ mode: "closed" });
    var tabStyle = document.createElement("style");
    tabStyle.textContent = [
      ":host { position:fixed; top:50%; z-index:2147483644; background:" + accent + "; color:#fff;",
      "padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;",
      "writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);",
      "right:" + width + "px; transform:translateY(-50%) translateX(100%);",
      "transition:right 0.3s ease, transform 0.3s ease; }",
      ":host(:hover) { filter:brightness(1.1); }",
      ":host(.open) { right:" + (width + 8) + "px; transform:translateY(-50%) translateX(0); }"
    ].join("");
    var tabSpan = document.createElement("span");
    tabSpan.textContent = title;
    tabRoot.appendChild(tabStyle);
    tabRoot.appendChild(tabSpan);
    document.body.appendChild(tab);
    function open() {
      if (isOpen) return;
      isOpen = true;
      container.host.classList.add("open");
      tab.classList.add("open");
      document.documentElement.style.marginRight = width + "px";
      if (opts.onOpen) opts.onOpen();
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      container.host.classList.remove("open");
      tab.classList.remove("open");
      document.documentElement.style.marginRight = "";
      if (opts.onClose) opts.onClose();
    }
    function toggle() {
      if (isOpen) close();
      else open();
    }
    var dragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
    header.addEventListener("mousedown", function(e) {
      if (e.target === closeBtn) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(container.host.style.right || 0, 10);
      startTop = parseInt(container.host.style.top || 0, 10);
      e.preventDefault();
    });
    document.addEventListener("mousemove", function(e) {
      if (!dragging) return;
      container.host.style.right = startRight - (e.clientX - startX) + "px";
      container.host.style.top = startTop + (e.clientY - startY) + "px";
    });
    document.addEventListener("mouseup", function() {
      dragging = false;
    });
    closeBtn.addEventListener("click", close);
    tab.addEventListener("click", toggle);
    return {
      host: container.host,
      root,
      bodyEl: body,
      tabEl: tab,
      open,
      close,
      toggle,
      isOpen: function() {
        return isOpen;
      },
      setTitle: function(t) {
        h2.textContent = t;
        tabSpan.textContent = t;
      }
    };
  }
  var CONFIG = {
    audio: { enabled: true, vol: 0.15 },
    selectors: {
      closeBtn: 'button[mattooltip="Quellenansicht schließen"]',
      content: "labs-tailwind-structural-element-view-v2",
      notebookTitle: ".title-label-inner.mat-title-large"
    }
  };
  var LOG_LEVEL = { INFO: "info", SUCCESS: "success", WARN: "warn", ERROR: "error" };
  var TIMING = {
    CONTENT_POLL_ATTEMPTS: 15,
    CONTENT_POLL_INTERVAL_MS: 200,
    CONTENT_RENDER_DELAY_MS: 1200,
    CONTENT_GONE_ATTEMPTS: 15,
    MIN_CONTENT_LENGTH_CHARS: 20,
    SOURCE_CLOSE_WAIT_MS: 1500,
    KEEP_ALIVE_VOLUME: 1e-3,
    LOG_MAX_ENTRIES: 50,
    AUDIO_NOTE_DELAYS_MS: [0, 100, 200]
  };
  var STATE = {
    isCancelled: false,
    keepAliveAudio: null,
    menuStartId: null,
    menuStopId: null
  };
  var SoundFX = {
    _ctx: null,
    get ctx() {
      if (!this._ctx && CONFIG.audio.enabled) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this._ctx;
    },
playTone: function(freq, type, duration, vol) {
      vol = vol || CONFIG.audio.vol;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
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
      var delays = TIMING.AUDIO_NOTE_DELAYS_MS;
      var notes = [
        { freq: 440, duration: 0.6, delay: delays[0] },
        { freq: 554, duration: 0.6, delay: delays[1] },
        { freq: 659, duration: 0.8, delay: delays[2] }
      ];
      notes.forEach(function(n) {
        setTimeout(function() {
          SoundFX.playTone(n.freq, "sine", n.duration);
        }, n.delay);
      });
    }
  };
  var ui = {
    sidebar: null,
    statusBar: null,
    terminalEl: null,
    stopBtn: null
  };
  function addLog(msg, level) {
    var terminalEl = ui.terminalEl;
    if (!terminalEl) return;
    var entry = document.createElement("div");
    entry.className = "log-entry log-" + (level || LOG_LEVEL.INFO);
    entry.textContent = "[" + ( new Date()).toLocaleTimeString(void 0, { hour12: false }) + "] " + msg;
    terminalEl.appendChild(entry);
    while (terminalEl.children.length > TIMING.LOG_MAX_ENTRIES) {
      terminalEl.removeChild(terminalEl.firstChild);
    }
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }
  function updateProgress(current, total) {
    var percent = Math.round(current / total * 100);
    var statusBar = ui.statusBar;
    if (statusBar) {
      statusBar.setProgress(percent);
      statusBar.setText("Processing: " + current + "/" + total);
    }
  }
  function initUI() {
    if (ui.sidebar) return;
    createLogger("NotebookLM Source Export");
    var sidebar = createSidebar({
      title: "NotebookLM Export",
      width: 420,
      accentColor: "#3b82f6"
    });
    ui.sidebar = sidebar;
    var styleEl = document.createElement("style");
    styleEl.textContent = [
      ".btn { width:100%; padding:10px; border-radius:4px; font:600 12px/1 system-ui,sans-serif;",
      "  text-transform:uppercase; letter-spacing:0.5px; cursor:pointer; margin-top:8px; }",
      ".btn-primary { background:#3b82f6; color:#fff; border:1px solid #2563eb; }",
      ".btn-primary:hover { background:#2563eb; }",
      ".btn-primary:disabled { background:#1e293b; border-color:#334155; color:#475569; cursor:not-allowed; }",
      ".btn-stop { background:transparent; color:#ef4444; border:1px solid #ef4444; display:none; }",
      ".btn-stop:hover { background:rgba(239,68,68,0.1); }",
      ".terminal { height:140px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05);",
      "  border-radius:4px; padding:10px; overflow-y:auto; font:11px/1.4 monospace; color:#94a3b8; }",
      ".log-entry { margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
      ".log-info { color:#94a3b8; } .log-success { color:#4ade80; }",
      ".log-warn { color:#fbbf24; } .log-error { color:#f87171; }",
      ".terminal::-webkit-scrollbar { width:4px; }",
      ".terminal::-webkit-scrollbar-track { background:transparent; }",
      ".terminal::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }"
    ].join("\n");
    sidebar.root.appendChild(styleEl);
    var terminalEl = document.createElement("div");
    terminalEl.className = "terminal";
    ui.terminalEl = terminalEl;
    sidebar.bodyEl.appendChild(terminalEl);
    addLog("Interface loaded.", LOG_LEVEL.INFO);
    addLog("Waiting for user command...", LOG_LEVEL.INFO);
    var startBtn = document.createElement("button");
    startBtn.className = "btn btn-primary";
    startBtn.textContent = "Start Extraction";
    startBtn.onclick = function() {
      runProcess(startBtn);
    };
    sidebar.bodyEl.appendChild(startBtn);
    var stopBtn = document.createElement("button");
    stopBtn.className = "btn btn-stop";
    stopBtn.textContent = "Stop";
    stopBtn.onclick = function() {
      STATE.isCancelled = true;
      createLogger("NotebookLM Source Export").warn("Stop requested by user.");
      addLog("Stop requested by user.", LOG_LEVEL.WARN);
    };
    ui.stopBtn = stopBtn;
    sidebar.bodyEl.appendChild(stopBtn);
    sidebar.open();
    var statusBar = createStatusBar({ accentColor: "#3b82f6" });
    ui.statusBar = statusBar;
    statusBar.setText("Ready");
  }
  var log = createLogger("NotebookLM Source Export");
  function wait(ms) {
    return new Promise(function(r) {
      setTimeout(r, ms);
    });
  }
  function startKeepAlive() {
    STATE.keepAliveAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA");
    STATE.keepAliveAudio.loop = true;
    STATE.keepAliveAudio.volume = TIMING.KEEP_ALIVE_VOLUME;
    STATE.keepAliveAudio.play().catch(function() {
      log.warn("Keep-alive audio blocked by browser. Tab may throttle if left in background.");
      addLog("Keep-alive audio blocked by browser. Tab may throttle if left in background.", LOG_LEVEL.WARN);
    });
  }
  function stopKeepAlive() {
    if (STATE.keepAliveAudio) {
      STATE.keepAliveAudio.pause();
      STATE.keepAliveAudio = null;
    }
  }
  function registerMenuCommands() {
    STATE.menuStartId = GM_registerMenuCommand("Start Export", function() {
      initUI();
    });
  }
  function registerMenuStop() {
    STATE.menuStopId = GM_registerMenuCommand("Stop Export", function() {
      STATE.isCancelled = true;
      log.warn("Stop requested via menu.");
      addLog("Stop requested via menu.", LOG_LEVEL.WARN);
    });
  }
  function cleanupRun(startBtn) {
    stopKeepAlive();
    if (ui.stopBtn) ui.stopBtn.style.display = "none";
    GM_unregisterMenuCommand(STATE.menuStopId);
    registerMenuCommands();
    if (startBtn) startBtn.disabled = false;
  }
  function attemptClose() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent.indexOf("collapse_content") !== -1) {
        buttons[i].click();
        return;
      }
    }
    var localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
    if (localizedBtn) {
      localizedBtn.click();
      return;
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  }
  async function runProcess(startBtn) {
    STATE.isCancelled = false;
    updateProgress(0, 1);
    startBtn.disabled = true;
    startBtn.textContent = "Running...";
    ui.stopBtn.style.display = "block";
    GM_unregisterMenuCommand(STATE.menuStartId);
    registerMenuStop();
    startKeepAlive();
    SoundFX.playStart();
    var totalSources = document.querySelectorAll(".single-source-container").length;
    if (totalSources === 0) {
      log.error("No sources found.");
      addLog("Error: No sources found.", LOG_LEVEL.ERROR);
      SoundFX.playError();
      cleanupRun(startBtn);
      startBtn.textContent = "Retry";
      return;
    }
    log.log("Scan complete. Found " + totalSources + " items.");
    addLog("Scan complete. Found " + totalSources + " items.", LOG_LEVEL.SUCCESS);
    log.warn("Keep this tab active — background tabs may throttle timers.");
    addLog("Keep this tab active — background tabs may throttle timers.", LOG_LEVEL.WARN);
    var collectedFiles = [];
    var crashed = false;
    try {
      for (var i = 0; i < totalSources; i++) {
        if (STATE.isCancelled) break;
        updateProgress(i + 1, totalSources);
        var source = document.querySelectorAll(".single-source-container")[i];
        if (!source) {
          log.error("Source index " + (i + 1) + " not found. Skipping.");
          addLog("Source index " + (i + 1) + " not found. Skipping.", LOG_LEVEL.ERROR);
          continue;
        }
        var titleEl = source.querySelector(".source-title");
        var fileName = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : "Source_" + (i + 1)).replace(/[\\/:*?"<>|]/g, "_").substring(0, 120).trim();
        if (fileName.indexOf(".md") !== fileName.length - 3) fileName += ".md";
        log.log("Opening: " + fileName);
        addLog("Opening: " + fileName, LOG_LEVEL.INFO);
        if (ui.statusBar) ui.statusBar.setText(i + 1 + "/" + totalSources + ": " + fileName);
        source.scrollIntoView({ block: "center" });
        await wait(100);
        (titleEl || source).click();
        var found = false;
        for (var a = 0; a < TIMING.CONTENT_POLL_ATTEMPTS; a++) {
          await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
          if (document.querySelector(CONFIG.selectors.content)) {
            found = true;
            break;
          }
        }
        if (found) {
          await wait(TIMING.CONTENT_RENDER_DELAY_MS);
          var allContent = document.querySelectorAll(CONFIG.selectors.content);
          var lines = Array.from(allContent).filter(
            function(el) {
              return !el.parentElement.closest(CONFIG.selectors.content);
            }
          );
          var textLines = lines.map(function(l) {
            return htmlToMarkdown(l);
          });
          var text = textLines.join("\n\n");
          if (text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
            collectedFiles.push({ name: fileName, data: text });
            log.log("Queued: " + fileName + " (" + text.length + " chars)");
            addLog(">> Queued: " + fileName + " (" + text.length + " chars)", LOG_LEVEL.SUCCESS);
          } else {
            log.warn("Content empty for: " + fileName);
            addLog(">> Warning: Content empty", LOG_LEVEL.WARN);
          }
        } else {
          log.error("Timeout loading content for: " + fileName);
          addLog(">> Timeout: Content load failed", LOG_LEVEL.ERROR);
        }
        attemptClose();
        for (var b = 0; b < TIMING.CONTENT_GONE_ATTEMPTS; b++) {
          await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
          if (!document.querySelector(CONFIG.selectors.content)) break;
        }
      }
    } catch (e) {
      log.error("Unexpected error: " + e.message);
      addLog("Unexpected error: " + e.message, LOG_LEVEL.ERROR);
      startBtn.textContent = "Retry";
      crashed = true;
    } finally {
      cleanupRun(startBtn);
    }
    if (crashed) return;
    if (STATE.isCancelled) {
      log.warn("Extraction stopped by user.");
      addLog("Extraction stopped by user.", LOG_LEVEL.WARN);
      if (ui.statusBar) ui.statusBar.setText("Stopped");
      startBtn.textContent = "Start Extraction";
    } else {
      updateProgress(totalSources, totalSources);
      if (collectedFiles.length > 0) {
        log.log("Building ZIP with " + collectedFiles.length + " file(s)...");
        addLog("Building ZIP with " + collectedFiles.length + " file(s)...", LOG_LEVEL.INFO);
        var notebookTitleEl = document.querySelector(CONFIG.selectors.notebookTitle);
        var notebookTitle = notebookTitleEl ? notebookTitleEl.textContent.trim() : "NotebookLM";
        var zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, "_").substring(0, 100).trim() + ".zip";
        var zipBlob;
        try {
          var converted = collectedFiles.map(function(f) {
            return { name: f.name, data: new TextEncoder().encode(f.data) };
          });
          var zipBytes = buildStoreZip(converted);
          zipBlob = new Blob([zipBytes], { type: "application/zip" });
        } catch (e) {
          log.error("ZIP build failed: " + e.message);
          addLog("ZIP build failed: " + e.message, LOG_LEVEL.ERROR);
          startBtn.textContent = "Retry";
          return;
        }
        var url = URL.createObjectURL(zipBlob);
        var a = document.createElement("a");
        a.href = url;
        a.download = zipName;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
          a.remove();
          URL.revokeObjectURL(url);
        }, 2e3);
        log.log("ZIP downloaded: " + zipName);
        addLog("ZIP downloaded.", LOG_LEVEL.SUCCESS);
      } else {
        log.warn("No files to export.");
        addLog("No files to export.", LOG_LEVEL.WARN);
      }
      log.log("Process completed successfully.");
      addLog("Process completed successfully.", LOG_LEVEL.SUCCESS);
      if (ui.statusBar) ui.statusBar.setText("Complete");
      startBtn.textContent = "Done";
      SoundFX.playComplete();
    }
  }
  // @license      MIT
  createLogger("NotebookLM Source Export");
  registerMenuCommands();

})();
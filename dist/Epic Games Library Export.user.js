// ==UserScript==
// @name         Epic Games Library Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      6.4.0
// @author       marmoris-x
// @description  High-Performance Game Library Exporter. Start via Tampermonkey menu.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=epicgames.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Epic%20Games%20Library%20Export.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Epic%20Games%20Library%20Export.user.js
// @match        https://www.epicgames.com/account/transactions*
// @sandbox      JavaScript
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @inject-into  content
// @run-at       document-idle
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
  // @license      MIT
  var { log } = createLogger("Epic Games Library Export");
  GM_registerMenuCommand("Epic Library Export", run);
  var CONFIG = {
    selector: ".am-hoct6b",
    ignoreList: ["Standard Edition", "Add-On", "Season Pass", "Saisonpass", "Demo", "Free", "Kostenlos"]
  };
  function run() {
    if (document.getElementById("ep-export-sidebar")) {
      log("Panel already open");
      return;
    }
    var sidebar = createSidebar({
      title: "Epic Turbo Export",
      width: 320,
      accentColor: "#f1c40f"
    });
    sidebar.host.id = "ep-export-sidebar";
    sidebar.open();
    var body = sidebar.bodyEl;
    body.style.padding = "16px";
    body.style.fontSize = "13px";
    body.style.color = "#e0e0e0";
    body.style.fontFamily = "system-ui, sans-serif";
    var isRunning = false;
    var gamesSet = new Set();
    var sortedGames = [];
    function statRow(label, initial) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;margin-bottom:6px;color:#888;font-size:12px;";
      var lbl = document.createElement("span");
      lbl.textContent = label;
      var val = document.createElement("b");
      val.style.cssText = "color:#fff;font-weight:600;font-family:monospace;font-size:13px;";
      val.textContent = initial;
      row.appendChild(lbl);
      row.appendChild(val);
      return { host: row, val };
    }
    var statusRow = statRow("STATUS", "Ready");
    var gamesRow = statRow("GAMES", "0");
    var pageRow = statRow("PAGE", "1");
    var barWrap = document.createElement("div");
    barWrap.style.cssText = "height:4px;background:#333;margin:16px 0;border-radius:2px;overflow:hidden;";
    var barFill = document.createElement("div");
    barFill.style.cssText = "height:100%;width:0%;background:#f1c40f;transition:width 0.2s linear;";
    barWrap.appendChild(barFill);
    function makeBtn(text, bg) {
      var btn = document.createElement("button");
      btn.textContent = text;
      btn.style.cssText = [
        "flex:1;padding:10px;border:none;border-radius:6px;cursor:pointer;font-weight:600;",
        "font-size:11px;text-transform:uppercase;color:white;background:" + bg + ";",
        "box-shadow:0 2px 5px rgba(0,0,0,0.2);transition:all 0.1s;"
      ].join("");
      btn.onmouseenter = function() {
        btn.style.filter = "brightness(1.15)";
      };
      btn.onmouseleave = function() {
        btn.style.filter = "";
      };
      return btn;
    }
    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;margin-top:12px;";
    var startBtn = makeBtn("Start", "linear-gradient(135deg,#0078f2,#095fb5)");
    var stopBtn = makeBtn("Stop", "linear-gradient(135deg,#d63031,#c0392b)");
    stopBtn.style.display = "none";
    btnRow.appendChild(startBtn);
    btnRow.appendChild(stopBtn);
    var exportArea = document.createElement("div");
    exportArea.style.cssText = "display:none;border-top:1px solid #333;margin-top:16px;padding-top:16px;";
    var exportTitle = document.createElement("div");
    exportTitle.style.cssText = "font-weight:700;color:#ccc;font-size:11px;text-transform:uppercase;margin-bottom:10px;";
    exportTitle.textContent = "EXPORT";
    exportArea.appendChild(exportTitle);
    var expBtnRow = document.createElement("div");
    expBtnRow.style.cssText = "display:flex;gap:8px;";
    var txtBtn = makeBtn("TXT", "#2d3436");
    var csvBtn = makeBtn("CSV", "#2d3436");
    expBtnRow.appendChild(txtBtn);
    expBtnRow.appendChild(csvBtn);
    exportArea.appendChild(expBtnRow);
    var copyWrap = document.createElement("div");
    copyWrap.style.cssText = "margin-top:8px;";
    var copyBtn = makeBtn("Copy", "linear-gradient(135deg,#00b894,#00a884)");
    copyWrap.appendChild(copyBtn);
    exportArea.appendChild(copyWrap);
    var msgEl = document.createElement("div");
    msgEl.style.cssText = "font-size:10px;color:#666;margin-top:10px;text-align:center;height:14px;";
    body.appendChild(statusRow.host);
    body.appendChild(gamesRow.host);
    body.appendChild(pageRow.host);
    body.appendChild(barWrap);
    body.appendChild(btnRow);
    body.appendChild(exportArea);
    body.appendChild(copyWrap);
    body.appendChild(msgEl);
    function sleep(ms) {
      return new Promise(function(r) {
        setTimeout(r, ms);
      });
    }
    function scrapePage() {
      var nodes = document.querySelectorAll(CONFIG.selector);
      for (var i = 0; i < nodes.length; i++) {
        var txt = nodes[i].innerText.trim();
        if (txt && !CONFIG.ignoreList.some(function(bad) {
          return txt.includes(bad);
        })) {
          gamesSet.add(txt);
        }
      }
    }
    function finishScan() {
      isRunning = false;
      stopBtn.style.display = "none";
      startBtn.textContent = "Restart";
      startBtn.style.display = "block";
      barFill.style.width = "100%";
      barFill.style.background = "#26bb26";
      if (gamesSet.size > 0) {
        sortedGames = Array.from(gamesSet).sort(function(a, b) {
          return a.localeCompare(b);
        }).map(function(title, i) {
          return i + 1 + ". " + title;
        });
        exportArea.style.display = "block";
        statusRow.val.textContent = "DONE";
        statusRow.val.style.color = "#26bb26";
        msgEl.textContent = gamesSet.size + " games captured.";
      }
      log("Scan finished: " + gamesSet.size + " games found");
    }
    async function processLoop() {
      if (isRunning) return;
      isRunning = true;
      gamesSet = new Set();
      sortedGames = [];
      var pageNum = 1;
      exportArea.style.display = "none";
      startBtn.style.display = "none";
      stopBtn.style.display = "block";
      barFill.style.background = "#f1c40f";
      barFill.style.width = "0%";
      statusRow.val.textContent = "SCANNING...";
      statusRow.val.style.color = "#f0f0f0";
      msgEl.textContent = "";
      while (isRunning) {
        scrapePage();
        gamesRow.val.textContent = gamesSet.size;
        pageRow.val.textContent = pageNum;
        barFill.style.width = pageNum % 2 === 0 ? "60%" : "90%";
        var nextBtn = document.querySelector('button[aria-label="Next Page"], #next-btn');
        var isDisabled = nextBtn && (nextBtn.disabled || nextBtn.classList.contains("Mui-disabled"));
        if (nextBtn && !isDisabled) {
          var prevFirstText = (function() {
            var e = document.querySelector(CONFIG.selector);
            return e ? e.innerText : "";
          })();
          nextBtn.click();
          pageNum++;
          for (var waited = 0; waited < 5e3; waited += 100) {
            await sleep(100);
            var newFirstText = (function() {
              var e = document.querySelector(CONFIG.selector);
              return e ? e.innerText : "";
            })();
            if (newFirstText && newFirstText !== prevFirstText) break;
          }
        } else {
          break;
        }
      }
      if (isRunning) finishScan();
    }
    function downloadFile(content, filename, type) {
      var blob = new Blob([content], { type });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 2e3);
      msgEl.textContent = "Saved!";
    }
    startBtn.onclick = processLoop;
    stopBtn.onclick = function() {
      isRunning = false;
      statusRow.val.textContent = "STOPPED";
      log("Scan stopped by user");
    };
    txtBtn.onclick = function() {
      downloadFile(sortedGames.join("\n"), "EpicGames_Export.txt", "text/plain");
      log("TXT export: " + sortedGames.length + " games");
    };
    csvBtn.onclick = function() {
      var csv = "Nr;Spiel\n";
      for (var i = 0; i < sortedGames.length; i++) {
        var idx = sortedGames[i].indexOf(". ");
        csv += sortedGames[i].substring(0, idx) + ';"' + sortedGames[i].substring(idx + 2) + '"\n';
      }
      downloadFile(csv, "EpicGames_Export.csv", "text/csv");
      log("CSV export: " + sortedGames.length + " games");
    };
    var copyTimer;
    copyBtn.onclick = function() {
      GM_setClipboard(sortedGames.join("\n"));
      copyBtn.textContent = "Copied";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function() {
        copyBtn.textContent = "Copy";
      }, 1e3);
      msgEl.textContent = "Copied to clipboard";
      log("Copied " + sortedGames.length + " games to clipboard");
    };
    log("Panel initialized");
  }

})();
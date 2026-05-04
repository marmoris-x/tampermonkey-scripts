// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.3.0
// @author       marmoris-x
// @description  Infinite scroll pagination for AniSearch with rating filter
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=anisearch.de
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/AniSearch%20Endless%20Scroll.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/AniSearch%20Endless%20Scroll.user.js
// @match        https://www.anisearch.de/anime*
// @sandbox      JavaScript
// @connect      anisearch.de
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
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
  globalThis.TM = globalThis.TM || {};
  globalThis.TM.network = {
    fetchPage,
    fetchJSON,
    fetchBlob
  };
  function fetchPage(url, opts) {
    opts = opts || {};
    var retries = opts.retries || 0;
    var timeout = opts.timeout || 15e3;
    return new Promise(function(resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout,
          anonymous: opts.anonymous !== false,
          onload: function(r) {
            if (r.status >= 200 && r.status < 300) {
              try {
                var parser = new DOMParser();
                var doc = parser.parseFromString(r.responseText, "text/html");
                resolve(doc);
              } catch (e) {
                reject(new Error("DOMParser failed: " + e.message));
              }
            } else if (n < retries) {
              attempt(n + 1);
            } else {
              reject(new Error("HTTP " + r.status + " for " + url));
            }
          },
          onerror: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Network error for " + url));
          },
          ontimeout: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Timeout for " + url));
          }
        });
      }
      attempt(0);
    });
  }
  function fetchJSON(url, opts) {
    opts = opts || {};
    var retries = opts.retries || 0;
    var timeout = opts.timeout || 15e3;
    return new Promise(function(resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout,
          anonymous: opts.anonymous !== false,
          onload: function(r) {
            if (r.status >= 200 && r.status < 300) {
              try {
                resolve(JSON.parse(r.responseText));
              } catch (e) {
                reject(new Error("JSON parse failed: " + e.message));
              }
            } else if (n < retries) {
              attempt(n + 1);
            } else {
              reject(new Error("HTTP " + r.status + " for " + url));
            }
          },
          onerror: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Network error for " + url));
          },
          ontimeout: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Timeout for " + url));
          }
        });
      }
      attempt(0);
    });
  }
  function fetchBlob(url, opts) {
    opts = opts || {};
    var retries = opts.retries || 2;
    var timeout = opts.timeout || 3e4;
    return new Promise(function(resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout,
          responseType: "blob",
          onload: function(r) {
            if (r.status >= 200 && r.status < 300) resolve({ blob: r.response, headers: r.responseHeaders });
            else if (n < retries) attempt(n + 1);
            else reject(new Error("HTTP " + r.status + " for " + url));
          },
          onerror: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Network error for " + url));
          },
          ontimeout: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Timeout for " + url));
          }
        });
      }
      attempt(0);
    });
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
  createLogger("AniSearch Endless Scroll");
  var STORAGE_KEY_RATING = "anisearch_rating_min";
  var STAR_SELS = [
    '[class*="star"]',
    '[class*="rating"]',
    '[class*="score"]',
    ".rating",
    ".score"
  ];
  function extractRating(itemEl) {
    for (var i = 0; i < STAR_SELS.length; i++) {
      var el = itemEl.querySelector(STAR_SELS[i]);
      if (!el) continue;
      var title = el.getAttribute("title") || "";
      var txt = (el.textContent || "").trim();
      var sources = [title, txt];
      for (var s = 0; s < sources.length; s++) {
        var m = sources[s].match(/(\d+(?:[.,]\d+)?)/);
        if (m) {
          var v = parseFloat(m[1].replace(",", "."));
          if (!isNaN(v) && v > 0) return v;
        }
      }
    }
    var dataEl = itemEl.querySelector("[data-rating],[data-score],[data-average]");
    if (dataEl) {
      var raw = dataEl.getAttribute("data-rating") || dataEl.getAttribute("data-score") || dataEl.getAttribute("data-average") || "";
      var v2 = parseFloat(raw);
      if (!isNaN(v2) && v2 > 0) return v2;
    }
    return null;
  }
  function passesRating(itemEl, ratingMin) {
    if (ratingMin === null) return true;
    var r = extractRating(itemEl);
    if (r === null) return true;
    return r >= ratingMin;
  }
  async function parseRatingMin() {
    var raw = new URLSearchParams(location.search).get("rating_min");
    if (raw !== null) {
      var v = parseFloat(raw);
      if (!isNaN(v)) {
        await saveSetting(STORAGE_KEY_RATING, v);
        return v;
      }
    }
    var stored = await loadSetting(STORAGE_KEY_RATING, null);
    if (stored !== null) {
      var v2 = parseFloat(stored);
      if (!isNaN(v2)) return v2;
    }
    return null;
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
  var LOADER_ID = "as-es-loader";
  var _statusBar = null;
  function ensureBar() {
    if (!_statusBar) {
      _statusBar = createStatusBar({ accentColor: "#6366f1" });
    }
    return _statusBar;
  }
  function setStatus(message) {
    ensureBar().setText(message);
  }
  function removeStatus() {
    if (_statusBar) {
      _statusBar.remove();
      _statusBar = null;
    }
  }
  function ensureLoader(container) {
    if (document.getElementById(LOADER_ID)) return;
    var loader = document.createElement("div");
    loader.id = LOADER_ID;
    loader.style.textAlign = "center";
    loader.style.padding = "24px";
    loader.style.color = "#6366f1";
    loader.style.fontSize = "13px";
    loader.style.fontFamily = '"Segoe UI",system-ui,sans-serif';
    loader.style.fontWeight = "500";
    loader.style.letterSpacing = "0.3px";
    loader.style.gridColumn = "1 / -1";
    loader.innerHTML = '<span style="display:inline-block;animation:as-spin 1s linear infinite;font-size:18px;margin-right:8px">⟳</span>Lädt weitere Einträge…';
    if (container.tagName === "TBODY") {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 99;
      td.appendChild(loader);
      tr.id = LOADER_ID + "-row";
      tr.appendChild(td);
      container.appendChild(tr);
    } else {
      container.appendChild(loader);
    }
  }
  function removeLoader() {
    var ids = [LOADER_ID, LOADER_ID + "-row"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }
  function showLoader(visible, container) {
    if (visible && container) {
      ensureLoader(container);
    } else {
      removeLoader();
    }
  }
  var PREMIUM_TEXTS = new Set([
    "premium only",
    "premium-only",
    "nur fur premium",
    "nur premium",
    "upgrade to premium"
  ]);
  var _limitObserver = null;
  function unlockUI() {
    var limitInput = document.querySelector("#limit");
    if (limitInput) {
      limitInput.removeAttribute("disabled");
      limitInput.removeAttribute("readonly");
      limitInput.style.opacity = "1";
      limitInput.style.cursor = "text";
      if (_limitObserver) _limitObserver.disconnect();
      _limitObserver = new MutationObserver(function() {
        limitInput.removeAttribute("disabled");
        limitInput.removeAttribute("readonly");
      });
      _limitObserver.observe(limitInput, { attributes: true });
    }
    hideElements([
      ".premium-only",
      ".premium-badge",
      ".locked",
      ".lock-icon",
      '[class*="premium-lock"]'
    ]);
    var groups = document.querySelectorAll(".form-group, .filter-group, label, .input-group");
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var allEls = group.querySelectorAll("*");
      for (var e = 0; e < allEls.length; e++) {
        if (allEls[e].children.length > 0) continue;
        if (PREMIUM_TEXTS.has(allEls[e].textContent.trim().toLowerCase())) {
          group.style.display = "none";
          break;
        }
      }
    }
  }
  var log$1 = createLogger("AniSearch Endless Scroll");
  var FETCH_DELAY_MS = 800;
  var MAX_PAGES = 200;
  var REQUEST_TIMEOUT_MS = 2e4;
  var MAX_RETRIES = 3;
  var CONTAINER_SELECTORS = [
    "ul.gallery",
    "ul.covers",
    "ul.list",
    "table.table tbody"
  ];
  var ITEM_SELECTOR_MAP = {
    "ul.gallery": "li",
    "ul.covers": "li",
    "ul.list": "li",
    "table.table tbody": "tr"
  };
  var _currentRunId = 0;
  function newRun() {
    return ++_currentRunId;
  }
  function isCurrentRun(runId) {
    return runId === _currentRunId;
  }
  function findContainer(doc) {
    doc = doc || document;
    for (var i = 0; i < CONTAINER_SELECTORS.length; i++) {
      var el = doc.querySelector(CONTAINER_SELECTORS[i]);
      if (el) return { container: el, selector: CONTAINER_SELECTORS[i] };
    }
    return null;
  }
  function getItemSel(containerSelector) {
    return ITEM_SELECTOR_MAP[containerSelector] || "li";
  }
  function findNextUrl(doc) {
    doc = doc || document;
    var candidates = [
      ".pagenav a.pagenav-next",
      "a.pagenav-next",
      'nav.pagination a[rel="next"]',
      '.pagination a[rel="next"]',
      'a[rel="next"]'
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = doc.querySelector(candidates[i]);
      if (!el) continue;
      var raw = (el.getAttribute("href") || "").trim();
      if (!raw || raw === "#") continue;
      try {
        if (/^https?:\/\//i.test(raw)) {
          var u = new URL(raw);
          if (u.href !== window.location.href) return u.href;
          continue;
        }
        if (raw.startsWith("/")) {
          return new URL(raw, window.location.origin).href;
        }
        return new URL("/" + raw, window.location.origin).href;
      } catch (e) {
        continue;
      }
    }
    return null;
  }
  function hideElements(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        els[j].style.display = "none";
      }
    }
  }
  function hidePagination() {
    hideElements([
      ".pagenav",
      ".pagination",
      "nav.pagination",
      '[class*="pagenav"]',
      '[class*="pagination"]'
    ]);
  }
  function sleep(ms) {
    return new Promise(function(r) {
      setTimeout(r, ms);
    });
  }
  function appendItem(container, itemEl) {
    container.appendChild(document.importNode(itemEl, true));
  }
  async function runEndlessLoop(ratingMin, found, runId) {
    var container = found.container;
    var selector = found.selector;
    var itemSel = getItemSel(selector);
    var existingItems = Array.from(container.querySelectorAll(itemSel));
    var filteredCount = 0;
    for (var i = 0; i < existingItems.length; i++) {
      if (!passesRating(existingItems[i], ratingMin)) {
        existingItems[i].style.display = "none";
        existingItems[i].setAttribute("data-as-hidden", "rating");
        filteredCount++;
      }
    }
    var visibleOnPage1 = existingItems.length - filteredCount;
    hidePagination();
    var nextUrl = findNextUrl(document);
    if (!nextUrl) {
      setStatus(
        "✔ Alle Einträge geladen\n  " + visibleOnPage1 + " Items" + (ratingMin !== null ? "\n  Rating ≥ " + ratingMin : "")
      );
      return;
    }
    setStatus(
      "⟳ Seite 1 — " + visibleOnPage1 + " Items\n  Lade Seite 2…"
    );
    showLoader(true, container);
    var currentPage = 2;
    var totalVisible = visibleOnPage1;
    var totalHidden = filteredCount;
    var visitedUrls = new Set([window.location.href]);
    while (nextUrl && currentPage <= MAX_PAGES) {
      if (visitedUrls.has(nextUrl)) {
        log$1.warn("Loop detected, stopping:", nextUrl);
        break;
      }
      visitedUrls.add(nextUrl);
      log$1.log("Fetching page", currentPage, "→", nextUrl);
      var fetchedDoc;
      try {
        fetchedDoc = await fetchPage(nextUrl, {
          retries: MAX_RETRIES - 1,
          timeout: REQUEST_TIMEOUT_MS
        });
      } catch (err) {
        log$1.warn("Page " + currentPage + " failed after " + MAX_RETRIES + " attempts:", err.message);
        setStatus(
          "⚠ Seite " + currentPage + " fehlgeschlagen\n  " + err.message
        );
        showLoader(false);
        break;
      }
      if (!isCurrentRun(runId)) {
        showLoader(false);
        removeStatus();
        return;
      }
      var fetchedFound = findContainer(fetchedDoc);
      if (!fetchedFound) {
        log$1.warn("Container on page", currentPage, "not found.");
        break;
      }
      var newItems = Array.from(
        fetchedFound.container.querySelectorAll(getItemSel(fetchedFound.selector))
      );
      if (newItems.length === 0) {
        break;
      }
      showLoader(false);
      for (var j = 0; j < newItems.length; j++) {
        if (passesRating(newItems[j], ratingMin)) {
          appendItem(container, newItems[j]);
          totalVisible++;
        } else {
          totalHidden++;
        }
      }
      nextUrl = findNextUrl(fetchedDoc);
      setStatus(
        "⟳ Seite " + currentPage + " geladen\n  Sichtbar: " + totalVisible + "  (" + totalHidden + " gefiltert)\n" + (nextUrl ? "  Lade Seite " + (currentPage + 1) + "…" : "  Letzte Seite erreicht")
      );
      if (nextUrl) {
        showLoader(true, container);
        await sleep(FETCH_DELAY_MS + Math.random() * 400);
        if (!isCurrentRun(runId)) {
          showLoader(false);
          removeStatus();
          return;
        }
      }
      currentPage++;
    }
    showLoader(false);
    var cappedByLimit = currentPage > MAX_PAGES;
    setStatus(
      (cappedByLimit ? "⚠" : "✔") + " Fertig!\n  " + totalVisible + " Einträge sichtbar" + (totalHidden > 0 ? "\n  " + totalHidden + " via Rating-Filter entfernt" : "") + (ratingMin !== null ? "\n  Rating ≥ " + ratingMin : "") + "\n  " + (currentPage - 1) + " Seiten durchsucht" + (cappedByLimit ? "\n  ⚠ Seiten-Limit erreicht!" : "")
    );
  }
  // @license      MIT
  var log = createLogger("AniSearch Endless Scroll");
  async function main() {
    var runId = newRun();
    setStatus("⟳ AniSearch Endless Scroll startet…");
    unlockUI();
    setTimeout(unlockUI, 1500);
    var ratingMin = await parseRatingMin();
    log.log("Rating min:", ratingMin || "no filter");
    if (!findContainer(document)) {
      setStatus("✔ UI entsperrt. (Keine Liste erkannt)");
      setTimeout(function() {
        removeStatus();
      }, 4e3);
      return;
    }
    await new Promise(function(r) {
      setTimeout(r, 250);
    });
    if (!isCurrentRun(runId)) {
      removeStatus();
      return;
    }
    var found = findContainer(document);
    if (!found) {
      setStatus("✔ UI entsperrt. (Keine Liste erkannt)");
      setTimeout(function() {
        removeStatus();
      }, 4e3);
      return;
    }
    await runEndlessLoop(ratingMin, found, runId);
    setTimeout(function() {
      removeStatus();
    }, 8e3);
  }
  function boot() {
    var style = document.createElement("style");
    style.textContent = "@keyframes as-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", main);
    } else {
      main();
    }
  }
  (function patchHistory() {
    var _push = history.pushState.bind(history);
    var _replace = history.replaceState.bind(history);
    var navTimer;
    function scheduleMain() {
      clearTimeout(navTimer);
      navTimer = setTimeout(main, 600);
    }
    history.pushState = function() {
      _push.apply(history, arguments);
      scheduleMain();
    };
    history.replaceState = function() {
      var before = location.href;
      _replace.apply(history, arguments);
      if (location.href !== before) scheduleMain();
    };
    window.addEventListener("popstate", scheduleMain);
  })();
  boot();

})();
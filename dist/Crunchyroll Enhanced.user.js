// ==UserScript==
// @name         Crunchyroll Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.0
// @author       marmoris-x
// @description  Sidebar (page-push) with multi-filter & sort for Crunchyroll browse — auto-scan, retry, export/clipboard, data-only filter
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.user.js
// @match        https://*.crunchyroll.com/*
// @sandbox      JavaScript
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_addStyle
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
  globalThis.TM.dom = {
    waitForElement,
    debounce,
    throttle,
    observeMutations
  };
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 1e4;
    root = root || document.body;
    return new Promise(function(resolve, reject) {
      var existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      var timer;
      var observer = new MutationObserver(function(mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var nodes = mutations[m].addedNodes;
          for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
            if (nodes[i].matches && nodes[i].matches(selector)) {
              cleanup();
              return resolve(nodes[i]);
            }
            var child = nodes[i].querySelector && nodes[i].querySelector(selector);
            if (child) {
              cleanup();
              return resolve(child);
            }
          }
        }
      });
      function cleanup() {
        observer.disconnect();
        if (timer) clearTimeout(timer);
      }
      observer.observe(root, { childList: true, subtree: true });
      if (timeout > 0) {
        timer = setTimeout(function() {
          cleanup();
          reject(new Error("waitForElement timeout: " + selector));
        }, timeout);
      }
    });
  }
  function debounce(fn, ms) {
    ms = ms || 200;
    var timer = 0;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(ctx, args);
      }, ms);
    };
  }
  function throttle(fn, ms) {
    ms = ms || 200;
    var last = 0;
    return function() {
      var now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }
  function observeMutations(callback, root) {
    root = root || document.body;
    var observer = new MutationObserver(function(mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var nodes = mutations[m].addedNodes;
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  }
  async function scanCards(ctx) {
    if (ctx.isScanning) return;
    ctx.isScanning = true;
    var btn = ctx._$("cr-btn-scan");
    btn.disabled = true;
    btn.innerHTML = '<span class="cr-spin"></span> Scannen…';
    ctx._status("Scanning cards…");
    ctx._$("cr-prog").style.display = "block";
    ctx.cards.clear();
    ctx.origOrder = [];
    var all = Array.from(document.querySelectorAll(".browse-card"));
    var forceStyle = document.createElement("style");
    forceStyle.id = "cr-force-hover";
    forceStyle.textContent = [
      '[class*="browse-card-hover"] {',
      "opacity: 1 !important; visibility: visible !important;",
      "display: block !important; transform: none !important;",
      "pointer-events: none !important;",
      "}"
    ].join("");
    document.head.appendChild(forceStyle);
    all.forEach(function(c) {
      c.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });
    await ctx._sleep(600);
    for (var i = 0; i < all.length; i++) {
      var card = all[i];
      var info = extractInfo(card, i);
      ctx.cards.set(card, info);
      ctx.origOrder.push(card);
      if (ctx.showBadges) addBadges(card, info);
      ctx._$("cr-prog-fill").style.width = Math.round((i + 1) / all.length * 100) + "%";
      ctx._status("Scanned: " + (i + 1) + " / " + all.length);
      if ((i + 1) % 30 === 0) await ctx._sleep(0);
    }
    var fh = document.getElementById("cr-force-hover");
    if (fh) fh.remove();
    ctx._$("cr-prog").style.display = "none";
    var noData = Array.from(ctx.cards.entries()).filter(function(e) {
      return !e[1].hasData;
    }).map(function(e) {
      return e[0];
    });
    if (noData.length > 0) {
      retryNoData(ctx, noData);
    }
    var wd = withData(ctx.cards);
    ctx._status("✅ " + all.length + " scanned, " + wd + " with real data");
    ctx._updateStats(all.length, all.length, wd);
    ctx.isScanning = false;
    btn.disabled = false;
    btn.innerHTML = "<span>🔄</span> Scannen";
    ctx._apply();
    startObserver(ctx);
  }
  function extractInfo(card, index) {
    var titleEl = card.querySelector('h3[data-t="title"] a') || card.querySelector('[class*="browse-card__title"] a');
    var title = titleEl ? titleEl.textContent.trim() : "";
    var link = titleEl ? titleEl.href : "";
    var seriesId = link.match(/series\/([A-Z0-9]+)/) ? link.match(/series\/([A-Z0-9]+)/)[1] : "";
    var descEl = card.querySelector('p[data-t="description"]');
    var description = descEl ? descEl.textContent.trim() : "";
    var ratingEl = card.querySelector('p[class*="star-rating-short-static__rating"]') || card.querySelector('[data-t="star-rating-short-static"] [class*="rating"]');
    var rating = ratingEl ? parseFloat(ratingEl.textContent.trim()) || null : null;
    var votesEl = card.querySelector('p[data-t="rating-count"]') || card.querySelector('[class*="votes-count"]') || card.querySelector('[class*="star-rating-short-static__votes"]');
    var votes = null;
    if (votesEl) {
      var m = votesEl.textContent.match(/([\d,.]+)\s*([kKmM]?)/);
      if (m) {
        var n = parseFloat(m[1].replace(",", "."));
        var s = m[2].toLowerCase();
        if (s === "k") n *= 1e3;
        else if (s === "m") n *= 1e6;
        votes = Math.round(n);
      }
    }
    var metaEl = card.querySelector('[class*="browse-card-hover__series-meta"]');
    var seasons = null, episodes = null;
    if (metaEl) {
      metaEl.querySelectorAll("span").forEach(function(span) {
        var t = span.textContent.trim();
        var ep = t.match(/(\d+)\s*(?:Episode[ns]?|Folge[n]?)/i);
        var se = t.match(/(\d+)\s*(?:Staffel[n]?|Season[s]?)/i);
        if (ep) episodes = parseInt(ep[1], 10);
        if (se) seasons = parseInt(se[1], 10);
      });
    }
    var hasSub = false, hasDub = false;
    card.querySelectorAll('[class*="meta-tags"] span, [class*="meta-tag"] span').forEach(function(el) {
      var t = el.textContent.toLowerCase();
      if (t.indexOf("untertitel") !== -1 || t.indexOf("sub") !== -1) hasSub = true;
      if (t.indexOf("synchro") !== -1 || t.indexOf("dub") !== -1) hasDub = true;
    });
    var onWatchlist = !!card.querySelector(
      '[class*="card-watchlist-label"], [class*="watchlist-label"]'
    );
    var hasData = rating !== null || votes !== null || episodes !== null || seasons !== null;
    return {
      title,
      description,
      link,
      seriesId,
      rating,
      votes,
      episodes,
      seasons,
      hasSub,
      hasDub,
      onWatchlist,
      hasData,
      index
    };
  }
  function triggerHover(cards) {
    var style = document.createElement("style");
    style.id = "cr-force-hover";
    style.textContent = [
      '[class*="browse-card-hover"] {',
      "opacity: 1 !important; visibility: visible !important;",
      "display: block !important; transform: none !important;",
      "pointer-events: none !important;",
      "}"
    ].join("");
    document.head.appendChild(style);
    cards.forEach(function(c) {
      c.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });
  }
  async function retryNoData(ctx, noDataCards) {
    ctx._status("Retry: " + noDataCards.length + " cards without data…");
    triggerHover(noDataCards);
    await ctx._sleep(1e3);
    var improved = 0;
    noDataCards.forEach(function(card) {
      var old = ctx.cards.get(card);
      var fresh = extractInfo(card, old.index);
      if (fresh.hasData) {
        ctx.cards.set(card, fresh);
        if (ctx.showBadges) addBadges(card, fresh);
        improved++;
      }
    });
    var fh = document.getElementById("cr-force-hover");
    if (fh) fh.remove();
    ctx._status("Retry: +" + improved + " of " + noDataCards.length + " upgraded");
    ctx.log.log("Retry: " + improved + "/" + noDataCards.length + " cards now have data");
  }
  function addBadges(card, info) {
    var existing = card.querySelector(".cr-overlay");
    if (existing) existing.remove();
    var anchor = card.querySelector('[class*="browse-card__poster"], [class*="content-image"]') || card;
    if (getComputedStyle(anchor).position === "static") anchor.style.position = "relative";
    var ov = document.createElement("div");
    ov.className = "cr-overlay";
    if (info.rating !== null) ov.appendChild(mkBadge("cr-b-rating", "⭐ " + info.rating.toFixed(1)));
    if (info.votes !== null) ov.appendChild(mkBadge("cr-b-votes", "👥 " + fmtNum(info.votes)));
    if (info.seasons !== null) ov.appendChild(mkBadge("cr-b-seasons", "📦 " + info.seasons + "S"));
    if (info.episodes !== null) ov.appendChild(mkBadge("cr-b-episodes", "📺 " + info.episodes + "E"));
    if (info.hasSub) ov.appendChild(mkBadge("cr-b-sub", "SUB"));
    if (info.hasDub) ov.appendChild(mkBadge("cr-b-dub", "DUB"));
    if (info.onWatchlist) ov.appendChild(mkBadge("cr-b-wl", "📌"));
    anchor.appendChild(ov);
  }
  function mkBadge(cls, text) {
    var b = document.createElement("div");
    b.className = "cr-badge " + cls;
    b.textContent = text;
    return b;
  }
  function updateBadgeVisibility(show) {
    document.querySelectorAll(".cr-overlay").forEach(function(el) {
      el.style.display = show ? "" : "none";
    });
  }
  function startObserver(ctx) {
    var target = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
    if (!target) return;
    if (ctx._observer) {
      ctx._observer.disconnect();
      ctx._observer = null;
    }
    ctx._observerPaused = false;
    ctx._observerTimer = null;
    ctx._observer = new MutationObserver(function(mutations) {
      if (ctx._observerPaused || ctx.isScanning) return;
      var newCards = [];
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          if (node.parentElement !== target) return;
          if (node.classList && node.classList.contains("browse-card") && !ctx.cards.has(node)) {
            newCards.push(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll(".browse-card").forEach(function(c) {
              if (!ctx.cards.has(c)) newCards.push(c);
            });
          }
        });
      });
      if (newCards.length === 0) return;
      clearTimeout(ctx._observerTimer);
      ctx._observerTimer = setTimeout(function() {
        var ready = newCards.filter(function(c) {
          var t = c.querySelector('h3[data-t="title"] a, [class*="browse-card__title"] a');
          return t && t.textContent.trim() !== "";
        });
        if (ready.length > 0) ingestNewCards(ctx, ready);
      }, 400);
    });
    ctx._observer.observe(target, { childList: true, subtree: true });
  }
  async function ingestNewCards(ctx, cards) {
    cards.forEach(function(c) {
      c.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });
    await ctx._sleep(700);
    var added = 0;
    cards.forEach(function(card) {
      if (ctx.cards.has(card)) return;
      var info = extractInfo(card, ctx.origOrder.length);
      ctx.cards.set(card, info);
      ctx.origOrder.push(card);
      if (ctx.showBadges) addBadges(card, info);
      card.classList.add("cr-new-card");
      added++;
    });
    if (added > 0) {
      ctx._status("+" + added + " new cards detected");
      var visCount = Array.from(ctx.cards.keys()).filter(function(c) {
        return !c.classList.contains("cr-hidden");
      }).length;
      ctx._updateStats(visCount, ctx.cards.size, withData(ctx.cards));
      ctx._apply();
    }
  }
  function withData(cards) {
    return Array.from(cards.values()).filter(function(i) {
      return i.hasData;
    }).length;
  }
  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function getFilters($, sidebarRoot) {
    function num(id) {
      var v = parseFloat($(id) ? $(id).value : "");
      return isNaN(v) ? null : v;
    }
    function intVal(id) {
      var v = parseInt($(id) ? $(id).value : "", 10);
      return isNaN(v) ? null : v;
    }
    function str(id) {
      var el = $(id);
      return el ? el.value.trim().toLowerCase() : "";
    }
    function chk(id) {
      var el = $(id);
      return el ? el.checked : false;
    }
    var wlEl = sidebarRoot.querySelector('input[name="cr-wl"]:checked');
    var wl = wlEl ? wlEl.value : "all";
    return {
      title: str("cr-f-title"),
      desc: str("cr-f-desc"),
      ratingMin: num("cr-f-r-min"),
      ratingMax: num("cr-f-r-max"),
      votesMin: intVal("cr-f-v-min"),
      epMin: intVal("cr-f-ep-min"),
      epMax: intVal("cr-f-ep-max"),
      seasonsMin: intVal("cr-f-se-min"),
      seasonsMax: intVal("cr-f-se-max"),
      subOnly: chk("cr-f-sub"),
      dubOnly: chk("cr-f-dub"),
      watchlist: wl,
      dataOnly: chk("cr-opt-data"),
      sort: ["cr-s-1", "cr-s-2", "cr-s-3"].map(function(id) {
        var el = $(id);
        return el ? el.value : "";
      }).filter(Boolean)
    };
  }
  function passesFilter(info, f) {
    if (f.title && info.title.toLowerCase().indexOf(f.title) === -1) return false;
    if (f.desc && info.description.toLowerCase().indexOf(f.desc) === -1) return false;
    if (f.ratingMin !== null && info.rating !== null && info.rating < f.ratingMin) return false;
    if (f.ratingMax !== null && info.rating !== null && info.rating > f.ratingMax) return false;
    if (f.votesMin !== null && info.votes !== null && info.votes < f.votesMin) return false;
    if (f.epMin !== null && info.episodes !== null && info.episodes < f.epMin) return false;
    if (f.epMax !== null && info.episodes !== null && info.episodes > f.epMax) return false;
    if (f.seasonsMin !== null && info.seasons !== null && info.seasons < f.seasonsMin) return false;
    if (f.seasonsMax !== null && info.seasons !== null && info.seasons > f.seasonsMax) return false;
    if (f.subOnly && !info.hasSub) return false;
    if (f.dubOnly && !info.hasDub) return false;
    if (f.watchlist === "yes" && !info.onWatchlist) return false;
    if (f.watchlist === "no" && info.onWatchlist) return false;
    if (f.dataOnly && !info.hasData) return false;
    return true;
  }
  function compareCards(a, b, criterion) {
    var parts = criterion.split("-");
    var field = parts[0], dir = parts[1];
    var mult = dir === "desc" ? -1 : 1;
    function numCmp(va, vb) {
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * mult;
    }
    switch (field) {
      case "rating":
        return numCmp(a.rating, b.rating);
      case "votes":
        return numCmp(a.votes, b.votes);
      case "episodes":
        return numCmp(a.episodes, b.episodes);
      case "seasons":
        return numCmp(a.seasons, b.seasons);
      case "title":
        return a.title.localeCompare(b.title) * mult;
      default:
        return 0;
    }
  }
  function applyFilterAndSort(ctx) {
    if (ctx.cards.size === 0) return;
    ctx._observerPaused = true;
    var f = getFilters(ctx._$, ctx.sidebar.root);
    var container = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
    if (!container) return;
    var entries = Array.from(ctx.cards.entries());
    var all = entries.map(function(e) {
      return { card: e[0], info: e[1] };
    });
    var visible = all.filter(function(item) {
      return passesFilter(item.info, f);
    });
    var hidden = all.filter(function(item) {
      return !passesFilter(item.info, f);
    });
    if (f.sort.length > 0) {
      visible.sort(function(a, b) {
        for (var ci = 0; ci < f.sort.length; ci++) {
          var r = compareCards(a.info, b.info, f.sort[ci]);
          if (r !== 0) return r;
        }
        return a.info.index - b.info.index;
      });
    } else {
      visible.sort(function(a, b) {
        return a.info.index - b.info.index;
      });
    }
    visible.forEach(function(item) {
      item.card.classList.remove("cr-hidden");
      container.appendChild(item.card);
    });
    hidden.forEach(function(item) {
      item.card.classList.add("cr-hidden");
      container.appendChild(item.card);
    });
    ctx._updateStats(visible.length, ctx.cards.size, withData(ctx.cards));
    setTimeout(function() {
      ctx._observerPaused = false;
    }, 500);
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
    function toggle2() {
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
    tab.addEventListener("click", toggle2);
    return {
      host: container.host,
      root,
      bodyEl: body,
      tabEl: tab,
      open,
      close,
      toggle: toggle2,
      isOpen: function() {
        return isOpen;
      },
      setTitle: function(t) {
        h2.textContent = t;
        tabSpan.textContent = t;
      }
    };
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
  function escCsv(v) {
    return '"' + String(v || "").replace(/"/g, '""') + '"';
  }
  function exportVisible(ctx) {
    var fmt = ctx._$("cr-export-fmt").value;
    var btn = ctx._$("cr-btn-copy");
    var items = Array.from(ctx.cards.entries()).filter(function(e) {
      return !e[0].classList.contains("cr-hidden");
    }).map(function(e) {
      return e[1];
    });
    if (items.length === 0) {
      btn.textContent = "⚠ Keine Titel";
      setTimeout(function() {
        btn.innerHTML = "📋 Kopieren";
      }, 1500);
      return;
    }
    var text = "";
    switch (fmt) {
      case "numbered":
        text = items.map(function(info, i) {
          return i + 1 + ". " + info.title;
        }).join("\n");
        break;
      case "bullets":
        text = items.map(function(info) {
          return "• " + info.title;
        }).join("\n");
        break;
      case "links":
        text = items.map(function(info) {
          return info.link || info.title;
        }).join("\n");
        break;
      case "csv": {
        var header = ["Titel", "Bewertung", "Stimmen", "Episoden", "Staffeln", "Sub", "Dub", "Watchlist", "Link"];
        var rows = items.map(function(i) {
          return [
            escCsv(i.title),
            escCsv(i.rating !== null ? i.rating : ""),
            escCsv(i.votes !== null ? i.votes : ""),
            escCsv(i.episodes !== null ? i.episodes : ""),
            escCsv(i.seasons !== null ? i.seasons : ""),
            escCsv(i.hasSub ? "Ja" : "Nein"),
            escCsv(i.hasDub ? "Ja" : "Nein"),
            escCsv(i.onWatchlist ? "Ja" : "Nein"),
            escCsv(i.link)
          ].join(",");
        });
        text = [header.join(","), rows.join("\n")].join("\n");
        break;
      }
      case "json":
        text = JSON.stringify(items.map(function(i) {
          return {
            title: i.title,
            rating: i.rating,
            votes: i.votes,
            episodes: i.episodes,
            seasons: i.seasons,
            sub: i.hasSub,
            dub: i.hasDub,
            onWatchlist: i.onWatchlist,
            link: i.link
          };
        }), null, 2);
        break;
      case "markdown": {
        let row2 = function(cells) {
          return "| " + cells.join(" | ") + " |";
        };
        var mdHeader = row2(["#", "Titel", "⭐", "👥", "📺 Ep.", "📦 St.", "Sub", "Dub"]);
        var sep = row2(["---", "---", "---", "---", "---", "---", "---", "---"]);
        var mdRows = items.map(function(info, idx) {
          return row2([
            String(idx + 1),
            info.title,
            info.rating !== null ? info.rating.toFixed(1) : "—",
            info.votes !== null ? fmtNum(info.votes) : "—",
            info.episodes !== null ? String(info.episodes) : "—",
            info.seasons !== null ? String(info.seasons) : "—",
            info.hasSub ? "✓" : "",
            info.hasDub ? "✓" : ""
          ]);
        });
        text = [mdHeader, sep].concat(mdRows).join("\n");
        break;
      }
    }
    navigator.clipboard.writeText(text).then(function() {
      btn.classList.add("copied");
      btn.innerHTML = "✅ " + items.length + " kopiert";
      setTimeout(function() {
        btn.classList.remove("copied");
        btn.innerHTML = "📋 Kopieren";
      }, 1800);
    }).catch(function() {
      btn.textContent = "⚠ Fehler";
      setTimeout(function() {
        btn.innerHTML = "📋 Kopieren";
      }, 1500);
    });
  }
  function sidebarStylesCSS() {
    return [
      ".body { padding: 0 !important; }",
      ".body::-webkit-scrollbar { width: 3px; }",
      ".body::-webkit-scrollbar-track { background: transparent; }",
      ".body::-webkit-scrollbar-thumb { background: rgba(244,117,33,0.4); border-radius: 2px; }",
      ".body::-webkit-scrollbar-thumb:hover { background: #f47521; }",
".cr-head { position:sticky; top:0; z-index:10; flex-shrink:0; background:#0e0e1a; border-bottom:1px solid rgba(244,117,33,0.2); padding:14px 16px 12px; display:flex; align-items:center; gap:10px; }",
      ".cr-head-logo { width:28px; height:28px; background:#f47521; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }",
      ".cr-head-text { flex:1; min-width:0; }",
      ".cr-head-text h2 { margin:0; font-size:14px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
      ".cr-head-text p { margin:2px 0 0; font-size:10px; color:#5a5a80; }",
      ".cr-head-close { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#888; width:28px; height:28px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.15s,color 0.15s; }",
      ".cr-head-close:hover { background:rgba(231,76,60,0.2); color:#e74c3c; border-color:rgba(231,76,60,0.4); }",
".cr-stats { flex-shrink:0; display:grid; grid-template-columns:1fr 1fr 1fr; background:#0e0e1a; border-bottom:1px solid rgba(255,255,255,0.06); }",
      ".cr-stat { padding:10px 6px; text-align:center; border-right:1px solid rgba(255,255,255,0.05); }",
      ".cr-stat:last-child { border-right:none; }",
      ".cr-stat-n { display:block; font-size:20px; font-weight:700; color:#f47521; line-height:1; }",
      ".cr-stat-l { display:block; font-size:9px; color:#4a4a70; text-transform:uppercase; letter-spacing:0.5px; margin-top:3px; }",
".cr-prog-wrap { flex-shrink:0; height:2px; background:rgba(255,255,255,0.05); display:none; }",
      ".cr-prog-fill { height:100%; background:linear-gradient(90deg,#f47521,#ff9f5a); width:0%; transition:width 0.12s; }",
      ".cr-status { flex-shrink:0; font-size:10px; color:#4a4a70; padding:5px 16px; border-bottom:1px solid rgba(255,255,255,0.04); min-height:22px; display:flex; align-items:center; gap:6px; }",
".cr-body-inner { padding:12px 12px 4px; display:flex; flex-direction:column; gap:8px; }",
".cr-card { background:#1a1a2a; border:1px solid rgba(255,255,255,0.07); border-radius:8px; overflow:hidden; }",
      ".cr-card-head { display:flex; align-items:center; gap:7px; padding:8px 12px; background:rgba(244,117,33,0.06); border-bottom:1px solid rgba(244,117,33,0.12); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.9px; color:#f47521; }",
      ".cr-card-head .cr-icon { font-size:13px; opacity:0.9; }",
      ".cr-card-body { padding:11px 12px; display:flex; flex-direction:column; gap:8px; }",
".cr-field { display:flex; align-items:center; gap:8px; }",
      ".cr-field-label { font-size:11px; color:#8888b0; min-width:80px; flex-shrink:0; }",
      ".cr-field-ctrl { flex:1; min-width:0; display:flex; align-items:center; gap:5px; }",
      ".cr-range { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:5px; flex:1; }",
      ".cr-range-sep { font-size:11px; color:#3a3a5a; text-align:center; flex-shrink:0; }",
      "input.cr-in, select.cr-sel { width:100%; padding:6px 8px; background:#0e0e1a; border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:#d8d8f0; font-size:11px; font-family:inherit; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; -webkit-appearance:none; appearance:none; }",
      "input.cr-in:focus, select.cr-sel:focus { outline:none; border-color:#f47521; box-shadow:0 0 0 2px rgba(244,117,33,0.15); }",
      "input.cr-in::placeholder { color:#2e2e4e; }",
      `select.cr-sel { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; padding-right:24px; cursor:pointer; }`,
      "select.cr-sel option { background:#12121e; color:#d8d8f0; }",
      ".cr-toggles { display:flex; flex-wrap:wrap; gap:6px; }",
      ".cr-toggle-lbl { display:flex; align-items:center; gap:5px; background:#0e0e1a; border:1px solid rgba(255,255,255,0.1); border-radius:5px; padding:5px 9px; font-size:11px; color:#8888b0; cursor:pointer; transition:border-color 0.15s,color 0.15s,background 0.15s; -webkit-user-select:none; user-select:none; }",
      ".cr-toggle-lbl:hover { border-color:rgba(244,117,33,0.4); color:#d8d8f0; }",
      ".cr-toggle-lbl input { display:none; }",
      ".cr-toggle-lbl.checked { background:rgba(244,117,33,0.12); border-color:rgba(244,117,33,0.5); color:#f47521; }",
      ".cr-wl-group { display:flex; gap:4px; }",
      ".cr-wl-lbl { flex:1; text-align:center; padding:5px 4px; background:#0e0e1a; border:1px solid rgba(255,255,255,0.08); border-radius:5px; font-size:10px; color:#666; cursor:pointer; transition:all 0.15s; -webkit-user-select:none; user-select:none; }",
      ".cr-wl-lbl:hover { border-color:rgba(244,117,33,0.3); color:#aaa; }",
      ".cr-wl-lbl.checked { background:rgba(244,117,33,0.12); border-color:rgba(244,117,33,0.5); color:#f47521; }",
      ".cr-wl-lbl input { display:none; }",
      ".cr-sort-level { display:grid; grid-template-columns:20px 1fr; align-items:center; gap:8px; }",
      ".cr-sort-num { font-size:10px; font-weight:700; color:#3a3a5a; text-align:center; }",
".cr-foot { flex-shrink:0; padding:10px 12px 12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:6px; background:#0e0e1a; }",
      ".cr-btn-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; }",
      ".cr-btn { padding:9px 12px; border:none; border-radius:6px; font-size:11px; font-weight:700; font-family:inherit; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:filter 0.15s,transform 0.1s; display:flex; align-items:center; justify-content:center; gap:5px; }",
      ".cr-btn:hover { filter:brightness(1.18); transform:translateY(-1px); }",
      ".cr-btn:active { transform:translateY(0); filter:brightness(0.9); }",
      ".cr-btn-scan { background:#2d6ca8; color:#fff; }",
      ".cr-btn-apply { background:#f47521; color:#fff; }",
      ".cr-btn-reset { background:rgba(231,76,60,0.12); color:#c0392b; border:1px solid rgba(231,76,60,0.25); }",
      ".cr-btn-reset:hover { background:rgba(231,76,60,0.22); filter:brightness(1); }",
      ".cr-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; filter:none; }",
".cr-export-row { display:grid; grid-template-columns:1fr auto; gap:6px; align-items:center; }",
      ".cr-btn-copy { padding:7px 12px; background:#2a6049; color:#5de8a8; border:1px solid rgba(93,232,168,0.25); border-radius:5px; font-size:11px; font-weight:700; font-family:inherit; cursor:pointer; transition:background 0.15s,filter 0.15s; white-space:nowrap; display:flex; align-items:center; gap:5px; }",
      ".cr-btn-copy:hover { background:#2e6e52; filter:brightness(1.15); }",
      ".cr-btn-copy.copied { background:#1a4a35; color:#3dcc8a; }",
".cr-spin { display:inline-block; width:10px; height:10px; border:2px solid rgba(244,117,33,0.2); border-top-color:#f47521; border-radius:50%; animation:cr-spin 0.7s linear infinite; flex-shrink:0; }"
    ].join("\n");
  }
  function bodyHTML(showBadges) {
    var chk = showBadges ? "checked" : "";
    return [
      '<div class="cr-head">',
      '<div class="cr-head-logo">⚙</div>',
      '<div class="cr-head-text"><h2>Advanced Filter</h2><p>Crunchyroll Browse Enhancer · v4.6</p></div>',
      '<button class="cr-head-close" id="cr-close">✕</button>',
      "</div>",
      '<div class="cr-stats">',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-vis">—</span><span class="cr-stat-l">Sichtbar</span></div>',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-tot">—</span><span class="cr-stat-l">Gesamt</span></div>',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-dat">—</span><span class="cr-stat-l">Mit Daten</span></div>',
      "</div>",
      '<div class="cr-prog-wrap" id="cr-prog"><div class="cr-prog-fill" id="cr-prog-fill"></div></div>',
      '<div class="cr-status" id="cr-status">Bereit — klicke Scannen um zu starten</div>',
      '<div class="cr-body-inner">',
'<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🔍</span>Suche</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Titel</span><div class="cr-field-ctrl"><input type="text" class="cr-in" id="cr-f-title" placeholder="Stichwort im Titel…"></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Beschreibung</span><div class="cr-field-ctrl"><input type="text" class="cr-in" id="cr-f-desc" placeholder="Stichwort in Beschreibung…"></div></div>',
      "</div></div>",
'<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">⭐</span>Bewertung &amp; Popularität</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Bewertung</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-r-min" min="0" max="5" step="0.1" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-r-max" min="0" max="5" step="0.1" placeholder="Max"></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Min. Stimmen</span><div class="cr-field-ctrl"><input type="number" class="cr-in" id="cr-f-v-min" min="0" placeholder="z. B. 500"></div></div>',
      "</div></div>",
'<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">📺</span>Umfang</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Episoden</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-ep-min" min="0" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-ep-max" min="0" placeholder="Max"></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Staffeln</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-se-min" min="0" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-se-max" min="0" placeholder="Max"></div></div>',
      "</div></div>",
'<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🌐</span>Verfügbarkeit</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Sprache</span><div class="cr-toggles" id="cr-lang-group"><label class="cr-toggle-lbl" id="lbl-sub"><input type="checkbox" id="cr-f-sub"> 🎌 Untertitel</label><label class="cr-toggle-lbl" id="lbl-dub"><input type="checkbox" id="cr-f-dub"> 🔊 Synchronisation</label></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Watchlist</span><div class="cr-wl-group"><label class="cr-wl-lbl checked" id="lbl-wl-all"><input type="radio" name="cr-wl" value="all" checked> Alle</label><label class="cr-wl-lbl" id="lbl-wl-yes"><input type="radio" name="cr-wl" value="yes"> ✅ Ja</label><label class="cr-wl-lbl" id="lbl-wl-no"><input type="radio" name="cr-wl" value="no"> ❌ Nein</label></div></div>',
      "</div></div>",
'<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🔀</span>Sortierung <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— bis zu 3 Ebenen</span></div><div class="cr-card-body">',
      '<div class="cr-sort-level"><span class="cr-sort-num">1</span><select class="cr-sel" id="cr-s-1">' + sortOptsHTML("— Standard —") + "</select></div>",
      '<div class="cr-sort-level"><span class="cr-sort-num">2</span><select class="cr-sel" id="cr-s-2">' + sortOptsHTML("— Keine —") + "</select></div>",
      '<div class="cr-sort-level"><span class="cr-sort-num">3</span><select class="cr-sel" id="cr-s-3">' + sortOptsHTML("— Keine —") + "</select></div>",
      "</div></div>",
'<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🏷</span>Anzeige</div><div class="cr-card-body">',
      '<label class="cr-toggle-lbl' + (showBadges ? " checked" : "") + '" id="lbl-badges" style="width:fit-content;"><input type="checkbox" id="cr-opt-badges" ' + chk + "> Badges auf Karten anzeigen</label>",
      '<label class="cr-toggle-lbl" id="lbl-data-only" style="width:fit-content;"><input type="checkbox" id="cr-opt-data"> Nur Karten mit gescannten Daten</label>',
      "</div></div>",
'<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">📋</span>Export <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— sichtbare Titel</span></div><div class="cr-card-body">',
      '<div class="cr-export-row">',
      '<select class="cr-sel" id="cr-export-fmt"><option value="numbered">1. Nummerierte Liste</option><option value="bullets">• Aufzählung</option><option value="csv">CSV (alle Daten)</option><option value="json">JSON (alle Daten)</option><option value="links">Links (URLs)</option><option value="markdown">Markdown Tabelle</option></select>',
      '<button class="cr-btn-copy" id="cr-btn-copy">📋 Kopieren</button>',
      "</div></div></div>",
'<div class="cr-foot">',
      '<div class="cr-btn-row">',
      '<button class="cr-btn cr-btn-scan" id="cr-btn-scan"><span>🔄</span> Scannen</button>',
      '<button class="cr-btn cr-btn-apply" id="cr-btn-apply"><span>✨</span> Anwenden</button>',
      "</div>",
      '<button class="cr-btn cr-btn-reset" id="cr-btn-reset">↺ Alle Filter zurücksetzen</button>',
      "</div>"
    ].join("");
  }
  function sortOptsHTML(empty) {
    return [
      '<option value="">' + empty + "</option>",
      '<option value="rating-desc">⭐ Bewertung — hoch &darr; niedrig</option>',
      '<option value="rating-asc">⭐ Bewertung — niedrig &rarr; hoch</option>',
      '<option value="votes-desc">👥 Stimmen — viele &rarr; wenige</option>',
      '<option value="votes-asc">👥 Stimmen — wenige &rarr; viele</option>',
      '<option value="episodes-desc">📺 Episoden — viele &rarr; wenige</option>',
      '<option value="episodes-asc">📺 Episoden — wenige &rarr; viele</option>',
      '<option value="seasons-desc">📦 Staffeln — viele &rarr; wenige</option>',
      '<option value="seasons-asc">📦 Staffeln — wenige &rarr; viele</option>',
      '<option value="title-asc">🔤 Titel — A &rarr; Z</option>',
      '<option value="title-desc">🔤 Titel — Z &rarr; A</option>'
    ].join("");
  }
  function buildSidebar(ctx, sidebarWidth) {
    ctx.sidebar = createSidebar({
      width: sidebarWidth,
      title: "Filter",
      accentColor: "#F47521",
      onOpen: async function() {
        ctx.isOpen = true;
        await GM.setValue("cr_sidebar_open", true);
      },
      onClose: async function() {
        ctx.isOpen = false;
        await GM.setValue("cr_sidebar_open", false);
      }
    });
    var style = document.createElement("style");
    style.textContent = sidebarStylesCSS();
    ctx.sidebar.root.appendChild(style);
    var sharedHdr = ctx.sidebar.root.querySelector(".header");
    if (sharedHdr) sharedHdr.style.display = "none";
    ctx.sidebar.bodyEl.innerHTML = bodyHTML(ctx.showBadges);
    if (ctx.isOpen) ctx.sidebar.open();
  }
  function attachEvents(ctx) {
    ctx._$("cr-close").addEventListener("click", function() {
      toggle(ctx, false);
    });
    ctx._$("cr-btn-scan").addEventListener("click", function() {
      ctx._scan();
    });
    ctx._$("cr-btn-apply").addEventListener("click", function() {
      ctx._apply();
    });
    ctx._$("cr-btn-reset").addEventListener("click", function() {
      ctx._reset();
    });
    ctx._$("cr-f-sub").addEventListener("change", function(e) {
      ctx._$("lbl-sub").classList.toggle("checked", e.target.checked);
      ctx._debounceApply();
    });
    ctx._$("cr-f-dub").addEventListener("change", function(e) {
      ctx._$("lbl-dub").classList.toggle("checked", e.target.checked);
      ctx._debounceApply();
    });
    var wlRadios = ctx.sidebar.root.querySelectorAll('input[name="cr-wl"]');
    Array.from(wlRadios).forEach(function(r) {
      r.addEventListener("change", function() {
        var labels = ctx.sidebar.root.querySelectorAll(".cr-wl-lbl");
        Array.from(labels).forEach(function(l) {
          l.classList.remove("checked");
        });
        var v = ctx.sidebar.root.querySelector('input[name="cr-wl"]:checked');
        v = v ? v.value : "all";
        var map = { all: "lbl-wl-all", yes: "lbl-wl-yes", no: "lbl-wl-no" };
        if (map[v]) ctx._$(map[v]).classList.add("checked");
        ctx._debounceApply();
      });
    });
    ctx._$("cr-opt-badges").addEventListener("change", async function(e) {
      ctx.showBadges = e.target.checked;
      ctx._$("lbl-badges").classList.toggle("checked", ctx.showBadges);
      await GM.setValue("cr_show_badges", ctx.showBadges);
      updateBadgeVisibility(ctx.showBadges);
    });
    ctx._$("cr-opt-data").addEventListener("change", function(e) {
      ctx._$("lbl-data-only").classList.toggle("checked", e.target.checked);
      ctx._debounceApply();
    });
    ctx._$("cr-btn-copy").addEventListener("click", function() {
      exportVisible(ctx);
    });
    var filterIds = [
      "cr-f-title",
      "cr-f-desc",
      "cr-f-r-min",
      "cr-f-r-max",
      "cr-f-v-min",
      "cr-f-ep-min",
      "cr-f-ep-max",
      "cr-f-se-min",
      "cr-f-se-max",
      "cr-s-1",
      "cr-s-2",
      "cr-s-3"
    ];
    filterIds.forEach(function(id) {
      var el = ctx._$(id);
      if (el) {
        el.addEventListener("input", function() {
          ctx._debounceApply();
        });
        el.addEventListener("change", function() {
          ctx._debounceApply();
        });
      }
    });
  }
  function toggle(ctx, forceTo) {
    if (forceTo === true || forceTo === void 0 && !ctx.isOpen) {
      ctx.sidebar.open();
    } else {
      ctx.sidebar.close();
    }
  }
  function updateStatus(ctx, msg) {
    var el = ctx._$("cr-status");
    if (el) el.textContent = msg;
  }
  function updateStats(ctx, visible, total, wd) {
    var vis = ctx._$("cr-s-vis");
    var tot = ctx._$("cr-s-tot");
    var dat = ctx._$("cr-s-dat");
    if (vis) vis.textContent = String(visible);
    if (tot) tot.textContent = String(total);
    if (dat) dat.textContent = String(wd);
  }
  function resetFilters(ctx) {
    var ids = [
      "cr-f-title",
      "cr-f-desc",
      "cr-f-r-min",
      "cr-f-r-max",
      "cr-f-v-min",
      "cr-f-ep-min",
      "cr-f-ep-max",
      "cr-f-se-min",
      "cr-f-se-max",
      "cr-s-1",
      "cr-s-2",
      "cr-s-3"
    ];
    ids.forEach(function(id) {
      var el = ctx._$(id);
      if (el) el.value = "";
    });
    ["cr-f-sub", "cr-f-dub"].forEach(function(id) {
      ctx._$(id).checked = false;
    });
    ctx._$("lbl-sub").classList.remove("checked");
    ctx._$("lbl-dub").classList.remove("checked");
    ctx._$("cr-opt-data").checked = false;
    ctx._$("lbl-data-only").classList.remove("checked");
    var allRadio = ctx.sidebar.root.querySelector('input[name="cr-wl"][value="all"]');
    if (allRadio) allRadio.checked = true;
    var wlLabels = ctx.sidebar.root.querySelectorAll(".cr-wl-lbl");
    Array.from(wlLabels).forEach(function(l) {
      l.classList.remove("checked");
    });
    ctx._$("lbl-wl-all").classList.add("checked");
    var container = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
    if (container) {
      ctx.origOrder.forEach(function(card) {
        card.classList.remove("cr-hidden");
        container.appendChild(card);
      });
    }
    ctx._updateStats(ctx.cards.size, ctx.cards.size, withData(ctx.cards));
    ctx._saveFilters();
  }
  async function saveFilters(ctx) {
    try {
      await saveSetting("crunchyroll_advanced_filters", getFilters(ctx._$, ctx.sidebar.root));
    } catch (e) {
      ctx.log.warn("Failed to save filters", e);
    }
  }
  async function loadSavedFilters(ctx) {
    try {
      let set2 = function(id, val) {
        if (val == null || val === "") return;
        var el = $(id);
        if (el) el.value = String(val);
      };
      var set = set2;
      var s = await loadSetting("crunchyroll_advanced_filters", {});
      if (typeof s === "string") {
        try {
          s = JSON.parse(s);
        } catch (e) {
          s = {};
        }
      }
      if (!s || typeof s !== "object") s = {};
      var $ = ctx._$;
      set2("cr-f-title", s.title);
      set2("cr-f-desc", s.desc);
      set2("cr-f-r-min", s.ratingMin);
      set2("cr-f-r-max", s.ratingMax);
      set2("cr-f-v-min", s.votesMin);
      set2("cr-f-ep-min", s.epMin);
      set2("cr-f-ep-max", s.epMax);
      set2("cr-f-se-min", s.seasonsMin);
      set2("cr-f-se-max", s.seasonsMax);
      set2("cr-s-1", s.sort ? s.sort[0] : null);
      set2("cr-s-2", s.sort ? s.sort[1] : null);
      set2("cr-s-3", s.sort ? s.sort[2] : null);
      if (s.dataOnly) {
        var doEl = $("cr-opt-data");
        if (doEl) doEl.checked = true;
        var doLbl = $("lbl-data-only");
        if (doLbl) doLbl.classList.add("checked");
      }
      if (s.subOnly) {
        var subEl = $("cr-f-sub");
        if (subEl) subEl.checked = true;
        var subLbl = $("lbl-sub");
        if (subLbl) subLbl.classList.add("checked");
      }
      if (s.dubOnly) {
        var dubEl = $("cr-f-dub");
        if (dubEl) dubEl.checked = true;
        var dubLbl = $("lbl-dub");
        if (dubLbl) dubLbl.classList.add("checked");
      }
      if (s.watchlist && s.watchlist !== "all") {
        var r = ctx.sidebar.root.querySelector('input[name="cr-wl"][value="' + s.watchlist + '"]');
        if (r) {
          r.checked = true;
          var wlLbls = ctx.sidebar.root.querySelectorAll(".cr-wl-lbl");
          Array.from(wlLbls).forEach(function(l) {
            l.classList.remove("checked");
          });
          var wlMap = { yes: "lbl-wl-yes", no: "lbl-wl-no" };
          if (wlMap[s.watchlist]) {
            var targetLbl = $(wlMap[s.watchlist]);
            if (targetLbl) targetLbl.classList.add("checked");
          }
          var allLbl = $("lbl-wl-all");
          if (allLbl) allLbl.classList.remove("checked");
        }
      }
    } catch (e) {
      ctx.log.warn("Failed to load saved filters", e);
    }
  }
  // @license      MIT
  var SW = 360;
  var log = createLogger("Crunchyroll Enhanced");
  GM_addStyle([
    "html { transition: margin-right 0.32s ease !important; }",
    ".cr-overlay { position:absolute; top:5px; right:5px; z-index:3; display:flex; flex-direction:column; gap:2px; pointer-events:none; }",
    ".cr-badge { display:inline-block; padding:2px 5px; border-radius:3px; font-size:9px; font-weight:700; line-height:1.4; white-space:nowrap; }",
    ".cr-b-rating   { background:rgba(230,140,10,0.9); color:#fff; }",
    ".cr-b-votes    { background:rgba(130,60,160,0.9); color:#fff; }",
    ".cr-b-seasons  { background:rgba(30,150,80,0.9);  color:#fff; }",
    ".cr-b-episodes { background:rgba(40,120,200,0.9); color:#fff; }",
    ".cr-b-sub      { background:rgba(20,50,80,0.92);  color:#6bb5e0; }",
    ".cr-b-dub      { background:rgba(20,50,80,0.92);  color:#9ecfec; }",
    ".cr-b-wl       { background:rgba(200,40,40,0.88); color:#fff; }",
    ".cr-hidden { display: none !important; }",
    "@keyframes cr-spin { to { transform: rotate(360deg); } }",
    "@keyframes cr-new-card { from { outline: 2px solid #f47521; } to { outline: 2px solid transparent; } }",
    ".cr-new-card { animation: cr-new-card 1.2s ease-out forwards; }"
  ].join("\n"));
  class CrunchyrollEnhanced {
    constructor() {
      this.cards = new Map();
      this.origOrder = [];
      this.isScanning = false;
      this.isOpen = false;
      this.showBadges = true;
      this.log = log;
      var self = this;
      this._debounceApply = debounce(function() {
        saveFilters(self);
        self._apply();
      }, 280);
      this._waitForCards().then(function() {
        self._buildUI();
        setTimeout(function() {
          self._scan();
        }, 1200);
      });
    }
_waitForCards() {
      return waitForElement(".browse-card", 0).catch(function() {
      });
    }
    async _buildUI() {
      this.isOpen = await GM.getValue("cr_sidebar_open", false);
      this.showBadges = await GM.getValue("cr_show_badges", true);
      buildSidebar(this, SW);
      await loadSavedFilters(this);
      attachEvents(this);
    }
_$(id) {
      return this.sidebar.root.querySelector("#" + CSS.escape(id));
    }
_scan() {
      scanCards(this);
    }
    _apply() {
      applyFilterAndSort(this);
    }
    _toggle(forceTo) {
      toggle(this, forceTo);
    }
    _reset() {
      resetFilters(this);
    }
    _status(msg) {
      updateStatus(this, msg);
    }
    _updateStats(visible, total, wd) {
      updateStats(this, visible, total, wd);
    }
    _saveFilters() {
      saveFilters(this);
    }
    _sleep(ms) {
      return new Promise(function(r) {
        setTimeout(r, ms);
      });
    }
  }
  setInterval(function() {
    var v = document.querySelector("video[disablePictureInPicture]");
    if (v) v.removeAttribute("disablePictureInPicture");
  }, 1e3);
  if (/\/videos\/popular/.test(location.pathname))
    new CrunchyrollEnhanced();

})();
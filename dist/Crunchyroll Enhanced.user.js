// ==UserScript==
// @name         Crunchyroll Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.2.2
// @author       marmoris-x
// @description  Sidebar (page-push) with multi-filter & sort for Crunchyroll browse — auto-scan, retry, export/clipboard, data-only filter
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=32&domain=crunchyroll.com
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.user.js
// @match        https://*.crunchyroll.com/*
// @sandbox      raw
// @grant        GM.getValue
// @grant        GM.registerMenuCommand
// @grant        GM.setValue
// @grant        GM_addStyle
// @grant        window.onurlchange
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  function createLogger(prefix, debugMode = false) {
    const tag = `[${prefix}]`;
    const forward = (method, args) => console[method](tag, ...args);
    return {
log: (...args) => forward("log", args),
warn: (...args) => forward("warn", args),
error: (...args) => forward("error", args),
info: (...args) => forward("info", args),
debug: (...args) => {
        if (debugMode) forward("debug", args);
      }
    };
  }
  function waitForElement(selector, timeout = 1e4, root = document.body) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      let timer = null;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.matches && node.matches(selector)) {
              cleanup();
              return resolve(node);
            }
            if (node.querySelector && node.querySelector(selector)) {
              cleanup();
              return resolve(node.querySelector(selector));
            }
          }
        }
      });
      const cleanup = () => {
        observer.disconnect();
        if (timer !== null) clearTimeout(timer);
      };
      observer.observe(root, { childList: true, subtree: true });
      if (timeout > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`waitForElement timeout: ${selector}`));
        }, timeout);
      }
    });
  }
  function debounce(fn, ms = 200) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }
  function createState() {
    return {
cards: new Map(),
origOrder: [],
isScanning: false,
isOpen: false,
showBadges: true,
sidebar: null,
_observer: null,
_observerPaused: false,
_observerTimer: null
    };
  }
  function createEmitter() {
    const listeners = new Map();
    return {
on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
      },
off(event, fn) {
        const set = listeners.get(event);
        if (set) set.delete(fn);
      },
emit(event, ...args) {
        const set = listeners.get(event);
        if (set) set.forEach((fn) => fn(...args));
      },
clear() {
        listeners.clear();
      }
    };
  }
  function queryById(root) {
    return (id) => root.querySelector("#" + CSS.escape(id));
  }
  async function scanCards(ctx) {
    if (ctx.isScanning) return;
    ctx.isScanning = true;
    const btn = ctx._$("cr-btn-scan");
    btn.disabled = true;
    btn.textContent = "";
    btn.append(createSpinner(), document.createTextNode(" Scanning…"));
    ctx._status("Scanning cards…");
    ctx._$("cr-prog").style.display = "block";
    ctx.cards.clear();
    ctx.origOrder.length = 0;
    const all = document.querySelectorAll(".browse-card");
    const forceStyle = document.createElement("style");
    forceStyle.id = "cr-force-hover";
    forceStyle.textContent = [
      '[class*="browse-card-hover"] {',
      "opacity: 1 !important; visibility: visible !important;",
      "display: block !important; transform: none !important;",
      "pointer-events: none !important;",
      "}"
    ].join("");
    document.head.appendChild(forceStyle);
    for (const card of all) {
      card.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    }
    await ctx._sleep(600);
    for (let i = 0; i < all.length; i++) {
      try {
        const card = all[i];
        const info = extractInfo(card, i);
        ctx.cards.set(card, info);
        ctx.origOrder.push(card);
        if (ctx.showBadges) addBadges(card, info);
      } catch (err) {
        ctx.log.warn("Scan error on card", i, err);
      }
      ctx._$("cr-prog-fill").style.width = Math.round((i + 1) / all.length * 100) + "%";
      ctx._status("Scanned: " + (i + 1) + " / " + all.length);
      if ((i + 1) % 30 === 0) await ctx._sleep(0);
    }
    const fh = document.getElementById("cr-force-hover");
    if (fh) fh.remove();
    ctx._$("cr-prog").style.display = "none";
    const noData = [...ctx.cards.entries()].filter(function(e) {
      return !e[1].hasData;
    }).map(function(e) {
      return e[0];
    });
    if (noData.length > 0) {
      retryNoData(ctx, noData);
    }
    const wd = withData(ctx.cards);
    ctx._status("✅ " + all.length + " scanned, " + wd + " with data");
    ctx._updateStats(all.length, all.length, wd);
    ctx.isScanning = false;
    btn.disabled = false;
    btn.textContent = "";
    btn.innerHTML = "<span>🔄</span> Scan";
    ctx._apply();
    startObserver(ctx);
  }
  function extractInfo(card, index) {
    const titleEl = card.querySelector('h3[data-t="title"] a') || card.querySelector('[class*="browse-card__title"] a') || card.querySelector('[data-testid="card-title"] a') || card.querySelector('a[class*="title"]') || card.querySelector('a[href*="/series/"]');
    const title = titleEl ? titleEl.textContent.trim() : "";
    const link = titleEl ? titleEl.href : "";
    const seriesId = link.match(/series\/([A-Z0-9]+)/) ? link.match(/series\/([A-Z0-9]+)/)[1] : "";
    const descEl = card.querySelector('p[data-t="description"]') || card.querySelector('[class*="browse-card__description"]') || card.querySelector('[data-testid="card-description"]') || card.querySelector('[class*="description"]');
    const description = descEl ? descEl.textContent.trim() : "";
    const ratingEl = card.querySelector('p[class*="star-rating-short-static__rating"]') || card.querySelector('[data-t="star-rating-short-static"] [class*="rating"]') || card.querySelector('[class*="rating"][data-t]') || card.querySelector('[class*="star-rating"] [class*="rating"]') || card.querySelector('[class*="rating"]');
    const rating = ratingEl ? parseFloat(ratingEl.textContent.trim()) || null : null;
    const votesEl = card.querySelector('p[data-t="rating-count"]') || card.querySelector('[class*="votes-count"]') || card.querySelector('[class*="star-rating-short-static__votes"]') || card.querySelector('[class*="rating-count"]');
    let votes = null;
    if (votesEl) {
      const m = votesEl.textContent.match(/([\d,.]+)\s*([kKmM]?)/);
      if (m) {
        let n = parseFloat(m[1].replace(",", "."));
        const s = m[2].toLowerCase();
        if (s === "k") n *= 1e3;
        else if (s === "m") n *= 1e6;
        votes = Math.round(n);
      }
    }
    const metaEl = card.querySelector('[class*="browse-card-hover__series-meta"]') || card.querySelector('[class*="series-meta"]');
    let seasons = null, episodes = null;
    if (metaEl) {
      for (const span of metaEl.querySelectorAll("span")) {
        const t = span.textContent.trim();
        const ep = t.match(/(\d+)\s*(?:Episode[ns]?|Folge[n]?)/i);
        const se = t.match(/(\d+)\s*(?:Staffel[n]?|Season[s]?)/i);
        if (ep) episodes = parseInt(ep[1], 10);
        if (se) seasons = parseInt(se[1], 10);
      }
    }
    let hasSub = false, hasDub = false;
    for (const el of card.querySelectorAll('[class*="meta-tags"] span, [class*="meta-tag"] span')) {
      const t = el.textContent.toLowerCase();
      if (t.includes("untertitel") || t.includes("sub")) hasSub = true;
      if (t.includes("synchro") || t.includes("dub")) hasDub = true;
    }
    const onWatchlist = !!card.querySelector(
      '[class*="card-watchlist-label"], [class*="watchlist-label"]'
    );
    const hasData = rating !== null || votes !== null || episodes !== null || seasons !== null;
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
    const style = document.createElement("style");
    style.id = "cr-force-hover";
    style.textContent = [
      '[class*="browse-card-hover"] {',
      "opacity: 1 !important; visibility: visible !important;",
      "display: block !important; transform: none !important;",
      "pointer-events: none !important;",
      "}"
    ].join("");
    document.head.appendChild(style);
    for (const c of cards) {
      c.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    }
  }
  async function retryNoData(ctx, noDataCards) {
    ctx._status("Retry: " + noDataCards.length + " cards without data…");
    triggerHover(noDataCards);
    await ctx._sleep(1e3);
    let improved = 0;
    for (const card of noDataCards) {
      try {
        const old = ctx.cards.get(card);
        if (!old) continue;
        const fresh = extractInfo(card, old.index);
        if (fresh.hasData) {
          ctx.cards.set(card, fresh);
          if (ctx.showBadges) addBadges(card, fresh);
          improved++;
        }
      } catch (err) {
        ctx.log.warn("Retry error on card", err);
      }
    }
    const fh = document.getElementById("cr-force-hover");
    if (fh) fh.remove();
    ctx._status("Retry: +" + improved + " of " + noDataCards.length + " upgraded");
    ctx.log.log("Retry: " + improved + "/" + noDataCards.length + " cards now have data");
  }
  function addBadges(card, info) {
    const existing = card.querySelector(".cr-overlay");
    if (existing) existing.remove();
    const anchor = card.querySelector('[class*="browse-card__poster"], [class*="content-image"]') || card;
    if (getComputedStyle(anchor).position === "static") {
      anchor.style.position = "relative";
    }
    const ov = document.createElement("div");
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
    const b = document.createElement("div");
    b.className = "cr-badge " + cls;
    b.textContent = text;
    return b;
  }
  function createSpinner() {
    const span = document.createElement("span");
    span.className = "cr-spin";
    return span;
  }
  function updateBadgeVisibility(show) {
    for (const el of document.querySelectorAll(".cr-overlay")) {
      el.style.display = show ? "" : "none";
    }
  }
  function startObserver(ctx) {
    const target = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
    if (!target) return;
    if (ctx._observer) {
      ctx._observer.disconnect();
      ctx._observer = null;
    }
    ctx._observerPaused = false;
    ctx._observerTimer = null;
    ctx._observer = new MutationObserver(function(mutations) {
      if (ctx._observerPaused || ctx.isScanning) return;
      const newCards = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.parentElement !== target) continue;
          if (node.classList && node.classList.contains("browse-card") && !ctx.cards.has(node)) {
            newCards.push(node);
          }
          if (node.querySelectorAll) {
            for (const c of node.querySelectorAll(".browse-card")) {
              if (!ctx.cards.has(c)) newCards.push(c);
            }
          }
        }
      }
      if (newCards.length === 0) return;
      clearTimeout(ctx._observerTimer);
      ctx._observerTimer = setTimeout(function() {
        const ready = newCards.filter(function(c) {
          const t = c.querySelector('h3[data-t="title"] a, [class*="browse-card__title"] a');
          return t && t.textContent.trim() !== "";
        });
        if (ready.length > 0) ingestNewCards(ctx, ready);
      }, 400);
    });
    ctx._observer.observe(target, { childList: true, subtree: true });
  }
  async function ingestNewCards(ctx, cards) {
    for (const c of cards) {
      c.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    }
    await ctx._sleep(700);
    let added = 0;
    for (const card of cards) {
      try {
        if (ctx.cards.has(card)) continue;
        const info = extractInfo(card, ctx.origOrder.length);
        ctx.cards.set(card, info);
        ctx.origOrder.push(card);
        if (ctx.showBadges) addBadges(card, info);
        card.classList.add("cr-new-card");
        added++;
      } catch (err) {
        ctx.log.warn("ingestNewCards error", err);
      }
    }
    if (added > 0) {
      ctx._status("+" + added + " new cards detected");
      let visCount = 0;
      for (const c of ctx.cards.keys()) {
        if (!c.classList.contains("cr-hidden")) visCount++;
      }
      ctx._updateStats(visCount, ctx.cards.size, withData(ctx.cards));
      ctx._apply();
    }
  }
  function withData(cards) {
    let count = 0;
    for (const info of cards.values()) {
      if (info.hasData) count++;
    }
    return count;
  }
  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function getFilters($, sidebarRoot) {
    const num = (id) => {
      const v = parseFloat($(id) ? $(id).value : "");
      return isNaN(v) ? null : v;
    };
    const intVal = (id) => {
      const v = parseInt($(id) ? $(id).value : "", 10);
      return isNaN(v) ? null : v;
    };
    const str = (id) => {
      const el = $(id);
      return el ? el.value.trim().toLowerCase() : "";
    };
    const chk = (id) => {
      const el = $(id);
      return el ? el.checked : false;
    };
    const wlEl = sidebarRoot.querySelector('input[name="cr-wl"]:checked');
    const wl = wlEl ? wlEl.value : "all";
    const result = {
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
      sort: ["cr-s-1", "cr-s-2", "cr-s-3"].map((id) => {
        const el = $(id);
        return el ? el.value : "";
      }).filter(Boolean)
    };
    return result;
  }
  function passesFilter(info, f) {
    if (f.title && !info.title.toLowerCase().includes(f.title)) return false;
    if (f.desc && !info.description.toLowerCase().includes(f.desc)) return false;
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
    const parts = criterion.split("-");
    const field = parts[0], dir = parts[1];
    const mult = dir === "desc" ? -1 : 1;
    const numCmp = (va, vb) => {
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * mult;
    };
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
    try {
      if (ctx.cards.size === 0) return;
      ctx._observerPaused = true;
      const f = getFilters(ctx._$, ctx.sidebar.root);
      const card0 = ctx.origOrder[0];
      const container = card0 ? card0.parentElement : null;
      if (!container) return;
      const entries = [...ctx.cards.entries()];
      const all = entries.map((e) => ({ card: e[0], info: e[1] }));
      const visible = all.filter((item) => passesFilter(item.info, f));
      const hidden = all.filter((item) => !passesFilter(item.info, f));
      if (f.sort.length > 0) {
        visible.sort((a, b) => {
          for (let ci = 0; ci < f.sort.length; ci++) {
            const r = compareCards(a.info, b.info, f.sort[ci]);
            if (r !== 0) return r;
          }
          return a.info.index - b.info.index;
        });
      } else {
        visible.sort((a, b) => a.info.index - b.info.index);
      }
      for (const item of visible) {
        item.card.classList.remove("cr-hidden");
        container.appendChild(item.card);
      }
      for (const item of hidden) {
        item.card.classList.add("cr-hidden");
        container.appendChild(item.card);
      }
      ctx._updateStats(visible.length, ctx.cards.size, withData(ctx.cards));
      setTimeout(() => {
        ctx._observerPaused = false;
      }, 500);
    } catch (err) {
      console.error("[Crunchyroll Enhanced] applyFilterAndSort error:", err);
    }
  }
  function createShadowContainer(opts = {}) {
    const host = document.createElement(opts.tag || "div");
    if (opts.id) host.id = opts.id;
    if (opts.className) host.className = opts.className;
    const root = host.attachShadow({ mode: "closed" });
    if (opts.styles) {
      const style = document.createElement("style");
      style.textContent = opts.styles;
      root.appendChild(style);
    }
    document.body.appendChild(host);
    const _reinsert = new MutationObserver(() => {
      if (!host.isConnected && document.body) {
        document.body.appendChild(host);
      }
    });
    _reinsert.observe(document.body, { childList: true });
    setTimeout(() => _reinsert.disconnect(), 6e4);
    return { host, root };
  }
  function createSidebar(opts = {}) {
    const width = opts.width ?? 340;
    const accent = opts.accentColor ?? "#F47521";
    const title = opts.title ?? "";
    let isOpen = false;
    const baseCSS = [
      ":host {",
      "all: initial;",
      "position: fixed; top: 0; right: 0; width: " + width + "px; height: 100vh;",
      "z-index: 2147483645;",
      "font: 13px/1.5 system-ui, sans-serif;",
      "transform: translateX(" + width + "px);",
      "transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);",
      "display: flex; flex-direction: column;",
      "}",
      ":host(.open) { transform: translateX(0); }",
      ".header {",
      "display: flex; align-items: center; padding: 10px 14px;",
      "cursor: move; user-select: none; flex-shrink: 0;",
      "}",
      ".header h2 { margin: 0; font-size: 14px; font-weight: 600; color: " + accent + "; flex: 1; }",
      ".header button {",
      "background: none; border: none; color: #e0e0e0; cursor: pointer;",
      "font-size: 18px; padding: 0 4px; line-height: 1;",
      "}",
      ".header button:hover { color: " + accent + "; }",
      ".body { flex: 1; overflow-y: auto; }",
      opts.cssOverrides || ""
    ].join("\n");
    const container = createShadowContainer({ styles: baseCSS });
    const root = container.root;
    const header = document.createElement("div");
    header.className = "header";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close sidebar");
    header.append(h2, closeBtn);
    root.appendChild(header);
    const body = document.createElement("div");
    body.className = "body";
    root.appendChild(body);
    const tab = document.createElement("div");
    const tabRoot = tab.attachShadow({ mode: "closed" });
    const tabStyle = document.createElement("style");
    tabStyle.textContent = [
      ":host {",
      "all: initial;",
      "position: fixed; top: 50%; z-index: 2147483644;",
      "background: " + accent + "; color: #fff;",
      "padding: 10px 6px; border-radius: 6px 0 0 6px; cursor: pointer;",
      "font: 12px system-ui, sans-serif;",
      "writing-mode: vertical-rl; text-orientation: mixed;",
      "box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.3);",
      "right: 0; transform: translateY(-50%);",
      "transition: right 0.32s cubic-bezier(0.4, 0, 0.2, 1);",
      "pointer-events: auto;",
      "}",
      ":host(:hover) { filter: brightness(1.15); }",
      ":host(.open) { right: " + (width + 8) + "px; }"
    ].join("\n");
    const tabSpan = document.createElement("span");
    tabSpan.textContent = title;
    tabRoot.append(tabStyle, tabSpan);
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
    function toggleFn() {
      if (isOpen) close();
      else open();
    }
    let dragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
    header.addEventListener("mousedown", function(e) {
      if (e.target === closeBtn) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const cs = getComputedStyle(container.host);
      startRight = parseInt(cs.right, 10) || 0;
      startTop = parseInt(cs.top, 10) || 0;
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
    tab.addEventListener("click", toggleFn);
    return {
      host: container.host,
      root,
      bodyEl: body,
      tabEl: tab,
      open,
      close,
      toggle: toggleFn,
      isOpen: function() {
        return isOpen;
      },
      setTitle: function(t) {
        h2.textContent = t;
        tabSpan.textContent = t;
      }
    };
  }
  async function loadSetting(key, defaultValue = null) {
    try {
      const raw = await GM.getValue(key);
      if (raw === void 0 || raw === null) return defaultValue;
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return raw;
        }
      }
      return raw;
    } catch (_) {
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    await GM.setValue(
      key,
      typeof value === "object" && value !== null ? JSON.stringify(value) : value
    );
  }
  function escCsv(v) {
    const s = String(v ?? "");
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportVisible(ctx) {
    const fmt = ctx._$("cr-export-fmt").value;
    const btn = ctx._$("cr-btn-copy");
    const items = [...ctx.cards.entries()].filter((e) => !e[0].classList.contains("cr-hidden")).map((e) => e[1]);
    if (items.length === 0) {
      btn.textContent = "⚠ No titles";
      setTimeout(() => {
        btn.textContent = "📋 Copy";
      }, 1500);
      return;
    }
    let text = "";
    switch (fmt) {
      case "numbered":
        text = items.map((info, i) => i + 1 + ". " + info.title).join("\n");
        break;
      case "bullets":
        text = items.map((info) => "• " + info.title).join("\n");
        break;
      case "links":
        text = items.map((info) => info.link || info.title).join("\n");
        break;
      case "csv": {
        const header = ["Titel", "Bewertung", "Stimmen", "Episoden", "Staffeln", "Sub", "Dub", "Watchlist", "Link"];
        const rows = items.map((i) => {
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
        text = JSON.stringify(items.map((i) => ({
          title: i.title,
          rating: i.rating,
          votes: i.votes,
          episodes: i.episodes,
          seasons: i.seasons,
          sub: i.hasSub,
          dub: i.hasDub,
          onWatchlist: i.onWatchlist,
          link: i.link
        })), null, 2);
        break;
      case "markdown": {
        const row = (cells) => "| " + cells.join(" | ") + " |";
        const mdHeader = row(["#", "Titel", "⭐", "👥", "📺 Ep.", "📦 St.", "Sub", "Dub"]);
        const sep = row(["---", "---", "---", "---", "---", "---", "---", "---"]);
        const mdRows = items.map((info, idx) => {
          return row([
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
        text = [mdHeader, sep, ...mdRows].join("\n");
        break;
      }
    }
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add("copied");
      btn.textContent = "✅ " + items.length + " copied";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = "📋 Copy";
      }, 1800);
    }).catch(() => {
      btn.textContent = "⚠ Error";
      setTimeout(() => {
        btn.textContent = "📋 Copy";
      }, 1500);
    });
  }
  const CSS_VARS = [
    ":host {",
    "--cr-bg: #0a0a14;",
    "--cr-surface: rgba(18, 18, 38, 0.65);",
    "--cr-surface-raised: rgba(30, 30, 55, 0.82);",
    "--cr-border: rgba(255, 255, 255, 0.07);",
    "--cr-border-focus: rgba(244, 117, 33, 0.45);",
    "--cr-accent: #f47521;",
    "--cr-accent-glow: rgba(244, 117, 33, 0.25);",
    "--cr-text: #f0f0f8;",
    "--cr-text-secondary: #9898b8;",
    "--cr-text-muted: #5a5a80;",
    "--cr-danger: #e74c3c;",
    "--cr-success: #3dcc8a;",
    "--cr-info: #5b9bd5;",
    "--cr-radius-sm: 6px;",
    "--cr-radius-md: 10px;",
    "--cr-transition: 0.15s cubic-bezier(0.4, 0, 0.2, 1);",
    "--cr-transition-med: 0.25s cubic-bezier(0.4, 0, 0.2, 1);",
    "--cr-blur: 16px;",
    "background: linear-gradient(180deg, rgba(10,10,20,0.97) 0%, rgba(14,14,28,0.95) 50%, rgba(10,10,20,0.97) 100%);",
    "backdrop-filter: blur(var(--cr-blur));",
    "-webkit-backdrop-filter: blur(var(--cr-blur));",
    "border-left: 1px solid var(--cr-border);",
    "box-shadow: -4px 0 32px rgba(0,0,0,0.45);",
    "color: var(--cr-text);",
    "}"
  ];
  function sidebarStylesCSS() {
    return [
      ...CSS_VARS,
".body::-webkit-scrollbar { width: 4px; }",
      ".body::-webkit-scrollbar-track { background: transparent; }",
      ".body::-webkit-scrollbar-thumb { background: rgba(244,117,33,0.2); border-radius: 2px; }",
      ".body::-webkit-scrollbar-thumb:hover { background: var(--cr-accent); }",
".cr-head {",
      "position: sticky; top: 0; z-index: 10; flex-shrink: 0;",
      "background: linear-gradient(180deg, rgba(10,10,20,0.98) 0%, rgba(10,10,20,0.92) 100%);",
      "backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);",
      "border-bottom: 1px solid rgba(244,117,33,0.15);",
      "padding: 16px 18px; display: flex; align-items: center; gap: 12px;",
      "}",
      ".cr-head-logo {",
      "width: 32px; height: 32px;",
      "background: linear-gradient(135deg, #f47521, #ff9a3c);",
      "border-radius: var(--cr-radius-sm);",
      "display: flex; align-items: center; justify-content: center;",
      "font-size: 16px; flex-shrink: 0;",
      "box-shadow: 0 2px 8px rgba(244,117,33,0.3);",
      "}",
      ".cr-head-text { flex: 1; min-width: 0; }",
      ".cr-head-text h2 { margin: 0; font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".cr-head-text p { margin: 2px 0 0; font-size: 10px; color: var(--cr-text-muted); letter-spacing: 0.3px; }",
      ".cr-head-close {",
      "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);",
      "border-radius: var(--cr-radius-sm); color: var(--cr-text-muted);",
      "width: 28px; height: 28px; cursor: pointer; font-size: 14px;",
      "display: flex; align-items: center; justify-content: center; flex-shrink: 0;",
      "transition: background var(--cr-transition), color var(--cr-transition), border-color var(--cr-transition);",
      "}",
      ".cr-head-close:hover { background: rgba(231,76,60,0.18); color: var(--cr-danger); border-color: rgba(231,76,60,0.35); }",
".cr-stats { flex-shrink: 0; display: grid; grid-template-columns: 1fr 1fr 1fr; background: rgba(10,10,20,0.5); border-bottom: 1px solid rgba(255,255,255,0.05); }",
      ".cr-stat { padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.04); }",
      ".cr-stat:last-child { border-right: none; }",
      ".cr-stat-n { display: block; font-size: 22px; font-weight: 700; color: var(--cr-accent); line-height: 1; text-shadow: 0 0 12px var(--cr-accent-glow); }",
      ".cr-stat-l { display: block; font-size: 9px; color: var(--cr-text-muted); text-transform: uppercase; letter-spacing: 0.6px; margin-top: 4px; }",
".cr-prog-wrap { flex-shrink: 0; height: 2px; background: rgba(255,255,255,0.04); display: none; }",
      ".cr-prog-fill { height: 100%; background: linear-gradient(90deg, var(--cr-accent), #ffa64d); width: 0%; transition: width 0.2s ease; }",
".cr-status { flex-shrink: 0; font-size: 10px; color: var(--cr-text-muted); padding: 6px 18px; border-bottom: 1px solid rgba(255,255,255,0.03); min-height: 24px; display: flex; align-items: center; gap: 6px; }",
".cr-body-inner { padding: 12px 14px 8px; display: flex; flex-direction: column; gap: 10px; }",
".cr-accordion { background: var(--cr-surface); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--cr-border); border-radius: var(--cr-radius-md); overflow: hidden; transition: border-color var(--cr-transition-med), box-shadow var(--cr-transition-med); }",
      ".cr-accordion[open] { border-color: rgba(244,117,33,0.18); box-shadow: 0 2px 12px rgba(0,0,0,0.25); }",
      ".cr-accordion-summary { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; user-select: none; -webkit-user-select: none; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--cr-text-secondary); transition: color var(--cr-transition); list-style: none; }",
      ".cr-accordion-summary::-webkit-details-marker { display: none; }",
      ".cr-accordion-summary:hover { color: var(--cr-accent); }",
      ".cr-accordion[open] > .cr-accordion-summary { color: var(--cr-accent); border-bottom: 1px solid rgba(244,117,33,0.1); }",
      ".cr-accordion-icon { font-size: 14px; opacity: 0.8; flex-shrink: 0; }",
      ".cr-accordion-arrow { margin-left: auto; flex-shrink: 0; transition: transform var(--cr-transition-med); font-size: 10px; color: var(--cr-text-muted); }",
      ".cr-accordion[open] .cr-accordion-arrow { transform: rotate(180deg); }",
      ".cr-accordion-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 9px; }",
".cr-filter-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; background: var(--cr-accent); color: #fff; border-radius: 9px; font-size: 10px; font-weight: 700; margin-left: auto; transition: transform var(--cr-transition), opacity var(--cr-transition); }",
      ".cr-filter-chip[hidden] { display: none; }",
      ".cr-filter-chip:not([hidden]) { animation: cr-chip-pop 0.2s ease-out; }",
      "@keyframes cr-chip-pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }",
".cr-field { display: flex; align-items: center; gap: 8px; }",
      ".cr-field-label { font-size: 11px; color: var(--cr-text-muted); min-width: 80px; flex-shrink: 0; }",
      ".cr-field-ctrl { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }",
      ".cr-range { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 6px; flex: 1; }",
      ".cr-range-sep { font-size: 11px; color: var(--cr-text-muted); text-align: center; flex-shrink: 0; }",
"input.cr-in, select.cr-sel { width: 100%; padding: 7px 10px; background: rgba(14,14,30,0.75); border: 1px solid rgba(255,255,255,0.09); border-radius: var(--cr-radius-sm); color: var(--cr-text); font-size: 11px; font-family: inherit; transition: border-color var(--cr-transition), box-shadow var(--cr-transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; }",
      "input.cr-in:focus, select.cr-sel:focus { outline: none; border-color: var(--cr-accent); box-shadow: 0 0 0 3px var(--cr-accent-glow); }",
      "input.cr-in::placeholder { color: rgba(255,255,255,0.15); }",
      `select.cr-sel { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 26px; cursor: pointer; }`,
      "select.cr-sel option { background: #14142a; color: var(--cr-text); }",
".cr-toggles { display: flex; flex-wrap: wrap; gap: 6px; }",
      ".cr-toggle-lbl { display: flex; align-items: center; gap: 5px; background: rgba(14,14,30,0.55); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--cr-radius-sm); padding: 6px 10px; font-size: 11px; color: var(--cr-text-muted); cursor: pointer; transition: border-color var(--cr-transition), color var(--cr-transition), background var(--cr-transition); user-select: none; -webkit-user-select: none; }",
      ".cr-toggle-lbl:hover { border-color: rgba(244,117,33,0.3); color: var(--cr-text-secondary); }",
      ".cr-toggle-lbl input { display: none; }",
      ".cr-toggle-lbl.active { background: rgba(244,117,33,0.12); border-color: rgba(244,117,33,0.4); color: var(--cr-accent); box-shadow: 0 0 8px rgba(244,117,33,0.1); }",
".cr-wl-group { display: flex; gap: 4px; }",
      ".cr-wl-lbl { flex: 1; text-align: center; padding: 6px 4px; background: rgba(14,14,30,0.55); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--cr-radius-sm); font-size: 10px; color: var(--cr-text-muted); cursor: pointer; transition: all var(--cr-transition); user-select: none; -webkit-user-select: none; }",
      ".cr-wl-lbl:hover { border-color: rgba(244,117,33,0.25); color: var(--cr-text-secondary); }",
      ".cr-wl-lbl input { display: none; }",
      ".cr-wl-lbl.active { background: rgba(244,117,33,0.12); border-color: rgba(244,117,33,0.4); color: var(--cr-accent); }",
".cr-sort-level { display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 8px; }",
      ".cr-sort-num { font-size: 10px; font-weight: 700; color: var(--cr-text-muted); text-align: center; }",
".cr-foot { flex-shrink: 0; padding: 12px 14px 14px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 8px; background: linear-gradient(0deg, rgba(10,10,20,0.95) 0%, rgba(14,14,28,0.7) 100%); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }",
      ".cr-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }",
".cr-btn { padding: 10px 14px; border: none; border-radius: var(--cr-radius-sm); font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; transition: filter var(--cr-transition), transform 0.1s ease, box-shadow var(--cr-transition); display: flex; align-items: center; justify-content: center; gap: 6px; }",
      ".cr-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }",
      ".cr-btn:active { transform: translateY(0); filter: brightness(0.88); }",
      ".cr-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; filter: none; box-shadow: none; }",
      ".cr-btn-scan { background: linear-gradient(135deg, #2d6ca8, #3a85cc); color: #fff; box-shadow: 0 2px 8px rgba(45,108,168,0.3); }",
      ".cr-btn-apply { background: linear-gradient(135deg, #f47521, #ff9340); color: #fff; box-shadow: 0 2px 10px var(--cr-accent-glow); }",
      ".cr-btn-reset { background: rgba(231,76,60,0.08); color: #c0392b; border: 1px solid rgba(231,76,60,0.2); }",
      ".cr-btn-reset:hover { background: rgba(231,76,60,0.18); filter: brightness(1); box-shadow: 0 2px 10px rgba(231,76,60,0.2); }",
".cr-export-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }",
      ".cr-btn-copy { padding: 8px 14px; background: linear-gradient(135deg, #1a4a35, #2a6049); color: var(--cr-success); border: 1px solid rgba(61,204,138,0.2); border-radius: var(--cr-radius-sm); font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background var(--cr-transition), filter var(--cr-transition); white-space: nowrap; display: flex; align-items: center; gap: 5px; }",
      ".cr-btn-copy:hover { background: linear-gradient(135deg, #1e5a3f, #2e6e52); filter: brightness(1.15); }",
      ".cr-btn-copy.copied { background: #143528; color: #5de8a8; }",
".cr-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(244,117,33,0.2); border-top-color: var(--cr-accent); border-radius: 50%; animation: cr-spin 0.7s linear infinite; flex-shrink: 0; }",
"@keyframes cr-spin { to { transform: rotate(360deg); } }",
".cr-hidden { display: none !important; }"
    ].join("\n");
  }
  function makeField(labelText, control) {
    const field = document.createElement("div");
    field.className = "cr-field";
    const label = document.createElement("span");
    label.className = "cr-field-label";
    label.textContent = labelText;
    field.append(label, control);
    return field;
  }
  function makeTextInput(id, placeholder) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "cr-in";
    input.id = id;
    input.placeholder = placeholder;
    return input;
  }
  function makeNumberInput(id, placeholder, min, max, step) {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "cr-in";
    input.id = id;
    input.placeholder = placeholder;
    return input;
  }
  function makeSelect(id, options) {
    const sel = document.createElement("select");
    sel.className = "cr-sel";
    sel.id = id;
    for (const opt of options) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      sel.appendChild(el);
    }
    return sel;
  }
  function sortOptions(emptyLabel) {
    return [
      { value: "", label: emptyLabel },
      { value: "rating-desc", label: "⭐ Bewertung — hoch → niedrig" },
      { value: "rating-asc", label: "⭐ Bewertung — niedrig → hoch" },
      { value: "votes-desc", label: "👥 Stimmen — viele → wenige" },
      { value: "votes-asc", label: "👥 Stimmen — wenige → viele" },
      { value: "episodes-desc", label: "📺 Episoden — viele → wenige" },
      { value: "episodes-asc", label: "📺 Episoden — wenige → viele" },
      { value: "seasons-desc", label: "📦 Staffeln — viele → wenige" },
      { value: "seasons-asc", label: "📦 Staffeln — wenige → viele" },
      { value: "title-asc", label: "🔤 Titel — A → Z" },
      { value: "title-desc", label: "🔤 Titel — Z → A" }
    ];
  }
  function makeToggle(text, inputId, checked) {
    const lbl = document.createElement("label");
    lbl.className = "cr-toggle-lbl" + (checked ? " active" : "");
    lbl.id = "lbl-" + inputId;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = inputId;
    if (checked) input.checked = true;
    lbl.appendChild(input);
    lbl.appendChild(document.createTextNode(text));
    return lbl;
  }
  function makeRadioGroup(name, options, selectedValue) {
    const group = document.createElement("div");
    group.className = "cr-wl-group";
    for (const opt of options) {
      const lbl = document.createElement("label");
      lbl.className = "cr-wl-lbl" + (opt.value === selectedValue ? " active" : "");
      lbl.id = "lbl-wl-" + opt.value;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = opt.value;
      if (opt.value === selectedValue) input.checked = true;
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(opt.label));
      group.appendChild(lbl);
    }
    return group;
  }
  function makeRange(idMin, idMax, placeholderMin, placeholderMax) {
    const range = document.createElement("div");
    range.className = "cr-range";
    const minInput = makeNumberInput(idMin, placeholderMin);
    const sep = document.createElement("span");
    sep.className = "cr-range-sep";
    sep.textContent = "–";
    const maxInput = makeNumberInput(idMax, placeholderMax);
    range.append(minInput, sep, maxInput);
    return range;
  }
  function makeAccordion(icon, title, bodyElements, chipId) {
    const details = document.createElement("details");
    details.className = "cr-accordion";
    details.open = false;
    const summary = document.createElement("summary");
    summary.className = "cr-accordion-summary";
    const iconEl = document.createElement("span");
    iconEl.className = "cr-accordion-icon";
    iconEl.textContent = icon;
    const label = document.createElement("span");
    label.textContent = title;
    summary.append(iconEl, label);
    if (chipId) {
      const chip = document.createElement("span");
      chip.className = "cr-filter-chip";
      chip.id = chipId;
      chip.hidden = true;
      chip.textContent = "0";
      summary.append(chip);
    }
    const arrow = document.createElement("span");
    arrow.className = "cr-accordion-arrow";
    arrow.textContent = "▼";
    summary.appendChild(arrow);
    details.appendChild(summary);
    const body = document.createElement("div");
    body.className = "cr-accordion-body";
    for (const el of bodyElements) body.appendChild(el);
    details.appendChild(body);
    return details;
  }
  function buildBodyContent(state) {
    const frag = document.createDocumentFragment();
    const head = document.createElement("div");
    head.className = "cr-head";
    head.innerHTML = [
      '<div class="cr-head-logo">⚙</div>',
      '<div class="cr-head-text"><h2>Advanced Filter</h2><p>Crunchyroll Browse Enhancer · v5.2.1</p></div>',
      '<button class="cr-head-close" id="cr-close">✕</button>'
    ].join("");
    frag.appendChild(head);
    const stats = document.createElement("div");
    stats.className = "cr-stats";
    stats.innerHTML = [
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-vis">—</span><span class="cr-stat-l">Visible</span></div>',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-tot">—</span><span class="cr-stat-l">Total</span></div>',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-dat">—</span><span class="cr-stat-l">With Data</span></div>'
    ].join("");
    frag.appendChild(stats);
    const prog = document.createElement("div");
    prog.className = "cr-prog-wrap";
    prog.id = "cr-prog";
    const fill = document.createElement("div");
    fill.className = "cr-prog-fill";
    fill.id = "cr-prog-fill";
    prog.appendChild(fill);
    frag.appendChild(prog);
    const status = document.createElement("div");
    status.className = "cr-status";
    status.id = "cr-status";
    status.textContent = "Ready — click Scan to start";
    frag.appendChild(status);
    const inner = document.createElement("div");
    inner.className = "cr-body-inner";
    inner.appendChild(makeAccordion("🔍", "Search", [
      makeField("Title", makeTextInput("cr-f-title", "Search in title…")),
      makeField("Description", makeTextInput("cr-f-desc", "Search in description…"))
    ], "cr-chip-search"));
    inner.appendChild(makeAccordion("⭐", "Rating & Popularity", [
      makeField("Rating", makeRange("cr-f-r-min", "cr-f-r-max", "Min", "Max")),
      makeField("Min Votes", makeField(
        "Min Votes",
        (() => {
          const inp = makeNumberInput("cr-f-v-min", "e.g. 500");
          return inp;
        })()
      ))
    ], "cr-chip-rating"));
    inner.appendChild(makeAccordion("📺", "Scope", [
      makeField("Episodes", makeRange("cr-f-ep-min", "cr-f-ep-max", "Min", "Max")),
      makeField("Seasons", makeRange("cr-f-se-min", "cr-f-se-max", "Min", "Max"))
    ], "cr-chip-scope"));
    const subDubGroup = document.createElement("div");
    subDubGroup.className = "cr-toggles";
    subDubGroup.id = "cr-lang-group";
    subDubGroup.appendChild(makeToggle("🎌 Subtitles", "cr-f-sub"));
    subDubGroup.appendChild(makeToggle("🔊 Dubbing", "cr-f-dub"));
    inner.appendChild(makeAccordion("🌐", "Availability", [
      makeField("Language", subDubGroup),
      makeField("Watchlist", makeRadioGroup("cr-wl", [
        { value: "all", label: "All" },
        { value: "yes", label: "✅ Yes" },
        { value: "no", label: "❌ No" }
      ], "all"))
    ], "cr-chip-avail"));
    inner.appendChild(makeAccordion("🔀", "Sorting", [
      (() => {
        const lvl = document.createElement("div");
        lvl.className = "cr-sort-level";
        const n1 = document.createElement("span");
        n1.className = "cr-sort-num";
        n1.textContent = "1";
        lvl.append(n1, makeSelect("cr-s-1", sortOptions("— Default —")));
        return lvl;
      })(),
      (() => {
        const lvl = document.createElement("div");
        lvl.className = "cr-sort-level";
        const n2 = document.createElement("span");
        n2.className = "cr-sort-num";
        n2.textContent = "2";
        lvl.append(n2, makeSelect("cr-s-2", sortOptions("— None —")));
        return lvl;
      })(),
      (() => {
        const lvl = document.createElement("div");
        lvl.className = "cr-sort-level";
        const n3 = document.createElement("span");
        n3.className = "cr-sort-num";
        n3.textContent = "3";
        lvl.append(n3, makeSelect("cr-s-3", sortOptions("— None —")));
        return lvl;
      })()
    ]));
    inner.appendChild(makeAccordion("🏷", "Display", [
      (() => {
        const container = document.createElement("div");
        container.className = "cr-toggles";
        container.appendChild(makeToggle("Show badges on cards", "cr-opt-badges", state.showBadges));
        container.appendChild(makeToggle("Only cards with scanned data", "cr-opt-data"));
        return container;
      })()
    ]));
    const exportRow = document.createElement("div");
    exportRow.className = "cr-export-row";
    exportRow.appendChild(makeSelect("cr-export-fmt", [
      { value: "numbered", label: "1. Numbered List" },
      { value: "bullets", label: "• Bullet List" },
      { value: "csv", label: "CSV (all data)" },
      { value: "json", label: "JSON (all data)" },
      { value: "links", label: "Links (URLs)" },
      { value: "markdown", label: "Markdown Table" }
    ]));
    const copyBtn = document.createElement("button");
    copyBtn.className = "cr-btn-copy";
    copyBtn.id = "cr-btn-copy";
    copyBtn.textContent = "📋 Copy";
    exportRow.appendChild(copyBtn);
    inner.appendChild(makeAccordion("📋", "Export", [exportRow]));
    frag.appendChild(inner);
    const foot = document.createElement("div");
    foot.className = "cr-foot";
    foot.innerHTML = [
      '<div class="cr-btn-row">',
      '<button class="cr-btn cr-btn-scan" id="cr-btn-scan">🔄 Scan</button>',
      '<button class="cr-btn cr-btn-apply" id="cr-btn-apply">✨ Apply</button>',
      "</div>",
      '<button class="cr-btn cr-btn-reset" id="cr-btn-reset">↺ Reset All Filters</button>'
    ].join("");
    frag.appendChild(foot);
    return frag;
  }
  function buildSidebar(state, sidebarWidth) {
    state.sidebar = createSidebar({
      width: sidebarWidth,
      title: "Filter",
      accentColor: "#F47521",
      onOpen: async function() {
        state.isOpen = true;
        await GM.setValue("cr_sidebar_open", true);
      },
      onClose: async function() {
        state.isOpen = false;
        await GM.setValue("cr_sidebar_open", false);
      }
    });
    const style = document.createElement("style");
    style.textContent = sidebarStylesCSS();
    state.sidebar.root.appendChild(style);
    const sharedHdr = state.sidebar.root.querySelector(".header");
    if (sharedHdr) sharedHdr.style.display = "none";
    state.sidebar.bodyEl.textContent = "";
    state.sidebar.bodyEl.appendChild(buildBodyContent(state));
    if (state.isOpen) state.sidebar.open();
  }
  function attachEvents(state, _$, emitter, debouncedApply) {
    _$("cr-close").addEventListener("click", () => {
      try {
        toggle(state, false);
      } catch (err) {
        console.error("[Crunchyroll Enhanced] Close error:", err);
      }
    });
    _$("cr-btn-scan").addEventListener("click", () => {
      try {
        state._scan();
      } catch (err) {
        console.error("[Crunchyroll Enhanced] Scan error:", err);
      }
    });
    _$("cr-btn-apply").addEventListener("click", () => {
      try {
        debouncedApply();
      } catch (err) {
        console.error("[Crunchyroll Enhanced] Apply error:", err);
      }
    });
    _$("cr-btn-reset").addEventListener("click", () => {
      try {
        resetFilters(state, _$, emitter);
        debouncedApply();
      } catch (err) {
        console.error("[Crunchyroll Enhanced] Reset error:", err);
      }
    });
    _$("cr-f-sub").addEventListener("change", (e) => {
      _$("lbl-cr-f-sub").classList.toggle("active", e.target.checked);
      emitter.emit("filter:changed");
    });
    _$("cr-f-dub").addEventListener("change", (e) => {
      _$("lbl-cr-f-dub").classList.toggle("active", e.target.checked);
      emitter.emit("filter:changed");
    });
    const wlInputs = state.sidebar.root.querySelectorAll('input[name="cr-wl"]');
    for (const r of wlInputs) {
      r.addEventListener("change", () => {
        for (const l of state.sidebar.root.querySelectorAll(".cr-wl-lbl")) {
          l.classList.remove("active");
        }
        const checked = state.sidebar.root.querySelector('input[name="cr-wl"]:checked');
        const val = checked ? checked.value : "all";
        const map = { all: "lbl-wl-all", yes: "lbl-wl-yes", no: "lbl-wl-no" };
        if (map[val]) _$("lbl-wl-" + val).classList.add("active");
        emitter.emit("filter:changed");
      });
    }
    _$("cr-opt-badges").addEventListener("change", async (e) => {
      state.showBadges = e.target.checked;
      _$("lbl-cr-opt-badges").classList.toggle("active", state.showBadges);
      await GM.setValue("cr_show_badges", state.showBadges);
      updateBadgeVisibility(state.showBadges);
    });
    _$("cr-opt-data").addEventListener("change", (e) => {
      _$("lbl-cr-opt-data").classList.toggle("active", e.target.checked);
      emitter.emit("filter:changed");
    });
    _$("cr-btn-copy").addEventListener("click", () => {
      try {
        exportVisible({ cards: state.cards, _$, ...state });
      } catch (err) {
        console.error("[Crunchyroll Enhanced] Copy error:", err);
      }
    });
    const filterIds = [
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
    for (const id of filterIds) {
      const el = _$(id);
      if (el) {
        el.addEventListener("input", () => emitter.emit("filter:changed"));
        el.addEventListener("change", () => emitter.emit("filter:changed"));
      }
    }
  }
  function toggle(state, forceTo) {
    if (!state.sidebar) return;
    {
      state.sidebar.close();
    }
  }
  function updateStatus(state, msg) {
    if (!state.sidebar) return;
    const el = state.sidebar.root.querySelector("#cr-status");
    if (el) el.textContent = msg;
  }
  function updateStats(state, visible, total, withDataCount) {
    if (!state.sidebar) return;
    const vis = state.sidebar.root.querySelector("#cr-s-vis");
    const tot = state.sidebar.root.querySelector("#cr-s-tot");
    const dat = state.sidebar.root.querySelector("#cr-s-dat");
    if (vis) vis.textContent = String(visible);
    if (tot) tot.textContent = String(total);
    if (dat) dat.textContent = String(withDataCount);
  }
  function resetFilters(state, _$, emitter) {
    const ids = [
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
    for (const id of ids) {
      const el = _$(id);
      if (el) el.value = "";
    }
    for (const id of ["cr-f-sub", "cr-f-dub"]) {
      const el = _$(id);
      if (el) el.checked = false;
    }
    for (const lblId of ["lbl-cr-f-sub", "lbl-cr-f-dub"]) {
      const el = _$(lblId);
      if (el) el.classList.remove("active");
    }
    const dataEl = _$("cr-opt-data");
    if (dataEl) dataEl.checked = false;
    const dataLbl = _$("lbl-cr-opt-data");
    if (dataLbl) dataLbl.classList.remove("active");
    const allRadio = state.sidebar.root.querySelector('input[name="cr-wl"][value="all"]');
    if (allRadio) allRadio.checked = true;
    for (const l of state.sidebar.root.querySelectorAll(".cr-wl-lbl")) {
      l.classList.remove("active");
    }
    const allLbl = _$("lbl-wl-all");
    if (allLbl) allLbl.classList.add("active");
    const container = state.origOrder[0] ? state.origOrder[0].parentElement : null;
    if (container) {
      for (const card of state.origOrder) {
        card.classList.remove("cr-hidden");
        container.appendChild(card);
      }
    }
    updateStats(state, state.cards.size, state.cards.size, withData(state.cards));
    emitter.emit("filter:changed");
  }
  async function saveFilters(state, _$, _emitter2, log2) {
    try {
      await saveSetting(
        "cr_filters",
        getFilters(_$, state.sidebar.root)
      );
    } catch (e) {
      if (log2) log2.warn("Failed to save filters", e);
    }
  }
  async function loadSavedFilters(state, _$, _emitter2, log2) {
    try {
      let s = await loadSetting("cr_filters", null);
      if (s === null) {
        const old = await loadSetting("crunchyroll_advanced_filters", null);
        if (old !== null) {
          s = old;
          await saveSetting("cr_filters", JSON.stringify(s));
        } else {
          s = {};
        }
      }
      if (typeof s === "string") {
        try {
          s = JSON.parse(s);
        } catch (e) {
          s = {};
        }
      }
      if (!s || typeof s !== "object") s = {};
      const setField = (id, val) => {
        if (val == null || val === "") return;
        const el = _$(id);
        if (el) el.value = String(val);
      };
      setField("cr-f-title", s.title);
      setField("cr-f-desc", s.desc);
      setField("cr-f-r-min", s.ratingMin);
      setField("cr-f-r-max", s.ratingMax);
      setField("cr-f-v-min", s.votesMin);
      setField("cr-f-ep-min", s.epMin);
      setField("cr-f-ep-max", s.epMax);
      setField("cr-f-se-min", s.seasonsMin);
      setField("cr-f-se-max", s.seasonsMax);
      setField("cr-s-1", s.sort ? s.sort[0] : null);
      setField("cr-s-2", s.sort ? s.sort[1] : null);
      setField("cr-s-3", s.sort ? s.sort[2] : null);
      if (s.dataOnly) {
        const doEl = _$("cr-opt-data");
        if (doEl) doEl.checked = true;
        const doLbl = _$("lbl-cr-opt-data");
        if (doLbl) doLbl.classList.add("active");
      }
      if (s.subOnly) {
        const subEl = _$("cr-f-sub");
        if (subEl) subEl.checked = true;
        const subLbl = _$("lbl-cr-f-sub");
        if (subLbl) subLbl.classList.add("active");
      }
      if (s.dubOnly) {
        const dubEl = _$("cr-f-dub");
        if (dubEl) dubEl.checked = true;
        const dubLbl = _$("lbl-cr-f-dub");
        if (dubLbl) dubLbl.classList.add("active");
      }
      if (s.watchlist && s.watchlist !== "all") {
        try {
          const r = state.sidebar.root.querySelector(
            'input[name="cr-wl"][value="' + s.watchlist + '"]'
          );
          if (r) {
            r.checked = true;
            for (const l of state.sidebar.root.querySelectorAll(".cr-wl-lbl")) {
              l.classList.remove("active");
            }
            const wlMap = { yes: "lbl-wl-yes", no: "lbl-wl-no" };
            if (wlMap[s.watchlist]) {
              const targetLbl = _$(wlMap[s.watchlist]);
              if (targetLbl) targetLbl.classList.add("active");
            }
            const allLbl = _$("lbl-wl-all");
            if (allLbl) allLbl.classList.remove("active");
          }
        } catch (e2) {
          if (log2) log2.warn("Failed to restore watchlist filter", e2);
        }
      }
    } catch (e) {
      if (log2) log2.warn("Failed to load saved filters", e);
    }
  }
  const log = createLogger("Crunchyroll Enhanced");
  let _initialized = false;
  let _state = null;
  let _emitter = null;
  async function init(opts = {}) {
    if (_initialized) {
      if (_state && _state._scan && !_state.isScanning) {
        _state._scan();
      }
      return { state: _state, emitter: _emitter };
    }
    const sidebarWidth = opts.sidebarWidth ?? 360;
    const state = createState();
    const emitter = createEmitter();
    const debouncedApply = debounce(() => {
      if (!state.sidebar) return;
      const _$2 = queryById(state.sidebar.root);
      saveFilters(state, _$2, emitter, log);
      applyFilterAndSort(createCtx(state, _$2, emitter, debouncedApply));
    }, 280);
    function createCtx(st, _$2, _em, da) {
      return {
        cards: st.cards,
        origOrder: st.origOrder,
        isScanning: st.isScanning,
        showBadges: st.showBadges,
        sidebar: st.sidebar,
        _observer: st._observer,
        _observerPaused: st._observerPaused,
        _observerTimer: st._observerTimer,
        _$: _$2,
        log,
        _status: (msg) => updateStatus(st, msg),
        _updateStats: (v, t, wd) => updateStats(st, v, t, wd),
        _sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        _apply: () => da(),
        _debounceApply: () => da()
      };
    }
    state._scan = async () => {
      if (!state.sidebar) return;
      const _$2 = queryById(state.sidebar.root);
      const ctx = createCtx(state, _$2, emitter, debouncedApply);
      await scanCards(ctx);
    };
    await waitForElement(".browse-card", 0).catch(() => {
    });
    state.isOpen = await loadSetting("cr_sidebar_open", false);
    state.showBadges = await loadSetting("cr_show_badges", true);
    buildSidebar(state, sidebarWidth);
    const _$ = queryById(state.sidebar.root);
    await loadSavedFilters(state, _$, emitter, log);
    attachEvents(state, _$, emitter, debouncedApply);
    setTimeout(() => {
      const ctx = createCtx(state, _$, emitter, debouncedApply);
      scanCards(ctx);
    }, 1200);
    emitter.on("scan:complete", () => debouncedApply());
    emitter.on("filter:changed", () => debouncedApply());
    _initialized = true;
    _state = state;
    _emitter = emitter;
    return { state, emitter };
  }
  function unlockPiP() {
    if (!/\/watch\//.test(location.pathname)) return;
    const existing = document.querySelectorAll("video[disablePictureInPicture]");
    for (const v of existing) {
      v.removeAttribute("disablePictureInPicture");
    }
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "disablepictureinpicture") {
          m.target.removeAttribute("disablePictureInPicture");
        }
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches && node.matches("video[disablePictureInPicture]")) {
            node.removeAttribute("disablePictureInPicture");
          }
          if (node.querySelectorAll) {
            for (const v of node.querySelectorAll("video[disablePictureInPicture]")) {
              v.removeAttribute("disablePictureInPicture");
            }
          }
        }
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disablepictureinpicture"]
    });
  }
  
  unlockPiP();
  if (/\/videos\/popular/.test(location.pathname)) {
    GM_addStyle([
      "html { transition: margin-right 0.32s cubic-bezier(0.4,0,0.2,1) !important; }",
      ".cr-overlay { position:absolute; top:5px; right:5px; z-index:3; display:flex; flex-direction:column; gap:2px; pointer-events:none; }",
      ".cr-badge { display:inline-block; padding:2px 5px; border-radius:3px; font-size:9px; font-weight:700; line-height:1.4; white-space:nowrap; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); }",
      ".cr-b-rating   { background:rgba(230,140,10,0.88); color:#fff; }",
      ".cr-b-votes    { background:rgba(130,60,160,0.88); color:#fff; }",
      ".cr-b-seasons  { background:rgba(30,150,80,0.88);  color:#fff; }",
      ".cr-b-episodes { background:rgba(40,120,200,0.88); color:#fff; }",
      ".cr-b-sub      { background:rgba(20,50,80,0.9);    color:#6bb5e0; }",
      ".cr-b-dub      { background:rgba(20,50,80,0.9);    color:#9ecfec; }",
      ".cr-b-wl       { background:rgba(200,40,40,0.85);  color:#fff; }",
      ".cr-hidden { display:none !important; }",
      "@keyframes cr-spin { to { transform: rotate(360deg); } }",
      "@keyframes cr-new-card { from { outline: 2px solid #f47521; } to { outline: 2px solid transparent; } }",
      ".cr-new-card { animation: cr-new-card 1.2s ease-out forwards; }"
    ].join("\n"));
    async function bootstrap() {
      try {
        await init({ sidebarWidth: 360 });
      } catch (err) {
        console.error("[Crunchyroll Enhanced] Bootstrap failed", err);
      }
    }
    bootstrap();
  }
  if (typeof window.onurlchange === "function") {
    window.addEventListener("urlchange", async () => {
      if (/\/videos\/popular/.test(location.pathname)) {
        try {
          await init({ sidebarWidth: 360 });
        } catch (err) {
          console.error("[Crunchyroll Enhanced] SPA bootstrap failed", err);
        }
      }
    });
  }
  if (typeof GM.registerMenuCommand === "function") {
    GM.registerMenuCommand("🔍 Crunchyroll Enhanced Scan", () => {
      if (/\/videos\/popular/.test(location.pathname)) {
        init({ sidebarWidth: 360 });
      }
    });
  }

})();
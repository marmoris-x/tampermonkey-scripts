// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.5.0
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
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  function createLogger(prefix, debugMode = false) {
    const tag = `[${prefix}]`;
    const make = (method) => (...args) => console[method](tag, ...args);
    return {
      log: make("log"),
      warn: make("warn"),
      error: make("error"),
      info: make("info"),
      debug: debugMode ? make("debug") : () => {
      }
    };
  }
  class NetworkError extends Error {
    constructor(url, message = "Network error") {
      super(`${message} for ${url}`);
      this.name = "NetworkError";
    }
  }
  class HttpStatusError extends Error {
    constructor(url, status) {
      super(`HTTP ${status} for ${url}`);
      this.name = "HttpStatusError";
      this.status = status;
    }
  }
  class TimeoutError extends Error {
    constructor(url) {
      super(`Timeout for ${url}`);
      this.name = "TimeoutError";
    }
  }
  function fetchPage(url, opts = {}) {
    const retries = opts.retries ?? 2;
    const timeout = opts.timeout ?? 15e3;
    const anonymous = opts.anonymous !== false;
    return new Promise((resolve, reject) => {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout,
          anonymous,
          onload(r) {
            if (r.status >= 200 && r.status < 300) {
              try {
                const doc = new DOMParser().parseFromString(r.responseText, "text/html");
                resolve(doc);
              } catch (e) {
                reject(new Error(`DOMParser failed: ${e.message}`));
              }
            } else if (n < retries) {
              attempt(n + 1);
            } else {
              reject(new HttpStatusError(url, r.status));
            }
          },
          onerror() {
            if (n < retries) attempt(n + 1);
            else reject(new NetworkError(url));
          },
          ontimeout() {
            if (n < retries) attempt(n + 1);
            else reject(new TimeoutError(url));
          }
        });
      }
      attempt(0);
    });
  }
  async function loadSetting(key, defaultValue) {
    try {
      const raw = await GM.getValue(key);
      if (raw === void 0 || raw === null) return defaultValue;
      return raw;
    } catch {
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    await GM.setValue(key, value);
  }
  const STORAGE_KEY_RATING = "anisearch_rating_min";
  const STAR_SELS = [
    '[class*="star"]',
    '[class*="rating"]',
    '[class*="score"]',
    ".rating",
    ".score"
  ];
  function extractRating(itemEl) {
    for (const sel of STAR_SELS) {
      const el = itemEl.querySelector(sel);
      if (!el) continue;
      const sources = [el.getAttribute("title") || "", (el.textContent || "").trim()];
      for (const src of sources) {
        const m = src.match(/(\d+(?:[.,]\d+)?)/);
        if (m) {
          const v = parseFloat(m[1].replace(",", "."));
          if (!isNaN(v) && v > 0) return v;
        }
      }
    }
    const dataEl = itemEl.querySelector("[data-rating],[data-score],[data-average]");
    if (dataEl) {
      const raw = dataEl.getAttribute("data-rating") || dataEl.getAttribute("data-score") || dataEl.getAttribute("data-average") || "";
      const v2 = parseFloat(raw);
      if (!isNaN(v2) && v2 > 0) return v2;
    }
    return null;
  }
  function passesRating(itemEl, ratingMin) {
    if (ratingMin === null) return true;
    const r = extractRating(itemEl);
    if (r === null) return true;
    return r >= ratingMin;
  }
  async function parseRatingMin() {
    const raw = new URLSearchParams(location.search).get("rating_min");
    if (raw !== null) {
      const v = parseFloat(raw);
      if (!isNaN(v)) {
        await saveSetting(STORAGE_KEY_RATING, v);
        return v;
      }
    }
    const stored = await loadSetting(STORAGE_KEY_RATING, null);
    if (stored !== null) {
      const v2 = parseFloat(stored);
      if (!isNaN(v2)) return v2;
    }
    return null;
  }
  let _statusBar = null;
  function createStatusBar() {
    const host = document.createElement("div");
    host.style.cssText = [
      "position:fixed;bottom:0;right:0;z-index:2147483646;",
      "background:#12121f;color:#e8e4f0;",
      "font:11px/1.5 system-ui,sans-serif;",
      "padding:8px 14px;min-width:180px;max-width:320px;",
      "border-radius:8px 0 0 0;border-left:3px solid #f472b6;",
      "box-shadow:-2px 0 16px rgba(244,114,182,0.12);",
      "user-select:none;"
    ].join("");
    const textEl = document.createElement("div");
    textEl.style.cssText = [
      "margin-bottom:5px;white-space:pre;overflow:hidden;",
      "text-overflow:ellipsis;letter-spacing:0.15px;"
    ].join("");
    const fillEl = document.createElement("div");
    fillEl.style.cssText = [
      "height:100%;width:0%;",
      "background:linear-gradient(90deg,#f472b6,#fb923c);",
      "transition:width 0.3s ease;border-radius:1px;"
    ].join("");
    const barEl = document.createElement("div");
    barEl.style.cssText = [
      "height:2px;background:rgba(255,255,255,0.06);",
      "border-radius:1px;overflow:hidden;"
    ].join("");
    barEl.appendChild(fillEl);
    host.appendChild(textEl);
    host.appendChild(barEl);
    document.body.appendChild(host);
    return {
      setText(msg) {
        textEl.textContent = msg;
      },
      setProgress(pct) {
        fillEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      },
      remove() {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    };
  }
  function ensureBar() {
    if (!_statusBar) {
      _statusBar = createStatusBar();
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
  const LOADER_ID = "as-es-loader";
  function ensureLoader(container) {
    if (document.getElementById(LOADER_ID)) return;
    const loader = document.createElement("div");
    loader.id = LOADER_ID;
    loader.style.textAlign = "center";
    loader.style.padding = "20px";
    loader.style.gridColumn = "1 / -1";
    const spinner = document.createElement("div");
    spinner.style.cssText = [
      "width:18px;height:18px;margin:0 auto 8px;",
      "border:2px solid rgba(244,114,182,0.15);",
      "border-top-color:#f472b6;border-radius:50%;",
      "animation:as-ring 0.7s linear infinite;"
    ].join("");
    const label = document.createElement("div");
    label.style.cssText = [
      "color:#f472b6;font:11px/1.4 system-ui,sans-serif;",
      "letter-spacing:0.3px;opacity:0.7;"
    ].join("");
    label.textContent = "Loading more entries…";
    loader.appendChild(spinner);
    loader.appendChild(label);
    if (container.tagName === "TBODY") {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 99;
      td.appendChild(loader);
      tr.id = `${LOADER_ID}-row`;
      tr.appendChild(td);
      container.appendChild(tr);
    } else {
      container.appendChild(loader);
    }
  }
  function removeLoader() {
    for (const id of [LOADER_ID, `${LOADER_ID}-row`]) {
      const el = document.getElementById(id);
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
  const PREMIUM_TEXTS = new Set([
    "premium only",
    "premium-only",
    "nur fur premium",
    "nur premium",
    "upgrade to premium"
  ]);
  function hideElements(selectors) {
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.display = "none";
      });
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
  let _limitObserver = null;
  function unlockUI() {
    const limitInput = document.querySelector("#limit");
    if (limitInput) {
      limitInput.removeAttribute("disabled");
      limitInput.removeAttribute("readonly");
      limitInput.style.opacity = "1";
      limitInput.style.cursor = "text";
      if (_limitObserver) _limitObserver.disconnect();
      _limitObserver = new MutationObserver(() => {
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
    const groups = document.querySelectorAll(".form-group, .filter-group, label, .input-group");
    for (const group of groups) {
      const allEls = group.querySelectorAll("*");
      const hasPremiumText = Array.from(allEls).some(
        (el) => el.children.length === 0 && PREMIUM_TEXTS.has(el.textContent.trim().toLowerCase())
      );
      if (hasPremiumText) {
        group.style.display = "none";
      }
    }
  }
  const log$1 = createLogger("AniSearch Endless Scroll");
  const FETCH_DELAY_MS = 800;
  const MAX_PAGES = 200;
  const REQUEST_TIMEOUT_MS = 2e4;
  const MAX_RETRIES = 3;
  const CONTAINER_SELECTORS = [
    "ul.gallery",
    "ul.covers",
    "ul.list",
    "table.table tbody"
  ];
  const ITEM_SELECTOR_MAP = {
    "ul.gallery": "li",
    "ul.covers": "li",
    "ul.list": "li",
    "table.table tbody": "tr"
  };
  let _currentRunId = 0;
  function newRun() {
    return ++_currentRunId;
  }
  function isCurrentRun(runId) {
    return runId === _currentRunId;
  }
  function findContainer(doc = document) {
    for (const sel of CONTAINER_SELECTORS) {
      const el = doc.querySelector(sel);
      if (el) return { container: el, selector: sel };
    }
    return null;
  }
  function getItemSel(containerSelector) {
    return ITEM_SELECTOR_MAP[containerSelector] || "li";
  }
  function findNextUrl(doc = document) {
    const candidates = [
      ".pagenav a.pagenav-next",
      "a.pagenav-next",
      'nav.pagination a[rel="next"]',
      '.pagination a[rel="next"]',
      'a[rel="next"]'
    ];
    for (const sel of candidates) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      const raw = (el.getAttribute("href") || "").trim();
      if (!raw || raw === "#") continue;
      try {
        if (/^https?:\/\//i.test(raw)) {
          const u = new URL(raw);
          if (u.href !== window.location.href) return u.href;
          continue;
        }
        if (raw.startsWith("/")) {
          return new URL(raw, window.location.origin).href;
        }
        return new URL(`/${raw}`, window.location.origin).href;
      } catch {
      }
    }
    return null;
  }
  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function appendItem(container, itemEl) {
    requestAnimationFrame(() => {
      container.appendChild(document.importNode(itemEl, true));
    });
  }
  async function runEndlessLoop(ratingMin, found, runId) {
    const container = found.container;
    const selector = found.selector;
    const itemSel = getItemSel(selector);
    const existingItems = Array.from(container.querySelectorAll(itemSel));
    let filteredCount = 0;
    for (const item of existingItems) {
      if (!passesRating(item, ratingMin)) {
        item.style.display = "none";
        item.setAttribute("data-as-hidden", "rating");
        filteredCount++;
      }
    }
    const visibleOnPage1 = existingItems.length - filteredCount;
    hidePagination();
    let nextUrl = findNextUrl(document);
    if (!nextUrl) {
      setStatus(
        `✔ All entries loaded
  ${visibleOnPage1} items` + (ratingMin !== null ? `
  Rating ≥ ${ratingMin}` : "")
      );
      return;
    }
    setStatus(
      `⟳ Page 1 — ${visibleOnPage1} items
  Loading page 2…`
    );
    showLoader(true, container);
    let currentPage = 2;
    let totalVisible = visibleOnPage1;
    let totalHidden = filteredCount;
    const visitedUrls = new Set([window.location.href]);
    while (nextUrl && currentPage <= MAX_PAGES) {
      if (visitedUrls.has(nextUrl)) {
        log$1.warn("Loop detected, stopping:", nextUrl);
        break;
      }
      visitedUrls.add(nextUrl);
      log$1.log("Fetching page", currentPage, "→", nextUrl);
      let fetchedDoc;
      try {
        fetchedDoc = await fetchPage(nextUrl, {
          retries: MAX_RETRIES - 1,
          timeout: REQUEST_TIMEOUT_MS
        });
      } catch (err) {
        let reason;
        if (err instanceof NetworkError) reason = "Network error";
        else if (err instanceof TimeoutError) reason = "Timeout";
        else if (err instanceof HttpStatusError) reason = `HTTP ${err.status}`;
        else reason = err.message || "Unknown error";
        log$1.warn(`Page ${currentPage} failed after ${MAX_RETRIES} attempts:`, reason);
        setStatus(`⚠ Page ${currentPage} failed
  ${reason}`);
        showLoader(false);
        break;
      }
      if (!isCurrentRun(runId)) {
        showLoader(false);
        removeStatus();
        return;
      }
      const fetchedFound = findContainer(fetchedDoc);
      if (!fetchedFound) {
        log$1.warn(`Container on page ${currentPage} not found.`);
        break;
      }
      const newItems = Array.from(
        fetchedFound.container.querySelectorAll(getItemSel(fetchedFound.selector))
      );
      if (newItems.length === 0) {
        break;
      }
      showLoader(false);
      for (const item of newItems) {
        if (passesRating(item, ratingMin)) {
          appendItem(container, item);
          totalVisible++;
        } else {
          totalHidden++;
        }
      }
      nextUrl = findNextUrl(fetchedDoc);
      setStatus(
        `⟳ Page ${currentPage} loaded
  Shown: ${totalVisible}  (${totalHidden} filtered)
` + (nextUrl ? `  Loading page ${currentPage + 1}…` : "  Last page reached")
      );
      if (nextUrl) {
        showLoader(true, container);
        await delay(FETCH_DELAY_MS + Math.random() * 400);
        if (!isCurrentRun(runId)) {
          showLoader(false);
          removeStatus();
          return;
        }
      }
      currentPage++;
    }
    showLoader(false);
    const cappedByLimit = currentPage > MAX_PAGES;
    setStatus(
      `${cappedByLimit ? "⚠" : "✔"} Done!
  ${totalVisible} entries visible` + (totalHidden > 0 ? `
  ${totalHidden} hidden by rating filter` : "") + (ratingMin !== null ? `
  Rating ≥ ${ratingMin}` : "") + `
  ${currentPage - 1} pages scanned` + (cappedByLimit ? "\n  ⚠ Page limit reached!" : "")
    );
  }
  let _active = false;
  let _navTimer = null;
  let _origPush = null;
  let _origReplace = null;
  function patchHistory(onNavigate) {
    if (_active) {
      if (_navTimer) clearTimeout(_navTimer);
      history.pushState = _origPush;
      history.replaceState = _origReplace;
    }
    _origPush = history.pushState.bind(history);
    _origReplace = history.replaceState.bind(history);
    function scheduleNavigate() {
      if (_navTimer) clearTimeout(_navTimer);
      _navTimer = setTimeout(onNavigate, 600);
    }
    history.pushState = function(...args) {
      _origPush.apply(history, args);
      scheduleNavigate();
    };
    history.replaceState = function(...args) {
      const before = location.href;
      _origReplace.apply(history, args);
      if (location.href !== before) scheduleNavigate();
    };
    window.addEventListener("popstate", scheduleNavigate);
    _active = true;
  }
  const log = createLogger("AniSearch Endless Scroll");
  async function main() {
    const runId = newRun();
    setStatus("⟳ Scanning AniSearch…");
    unlockUI();
    setTimeout(unlockUI, 1500);
    const ratingMin = await parseRatingMin();
    log.log("Rating min:", ratingMin || "no filter");
    if (!findContainer(document)) {
      setStatus("✔ Ready. (No listing detected)");
      setTimeout(() => {
        removeStatus();
      }, 4e3);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
    if (!isCurrentRun(runId)) {
      removeStatus();
      return;
    }
    const found = findContainer(document);
    if (!found) {
      setStatus("✔ Ready. (No listing detected)");
      setTimeout(() => {
        removeStatus();
      }, 4e3);
      return;
    }
    await runEndlessLoop(ratingMin, found, runId);
    setTimeout(() => {
      removeStatus();
    }, 8e3);
  }
  function boot() {
    const style = document.createElement("style");
    style.textContent = "@keyframes as-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes as-ring{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", main);
    } else {
      main();
    }
  }
  function registerBoot() {
    GM_registerMenuCommand("Load All Pages", () => {
      patchHistory(main);
      boot();
    });
  }
  
  registerBoot();

})();
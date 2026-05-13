// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.5.0
// @author       marmoris-x
// @description  Downloads manga/manhwa panels as ZIP — pipeline download, retry, abort, fast scrolling
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js
// @match        *://*/*
// @require      https://raw.githubusercontent.com/Tampermonkey/utils/refs/heads/main/requires/gh_2215_make_GM_xhr_more_parallel_again.js
// @sandbox      raw
// @connect      *
// @grant        GM.registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        GM_addElement
// @grant        GM_xmlhttpRequest
// @grant        window.onurlchange
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const MIN_IMG_PX = 400;
  function extractLazySrc(el) {
    return el.dataset.src || el.dataset.lazySrc || el.dataset.original || el.dataset.url || el.dataset.imgSrc || el.dataset.lazyload || el.getAttribute("data-cfsrc") || el.getAttribute("data-echo") || null;
  }
  function getSrc(el) {
    const raw = el.src || el.currentSrc || extractLazySrc(el) || (el.getAttribute("data-srcset") || "").split(/[\s,]+/)[0] || (el.getAttribute("srcset") || "").split(/[\s,]+/)[0] || "";
    if (!raw || raw.startsWith("data:") || raw.startsWith("http")) return raw;
    try {
      return new URL(raw, location.href).href;
    } catch (e) {
      return raw;
    }
  }
  function allSrcsOf(el) {
    const srcs = new Set();
    function add(v) {
      if (!v || typeof v !== "string" || v.length < 5) return;
      srcs.add(v);
    }
    if (!el) return srcs;
    add(el.src);
    add(el.currentSrc);
    add(extractLazySrc(el));
    add((el.getAttribute && el.getAttribute("data-srcset") || "").split(/[\s,]+/)[0]);
    add((el.getAttribute && el.getAttribute("srcset") || "").split(/[\s,]+/)[0]);
    const arr = [];
    srcs.forEach(function(s) {
      arr.push(s);
    });
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      if (s && !s.startsWith("data:") && !s.startsWith("http")) {
        try {
          add(new URL(s, location.href).href);
        } catch (e) {
        }
      }
    }
    return srcs;
  }
  function findImages(container) {
    const seen = new Set();
    const results = [];
    function tryAdd(el, src) {
      if (!src || el && el.dataset && el.dataset.mpdProcessed) return;
      if (seen.has(src)) return;
      if (/\.(svg|gif)(\?|#|$)/i.test(src)) return;
      if (src.startsWith("data:image/svg") || src.startsWith("data:image/gif")) return;
      const parentTag = el.parentElement && el.parentElement.tagName ? el.parentElement.tagName.toLowerCase() : "";
      if (parentTag === "nav" || parentTag === "header" || parentTag === "footer") return;
      if (el.nodeType === Node.ELEMENT_NODE) {
        const cs = window.getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        if (el.tagName === "IMG" && el.offsetWidth === 0 && el.offsetHeight === 0) return;
      }
      const nw = el.naturalWidth || parseInt(el.getAttribute && el.getAttribute("width")) || el.offsetWidth || 0;
      const nh = el.naturalHeight || parseInt(el.getAttribute && el.getAttribute("height")) || el.offsetHeight || 0;
      if (nw > 0 && nw < 100 && nh > 0 && nh < 100) return;
      seen.add(src);
      results.push({ el, src });
    }
    const imgs = container.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i++) {
      tryAdd(imgs[i], getSrc(imgs[i]));
    }
    const sources = container.querySelectorAll("picture source");
    for (let j = 0; j < sources.length; j++) {
      const s = sources[j];
      const url = (s.srcset || "").split(/[\s,]+/)[0];
      if (url) {
        const picture = s.closest("picture");
        tryAdd(picture ? picture.querySelector("img") : s, url);
      }
    }
    const bgEls = container.querySelectorAll('[style*="background"]');
    for (let k = 0; k < bgEls.length; k++) {
      const bgEl = bgEls[k];
      const match = bgEl.style.backgroundImage ? bgEl.style.backgroundImage.match(/url\(['"]?([^'")\s]+)['"]?\)/) : null;
      if (match && bgEl.offsetWidth >= MIN_IMG_PX && bgEl.offsetHeight >= MIN_IMG_PX) {
        tryAdd(bgEl, match[1]);
      }
    }
    const canvases = container.querySelectorAll("canvas");
    for (let l = 0; l < canvases.length; l++) {
      const c = canvases[l];
      if (c.width < MIN_IMG_PX || c.height < MIN_IMG_PX) continue;
      try {
        const d = c.toDataURL("image/jpeg", 0.92);
        if (d && d.length > 1e3) tryAdd(c, d);
      } catch (e) {
      }
    }
    return results;
  }
  function triggerLazy(container) {
    const imgs = container.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      const lazy = extractLazySrc(img);
      if (lazy && !img.src.startsWith("http") && !img.src.startsWith("data:")) {
        img.src = lazy;
      }
    }
  }
  function _fetchBlob(url, signal, headerOverrides) {
    const headers = {};
    if (!headerOverrides || headerOverrides.Referer !== null) {
      headers.Referer = location.href;
    }
    if (!headerOverrides || headerOverrides.Origin !== null) {
      headers.Origin = location.origin;
    }
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const gm = GM.xmlHttpRequest({
        method: "GET",
        url,
        responseType: "blob",
        anonymous: true,
        redirect: "manual",
        headers,
        onload: (r) => {
          if (r.status === 200 && r.response && r.response.size > 100) {
            resolve(r.response);
          } else {
            reject(new Error("HTTP " + r.status + " (" + url.slice(0, 80) + ")"));
          }
        },
        onerror: () => reject(new Error("Network error")),
        ontimeout: () => reject(new Error("Timeout")),
        timeout: 2e4
      });
      if (signal) {
        signal.addEventListener("abort", () => {
          gm.abort();
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }
    });
  }
  async function _fetchWithFallbacks(src, el, signal) {
    if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (src && src.startsWith("data:")) {
      const resp = await fetch(src);
      return resp.blob();
    }
    const errs = [];
    try {
      return await _fetchBlob(src, signal);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      errs.push(e.message);
    }
    if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await _fetchBlob(src, signal, { Origin: null });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      errs.push(e.message);
    }
    if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await _fetchBlob(src, signal, { Referer: null, Origin: null });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      errs.push(e.message);
    }
    if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const r = await fetch(src, { credentials: "include" });
      if (r.ok) return r.blob();
      throw new Error("HTTP " + r.status);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      errs.push(e.message);
    }
    if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      if (el && el.tagName === "IMG" && el.complete && el.naturalWidth > 0) {
        const c = document.createElement("canvas");
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        c.getContext("2d").drawImage(el, 0, 0);
        return await new Promise((r) => {
          c.toBlob(r, "image/jpeg", 0.92);
        });
      }
      throw new Error("Not a loaded img");
    } catch (e) {
      if (e.name === "AbortError") throw e;
      errs.push(e.message);
    }
    throw new Error("All fetch strategies failed: " + errs.join(" | "));
  }
  async function downloadImage(url, signal, options = {}) {
    const maxRetries = options.retries !== void 0 ? options.retries : 2;
    const el = options.el || null;
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal && signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        return await _fetchWithFallbacks(url, el, signal);
      } catch (e) {
        if (e.name === "AbortError") throw e;
        lastErr = e;
        if (attempt < maxRetries) {
          const delay = 600 * (attempt + 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr || new Error("Download failed");
  }
  const MAX_SEG_H = 3500;
  const MIN_SEG_H = 600;
  function findSplitPoints(h) {
    if (h <= MAX_SEG_H) return [0, h];
    const pts = [0];
    for (let y = MAX_SEG_H; y < h; y += MAX_SEG_H) pts.push(y);
    pts.push(h);
    if (pts.length > 2 && pts[pts.length - 1] - pts[pts.length - 2] < MIN_SEG_H) {
      pts.splice(pts.length - 2, 1);
    }
    return pts;
  }
  async function processImage(url, pageNum, srcEl, signal) {
    const blob = await downloadImage(url, signal, { el: srcEl });
    const ew = srcEl ? srcEl.naturalWidth : 0;
    const eh = srcEl ? srcEl.naturalHeight : 0;
    if (ew > 0 && eh > 0 && eh <= MAX_SEG_H && blob.type !== "image/webp") {
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const pad = ("000" + pageNum).slice(-3);
      return [{
        filename: "page_" + pad + "." + ext,
        blob,
        previewUrl: URL.createObjectURL(blob),
        w: ew,
        h: eh
      }];
    }
    const objUrl = URL.createObjectURL(blob);
    let img;
    try {
      img = await new Promise((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = () => rej(new Error("Decode failed"));
        el.src = objUrl;
      });
    } finally {
      URL.revokeObjectURL(objUrl);
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const pts = findSplitPoints(h);
    const srcExt = pts.length === 2 && blob.type === "image/png" ? "png" : "jpg";
    const pad2 = ("000" + pageNum).slice(-3);
    const results = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const y0 = pts[i];
      const segH = pts[i + 1] - y0;
      const suffix = pts.length === 2 ? "" : "_part" + (i + 1);
      const filename = "page_" + pad2 + suffix + "." + srcExt;
      if (pts.length === 2 && blob.type !== "image/webp") {
        results.push({
          filename,
          blob,
          previewUrl: URL.createObjectURL(blob),
          w,
          h: segH
        });
      } else {
        const segBlob = await new Promise((r) => {
          const cv = document.createElement("canvas");
          cv.width = w;
          cv.height = segH;
          cv.getContext("2d").drawImage(img, 0, y0, w, segH, 0, 0, w, segH);
          cv.toBlob(r, "image/jpeg", 0.92);
        });
        results.push({
          filename,
          blob: segBlob,
          previewUrl: URL.createObjectURL(segBlob),
          w,
          h: segH
        });
      }
    }
    return results;
  }
  const SCROLL_TIMEOUT_MS = 3e3;
  function sleep$1(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function getUnloaded() {
    const result = [];
    const imgs = document.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if ((!img.complete || !img.naturalWidth) && (img.src && (img.src.startsWith("http") || extractLazySrc(img)))) {
        result.push(img);
      }
    }
    return result;
  }
  function countLoadedImages() {
    const imgs = document.querySelectorAll("img");
    let count = 0;
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].complete && imgs[i].naturalWidth > 0) count++;
    }
    return count;
  }
  async function* scrollLoad(isAborted) {
    triggerLazy(document);
    await sleep$1(150);
    yield { type: "pass", passNumber: 1, imagesFound: countLoadedImages() };
    if (isAborted && isAborted()) return;
    const unloaded = getUnloaded();
    for (let u = 0; u < unloaded.length; u++) {
      if (isAborted && isAborted()) return;
      unloaded[u].scrollIntoView({ block: "center", behavior: "instant" });
      triggerLazy(document);
      await sleep$1(60);
    }
    yield { type: "pass", passNumber: 2, imagesFound: countLoadedImages() };
    if (isAborted && isAborted()) return;
    const pageH = document.documentElement.scrollHeight;
    for (let y = 0; y <= pageH; y += window.innerHeight) {
      if (isAborted && isAborted()) return;
      window.scrollTo(0, y);
      triggerLazy(document);
      await sleep$1(40);
    }
    yield { type: "pass", passNumber: 3, imagesFound: countLoadedImages() };
    if (isAborted && isAborted()) return;
    const deadline = Date.now() + SCROLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (isAborted && isAborted()) return;
      triggerLazy(document);
      if (getUnloaded().length === 0) break;
      await sleep$1(150);
    }
    window.scrollTo(0, 0);
    const totalLoaded = countLoadedImages();
    yield { type: "complete", totalLoaded };
  }
  function guessNextUrl(url) {
    try {
      const u = new URL(url);
      if (u.searchParams.has("page")) {
        const n = parseInt(u.searchParams.get("page"), 10);
        if (!isNaN(n)) {
          const next = new URL(url);
          next.searchParams.set("page", n + 1);
          return next.href;
        }
      }
      const m = u.pathname.match(/^(.*\/)(\d+)(\/?)$/);
      if (m) {
        const pn = parseInt(m[2], 10);
        if (!isNaN(pn) && pn > 0 && pn < 1e4) {
          return u.origin + m[1] + (pn + 1) + m[3] + u.search;
        }
      }
    } catch (_) {
    }
    return null;
  }
  function clickNextPage() {
    const selectors = [
      'a[rel="next"]',
      '[class*="next"]:not([disabled])',
      '[aria-label*="next" i]',
      '[title*="next" i]',
      '[aria-label*="weiter" i]',
      '[title*="weiter" i]'
    ];
    for (let i = 0; i < selectors.length; i++) {
      const el = document.querySelector(selectors[i]);
      if (el) {
        el.click();
        return true;
      }
    }
    const links = document.querySelectorAll("a, button");
    for (let j = 0; j < links.length; j++) {
      const t = (links[j].textContent || "").trim().toLowerCase();
      if (t === "next" || t === "weiter" || t === ">" || t === "›" || t === "→") {
        links[j].click();
        return true;
      }
    }
    return false;
  }
  function navigateNext() {
    if (clickNextPage()) return;
    const nextUrl = guessNextUrl(location.href);
    if (nextUrl) location.href = nextUrl;
  }
  function waitForUrlChange(prevUrl, timeout = 5e3) {
    return new Promise((resolve) => {
      if (window.onurlchange === null) {
        const handler = (info) => {
          if (info.url !== prevUrl) {
            window.removeEventListener("urlchange", handler);
            resolve(true);
          }
        };
        window.addEventListener("urlchange", handler);
        setTimeout(() => {
          window.removeEventListener("urlchange", handler);
          resolve(false);
        }, timeout);
      } else {
        const id = setInterval(() => {
          if (location.href !== prevUrl) {
            clearInterval(id);
            resolve(true);
          }
        }, 80);
        setTimeout(() => {
          clearInterval(id);
          resolve(false);
        }, timeout);
      }
    });
  }
  const MAX_PAGES = 200;
  const NAV_CLICK_WAIT_MS = 50;
  const NAV_LOAD_WAIT_MS = 150;
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  async function* harvestPages({ getPageImages, maxPages = MAX_PAGES, externalAbort }) {
    let page = 1;
    let currentUrl = location.href;
    while (page <= maxPages) {
      if (externalAbort && externalAbort()) return;
      const images = await getPageImages();
      if (externalAbort && externalAbort()) return;
      if (!images || images.length === 0) {
        yield { page, images: [], status: "no-images", stop: true };
        return;
      }
      yield { page, images };
      navigateNext();
      await sleep(NAV_CLICK_WAIT_MS);
      const changed = await waitForUrlChange(currentUrl);
      if (!changed) {
        yield { page, status: "nav-timeout", stop: true };
        return;
      }
      await sleep(NAV_LOAD_WAIT_MS);
      currentUrl = location.href;
      page++;
    }
  }
  const SIDEBAR_WIDTH = 320;
  const CONTENT_CSS = [
    "#mpd-controls { padding:12px 0; border-bottom:1px solid rgba(99,102,241,0.15); display:flex; flex-direction:column; gap:9px; }",
    ".mpd-btn-row { display:flex; gap:8px; }",
    ".mpd-btn-row button { flex:1; }",
    ".mpd-btn { padding:7px 12px; border:none; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s ease; }",
    ".mpd-btn:active { transform:scale(0.96); }",
    ".mpd-primary { background:#2f9e44; color:#fff; box-shadow:0 1px 4px rgba(47,158,68,0.25); }",
    ".mpd-primary:hover:not(:disabled) { background:#237032; box-shadow:0 2px 8px rgba(47,158,68,0.35); }",
    ".mpd-danger { background:#c92a2a; color:#fff; box-shadow:0 1px 4px rgba(201,42,42,0.25); }",
    ".mpd-danger:hover:not(:disabled) { background:#a61e1e; }",
    ".mpd-secondary { background:rgba(255,255,255,0.08); color:#c1c2c5; }",
    ".mpd-secondary:hover:not(:disabled) { background:rgba(255,255,255,0.14); }",
    ".mpd-btn:disabled { background:#333; color:#555; cursor:not-allowed; box-shadow:none; }",
    "#mpd-progress { height:3px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; display:none; }",
    "#mpd-progress-bar { height:100%; background:#2f9e44; width:0%; transition:width 0.25s cubic-bezier(0.4,0,0.2,1); }",
    "#mpd-status { font-size:12px; color:rgba(255,255,255,0.45); min-height:16px; }",
    ".mpd-thumb { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04); }",
    ".mpd-thumb img { width:48px; height:48px; object-fit:cover; border-radius:4px; flex-shrink:0; background:rgba(255,255,255,0.04); }",
    ".mpd-thumb-info { flex:1; min-width:0; }",
    ".mpd-thumb-name { font-size:11px; color:rgba(255,255,255,0.45); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
    ".mpd-thumb-size { font-size:11px; color:rgba(255,255,255,0.2); }",
    ".mpd-thumb input[type=checkbox] { flex-shrink:0; width:15px; height:15px; cursor:pointer; accent-color:#2f9e44; }",
    "#mpd-footer { padding:8px 0; border-top:1px solid rgba(255,255,255,0.04); font-size:11px; color:rgba(255,255,255,0.2); }",
    ".mpd-toggle-row { display:flex; align-items:center; gap:8px; font-size:12px; color:rgba(255,255,255,0.45); cursor:pointer; user-select:none; }",
    ".mpd-toggle-row input { cursor:pointer; accent-color:#2f9e44; }"
  ].join("");
  function applyStyles(root, cssText) {
    if (typeof GM_addElement !== "undefined") {
      try {
        GM_addElement(root, "style", { textContent: cssText });
        return;
      } catch (_) {
      }
    }
    if (root.adoptedStyleSheets !== void 0) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        root.adoptedStyleSheets = [sheet];
        return;
      } catch (_) {
      }
    }
    try {
      const style = document.createElement("style");
      style.textContent = cssText;
      root.appendChild(style);
    } catch (_) {
    }
  }
  function createShadowContainer(opts = {}) {
    const host = document.createElement(opts.tag || "div");
    if (opts.id) host.id = opts.id;
    if (opts.className) host.className = opts.className;
    const root = host.attachShadow({ mode: "closed" });
    if (opts.styles) {
      applyStyles(root, opts.styles);
    }
    try {
      document.body.appendChild(host);
    } catch (_) {
      document.documentElement.appendChild(host);
    }
    return { host, root };
  }
  function createSidebar(opts = {}) {
    const width = opts.width || 340;
    const accent = opts.accentColor || "#2196F3";
    const title = opts.title || "";
    let isOpen = false;
    const sidebarCSS = [
      ":host { position:fixed; top:0; right:0; width:" + width + "px; height:100vh; z-index:2147483645;",
      "background:linear-gradient(180deg,#0d0d1a 0%,#111827 55%,#0a1628 100%);",
      "color:#e2e8f0; font:13px/1.5 system-ui,sans-serif;",
      "transform:translateX(" + width + "px); transition:transform 0.35s cubic-bezier(0.4,0,0.2,1);",
      "display:flex; flex-direction:column; border-left:1px solid rgba(99,102,241,0.2); }",
      ":host(.open) { transform:translateX(0); }",
      ".header { display:flex; align-items:center; padding:11px 14px;",
      "background:linear-gradient(90deg,rgba(99,102,241,0.08) 0%,transparent 100%);",
      "border-bottom:1px solid rgba(99,102,241,0.15); cursor:move; user-select:none; flex-shrink:0; }",
      ".header h2 { margin:0; font-size:14px; font-weight:600; color:" + accent + "; flex:1;",
      "letter-spacing:0.02em; }",
      ".header button { background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer;",
      "font-size:18px; padding:0 4px; line-height:1; transition:transform 0.2s ease,color 0.2s ease; }",
      ".header button:hover { color:" + accent + "; transform:rotate(90deg); }",
      ".body { flex:1; overflow-y:auto; padding:12px 14px; }",
      ".body::-webkit-scrollbar { width:5px; }",
      ".body::-webkit-scrollbar-track { background:transparent; }",
      ".body::-webkit-scrollbar-thumb { background:rgba(99,102,241,0.3); border-radius:3px; }",
      opts.cssOverrides || ""
    ].join("");
    const allCSS = sidebarCSS + "\n" + CONTENT_CSS;
    const container = createShadowContainer({ styles: allCSS });
    const root = container.root;
    const header = document.createElement("div");
    header.className = "header";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Sidebar schließen");
    header.appendChild(h2);
    header.appendChild(closeBtn);
    root.appendChild(header);
    const body = document.createElement("div");
    body.className = "body";
    root.appendChild(body);
    const tab = document.createElement("div");
    const tabRoot = tab.attachShadow({ mode: "closed" });
    const tabCSS = [
      ":host { position:fixed; top:50%; z-index:2147483644; background:" + accent + "; color:#fff;",
      "padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;",
      "writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);",
      "right:0; transform:translateY(-50%) translateX(calc(100% - 10px));",
      "transition:right 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1); }",
      ":host(:hover) { filter:brightness(1.15); }",
      ":host(.open) { right:" + (width + 8) + "px; transform:translateY(-50%) translateX(0); }"
    ].join("");
    applyStyles(tabRoot, tabCSS);
    const tabSpan = document.createElement("span");
    tabSpan.textContent = title;
    tabRoot.appendChild(tabSpan);
    try {
      document.body.appendChild(tab);
    } catch (_) {
      document.documentElement.appendChild(tab);
    }
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
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startTop = 0;
    header.addEventListener("mousedown", (e) => {
      if (e.target === closeBtn) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(container.host.style.right || "0", 10);
      startTop = parseInt(container.host.style.top || "0", 10);
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      container.host.style.right = startRight - (e.clientX - startX) + "px";
      container.host.style.top = startTop + (e.clientY - startY) + "px";
    });
    document.addEventListener("mouseup", () => {
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
      isOpen: () => isOpen,
      setTitle: (t) => {
        h2.textContent = t;
        tabSpan.textContent = t;
      }
    };
  }
  function buildUI(mangaMode) {
    const sidebar = createSidebar({
      width: SIDEBAR_WIDTH,
      title: "Manga Downloader",
      accentColor: "#2f9e44"
    });
    const root = sidebar.root;
    const body = sidebar.bodyEl;
    const controls = document.createElement("div");
    controls.id = "mpd-controls";
    const btnRow = document.createElement("div");
    btnRow.className = "mpd-btn-row";
    const scanBtn = document.createElement("button");
    scanBtn.id = "mpd-scan";
    scanBtn.className = "mpd-btn mpd-primary";
    scanBtn.textContent = "Scan";
    scanBtn.setAttribute("role", "button");
    scanBtn.setAttribute("aria-label", "Bilder auf der aktuellen Seite scannen");
    scanBtn.tabIndex = 0;
    const dlBtn = document.createElement("button");
    dlBtn.id = "mpd-dl";
    dlBtn.className = "mpd-btn mpd-secondary";
    dlBtn.textContent = "ZIP";
    dlBtn.disabled = true;
    dlBtn.setAttribute("role", "button");
    dlBtn.setAttribute("aria-label", "Ausgewählte Bilder als ZIP herunterladen");
    dlBtn.tabIndex = 0;
    btnRow.appendChild(scanBtn);
    btnRow.appendChild(dlBtn);
    controls.appendChild(btnRow);
    const mangaLabel = document.createElement("label");
    mangaLabel.className = "mpd-toggle-row";
    const mangaCheck = document.createElement("input");
    mangaCheck.type = "checkbox";
    mangaCheck.id = "mpd-manga-mode";
    mangaCheck.checked = !!mangaMode;
    mangaCheck.setAttribute("aria-checked", mangaMode ? "true" : "false");
    const mangaLabelSpan = document.createElement("span");
    mangaLabelSpan.textContent = "Manga-Modus (auto weiterklicken)";
    mangaLabel.appendChild(mangaCheck);
    mangaLabel.appendChild(mangaLabelSpan);
    controls.appendChild(mangaLabel);
    const progressEl = document.createElement("div");
    progressEl.id = "mpd-progress";
    const progressBar = document.createElement("div");
    progressBar.id = "mpd-progress-bar";
    progressEl.appendChild(progressBar);
    controls.appendChild(progressEl);
    const statusEl = document.createElement("div");
    statusEl.id = "mpd-status";
    statusEl.textContent = "Ready.";
    controls.appendChild(statusEl);
    body.appendChild(controls);
    const resultsEl = document.createElement("div");
    resultsEl.id = "mpd-results";
    body.appendChild(resultsEl);
    const footerEl = document.createElement("div");
    footerEl.id = "mpd-footer";
    body.appendChild(footerEl);
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") sidebar.close();
    });
    return {
      sidebar,
      root,
      scanBtn,
      dlBtn,
      mangaCheck,
      statusEl,
      progressEl,
      progressBar,
      resultsEl,
      footerEl
    };
  }
  function setScanBtn(scanBtn, scanning) {
    if (!scanBtn) return;
    scanBtn.textContent = scanning ? "Stop" : "Scan";
    scanBtn.className = scanning ? "mpd-btn mpd-danger" : "mpd-btn mpd-primary";
    scanBtn.setAttribute(
      "aria-label",
      scanning ? "Scanvorgang abbrechen" : "Bilder auf der aktuellen Seite scannen"
    );
  }
  function addSegmentsToUI(segments, resultsEl) {
    if (!resultsEl) return;
    while (resultsEl.firstChild) {
      resultsEl.removeChild(resultsEl.firstChild);
    }
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const div = document.createElement("div");
      div.className = "mpd-thumb";
      const img = document.createElement("img");
      img.src = seg.previewUrl || "";
      img.alt = seg.filename || "Segment Vorschau";
      img.loading = "lazy";
      const info = document.createElement("div");
      info.className = "mpd-thumb-info";
      const nameDiv = document.createElement("div");
      nameDiv.className = "mpd-thumb-name";
      nameDiv.textContent = seg.filename || "";
      const sizeDiv = document.createElement("div");
      sizeDiv.className = "mpd-thumb-size";
      sizeDiv.textContent = (seg.w || "?") + " × " + (seg.h || "?") + " px";
      info.appendChild(nameDiv);
      info.appendChild(sizeDiv);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.idx = String(i);
      cb.setAttribute("aria-label", seg.filename || "Segment " + (i + 1));
      div.appendChild(img);
      div.appendChild(info);
      div.appendChild(cb);
      resultsEl.appendChild(div);
    }
  }
  function triggerDownload(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.style.display = "none";
    a.setAttribute("aria-hidden", "true");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
    }, 1e4);
  }
  let crcTable = null;
  function buildCRCTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      crcTable[i] = c;
    }
    return crcTable;
  }
  function crc32(data) {
    const table = buildCRCTable();
    let crc = 4294967295;
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 255] ^ crc >>> 8;
    }
    return (crc ^ 4294967295) >>> 0;
  }
  const encoder = new TextEncoder();
  async function buildStoreZip(files) {
    const localHeaders = [];
    const centralEntries = [];
    const offsets = [];
    let offset = 0;
    for (let f = 0; f < files.length; f++) {
      const nameBytes = encoder.encode(files[f].name);
      const data = files[f].data;
      const crc = crc32(data);
      const nameLen = nameBytes.length;
      const dataLen = data.length;
      const lh = new ArrayBuffer(30 + nameLen);
      const lv = new DataView(lh);
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
      const lhBytes = new Uint8Array(lh);
      lhBytes.set(nameBytes, 30);
      localHeaders.push(lhBytes);
      offsets.push(offset);
      offset += lhBytes.length + dataLen;
    }
    let cdTotal = 0;
    const cdOffset = offset;
    for (let f = 0; f < files.length; f++) {
      const cdNameBytes = encoder.encode(files[f].name);
      const cdNameLen = cdNameBytes.length;
      const cd = new ArrayBuffer(46 + cdNameLen);
      const cv = new DataView(cd);
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
      const cdBytes = new Uint8Array(cd);
      cdBytes.set(cdNameBytes, 46);
      centralEntries.push(cdBytes);
      cdTotal += cdBytes.length;
    }
    const totalSize = offset + cdTotal + 22;
    const out = new Uint8Array(totalSize);
    let pos = 0;
    for (let f = 0; f < files.length; f++) {
      out.set(localHeaders[f], pos);
      pos += localHeaders[f].length;
      out.set(files[f].data, pos);
      pos += files[f].data.length;
    }
    for (let f = 0; f < centralEntries.length; f++) {
      out.set(centralEntries[f], pos);
      pos += centralEntries[f].length;
    }
    const eocd = new DataView(out.buffer, pos, 22);
    eocd.setUint32(0, 101010256, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, files.length, true);
    eocd.setUint16(10, files.length, true);
    eocd.setUint32(12, cdTotal, true);
    eocd.setUint32(16, cdOffset, true);
    eocd.setUint16(20, 0, true);
    return out;
  }
  async function buildZipBlob(files) {
    const converted = await Promise.all(files.map(async (file) => {
      const buf = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(new Uint8Array(fr.result));
        fr.onerror = () => reject(fr.error || new Error("FileReader error"));
        fr.readAsArrayBuffer(file.blob);
      });
      return { name: file.filename, data: buf };
    }));
    const zipBytes = await buildStoreZip(converted);
    return new Blob([zipBytes], { type: "application/zip" });
  }
  const CONCURRENT_DL = 6;
  const MANGA_POLL_MS = 50;
  const MANGA_MAX_WAIT_MS = 3e3;
  class MangaDownloader {
constructor(logger2) {
      this.log = logger2;
      this.segments = [];
      this.errors = [];
      this.scanning = false;
      this.mangaMode = false;
      this.scannedUrls = new Set();
      this.previewRevokeTimer = null;
      this.abortController = null;
      this._enabled = false;
      this._menuId = null;
      this.ui = null;
      this._registerMenuCommand();
    }

init() {
    }

_registerMenuCommand() {
      if (this._menuId !== null) ;
      const label = this._enabled ? "Manga Downloader deaktivieren" : "Manga Downloader aktivieren";
      this._menuId = GM.registerMenuCommand(label, () => this._toggle());
    }
_ensureUI() {
      if (this.ui) return;
      this.ui = buildUI(this.mangaMode);
      this._initUI();
      this._watchUrlChanges();
    }
_toggle() {
      this._enabled = !this._enabled;
      if (this._enabled) {
        this._ensureUI();
        this.ui.sidebar.open();
      } else if (this.ui) {
        this.ui.sidebar.close();
      }
    }

_initUI() {
      this.ui.scanBtn.addEventListener("click", () => {
        if (this.scanning) this._abort();
        else this._scan();
      });
      this.ui.dlBtn.addEventListener("click", () => this._download());
      this.ui.mangaCheck.addEventListener("change", (e) => {
        this.mangaMode = e.target.checked;
      });
    }

_watchUrlChanges() {
      const handler = () => {
        if (this.scanning) return;
        if (this.segments.length > 0) return;
        this._reset();
      };
      if (window.onurlchange === null) {
        window.addEventListener("urlchange", handler);
      } else {
        window.addEventListener("popstate", handler);
        window.addEventListener("hashchange", handler);
      }
    }

_reset() {
      if (this.scanning) return;
      clearTimeout(this.previewRevokeTimer);
      this.previewRevokeTimer = null;
      this._revokeAllPreviews();
      this.segments = [];
      this.errors = [];
      this._clearResults();
      this.ui.dlBtn.disabled = true;
      this._setStatus("Ready.");
      this._setProgress(0);
    }
_clearResults() {
      const el = this.ui.resultsEl;
      while (el.firstChild) el.removeChild(el.firstChild);
      this.ui.footerEl.textContent = "";
    }
_revokeAllPreviews() {
      for (let i = 0; i < this.segments.length; i++) {
        try {
          URL.revokeObjectURL(this.segments[i].previewUrl);
        } catch (_) {
        }
      }
    }

_setStatus(msg) {
      this.ui.statusEl.textContent = msg;
    }
_setProgress(pct) {
      this.ui.progressEl.style.display = pct > 0 && pct < 100 ? "block" : "none";
      this.ui.progressBar.style.width = pct + "%";
    }

_abort() {
      if (this.abortController) {
        this.abortController.abort();
      }
      this._setStatus("Aborting...");
    }

async _collectPageUrls() {
      if (this.mangaMode) {
        const deadline = Date.now() + MANGA_MAX_WAIT_MS;
        while (Date.now() < deadline) {
          const imgs = findImages(document);
          if (imgs.length > 0) break;
          await this._sleep(MANGA_POLL_MS);
        }
      }
      const candidates = findImages(document);
      const withY = candidates.map((c) => ({
        c,
        y: (c.el.getBoundingClientRect ? c.el.getBoundingClientRect().top : 0) + window.scrollY
      }));
      withY.sort((a, b) => a.y - b.y);
      const sorted = withY.map((w) => w.c);
      const fresh = [];
      for (let i = 0; i < sorted.length; i++) {
        const c = sorted[i];
        if (this.scannedUrls.has(c.src)) continue;
        const srcs = allSrcsOf(c.el);
        let seen = false;
        srcs.forEach((v) => {
          if (this.scannedUrls.has(v)) seen = true;
        });
        if (seen) continue;
        this.scannedUrls.add(c.src);
        srcs.forEach((v) => this.scannedUrls.add(v));
        fresh.push(c);
      }
      return fresh;
    }

async _scan() {
      if (this.scanning) return;
      this.scanning = true;
      this.abortController = new AbortController();
      const signal = this.abortController.signal;
      clearTimeout(this.previewRevokeTimer);
      this.previewRevokeTimer = null;
      this._revokeAllPreviews();
      this.segments = [];
      this.errors = [];
      this.scannedUrls.clear();
      this._clearResults();
      this.ui.dlBtn.disabled = true;
      setScanBtn(this.ui.scanBtn, true);
      this._setProgress(0);
      this._setStatus("Starting...");
      const processedEls = document.querySelectorAll("[data-mpd-processed]");
      for (let pe = 0; pe < processedEls.length; pe++) {
        processedEls[pe].removeAttribute("data-mpd-processed");
      }
      const queue = [];
      let producerDone = false;
      let totalExpected = 0;
      let dlDone = 0;
      const producer = async () => {
        let seqNum = 0;
        if (this.mangaMode) {
          const getPageImages = async () => this._collectPageUrls();
          const harvest = harvestPages({
            getPageImages,
            externalAbort: () => signal.aborted
          });
          for await (const pageResult of harvest) {
            if (signal.aborted) return;
            if (pageResult.images) {
              pageResult.images.forEach((c) => {
                c.num = ++seqNum;
              });
              queue.push(...pageResult.images);
              totalExpected += pageResult.images.length;
              this._setStatus(`Page ${pageResult.page} OK — ${totalExpected} panel(s) found`);
            }
            if (pageResult.stop) break;
          }
        } else {
          const scrollGen = scrollLoad(() => signal.aborted);
          for await (const scrollEvent of scrollGen) {
            if (signal.aborted) return;
          }
          const found = await this._collectPageUrls();
          found.forEach((c) => {
            c.num = ++seqNum;
          });
          queue.push(...found);
          totalExpected += found.length;
          this._setStatus(`Page OK — ${totalExpected} panel(s) found`);
        }
        producerDone = true;
      };
      const consumer = async () => {
        const running = new Set();
        const allTasks = [];
        const spawn = (candidate) => {
          const task = (async () => {
            try {
              if (signal.aborted) return;
              const segs = await processImage(
                candidate.src,
                candidate.num,
                candidate.el,
                signal
              );
              if (signal.aborted || !segs) return;
              segs.forEach((seg) => {
                this.segments.push(seg);
              });
              if (candidate.el) candidate.el.dataset.mpdProcessed = "true";
            } catch (e) {
              this.errors.push({ src: candidate.src, message: e.message });
              this.log.warn("Failed:", candidate.src ? candidate.src.slice(0, 80) : "", e.message);
            } finally {
              dlDone++;
              running.delete(task);
              const pct = totalExpected > 0 ? dlDone / totalExpected * 100 : 0;
              const errStr = this.errors.length ? ` (${this.errors.length} errors)` : "";
              this._setProgress(pct);
              this._setStatus(`Downloading: ${dlDone}/${totalExpected}${errStr}`);
            }
          })();
          running.add(task);
          allTasks.push(task);
        };
        const consumerLoop = async () => {
          while (!signal.aborted) {
            while (queue.length > 0 && running.size < CONCURRENT_DL) {
              spawn(queue.shift());
            }
            if (producerDone && queue.length === 0 && running.size === 0) {
              return;
            }
            await this._sleep(40);
          }
        };
        await consumerLoop();
        if (allTasks.length > 0) {
          await Promise.all(allTasks.map((t) => t.catch(() => {
          })));
        }
      };
      try {
        if (this.mangaMode) {
          await producer();
          if (!signal.aborted) {
            this._setStatus(`${totalExpected} panels found. Downloading...`);
            await consumer();
          }
        } else {
          await Promise.all([producer(), consumer()]);
        }
        if (!signal.aborted || this.segments.length > 0) {
          this._renderResults();
        }
        this._setProgress(0);
        const errStr = this.errors.length ? ` | ${this.errors.length} errors` : "";
        this.ui.footerEl.textContent = this.segments.length + " Segmente" + errStr;
        if (signal.aborted) {
          this._setStatus(`Aborted. ${this.segments.length} files loaded.`);
        } else {
          this._setStatus(`Done. ${this.segments.length} files ready.`);
        }
        if (this.segments.length > 0) this.ui.dlBtn.disabled = false;
      } catch (e) {
        this._setStatus("Error: " + (e && e.message || e));
        this.log.error(e);
      } finally {
        this.scanning = false;
        this.abortController = null;
        setScanBtn(this.ui.scanBtn, false);
      }
    }
_renderResults() {
      this.segments.sort((a, b) => a.filename.localeCompare(b.filename));
      addSegmentsToUI(this.segments, this.ui.resultsEl);
    }

_download() {
      const checkboxes = this.ui.root.querySelectorAll("#mpd-results input[type=checkbox]:checked");
      const checked = [];
      for (let i = 0; i < checkboxes.length; i++) {
        const seg = this.segments[parseInt(checkboxes[i].dataset.idx)];
        if (seg && seg.blob) checked.push(seg);
      }
      if (!checked.length) {
        this._setStatus("Nothing selected.");
        return;
      }
      this.ui.dlBtn.disabled = true;
      const host = location.hostname;
      const date = ( new Date()).toISOString().slice(0, 10);
      const chapter = location.pathname.replace(/\//g, "_").slice(1, 40) || "chapter";
      const name = `${host}_${chapter}_${date}.zip`;
      const finish = (zipBlob) => {
        triggerDownload(zipBlob, name);
        this.segments.forEach((seg) => {
          seg.blob = null;
        });
        this.ui.dlBtn.disabled = true;
        clearTimeout(this.previewRevokeTimer);
        this.previewRevokeTimer = setTimeout(() => {
          this._revokeAllPreviews();
        }, 3e4);
        this._setStatus("Downloaded: " + name);
      };
      this._setStatus(`Building ZIP (${checked.length} files)...`);
      buildZipBlob(checked).then(finish).catch((e) => {
        this.log.warn("Manual ZIP failed, downloading individually:", e.message);
        const individual = (idx) => {
          if (idx >= checked.length) {
            this.segments.forEach((seg2) => {
              seg2.blob = null;
            });
            this.ui.dlBtn.disabled = true;
            clearTimeout(this.previewRevokeTimer);
            this.previewRevokeTimer = setTimeout(() => {
              this._revokeAllPreviews();
            }, 3e4);
            this._setStatus(`${checked.length} files downloaded individually.`);
            return;
          }
          const seg = checked[idx];
          this._setStatus(`Downloading ${idx + 1}/${checked.length}: ${seg.filename}`);
          triggerDownload(seg.blob, seg.filename);
          this._sleep(300).then(() => individual(idx + 1));
        };
        try {
          individual(0);
        } catch (e2) {
          this._setStatus("Error: " + e2.message);
          this.log.error("Download:", e2);
          this.ui.dlBtn.disabled = false;
        }
      });
    }

_sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }
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
  
  const logger = createLogger("MPD");
  const downloader = new MangaDownloader(logger);
  downloader.init();

})();
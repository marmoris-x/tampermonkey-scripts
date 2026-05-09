// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.4.0
// @author       marmoris-x
// @description  Downloads manga/manhwa panels as ZIP — pipeline download, retry, abort, fast scrolling
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js
// @match        *://*/*
// @sandbox      JavaScript
// @connect      *
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
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
  var MIN_IMG_PX = 400;
  function extractLazySrc(el) {
    return el.dataset.src || el.dataset.lazySrc || el.dataset.original || el.dataset.url || el.dataset.imgSrc || el.dataset.lazyload || el.getAttribute("data-cfsrc") || el.getAttribute("data-echo") || null;
  }
  function getSrc(el) {
    var raw = el.src || el.currentSrc || extractLazySrc(el) || (el.getAttribute("data-srcset") || "").split(/[\s,]+/)[0] || (el.getAttribute("srcset") || "").split(/[\s,]+/)[0] || "";
    if (!raw || raw.startsWith("data:") || raw.startsWith("http")) return raw;
    try {
      return new URL(raw, location.href).href;
    } catch (e) {
      return raw;
    }
  }
  function allSrcsOf(el) {
    var srcs = new Set();
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
    var arr = [];
    srcs.forEach(function(s2) {
      arr.push(s2);
    });
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
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
    var seen = new Set();
    var results = [];
    function tryAdd(el, src) {
      if (!src || el && el.dataset && el.dataset.mpdProcessed) return;
      if (seen.has(src)) return;
      if (/\.(svg|gif)(\?|#|$)/i.test(src)) return;
      if (src.startsWith("data:image/svg") || src.startsWith("data:image/gif")) return;
      var parentTag = el.parentElement && el.parentElement.tagName ? el.parentElement.tagName.toLowerCase() : "";
      if (parentTag === "nav" || parentTag === "header" || parentTag === "footer") return;
      if (el.nodeType === Node.ELEMENT_NODE) {
        var cs = window.getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        if (el.tagName === "IMG" && el.offsetWidth === 0 && el.offsetHeight === 0) return;
      }
      var nw = el.naturalWidth || parseInt(el.getAttribute && el.getAttribute("width")) || el.offsetWidth || 0;
      var nh = el.naturalHeight || parseInt(el.getAttribute && el.getAttribute("height")) || el.offsetHeight || 0;
      if (nw > 0 && nw < 100 && nh > 0 && nh < 100) return;
      seen.add(src);
      results.push({ el, src });
    }
    var imgs = container.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      tryAdd(imgs[i], getSrc(imgs[i]));
    }
    var sources = container.querySelectorAll("picture source");
    for (var j = 0; j < sources.length; j++) {
      var s = sources[j];
      var url = (s.srcset || "").split(/[\s,]+/)[0];
      if (url) {
        var picture = s.closest("picture");
        tryAdd(picture ? picture.querySelector("img") : s, url);
      }
    }
    var bgEls = container.querySelectorAll('[style*="background"]');
    for (var k = 0; k < bgEls.length; k++) {
      var bgEl = bgEls[k];
      var match = bgEl.style.backgroundImage ? bgEl.style.backgroundImage.match(/url\(['"]?([^'")\s]+)['"]?\)/) : null;
      if (match && bgEl.offsetWidth >= MIN_IMG_PX && bgEl.offsetHeight >= MIN_IMG_PX) {
        tryAdd(bgEl, match[1]);
      }
    }
    var canvases = container.querySelectorAll("canvas");
    for (var l = 0; l < canvases.length; l++) {
      var c = canvases[l];
      if (c.width < MIN_IMG_PX || c.height < MIN_IMG_PX) return;
      try {
        var d = c.toDataURL("image/jpeg", 0.92);
        if (d && d.length > 1e3) tryAdd(c, d);
      } catch (e) {
      }
    }
    return results;
  }
  function triggerLazy(container) {
    var imgs = container.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var lazy = extractLazySrc(img);
      if (lazy && !img.src.startsWith("http") && !img.src.startsWith("data:")) {
        img.src = lazy;
      }
    }
  }
  var MAX_SEG_H = 3500;
  var MIN_SEG_H = 600;
  var FETCH_RETRY_COUNT = 2;
  function sleep$1(ms) {
    return new Promise(function(r) {
      setTimeout(r, ms);
    });
  }
  function fetchBlob(url, extraHeaders) {
    extraHeaders = extraHeaders || {};
    var headers = {};
    headers.Referer = location.href;
    headers.Origin = location.origin;
    for (var key in extraHeaders) {
      if (extraHeaders.hasOwnProperty(key)) {
        headers[key] = extraHeaders[key];
      }
    }
    var cleanHeaders = {};
    for (var k in headers) {
      if (headers.hasOwnProperty(k) && headers[k] != null) {
        cleanHeaders[k] = headers[k];
      }
    }
    return new Promise(function(resolve, reject) {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "blob",
        headers: cleanHeaders,
        onload: function(r) {
          if (r.status === 200 && r.response && r.response.size > 100) {
            resolve(r.response);
          } else {
            reject(new Error("HTTP " + r.status));
          }
        },
        onerror: function() {
          reject(new Error("Network error"));
        },
        ontimeout: function() {
          reject(new Error("Timeout"));
        },
        timeout: 2e4
      });
    });
  }
  async function fetchBlobWithFallbacks(src, el) {
    if (src && src.startsWith("data:")) {
      var resp = await fetch(src);
      return resp.blob();
    }
    var errs = [];
    try {
      return await fetchBlob(src);
    } catch (e) {
      errs.push(e.message);
    }
    try {
      return await fetchBlob(src, { Origin: null });
    } catch (e) {
      errs.push(e.message);
    }
    try {
      return await fetchBlob(src, { Referer: null, Origin: null });
    } catch (e) {
      errs.push(e.message);
    }
    try {
      var r = await fetch(src, { credentials: "include" });
      if (r.ok) return r.blob();
      throw new Error("HTTP " + r.status);
    } catch (e) {
      errs.push(e.message);
    }
    try {
      if (el && el.tagName === "IMG" && el.complete && el.naturalWidth > 0) {
        var c = document.createElement("canvas");
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        c.getContext("2d").drawImage(el, 0, 0);
        return await new Promise(function(r2) {
          c.toBlob(r2, "image/jpeg", 0.92);
        });
      }
      throw new Error("Not a loaded img");
    } catch (e) {
      errs.push(e.message);
    }
    throw new Error(errs.join(" | "));
  }
  async function fetchWithRetry(src, el, isAborted) {
    var lastErr;
    for (var attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
      if (isAborted && isAborted()) throw new Error("Aborted");
      try {
        return await fetchBlobWithFallbacks(src, el);
      } catch (e) {
        lastErr = e;
        if (attempt < FETCH_RETRY_COUNT) {
          await sleep$1(600 * (attempt + 1));
        }
      }
    }
    throw lastErr;
  }
  function findSplitPoints(h) {
    if (h <= MAX_SEG_H) return [0, h];
    var pts = [0];
    for (var y = MAX_SEG_H; y < h; y += MAX_SEG_H) pts.push(y);
    pts.push(h);
    if (pts.length > 2 && pts[pts.length - 1] - pts[pts.length - 2] < MIN_SEG_H) {
      pts.splice(pts.length - 2, 1);
    }
    return pts;
  }
  async function processImage(url, pageNum, srcEl, isAborted) {
    var blob = await fetchWithRetry(url, srcEl, isAborted);
    var ew = srcEl ? srcEl.naturalWidth : 0;
    var eh = srcEl ? srcEl.naturalHeight : 0;
    if (ew > 0 && eh > 0 && eh <= MAX_SEG_H && blob.type !== "image/webp") {
      var ext = blob.type === "image/png" ? "png" : "jpg";
      var pad = ("000" + pageNum).slice(-3);
      return [{
        filename: "page_" + pad + "." + ext,
        blob,
        previewUrl: URL.createObjectURL(blob),
        w: ew,
        h: eh
      }];
    }
    var objUrl = URL.createObjectURL(blob);
    var img;
    try {
      img = await new Promise(function(res, rej) {
        var el = new Image();
        el.onload = function() {
          res(el);
        };
        el.onerror = function() {
          rej(new Error("Decode failed"));
        };
        el.src = objUrl;
      });
    } finally {
      URL.revokeObjectURL(objUrl);
    }
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var pts = findSplitPoints(h);
    var srcExt = pts.length === 2 && blob.type === "image/png" ? "png" : "jpg";
    var pad2 = ("000" + pageNum).slice(-3);
    var results = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var y0 = pts[i];
      var segH = pts[i + 1] - y0;
      var suffix = pts.length === 2 ? "" : "_part" + (i + 1);
      var filename = "page_" + pad2 + suffix + "." + srcExt;
      if (pts.length === 2 && blob.type !== "image/webp") {
        results.push({
          filename,
          blob,
          previewUrl: URL.createObjectURL(blob),
          w,
          h: segH
        });
      } else {
        var segBlob = await new Promise(function(r) {
          var cv = document.createElement("canvas");
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
  var SCROLL_TIMEOUT_MS = 3e3;
  function sleep(ms) {
    return new Promise(function(r) {
      setTimeout(r, ms);
    });
  }
  async function scrollLoad() {
    triggerLazy(document);
    await sleep(150);
    function getUnloaded() {
      var result = [];
      var imgs = document.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if ((!img.complete || !img.naturalWidth) && (img.src && (img.src.startsWith("http") || extractLazySrc(img)))) {
          result.push(img);
        }
      }
      return result;
    }
    var unloaded = getUnloaded();
    for (var u = 0; u < unloaded.length; u++) {
      unloaded[u].scrollIntoView({ block: "center", behavior: "instant" });
      triggerLazy(document);
      await sleep(60);
    }
    var pageH = document.documentElement.scrollHeight;
    for (var y = 0; y <= pageH; y += window.innerHeight) {
      window.scrollTo(0, y);
      triggerLazy(document);
      await sleep(40);
    }
    var deadline = Date.now() + SCROLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      triggerLazy(document);
      if (getUnloaded().length === 0) break;
      await sleep(150);
    }
    window.scrollTo(0, 0);
    await sleep(100);
  }
  function guessNextUrl(url) {
    try {
      var u = new URL(url);
      if (u.searchParams.has("page")) {
        var n = parseInt(u.searchParams.get("page"), 10);
        if (!isNaN(n)) {
          var next = new URL(url);
          next.searchParams.set("page", n + 1);
          return next.href;
        }
      }
      var m = u.pathname.match(/^(.*\/)(\d+)(\/?)$/);
      if (m) {
        var pn = parseInt(m[2], 10);
        if (!isNaN(pn) && pn > 0 && pn < 1e4) {
          return u.origin + m[1] + (pn + 1) + m[3] + u.search;
        }
      }
    } catch (e) {
    }
    return null;
  }
  function clickNextPage() {
    var selectors = [
      'a[rel="next"]',
      '[class*="next"]:not([disabled])',
      '[aria-label*="next" i]',
      '[title*="next" i]',
      '[aria-label*="weiter" i]',
      '[title*="weiter" i]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        el.click();
        return true;
      }
    }
    var links = document.querySelectorAll("a, button");
    for (var j = 0; j < links.length; j++) {
      var t = (links[j].textContent || "").trim().toLowerCase();
      if (t === "next" || t === "weiter" || t === ">" || t === "›" || t === "→") {
        links[j].click();
        return true;
      }
    }
    return false;
  }
  function navigateNext() {
    if (clickNextPage()) return;
    var nextUrl = guessNextUrl(location.href);
    if (nextUrl) location.href = nextUrl;
  }
  function waitForUrlChange(prevUrl, timeout) {
    return new Promise(function(resolve) {
      var start = Date.now();
      var id = setInterval(function() {
        if (location.href !== prevUrl) {
          clearInterval(id);
          resolve(true);
          return;
        }
        if (Date.now() - start > timeout) {
          clearInterval(id);
          resolve(false);
        }
      }, 80);
    });
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
      "right:0; transform:translateY(-50%) translateX(100%);",
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
  var SW = 320;
  var CONTENT_CSS = [
    "#mpd-controls { padding:12px 0; border-bottom:1px solid #2c2d32; display:flex; flex-direction:column; gap:9px; }",
    ".mpd-btn-row { display:flex; gap:8px; }",
    ".mpd-btn-row button { flex:1; }",
    ".mpd-btn { padding:7px 12px; border:none; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.15s; }",
    ".mpd-primary { background:#2f9e44; color:#fff; }",
    ".mpd-primary:hover:not(:disabled) { background:#237032; }",
    ".mpd-danger { background:#c92a2a; color:#fff; }",
    ".mpd-danger:hover:not(:disabled) { background:#a61e1e; }",
    ".mpd-secondary { background:#2c2d32; color:#c1c2c5; }",
    ".mpd-secondary:hover:not(:disabled) { background:#373a40; }",
    ".mpd-btn:disabled { background:#333; color:#555; cursor:not-allowed; }",
    "#mpd-progress { height:3px; background:#2c2d32; border-radius:2px; overflow:hidden; display:none; }",
    "#mpd-progress-bar { height:100%; background:#2f9e44; width:0%; transition:width 0.15s; }",
    "#mpd-status { font-size:12px; color:#909296; min-height:16px; }",
    ".mpd-thumb { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #25262b; }",
    ".mpd-thumb img { width:48px; height:48px; object-fit:cover; border-radius:3px; flex-shrink:0; background:#25262b; }",
    ".mpd-thumb-info { flex:1; min-width:0; }",
    ".mpd-thumb-name { font-size:11px; color:#909296; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
    ".mpd-thumb-size { font-size:11px; color:#555; }",
    ".mpd-thumb input[type=checkbox] { flex-shrink:0; width:15px; height:15px; cursor:pointer; accent-color:#2f9e44; }",
    "#mpd-footer { padding:8px 0; border-top:1px solid #2c2d32; font-size:11px; color:#555; }",
    ".mpd-toggle-row { display:flex; align-items:center; gap:8px; font-size:12px; color:#909296; cursor:pointer; user-select:none; }",
    ".mpd-toggle-row input { cursor:pointer; accent-color:#2f9e44; }"
  ].join("");
  function buildUI(mangaMode) {
    var sidebar = createSidebar({
      width: SW,
      title: "Manga Downloader",
      accentColor: "#2f9e44"
    });
    var root = sidebar.root;
    var style = document.createElement("style");
    style.textContent = CONTENT_CSS;
    root.appendChild(style);
    var body = sidebar.bodyEl;
    body.innerHTML = [
      '<div id="mpd-controls">',
      '<div class="mpd-btn-row">',
      '<button class="mpd-btn mpd-primary" id="mpd-scan">Scan</button>',
      '<button class="mpd-btn mpd-secondary" id="mpd-dl" disabled>ZIP</button>',
      "</div>",
      '<label class="mpd-toggle-row">',
      '<input type="checkbox" id="mpd-manga-mode"',
      mangaMode ? " checked" : "",
      ">",
      "<span>Manga-Modus (auto weiterklicken)</span>",
      "</label>",
      '<div id="mpd-progress"><div id="mpd-progress-bar"></div></div>',
      '<div id="mpd-status">Ready.</div>',
      "</div>",
      '<div id="mpd-results"></div>',
      '<div id="mpd-footer"></div>'
    ].join("");
    sidebar.open();
    return {
      sidebar,
      root,
      scanBtn: root.querySelector("#mpd-scan"),
      dlBtn: root.querySelector("#mpd-dl"),
      mangaCheck: root.querySelector("#mpd-manga-mode"),
      statusEl: root.querySelector("#mpd-status"),
      progressEl: root.querySelector("#mpd-progress"),
      progressBar: root.querySelector("#mpd-progress-bar"),
      resultsEl: root.querySelector("#mpd-results"),
      footerEl: root.querySelector("#mpd-footer")
    };
  }
  function setScanBtn(scanBtn, scanning) {
    if (!scanBtn) return;
    scanBtn.textContent = scanning ? "Stop" : "Scan";
    scanBtn.className = scanning ? "mpd-btn mpd-danger" : "mpd-btn mpd-primary";
  }
  function addSegmentsToUI(segments, resultsEl) {
    if (!resultsEl) return;
    resultsEl.innerHTML = "";
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var div = document.createElement("div");
      div.className = "mpd-thumb";
      div.innerHTML = [
        '<img src="' + seg.previewUrl + '">',
        '<div class="mpd-thumb-info">',
        '<div class="mpd-thumb-name">' + seg.filename + "</div>",
        '<div class="mpd-thumb-size">' + seg.w + "×" + seg.h + "px</div>",
        "</div>",
        '<input type="checkbox" checked data-idx="' + i + '">'
      ].join("");
      resultsEl.appendChild(div);
    }
  }
  function buildZipBlob(files) {
    var pending = [];
    for (var i = 0; i < files.length; i++) {
      pending.push(new Promise(function(resolve, reject) {
        var fr = new FileReader();
        fr.onload = function() {
          resolve(new Uint8Array(fr.result));
        };
        fr.onerror = function() {
          reject(fr.error || new Error("FileReader error"));
        };
        fr.readAsArrayBuffer(files[i].blob);
      }).then(function(data) {
        return { name: files[i].filename, data };
      }));
    }
    return Promise.all(pending).then(function(converted) {
      var zipBytes = buildStoreZip(converted);
      return new Blob([zipBytes], { type: "application/zip" });
    });
  }
  function triggerDownload(blob, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() {
      URL.revokeObjectURL(a.href);
    }, 1e4);
  }
  
  var log = createLogger("Manga Panel Downloader");
  GM_deleteValue("mpd-allowed-sites");
  GM_deleteValue("mpd-manga-mode");
  window.mpd_enabled = window.mpd_enabled || false;
  var downloader = null;
  function initDownloader() {
    if (downloader) return;
    downloader = new MangaDownloader();
  }
  function toggleDownloader() {
    window.mpd_enabled = !window.mpd_enabled;
    if (window.mpd_enabled) {
      initDownloader();
    } else if (downloader) {
      var host = downloader.ui.sidebar.host;
      if (host.parentNode) host.parentNode.removeChild(host);
      downloader = null;
    }
  }
  GM_registerMenuCommand(
    window.mpd_enabled ? "Manga Downloader deaktivieren" : "Manga Downloader aktivieren",
    toggleDownloader
  );
  if (window.mpd_enabled) {
    initDownloader();
  }
  var CONCURRENT_DL = 6;
  var MAX_PAGES = 200;
  var NAV_CLICK_WAIT_MS = 50;
  var NAV_LOAD_WAIT_MS = 150;
  var NAV_TIMEOUT_MS = 5e3;
  var MANGA_POLL_MS = 50;
  var MANGA_MAX_WAIT_MS = 3e3;
  function MangaDownloader() {
    this.segments = [];
    this.errors = [];
    this.scanning = false;
    this.aborted = false;
    this.mangaMode = window.mpd_mangaMode || false;
    this.scannedUrls = new Set();
    this.previewRevokeTimer = null;
    this.ui = buildUI(this.mangaMode);
    this._initUI();
    this._watchUrlChanges();
  }
  MangaDownloader.prototype._initUI = function() {
    var self = this;
    self.ui.scanBtn.addEventListener("click", function() {
      if (self.scanning) self._abort();
      else self._scan();
    });
    self.ui.dlBtn.addEventListener("click", function() {
      self._download();
    });
    self.ui.mangaCheck.addEventListener("change", function(e) {
      self.mangaMode = e.target.checked;
      window.mpd_mangaMode = self.mangaMode;
    });
  };
  MangaDownloader.prototype._watchUrlChanges = function() {
    var self = this;
    var lastUrl = location.href;
    function onChange() {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      if (self.scanning) return;
      if (self.segments.length > 0) return;
      self._reset();
    }
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    setInterval(onChange, 1e3);
  };
  MangaDownloader.prototype._reset = function() {
    if (this.scanning) return;
    clearTimeout(this.previewRevokeTimer);
    this.previewRevokeTimer = null;
    this._revokeAllPreviews();
    this.segments = [];
    this.errors = [];
    this.ui.resultsEl.innerHTML = "";
    this.ui.footerEl.textContent = "";
    this.ui.dlBtn.disabled = true;
    this._setStatus("Ready.");
    this._setProgress(0);
  };
  MangaDownloader.prototype._revokeAllPreviews = function() {
    for (var i = 0; i < this.segments.length; i++) {
      try {
        URL.revokeObjectURL(this.segments[i].previewUrl);
      } catch (e) {
      }
    }
  };
  MangaDownloader.prototype._setStatus = function(msg) {
    this.ui.statusEl.textContent = msg;
  };
  MangaDownloader.prototype._setProgress = function(pct) {
    this.ui.progressEl.style.display = pct > 0 && pct < 100 ? "block" : "none";
    this.ui.progressBar.style.width = pct + "%";
  };
  MangaDownloader.prototype._abort = function() {
    this.aborted = true;
    this._setStatus("Aborting...");
  };
  MangaDownloader.prototype._collectPageUrls = function() {
    var self = this;
    var findAndSort = function() {
      var candidates = findImages(document);
      var withY = candidates.map(function(c2) {
        return { c: c2, y: (c2.el.getBoundingClientRect ? c2.el.getBoundingClientRect().top : 0) + window.scrollY };
      });
      withY.sort(function(a, b) {
        return a.y - b.y;
      });
      var sorted = withY.map(function(w) {
        return w.c;
      });
      var fresh = [];
      for (var i = 0; i < sorted.length; i++) {
        var c = sorted[i];
        if (self.scannedUrls.has(c.src)) continue;
        var srcs = allSrcsOf(c.el);
        var seen = false;
        srcs.forEach(function(v) {
          if (self.scannedUrls.has(v)) seen = true;
        });
        if (seen) continue;
        self.scannedUrls.add(c.src);
        srcs.forEach(function(v) {
          self.scannedUrls.add(v);
        });
        fresh.push(c);
      }
      return fresh;
    };
    if (this.mangaMode) {
      let poll2 = function() {
        if (Date.now() >= deadline) return Promise.resolve(findAndSort());
        var imgs = findImages(document);
        if (imgs.length > 0) return Promise.resolve(findAndSort());
        return self._sleep(MANGA_POLL_MS).then(poll2);
      };
      var deadline = Date.now() + MANGA_MAX_WAIT_MS;
      return poll2();
    } else {
      return scrollLoad().then(findAndSort);
    }
  };
  MangaDownloader.prototype._scan = function() {
    var self = this;
    if (self.scanning) return;
    self.scanning = true;
    self.aborted = false;
    clearTimeout(self.previewRevokeTimer);
    self.previewRevokeTimer = null;
    self._revokeAllPreviews();
    self.segments = [];
    self.errors = [];
    self.scannedUrls.clear();
    var processedEls = document.querySelectorAll("[data-mpd-processed]");
    for (var pe = 0; pe < processedEls.length; pe++) {
      processedEls[pe].removeAttribute("data-mpd-processed");
    }
    self.ui.resultsEl.innerHTML = "";
    self.ui.footerEl.textContent = "";
    self.ui.dlBtn.disabled = true;
    setScanBtn(self.ui.scanBtn, true);
    self._setProgress(0);
    self._setStatus("Starting...");
    var queue = [];
    var producerDone = false;
    var totalExpected = 0;
    var dlDone = 0;
    function producer() {
      var seqNum = 0;
      var page = 1;
      function runProducer() {
        if (self.aborted) return Promise.resolve();
        if (self.mangaMode && page > MAX_PAGES) return Promise.resolve();
        self._setStatus("Page " + page + ": scanning... (" + totalExpected + " so far)");
        var prevUrl = location.href;
        return self._collectPageUrls().then(function(found) {
          found.forEach(function(c) {
            c.num = ++seqNum;
          });
          queue.push.apply(queue, found);
          totalExpected += found.length;
          self._setStatus("Page " + page + " OK — " + totalExpected + " panel(s) found");
          if (found.length === 0) {
            self._setStatus("Page " + page + ": no panels. Finished.");
            return;
          }
          if (!self.mangaMode) return;
          navigateNext();
          return self._sleep(NAV_CLICK_WAIT_MS).then(function() {
            return waitForUrlChange(prevUrl, NAV_TIMEOUT_MS).then(function(changed) {
              if (!changed) return;
              return self._sleep(NAV_LOAD_WAIT_MS).then(function() {
                page++;
                return runProducer();
              });
            });
          });
        });
      }
      return runProducer().then(function() {
        producerDone = true;
      });
    }
    function consumer() {
      var running = new Set();
      var allTasks = [];
      function spawn(candidate) {
        var task = (function() {
          return Promise.resolve().then(function() {
            if (self.aborted) return;
            return processImage(
              candidate.src,
              candidate.num,
              candidate.el,
              function() {
                return self.aborted;
              }
            );
          }).then(function(segs) {
            if (self.aborted || !segs) return;
            segs.forEach(function(seg) {
              self.segments.push(seg);
            });
            if (candidate.el) candidate.el.dataset.mpdProcessed = "true";
          }).catch(function(e) {
            self.errors.push({ src: candidate.src, message: e.message });
            log.warn("Failed:", candidate.src ? candidate.src.slice(0, 80) : "", e.message);
          }).then(function() {
            dlDone++;
            running.delete(task);
            var pct = totalExpected > 0 ? dlDone / totalExpected * 100 : 0;
            var errStr = self.errors.length ? " (" + self.errors.length + " errors)" : "";
            self._setProgress(pct);
            self._setStatus("Downloading: " + dlDone + "/" + totalExpected + errStr);
          });
        })();
        running.add(task);
        allTasks.push(task);
      }
      function consumerLoop() {
        if (self.aborted) return Promise.resolve();
        while (queue.length > 0 && running.size < CONCURRENT_DL) {
          spawn(queue.shift());
        }
        if (producerDone && queue.length === 0 && running.size === 0) {
          return Promise.resolve();
        }
        return self._sleep(40).then(consumerLoop);
      }
      return consumerLoop().then(function() {
        if (allTasks.length > 0) {
          return Promise.all(allTasks.map(function(t) {
            return t.catch(function() {
            });
          }));
        }
      });
    }
    var phase;
    if (self.mangaMode) {
      phase = producer().then(function() {
        self._setStatus(totalExpected + " panels found. Downloading...");
        return consumer();
      });
    } else {
      phase = Promise.all([producer(), consumer()]);
    }
    return phase.then(function() {
      self._renderResults();
      self._setProgress(0);
      var errStr = self.errors.length ? " | " + self.errors.length + " errors" : "";
      self.ui.footerEl.textContent = self.segments.length + " Segmente" + errStr;
      self._setStatus(
        self.aborted ? "Aborted. " + self.segments.length + " files loaded." : "Done. " + self.segments.length + " files ready."
      );
      if (self.segments.length > 0) self.ui.dlBtn.disabled = false;
    }).catch(function(e) {
      self._setStatus("Error: " + (e && e.message || e));
      log.error(e);
    }).then(function() {
      self.scanning = false;
      setScanBtn(self.ui.scanBtn, false);
    });
  };
  MangaDownloader.prototype._renderResults = function() {
    this.segments.sort(function(a, b) {
      return a.filename.localeCompare(b.filename);
    });
    addSegmentsToUI(this.segments, this.ui.resultsEl);
  };
  MangaDownloader.prototype._download = function() {
    var self = this;
    var checkboxes = self.ui.root.querySelectorAll("#mpd-results input[type=checkbox]:checked");
    var checked = [];
    for (var i = 0; i < checkboxes.length; i++) {
      var seg = self.segments[parseInt(checkboxes[i].dataset.idx)];
      if (seg && seg.blob) checked.push(seg);
    }
    if (!checked.length) {
      self._setStatus("Nothing selected.");
      return;
    }
    self.ui.dlBtn.disabled = true;
    var host = location.hostname;
    var date = ( new Date()).toISOString().slice(0, 10);
    var chapter = location.pathname.replace(/\//g, "_").slice(1, 40) || "chapter";
    var name = host + "_" + chapter + "_" + date + ".zip";
    var finish = function(zipBlob) {
      triggerDownload(zipBlob, name);
      self.segments.forEach(function(seg2) {
        seg2.blob = null;
      });
      self.ui.dlBtn.disabled = true;
      clearTimeout(self.previewRevokeTimer);
      self.previewRevokeTimer = setTimeout(function() {
        self._revokeAllPreviews();
      }, 3e4);
      self._setStatus("Downloaded: " + name);
    };
    self._setStatus("Building ZIP (" + checked.length + " files)...");
    buildZipBlob(checked).then(finish).catch(function(e) {
      log.warn("Manual ZIP failed, downloading individually:", e.message);
      var individual = function(idx) {
        if (idx >= checked.length) {
          self.segments.forEach(function(seg3) {
            seg3.blob = null;
          });
          self.ui.dlBtn.disabled = true;
          clearTimeout(self.previewRevokeTimer);
          self.previewRevokeTimer = setTimeout(function() {
            self._revokeAllPreviews();
          }, 3e4);
          self._setStatus(checked.length + " files downloaded individually.");
          return;
        }
        var seg2 = checked[idx];
        self._setStatus("Downloading " + (idx + 1) + "/" + checked.length + ": " + seg2.filename);
        triggerDownload(seg2.blob, seg2.filename);
        self._sleep(300).then(function() {
          individual(idx + 1);
        });
      };
      try {
        individual(0);
      } catch (e2) {
        self._setStatus("Error: " + e2.message);
        log.error("Download:", e2);
        self.ui.dlBtn.disabled = false;
      }
    });
  };
  MangaDownloader.prototype._sleep = function(ms) {
    return new Promise(function(r) {
      setTimeout(r, ms);
    });
  };

})();
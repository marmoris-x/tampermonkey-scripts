'use strict';

const pendingRequests = new Map();

// Cache for player element to avoid repeated querySelector calls
let cachedPlayer = null;
let cachedPlayerSelector = null;
let cachedPathname = null;

class SessionLRUCache {
  constructor({
    maxBytes = 5 * 1024 * 1024,
    ns = "[YoutubeAntiTranslate]cache:",
  } = {}) {
    this.maxBytes = maxBytes;
    this.ns = ns;
  }

  set(key, value) {
    const entryKey = this.ns + key;
    const entry = { v: value, t: Date.now() };
    sessionStorage.setItem(entryKey, JSON.stringify(entry));
    this._evictIfNeeded();
  }

  get(key) {
    const entryKey = this.ns + key;
    const raw = sessionStorage.getItem(entryKey);
    if (!raw) return undefined;
    try {
      const entry = JSON.parse(raw);
      entry.t = Date.now();
      sessionStorage.setItem(entryKey, JSON.stringify(entry));
      return entry.v;
    } catch {
      sessionStorage.removeItem(entryKey);
      return undefined;
    }
  }

  delete(key) {
    sessionStorage.removeItem(this.ns + key);
  }

  clear() {
    this._eachEntry(({ k }) => sessionStorage.removeItem(k));
  }

  bytes() {
    let total = 0;
    this._eachEntry(({ k, v }) => { total += (k.length + v.length) * 2; });
    return total;
  }

  size() {
    let n = 0;
    this._eachEntry(() => { n += 1; });
    return n;
  }

  _eachEntry(cb) {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(this.ns)) {
        cb({ k, v: sessionStorage.getItem(k) });
      }
    }
  }

  _evictIfNeeded() {
    let usage = this.bytes();
    if (usage <= this.maxBytes) return;
    const items = [];
    this._eachEntry(({ k, v }) => {
      const { t } = JSON.parse(v || "{}");
      const bytes = (k.length + v.length) * 2;
      items.push({ k, bytes, t: t ?? 0 });
    });
    items.sort((a, b) => a.t - b.t);
    for (const item of items) {
      sessionStorage.removeItem(item.k);
      usage -= item.bytes;
      if (usage <= this.maxBytes) break;
    }
  }
}

const lruCache = new SessionLRUCache();

window.YoutubeAntiTranslate = {
  VIEWPORT_EXTENSION_PERCENTAGE_FRACTION: 0.5,
  VIEWPORT_OUTSIDE_LIMIT_FRACTION: 0.5,
  MAX_ATTEMPTS: 2,
  LOG_PREFIX: "[YoutubeAntiTranslate]",
  LOG_LEVELS: {
    NONE: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4,
  },
  currentLogLevel: 2,
  QS_PROFILE_ENABLED: false,
  QS_PROFILE_CHECK_CORRECTNESS: false,

  setLogLevel: function (levelName) {
    const newLevel = this.LOG_LEVELS[levelName.toUpperCase()];
    if (typeof newLevel === "number") {
      this.currentLogLevel = newLevel;
      this.logDebug(`Log level set to ${levelName.toUpperCase()} (${newLevel})`);
    } else {
      this.logWarning(`Invalid log level: ${levelName}`);
    }
  },

  CORE_ATTRIBUTED_STRING_SELECTOR:
    ":is(.yt-core-attributed-string, .ytAttributedStringHost)",
  CORE_ATTRIBUTED_STRING_LINK_SELECTOR:
    "a:is(.yt-core-attributed-string__link, .ytAttributedStringLink)",
  CORE_ATTRIBUTED_STRING_PRE_WRAP_SELECTOR:
    ":is(.yt-core-attributed-string--white-space-pre-wrap, .ytAttributedStringWhiteSpacePreWrap)",
  ALL_ARRAYS_VIDEOS_SELECTOR: `ytd-video-renderer,
ytd-rich-item-renderer,
ytd-compact-video-renderer,
ytd-grid-video-renderer,
ytd-playlist-video-renderer,
ytd-playlist-panel-video-renderer,
ytm-playlist-panel-video-renderer,
yt-lockup-view-model,
ytm-compact-video-renderer,
ytm-rich-item-renderer,
ytm-video-with-context-renderer,
ytm-video-card-renderer,
ytm-media-item,
ytm-playlist-video-renderer,
a.ytp-videowall-still,
a.ytp-ce-covering-overlay,
a.ytp-suggestion-link,
div.fullscreen-recommendation,
ytd-structured-description-video-lockup-renderer,
a.ytp-autonav-endscreen-link-container,
a.autonav-endscreen-cued-video-container,
a.ytp-modern-videowall-still,

ytm-compact-playlist-renderer,
ytm-playlist-card-renderer`,
  ALL_ARRAYS_SHORTS_SELECTOR: `div.style-scope.ytd-rich-item-renderer,
ytm-shorts-lockup-view-model`,

  logWarning: function (...args) {
    if (this.currentLogLevel >= this.LOG_LEVELS.WARN) {
      console.log(`${this.LOG_PREFIX} [WARN ]`, ...args);
    }
  },

  logInfo: function (...args) {
    if (this.currentLogLevel >= this.LOG_LEVELS.INFO) {
      console.log(`${this.LOG_PREFIX} [INFO ]`, ...args);
    }
  },

  logError: function (...args) {
    if (this.currentLogLevel >= this.LOG_LEVELS.ERROR) {
      console.error(`${this.LOG_PREFIX} [ERROR]`, ...args);
    }
  },

  logDebug: function (...args) {
    if (this.currentLogLevel >= this.LOG_LEVELS.DEBUG) {
      console.debug(`${this.LOG_PREFIX} [DEBUG]`, ...args);
    }
  },

  debounce: function (func, waitMinMs = 90, includeArgsInSignature = false, getSignature = undefined) {
    if (!func["__debounceId"]) {
      Object.defineProperty(func, "__debounceId", {
        value: Symbol(), writable: false, configurable: false,
      });
    }
    const signatures = new Map();
    function schedule(callback) {
      if (document.hidden || typeof requestAnimationFrame === "undefined") {
        return setTimeout(() => {
          const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
          callback(now);
        }, 16);
      }
      return requestAnimationFrame(callback);
    }
    function tickQueue(signature, time) {
      const entry = signatures.get(signature);
      if (!entry || !entry.queued) return;
      const elapsed = time - entry.lastExecTime;
      if (elapsed >= waitMinMs) {
        func.apply(entry.queued.context, entry.queued.args);
        entry.lastExecTime = time;
        entry.queued = null;
      } else {
        schedule((t) => tickQueue(signature, t));
      }
    }
    return function (...args) {
      const context = this;
      const signature = getSignature?.(context, args) ||
        (includeArgsInSignature
          ? `${String(func["__debounceId"])}::${JSON.stringify(args)}`
          : String(func["__debounceId"]));
      const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      let entry = signatures.get(signature);
      if (!entry) {
        entry = { lastExecTime: now, queued: null };
        signatures.set(signature, entry);
        schedule((time) => { func.apply(context, args); entry.lastExecTime = time; });
      } else {
        if (!entry.queued) {
          entry.queued = { context, args };
          schedule((time) => tickQueue(signature, time));
        } else {
          entry.queued.context = context;
          entry.queued.args = args;
        }
      }
    };
  },

  getSessionCache: function (key) { return lruCache.get(key); },
  setSessionCache: function (key, value) { return lruCache.set(key, value); },

  getPlayerSelector: function () {
    if (window.location.hostname === "m.youtube.com") return "#player-container-id";
    if (window.location.pathname.startsWith("/embed")) return "#movie_player";
    const selector = window.location.pathname.startsWith("/shorts")
      ? "#shorts-player" : "ytd-player .html5-video-player";
    return selector;
  },

  getCachedPlayer: function () {
    const doProfile = this.QS_PROFILE_ENABLED;
    const t0 = doProfile ? performance.now() : 0;
    const currentPathname = window.location.pathname;
    if (cachedPathname !== currentPathname) {
      cachedPlayer = null;
      cachedPlayerSelector = null;
      cachedPathname = currentPathname;
    }
    if (cachedPlayer && document.contains(cachedPlayer)) {
      if (doProfile) {
        this.__recordQueryProfile("getCachedPlayer[hit]", document, cachedPlayerSelector || "(none)", performance.now() - t0);
      }
      return cachedPlayer;
    }
    cachedPlayerSelector = this.getPlayerSelector();
    cachedPlayer = this.querySelector(cachedPlayerSelector);
    if (doProfile) {
      this.__recordQueryProfile("getCachedPlayer[miss]", document, cachedPlayerSelector, performance.now() - t0);
    }
    return cachedPlayer;
  },

  isMobile: function () { return window.location.hostname === "m.youtube.com"; },

  normalizeSpaces: function (str) { return str.replace(/\s+/g, " ").trim(); },

  processString: function (str, options = {}) {
    const {
      ignoreCase = true, normalizeSpaces = true, normalizeNFKC = true,
      ignoreInvisible = true, trim = true, trimLeft = false, trimRight = false,
    } = options;
    if (!str) return str;
    if (normalizeNFKC) str = str.normalize("NFKC");
    if (ignoreInvisible) str = str.replace(/[​-‏‪-‮⁠-⁯﻿]/g, "");
    if (normalizeSpaces) str = str.replace(/\s+/g, " ");
    if (trim) str = str.trim();
    else { if (trimLeft) str = str.trimStart(); if (trimRight) str = str.trimEnd(); }
    if (ignoreCase) str = str.toLowerCase();
    return str;
  },

  isStringEqual: function (str1, str2, options = {}) {
    return this.processString(str1, options) === this.processString(str2, options);
  },

  doesStringInclude: function (container, substring, options = {}) {
    return this.processString(container, options).includes(this.processString(substring, options));
  },

  stringReplaceWithOptions: function (input, pattern, replacement, options = {}) {
    const { ignoreCase = true } = options;
    const preprocessOptions = { ...options, ignoreCase: false };
    const processedInput = this.processString(input, preprocessOptions);
    if (!processedInput || replacement === null || replacement === undefined) return processedInput;
    let regex;
    if (typeof pattern === "string") {
      const processedPattern = this.processString(pattern, preprocessOptions);
      const escapedPattern = processedPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(escapedPattern, ignoreCase ? "gi" : "g");
    } else if (pattern instanceof RegExp) {
      const flags = pattern.flags.replace(/i?/, ignoreCase ? "i" : "");
      regex = new RegExp(pattern.source, flags);
    } else {
      throw new TypeError("pattern must be a string or RegExp");
    }
    return processedInput.replace(regex, replacement);
  },

  isVisible: function (node, shouldCheckViewport = true, onlyOutsideViewport = false, useOutsideLimit = false) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      this.logError("Provided node is not a valid Element.", window.location.href);
      return false;
    }
    const element = /** @type {Element} */ (node);
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || parseFloat(style.opacity) === 0) return false;
    let parent = element.parentElement;
    let depth = 0;
    const MAX_PARENT_DEPTH = 25;
    while (parent && depth < MAX_PARENT_DEPTH) {
      const parentStyle = getComputedStyle(parent);
      if (parentStyle.display === "none" || parentStyle.visibility === "hidden" || parentStyle.visibility === "collapse" || parseFloat(parentStyle.opacity) === 0) return false;
      parent = parent.parentElement;
      depth++;
    }
    if (shouldCheckViewport) {
      const rect = element.getBoundingClientRect();
      const extendedHeight = window.innerHeight * this.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION;
      const extendedWidth = window.innerWidth * this.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION;
      const topBoundary = -extendedHeight;
      const bottomBoundary = window.innerHeight + extendedHeight;
      const leftBoundary = -extendedWidth;
      const rightBoundary = window.innerWidth + extendedWidth;
      if (onlyOutsideViewport) {
        const fullyOutside = rect.top > bottomBoundary || rect.bottom < topBoundary || rect.left > rightBoundary || rect.right < leftBoundary;
        if (!useOutsideLimit) return fullyOutside;
        const extraHeight = Math.max(window.innerHeight * this.VIEWPORT_OUTSIDE_LIMIT_FRACTION, 500);
        const extraWidth = Math.max(window.innerWidth * this.VIEWPORT_OUTSIDE_LIMIT_FRACTION, 500);
        const outerTopBoundary = topBoundary - extraHeight;
        const outerBottomBoundary = bottomBoundary + extraHeight;
        const outerLeftBoundary = leftBoundary - extraWidth;
        const outerRightBoundary = rightBoundary + extraWidth;
        const intersectsOuterLimitViewport = rect.top <= outerBottomBoundary && rect.bottom >= outerTopBoundary && rect.left <= outerRightBoundary && rect.right >= outerLeftBoundary;
        return fullyOutside && intersectsOuterLimitViewport;
      } else {
        return rect.top <= bottomBoundary && rect.bottom >= topBoundary && rect.left <= rightBoundary && rect.right >= leftBoundary;
      }
    }
    return true;
  },

  getFirstVisible: function (nodes, shouldBeInsideViewport = true) {
    if (!nodes && (!(nodes instanceof Element) || !(nodes instanceof NodeList))) return null;
    let nodeArray;
    if (nodes instanceof Element) nodeArray = [nodes];
    else nodeArray = Array.from(nodes);
    for (const node of nodeArray) {
      if (this.isVisible(node, shouldBeInsideViewport, false, false)) return node;
    }
    return null;
  },

  getAllVisibleNodes: function (nodes, shouldBeInsideViewport = true, lengthLimit = Number.MAX_VALUE) {
    if (!nodes && (!(nodes instanceof Element) || !(nodes instanceof NodeList))) return null;
    let nodeArray;
    if (nodes instanceof Element) nodeArray = [nodes];
    else nodeArray = Array.from(nodes);
    let visibleNodes = null;
    for (const node of nodeArray) {
      if (this.isVisible(node, shouldBeInsideViewport, false, false)) {
        if (visibleNodes) visibleNodes.push(node);
        else visibleNodes = [node];
        if (visibleNodes.length === lengthLimit) break;
      }
    }
    return visibleNodes;
  },

  getAllVisibleNodesOutsideViewport: function (nodes, useOutsideLimit = false) {
    if (!nodes && (!(nodes instanceof Element) || !(nodes instanceof NodeList))) return null;
    let nodeArray;
    if (nodes instanceof Node) nodeArray = [nodes];
    else nodeArray = Array.from(nodes);
    let visibleNodes = null;
    for (const node of nodeArray) {
      if (this.isVisible(node, true, true, useOutsideLimit)) {
        if (visibleNodes) visibleNodes.push(node);
        else visibleNodes = [node];
      }
    }
    return visibleNodes;
  },

  createLinkElement: function (url) {
    const link = document.createElement("a");
    link.href = url;
    link.textContent = url;
    link.rel = "nofollow";
    link.target = "_blank";
    link.dir = "auto";
    link.className = "yt-simple-endpoint style-scope yt-formatted-string";
    return link;
  },

  convertTimecodeToSeconds: function (timecode) {
    const parts = timecode.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  },

  stripNonEssentialParams: function (url) {
    if (!url.includes("/watch?")) return url;
    const searchParamsText = url.split("?")[1];
    const searchParams = new URLSearchParams(searchParamsText);
    const videoId = searchParams.get("v");
    return `${url.split("?")[0]}?v=${videoId}`;
  },

  isAdvertisementHref: function (href) { return href.includes("www.googleadservices.com"); },

  getCurrentVideoId: function () {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v") || "";
  },

  isDarkTheme: function () {
    if (this.isMobile()) {
      return this.querySelector("head > #theme-meta")?.getAttribute("content") === "rgba(15, 15, 15, 0.7)";
    }
    return document.documentElement.hasAttribute("dark");
  },

  createTimecodeLink: function (timecode) {
    const seconds = this.convertTimecodeToSeconds(timecode);
    const span = document.createElement("span");
    span.className = "yt-core-attributed-string--link-inherit-color ytAttributedStringLinkInheritColor";
    span.dir = "auto";
    span.style.color = this.isDarkTheme() ? "rgb(62, 166, 255)" : "rgb(6, 95, 212)";
    const link = document.createElement("a");
    link.className = "yt-core-attributed-string__link yt-core-attributed-string__link--call-to-action-color ytAttributedStringLink ytAttributedStringLinkCallToActionColor yt-timecode-link";
    link.tabIndex = 0;
    link.href = `/watch?v=${this.getCurrentVideoId()}&t=${seconds}s`;
    link.target = "";
    link.setAttribute("force-new-state", "true");
    link.setAttribute("data-seconds", seconds.toString());
    link.textContent = timecode;
    span.appendChild(link);
    return span;
  },

  createTagLink: function (type, value) {
    const span = document.createElement("span");
    span.className = "yt-core-attributed-string--link-inherit-color ytAttributedStringLinkInheritColor";
    span.dir = "auto";
    span.style.color = this.isDarkTheme() ? "rgb(62, 166, 255)" : "rgb(6, 95, 212)";
    const link = document.createElement("a");
    link.className = "yt-core-attributed-string__link yt-core-attributed-string__link--call-to-action-color ytAttributedStringLink ytAttributedStringLinkCallToActionColor";
    link.tabIndex = 0;
    if (type === "hashtag") { link.href = `/hashtag/${encodeURIComponent(value)}`; link.textContent = `#${value}`; }
    else if (type === "mention") { link.href = `/@${value}`; link.textContent = `@${value}`; }
    link.target = "";
    link.setAttribute("force-new-state", "true");
    span.appendChild(link);
    return span;
  },

  convertUrlsToLinks: function (text) {
    const container = document.createElement("span");
    const combinedPattern = /(https?:\/\/[^\s]+)|((?:^|\s)((?:\d{1,2}:)?\d{1,2}:\d{2}))(?=\s|$)|((?:^|\s)#([A-Za-z0-9_\--ʯͰ-῿⺀-⿟぀-﷿]{1,50}))|((?:^|\s)@([\w-]{3,100}))/g;
    let lastIndex = 0;
    let match;
    let linkCount = 0;
    while ((match = combinedPattern.exec(text)) !== null) {
      const urlMatch = match[1];
      const timecodeFullMatch = match[2];
      const timecodeValue = match[3];
      const hashtagFullMatch = match[4];
      const hashtag = match[5];
      const mentionFullMatch = match[6];
      const mention = match[7];
      if (match.index > lastIndex) container.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      if (urlMatch) {
        container.appendChild(this.createLinkElement(urlMatch));
        lastIndex = combinedPattern.lastIndex;
        linkCount++;
      } else if (timecodeValue) {
        if (timecodeFullMatch.startsWith(" ")) container.appendChild(document.createTextNode(" "));
        container.appendChild(this.createTimecodeLink(timecodeValue));
        lastIndex = match.index + timecodeFullMatch.length;
        combinedPattern.lastIndex = lastIndex;
        linkCount++;
      } else if (hashtag) {
        if (hashtagFullMatch.startsWith(" ")) container.appendChild(document.createTextNode(" "));
        container.appendChild(this.createTagLink("hashtag", hashtag));
        lastIndex = match.index + hashtagFullMatch.length;
        combinedPattern.lastIndex = lastIndex;
        linkCount++;
      } else if (mention) {
        if (mentionFullMatch.startsWith(" ")) container.appendChild(document.createTextNode(" "));
        container.appendChild(this.createTagLink("mention", mention));
        lastIndex = match.index + mentionFullMatch.length;
        combinedPattern.lastIndex = lastIndex;
        linkCount++;
      }
    }
    if (lastIndex < text.length) container.appendChild(document.createTextNode(text.substring(lastIndex)));
    return container;
  },

  createFormattedContent: function (text) {
    const contentElement = document.createElement("span");
    contentElement.className = "yt-core-attributed-string yt-core-attributed-string--white-space-pre-wrap ytAttributedStringHost ytAttributedStringWhiteSpacePreWrap";
    contentElement.dir = "auto";
    const textLines = text.split("\n");
    textLines.forEach((line, index) => {
      const lineElement = this.convertUrlsToLinks(line);
      contentElement.appendChild(lineElement);
      if (index < textLines.length - 1) contentElement.appendChild(document.createElement("br"));
    });
    return contentElement;
  },

  replaceTextOnly: function (element, replaceText) {
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = replaceText;
        break;
      }
    }
  },

  getFirstTextNode: function (element) {
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) return node;
    }
    return null;
  },

  replaceContainerContent: function (container, newContent) {
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(newContent);
  },

  getArraysVideos: function (root = document) {
    const context = root || document;
    const doProfile = this.QS_PROFILE_ENABLED;
    const t0 = doProfile ? performance.now() : 0;
    const tagSelectors = [
      "ytd-video-renderer", "ytd-rich-item-renderer", "ytd-compact-video-renderer",
      "ytd-grid-video-renderer", "ytd-playlist-video-renderer", "ytd-playlist-panel-video-renderer",
      "ytm-playlist-panel-video-renderer", "yt-lockup-view-model", "ytm-compact-video-renderer",
      "ytm-rich-item-renderer", "ytm-video-with-context-renderer", "ytm-video-card-renderer",
      "ytm-media-item", "ytm-playlist-video-renderer", "ytd-structured-description-video-lockup-renderer",
      "ytm-compact-playlist-renderer", "ytm-playlist-card-renderer",
    ];
    const classQualifiedSelector = [
      "a.ytp-videowall-still", "a.ytp-ce-covering-overlay", "a.ytp-suggestion-link",
      "div.fullscreen-recommendation", "a.ytp-autonav-endscreen-link-container",
      "a.autonav-endscreen-cued-video-container", "a.ytp-modern-videowall-still",
    ].join(",");
    const resultSet = new Set();
    for (const tag of tagSelectors) {
      const list = context.getElementsByTagName(tag);
      for (let i = 0; i < list.length; i++) resultSet.add(list[i]);
    }
    if (classQualifiedSelector) {
      const extra = context.querySelectorAll(classQualifiedSelector);
      for (let i = 0; i < extra.length; i++) resultSet.add(extra[i]);
    }
    const optimized = Array.from(resultSet);
    if (doProfile) {
      const t1 = performance.now();
      this.__recordQueryProfile("getArraysVideos", context, this.ALL_ARRAYS_VIDEOS_SELECTOR, t1 - t0);
      if (this.QS_PROFILE_CHECK_CORRECTNESS) {
        const baseline = this.querySelectorAll(this.ALL_ARRAYS_VIDEOS_SELECTOR, context);
        if (baseline.length !== optimized.length) this.logError(`getArraysVideos count differs: optimized=${optimized.length}, baseline=${baseline.length}`);
      }
    }
    return optimized;
  },

  SUPPORTED_BCP47_CODES: new Set([
    "af-ZA", "az-AZ", "id-ID", "ms-MY", "bs-BA", "ca-ES", "cs-CZ", "da-DK", "de-DE",
    "et-EE", "en-IN", "en-GB", "en-US", "es-ES", "es-419", "es-US", "eu-ES", "fil-PH",
    "fr-FR", "fr-CA", "gl-ES", "hr-HR", "zu-ZA", "is-IS", "it-IT", "sw-TZ", "lv-LV",
    "lt-LT", "hu-HU", "nl-NL", "nb-NO", "uz-UZ", "pl-PL", "pt-PT", "pt-BR", "ro-RO",
    "sq-AL", "sk-SK", "sl-SI", "sr-RS", "fi-FI", "sv-SE", "vi-VN", "tr-TR", "be-BY",
    "bg-BG", "ky-KG", "kk-KZ", "mk-MK", "mn-MN", "ru-RU", "sr-BA", "uk-UA", "el-GR",
    "hy-AM", "he-IL", "ur-PK", "ar-SA", "fa-IR", "ne-NP", "mr-IN", "hi-IN", "as-IN",
    "bn-BD", "pa-IN", "gu-IN", "or-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "si-LK",
    "th-TH", "lo-LA", "my-MM", "ka-GE", "am-ET", "km-KH", "zh-CN", "zh-TW", "zh-HK",
    "ja-JP", "ko-KR",
  ]),

  COMMON_BCP47_FALLBACKS: {
    af: "af-ZA", am: "am-ET", ar: "ar-SA", as: "as-IN", az: "az-AZ", be: "be-BY",
    bg: "bg-BG", bn: "bn-BD", bs: "bs-BA", ca: "ca-ES", cs: "cs-CZ", da: "da-DK",
    de: "de-DE", el: "el-GR", en: "en-US", es: "es-419", et: "et-EE", eu: "eu-ES",
    fa: "fa-IR", fi: "fi-FI", fil: "fil-PH", fr: "fr-FR", gl: "gl-ES", gu: "gu-IN",
    he: "he-IL", hi: "hi-IN", hr: "hr-HR", hu: "hu-HU", hy: "hy-AM", id: "id-ID",
    is: "is-IS", it: "it-IT", ja: "ja-JP", ka: "ka-GE", km: "km-KH", kn: "kn-IN",
    ko: "ko-KR", lo: "lo-LA", lt: "lt-LT", lv: "lv-LV", mk: "mk-MK", ml: "ml-IN",
    mn: "mn-MN", mr: "mr-IN", ms: "ms-MY", ne: "ne-NP", nl: "nl-NL", nb: "nb-NO",
    or: "or-IN", pa: "pa-IN", pl: "pl-PL", pt: "pt-BR", ro: "ro-RO", ru: "ru-RU",
    si: "si-LK", sk: "sk-SK", sl: "sl-SI", sq: "sq-AL", sr: "sr-RS", sv: "sv-SE",
    sw: "sw-TZ", ta: "ta-IN", te: "te-IN", th: "th-TH", tr: "tr-TR", uk: "uk-UA",
    ur: "ur-PK", uz: "uz-UZ", vi: "vi-VN", zh: "zh-CN", zu: "zu-ZA",
  },

  /** Stub — original used chrome.i18n.detectLanguage which is unavailable in TM */
  detectSupportedLanguage: async function () { return null; },

  getSettings: async function () {
    return window.__YAT_getSettings ? window.__YAT_getSettings() : {};
  },

  cachedRequest: async function cachedRequest(url, postData = null, headersData = { "content-type": "application/json" }, doNotCache = false, cacheDotNotationProperty = null) {
    const cacheKey = url + "|" + postData + "|" + cacheDotNotationProperty;
    const storedResponse = this.getSessionCache(cacheKey);
    if (storedResponse) {
      if (cacheDotNotationProperty) {
        return { response: new Response(JSON.stringify({ data: null, cachedWithDotNotation: storedResponse }), { status: storedResponse.status || 200, headers: { "Content-Type": "application/json" } }), data: null, cachedWithDotNotation: storedResponse };
      } else {
        return { response: new Response(JSON.stringify({ data: storedResponse, cachedWithDotNotation: null }), { status: storedResponse.status || 200, headers: { "Content-Type": "application/json" } }), data: storedResponse, cachedWithDotNotation: null };
      }
    }
    if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);
    const requestPromise = (async () => {
      try {
        const response = await fetch(url, { method: postData ? "POST" : "GET", headers: headersData, body: postData ? postData : undefined });
        if (!response.ok) {
          if (response.status === 404) { if (!doNotCache) this.setSessionCache(cacheKey, null); return null; }
          else if (response.status === 401) {
            if (!doNotCache) {
              if (url.includes("oembed?url=")) this.setSessionCache(cacheKey, { title: undefined, status: 401 });
              else this.setSessionCache(cacheKey, null);
            }
            return { response: response, data: null };
          }
          throw new Error(`HTTP error! status: ${response.status}, while fetching: ${url}`);
        }
        const data = await response.json();
        if (!doNotCache) {
          if (cacheDotNotationProperty) this.setSessionCache(cacheKey, this.getPropertyByDotNotation(data, cacheDotNotationProperty) || null);
          else this.setSessionCache(cacheKey, data);
        }
        return { response: response, data: data };
      } catch (error) {
        this.logWarning("Error fetching:", error);
        if (!doNotCache) this.setSessionCache(cacheKey, null);
        return null;
      } finally { pendingRequests.delete(cacheKey); }
    })();
    pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  jsonHierarchy: function (value, dotNotationProperty) {
    if (!dotNotationProperty.includes(".")) return { [dotNotationProperty]: value };
    const keys = dotNotationProperty.split(".");
    const result = {};
    let current = result;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) current[key] = value;
      else { current[key] = {}; current = current[key]; }
    });
    return result;
  },

  getPropertyByDotNotation: function (json, dotNotationProperty) {
    if (!dotNotationProperty) return null;
    if (typeof json !== "object" || json === null) return null;
    const keys = dotNotationProperty.split(".");
    let current = json;
    for (const key of keys) {
      if (current && Object.prototype.hasOwnProperty.call(current, key)) current = current[key];
      else return null;
    }
    return current;
  },

  extractVideoIdFromUrl: function (url) {
    try {
      const u = new URL(url, window.location.origin);
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.hostname.includes("i.ytimg.com")) {
        const parts = u.pathname.split("/");
        if (parts.length >= 3 && (parts[1] === "vi_lc" || parts[1] === "vi")) return parts[2];
      }
      return null;
    } catch { return null; }
  },

  getVideoTitleFromYoutubeI: async function (videoId) {
    const body = {
      context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250731.09.00" } },
      videoId,
    };
    const headers = await this.getYoutubeIHeadersWithCredentials();
    const response = await this.cachedRequest(
      `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/player?prettyPrint=false`,
      JSON.stringify(body), headers, false, "videoDetails",
    );
    const title = response?.cachedWithDotNotation?.title || response?.data?.videoDetails?.title || null;
    const author_name = response?.cachedWithDotNotation?.author || response?.data?.videoDetails?.author || null;
    const thumbnails = response?.cachedWithDotNotation?.thumbnail?.thumbnails || response?.data?.videoDetails?.thumbnail?.thumbnails || null;
    let thumbnail_url = thumbnails?.[0]?.url || null;
    const maxresdefault_url = thumbnails?.find((thumb) => thumb.url.includes("maxresdefault"))?.url || null;
    const channelId = response?.cachedWithDotNotation?.channelId || response?.data?.videoDetails?.channelId || null;
    const author_url = channelId ? `https://www.youtube.com/channel/${channelId}` : null;
    if (thumbnail_url) { const urlObj = new URL(thumbnail_url); urlObj.search = ""; thumbnail_url = urlObj.toString(); }
    if (title) return { response: response.response, data: { title, author_name, author_url, thumbnail_url, maxresdefault_url } };
    return { response: response?.response, data: null };
  },

  getSAPISID: function () {
    const match = document.cookie.match(/SAPISID=([^\s;]+)/);
    return match ? match[1] : null;
  },

  getSAPISIDHASH: async function (origin = this.isMobile() ? "https://m.youtube.com" : "https://www.youtube.com") {
    const sapisid = this.getSAPISID();
    if (!sapisid) { this.logWarning("SAPISID cookie not found."); return null; }
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp} ${sapisid} ${origin}`;
    async function sha1Hash(msg) {
      const encoder = new TextEncoder();
      const data = encoder.encode(msg);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const hash = await sha1Hash(message);
    return `SAPISIDHASH ${timestamp}_${hash}`;
  },

  getYoutubeIHeadersWithCredentials: async function (anonymously = false) {
    const sapisidhash = await this.getSAPISIDHASH();
    if (!sapisidhash || anonymously) return { "Content-Type": "application/json" };
    return {
      "Content-Type": "application/json",
      Authorization: sapisidhash,
      Origin: this.isMobile() ? "https://m.youtube.com" : "https://www.youtube.com",
      "X-Youtube-Client-Name": "1",
      "X-Youtube-Client-Version": "2.20250731.09.00",
    };
  },

  getOriginalCollaboratorsItemsWithYoutubeI: async function (search_query) {
    if (!search_query || search_query.trim() === "") return null;
    let decodedQuery;
    try { decodedQuery = decodeURIComponent(search_query); } catch { decodedQuery = search_query; }
    const body = {
      context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250527.00.00", hl: "lo" } },
      query: `${decodedQuery} ${decodedQuery}`,
    };
    const requestIdentifier = `youtubei/v1/results_${JSON.stringify(body)}`;
    const storedResponse = this.getSessionCache(requestIdentifier);
    if (storedResponse && Array.isArray(storedResponse) && storedResponse.length > 0) return storedResponse;
    const search = `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/search?prettyPrint=false`;
    const response = await this.cachedRequest(search, JSON.stringify(body), await this.getYoutubeIHeadersWithCredentials(true), true);
    if (!response?.data) { this.logWarning(`Failed to fetch ${search} or parse response`); return; }
    const result = this.extractCollaboratorsItemsFromSearch(response.data);
    if (!result) return;
    await this.setSessionCache(requestIdentifier, result);
    return result;
  },

  extractCollaboratorsItemsFromSearch: function (json) {
    const results = [];
    const sections = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || json?.contents?.sectionListRenderer?.contents || [];
    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const video = item?.videoRenderer || item?.videoWithContextRenderer;
        if (!video) continue;
        const byline = video.shortBylineText || video.longBylineText;
        const runs = byline?.runs || [];
        for (const run of runs) {
          const showDialog = run?.navigationEndpoint?.showDialogCommand || run?.navigationEndpoint?.showSheetCommand;
          if (!showDialog) continue;
          const listItems = showDialog?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems || showDialog?.panelLoadingStrategy?.inlineContent?.sheetViewModel?.content?.listViewModel?.listItems;
          if (Array.isArray(listItems)) {
            for (const listItem of listItems) {
              const view = listItem?.listItemViewModel || {};
              const name = view.title?.content || null;
              const avatarImage = view.leadingAccessory?.avatarViewModel?.image?.sources?.[0]?.url || null;
              const url = view.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || null;
              const navigationEndpointUrl = video.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
              const videoId = video.navigationEndpoint?.watchEndpoint?.videoId || this.extractVideoIdFromUrl(navigationEndpointUrl.startsWith("http") ? navigationEndpointUrl : window.location.origin + navigationEndpointUrl);
              results.push({ name, avatarImage, url, navigationEndpointUrl, videoId });
            }
          }
        }
      }
    }
    return results;
  },

  getLocalizedAnd: function (languageCode) {
    const andTranslations = {
      "af-ZA": "en", "az-AZ": "və", "id-ID": "dan", "ms-MY": "dan", "bs-BA": "i", "ca-ES": "i",
      "cs-CZ": "a", "da-DK": "og", "de-DE": "und", "et-EE": "ja", "en-IN": "and", "en-GB": "and",
      "en-US": "and", "es-ES": "y", "es-419": "y", "es-US": "y", "eu-ES": "eta", "fil-PH": "at",
      "fr-FR": "et", "fr-CA": "et", "gl-ES": "e", "hr-HR": "i", "zu-ZA": "futhi", "is-IS": "og",
      "it-IT": "e", "sw-TZ": "na", "lv-LV": "un", "lt-LT": "ir", "hu-HU": "és", "nl-NL": "en",
      "nb-NO": "og", "uz-UZ": "va", "pl-PL": "i", "pt-PT": "e", "pt-BR": "e", "ro-RO": "și",
      "sq-AL": "dhe", "sk-SK": "a", "sl-SI": "in", "sr-RS": "и", "fi-FI": "ja", "sv-SE": "och",
      "vi-VN": "và", "tr-TR": "ve", "be-BY": "і", "bg-BG": "и", "ky-KG": "жана", "kk-KZ": "және",
      "mk-MK": "и", "mn-MN": "ба", "ru-RU": "и", "sr-BA": "и", "uk-UA": "і", "el-GR": "και",
      "hy-AM": "եւ", "he-IL": "ו", "ur-PK": "اور", "ar-SA": "و", "fa-IR": "و", "ne-NP": "र",
      "mr-IN": "आणि", "hi-IN": "और", "as-IN": "আৰু", "bn-BD": "এবং", "pa-IN": "ਅਤੇ",
      "gu-IN": "અને", "or-IN": "ଏବଂ", "ta-IN": "மற்றும்", "te-IN": "మరియు", "kn-IN": "ಮತ್ತು",
      "ml-IN": "കൂടാതെ", "si-LK": "සහ", "th-TH": "และ", "lo-LA": "ແລະ", "my-MM": "နှင့်",
      "ka-GE": "და", "am-ET": "እና", "km-KH": "និង", "zh-CN": "和", "zh-TW": "和", "zh-HK": "和",
      "ja-JP": "と", "ko-KR": "그리고",
    };
    return andTranslations[languageCode] || "and";
  },

  getImageSize: async function (src) {
    if (!src) return { width: null, height: null };
    const img = new Image();
    img.src = src;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  },

  isFoundImageSrc: async function (src) {
    if (!src) return false;
    try {
      const response = await this.cachedRequest(src);
      return response?.response.ok && response?.response.status >= 200 && response?.response.status < 300;
    } catch { return false; }
  },

  isWhitelistedChannel: async function (whiteStoragePropertyName, handle = null, channelUrl = null, channelId = null, channelName = null) {
    const settings = await this.getSettings();
    const whitelist = settings?.[whiteStoragePropertyName];
    if (!whitelist) throw new Error(`Unsupported whiteListType: ${whiteStoragePropertyName}`);
    if (whitelist.length === 0) { this.logDebug(`isWhitelistedChannel: ${whiteStoragePropertyName} is empty`); return false; }
    const normalizeHandle = (value) => {
      let decodedValue = value;
      try { decodedValue = decodeURIComponent(value); } catch { decodedValue = value; }
      return this.processString(decodedValue, { normalizeSpaces: false });
    };
    const removeDiacritics = (value) => value.normalize("NFD").replace(/\p{M}/gu, "");
    const normalizedWhitelist = whitelist.map((item) => normalizeHandle(item));
    const normalizedWhitelistSet = new Set(normalizedWhitelist);
    const normalizedWhitelistNoMarksSet = new Set(normalizedWhitelist.map((item) => removeDiacritics(item)));
    const isWhitelistedHandle = (value) => {
      const normalized = normalizeHandle(value);
      return normalizedWhitelistSet.has(normalized) || normalizedWhitelistNoMarksSet.has(removeDiacritics(normalized));
    };
    if ((!handle || typeof handle !== "string" || handle.trim() === "") && (!channelId || typeof channelId !== "string" || channelId.trim() === "") && (!channelUrl || typeof channelUrl !== "string" || channelUrl.trim() === "") && (!channelName || typeof channelName !== "string" || channelName.trim() === "")) return false;
    let channelURL = null;
    if (channelUrl && typeof channelUrl === "string") {
      const url = channelUrl.startsWith("http") ? channelUrl : window.location.origin + channelUrl;
      try { channelURL = new URL(url); } catch { this.logWarning(`isWhitelistedChannel: invalid channelUrl: ${url}`); }
    }
    if (channelURL) {
      if (!channelId && channelURL.pathname.startsWith("/channel/")) { const match = channelURL.pathname.match(/\/channel\/([^/?]+)/); channelId = match ? match[1] : null; }
      else if (!handle && channelURL.pathname.startsWith("/@")) { const match = channelURL.pathname.match(/\/(@[^/?]+)/); handle = match ? match[1] : null; }
    }
    if (!handle || typeof handle !== "string" || handle.trim() === "" || !handle.trim().startsWith("@")) {
      if (handle) this.logInfo(`isWhitelistedChannel: invalid handle: ${handle}`);
      if ((!channelId || typeof channelId !== "string" || channelId.trim() === "") && (!channelName || typeof channelName !== "string" || channelName.trim() === "")) return false;
    } else { return isWhitelistedHandle(handle); }
    if (!channelId || typeof channelId !== "string" || channelId.trim() === "") {
      if (channelId) this.logInfo(`isWhitelistedChannel: invalid channelId: ${channelId}`);
      if (!channelName || typeof channelName !== "string" || channelName.trim() === "") return false;
    } else {
      const response = await this.getChannelBrandingWithYoutubeI(channelId);
      handle = response?.channelHandle || null;
    }
    if (!handle) {
      this.logInfo(`isWhitelistedChannel: could not retrieve handle for channelId: ${channelId}`);
      if (!channelName || typeof channelName !== "string" || channelName.trim() === "") return false;
    } else { return isWhitelistedHandle(handle); }
    if (!channelName || typeof channelName !== "string" || channelName.trim() === "") { this.logInfo(`isWhitelistedChannel: invalid channelName: ${channelName}`); return false; }
    else {
      if (!channelName.trim().includes(" ") && (isWhitelistedHandle(`@${channelName}`) || (channelName.startsWith("@") && isWhitelistedHandle(channelName)))) return true;
      const lookupResult = await this.lookupChannelId(channelName);
      handle = lookupResult?.channelHandle;
    }
    if (!handle) { this.logInfo(`isWhitelistedChannel: could not retrieve handle for channelName: ${channelName}`); return false; }
    else { return isWhitelistedHandle(handle); }
  },

  lookupChannelId: async function (query) {
    if (!query) return null;
    let decodedQuery;
    try { decodedQuery = decodeURIComponent(query); } catch { decodedQuery = query; }
    const body = {
      context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250527.00.00" } },
      query: `${decodedQuery} ${decodedQuery}`,
      params: "EgIQAg==",
    };
    const requestIdentifier = `youtubei/v1/search_${JSON.stringify(body)}`;
    const storedResponse = this.getSessionCache(requestIdentifier);
    if (storedResponse) return storedResponse;
    const search = `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/search?prettyPrint=false`;
    const result = await this.cachedRequest(search, JSON.stringify(body), await this.getYoutubeIHeadersWithCredentials(true), true);
    if (!result || !result.response || !result.response.ok) { this.logInfo(`Failed to fetch ${search}:`, result?.response?.statusText || "Unknown error"); return; }
    const json = result.data;
    let channelUcid, channelHandle;
    for (const sectionContent of json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || []) {
      for (const itemRenderedContent of sectionContent?.itemSectionRenderer?.contents || []) {
        if (this.isStringEqual(itemRenderedContent?.channelRenderer?.title?.simpleText, query) || this.isStringEqual(itemRenderedContent?.channelRenderer?.subscriberCountText?.simpleText, query)) {
          channelUcid = itemRenderedContent?.channelRenderer?.channelId;
          channelHandle = itemRenderedContent?.channelRenderer?.subscriberCountText?.simpleText;
          break;
        }
      }
    }
    for (const sectionContent of json.contents?.sectionListRenderer?.contents || []) {
      for (const itemRenderedContent of sectionContent?.itemSectionRenderer?.contents || []) {
        let itemMatchChannelName = false;
        for (const runs of itemRenderedContent?.compactChannelRenderer?.displayName?.runs || []) { if (this.isStringEqual(runs.text, query)) { itemMatchChannelName = true; break; } }
        let itemMatchChannelHandle = false;
        let itemMatchChannelHandleIndex = -1;
        for (const runs of itemRenderedContent?.compactChannelRenderer?.subscriberCountText?.runs || []) {
          if (this.isStringEqual(runs.text, query)) { itemMatchChannelHandle = true; itemMatchChannelHandleIndex = itemRenderedContent?.compactChannelRenderer?.subscriberCountText?.runs.indexOf(runs); break; }
        }
        if (itemMatchChannelName || itemMatchChannelHandle) {
          channelUcid = itemRenderedContent?.compactChannelRenderer?.channelId;
          channelHandle = itemRenderedContent?.compactChannelRenderer?.subscriberCountText?.runs?.[itemMatchChannelHandleIndex]?.text;
          break;
        }
      }
    }
    const response = { channelUcid, channelHandle };
    if (!response || !response.channelUcid) return;
    this.setSessionCache(requestIdentifier, response);
    return response;
  },

  getChannelUCIDFromHref: async function (href) {
    if (!href) return null;
    const channelMatch = href.match(/\/channel\/([^/?&#]+)/);
    if (channelMatch && channelMatch[1]) return channelMatch[1];
    const handleMatch = href.match(/\/(?:@|c\/|user\/)([^/?&#]+)/);
    if (handleMatch && handleMatch[1]) {
      let handle = handleMatch[1];
      if (!handle.startsWith("@")) handle = href.includes("/@") ? `@${handle}` : handle;
      const lookupResult = await this.lookupChannelId(handle);
      return lookupResult?.channelUcid;
    }
    return null;
  },

  getChannelUCID: async function () {
    if (window.location.pathname.startsWith("/channel/")) {
      const match = window.location.pathname.match(/\/channel\/([^/?]+)/);
      return match ? `${match[1]}` : null;
    }
    let handle = null;
    if (window.location.pathname.startsWith("/c/")) { const match = window.location.pathname.match(/\/c\/([^/?]+)/); handle = match ? `${match[1]}` : null; }
    else if (window.location.pathname.startsWith("/@")) { const match = window.location.pathname.match(/\/(@[^/?]+)/); handle = match ? `${match[1]}` : null; }
    else if (window.location.pathname.startsWith("/user/")) { const match = window.location.pathname.match(/\/user\/([^/?]+)/); handle = match ? `${match[1]}` : null; }
    const lookupResult = await this.lookupChannelId(handle);
    return lookupResult?.channelUcid;
  },

  getChannelBrandingWithYoutubeI: async function (ucid = null) {
    if (!ucid) ucid = await this.getChannelUCID();
    if (!ucid) { this.logInfo("could not find channel UCID"); return; }
    const body = {
      context: { client: { clientName: this.isMobile() ? "MWEB" : "WEB", clientVersion: "2.20250527.00.00", hl: "lo" } },
      browseId: ucid,
    };
    const requestIdentifier = `youtubei/v1/browse_${JSON.stringify(body)}`;
    const storedResponse = this.getSessionCache(requestIdentifier);
    if (storedResponse) return storedResponse;
    const browse = `https://${this.isMobile() ? "m" : "www"}.youtube.com/youtubei/v1/browse?prettyPrint=false`;
    const response = await this.cachedRequest(browse, JSON.stringify(body), await this.getYoutubeIHeadersWithCredentials(), true);
    if (!response?.data) { this.logWarning(`Failed to fetch ${browse} or parse response`); return; }
    const hdr = response.data.header?.pageHeaderRenderer;
    const metadata = response.data.metadata?.channelMetadataRenderer;
    const hdrMetadataRows = hdr?.content?.pageHeaderViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
    let channelHandle;
    for (const metadataRow of hdrMetadataRows || []) {
      for (const metadataPart of metadataRow?.metadataParts || []) {
        if (metadataPart?.text?.content?.startsWith("@")) { channelHandle = metadataPart?.text?.content; break; }
      }
    }
    const result = {
      title: metadata?.title,
      truncatedDescription: hdr?.content?.pageHeaderViewModel?.description?.descriptionPreviewViewModel?.description?.content,
      description: metadata?.description,
      channelHandle,
    };
    if (!metadata || !hdr) return;
    this.setSessionCache(requestIdentifier, result);
    return result;
  },

  getPlayerResponseSafely: function (playerEl) {
    let response = null;
    try { if (playerEl && playerEl["getPlayerResponse"] && typeof playerEl["getPlayerResponse"] === "function") response = playerEl["getPlayerResponse"](); } catch (err) { this?.logDebug?.("getPlayerResponse failed", err); }
    if (!response) { try { if (playerEl && playerEl["getEmbeddedPlayerResponse"] && typeof playerEl["getEmbeddedPlayerResponse"] === "function") response = playerEl["getEmbeddedPlayerResponse"](); } catch (err) { this?.logDebug?.("getEmbeddedPlayerResponse failed", err); } }
    if (!response && window["ytplayer"] && window["ytplayer"].config && window["ytplayer"].config.args && window["ytplayer"].config.args.player_response) {
      try { response = JSON.parse(window["ytplayer"].config.args.player_response); } catch (err) { this.logWarning("Failed to parse ytplayer.config.args.player_response", err); }
    }
    return response || null;
  },

  increaseVideoAttemptAttribute: function (element, attributeName, videoId) {
    const getCount = element.getAttribute(attributeName);
    const getCountNumber = parseInt(getCount ? getCount.match(new RegExp(`^${videoId}__([0-9]+)$`))?.[1] || "0" : "0");
    element.setAttribute(attributeName, `${videoId}__${getCountNumber >= this.MAX_ATTEMPTS ? this.MAX_ATTEMPTS : getCountNumber + 1}`);
  },

  __qsProfile: new Map(),
  __qsTotals: { calls: 0, totalMs: 0 },

  __formatRootLabel: function (root) {
    if (!root || root === document) return "document";
    if (root.nodeType === Node.ELEMENT_NODE) {
      const el = root;
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className && typeof el.className === "string" ? `.${el.className.split(/\s+/).slice(0, 2).join(".")}` : "";
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    }
    return String(root.nodeName || "node").toLowerCase();
  },

  __recordQueryProfile: function (method, root, selector, durationMs) {
    if (!this.QS_PROFILE_ENABLED) return;
    const rootLabel = this.__formatRootLabel(root);
    const key = `${method}|${rootLabel}|${selector}`;
    const entry = this.__qsProfile.get(key) || { key, method, root: rootLabel, selector, calls: 0, totalMs: 0, maxMs: 0, minMs: Number.POSITIVE_INFINITY };
    entry.calls += 1; entry.totalMs += durationMs;
    if (durationMs > entry.maxMs) entry.maxMs = durationMs;
    if (durationMs < entry.minMs) entry.minMs = durationMs;
    this.__qsProfile.set(key, entry);
    this.__qsTotals.calls += 1; this.__qsTotals.totalMs += durationMs;
  },

  querySelector: function (selector, root = document) {
    const context = root || document;
    if (!this.QS_PROFILE_ENABLED) return context.querySelector(selector);
    const t0 = performance.now();
    const result = context.querySelector(selector);
    this.__recordQueryProfile("qs", context, selector, performance.now() - t0);
    return result;
  },

  querySelectorAll: function (selector, root = document) {
    const context = root || document;
    if (!this.QS_PROFILE_ENABLED) return context.querySelectorAll(selector);
    const t0 = performance.now();
    const result = context.querySelectorAll(selector);
    this.__recordQueryProfile("qsa", context, selector, performance.now() - t0);
    return result;
  },

  printProfile: function ({ sortBy = "totalMs", limit = 50 } = {}) {
    if (!this.QS_PROFILE_ENABLED) { console.log("To enable query selector profiling, set QS_PROFILE_ENABLED to true"); return; }
    const rows = Array.from(this.__qsProfile.values()).map((e) => ({ method: e.method, root: e.root, selector: e.selector, calls: e.calls, totalMs: Number(e.totalMs.toFixed(2)), avgMs: Number((e.totalMs / e.calls).toFixed(2)), pctTotal: this.__qsTotals.totalMs > 0 ? Number(((e.totalMs / this.__qsTotals.totalMs) * 100).toFixed(1)) : 0 }));
    const validSorts = new Set(["totalMs", "calls", "avgMs", "maxMs"]);
    const sortKey = validSorts.has(sortBy) ? sortBy : "totalMs";
    rows.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    console.log(`${this.LOG_PREFIX} QuerySelector profile — calls=${this.__qsTotals.calls}, totalMs=${this.__qsTotals.totalMs.toFixed(2)}`);
    if (typeof console.table === "function") console.table(rows.slice(0, limit));
    else rows.slice(0, limit).forEach((r) => console.log(`${r.method} ${r.root} ${r.selector} → calls=${r.calls} totalMs=${r.totalMs} avgMs=${r.avgMs} (${r.pctTotal}%)`));
  },

  clearProfile: function () {
    this.__qsProfile.clear();
    this.__qsTotals.calls = 0;
    this.__qsTotals.totalMs = 0;
  },
};

/**
 * Initializes window.YoutubeAntiTranslate and sets the settings bridge.
 * Must be called before any other anti-translate module.
 * @param {Function} getSettingsFn - () => settings object (sync)
 */
export function initAntiTranslateCore(getSettingsFn) {
  window.__YAT_getSettings = getSettingsFn;
}


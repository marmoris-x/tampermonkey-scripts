// ==UserScript==
// @name            Marketplace Deal Finder
// @name:de         Marketplace Deal Finder
// @namespace       https://github.com/marmoris-x/tampermonkey-scripts
// @version         31.0.20
// @author          marmoris
// @description     Multi-provider AI deal aggregator for Willhaben & Kleinanzeigen. Supports Gemini, OpenAI, DeepSeek, Claude, OpenRouter & Portkey.
// @description:de  Multi-Provider KI-Deal-Aggregator für Willhaben und Kleinanzeigen. Unterstützt Gemini, OpenAI, DeepSeek, Claude, OpenRouter und Portkey.
// @license         MIT
// @icon            https://i.imgur.com/oQmtRjQ.png
// @homepageURL     https://github.com/marmoris-x/tampermonkey-scripts
// @supportURL      https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL     https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Marketplace%20Deal%20Finder.user.js
// @updateURL       https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Marketplace%20Deal%20Finder.user.js
// @match           https://www.willhaben.at/iad/kaufen-und-verkaufen/*
// @match           https://www.kleinanzeigen.de/s-*
// @match           https://www.kleinanzeigen.de/z-*
// @require         https://raw.githubusercontent.com/Tampermonkey/utils/refs/heads/main/requires/gh_2215_make_GM_xhr_more_parallel_again.js
// @sandbox         JavaScript
// @tag             search
// @connect         willhaben.at
// @connect         kleinanzeigen.de
// @connect         generativelanguage.googleapis.com
// @connect         api.openai.com
// @connect         api.deepseek.com
// @connect         api.anthropic.com
// @connect         openrouter.ai
// @connect         api.portkey.ai
// @grant           GM.getValue
// @grant           GM.setValue
// @grant           GM_addElement
// @grant           GM_xmlhttpRequest
// @run-at          document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

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
  const PROVIDER_TYPES = {
    GEMINI: "gemini",
    OPENAI: "openai",
    DEEPSEEK: "deepseek",
    CLAUDE: "claude",
    OPENROUTER: "openrouter",
    PORTKEY: "portkey"
  };
  const INITIAL_BATCH_SIZE = 8;
  const SETTINGS_VERSION = 3;
  const MAX_CACHE_SIZE = 100;
  const REQUEST_TIMEOUT = 6e4;
  const RE_RANK_MAX_DEALS = 30;
  const PAUSE_POLL_INTERVAL = 500;
  const SAME_PAGE_INCREMENT = 0;
  const NEW_PAGE_INCREMENT = 1;
  const MAX_INIT_RETRIES = 5;
  const MIN_TITLE_LENGTH = 5;
  const GEMINI_API_TIMEOUT = 6e4;
  const RATE_LIMIT_MAX_RETRIES = 5;
  const RETRY_BASE_DELAY = 2e3;
  const MAX_RATE_LIMIT_DELAY = 3e5;
  const JITTER_FACTOR = 0.2;
  const MAX_OUTPUT_TOKENS = 8192;
  const DESCRIPTION_FETCH_DELAY = 1e3;
  const DESCRIPTION_MAX_RETRIES = 1;
  const DESCRIPTION_BACKOFF_FACTOR = 2;
  const PAGE_TRANSITION_DELAY = 1500;
  const SCROLL_DELAY = 1500;
  const MODEL_PRESETS = {
    gemini: [
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", icon: "💡", desc: "Most economical, high thinking", options: { thinking_budget: -1 } },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", icon: "⚡", desc: "Latest flash, high thinking", options: { thinking_level: "high" } },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", icon: "🔥", desc: "Preview, high thinking", options: { thinking_level: "high" } },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", icon: "🧠", desc: "Max intelligence, preview" }
    ],
    openai: [
      { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", icon: "💡", desc: "Cheapest, high thinking", options: { reasoning_effort: "high" } },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", icon: "⚡", desc: "Fast & cheap" },
      { id: "gpt-5.5", label: "GPT-5.5", icon: "🧠", desc: "Flagship intelligence" }
    ],
    deepseek: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", icon: "⚡", desc: "Fast 284B, max thinking", options: { reasoning_effort: "max" } },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", icon: "🧠", desc: "1.6T params, max thinking", options: { reasoning_effort: "max" } }
    ],
    claude: [
      { id: "claude-opus-4-7", label: "Claude Opus 4.7", icon: "🧠", desc: "Latest flagship, extended thinking", options: { thinking: { type: "enabled", budget_tokens: 1e4 } } },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", icon: "🎯", desc: "Best balance, extended thinking", options: { thinking: { type: "enabled", budget_tokens: 8e3 } } },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", icon: "⚡", desc: "Fast & cheap" }
    ],
    openrouter: [
      { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", icon: "💡", desc: "Cheap via OR" },
      { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", icon: "⚡", desc: "Cheap via OR" },
      { id: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano", icon: "💡", desc: "Cheapest smart model via OR" }
    ],
    portkey: [
      { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", icon: "💡", desc: "Via Portkey config" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", icon: "⚡", desc: "Via Portkey config" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", icon: "⚡", desc: "Via Portkey config", options: { skip_response_format: true } }
    ]
  };
  function findAds$1() {
    const adSelectors = [
      'a[data-testid^="search-result-entry-header-"]',
      'article[data-testid^="search-result-entry-"]',
      '[data-testid*="search-result-entry"]'
    ];
    for (let si = 0; si < adSelectors.length; si++) {
      const entries = document.querySelectorAll(adSelectors[si]);
      if (entries.length > 0) {
        console.log("[MDF-WH] Found " + entries.length + " ads (selector: " + adSelectors[si] + ")");
        return { adEntries: entries };
      }
    }
    const uniqueUrls = new Set();
    const uniqueAds = [];
    const urlRegex = /\/iad\/kaufen-und-verkaufen\/.*\/\d+/;
    document.querySelectorAll('a[href*="/iad/kaufen-und-verkaufen/"]').forEach(function(link) {
      const url = link.href;
      if (urlRegex.test(url) && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        const container = link.closest('article, div[class*="box"], [data-testid*="search-result"], .ad-item, .list-item');
        uniqueAds.push(container || link);
      }
    });
    if (uniqueAds.length > 0) {
      console.log("[MDF-WH] Found " + uniqueAds.length + " ads (fallback method)");
      return { adEntries: uniqueAds };
    }
    return null;
  }
  function extractBasicInfo$1(ad) {
    let title = "Title not available";
    ["h3", "h2", '[data-testid*="title"]'].forEach(function(s) {
      const el = ad.querySelector(s);
      if (el) {
        const text = el.textContent.trim();
        if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText$1(text)) title = text;
      }
    });
    let price = "Price not available";
    const spans = ad.querySelectorAll("span, div, p");
    for (let pi = 0; pi < spans.length; pi++) {
      const text = spans[pi].textContent.trim();
      if ((text.indexOf("€") !== -1 || text.indexOf("EUR") !== -1) && text.length < 20 && text.indexOf("...") === -1) {
        price = text;
        break;
      }
    }
    const url = ad.href || (ad.querySelector('a[href*="/iad/"]') ? ad.querySelector('a[href*="/iad/"]').href : "URL not available");
    return { title, price, url };
  }
  function isPriceOnlyText$1(text) {
    return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
  }
  function descSelectors$1() {
    return [
      '[data-testid="ad-description-Beschreibung"]',
      '[data-testid*="description"]',
      ".ad-description",
      '[class*="description"]'
    ];
  }
  function goToNextPage$1(currentPage) {
    let nextButton = document.querySelector('[data-testid="pagination-bottom-next-button"]');
    if (!nextButton) {
      const targetPage = currentPage + 1;
      const paginationLinks = document.querySelectorAll('[data-testid*="pagination"] a, nav a');
      for (let li = 0; li < paginationLinks.length; li++) {
        const btn = paginationLinks[li];
        const text = (btn.textContent || "").trim();
        const href = btn.getAttribute("href");
        if (text && (text === String(targetPage) || text.toLowerCase().indexOf("weiter") !== -1 || text.toLowerCase().indexOf("next") !== -1 || text === "›" || text === ">")) {
          if (!btn.hasAttribute("disabled") && btn.getAttribute("aria-disabled") !== "true" && href) {
            nextButton = btn;
            break;
          }
        }
      }
    }
    if (nextButton) {
      const isDisabled = nextButton.hasAttribute("disabled");
      const ariaDisabled = nextButton.getAttribute("aria-disabled") === "true";
      const href = nextButton.getAttribute("href");
      console.log("[MDF-WH] Next button disabled:", isDisabled, "| aria-disabled:", ariaDisabled, "| href:", href);
      if (!isDisabled && !ariaDisabled && href) {
        try {
          if (new URL(href, location.href).href === location.href) {
            console.log("[MDF-WH] Next button points to same page - skipped");
            return false;
          }
        } catch (e) {
          console.warn("[MDF-WH] Invalid URL in next button:", href, e);
          return false;
        }
        return href;
      }
      console.log("[MDF-WH] Next button not usable");
    }
    return false;
  }
  const whScraper = Object.freeze( Object.defineProperty({
    __proto__: null,
    descSelectors: descSelectors$1,
    extractBasicInfo: extractBasicInfo$1,
    findAds: findAds$1,
    goToNextPage: goToNextPage$1
  }, Symbol.toStringTag, { value: "Module" }));
  function findAds() {
    const adSelectors = ["article[data-adid]", "li.ad-listitem", ".aditem"];
    for (let si = 0; si < adSelectors.length; si++) {
      const entries = document.querySelectorAll(adSelectors[si]);
      if (entries.length > 0) {
        console.log("[MDF-KA] Found " + entries.length + " ads (selector: " + adSelectors[si] + ")");
        return { adEntries: entries };
      }
    }
    const uniqueUrls = new Set();
    const uniqueAds = [];
    const urlRegex = /\/s-anzeige\/.*\/\d+/;
    document.querySelectorAll('a[href*="/s-anzeige/"]').forEach(function(link) {
      const url = link.href;
      if (urlRegex.test(url) && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        const container = link.closest("article, li, .aditem, .ad-listitem, [data-adid]");
        uniqueAds.push(container || link);
      }
    });
    if (uniqueAds.length > 0) {
      console.log("[MDF-KA] Found " + uniqueAds.length + " ads (fallback method)");
      return { adEntries: uniqueAds };
    }
    return null;
  }
  function extractBasicInfo(ad) {
    let title = "Title not available";
    ["h2", "h3", 'a[class*="ellipsis"]', '[class*="title"]'].forEach(function(s) {
      const el = ad.querySelector(s);
      if (el) {
        const text = el.textContent.trim();
        if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) title = text;
      }
    });
    let price = "Price not available";
    const spans = ad.querySelectorAll("span, div, p, strong");
    for (let pi = 0; pi < spans.length; pi++) {
      const text = spans[pi].textContent.trim();
      if ((text.indexOf("€") !== -1 || text.indexOf("EUR") !== -1 || /^(\d[\d.,]*\s*€?\s*)?VB$/i.test(text.trim())) && text.length < 30 && text.indexOf("...") === -1) {
        price = text;
        break;
      }
    }
    let url = ad.getAttribute("data-href") || ad.href || (ad.querySelector('a[href*="/s-anzeige/"]') ? ad.querySelector('a[href*="/s-anzeige/"]').href : "URL not available");
    if (url && url.indexOf("/") === 0) {
      url = "https://www.kleinanzeigen.de" + url;
    }
    return { title, price, url };
  }
  function isPriceOnlyText(text) {
    return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
  }
  function descSelectors() {
    return [
      "#viewad-description-text",
      ".ad-description",
      'div[class*="description"]',
      '[class*="description"]'
    ];
  }
  function goToNextPage(currentPage) {
    let nextButton = document.querySelector('a[class*="pagination-next"]');
    if (!nextButton) {
      const paginationLinks = document.querySelectorAll('[class*="pagination"] a, nav a, .pagination a');
      for (let li = 0; li < paginationLinks.length; li++) {
        const linkEl = paginationLinks[li];
        const text = (linkEl.textContent || "").trim().toLowerCase();
        const href = linkEl.getAttribute("href");
        if ((text === "weiter" || text === ">" || text === "›") && href && href.indexOf("seite:") !== -1) {
          nextButton = linkEl;
          break;
        }
      }
    }
    if (!nextButton) {
      const targetPage = currentPage + 1;
      const seiteLinks = document.querySelectorAll('a[href*="seite:"]');
      for (let sl = 0; sl < seiteLinks.length; sl++) {
        const href = seiteLinks[sl].getAttribute("href");
        if (href && href.indexOf("seite:" + targetPage) !== -1) {
          nextButton = seiteLinks[sl];
          break;
        }
      }
    }
    if (nextButton) {
      const href = nextButton.getAttribute("href");
      console.log("[MDF-KA] Next button href:", href);
      if (href) {
        try {
          if (new URL(href, location.href).href === location.href) {
            console.log("[MDF-KA] Next button points to same page - skipped");
            return false;
          }
        } catch (e) {
          console.warn("[MDF-KA] Invalid URL in next button:", href, e);
          return false;
        }
        return href;
      }
      console.log("[MDF-KA] Next button has no href");
    }
    return false;
  }
  const kaScraper = Object.freeze( Object.defineProperty({
    __proto__: null,
    descSelectors,
    extractBasicInfo,
    findAds,
    goToNextPage
  }, Symbol.toStringTag, { value: "Module" }));
  function getScraper() {
    const isWH = window.location.hostname.includes("willhaben.at");
    return {
      ...isWH ? whScraper : kaScraper,
      siteName: isWH ? "WILLHABEN" : "KLEINANZEIGEN",
      storagePrefix: isWH ? "wh" : "ka",
      buttonGradient: isWH ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "linear-gradient(135deg, #86a542 0%, #2d2d2d 100%)"
    };
  }
  async function loadSetting(key, defaultValue) {
    try {
      const raw = await GM.getValue(key);
      if (raw === void 0 || raw === null) return defaultValue;
      return raw;
    } catch (e) {
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    try {
      await GM.setValue(key, value);
    } catch (e) {
      console.error("[MDF] Failed to save setting:", key, e.message || e);
    }
  }
  async function saveCrawlState(state, storagePrefix) {
    await saveSetting(storagePrefix + "_dealfinder_crawl_state", JSON.stringify(state));
  }
  async function loadCrawlState(storagePrefix) {
    const saved = await loadSetting(storagePrefix + "_dealfinder_crawl_state", null);
    if (!saved) return null;
    try {
      return typeof saved === "string" ? JSON.parse(saved) : saved;
    } catch (e) {
      await saveSetting(storagePrefix + "_dealfinder_crawl_state", null);
      return null;
    }
  }
  async function clearCrawlState(storagePrefix) {
    await saveSetting(storagePrefix + "_dealfinder_crawl_state", null);
  }
  async function saveResults(results, storagePrefix) {
    await saveSetting(storagePrefix + "_dealfinder_results", JSON.stringify(results));
  }
  async function loadResults(storagePrefix) {
    const saved = await loadSetting(storagePrefix + "_dealfinder_results", null);
    if (!saved) return null;
    try {
      return typeof saved === "string" ? JSON.parse(saved) : saved;
    } catch (e) {
      await saveSetting(storagePrefix + "_dealfinder_results", null);
      return null;
    }
  }
  function deepCopySettings(settings) {
    if (!settings) return settings;
    const copy = { ...settings };
    if (copy.provider) {
      copy.provider = { ...copy.provider };
      if (copy.provider.options) copy.provider.options = { ...copy.provider.options };
    }
    if (copy.providers) {
      copy.providers = { ...copy.providers };
      Object.keys(copy.providers).forEach(function(k) {
        copy.providers[k] = { ...copy.providers[k] };
        if (copy.providers[k].options) copy.providers[k].options = { ...copy.providers[k].options };
      });
    }
    return copy;
  }
  const DEFAULT_SETTINGS = {
    version: SETTINGS_VERSION,
currentProvider: PROVIDER_TYPES.GEMINI,
    providers: {
      gemini: { type: "gemini", apiKey: "", modelId: "gemini-2.5-flash-lite", baseUrl: "", options: {} },
      openai: { type: "openai", apiKey: "", modelId: "gpt-5.4-nano", baseUrl: "", options: {} },
      deepseek: { type: "deepseek", apiKey: "", modelId: "deepseek-v4-flash", baseUrl: "", options: {} },
      claude: { type: "claude", apiKey: "", modelId: "claude-sonnet-4-6", baseUrl: "", options: {} },
      openrouter: { type: "openrouter", apiKey: "", modelId: "google/gemini-3.1-flash-lite", baseUrl: "", options: {} },
      portkey: { type: "portkey", apiKey: "", modelId: "gpt-5.4-nano", baseUrl: "", options: {} }
    },
    searchContext: "",
    topX: 3,
    maxPages: 10
  };
  function isV1Settings(settings) {
    if (!settings || typeof settings !== "object") return false;
    return settings.version === 1 || typeof settings.apiKey === "string" && !settings.provider && !settings.providers;
  }
  function isV2Settings(settings) {
    if (!settings || typeof settings !== "object") return false;
    return settings.version === 2 || settings.provider && !settings.providers;
  }
  function migrateV1toV2(v1) {
    const modelMap = v1.modelMapping || {};
    const modelKey = v1.model || "flash";
    const modelId = modelMap[modelKey] || "gemini-2.5-flash";
    return {
      version: 2,
      provider: {
        type: PROVIDER_TYPES.GEMINI,
        apiKey: v1.apiKey || "",
        modelId,
        baseUrl: "",
        options: {}
      },
      searchContext: v1.searchContext || "",
      topX: v1.topX ?? 3,
      maxPages: v1.maxPages ?? 10
    };
  }
  function migrateV2toV3(v2) {
    const type = v2.provider ? v2.provider.type : PROVIDER_TYPES.GEMINI;
    const v3 = {
      version: SETTINGS_VERSION,
      currentProvider: type,
      providers: {
        gemini: { type: "gemini", apiKey: "", modelId: "gemini-2.5-flash-lite", baseUrl: "", options: {} },
        openai: { type: "openai", apiKey: "", modelId: "gpt-5.4-nano", baseUrl: "", options: {} },
        deepseek: { type: "deepseek", apiKey: "", modelId: "deepseek-v4-flash", baseUrl: "", options: {} },
        claude: { type: "claude", apiKey: "", modelId: "claude-sonnet-4-6", baseUrl: "", options: {} },
        openrouter: { type: "openrouter", apiKey: "", modelId: "google/gemini-3.1-flash-lite", baseUrl: "", options: {} },
        portkey: { type: "portkey", apiKey: "", modelId: "gpt-5.4-nano", baseUrl: "", options: {} }
      },
      searchContext: v2.searchContext || "",
      topX: v2.topX ?? 3,
      maxPages: v2.maxPages ?? 10
    };
    if (v2.provider) {
      const p = v2.provider;
      if (v3.providers[p.type]) {
        v3.providers[p.type] = { ...p };
      }
    }
    return v3;
  }
  async function loadSettings(storagePrefix, cachedSettings) {
    if (cachedSettings != null) {
      const copy = deepCopySettings(cachedSettings);
      if (copy.providers && copy.currentProvider) {
        copy.provider = copy.providers[copy.currentProvider] || {};
      }
      return { settings: copy, cachedSettings };
    }
    const raw = await loadSetting(storagePrefix + "_dealfinder_settings", null);
    if (!raw) {
      const defaults = deepCopySettings(DEFAULT_SETTINGS);
      if (defaults.providers && defaults.currentProvider) {
        defaults.provider = defaults.providers[defaults.currentProvider] || {};
      }
      return { settings: deepCopySettings(defaults), cachedSettings: defaults };
    }
    try {
      let parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const needsMigration = isV1Settings(parsed) || isV2Settings(parsed);
      if (isV1Settings(parsed)) parsed = migrateV1toV2(parsed);
      if (isV2Settings(parsed)) parsed = migrateV2toV3(parsed);
      const merged = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        providers: { ...DEFAULT_SETTINGS.providers, ...parsed.providers || {} }
      };
      if (needsMigration) {
        const toStore = { ...merged };
        delete toStore.provider;
        await saveSetting(storagePrefix + "_dealfinder_settings", JSON.stringify(toStore));
      }
      const cs = deepCopySettings(merged);
      cs.provider = cs.providers[cs.currentProvider] || {};
      const copy = deepCopySettings(cs);
      copy.provider = copy.providers[copy.currentProvider] || {};
      return { settings: copy, cachedSettings: cs };
    } catch (e) {
      console.warn("[MDF] Corrupted settings storage, resetting to defaults");
      await saveSetting(storagePrefix + "_dealfinder_settings", null);
      const defs = deepCopySettings(DEFAULT_SETTINGS);
      defs.provider = defs.providers[defs.currentProvider] || {};
      return { settings: deepCopySettings(defs), cachedSettings: defs };
    }
  }
  async function saveSettings(storagePrefix, settings) {
    const toStore = { ...settings };
    if (toStore.provider && toStore.currentProvider && toStore.providers) {
      toStore.providers[toStore.currentProvider] = { ...toStore.provider };
    }
    delete toStore.provider;
    await saveSetting(storagePrefix + "_dealfinder_settings", JSON.stringify(toStore));
  }
  const S = {
    isRunning: false,
    isPaused: false,
    shouldStop: false,
    captchaPaused: false,
    allTopDeals: [],
    currentPage: 1,
    initRetries: 0,
    descriptionCache: new Map(),
    cachedSettings: null,
    scraper: null,
    abortController: null
  };
  function setRunning(val) {
    S.isRunning = val;
  }
  function setCachedSettings(val) {
    S.cachedSettings = val;
  }
  function setScraper(val) {
    S.scraper = val;
  }
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 1e4;
    root = root || document.body;
    return new Promise(function(resolve, reject) {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      let timer;
      const observer = new MutationObserver(function() {
        const found = root.querySelector(selector);
        if (found) {
          cleanup();
          resolve(found);
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
  function createToast(message, opts) {
    opts = opts || {};
    const duration = opts.duration || 3e3;
    const type = opts.type || "info";
    const colors = { info: "#2196F3", success: "#4CAF50", error: "#F44336", warn: "#FF9800" };
    const toast = document.createElement("div");
    const root = toast.attachShadow({ mode: "closed" });
    const toastStyle = document.createElement("style");
    toastStyle.textContent = [
      ":host { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:2147483647;",
      "background:" + (colors[type] || colors.info) + "; color:#fff; padding:10px 20px; border-radius:6px;",
      "font:13px/1.4 system-ui,sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.3);",
      "opacity:0; transition:opacity 0.3s ease; pointer-events:none; max-width:80vw; }",
      ":host(.show) { opacity:1; }"
    ].join("");
    root.appendChild(toastStyle);
    const span = document.createElement("span");
    span.textContent = message;
    root.appendChild(span);
    document.body.appendChild(toast);
    requestAnimationFrame(function() {
      toast.classList.add("show");
    });
    setTimeout(function() {
      toast.classList.remove("show");
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
    return toast;
  }
  function esc(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function renderSettingsView(prefix, settings, savedResults, siteName) {
    const provider = settings.provider || {};
    const providerType = provider.type || PROVIDER_TYPES.GEMINI;
    let displayContext = settings.searchContext || "";
    if (!displayContext) {
      const urlParams = new URLSearchParams(window.location.search);
      const keyword = urlParams.get("keyword");
      if (keyword) {
        displayContext = keyword;
      } else if (siteName === "KLEINANZEIGEN") {
        const pathMatch = window.location.pathname.match(/\/s-([^/]+)/);
        if (pathMatch) displayContext = decodeURIComponent(pathMatch[1].replace(/-/g, " "));
      }
    }
    let savedTs = "";
    if (savedResults && savedResults.timestamp) {
      const ts = savedResults.timestamp;
      savedTs = ts.indexOf("T") !== -1 ? new Date(ts).toLocaleString("de-DE") : ts;
    }
    const providerOptions = Object.values(PROVIDER_TYPES).map(function(type) {
      const labels = {
        gemini: "Google Gemini",
        openai: "OpenAI",
        deepseek: "DeepSeek",
        claude: "Anthropic Claude",
        openrouter: "OpenRouter",
        portkey: "Portkey"
      };
      const selected = type === providerType ? " selected" : "";
      return '<option value="' + type + '"' + selected + ">" + (labels[type] || type) + "</option>";
    }).join("\n");
    const presets = MODEL_PRESETS[providerType] || [];
    const presetButtons = presets.map(function(preset) {
      const active = preset.id === provider.modelId ? " background:#6366f1; color:#fff; border-color:#6366f1;" : "";
      const optionsJson = preset.options ? esc(JSON.stringify(preset.options)) : "";
      return '<button data-model-id="' + esc(preset.id) + '" data-options="' + optionsJson + '" class="' + prefix + '-model-preset" style="padding:4px 8px;font-size:11px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#f8f9fa;color:#333;' + active + '">' + esc(preset.icon) + " " + esc(preset.label) + "</button>";
    }).join("");
    return [
      '<div id="' + prefix + '-settings-view" style="padding: 25px;">',
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">',
      '<h2 style="margin: 0; color: #333; font-size: 20px;">Deal Finder</h2>',
      '<button id="' + prefix + '-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">x</button>',
      "</div>",
savedResults ? '<div style="background: #e8f5e9; padding: 12px; border-radius: 4px; margin-bottom: 18px; border-left: 3px solid #4caf50;"><div style="font-size: 13px; color: #2e7d32; font-weight: 600; margin-bottom: 6px;">' + savedResults.deals.length + ' gespeicherte Deals</div><div style="font-size: 11px; color: #558b2f;">Analysierte Seiten: ' + savedResults.pages + " | " + savedTs + '</div><button id="' + prefix + '-show-results-btn" style="width:100%;margin-top:8px;padding:8px;background:#4caf50;color:white;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">Ergebnisse anzeigen</button></div>' : "",
'<div style="margin-bottom: 16px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Provider</label>',
      '<select id="' + prefix + '-provider-select" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;background:white;">',
      providerOptions,
      "</select>",
      "</div>",
'<div style="margin-bottom: 16px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Provider API Key</label>',
      '<input type="password" id="' + prefix + '-api-key" placeholder="API Key..." value="' + esc(provider.apiKey) + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
      "</div>",
providerType === PROVIDER_TYPES.PORTKEY ? '<div id="' + prefix + '-portkey-config-container" style="margin-bottom: 16px;"><label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Portkey Config</label><input type="text" id="' + prefix + '-portkey-config" placeholder="z.B. pc-gemini-6910ed" value="' + esc(provider.options && provider.options.config || "") + '" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;font-family:monospace;"><small style="color:#888;font-size:11px;">Config-ID aus dem Portkey-Dashboard (pc-...)</small></div>' : "",
'<div style="margin-bottom: 16px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Model ID</label>',
      '<input type="text" id="' + prefix + '-model-id" placeholder="z.B. gemini-2.5-flash" value="' + esc(provider.modelId) + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;font-family:monospace;">',
      presetButtons ? '<div id="' + prefix + '-model-presets" style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">' + presetButtons + "</div>" : "",
      "</div>",
'<div style="margin-bottom: 16px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Base URL (optional)</label>',
      '<input type="text" id="' + prefix + '-base-url" placeholder="https://api.openai.com/v1" value="' + esc(provider.baseUrl || "") + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;font-family:monospace;">',
      "</div>",
'<div style="margin-bottom: 16px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Suchkontext</label>',
      '<textarea id="' + prefix + '-search-context" placeholder="z.B. Gaming PC RTX 3060, Neupreis 800-1000 EUR"',
      ' style="width:100%;height:70px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit;">' + esc(displayContext) + "</textarea>",
      "</div>",
'<div style="margin-bottom: 16px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">AI-Picks pro Seite</label>',
      '<input type="number" id="' + prefix + '-top-x" min="1" max="10" value="' + (settings.topX ?? 3) + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
      '<small style="color:#888;font-size:11px;">Anzahl der besten Deals, die die AI pro Seite auswaehlt (1-10)</small>',
      "</div>",
'<div style="margin-bottom: 16px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Max. Seiten</label>',
      '<input type="number" id="' + prefix + '-max-pages" min="1" max="100" value="' + (settings.maxPages || 10) + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
      "</div>",
'<div id="' + prefix + '-progress-container" style="display:none;margin-bottom:18px;padding:12px;background:#f8f9fa;border-radius:4px;border-left:3px solid #667eea;">',
      '<div id="' + prefix + '-progress-text" style="font-weight:600;color:#333;margin-bottom:8px;font-size:12px;">Bereit...</div>',
      '<div style="background:#e0e0e0;border-radius:4px;height:6px;overflow:hidden;">',
      '<div id="' + prefix + '-progress-bar" style="background:#667eea;height:100%;width:0%;transition:width 0.3s;"></div>',
      "</div></div>",
'<div id="' + prefix + '-live-ranking" style="display:none;margin-bottom:18px;padding:12px;background:#fff8e1;border-radius:4px;border-left:3px solid #ffc107;">',
      '<h3 style="margin:0 0 10px 0;font-size:14px;color:#333;">Live Top-Deals</h3>',
      '<div id="' + prefix + '-live-ranking-content" style="font-size:12px;color:#555;"></div>',
      "</div>",
'<div style="display:flex;gap:8px;flex-wrap:wrap;">',
      '<button id="' + prefix + '-start-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#28a745;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">Start</button>',
      '<button id="' + prefix + '-pause-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#ffc107;color:#333;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">Pause</button>',
      '<button id="' + prefix + '-stop-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">Stopp</button>',
      "</div></div>"
    ].join("\n");
  }
  function renderResultsView(prefix, deals) {
    const sortedDeals = (deals || []).slice().sort(function(a, b) {
      return (b && b.score || 0) - (a && a.score || 0);
    });
    const items = sortedDeals.map(function(deal, index) {
      const safeUrl = deal.url && deal.url.startsWith("https://") ? deal.url : "#";
      const safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
      const scoreBar = safeScore !== null ? '<div style="margin-bottom:6px;"><div style="font-size:10px;color:#888;margin-bottom:2px;">Score: ' + safeScore + '/100</div><div style="background:#e0e0e0;border-radius:4px;height:4px;overflow:hidden;"><div style="background:' + (safeScore >= 70 ? "#28a745" : safeScore >= 40 ? "#ffc107" : "#dc3545") + ";height:100%;width:" + safeScore + '%;"></div></div></div>' : "";
      const medal = index === 0 ? "#1" : index === 1 ? "#2" : index === 2 ? "#3" : "#" + (index + 1);
      const borderColor = index === 0 ? "#ffc107" : index === 1 ? "#28a745" : index === 2 ? "#17a2b8" : "#6c757d";
      const bgColor = index === 0 ? "#fff8e1" : "#f8f9fa";
      return [
        '<div style="padding:15px;background:' + bgColor + ";border-radius:4px;margin-bottom:12px;border-left:3px solid " + borderColor + ';">',
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">',
        '<div style="font-weight:700;color:#333;font-size:14px;">' + medal + " " + esc(deal.title) + "</div>",
        '<div style="font-size:11px;color:#888;white-space:nowrap;margin-left:8px;">S.' + deal.page + "</div>",
        "</div>",
        '<div style="font-weight:600;color:#28a745;font-size:15px;margin-bottom:8px;">' + esc(deal.price) + "</div>",
        scoreBar,
        '<div style="font-size:11px;color:#666;margin-bottom:8px;font-style:italic;">' + esc(deal.reasoning || "Keine Begruendung verfuegbar") + "</div>",
        deal.description ? '<div style="font-size:11px;color:#555;line-height:1.4;margin-bottom:8px;max-height:60px;overflow:hidden;">' + esc(deal.description.substring(0, 150)) + (deal.description.length > 150 ? "..." : "") + "</div>" : "",
        '<a href="' + esc(safeUrl) + '" target="_blank" style="font-size:11px;color:#667eea;text-decoration:none;">Anzeige oeffnen</a>',
        "</div>"
      ].join("\n");
    }).join("\n");
    return [
      '<div id="' + prefix + '-results-view" style="padding: 25px;">',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">',
      '<h2 style="margin:0;color:#333;font-size:20px;">Top-Deals</h2>',
      '<button id="' + prefix + '-close-btn-x" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;padding:0;line-height:1;">x</button>',
      "</div>",
      '<div style="background:#667eea;color:white;padding:12px;border-radius:4px;margin-bottom:20px;text-align:center;">',
      '<div style="font-size:24px;font-weight:700;margin-bottom:4px;">' + deals.length + "</div>",
      '<div style="font-size:12px;">Top-Deals gefunden</div>',
      "</div>",
      '<div style="margin-bottom:15px;">' + items + "</div>",
      '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">',
      '<button id="' + prefix + '-export-markdown-btn" style="flex:1;padding:10px 12px;background:#28a745;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">Markdown</button>',
      '<button id="' + prefix + '-export-json-btn" style="flex:1;padding:10px 12px;background:#17a2b8;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">JSON</button>',
      '<button id="' + prefix + '-export-csv-btn" style="flex:1;padding:10px 12px;background:#6f42c1;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">CSV</button>',
      '<button id="' + prefix + '-clear-results-btn" style="padding:10px 12px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">Loeschen</button>',
      "</div>",
      '<button id="' + prefix + '-back-to-settings" style="width:100%;padding:10px 16px;background:#6c757d;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">Zurueck zu Einstellungen</button>',
      "</div>"
    ].join("\n");
  }
  const SIDEBAR_WIDTH = "400px";
  function createModal(prefix) {
    const modalId = prefix + "-dealfinder-modal";
    if (document.getElementById(modalId)) return;
    const modal = document.createElement("div");
    modal.id = modalId;
    modal.style.cssText = [
      "display: none; position: fixed; top: 0; right: 0; width: 400px; height: 100vh;",
      "background: white; z-index: 999999; box-shadow: -5px 0 20px rgba(0,0,0,0.2);",
      "overflow-y: auto; transition: transform 0.3s ease;"
    ].join(" ");
    document.body.appendChild(modal);
  }
  function openModal(prefix) {
    const modal = document.getElementById(prefix + "-dealfinder-modal");
    const floatBtn = document.getElementById(prefix + "-dealfinder-btn");
    if (modal) modal.style.display = "block";
    if (floatBtn) floatBtn.style.display = "none";
    document.documentElement.style.transition = "margin-right 0.3s ease";
    document.documentElement.style.marginRight = SIDEBAR_WIDTH;
  }
  function closeModal(prefix, isRunning) {
    if (isRunning) {
      const btn = document.getElementById(prefix + "-close-btn-x");
      if (btn) {
        btn.style.color = "#dc3545";
        btn.title = "Crawl laeuft - erst stoppen";
        setTimeout(function() {
          btn.style.color = "#999";
          btn.title = "";
        }, 1e3);
      }
      return;
    }
    const modal = document.getElementById(prefix + "-dealfinder-modal");
    const floatBtn = document.getElementById(prefix + "-dealfinder-btn");
    if (modal) modal.style.display = "none";
    if (floatBtn) floatBtn.style.display = "block";
    document.documentElement.style.marginRight = "";
  }
  function createDealFinderButton(prefix, gradient) {
    const buttonId = prefix + "-dealfinder-btn";
    if (document.getElementById(buttonId)) return;
    const button = document.createElement("button");
    button.id = buttonId;
    button.textContent = "Deal Finder";
    button.style.cssText = [
      "position: fixed; top: 140px; right: 0; z-index: 99999;",
      "padding: 12px 16px; background: " + gradient + ";",
      "color: white; border: none; border-radius: 8px 0 0 8px; cursor: pointer;",
      "box-shadow: -3px 3px 12px rgba(0,0,0,0.25); font-size: 15px; font-weight: bold;",
      "transition: padding-right 0.2s ease, box-shadow 0.2s ease;"
    ].join(" ");
    button.addEventListener("mouseenter", function() {
      button.style.paddingRight = "22px";
      button.style.boxShadow = "-5px 4px 18px rgba(0,0,0,0.35)";
    });
    button.addEventListener("mouseleave", function() {
      button.style.paddingRight = "16px";
      button.style.boxShadow = "-3px 3px 12px rgba(0,0,0,0.25)";
    });
    document.body.appendChild(button);
    return button;
  }
  function switchToResultsView(prefix, deals) {
    const modal = document.getElementById(prefix + "-dealfinder-modal");
    if (!modal) return;
    modal.innerHTML = renderResultsView(prefix, deals || []);
  }
  class AIProvider {
constructor(config) {
      if (new.target === AIProvider) {
        throw new TypeError("AIProvider is abstract — must extend it");
      }
      this.config = config;
    }
getEndpoint() {
      throw new Error("Not implemented: getEndpoint() must be overridden");
    }
getAuthHeaders() {
      throw new Error("Not implemented: getAuthHeaders() must be overridden");
    }
buildRequest(prompt, options = {}) {
      throw new Error("Not implemented: buildRequest() must be overridden");
    }
parseResponse(response) {
      throw new Error("Not implemented: parseResponse() must be overridden");
    }
isRateLimitError(status) {
      return status === 429 || status === 503;
    }
isAuthError(status) {
      return status === 401 || status === 403;
    }
getRetryDelay(retryCount) {
      return 2e3 * Math.pow(2, retryCount);
    }
  }
  const registry = new Map();
  function registerProvider(type, providerClass) {
    if (!(providerClass.prototype instanceof AIProvider)) {
      throw new TypeError("providerClass must extend AIProvider");
    }
    registry.set(type, providerClass);
  }
  function createProvider(type, config) {
    const ProviderClass = registry.get(type);
    if (!ProviderClass) {
      throw new Error(`Unknown provider type: "${type}". Available: ${Array.from(registry.keys()).join(", ")}`);
    }
    return new ProviderClass(config);
  }
  function getTimeoutForProvider(providerType) {
    return providerType === PROVIDER_TYPES.GEMINI ? GEMINI_API_TIMEOUT : REQUEST_TIMEOUT;
  }
  function gmRequest(params, signal) {
    return new Promise((resolve, reject) => {
      if (signal == null ? void 0 : signal.aborted) {
        return reject(new DOMException("Aborted", "AbortError"));
      }
      const details = {
        ...params,
        onload(resp) {
          resolve({ status: resp.status, responseText: resp.responseText, responseHeaders: resp.responseHeaders });
        },
        onerror(err) {
          reject(new Error(`GM_xmlhttpRequest failed: ${(err == null ? void 0 : err.finalUrl) || (err == null ? void 0 : err.status) || "network error"}`));
        },
        ontimeout() {
          reject(new Error(`GM_xmlhttpRequest timed out after ${params.timeout || REQUEST_TIMEOUT}ms`));
        }
      };
      const abortHandler = () => {
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal) {
        signal.addEventListener("abort", abortHandler, { once: true });
      }
      try {
        GM_xmlhttpRequest(details);
      } catch (err) {
        reject(new Error(`GM_xmlhttpRequest threw: ${err.message}`));
      }
    });
  }
  function buildRequestBody(provider, prompt, userOptions = {}) {
    return provider.buildRequest(prompt, userOptions);
  }
  function calculateBackoff(retryCount, baseDelay = RETRY_BASE_DELAY) {
    const exponential = baseDelay * Math.pow(2, retryCount);
    const capped = Math.min(exponential, MAX_RATE_LIMIT_DELAY);
    const jitter = capped * JITTER_FACTOR * (Math.random() * 2 - 1);
    return Math.round(capped + jitter);
  }
  function cleanAIJson(text) {
    let cleaned = (text || "").trim();
    if (!cleaned) return cleaned;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      cleaned = cleaned.trim();
    }
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace === -1) return cleaned;
    let depth = 0, inString = false, escaped = false, matchEnd = -1;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          matchEnd = i + 1;
          break;
        }
      }
    }
    if (matchEnd > 0) cleaned = cleaned.substring(firstBrace, matchEnd);
    cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
    return cleaned;
  }
  async function callAI(prompt, settings, options = {}) {
    var _a, _b;
    const provider = createProvider(settings.providerType, {
      type: settings.providerType,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
      baseUrl: settings.baseUrl,
      providerOptions: settings.providerOptions
    });
    const endpoint = provider.getEndpoint();
    const headers = provider.getAuthHeaders();
    const body = buildRequestBody(provider, prompt, options);
    const timeout = getTimeoutForProvider(settings.providerType);
    let lastError = null;
    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
      if ((_a = options.signal) == null ? void 0 : _a.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const resp = await gmRequest({
          method: "POST",
          url: endpoint,
          headers,
          data: JSON.stringify(body),
          timeout
        }, options.signal);
        if (provider.isAuthError(resp.status)) {
          throw new Error(`Auth error (${resp.status}): API key rejected for ${settings.providerType}`);
        }
        if (provider.isRateLimitError(resp.status)) {
          lastError = new Error(`Rate limited (${resp.status})`);
          if (attempt < RATE_LIMIT_MAX_RETRIES) {
            const delay = calculateBackoff(attempt);
            if (options.onRetry) {
              options.onRetry(attempt + 1, lastError);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw lastError;
        }
        if (resp.status < 200 || resp.status >= 300) {
          throw new Error(`API returned status ${resp.status}: ${(_b = resp.responseText) == null ? void 0 : _b.slice(0, 200)}`);
        }
        let parsed;
        try {
          parsed = JSON.parse(resp.responseText);
        } catch (parseErr) {
          throw new Error(`Failed to parse API response as JSON: ${parseErr.message}`);
        }
        let text;
        try {
          text = provider.parseResponse(parsed);
        } catch (parseErr) {
          throw new Error(`Provider parse error: ${parseErr.message}`);
        }
        if (!text || text.trim().length === 0) {
          throw new Error("Provider returned empty text content");
        }
        let result;
        try {
          result = JSON.parse(text);
        } catch (parseErr) {
          try {
            const repaired = cleanAIJson(text);
            result = JSON.parse(repaired);
          } catch (repairErr) {
            console.warn("[MDF] Raw AI output (first 500 chars):", (text || "").substring(0, 500));
            throw new Error(`Failed to parse provider output as JSON: ${parseErr.message} | Repair error: ${repairErr.message}`);
          }
        }
        if (!result.topDeals || !Array.isArray(result.topDeals)) {
          throw new Error("Provider response missing topDeals array");
        }
        return { topDeals: result.topDeals };
      } catch (err) {
        if (err.name === "AbortError") throw err;
        lastError = err;
        if (attempt < RATE_LIMIT_MAX_RETRIES && !provider.isRateLimitError(err.status || 0)) {
          const message = err.message || "";
          const isRetryable = /timed out|network error|failed to parse (?:api response|provider output)/i.test(message);
          if (isRetryable) {
            const delay = calculateBackoff(attempt);
            if (options.onRetry) {
              options.onRetry(attempt + 1, err);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw lastError;
        }
      }
    }
    throw lastError || new Error(`callAI failed after ${RATE_LIMIT_MAX_RETRIES + 1} attempts`);
  }
  function getValidScore(score) {
    const num = Number(score);
    return Number.isFinite(num) ? num : null;
  }
  function isValidScore(score) {
    return getValidScore(score) !== null;
  }
  function normalizeUrl(url) {
    if (!url) return url;
    return url.split("#")[0];
  }
  function deduplicateDeals(deals) {
    const seen = new Map();
    for (let i = 0; i < deals.length; i++) {
      const d = deals[i];
      const key = normalizeUrl(d.url) || d.url;
      if (!seen.has(key)) seen.set(key, d);
    }
    return Array.from(seen.values());
  }
  function sortDealsByScore(deals) {
    return deals.slice().sort(function(a, b) {
      return (getValidScore(b.score) ?? 0) - (getValidScore(a.score) ?? 0);
    });
  }
  function computePriceStats(adsData) {
    const prices = [];
    for (let ai = 0; ai < adsData.length; ai++) {
      const ad = adsData[ai];
      const match = (ad.price || "").replace(/\./g, "").replace(/,/g, ".").match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const p = parseFloat(match[1]);
        if (p > 0) prices.push(p);
      }
    }
    if (prices.length === 0) return null;
    const sorted = prices.slice().sort(function(a, b) {
      return a - b;
    });
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    let sum = 0;
    for (let si = 0; si < prices.length; si++) sum += prices[si];
    const mean = sum / prices.length;
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(mean),
      median: Math.round(median),
      count: prices.length
    };
  }
  function updateProgress(prefix, text, percentage, type) {
    type = type || "info";
    const container = document.getElementById(prefix + "-progress-container");
    const progressText = document.getElementById(prefix + "-progress-text");
    const progressBar = document.getElementById(prefix + "-progress-bar");
    const borderColor = type === "error" ? "#dc3545" : type === "warning" ? "#ffc107" : type === "success" ? "#28a745" : "#667eea";
    const textColor = type === "error" ? "#dc3545" : type === "warning" ? "#ffc107" : type === "success" ? "#28a745" : "#333";
    const barColor = type === "error" ? "#dc3545" : type === "warning" ? "#ffc107" : type === "success" ? "#28a745" : "#007bff";
    if (container) {
      container.style.display = "block";
      container.style.borderLeftColor = borderColor;
    }
    if (progressText) {
      progressText.textContent = text;
      progressText.style.color = textColor;
    }
    if (progressBar) {
      progressBar.style.width = percentage + "%";
      progressBar.style.backgroundColor = barColor;
      progressBar.style.transition = "width 0.3s ease, background-color 0.3s ease";
    }
  }
  function showWarning(prefix, message, percentage) {
    updateProgress(prefix, "Warnung: " + message, percentage || 0, "warning");
  }
  function resetUI(prefix) {
    const startBtn = document.getElementById(prefix + "-start-btn");
    const pauseBtn = document.getElementById(prefix + "-pause-btn");
    const stopBtn = document.getElementById(prefix + "-stop-btn");
    const apiKeyInput = document.getElementById(prefix + "-api-key");
    const searchInput = document.getElementById(prefix + "-search-context");
    const topXInput = document.getElementById(prefix + "-top-x");
    const providerSelect = document.getElementById(prefix + "-provider-select");
    const modelIdInput = document.getElementById(prefix + "-model-id");
    const baseUrlInput = document.getElementById(prefix + "-base-url");
    if (startBtn) startBtn.style.display = "block";
    if (pauseBtn) pauseBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "none";
    if (apiKeyInput) apiKeyInput.disabled = false;
    if (searchInput) searchInput.disabled = false;
    if (topXInput) topXInput.disabled = false;
    if (providerSelect) providerSelect.disabled = false;
    if (modelIdInput) modelIdInput.disabled = false;
    if (baseUrlInput) baseUrlInput.disabled = false;
    const liveRanking = document.getElementById(prefix + "-live-ranking");
    if (liveRanking) liveRanking.style.display = "none";
    const progressContainer = document.getElementById(prefix + "-progress-container");
    if (progressContainer) progressContainer.style.display = "none";
    setRunning(false);
  }
  function setUIRunningState(prefix) {
    const startBtn = document.getElementById(prefix + "-start-btn");
    const pauseBtn = document.getElementById(prefix + "-pause-btn");
    const stopBtn = document.getElementById(prefix + "-stop-btn");
    const apiKeyInput = document.getElementById(prefix + "-api-key");
    const searchInput = document.getElementById(prefix + "-search-context");
    const topXInput = document.getElementById(prefix + "-top-x");
    const providerSelect = document.getElementById(prefix + "-provider-select");
    const modelIdInput = document.getElementById(prefix + "-model-id");
    const baseUrlInput = document.getElementById(prefix + "-base-url");
    if (startBtn) startBtn.style.display = "none";
    if (pauseBtn) pauseBtn.style.display = "block";
    if (stopBtn) stopBtn.style.display = "block";
    if (apiKeyInput) apiKeyInput.disabled = true;
    if (searchInput) searchInput.disabled = true;
    if (topXInput) topXInput.disabled = true;
    if (providerSelect) providerSelect.disabled = true;
    if (modelIdInput) modelIdInput.disabled = true;
    if (baseUrlInput) baseUrlInput.disabled = true;
  }
  function updateLiveRanking(prefix, allTopDeals, cachedSettings) {
    const container = document.getElementById(prefix + "-live-ranking");
    const content = document.getElementById(prefix + "-live-ranking-content");
    if (!container || !content) return;
    if (!S.isRunning) {
      container.style.display = "none";
      return;
    }
    if (!allTopDeals || allTopDeals.length === 0) {
      container.style.display = "none";
      return;
    }
    let currentPage = 0;
    for (let di = 0; di < allTopDeals.length; di++) {
      if (allTopDeals[di].page > currentPage) currentPage = allTopDeals[di].page;
    }
    const pageDeals = [];
    for (let di = 0; di < allTopDeals.length; di++) {
      if (allTopDeals[di].page === currentPage) pageDeals.push(allTopDeals[di]);
    }
    if (pageDeals.length === 0) {
      container.style.display = "none";
      return;
    }
    const topX = cachedSettings && cachedSettings.topX || 3;
    container.style.display = "block";
    pageDeals.sort(function(a, b) {
      return (b && b.score || 0) - (a && a.score || 0);
    });
    const topItems = pageDeals.slice(0, Math.min(3, topX));
    content.innerHTML = topItems.map(function(deal, idx) {
      const safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
      const borderStyle = idx < topItems.length - 1 ? "border-bottom:1px solid #ffe082;" : "";
      return [
        '<div style="margin-bottom:8px;padding-bottom:8px;' + borderStyle + '">',
        '<div style="font-weight:600;color:#333;">' + (idx + 1) + ". " + esc(deal.title) + "</div>",
        '<div style="color:#28a745;font-weight:600;">' + esc(deal.price) + "</div>",
        safeScore !== null ? '<div style="font-size:10px;color:#888;">Score: ' + safeScore + "/100</div>" : "",
        '<div style="font-size:10px;color:#888;">Seite ' + deal.page + "</div>",
        "</div>"
      ].join("\n");
    }).join("\n");
  }
  function attachSettingsListeners(prefix, callbacks) {
    const startBtn = document.getElementById(prefix + "-start-btn");
    const pauseBtn = document.getElementById(prefix + "-pause-btn");
    const stopBtn = document.getElementById(prefix + "-stop-btn");
    const closeBtn = document.getElementById(prefix + "-close-btn-x");
    const showResultsBtn = document.getElementById(prefix + "-show-results-btn");
    const apiKeyInput = document.getElementById(prefix + "-api-key");
    const searchContextInput = document.getElementById(prefix + "-search-context");
    const providerSelect = document.getElementById(prefix + "-provider-select");
    const modelIdInput = document.getElementById(prefix + "-model-id");
    const baseUrlInput = document.getElementById(prefix + "-base-url");
    const presetContainer = document.getElementById(prefix + "-model-presets");
    if (startBtn && callbacks.start) {
      startBtn.addEventListener("click", function() {
        callbacks.start()["catch"](function(error) {
          console.error("[MDF] Unhandled error in start:", error);
          updateProgress(prefix, "Fehler: " + error.message, 0, "error");
          resetUI(prefix);
        });
      });
    }
    if (pauseBtn && callbacks.pause) {
      pauseBtn.addEventListener("click", callbacks.pause);
    }
    if (stopBtn && callbacks.stop) {
      stopBtn.addEventListener("click", callbacks.stop);
    }
    if (closeBtn && callbacks.close) {
      closeBtn.addEventListener("click", callbacks.close);
    }
    if (showResultsBtn && callbacks.showSavedResults) {
      showResultsBtn.addEventListener("click", callbacks.showSavedResults);
    }
    if (apiKeyInput && callbacks.apiKeyChange) {
      apiKeyInput.addEventListener("blur", function() {
        callbacks.apiKeyChange(apiKeyInput.value.trim());
      });
    }
    if (searchContextInput && callbacks.searchContextChange) {
      searchContextInput.addEventListener("blur", function() {
        callbacks.searchContextChange(searchContextInput.value.trim());
      });
    }
    if (providerSelect && callbacks.providerChange) {
      providerSelect.addEventListener("change", function() {
        callbacks.providerChange(providerSelect.value)["catch"](function(err) {
          console.error("[MDF] Provider change error:", err);
        });
      });
    }
    if (modelIdInput && callbacks.modelIdChange) {
      modelIdInput.addEventListener("blur", function() {
        callbacks.modelIdChange(modelIdInput.value.trim());
      });
    }
    if (baseUrlInput && callbacks.baseUrlChange) {
      baseUrlInput.addEventListener("blur", function() {
        callbacks.baseUrlChange(baseUrlInput.value.trim());
      });
    }
    const portkeyConfigInput = document.getElementById(prefix + "-portkey-config");
    if (portkeyConfigInput && callbacks.portkeyConfigChange) {
      portkeyConfigInput.addEventListener("blur", function() {
        callbacks.portkeyConfigChange(portkeyConfigInput.value.trim());
      });
    }
    if (presetContainer && callbacks.modelPresetClick) {
      presetContainer.addEventListener("click", function(e) {
        const btn = e.target.closest("[data-model-id]");
        if (btn) {
          const modelId = btn.getAttribute("data-model-id");
          const rawOpts = btn.getAttribute("data-options");
          let options = null;
          if (rawOpts) {
            try {
              options = JSON.parse(rawOpts);
            } catch (e2) {
            }
          }
          callbacks.modelPresetClick(modelId, options);
        }
      });
    }
    [startBtn, pauseBtn, stopBtn, showResultsBtn].forEach(function(btn) {
      if (btn) {
        btn.addEventListener("mouseenter", function() {
          btn.style.opacity = "0.9";
        });
        btn.addEventListener("mouseleave", function() {
          btn.style.opacity = "1";
        });
      }
    });
  }
  function attachResultsListeners(prefix, callbacks) {
    const closeBtn = document.getElementById(prefix + "-close-btn-x");
    const backBtn = document.getElementById(prefix + "-back-to-settings");
    const exportMdBtn = document.getElementById(prefix + "-export-markdown-btn");
    const exportJsonBtn = document.getElementById(prefix + "-export-json-btn");
    const exportCsvBtn = document.getElementById(prefix + "-export-csv-btn");
    const clearBtn = document.getElementById(prefix + "-clear-results-btn");
    if (closeBtn && callbacks.close) closeBtn.addEventListener("click", callbacks.close);
    if (backBtn && callbacks.backToSettings) backBtn.addEventListener("click", callbacks.backToSettings);
    if (exportMdBtn && callbacks.exportMarkdown) exportMdBtn.addEventListener("click", callbacks.exportMarkdown);
    if (exportJsonBtn && callbacks.exportJSON) exportJsonBtn.addEventListener("click", callbacks.exportJSON);
    if (exportCsvBtn && callbacks.exportCSV) exportCsvBtn.addEventListener("click", callbacks.exportCSV);
    if (clearBtn && callbacks.clearResults) clearBtn.addEventListener("click", callbacks.clearResults);
    [closeBtn, backBtn, exportMdBtn, exportJsonBtn, exportCsvBtn, clearBtn].forEach(function(btn) {
      if (btn) {
        btn.addEventListener("mouseenter", function() {
          btn.style.opacity = "0.9";
        });
        btn.addEventListener("mouseleave", function() {
          btn.style.opacity = "1";
        });
      }
    });
  }
  function escapeTable(str) {
    return (str || "").replace(/\|/g, "\\|");
  }
  function formatDate(isoString) {
    try {
      let d = new Date(isoString);
      return d.toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoString;
    }
  }
  function generateMarkdown(deals, pages, timestamp, siteName) {
    let ts = timestamp || ( new Date()).toISOString();
    let md = "# " + siteName + " — Top-Deals\n\n";
    md += "- **Gefunden:** " + deals.length + " Top-Deals\n";
    md += "- **Analysierte Seiten:** " + pages + "\n";
    md += "- **Erstellt:** " + formatDate(ts) + "\n\n";
    let stats = computePriceStats(deals);
    if (stats) {
      md += "### Preis-Statistik\n\n";
      md += "| Kennzahl | Wert |\n";
      md += "|----------|-----|\n";
      md += "| Minimal | " + stats.min.toLocaleString("de-DE") + " EUR |\n";
      md += "| Maximal | " + stats.max.toLocaleString("de-DE") + " EUR |\n";
      md += "| Median | " + stats.median.toLocaleString("de-DE") + " EUR |\n";
      md += "| Durchschnitt | " + stats.mean.toLocaleString("de-DE") + " EUR |\n\n";
    }
    md += "## Uebersicht\n\n";
    md += "| # | Titel | Preis | Score | Seite |\n";
    md += "|---|-------|-------|-------|------|\n";
    for (let i = 0; i < deals.length; i++) {
      let deal = deals[i];
      let rank = i + 1;
      let title = escapeTable(deal.title || "Unbekannt");
      let price = escapeTable(deal.price || "-");
      let score = deal.score !== void 0 && isValidScore(deal.score) ? deal.score + "/100" : "-";
      let page = deal.page || "-";
      md += "| " + rank + " | " + title + " | " + price + " | " + score + " | " + page + " |\n";
    }
    md += "\n";
    md += "---\n\n## Details\n\n";
    for (let j = 0; j < deals.length; j++) {
      let d = deals[j];
      let r = j + 1;
      md += "### #" + r + " — " + (d.title || "Unbekannt") + "\n\n";
      md += "- **Preis:** " + (d.price || "Unbekannt") + "\n";
      if (d.score !== void 0 && isValidScore(d.score)) {
        md += "- **Score:** " + d.score + "/100\n";
      }
      md += "- **Begruendung:** " + (d.reasoning || "Keine Begruendung") + "\n";
      md += "- **Seite:** " + (d.page || "?") + "\n\n";
      if (d.description) {
        md += "**Beschreibung:**\n\n```\n" + d.description + "\n```\n\n";
      } else {
        md += "*Keine Beschreibung geladen.*\n\n";
      }
      md += "[Anzeige oeffnen](" + d.url + ")\n\n";
      if (j < deals.length - 1) {
        md += "---\n\n";
      }
    }
    return md;
  }
  function escapeCsv(val) {
    if (val === null || val === void 0) return "";
    let str = String(val);
    str = str.replace(/[\r\n]+/g, " ");
    return '"' + str.replace(/"/g, '""') + '"';
  }
  async function exportMarkdown(prefix) {
    let results = await loadResults(prefix);
    if (!results) {
      createToast("Keine Results verfuegbar!", { type: "error" });
      return;
    }
    let siteName = prefix === "wh" ? "WILLHABEN" : "KLEINANZEIGEN";
    let md = generateMarkdown(results.deals, results.pages, results.timestamp, siteName);
    try {
      await navigator.clipboard.writeText(md);
      let btn = document.getElementById(prefix + "-export-markdown-btn");
      if (btn) {
        let orig = btn.textContent;
        btn.textContent = "Kopiert!";
        setTimeout(function() {
          btn.textContent = orig;
        }, 2e3);
      }
    } catch (error) {
      createToast("Fehler beim Kopieren. Bitte Fenster fokussieren und nochmal versuchen.", { type: "error", duration: 5e3 });
    }
  }
  async function exportJSON(prefix) {
    let results = await loadResults(prefix);
    if (!results) {
      createToast("Keine Results verfuegbar!", { type: "error" });
      return;
    }
    let siteName = prefix === "wh" ? "WILLHABEN" : "KLEINANZEIGEN";
    let deals = results.deals || [];
    let metaJson = JSON.stringify({
      site: siteName,
      totalDeals: deals.length,
      pages: results.pages || 0,
      timestamp: results.timestamp || ( new Date()).toISOString()
    });
    let jsonOut = '{\n  "metadata": ' + metaJson + ',\n  "deals": [\n';
    for (let i = 0; i < deals.length; i++) {
      jsonOut += "    " + JSON.stringify(deals[i]);
      if (i < deals.length - 1) jsonOut += ",\n";
      else jsonOut += "\n";
    }
    jsonOut += "  ]\n}\n";
    let blob = new Blob([jsonOut], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = GM_addElement("a", { href: url, download: "deals-" + Date.now() + ".json" });
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1e3);
  }
  async function exportCSV(prefix) {
    let results = await loadResults(prefix);
    if (!results) {
      createToast("Keine Results verfuegbar!", { type: "error" });
      return;
    }
    let deals = results.deals || [];
    let header = ["Rang", "Titel", "Preis", "Score", "Begruendung", "Seite", "Beschreibung", "URL"];
    let rows = deals.map(function(d, i) {
      return [
        i + 1,
        escapeCsv(d.title),
        escapeCsv(d.price),
        d.score !== void 0 && Number.isFinite(Number(d.score)) ? d.score : "",
        escapeCsv(d.reasoning || d.reason),
        d.page || "",
        escapeCsv(d.description),
        escapeCsv(d.url)
      ].join(";");
    });
    let csv = "\uFEFF" + header.join(";") + "\r\n" + rows.join("\r\n");
    let blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    let url = URL.createObjectURL(blob);
    let a = GM_addElement("a", { href: url, download: "deals-" + Date.now() + ".csv" });
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1e3);
  }
  const Logger$1 = createLogger("Marketplace Deal Finder");
  function escapeForPrompt(str) {
    return (str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "");
  }
  function buildAnalysisPrompt(adsData, searchContext, topX, siteName, maxDescLength) {
    maxDescLength = maxDescLength || 400;
    const stats = computePriceStats(adsData);
    const statsSection = stats ? "\n\n## Price Distribution\n- Min: " + stats.min + " EUR\n- Max: " + stats.max + " EUR\n- Avg: " + stats.mean + " EUR\n- Median: " + stats.median + " EUR\n- Listings with price: " + stats.count : "";
    let prompt = "You are a deal and price analysis expert.\n\nSEARCH CONTEXT: " + escapeForPrompt(searchContext) + "\n\nTASK:\nAnalyze the following " + siteName + " listings and find the " + topX + " BEST deals.\n\nCRITERIA for a good deal:\n- 35-90% below the usual new price\n- Guaranteed profit on resale possible\n- MUST BUY quality\n- Real added value for the buyer" + statsSection + "\n\nLISTINGS:\n";
    for (let adi = 0; adi < adsData.length; adi++) {
      const ad = adsData[adi];
      prompt += "\nListing " + (adi + 1) + ":\nTitle: " + escapeForPrompt(ad.title) + "\nPrice: " + escapeForPrompt(ad.price) + "\nDescription: " + escapeForPrompt(ad.description).substring(0, maxDescLength) + "\nURL: " + escapeForPrompt(ad.url) + "\n---\n";
    }
    prompt += '\nRESPONSE FORMAT (JSON ONLY, NO EXTRA TEXT):\n{\n  "topDeals": [\n    {\n      "title": "...",\n      "price": "...",\n      "description": "...",\n      "url": "...",\n      "reasoning": "Why is this a top deal? (1-2 sentences)",\n      "score": 85\n    }\n  ]\n}\n\nSort the top ' + topX + " deals by quality (best first). Score is 0-100 (100 = absolute bargain).\nReturn ONLY valid JSON. No markdown, no code fences, no extra text.";
    return prompt;
  }
  async function waitIfPaused() {
    while (S.isPaused && !S.shouldStop) {
      await new Promise(function(r) {
        setTimeout(r, PAUSE_POLL_INTERVAL);
      });
    }
  }
  function fetchFullDescription(url, descSelectors2, retryCount) {
    retryCount = retryCount || 0;
    if (S.descriptionCache.has(url)) {
      const desc = S.descriptionCache.get(url);
      S.descriptionCache.delete(url);
      S.descriptionCache.set(url, desc);
      return Promise.resolve({ success: true, description: desc });
    }
    return new Promise(function(resolve) {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: REQUEST_TIMEOUT,
        onload: function(response) {
          try {
            if (response.status >= 200 && response.status < 300) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(response.responseText, "text/html");
              let fullDesc = null;
              for (let si = 0; si < descSelectors2.length; si++) {
                const element = doc.querySelector(descSelectors2[si]);
                if (element && element.textContent.trim().length > 20) {
                  fullDesc = element.textContent.replace(/\s+/g, " ").trim();
                  break;
                }
              }
              if (!fullDesc) {
                const itempropEl = doc.querySelector('[itemprop="description"]');
                if (itempropEl && itempropEl.textContent.trim().length > 20) {
                  fullDesc = itempropEl.textContent.replace(/\s+/g, " ").trim();
                }
              }
              if (!fullDesc) {
                const metaDesc = doc.querySelector('meta[name="description"]');
                if (metaDesc && metaDesc.getAttribute("content") && metaDesc.getAttribute("content").trim().length > 20) {
                  fullDesc = metaDesc.getAttribute("content").replace(/\s+/g, " ").trim();
                }
              }
              if (fullDesc) {
                if (S.descriptionCache.size >= MAX_CACHE_SIZE) {
                  const firstKey = S.descriptionCache.keys().next().value;
                  S.descriptionCache.delete(firstKey);
                }
                S.descriptionCache.set(url, fullDesc);
                resolve({ success: true, description: fullDesc });
                return;
              }
            }
          } catch (e) {
          }
          const delay = DESCRIPTION_FETCH_DELAY * Math.pow(DESCRIPTION_BACKOFF_FACTOR, retryCount);
          if (retryCount < DESCRIPTION_MAX_RETRIES && !S.shouldStop) {
            setTimeout(function() {
              fetchFullDescription(url, descSelectors2, retryCount + 1).then(resolve);
            }, delay);
          } else {
            resolve({ success: false, description: "" });
          }
        },
        onerror: function() {
          const delay = DESCRIPTION_FETCH_DELAY * Math.pow(DESCRIPTION_BACKOFF_FACTOR, retryCount);
          if (retryCount < DESCRIPTION_MAX_RETRIES && !S.shouldStop) {
            setTimeout(function() {
              fetchFullDescription(url, descSelectors2, retryCount + 1).then(resolve);
            }, delay);
          } else {
            resolve({ success: false, description: "" });
          }
        },
        ontimeout: function() {
          const delay = DESCRIPTION_FETCH_DELAY * Math.pow(DESCRIPTION_BACKOFF_FACTOR, retryCount);
          if (retryCount < DESCRIPTION_MAX_RETRIES && !S.shouldStop) {
            setTimeout(function() {
              fetchFullDescription(url, descSelectors2, retryCount + 1).then(resolve);
            }, delay);
          } else {
            resolve({ success: false, description: "" });
          }
        }
      });
    });
  }
  async function saveCrawlStateAndNavigate(href, settings) {
    const crawlState = {
      currentPage: S.currentPage,
      currentUrl: window.location.href,
      allTopDeals: S.allTopDeals,
      maxPages: settings.maxPages
    };
    await saveCrawlState(crawlState, S.scraper.storagePrefix);
    await saveSetting(
      S.scraper.storagePrefix + "_dealfinder_resume",

JSON.stringify({ u: normalizeUrl(new URL(href, window.location.href).href) })
    );
    window.location.href = href;
  }
  async function startDealFinder() {
    const prefix = S.scraper.storagePrefix;
    if (S.isRunning) {
      Logger$1.warn("Crawl already running, ignoring duplicate start");
      return;
    }
    const apiKey = document.getElementById(prefix + "-api-key").value.trim();
    const modelId = document.getElementById(prefix + "-model-id").value.trim();
    const searchContext = document.getElementById(prefix + "-search-context").value.trim();
    const topX = parseInt(document.getElementById(prefix + "-top-x").value);
    const maxPages = parseInt(document.getElementById(prefix + "-max-pages").value) || 10;
    const providerType = document.getElementById(prefix + "-provider-select") ? document.getElementById(prefix + "-provider-select").value : "gemini";
    const baseUrl = document.getElementById(prefix + "-base-url") ? document.getElementById(prefix + "-base-url").value.trim() : "";
    if (!apiKey) {
      alert("Bitte gib deinen API Key ein!");
      return;
    }
    if (!searchContext) {
      alert("Bitte gib einen Suchkontext ein!");
      return;
    }
    if (!Number.isFinite(topX) || topX < 1 || topX > 10) {
      alert("AI-Picks muss zwischen 1 und 10 liegen!");
      return;
    }
    if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 100) {
      alert("Maximale Seiten muss zwischen 1 und 100 liegen!");
      return;
    }
    const result = await loadSettings(prefix, S.cachedSettings);
    S.cachedSettings = result.cachedSettings;
    const settings = result.settings;
    settings.provider = {
      type: providerType,
      apiKey,
      modelId,
      baseUrl,
      options: settings.provider.options || {}
    };
    settings.searchContext = searchContext;
    settings.topX = topX;
    settings.maxPages = maxPages;
    await saveSettings(prefix, settings);
    S.cachedSettings = deepCopySettings(settings);
    S.cachedSettings.provider = S.cachedSettings.providers[S.cachedSettings.currentProvider] || {};
    if ("Notification" in window) {
      Notification.requestPermission()["catch"](function() {
      });
    }
    S.abortController = new AbortController();
    S.currentPage = 1;
    S.allTopDeals = [];
    S.isRunning = true;
    S.isPaused = false;
    S.shouldStop = false;
    S.captchaPaused = false;
    setUIRunningState(prefix);
    try {
      await processCurrentPage(settings);
    } catch (error) {
      Logger$1.error("Error:", error);
      updateProgress(prefix, "Fehler: " + error.message, 0, "error");
      if (S.allTopDeals.length > 0) {
        await finishDealFinder();
      } else {
        resetUI(prefix);
        alert("Fehler: " + error.message);
      }
    }
  }
  function pauseDealFinder() {
    S.isPaused = true;
    const prefix = S.scraper.storagePrefix;
    const pauseBtn = document.getElementById(prefix + "-pause-btn");
    if (!pauseBtn) return;
    pauseBtn.textContent = "Fortsetzen";
    pauseBtn.style.background = "#28a745";
    pauseBtn.removeEventListener("click", pauseDealFinder);
    pauseBtn.addEventListener("click", resumeDealFinder);
    updateProgress(prefix, "Pausiert - Klicke Fortsetzen...", 50, "warning");
  }
  function resumeDealFinder() {
    S.isPaused = false;
    const prefix = S.scraper.storagePrefix;
    const pauseBtn = document.getElementById(prefix + "-pause-btn");
    if (!pauseBtn) return;
    pauseBtn.textContent = "Pause";
    pauseBtn.style.background = "#ffc107";
    pauseBtn.removeEventListener("click", resumeDealFinder);
    pauseBtn.addEventListener("click", pauseDealFinder);
    if (S.isRunning && S.captchaPaused) {
      S.captchaPaused = false;
      const cs = S.cachedSettings || {};
      processCurrentPage(cs)["catch"](function(error) {
        Logger$1.error("Resume error:", error);
        updateProgress(prefix, "Fehler: " + error.message, 0, "error");
        if (S.allTopDeals.length > 0) {
          finishDealFinder()["catch"](function(e) {
            Logger$1.error("finishDealFinder after resume error:", e);
          });
        } else {
          resetUI(prefix);
        }
      });
    }
  }
  async function stopDealFinder() {
    S.shouldStop = true;
    S.isPaused = false;
    S.captchaPaused = false;
    if (S.abortController) {
      S.abortController.abort();
      S.abortController = null;
    }
    const prefix = S.scraper.storagePrefix;
    await clearCrawlState(prefix);
    Logger$1.log("Crawl stopped by user");
    updateProgress(prefix, "Stoppe nach aktueller Seite...", 95, "warning");
  }
  async function processCurrentPage(settings) {
    const prefix = S.scraper.storagePrefix;
    const scraper = S.scraper;
    const maxPages = settings.maxPages || 10;
    await waitIfPaused();
    if (S.shouldStop) {
      await finishDealFinder();
      return;
    }
    if (S.currentPage > maxPages) {
      await finishDealFinder();
      return;
    }
    updateProgress(prefix, "Seite " + S.currentPage + ": Lade alle Anzeigen...", 10, "info");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await new Promise(function(r) {
      setTimeout(r, SCROLL_DELAY);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    await new Promise(function(r) {
      setTimeout(r, SCROLL_DELAY);
    });
    updateProgress(prefix, "Seite " + S.currentPage + ": Sammle Anzeigen...", 15, "info");
    const selectors = scraper.findAds();
    if (!selectors) {
      const pageText = (document.title + " " + document.body.innerText).toLowerCase();
      if (pageText.indexOf("captcha") !== -1 || pageText.indexOf("challenge") !== -1) {
        S.captchaPaused = true;
        const crawlState = {
          currentPage: S.currentPage,
          currentUrl: window.location.href,
          allTopDeals: S.allTopDeals,
          maxPages
        };
        await saveCrawlState(crawlState, prefix);
        pauseDealFinder();
        updateProgress(prefix, "CAPTCHA erkannt! Bitte loesen und Fortsetzen klicken", 50, "warning");
        return;
      }
      throw new Error("Keine Anzeigen gefunden");
    }
    updateProgress(prefix, "Seite " + S.currentPage + ": Sammle Basis-Daten...", 20, "info");
    const seenUrls = new Set();
    const adsData = [];
    const adArray = Array.from(selectors.adEntries);
    for (let adi = 0; adi < adArray.length; adi++) {
      const info = scraper.extractBasicInfo(adArray[adi]);
      info.url = normalizeUrl(info.url) || info.url;
      if (!seenUrls.has(info.url)) {
        seenUrls.add(info.url);
        adsData.push(info);
      }
    }
    Logger$1.log(adsData.length + " ads found (deduplicated)");
    updateProgress(prefix, "Seite " + S.currentPage + ": Lade Details (0/" + adsData.length + ")...", 30, "info");
    let completedCount = 0;
    let deadlineWarningLogged = false;
    for (let bi = 0; bi < adsData.length; bi += INITIAL_BATCH_SIZE) {
      await waitIfPaused();
      if (S.shouldStop) break;
      const batch = adsData.slice(bi, Math.min(bi + INITIAL_BATCH_SIZE, adsData.length));
      let batchDeadlineReached = false;
      const batchFns = batch.map(function(ad, idx) {
        const absoluteIndex = bi + idx;
        const fetchPromise = ad.url && ad.url.indexOf("http") === 0 ? fetchFullDescription(ad.url, scraper.descSelectors()) : Promise.resolve({ success: false, description: "" });
        return fetchPromise.then(function(result) {
          if (!batchDeadlineReached) {
            completedCount++;
            if (completedCount % 5 === 0 || completedCount === adsData.length) {
              updateProgress(
                prefix,
                "Seite " + S.currentPage + ": Lade Details (" + completedCount + "/" + adsData.length + ")...",
                30 + completedCount / adsData.length * 40,
                "info"
              );
            }
            adsData[absoluteIndex].description = result.description;
          }
        });
      });
      const deadline = 8e3;
      await Promise.race([
        Promise.all(batchFns),
        new Promise(function(r) {
          setTimeout(function() {
            batchDeadlineReached = true;
            if (!deadlineWarningLogged) {
              Logger$1.warn("Description fetch deadline (" + deadline + "ms) reached — proceeding with partial data");
              deadlineWarningLogged = true;
            }
            r();
          }, deadline);
        })
      ]);
      if (bi + INITIAL_BATCH_SIZE < adsData.length) {
        await new Promise(function(r) {
          setTimeout(r, 500 + Math.random() * 1e3);
        });
      }
    }
    if (S.shouldStop) {
      await finishDealFinder();
      return;
    }
    updateProgress(prefix, "Seite " + S.currentPage + ": AI analysiert Angebote...", 75, "info");
    Logger$1.log("Sending " + adsData.length + " listings to " + settings.provider.type + "...");
    const prompt = buildAnalysisPrompt(adsData, settings.searchContext, settings.topX, scraper.siteName);
    const aiCallStart = Date.now();
    const onRetry = function(retryNum, error) {
      showWarning(prefix, "API " + (error.status || "error") + " - Retry " + retryNum + "...", 75);
    };
    let aiResult = null;
    try {
      aiResult = await callAI(prompt, {
        providerType: settings.provider.type,
        apiKey: settings.provider.apiKey,
        modelId: settings.provider.modelId,
        baseUrl: settings.provider.baseUrl || void 0,
        providerOptions: settings.provider.options || {}
      }, {
        temperature: 0.1,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        onRetry,
        signal: S.abortController && S.abortController.signal
      });
      Logger$1.log("AI response received in " + (Date.now() - aiCallStart) + "ms");
    } catch (error) {
      if (error.name === "AbortError" || S.shouldStop) {
        await finishDealFinder();
        return;
      }
      Logger$1.error("AI analysis failed for page " + S.currentPage + ", continuing to next page:", error);
      updateProgress(prefix, "Seite " + S.currentPage + ": Analyse fehlgeschlagen, ueberspringe...", 75, "warning");
      aiResult = null;
    }
    if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
      Logger$1.log("AI found " + aiResult.topDeals.length + " top deals");
      const scrapedDescs = new Map();
      for (let adi = 0; adi < adsData.length; adi++) {
        if (adsData[adi].description && adsData[adi].url) {
          scrapedDescs.set(adsData[adi].url, adsData[adi].description);
        }
      }
      for (let tdi = 0; tdi < aiResult.topDeals.length; tdi++) {
        const rawDeal = aiResult.topDeals[tdi];
        let description = rawDeal.description || "";
        const fullDesc = rawDeal.url && scrapedDescs.has(rawDeal.url) ? scrapedDescs.get(rawDeal.url) : "";
        if (fullDesc) description = fullDesc;
        const normalized = {
          title: rawDeal.title || "Unknown",
          price: rawDeal.price || "Unknown",
          description: description || "",
          url: normalizeUrl(rawDeal.url) || "",
          score: rawDeal.score,
          reasoning: rawDeal.reasoning || rawDeal.reason || "Keine Begruendung",
          page: S.currentPage
        };
        S.allTopDeals.push(normalized);
      }
      updateProgress(prefix, "Seite " + S.currentPage + ": " + aiResult.topDeals.length + " Top-Deals gefunden!", 90, "success");
      updateLiveRanking(prefix, S.allTopDeals, S.cachedSettings);
    }
    await new Promise(function(r) {
      setTimeout(r, PAGE_TRANSITION_DELAY);
    });
    if (!S.shouldStop) {
      const nextUrl = scraper.goToNextPage(S.currentPage);
      if (nextUrl) {
        Logger$1.log("Navigating to next page: " + nextUrl);
        await saveCrawlStateAndNavigate(nextUrl, settings);
      } else {
        Logger$1.log("No more pages available - ending crawl");
        await finishDealFinder();
      }
    } else {
      await finishDealFinder();
    }
  }
  async function finishDealFinder() {
    const prefix = S.scraper.storagePrefix;
    updateProgress(prefix, "Erstelle finale Ranking-Liste...", 95, "info");
    await clearCrawlState(prefix);
    if (S.allTopDeals.length === 0) {
      updateProgress(prefix, "Keine Deals gefunden!", 100, "error");
      alert("Keine Top-Deals gefunden! Versuche andere Suchkriterien.");
      S.allTopDeals = [];
      resetUI(prefix);
      return;
    }
    if (S.shouldStop) {
      updateProgress(prefix, "Crawl gestoppt. Speichere bisherige Deals...", 100, "warning");
      await saveResults({ deals: S.allTopDeals, pages: S.currentPage, timestamp: ( new Date()).toISOString() }, prefix);
      switchToResultsView(prefix, S.allTopDeals);
      attachResultsListeners(prefix, makeResultsCallbacks(prefix));
      S.allTopDeals = [];
      resetUI(prefix);
      return;
    }
    const deduped = deduplicateDeals(S.allTopDeals);
    S.allTopDeals = deduped;
    if (S.allTopDeals.length > 1) {
      updateProgress(prefix, "Globales Re-Ranking aller Deals...", 97, "info");
      try {
        const sortedTopDeals = sortDealsByScore(S.allTopDeals);
        const dealsToReRank = sortedTopDeals.slice(0, RE_RANK_MAX_DEALS);
        const reRankPrompt = buildAnalysisPrompt(
          dealsToReRank.map(function(d) {
            return {
              title: d.title,
              price: d.price,
              description: d.description || "",
url: d.url
            };
          }),
          (S.cachedSettings || {}).searchContext || "",
          dealsToReRank.length,
          S.scraper.siteName,
          3e3
);
        const cs = S.cachedSettings || {};
        const reRankResult = await callAI(reRankPrompt, {
          providerType: cs.provider ? cs.provider.type : "gemini",
          apiKey: cs.provider ? cs.provider.apiKey : "",
          modelId: cs.provider ? cs.provider.modelId : "gemini-2.5-flash",
          baseUrl: cs.provider ? cs.provider.baseUrl : void 0,
          providerOptions: cs.provider ? cs.provider.options : {}
        }, { temperature: 0.1, maxOutputTokens: MAX_OUTPUT_TOKENS, signal: S.abortController && S.abortController.signal });
        if (reRankResult && reRankResult.topDeals) {
          const urlToDeal = new Map();
          for (let ri = 0; ri < dealsToReRank.length; ri++) {
            urlToDeal.set(dealsToReRank[ri].url, dealsToReRank[ri]);
          }
          const reRankedDeals = reRankResult.topDeals.map(function(rd) {
            const orig = urlToDeal.get(rd.url);
            return {
              title: orig && orig.title || rd.title,
              price: rd.price,
              description: orig && orig.description || rd.description,
              url: orig && orig.url || rd.url,
              score: rd.score,
              reasoning: rd.reasoning || rd.reason || "",
              page: orig && orig.page || "unknown"
            };
          });
          const reRankedUrls = new Set(reRankedDeals.map(function(d) {
            return d.url;
          }));
          const remainingDeals = sortedTopDeals.filter(function(d) {
            return !reRankedUrls.has(d.url);
          });
          S.allTopDeals = sortDealsByScore(reRankedDeals.concat(remainingDeals));
          Logger$1.log("Global re-ranking complete");
        }
      } catch (e) {
        Logger$1.warn("Global re-ranking failed:", e);
        showWarning(prefix, "Re-Ranking fehlgeschlagen — Ergebnisse ohne Neusortierung", 95);
      }
    }
    await saveResults({ deals: S.allTopDeals, pages: S.currentPage, timestamp: ( new Date()).toISOString() }, prefix);
    updateProgress(prefix, S.allTopDeals.length + " Deals gespeichert!", 100, "success");
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Deal Finder fertig", {
          body: S.allTopDeals.length + " Deals auf " + S.currentPage + " Seiten gefunden"
        });
      } catch (e) {
      }
    }
    switchToResultsView(prefix, S.allTopDeals);
    attachResultsListeners(prefix, makeResultsCallbacks(prefix));
    S.allTopDeals = [];
    resetUI(prefix);
  }
  async function setupSettingsView(scraper) {
    const prefix = scraper.storagePrefix;
    const result = await loadSettings(prefix, S.cachedSettings);
    S.cachedSettings = result.cachedSettings;
    const settings = result.settings;
    const savedResults = await loadResults(prefix);
    const modal = document.getElementById(prefix + "-dealfinder-modal");
    if (!modal) return;
    modal.innerHTML = renderSettingsView(prefix, settings, savedResults, scraper.siteName);
    attachSettingsListeners(prefix, {
      start: startDealFinder,
      pause: pauseDealFinder,
      stop: stopDealFinder,
      close: function() {
        const isRunning = S.isRunning;
        closeModal(prefix, isRunning);
      },
      showSavedResults: async function() {
        const sr = await loadResults(prefix);
        if (sr) {
          switchToResultsView(prefix, sr.deals);
          attachResultsListeners(prefix, makeResultsCallbacks(prefix));
        }
      },
      apiKeyChange: async function(newKey) {
        const s = await loadSettings(prefix, S.cachedSettings);
        S.cachedSettings = s.cachedSettings;
        const settingsObj = s.settings;
        if (settingsObj.provider.apiKey !== newKey) {
          settingsObj.provider.apiKey = newKey;
          await saveSettings(prefix, settingsObj);
          S.cachedSettings = deepCopySettings(settingsObj);
        }
      },
      searchContextChange: async function(newContext) {
        const s = await loadSettings(prefix, S.cachedSettings);
        S.cachedSettings = s.cachedSettings;
        const settingsObj = s.settings;
        if (settingsObj.searchContext !== newContext) {
          settingsObj.searchContext = newContext;
          await saveSettings(prefix, settingsObj);
          S.cachedSettings = deepCopySettings(settingsObj);
        }
      },
      providerChange: async function(newType) {
        const s = await loadSettings(prefix, S.cachedSettings);
        S.cachedSettings = s.cachedSettings;
        const settingsObj = s.settings;
        if (settingsObj.currentProvider !== newType) {
          settingsObj.currentProvider = newType;
          settingsObj.provider = settingsObj.providers[newType] || {};
          settingsObj.provider.type = newType;
          if (!settingsObj.provider.modelId) {
            settingsObj.provider.modelId = getDefaultModelForProvider(newType);
          }
          await saveSettings(prefix, settingsObj);
          S.cachedSettings = deepCopySettings(settingsObj);
          S.cachedSettings.provider = S.cachedSettings.providers[S.cachedSettings.currentProvider] || {};
          await setupSettingsView(scraper)["catch"](function(err) {
            Logger$1.error("Re-render after provider change failed:", err);
          });
        }
      },
      modelIdChange: async function(newId) {
        const s = await loadSettings(prefix, S.cachedSettings);
        S.cachedSettings = s.cachedSettings;
        const settingsObj = s.settings;
        if (settingsObj.provider.modelId !== newId) {
          settingsObj.provider.modelId = newId;
          const matchingPreset = (MODEL_PRESETS[settingsObj.currentProvider] || []).find(function(p) {
            return p.id === newId;
          });
          settingsObj.provider.options = matchingPreset && matchingPreset.options ? matchingPreset.options : {};
          await saveSettings(prefix, settingsObj);
          S.cachedSettings = deepCopySettings(settingsObj);
          document.querySelectorAll("#" + prefix + "-model-presets [data-model-id]").forEach(function(btn) {
            const isActive = btn.getAttribute("data-model-id") === newId;
            btn.style.background = isActive ? "#6366f1" : "#f8f9fa";
            btn.style.color = isActive ? "#fff" : "#333";
            btn.style.borderColor = isActive ? "#6366f1" : "#ddd";
          });
        }
      },
      modelPresetClick: async function(modelId, options) {
        const modelIdInput = document.getElementById(prefix + "-model-id");
        if (modelIdInput) {
          modelIdInput.value = modelId;
          const s = await loadSettings(prefix, S.cachedSettings);
          s.settings.provider.modelId = modelId;
          if (options) s.settings.provider.options = options;
          await saveSettings(prefix, s.settings);
          S.cachedSettings = deepCopySettings(s.settings);
          document.querySelectorAll("#" + prefix + "-model-presets [data-model-id]").forEach(function(btn) {
            const isActive = btn.getAttribute("data-model-id") === modelId;
            btn.style.background = isActive ? "#6366f1" : "#f8f9fa";
            btn.style.color = isActive ? "#fff" : "#333";
            btn.style.borderColor = isActive ? "#6366f1" : "#ddd";
          });
        }
      },
      baseUrlChange: async function(newUrl) {
        const s = await loadSettings(prefix, S.cachedSettings);
        S.cachedSettings = s.cachedSettings;
        const settingsObj = s.settings;
        if (settingsObj.provider.baseUrl !== newUrl) {
          settingsObj.provider.baseUrl = newUrl;
          await saveSettings(prefix, settingsObj);
          S.cachedSettings = deepCopySettings(settingsObj);
        }
      },
      portkeyConfigChange: async function(newConfig) {
        const s = await loadSettings(prefix, S.cachedSettings);
        S.cachedSettings = s.cachedSettings;
        const settingsObj = s.settings;
        if (!settingsObj.provider.options) settingsObj.provider.options = {};
        if (settingsObj.provider.options.config !== newConfig) {
          settingsObj.provider.options.config = newConfig;
          await saveSettings(prefix, settingsObj);
          S.cachedSettings = deepCopySettings(settingsObj);
        }
      }
    });
  }
  function getDefaultModelForProvider(providerType) {
    const presets = MODEL_PRESETS[providerType];
    return presets && presets.length > 0 ? presets[0].id : "gemini-2.5-flash";
  }
  function makeResultsCallbacks(prefix) {
    return {
      close: function() {
        closeModal(prefix, S.isRunning);
      },
      backToSettings: function() {
        setupSettingsView(S.scraper);
      },
      exportMarkdown: async function() {
        await exportMarkdown(prefix);
      },
      exportJSON: function() {
        exportJSON(prefix);
      },
      exportCSV: function() {
        exportCSV(prefix);
      },
      clearResults: async function() {
        if (!confirm("Moechtest du die gespeicherten Results wirklich loeschen?")) return;
        await clearResults(prefix);
        setupSettingsView(S.scraper);
      }
    };
  }
  async function resumeCrawlIfActive(scraper) {
    const prefix = scraper.storagePrefix;
    const rawState = await loadCrawlState(prefix);
    if (!rawState) {
      Logger$1.log("Normal session");
      return;
    }
    const currentAds = scraper.findAds();
    if (!currentAds) {
      Logger$1.log("Stale crawl state found but current page has no search results — clearing");
      await clearCrawlState(prefix);
      return;
    }
    const normalizedCurrentUrl = normalizeUrl(rawState.currentUrl);
    const normalizedWindowUrl = normalizeUrl(window.location.href);
    const samePage = normalizedCurrentUrl && normalizedCurrentUrl === normalizedWindowUrl;
    const resumeRaw = await loadSetting(prefix + "_dealfinder_resume", null);
    await saveSetting(prefix + "_dealfinder_resume", null);
    let isScriptNavigation = false;
    if (resumeRaw) {
      try {
        const flag = JSON.parse(resumeRaw);
        isScriptNavigation = normalizeUrl(flag.u || "") === normalizeUrl(window.location.href);
      } catch (e) {
      }
    }
    if (!isScriptNavigation && !samePage) {
      Logger$1.log("Stale crawl state from different search — clearing");
      await clearCrawlState(prefix);
      return;
    }
    const pageIncrement = samePage ? SAME_PAGE_INCREMENT : NEW_PAGE_INCREMENT;
    Logger$1.log("Crawl state found - resuming from page " + (rawState.currentPage + pageIncrement));
    S.currentPage = rawState.currentPage + pageIncrement;
    S.allTopDeals = rawState.allTopDeals || [];
    S.isRunning = true;
    S.scraper = scraper;
    openModal(prefix);
    const result = await loadSettings(prefix, S.cachedSettings);
    S.cachedSettings = result.cachedSettings;
    const settings = result.settings;
    const maxPages = rawState.maxPages || settings.maxPages || 10;
    settings.maxPages = maxPages;
    if (S.cachedSettings) {
      S.cachedSettings.maxPages = maxPages;
    }
    setUIRunningState(prefix);
    try {
      await processCurrentPage(settings);
    } catch (error) {
      Logger$1.error("Error resuming:", error);
      updateProgress(prefix, "Fehler: " + error.message, 0, "error");
      await clearCrawlState(prefix);
      if (S.allTopDeals.length > 0) {
        await finishDealFinder();
      } else {
        resetUI(prefix);
        alert("Fehler beim Fortsetzen: " + error.message);
      }
    }
  }
  const Logger = createLogger("Marketplace Deal Finder");
  async function waitForPage(scraper) {
    const isWH = scraper.siteName === "WILLHABEN";
    if (isWH) {
      const searchIndicators = [
        '[data-testid="result-list-title"]',
        '[data-testid*="search-result"]',
        'a[href*="/iad/"]'
      ];
      let hasIndicator = false;
      for (let ssi = 0; ssi < searchIndicators.length; ssi++) {
        if (document.querySelector(searchIndicators[ssi])) {
          hasIndicator = true;
          break;
        }
      }
      if (!hasIndicator) {
        throw new Error("No search results detected");
      }
    } else {
      try {
        await waitForElement("article[data-adid], #srchrslt-adtable", 1e4);
      } catch (e) {
        throw new Error("No ad list detected");
      }
    }
  }
  async function init() {
    try {
      const scraper = getScraper();
      setScraper(scraper);
      const result = await loadSettings(scraper.storagePrefix);
      setCachedSettings(result.cachedSettings);
      Logger.log("Initializing...");
      for (let attempt = 0; attempt < MAX_INIT_RETRIES; attempt++) {
        try {
          await waitForPage(scraper);
          break;
        } catch (e) {
          if (attempt < MAX_INIT_RETRIES - 1) {
            Logger.log("Page not ready, retrying in 3s...");
            await new Promise(function(r) {
              setTimeout(r, 3e3);
            });
          } else {
            Logger.warn("Max retries reached - showing button anyway");
          }
        }
      }
      await new Promise(function(r) {
        setTimeout(r, 1500);
      });
      createModal(scraper.storagePrefix);
      createDealFinderButton(scraper.storagePrefix, scraper.buttonGradient);
      const floatBtn = document.getElementById(scraper.storagePrefix + "-dealfinder-btn");
      if (floatBtn) {
        floatBtn.addEventListener("click", function() {
          openModal(scraper.storagePrefix);
          setupSettingsView(scraper)["catch"](function(err) {
            Logger.error("Failed to load settings view:", err);
          });
        });
      }
      await setupSettingsView(scraper);
      await resumeCrawlIfActive(scraper);
    } catch (error) {
      Logger.error("Initialization error:", error);
      await new Promise(function(r) {
        setTimeout(r, 3e3);
      });
      init()["catch"](function(e) {
        Logger.error("Fatal init failure after retry:", e);
        console.error("[Marketplace Deal Finder] Could not initialize. Please reload the page or check the console for details.");
      });
    }
  }
  class GeminiProvider extends AIProvider {
constructor(config) {
      super(config);
    }
getEndpoint() {
      return `https://generativelanguage.googleapis.com/v1beta/models/${this.config.modelId}:generateContent`;
    }
getAuthHeaders() {
      return {
        "x-goog-api-key": this.config.apiKey,
        "Content-Type": "application/json"
      };
    }
buildRequest(prompt, options = {}) {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.1,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: options.maxOutputTokens ?? 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              topDeals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    title: { type: "string" },
                    price: { type: "string" },
                    description: { type: "string" },
                    score: { type: "integer" },
                    reasoning: { type: "string" }
                  },
                  required: ["url", "title", "price", "score", "reasoning"]
                }
              }
            },
            required: ["topDeals"]
          }
        }
      };
      const opts = this.config.providerOptions || {};
      if (opts.thinking_budget !== void 0) {
        body.generationConfig.thinkingConfig = { thinking_budget: opts.thinking_budget };
      } else if (opts.thinking_level) {
        body.generationConfig.thinkingConfig = { thinking_level: opts.thinking_level };
      }
      return body;
    }
parseResponse(response) {
      var _a;
      if (!response || !response.candidates || response.candidates.length === 0) {
        throw new Error("Gemini: empty response — no candidates returned");
      }
      const candidate = response.candidates[0];
      if (candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKLIST") {
        throw new Error(`Gemini: blocked — finishReason: ${candidate.finishReason}`);
      }
      if (candidate.finishReason === "MAX_TOKENS") {
        console.warn("[MDF] Gemini response may be truncated — max tokens reached");
      }
      const parts = (_a = candidate.content) == null ? void 0 : _a.parts;
      if (!parts || parts.length === 0) {
        throw new Error("Gemini: response missing content parts");
      }
      return parts[0].text || "";
    }
  }
  const ENDPOINTS = {
    [PROVIDER_TYPES.OPENAI]: "https://api.openai.com/v1/chat/completions",
    [PROVIDER_TYPES.DEEPSEEK]: "https://api.deepseek.com/chat/completions",
    [PROVIDER_TYPES.OPENROUTER]: "https://openrouter.ai/api/v1/chat/completions",
    [PROVIDER_TYPES.PORTKEY]: "https://api.portkey.ai/v1/chat/completions"
  };
  class OpenAICompatibleProvider extends AIProvider {
constructor(config) {
      super(config);
    }
getEndpoint() {
      return this.config.baseUrl || ENDPOINTS[this.config.type];
    }
getAuthHeaders() {
      const headers = { "Content-Type": "application/json" };
      if (this.config.type === PROVIDER_TYPES.PORTKEY) {
        headers["x-portkey-api-key"] = this.config.apiKey;
        const opts = this.config.providerOptions || {};
        if (opts.config) {
          headers["x-portkey-config"] = opts.config;
          headers["x-portkey-debug"] = "false";
        } else {
          if (opts.providerSlug) {
            headers["x-portkey-provider"] = opts.providerSlug;
          }
          if (opts.virtualKey) {
            headers["x-portkey-virtual-key"] = opts.virtualKey;
          }
        }
      } else {
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      }
      if (this.config.type === PROVIDER_TYPES.OPENROUTER) {
        headers["HTTP-Referer"] = "https://github.com/marmoris-x/tampermonkey-scripts";
        headers["X-OpenRouter-Title"] = "Marketplace Deal Finder";
      }
      return headers;
    }
buildRequest(prompt, options = {}) {
      const body = {
        model: this.config.modelId,
        messages: [
          {
            role: "system",
            content: "You extract structured deal data from classified ads. Always respond with valid JSON matching the requested schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxOutputTokens ?? 8192
      };
      const opts = this.config.providerOptions || {};
      if (!opts.skip_response_format) {
        body.response_format = { type: "json_object" };
      }
      if (opts.reasoning_effort) {
        body.reasoning_effort = opts.reasoning_effort;
      }
      if (this.config.type === PROVIDER_TYPES.DEEPSEEK && opts.reasoning_effort === "max") {
        body.thinking = { type: "enabled" };
      }
      return body;
    }
parseResponse(response) {
      var _a;
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error(`${this.config.type}: empty response — no choices returned`);
      }
      const choice = response.choices[0];
      if (choice.finish_reason && choice.finish_reason !== "stop" && choice.finish_reason !== "length") {
        throw new Error(`${this.config.type}: unexpected finish_reason: ${choice.finish_reason}`);
      }
      const content = (_a = choice.message) == null ? void 0 : _a.content;
      if (!content) {
        throw new Error(`${this.config.type}: response missing message content`);
      }
      return content;
    }
  }
  class ClaudeProvider extends AIProvider {
constructor(config) {
      super(config);
    }
getEndpoint() {
      return "https://api.anthropic.com/v1/messages";
    }
getAuthHeaders() {
      return {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      };
    }
buildRequest(prompt, options = {}) {
      const opts = this.config.providerOptions || {};
      const isThinking = opts.thinking && opts.thinking.type === "enabled";
      const body = {
        model: this.config.modelId,
        max_tokens: options.maxOutputTokens ?? 8192,
        system: "You extract structured deal data from classified ads. Always respond with valid JSON matching the requested schema. Return ONLY valid JSON — no markdown, no code fences, no explanation.",
        messages: [
          { role: "user", content: prompt }
        ]
      };
      if (isThinking) {
        if (!opts.thinking.budget_tokens || typeof opts.thinking.budget_tokens !== "number") {
          console.warn("[MDF] Claude thinking enabled but budget_tokens missing or invalid — disabling thinking");
        } else {
          body.thinking = opts.thinking;
          body.temperature = 1;
        }
      }
      if (!body.thinking) {
        body.temperature = options.temperature ?? 0.1;
      }
      return body;
    }
parseResponse(response) {
      if (!response || !response.content || response.content.length === 0) {
        throw new Error("Claude: empty response — no content returned");
      }
      const block = response.content[0];
      if (block.type !== "text") {
        throw new Error(`Claude: unexpected content block type: ${block.type}`);
      }
      if (response.stop_reason && response.stop_reason !== "end_turn" && response.stop_reason !== "stop" && response.stop_reason !== "max_tokens") {
        throw new Error(`Claude: unexpected stop_reason: ${response.stop_reason}`);
      }
      if (response.stop_reason === "max_tokens") {
        console.warn("[MDF] Claude response may be truncated — max tokens reached");
      }
      return block.text || "";
    }
  }
  
  registerProvider("gemini", GeminiProvider);
  registerProvider("openai", OpenAICompatibleProvider);
  registerProvider("deepseek", OpenAICompatibleProvider);
  registerProvider("openrouter", OpenAICompatibleProvider);
  registerProvider("portkey", OpenAICompatibleProvider);
  registerProvider("claude", ClaudeProvider);
  init();

})();
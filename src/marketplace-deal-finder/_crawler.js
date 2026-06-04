// src/marketplace-deal-finder/_crawler.js — Crawl orchestration, prompt construction
'use strict';

import { createLogger } from './_logger.js';
import { S as state } from './_state.js';
import { callAI } from './_api-router.js';
import { loadCrawlState, saveCrawlState, clearCrawlState, clearResults, saveResults, loadResults, deepCopySettings, saveSetting, loadSetting } from './_storage.js';
import { loadSettings, saveSettings } from './_settings.js';
import { deduplicateDeals, computePriceStats, normalizeUrl, sortDealsByScore } from './_ranker.js';
import { updateProgress, updateLiveRanking, resetUI, setUIRunningState, showWarning } from './_ui-progress.js';
import { closeModal, openModal, switchToResultsView } from './_ui-panel.js';
import { renderSettingsView } from './_ui-settings.js';
import { attachSettingsListeners, attachResultsListeners } from './_ui-listeners.js';
import { exportMarkdown, exportJSON, exportCSV } from './_export.js';
import * as C from './_constants.js';

const Logger = createLogger('MDF Crawler');

/* ─── Helpers ─── */

/**
 * Escapes special characters that can confuse an AI model into producing
 * malformed JSON. Handles quotes, backslashes, and control characters.
 * @param {string} str - Raw input string
 * @returns {string} Escaped string safe for prompt injection
 */
function escapeForPrompt(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
}

/**
 * Scrolls the page gradually to a target Y position over a given duration.
 * Uses ease-out cubic easing for a natural decelerating feel.
 * @param {number} targetY - Target scroll position
 * @param {number} durationMs - Duration in milliseconds
 * @returns {Promise<void>}
 */
function gradualScroll(targetY, durationMs) {
  return new Promise(function (resolve) {
    var startY = window.scrollY;
    var startTime = performance.now();
    function step() {
      var elapsed = performance.now() - startTime;
      var progress = Math.min(elapsed / durationMs, 1);
      // Cubic ease-out: fast start, smooth deceleration
      var eased = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startY + (targetY - startY) * eased);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

/* ─── Prompt Builder ─── */

/**
 * Builds the full analysis prompt for the AI.
 * Provider-agnostic — contains listings data and instructions.
 * @param {Array<Object>} adsData - Array of ad objects with title, price, description, url
 * @param {string} searchContext - User's search context/description
 * @param {number} topX - Number of top deals to request
 * @param {string} siteName - "WILLHABEN" or "KLEINANZEIGEN"
 * @returns {string} Full prompt text
 */
function buildAnalysisPrompt(adsData, searchContext, topX, siteName, maxDescLength) {
  maxDescLength = maxDescLength || 400;
  const stats = computePriceStats(adsData);
  const statsSection = stats
    ? '\n\n## Price Distribution\n- Min: ' + stats.min + ' EUR\n- Max: ' + stats.max + ' EUR\n- Avg: ' + stats.mean + ' EUR\n- Median: ' + stats.median + ' EUR\n- Listings with price: ' + stats.count
    : '';

  let prompt = 'You are a deal and price analysis expert.\n\nSEARCH CONTEXT: ' + escapeForPrompt(searchContext) +
    '\n\nTASK:\nAnalyze the following ' + siteName + ' listings and find the ' + topX + ' BEST deals.\n\n' +
    'CRITERIA for a good deal:\n- 35-90% below the usual new price\n' +
    '- Guaranteed profit on resale possible\n- MUST BUY quality\n- Real added value for the buyer' +
    statsSection + '\n\nLISTINGS:\n';

  for (let adi = 0; adi < adsData.length; adi++) {
    const ad = adsData[adi];
    prompt += '\nListing ' + (adi + 1) + ':\nTitle: ' + escapeForPrompt(ad.title) +
      '\nPrice: ' + escapeForPrompt(ad.price) +
      '\nDescription: ' + escapeForPrompt(ad.description).substring(0, maxDescLength) +
      '\nURL: ' + escapeForPrompt(ad.url) + '\n---\n';
  }

  prompt += '\nRESPONSE FORMAT (JSON ONLY, NO EXTRA TEXT):\n{\n  "topDeals": [\n    {\n' +
    '      "title": "...",\n      "price": "...",\n      "description": "...",\n' +
    '      "url": "...",\n      "reasoning": "Why is this a top deal? (1-2 sentences)",\n' +
    '      "score": 85\n    }\n  ]\n}\n\nSort the top ' + topX +
    ' deals by quality (best first). Score is 0-100 (100 = absolute bargain).\n' +
    'Return ONLY valid JSON. No markdown, no code fences, no extra text.';

  return prompt;
}

/* ─── Helpers ─── */

/**
 * Waits while paused, checking every 500ms. Respects stop signal.
 */
async function waitIfPaused() {
  while (state.isPaused && !state.shouldStop) {
    await new Promise(function (r) { setTimeout(r, C.PAUSE_POLL_INTERVAL); });
  }
}

/**
 * Fetches the full description of a listing by loading its page and
 * extracting the description element using site-appropriate selectors.
 * Uses an LRU cache and retries on failure.
 * @param {string} url - Listing URL
 * @param {Array<Function>} descSelectors - Array of CSS selector strings
 * @param {number} [retryCount=0] - Current retry attempt
 * @returns {Promise<{ success: boolean, description: string, via?: string }>}
 */

/* ─── Description Extraction Pipeline ─── */

/**
 * Recursively searches an object for description-like fields.
 * Prioritizes nodes with recognized @type values (Product, Offer, etc.).
 * @param {*} obj - Parsed JSON to search
 * @param {number} [depth=0] - Current recursion depth
 * @returns {string|null}
 */
function deepFindDescription(obj, depth) {
  depth = depth || 0;
  if (!obj || typeof obj !== 'object' || depth > 10) return null;
  // Look for description/text/body on recognized schema types
  if (obj['@type']) {
    var typeStr = String(obj['@type']).toLowerCase();
    if (/product|offer|article|vehicle|residence|apartment|car/i.test(typeStr)) {
      if (typeof obj.description === 'string' && obj.description.trim().length > 20) return obj.description;
      if (typeof obj.body === 'string' && obj.body.trim().length > 20) return obj.body;
      if (typeof obj.teaser === 'string' && obj.teaser.trim().length > 20) return obj.teaser;
    }
  }
  // Generic check on current level
  if (typeof obj.description === 'string' && obj.description.trim().length > 20) return obj.description;
  if (typeof obj.body === 'string' && obj.body.trim().length > 20) return obj.body;
  if (typeof obj.text === 'string' && obj.text.trim().length > 100) return obj.text;
  // Recurse into arrays and objects
  if (Array.isArray(obj)) {
    for (var ai = 0; ai < obj.length; ai++) {
      var result = deepFindDescription(obj[ai], depth + 1);
      if (result) return result;
    }
  } else {
    var keys = Object.keys(obj);
    for (var ki = 0; ki < keys.length; ki++) {
      var val = obj[keys[ki]];
      if (val && typeof val === 'object') {
        var result = deepFindDescription(val, depth + 1);
        if (result) return result;
      }
    }
  }
  return null;
}

/**
 * Decodes common HTML entities in a string.
 * @param {string} str - String with potential HTML entities
 * @returns {string} Decoded string
 */
function decodeEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Multi-source description extraction from raw HTML.
 * Tries sources in priority order, picks the longest valid candidate.
 * @param {string} html - Raw HTML response text
 * @param {Array<string>} descSelectors - CSS selectors for site-specific DOM extraction
 * @returns {{ ok: boolean, via: string, text: string }}
 */
function extractDescriptionFromHtml(html, descSelectors) {
  var candidates = [];
  var push = function (via, text) {
    if (text) {
      var clean = decodeEntities(text).replace(/\s+/g, ' ').trim();
      if (clean.length >= 20) candidates.push({ via: via, text: clean });
    }
  };

  var doc = null;
  try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (e) { /* ignore */ }

  // 1) __NEXT_DATA__ (Willhaben / Next.js) — data is embedded in raw HTML
  try {
    var nextMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextMatch && nextMatch[1]) {
      var data = JSON.parse(nextMatch[1]);
      var nextDesc = deepFindDescription(data);
      push('next_data', nextDesc);
    }
  } catch (e) { /* JSON parse or regex failed — not a Next.js page */ }

  // 2) ALL JSON-LD blocks including @graph/arrays
  if (doc) {
    var ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (var ldi = 0; ldi < ldScripts.length; ldi++) {
      try {
        var json = JSON.parse(ldScripts[ldi].textContent);
        var nodes = Array.isArray(json) ? json : (json['@graph'] ? json['@graph'] : [json]);
        for (var ni = 0; ni < nodes.length; ni++) {
          var n = nodes[ni];
          if (n && typeof n.description === 'string') push('jsonld', n.description);
        }
      } catch (e) { /* JSON parse failed — skip this LD block */ }
    }
  }

  // 3) og:description / meta description (per DOM, not strict regex)
  if (doc) {
    var og = doc.querySelector('meta[property="og:description"]');
    if (og) push('og', og.getAttribute('content'));
    var metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc) push('meta', metaDesc.getAttribute('content'));
  }

  // 4) Site-specific DOM selectors (works for server-rendered pages like Kleinanzeigen)
  if (doc) {
    for (var si = 0; si < descSelectors.length; si++) {
      var el = doc.querySelector(descSelectors[si]);
      if (el && el.textContent.trim().length > 20) { push('dom', el.textContent); break; }
    }
    var ip = doc.querySelector('[itemprop="description"]');
    if (ip) push('itemprop', ip.textContent || ip.getAttribute('content'));
  }

  if (candidates.length === 0) return { ok: false, via: 'none', text: '' };
  // Pick the longest valid candidate — more content = better for AI evaluation
  candidates.sort(function (a, b) { return b.text.length - a.text.length; });
  return { ok: true, via: candidates[0].via, text: candidates[0].text };
}

/* ─── Persistent Description Cache (A-9 Ebene 2) ─── */

/**
 * Loads the persistent URL→description cache from GM storage.
 * Re-populates state.descriptionCache so descriptions survive page reloads.
 * @param {string} prefix - Storage prefix ("wh" or "ka")
 */
async function loadDescCache(prefix) {
  try {
    var raw = await GM.getValue(prefix + '_desc_cache', null);
    if (raw && typeof raw === 'object') {
      var keys = Object.keys(raw);
      for (var ki = 0; ki < keys.length; ki++) {
        if (raw[keys[ki]] && state.descriptionCache.size < C.MAX_CACHE_SIZE) {
          state.descriptionCache.set(keys[ki], raw[keys[ki]]);
        }
      }
      Logger.log('Loaded ' + state.descriptionCache.size + ' cached descriptions');
    }
  } catch (e) { Logger.debug('No desc cache to load'); }
}

/**
 * Persists the in-memory description cache to GM storage.
 * Capped at MAX_CACHE_SIZE entries; each description capped at 2000 chars.
 * @param {string} prefix - Storage prefix ("wh" or "ka")
 */
async function saveDescCache(prefix) {
  try {
    var obj = {};
    var count = 0;
    var entries = Array.from(state.descriptionCache.entries());
    for (var ei = 0; ei < entries.length && count < C.MAX_CACHE_SIZE; ei++) {
      var key = entries[ei][0];
      var val = entries[ei][1];
      if (val && key) {
        obj[key] = (val || '').slice(0, 2000);
        count++;
      }
    }
    await GM.setValue(prefix + '_desc_cache', obj);
  } catch (e) { Logger.debug('Failed to persist desc cache:', (e && e.message) || String(e)); }
}

/**
 * Fetches the full description from a listing's detail page.
 * Uses extractDescriptionFromHtml for multi-source extraction.
 * @param {string} url - Listing URL
 * @param {Array<string>} descSelectors - CSS selector strings
 * @param {number} [retryCount=0] - Current retry attempt
 * @returns {Promise<{ success: boolean, description: string, via?: string }>}
 */
function fetchFullDescription(url, descSelectors, retryCount) {
  retryCount = retryCount || 0;
  if (state.descriptionCache.has(url)) {
    const desc = state.descriptionCache.get(url);
    state.descriptionCache.delete(url);
    state.descriptionCache.set(url, desc);
    return Promise.resolve({ success: true, description: desc });
  }
  return new Promise(function (resolve) {
    var handle = null;
    var done = false;
    var abortSignal = state.abortController ? state.abortController.signal : null;

    function abortIfStopped() {
      if (done) return true;
      if (state.shouldStop || (abortSignal && abortSignal.aborted)) {
        done = true;
        try { if (handle && handle.abort) handle.abort(); } catch (e) { /* ignore */ }
        resolve({ success: false, description: '' });
        return true;
      }
      return false;
    }

    handle = GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      timeout: 10000,
      headers: {
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': window.location.href
      },
      onload: function (response) {
        if (abortIfStopped()) return;
        try {
          if (response.status >= 200 && response.status < 300) {
            var responseText = response.responseText;

            // Multi-source extraction pipeline: __NEXT_DATA__ → JSON-LD → OG/Meta → DOM selectors
            var extracted = extractDescriptionFromHtml(responseText, descSelectors);
            if (extracted.ok) {
              done = true;
              if (state.descriptionCache.size >= C.MAX_CACHE_SIZE) {
                const firstKey = state.descriptionCache.keys().next().value;
                state.descriptionCache.delete(firstKey);
              }
              state.descriptionCache.set(url, extracted.text);
              Logger.debug('Desc OK', { url: url, via: extracted.via, status: response.status, len: extracted.text.length });
              resolve({ success: true, description: extracted.text, via: extracted.via });
              return;
            }
            // No description found in any source — log for diagnosis
            Logger.debug('Desc MISS', { url: url, status: response.status, len: (responseText || '').length });
          } else {
            Logger.debug('Desc HTTP ' + response.status, { url: url, status: response.status });
            // 403/429 anti-bot — use longer base delay for retries (A-7)
            if (response.status === 403 || response.status === 429) {
              Logger.debug('Anti-bot response ' + response.status, { url: url, status: response.status });
            }
          }
        } catch (e) { Logger.debug('Desc parse error', { url: url, error: (e && e.message) || String(e) }); }
        if (abortIfStopped()) return;
        // Jittered backoff: 403/429 use 3× base delay (A-7)
        var antiBot = response.status === 403 || response.status === 429;
        var baseDelay = antiBot ? C.DESCRIPTION_FETCH_DELAY * 3 : C.DESCRIPTION_FETCH_DELAY;
        var delay = (baseDelay * Math.pow(C.DESCRIPTION_BACKOFF_FACTOR, retryCount)) * (1 + Math.random() * C.JITTER_FACTOR);
        if (retryCount < C.DESCRIPTION_MAX_RETRIES) {
          // B-3: Skip retry if already stopping — avoid wasted request
          if (state.shouldStop) { done = true; resolve({ success: false, description: '' }); return; }
          done = true;
          setTimeout(function () { fetchFullDescription(url, descSelectors, retryCount + 1).then(resolve); }, Math.round(delay));
        } else {
          done = true;
          resolve({ success: false, description: '' });
        }
      },
      onerror: function () {
        if (abortIfStopped()) return;
        var delay = (C.DESCRIPTION_FETCH_DELAY * Math.pow(C.DESCRIPTION_BACKOFF_FACTOR, retryCount)) * (1 + Math.random() * C.JITTER_FACTOR);
        if (retryCount < C.DESCRIPTION_MAX_RETRIES) {
          if (state.shouldStop) { done = true; resolve({ success: false, description: '' }); return; }
          done = true;
          setTimeout(function () { fetchFullDescription(url, descSelectors, retryCount + 1).then(resolve); }, Math.round(delay));
        } else {
          done = true;
          resolve({ success: false, description: '' });
        }
      },
      ontimeout: function () {
        if (abortIfStopped()) return;
        var delay = (C.DESCRIPTION_FETCH_DELAY * Math.pow(C.DESCRIPTION_BACKOFF_FACTOR, retryCount)) * (1 + Math.random() * C.JITTER_FACTOR);
        if (retryCount < C.DESCRIPTION_MAX_RETRIES) {
          if (state.shouldStop) { done = true; resolve({ success: false, description: '' }); return; }
          done = true;
          setTimeout(function () { fetchFullDescription(url, descSelectors, retryCount + 1).then(resolve); }, Math.round(delay));
        } else {
          done = true;
          resolve({ success: false, description: '' });
        }
      }
    });
  });
}

/**
 * Persists crawl state and navigates to next page.
 * @param {string} href - Next page URL
 * @param {Object} settings - Current settings
 */
async function saveCrawlStateAndNavigate(href, settings) {
  // Save allTopDeals with descriptions capped at 2000 chars to avoid
  // "Message length exceeded" on large crawls while preserving descriptions
  // across page reloads. Without description, only the last page's deals
  // retain their text — all previous pages' descriptions are lost.
  var strippedDeals = [];
  for (var di = 0; di < state.allTopDeals.length; di++) {
    var d = state.allTopDeals[di];
    strippedDeals.push({
      url: d.url,
      title: d.title,
      price: d.price,
      score: d.score,
      page: d.page,
      reasoning: d.reasoning,
      description: (d.description || '').slice(0, 2000)
    });
  }
  const crawlState = {
    currentPage: state.currentPage,
    currentUrl: window.location.href,
    allTopDeals: strippedDeals,
    maxPages: settings.maxPages
  };
  await saveCrawlState(crawlState, state.scraper.storagePrefix);
  // Signal to resumeCrawlIfActive that this is a script-initiated navigation.
  // Stores the expected target URL so a failed/different navigation won't match.
  await saveSetting(
    state.scraper.storagePrefix + '_dealfinder_resume',
    // goToNextPage returns raw DOM href attributes (e.g. "?page=2", "/s-seite:2").
    // Resolve against current URL so the flag matches window.location.href after navigation.
    JSON.stringify({ u: normalizeUrl(new URL(href, window.location.href).href) })
  );
  window.location.href = href;
}

/* ─── Crawl Orchestration ─── */

/**
 * Starts the deal finding process.
 * Reads settings from UI inputs, validates, and begins crawling.
 */
async function startDealFinder() {
  const prefix = state.scraper.storagePrefix;

  // Guard: prevent duplicate crawls
  if (state.isRunning) {
    Logger.warn('Crawl already running, ignoring duplicate start');
    return;
  }

  const apiKey = state.uiRoot.getElementById(prefix + '-api-key').value.trim();
  const modelId = state.uiRoot.getElementById(prefix + '-model-id').value.trim();
  const searchContext = state.uiRoot.getElementById(prefix + '-search-context').value.trim();
  const topX = parseInt(state.uiRoot.getElementById(prefix + '-top-x').value);
  const maxPages = parseInt(state.uiRoot.getElementById(prefix + '-max-pages').value) || 10;
  const providerType = state.uiRoot.getElementById(prefix + '-provider-select')
    ? state.uiRoot.getElementById(prefix + '-provider-select').value
    : 'gemini';
  const baseUrl = state.uiRoot.getElementById(prefix + '-base-url')
    ? state.uiRoot.getElementById(prefix + '-base-url').value.trim()
    : '';

  if (!apiKey) { alert('Bitte gib deinen API Key ein!'); return; }
  if (!searchContext) { alert('Bitte gib einen Suchkontext ein!'); return; }
  if (!Number.isFinite(topX) || topX < 1 || topX > 10) { alert('AI-Picks muss zwischen 1 und 10 liegen!'); return; }
  if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 100) { alert('Maximale Seiten muss zwischen 1 und 100 liegen!'); return; }

  // Load settings, update with current values, persist
  const result = await loadSettings(prefix, state.cachedSettings);
  state.cachedSettings = result.cachedSettings;
  const settings = result.settings;

  settings.currentProvider = providerType;
  settings.provider = {
    type: providerType,
    apiKey: apiKey,
    modelId: modelId,
    baseUrl: baseUrl,
    options: settings.provider.options || {}
  };
  settings.searchContext = searchContext;
  settings.topX = topX;
  settings.maxPages = maxPages;
  await saveSettings(prefix, settings);
  // Sync in-memory cache so finishDealFinder (re-ranking) sees fresh values
  state.cachedSettings = deepCopySettings(settings);
  state.cachedSettings.provider = state.cachedSettings.providers[state.cachedSettings.currentProvider] || {};

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()['catch'](function () {});
  }

  // Create AbortController so Stop can cancel in-flight API calls
  state.abortController = new AbortController();

  // Load persistent URL→description cache so descriptions survive page reloads
  await loadDescCache(prefix);

  state.currentPage = 1;
  state.allTopDeals = [];
  state.isRunning = true;
  state.isPaused = false;
  state.shouldStop = false;
  state.captchaPaused = false;
  state.finished = false;

  setUIRunningState(prefix);

  try {
    await processCurrentPage(settings);
  } catch (error) {
    Logger.error('Error:', error);
    updateProgress(prefix, 'Fehler: ' + error.message, 0, 'error');
    if (state.allTopDeals.length > 0) {
      await finishDealFinder();
    } else {
      resetUI(prefix);
      alert('Fehler: ' + error.message);
    }
  }
}

/**
 * Pauses the crawl.
 */
function pauseDealFinder() {
  state.isPaused = true;
  const prefix = state.scraper.storagePrefix;
  const pauseBtn = state.uiRoot.getElementById(prefix + '-pause-btn');
  if (!pauseBtn) return;
  pauseBtn.textContent = 'Fortsetzen';
  pauseBtn.style.background = '#28a745';
  pauseBtn.removeEventListener('click', pauseDealFinder);
  pauseBtn.addEventListener('click', resumeDealFinder);
  updateProgress(prefix, 'Pausiert - Klicke Fortsetzen...', 50, 'warning');
}

/**
 * Resumes the crawl after pause.
 */
function resumeDealFinder() {
  state.isPaused = false;
  const prefix = state.scraper.storagePrefix;
  const pauseBtn = state.uiRoot.getElementById(prefix + '-pause-btn');
  if (!pauseBtn) return;
  pauseBtn.textContent = 'Pause';
  pauseBtn.style.background = '#ffc107';
  pauseBtn.removeEventListener('click', resumeDealFinder);
  pauseBtn.addEventListener('click', pauseDealFinder);

  if (state.isRunning && state.captchaPaused) {
    state.captchaPaused = false;
    const cs = state.cachedSettings || {};
    processCurrentPage(cs)['catch'](function (error) {
      Logger.error('Resume error:', error);
      updateProgress(prefix, 'Fehler: ' + error.message, 0, 'error');
      if (state.allTopDeals.length > 0) {
        finishDealFinder()['catch'](function (e) { Logger.error('finishDealFinder after resume error:', e); });
      } else {
        resetUI(prefix);
      }
    });
  }
}

/**
 * Stops the crawl gracefully.
 */
async function stopDealFinder() {
  state.shouldStop = true;
  state.isPaused = false;
  state.captchaPaused = false;
  // Cancel any in-flight API call immediately
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  const prefix = state.scraper.storagePrefix;
  await clearCrawlState(prefix);
  Logger.log('Crawl stopped by user');
  updateProgress(prefix, 'Stoppe nach aktueller Seite...', 95, 'warning');
}

/**
 * Processes a single search results page.
 * @param {Object} settings - Current settings object
 */
async function processCurrentPage(settings) {
  const prefix = state.scraper.storagePrefix;
  const scraper = state.scraper;
  const maxPages = settings.maxPages || 10;

  await waitIfPaused();
  if (state.shouldStop) { await finishDealFinder(); return; }
  if (state.currentPage > maxPages) { await finishDealFinder(); return; }

  updateProgress(prefix, 'Seite ' + state.currentPage + ': Lade alle Anzeigen...', 10, 'info');

  // Trigger lazy-load by scrolling gradually, then wait for DOM to settle.
  // A MutationObserver watches the result container; we consider loading
  // "done" when no new elements have been added for a settle period
  // (or a hard timeout is reached).
  var settleMs = 800;
  var hardTimeoutMs = 8000;
  var scrollDone = false;

  // Gradual scroll: bottom first (2s), short pause, then back to top (1.5s).
  // Slow, controlled scrolling gives lazy-load images time to trigger and
  // avoids overwhelming the MutationObserver.
  await gradualScroll(document.body.scrollHeight, 2000);
  scrollDone = true;
  await new Promise(function (r) { setTimeout(r, 500); });
  await gradualScroll(0, 1500);

  // Observe document.body for DOM mutations (lazy-loaded ad cards)
  var settleTimer = null;
  var observerDone = false;

  await new Promise(function (resolveObserve) {
    var observer = new MutationObserver(function () {
      if (!scrollDone) return;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        observer.disconnect();
        clearTimeout(hardTimer);
        observerDone = true;
        resolveObserve();
      }, settleMs);
    });

    var hardTimer = setTimeout(function () {
      try { observer.disconnect(); } catch (e) { /* ignore */ }
      observerDone = true;
      resolveObserve();
    }, hardTimeoutMs);

    observer.observe(document.body, { childList: true, subtree: true });

    // If no mutations happen at all, resolve after settleMs + scroll time
    setTimeout(function () {
      if (!observerDone) {
        observer.disconnect();
        clearTimeout(hardTimer);
        observerDone = true;
        resolveObserve();
      }
    }, settleMs + 1500);
  });

  updateProgress(prefix, 'Seite ' + state.currentPage + ': Sammle Anzeigen...', 15, 'info');
  const selectors = scraper.findAds();
  if (!selectors) {
    // Check for known CAPTCHA containers first (specific), then fall back
    // to keyword match in page text (broad — can false-positive).
    const captchaSelectors = [
      'iframe[src*="challenges.cloudflare.com"]',
      'iframe[src*="hcaptcha.com"]',
      'iframe[src*="google.com/recaptcha"]',
      '#challenge-form',
      '.g-recaptcha',
      '[id*="captcha"]',
      '[class*="captcha"]'
    ];
    var hasCaptchaElement = false;
    for (var ci = 0; ci < captchaSelectors.length; ci++) {
      if (document.querySelector(captchaSelectors[ci])) {
        hasCaptchaElement = true;
        break;
      }
    }
    const pageText = (document.title + ' ' + document.body.innerText).toLowerCase();
    if (hasCaptchaElement || pageText.indexOf('captcha') !== -1 || pageText.indexOf('challenge') !== -1) {
      state.captchaPaused = true;
      const crawlState = {
        currentPage: state.currentPage,
        currentUrl: window.location.href,
        allTopDeals: state.allTopDeals,
        maxPages: maxPages
      };
      await saveCrawlState(crawlState, prefix);
      pauseDealFinder();
      updateProgress(prefix, 'CAPTCHA erkannt! Bitte loesen und Fortsetzen klicken', 50, 'warning');
      return;
    }
    throw new Error('Keine Anzeigen gefunden');
  }

  updateProgress(prefix, 'Seite ' + state.currentPage + ': Sammle Basis-Daten...', 20, 'info');
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
  Logger.log(adsData.length + ' ads found (deduplicated)');

  updateProgress(prefix, 'Seite ' + state.currentPage + ': Lade Details (0/' + adsData.length + ')...', 30, 'info');
  let completedCount = 0;

  for (let bi = 0; bi < adsData.length; bi += C.INITIAL_BATCH_SIZE) {
    await waitIfPaused();
    if (state.shouldStop) break;

    const batch = adsData.slice(bi, Math.min(bi + C.INITIAL_BATCH_SIZE, adsData.length));
    const batchFns = batch.map(function (ad, idx) {
      const absoluteIndex = bi + idx;
      const fetchPromise = ad.url && ad.url.indexOf('http') === 0
        ? fetchFullDescription(ad.url, scraper.descSelectors())
        : Promise.resolve({ success: false, description: '' });
      return fetchPromise.then(function (result) {
        completedCount++;
        if (completedCount % 5 === 0 || completedCount === adsData.length) {
          updateProgress(prefix, 'Seite ' + state.currentPage + ': Lade Details (' + completedCount + '/' + adsData.length + ')...',
            30 + (completedCount / adsData.length) * 40, 'info');
        }
        adsData[absoluteIndex].description = result.description;
      });
    });
    // Each description fetch has its own timeout (10s + retries), so
    // they are guaranteed to resolve eventually. Promise.allSettled
    // ensures we wait for ALL fetches before proceeding to the AI call.
    // No artificial deadline — late-arriving descriptions are preserved.
    await Promise.allSettled(batchFns);

    // E-1: Adaptive inter-batch delay. Base 500ms + jitter.
    if (bi + C.INITIAL_BATCH_SIZE < adsData.length) {
      await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 1000); });
    }
  }

  if (state.shouldStop) { await finishDealFinder(); return; }

  // Diagnostic: count how many descriptions were successfully fetched this page
  var descOk = 0;
  for (var dci = 0; dci < adsData.length; dci++) {
    if (adsData[dci].description) descOk++;
  }
  Logger.log('Descriptions: ' + descOk + '/' + adsData.length + ' on page ' + state.currentPage);
  // E-1: Warn if anti-bot measures are likely blocking description fetches
  if (adsData.length > 4 && descOk < adsData.length * 0.3) {
    Logger.warn('Low description yield (' + descOk + '/' + adsData.length + ') — possible anti-bot throttling. Consider reducing page count or waiting between crawls.');
  }
  // Persist the description cache so it survives page reloads
  saveDescCache(prefix)['catch'](function (e) { Logger.debug('saveDescCache:', (e && e.message) || String(e)); });

  updateProgress(prefix, 'Seite ' + state.currentPage + ': AI analysiert Angebote...', 75, 'info');
  Logger.log('Sending ' + adsData.length + ' listings to ' + settings.provider.type + '...');

  const prompt = buildAnalysisPrompt(adsData, settings.searchContext, settings.topX, scraper.siteName);
  const aiCallStart = Date.now();

  const onRetry = function (retryNum, error) {
    showWarning(prefix, 'API ' + (error.status || 'error') + ' - Retry ' + retryNum + '...', 75);
  };

  let aiResult = null;
  try {
    aiResult = await callAI(prompt, {
      providerType: settings.provider.type,
      apiKey: settings.provider.apiKey,
      modelId: settings.provider.modelId,
      baseUrl: settings.provider.baseUrl || undefined,
      providerOptions: settings.provider.options || {}
    }, {
      temperature: 0.1,
      maxOutputTokens: C.getMaxTokensForProvider(settings.provider.type),
      onRetry: onRetry,
      signal: state.abortController && state.abortController.signal
    });
    Logger.log('AI response received in ' + (Date.now() - aiCallStart) + 'ms');
  } catch (error) {
    if (error.name === 'AbortError' || state.shouldStop) {
      await finishDealFinder();
      return;
    }
    // Salvage path (C-3): Try a simplified second request with strict JSON
    // instruction before giving up on this page entirely.
    Logger.warn('AI analysis failed — attempting salvage retry...');
    updateProgress(prefix, 'Seite ' + state.currentPage + ': Erneuter Analyse-Versuch...', 75, 'warning');
    try {
      var salvagePrompt = 'Return ONLY a JSON object with a "topDeals" array containing exactly ' + (
        Math.min(3, adsData.length)) + ' deals. Format: {"topDeals":[{"title":"...","price":"...","score":0-100,"reasoning":"...","url":"..."}]}. ' +
        'If you cannot analyze these listings, return {"topDeals":[]}. DO NOT add commentary.';
      var salvageListingData = adsData.slice(0, Math.min(20, adsData.length)).map(function (ad) {
        return (ad.title || '') + ' | ' + (ad.price || '') + ' | ' + (ad.url || '');
      }).join('\n');
      aiResult = await callAI(salvagePrompt + '\n\nListings:\n' + salvageListingData, {
        providerType: settings.provider.type,
        apiKey: settings.provider.apiKey,
        modelId: settings.provider.modelId,
        baseUrl: settings.provider.baseUrl || undefined,
        providerOptions: settings.provider.options || {}
      }, {
        temperature: 0,
        maxOutputTokens: 4096,
        signal: state.abortController && state.abortController.signal
      });
      Logger.log('Salvage retry succeeded');
    } catch (salvageError) {
      if (salvageError.name === 'AbortError' || state.shouldStop) {
        await finishDealFinder();
        return;
      }
      Logger.warn('Salvage retry also failed — using price heuristics for this page');
      // Last resort: pick top deals by price heuristic (cheapest = best deal)
      var priceAds = adsData.filter(function (ad) { return ad.price && ad.url; });
      priceAds.sort(function (a, b) {
        var pa = parseFloat(String(a.price).replace(/[^0-9,.-]/g, '').replace(',', '.'));
        var pb = parseFloat(String(b.price).replace(/[^0-9,.-]/g, '').replace(',', '.'));
        return (isNaN(pa) ? Infinity : pa) - (isNaN(pb) ? Infinity : pb);
      });
      var fallbackTopX = Math.min(settings.topX, priceAds.length);
      aiResult = {
        topDeals: priceAds.slice(0, fallbackTopX).map(function (ad, idx) {
          return {
            title: ad.title || 'Unknown',
            price: ad.price || 'Unknown',
            score: Math.round(80 - idx * 5),  // descending heuristic scores
            reasoning: 'Preis-Heuristik (KI-Analyse nicht verfuegbar)',
            url: ad.url
          };
        })
      };
    }
  }

  if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
    Logger.log('AI found ' + aiResult.topDeals.length + ' top deals');
    // Build URL→description map from scraped data to merge into AI results.
    // Also build a path-only index as fallback — AI may return URLs with
    // different query params or fragments than what was scraped.
    const scrapedDescs = new Map();
    const pathDescs = new Map();
    for (let adi = 0; adi < adsData.length; adi++) {
      if (adsData[adi].description && adsData[adi].url) {
        scrapedDescs.set(adsData[adi].url, adsData[adi].description);
        try {
          var pUrl = new URL(adsData[adi].url);
          var pathKey = pUrl.hostname + pUrl.pathname;
          if (!pathDescs.has(pathKey)) pathDescs.set(pathKey, adsData[adi].description);
        } catch (e) { /* ignore malformed URL */ }
      }
    }
    for (let tdi = 0; tdi < aiResult.topDeals.length; tdi++) {
      const rawDeal = aiResult.topDeals[tdi];
      // Prefer the scraped full description over the AI's summary — it's the
      // ground-truth listing text needed for the final re-ranking prompt.
      let description = rawDeal.description || '';
      // Normalize AI-returned URL for lookup (may have fragment/different format)
      var lookupKey = normalizeUrl(rawDeal.url) || rawDeal.url;
      var fullDesc = lookupKey && scrapedDescs.has(lookupKey) ? scrapedDescs.get(lookupKey) : '';
      // Path-only fallback: match by hostname+pathname ignoring query string
      if (!fullDesc && lookupKey) {
        try {
          var lUrl = new URL(lookupKey);
          var lPathKey = lUrl.hostname + lUrl.pathname;
          fullDesc = pathDescs.get(lPathKey) || '';
        } catch (e) { /* ignore */ }
      }
      if (fullDesc) description = fullDesc;
      const normalized = {
        title: rawDeal.title || 'Unknown',
        price: rawDeal.price || 'Unknown',
        description: description || '',
        url: normalizeUrl(rawDeal.url) || '',
        score: rawDeal.score,
        reasoning: rawDeal.reasoning || rawDeal.reason || 'Keine Begruendung',
        page: state.currentPage
      };
      state.allTopDeals.push(normalized);
    }
    updateProgress(prefix, 'Seite ' + state.currentPage + ': ' + aiResult.topDeals.length + ' Top-Deals gefunden!', 90, 'success');
    updateLiveRanking(prefix, state.allTopDeals, state.cachedSettings);
  }

  await new Promise(function (r) { setTimeout(r, C.PAGE_TRANSITION_DELAY); });

  if (!state.shouldStop) {
    const nextUrl = scraper.goToNextPage(state.currentPage);
    if (nextUrl) {
      Logger.log('Navigating to next page: ' + nextUrl);
      await saveCrawlStateAndNavigate(nextUrl, settings);
    } else {
      Logger.log('No more pages available - ending crawl');
      await finishDealFinder();
    }
  } else {
    await finishDealFinder();
  }
}

/**
 * Finalizes the deal finding process.
 */
async function finishDealFinder() {
  // Idempotency guard — prevent double invocation from processCurrentPage
  // and startDealFinder's catch block (B9).
  if (state.finished) return;
  state.finished = true;

  const prefix = state.scraper.storagePrefix;
  updateProgress(prefix, 'Erstelle finale Ranking-Liste...', 95, 'info');
  await clearCrawlState(prefix);

  if (state.allTopDeals.length === 0) {
    updateProgress(prefix, 'Keine Deals gefunden!', 100, 'error');
    alert('Keine Top-Deals gefunden! Versuche andere Suchkriterien.');
    state.allTopDeals = [];
    resetUI(prefix);
    return;
  }

  if (state.shouldStop) {
    updateProgress(prefix, 'Crawl gestoppt. Speichere bisherige Deals...', 100, 'warning');
    const dedupedStopped = deduplicateDeals(state.allTopDeals);
    await saveResults({ deals: dedupedStopped, pages: state.currentPage, timestamp: new Date().toISOString() }, prefix);
    switchToResultsView(prefix, dedupedStopped);
    attachResultsListeners(prefix, makeResultsCallbacks(prefix));
    state.allTopDeals = [];
    resetUI(prefix);
    return;
  }

  // Deduplicate across pages
  const deduped = deduplicateDeals(state.allTopDeals);
  state.allTopDeals = deduped;

  // Global re-ranking via AI (if enough deals AND valid provider configured).
  // Skip re-ranking when provider.apiKey is missing — the hardcoded fallback
  // would use the wrong credentials and fail silently. Deals are already
  // sorted by per-page score, so results remain usable without re-ranking.
  var cs = state.cachedSettings || {};
  var canReRank = cs.provider && cs.provider.apiKey && cs.provider.type;
  if (state.allTopDeals.length > 1 && canReRank) {
    updateProgress(prefix, 'Globales Re-Ranking aller Deals...', 97, 'info');
    try {
      const sortedTopDeals = sortDealsByScore(state.allTopDeals);
      const dealsToReRank = sortedTopDeals.slice(0, C.RE_RANK_MAX_DEALS);

      const reRankPrompt = buildAnalysisPrompt(
        dealsToReRank.map(function (d) {
          return {
            title: d.title,
            price: d.price,
            description: d.description || '',  // pass full description, no truncation
            url: d.url
          };
        }),
        cs.searchContext || '',
        dealsToReRank.length,
        state.scraper.siteName,
        3000  // higher limit so the re-ranking AI sees the full listing text
      );

      const reRankResult = await callAI(reRankPrompt, {
        providerType: cs.provider.type,
        apiKey: cs.provider.apiKey,
        modelId: cs.provider.modelId,
        baseUrl: cs.provider.baseUrl || undefined,
        providerOptions: cs.provider.options || {}
      }, { temperature: 0.1, maxOutputTokens: C.getMaxTokensForProvider(cs.provider.type), signal: state.abortController && state.abortController.signal });

      if (reRankResult && reRankResult.topDeals) {
        const urlToDeal = new Map();
        for (let ri = 0; ri < dealsToReRank.length; ri++) {
          urlToDeal.set(dealsToReRank[ri].url, dealsToReRank[ri]);
        }
        const reRankedDeals = reRankResult.topDeals.map(function (rd) {
          const orig = urlToDeal.get(rd.url);
          return {
            title: (orig && orig.title) || rd.title,
            price: (orig && orig.price) || rd.price,
            description: (orig && orig.description) || rd.description,
            url: (orig && orig.url) || rd.url,
            score: rd.score,
            reasoning: rd.reasoning || rd.reason || '',
            page: (orig && orig.page) || 'unknown'
          };
        });
        const reRankedUrls = new Set(reRankedDeals.map(function (d) { return d.url; }));
        const remainingDeals = sortedTopDeals.filter(function (d) { return !reRankedUrls.has(d.url); });
        // Final sort by score descending — ensures the array is ordered correctly
        // regardless of AI output order. Per-page and re-ranking scores may not be
        // perfectly calibrated, but a deterministic sort is better than gambling on
        // the LLM's positional ordering.
        state.allTopDeals = sortDealsByScore(reRankedDeals.concat(remainingDeals));
        Logger.log('Global re-ranking complete');
      }
    } catch (e) {
      Logger.warn('Global re-ranking failed:', e);
      showWarning(prefix, 'Re-Ranking fehlgeschlagen — Ergebnisse ohne Neusortierung', 95);
    }
  }

  // Ebene 3 — Refetch-Garantie: For each top deal with missing/short description,
  // fetch the detail page one more time. This is a targeted refetch of at most
  // a few URLs, ensuring every exported deal has a description if the source
  // provides one.
  var refetchCount = 0;
  for (var rfi = 0; rfi < state.allTopDeals.length; rfi++) {
    var deal = state.allTopDeals[rfi];
    if (!deal.description || deal.description.length < 20) {
      try {
        var refetched = await fetchFullDescription(deal.url, state.scraper.descSelectors());
        if (refetched && refetched.success && refetched.description) {
          deal.description = refetched.description;
          refetchCount++;
        }
      } catch (e) { /* refetch failed — leave description as-is */ }
    }
  }
  if (refetchCount > 0) Logger.log('Refetch filled ' + refetchCount + ' missing descriptions');

  await saveResults({ deals: state.allTopDeals, pages: state.currentPage, timestamp: new Date().toISOString() }, prefix);
  updateProgress(prefix, state.allTopDeals.length + ' Deals gespeichert!', 100, 'success');

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Deal Finder fertig', {
        body: state.allTopDeals.length + ' Deals auf ' + state.currentPage + ' Seiten gefunden'
      });
    } catch (e) { /* ignore */ }
  }

  switchToResultsView(prefix, state.allTopDeals);
  attachResultsListeners(prefix, makeResultsCallbacks(prefix));
  state.allTopDeals = [];
  resetUI(prefix);
}

/* ─── Settings UI Setup ─── */

/**
 * Loads settings and renders settings view, wires listeners.
 * @param {Object} scraper - Scraper object from getScraper()
 */
export async function setupSettingsView(scraper) {
  const prefix = scraper.storagePrefix;
  const result = await loadSettings(prefix, state.cachedSettings);
  state.cachedSettings = result.cachedSettings;
  const settings = result.settings;
  const savedResults = await loadResults(prefix);

  if (!state.uiContent) return;
  state.uiContent.innerHTML = renderSettingsView(prefix, settings, savedResults, scraper.siteName);

  attachSettingsListeners(prefix, {
    start: startDealFinder,
    pause: pauseDealFinder,
    stop: stopDealFinder,
    close: function () {
      const isRunning = state.isRunning;
      closeModal(prefix, isRunning);
    },
    showSavedResults: async function () {
      const sr = await loadResults(prefix);
      if (sr) {
        switchToResultsView(prefix, sr.deals);
        attachResultsListeners(prefix, makeResultsCallbacks(prefix));
      }
    },
    apiKeyChange: async function (newKey) {
      const s = await loadSettings(prefix, state.cachedSettings);
      state.cachedSettings = s.cachedSettings;
      const settingsObj = s.settings;
      if (settingsObj.provider.apiKey !== newKey) {
        settingsObj.provider.apiKey = newKey;
        await saveSettings(prefix, settingsObj);
        state.cachedSettings = deepCopySettings(settingsObj);
      }
    },
    searchContextChange: async function (newContext) {
      const s = await loadSettings(prefix, state.cachedSettings);
      state.cachedSettings = s.cachedSettings;
      const settingsObj = s.settings;
      if (settingsObj.searchContext !== newContext) {
        settingsObj.searchContext = newContext;
        await saveSettings(prefix, settingsObj);
        state.cachedSettings = deepCopySettings(settingsObj);
      }
    },
    providerChange: async function (newType) {
      const s = await loadSettings(prefix, state.cachedSettings);
      state.cachedSettings = s.cachedSettings;
      const settingsObj = s.settings;
      if (settingsObj.currentProvider !== newType) {
        settingsObj.currentProvider = newType;
        // Load saved provider config — preserves apiKey, modelId per provider
        settingsObj.provider = settingsObj.providers[newType] || {};
        // Ensure .type is always set so the dropdown renders correctly
        settingsObj.provider.type = newType;
        if (!settingsObj.provider.modelId) {
          settingsObj.provider.modelId = getDefaultModelForProvider(newType);
        }
        await saveSettings(prefix, settingsObj);
        state.cachedSettings = deepCopySettings(settingsObj);
        state.cachedSettings.provider = state.cachedSettings.providers[state.cachedSettings.currentProvider] || {};
        // Re-render to update model presets and per-provider fields
        await setupSettingsView(scraper)['catch'](function (err) {
          Logger.error('Re-render after provider change failed:', err);
        });
      }
    },
    modelIdChange: async function (newId) {
      const s = await loadSettings(prefix, state.cachedSettings);
      state.cachedSettings = s.cachedSettings;
      const settingsObj = s.settings;
      if (settingsObj.provider.modelId !== newId) {
        settingsObj.provider.modelId = newId;
        // Reset options unless a matching preset with options exists
        const matchingPreset = (C.MODEL_PRESETS[settingsObj.currentProvider] || []).find(function (p) { return p.id === newId; });
        settingsObj.provider.options = matchingPreset && matchingPreset.options ? matchingPreset.options : {};
        await saveSettings(prefix, settingsObj);
        state.cachedSettings = deepCopySettings(settingsObj);
        // Sync preset button highlights — custom IDs de-highlight all buttons
        state.uiRoot.querySelectorAll('#' + prefix + '-model-presets [data-model-id]').forEach(function (btn) {
          const isActive = btn.getAttribute('data-model-id') === newId;
          btn.style.background = isActive ? '#6366f1' : '#f8f9fa';
          btn.style.color = isActive ? '#fff' : '#333';
          btn.style.borderColor = isActive ? '#6366f1' : '#ddd';
        });
      }
    },
    modelPresetClick: async function (modelId, options) {
      const modelIdInput = state.uiRoot.getElementById(prefix + '-model-id');
      if (modelIdInput) {
        modelIdInput.value = modelId;
        const s = await loadSettings(prefix, state.cachedSettings);
        s.settings.provider.modelId = modelId;
        if (options) s.settings.provider.options = options;
        await saveSettings(prefix, s.settings);
        state.cachedSettings = deepCopySettings(s.settings);
        // Update preset button highlights visually
        state.uiRoot.querySelectorAll('#' + prefix + '-model-presets [data-model-id]').forEach(function (btn) {
          const isActive = btn.getAttribute('data-model-id') === modelId;
          btn.style.background = isActive ? '#6366f1' : '#f8f9fa';
          btn.style.color = isActive ? '#fff' : '#333';
          btn.style.borderColor = isActive ? '#6366f1' : '#ddd';
        });
      }
    },
    baseUrlChange: async function (newUrl) {
      const s = await loadSettings(prefix, state.cachedSettings);
      state.cachedSettings = s.cachedSettings;
      const settingsObj = s.settings;
      if (settingsObj.provider.baseUrl !== newUrl) {
        settingsObj.provider.baseUrl = newUrl;
        await saveSettings(prefix, settingsObj);
        state.cachedSettings = deepCopySettings(settingsObj);
      }
    },
    portkeyConfigChange: async function (newConfig) {
      const s = await loadSettings(prefix, state.cachedSettings);
      state.cachedSettings = s.cachedSettings;
      const settingsObj = s.settings;
      if (!settingsObj.provider.options) settingsObj.provider.options = {};
      if (settingsObj.provider.options.config !== newConfig) {
        settingsObj.provider.options.config = newConfig;
        await saveSettings(prefix, settingsObj);
        state.cachedSettings = deepCopySettings(settingsObj);
      }
    }
  });
}

/**
 * Gets default model ID for a provider type.
 * @param {string} providerType
 * @returns {string}
 */
function getDefaultModelForProvider(providerType) {
  const presets = C.MODEL_PRESETS[providerType];
  return presets && presets.length > 0 ? presets[0].id : 'gemini-2.5-flash';
}

/**
 * Creates callbacks object for results view.
 * @param {string} prefix
 * @returns {Object}
 */
function makeResultsCallbacks(prefix) {
  return {
    close: function () { closeModal(prefix, state.isRunning); },
    backToSettings: function () { setupSettingsView(state.scraper); },
    exportMarkdown: async function () {
      await exportMarkdown(prefix);
    },
    exportJSON: function () {
      exportJSON(prefix);
    },
    exportCSV: function () {
      exportCSV(prefix);
    },
    clearResults: async function () {
      if (!confirm('Moechtest du die gespeicherten Results wirklich loeschen?')) return;
      await clearResults(prefix);
      setupSettingsView(state.scraper);
    }
  };
}

/* ─── Resume Logic ─── */

/**
 * Checks for persisted crawl state and resumes if found.
 * @param {Object} scraper - Scraper object
 */
export async function resumeCrawlIfActive(scraper) {
  const prefix = scraper.storagePrefix;
  const rawState = await loadCrawlState(prefix);
  if (!rawState) {
    Logger.log('Normal session');
    return;
  }

  // Validate that the current page actually has search results before resuming.
  // A stale crawl state from a previous session should not auto-resume on a
  // non-results page (e.g. single listing, different search).
  const currentAds = scraper.findAds();
  if (!currentAds) {
    Logger.log('Stale crawl state found but current page has no search results — clearing');
    await clearCrawlState(prefix);
    return;
  }

  const normalizedCurrentUrl = normalizeUrl(rawState.currentUrl);
  const normalizedWindowUrl = normalizeUrl(window.location.href);
  const samePage = normalizedCurrentUrl && normalizedCurrentUrl === normalizedWindowUrl;

  // B-1: Loose URL match — same path + core query params (ignores tracking params
  // like utm_*, fbclid, etc. that sites may add dynamically). This prevents
  // crawl state from being cleared when the URL has only cosmetic differences.
  var looseMatch = false;
  if (!samePage && normalizedCurrentUrl && normalizedWindowUrl) {
    try {
      var savedUrl = new URL(normalizedCurrentUrl);
      var currentUrl = new URL(normalizedWindowUrl);
      if (savedUrl.hostname === currentUrl.hostname &&
          savedUrl.pathname.replace(/\/$/, '') === currentUrl.pathname.replace(/\/$/, '')) {
        // Compare search/query params ignoring known tracking keys
        var trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
          'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ref', 'source', 'campaign'];
        var savedParams = new URLSearchParams(savedUrl.search);
        var currentParams = new URLSearchParams(currentUrl.search);
        trackingKeys.forEach(function (k) { savedParams.delete(k); currentParams.delete(k); });
        savedParams.sort(); currentParams.sort();
        if (savedParams.toString() === currentParams.toString()) {
          looseMatch = true;
          Logger.log('Loose URL match — same search, different tracking params');
        }
      }
    } catch (e) { /* ignore — fall through to strict match only */ }
  }

  // Consume the script-navigation flag to distinguish script-initiated
  // navigation (multi-page crawl) from a user navigating to a new search.
  // The flag stores the expected target URL so a failed redirect or
  // manual navigation to a different page won't match.
  const resumeRaw = await loadSetting(prefix + '_dealfinder_resume', null);
  await saveSetting(prefix + '_dealfinder_resume', null);
  let isScriptNavigation = false;
  if (resumeRaw) {
    try {
      const flag = JSON.parse(resumeRaw);
      isScriptNavigation = normalizeUrl(flag.u || '') === normalizeUrl(window.location.href);
    } catch (e) { /* ignore malformed flag */ }
  }

  if (!isScriptNavigation && !samePage && !looseMatch) {
    Logger.log('Stale crawl state from different search — clearing');
    await clearCrawlState(prefix);
    return;
  }
  const pageIncrement = samePage ? C.SAME_PAGE_INCREMENT : C.NEW_PAGE_INCREMENT;
  Logger.log('Crawl state found - resuming from page ' + (rawState.currentPage + pageIncrement));

  state.currentPage = rawState.currentPage + pageIncrement;
  state.allTopDeals = rawState.allTopDeals || [];
  state.isRunning = true;
  state.scraper = scraper;

  openModal(prefix);

  const result = await loadSettings(prefix, state.cachedSettings);
  state.cachedSettings = result.cachedSettings;
  const settings = result.settings;
  const maxPages = rawState.maxPages || settings.maxPages || 10;
  settings.maxPages = maxPages;
  // Sync cachedSettings so captcha-resume uses the correct page limit
  if (state.cachedSettings) {
    state.cachedSettings.maxPages = maxPages;
  }

  setUIRunningState(prefix);
  // Don't call updateLiveRanking here — it would show old deals from previous
  // pages before the current page's AI analysis completes.
  // updateLiveRanking is called automatically after processCurrentPage returns
  // new deals for the current page.

  try {
    await processCurrentPage(settings);
  } catch (error) {
    Logger.error('Error resuming:', error);
    updateProgress(prefix, 'Fehler: ' + error.message, 0, 'error');
    await clearCrawlState(prefix);
    if (state.allTopDeals.length > 0) {
      await finishDealFinder();
    } else {
      resetUI(prefix);
      alert('Fehler beim Fortsetzen: ' + error.message);
    }
  }
}

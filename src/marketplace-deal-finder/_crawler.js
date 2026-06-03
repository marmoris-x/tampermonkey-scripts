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

const Logger = createLogger('Marketplace Deal Finder');

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
 * @returns {Promise<{ success: boolean, description: string }>}
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
      onload: function (response) {
        if (abortIfStopped()) return;
        try {
          if (response.status >= 200 && response.status < 300) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            let fullDesc = null;
            for (let si = 0; si < descSelectors.length; si++) {
              const element = doc.querySelector(descSelectors[si]);
              if (element && element.textContent.trim().length > 20) {
                fullDesc = element.textContent.replace(/\s+/g, ' ').trim();
                break;
              }
            }
            if (!fullDesc) {
              const itempropEl = doc.querySelector('[itemprop="description"]');
              if (itempropEl && itempropEl.textContent.trim().length > 20) {
                fullDesc = itempropEl.textContent.replace(/\s+/g, ' ').trim();
              }
            }
            if (!fullDesc) {
              const metaDesc = doc.querySelector('meta[name="description"]');
              if (metaDesc && metaDesc.getAttribute('content') && metaDesc.getAttribute('content').trim().length > 20) {
                fullDesc = metaDesc.getAttribute('content').replace(/\s+/g, ' ').trim();
              }
            }
            if (fullDesc) {
              done = true;
              if (state.descriptionCache.size >= C.MAX_CACHE_SIZE) {
                const firstKey = state.descriptionCache.keys().next().value;
                state.descriptionCache.delete(firstKey);
              }
              state.descriptionCache.set(url, fullDesc);
              resolve({ success: true, description: fullDesc });
              return;
            }
          }
        } catch (e) { /* fall through to retry */ }
        if (abortIfStopped()) return;
        var delay = C.DESCRIPTION_FETCH_DELAY * Math.pow(C.DESCRIPTION_BACKOFF_FACTOR, retryCount);
        if (retryCount < C.DESCRIPTION_MAX_RETRIES) {
          setTimeout(function () { fetchFullDescription(url, descSelectors, retryCount + 1).then(resolve); }, delay);
        } else {
          done = true;
          resolve({ success: false, description: '' });
        }
      },
      onerror: function () {
        if (abortIfStopped()) return;
        var delay = C.DESCRIPTION_FETCH_DELAY * Math.pow(C.DESCRIPTION_BACKOFF_FACTOR, retryCount);
        if (retryCount < C.DESCRIPTION_MAX_RETRIES) {
          setTimeout(function () { fetchFullDescription(url, descSelectors, retryCount + 1).then(resolve); }, delay);
        } else {
          done = true;
          resolve({ success: false, description: '' });
        }
      },
      ontimeout: function () {
        if (abortIfStopped()) return;
        var delay = C.DESCRIPTION_FETCH_DELAY * Math.pow(C.DESCRIPTION_BACKOFF_FACTOR, retryCount);
        if (retryCount < C.DESCRIPTION_MAX_RETRIES) {
          setTimeout(function () { fetchFullDescription(url, descSelectors, retryCount + 1).then(resolve); }, delay);
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
  // Strip descriptions from allTopDeals before serializing — they can be
  // several KB per deal and cause "Message length exceeded" on large crawls.
  // Descriptions are re-fetched in processCurrentPage after resume, so we
  // only need url, score, page, title, and price to continue.
  var strippedDeals = [];
  for (var di = 0; di < state.allTopDeals.length; di++) {
    var d = state.allTopDeals[di];
    strippedDeals.push({
      url: d.url,
      title: d.title,
      price: d.price,
      score: d.score,
      page: d.page,
      reasoning: d.reasoning
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

  const apiKey = document.getElementById(prefix + '-api-key').value.trim();
  const modelId = document.getElementById(prefix + '-model-id').value.trim();
  const searchContext = document.getElementById(prefix + '-search-context').value.trim();
  const topX = parseInt(document.getElementById(prefix + '-top-x').value);
  const maxPages = parseInt(document.getElementById(prefix + '-max-pages').value) || 10;
  const providerType = document.getElementById(prefix + '-provider-select')
    ? document.getElementById(prefix + '-provider-select').value
    : 'gemini';
  const baseUrl = document.getElementById(prefix + '-base-url')
    ? document.getElementById(prefix + '-base-url').value.trim()
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

  if ('Notification' in window) {
    Notification.requestPermission()['catch'](function () {});
  }

  // Create AbortController so Stop can cancel in-flight API calls
  state.abortController = new AbortController();

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
  const pauseBtn = document.getElementById(prefix + '-pause-btn');
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
  const pauseBtn = document.getElementById(prefix + '-pause-btn');
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
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await new Promise(function (r) { setTimeout(r, C.SCROLL_DELAY); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await new Promise(function (r) { setTimeout(r, C.SCROLL_DELAY); });

  updateProgress(prefix, 'Seite ' + state.currentPage + ': Sammle Anzeigen...', 15, 'info');
  const selectors = scraper.findAds();
  if (!selectors) {
    const pageText = (document.title + ' ' + document.body.innerText).toLowerCase();
    if (pageText.indexOf('captcha') !== -1 || pageText.indexOf('challenge') !== -1) {
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

  // Only warn once per page about slow description fetches
  let deadlineWarningLogged = false;

  for (let bi = 0; bi < adsData.length; bi += C.INITIAL_BATCH_SIZE) {
    await waitIfPaused();
    if (state.shouldStop) break;

    const batch = adsData.slice(bi, Math.min(bi + C.INITIAL_BATCH_SIZE, adsData.length));
    // Flag to prevent description fetches from mutating adsData after the
    // deadline fires. Without this, promises that resolve after the race
    // deadline continue writing to adsData during subsequent batch processing.
    let batchDeadlineReached = false;
    const batchFns = batch.map(function (ad, idx) {
      const absoluteIndex = bi + idx;
      const fetchPromise = ad.url && ad.url.indexOf('http') === 0
        ? fetchFullDescription(ad.url, scraper.descSelectors())
        : Promise.resolve({ success: false, description: '' });
      return fetchPromise.then(function (result) {
        if (!batchDeadlineReached) {
          completedCount++;
          if (completedCount % 5 === 0 || completedCount === adsData.length) {
            updateProgress(prefix, 'Seite ' + state.currentPage + ': Lade Details (' + completedCount + '/' + adsData.length + ')...',
              30 + (completedCount / adsData.length) * 40, 'info');
          }
          adsData[absoluteIndex].description = result.description;
        }
      });
    });
    // Race description fetches against a deadline so slow marketplace pages
    // cannot block the AI call indefinitely (especially critical under Chrome MV3
    // where GM_xmlhttpRequest is serialized).
    const deadline = 8000;
    await Promise.race([
      Promise.all(batchFns),
      new Promise(function (r) { setTimeout(function () {
        batchDeadlineReached = true;
        if (!deadlineWarningLogged) {
          Logger.warn('Description fetch deadline (' + deadline + 'ms) reached — proceeding with partial data');
          deadlineWarningLogged = true;
        }
        r();
      }, deadline); })
    ]);

    if (bi + C.INITIAL_BATCH_SIZE < adsData.length) {
      await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 1000); });
    }
  }

  if (state.shouldStop) { await finishDealFinder(); return; }

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
      maxOutputTokens: C.MAX_OUTPUT_TOKENS,
      onRetry: onRetry,
      signal: state.abortController && state.abortController.signal
    });
    Logger.log('AI response received in ' + (Date.now() - aiCallStart) + 'ms');
  } catch (error) {
    if (error.name === 'AbortError' || state.shouldStop) {
      await finishDealFinder();
      return;
    }
    // Page-level recovery: log error, skip this page, continue to next
    // Without this, a single failed page kills the entire multi-page crawl.
    Logger.error('AI analysis failed for page ' + state.currentPage + ', continuing to next page:', error);
    updateProgress(prefix, 'Seite ' + state.currentPage + ': Analyse fehlgeschlagen, ueberspringe...', 75, 'warning');
    aiResult = null;
  }

  if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
    Logger.log('AI found ' + aiResult.topDeals.length + ' top deals');
    // Build URL→description map from scraped data to merge into AI results
    const scrapedDescs = new Map();
    for (let adi = 0; adi < adsData.length; adi++) {
      if (adsData[adi].description && adsData[adi].url) {
        scrapedDescs.set(adsData[adi].url, adsData[adi].description);
      }
    }
    for (let tdi = 0; tdi < aiResult.topDeals.length; tdi++) {
      const rawDeal = aiResult.topDeals[tdi];
      // Prefer the scraped full description over the AI's summary — it's the
      // ground-truth listing text needed for the final re-ranking prompt.
      let description = rawDeal.description || '';
      const fullDesc = rawDeal.url && scrapedDescs.has(rawDeal.url) ? scrapedDescs.get(rawDeal.url) : '';
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

  // Global re-ranking via AI (if enough deals)
  if (state.allTopDeals.length > 1) {
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
        (state.cachedSettings || {}).searchContext || '',
        dealsToReRank.length,
        state.scraper.siteName,
        3000  // higher limit so the re-ranking AI sees the full listing text
      );

      const cs = state.cachedSettings || {};
      const reRankResult = await callAI(reRankPrompt, {
        providerType: cs.provider ? cs.provider.type : 'gemini',
        apiKey: cs.provider ? cs.provider.apiKey : '',
        modelId: cs.provider ? cs.provider.modelId : 'gemini-2.5-flash',
        baseUrl: cs.provider ? cs.provider.baseUrl : undefined,
        providerOptions: cs.provider ? cs.provider.options : {}
      }, { temperature: 0.1, maxOutputTokens: C.MAX_OUTPUT_TOKENS, signal: state.abortController && state.abortController.signal });

      if (reRankResult && reRankResult.topDeals) {
        const urlToDeal = new Map();
        for (let ri = 0; ri < dealsToReRank.length; ri++) {
          urlToDeal.set(dealsToReRank[ri].url, dealsToReRank[ri]);
        }
        const reRankedDeals = reRankResult.topDeals.map(function (rd) {
          const orig = urlToDeal.get(rd.url);
          return {
            title: (orig && orig.title) || rd.title,
            price: rd.price,
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

  const modal = document.getElementById(prefix + '-dealfinder-modal');
  if (!modal) return;
  modal.innerHTML = renderSettingsView(prefix, settings, savedResults, scraper.siteName);

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
        document.querySelectorAll('#' + prefix + '-model-presets [data-model-id]').forEach(function (btn) {
          const isActive = btn.getAttribute('data-model-id') === newId;
          btn.style.background = isActive ? '#6366f1' : '#f8f9fa';
          btn.style.color = isActive ? '#fff' : '#333';
          btn.style.borderColor = isActive ? '#6366f1' : '#ddd';
        });
      }
    },
    modelPresetClick: async function (modelId, options) {
      const modelIdInput = document.getElementById(prefix + '-model-id');
      if (modelIdInput) {
        modelIdInput.value = modelId;
        const s = await loadSettings(prefix, state.cachedSettings);
        s.settings.provider.modelId = modelId;
        if (options) s.settings.provider.options = options;
        await saveSettings(prefix, s.settings);
        state.cachedSettings = deepCopySettings(s.settings);
        // Update preset button highlights visually
        document.querySelectorAll('#' + prefix + '-model-presets [data-model-id]').forEach(function (btn) {
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

  if (!isScriptNavigation && !samePage) {
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

// ==UserScript==
// @name         Marketplace Deal Finder
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      30.0
// @description  Cross-platform deal aggregator for Willhaben and Kleinanzeigen with AI-powered price analysis. Multi-page crawling with Gemini AI.
// @author       marmoris
// @match        https://www.willhaben.at/iad/kaufen-und-verkaufen/*
// @match        https://www.kleinanzeigen.de/s-*
// @match        https://www.kleinanzeigen.de/z-*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=willhaben.at
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      willhaben.at
// @connect      kleinanzeigen.de
// @connect      generativelanguage.googleapis.com
// @noframes
// @sandbox      JavaScript
// @inject-into  content
// @unwrap
// @run-at       document-idle
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

import { createLogger } from '../shared/logging-utils.js';
import { saveSetting } from '../shared/storage-utils.js';
import { waitForElement } from '../shared/dom-utils.js';
import {
  PAUSE_POLL_INTERVAL, REQUEST_TIMEOUT, MAX_CACHE_SIZE, MAX_RETRIES,
  INITIAL_BATCH_SIZE, SAME_PAGE_INCREMENT, NEW_PAGE_INCREMENT, MAX_INIT_RETRIES,
  DEFAULT_SETTINGS,
  loadSettings, deepCopySettings, saveCrawlState, normalizeUrl,
  clearCrawlState, deduplicateDeals, reRankGlobal,
  saveResults, loadResults, clearResults, generateMarkdown
} from '../marketplace-deal-finder/ranking-engine.js';
import { MODEL, GEMINI_MODELS, callGeminiAPI, restoreModelSelect } from '../marketplace-deal-finder/api-gemini.js';
import { findAds as whFindAds, extractBasicInfo as whExtractBasicInfo, descSelectors as whDescSelectors, goToNextPage as whGoToNextPage } from '../marketplace-deal-finder/scraper-willhaben.js';
import { findAds as kaFindAds, extractBasicInfo as kaExtractBasicInfo, descSelectors as kaDescSelectors, goToNextPage as kaGoToNextPage } from '../marketplace-deal-finder/scraper-kleinanzeigen.js';
import {
  setUIRunningState, updateProgress, resetUI, openModal, createModal,
  createDealFinderButton, renderSettingsView, attachSettingsListeners,
  attachResultsListeners, updateLiveRanking, switchToResultsView,
  closeModal, exportMarkdown, exportJSON, exportCSV, showWarning
} from '../marketplace-deal-finder/ui-panel.js';

/* ─── Site Detection ─── */

var IS_WH = window.location.hostname.includes('willhaben.at');
var P = IS_WH ? 'wh' : 'ka';
var SITE_NAME = IS_WH ? 'WILLHABEN' : 'KLEINANZEIGEN';
var BTN_GRADIENT = IS_WH
  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  : 'linear-gradient(135deg, #86a542 0%, #2d2d2d 100%)';
var Logger = createLogger('Marketplace Deal Finder');

/* ─── Site-specific scraper ─── */

var SCRAPER = IS_WH
  ? { findAds: whFindAds, extractBasicInfo: whExtractBasicInfo, descSelectors: whDescSelectors, goToNextPage: whGoToNextPage }
  : { findAds: kaFindAds, extractBasicInfo: kaExtractBasicInfo, descSelectors: kaDescSelectors, goToNextPage: kaGoToNextPage };

/* ─── Global State ─── */

var isRunning = false;
var isPaused = false;
var shouldStop = false;
var captchaPaused = false;
var allTopDeals = [];
var currentPage = 1;
var activeRequests = new Set();
var descriptionCache = new Map();
var initRetries = 0;
var cachedSettings = null;

/* ─── Helpers ─── */

/**
 * Waits while paused, checking every 500ms. Respects stop signal.
 */
async function waitIfPaused() {
  while (isPaused && !shouldStop) {
    await new Promise(function (r) { setTimeout(r, PAUSE_POLL_INTERVAL); });
  }
}

/**
 * Fetches the full description of a listing by loading its page and
 * extracting the description element using the site-appropriate selectors.
 * Uses a cache (LRU, max 100 entries) and retries on failure.
 *
 * @param {string} url - Listing URL
 * @param {number} [retryCount=0] - Current retry attempt
 * @returns {Promise<{ success: boolean, description: string }>}
 */
function fetchFullDescription(url, retryCount) {
  retryCount = retryCount || 0;
  if (descriptionCache.has(url)) {
    var desc = descriptionCache.get(url);
    descriptionCache.delete(url);
    descriptionCache.set(url, desc);
    return Promise.resolve({ success: true, description: desc });
  }
  var descSelectors = SCRAPER.descSelectors();
  return new Promise(function (resolve) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      timeout: REQUEST_TIMEOUT,
      onload: function (response) {
        try {
          if (response.status >= 200 && response.status < 300) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(response.responseText, 'text/html');
            var fullDesc = null;
            for (var si = 0; si < descSelectors.length; si++) {
              var element = doc.querySelector(descSelectors[si]);
              if (element && element.textContent.trim().length > 20) {
                fullDesc = element.textContent.replace(/\s+/g, ' ').trim();
                break;
              }
            }
            if (fullDesc) {
              if (descriptionCache.size >= MAX_CACHE_SIZE) {
                var firstKey = descriptionCache.keys().next().value;
                descriptionCache.delete(firstKey);
              }
              descriptionCache.set(url, fullDesc);
              resolve({ success: true, description: fullDesc });
              return;
            } else if (retryCount < MAX_RETRIES && !shouldStop) {
              setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
              return;
            }
          } else if (retryCount < MAX_RETRIES && !shouldStop) {
            setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
            return;
          }
        } catch (e) {
          if (retryCount < MAX_RETRIES && !shouldStop) {
            setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
            return;
          }
        }
        resolve({ success: false, description: 'Description not available' });
      },
      onerror: function () {
        if (retryCount < MAX_RETRIES && !shouldStop) {
          setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
        } else {
          resolve({ success: false, description: 'Description not available' });
        }
      },
      ontimeout: function () {
        if (retryCount < MAX_RETRIES && !shouldStop) {
          setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
        } else {
          resolve({ success: false, description: 'Description not available' });
        }
      }
    });
  });
}

/**
 * Persists crawl state synchronously (for use before window.location navigation)
 * and navigates to the next page URL.
 *
 * @param {string} href - Next page URL (relative or absolute)
 * @param {Object} settings - Current crawl settings
 */
async function saveCrawlStateAndNavigate(href, settings) {
  var state = {
    currentPage: currentPage,
    currentUrl: window.location.href,
    allTopDeals: allTopDeals,
    maxPages: settings.maxPages
  };
  await GM.setValue(P + '_dealfinder_crawl_state', JSON.stringify(state));
  window.location.href = href;
}

/* ─── Crawl Orchestration ─── */

/**
 * Starts the deal finding process: reads settings from UI inputs,
 * validates them, persists, and begins crawling page by page.
 */
async function startDealFinder() {
  var apiKey = document.getElementById(P + '-api-key').value.trim();
  var searchContext = document.getElementById(P + '-search-context').value.trim();
  var topX = parseInt(document.getElementById(P + '-top-x').value);
  var maxPages = parseInt(document.getElementById(P + '-max-pages').value) || 10;
  var modelEl = document.getElementById(P + '-model-select');
  var model = modelEl ? modelEl.value : MODEL.FLASH;

  if (!apiKey) { alert('Bitte gib deinen Gemini API Key ein!'); return; }
  if (!searchContext) { alert('Bitte gib einen Suchkontext ein!'); return; }
  if (!Number.isFinite(topX) || topX < 1 || topX > 10) { alert('AI-Picks muss zwischen 1 und 10 liegen!'); return; }
  if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 100) { alert('Maximale Seiten muss zwischen 1 und 100 liegen!'); return; }

  var currentSettings = await loadSettings(P, cachedSettings);
  cachedSettings = currentSettings.cachedSettings;
  var settings = currentSettings.settings;
  settings.apiKey = apiKey;
  settings.searchContext = searchContext;
  settings.topX = topX;
  settings.model = model;
  settings.maxPages = maxPages;
  await saveSetting(P + '_dealfinder_settings', JSON.stringify(settings));
  cachedSettings = deepCopySettings(settings);

  if ('Notification' in window) {
    Notification.requestPermission()['catch'](function () {});
  }

  currentPage = 1;
  allTopDeals = [];
  isRunning = true;
  isPaused = false;
  shouldStop = false;
  captchaPaused = false;

  setUIRunningState(P);

  try {
    await processCurrentPage(apiKey, searchContext, topX, model, maxPages);
  } catch (error) {
    Logger.error('Error:', error);
    updateProgress(P, 'Fehler: ' + error.message, 0, 'error', IS_WH);
    if (allTopDeals.length > 0) {
      await finishDealFinder();
    } else {
      resetUI(P);
      alert('Fehler: ' + error.message);
    }
  }
}

/**
 * Pauses the crawl. Button toggles to "Resume".
 */
function pauseDealFinder() {
  isPaused = true;
  var pauseBtn = document.getElementById(P + '-pause-btn');
  if (!pauseBtn) return;
  pauseBtn.textContent = 'Fortsetzen';
  pauseBtn.style.background = '#28a745';
  pauseBtn.removeEventListener('click', pauseDealFinder);
  pauseBtn.addEventListener('click', resumeDealFinder);
  updateProgress(P, 'Pausiert - Klicke Fortsetzen...', 50, 'warning', IS_WH);
}

/**
 * Resumes the crawl after pause. If CAPTCHA was detected, re-enters the crawl loop.
 */
function resumeDealFinder() {
  isPaused = false;
  var pauseBtn = document.getElementById(P + '-pause-btn');
  if (!pauseBtn) return;
  pauseBtn.textContent = 'Pause';
  pauseBtn.style.background = '#ffc107';
  pauseBtn.removeEventListener('click', resumeDealFinder);
  pauseBtn.addEventListener('click', pauseDealFinder);

  if (isRunning && captchaPaused) {
    captchaPaused = false;
    var settings = cachedSettings || DEFAULT_SETTINGS;
    var maxPages = settings.maxPages || 10;
    processCurrentPage(settings.apiKey, settings.searchContext, settings.topX,
      settings.model || MODEL.FLASH, maxPages)
      ['catch'](function (error) {
        Logger.error('Resume error:', error);
        updateProgress(P, 'Fehler: ' + error.message, 0, 'error', IS_WH);
        resetUI(P);
      });
  }
}

/**
 * Stops the crawl gracefully (finishes current page, then saves).
 */
async function stopDealFinder() {
  shouldStop = true;
  isPaused = false;
  captchaPaused = false;
  await GM.setValue(P + '_dealfinder_crawl_state', null);
  Logger.log('Crawl stopped by user');
  updateProgress(P, 'Stoppe nach aktueller Seite...', 95, 'warning', IS_WH);
}

/**
 * Processes a single search results page: collects ads, fetches descriptions,
 * calls Gemini AI for analysis, and either navigates to the next page or finishes.
 *
 * @param {string} apiKey - Gemini API key
 * @param {string} searchContext - Search context for AI analysis
 * @param {number} topX - Number of top deals per page
 * @param {string} model - Model key (flash/pro/nano)
 * @param {number} maxPages - Maximum pages to crawl
 */
async function processCurrentPage(apiKey, searchContext, topX, model, maxPages) {
  maxPages = maxPages || 10;
  await waitIfPaused();
  if (shouldStop) { await finishDealFinder(); return; }
  if (currentPage > maxPages) { await finishDealFinder(); return; }

  updateProgress(P, 'Seite ' + currentPage + ': Lade alle Anzeigen...', 10, 'info', IS_WH);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await new Promise(function (r) { setTimeout(r, 1500); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await new Promise(function (r) { setTimeout(r, 1500); });

  updateProgress(P, 'Seite ' + currentPage + ': Sammle Anzeigen...', 15, 'info', IS_WH);
  var selectors = SCRAPER.findAds();
  if (!selectors) {
    var pageText = (document.title + ' ' + document.body.innerText).toLowerCase();
    if (pageText.indexOf('captcha') !== -1 || pageText.indexOf('challenge') !== -1) {
      captchaPaused = true;
      await saveCrawlState({
        currentPage: currentPage,
        currentUrl: window.location.href,
        allTopDeals: allTopDeals,
        maxPages: maxPages
      }, P);
      pauseDealFinder();
      updateProgress(P, 'CAPTCHA erkannt! Bitte lösen und Fortsetzen klicken', 50, 'warning', IS_WH);
      return;
    }
    throw new Error('Keine Anzeigen gefunden');
  }

  updateProgress(P, 'Seite ' + currentPage + ': Sammle Basis-Daten...', 20, 'info', IS_WH);
  var seenUrls = new Set();
  var adsData = [];
  var adArray = Array.from(selectors.adEntries);
  for (var adi = 0; adi < adArray.length; adi++) {
    var info = SCRAPER.extractBasicInfo(adArray[adi]);
    if (!seenUrls.has(info.url)) {
      seenUrls.add(info.url);
      adsData.push(info);
    }
  }
  Logger.log(adsData.length + ' ads found (deduplicated)');

  updateProgress(P, 'Seite ' + currentPage + ': Lade Details (0/' + adsData.length + ')...', 30, 'info', IS_WH);
  var completedCount = 0;

  for (var bi = 0; bi < adsData.length; bi += INITIAL_BATCH_SIZE) {
    await waitIfPaused();
    if (shouldStop) break;

    var batch = adsData.slice(bi, Math.min(bi + INITIAL_BATCH_SIZE, adsData.length));
    var batchFns = [];
    for (var bj = 0; bj < batch.length; bj++) {
      var adDataBatch = batch[bj];
      var idx = bi + bj;
      (function (index, url) {
        var fetchPromise = url && url.indexOf('http') === 0
          ? fetchFullDescription(url)
          : Promise.resolve({ success: false, description: 'Description not available' });
        batchFns.push(fetchPromise.then(function (result) {
          completedCount++;
          if (completedCount % 5 === 0 || completedCount === adsData.length) {
            updateProgress(P, 'Seite ' + currentPage + ': Lade Details (' + completedCount + '/' + adsData.length + ')...',
              30 + (completedCount / adsData.length) * 40, 'info', IS_WH);
          }
          adsData[index].description = result.description;
        }));
      })(idx, adDataBatch.url);
    }
    await Promise.all(batchFns);

    if (bi + INITIAL_BATCH_SIZE < adsData.length) {
      await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 1000); });
    }
  }

  if (shouldStop) { await finishDealFinder(); return; }

  var modelName = GEMINI_MODELS[model] ? GEMINI_MODELS[model].name : model;
  updateProgress(P, 'Seite ' + currentPage + ': AI analysiert Angebote...', 75, 'info', IS_WH);
  Logger.log('Sending ' + adsData.length + ' listings to ' + modelName + '...');

  var onRetry = function (status, retryNum, delaySeconds) {
    var statusText = typeof status === 'number' ? 'HTTP ' + status : status;
    showWarning(P, 'API ' + statusText + ' - Retry ' + retryNum + ' in ' + delaySeconds + 's...', 75, IS_WH);
  };

  var aiResult = null;
  try {
    aiResult = await callGeminiAPI(adsData, searchContext, topX, apiKey, model, 0, onRetry, SITE_NAME);
  } catch (error) {
    if (error.message === 'Aborted' || shouldStop) {
      await finishDealFinder();
      return;
    }
    throw error;
  }

  if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
    Logger.log('AI found ' + aiResult.topDeals.length + ' top deals');
    for (var tdi = 0; tdi < aiResult.topDeals.length; tdi++) {
      var deal = aiResult.topDeals[tdi];
      deal.page = currentPage;
      allTopDeals.push(deal);
    }
    updateProgress(P, 'Seite ' + currentPage + ': ' + aiResult.topDeals.length + ' Top-Deals gefunden!', 90, 'success', IS_WH);
    updateLiveRanking(P, allTopDeals, cachedSettings);
  }

  await new Promise(function (r) { setTimeout(r, 1500); });

  // Determine if there is a next page. The scraper's goToNextPage returns a URL or false.
  if (!shouldStop) {
    var nextUrl = SCRAPER.goToNextPage(currentPage);
    if (nextUrl) {
      Logger.log('Navigating to next page: ' + nextUrl);
      await saveCrawlStateAndNavigate(nextUrl, { apiKey: apiKey, searchContext: searchContext, topX: topX, model: model, maxPages: maxPages });
    } else {
      Logger.log('No more pages available - ending crawl');
      await finishDealFinder();
    }
  } else {
    await finishDealFinder();
  }
}

/**
 * Finalizes the deal finding process: deduplicates, optionally re-ranks
 * via Gemini, saves results, and shows the results view.
 */
async function finishDealFinder() {
  updateProgress(P, 'Erstelle finale Ranking-Liste...', 95, 'info', IS_WH);
  await clearCrawlState(P);

  if (allTopDeals.length === 0) {
    updateProgress(P, 'Keine Deals gefunden!', 100, 'error', IS_WH);
    alert('Keine Top-Deals gefunden! Versuche andere Suchkriterien.');
    resetUI(P);
    return;
  }

  if (shouldStop) {
    updateProgress(P, 'Crawl gestoppt. Speichere bisherige Deals...', 100, 'warning', IS_WH);
    await saveResults({ deals: allTopDeals, pages: currentPage, timestamp: new Date().toISOString() }, P);
    switchToResultsView(P, allTopDeals);
    resetUI(P);
    return;
  }

  // Deduplicate across pages
  allTopDeals = deduplicateDeals(allTopDeals);

  // Global re-ranking across all collected deals
  if (allTopDeals.length > 1) {
    updateProgress(P, 'Globales Re-Ranking aller Deals...', 97, 'info', IS_WH);
    var settings = cachedSettings || DEFAULT_SETTINGS;
    allTopDeals = await reRankGlobal(allTopDeals, settings.apiKey, settings.searchContext,
      settings.model || MODEL.FLASH, Logger);
  }

  await saveResults({ deals: allTopDeals, pages: currentPage, timestamp: new Date().toISOString() }, P);
  updateProgress(P, allTopDeals.length + ' Deals gespeichert!', 100, 'success', IS_WH);

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Deal Finder fertig', {
        body: allTopDeals.length + ' Deals auf ' + currentPage + ' Seiten gefunden'
      });
    } catch (e) { /* ignore */ }
  }

  switchToResultsView(P, allTopDeals);
  resetUI(P);
}

/* ─── Initialization ─── */

/**
 * Checks for a persisted crawl state on page load and resumes if found.
 * Called after the modal is created and settings are loaded.
 */
async function resumeCrawlIfActive() {
  var rawState = await GM.getValue(P + '_dealfinder_crawl_state', null);
  if (!rawState) {
    Logger.log('Normal session - results preserved');
    return;
  }
  var crawlState;
  try { crawlState = JSON.parse(rawState); } catch (e) { return; }
  if (!crawlState) return;

  var normalizedCurrentUrl = normalizeUrl(crawlState.currentUrl);
  var normalizedWindowUrl = normalizeUrl(window.location.href);
  var samePage = normalizedCurrentUrl && normalizedCurrentUrl === normalizedWindowUrl;
  var pageIncrement = samePage ? SAME_PAGE_INCREMENT : NEW_PAGE_INCREMENT;
  Logger.log('Crawl state found - resuming from page ' + (crawlState.currentPage + pageIncrement) +
    ' (' + (samePage ? 'page reloaded' : 'navigation detected') + ')');

  currentPage = crawlState.currentPage + pageIncrement;
  allTopDeals = crawlState.allTopDeals || [];
  isRunning = true;

  openModal(P);

  try {
    await waitForElement('#' + P + '-progress-container', 2000);
  } catch (e) {
    await new Promise(function (r) { setTimeout(r, 500); });
  }

  setUIRunningState(P);
  updateLiveRanking(P, allTopDeals, cachedSettings);

  var settings = cachedSettings || DEFAULT_SETTINGS;
  var maxPages = crawlState.maxPages || settings.maxPages || 10;

  try {
    await processCurrentPage(settings.apiKey, settings.searchContext, settings.topX,
      settings.model || MODEL.FLASH, maxPages);
  } catch (error) {
    Logger.error('Error resuming:', error);
    updateProgress(P, 'Fehler: ' + error.message, 0, 'error', IS_WH);
    await clearCrawlState(P);
    if (allTopDeals.length > 0) {
      await finishDealFinder();
    } else {
      resetUI(P);
      alert('Fehler beim Fortsetzen: ' + error.message);
    }
  }
}

/**
 * Loads the settings view into the modal and wires all callbacks.
 */
async function renderAndWireSettings() {
  var result = await loadSettings(P, cachedSettings);
  cachedSettings = result.cachedSettings;
  var settings = result.settings;
  var savedResults = await loadResults(P);

  var modal = document.getElementById(P + '-dealfinder-modal');
  if (!modal) return;
  modal.innerHTML = renderSettingsView(P, settings, savedResults, SITE_NAME);

  // Wire settings view callbacks
  attachSettingsListeners(P, {
    start: startDealFinder,
    pause: pauseDealFinder,
    stop: stopDealFinder,
    close: function () { closeModal(P, isRunning); },
    showSavedResults: async function () {
      var sr = await loadResults(P);
      if (sr) {
        switchToResultsView(P, sr.deals);
        attachResultsListeners(P, resultsCallbacks);
      }
    },
    apiKeyChange: async function (newKey) {
      var s = await loadSettings(P, cachedSettings);
      cachedSettings = s.cachedSettings;
      var settingsObj = s.settings;
      if (settingsObj.apiKey !== newKey) {
        settingsObj.apiKey = newKey;
        await saveSetting(P + '_dealfinder_settings', JSON.stringify(settingsObj));
        cachedSettings = deepCopySettings(settingsObj);
      }
    },
    searchContextChange: async function (newContext) {
      var s = await loadSettings(P, cachedSettings);
      cachedSettings = s.cachedSettings;
      var settingsObj = s.settings;
      if (settingsObj.searchContext !== newContext) {
        settingsObj.searchContext = newContext;
        await saveSetting(P + '_dealfinder_settings', JSON.stringify(settingsObj));
        cachedSettings = deepCopySettings(settingsObj);
      }
    }
  });

  // Restore model selection dropdown (from Gemini API module)
  restoreModelSelect(P, cachedSettings);
}

/**
 * Callbacks for the results view (export, navigation).
 * Defined here so UI module doesn't need to know about storage or ranking.
 */
var resultsCallbacks = {
  close: function () { closeModal(P, isRunning); },
  backToSettings: renderAndWireSettings,
  exportMarkdown: async function () {
    await exportMarkdown(P, { loadResults: loadResults, generateMarkdown: generateMarkdown });
  },
  exportJSON: function () {
    exportJSON(P);
  },
  exportCSV: function () {
    exportCSV(P);
  },
  clearResults: async function () {
    if (!confirm('Möchtest du die gespeicherten Results wirklich löschen?')) return;
    await clearResults(P);
    renderAndWireSettings();
  }
};

/**
 * Initializes the script: loads settings, creates UI elements,
 * waits for search results to appear, then checks for crawl resume.
 */
async function init() {
  try {
    Logger.log('Script started');

    // Pre-populate settings cache from sync storage
    var rawSettings = await GM.getValue(P + '_dealfinder_settings', null);
    if (rawSettings) {
      try {
        var loaded = JSON.parse(rawSettings);
        if (loaded.model && !{ flash: 1, pro: 1, nano: 1 }[loaded.model]) loaded.model = 'flash';
        cachedSettings = deepCopySettings(Object.assign({}, DEFAULT_SETTINGS, loaded));
      } catch (e) {
        cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
      }
    } else {
      cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
    }

    // Wait for search results page to be ready
    if (IS_WH) {
      var searchIndicators = [
        '[data-testid="result-list-title"]',
        '[data-testid*="search-result"]',
        'a[href*="/iad/"]'
      ];
      var hasIndicator = false;
      for (var ssi = 0; ssi < searchIndicators.length; ssi++) {
        if (document.querySelector(searchIndicators[ssi])) { hasIndicator = true; break; }
      }
      if (!hasIndicator) {
        if (++initRetries >= MAX_INIT_RETRIES) {
          Logger.warn('Max init retries reached - showing button anyway');
          createModal(P);
          createDealFinderButton(P, BTN_GRADIENT);
          openModal(P);
          await renderAndWireSettings();
          return;
        }
        setTimeout(init, 3000);
        return;
      }
    } else {
      try {
        await waitForElement('article[data-adid], #srchrslt-adtable', 10000);
      } catch (e) {
        Logger.log('No ad list found, retrying later');
        if (++initRetries >= MAX_INIT_RETRIES) {
          Logger.warn('Max init retries reached - showing button anyway');
          createModal(P);
          createDealFinderButton(P, BTN_GRADIENT);
          await renderAndWireSettings();
          return;
        }
        setTimeout(init, 3000);
        return;
      }
    }

    await new Promise(function (r) { setTimeout(r, 1500); });
    createModal(P);
    createDealFinderButton(P, BTN_GRADIENT);

    // Wire floating button to open modal
    var floatBtn = document.getElementById(P + '-dealfinder-btn');
    if (floatBtn) {
      floatBtn.addEventListener('click', function () {
        openModal(P);
        renderAndWireSettings();
      });
    }

    // Load settings into modal
    await renderAndWireSettings();

    // Check for crawl resume
    await resumeCrawlIfActive();

  } catch (error) {
    Logger.error('Initialization error:', error);
    setTimeout(init, 3000);
  }
}

init();

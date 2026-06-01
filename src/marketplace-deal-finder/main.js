// src/marketplace-deal-finder/main.js — Orchestrator & init
'use strict';

import { createLogger } from './_logger.js';
import { getScraper } from './_scraper-factory.js';
import { loadSettings } from './_settings.js';
import { setCachedSettings, setScraper } from './_state.js';
import { createModal, createDealFinderButton, openModal } from './_ui-panel.js';
import { waitForElement } from './_dom.js';
import { resumeCrawlIfActive, setupSettingsView } from './_crawler.js';
import { MAX_INIT_RETRIES } from './_constants.js';

const Logger = createLogger('Marketplace Deal Finder');

/**
 * Waits for the search results page to be ready.
 * Uses site-specific selectors to detect search results.
 * @param {Object} scraper - Scraper object
 * @returns {Promise<void>}
 */
async function waitForPage(scraper) {
  const isWH = scraper.siteName === 'WILLHABEN';

  if (isWH) {
    const searchIndicators = [
      '[data-testid="result-list-title"]',
      '[data-testid*="search-result"]',
      'a[href*="/iad/"]'
    ];
    let hasIndicator = false;
    for (let ssi = 0; ssi < searchIndicators.length; ssi++) {
      if (document.querySelector(searchIndicators[ssi])) { hasIndicator = true; break; }
    }
    if (!hasIndicator) {
      throw new Error('No search results detected');
    }
  } else {
    try {
      await waitForElement('article[data-adid], #srchrslt-adtable', 10000);
    } catch (e) {
      throw new Error('No ad list detected');
    }
  }
}

/**
 * Main initialization function.
 * Sets up state, creates UI elements, wires event handlers, and checks for crawl resume.
 */
async function init() {
  try {
    const scraper = getScraper();
    setScraper(scraper);
    const result = await loadSettings(scraper.storagePrefix);
    setCachedSettings(result.cachedSettings);
    Logger.log('Initializing...');

    // Wait for page to be ready
    for (let attempt = 0; attempt < MAX_INIT_RETRIES; attempt++) {
      try {
        await waitForPage(scraper);
        break;
      } catch (e) {
        if (attempt < MAX_INIT_RETRIES - 1) {
          Logger.log('Page not ready, retrying in 3s...');
          await new Promise(function (r) { setTimeout(r, 3000); });
        } else {
          Logger.warn('Max retries reached - showing button anyway');
        }
      }
    }

    await new Promise(function (r) { setTimeout(r, 1500); });

    // Create UI
    createModal(scraper.storagePrefix);
    createDealFinderButton(scraper.storagePrefix, scraper.buttonGradient);

    // Wire floating button to open modal
    const floatBtn = document.getElementById(scraper.storagePrefix + '-dealfinder-btn');
    if (floatBtn) {
      floatBtn.addEventListener('click', function () {
        openModal(scraper.storagePrefix);
        setupSettingsView(scraper)['catch'](function (err) {
          Logger.error('Failed to load settings view:', err);
        });
      });
    }

    // Load settings into modal
    await setupSettingsView(scraper);

    // Check for crawl resume
    await resumeCrawlIfActive(scraper);

  } catch (error) {
    Logger.error('Initialization error:', error);
    // Auto-retry once
    await new Promise(function (r) { setTimeout(r, 3000); });
    init()['catch'](function (e) {
      Logger.error('Fatal init failure after retry:', e);
      console.error('[Marketplace Deal Finder] Could not initialize. Please reload the page or check the console for details.');
    });
  }
}

export { init };

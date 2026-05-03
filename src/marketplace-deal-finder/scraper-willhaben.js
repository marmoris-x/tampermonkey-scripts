// src/marketplace-deal-finder/scraper-willhaben.js — Willhaben.at scraping
// Provides ad detection, data extraction, and pagination for willhaben.at search results.
// Uses document (runs in page context) — no GM_* API calls.
(function () {
  'use strict';

  var MIN_TITLE_LENGTH = 5;

  /**
   * Checks if text consists only of a price (e.g. "12,50 €" or "350 € VB").
   * @param {string} text
   * @returns {boolean}
   */
  function isPriceOnlyText(text) {
    return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
  }

  /**
   * Finds ad elements on the current Willhaben search results page.
   * Uses a cascade of selectors from most specific to generic fallback.
   * @returns {{ adEntries: NodeList }|null} Object with adEntries array, or null if no ads found
   */
  function findAds() {
    var adSelectors = [
      'a[data-testid^="search-result-entry-header-"]',
      'article[data-testid^="search-result-entry-"]',
      '[data-testid*="search-result-entry"]'
    ];
    for (var si = 0; si < adSelectors.length; si++) {
      var entries = document.querySelectorAll(adSelectors[si]);
      if (entries.length > 0) {
        console.log('[MDF-WH] Found ' + entries.length + ' ads (selector: ' + adSelectors[si] + ')');
        return { adEntries: entries };
      }
    }
    // Fallback: find unique ad URLs and their containers
    var uniqueUrls = new Set();
    var uniqueAds = [];
    var urlRegex = /\/iad\/kaufen-und-verkaufen\/.*\/\d+/;
    document.querySelectorAll('a[href*="/iad/kaufen-und-verkaufen/"]').forEach(function (link) {
      var url = link.href;
      if (urlRegex.test(url) && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        var container = link.closest('article, div[class*="box"], [data-testid*="search-result"], .ad-item, .list-item');
        uniqueAds.push(container || link);
      }
    });
    if (uniqueAds.length > 0) {
      console.log('[MDF-WH] Found ' + uniqueAds.length + ' ads (fallback method)');
      return { adEntries: uniqueAds };
    }
    return null;
  }

  /**
   * Extracts title, price, and URL from a Willhaben ad element.
   * @param {Element} ad - The ad container element
   * @returns {{ title: string, price: string, url: string }}
   */
  function extractBasicInfo(ad) {
    var title = 'Title not available';
    [].concat(['h3', 'h2', '[data-testid*="title"]']).forEach(function (s) {
      var el = ad.querySelector(s);
      if (el) {
        var text = el.textContent.trim();
        if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) title = text;
      }
    });

    var price = 'Price not available';
    var spans = ad.querySelectorAll('span, div, p');
    for (var pi = 0; pi < spans.length; pi++) {
      var text = spans[pi].textContent.trim();
      if ((text.indexOf('€') !== -1 || text.indexOf('EUR') !== -1) && text.length < 20 && text.indexOf('...') === -1) {
        price = text; break;
      }
    }

    var url = ad.href || (ad.querySelector('a[href*="/iad/"]') ? ad.querySelector('a[href*="/iad/"]').href : 'URL not available');
    return { title: title, price: price, url: url };
  }

  /**
   * Returns CSS selectors for the description element on a Willhaben ad page.
   * @returns {string[]} Ordered array of selectors (most specific first)
   */
  function descSelectors() {
    return [
      '[data-testid="ad-description-Beschreibung"]',
      '[data-testid*="description"]',
      '.ad-description',
      '[class*="description"]'
    ];
  }

  /**
   * Finds the "next page" URL on a Willhaben search results page.
   * @param {number} currentPage - Current page number
   * @returns {string|false} Next page URL, or false if no more pages
   */
  function goToNextPage(currentPage) {
    var nextButton = document.querySelector('[data-testid="pagination-bottom-next-button"]');
    if (!nextButton) {
      var targetPage = currentPage + 1;
      var paginationLinks = document.querySelectorAll('[data-testid*="pagination"] a, nav a');
      for (var li = 0; li < paginationLinks.length; li++) {
        var btn = paginationLinks[li];
        var text = (btn.textContent || '').trim();
        var href = btn.getAttribute('href');
        if (text && (
          text === String(targetPage) ||
          text.toLowerCase().indexOf('weiter') !== -1 ||
          text.toLowerCase().indexOf('next') !== -1 ||
          text === '›' || text === '>'
        )) {
          if (!btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true' && href) {
            nextButton = btn; break;
          }
        }
      }
    }
    if (nextButton) {
      var isDisabled = nextButton.hasAttribute('disabled');
      var ariaDisabled = nextButton.getAttribute('aria-disabled') === 'true';
      var href = nextButton.getAttribute('href');
      console.log('[MDF-WH] Next button disabled:', isDisabled, '| aria-disabled:', ariaDisabled, '| href:', href);
      if (!isDisabled && !ariaDisabled && href) {
        try {
          if (new URL(href, location.href).href === location.href) {
            console.log('[MDF-WH] Next button points to same page - skipped');
            return false;
          }
        } catch (e) {
          console.warn('[MDF-WH] Invalid URL in next button:', href, e);
          return false;
        }
        return href;
      }
      console.log('[MDF-WH] Next button not usable');
    }
    return false;
  }

  /* ─── Namespace Registration ─── */
  window.__MDF__ = window.__MDF__ || {};
  window.__MDF__.wh = {
    findAds: findAds,
    extractBasicInfo: extractBasicInfo,
    descSelectors: descSelectors,
    goToNextPage: goToNextPage
  };

})();

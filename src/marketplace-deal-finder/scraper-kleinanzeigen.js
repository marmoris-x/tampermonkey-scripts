// src/marketplace-deal-finder/scraper-kleinanzeigen.js — Kleinanzeigen.de scraping
// Provides ad detection, data extraction, and pagination for kleinanzeigen.de search results.
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
   * Finds ad elements on the current Kleinanzeigen search results page.
   * Uses a cascade of selectors from most specific to generic fallback.
   * @returns {{ adEntries: NodeList }|null} Object with adEntries array, or null if no ads found
   */
  function findAds() {
    var adSelectors = ['article[data-adid]', 'li.ad-listitem', '.aditem'];
    for (var si = 0; si < adSelectors.length; si++) {
      var entries = document.querySelectorAll(adSelectors[si]);
      if (entries.length > 0) {
        console.log('[MDF-KA] Found ' + entries.length + ' ads (selector: ' + adSelectors[si] + ')');
        return { adEntries: entries };
      }
    }
    // Fallback: find unique ad URLs and their containers
    var uniqueUrls = new Set();
    var uniqueAds = [];
    var urlRegex = /\/s-anzeige\/.*\/\d+/;
    document.querySelectorAll('a[href*="/s-anzeige/"]').forEach(function (link) {
      var url = link.href;
      if (urlRegex.test(url) && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        var container = link.closest('article, li, .aditem, .ad-listitem, [data-adid]');
        uniqueAds.push(container || link);
      }
    });
    if (uniqueAds.length > 0) {
      console.log('[MDF-KA] Found ' + uniqueAds.length + ' ads (fallback method)');
      return { adEntries: uniqueAds };
    }
    return null;
  }

  /**
   * Extracts title, price, and URL from a Kleinanzeigen ad element.
   * @param {Element} ad - The ad container element
   * @returns {{ title: string, price: string, url: string }}
   */
  function extractBasicInfo(ad) {
    var title = 'Title not available';
    [].concat(['h2', 'h3', 'a[class*="ellipsis"]', '[class*="title"]']).forEach(function (s) {
      var el = ad.querySelector(s);
      if (el) {
        var text = el.textContent.trim();
        if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) title = text;
      }
    });

    var price = 'Price not available';
    var spans = ad.querySelectorAll('span, div, p, strong');
    for (var pi = 0; pi < spans.length; pi++) {
      var text = spans[pi].textContent.trim();
      if ((text.indexOf('€') !== -1 || text.indexOf('EUR') !== -1 ||
           /^(\d[\d.,]*\s*€?\s*)?VB$/i.test(text.trim())) && text.length < 30 && text.indexOf('...') === -1) {
        price = text; break;
      }
    }

    var url = ad.getAttribute('data-href') || ad.href ||
      (ad.querySelector('a[href*="/s-anzeige/"]') ? ad.querySelector('a[href*="/s-anzeige/"]').href : 'URL not available');
    if (url && url.indexOf('/') === 0) {
      url = 'https://www.kleinanzeigen.de' + url;
    }
    return { title: title, price: price, url: url };
  }

  /**
   * Returns CSS selectors for the description element on a Kleinanzeigen ad page.
   * @returns {string[]} Ordered array of selectors (most specific first)
   */
  function descSelectors() {
    return [
      '#viewad-description-text',
      '.ad-description',
      'div[class*="description"]',
      '[class*="description"]'
    ];
  }

  /**
   * Finds the "next page" URL on a Kleinanzeigen search results page.
   * @param {number} currentPage - Current page number
   * @returns {string|false} Next page URL, or false if no more pages
   */
  function goToNextPage(currentPage) {
    var nextButton = document.querySelector('a[class*="pagination-next"]');
    if (!nextButton) {
      var paginationLinks = document.querySelectorAll('[class*="pagination"] a, nav a, .pagination a');
      for (var li = 0; li < paginationLinks.length; li++) {
        var linkEl = paginationLinks[li];
        var text = (linkEl.textContent || '').trim().toLowerCase();
        var href = linkEl.getAttribute('href');
        if ((text === 'weiter' || text === '>' || text === '›') && href && href.indexOf('seite:') !== -1) {
          nextButton = linkEl; break;
        }
      }
    }
    if (!nextButton) {
      var targetPage = currentPage + 1;
      var seiteLinks = document.querySelectorAll('a[href*="seite:"]');
      for (var sl = 0; sl < seiteLinks.length; sl++) {
        var href = seiteLinks[sl].getAttribute('href');
        if (href && href.indexOf('seite:' + targetPage) !== -1) {
          nextButton = seiteLinks[sl]; break;
        }
      }
    }
    if (nextButton) {
      var href = nextButton.getAttribute('href');
      console.log('[MDF-KA] Next button href:', href);
      if (href) {
        try {
          if (new URL(href, location.href).href === location.href) {
            console.log('[MDF-KA] Next button points to same page - skipped');
            return false;
          }
        } catch (e) {
          console.warn('[MDF-KA] Invalid URL in next button:', href, e);
          return false;
        }
        return href;
      }
      console.log('[MDF-KA] Next button has no href');
    }
    return false;
  }

  /* ─── Namespace Registration ─── */
  window.__MDF__ = window.__MDF__ || {};
  window.__MDF__.ka = {
    findAds: findAds,
    extractBasicInfo: extractBasicInfo,
    descSelectors: descSelectors,
    goToNextPage: goToNextPage
  };

})();

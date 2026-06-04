'use strict';

import { MIN_TITLE_LENGTH } from './_constants.js';
import { createLogger } from './_logger.js';
const Logger = createLogger('MDF-KA');

/**
 * Finds ad elements on the current Kleinanzeigen search results page.
 * Uses a cascade of selectors from most specific to generic fallback.
 * @returns {{ adEntries: NodeList }|null} Object with adEntries array, or null if no ads found
 */
export function findAds() {
  const adSelectors = ['article[data-adid]', 'li.ad-listitem', '.aditem'];
  for (let si = 0; si < adSelectors.length; si++) {
    const entries = document.querySelectorAll(adSelectors[si]);
    if (entries.length > 0) {
      Logger.log('Found ' + entries.length + ' ads (selector: ' + adSelectors[si] + ')');
      return { adEntries: entries };
    }
  }
  // Fallback: find unique ad URLs and their containers
  const uniqueUrls = new Set();
  const uniqueAds = [];
  const urlRegex = /\/s-anzeige\/.*\/\d+/;
  document.querySelectorAll('a[href*="/s-anzeige/"]').forEach(function (link) {
    const url = link.href;
    if (urlRegex.test(url) && !uniqueUrls.has(url)) {
      uniqueUrls.add(url);
      const container = link.closest('article, li, .aditem, .ad-listitem, [data-adid]');
      uniqueAds.push(container || link);
    }
  });
  if (uniqueAds.length > 0) {
    Logger.log('Found ' + uniqueAds.length + ' ads (fallback method)');
    return { adEntries: uniqueAds };
  }
  return null;
}

/**
 * Extracts title, price, and URL from a Kleinanzeigen ad element.
 * @param {Element} ad - The ad container element
 * @returns {{ title: string, price: string, url: string }}
 */
export function extractBasicInfo(ad) {
  let title = 'Title not available';
  ['h2', 'h3', 'a[class*="ellipsis"]', '[class*="title"]'].forEach(function (s) {
    const el = ad.querySelector(s);
    if (el) {
      const text = el.textContent.trim();
      if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) title = text;
    }
  });

  let price = 'Price not available';
  // Site-specific selectors first (fast path), generic scan as fallback (E-3)
  var priceSelectors = [
    '.aditem-main--middle--price-shipping--price', '[class*="aditem-main--price"]',
    '.aditem-main--price', '[data-price]', '[class*="aditem-price"]'
  ];
  var priceEl = null;
  for (var psi = 0; psi < priceSelectors.length; psi++) {
    priceEl = ad.querySelector(priceSelectors[psi]);
    if (priceEl) {
      var pt = priceEl.textContent.trim();
      if (pt && pt.length < 30 && (pt.indexOf('€') !== -1 || /^(\d[\d.,]*\s*€?\s*)?VB$/i.test(pt))) {
        price = pt; break;
      }
    }
  }
  if (!priceEl) {
    const spans = ad.querySelectorAll('span, div, p, strong');
    for (let pi = 0; pi < spans.length; pi++) {
      const text = spans[pi].textContent.trim();
      if ((text.indexOf('€') !== -1 || text.indexOf('EUR') !== -1 ||
           /^(\d[\d.,]*\s*€?\s*)?VB$/i.test(text.trim())) && text.length < 30 && text.indexOf('...') === -1) {
        price = text; break;
      }
    }
  }

  let url = ad.getAttribute('data-href') || ad.href ||
    (ad.querySelector('a[href*="/s-anzeige/"]') ? ad.querySelector('a[href*="/s-anzeige/"]').href : 'URL not available');
  if (url && url.indexOf('/') === 0) {
    url = 'https://www.kleinanzeigen.de' + url;
  }
  return { title: title, price: price, url: url };
}

/**
 * Checks if text consists only of a price (e.g. "12,50 EUR" or "350 EUR VB").
 * @param {string} text
 * @returns {boolean}
 */
function isPriceOnlyText(text) {
  return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
}

/**
 * Returns CSS selectors for the description element on a Kleinanzeigen ad page.
 * @returns {string[]} Ordered array of selectors (most specific first)
 */
export function descSelectors() {
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
export function goToNextPage(currentPage) {
  let nextButton = document.querySelector('a[class*="pagination-next"]');
  if (!nextButton) {
    const paginationLinks = document.querySelectorAll('[class*="pagination"] a, nav a, .pagination a');
    for (let li = 0; li < paginationLinks.length; li++) {
      const linkEl = paginationLinks[li];
      const text = (linkEl.textContent || '').trim().toLowerCase();
      const href = linkEl.getAttribute('href');
      if ((text === 'weiter' || text === '>' || text === '›') && href && href.indexOf('seite:') !== -1) {
        nextButton = linkEl; break;
      }
    }
  }
  if (!nextButton) {
    const targetPage = currentPage + 1;
    const seiteLinks = document.querySelectorAll('a[href*="seite:"]');
    for (let sl = 0; sl < seiteLinks.length; sl++) {
      const href = seiteLinks[sl].getAttribute('href');
      if (href && href.indexOf('seite:' + targetPage) !== -1) {
        nextButton = seiteLinks[sl]; break;
      }
    }
  }
  if (nextButton) {
    const href = nextButton.getAttribute('href');
    Logger.log('Next button href:', href);
    if (href) {
      try {
        if (new URL(href, location.href).href === location.href) {
          Logger.log('Next button points to same page - skipped');
          return false;
        }
      } catch (e) {
        Logger.warn(' Invalid URL in next button:', href, e);
        return false;
      }
      return href;
    }
    Logger.log('Next button has no href');
  }
  Logger.log('No next page found — either last page or pagination markup changed');
  return false;
}

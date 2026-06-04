'use strict';

import { MIN_TITLE_LENGTH } from './_constants.js';
import { createLogger } from './_logger.js';
const Logger = createLogger('MDF-WH');

/**
 * Finds ad elements on the current Willhaben search results page.
 * Uses a cascade of selectors from most specific to generic fallback.
 * @returns {{ adEntries: NodeList }|null} Object with adEntries array, or null if no ads found
 */
export function findAds() {
  const adSelectors = [
    'a[data-testid^="search-result-entry-header-"]',
    'article[data-testid^="search-result-entry-"]',
    '[data-testid*="search-result-entry"]'
  ];
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
  const urlRegex = /\/iad\/kaufen-und-verkaufen\/.*\/\d+/;
  document.querySelectorAll('a[href*="/iad/kaufen-und-verkaufen/"]').forEach(function (link) {
    const url = link.href;
    if (urlRegex.test(url) && !uniqueUrls.has(url)) {
      uniqueUrls.add(url);
      const container = link.closest('article, div[class*="box"], [data-testid*="search-result"], .ad-item, .list-item');
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
 * Extracts title, price, and URL from a Willhaben ad element.
 * @param {Element} ad - The ad container element
 * @returns {{ title: string, price: string, url: string }}
 */
export function extractBasicInfo(ad) {
  let title = 'Title not available';
  ['h3', 'h2', '[data-testid*="title"]'].forEach(function (s) {
    const el = ad.querySelector(s);
    if (el) {
      const text = el.textContent.trim();
      if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) title = text;
    }
  });

  let price = 'Price not available';
  const spans = ad.querySelectorAll('span, div, p');
  for (let pi = 0; pi < spans.length; pi++) {
    const text = spans[pi].textContent.trim();
    if ((text.indexOf('€') !== -1 || text.indexOf('EUR') !== -1) && text.length < 20 && text.indexOf('...') === -1) {
      price = text; break;
    }
  }

  const url = ad.href || (ad.querySelector('a[href*="/iad/"]') ? ad.querySelector('a[href*="/iad/"]').href : 'URL not available');
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
 * Returns CSS selectors for the description element on a Willhaben ad page.
 * @returns {string[]} Ordered array of selectors (most specific first)
 */
export function descSelectors() {
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
export function goToNextPage(currentPage) {
  let nextButton = document.querySelector('[data-testid="pagination-bottom-next-button"]');
  if (!nextButton) {
    const targetPage = currentPage + 1;
    const paginationLinks = document.querySelectorAll('[data-testid*="pagination"] a, nav a');
    for (let li = 0; li < paginationLinks.length; li++) {
      const btn = paginationLinks[li];
      const text = (btn.textContent || '').trim();
      const href = btn.getAttribute('href');
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
    const isDisabled = nextButton.hasAttribute('disabled');
    const ariaDisabled = nextButton.getAttribute('aria-disabled') === 'true';
    const href = nextButton.getAttribute('href');
    Logger.log('Next button disabled:', isDisabled, '| aria-disabled:', ariaDisabled, '| href:', href);
    // Button is not disabled but has no href — Willhaben sometimes uses
    // <button> elements for pagination (JS-driven navigation).
    // Fall back to constructing the next-page URL from the current URL.
    if (!isDisabled && !ariaDisabled && !href) {
      try {
        var url = new URL(location.href);
        var nextPage = currentPage + 1;
        url.searchParams.set('page', String(nextPage));
        var nextUrl = url.pathname + url.search;
        Logger.log('Constructed next page URL from params:', nextUrl);
        return nextUrl;
      } catch (e) {
        Logger.warn('Failed to construct next page URL:', e);
        return false;
      }
    }
    if (!isDisabled && !ariaDisabled && href) {
      try {
        if (new URL(href, location.href).href === location.href) {
          Logger.log('Next button points to same page - skipped');
          return false;
        }
      } catch (e) {
        Logger.warn('Invalid URL in next button:', href, e);
        return false;
      }
      return href;
    }
    Logger.log('Next button not usable');
  }
  return false;
}

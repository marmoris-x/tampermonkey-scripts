'use strict';

import * as whScraper from './_scraper-willhaben.js';
import * as kaScraper from './_scraper-kleinanzeigen.js';

/**
 * Detect current site and return the appropriate scraper module along with
 * site-specific metadata (name, storage prefix, button gradient).
 * @returns {{ findAds: Function, extractBasicInfo: Function, descSelectors: Function, goToNextPage: Function, siteName: string, storagePrefix: string, buttonGradient: string }}
 */
export function getScraper() {
  const isWH = window.location.hostname.includes('willhaben.at');
  return {
    ...(isWH ? whScraper : kaScraper),
    siteName: isWH ? 'WILLHABEN' : 'KLEINANZEIGEN',
    storagePrefix: isWH ? 'wh' : 'ka',
    buttonGradient: isWH
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'linear-gradient(135deg, #86a542 0%, #2d2d2d 100%)'
  };
}

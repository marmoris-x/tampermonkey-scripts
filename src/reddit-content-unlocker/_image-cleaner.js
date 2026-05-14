/**
 * @fileoverview Image blur removal utilities.
 * Cleans blur URL parameters and inline CSS filter:blur() styles
 * from images to restore full-quality content.
 *
 * @module _image-cleaner
 */

import { ATTRS, URL_PATTERNS, STYLE_PATTERNS } from './_selectors.js';

/**
 * Removes blur from all images on the page.
 * Handles two blur mechanisms:
 * 1. URL parameter-based blur: `?blur=500&format=pjpg`
 * 2. Inline style-based blur: `filter: blur(20px)`
 *
 * Marks processed images with data-unblurred attribute
 * to prevent redundant processing.
 */
export function removeImageBlur() {
  // Select all images with blur indicators that haven't been processed
  const selector = [
    'img[src*="blur="]:not([data-unblurred])',
    'img[style*="blur"]:not([data-unblurred])'
  ].join(',');

  document.querySelectorAll(selector).forEach((img) => {
    img.setAttribute(ATTRS.DATA_UNBLURRED, '1');

    // Clean URL-based blur
    if (img.src.includes('blur=')) {
      let fixed = img.src
        .replace(URL_PATTERNS.BLUR_PARAM, '')
        .replace(URL_PATTERNS.FORMAT_PJPG, '')
        .replace(URL_PATTERNS.DOUBLE_AMPERSAND, '&')
        .replace(URL_PATTERNS.QUESTION_AMPERSAND, '?');

      if (fixed !== img.src) {
        img.src = fixed;
      }
    }

    // Clean inline style blur
    const style = img.getAttribute('style') || '';
    if (style.includes('blur')) {
      img.setAttribute(
        'style',
        style.replace(STYLE_PATTERNS.BLUR_FILTER, '')
      );
    }
  });
}

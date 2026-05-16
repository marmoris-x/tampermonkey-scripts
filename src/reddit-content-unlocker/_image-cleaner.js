/**
 * @fileoverview Image URL unblurring utility.
 * Removes blur URL parameters and inline blur styles from images.
 * Works on ALL image domains (preview.redd.it, v.redd.it, etc.).
 *
 * Uses URL parameter stripping (removing ?blur=N) rather than
 * domain swapping (preview.redd.it → i.redd.it), because domain
 * swaps can break external video link thumbnails with 404 errors.
 *
 * @module _image-cleaner
 */

import { ATTRS, URL_PATTERNS, STYLE_PATTERNS } from './_selectors.js';

/**
 * Removes server-side blur from images by cleaning URL parameters
 * and inline style filters. This handles the cases where Reddit
 * serves blurred thumbnails (including video thumbnails) via
 * preview.redd.it with a blur=N URL parameter.
 *
 * Operates on the full document — catches images outside the
 * shreddit-blurred-container pattern (e.g. video thumbnails,
 * gallery previews, sidebar images).
 */
export function removeImageBlur() {
  const selector = [
    'img[src*="blur="]:not([data-unblurred])',
    'img[style*="blur"]:not([data-unblurred])'
  ].join(',');

  document.querySelectorAll(selector).forEach((img) => {
    img.setAttribute(ATTRS.DATA_UNBLURRED, '1');

    // Clean blur URL parameter (Reddit uses ?blur=N, NOT "blurred")
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

    // Clean inline blur style (CSS filter: blur(...))
    const st = img.getAttribute('style') || '';
    if (st.includes('blur')) {
      img.setAttribute('style', st.replace(STYLE_PATTERNS.BLUR_FILTER, ''));
    }
  });
}

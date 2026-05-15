/**
 * @fileoverview Image URL unblurring utility.
 * Replaces Reddit CDN preview URLs (server-side blurred) with
 * direct i.redd.it URLs that serve the full-resolution image.
 * Skips video thumbnails which have no i.redd.it counterpart.
 *
 * @module _image-cleaner
 */

import { SELECTORS, SLOTS } from './_selectors.js';

/**
 * Checks whether an img element is a video thumbnail rather than
 * a real image. Video thumbnails use preview.redd.it but have
 * no corresponding image on i.redd.it — replacing would produce a 404.
 *
 * Detection order (first match wins):
 * 1. img inside a shreddit-player element
 * 2. img inside a blurred container whose revealed slot contains video
 * 3. img inside a shreddit-post that contains video elements
 * 4. Otherwise: treat conservatively as uncertain → skip replacement
 *
 * @param {HTMLImageElement} img - The image element to check
 * @returns {boolean} True if the img is a video thumbnail
 */
export function isVideoThumbnail(img) {
  // Check 1: directly inside a video player
  if (img.closest(SELECTORS.SHREDDIT_PLAYER)) return true;

  // Check 2: inside a blurred container
  const blurredContainer = img.closest(SELECTORS.SHREDDIT_BLURRED_CONTAINER);
  if (blurredContainer) {
    // 2a: revealed slot with video content
    const revealed = blurredContainer.querySelector(`[slot="${SLOTS.REVEALED}"]`);
    if (revealed && revealed.querySelector(`${SELECTORS.SHREDDIT_PLAYER}, video`)) return true;
    // 2b: any video elements in the container
    if (blurredContainer.querySelector(`${SELECTORS.SHREDDIT_PLAYER}, video`)) return true;
  }

  // Check 3: inside a post container with video content
  const post = img.closest(SELECTORS.SHREDDIT_POST);
  if (post && post.querySelector(`${SELECTORS.SHREDDIT_PLAYER}, video`)) return true;

  // No video indicators found — assume it's an image (safe to replace)
  return false;
}

/**
 * Maps Reddit preview CDN URLs to direct image URLs.
 * preview.redd.it serves blurred images with a signed URL.
 * i.redd.it serves the same image without server-side blur.
 *
 * @param {string} src - Current image src
 * @returns {string} Unblurred image URL, or original if no match
 */
export function unblurImageUrl(src) {
  const match = src.match(/https?:\/\/(?:preview|external-preview)\.redd\.it\/([^?]+)/);
  if (match) {
    return 'https://i.redd.it/' + match[1];
  }
  return src;
}

/**
 * Replaces Reddit preview CDN image URLs with direct
 * i.redd.it URLs to remove server-side blur.
 * Skips video thumbnails to avoid 404 broken images.
 */
export function replacePreviewUrls() {
  /** @type {NodeListOf<HTMLImageElement>} */
  const images = document.querySelectorAll(
    'img[src*="preview.redd.it/"], img[src*="external-preview.redd.it/"]'
  );
  images.forEach((img) => {
    if (isVideoThumbnail(img)) return;
    const unblurred = unblurImageUrl(img.src);
    if (unblurred !== img.src) {
      img.src = unblurred;
    }
  });
}

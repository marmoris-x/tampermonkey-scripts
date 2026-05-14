/**
 * @fileoverview Image URL unblurring utility.
 * Replaces Reddit CDN preview URLs (server-side blurred) with
 * direct i.redd.it URLs that serve the full-resolution image.
 *
 * @module _image-cleaner
 */

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
 * Replaces all Reddit preview CDN image URLs with direct
 * i.redd.it URLs to remove server-side blur.
 */
export function replacePreviewUrls() {
  document.querySelectorAll(
    'img[src*="preview.redd.it/"], img[src*="external-preview.redd.it/"]'
  ).forEach((img) => {
    const unblurred = unblurImageUrl(img.src);
    if (unblurred !== img.src) {
      img.src = unblurred;
    }
  });
}

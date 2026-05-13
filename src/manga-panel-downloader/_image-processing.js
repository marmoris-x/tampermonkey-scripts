// src/manga-panel-downloader/_image-processing.js — Image download and processing
// Downloads images via network module, splits tall panels into 3500px segments.

'use strict';

import { downloadImage } from './_network.js';

const MAX_SEG_H = 3500;
const MIN_SEG_H = 600;

/**
 * Finds split points for tall panels.
 * @param {number} h - Image height in pixels
 * @returns {number[]} Array of y-coordinate split points
 */
export function findSplitPoints(h) {
  if (h <= MAX_SEG_H) return [0, h];
  const pts = [0];
  for (let y = MAX_SEG_H; y < h; y += MAX_SEG_H) pts.push(y);
  pts.push(h);
  if (pts.length > 2 && pts[pts.length - 1] - pts[pts.length - 2] < MIN_SEG_H) {
    pts.splice(pts.length - 2, 1);
  }
  return pts;
}

/**
 * Downloads an image and processes it into one or more segments.
 * Tall images are split at MAX_SEG_H intervals.
 * @param {string} url - Image URL
 * @param {number} pageNum - Sequential page number (for filename)
 * @param {Element|null} srcEl - Source DOM element for canvas fallback
 * @param {AbortSignal} [signal] - AbortSignal for cancellation
 * @returns {Promise<Array<{filename: string, blob: Blob, previewUrl: string, w: number, h: number}>>}
 */
export async function processImage(url, pageNum, srcEl, signal) {
  const blob = await downloadImage(url, signal, { el: srcEl });

  // Fast path: known dimensions, no split needed, already JPEG/PNG
  const ew = srcEl ? srcEl.naturalWidth : 0;
  const eh = srcEl ? srcEl.naturalHeight : 0;
  if (ew > 0 && eh > 0 && eh <= MAX_SEG_H && blob.type !== 'image/webp') {
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const pad = ('000' + pageNum).slice(-3);
    return [{
      filename: 'page_' + pad + '.' + ext,
      blob: blob,
      previewUrl: URL.createObjectURL(blob),
      w: ew,
      h: eh
    }];
  }

  // Decode via ObjectURL to get dimensions
  const objUrl = URL.createObjectURL(blob);
  let img;
  try {
    img = await new Promise((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('Decode failed'));
      el.src = objUrl;
    });
  } finally {
    URL.revokeObjectURL(objUrl);
  }

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const pts = findSplitPoints(h);
  const srcExt = (pts.length === 2 && blob.type === 'image/png') ? 'png' : 'jpg';
  const pad2 = ('000' + pageNum).slice(-3);
  const results = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const y0 = pts[i];
    const segH = pts[i + 1] - y0;
    const suffix = pts.length === 2 ? '' : '_part' + (i + 1);
    const filename = 'page_' + pad2 + suffix + '.' + srcExt;

    if (pts.length === 2 && blob.type !== 'image/webp') {
      // No split needed and not WebP — reuse original blob
      results.push({
        filename: filename,
        blob: blob,
        previewUrl: URL.createObjectURL(blob),
        w: w,
        h: segH
      });
    } else {
      // Need to split or re-encode — use canvas
      const segBlob = await new Promise(r => {
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = segH;
        cv.getContext('2d').drawImage(img, 0, y0, w, segH, 0, 0, w, segH);
        cv.toBlob(r, 'image/jpeg', 0.92);
      });
      results.push({
        filename: filename,
        blob: segBlob,
        previewUrl: URL.createObjectURL(segBlob),
        w: w,
        h: segH
      });
    }
  }

  return results;
}

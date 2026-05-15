// src/youtube-enhanced/auto-hd.js — Auto HD quality selection for YouTube
// Patches localStorage before YouTube reads it to set preferred quality,
// and intervenes via the native player API to force the highest available
// quality on each video.
'use strict';

import { createLogger } from './_logger.js';

const log = createLogger('YouTube Enhanced');

const THIRTY_DAYS_MS = 2592000000;

const CFG = {
  debug: false,
  preferredQuality: 8    // Fallback: 0=Auto  5=720p  6=1080p  7=1440p  8=2160p/4K
};

const QUALITY_MAP = {
  0: 'auto',
  5: 'hd720',
  6: 'hd1080',
  7: 'hd1440',
  8: 'hd2160'
};

let handledVidsHD = new WeakSet();

/**
 * Resets the WeakSet tracking which video elements have been processed for HD.
 * Must be called on SPA navigation (yt-navigate-finish) so that re-visiting
 * a watch page re-applies HD quality settings.
 */
export function resetHDTrackers() {
  handledVidsHD = new WeakSet();
}

/**
 * Patches YouTube's localStorage quality settings so the player picks
 * the user's preferred resolution (up to 2160p/4K) on initial load.
 * Writes two keys:
 * - yt-player-user-settings (legacy format with intValue codes)
 * - yt-player-quality (newer format with quality string)
 */
export function patchQuality() {
  try {
    const KEY = 'yt-player-user-settings';
    let us = {};
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.data) us = JSON.parse(p.data);
      }
    } catch (_) { }

    const now = Date.now();
    us['482'] = { intValue: CFG.preferredQuality };
    localStorage.setItem(KEY, JSON.stringify({
      creation:   now,
      data:       JSON.stringify(us),
      expiration: now + THIRTY_DAYS_MS,
    }));

    // New YouTube quality key -- forces player to preferred quality
    localStorage.setItem('yt-player-quality', JSON.stringify({
      data: JSON.stringify({ quality: QUALITY_MAP[CFG.preferredQuality], previousQuality: "auto" }),
      expiration: now + THIRTY_DAYS_MS,
      creation: now
    }));
  } catch (e) { log.debug('patchQuality error:', e); }
}

/**
 * Forces the given YouTube player to use the highest available quality
 * level up to the user's preferred setting.
 * @param {object} ytPlayer - YouTube player API object
 */
function applyAutoHD(ytPlayer) {
  try {
    if (!ytPlayer || typeof ytPlayer.getAvailableQualityLevels !== 'function') return;

    const levels = ytPlayer.getAvailableQualityLevels();
    if (!levels || levels.length === 0) return;

    const desired = QUALITY_MAP[CFG.preferredQuality];
    let targetQuality = null;

    if (desired && desired !== 'auto') {
      targetQuality = levels.find(function (q) { return q === desired; });
    }

    if (!targetQuality) {
      // Fallback: highest non-auto quality
      targetQuality = levels.find(function (q) { return q && q !== 'auto'; });
    }

    if (targetQuality) {
      if (typeof ytPlayer.setPlaybackQualityRange === 'function') {
        ytPlayer.setPlaybackQualityRange(targetQuality, targetQuality);
      }
      log.debug('AutoHD: Set to', targetQuality);
    }
  } catch (e) { log.debug('applyAutoHD error:', e); }
}

/**
 * Initializes Auto HD on a YouTube video element. Applies the preferred
 * quality immediately and attaches to loadedmetadata/playing events for
 * retries when resolution data becomes available.
 * @param {object} ytPlayer - YouTube player API object
 * @param {HTMLElement} vid - The <video> element
 */
export function initAutoHD(ytPlayer, vid) {
  if (!ytPlayer || !vid || handledVidsHD.has(vid)) return;
  handledVidsHD.add(vid);

  const force = function () { return applyAutoHD(ytPlayer); };

  force(); // Apply immediately
  vid.addEventListener('loadedmetadata', force, { once: true });
  vid.addEventListener('playing', function () { setTimeout(force, 100); }, { once: true });
}

// src/youtube-enhanced/boot.js — Main orchestrator for YouTube Enhanced
// Wires together Auto-HD, Channel Speed, and Auto-Stop modules.
// Handles initial boot and SPA navigation events.
'use strict';

import { createLogger } from './_logger.js';
import { patchQuality, resetHDTrackers } from './auto-hd.js';
import { loadSpeedData, initSpeed, cleanupSpeed } from './channel-speed.js';
import { initAutoStop, cleanupAutoStop, resetStopTrackers } from './auto-stop.js';

const log = createLogger('YouTube Enhanced', false);

// Patch localStorage quality settings immediately at module load time,
// before YouTube's player script reads them.
patchQuality();

/**
 * Main initialization function. Loads saved speed data, initializes
 * channel speed control on watch/shorts pages, and starts auto-stop.
 */
async function boot() {
  await loadSpeedData();
  if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
    initSpeed();
  }
  initAutoStop();
}

/**
 * Handles YouTube SPA navigation. Resets all trackers, reloads speed
 * data, re-applies quality settings, and re-initializes features
 * appropriate for the new page.
 */
window.addEventListener('yt-navigate-finish', async () => {
  resetHDTrackers();
  resetStopTrackers();
  await loadSpeedData();
  patchQuality();

  cleanupSpeed();
  if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
    initSpeed();
  }

  cleanupAutoStop();
  initAutoStop();
});

export { boot };

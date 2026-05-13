// src/anisearch-endless-scroll/boot.js — Bootstrap entry point
// No external shared dependencies.

import { createLogger } from './logger.js';
import { newRun, findContainer, isCurrentRun, runEndlessLoop } from './endless-loop.js';
import { parseRatingMin } from './rating-filter.js';
import { setStatus, removeStatus, unlockUI } from './ui.js';
import { patchHistory } from './history-patch.js';

const log = createLogger('AniSearch Endless Scroll');

/**
 * Main entry: initializes run, unlocks UI, detects container, starts loop.
 */
export async function main() {
  const runId = newRun();

  setStatus('⟳ Scanning AniSearch…');

  // Remove UI locks immediately
  unlockUI();
  // Retry after 1.5s in case site JS restores them
  setTimeout(unlockUI, 1500);

  // Determine rating minimum
  const ratingMin = await parseRatingMin();
  log.log('Rating min:', ratingMin || 'no filter');

  // Quick check whether any list exists (before the sleep)
  if (!findContainer(document)) {
    setStatus('✔ Ready. (No listing detected)');
    setTimeout(() => { removeStatus(); }, 4000);
    return;
  }

  // Brief wait for site JS to finish rendering, then determine container fresh
  await new Promise((r) => setTimeout(r, 250));
  if (!isCurrentRun(runId)) {
    removeStatus();
    return;
  }

  const found = findContainer(document);
  if (!found) {
    setStatus('✔ Ready. (No listing detected)');
    setTimeout(() => { removeStatus(); }, 4000);
    return;
  }

  // Main loop
  await runEndlessLoop(ratingMin, found, runId);

  // Auto-remove status bar after completion
  setTimeout(() => { removeStatus(); }, 8000);
}

/**
 * Injects CSS and starts the script once DOM is ready.
 */
export function boot() {
  // Inject spinner keyframe (used by the loader indicator)
  const style = document.createElement('style');
  style.textContent = '@keyframes as-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes as-ring{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
}

/**
 * Registers the Tampermonkey menu command and sets up SPA navigation support.
 * Call this from the entry file to enable manual start via TM menu.
 */
export function registerBoot() {
  GM_registerMenuCommand('Load All Pages', () => {
    patchHistory(main);
    boot();
  });
}

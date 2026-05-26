// src/youtube-enhanced/boot.js — Main orchestrator for YouTube Enhanced
// Wires together Auto-HD, Channel Speed, Auto-Stop, and Anti-Translate modules.
// Handles initial boot and SPA navigation events.
'use strict';

// ── Iframe guard ───────────────────────────────────────────────────────────
// Allow top-level window, embed iframes, and nocookie embed iframes.
// Skip all other frames (e.g., YouTube's internal ad/overlay iframes).
const _isTopLevel = window === window.top;
const _isEmbedFrame = window.location.pathname.startsWith('/embed/');
const _isNocookieDomain = window.location.hostname.includes('youtube-nocookie.com');

if (!_isTopLevel && !_isEmbedFrame && !_isNocookieDomain) {
  // Silently abort — this is an internal YouTube iframe
  throw new Error('[YouTube Enhanced] Skipping internal iframe');
}

// ── Imports ────────────────────────────────────────────────────────────────
import { patchQuality, resetHDTrackers } from './auto-hd.js';
import { loadSpeedData, initSpeed, cleanupSpeed } from './channel-speed.js';
import { initAutoStop, cleanupAutoStop, resetStopTrackers } from './auto-stop.js';

import { loadATSettings, saveATSettings, setATSettingsCache, getATSettingsSync, AT_DEFAULTS } from './_storage.js';
import { initAntiTranslateCore } from './_anti-translate-core.js';
import { initAntiTranslateTitles, resetAntiTranslateTitles } from './anti-translate-titles.js';
import { initAntiTranslateAudio } from './anti-translate-audio.js';
import { initAntiTranslateDescription } from './anti-translate-description.js';
import { initAntiTranslateNotifications } from './anti-translate-notifications.js';
import { initAntiTranslateSubtitles } from './anti-translate-subtitles.js';
import { initAntiTranslateChannelBranding } from './anti-translate-channelbranding.js';

// Patch localStorage quality settings immediately at module load time,
// before YouTube's player script reads them.
patchQuality();

// ── Anti-Translate Bootstrap ───────────────────────────────────────────────

/**
 * Initializes all anti-translate sub-modules.
 * @param {object} settings - AT settings from GM storage
 */
async function bootAntiTranslate(settings) {
  if (settings.disabled) return;

  // 1. Core must be first — sets up window.YoutubeAntiTranslate and settings bridge
  initAntiTranslateCore(() => getATSettingsSync());

  // 2. Titles + thumbnails (background.js equivalent)
  if (settings.untranslateTitle || settings.untranslateDescription ||
      settings.untranslateChannelBranding || settings.untranslateThumbnail) {
    initAntiTranslateTitles();
  }

  // 3. Audio dubbing bypass
  if (settings.untranslateAudio) {
    initAntiTranslateAudio();
  }

  // 4. Descriptions, chapters, snippets
  if (settings.untranslateDescription || settings.untranslateChapters) {
    initAntiTranslateDescription();
  }

  // 5. Notification popup titles
  if (settings.untranslateNotification) {
    initAntiTranslateNotifications();
  }

  // 6. Subtitle track selection
  if (settings.subtitlesEnabled) {
    initAntiTranslateSubtitles();
  }

  // 7. Channel branding (only on channel pages; guard is inside the module)
  if (settings.untranslateChannelBranding) {
    initAntiTranslateChannelBranding();
  }
}

// ── Settings Menu ──────────────────────────────────────────────────────────

function registerSettingsMenu() {
  GM.registerMenuCommand('⚙ YT Anti-Translate Settings', () => {
    const s = getATSettingsSync();
    const json = prompt(
      'YT Anti-Translate Settings (JSON):\nEdit and click OK to save.\n' +
      'Keys: untranslateTitle, untranslateAudio, untranslateDescription,\n' +
      'untranslateChapters, untranslateChannelBranding, untranslateNotification,\n' +
      'untranslateThumbnail, subtitlesEnabled, subtitlesLanguage,\n' +
      'whiteListUntranslateTitle (array of @handles)',
      JSON.stringify(s, null, 2)
    );
    if (json) {
      try {
        const parsed = JSON.parse(json);
        saveATSettings({ ...AT_DEFAULTS, ...parsed }).then(() => {
          setATSettingsCache({ ...AT_DEFAULTS, ...parsed });
          alert('Settings saved. Reload the page to apply.');
        });
      } catch {
        alert('Invalid JSON — settings not saved.');
      }
    }
  });
}

// ── Main Boot ──────────────────────────────────────────────────────────────

/**
 * Main initialization function. Loads saved speed data, initializes
 * channel speed control on watch/shorts pages, starts auto-stop,
 * and bootstraps anti-translate features.
 */
async function boot() {
  // Existing: speed data, channel speed, auto-stop
  await loadSpeedData();
  if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
    initSpeed();
  }
  initAutoStop();

  // Anti-translate
  const atSettings = await loadATSettings();
  setATSettingsCache(atSettings);
  await bootAntiTranslate(atSettings);

  // Settings menu
  registerSettingsMenu();
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

  // Anti-translate SPA handling
  const atSettings = await loadATSettings();
  setATSettingsCache(atSettings);

  // Reset intersection observers for new page
  resetAntiTranslateTitles();

  // Re-run subtitle selection (new video)
  if (atSettings.subtitlesEnabled) {
    initAntiTranslateSubtitles();
  }

  // Re-initialize channel branding if navigated to/from a channel page
  if (atSettings.untranslateChannelBranding) {
    initAntiTranslateChannelBranding();
  }
});

export { boot };

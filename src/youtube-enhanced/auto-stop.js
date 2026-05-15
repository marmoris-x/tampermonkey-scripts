// src/youtube-enhanced/auto-stop.js — Auto-stop video playback for YouTube
// Pauses video playback automatically when navigating to a supported page
// (/watch, /shorts, /channel, /@, /playlist, /live). Also handles catching
// auto-play that starts after the initial pause.
'use strict';

import { createLogger } from './_logger.js';
import { observeMutations } from './_dom.js';
import { initAutoHD } from './auto-hd.js';

const log = createLogger('YouTube Enhanced');

const PS_PLAYING   = 1; // YouTube player state: PLAYING
const PS_BUFFERING = 3; // YouTube player state: BUFFERING

const STOP_PATHS  = ['/channel','/watch','/shorts','/@','/playlist','/live'];
let stopObs     = null;

let handledVids = new WeakSet();

/**
 * Resets the WeakSet tracking which video elements have been handled for auto-stop.
 * Must be called on SPA navigation (yt-navigate-finish) so that newly loaded
 * videos are paused as expected.
 */
export function resetStopTrackers() {
  handledVids = new WeakSet();
}

/**
 * Pauses video playback on the given YouTube player and video element.
 * Also sets up one-time event listeners to catch auto-play attempts
 * within a 2-second window after initialization.
 * @param {object} youtubePlayer - YouTube player API object
 * @param {HTMLElement} videoElement - The <video> element
 */
function stopVideoPlayback(youtubePlayer, videoElement) {
  if (!youtubePlayer || !videoElement || handledVids.has(videoElement)) return;

  handledVids.add(videoElement);

  try {
    const playerState = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : undefined;
    if (playerState === PS_PLAYING || playerState === PS_BUFFERING) {
      youtubePlayer.pauseVideo();
    }
  } catch (error) {
    log.warn('Error pausing video:', error);
  }

  // One-time event listener to catch auto-play
  let hasIntercepted = false;

  const handleAutoPlay = function () {
    if (hasIntercepted) return;

    try {
      const state = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : undefined;
      if (state === PS_PLAYING || state === PS_BUFFERING) {
        hasIntercepted = true;
        youtubePlayer.pauseVideo();

        videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
        videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
      }
    } catch (error) {
      log.warn('Error in event handler:', error);
    }
  };

  videoElement.addEventListener('play', handleAutoPlay, { capture: true });
  videoElement.addEventListener('playing', handleAutoPlay, { capture: true });

  // Fallback: remove listeners after short delay to allow manual play
  setTimeout(function () {
    if (!hasIntercepted) {
      videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
      videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
    }
  }, 2000);
}

/**
 * Locates the YouTube player and video element in the DOM and applies
 * auto-stop and auto-HD. Returns false if the player is not ready yet.
 * @returns {boolean} true if player was found and processed
 */
function checkForPlayer() {
  const playerElement = document.querySelector('ytd-player');
  const videoElement = document.querySelector('.html5-main-video');

  // Bugfix: removed "|| document.getElementById('movie_player')".
  // Requiring the player API on the element prevents ghost players
  // from prior videos triggering too early.
  const youtubePlayer = playerElement ? playerElement.player_ : undefined;

  if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
    stopVideoPlayback(youtubePlayer, videoElement);
    initAutoHD(youtubePlayer, videoElement);
    cleanupAutoStop();
    return true;
  }
  return false;
}

/**
 * Initializes auto-stop for the current page. Only activates on paths
 * matching STOP_PATHS. If the player is not yet available, sets up a
 * MutationObserver to wait for it.
 */
export function initAutoStop() {
  if (!STOP_PATHS.some(function (p) { return location.pathname.startsWith(p); })) {
    cleanupAutoStop();
    return;
  }

  if (checkForPlayer()) return;

  if (stopObs) stopObs.disconnect();
  stopObs = observeMutations(function (_, obs) {
    if (checkForPlayer()) obs.disconnect();
  }, document.documentElement);

  setTimeout(checkForPlayer, 100);
}

/**
 * Cleans up the auto-stop MutationObserver.
 */
export function cleanupAutoStop() {
  if (stopObs) { stopObs.disconnect(); stopObs = null; }
}

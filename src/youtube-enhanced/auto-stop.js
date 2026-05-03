(function () {
    'use strict';

    /**
     * Auto-Stop module for YouTube Enhanced.
     * Pauses video playback automatically when navigating to a supported page
     * (/watch, /shorts, /channel, /@, /playlist, /live). Also handles catching
     * auto-play that starts after the initial pause.
     */

    var YTE = window.__YTE__ = window.__YTE__ || {};

    var PS_PLAYING   = 1; // YouTube player state: PLAYING
    var PS_BUFFERING = 3; // YouTube player state: BUFFERING

    var STOP_PATHS  = ['/channel','/watch','/shorts','/@','/playlist','/live'];
    var stopObs     = null;

    /**
     * Pauses video playback on the given YouTube player and video element.
     * Also sets up one-time event listeners to catch auto-play attempts
     * within a 2-second window after initialization.
     * @param {object} youtubePlayer - YouTube player API object
     * @param {HTMLElement} videoElement - The <video> element
     */
    YTE.stopVideoPlayback = function (youtubePlayer, videoElement) {
        if (!youtubePlayer || !videoElement || YTE.handledVids.has(videoElement)) return;

        YTE.handledVids.add(videoElement);

        try {
            var playerState = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : undefined;
            if (playerState === PS_PLAYING || playerState === PS_BUFFERING) {
                youtubePlayer.pauseVideo();
            }
        } catch (error) {
            YTE.log.warn('Error pausing video:', error);
        }

        // One-time event listener to catch auto-play
        var hasIntercepted = false;

        var handleAutoPlay = function () {
            if (hasIntercepted) return;

            try {
                var state = youtubePlayer.getPlayerState ? youtubePlayer.getPlayerState() : undefined;
                if (state === PS_PLAYING || state === PS_BUFFERING) {
                    hasIntercepted = true;
                    youtubePlayer.pauseVideo();

                    videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                    videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
                }
            } catch (error) {
                YTE.log.warn('Error in event handler:', error);
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
    };

    /**
     * Locates the YouTube player and video element in the DOM and applies
     * auto-stop and auto-HD. Returns false if the player is not ready yet.
     * @returns {boolean} true if player was found and processed
     */
    YTE.checkForPlayer = function () {
        var playerElement = document.querySelector('ytd-player');
        var videoElement = document.querySelector('.html5-main-video');

        // Bugfix: removed "|| document.getElementById('movie_player')".
        // Requiring the player API on the element prevents ghost players
        // from prior videos triggering too early.
        var youtubePlayer = playerElement ? playerElement.player_ : undefined;

        if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
            YTE.stopVideoPlayback(youtubePlayer, videoElement);
            YTE.initAutoHD(youtubePlayer, videoElement);
            YTE.cleanupAutoStop();
            return true;
        }
        return false;
    };

    /**
     * Initializes auto-stop for the current page. Only activates on paths
     * matching STOP_PATHS. If the player is not yet available, sets up a
     * MutationObserver to wait for it.
     */
    YTE.initAutoStop = function () {
        if (!STOP_PATHS.some(function (p) { return location.pathname.startsWith(p); })) {
            YTE.cleanupAutoStop();
            return;
        }

        if (YTE.checkForPlayer()) return;

        if (stopObs) stopObs.disconnect();
        stopObs = TM.dom.observeMutations(function (addedNode, obs) {
            if (YTE.checkForPlayer()) obs.disconnect();
        }, document.documentElement);

        setTimeout(YTE.checkForPlayer, 100);
    };

    /**
     * Cleans up the auto-stop MutationObserver.
     */
    YTE.cleanupAutoStop = function () {
        if (stopObs) { stopObs.disconnect(); stopObs = null; }
    };
})();

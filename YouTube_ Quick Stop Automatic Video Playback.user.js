// ==UserScript==
// @name            YouTube: Quick Stop Automatic Video Playback
// @namespace       org.sidneys.userscripts
// @version         5.2.1
// @description     Stop automatic video playback everywhere with optimized performance and reliability
// @author          sidneys (modified)
// @noframes
// @match           http*://www.youtube.com/*
// @run-at          document-start
// @grant           none
// @icon            https://www.youtube.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    // Track handled videos to prevent duplicate processing
    const handledVideos = new WeakSet();

    // Paths where script should run
    const urlPathList = ['/channel', '/watch', '/shorts', '/@', '/playlist', '/live', '/embed'];

    /**
     * Stop video playback and prevent auto-play
     */
    const stopVideoPlayback = (youtubePlayer, videoElement) => {
        if (!youtubePlayer || !videoElement || handledVideos.has(videoElement)) return;

        handledVideos.add(videoElement);

        try {
            // Immediately pause if playing
            const playerState = youtubePlayer.getPlayerState?.();
            if (playerState === 1 || playerState === 3) { // PLAYING or BUFFERING
                youtubePlayer.pauseVideo();
            }
        } catch (error) {
            console.debug('[YouTube Auto-Stop] Error pausing video:', error);
        }

        // Set up ONE-TIME event listener to catch auto-play
        // Using 'once: true' ensures it only fires once and auto-removes
        let hasIntercepted = false;

        const handleAutoPlay = (event) => {
            // Only intercept the very first automatic play
            if (hasIntercepted) return;

            try {
                const state = youtubePlayer.getPlayerState?.();
                // Only prevent if video is trying to play automatically (not already paused by user)
                if (state === 1 || state === 3) { // PLAYING or BUFFERING
                    hasIntercepted = true;
                    youtubePlayer.pauseVideo();

                    // Remove all listeners after successful interception
                    videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                    videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
                }
            } catch (error) {
                console.debug('[YouTube Auto-Stop] Error in event handler:', error);
            }
        };

        // Add listeners with capture phase to intercept early
        // These will auto-remove after first successful pause
        videoElement.addEventListener('play', handleAutoPlay, { capture: true, passive: true });
        videoElement.addEventListener('playing', handleAutoPlay, { capture: true, passive: true });

        // Fallback: Remove listeners after short delay if nothing happened
        setTimeout(() => {
            if (!hasIntercepted) {
                videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
            }
        }, 2000);
    };

    let observer = null;

    /**
     * Check for player and video elements
     */
    const checkForPlayer = () => {
        const playerElement = document.querySelector('ytd-player');
        const videoElement = document.querySelector('video');
        const youtubePlayer = playerElement?.player_;

        if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
            stopVideoPlayback(youtubePlayer, videoElement);
            return true;
        }
        return false;
    };

    /**
     * Initialize or re-initialize the script
     */
    const init = () => {
        if (!urlPathList.some(path => window.location.pathname.startsWith(path))) {
            cleanup();
            return;
        }

        // Try immediate check first
        if (checkForPlayer()) return;

        // Set up MutationObserver for efficient player detection
        if (!observer) {
            observer = new MutationObserver(() => {
                // Check if player is now available
                checkForPlayer();
            });
        }

        // Observe the entire document for changes
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Fallback check after short delay
        setTimeout(checkForPlayer, 100);
    };

    /**
     * Cleanup function
     */
    const cleanup = () => {
        if (observer) {
            observer.disconnect();
        }
    };

    /**
     * Handle YouTube SPA navigation
     */
    const handleNavigation = () => {
        cleanup();
        init();
    };

    // Listen for YouTube's SPA navigation
    window.addEventListener('yt-navigate-finish', handleNavigation);

    // Also listen for popstate for back/forward navigation
    window.addEventListener('popstate', handleNavigation);

    // Initial run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

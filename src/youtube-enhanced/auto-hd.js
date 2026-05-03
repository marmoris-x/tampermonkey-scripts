(function () {
    'use strict';

    /**
     * Auto HD module for YouTube Enhanced.
     * Patches localStorage before YouTube reads it to set preferred quality,
     * and intervenes via the native player API to force the highest available
     * quality on each video.
     */

    var YTE = window.__YTE__ = window.__YTE__ || {};

    var THIRTY_DAYS_MS = 2592000000;

    /**
     * Patches YouTube's localStorage quality settings so the player picks
     * the user's preferred resolution (up to 2160p/4K) on initial load.
     * Writes two keys:
     * - yt-player-user-settings (legacy format with intValue codes)
     * - yt-player-quality (newer format with quality string)
     */
    YTE.patchQuality = function () {
        try {
            var KEY = 'yt-player-user-settings';
            var us = {};
            try {
                var raw = localStorage.getItem(KEY);
                if (raw) {
                    var p = JSON.parse(raw);
                    if (p && p.data) us = JSON.parse(p.data);
                }
            } catch (_) { }

            var now = Date.now();
            us['482'] = { intValue: YTE.CFG.preferredQuality };
            localStorage.setItem(KEY, JSON.stringify({
                creation:   now,
                data:       JSON.stringify(us),
                expiration: now + THIRTY_DAYS_MS,
            }));

            // New YouTube quality key -- forces player to preferred quality
            localStorage.setItem('yt-player-quality', JSON.stringify({
                data: JSON.stringify({ quality: YTE.QUALITY_MAP[YTE.CFG.preferredQuality], previousQuality: "auto" }),
                expiration: now + THIRTY_DAYS_MS,
                creation: now
            }));
        } catch (e) { YTE.log.debug('patchQuality error:', e); }
    };

    /**
     * Forces the given YouTube player to use the highest available quality
     * level up to the user's preferred setting.
     * @param {object} ytPlayer - YouTube player API object
     */
    YTE.applyAutoHD = function (ytPlayer) {
        try {
            if (!ytPlayer || typeof ytPlayer.getAvailableQualityLevels !== 'function') return;

            var levels = ytPlayer.getAvailableQualityLevels();
            if (!levels || levels.length === 0) return;

            var desired = YTE.QUALITY_MAP[YTE.CFG.preferredQuality];
            var targetQuality = null;

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
                YTE.log.debug('AutoHD: Set to', targetQuality);
            }
        } catch (e) { YTE.log.debug('applyAutoHD error:', e); }
    };

    /**
     * Initializes Auto HD on a YouTube video element. Applies the preferred
     * quality immediately and attaches to loadedmetadata/playing events for
     * retries when resolution data becomes available.
     * @param {object} ytPlayer - YouTube player API object
     * @param {HTMLElement} vid - The <video> element
     */
    YTE.initAutoHD = function (ytPlayer, vid) {
        if (!ytPlayer || !vid || YTE.handledVidsHD.has(vid)) return;
        YTE.handledVidsHD.add(vid);

        var force = function () { return YTE.applyAutoHD(ytPlayer); };

        force(); // Apply immediately
        vid.addEventListener('loadedmetadata', force, { once: true });
        vid.addEventListener('playing', function () { setTimeout(force, 100); }, { once: true });
    };
})();

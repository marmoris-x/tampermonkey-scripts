// ==UserScript==
// @name         YouTube - Als geschaut markieren
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Markiert YouTube-Videos über einen Menü-Befehl als geschaut durch direktes Abspielen
// @author       marmoris & Roo (fixed version)
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[YouTube Mark as Watched] Script geladen (Version 5.0)');

    // CSS für die Fortschrittsanzeige
    GM_addStyle(`
        .mark-watched-progress {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 99999;
            font-size: 14px;
            min-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .mark-watched-progress .title {
            font-weight: bold;
            margin-bottom: 10px;
        }
        .mark-watched-progress .status {
            color: #ffd700;
        }
    `);

    // --- HAUPTFUNKTIONALITÄT ---

    // Prüfe ob wir gerade ein Video automatisch verarbeiten
    checkAutoProcess();

    // Registriere Menü-Befehl
    GM_registerMenuCommand('Videos als geschaut markieren...', showMarkVideosDialog);

    function showMarkVideosDialog() {
        const input = prompt(
            'Fügen Sie YouTube-Links ein (getrennt durch Leerzeichen oder Zeilenumbruch):\n\n' +
            'Beispiele:\n' +
            '• https://www.youtube.com/watch?v=VIDEO_ID\n' +
            '• https://youtu.be/VIDEO_ID\n' +
            '• Mehrere Links mit Enter getrennt',
            ''
        );

        if (!input) return;

        const urls = extractYouTubeUrls(input);
        if (urls.length === 0) {
            alert('Keine gültigen YouTube-Links gefunden.');
            return;
        }

        // Öffne alle URLs gleichzeitig in neuen Tabs
        urls.forEach((url, index) => {
            const processUrl = url + (url.includes('?') ? '&' : '?') + 'autoplay=1';
            setTimeout(() => {
                window.open(processUrl, '_blank');
            }, index * 500); // Verzögerung von 500ms zwischen den Tabs
        });

        // Zeige Erfolgsmeldung
        GM_notification({
            title: 'YouTube - Tabs geöffnet!',
            text: `${urls.length} Videos wurden in neuen Tabs geöffnet.`,
            timeout: 5000
        });

        alert(`${urls.length} Videos wurden in neuen Tabs geöffnet.\n\nJedes Video wird automatisch als "geschaut" markiert, sobald es geladen wird.`);
    }

    function extractYouTubeUrls(input) {
        const patterns = [
            /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/g,
            /https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/g
        ];

        let urls = [];
        patterns.forEach(pattern => {
            const matches = input.match(pattern);
            if (matches) urls = urls.concat(matches);
        });

        // Normalisiere alle URLs zu youtube.com/watch?v= Format
        return urls.map(url => {
            if (url.includes('youtu.be/')) {
                const videoId = url.split('youtu.be/')[1].split('?')[0];
                return `https://www.youtube.com/watch?v=${videoId}`;
            } else if (url.includes('/shorts/')) {
                const videoId = url.split('/shorts/')[1].split('?')[0];
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
            return url;
        });
    }

    // Diese Funktion wird nicht mehr benötigt, da alle Tabs gleichzeitig geöffnet werden

    function checkAutoProcess() {
        // Prüfe ob dies ein YouTube-Video ist und verarbeite es automatisch
        if (window.location.pathname === '/watch') {
            // Warte bis das Video geladen ist
            waitForVideo().then(video => {
                markCurrentVideoAsWatched(video);
            });
        }
    }

    function waitForVideo() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const video = document.querySelector('video');
                if (video && video.readyState >= 2) { // HAVE_CURRENT_DATA
                    clearInterval(checkInterval);
                    resolve(video);
                }
            }, 500);

            // Timeout nach 10 Sekunden
            setTimeout(() => {
                clearInterval(checkInterval);
                const video = document.querySelector('video');
                if (video) resolve(video);
                else {
                    console.error('[YT Mark Watched] Video-Element nicht gefunden');
                    processNextVideo(); // Überspringe dieses Video
                }
            }, 10000);
        });
    }

    function markCurrentVideoAsWatched(video) {
        console.log(`[YT Mark Watched] Verarbeite Video...`);

        try {
            // Stelle sicher, dass das Video stummgeschaltet ist
            video.muted = true;

            // Erhöhe die Wiedergabegeschwindigkeit
            video.playbackRate = 16;

            // Springe nahe ans Ende (95% der Dauer)
            const targetTime = video.duration * 0.95;
            video.currentTime = targetTime;

            // Spiele das Video ab
            video.play().then(() => {
                console.log('[YT Mark Watched] Video wird abgespielt...');

                // Warte 3 Sekunden, damit YouTube die Wiedergabe registriert
                setTimeout(() => {
                    video.pause();

                    // Speichere die Video-ID
                    const urlParams = new URLSearchParams(window.location.search);
                    const videoId = urlParams.get('v');
                    if (videoId) {
                        saveWatchedVideo(videoId);
                        console.log(`[YT Mark Watched] Video ${videoId} als geschaut markiert`);

                        // Zeige Erfolgsmeldung
                        showVideoProcessedMessage(videoId);
                    }
                }, 3000);
            }).catch(error => {
                console.error('[YT Mark Watched] Fehler beim Abspielen:', error);
            });

        } catch (error) {
            console.error('[YT Mark Watched] Fehler:', error);
        }
    }

    function showProgress(current, total) {
        let progressDiv = document.querySelector('.mark-watched-progress');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.className = 'mark-watched-progress';
            document.body.appendChild(progressDiv);
        }

        progressDiv.innerHTML = `
            <div class="title">📺 YouTube - Als geschaut markieren</div>
            <div class="status">⏳ Verarbeite Video ${current} von ${total}...</div>
            <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
                Bitte warten Sie, bis alle Videos verarbeitet wurden.
            </div>
        `;
    }

    function showCompletionMessage(total) {
        let progressDiv = document.querySelector('.mark-watched-progress');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.className = 'mark-watched-progress';
            document.body.appendChild(progressDiv);
        }

        progressDiv.innerHTML = `
            <div class="title">📺 YouTube - Als geschaut markieren</div>
            <div class="status" style="color: #4caf50;">✅ Alle ${total} Videos wurden erfolgreich verarbeitet!</div>
        `;

        GM_notification({
            title: 'YouTube - Erledigt!',
            text: `Alle ${total} Videos wurden als geschaut markiert.`,
            timeout: 5000
        });

        setTimeout(() => {
            progressDiv.remove();
            // Navigiere zur YouTube-Startseite oder Verlauf
            window.open('https://www.youtube.com/feed/history', '_blank');
        }, 3000);
    }

    function cleanupProcessing() {
        GM_deleteValue('videos_to_process');
        GM_deleteValue('current_index');
        GM_deleteValue('total_videos');
        GM_deleteValue('auto_process');
    }

    function saveWatchedVideo(videoId) {
        const watched = JSON.parse(localStorage.getItem('ytMarkAsWatched') || '[]');
        if (!watched.includes(videoId)) {
            watched.push(videoId);
            localStorage.setItem('ytMarkAsWatched', JSON.stringify(watched));
        }

        // Zusätzlich: Zeitstempel speichern
        const watchHistory = JSON.parse(localStorage.getItem('ytWatchHistory') || '{}');
        watchHistory[videoId] = {
            watchedAt: new Date().toISOString(),
            markedByScript: true
        };
        localStorage.setItem('ytWatchHistory', JSON.stringify(watchHistory));
    }

    // --- ZUSÄTZLICHE FEATURES ---

    // Zeige gespeicherte Videos im Menü
    GM_registerMenuCommand('Zeige Verlauf (Skript)', () => {
        const watched = JSON.parse(localStorage.getItem('ytMarkAsWatched') || '[]');
        const watchHistory = JSON.parse(localStorage.getItem('ytWatchHistory') || '{}');

        if (watched.length === 0) {
            alert('Noch keine Videos über das Skript als geschaut markiert.');
            return;
        }

        let message = `Über das Skript als geschaut markierte Videos: ${watched.length}\n\n`;
        message += 'Letzte 10 Videos:\n';

        const recent = watched.slice(-10).reverse();
        recent.forEach(id => {
            const info = watchHistory[id];
            const date = info ? new Date(info.watchedAt).toLocaleString('de-DE') : 'Unbekannt';
            message += `• ${id} (${date})\n`;
        });

        alert(message);
    });

    // Lösche Skript-Verlauf
    GM_registerMenuCommand('Skript-Verlauf löschen', () => {
        if (confirm('Möchten Sie den Skript-Verlauf wirklich löschen?\n\n(Dies betrifft nur die lokale Liste des Skripts, nicht den YouTube-Verlauf)')) {
            localStorage.removeItem('ytMarkAsWatched');
            localStorage.removeItem('ytWatchHistory');
            alert('Skript-Verlauf wurde gelöscht.');
        }
    });

})();
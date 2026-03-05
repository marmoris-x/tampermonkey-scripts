// ==UserScript==
// @name         YouTube Auto HD/4K
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  Erzwingt automatisch die höchste verfügbare Videoqualität auf YouTube.
// @author       marmoris
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        none
// @icon         https://www.youtube.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        debug: true,  // Debug-Ausgabe in der Konsole
        preferredQuality: 8  // 0=Auto, 5=720p, 6=1080p, 7=1440p, 8=2160p/4K
    };

    const STATE = {
        lastVideoId: null,
        qualityFixed: false
    };

    const log = (...args) => {
        if (CONFIG.debug) console.log('[YT-AutoHD]', ...args);
    };

    // =========================================================================
    // LOCALSTORAGE PATCHING - Setzt YouTube's interne Quality-Präferenz
    // =========================================================================
    function patchQualitySettings() {
        try {
            const settingsKey = 'yt-player-user-settings';
            let userSettings = {};

            const currentSettings = localStorage.getItem(settingsKey);
            if (currentSettings) {
                try {
                    const parsed = JSON.parse(currentSettings);
                    if (parsed.data) {
                        userSettings = JSON.parse(parsed.data);
                    }
                } catch (e) {}
            }

            // Key 482 = Quality Setting
            // Werte: 0=Auto, 1=Tiny, 2=Small, 3=Medium, 4=Large, 5=HD720, 6=HD1080, 7=HD1440, 8=HD2160
            userSettings['482'] = { intValue: CONFIG.preferredQuality };

            const settingsData = {
                creation: Date.now(),
                data: JSON.stringify(userSettings),
                expiration: Date.now() + (30 * 24 * 60 * 60 * 1000)
            };

            localStorage.setItem(settingsKey, JSON.stringify(settingsData));
            log('Quality auf Maximum gesetzt (Key 482 =', CONFIG.preferredQuality + ')');

        } catch (error) {
            log('Settings Fehler:', error);
        }
    }

    // =========================================================================
    // MENÜ-BASIERTE QUALITÄTS-AUSWAHL (Fallback)
    // =========================================================================
    async function setQualityViaMenu() {
        return new Promise((resolve) => {
            const settingsButton = document.querySelector('.ytp-settings-button');
            if (!settingsButton) {
                resolve(false);
                return;
            }

            const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

            // Öffne Einstellungen
            settingsButton.dispatchEvent(click);

            setTimeout(() => {
                // Finde Qualitäts-Menü
                const menuItems = document.querySelectorAll('.ytp-menuitem');
                const qualityTerms = ['quality', 'qualität', 'calidad', 'qualité', '画質', '품질', 'качество'];
                let qualityItem = null;

                for (const item of menuItems) {
                    const label = item.querySelector('.ytp-menuitem-label');
                    if (label && qualityTerms.some(t => label.textContent.toLowerCase().includes(t))) {
                        qualityItem = item;
                        break;
                    }
                }

                if (!qualityItem) {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                    resolve(false);
                    return;
                }

                qualityItem.dispatchEvent(click);

                setTimeout(() => {
                    // Wähle höchste Qualität
                    const options = document.querySelectorAll('.ytp-panel-menu .ytp-menuitem');
                    let bestOption = null;
                    let bestRes = 0;

                    for (const opt of options) {
                        const label = opt.querySelector('.ytp-menuitem-label');
                        if (!label) continue;
                        const match = label.textContent.match(/(\d{3,4})p/);
                        if (match) {
                            const res = parseInt(match[1]);
                            if (res > bestRes) {
                                bestRes = res;
                                bestOption = opt;
                            }
                        }
                    }

                    if (bestOption) {
                        log('Qualität via Menü gesetzt:', bestRes + 'p');
                        bestOption.dispatchEvent(click);
                        STATE.qualityFixed = true;
                        resolve(true);
                    } else {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                        resolve(false);
                    }
                }, 100);
            }, 100);
        });
    }

    // =========================================================================
    // HAUPTLOGIK
    // =========================================================================
    function getVideoId() {
        const url = new URL(window.location.href);
        return url.searchParams.get('v') || url.pathname.split('/').pop();
    }

    async function processVideo() {
        const videoId = getVideoId();

        if (videoId !== STATE.lastVideoId) {
            STATE.lastVideoId = videoId;
            STATE.qualityFixed = false;
            log('Neues Video:', videoId);
        }

        if (STATE.qualityFixed) return;

        const player = document.getElementById('movie_player');
        if (!player) return;

        // Fallback: Menü-Methode nach kurzer Verzögerung
        setTimeout(async () => {
            if (!STATE.qualityFixed) {
                await setQualityViaMenu();
            }
        }, 2000);
    }

    // =========================================================================
    // INITIALISIERUNG
    // =========================================================================
    function init() {
        log('YouTube Auto HD v6.1 gestartet');

        // localStorage patchen (vor Video-Laden)
        patchQualitySettings();

        // Navigation Events
        window.addEventListener('yt-navigate-finish', () => {
            STATE.qualityFixed = false;
            patchQualitySettings();
            setTimeout(processVideo, 500);
        });

        window.addEventListener('yt-page-data-updated', () => {
            setTimeout(processVideo, 500);
        });

        // Initial
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(processVideo, 1000));
        } else {
            setTimeout(processVideo, 1000);
        }

        // Regelmäßige Prüfung
        setInterval(() => {
            if (window.location.pathname === '/watch' || window.location.pathname.includes('/shorts/')) {
                if (getVideoId() !== STATE.lastVideoId) {
                    processVideo();
                }
            }
        }, 3000);
    }

    init();

})();
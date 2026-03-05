// ==UserScript==
// @name         Voe Advanced Blocker
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Removes ad overlays (even after style changes) and blocks pop-ups without affecting page functionality.
// @author       marmoris
// @match        *://*.lancewhosedifficult.com/*
// @match        *://*.voe.sx/*
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiA1LjY5bC01IDQuN1YxOEg5djVsNmwtNi00LjY5TDYgNnY2SDRWMTAuNEw3IDhsLTUgMyAxMCA5IDktOC0xMC05ek0xMiAyTDIgMHYxNmg0di00aDR2NGg0di00aDRWMEwxMiAyeiIvPjwvc3ZnPg==
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Der CSS-Selektor, der die Werbecontainer eindeutig identifiziert.
    const AD_SELECTOR = 'div[style*="z-index: 2147483647"]';

    /**
     * MODUL 1: Gezielter Pop-up-Blocker
     * Verhindert das Öffnen neuer Fenster, indem die dafür zuständige Funktion neutralisiert wird.
     */
    const initPopupBlocker = () => {
        window.open = function() {
            console.log('[Voe Blocker] window.open() call blocked.');
            return null;
        };
        console.log('[Voe Blocker] window.open blocker initialized.');
    };

    /**
     * MODUL 2: Robuster Werbe-Overlay-Entferner
     * Nutzt einen MutationObserver UND einen Timer als Fallback.
     */
    const initOverlayRemover = () => {
        // Funktion, die alle passenden Werbe-Elemente sucht und entfernt.
        const cleanupAds = () => {
            const ads = document.querySelectorAll(AD_SELECTOR);
            if (ads.length > 0) {
                ads.forEach(ad => {
                    ad.remove();
                });
            }
        };

        // Der Observer, der auf Änderungen am DOM reagiert.
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                // FALL 1: Ein neues Element wurde hinzugefügt.
                if (mutation.type === 'childList') {
                    cleanupAds(); // Sicherste Methode: Bei jeder Änderung kurz aufräumen.
                }
                // FALL 2: Ein Attribut (wie z.B. 'style') wurde geändert.
                if (mutation.type === 'attributes') {
                    if (mutation.target.matches && mutation.target.matches(AD_SELECTOR)) {
                        mutation.target.remove();
                    }
                }
            }
        });

        // Starte den Observer so früh wie möglich mit erweiterten Optionen.
        const startObserver = () => {
            if (document.documentElement) {
                observer.observe(document.documentElement, {
                    childList: true,      // Beobachte das Hinzufügen/Entfernen von Kindern.
                    subtree: true,        // Beobachte auch alle Unterelemente.
                    attributes: true,     // **NEU**: Beobachte auch Attribut-Änderungen.
                    attributeFilter: ['style'] // Nur auf Änderungen am 'style'-Attribut reagieren.
                });
                console.log('[Voe Blocker] Advanced Overlay remover initialized.');
            } else {
                window.setTimeout(startObserver, 10);
            }
        };

        // Starte die Überwachung.
        startObserver();

        // **SICHERHEITSNETZ**: Führe alle 500ms eine manuelle Reinigung durch.
        // Das fängt alle Werbeelemente, die der Observer aus irgendeinem Grund verpasst.
        setInterval(cleanupAds, 500);
    };

    // Führe alle Module aus.
    initPopupBlocker();
    initOverlayRemover();

})();

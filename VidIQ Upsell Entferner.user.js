// ==UserScript==
// @name         VidIQ Upsell Entferner
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Entfernt VidIQ Upsell-Elemente von YouTube
// @author       ClaudeScript
// @match        https://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=vidiq.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Funktion zum Entfernen des Upsell-Elements
    function entferneUpsellElement() {
        const upsellElements = document.querySelectorAll('div.vidiq-social-stats-upsell');
        if (upsellElements.length > 0) {
            console.log('VidIQ Upsell Entferner: ' + upsellElements.length + ' Element(e) gefunden und entfernt.');
            upsellElements.forEach(element => {
                element.style.display = 'none'; // Zuerst ausblenden
                setTimeout(() => element.remove(), 100); // Dann komplett entfernen
            });
        }
    }

    // Führe die Funktion sofort aus
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', entferneUpsellElement);
    } else {
        entferneUpsellElement();
    }

    // Beobachte DOM-Änderungen um dynamisch eingefügte Elemente zu entfernen
    const beobachter = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                entferneUpsellElement();
            }
        });
    });

    // Starte den Beobachter, sobald das Dokument geladen ist
    document.addEventListener('DOMContentLoaded', function() {
        beobachter.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    // Wiederhole die Überprüfung in regelmäßigen Abständen für mehr Sicherheit
    setInterval(entferneUpsellElement, 2000);
})();
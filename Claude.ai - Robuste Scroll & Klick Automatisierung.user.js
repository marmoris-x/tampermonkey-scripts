// ==UserScript==
// @name         Claude.ai - Robuste Scroll & Klick Automatisierung
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Findet scrollbare Bereiche und scrollt/klickt intelligent, bis alle Inhalte geladen sind. Start via Kontextmenü.
// @author       marmoris
// @match        https://claude.ai/*
// @run-at       context-menu
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Konfiguration ---
    const CLICK_DELAY_MS = 1000; // Pause nach einem Klick, um auf das Laden zu warten.
    const SCROLL_DELAY_MS = 500;   // Pause nach dem Scrollen.
    const STABILITY_CHECKS = 2;    // Wie oft der Zustand unverändert sein muss, bevor der Prozess stoppt.

    /**
     * Versucht, das primäre scrollbare Element auf der Seite zu finden.
     * Fallback: Das Haupt-Dokument selbst.
     */
    function findScrollContainer() {
        console.log("Suche nach scrollbarem Container...");
        const elements = Array.from(document.querySelectorAll('*'));
        let bestCandidate = document.documentElement; // Fallback auf das Hauptfenster

        for (const el of elements) {
            const style = window.getComputedStyle(el);
            const isScrollable = style.overflowY === 'scroll' || style.overflowY === 'auto';
            // Prüft, ob das Element tatsächlich scrollbaren Inhalt hat und sichtbar ist.
            if (isScrollable && el.scrollHeight > el.clientHeight && el.clientHeight > 200) {
                 console.log("Potenzieller Scroll-Container gefunden:", el);
                 bestCandidate = el;
                 break; // Nimm den ersten guten Kandidaten
            }
        }
        // Falls der Container das Dokument selbst ist, setzen wir das Scroll-Objekt auf `window`.
        const scrollTarget = (bestCandidate === document.documentElement) ? window : bestCandidate;
        const scrollElement = (bestCandidate === document.documentElement) ? document.body : bestCandidate;

        console.log("Verwende folgendes Element zum Scrollen:", scrollElement);
        return { scrollTarget, scrollElement };
    }

    /**
     * Die asynchrone Hauptfunktion, die den gesamten Prozess steuert.
     */
    async function runAutomation() {
        console.log("Robuste Automatisierung gestartet.");
        const { scrollTarget, scrollElement } = findScrollContainer();
        let stabilityCounter = 0;
        let lastScrollHeight = 0;

        while (stabilityCounter < STABILITY_CHECKS) {
            let actionTaken = false;
            lastScrollHeight = scrollElement.scrollHeight;

            // 1. Scrollen
            console.log("Scrolle nach unten...");
            scrollTarget.scrollTo(0, scrollElement.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, SCROLL_DELAY_MS));

            // 2. Button suchen und klicken
            const showMoreButton = Array.from(document.querySelectorAll('button.Button_secondary__Teecd'))
                                        .find(btn => btn.textContent.trim() === 'Mehr anzeigen');

            if (showMoreButton && !showMoreButton.disabled) {
                console.log("Button 'Mehr anzeigen' gefunden und geklickt.");
                showMoreButton.click();
                actionTaken = true;
                await new Promise(resolve => setTimeout(resolve, CLICK_DELAY_MS));
            }

            // 3. Stabilitätsprüfung
            if (scrollElement.scrollHeight === lastScrollHeight && !actionTaken) {
                stabilityCounter++;
                console.log(`Keine Änderung festgestellt. Stabilitäts-Check: ${stabilityCounter}/${STABILITY_CHECKS}`);
            } else {
                // Wenn sich etwas geändert hat, Zähler zurücksetzen.
                stabilityCounter = 0;
                console.log("Neue Inhalte geladen, setze Stabilitäts-Check zurück.");
            }
        }

        console.log("Automatisierung abgeschlossen. Alle verfügbaren Inhalte wurden geladen.");
    }

    // Starte den Prozess
    runAutomation();

})();
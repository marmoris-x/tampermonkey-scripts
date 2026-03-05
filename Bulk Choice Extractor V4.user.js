// ==UserScript==
// @name         Bulk Choice Extractor V4
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Fügt einen "Copy Bulk" Button nur neben dem "Clear All Choices" Button hinzu, um Label/Value-Paare zu kopieren.
// @author       marmoris
// @match        https://dashboard.botghost.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=botghost.com
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function createAndInjectButton() {
        // 1. Finde den "Clear All Choices" Button als Ankerpunkt.
        const clearAllButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === 'Clear All Choices');

        // 2. Fahre nur fort, wenn der Anker-Button existiert.
        if (clearAllButton) {
            const targetContainer = clearAllButton.parentElement;

            // 3. Prüfe, ob der Container gültig ist und unser Button noch nicht existiert.
            if (targetContainer && !document.getElementById('bulk-copy-button')) {
                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy Bulk';
                copyButton.id = 'bulk-copy-button';

                // Styling aus der vorherigen Version.
                copyButton.className = 'ml-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#ffb296] hover:bg-[#4d352a] transition-colors';
                copyButton.style.color = '#ffb296';

                copyButton.addEventListener('click', () => {
                    const choiceContainers = document.querySelectorAll('.space-y-2 > div[class*="bg-"]');
                    const lines = [];

                    choiceContainers.forEach(container => {
                        const inputs = container.querySelectorAll('input[type="text"]');
                        if (inputs.length === 2) {
                            const label = inputs[0].value.trim();
                            const value = inputs[1].value.trim();
                            if (label && value) {
                                lines.push(`${label},${value}`);
                            }
                        }
                    });

                    if (lines.length > 0) {
                        const outputString = lines.join('\n');
                        GM_setClipboard(outputString);
                        copyButton.textContent = `Copied ${lines.length} items!`;
                    } else {
                        copyButton.textContent = 'Nothing to copy!';
                    }

                    setTimeout(() => {
                        copyButton.textContent = 'Copy Bulk';
                    }, 2500);
                });

                // Füge den neuen Button zum Container des Anker-Buttons hinzu.
                targetContainer.appendChild(copyButton);
            }
        }
    }

    const observer = new MutationObserver((mutationsList, observer) => {
        // Die Funktion wird bei jeder DOM-Änderung aufgerufen, ist aber durch die internen Prüfungen sicher.
        createAndInjectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Führe eine initiale Prüfung beim Laden des Skripts durch.
    createAndInjectButton();
})();

// ==UserScript==
// @name         BotGhost Bulk Choice Extractor
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.7
// @description  Adds a "Copy Bulk" button next to "Clear All Choices" to copy label/value pairs.
// @author       marmoris-x
// @match        https://dashboard.botghost.com/*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=botghost.com
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @sandbox      JavaScript
// @inject-into  content
// @grant        GM_setClipboard
// @noframes
// @unwrap
// @run-at       document-end
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const log = TM.createLogger('BotGhost Bulk Choice Extractor');

    function createAndInjectButton() {
        // 1. Find the "Clear All Choices" button as anchor point.
        const clearAllButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === 'Clear All Choices');

        // 2. Only proceed if the anchor button exists.
        if (clearAllButton) {
            const targetContainer = clearAllButton.parentElement;

            // 3. Check if container is valid and our button does not exist yet.
            if (targetContainer && !document.getElementById('bulk-copy-button')) {
                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy Bulk';
                copyButton.id = 'bulk-copy-button';

                // Styling preserved from the previous version.
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

                // Append the new button to the anchor button's container.
                targetContainer.appendChild(copyButton);
            }
        }
    }

    const observer = new MutationObserver(() => {
        // Called on every DOM change but safe due to guarded checks inside createAndInjectButton.
        createAndInjectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Run an initial check on script load.
    createAndInjectButton();
})();

// ==UserScript==
// @name         BotGhost Bulk Choice Extractor
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.8.0
// @description  Adds a "Copy Bulk" button next to "Clear All Choices" to copy label/value pairs.
// @author       marmoris-x
// @match        https://dashboard.botghost.com/*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=botghost.com
// @sandbox      JavaScript
// @inject-into  content
// @grant        GM_setClipboard
// @noframes
// @run-at       document-idle
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/BotGhost%20Bulk%20Choice%20Extractor.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

import { createLogger } from './src/shared/logging-utils.js';
import { observeMutations } from './src/shared/dom-utils.js';

const log = createLogger('BotGhost Bulk Choice Extractor');

    /**
     * Finds the "Clear All Choices" button and injects a "Copy Bulk" sibling button.
     * Guarded — skips if the button already exists or the anchor is missing.
     */
    function createAndInjectButton() {
        // Find the "Clear All Choices" button as anchor point.
        const clearAllButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === 'Clear All Choices');

        // Only proceed if the anchor button exists.
        if (clearAllButton) {
            const targetContainer = clearAllButton.parentElement;

            // Check if container is valid and our button does not exist yet.
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

    observeMutations(() => {
        createAndInjectButton();
    }, document.body);

    // Run an initial check on script load.
    createAndInjectButton();

// ==UserScript==
// @name         FlameComics Advanced Sort
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds custom sorting options (alphabetical, hearts count) to FlameComics
// @author       marmoris
// @match        https://flamecomics.xyz/*
// @match        https://www.flamecomics.xyz/*
// @match        https://flamecomics.com/*
// @match        https://www.flamecomics.com/*
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://flamecomics.xyz
// @run-at       document-end
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/FlameComics%20Advanced%20Sort.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/FlameComics%20Advanced%20Sort.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('[FlameComics Sort] Script loaded - v1.3');

    const styles = `
        .custom-sort-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            margin-top: 4px;
            background: var(--mantine-color-body, #1a1b1e);
            border: 1px solid var(--mantine-color-default-border, #373a40);
            border-radius: var(--mantine-radius-default, 4px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            z-index: 9999;
            overflow: hidden;
            min-width: 200px;
        }

        .custom-sort-option {
            padding: 10px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--mantine-color-text, #c1c2c5);
            font-size: 14px;
            font-family: var(--mantine-font-family);
        }

        .custom-sort-option:hover {
            background: var(--mantine-color-default-hover, #25262b);
        }

        .custom-sort-option.active {
            background: var(--mantine-primary-color-filled, #228be6);
            color: white;
        }

        .sort-icon {
            width: 16px;
            height: 16px;
            opacity: 0.9;
        }

        /* Wrapper muss Block sein und 100% Breite haben, da der Original-Button data-block="true" ist */
        .sort-button-wrapper {
            position: relative;
            display: block;
            width: 100%;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    let currentSort = 'default';
    let dropdownOpen = false;

    // --- SORTIER LOGIK (Unverändert gut) ---

    function getSeriesWrappers() {
        // Suche nach inneren Karten-Containern
        const innerCards = document.querySelectorAll('[class*="DescSeriesCard_cardContainer"]');
        const wrappers = new Set();

        innerCards.forEach(card => {
            // Gehe hoch zum Mantine Grid Column
            const wrapper = card.closest('[class*="mantine-Grid-col"]');
            if (wrapper) {
                wrappers.add(wrapper);
            }
        });

        return Array.from(wrappers);
    }

    function getHeartsCount(wrapper) {
        const heartIcon = wrapper.querySelector('svg.bi-heart-fill');
        if (!heartIcon) return 0;

        const group = heartIcon.closest('[class*="mantine-Group-root"]');
        if (group) {
            const textEl = group.querySelector('p[class*="mantine-Text-root"]');
            if (textEl) {
                const text = textEl.textContent.trim();
                let multiplier = 1;
                if (text.toLowerCase().includes('k')) multiplier = 1000;
                if (text.toLowerCase().includes('m')) multiplier = 1000000;

                const num = parseFloat(text.replace(/[^0-9.]/g, ''));
                return Math.floor(num * multiplier) || 0;
            }
        }
        return 0;
    }

    function getTitle(wrapper) {
        const titleEl = wrapper.querySelector('[class*="DescSeriesCard_title"]');
        return titleEl ? titleEl.textContent.trim() : '';
    }

    function performSort(compareFunction) {
        const wrappers = getSeriesWrappers();
        if (wrappers.length === 0) return;

        const container = wrappers[0].parentElement;
        if (!container) return;

        const sortData = wrappers.map(wrapper => ({
            wrapper: wrapper,
            title: getTitle(wrapper),
            hearts: getHeartsCount(wrapper)
        }));

        sortData.sort(compareFunction);

        sortData.forEach(item => {
            container.appendChild(item.wrapper);
        });
    }

    const sortActions = {
        'alpha-asc': () => performSort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true})),
        'alpha-desc': () => performSort((a, b) => b.title.localeCompare(a.title, undefined, {numeric: true})),
        'hearts-desc': () => performSort((a, b) => b.hearts - a.hearts),
        'hearts-asc': () => performSort((a, b) => a.hearts - b.hearts)
    };

    // --- UI LOGIK ---

    function createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-sort-dropdown';

        const options = [
            { id: 'alpha-asc', text: 'Alphabetical (A-Z)', icon: 'M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371zm1.57-.785L11 2.687h-.047l-.652 2.157z M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645zm-8.46-.5a.5.5 0 0 1-1 0V3.707L2.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.5.5 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L4.5 3.707z' },
            { id: 'alpha-desc', text: 'Alphabetical (Z-A)', icon: 'M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371zm1.57-.785L11 2.687h-.047l-.652 2.157z M4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293z' },
            { id: 'hearts-desc', text: 'Most Popular First', icon: 'M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314' },
            { id: 'hearts-asc', text: 'Least Popular First', icon: 'm8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01z' }
        ];

        let html = '';
        options.forEach(opt => {
            html += `
            <div class="custom-sort-option ${currentSort === opt.id ? 'active' : ''}" data-sort="${opt.id}">
                <svg class="sort-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="${opt.icon}"/>
                </svg>
                <span>${opt.text}</span>
            </div>`;
        });
        dropdown.innerHTML = html;

        dropdown.querySelectorAll('.custom-sort-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const sortType = option.dataset.sort;

                if (sortActions[sortType]) {
                    sortActions[sortType]();
                    currentSort = sortType;
                }
                closeDropdown();
            });
        });

        return dropdown;
    }

    function closeDropdown() {
        const dropdown = document.querySelector('.custom-sort-dropdown');
        if (dropdown) dropdown.remove();
        dropdownOpen = false;
    }

    // Präzise Suche nach dem Button anhand der HTML Struktur
    function findSortButton() {
        // Suche nach dem Span mit dem Text "Sort Order"
        const labels = Array.from(document.querySelectorAll('.mantine-Button-label'));
        const label = labels.find(el => el.textContent.trim() === 'Sort Order');

        // Wenn gefunden, gehe hoch zum Button-Element
        if (label) {
            return label.closest('button');
        }
        return null;
    }

    function setupSortButton(button) {
        if (!button || button.getAttribute('data-sort-enhanced') === 'true') return;

        console.log('[FlameComics Sort] Hooking into button:', button);
        button.setAttribute('data-sort-enhanced', 'true');

        // Wrapper erstellen
        const wrapper = document.createElement('div');
        wrapper.className = 'sort-button-wrapper';

        // Button in Wrapper verschieben
        // WICHTIG: insertBefore sorgt dafür, dass der Wrapper an der exakt gleichen Stelle landet
        button.parentNode.insertBefore(wrapper, button);
        wrapper.appendChild(button);

        // Klonen um alte Event Listener der Seite zu entfernen
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        // Neuen Click Handler hinzufügen
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (dropdownOpen) {
                closeDropdown();
            } else {
                const dropdown = createDropdown();
                wrapper.appendChild(dropdown);
                dropdownOpen = true;

                // Close on click outside
                const closeHandler = (evt) => {
                    if (!wrapper.contains(evt.target)) {
                        closeDropdown();
                        document.removeEventListener('click', closeHandler);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeHandler), 0);
            }
        });
    }

    function init() {
        const observer = new MutationObserver(() => {
            const btn = findSortButton();
            // Checken ob Button existiert und noch nicht bearbeitet wurde
            if (btn && !btn.hasAttribute('data-sort-enhanced')) {
                setupSortButton(btn);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initialer Versuch
        const btn = findSortButton();
        if (btn) setupSortButton(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
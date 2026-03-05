// ==UserScript==
// @name         Gutefrage Enhanced Suite
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Kombinierte Lösung: Erweiterte Filteroptionen und automatisches Tag-Management für gutefrage.net
// @author       marmoris
// @match        https://www.gutefrage.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gutefrage.net
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @grant        window.close
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // SHARED UTILITIES
    // ============================================

    class Utils {
        static async waitForElements(selector, maxWaitTime = 15000, checkInterval = 500) {
            const startTime = Date.now();

            return new Promise((resolve) => {
                const checkForElements = () => {
                    const elements = document.querySelectorAll(selector);
                    const elapsed = Date.now() - startTime;

                    if (elements.length > 0) {
                        console.log(`[Gutefrage Suite] Elements found: ${selector} after ${elapsed}ms`);
                        resolve(elements);
                        return;
                    }

                    if (elapsed >= maxWaitTime) {
                        console.log(`[Gutefrage Suite] Timeout for ${selector} (${maxWaitTime}ms)`);
                        resolve(elements);
                        return;
                    }

                    setTimeout(checkForElements, checkInterval);
                };

                checkForElements();
            });
        }

        static async waitForPageReady() {
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });

            const criticalSelectors = ['.Tag-container', '.Tag', 'article', 'main'];
            for (const selector of criticalSelectors) {
                const elements = await Utils.waitForElements(selector, 8000, 300);
                if (elements.length > 0) break;
            }

            const adaptiveDelay = Math.min(3000, Math.max(500, document.querySelectorAll('*').length / 100));
            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        }

        static debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    }

    // ============================================
    // TAG REMOVER MODULE
    // ============================================

    class TagRemover {
        constructor() {
            this.tagsToRemove = ['islam', 'allah', 'muslime', 'koran', 'mohammed'];
            this.init();
        }

        init() {
            this.addRemoveTagButtons();
            this.autoRemoveAndClose();
            this.observeNewContent();
        }

        removeTag(tagElement) {
            const hideButton = tagElement.querySelector('.Tag-action');
            if (hideButton) {
                hideButton.click();
                console.log(`[Tag Remover] Tag removed: ${tagElement.getAttribute('aria-label')}`);
                return true;
            }
            return false;
        }

        async removeUnwantedTags() {
            console.log('[Tag Remover] Starting tag removal process...');
            await Utils.waitForPageReady();

            let tagsRemoved = 0;
            const maxAttempts = 3;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const tagContainers = document.querySelectorAll('.Tag-container');
                console.log(`[Tag Remover] Attempt ${attempt}/${maxAttempts}, found ${tagContainers.length} containers`);

                if (tagContainers.length === 0 && attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }

                for (const tagContainer of tagContainers) {
                    const tagSlug = tagContainer.querySelector('.Tag')?.getAttribute('data-tag-slug');

                    if (tagSlug && this.tagsToRemove.includes(tagSlug.toLowerCase())) {
                        if (this.removeTag(tagContainer)) {
                            tagsRemoved++;
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    }
                }

                if (tagContainers.length > 0) break;
            }

            console.log(`[Tag Remover] Completed. Total tags removed: ${tagsRemoved}`);
            return tagsRemoved;
        }

        addRemoveTagButtons() {
            const articles = document.querySelectorAll('article.ListingElement, .ContentCard');

            articles.forEach(article => {
                if (article.querySelector('.custom-remove-tags-button')) return;

                let buttonContainer = article.querySelector('.ListingElement-bottomBar--withItemActions .u-flex:last-child');
                if (!buttonContainer) {
                    buttonContainer = article.querySelector('.ContentCard-action, .ContentCard-actions');
                }
                if (!buttonContainer) {
                    const tagSection = article.querySelector('.Tag');
                    if (tagSection) buttonContainer = tagSection.parentElement;
                }

                if (buttonContainer) {
                    const removeTagsButton = document.createElement('button');
                    removeTagsButton.className = 'Tag custom-remove-tags-button';
                    removeTagsButton.style.cssText = `
                        background-color: #dc3545;
                        color: white;
                        border: none;
                        padding: 4px 12px;
                        margin-left: 8px;
                        border-radius: 12px;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background-color 0.2s;
                        display: inline-flex;
                        align-items: center;
                        height: 24px;
                        white-space: nowrap;
                    `;
                    removeTagsButton.textContent = 'Tags entfernen';
                    removeTagsButton.title = 'Entfernt unerwünschte Tags von diesem Beitrag';

                    removeTagsButton.addEventListener('mouseenter', function() {
                        this.style.backgroundColor = '#c82333';
                    });

                    removeTagsButton.addEventListener('mouseleave', function() {
                        this.style.backgroundColor = '#dc3545';
                    });

                    removeTagsButton.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const questionLink = article.querySelector('a[href*="/frage/"], .ContentCard-link, .ListingElement-questionLink');
                        if (questionLink) {
                            const url = new URL(questionLink.href);
                            url.searchParams.set('removeTagsAuto', 'true');

                            removeTagsButton.textContent = 'Wird bearbeitet...';
                            removeTagsButton.style.backgroundColor = '#28a745';

                            if (typeof GM_openInTab !== 'undefined') {
                                GM_openInTab(url.href, { active: false, insert: true, setParent: true });
                            } else {
                                window.open(url.href, '_blank');
                            }

                            setTimeout(() => {
                                removeTagsButton.textContent = 'Tags entfernen';
                                removeTagsButton.style.backgroundColor = '#dc3545';
                            }, 2000);
                        }
                    });

                    buttonContainer.appendChild(removeTagsButton);
                }
            });
        }

        async autoRemoveAndClose() {
            const urlParams = new URLSearchParams(window.location.search);

            if (urlParams.get('removeTagsAuto') === 'true') {
                console.log('[Tag Remover] Auto-remove mode activated');

                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #ffc107;
                    color: #000;
                    padding: 15px 20px;
                    border-radius: 8px;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    font-size: 14px;
                    font-weight: 500;
                `;
                notification.textContent = 'Warte auf vollständiges Laden der Seite...';
                document.body.appendChild(notification);

                try {
                    const progressInterval = setInterval(() => {
                        const tagContainers = document.querySelectorAll('.Tag-container');
                        notification.textContent = `Seite wird geladen... (${tagContainers.length} Tags gefunden)`;
                    }, 1000);

                    const tagsRemoved = await this.removeUnwantedTags();
                    clearInterval(progressInterval);

                    notification.style.background = '#4CAF50';
                    notification.style.color = '#fff';
                    notification.textContent = `✓ ${tagsRemoved} Tag(s) entfernt! Tab wird geschlossen...`;

                    setTimeout(() => {
                        window.close();
                        setTimeout(() => {
                            notification.textContent = 'Bitte schließen Sie diesen Tab manuell.';
                            notification.style.background = '#17a2b8';
                        }, 500);
                    }, 2000);

                } catch (error) {
                    console.error('[Tag Remover] Error:', error);
                    notification.style.background = '#dc3545';
                    notification.style.color = '#fff';
                    notification.textContent = 'Fehler beim Entfernen der Tags!';
                }
            }
        }

        observeNewContent() {
            const observer = new MutationObserver((mutations) => {
                const hasNewContent = mutations.some(mutation => {
                    return Array.from(mutation.addedNodes).some(node => {
                        return node.nodeType === 1 && (
                            node.matches?.('article.ListingElement, .ContentCard') ||
                            node.querySelector?.('article.ListingElement, .ContentCard')
                        );
                    });
                });

                if (hasNewContent) {
                    this.addRemoveTagButtons();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ============================================
    // ENHANCED FILTER MODULE
    // ============================================

    GM_addStyle(`
        .FilterMenu {
            max-height: 60vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding-right: 10px !important;
            position: relative !important;
        }

        .FilterMenu::-webkit-scrollbar {
            width: 6px;
        }

        .FilterMenu::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 3px;
        }

        .FilterMenu::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 3px;
            transition: background 0.2s;
        }

        .FilterMenu::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.5);
        }

        .FilterMenu {
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0.1);
        }

        .Toggletip-content {
            max-height: 70vh !important;
        }

        .enhanced-filter-section {
            margin-top: 15px;
        }

        .FilterMenu-subsection {
            margin-left: 10px;
            margin-top: 10px;
            font-size: 13px;
            color: #666;
        }

        .date-range-container {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }

        .date-range-container > div {
            flex: 1;
        }

        .FormInput--small .FormInput-field {
            padding: 8px;
            font-size: 13px;
        }

        .keyword-input-container {
            margin: 10px 0;
        }

        .keyword-input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 13px;
            background: rgba(255,255,255,0.05);
            color: inherit;
        }

        .keyword-input:focus {
            outline: none;
            border-color: #4a90e2;
        }

        .filter-number-range {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 10px 0;
        }

        .filter-number-range input {
            width: 60px;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 13px;
            background: rgba(255,255,255,0.05);
            color: inherit;
        }

        .FilterMenu-info {
            font-size: 11px;
            color: #888;
            margin-top: 5px;
        }

        .filter-active-indicator {
            display: inline-block;
            width: 6px;
            height: 6px;
            background-color: #4a90e2;
            border-radius: 50%;
            margin-left: 5px;
        }

        .FilterMenu-section {
            position: sticky;
            top: -1px;
            background: inherit;
            z-index: 1;
            padding-bottom: 5px;
        }

        .enhanced-reset-button {
            display: flex;
            align-items: center;
            transition: all 0.3s ease;
        }

        .enhanced-reset-button:hover {
            background-color: #f5f5f5;
        }

        .enhanced-reset-button:active {
            transform: scale(0.98);
        }
    `);

    class EnhancedFilterIntegration {
        constructor() {
            if (!this.isHomePage()) return;

            this.filters = this.loadFilters();
            this.filtersEnabled = false; // Filter sind standardmäßig deaktiviert
            this.debouncedApplyFilters = Utils.debounce(() => this.applyFilters(), 300);
            this.observeFilterMenu();
            this.observeFilterButton();
            // observeNewPosts() wird erst aufgerufen, wenn Filter aktiviert werden
        }

        isHomePage() {
            return window.location.pathname.startsWith('/home/');
        }

        loadFilters() {
            const savedFilters = GM_getValue('enhancedFilters', {
                afterDate: '',
                contentFilters: {
                    onlyBookmarked: false,
                    hideBookmarked: false
                },
                interactionFilters: {
                    minAnswers: '',
                    maxAnswers: '',
                    minLikes: ''
                },
                textFilters: {
                    keywords: '',
                    excludeKeywords: ''
                }
            });

            return savedFilters;
        }

        saveFilters() {
            GM_setValue('enhancedFilters', this.filters);
        }

        observeFilterButton() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            const filterButton = node.querySelector ? node.querySelector('.Filter-button') :
                                                  (node.classList?.contains('Filter-button') ? node : null);

                            if (filterButton) {
                                this.attachFilterButtonListener(filterButton);
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });

            const existingFilterButton = document.querySelector('.Filter-button');
            if (existingFilterButton) {
                this.attachFilterButtonListener(existingFilterButton);
            }
        }

        attachFilterButtonListener(filterButton) {
            if (filterButton.hasAttribute('data-enhanced-listener')) return;
            filterButton.setAttribute('data-enhanced-listener', 'true');

            filterButton.addEventListener('click', () => {
                // Aktiviere Filter beim Klick
                this.enableFilters();
                setTimeout(() => this.applyFilters(), 300);
            });
        }

        observeFilterMenu() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList?.contains('Toggletip-content')) {
                            const filterMenu = node.querySelector('.FilterMenu');
                            if (filterMenu) {
                                this.enhanceFilterMenu(filterMenu);
                                // Filter werden nicht automatisch angewendet beim Öffnen des Menüs
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });

            const existingMenu = document.querySelector('.Toggletip-content .FilterMenu');
            if (existingMenu) {
                this.enhanceFilterMenu(existingMenu);
                // Filter werden nicht automatisch angewendet
            }
        }

        enableFilters() {
            if (!this.filtersEnabled) {
                this.filtersEnabled = true;
                this.observeNewPosts(); // Starte Observer für neue Posts
                console.log('[Enhanced Filter] Filters activated!');
            }
        }

        observeNewPosts() {
            // Verhindere mehrfaches Initialisieren
            if (this.postObserver) return;

            this.postObserver = new MutationObserver((mutations) => {
                // Nur filtern wenn Filter aktiviert sind
                if (!this.filtersEnabled) return;

                const hasNewPosts = mutations.some(mutation => {
                    return Array.from(mutation.addedNodes).some(node => {
                        return node.nodeType === 1 && (
                            node.matches?.('.Plate.ListingElement') ||
                            node.querySelector?.('.Plate.ListingElement')
                        );
                    });
                });

                if (hasNewPosts) {
                    console.log('[Enhanced Filter] New posts detected, applying filters...');
                    this.debouncedApplyFilters();
                }
            });

            this.postObserver.observe(document.body, { childList: true, subtree: true });
            console.log('[Enhanced Filter] Observer for new posts initialized');
        }

        enhanceFilterMenu(filterMenu) {
            if (filterMenu.querySelector('.enhanced-filter-section')) return;

            const searchForm = filterMenu.querySelector('form');
            const newFiltersHTML = this.getEnhancedFiltersHTML();

            if (searchForm) {
                searchForm.insertAdjacentHTML('afterend', newFiltersHTML);
            } else {
                filterMenu.lastElementChild.insertAdjacentHTML('afterend', newFiltersHTML);
            }

            this.attachEventListeners(filterMenu);
            this.updateFilterIndicator();
        }

        getEnhancedFiltersHTML() {
            return `
                <hr class="FilterMenu-divider">
                <div class="FilterMenu-section enhanced-filter-section">Datumsfilter</div>

                <div class="keyword-input-container">
                    <label class="FilterMenu-subsection">Nach Datum (ab diesem Datum):</label>
                    <input type="datetime-local" class="keyword-input"
                           value="${this.filters.afterDate || ''}" data-filter="afterDate">
                    <div class="FilterMenu-info">Zeigt nur Beiträge ab diesem Datum</div>
                </div>

                <hr class="FilterMenu-divider">
                <div class="FilterMenu-section enhanced-filter-section">Gemerkte Beiträge</div>

                <div class="FilterMenu-option">
                    <div class="Toggle-container u-sizeFull">
                        <div class="Toggle-containerInner u-flex u-flexAlignItemsCenter u-flexJustifyBetween">
                            <label class="Toggle-text" for="filter-only-bookmarked">Nur gemerkte anzeigen</label>
                            <button class="Toggle-button u-mrm" type="button" id="filter-only-bookmarked" role="switch"
                                    aria-checked="${this.filters.contentFilters.onlyBookmarked}" data-filter="contentFilters.onlyBookmarked">
                                <span class="Toggle ${this.filters.contentFilters.onlyBookmarked ? 'Toggle--on' : 'Toggle--off'}">
                                    <span class="Toggle-label"></span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="FilterMenu-option">
                    <div class="Toggle-container u-sizeFull">
                        <div class="Toggle-containerInner u-flex u-flexAlignItemsCenter u-flexJustifyBetween">
                            <label class="Toggle-text" for="filter-hide-bookmarked">Gemerkte ausblenden</label>
                            <button class="Toggle-button u-mrm" type="button" id="filter-hide-bookmarked" role="switch"
                                    aria-checked="${this.filters.contentFilters.hideBookmarked}" data-filter="contentFilters.hideBookmarked">
                                <span class="Toggle ${this.filters.contentFilters.hideBookmarked ? 'Toggle--on' : 'Toggle--off'}">
                                    <span class="Toggle-label"></span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <hr class="FilterMenu-divider">
                <div class="FilterMenu-section enhanced-filter-section">Interaktionsfilter</div>

                <div class="FilterMenu-subsection">Anzahl Antworten:</div>
                <div class="filter-number-range">
                    <input type="number" placeholder="Min" value="${this.filters.interactionFilters.minAnswers}"
                           data-filter="interactionFilters.minAnswers">
                    <span>bis</span>
                    <input type="number" placeholder="Max" value="${this.filters.interactionFilters.maxAnswers}"
                           data-filter="interactionFilters.maxAnswers">
                </div>

                <div class="keyword-input-container">
                    <label class="FilterMenu-subsection">Mindest-Likes:</label>
                    <input type="number" class="keyword-input" placeholder="z.B. 5"
                           value="${this.filters.interactionFilters.minLikes}" data-filter="interactionFilters.minLikes">
                </div>

                <hr class="FilterMenu-divider">
                <div class="FilterMenu-section enhanced-filter-section">Textfilter</div>

                <div class="keyword-input-container">
                    <label class="FilterMenu-subsection">Suchbegriffe (kommagetrennt):</label>
                    <input type="text" class="keyword-input" placeholder="z.B. JavaScript, HTML"
                           value="${this.filters.textFilters.keywords}" data-filter="textFilters.keywords">
                    <div class="FilterMenu-info">Zeigt nur Beiträge mit diesen Begriffen</div>
                </div>

                <div class="keyword-input-container">
                    <label class="FilterMenu-subsection">Ausschließen (kommagetrennt):</label>
                    <input type="text" class="keyword-input" placeholder="z.B. Spam, Werbung"
                           value="${this.filters.textFilters.excludeKeywords}" data-filter="textFilters.excludeKeywords">
                    <div class="FilterMenu-info">Versteckt Beiträge mit diesen Begriffen</div>
                </div>

                <hr class="FilterMenu-divider">
                <div class="FilterMenu-section enhanced-filter-section">
                    <button class="Button Button--roundWhite Button--small enhanced-reset-button"
                            style="width: 100%; justify-content: center; margin-top: 10px;">
                        <svg class="Icon Icon--refresh Icon--sbig u-mrs" aria-hidden="true" role="img" style="width: 16px; height: 16px; margin-right: 8px;">
                            <use href="/nmms-assets/logged-in-app-shell/images/icon-sprite-672c5a2efe0b0ae80106556b75d7500a.svg#shape-icon-refresh"></use>
                        </svg>
                        Erweiterte Filter zurücksetzen
                    </button>
                </div>
            `;
        }

        attachEventListeners(filterMenu) {
            filterMenu.querySelectorAll('.Toggle-button[data-filter]').forEach(button => {
                button.addEventListener('click', (e) => {
                    const toggle = button.querySelector('.Toggle');
                    const isOn = toggle.classList.contains('Toggle--on');

                    const buttonId = button.id;
                    if (buttonId === 'filter-only-bookmarked' || buttonId === 'filter-hide-bookmarked') {
                        if (!isOn) {
                            const otherButtonId = buttonId === 'filter-only-bookmarked' ? 'filter-hide-bookmarked' : 'filter-only-bookmarked';
                            const otherButton = filterMenu.querySelector(`#${otherButtonId}`);
                            if (otherButton) {
                                const otherToggle = otherButton.querySelector('.Toggle');
                                if (otherToggle.classList.contains('Toggle--on')) {
                                    otherToggle.classList.remove('Toggle--on');
                                    otherToggle.classList.add('Toggle--off');
                                    otherButton.setAttribute('aria-checked', 'false');
                                    this.updateFilterValue(otherButton.getAttribute('data-filter'), false);
                                }
                            }
                        }
                    }

                    toggle.classList.toggle('Toggle--on', !isOn);
                    toggle.classList.toggle('Toggle--off', isOn);
                    button.setAttribute('aria-checked', !isOn);

                    this.updateFilterValue(button.getAttribute('data-filter'), !isOn);
                });
            });

            filterMenu.querySelectorAll('input[data-filter]').forEach(input => {
                input.addEventListener('change', (e) => {
                    this.updateFilterValue(input.getAttribute('data-filter'), input.value);
                });
            });

            filterMenu.querySelectorAll('input, button[data-filter]').forEach(element => {
                element.addEventListener('change', () => {
                    this.enableFilters(); // Aktiviere Filter bei Änderungen
                    this.debouncedApplyFilters();
                });
                element.addEventListener('click', () => {
                    this.enableFilters(); // Aktiviere Filter bei Änderungen
                    this.debouncedApplyFilters();
                });
            });

            const resetButton = filterMenu.querySelector('.enhanced-reset-button');
            if (resetButton) {
                resetButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.resetEnhancedFilters(filterMenu);
                });
            }
        }

        updateFilterValue(filterPath, value) {
            const paths = filterPath.split('.');
            let current = this.filters;

            for (let i = 0; i < paths.length - 1; i++) {
                current = current[paths[i]];
            }

            current[paths[paths.length - 1]] = value;
            this.saveFilters();
            this.updateFilterIndicator();
        }

        updateFilterIndicator() {
            const filterButton = document.querySelector('.Filter-button');
            if (!filterButton) return;

            let activeCount = 0;

            if (this.filters.afterDate) activeCount++;

            Object.values(this.filters.contentFilters).forEach(value => {
                if (value) activeCount++;
            });

            if (this.filters.interactionFilters.minAnswers ||
                this.filters.interactionFilters.maxAnswers ||
                this.filters.interactionFilters.minLikes) {
                activeCount++;
            }

            if (this.filters.textFilters.keywords ||
                this.filters.textFilters.excludeKeywords) {
                activeCount++;
            }

            let countSpan = document.querySelector('.Filter-buttonActiveFiltersCount');
            if (countSpan) {
                countSpan.textContent = activeCount > 0 ? activeCount : '';
                countSpan.style.display = activeCount > 0 ? 'inline-block' : 'none';
            }
        }

        resetEnhancedFilters(filterMenu) {
            this.filters = {
                afterDate: '',
                contentFilters: {
                    onlyBookmarked: false,
                    hideBookmarked: false
                },
                interactionFilters: {
                    minAnswers: '',
                    maxAnswers: '',
                    minLikes: ''
                },
                textFilters: {
                    keywords: '',
                    excludeKeywords: ''
                }
            };

            filterMenu.querySelectorAll('.Toggle-button[data-filter]').forEach(button => {
                const toggle = button.querySelector('.Toggle');
                toggle.classList.remove('Toggle--on');
                toggle.classList.add('Toggle--off');
                button.setAttribute('aria-checked', 'false');
            });

            filterMenu.querySelectorAll('input[data-filter]').forEach(input => {
                input.value = '';
            });

            this.saveFilters();
            this.updateFilterIndicator();
            setTimeout(() => this.applyFilters(), 0);

            const resetButton = filterMenu.querySelector('.enhanced-reset-button');
            if (resetButton) {
                const originalText = resetButton.innerHTML;
                resetButton.innerHTML = '<svg class="Icon Icon--check Icon--sbig" style="width: 16px; height: 16px; margin-right: 8px;"><use href="/nmms-assets/logged-in-app-shell/images/icon-sprite-672c5a2efe0b0ae80106556b75d7500a.svg#shape-icon-check"></use></svg>Zurückgesetzt!';
                resetButton.style.backgroundColor = '#4CAF50';
                resetButton.style.color = 'white';

                setTimeout(() => {
                    resetButton.innerHTML = originalText;
                    resetButton.style.backgroundColor = '';
                    resetButton.style.color = '';
                }, 1500);
            }
        }

        applyFilters() {
            // Nur filtern wenn Filter aktiviert sind
            if (!this.filtersEnabled) {
                console.log('[Enhanced Filter] Filters not enabled, skipping...');
                return;
            }

            console.log('[Enhanced Filter] Applying filters:', this.filters);

            const posts = document.querySelectorAll('.Plate.ListingElement');

            posts.forEach(post => {
                post.style.display = '';
            });

            posts.forEach(post => {
                let shouldShow = true;

                if (this.filters.afterDate) {
                    const timeElement = post.querySelector('time[datetime]');
                    if (timeElement) {
                        const postDate = new Date(timeElement.getAttribute('datetime'));
                        const afterDate = new Date(this.filters.afterDate);

                        if (postDate < afterDate) {
                            shouldShow = false;
                        }
                    }
                }

                const titleElement = post.querySelector('.Question-title');
                const bodyElement = post.querySelector('.ContentBody');
                const usernameElement = post.querySelector('.ContentMeta-author a');

                const titleText = titleElement ? titleElement.textContent.toLowerCase() : '';
                const bodyText = bodyElement ? bodyElement.textContent.toLowerCase() : '';
                const usernameText = usernameElement ? usernameElement.textContent.toLowerCase() : '';

                const searchableText = titleText + ' ' + bodyText + ' ' + usernameText;

                if (this.filters.textFilters.keywords) {
                    const keywords = this.filters.textFilters.keywords.split(',')
                        .map(k => k.trim().toLowerCase())
                        .filter(k => k.length > 0);

                    if (keywords.length > 0) {
                        const hasKeyword = keywords.some(keyword => searchableText.includes(keyword));
                        if (!hasKeyword) shouldShow = false;
                    }
                }

                if (this.filters.textFilters.excludeKeywords) {
                    const excludeKeywords = this.filters.textFilters.excludeKeywords.split(',')
                        .map(k => k.trim().toLowerCase())
                        .filter(k => k.length > 0);

                    if (excludeKeywords.length > 0) {
                        for (const keyword of excludeKeywords) {
                            if (searchableText.includes(keyword)) {
                                shouldShow = false;
                                break;
                            }
                        }
                    }
                }

                let answerCount = 0;
                const answerSelectors = [
                    'a[href*="/frage/"]',
                    'a[href*="/diskussion/"]',
                    'a[href*="/umfrage/"]',
                    '.ListingElement-bottomBar a'
                ];

                for (const selector of answerSelectors) {
                    const answerLinks = post.querySelectorAll(selector);

                    for (const link of answerLinks) {
                        const text = link.textContent.trim();

                        let match = text.match(/^(\d+)\s+Antwort/i);
                        if (!match) {
                            match = text.match(/(\d+)\s+Antwort/i);
                        }
                        if (!match && text.toLowerCase().includes('keine antwort')) {
                            answerCount = 0;
                            break;
                        }
                        if (!match && text.toLowerCase().includes('antwort')) {
                            const numberMatch = text.match(/(\d+)/);
                            if (numberMatch) {
                                match = [null, numberMatch[1]];
                            }
                        }

                        if (match) {
                            answerCount = parseInt(match[1]);
                            break;
                        }
                    }

                    if (answerCount > 0) break;
                }

                if (this.filters.interactionFilters.minAnswers !== '') {
                    const minAnswers = parseInt(this.filters.interactionFilters.minAnswers);
                    if (!isNaN(minAnswers) && answerCount < minAnswers) {
                        shouldShow = false;
                    }
                }

                if (this.filters.interactionFilters.maxAnswers !== '') {
                    const maxAnswers = parseInt(this.filters.interactionFilters.maxAnswers);
                    if (!isNaN(maxAnswers) && answerCount > maxAnswers) {
                        shouldShow = false;
                    }
                }

                const likeButton = post.querySelector('.ActionBarIcon-count');
                if (likeButton && this.filters.interactionFilters.minLikes) {
                    const likes = parseInt(likeButton.textContent) || 0;
                    if (likes < parseInt(this.filters.interactionFilters.minLikes)) {
                        shouldShow = false;
                    }
                }

                if (this.filters.contentFilters.onlyBookmarked || this.filters.contentFilters.hideBookmarked) {
                    const bookmarkIcon = post.querySelector('.Icon--bookmark-filled-large');
                    const isBookmarked = bookmarkIcon !== null;

                    if (this.filters.contentFilters.onlyBookmarked && !isBookmarked) {
                        shouldShow = false;
                    }
                    if (this.filters.contentFilters.hideBookmarked && isBookmarked) {
                        shouldShow = false;
                    }
                }

                post.style.display = shouldShow ? '' : 'none';
            });
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    console.log('[Gutefrage Enhanced Suite] Initializing...');

    // Initialize Tag Remover (works on all pages)
    new TagRemover();

    // Initialize Enhanced Filters (only on home page)
    new EnhancedFilterIntegration();

    console.log('[Gutefrage Enhanced Suite] Ready!');
})();
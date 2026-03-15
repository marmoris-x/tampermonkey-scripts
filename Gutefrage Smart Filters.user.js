// ==UserScript==
// @name         Gutefrage Smart Filters
// @namespace    http://tampermonkey.net/
// @version      3.4
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
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Gutefrage%20Smart%20Filters.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Gutefrage%20Smart%20Filters.user.js
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
                        console.log(`[Gutefrage Smart Filters] Elements found: ${selector} after ${elapsed}ms`);
                        resolve(elements);
                        return;
                    }
                    if (elapsed >= maxWaitTime) {
                        console.log(`[Gutefrage Smart Filters] Timeout for ${selector} (${maxWaitTime}ms)`);
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
                    timeout = null;
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Get answer count from a post element
        static getAnswerCount(post) {
            const answerSelectors = [
                'a[href*="/frage/"]', 'a[href*="/diskussion/"]',
                'a[href*="/umfrage/"]', '.ListingElement-bottomBar a'
            ];

            for (const selector of answerSelectors) {
                for (const link of post.querySelectorAll(selector)) {
                    const text = link.textContent.trim();
                    if (text.toLowerCase().includes('keine antwort')) {
                        return 0;
                    }
                    let match = text.match(/(\d+)\s+Antwort/i);
                    if (!match && text.toLowerCase().includes('antwort')) {
                        const nm = text.match(/(\d+)/);
                        if (nm) match = [null, nm[1]];
                    }
                    if (match) {
                        return parseInt(match[1]);
                    }
                }
            }
            return 0;
        }

        // Get a fingerprint for a post based on its content (for caching)
        static getPostFingerprint(post) {
            const title = Utils.getPostTitle(post);
            const author = Utils.getPostAuthor(post);
            const datetime = Utils.getPostDateTime(post);
            const hasImages = Utils.getPostImagesStatus(post);
            const answerCount = Utils.getAnswerCount(post);

            // Create a simple hash from the content
            const titleHash = Utils.hashString(title);
            return `${titleHash}|${author}|${datetime}|${hasImages}|${answerCount}`;
        }

        // Convert datetime-local value to springe-zu format with local timezone offset
        static toSpringeZu(datetimeLocalValue) {
            if (!datetimeLocalValue) return null;
            const d = new Date(datetimeLocalValue);
            const offset = -d.getTimezoneOffset();
            const sign = offset >= 0 ? '+' : '-';
            const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
            const mm = String(Math.abs(offset) % 60).padStart(2, '0');
            const local = datetimeLocalValue.length === 16 ? datetimeLocalValue + ':00' : datetimeLocalValue;
            return local + sign + hh + ':' + mm;
        }

        // Parse comma-separated values into normalized array
        static parseCSV(text, lowercase = true) {
            if (!text || typeof text !== 'string') return [];
            return text.split(',')
                .map(t => lowercase ? t.trim().toLowerCase() : t.trim())
                .filter(Boolean);
        }

        // Simple string hash function (djb2 variant)
        static hashString(str) {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
            }
            // Convert to base36 string (shorter than hex)
            return (hash & 0x7FFFFFFF).toString(36).substring(0, 8);
        }


        // Normalize topic strings for comparison (handles "Religion & Glaube" vs "religion-glaube")
        static normalizeTopic(topic) {
            if (!topic) return '';
            // Convert to lowercase
            let normalized = topic.toLowerCase();

            // Replace German umlauts and ß
            normalized = normalized
                .replace(/ä/g, 'ae')
                .replace(/ö/g, 'oe')
                .replace(/ü/g, 'ue')
                .replace(/ß/g, 'ss');

            // Remove spaces, ampersands, hyphens, underscores, commas, periods, and other separators
            normalized = normalized.replace(/[&\s\-_,.]+/g, '');

            // Remove any remaining non-alphanumeric characters (except letters and numbers)
            normalized = normalized.replace(/[^a-z0-9]/g, '');

            return normalized;
        }

        // Match topics with normalization (handles different representations)
        // Uses substring matching: "Religion" matches "Religion & Glaube"
        static topicsMatch(topic1, topic2) {
            const norm1 = Utils.normalizeTopic(topic1);
            const norm2 = Utils.normalizeTopic(topic2);
            return norm1.includes(norm2) || norm2.includes(norm1);
        }

        // Common DOM query helpers
        static getPostTitle(post) {
            return post.querySelector('.Question-title')?.textContent.trim() || '';
        }

        static getPostAuthor(post) {
            return post.querySelector('.ContentMeta-author a')?.textContent.trim() || '';
        }

        static getPostDateTime(post) {
            const timeEl = post.querySelector('time[datetime]');
            return timeEl ? timeEl.getAttribute('datetime') : '';
        }

        static getPostImagesStatus(post) {
            return !!post.querySelector('button[aria-label="Mit Bildern"]') ||
                   !!post.querySelector('.ListingElement-image');
        }
    }

    // ============================================
    // TAG REMOVER MODULE
    // ============================================

    class TagRemover {
        constructor() {
            this.tagsToRemove = GM_getValue('customTagsToRemove', DEFAULT_TAGS);
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

            // Reload tags from storage in case user changed them in sidebar
            this.tagsToRemove = GM_getValue('customTagsToRemove', DEFAULT_TAGS);

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
                    const btnStyle = `
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

                    const removeTagsButton = document.createElement('button');
                    removeTagsButton.className = 'Tag custom-remove-tags-button';
                    removeTagsButton.style.cssText = `background-color: #dc3545; ${btnStyle}`;
                    removeTagsButton.textContent = 'Tags entfernen';
                    removeTagsButton.title = 'Entfernt unerwünschte Tags von diesem Beitrag';

                    removeTagsButton.addEventListener('mouseenter', function() { this.style.backgroundColor = '#c82333'; });
                    removeTagsButton.addEventListener('mouseleave', function() { this.style.backgroundColor = '#dc3545'; });

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

                    const authorEl = article.querySelector('.ContentMeta-author a');
                    if (authorEl) {
                        const blockAuthorButton = document.createElement('button');
                        blockAuthorButton.className = 'Tag custom-block-author-button';
                        blockAuthorButton.style.cssText = `background-color: #6c757d; ${btnStyle}`;
                        blockAuthorButton.textContent = 'Autor sperren';
                        blockAuthorButton.title = 'Blendet alle Beiträge dieses Autors aus';

                        blockAuthorButton.addEventListener('mouseenter', function() { this.style.backgroundColor = '#545b62'; });
                        blockAuthorButton.addEventListener('mouseleave', function() { this.style.backgroundColor = '#6c757d'; });

                        blockAuthorButton.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const authorName = authorEl.textContent.trim();
                            const blocked = GM_getValue('blockedAuthors', []);
                            if (!blocked.includes(authorName)) {
                                blocked.push(authorName);
                                GM_setValue('blockedAuthors', blocked);
                            }

                            const postContainer = article.closest('.Plate.ListingElement') || article;
                            postContainer.style.display = 'none';
                        });

                        buttonContainer.appendChild(blockAuthorButton);
                    }
                }
            });
        }

        async autoRemoveAndClose() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('removeTagsAuto') !== 'true') return;

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

            const progressInterval = setInterval(() => {
                const tagContainers = document.querySelectorAll('.Tag-container');
                notification.textContent = `Seite wird geladen... (${tagContainers.length} Tags gefunden)`;
            }, 1000);

            try {
                const tagsRemoved = await this.removeUnwantedTags();
                clearInterval(progressInterval);

                notification.style.background = '#4CAF50';
                notification.style.color = '#fff';
                notification.textContent = `\u2713 ${tagsRemoved} Tag(s) entfernt! Tab wird geschlossen...`;

                setTimeout(() => {
                    window.close();
                    setTimeout(() => {
                        notification.textContent = 'Bitte schlie\xdfen Sie diesen Tab manuell.';
                        notification.style.background = '#17a2b8';
                    }, 500);
                }, 2000);

            } catch (error) {
                clearInterval(progressInterval);
                console.error('[Tag Remover] Error:', error);
                notification.style.background = '#dc3545';
                notification.style.color = '#fff';
                notification.textContent = 'Fehler beim Entfernen der Tags!';
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
    // STYLES
    // ============================================

    // Native FilterMenu improvements
    GM_addStyle(`
        .FilterMenu {
            max-height: 60vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding-right: 10px !important;
            position: relative !important;
            scrollbar-width: thin;
            scrollbar-color: rgba(0,0,0,0.3) rgba(0,0,0,0.1);
        }
        .FilterMenu::-webkit-scrollbar { width: 6px; }
        .FilterMenu::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 3px; }
        .FilterMenu::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.3); border-radius: 3px; }
        .FilterMenu::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.5); }
        .Toggletip-content { max-height: 70vh !important; }
        .FilterMenu-section {
            position: sticky;
            top: -1px;
            background: inherit;
            z-index: 1;
            padding-bottom: 5px;
        }
    `);

    // Sidebar layout, design, push-page, dark mode
    GM_addStyle(`
        body {
            transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        body.gf-sidebar-open {
            margin-right: 360px;
        }

        /* ── Sidebar shell ── */
        #gf-sidebar {
            position: fixed;
            right: -360px;
            top: 0;
            width: 340px;
            height: 100vh;
            background: var(--gf-bg, #ffffff);
            border-left: 1px solid var(--gf-border, rgba(0,0,0,0.09));
            z-index: 10001;
            overflow-y: auto;
            overflow-x: hidden;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 0 0 32px;
            box-sizing: border-box;
            box-shadow: -6px 0 28px rgba(0,0,0,0.08);
            font-size: 11px;
            color: var(--gf-text, #2c3e50);
            scrollbar-width: thin;
            scrollbar-color: rgba(0,0,0,0.12) transparent;
        }
        #gf-sidebar::-webkit-scrollbar { width: 4px; }
        #gf-sidebar::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.15);
            border-radius: 2px;
        }

        /* ── Tab ── */
        #gf-sidebar-tab {
            position: fixed;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            background: #4a90e2;
            color: white;
            border: none;
            border-radius: 8px 0 0 8px;
            padding: 16px 8px;
            writing-mode: vertical-rl;
            text-orientation: mixed;
            cursor: pointer;
            z-index: 10002;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
            box-shadow: -3px 0 12px rgba(74,144,226,0.35);
        }
        #gf-sidebar-tab:hover { background: #3a7bd5; }

        /* ── Header ── */
        .gf-header {
            position: sticky;
            top: 0;
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            padding: 14px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 2;
            box-shadow: 0 2px 10px rgba(74,144,226,0.3);
        }
        .gf-header-title {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.3px;
        }
        .gf-header-close {
            background: rgba(255,255,255,0.18);
            border: none;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 5px;
            line-height: 1;
            transition: background 0.15s;
        }
        .gf-header-close:hover { background: rgba(255,255,255,0.32); }

        /* ── Stats bar ── */
        .gf-stats-bar {
            margin: 12px 14px 0;
            padding: 8px 13px;
            background: rgba(74,144,226,0.07);
            border: 1px solid rgba(74,144,226,0.2);
            border-radius: 7px;
            font-size: 12px;
            color: #4a90e2;
            text-align: center;
            display: none;
            font-weight: 500;
        }
        .gf-stats-bar.active { display: block; }

        /* ── Body padding ── */
        .gf-body { padding: 0 14px; }

        /* ── Section card ── */
        .gf-section {
            margin-top: 10px;
            background: var(--gf-surface, #f7f8fc);
            border-radius: 9px;
            padding: 9px 11px 11px;
            border: 1px solid var(--gf-border, rgba(0,0,0,0.06));
        }
        .gf-section-title {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.9px;
            color: var(--gf-muted, #8896a6);
            margin: 0 0 9px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .gf-section-title::before {
            content: '';
            flex-shrink: 0;
            display: inline-block;
            width: 3px;
            height: 11px;
            background: #4a90e2;
            border-radius: 2px;
        }

        /* ── Inputs ── */
        .gf-input {
            width: 100%;
            padding: 6px 9px;
            border: 1px solid var(--gf-border-input, #dde3ec);
            border-radius: 6px;
            font-size: 12px;
            background: var(--gf-input-bg, #ffffff);
            color: var(--gf-text, #2c3e50);
            box-sizing: border-box;
            transition: border-color 0.15s, box-shadow 0.15s;
            font-family: inherit;
        }
        .gf-input + .gf-input { margin-top: 4px; }
        .gf-input:focus {
            outline: none;
            border-color: #4a90e2;
            box-shadow: 0 0 0 3px rgba(74,144,226,0.12);
        }
        .gf-label {
            font-size: 10px;
            color: var(--gf-muted, #8896a6);
            display: block;
            margin: 6px 0 3px;
            font-weight: 500;
        }
        .gf-label:first-child { margin-top: 0; }
        .gf-hint {
            font-size: 10px;
            color: var(--gf-hint, #b0bec5);
            margin-top: 3px;
            line-height: 1.4;
        }


        /* ── Post type pills ── */
        .gf-pill-row {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .gf-pill-label {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            padding: 5px 12px;
            border: 1.5px solid var(--gf-border-input, #dde3ec);
            border-radius: 20px;
            user-select: none;
            transition: all 0.15s;
            color: var(--gf-muted, #7f8c8d);
            background: var(--gf-input-bg, #fff);
        }
        .gf-pill-label:has(input:checked) {
            background: #4a90e2;
            color: white;
            border-color: #4a90e2;
            box-shadow: 0 2px 6px rgba(74,144,226,0.28);
        }
        .gf-pill-label input { display: none; }

        /* ── Toggle rows ── */
        .gf-toggle-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
        }
        .gf-toggle-row + .gf-toggle-row {
            margin-top: 1px;
            padding-top: 6px;
            border-top: 1px solid var(--gf-border, rgba(0,0,0,0.06));
        }
        .gf-toggle-label {
            font-size: 12px;
            color: var(--gf-text, #2c3e50);
        }

        /* ── Number row ── */
        .gf-number-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .gf-number-row input {
            width: 72px;
            padding: 7px 8px;
            border: 1px solid var(--gf-border-input, #dde3ec);
            border-radius: 6px;
            font-size: 13px;
            background: var(--gf-input-bg, #ffffff);
            color: var(--gf-text, #2c3e50);
            font-family: inherit;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .gf-number-row input:focus {
            outline: none;
            border-color: #4a90e2;
            box-shadow: 0 0 0 3px rgba(74,144,226,0.12);
        }
        .gf-number-row span {
            font-size: 12px;
            color: var(--gf-muted, #8896a6);
        }

        /* ── Date navigation buttons ── */
        .gf-nav-row {
            display: flex;
            gap: 6px;
            margin-top: 8px;
        }
        .gf-nav-btn {
            flex: 1;
            padding: 7px 8px;
            font-size: 11px;
            font-weight: 600;
            background: var(--gf-input-bg, #fff);
            color: #4a90e2;
            border: 1.5px solid #4a90e2;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s;
            font-family: inherit;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .gf-nav-btn:hover {
            background: #4a90e2;
            color: white;
            box-shadow: 0 2px 6px rgba(74,144,226,0.28);
        }
        .gf-nav-btn:disabled {
            opacity: 0.38;
            cursor: not-allowed;
            border-color: var(--gf-border-input, #dde3ec);
            color: var(--gf-muted, #8896a6);
        }
        .gf-nav-btn:disabled:hover {
            background: var(--gf-input-bg, #fff);
            color: var(--gf-muted, #8896a6);
            box-shadow: none;
        }
        .gf-nav-btn.active {
            background: #4a90e2;
            color: white;
            box-shadow: 0 2px 6px rgba(74,144,226,0.28);
        }
        .gf-nav-btn.active:hover {
            background: #3a7bd5;
        }

        /* ── Feed navigation reset button ── */
        #gf-nav-reset {
            background: var(--gf-surface, #f7f8fc);
            color: var(--gf-muted, #8896a6);
            border-color: var(--gf-border-input, #dde3ec);
        }
        #gf-nav-reset:hover {
            background: var(--gf-muted, #8896a6);
            color: white;
            box-shadow: 0 2px 6px rgba(136,150,166,0.28);
        }

        /* ── Reset button ── */
        .gf-reset-btn {
            display: block;
            width: calc(100% - 28px);
            margin: 14px 14px 0;
            padding: 10px;
            background: var(--gf-surface, #f7f8fc);
            border: 1.5px solid var(--gf-border-input, #dde3ec);
            border-radius: 7px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            color: var(--gf-muted, #7f8c8d);
            transition: all 0.2s;
            font-family: inherit;
            letter-spacing: 0.2px;
            text-align: center;
        }
        .gf-reset-btn:hover {
            background: #fff0f0;
            border-color: #e57373;
            color: #c0392b;
        }

        /* ── Dark mode (sidebar-only) ── */
        #gf-sidebar.gf-dark {
            --gf-bg: #1e2130;
            --gf-surface: #262a3c;
            --gf-border: rgba(255,255,255,0.07);
            --gf-border-input: rgba(255,255,255,0.13);
            --gf-text: #dde3ec;
            --gf-muted: #8890a4;
            --gf-hint: #4e5a72;
            --gf-input-bg: #2d3248;
        }
        #gf-sidebar.gf-dark .gf-stats-bar {
            background: rgba(74,144,226,0.12);
            border-color: rgba(74,144,226,0.25);
        }
        #gf-sidebar.gf-dark .gf-reset-btn:hover {
            background: rgba(192,57,43,0.15);
            border-color: rgba(192,57,43,0.4);
            color: #e57373;
        }
        #gf-sidebar.gf-dark ~ #gf-sidebar-tab {
            background: #2a5a9e;
            box-shadow: -3px 0 12px rgba(42,90,158,0.45);
        }
        #gf-sidebar.gf-dark ~ #gf-sidebar-tab:hover { background: #3570be; }
    `);

    // ============================================
    // CONSTANTS
    // ============================================

    const DEFAULT_TAGS = ['islam', 'allah', 'muslime', 'koran', 'mohammed'];

    const DEFAULT_FILTERS = {
        afterDate: '',
        contentFilters: {
            onlyBookmarked: false,
            hideBookmarked: false,
            onlyWithImages: false,
            hideWithImages: false,
            hidePostTypes: []
        },
        interactionFilters: {
            minAnswers: '',
            maxAnswers: '',
            minLikes: ''
        },
        textFilters: {
            keywords: '',
            excludeKeywords: ''
        },
        topicFilters: {
            excludeTopics: '',
            includeTopics: ''
        }
    };

    // ============================================
    // ENHANCED FILTER INTEGRATION (logic only)
    // ============================================

    class EnhancedFilterIntegration {
        constructor() {
            if (!this.isHomePage()) return;

            this.filters = this.loadFilters();
            this.filtersEnabled = false;
            this.sidebar = null;
            this.debouncedApplyFilters = Utils.debounce(() => this.applyFilters(), 300);
            this.filterCache = {}; // Cache for filter results: key = filterHash + '|' + postFingerprint
            this.lastFilterHash = '';
            this.parsedFilterData = {
                excludeTopics: null,
                includeTopics: null,
                keywords: null,
                excludeKeywords: null,
                blockedAuthors: null
            };
        }

        isHomePage() {
            return window.location.pathname.startsWith('/home/');
        }

        loadFilters() {
            const saved = GM_getValue('enhancedFilters', {});
            return {
                afterDate: saved.afterDate ?? DEFAULT_FILTERS.afterDate,
                contentFilters: { ...DEFAULT_FILTERS.contentFilters, ...saved.contentFilters },
                interactionFilters: { ...DEFAULT_FILTERS.interactionFilters, ...saved.interactionFilters },
                textFilters: { ...DEFAULT_FILTERS.textFilters, ...saved.textFilters },
                topicFilters: { ...DEFAULT_FILTERS.topicFilters, ...saved.topicFilters }
            };
        }

        saveFilters() {
            GM_setValue('enhancedFilters', this.filters);
        }

        enableFilters() {
            if (!this.filtersEnabled) {
                this.filtersEnabled = true;
                this.observeNewPosts();
                console.log('[Gutefrage Smart Filters] Filters activated!');
            }
        }

        observeNewPosts() {
            if (this.postObserver) return;

            this.postObserver = new MutationObserver((mutations) => {
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
                    this.debouncedApplyFilters();
                }
            });

            this.postObserver.observe(document.body, { childList: true, subtree: true });
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
            const countSpan = document.querySelector('.Filter-buttonActiveFiltersCount');
            if (!countSpan) return;

            let activeCount = 0;
            if (this.filters.afterDate) activeCount++;

            const cf = this.filters.contentFilters;
            if (cf.onlyBookmarked) activeCount++;
            if (cf.hideBookmarked) activeCount++;
            if (cf.onlyWithImages) activeCount++;
            if (cf.hideWithImages) activeCount++;
            if (cf.hidePostTypes?.length > 0) activeCount++;

            const inf = this.filters.interactionFilters;
            if (inf.minAnswers || inf.maxAnswers || inf.minLikes) activeCount++;

            const tf = this.filters.textFilters;
            if (tf.keywords || tf.excludeKeywords) activeCount++;

            const top = this.filters.topicFilters;
            if (top.excludeTopics || top.includeTopics) activeCount++;

            countSpan.textContent = activeCount > 0 ? activeCount : '';
            countSpan.style.display = activeCount > 0 ? 'inline-block' : 'none';
        }

        getFilterHash() {
            const blockedAuthors = GM_getValue('blockedAuthors', []);
            const customTags = GM_getValue('customTagsToRemove', []);
            return JSON.stringify({
                filters: this.filters,
                blockedAuthors: blockedAuthors,
                customTags: customTags
            });
        }

        updateParsedFilters() {
            // Parse filter strings once and cache them
            this.parsedFilterData = {
                excludeTopics: Utils.parseCSV(this.filters.topicFilters.excludeTopics),
                includeTopics: Utils.parseCSV(this.filters.topicFilters.includeTopics),
                keywords: Utils.parseCSV(this.filters.textFilters.keywords),
                excludeKeywords: Utils.parseCSV(this.filters.textFilters.excludeKeywords),
                blockedAuthors: GM_getValue('blockedAuthors', []).map(a => a.trim().toLowerCase())
            };
        }

        applyFilters() {
            if (!this.filtersEnabled) return;

            const posts = document.querySelectorAll('.Plate.ListingElement');
            let visibleCount = 0;

            const currentHash = this.getFilterHash();
            const shortHash = Utils.hashString(currentHash);

            // Clear cache if filters changed
            if (currentHash !== this.lastFilterHash) {
                this.filterCache = {};
                this.lastFilterHash = currentHash;
                this.updateParsedFilters();
            }

            // Limit cache size to prevent memory leaks
            if (Object.keys(this.filterCache).length > 1000) {
                this.filterCache = {};
            }

            // Ensure parsed filters are initialized
            if (!this.parsedFilterData || this.parsedFilterData.excludeTopics === null) {
                this.updateParsedFilters();
            }

            for (const post of posts) {
                // Calculate fingerprint for cache (survives DOM recycling)
                const postFingerprint = Utils.getPostFingerprint(post);
                const cacheKey = currentHash + '|' + postFingerprint;

                // Check memory cache first
                if (this.filterCache[cacheKey] !== undefined) {
                    // Use cached result from memory
                    const cachedResult = this.filterCache[cacheKey];
                    if (cachedResult === false) {
                        post.style.display = 'none';
                    } else {
                        visibleCount++;
                        post.style.display = '';
                    }
                    // Also update DOM attributes for consistency
                    post.dataset.filterHash = shortHash;
                    post.dataset.lastFilterResult = cachedResult ? 'visible' : 'hidden';
                    continue;
                }

                // Fallback to DOM cache (for backward compatibility)
                const postHash = post.dataset.filterHash;
                const lastResult = post.dataset.lastFilterResult;

                if (postHash === shortHash && lastResult) {
                    // Use cached result from DOM
                    const cachedResult = lastResult === 'visible';
                    this.filterCache[cacheKey] = cachedResult; // Populate memory cache
                    if (!cachedResult) {
                        post.style.display = 'none';
                    } else {
                        visibleCount++;
                        post.style.display = '';
                    }
                    continue;
                }

                let shouldShow = true;

                // Date filter
                if (this.filters.afterDate) {
                    const timeEl = post.querySelector('time[datetime]');
                    if (timeEl && new Date(timeEl.getAttribute('datetime')) < new Date(this.filters.afterDate)) {
                        shouldShow = false;
                    }
                }

                // Post type filter
                if (shouldShow && this.filters.contentFilters.hidePostTypes?.length > 0) {
                    const link = post.querySelector('a.ListingElement-questionLink[href]');
                    if (link) {
                        const href = link.getAttribute('href');
                        const type = href.includes('/frage/') ? 'frage'
                            : href.includes('/diskussion/') ? 'diskussion'
                            : href.includes('/umfrage/') ? 'umfrage'
                            : null;
                        if (type && this.filters.contentFilters.hidePostTypes.includes(type)) {
                            shouldShow = false;
                        }
                    }
                }

                // Bookmark filter
                if (shouldShow && (this.filters.contentFilters.onlyBookmarked || this.filters.contentFilters.hideBookmarked)) {
                    const isBookmarked = !!post.querySelector('.Icon--bookmark-filled-large');
                    if (this.filters.contentFilters.onlyBookmarked && !isBookmarked) shouldShow = false;
                    if (shouldShow && this.filters.contentFilters.hideBookmarked && isBookmarked) shouldShow = false;
                }

                // Images filter
                if (shouldShow && (this.filters.contentFilters.onlyWithImages || this.filters.contentFilters.hideWithImages)) {
                    const hasImages = Utils.getPostImagesStatus(post);
                    if (this.filters.contentFilters.onlyWithImages && !hasImages) shouldShow = false;
                    if (shouldShow && this.filters.contentFilters.hideWithImages && hasImages) shouldShow = false;
                }

                // Blocked author filter (using cached parsed data)
                if (shouldShow && this.parsedFilterData.blockedAuthors.length > 0) {
                    const authorName = Utils.getPostAuthor(post).toLowerCase();
                    if (authorName && this.parsedFilterData.blockedAuthors.includes(authorName)) {
                        shouldShow = false;
                    }
                }

                // Topic / Themenbereich filter (using cached parsed data)
                if (shouldShow && (this.parsedFilterData.excludeTopics.length > 0 || this.parsedFilterData.includeTopics.length > 0)) {
                    // Collect all topic elements (multiple selectors to catch different Gutefrage layouts)
                    const topicEls = post.querySelectorAll('a[href*="/thema/"], a:has(.BrandAvatar), [data-topic-slug], .ContentMeta-topic, .ContentMeta-category, a.u-strongLight:has(.BrandAvatar--small)');
                    const topicStrings = [];

                    for (const el of topicEls) {
                        const text = (el.textContent ?? '').trim().toLowerCase();
                        if (text) topicStrings.push(text);

                        // Extract slug from href or data attribute
                        const href = el.getAttribute('href');
                        if (href) {
                            // Try to extract any path segment that looks like a topic/category slug
                            // Remove leading/trailing slashes, query params, and hash
                            const cleanHref = href.replace(/^https?:\/\/[^\/]+/, ''); // Remove domain
                            const path = cleanHref.split('?')[0].split('#')[0]; // Remove query/hash
                            const slug = path.replace(/^\/|\/$/g, ''); // Trim slashes
                            if (slug && !slug.match(/^(frage|diskussion|umfrage|home|meine|suche|nutzer)\//)) {
                                // Add the full slug (e.g., "religion-glaube/goetter-propheten-religioese-figuren")
                                topicStrings.push(slug);

                                // If slug contains slashes, also add each component
                                if (slug.includes('/')) {
                                    const parts = slug.split('/');
                                    for (const part of parts) {
                                        if (part) topicStrings.push(part);
                                    }
                                }
                            }
                        }
                        const dataSlug = el.getAttribute('data-topic-slug');
                        if (dataSlug) topicStrings.push(dataSlug.toLowerCase());
                    }

                    // Remove duplicates
                    const uniqueTopics = [...new Set(topicStrings)];

                    // Exclude topics check
                    if (this.parsedFilterData.excludeTopics.length > 0 && uniqueTopics.length > 0) {
                        const hasExcluded = uniqueTopics.some(topic =>
                            this.parsedFilterData.excludeTopics.some(excl =>
                                Utils.topicsMatch(topic, excl)
                            )
                        );
                        if (hasExcluded) shouldShow = false;
                    }

                    // Include topics check (only if not already excluded)
                    if (shouldShow && this.parsedFilterData.includeTopics.length > 0) {
                        // If post has no topics, we can't filter it out based on topics
                        // (it might be a post without any topic assignment)
                        if (uniqueTopics.length === 0) {
                            // Leave it visible - can't determine if it matches or not
                        } else {
                            // Post has topics - check if at least one matches included topics
                            const hasIncluded = uniqueTopics.some(topic =>
                                this.parsedFilterData.includeTopics.some(inc =>
                                    Utils.topicsMatch(topic, inc)
                                )
                            );
                            if (!hasIncluded) shouldShow = false;
                        }
                    }
                }

                // Text filters (using cached parsed data)
                if (shouldShow && (this.parsedFilterData.keywords.length > 0 || this.parsedFilterData.excludeKeywords.length > 0)) {
                    const titleText = Utils.getPostTitle(post).toLowerCase();
                    const bodyText = post.querySelector('.ContentBody')?.textContent.toLowerCase() ?? '';
                    const authorText = Utils.getPostAuthor(post).toLowerCase();
                    const searchableText = titleText + ' ' + bodyText + ' ' + authorText;

                    if (this.parsedFilterData.keywords.length > 0) {
                        if (!this.parsedFilterData.keywords.some(k => searchableText.includes(k))) {
                            shouldShow = false;
                        }
                    }

                    if (shouldShow && this.parsedFilterData.excludeKeywords.length > 0) {
                        if (this.parsedFilterData.excludeKeywords.some(k => searchableText.includes(k))) {
                            shouldShow = false;
                        }
                    }
                }


                // Answer count filter
                if (shouldShow && (this.filters.interactionFilters.minAnswers !== '' || this.filters.interactionFilters.maxAnswers !== '')) {
                    const answerCount = Utils.getAnswerCount(post);
                    const minA = parseInt(this.filters.interactionFilters.minAnswers);
                    const maxA = parseInt(this.filters.interactionFilters.maxAnswers);
                    if (!isNaN(minA) && answerCount < minA) shouldShow = false;
                    if (shouldShow && !isNaN(maxA) && answerCount > maxA) shouldShow = false;
                }

                // Likes filter
                if (shouldShow && this.filters.interactionFilters.minLikes) {
                    const likeBtn = post.querySelector('.ActionBarIcon button[aria-label*="Daumen"]');
                    const likes = likeBtn
                        ? parseInt(likeBtn.getAttribute('aria-label').match(/(\d+)/)?.[1]) || 0
                        : parseInt(post.querySelector('.ActionBarIcon-count')?.textContent) || 0;
                    if (likes < parseInt(this.filters.interactionFilters.minLikes)) shouldShow = false;
                }

                // Store cache
                this.filterCache[cacheKey] = shouldShow; // Memory cache
                post.dataset.filterHash = shortHash;
                post.dataset.lastFilterResult = shouldShow ? 'visible' : 'hidden';

                if (shouldShow) visibleCount++;
                post.style.display = shouldShow ? '' : 'none';
            }

            this.updateStatsOverlay(visibleCount, posts.length);
        }

        updateStatsOverlay(visible, total) {
            if (this.sidebar?.isOpen) {
                this.sidebar.updateStats(visible, total);
                const overlay = document.getElementById('gf-stats-overlay');
                if (overlay) overlay.style.display = 'none';
                return;
            }

            if (this.sidebar) {
                this.sidebar.updateStats(visible, total);
            }

            let overlay = document.getElementById('gf-stats-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'gf-stats-overlay';
                overlay.style.cssText = `
                    position: fixed; bottom: 20px; right: 20px;
                    background: rgba(30,33,48,0.85); color: white;
                    padding: 7px 14px; border-radius: 20px;
                    font-size: 12px; z-index: 9999; pointer-events: none;
                    backdrop-filter: blur(6px); font-weight: 500;
                `;
                document.body.appendChild(overlay);
            }

            const filtered = total - visible;
            overlay.textContent = `${visible} sichtbar \u00b7 ${filtered} gefiltert`;
            overlay.style.display = filtered > 0 ? 'block' : 'none';
        }
    }

    // ============================================
    // SIDEBAR PANEL
    // ============================================

    class SidebarPanel {
        constructor(fi) {
            if (!window.location.pathname.startsWith('/home/')) return;
            this.fi = fi;
            this.fi.sidebar = this;
            this.isOpen = GM_getValue('sidebarOpen', false);
            this.createPanel();
            if (GM_getValue('darkMode', false)) this.panel.classList.add('gf-dark');
            this.createToggleTab();
            if (this.isOpen) this.open(false);
        }

        createPanel() {
            this.panel = document.createElement('div');
            this.panel.id = 'gf-sidebar';
            this.renderContent();
            document.body.appendChild(this.panel);
        }

        createToggleTab() {
            this.tab = document.createElement('button');
            this.tab.id = 'gf-sidebar-tab';
            this.tab.textContent = 'Filter & Tools';
            this.tab.title = 'Erweiterte Filter \u00f6ffnen / schlie\xdfen';
            this.tab.addEventListener('click', () => this.toggle());
            document.body.appendChild(this.tab);
        }

        toggle() { this.isOpen ? this.close() : this.open(); }

        open(save = true) {
            this.isOpen = true;
            this.panel.style.right = '0';
            this.tab.style.right = '340px';
            document.body.classList.add('gf-sidebar-open');
            if (save) GM_setValue('sidebarOpen', true);
            this.fi.enableFilters();
            setTimeout(() => this.fi.applyFilters(), 100);
        }

        close(save = true) {
            this.isOpen = false;
            this.panel.style.right = '-360px';
            this.tab.style.right = '0';
            document.body.classList.remove('gf-sidebar-open');
            if (save) GM_setValue('sidebarOpen', false);
        }

        updateStats(visible, total) {
            const statsEl = this.panel.querySelector('.gf-stats-bar');
            if (!statsEl) return;
            const filtered = total - visible;
            if (filtered > 0) {
                statsEl.textContent = `${visible} sichtbar  \u00b7  ${filtered} ausgeblendet`;
                statsEl.classList.add('active');
            } else {
                statsEl.classList.remove('active');
            }
        }

        renderContent() {
            const f = this.fi.filters;
            const hideTypes = f.contentFilters.hidePostTypes || [];
            const customTags = GM_getValue('customTagsToRemove', DEFAULT_TAGS).join(', ');
            const blockedAuthors = GM_getValue('blockedAuthors', []).join(', ');
            const isDark = GM_getValue('darkMode', false);
            const dateVal = f.afterDate || '';
            const isUnansweredPage = window.location.pathname.includes('/unbeantwortet');

            const togBtn = (id, dataFilter, isOn, label) => `
                <div class="gf-toggle-row">
                    <span class="gf-toggle-label">${label}</span>
                    <button class="Toggle-button u-mrm" type="button" id="${id}" role="switch"
                            aria-checked="${isOn}" ${dataFilter ? `data-filter="${dataFilter}"` : ''}>
                        <span class="Toggle ${isOn ? 'Toggle--on' : 'Toggle--off'}">
                            <span class="Toggle-label"></span>
                        </span>
                    </button>
                </div>`;

            this.panel.innerHTML = `
                <div class="gf-header">
                    <span class="gf-header-title">\u2699 Filter &amp; Tools</span>
                    <button class="gf-header-close" title="Schlie\xdfen">\u2715</button>
                </div>
                <div class="gf-stats-bar"></div>

                <div class="gf-body">

                    <div class="gf-section">
                        <div class="gf-section-title">Fragetyp</div>
                        <div class="gf-pill-row">
                            <label class="gf-pill-label">
                                <input type="checkbox" data-posttype="frage" ${!hideTypes.includes('frage') ? 'checked' : ''}> Fragen
                            </label>
                            <label class="gf-pill-label">
                                <input type="checkbox" data-posttype="diskussion" ${!hideTypes.includes('diskussion') ? 'checked' : ''}> Diskussionen
                            </label>
                            <label class="gf-pill-label">
                                <input type="checkbox" data-posttype="umfrage" ${!hideTypes.includes('umfrage') ? 'checked' : ''}> Umfragen
                            </label>
                        </div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Datum-Filter</div>
                        <input type="datetime-local" class="gf-input" data-filter="afterDate"
                               value="${dateVal}" title="Nur Beitr\u00e4ge ab diesem Datum anzeigen">
                        <div class="gf-hint">Blendet Beitr\u00e4ge <strong>vor</strong> diesem Datum aus (AB-Filter)</div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Feed-Navigation</div>
                        <span class="gf-label">Zu diesem Datum springen:</span>
                        <input type="datetime-local" class="gf-input" id="gf-nav-date"
                               value="${GM_getValue('navDate', '')}"
                               title="Springt im Gutefrage-Feed zu diesem Datum (VOR-Navigation)">
                        <div class="gf-hint">Springt im Feed zu Beitr\u00e4gen <strong>vor</strong> diesem Datum</div>
                        <div class="gf-nav-row">
                            <button class="gf-nav-btn ${!isUnansweredPage ? 'active' : ''}" id="gf-nav-alle"
                                    title="In &lsquo;Alle Beitr\u00e4ge f\u00fcr Dich&rsquo; zu diesem Datum springen">
                                Alle Beitr\u00e4ge \u2192
                            </button>
                            <button class="gf-nav-btn ${isUnansweredPage ? 'active' : ''}" id="gf-nav-unbeantwortet"
                                    title="In &lsquo;Unbeantwortet&rsquo; zu diesem Datum springen">
                                Unbeantwortet \u2192
                            </button>
                            <button class="gf-nav-btn" id="gf-nav-reset"
                                    title="Feed-Navigation zur\u00fccksetzen (Datum l\u00f6schen)">
                                Zur\u00fccksetzen \u21BA
                            </button>
                        </div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Themenbereich</div>
                        <span class="gf-label">Themen ausschlie\xdfen (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. Liebe, Sport, Tiere"
                               value="${f.topicFilters.excludeTopics}" data-filter="topicFilters.excludeTopics">
                        <span class="gf-label">Nur diese Themen (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. Computer, Technik"
                               value="${f.topicFilters.includeTopics}" data-filter="topicFilters.includeTopics">
                        <div class="gf-hint">Themenname oder Slug (z.B. computer-internet)</div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Bilder-Filter</div>
                        ${togBtn('sb-only-with-images', 'contentFilters.onlyWithImages', f.contentFilters.onlyWithImages, 'Nur Beitr\u00e4ge mit Bildern')}
                        ${togBtn('sb-hide-with-images', 'contentFilters.hideWithImages', f.contentFilters.hideWithImages, 'Beitr\u00e4ge mit Bildern ausblenden')}
                        <div class="gf-hint">Filtert nach Posts mit oder ohne Bildern</div>
                    </div>


                    <div class="gf-section">
                        <div class="gf-section-title">Gemerkte Beitr\u00e4ge</div>
                        ${togBtn('sb-only-bookmarked', 'contentFilters.onlyBookmarked', f.contentFilters.onlyBookmarked, 'Nur gemerkte anzeigen')}
                        ${togBtn('sb-hide-bookmarked', 'contentFilters.hideBookmarked', f.contentFilters.hideBookmarked, 'Gemerkte ausblenden')}
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Interaktion</div>
                        <span class="gf-label">Anzahl Antworten:</span>
                        <div class="gf-number-row">
                            <input type="number" placeholder="Min" value="${f.interactionFilters.minAnswers}"
                                   data-filter="interactionFilters.minAnswers" min="0">
                            <span>bis</span>
                            <input type="number" placeholder="Max" value="${f.interactionFilters.maxAnswers}"
                                   data-filter="interactionFilters.maxAnswers" min="0">
                        </div>
                        <span class="gf-label">Mindest-Likes:</span>
                        <input type="number" class="gf-input" placeholder="z.B. 5"
                               value="${f.interactionFilters.minLikes}" data-filter="interactionFilters.minLikes" min="0">
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Textfilter</div>
                        <span class="gf-label">Suchbegriffe (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. JavaScript, Python"
                               value="${f.textFilters.keywords}" data-filter="textFilters.keywords">
                        <span class="gf-label">Ausschlie\xdfen (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. Spam, Werbung"
                               value="${f.textFilters.excludeKeywords}" data-filter="textFilters.excludeKeywords">
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Einstellungen</div>
                        <span class="gf-label">Tags automatisch entfernen (kommagetrennt):</span>
                        <input type="text" class="gf-input" id="gf-custom-tags" value="${customTags}">
                        <span class="gf-label">Gesperrte Autoren (kommagetrennt):</span>
                        <input type="text" class="gf-input" id="gf-blocked-authors" value="${blockedAuthors}">
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Darstellung</div>
                        ${togBtn('sb-dark-mode', '', isDark, 'Dark Mode')}
                    </div>

                    <button class="gf-reset-btn">\u21ba Alle Filter zur\u00fccksetzen</button>

                </div>
            `;

            this.attachEventListeners();
        }

        attachEventListeners() {
            const panel = this.panel;

            panel.querySelector('.gf-header-close').addEventListener('click', () => this.close());

            // Post type checkboxes
            panel.querySelectorAll('[data-posttype]').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const type = checkbox.getAttribute('data-posttype');
                    const hideTypes = [...(this.fi.filters.contentFilters.hidePostTypes || [])];
                    if (checkbox.checked) {
                        const idx = hideTypes.indexOf(type);
                        if (idx > -1) hideTypes.splice(idx, 1);
                    } else {
                        if (!hideTypes.includes(type)) hideTypes.push(type);
                    }
                    this.fi.filters.contentFilters.hidePostTypes = hideTypes;
                    this.fi.saveFilters();
                    this.fi.updateFilterIndicator();
                    this.fi.enableFilters();
                    this.fi.debouncedApplyFilters();
                });
            });

            // Toggle buttons — mutual exclusion for bookmarks
            panel.querySelectorAll('.Toggle-button[data-filter]').forEach(button => {
                button.addEventListener('click', () => {
                    const toggle = button.querySelector('.Toggle');
                    const isOn = toggle.classList.contains('Toggle--on');

                    if (!isOn && (button.id === 'sb-only-bookmarked' || button.id === 'sb-hide-bookmarked')) {
                        const otherId = button.id === 'sb-only-bookmarked' ? 'sb-hide-bookmarked' : 'sb-only-bookmarked';
                        const other = panel.querySelector(`#${otherId}`);
                        if (other?.querySelector('.Toggle').classList.contains('Toggle--on')) {
                            other.querySelector('.Toggle').classList.replace('Toggle--on', 'Toggle--off');
                            other.setAttribute('aria-checked', 'false');
                            this.fi.updateFilterValue(other.getAttribute('data-filter'), false);
                        }
                    }
                    if (!isOn && (button.id === 'sb-only-with-images' || button.id === 'sb-hide-with-images')) {
                        const otherId = button.id === 'sb-only-with-images' ? 'sb-hide-with-images' : 'sb-only-with-images';
                        const other = panel.querySelector(`#${otherId}`);
                        if (other?.querySelector('.Toggle').classList.contains('Toggle--on')) {
                            other.querySelector('.Toggle').classList.replace('Toggle--on', 'Toggle--off');
                            other.setAttribute('aria-checked', 'false');
                            this.fi.updateFilterValue(other.getAttribute('data-filter'), false);
                        }
                    }

                    toggle.classList.toggle('Toggle--on', !isOn);
                    toggle.classList.toggle('Toggle--off', isOn);
                    button.setAttribute('aria-checked', !isOn);
                    this.fi.updateFilterValue(button.getAttribute('data-filter'), !isOn);
                    this.fi.enableFilters();
                    this.fi.debouncedApplyFilters();
                });
            });

            // Dark mode toggle (no data-filter attribute, handled separately)
            panel.querySelector('#sb-dark-mode').addEventListener('click', () => {
                const isDark = !GM_getValue('darkMode', false);
                GM_setValue('darkMode', isDark);
                this.panel.classList.toggle('gf-dark', isDark);
                const btn = panel.querySelector('#sb-dark-mode');
                btn.setAttribute('aria-checked', isDark);
                btn.querySelector('.Toggle').className = 'Toggle ' + (isDark ? 'Toggle--on' : 'Toggle--off');
            });

            // Filter inputs (datetime, text, number — all with data-filter)
            panel.querySelectorAll('input[data-filter]').forEach(input => {
                input.addEventListener('change', () => {
                    this.fi.updateFilterValue(input.getAttribute('data-filter'), input.value);
                    this.fi.enableFilters();
                    this.fi.debouncedApplyFilters();
                });
            });

            // Feed navigation — own separate date input, independent of date filter
            panel.querySelector('#gf-nav-date').addEventListener('change', (e) => {
                GM_setValue('navDate', e.target.value);
            });

            panel.querySelector('#gf-nav-alle').addEventListener('click', () => {
                const tz = Utils.toSpringeZu(GM_getValue('navDate', ''));
                const baseUrl = '/home/meine/alle';
                const url = tz ? `${baseUrl}?springe-zu=${encodeURIComponent(tz)}` : baseUrl;
                window.location.href = url;
            });

            panel.querySelector('#gf-nav-unbeantwortet').addEventListener('click', () => {
                const tz = Utils.toSpringeZu(GM_getValue('navDate', ''));
                const baseUrl = '/home/meine/unbeantwortet';
                const url = tz ? `${baseUrl}?springe-zu=${encodeURIComponent(tz)}` : baseUrl;
                window.location.href = url;
            });

            panel.querySelector('#gf-nav-reset').addEventListener('click', () => {
                // Clear stored date
                GM_setValue('navDate', '');
                // Clear input field
                const dateInput = panel.querySelector('#gf-nav-date');
                if (dateInput) dateInput.value = '';
                // Optionally remove springe-zu parameter from current URL and reload
                const url = new URL(window.location.href);
                if (url.searchParams.has('springe-zu')) {
                    url.searchParams.delete('springe-zu');
                    window.location.href = url.toString();
                }
            });

            // Settings: custom tags
            panel.querySelector('#gf-custom-tags').addEventListener('change', (e) => {
                const tags = Utils.parseCSV(e.target.value, false); // Keep original case for tags
                GM_setValue('customTagsToRemove', tags);
            });

            // Settings: blocked authors
            panel.querySelector('#gf-blocked-authors').addEventListener('change', (e) => {
                const authors = Utils.parseCSV(e.target.value, false); // Case preserved, will be lowercased in updateParsedFilters
                GM_setValue('blockedAuthors', authors);
                this.fi.enableFilters();
                this.fi.debouncedApplyFilters();
            });

            // Reset
            panel.querySelector('.gf-reset-btn').addEventListener('click', () => {
                this.fi.filters = {
                    ...DEFAULT_FILTERS,
                    contentFilters: { ...DEFAULT_FILTERS.contentFilters },
                    interactionFilters: { ...DEFAULT_FILTERS.interactionFilters },
                    textFilters: { ...DEFAULT_FILTERS.textFilters },
                    topicFilters: { ...DEFAULT_FILTERS.topicFilters }
                };
                this.fi.saveFilters();
                this.fi.updateFilterIndicator();
                this.renderContent();
                this.fi.applyFilters();
            });
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    console.log('[Gutefrage Smart Filters] Initializing...');

    new TagRemover();

    const filterIntegration = new EnhancedFilterIntegration();
    new SidebarPanel(filterIntegration);

    console.log('[Gutefrage Smart Filters] Ready!');
})();

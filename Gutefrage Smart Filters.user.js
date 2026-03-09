     // ==UserScript==
     // @name         Gutefrage Smart Filters
     // @namespace    http://tampermonkey.net/
     // @version      3.3
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
        }
    
        // ============================================
        // TAG REMOVER MODULE
        // ============================================
    
        class TagRemover {
            constructor() {
                this.tagsToRemove = GM_getValue('customTagsToRemove', ['islam', 'allah', 'muslime', 'koran', 'mohammed']);
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
                   notification.textContent = `✓ ${tagsRemoved} Tag(s) entfernt! Tab wird geschlossen...`;
   
                   setTimeout(() => {
                       window.close();
                       setTimeout(() => {
                           notification.textContent = 'Bitte schließen Sie diesen Tab manuell.';
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
       // FILTER MODULE + SIDEBAR
       // ============================================
   
       // Verbessert das native FilterMenu (scrollbar, sticky header)
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
   
       // Sidebar styles
       GM_addStyle(`
           #gf-sidebar {
               position: fixed;
               right: -360px;
               top: 0;
               width: 340px;
               height: 100vh;
               background: #fff;
               border-left: 1px solid rgba(0,0,0,0.12);
               z-index: 10001;
               overflow-y: auto;
               transition: right 0.25s ease;
               padding: 0 16px 24px;
               box-sizing: border-box;
               box-shadow: -4px 0 20px rgba(0,0,0,0.1);
               font-size: 14px;
               color: #333;
           }
           #gf-sidebar-tab {
               position: fixed;
               right: 0;
               top: 50%;
               transform: translateY(-50%);
               background: #4a90e2;
               color: white;
               border: none;
               border-radius: 6px 0 0 6px;
               padding: 14px 7px;
               writing-mode: vertical-rl;
               text-orientation: mixed;
               cursor: pointer;
               z-index: 10002;
               font-size: 12px;
               font-weight: 600;
               letter-spacing: 0.5px;
               transition: right 0.25s ease, background-color 0.2s;
               box-shadow: -2px 0 8px rgba(0,0,0,0.2);
           }
           #gf-sidebar-tab:hover { background: #357abd; }
           .gf-sidebar-header {
               position: sticky;
               top: 0;
               background: #4a90e2;
               color: white;
               margin: 0 -16px;
               padding: 12px 16px;
               display: flex;
               justify-content: space-between;
               align-items: center;
               z-index: 1;
           }
           .gf-sidebar-header strong { font-size: 14px; }
           .gf-sidebar-close {
               background: none;
               border: none;
               color: white;
               font-size: 18px;
               cursor: pointer;
               padding: 0 4px;
               line-height: 1;
               opacity: 0.8;
           }
           .gf-sidebar-close:hover { opacity: 1; }
           .gf-stats-bar {
               background: rgba(74,144,226,0.1);
               border: 1px solid rgba(74,144,226,0.3);
               border-radius: 6px;
               padding: 7px 12px;
               margin: 12px 0 4px;
               font-size: 12px;
               color: #4a90e2;
               text-align: center;
               display: none;
           }
           .gf-stats-bar.active { display: block; }
           .gf-section-title {
               font-size: 11px;
               font-weight: 700;
               text-transform: uppercase;
               letter-spacing: 0.5px;
               color: #888;
               margin: 16px 0 8px;
               padding-bottom: 4px;
               border-bottom: 1px solid rgba(0,0,0,0.08);
           }
           .gf-input {
               width: 100%;
               padding: 7px 10px;
               border: 1px solid #ddd;
               border-radius: 5px;
               font-size: 13px;
               background: rgba(255,255,255,0.05);
               color: inherit;
               box-sizing: border-box;
           }
           .gf-input:focus { outline: none; border-color: #4a90e2; }
           .gf-input-label {
               font-size: 12px;
               color: #888;
               display: block;
               margin: 8px 0 4px;
           }
           .gf-input-hint {
               font-size: 11px;
               color: #aaa;
               margin-top: 3px;
           }
           .gf-posttype-row {
               display: flex;
               gap: 6px;
               flex-wrap: wrap;
               margin: 6px 0;
           }
           .gf-posttype-label {
               display: flex;
               align-items: center;
               gap: 4px;
               font-size: 13px;
               cursor: pointer;
               padding: 4px 10px;
               border: 1px solid #ddd;
               border-radius: 14px;
               user-select: none;
               transition: all 0.15s;
               color: #555;
           }
           .gf-posttype-label:has(input:checked) {
               background: #4a90e2;
               color: white;
               border-color: #4a90e2;
           }
           .gf-posttype-label input { display: none; }
           .gf-number-row {
               display: flex;
               align-items: center;
               gap: 8px;
               margin: 4px 0;
           }
           .gf-number-row input {
               width: 70px;
               padding: 6px 8px;
               border: 1px solid #ddd;
               border-radius: 5px;
               font-size: 13px;
               background: rgba(255,255,255,0.05);
               color: inherit;
           }
           .gf-toggle-row {
               display: flex;
               justify-content: space-between;
               align-items: center;
               padding: 5px 0;
           }
           .gf-toggle-label { font-size: 13px; }
           .gf-reset-btn {
               width: 100%;
               margin-top: 16px;
               padding: 9px;
               background: none;
               border: 1px solid #ddd;
               border-radius: 6px;
               font-size: 13px;
               cursor: pointer;
               color: inherit;
               transition: all 0.2s;
           }
           .gf-reset-btn:hover { background: rgba(0,0,0,0.05); }
       `);
   
       const DEFAULT_FILTERS = {
           afterDate: '',
           contentFilters: {
               onlyBookmarked: false,
               hideBookmarked: false,
               hidePostTypes: []
           },
           interactionFilters: {
               minAnswers: '',
               maxAnswers: '',
               minLikes: ''
           },
           textFilters: {
               keywords: '',
               excludeKeywords: '',
               requiredTags: ''
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
               this.sidebar = null; // set by SidebarPanel after construction
               this.debouncedApplyFilters = Utils.debounce(() => this.applyFilters(), 300);
               this.observeFilterButton();
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
                   textFilters: { ...DEFAULT_FILTERS.textFilters, ...saved.textFilters }
               };
           }
   
           saveFilters() {
               GM_setValue('enhancedFilters', this.filters);
           }
   
           observeFilterButton() {
               const observer = new MutationObserver((mutations) => {
                   mutations.forEach((mutation) => {
                       mutation.addedNodes.forEach((node) => {
                           if (node.nodeType === 1) {
                               const filterButton = node.querySelector
                                   ? node.querySelector('.Filter-button')
                                   : (node.classList?.contains('Filter-button') ? node : null);
                               if (filterButton) this.attachFilterButtonListener(filterButton);
                           }
                       });
                   });
               });
               observer.observe(document.body, { childList: true, subtree: true });
   
               const existingFilterButton = document.querySelector('.Filter-button');
               if (existingFilterButton) this.attachFilterButtonListener(existingFilterButton);
           }
   
           attachFilterButtonListener(filterButton) {
               if (filterButton.hasAttribute('data-enhanced-listener')) return;
               filterButton.setAttribute('data-enhanced-listener', 'true');
               filterButton.addEventListener('click', () => {
                   this.enableFilters();
                   setTimeout(() => this.applyFilters(), 300);
               });
           }
   
           enableFilters() {
               if (!this.filtersEnabled) {
                   this.filtersEnabled = true;
                   this.observeNewPosts();
                   console.log('[Enhanced Filter] Filters activated!');
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
                       console.log('[Enhanced Filter] New posts detected, applying filters...');
                       this.debouncedApplyFilters();
                   }
               });
   
               this.postObserver.observe(document.body, { childList: true, subtree: true });
               console.log('[Enhanced Filter] Observer for new posts initialized');
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
   
               const cf = this.filters.contentFilters;
               if (cf.onlyBookmarked) activeCount++;
               if (cf.hideBookmarked) activeCount++;
               if (cf.hidePostTypes?.length > 0) activeCount++;
   
               if (this.filters.interactionFilters.minAnswers ||
                   this.filters.interactionFilters.maxAnswers ||
                   this.filters.interactionFilters.minLikes) activeCount++;
   
               if (this.filters.textFilters.keywords ||
                   this.filters.textFilters.excludeKeywords ||
                   this.filters.textFilters.requiredTags) activeCount++;
   
               const countSpan = document.querySelector('.Filter-buttonActiveFiltersCount');
               if (countSpan) {
                   countSpan.textContent = activeCount > 0 ? activeCount : '';
                   countSpan.style.display = activeCount > 0 ? 'inline-block' : 'none';
               }
           }
   
           applyFilters() {
               if (!this.filtersEnabled) {
                   console.log('[Enhanced Filter] Filters not enabled, skipping...');
                   return;
               }
   
               console.log('[Enhanced Filter] Applying filters:', this.filters);
   
               const posts = document.querySelectorAll('.Plate.ListingElement');
               const blockedAuthors = GM_getValue('blockedAuthors', []);
               let visibleCount = 0;
   
               posts.forEach(post => {
                   let shouldShow = true;
   
                   // Date filter
                   if (shouldShow && this.filters.afterDate) {
                       const timeElement = post.querySelector('time[datetime]');
                       if (timeElement) {
                           const postDate = new Date(timeElement.getAttribute('datetime'));
                           const afterDate = new Date(this.filters.afterDate);
                           if (postDate < afterDate) shouldShow = false;
                       }
                   }
   
                   // Post type filter
                   if (shouldShow && this.filters.contentFilters.hidePostTypes?.length > 0) {
                       const questionLink = post.querySelector('a.ListingElement-questionLink[href]');
                       if (questionLink) {
                           const href = questionLink.getAttribute('href');
                           const postType = href.includes('/frage/') ? 'frage'
                               : href.includes('/diskussion/') ? 'diskussion'
                               : href.includes('/umfrage/') ? 'umfrage'
                               : null;
                           if (postType && this.filters.contentFilters.hidePostTypes.includes(postType)) {
                               shouldShow = false;
                           }
                       }
                   }
   
                   // Bookmark filter
                   if (shouldShow && (this.filters.contentFilters.onlyBookmarked || this.filters.contentFilters.hideBookmarked)) {
                       const isBookmarked = post.querySelector('.Icon--bookmark-filled-large') !== null;
                       if (this.filters.contentFilters.onlyBookmarked && !isBookmarked) shouldShow = false;
                       if (shouldShow && this.filters.contentFilters.hideBookmarked && isBookmarked) shouldShow = false;
                   }
   
                   // Blocked author filter
                   if (shouldShow && blockedAuthors.length > 0) {
                       const authorEl = post.querySelector('.ContentMeta-author a');
                       if (authorEl && blockedAuthors.includes(authorEl.textContent.trim())) {
                           shouldShow = false;
                       }
                   }
   
                   // Text filters (only build searchableText if needed)
                   if (shouldShow && (this.filters.textFilters.keywords || this.filters.textFilters.excludeKeywords)) {
                       const titleText = post.querySelector('.Question-title')?.textContent.toLowerCase() ?? '';
                       const bodyText = post.querySelector('.ContentBody')?.textContent.toLowerCase() ?? '';
                       const authorText = post.querySelector('.ContentMeta-author a')?.textContent.toLowerCase() ?? '';
                       const searchableText = titleText + ' ' + bodyText + ' ' + authorText;
   
                       if (shouldShow && this.filters.textFilters.keywords) {
                           const keywords = this.filters.textFilters.keywords.split(',')
                               .map(k => k.trim().toLowerCase()).filter(Boolean);
                           if (keywords.length > 0 && !keywords.some(k => searchableText.includes(k))) {
                               shouldShow = false;
                           }
                       }
   
                       if (shouldShow && this.filters.textFilters.excludeKeywords) {
                           const excludeWords = this.filters.textFilters.excludeKeywords.split(',')
                               .map(k => k.trim().toLowerCase()).filter(Boolean);
                           if (excludeWords.some(k => searchableText.includes(k))) shouldShow = false;
                       }
                   }
   
                   // Required tags filter
                   if (shouldShow && this.filters.textFilters.requiredTags) {
                       const requiredTags = this.filters.textFilters.requiredTags.split(',')
                           .map(t => t.trim().toLowerCase()).filter(Boolean);
                       if (requiredTags.length > 0) {
                           const postTags = Array.from(post.querySelectorAll('[data-tag-slug]'))
                               .map(el => el.getAttribute('data-tag-slug').toLowerCase());
                           if (!requiredTags.some(tag => postTags.includes(tag))) shouldShow = false;
                       }
                   }
   
                   // Answer count filter (only parse DOM if needed)
                   if (shouldShow && (this.filters.interactionFilters.minAnswers !== '' || this.filters.interactionFilters.maxAnswers !== '')) {
                       let answerCount = 0;
                       let answerCountFound = false;
                       const answerSelectors = [
                           'a[href*="/frage/"]', 'a[href*="/diskussion/"]',
                           'a[href*="/umfrage/"]', '.ListingElement-bottomBar a'
                       ];
   
                       for (const selector of answerSelectors) {
                           if (answerCountFound) break;
                           for (const link of post.querySelectorAll(selector)) {
                               const text = link.textContent.trim();
                               let match = text.match(/^(\d+)\s+Antwort/i) || text.match(/(\d+)\s+Antwort/i);
                               if (!match && text.toLowerCase().includes('keine antwort')) {
                                   answerCount = 0; answerCountFound = true; break;
                               }
                               if (!match && text.toLowerCase().includes('antwort')) {
                                   const nm = text.match(/(\d+)/);
                                   if (nm) match = [null, nm[1]];
                               }
                               if (match) { answerCount = parseInt(match[1]); answerCountFound = true; break; }
                           }
                       }
   
                       const minA = parseInt(this.filters.interactionFilters.minAnswers);
                       const maxA = parseInt(this.filters.interactionFilters.maxAnswers);
                       if (!isNaN(minA) && answerCount < minA) shouldShow = false;
                       if (shouldShow && !isNaN(maxA) && answerCount > maxA) shouldShow = false;
                   }
   
                   // Likes filter — prefer aria-label for robustness
                   if (shouldShow && this.filters.interactionFilters.minLikes) {
                       const likeBtn = post.querySelector('.ActionBarIcon button[aria-label*="Daumen"]');
                       const likes = likeBtn
                           ? parseInt(likeBtn.getAttribute('aria-label').match(/(\d+)/)?.[1]) || 0
                           : parseInt(post.querySelector('.ActionBarIcon-count')?.textContent) || 0;
                       if (likes < parseInt(this.filters.interactionFilters.minLikes)) shouldShow = false;
                   }
   
                   if (shouldShow) visibleCount++;
                   post.style.display = shouldShow ? '' : 'none';
               });
   
               this.updateStatsOverlay(visibleCount, posts.length);
           }
   
           updateStatsOverlay(visible, total) {
               // Delegate to sidebar if open; otherwise use floating overlay
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
                       position: fixed;
                       bottom: 20px;
                       right: 20px;
                       background: rgba(0,0,0,0.72);
                       color: white;
                       padding: 7px 12px;
                       border-radius: 6px;
                       font-size: 12px;
                       z-index: 9999;
                       pointer-events: none;
                   `;
                   document.body.appendChild(overlay);
               }
   
               const filtered = total - visible;
               overlay.textContent = `${visible} sichtbar · ${filtered} gefiltert`;
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
               this.tab.textContent = '⚙ Filter & Tools';
               this.tab.title = 'Erweiterte Filter öffnen / schließen';
               this.tab.addEventListener('click', () => this.toggle());
               document.body.appendChild(this.tab);
           }
   
           toggle() { this.isOpen ? this.close() : this.open(); }
   
           open(save = true) {
               this.isOpen = true;
               this.panel.style.right = '0';
               this.tab.style.right = '340px';
               if (save) GM_setValue('sidebarOpen', true);
               this.fi.enableFilters();
               setTimeout(() => this.fi.applyFilters(), 100);
           }
   
           close(save = true) {
               this.isOpen = false;
               this.panel.style.right = '-360px';
               this.tab.style.right = '0';
               if (save) GM_setValue('sidebarOpen', false);
           }
   
           updateStats(visible, total) {
               const statsEl = this.panel.querySelector('.gf-stats-bar');
               if (!statsEl) return;
               const filtered = total - visible;
               if (filtered > 0) {
                   statsEl.textContent = `${visible} sichtbar · ${filtered} ausgeblendet`;
                   statsEl.classList.add('active');
               } else {
                   statsEl.classList.remove('active');
               }
           }
   
           renderContent() {
               const f = this.fi.filters;
               const hideTypes = f.contentFilters.hidePostTypes || [];
               const customTags = GM_getValue('customTagsToRemove', ['islam', 'allah', 'muslime', 'koran', 'mohammed']).join(', ');
               const blockedAuthors = GM_getValue('blockedAuthors', []).join(', ');
   
               const togBtn = (id, dataFilter, isOn) => `
                   <button class="Toggle-button u-mrm" type="button" id="${id}" role="switch"
                           aria-checked="${isOn}" data-filter="${dataFilter}">
                       <span class="Toggle ${isOn ? 'Toggle--on' : 'Toggle--off'}">
                           <span class="Toggle-label"></span>
                       </span>
                   </button>`;
   
               this.panel.innerHTML = `
                   <div class="gf-sidebar-header">
                       <strong>⚙ Filter &amp; Tools</strong>
                       <button class="gf-sidebar-close" title="Schließen">✕</button>
                   </div>
                   <div class="gf-stats-bar"></div>
   
                   <div class="gf-section-title">Fragetyp</div>
                   <div class="gf-posttype-row">
                       <label class="gf-posttype-label">
                           <input type="checkbox" data-posttype="frage" ${!hideTypes.includes('frage') ? 'checked' : ''}> Fragen
                       </label>
                       <label class="gf-posttype-label">
                           <input type="checkbox" data-posttype="diskussion" ${!hideTypes.includes('diskussion') ? 'checked' : ''}> Diskussionen
                       </label>
                       <label class="gf-posttype-label">
                           <input type="checkbox" data-posttype="umfrage" ${!hideTypes.includes('umfrage') ? 'checked' : ''}> Umfragen
                       </label>
                   </div>
   
                   <div class="gf-section-title">Datum</div>
                   <input type="datetime-local" class="gf-input" data-filter="afterDate"
                          value="${f.afterDate || ''}">
                   <div class="gf-input-hint">Nur Beiträge ab diesem Datum</div>
   
                   <div class="gf-section-title">Gemerkte Beiträge</div>
                   <div class="gf-toggle-row">
                       <span class="gf-toggle-label">Nur gemerkte anzeigen</span>
                       ${togBtn('sb-only-bookmarked', 'contentFilters.onlyBookmarked', f.contentFilters.onlyBookmarked)}
                   </div>
                   <div class="gf-toggle-row">
                       <span class="gf-toggle-label">Gemerkte ausblenden</span>
                       ${togBtn('sb-hide-bookmarked', 'contentFilters.hideBookmarked', f.contentFilters.hideBookmarked)}
                   </div>
   
                   <div class="gf-section-title">Interaktion</div>
                   <label class="gf-input-label">Anzahl Antworten:</label>
                   <div class="gf-number-row">
                       <input type="number" placeholder="Min" value="${f.interactionFilters.minAnswers}"
                              data-filter="interactionFilters.minAnswers">
                       <span>bis</span>
                       <input type="number" placeholder="Max" value="${f.interactionFilters.maxAnswers}"
                              data-filter="interactionFilters.maxAnswers">
                   </div>
                   <label class="gf-input-label">Mindest-Likes:</label>
                   <input type="number" class="gf-input" placeholder="z.B. 5"
                          value="${f.interactionFilters.minLikes}" data-filter="interactionFilters.minLikes">
   
                   <div class="gf-section-title">Textfilter</div>
                   <label class="gf-input-label">Suchbegriffe (kommagetrennt):</label>
                   <input type="text" class="gf-input" placeholder="z.B. JavaScript, HTML"
                          value="${f.textFilters.keywords}" data-filter="textFilters.keywords">
                   <label class="gf-input-label">Ausschließen (kommagetrennt):</label>
                   <input type="text" class="gf-input" placeholder="z.B. Spam, Werbung"
                          value="${f.textFilters.excludeKeywords}" data-filter="textFilters.excludeKeywords">
                   <label class="gf-input-label">Nur diese Tags (kommagetrennt):</label>
                   <input type="text" class="gf-input" placeholder="z.B. javascript, html"
                          value="${f.textFilters.requiredTags}" data-filter="textFilters.requiredTags">
                   <div class="gf-input-hint">Post muss mindestens einen dieser Tags haben</div>
   
                   <div class="gf-section-title">Einstellungen</div>
                   <label class="gf-input-label">Zu entfernende Tags (kommagetrennt):</label>
                   <input type="text" class="gf-input" id="gf-custom-tags" value="${customTags}">
                   <div class="gf-input-hint">Wird beim automatischen Tag-Entfernen verwendet</div>
                   <label class="gf-input-label">Gesperrte Autoren (kommagetrennt):</label>
                   <input type="text" class="gf-input" id="gf-blocked-authors" value="${blockedAuthors}">
                   <div class="gf-input-hint">Beiträge dieser Autoren werden ausgeblendet</div>
   
                   <button class="gf-reset-btn">↺ Alle Filter zurücksetzen</button>
               `;
   
               this.attachEventListeners();
           }
   
           attachEventListeners() {
               const panel = this.panel;
   
               // Close button
               panel.querySelector('.gf-sidebar-close').addEventListener('click', () => this.close());
   
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
  
              // Toggle buttons (bookmarks) — mutual exclusion
              panel.querySelectorAll('.Toggle-button[data-filter]').forEach(button => {
                  button.addEventListener('click', () => {
                      const toggle = button.querySelector('.Toggle');
                      const isOn = toggle.classList.contains('Toggle--on');
  
                      // Mutual exclusion for bookmark toggles
                      if (!isOn && (button.id === 'sb-only-bookmarked' || button.id === 'sb-hide-bookmarked')) {
                          const otherId = button.id === 'sb-only-bookmarked' ? 'sb-hide-bookmarked' : 'sb-only-bookmarked';
                          const other = panel.querySelector(`#${otherId}`);
                          if (other) {
                              const otherToggle = other.querySelector('.Toggle');
                              if (otherToggle.classList.contains('Toggle--on')) {
                                  otherToggle.classList.replace('Toggle--on', 'Toggle--off');
                                  other.setAttribute('aria-checked', 'false');
                                  this.fi.updateFilterValue(other.getAttribute('data-filter'), false);
                              }
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
  
              // Regular inputs
              panel.querySelectorAll('input[data-filter]').forEach(input => {
                  input.addEventListener('change', () => {
                      this.fi.updateFilterValue(input.getAttribute('data-filter'), input.value);
                      this.fi.enableFilters();
                      this.fi.debouncedApplyFilters();
                  });
              });
  
              // Settings: custom tags to remove
              panel.querySelector('#gf-custom-tags').addEventListener('change', (e) => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  GM_setValue('customTagsToRemove', tags);
              });
  
              // Settings: blocked authors
              panel.querySelector('#gf-blocked-authors').addEventListener('change', (e) => {
                  const authors = e.target.value.split(',').map(a => a.trim()).filter(Boolean);
                  GM_setValue('blockedAuthors', authors);
                  this.fi.enableFilters();
                  this.fi.debouncedApplyFilters();
              });
  
              // Reset button
              panel.querySelector('.gf-reset-btn').addEventListener('click', () => {
                  this.fi.filters = {
                      ...DEFAULT_FILTERS,
                      contentFilters: { ...DEFAULT_FILTERS.contentFilters },
                      interactionFilters: { ...DEFAULT_FILTERS.interactionFilters },
                      textFilters: { ...DEFAULT_FILTERS.textFilters }
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

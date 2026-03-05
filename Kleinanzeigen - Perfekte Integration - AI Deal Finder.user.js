// ==UserScript==
// @name         Kleinanzeigen - Perfekte Integration - AI Deal Finder
// @namespace    http://tampermonkey.net/
// @version      27.2
// @description  Automatischer AI-gestützter Deal-Finder für Kleinanzeigen mit Live-Ranking und Pause-Funktion. Crawlt mehrere Seiten, analysiert mit Gemini AI.
// @author       marmoris
// @match        https://www.kleinanzeigen.de/s-*
// @match        https://www.kleinanzeigen.de/z-*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=kleinanzeigen.de
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      kleinanzeigen.de
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_PREFIX = '[KA-DealFinder V27.2]';
    const INITIAL_BATCH_SIZE = 12;
    const MIN_BATCH_SIZE = 8;
    const MAX_BATCH_SIZE = 20;
    const MAX_RETRIES = 2;

    // Gemini Models
    const GEMINI_MODELS = {
        flash: {
            id: 'gemini-3-flash-preview',
            name: 'Gemini 3 Flash',
            description: 'Schneller & effizient',
            url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent'
        },
        pro: {
            id: 'gemini-3-pro-preview',
            name: 'Gemini 3 Pro',
            description: 'Maximum Intelligenz',
            url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent'
        }
    };

    // Globaler State
    let isRunning = false;
    let isPaused = false;
    let shouldStop = false;
    let allTopDeals = [];
    let currentPage = 1;

    // Hilfsfunktion: Warten auf Element (aus originalem Skript)
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    // LocalStorage für Settings
    function saveSettings(settings) {
        GM_setValue('ka_dealfinder_settings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = GM_getValue('ka_dealfinder_settings', null);
        return saved ? JSON.parse(saved) : {
            apiKey: '',
            searchContext: '',
            topX: 3,
            model: 'flash'  // Default: Gemini 3 Flash
        };
    }

    // Crawl-State speichern/laden (für Multi-Page Navigation)
    function saveCrawlState(state) {
        GM_setValue('ka_dealfinder_crawl_state', JSON.stringify(state));
        console.log(`${SCRIPT_PREFIX} Crawl-State gespeichert:`, state);
    }

    function loadCrawlState() {
        const saved = GM_getValue('ka_dealfinder_crawl_state', null);
        return saved ? JSON.parse(saved) : null;
    }

    function clearCrawlState() {
        GM_setValue('ka_dealfinder_crawl_state', null);
        console.log(`${SCRIPT_PREFIX} Crawl-State gelöscht`);
    }

    // Results speichern/laden (persistent zwischen Settings/Results Views)
    function saveResults(results) {
        GM_setValue('ka_dealfinder_results', JSON.stringify(results));
        console.log(`${SCRIPT_PREFIX} Results gespeichert:`, results.length, 'Deals');
    }

    function loadResults() {
        const saved = GM_getValue('ka_dealfinder_results', null);
        return saved ? JSON.parse(saved) : null;
    }

    function clearResults() {
        GM_setValue('ka_dealfinder_results', null);
        console.log(`${SCRIPT_PREFIX} Results gelöscht`);
    }

    // ==================== UI FUNKTIONEN ====================

    // Sidepanel Content - Settings View
    function renderSettingsView() {
        const settings = loadSettings();
        const savedResults = loadResults();

        return `
            <div id="ka-settings-view" style="padding: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2 style="margin: 0; color: #333; font-size: 20px;">🔍 Deal Finder</h2>
                    <button id="ka-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">×</button>
                </div>

                ${savedResults ? `
                <div style="background: #e8f5e9; padding: 12px; border-radius: 4px; margin-bottom: 18px; border-left: 3px solid #4caf50;">
                    <div style="font-size: 13px; color: #2e7d32; font-weight: 600; margin-bottom: 6px;">
                        ✅ ${savedResults.deals.length} gespeicherte Deals
                    </div>
                    <div style="font-size: 11px; color: #558b2f;">
                        Analysierte Seiten: ${savedResults.pages} | ${savedResults.timestamp}
                    </div>
                    <button id="ka-show-results-btn" style="
                        width: 100%;
                        margin-top: 8px;
                        padding: 8px;
                        background: #4caf50;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                    ">📊 Ergebnisse anzeigen</button>
                </div>
                ` : ''}

                <div style="margin-bottom: 18px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        Gemini API Key
                    </label>
                    <input type="password" id="ka-api-key" placeholder="AIza..."
                        value="${settings.apiKey}"
                        style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
                    <small style="color: #888; font-size: 11px;">
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #667eea;">Kostenlosen Key holen</a>
                    </small>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        Suchkontext
                    </label>
                    <textarea id="ka-search-context" placeholder="z.B. Gaming PC RTX 3060, Neupreis €800-1000"
                        style="width: 100%; height: 70px; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; resize: vertical; box-sizing: border-box; font-family: inherit;">${settings.searchContext}</textarea>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        Top-X pro Seite
                    </label>
                    <input type="number" id="ka-top-x" min="1" max="10" value="${settings.topX}"
                        style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 13px;">
                        AI Model
                    </label>
                    <div style="display: flex; gap: 10px;">
                        <label style="flex: 1; cursor: pointer;">
                            <input type="radio" name="ka-model" value="flash" ${settings.model === 'flash' ? 'checked' : ''}
                                style="margin-right: 6px;">
                            <span style="font-size: 12px; color: #333;">
                                <strong>⚡ Flash</strong><br>
                                <small style="color: #777;">Schnell & effizient</small>
                            </span>
                        </label>
                        <label style="flex: 1; cursor: pointer;">
                            <input type="radio" name="ka-model" value="pro" ${settings.model === 'pro' ? 'checked' : ''}
                                style="margin-right: 6px;">
                            <span style="font-size: 12px; color: #333;">
                                <strong>🧠 Pro</strong><br>
                                <small style="color: #777;">Maximum Intelligenz</small>
                            </span>
                        </label>
                    </div>
                </div>

                <div id="ka-progress-container" style="display: none; margin-bottom: 18px; padding: 12px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #667eea;">
                    <div id="ka-progress-text" style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 12px;">
                        Bereit...
                    </div>
                    <div style="background: #e0e0e0; border-radius: 4px; height: 6px; overflow: hidden;">
                        <div id="ka-progress-bar" style="background: #667eea; height: 100%; width: 0%; transition: width 0.3s;"></div>
                    </div>
                </div>

                <!-- Live Ranking Container -->
                <div id="ka-live-ranking" style="display: none; margin-bottom: 18px; padding: 12px; background: #fff8e1; border-radius: 4px; border-left: 3px solid #ffc107;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">🏆 Live Top-Deals</h3>
                    <div id="ka-live-ranking-content" style="font-size: 12px; color: #555;"></div>
                </div>

                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="ka-start-btn" style="
                        flex: 1;
                        min-width: 100px;
                        padding: 10px 16px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">▶ Start</button>

                    <button id="ka-pause-btn" style="
                        flex: 1;
                        min-width: 100px;
                        padding: 10px 16px;
                        background: #ffc107;
                        color: #333;
                        border: none;
                        border-radius: 4px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        display: none;
                    ">⏸ Pause</button>

                    <button id="ka-stop-btn" style="
                        flex: 1;
                        min-width: 100px;
                        padding: 10px 16px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        display: none;
                    ">⏹ Stopp</button>
                </div>
            </div>
        `;
    }

    // Generate Markdown from results
    function generateMarkdown(deals, pages) {
        let markdown = `# 🏆 KLEINANZEIGEN DEAL FINDER - FINALE RANKING\n\n`;
        markdown += `**Gefunden:** ${deals.length} Top-Deals  \n`;
        markdown += `**Analysierte Seiten:** ${pages}  \n`;
        markdown += `**Erstellt:** ${new Date().toLocaleString('de-DE')}\n\n`;

        deals.forEach((deal, index) => {
            const rank = index + 1;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${rank}`;

            markdown += `## ${medal} RANG ${rank} (Seite ${deal.page})\n\n`;
            markdown += `**Titel:** ${deal.title || 'Unbekannt'}  \n`;
            markdown += `**Preis:** ${deal.price || 'Unbekannt'}  \n`;
            markdown += `**Begründung:** ${deal.reasoning || 'Keine Begründung'}  \n\n`;

            if (deal.description) {
                markdown += `**Beschreibung:**\n> ${deal.description.substring(0, 200)}${deal.description.length > 200 ? '...' : ''}\n\n`;
            }

            markdown += `**Link:** [Anzeige öffnen](${deal.url})\n\n`;
        });

        return markdown;
    }

    // Sidepanel Content - Results View
    function renderResultsView(dealsToShow = null) {
        const deals = dealsToShow || allTopDeals;
        const pages = dealsToShow ? loadResults()?.pages : currentPage;

        const dealsHTML = deals.map((deal, index) => `
            <div style="padding: 15px; background: ${index === 0 ? '#fff8e1' : '#f8f9fa'}; border-radius: 4px; margin-bottom: 12px; border-left: 3px solid ${index === 0 ? '#ffc107' : index === 1 ? '#28a745' : index === 2 ? '#17a2b8' : '#6c757d'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="font-weight: 700; color: #333; font-size: 14px;">
                        ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`} ${deal.title}
                    </div>
                    <div style="font-size: 11px; color: #888; white-space: nowrap; margin-left: 8px;">
                        S.${deal.page}
                    </div>
                </div>
                <div style="font-weight: 600; color: #28a745; font-size: 15px; margin-bottom: 8px;">
                    ${deal.price}
                </div>
                <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-style: italic;">
                    💡 ${deal.reasoning || 'Keine Begründung verfügbar'}
                </div>
                ${deal.description ? `
                <div style="font-size: 11px; color: #555; line-height: 1.4; margin-bottom: 8px; max-height: 60px; overflow: hidden;">
                    ${deal.description.substring(0, 150)}${deal.description.length > 150 ? '...' : ''}
                </div>
                ` : ''}
                <a href="${deal.url}" target="_blank" style="font-size: 11px; color: #667eea; text-decoration: none;">
                    → Anzeige öffnen
                </a>
            </div>
        `).join('');

        return `
            <div id="ka-results-view" style="padding: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333; font-size: 20px;">🏆 Top-Deals</h2>
                    <button id="ka-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">×</button>
                </div>

                <div style="background: #667eea; color: white; padding: 12px; border-radius: 4px; margin-bottom: 20px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${deals.length}</div>
                    <div style="font-size: 12px;">Top-Deals gefunden</div>
                </div>

                <div style="margin-bottom: 15px;">
                    ${dealsHTML}
                </div>

                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                    <button id="ka-export-markdown-btn" style="
                        flex: 1;
                        padding: 10px 16px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">📋 Markdown kopieren</button>

                    <button id="ka-clear-results-btn" style="
                        padding: 10px 16px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">🗑️ Löschen</button>
                </div>

                <button id="ka-back-to-settings" style="
                    width: 100%;
                    padding: 10px 16px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">← Zurück zu Einstellungen</button>
            </div>
        `;
    }

    // Update Live Ranking
    function updateLiveRanking() {
        const container = document.getElementById('ka-live-ranking');
        const content = document.getElementById('ka-live-ranking-content');

        if (!container || !content) return;

        if (allTopDeals.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        const topThree = allTopDeals.slice(0, 3);

        content.innerHTML = topThree.map((deal, idx) => `
            <div style="margin-bottom: 8px; padding-bottom: 8px; ${idx < topThree.length - 1 ? 'border-bottom: 1px solid #ffe082;' : ''}">
                <div style="font-weight: 600; color: #333;">${idx + 1}. ${deal.title}</div>
                <div style="color: #28a745; font-weight: 600;">${deal.price}</div>
                <div style="font-size: 10px; color: #888;">Seite ${deal.page}</div>
            </div>
        `).join('');
    }

    // Sidepanel erstellen
    function createModal() {
        const modalId = 'ka-dealfinder-modal';
        if (document.getElementById(modalId)) return;

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            right: 0;
            width: 400px;
            height: 100vh;
            background: white;
            z-index: 999999;
            box-shadow: -5px 0 20px rgba(0,0,0,0.2);
            overflow-y: auto;
            transition: transform 0.3s ease;
        `;

        modal.innerHTML = renderSettingsView();
        document.body.appendChild(modal);

        attachEventListeners();
    }

    function attachEventListeners() {
        // Settings View Listeners
        const startBtn = document.getElementById('ka-start-btn');
        const pauseBtn = document.getElementById('ka-pause-btn');
        const stopBtn = document.getElementById('ka-stop-btn');
        const closeBtn = document.getElementById('ka-close-btn-x');
        const showResultsBtn = document.getElementById('ka-show-results-btn');

        if (startBtn) startBtn.addEventListener('click', startDealFinder);
        if (pauseBtn) pauseBtn.addEventListener('click', pauseDealFinder);
        if (stopBtn) stopBtn.addEventListener('click', stopDealFinder);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (showResultsBtn) showResultsBtn.addEventListener('click', showSavedResults);

        // Hover effects
        [startBtn, pauseBtn, stopBtn, showResultsBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('mouseenter', () => btn.style.opacity = '0.9');
                btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
            }
        });
    }

    function showSavedResults() {
        const savedResults = loadResults();
        if (savedResults) {
            switchToResultsView(savedResults.deals);
        }
    }

    function switchToResultsView(deals = null) {
        const modal = document.getElementById('ka-dealfinder-modal');
        if (!modal) return;

        modal.innerHTML = renderResultsView(deals);

        // Attach new listeners
        const closeBtn = document.getElementById('ka-close-btn-x');
        const backBtn = document.getElementById('ka-back-to-settings');
        const exportBtn = document.getElementById('ka-export-markdown-btn');
        const clearBtn = document.getElementById('ka-clear-results-btn');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (backBtn) backBtn.addEventListener('click', switchToSettingsView);
        if (exportBtn) exportBtn.addEventListener('click', exportMarkdown);
        if (clearBtn) clearBtn.addEventListener('click', clearResultsAndGoBack);

        // Hover effects
        [exportBtn, clearBtn, backBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('mouseenter', () => btn.style.opacity = '0.9');
                btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
            }
        });
    }

    async function exportMarkdown() {
        const savedResults = loadResults();
        if (!savedResults) {
            alert('Keine Results verfügbar!');
            return;
        }

        const markdown = generateMarkdown(savedResults.deals, savedResults.pages);

        try {
            await navigator.clipboard.writeText(markdown);
            const btn = document.getElementById('ka-export-markdown-btn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✅ Kopiert!';
                btn.style.background = '#28a745';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '#28a745';
                }, 2000);
            }
            console.log(`${SCRIPT_PREFIX} Markdown in Zwischenablage kopiert!`);
        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Clipboard-Fehler:`, error);
            alert('Fehler beim Kopieren. Bitte Fenster fokussieren und nochmal versuchen.');
        }
    }

    function clearResultsAndGoBack() {
        if (confirm('Möchtest du die gespeicherten Results wirklich löschen?')) {
            clearResults();
            switchToSettingsView();
        }
    }

    function switchToSettingsView() {
        const modal = document.getElementById('ka-dealfinder-modal');
        if (!modal) return;

        modal.innerHTML = renderSettingsView();
        attachEventListeners();
    }

    function openModal() {
        const modal = document.getElementById('ka-dealfinder-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    function closeModal() {
        const modal = document.getElementById('ka-dealfinder-modal');
        if (modal && !isRunning) {
            modal.style.display = 'none';
        }
    }

    function updateProgress(text, percentage) {
        const container = document.getElementById('ka-progress-container');
        const progressText = document.getElementById('ka-progress-text');
        const progressBar = document.getElementById('ka-progress-bar');

        if (container) container.style.display = 'block';
        if (progressText) progressText.textContent = text;
        if (progressBar) progressBar.style.width = percentage + '%';
    }

    // ==================== CORE FUNKTIONEN ====================

    function findCurrentSelectors() {
        // Mehrere Ansätze: Erst spezifisch, dann allgemein
        const adSelectors = [
            'article[data-adid]',       // Modernes Layout
            'li.ad-listitem',           // Älteres Layout
            '.aditem'                   // Fallback
        ];

        // Versuche jeden Selector
        for (const selector of adSelectors) {
            const adEntries = document.querySelectorAll(selector);
            if (adEntries.length > 0) {
                console.log(`${SCRIPT_PREFIX} Gefunden: ${adEntries.length} Anzeigen (Selector: ${selector})`);
                return { adEntries };
            }
        }

        // Fallback: Alle Links die zu /s-anzeige/ führen
        const allLinks = document.querySelectorAll('a[href*="/s-anzeige/"]');
        // Filtere nur einzigartige Anzeigen (keine Duplikate)
        const uniqueUrls = new Set();
        const uniqueAds = [];

        allLinks.forEach(link => {
            const url = link.href;
            // Nur wenn es eine echte Anzeigen-URL ist (mit ID am Ende)
            if (url.match(/\/s-anzeige\/.*\/\d+/) && !uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                uniqueAds.push(link);
            }
        });

        if (uniqueAds.length > 0) {
            console.log(`${SCRIPT_PREFIX} Gefunden: ${uniqueAds.length} Anzeigen (Fallback-Methode)`);
            return { adEntries: uniqueAds };
        }

        console.log(`${SCRIPT_PREFIX} Keine Anzeigen gefunden`);
        return null;
    }

    function extractBasicInfo(ad) {
        const titleSelectors = ['h2', 'h3', 'a[class*="ellipsis"]', '[class*="title"]'];
        let title = 'Titel nicht verfügbar';
        for (const selector of titleSelectors) {
            const titleElement = ad.querySelector(selector);
            if (titleElement) {
                const titleText = titleElement.textContent.trim();
                if (titleText.length > 5 && !titleText.includes('€')) {
                    title = titleText;
                    break;
                }
            }
        }

        let price = 'Preis nicht verfügbar';
        const allTextElements = ad.querySelectorAll('span, div, p, strong');
        for (const element of allTextElements) {
            const text = element.textContent.trim();
            if ((text.includes('€') || text.includes('EUR') || text.includes('VB')) && text.length < 30 && !text.includes('...')) {
                price = text;
                break;
            }
        }

        // URL aus data-href oder Link extrahieren
        let url = ad.getAttribute('data-href') || ad.href || ad.querySelector('a[href*="/s-anzeige/"]')?.href || 'URL nicht verfügbar';

        // Relative URL korrigieren
        if (url && !url.startsWith('http')) {
            url = 'https://www.kleinanzeigen.de' + url;
        }

        return { title, price, url };
    }

    function fetchFullDescription(url, retryCount = 0) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: 15000,
                onload: function(response) {
                    try {
                        if (response.status >= 200 && response.status < 300) {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(response.responseText, 'text/html');

                            const descSelectors = [
                                '#viewad-description-text',
                                '[class*="description"]',
                                '.ad-description',
                                'div[class*="description"]'
                            ];

                            let fullDesc = null;
                            for (const selector of descSelectors) {
                                const element = doc.querySelector(selector);
                                if (element && element.textContent.trim().length > 20) {
                                    fullDesc = element.textContent.replace(/\s+/g, ' ').trim();
                                    break;
                                }
                            }

                            if (fullDesc) {
                                resolve({ success: true, description: fullDesc });
                            } else if (retryCount < MAX_RETRIES) {
                                setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000);
                            } else {
                                resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                            }
                        } else if (retryCount < MAX_RETRIES) {
                            setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000);
                        } else {
                            resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                        }
                    } catch (error) {
                        if (retryCount < MAX_RETRIES) {
                            setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000);
                        } else {
                            resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                        }
                    }
                },
                onerror: () => retryCount < MAX_RETRIES ?
                    setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000) :
                    resolve({ success: false, description: 'Beschreibung nicht verfügbar' }),
                ontimeout: () => retryCount < MAX_RETRIES ?
                    setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000) :
                    resolve({ success: false, description: 'Beschreibung nicht verfügbar' })
            });
        });
    }

    function callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey = 'flash', retryCount = 0) {
        return new Promise((resolve, reject) => {
            const modelConfig = GEMINI_MODELS[modelKey];

            // Use full descriptions without truncation

            const prompt = `Du bist ein Experte für Schnäppchen und Preisanalyse.

SUCHKONTEXT: ${searchContext}

AUFGABE:
Analysiere die folgenden Kleinanzeigen-Anzeigen und finde die ${topX} BESTEN Schnäppchen/Deals.

KRITERIEN für ein gutes Schnäppchen:
- 35-90% unter dem üblichen Neupreis
- Bei Wiederverkauf garantierter Gewinn möglich
- MUST BUY Qualität
- Echter Mehrwert für den Käufer

ANZEIGEN:
${adsData.map((ad, idx) => `
Anzeige ${idx + 1}:
Titel: ${ad.title}
Preis: ${ad.price}
Beschreibung: ${ad.description}
URL: ${ad.url}
`).join('\n---\n')}

ANTWORT-FORMAT (NUR JSON, KEINE ZUSÄTZLICHEN TEXTE):
{
  "topDeals": [
    {
      "originalIndex": 1,
      "title": "...",
      "price": "...",
      "description": "...",
      "url": "...",
      "reasoning": "Warum ist das ein Top-Deal? (1-2 Sätze)"
    }
  ]
}

Sortiere die Top ${topX} Deals nach Qualität (beste zuerst).`;

            console.log(`${SCRIPT_PREFIX} Prompt length: ~${prompt.length} chars`);
            console.log(`${SCRIPT_PREFIX} Using model: ${modelConfig.name} (${modelConfig.id})`);

            const requestBody = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 65536,  // Gemini 3: Max 64k Output
                    responseMimeType: "application/json"  // Direkte JSON-Antwort ohne Markdown
                    // thinking_level wird NICHT unterstützt - entfernt!
                }
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: `${modelConfig.url}?key=${apiKey}`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(requestBody),
                timeout: 60000,
                onload: function(response) {
                    try {
                        if (response.status === 200) {
                            const data = JSON.parse(response.responseText);

                            // Debug: Zeige finishReason
                            const finishReason = data.candidates?.[0]?.finishReason;
                            console.log(`${SCRIPT_PREFIX} Gemini finishReason:`, finishReason);

                            // Kombiniere ALLE Parts (falls mehrere)
                            const parts = data.candidates[0].content.parts;
                            let fullText = parts.map(p => p.text).join('');

                            console.log(`${SCRIPT_PREFIX} AI Antwort (${parts.length} parts, ${fullText.length} chars):`, fullText.substring(0, 500));

                            // Warnung bei STOP (abgeschnitten)
                            if (finishReason === 'STOP') {
                                console.log(`${SCRIPT_PREFIX} ✅ Vollständige Antwort erhalten (STOP)`);
                            } else if (finishReason === 'MAX_TOKENS') {
                                console.warn(`${SCRIPT_PREFIX} ⚠️ Response bei MAX_TOKENS abgeschnitten!`);
                            } else if (finishReason) {
                                console.warn(`${SCRIPT_PREFIX} ⚠️ Unerwarteter finishReason: ${finishReason}`);
                            }

                            let jsonText = null;

                            // Methode 1: Direkt als JSON parsen (responseMimeType: "application/json")
                            try {
                                const directResult = JSON.parse(fullText);
                                if (directResult.topDeals) {
                                    console.log(`${SCRIPT_PREFIX} ✅ Direktes JSON erfolgreich geparst`);
                                    resolve(directResult);
                                    return;
                                }
                            } catch (e) {
                                // Fallback zu anderen Methoden
                            }

                            // Methode 2: Markdown Codeblock ```json ... ``` (GREEDY)
                            const markdownMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                            if (markdownMatch) {
                                jsonText = markdownMatch[1];
                                console.log(`${SCRIPT_PREFIX} JSON via Markdown extrahiert (${jsonText.length} chars)`);
                            }

                            // Methode 3: Rohes JSON (GREEDY)
                            if (!jsonText) {
                                const rawMatch = fullText.match(/\{[\s\S]*\}/);
                                if (rawMatch) {
                                    jsonText = rawMatch[0];
                                    console.log(`${SCRIPT_PREFIX} JSON raw extrahiert (${jsonText.length} chars)`);
                                }
                            }

                            if (jsonText) {
                                try {
                                    const result = JSON.parse(jsonText);
                                    resolve(result);
                                } catch (parseError) {
                                    console.error(`${SCRIPT_PREFIX} JSON Parse Fehler:`, parseError);
                                    console.error(`${SCRIPT_PREFIX} Problematischer JSON-Text:`, jsonText.substring(0, 500));
                                    if (retryCount < MAX_RETRIES) {
                                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1).then(resolve).catch(reject), 2000);
                                    } else {
                                        reject(new Error('JSON Parse Fehler'));
                                    }
                                }
                            } else {
                                console.error(`${SCRIPT_PREFIX} Kein JSON in Antwort gefunden`);
                                console.error(`${SCRIPT_PREFIX} Vollständige Antwort:`, fullText);
                                if (retryCount < MAX_RETRIES) {
                                    setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1).then(resolve).catch(reject), 2000);
                                } else {
                                    reject(new Error('Kein JSON in AI-Antwort'));
                                }
                            }
                        } else if (retryCount < MAX_RETRIES) {
                            console.log(`${SCRIPT_PREFIX} Gemini API Fehler ${response.status} - Retry ${retryCount + 1}`);
                            console.error(`${SCRIPT_PREFIX} Response Body:`, response.responseText);
                            setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1).then(resolve).catch(reject), 2000);
                        } else {
                            console.error(`${SCRIPT_PREFIX} FINALE FEHLER - Status: ${response.status}`);
                            console.error(`${SCRIPT_PREFIX} Response Body:`, response.responseText);
                            reject(new Error(`Gemini API Fehler: ${response.status} - ${response.responseText}`));
                        }
                    } catch (error) {
                        if (retryCount < MAX_RETRIES) {
                            setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1).then(resolve).catch(reject), 2000);
                        } else {
                            reject(error);
                        }
                    }
                },
                onerror: () => {
                    if (retryCount < MAX_RETRIES) {
                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1).then(resolve).catch(reject), 2000);
                    } else {
                        reject(new Error('Netzwerkfehler bei Gemini API'));
                    }
                },
                ontimeout: () => {
                    if (retryCount < MAX_RETRIES) {
                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1).then(resolve).catch(reject), 2000);
                    } else {
                        reject(new Error('Timeout bei Gemini API'));
                    }
                }
            });
        });
    }

    function goToNextPage() {
        console.log(`${SCRIPT_PREFIX} 🔍 Suche Next-Button...`);

        // Methode 1: Pagination für Kleinanzeigen
        let nextButton = document.querySelector('a[class*="pagination-next"]');

        // Methode 2: Fallback - Suche nach "weiter" oder ">"
        if (!nextButton) {
            const allLinks = document.querySelectorAll('a');
            for (const link of allLinks) {
                const text = link.textContent?.trim().toLowerCase();
                const href = link.getAttribute('href');
                if ((text === 'weiter' || text === '>' || text === '›') && href && href.includes('seite:')) {
                    nextButton = link;
                    break;
                }
            }
        }

        // Methode 3: Suche nach Seitenzahl-Links (nächste Seite)
        if (!nextButton) {
            const targetPage = currentPage + 1;
            const pageLinks = document.querySelectorAll('a[href*="seite:"]');
            for (const link of pageLinks) {
                const href = link.getAttribute('href');
                if (href && href.includes(`seite:${targetPage}`)) {
                    nextButton = link;
                    break;
                }
            }
        }

        if (nextButton) {
            const href = nextButton.getAttribute('href');

            console.log(`${SCRIPT_PREFIX} Next-Button href:`, href);

            if (href) {
                console.log(`${SCRIPT_PREFIX} ✅ Navigiere zur nächsten Seite: ${href}`);

                // WICHTIG: State speichern vor Navigation
                const settings = loadSettings();
                saveCrawlState({
                    isActive: true,
                    currentPage: currentPage + 1,
                    allTopDeals: allTopDeals,
                    apiKey: settings.apiKey,
                    searchContext: settings.searchContext,
                    topX: settings.topX,
                    model: settings.model
                });

                window.location.href = href;
                return true;
            } else {
                console.log(`${SCRIPT_PREFIX} ❌ Next-Button hat keine href`);
            }
        }

        console.log(`${SCRIPT_PREFIX} 🛑 Keine weitere Seite verfügbar - beende Crawl`);
        return false;
    }

    // ==================== HAUPT-FUNKTIONEN ====================

    async function startDealFinder() {
        const apiKey = document.getElementById('ka-api-key').value.trim();
        const searchContext = document.getElementById('ka-search-context').value.trim();
        const topX = parseInt(document.getElementById('ka-top-x').value);
        const model = document.querySelector('input[name="ka-model"]:checked')?.value || 'flash';

        if (!apiKey) {
            alert('Bitte gib deinen Gemini API Key ein!');
            return;
        }

        if (!searchContext) {
            alert('Bitte gib einen Suchkontext ein!');
            return;
        }

        if (topX < 1 || topX > 10) {
            alert('Top-X muss zwischen 1 und 10 liegen!');
            return;
        }

        saveSettings({ apiKey, searchContext, topX, model });

        // Reset state for fresh run
        currentPage = 1;
        allTopDeals = [];
        isRunning = true;
        isPaused = false;
        shouldStop = false;
        document.getElementById('ka-start-btn').style.display = 'none';
        document.getElementById('ka-pause-btn').style.display = 'block';
        document.getElementById('ka-stop-btn').style.display = 'block';
        document.getElementById('ka-api-key').disabled = true;
        document.getElementById('ka-search-context').disabled = true;
        document.getElementById('ka-top-x').disabled = true;

        try {
            await processCurrentPage(apiKey, searchContext, topX, model);
        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Fehler:`, error);
            updateProgress(`❌ Fehler: ${error.message}`, 0);
            resetUI();
        }
    }

    function pauseDealFinder() {
        isPaused = true;
        document.getElementById('ka-pause-btn').textContent = '▶ Fortsetzen';
        document.getElementById('ka-pause-btn').style.background = '#28a745';
        document.getElementById('ka-pause-btn').onclick = resumeDealFinder;
        updateProgress('⏸ Pausiert - Klicke Fortsetzen...', 50);
    }

    function resumeDealFinder() {
        isPaused = false;
        document.getElementById('ka-pause-btn').textContent = '⏸ Pause';
        document.getElementById('ka-pause-btn').style.background = '#ffc107';
        document.getElementById('ka-pause-btn').onclick = pauseDealFinder;
    }

    function stopDealFinder() {
        shouldStop = true;
        clearCrawlState(); // State löschen wenn User stoppt
        updateProgress('⏹ Stoppe nach aktueller Seite...', 95);
    }

    async function processCurrentPage(apiKey, searchContext, topX, model) {
        // Warte auf Resume wenn pausiert
        while (isPaused) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (shouldStop) {
            await finishDealFinder();
            return;
        }

        // ERST SCROLLEN - dann Anzeigen finden!
        updateProgress(`📋 Seite ${currentPage}: Lade alle Anzeigen...`, 10);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // JETZT Anzeigen finden (nach Scrolling!)
        updateProgress(`📋 Seite ${currentPage}: Sammle Anzeigen...`, 15);

        const selectors = findCurrentSelectors();
        if (!selectors) {
            throw new Error('Keine Anzeigen gefunden');
        }

        const allAds = Array.from(selectors.adEntries);
        console.log(`${SCRIPT_PREFIX} ${allAds.length} Anzeigen gefunden (nach Scrolling)`);

        updateProgress(`📋 Seite ${currentPage}: Sammle Basis-Daten...`, 20);
        const adsData = allAds.map(ad => extractBasicInfo(ad));

        updateProgress(`📋 Seite ${currentPage}: Lade Details (0/${allAds.length})...`, 30);

        let completedCount = 0;
        let currentBatchSize = INITIAL_BATCH_SIZE;

        for (let i = 0; i < adsData.length; i += currentBatchSize) {
            if (shouldStop) break;

            const batch = adsData.slice(i, Math.min(i + currentBatchSize, adsData.length));
            const promises = batch.map((adData, batchIndex) => {
                const index = i + batchIndex;
                return fetchFullDescription(adData.url).then(result => {
                    completedCount++;
                    const progress = 30 + (completedCount / allAds.length) * 40;
                    updateProgress(`📋 Seite ${currentPage}: Lade Details (${completedCount}/${allAds.length})...`, progress);
                    adsData[index].description = result.description;
                });
            });

            await Promise.all(promises);
        }

        if (shouldStop) {
            await finishDealFinder();
            return;
        }

        // AI Bewertung
        updateProgress(`🤖 Seite ${currentPage}: AI analysiert Angebote...`, 75);
        console.log(`${SCRIPT_PREFIX} Sende ${adsData.length} Anzeigen an Gemini ${GEMINI_MODELS[model].name}...`);

        const aiResult = await callGeminiAPI(adsData, searchContext, topX, apiKey, model);

        if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
            console.log(`${SCRIPT_PREFIX} AI hat ${aiResult.topDeals.length} Top-Deals gefunden`);
            allTopDeals.push(...aiResult.topDeals.map(deal => ({
                ...deal,
                page: currentPage
            })));
            updateProgress(`✅ Seite ${currentPage}: ${aiResult.topDeals.length} Top-Deals gefunden!`, 90);

            // Update Live Ranking
            allTopDeals.sort((a, b) => (b.originalIndex || 0) - (a.originalIndex || 0));
            updateLiveRanking();
        }

        await new Promise(resolve => setTimeout(resolve, 1500));

        if (!shouldStop && goToNextPage()) {
            currentPage++;
        } else {
            await finishDealFinder();
        }
    }

    async function finishDealFinder() {
        updateProgress('📊 Erstelle finale Ranking-Liste...', 95);

        // Crawl-State löschen (Crawl ist beendet)
        clearCrawlState();

        if (allTopDeals.length === 0) {
            updateProgress('❌ Keine Deals gefunden!', 100);
            alert('Keine Top-Deals gefunden! Versuche andere Suchkriterien.');
            resetUI();
            return;
        }

        // Results speichern (persistent)
        saveResults({
            deals: allTopDeals,
            pages: currentPage,
            timestamp: new Date().toLocaleString('de-DE')
        });

        // Markdown generieren
        const markdown = generateMarkdown(allTopDeals, currentPage);

        // Auch Plain Text für Legacy
        let rankingText = `🏆 KLEINANZEIGEN DEAL FINDER - FINALE RANKING 🏆\n`;
        rankingText += `Gefunden: ${allTopDeals.length} Top-Deals\n`;
        rankingText += `Analysierte Seiten: ${currentPage}\n`;
        rankingText += `Erstellt: ${new Date().toLocaleString('de-DE')}\n`;
        rankingText += `${'='.repeat(80)}\n\n`;

        allTopDeals.forEach((deal, index) => {
            rankingText += `📍 RANG ${index + 1} (Seite ${deal.page}):\n`;
            rankingText += `Titel: ${deal.title || 'Unbekannt'}\n`;
            rankingText += `Preis: ${deal.price || 'Unbekannt'}\n`;
            rankingText += `Begründung: ${deal.reasoning || 'Keine Begründung'}\n`;
            rankingText += `Beschreibung: ${deal.description || 'Keine Beschreibung verfügbar'}\n`;
            rankingText += `URL: ${deal.url || 'Keine URL'}\n`;
            rankingText += `\n${'-'.repeat(80)}\n\n`;
        });

        console.log(`${SCRIPT_PREFIX} Finale Ranking:\n`, rankingText);

        updateProgress(`✅ ${allTopDeals.length} Deals gespeichert!`, 100);

        // Switch zu Results View
        switchToResultsView();
        resetUI();
    }

    function resetUI() {
        isRunning = false;
        isPaused = false;
        shouldStop = false;
        const startBtn = document.getElementById('ka-start-btn');
        const pauseBtn = document.getElementById('ka-pause-btn');
        const stopBtn = document.getElementById('ka-stop-btn');
        const apiKeyInput = document.getElementById('ka-api-key');
        const searchInput = document.getElementById('ka-search-context');
        const topXInput = document.getElementById('ka-top-x');

        if (startBtn) startBtn.style.display = 'block';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        if (apiKeyInput) apiKeyInput.disabled = false;
        if (searchInput) searchInput.disabled = false;
        if (topXInput) topXInput.disabled = false;
    }

    // ==================== INITIALISIERUNG ====================

    function createDealFinderButton() {
        const buttonId = 'ka-dealfinder-btn';
        if (document.getElementById(buttonId)) return;

        const button = document.createElement('button');
        button.id = buttonId;
        button.innerHTML = '🔍 Deal Finder';
        button.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 99999;
            padding: 14px 20px;
            background: linear-gradient(135deg, #86a542 0%, #2d2d2d 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            font-size: 16px;
            font-weight: bold;
            transition: all 0.3s;
        `;

        button.addEventListener('click', openModal);
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 7px 20px rgba(0,0,0,0.4)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
        });

        document.body.appendChild(button);
        console.log(`${SCRIPT_PREFIX} Deal Finder Button erstellt`);
    }

    async function init() {
        try {
            console.log(`${SCRIPT_PREFIX} Script gestartet`);

            if (document.readyState === 'loading') {
                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
            }

            // Warte auf Suchergebnisse (wie im originalen Skript)
            try {
                await waitForElement('article[data-adid], #srchrslt-adtable', 10000);

                await new Promise(resolve => setTimeout(resolve, 1500));
                createModal();
                createDealFinderButton();

                // ========== CRAWL-STATE WIEDERHERSTELLUNG ==========
                const crawlState = loadCrawlState();

                // Results nur löschen wenn kein aktiver Crawl (Seitenneuladen)
                if (!crawlState) {
                    // Kein aktiver Crawl -> normale Session, Results bleiben
                    console.log(`${SCRIPT_PREFIX} Normale Session - Results bleiben erhalten`);
                } else {
                    console.log(`${SCRIPT_PREFIX} Aktiver Crawl wird fortgesetzt`);
                }

                if (crawlState && crawlState.isActive) {
                    console.log(`${SCRIPT_PREFIX} 🔄 Crawl-State gefunden - setze fort ab Seite ${crawlState.currentPage}`);

                    // State wiederherstellen
                    currentPage = crawlState.currentPage;
                    allTopDeals = crawlState.allTopDeals || [];
                    isRunning = true;

                    // Sidepanel öffnen
                    openModal();

                    // UI in "Running"-Modus setzen
                    await new Promise(resolve => setTimeout(resolve, 500)); // Kurze Verzögerung für DOM
                    document.getElementById('ka-start-btn').style.display = 'none';
                    document.getElementById('ka-pause-btn').style.display = 'block';
                    document.getElementById('ka-stop-btn').style.display = 'block';
                    document.getElementById('ka-api-key').disabled = true;
                    document.getElementById('ka-search-context').disabled = true;
                    document.getElementById('ka-top-x').disabled = true;

                    // Live-Ranking aktualisieren
                    updateLiveRanking();

                    // Crawler fortsetzen
                    try {
                        await processCurrentPage(crawlState.apiKey, crawlState.searchContext, crawlState.topX, crawlState.model || 'flash');
                    } catch (error) {
                        console.error(`${SCRIPT_PREFIX} Fehler beim Fortsetzen:`, error);
                        updateProgress(`❌ Fehler: ${error.message}`, 0);
                        clearCrawlState();
                        resetUI();
                    }
                }
            } catch (error) {
                console.log(`${SCRIPT_PREFIX} Keine Anzeigenliste gefunden, versuche später erneut.`);
                setTimeout(init, 3000);
            }

        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Initialisierungsfehler:`, error);
            setTimeout(init, 3000);
        }
    }

    init();

})();
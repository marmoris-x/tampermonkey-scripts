// ==UserScript==
// @name         Marketplace Deal Finder
// @namespace    http://tampermonkey.net/
// @version      29.0
// @description  Automatic AI-powered deal finder for Willhaben & Kleinanzeigen with live ranking and pause function. Multi-page crawling with Gemini AI analysis.
// @author       marmoris
// @match        https://www.willhaben.at/iad/kaufen-und-verkaufen/*
// @match        https://www.kleinanzeigen.de/s-*
// @match        https://www.kleinanzeigen.de/z-*
// @icon         https://i.imgur.com/oQmtRjQ.png
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      willhaben.at
// @connect      kleinanzeigen.de
// @connect      generativelanguage.googleapis.com
// @noframes
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Marketplace%20Deal%20Finder.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Marketplace%20Deal%20Finder.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ==================== SITE DETECTION ====================

    const IS_WH = window.location.hostname.includes('willhaben.at');
    const P = IS_WH ? 'wh' : 'ka';
    const SITE_NAME = IS_WH ? 'WILLHABEN' : 'KLEINANZEIGEN';
    const SCRIPT_PREFIX = `[${IS_WH ? 'WH' : 'KA'}-DealFinder V29.0]`;
    const BTN_GRADIENT = IS_WH
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : 'linear-gradient(135deg, #86a542 0%, #2d2d2d 100%)';

    const INITIAL_BATCH_SIZE = 8;
    const MAX_RETRIES = 2;
    const RATE_LIMIT_MAX_RETRIES = 5;
    const DESCRIPTION_PREVIEW_LENGTH = 150;
    const SETTINGS_VERSION = 1;
    const MAX_CACHE_SIZE = 100;
    const REQUEST_TIMEOUT = 15000; // 15 seconds for general requests
    const GEMINI_API_TIMEOUT = 60000; // 60 seconds for Gemini API
    const RETRY_BASE_DELAY = 2000; // 2 seconds
    const RATE_LIMIT_BASE_DELAY = 5000; // 5 seconds
    const MAX_RATE_LIMIT_DELAY = 300000; // 5 minutes
    const RE_RANK_MAX_DEALS = 30; // Maximum number of deals to send for global re-ranking

<<<<<<< Updated upstream
=======
    // Regex constants for performance (avoid repeated instantiation)
    const SHIPPING_REGEX = /versand|shipping|porto|lieferung/i;
    const WHITESPACE_REGEX_G = /\s/g;
    const THOUSAND_DOT_REGEX_G = /\./g;
    const COMMA_REGEX_G = /,/g;
    const DECIMAL_NUMBER_REGEX = /(\d+(?:\.\d+)?)/;
    // UI and timing constants
    const PAUSE_POLL_INTERVAL = 500; // ms between pause loop checks
    const JITTER_FACTOR = 0.2; // +0‑20% jitter multiplier
    const MIN_TITLE_LENGTH = 5; // minimum characters for valid title
    // Page increment constants for resume logic
    const SAME_PAGE_INCREMENT = 0;
    const NEW_PAGE_INCREMENT = 1;
    // Deal property keys for type-safe access
    const DEAL_KEYS = {
        URL: 'url',
        TITLE: 'title',
        PRICE: 'price',
        DESCRIPTION: 'description',
        SCORE: 'score',
        REASON: 'reason',
        PAGE: 'page'
    };

>>>>>>> Stashed changes
    // Unit 1: Fixed model IDs — add/remove/rename entries here; UI auto-updates
    const GEMINI_MODELS = {
        flash: {
            id: 'gemini-2.0-flash',
            name: 'Gemini 2.0 Flash',
            url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            icon: '⚡', label: 'Flash', desc: 'Schnell & effizient'
        },
        pro: {
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
            icon: '🧠', label: 'Pro', desc: 'Maximum Intelligenz'
        },
        nano: {
            id: 'gemini-2.0-flash-lite',
            name: 'Gemini Flash Lite',
            url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
            icon: '💡', label: 'Lite', desc: 'Sparsam & schnell'
        }
    };
    // Model key constants for type safety
    const MODEL = {
        FLASH: 'flash',
        PRO: 'pro',
        NANO: 'nano'
    };

    // Global state
    let isRunning = false;
    let isPaused = false;
    let shouldStop = false;
    let captchaPaused = false;
    let allTopDeals = [];
    let currentPage = 1;
    let activeRequests = new Set(); // Set for O(1) add/delete operations
    let descriptionCache = new Map(); // LRU cache for descriptions (max size MAX_CACHE_SIZE)
    let initRetries = 0;
    let cachedSettings = null;
    const MAX_INIT_RETRIES = 5;

    // Unit 2: XSS escaping
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Unit 3: Score validation helper
    function isValidScore(score) {
<<<<<<< Updated upstream
        const num = Number(score);
        return Number.isFinite(num);
=======
        return getValidScore(score) !== null;
    }

    // Parse price string to numeric value (supports European/international formats)
    function parsePriceText(priceStr) {
        if (!priceStr || typeof priceStr !== 'string') return null;
        // Remove spaces (thousand separators)
        let normalized = priceStr.replace(WHITESPACE_REGEX_G, '');
        // Determine decimal separator
        const hasComma = normalized.includes(',');
        const hasDot = normalized.includes('.');
        if (hasComma) {
            // European format: dots are thousand separators, comma is decimal
            normalized = normalized.replace(THOUSAND_DOT_REGEX_G, '');
            normalized = normalized.replace(COMMA_REGEX_G, '.');
        } else if (hasDot) {
            // International format: dots could be thousand separators or decimal
            // If multiple dots, assume thousand separators except last dot
            const parts = normalized.split('.');
            if (parts.length > 1) {
                normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
            }
        }
        const match = normalized.match(DECIMAL_NUMBER_REGEX);
        const parsed = match ? parseFloat(match[1]) : null;
        debugLog(`Price parsing: "${priceStr}" -> normalized "${normalized}" -> ${parsed}`);
        return parsed;
    }

    // Unit 1: Helper to sort deals by validated score
    function sortDealsByScore(deals) {
        // Sort copy with single validation per deal
        return deals.slice().sort((a, b) => (getValidScore(b.score) ?? 0) - (getValidScore(a.score) ?? 0));
    }

    // Helper to check if text consists only of a price (e.g., "12,50 €" or "350 € VB")
    function isPriceOnlyText(text) {
        return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
    }

    // Wait while paused, respecting stop signal
    async function waitIfPaused() {
        while (isPaused && !shouldStop) {
            await new Promise(r => setTimeout(r, PAUSE_POLL_INTERVAL));
        }
    }

    // Create a Set from array by extracting a key
    function extractSet(arr, key) {
        return new Set(arr.map(item => item[key]));
    }

    // Add positive jitter to a base value (percent as decimal, e.g., 0.2 for +0‑20%)
    function addJitter(base, percent) {
        return base * (1 + Math.random() * percent);
    }

    // Normalize URL by removing hash fragment for comparison purposes
    function normalizeUrl(url) {
        if (!url) return url;
        return url.split('#')[0];
>>>>>>> Stashed changes
    }

    // ==================== STORAGE ====================

    const DEFAULT_SETTINGS = {
        version: SETTINGS_VERSION,
        apiKey: '',
        searchContext: '',
        topX: 3,
        model: MODEL.FLASH,
        modelMapping: {
            [MODEL.FLASH]: GEMINI_MODELS[MODEL.FLASH].id,
            [MODEL.PRO]: GEMINI_MODELS[MODEL.PRO].id,
            [MODEL.NANO]: GEMINI_MODELS[MODEL.NANO].id
        },
        maxPages: 10
    };

    function saveSettings(settings) {
        console.log(`${SCRIPT_PREFIX} saveSettings: Saving:`, settings);
        GM_setValue(`${P}_dealfinder_settings`, JSON.stringify(settings));
        // Deep copy modelMapping to prevent cache mutation
        cachedSettings = {
            ...settings,
            modelMapping: { ...(settings.modelMapping || DEFAULT_SETTINGS.modelMapping) }
        };
    }

    function loadSettings() {
        if (cachedSettings !== null) {
            // Return deep copy to prevent mutation of cached modelMapping
            return {
                ...cachedSettings,
                modelMapping: { ...(cachedSettings.modelMapping || DEFAULT_SETTINGS.modelMapping) }
            };
        }
        const saved = GM_getValue(`${P}_dealfinder_settings`, null);
        if (!saved) {
            console.log(`${SCRIPT_PREFIX} loadSettings: No saved settings, returning defaults`);
            // Deep copy DEFAULT_SETTINGS including modelMapping
            cachedSettings = {
                ...DEFAULT_SETTINGS,
                modelMapping: { ...DEFAULT_SETTINGS.modelMapping }
            };
            return {
                ...cachedSettings,
                modelMapping: { ...cachedSettings.modelMapping }
            };
        }
        try {
            const loaded = JSON.parse(saved);
            console.log(`${SCRIPT_PREFIX} loadSettings: Loaded raw:`, loaded);
            // Migrate: if model is a full ID (not a slot key), reset to 'flash'
            if (loaded.model && !GEMINI_MODELS[loaded.model]) {
                loaded.model = MODEL.FLASH;
            }
            const merged = Object.assign({}, DEFAULT_SETTINGS, loaded);
            console.log(`${SCRIPT_PREFIX} loadSettings: Merged settings:`, merged);
            // Deep copy modelMapping to prevent cache mutation
            cachedSettings = {
                ...merged,
                modelMapping: { ...(merged.modelMapping || DEFAULT_SETTINGS.modelMapping) }
            };
            return {
                ...cachedSettings,
                modelMapping: { ...cachedSettings.modelMapping }
            };
        } catch (e) {
            console.warn(SCRIPT_PREFIX + ' Corrupted settings storage:', saved);
            GM_setValue(`${P}_dealfinder_settings`, null);
            // Deep copy DEFAULT_SETTINGS including modelMapping
            cachedSettings = {
                ...DEFAULT_SETTINGS,
                modelMapping: { ...DEFAULT_SETTINGS.modelMapping }
            };
            return {
                ...cachedSettings,
                modelMapping: { ...cachedSettings.modelMapping }
            };
        }
    }

    function saveCrawlState(state) {
        GM_setValue(`${P}_dealfinder_crawl_state`, JSON.stringify(state));
        console.log(`${SCRIPT_PREFIX} Crawl-State gespeichert:`, state);
    }

    function loadCrawlState() {
        const saved = GM_getValue(`${P}_dealfinder_crawl_state`, null);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.warn(SCRIPT_PREFIX + ' Corrupted crawl state:', saved);
            GM_setValue(`${P}_dealfinder_crawl_state`, null);
            return null;
        }
    }

    function clearCrawlState() {
        GM_setValue(`${P}_dealfinder_crawl_state`, null);
        console.log(`${SCRIPT_PREFIX} Crawl-State gelöscht`);
    }

    function saveResults(results) {
        GM_setValue(`${P}_dealfinder_results`, JSON.stringify(results));
        console.log(`${SCRIPT_PREFIX} Results gespeichert:`, results.deals.length, 'Deals');
    }

    function loadResults() {
        const saved = GM_getValue(`${P}_dealfinder_results`, null);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.warn(SCRIPT_PREFIX + ' Corrupted results storage:', saved);
            GM_setValue(`${P}_dealfinder_results`, null);
            return null;
        }
    }

    function clearResults() {
        GM_setValue(`${P}_dealfinder_results`, null);
        console.log(`${SCRIPT_PREFIX} Results gelöscht`);
    }

    function saveAvailableModels(models) {
        GM_setValue(`${P}_available_models`, JSON.stringify(models));
    }

    function loadAvailableModels() {
        const saved = GM_getValue(`${P}_available_models`, null);
        if (!saved) return null;
        try { return JSON.parse(saved); } catch (e) { return null; }
    }

    // ==================== UI ====================

    function renderSettingsView() {
        const settings = loadSettings();
        const savedResults = loadResults();

        // UX-04: Pre-fill searchContext from URL keyword if empty
        let autoContext = settings.searchContext;
        if (!autoContext) {
            const urlParams = new URLSearchParams(window.location.search);
            const keyword = urlParams.get('keyword');
            if (keyword) {
                autoContext = keyword;
            } else if (!IS_WH) {
                const pathMatch = window.location.pathname.match(/\/s-([^/]+)/);
                if (pathMatch) autoContext = decodeURIComponent(pathMatch[1].replace(/-/g, ' '));
            }
        }

        // Handle both old locale-string timestamps and new ISO timestamps
        let savedTs = '';
        if (savedResults && savedResults.timestamp) {
            const ts = savedResults.timestamp;
            savedTs = ts.includes('T') ? new Date(ts).toLocaleString('de-DE') : ts;
        }

        return `
            <div id="${P}-settings-view" style="padding: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2 style="margin: 0; color: #333; font-size: 20px;">🔍 Deal Finder</h2>
                    <button id="${P}-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">×</button>
                </div>

                ${savedResults ? `
                <div style="background: #e8f5e9; padding: 12px; border-radius: 4px; margin-bottom: 18px; border-left: 3px solid #4caf50;">
                    <div style="font-size: 13px; color: #2e7d32; font-weight: 600; margin-bottom: 6px;">
                        ✅ ${savedResults.deals.length} gespeicherte Deals
                    </div>
                    <div style="font-size: 11px; color: #558b2f;">
                        Analysierte Seiten: ${savedResults.pages} | ${savedTs}
                    </div>
                    <button id="${P}-show-results-btn" style="
                        width: 100%; margin-top: 8px; padding: 8px; background: #4caf50;
                        color: white; border: none; border-radius: 4px; font-size: 12px;
                        font-weight: 600; cursor: pointer;
                    ">📊 Ergebnisse anzeigen</button>
                </div>
                ` : ''}

                <div style="margin-bottom: 18px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        Gemini API Key
                    </label>
                    <input type="password" id="${P}-api-key" placeholder="AIza..."
                        value="${escapeHTML(settings.apiKey)}"
                        style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
                    <small style="color: #888; font-size: 11px;">
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #667eea;">Kostenlosen Key holen</a>
                    </small>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        Suchkontext
                    </label>
                    <textarea id="${P}-search-context" placeholder="z.B. Gaming PC RTX 3060, Neupreis €800-1000"
                        style="width: 100%; height: 70px; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; resize: vertical; box-sizing: border-box; font-family: inherit;">${escapeHTML(autoContext)}</textarea>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        AI-Picks pro Seite
                    </label>
                    <input type="number" id="${P}-top-x" min="1" max="10" value="${settings.topX}"
                        style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
                    <small style="color: #888; font-size: 11px;">Anzahl der besten Deals, die die AI pro Seite auswählt (1–10)</small>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        Max. Seiten
                    </label>
                    <input type="number" id="${P}-max-pages" min="1" max="100" value="${settings.maxPages}"
                        style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">
                        AI Model
                    </label>
                    <div id="${P}-model-area"></div>
                </div>

                <div id="${P}-progress-container" style="display: none; margin-bottom: 18px; padding: 12px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #667eea;">
                    <div id="${P}-progress-text" style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 12px;">
                        Bereit...
                    </div>
                    <div style="background: #e0e0e0; border-radius: 4px; height: 6px; overflow: hidden;">
                        <div id="${P}-progress-bar" style="background: #667eea; height: 100%; width: 0%; transition: width 0.3s;"></div>
                    </div>
                </div>

                <div id="${P}-live-ranking" style="display: none; margin-bottom: 18px; padding: 12px; background: #fff8e1; border-radius: 4px; border-left: 3px solid #ffc107;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">🏆 Live Top-Deals</h3>
                    <div id="${P}-live-ranking-content" style="font-size: 12px; color: #555;"></div>
                </div>

                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="${P}-start-btn" style="
                        flex: 1; min-width: 100px; padding: 10px 16px; background: #28a745;
                        color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer;
                    ">▶ Start</button>
                    <button id="${P}-pause-btn" style="
                        flex: 1; min-width: 100px; padding: 10px 16px; background: #ffc107;
                        color: #333; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; display: none;
                    ">⏸ Pause</button>
                    <button id="${P}-stop-btn" style="
                        flex: 1; min-width: 100px; padding: 10px 16px; background: #dc3545;
                        color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; display: none;
                    ">⏹ Stopp</button>
                </div>
            </div>
        `;
    }

    function generateMarkdown(deals, pages, timestamp = new Date().toISOString()) {
        let md = `# 🏆 ${SITE_NAME} DEAL FINDER - FINALE RANKING\n\n`;
        md += `**Gefunden:** ${deals.length} Top-Deals  \n`;
        md += `**Analysierte Seiten:** ${pages}  \n`;
        md += `**Erstellt:** ${timestamp}\n\n`;

        deals.forEach((deal, index) => {
            const rank = index + 1;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${rank}`;
            md += `## ${medal} RANG ${rank} (Seite ${deal.page})\n\n`;
            md += `**Titel:** ${deal.title || 'Unbekannt'}  \n`;
            md += `**Preis:** ${deal.price || 'Unbekannt'}  \n`;
            if (deal.score !== undefined && isValidScore(deal.score)) md += `**Score:** ${deal.score}/100  \n`;
            md += `**Begründung:** ${deal.reasoning || 'Keine Begründung'}  \n\n`;
            if (deal.description) {
                md += `**Beschreibung:**\n> ${deal.description.substring(0, DESCRIPTION_PREVIEW_LENGTH)}${deal.description.length > DESCRIPTION_PREVIEW_LENGTH ? '...' : ''}\n\n`;
            }
            md += `**Link:** [Anzeige öffnen](${deal.url})\n\n`;
        });
        return md;
    }

    function renderResultsView(dealsToShow = null) {
        const deals = dealsToShow || allTopDeals;

        const dealsHTML = deals.map((deal, index) => {
            const safeUrl = (deal.url && deal.url.startsWith('https://')) ? deal.url : '#';
            const safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
            const scoreBar = safeScore !== null ? `
                <div style="margin-bottom: 6px;">
                    <div style="font-size: 10px; color: #888; margin-bottom: 2px;">Score: ${safeScore}/100</div>
                    <div style="background: #e0e0e0; border-radius: 4px; height: 4px; overflow: hidden;">
                        <div style="background: ${safeScore >= 70 ? '#28a745' : safeScore >= 40 ? '#ffc107' : '#dc3545'}; height: 100%; width: ${safeScore}%;"></div>
                    </div>
                </div>` : '';
            return `
            <div style="padding: 15px; background: ${index === 0 ? '#fff8e1' : '#f8f9fa'}; border-radius: 4px; margin-bottom: 12px; border-left: 3px solid ${index === 0 ? '#ffc107' : index === 1 ? '#28a745' : index === 2 ? '#17a2b8' : '#6c757d'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="font-weight: 700; color: #333; font-size: 14px;">
                        ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`} ${escapeHTML(deal.title)}
                    </div>
                    <div style="font-size: 11px; color: #888; white-space: nowrap; margin-left: 8px;">S.${deal.page}</div>
                </div>
                <div style="font-weight: 600; color: #28a745; font-size: 15px; margin-bottom: 8px;">${escapeHTML(deal.price)}</div>
                ${scoreBar}
                <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-style: italic;">💡 ${escapeHTML(deal.reasoning || 'Keine Begründung verfügbar')}</div>
                ${deal.description ? `
                <div style="font-size: 11px; color: #555; line-height: 1.4; margin-bottom: 8px; max-height: 60px; overflow: hidden;">
                    ${escapeHTML(deal.description.substring(0, DESCRIPTION_PREVIEW_LENGTH))}${deal.description.length > DESCRIPTION_PREVIEW_LENGTH ? '...' : ''}
                </div>` : ''}
                <a href="${escapeHTML(safeUrl)}" target="_blank" style="font-size: 11px; color: #667eea; text-decoration: none;">→ Anzeige öffnen</a>
            </div>
        `;
        }).join('');

        return `
            <div id="${P}-results-view" style="padding: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333; font-size: 20px;">🏆 Top-Deals</h2>
                    <button id="${P}-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">×</button>
                </div>

                <div style="background: #667eea; color: white; padding: 12px; border-radius: 4px; margin-bottom: 20px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${deals.length}</div>
                    <div style="font-size: 12px;">Top-Deals gefunden</div>
                </div>

                <div style="margin-bottom: 15px;">${dealsHTML}</div>

                <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
                    <button id="${P}-export-markdown-btn" style="
                        flex: 1; padding: 10px 12px; background: #28a745; color: white;
                        border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;
                    ">📋 Markdown</button>
                    <button id="${P}-export-json-btn" style="
                        flex: 1; padding: 10px 12px; background: #17a2b8; color: white;
                        border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;
                    ">📄 JSON</button>
                    <button id="${P}-export-csv-btn" style="
                        flex: 1; padding: 10px 12px; background: #6f42c1; color: white;
                        border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;
                    ">📊 CSV</button>
                    <button id="${P}-clear-results-btn" style="
                        padding: 10px 12px; background: #dc3545; color: white;
                        border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;
                    ">🗑️</button>
                </div>

                <button id="${P}-back-to-settings" style="
                    width: 100%; padding: 10px 16px; background: #6c757d; color: white;
                    border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer;
                ">← Zurück zu Einstellungen</button>
            </div>
        `;
    }

    function updateLiveRanking() {
        const container = document.getElementById(`${P}-live-ranking`);
        const content = document.getElementById(`${P}-live-ranking-content`);
        if (!container || !content) return;
        if (allTopDeals.length === 0) { container.style.display = 'none'; return; }

        const settings = loadSettings();
        container.style.display = 'block';
        const topItems = [...allTopDeals]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, Math.min(3, settings.topX));
        content.innerHTML = topItems.map((deal, idx) => {
            const safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
            return `
            <div style="margin-bottom: 8px; padding-bottom: 8px; ${idx < topItems.length - 1 ? 'border-bottom: 1px solid #ffe082;' : ''}">
                <div style="font-weight: 600; color: #333;">${idx + 1}. ${escapeHTML(deal.title)}</div>
                <div style="color: #28a745; font-weight: 600;">${escapeHTML(deal.price)}</div>
                ${safeScore !== null ? `<div style="font-size: 10px; color: #888;">Score: ${safeScore}/100</div>` : ''}
                <div style="font-size: 10px; color: #888;">Seite ${deal.page}</div>
            </div>
        `}).join('');
    }

    function createModal() {
        const modalId = `${P}-dealfinder-modal`;
        if (document.getElementById(modalId)) return;
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            display: none; position: fixed; top: 0; right: 0; width: 400px; height: 100vh;
            background: white; z-index: 999999; box-shadow: -5px 0 20px rgba(0,0,0,0.2);
            overflow-y: auto; transition: transform 0.3s ease;
        `;
        modal.innerHTML = renderSettingsView();
        document.body.appendChild(modal);
        attachEventListeners();
        restoreModelSelect();
    }

    function attachEventListeners() {
        const startBtn = document.getElementById(`${P}-start-btn`);
        const pauseBtn = document.getElementById(`${P}-pause-btn`);
        const stopBtn = document.getElementById(`${P}-stop-btn`);
        const closeBtn = document.getElementById(`${P}-close-btn-x`);
        const showResultsBtn = document.getElementById(`${P}-show-results-btn`);
        const apiKeyInput = document.getElementById(`${P}-api-key`);
        const searchContextInput = document.getElementById(`${P}-search-context`);

        if (startBtn) startBtn.addEventListener('click', () => {
            startDealFinder().catch(error => {
                console.error(`${SCRIPT_PREFIX} Unhandled error in startDealFinder:`, error);
                updateProgress(`❌ Fehler: ${error.message}`, 0);
                resetUI();
            });
        });
        if (pauseBtn) pauseBtn.addEventListener('click', pauseDealFinder);
        if (stopBtn) stopBtn.addEventListener('click', stopDealFinder);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (showResultsBtn) showResultsBtn.addEventListener('click', showSavedResults);

        // UX-06: auto-save on blur
        if (apiKeyInput) apiKeyInput.addEventListener('blur', () => {
            const s = loadSettings();
            const newKey = apiKeyInput.value.trim();
            if (s.apiKey !== newKey) {
                s.apiKey = newKey;
                saveSettings(s);
            }
        });
        if (searchContextInput) searchContextInput.addEventListener('blur', () => {
            const s = loadSettings();
            const newContext = searchContextInput.value.trim();
            if (s.searchContext !== newContext) {
                s.searchContext = newContext;
                saveSettings(s);
            }
        });

        [startBtn, pauseBtn, stopBtn, showResultsBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('mouseenter', () => btn.style.opacity = '0.9');
                btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
            }
        });
    }

    function showSavedResults() {
        const savedResults = loadResults();
        if (savedResults) switchToResultsView(savedResults.deals);
    }

    function switchToResultsView(deals = null) {
        const modal = document.getElementById(`${P}-dealfinder-modal`);
        if (!modal) return;
        modal.innerHTML = renderResultsView(deals);

        const closeBtn = document.getElementById(`${P}-close-btn-x`);
        const backBtn = document.getElementById(`${P}-back-to-settings`);
        const exportBtn = document.getElementById(`${P}-export-markdown-btn`);
        const exportJsonBtn = document.getElementById(`${P}-export-json-btn`);
        const exportCsvBtn = document.getElementById(`${P}-export-csv-btn`);
        const clearBtn = document.getElementById(`${P}-clear-results-btn`);

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (backBtn) backBtn.addEventListener('click', switchToSettingsView);
        if (exportBtn) exportBtn.addEventListener('click', exportMarkdown);
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJSON);
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);
        if (clearBtn) clearBtn.addEventListener('click', clearResultsAndGoBack);

        [exportBtn, exportJsonBtn, exportCsvBtn, clearBtn, backBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('mouseenter', () => btn.style.opacity = '0.9');
                btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
            }
        });
    }

    async function exportMarkdown() {
        const savedResults = loadResults();
        if (!savedResults) { alert('Keine Results verfügbar!'); return; }
        const md = generateMarkdown(savedResults.deals, savedResults.pages, savedResults.timestamp);
        try {
            await navigator.clipboard.writeText(md);
            const btn = document.getElementById(`${P}-export-markdown-btn`);
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '✅ Kopiert!';
                setTimeout(() => { btn.textContent = orig; }, 2000);
            }
            console.log(`${SCRIPT_PREFIX} Markdown in Zwischenablage kopiert!`);
        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Clipboard-Fehler:`, error);
            alert('Fehler beim Kopieren. Bitte Fenster fokussieren und nochmal versuchen.');
        }
    }

    function exportJSON() {
        const savedResults = loadResults();
        if (!savedResults) { alert('Keine Results verfügbar!'); return; }
        const blob = new Blob([JSON.stringify(savedResults, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deals-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    }

    function exportCSV() {
        const savedResults = loadResults();
        if (!savedResults) { alert('Keine Results verfügbar!'); return; }
        const header = ['Rang', 'Titel', 'Preis', 'Score', 'Begründung', 'Seite', 'URL'];
        const rows = savedResults.deals.map((d, i) => [
            i + 1,
            `"${(d.title || '').replace(/"/g, '""')}"`,
            `"${(d.price || '').replace(/"/g, '""')}"`,
            d.score !== undefined && Number.isFinite(Number(d.score)) ? d.score : '',
            `"${(d.reasoning || '').replace(/"/g, '""')}"`,
            d.page || '',
            `"${(d.url || '').replace(/"/g, '""')}"`
        ]);
        const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deals-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    }

    function clearResultsAndGoBack() {
        if (confirm('Möchtest du die gespeicherten Results wirklich löschen?')) {
            clearResults();
            switchToSettingsView();
        }
    }

    function switchToSettingsView() {
        if (isRunning) return;
        const modal = document.getElementById(`${P}-dealfinder-modal`);
        if (!modal) return;
        modal.innerHTML = renderSettingsView();
        attachEventListeners();
        restoreModelSelect();
    }

    const SIDEBAR_WIDTH = '400px';

    function openModal() {
        const modal = document.getElementById(`${P}-dealfinder-modal`);
        const floatBtn = document.getElementById(`${P}-dealfinder-btn`);
        if (modal) modal.style.display = 'block';
        if (floatBtn) floatBtn.style.display = 'none';
        document.documentElement.style.transition = 'margin-right 0.3s ease';
        document.documentElement.style.marginRight = SIDEBAR_WIDTH;
    }

    function closeModal() {
        if (isRunning) {
            const btn = document.getElementById(`${P}-close-btn-x`);
            if (btn) {
                btn.style.color = '#dc3545';
                btn.title = 'Crawl läuft – erst stoppen';
                setTimeout(() => { btn.style.color = '#999'; btn.title = ''; }, 1000);
            }
            return;
        }
        const modal = document.getElementById(`${P}-dealfinder-modal`);
        const floatBtn = document.getElementById(`${P}-dealfinder-btn`);
        if (modal) modal.style.display = 'none';
        if (floatBtn) floatBtn.style.display = 'block';
        document.documentElement.style.marginRight = '';
    }

    function updateProgress(text, percentage, type = 'info') {
        const container = document.getElementById(`${P}-progress-container`);
        const progressText = document.getElementById(`${P}-progress-text`);
        const progressBar = document.getElementById(`${P}-progress-bar`);
        if (container) {
            container.style.display = 'block';
            // Update border color based on type
            container.style.borderLeftColor = type === 'error' ? '#dc3545' :
                                            type === 'warning' ? '#ffc107' :
                                            type === 'success' ? '#28a745' :
                                            '#667eea';
        }
        if (progressText) {
            progressText.textContent = text;
            // Color coding for errors/warnings
            progressText.style.color = type === 'error' ? '#dc3545' :
                                     type === 'warning' ? '#ffc107' :
                                     type === 'success' ? '#28a745' :
                                     '#333';
        }
        if (progressBar) {
            progressBar.style.width = percentage + '%';
            progressBar.style.backgroundColor = type === 'error' ? '#dc3545' :
                                              type === 'warning' ? '#ffc107' :
                                              type === 'success' ? '#28a745' :
                                              '#007bff';
            progressBar.style.transition = 'width 0.3s ease, background-color 0.3s ease';
        }
    }

    // Helper for error states
    function showError(message, percentage = 0) {
        updateProgress(`❌ ${message}`, percentage, 'error');
    }

    function showWarning(message, percentage = 0) {
        updateProgress(`⚠️ ${message}`, percentage, 'warning');
    }

    function showSuccess(message, percentage = 100) {
        updateProgress(`✅ ${message}`, percentage, 'success');
    }

    // ==================== SITE-SPECIFIC: Willhaben ====================

    function wh_findCurrentSelectors() {
        const adSelectors = [
            'a[data-testid^="search-result-entry-header-"]',
            'article[data-testid^="search-result-entry-"]',
            '[data-testid*="search-result-entry"]',
        ];
        // Try each selector in priority order, stop at first match
        for (const selector of adSelectors) {
            const adEntries = document.querySelectorAll(selector);
            if (adEntries.length > 0) {
                console.log(`${SCRIPT_PREFIX} Gefunden: ${adEntries.length} Anzeigen (Selector: ${selector})`);
                return { adEntries };
            }
        }
        const uniqueUrls = new Set();
        const uniqueAds = [];
        const urlRegex = /\/iad\/kaufen-und-verkaufen\/.*\/\d+/;
        document.querySelectorAll('a[href*="/iad/kaufen-und-verkaufen/"]').forEach(link => {
            const url = link.href;
            if (url.match(urlRegex) && !uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                // Try to find a parent container that likely contains title and price
                const container = link.closest('article, div[class*="box"], [data-testid*="search-result"], .ad-item, .list-item');
                uniqueAds.push(container || link);
            }
        });
        if (uniqueAds.length > 0) {
            console.log(`${SCRIPT_PREFIX} Gefunden: ${uniqueAds.length} Anzeigen (Fallback-Methode)`);
            return { adEntries: uniqueAds };
        }
        return null;
    }

    function wh_extractBasicInfo(ad) {
        let title = 'Titel nicht verfügbar';
        for (const selector of ['h3', 'h2', '[data-testid*="title"]']) {
            const el = ad.querySelector(selector);
            if (el) {
                const text = el.textContent.trim();
                // Unit 7: only exclude if text STARTS with a price number + € and nothing else
                if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) { title = text; break; }
            }
        }
        let price = 'Preis nicht verfügbar';
        for (const el of ad.querySelectorAll('span, div, p')) {
            const text = el.textContent.trim();
            if ((text.includes('€') || text.includes('EUR')) && text.length < 20 && !text.includes('...')) {
                price = text; break;
            }
        }
        const url = ad.href || ad.querySelector('a[href*="/iad/"]')?.href || 'URL nicht verfügbar';
        return { title, price, url };
    }

    function wh_descSelectors() {
        return [
            '[data-testid="ad-description-Beschreibung"]',
            '[data-testid*="description"]',
            '.ad-description',
            '[class*="description"]'
        ];
    }

    // Unit 4 BUG-03: save currentPage (not +1); resume increments it
    function saveCrawlStateAndNavigate(href, settings) {
        saveCrawlState({
            currentPage,
            currentUrl: window.location.href,
            allTopDeals,
            maxPages: settings.maxPages
        });
        window.location.href = href;
    }

    function wh_goToNextPage(settings) {
        let nextButton = document.querySelector('[data-testid="pagination-bottom-next-button"]');
        if (!nextButton) {
            const targetPage = currentPage + 1;
            for (const btn of document.querySelectorAll('[data-testid*="pagination"] a, nav a')) {
                const text = btn.textContent?.trim();
                const href = btn.getAttribute('href');
                if (text && (
                    text === String(targetPage) ||
                    text.toLowerCase().includes('weiter') ||
                    text.toLowerCase().includes('next') ||
                    text.toLowerCase().includes('nächste') ||
                    text === '›' || text === '>'
                )) {
                    if (!btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true' && href) {
                        nextButton = btn; break;
                    }
                }
            }
        }
        if (nextButton) {
            const isDisabled = nextButton.hasAttribute('disabled');
            const ariaDisabled = nextButton.getAttribute('aria-disabled') === 'true';
            const href = nextButton.getAttribute('href');
            console.log(`${SCRIPT_PREFIX} Next-Button disabled:`, isDisabled, '| aria-disabled:', ariaDisabled, '| href:', href);
            if (!isDisabled && !ariaDisabled && href) {
                // Unit 7: same-URL guard
                try {
                    if (new URL(href, location.href).href === location.href) {
                        console.log(`${SCRIPT_PREFIX} ❌ Next-Button zeigt auf gleiche Seite - übersprungen`);
                    } else {
                        saveCrawlStateAndNavigate(href, settings);
                        return true;
                    }
                } catch (e) {
                    console.warn(`${SCRIPT_PREFIX} Ungültige URL im Next-Button:`, href, e);
                }
            }
            console.log(`${SCRIPT_PREFIX} ❌ Next-Button nicht nutzbar`);
        }
        return false;
    }

    // ==================== SITE-SPECIFIC: Kleinanzeigen ====================

    function ka_findCurrentSelectors() {
        const adSelectors = ['article[data-adid]', 'li.ad-listitem', '.aditem'];
        // Try each selector in priority order, stop at first match
        for (const selector of adSelectors) {
            const adEntries = document.querySelectorAll(selector);
            if (adEntries.length > 0) {
                console.log(`${SCRIPT_PREFIX} Gefunden: ${adEntries.length} Anzeigen (Selector: ${selector})`);
                return { adEntries };
            }
        }
        const uniqueUrls = new Set();
        const uniqueAds = [];
        const urlRegex = /\/s-anzeige\/.*\/\d+/;
        document.querySelectorAll('a[href*="/s-anzeige/"]').forEach(link => {
            const url = link.href;
            if (url.match(urlRegex) && !uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                // Try to find a parent container that likely contains title and price
                const container = link.closest('article, li, .aditem, .ad-listitem, [data-adid]');
                uniqueAds.push(container || link);
            }
        });
        if (uniqueAds.length > 0) {
            console.log(`${SCRIPT_PREFIX} Gefunden: ${uniqueAds.length} Anzeigen (Fallback-Methode)`);
            return { adEntries: uniqueAds };
        }
        return null;
    }

    function ka_extractBasicInfo(ad) {
        let title = 'Titel nicht verfügbar';
        for (const selector of ['h2', 'h3', 'a[class*="ellipsis"]', '[class*="title"]']) {
            const el = ad.querySelector(selector);
            if (el) {
                const text = el.textContent.trim();
<<<<<<< Updated upstream
                if (text.length > 5 && !text.includes('€')) { title = text; break; }
=======
                if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) { title = text; break; }
>>>>>>> Stashed changes
            }
        }
        let price = 'Preis nicht verfügbar';
        for (const el of ad.querySelectorAll('span, div, p, strong')) {
            const text = el.textContent.trim();
            // Unit 7: VB fix — only match standalone VB or price+VB, not arbitrary text containing "VB"
            if ((text.includes('€') || text.includes('EUR') || /^(\d[\d.,]*\s*€?\s*)?VB$/i.test(text.trim())) && text.length < 30 && !text.includes('...')) {
                price = text; break;
            }
        }
        let url = ad.getAttribute('data-href') || ad.href || ad.querySelector('a[href*="/s-anzeige/"]')?.href || 'URL nicht verfügbar';
        // Only prepend domain if URL is a relative path starting with '/'
        if (url && url.startsWith('/')) {
            url = 'https://www.kleinanzeigen.de' + url;
        }
        return { title, price, url };
    }

    function ka_descSelectors() {
        return [
            '#viewad-description-text',
            '.ad-description',
            'div[class*="description"]',
            '[class*="description"]'
        ];
    }

    function ka_goToNextPage(settings) {
        let nextButton = document.querySelector('a[class*="pagination-next"]');
        if (!nextButton) {
            for (const link of document.querySelectorAll('[class*="pagination"] a, nav a, .pagination a')) {
                const text = link.textContent?.trim().toLowerCase();
                const href = link.getAttribute('href');
                if ((text === 'weiter' || text === '>' || text === '›') && href && href.includes('seite:')) {
                    nextButton = link; break;
                }
            }
        }
        if (!nextButton) {
            const targetPage = currentPage + 1;
            for (const link of document.querySelectorAll('a[href*="seite:"]')) {
                const href = link.getAttribute('href');
                if (href && href.includes(`seite:${targetPage}`)) { nextButton = link; break; }
            }
        }
        if (nextButton) {
            const href = nextButton.getAttribute('href');
            console.log(`${SCRIPT_PREFIX} Next-Button href:`, href);
            if (href) {
                // Unit 7: same-URL guard
                try {
                    if (new URL(href, location.href).href === location.href) {
                        console.log(`${SCRIPT_PREFIX} ❌ Next-Button zeigt auf gleiche Seite - übersprungen`);
                        return false;
                    }
                } catch (e) {
                    console.warn(`${SCRIPT_PREFIX} Ungültige URL im Next-Button:`, href, e);
                }
                saveCrawlStateAndNavigate(href, settings);
                return true;
            }
            console.log(`${SCRIPT_PREFIX} ❌ Next-Button hat keine href`);
        }
        return false;
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) { resolve(element); return; }
            let pendingCheck = false;
            let timer;
            const observer = new MutationObserver((mutations, obs) => {
                if (pendingCheck) return;
                pendingCheck = true;
                requestAnimationFrame(() => {
                    pendingCheck = false;
                    const el = document.querySelector(selector);
                    if (el) { clearTimeout(timer); obs.disconnect(); resolve(el); }
                });
            });
            // Unit 8: observe documentElement instead of body
            const root = document.documentElement || document.body;
            if (!root) { reject(new Error('document root not available')); return; }
            observer.observe(root, { childList: true, subtree: true });
            timer = setTimeout(() => { observer.disconnect(); reject(new Error(`Element ${selector} not found`)); }, timeout);
        });
    }

    // ==================== DISPATCHERS ====================

    function findCurrentSelectors() {
        return IS_WH ? wh_findCurrentSelectors() : ka_findCurrentSelectors();
    }

    function extractBasicInfo(ad) {
        return IS_WH ? wh_extractBasicInfo(ad) : ka_extractBasicInfo(ad);
    }

    function fetchFullDescription(url, retryCount = 0) {
        // Unit 4: check cache first
        if (descriptionCache.has(url)) {
            const desc = descriptionCache.get(url);
            // Move to end (LRU) - delete and reinsert to update order
            descriptionCache.delete(url);
            descriptionCache.set(url, desc);
            return Promise.resolve({ success: true, description: desc });
        }
        const descSelectors = IS_WH ? wh_descSelectors() : ka_descSelectors();
        return new Promise((resolve) => {
            const req = GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: REQUEST_TIMEOUT,
                onload: function(response) {
                    activeRequests.delete(req);
                    try {
                        if (response.status >= 200 && response.status < 300) {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(response.responseText, 'text/html');
                            let fullDesc = null;
                            for (const selector of descSelectors) {
                                const element = doc.querySelector(selector);
                                if (element && element.textContent.trim().length > 20) {
                                    fullDesc = element.textContent.replace(/\s+/g, ' ').trim();
                                    break;
                                }
                            }
                            if (fullDesc) {
                                // LRU eviction: remove oldest entry if cache full
                                if (descriptionCache.size >= MAX_CACHE_SIZE) {
                                    const firstKey = descriptionCache.keys().next().value;
                                    descriptionCache.delete(firstKey);
                                }
                                descriptionCache.set(url, fullDesc);
                                resolve({ success: true, description: fullDesc });
                            } else if (retryCount < MAX_RETRIES) {
                                if (shouldStop) {
                                    resolve({ success: false, description: 'Aborted' });
                                    return;
                                }
                                setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000);
                            } else {
                                resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                            }
                        } else if (retryCount < MAX_RETRIES) {
                            if (shouldStop) {
                                resolve({ success: false, description: 'Aborted' });
                                return;
                            }
                            setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000);
                        } else {
                            resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                        }
                    } catch (error) {
                        if (shouldStop) {
                            resolve({ success: false, description: 'Aborted' });
                            return;
                        }
                        if (retryCount < MAX_RETRIES) {
                            setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000);
                        } else {
                            resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                        }
                    }
                },
                onerror: function() {
                    activeRequests.delete(req);
                    if (shouldStop) {
                        resolve({ success: false, description: 'Aborted' });
                        return;
                    }
                    retryCount < MAX_RETRIES
                        ? setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000)
                        : resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                },
                ontimeout: function() {
                    activeRequests.delete(req);
                    if (shouldStop) {
                        resolve({ success: false, description: 'Aborted' });
                        return;
                    }
                    retryCount < MAX_RETRIES
                        ? setTimeout(() => fetchFullDescription(url, retryCount + 1).then(resolve), 1000)
                        : resolve({ success: false, description: 'Beschreibung nicht verfügbar' });
                }
            });
            if (req) activeRequests.add(req);
        });
    }

    function fetchGeminiModels(apiKey) {
        const area = document.getElementById(`${P}-model-area`);
        if (!area) return;
        area.innerHTML = '<small style="color:#aaa;font-size:12px;">Lade Modelle…</small>';

        const req = GM_xmlhttpRequest({
            method: 'GET',
            url: `https://generativelanguage.googleapis.com/v1beta/models`,
            timeout: REQUEST_TIMEOUT,
            headers: { 'x-goog-api-key': apiKey },
            onload: function(response) {
                activeRequests.delete(req);
                try {
                    if (response.status !== 200) {
                        console.error(`${SCRIPT_PREFIX} Models API Fehler:`, response.status, response.responseText);
                        throw new Error(`HTTP ${response.status}: ${response.responseText.substring(0, 120)}`);
                    }
                    const data = JSON.parse(response.responseText);
                    const modelIds = (data.models || [])
                        .filter(m =>
                            Array.isArray(m.supportedGenerationMethods) &&
                            m.supportedGenerationMethods.includes('generateContent') &&
                            m.name.includes('gemini')
                        )
                        .map(m => m.name.replace('models/', ''));
                    if (modelIds.length === 0) throw new Error('Keine Gemini-Modelle gefunden');
                    saveAvailableModels(modelIds);
                    showModelMapper(modelIds);
                } catch (e) {
                    restoreModelSelect();
                    if (area) {
                        const hint = area.querySelector('small');
                        if (hint) hint.textContent = `Fehler: ${e.message}`;
                    }
                    console.error(`${SCRIPT_PREFIX} Modelle laden fehlgeschlagen:`, e);
                }
            },
            onerror: function() {
                activeRequests.delete(req);
                restoreModelSelect();
            },
            ontimeout: function() {
                activeRequests.delete(req);
                restoreModelSelect();
            }
        });
        if (req) activeRequests.add(req);
    }

    function showModelMapper(modelIds) {
        const area = document.getElementById(`${P}-model-area`);
        if (!area) return;
        const settings = loadSettings();
        const mapping = settings.modelMapping || DEFAULT_SETTINGS.modelMapping;

        area.innerHTML = `
            <div style="border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px; background: #fafafa;">
                <div style="font-size: 11px; color: #888; margin-bottom: 10px; font-weight: 600;">Welches Modell steckt hinter…</div>
                ${Object.entries(GEMINI_MODELS).map(([key, m]) => `
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: 600; color: #444; min-width: 70px;">${m.icon} ${m.label}</span>
                        <select id="${P}-map-${key}" style="flex: 1; padding: 5px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; background: white;">
                            ${modelIds.map(id => `<option value="${escapeHTML(id)}" ${(mapping[key] || m.id) === id ? 'selected' : ''}>${escapeHTML(id)}</option>`).join('')}
                        </select>
                    </div>
                `).join('')}
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button id="${P}-map-save" style="flex: 1; padding: 7px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">✓ Speichern</button>
                    <button id="${P}-map-cancel" style="padding: 7px 14px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; cursor: pointer; color: #555;">Abbrechen</button>
                </div>
            </div>
        `;

        // Helper to save current mapping
        function saveModelMapping(showFeedback = false) {
            const s = loadSettings();
            s.modelMapping = s.modelMapping || {};
            Object.keys(GEMINI_MODELS).forEach(key => {
                const sel = document.getElementById(`${P}-map-${key}`);
                if (sel) s.modelMapping[key] = sel.value;
            });
            saveSettings(s);
            console.log(`${SCRIPT_PREFIX} Model-Mapping gespeichert:`, s.modelMapping);

            if (showFeedback) {
                const saveBtn = document.getElementById(`${P}-map-save`);
                if (saveBtn) {
                    const originalText = saveBtn.textContent;
                    saveBtn.textContent = '✓ Gespeichert!';
                    saveBtn.style.background = '#28a745';
                    setTimeout(() => {
                        saveBtn.textContent = originalText;
                        restoreModelSelect();
                    }, 800);
                } else {
                    restoreModelSelect();
                }
            }
        }

        // Auto-save on select change (with debounce)
        Object.keys(GEMINI_MODELS).forEach(key => {
            const sel = document.getElementById(`${P}-map-${key}`);
            if (sel) {
                sel.addEventListener('change', () => {
                    saveModelMapping(false);
                    // Optional: show small indicator that it auto-saved
                    const indicatorId = `${P}-map-indicator-${key}`;
                    const indicator = document.getElementById(indicatorId);
                    if (!indicator) {
                        const div = document.createElement('div');
                        div.id = indicatorId;
                        div.style.cssText = 'position: absolute; top: -20px; right: 0; font-size: 11px; color: #28a745;';
                        sel.parentNode.style.position = 'relative';
                        sel.parentNode.appendChild(div);
                    }
                    const indicatorEl = document.getElementById(indicatorId);
                    indicatorEl.textContent = '✓ auto-gespeichert';
                    setTimeout(() => indicatorEl.textContent = '', 1500);
                });
            }
        });

        // Save button for explicit confirmation
        document.getElementById(`${P}-map-save`)?.addEventListener('click', () => saveModelMapping(true));
        document.getElementById(`${P}-map-cancel`)?.addEventListener('click', restoreModelSelect);
    }

    function restoreModelSelect() {
        const area = document.getElementById(`${P}-model-area`);
        if (!area) return;
        const settings = loadSettings();
        console.log(`${SCRIPT_PREFIX} restoreModelSelect mit Mapping:`, settings.modelMapping);
        area.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center;">
                <select id="${P}-model-select" style="
                    flex: 1; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px;
                    font-size: 13px; background: white; cursor: pointer; color: #333;
                ">
                    ${Object.entries(GEMINI_MODELS).map(([key, m]) => `
                        <option value="${key}" ${settings.model === key ? 'selected' : ''}>
                            ${m.icon} ${m.label} — ${settings.modelMapping?.[key] || m.id}
                        </option>
                    `).join('')}
                </select>
                <button id="${P}-load-models-btn" title="Modellzuweisung ändern"
                    style="padding: 8px 11px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; cursor: pointer; line-height: 1; color: #555;">↻</button>
            </div>
            <small style="color: #aaa; font-size: 11px; display: block; margin-top: 4px;">
                ↻ um zuzuweisen, welches Gemini-Modell hinter Flash/Pro/Lite steckt
            </small>
        `;
        // Re-attach events
        const sel = document.getElementById(`${P}-model-select`);
        if (sel) sel.addEventListener('change', () => {
            const s = loadSettings(); s.model = sel.value; saveSettings(s);
        });
        const apiKeyEl = document.getElementById(`${P}-api-key`);
        document.getElementById(`${P}-load-models-btn`)?.addEventListener('click', () => {
            const key = apiKeyEl?.value.trim();
            if (!key) return;
            fetchGeminiModels(key);
        });
    }

    function goToNextPage(settings) {
        console.log(`${SCRIPT_PREFIX} 🔍 Suche Next-Button...`);
        const result = IS_WH ? wh_goToNextPage(settings) : ka_goToNextPage(settings);
        if (!result) console.log(`${SCRIPT_PREFIX} 🛑 Keine weitere Seite verfügbar - beende Crawl`);
        return result;
    }

    // ==================== GEMINI API ====================

    function computePriceStats(adsData) {
        const prices = adsData
            .map(ad => {
                const match = (ad.price || '')
                    .replace(/\./g, '')        // Tausenderpunkte entfernen
                    .replace(/,/g, '.')        // Dezimalkomma zu Punkt
                    .match(/(\d+(?:\.\d+)?)/); // Dezimalzahl matchen
                return match ? parseFloat(match[1]) : null;
            })
            .filter(p => p !== null && p > 0);
        if (prices.length === 0) return null;
        const sorted = [...prices].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
        return { min: sorted[0], max: sorted[sorted.length - 1], mean: Math.round(mean), median: Math.round(median), count: prices.length };
    }

    function callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey = MODEL.FLASH, retryCount = 0, onRetry = null) {
        return new Promise((resolve, reject) => {
            // Resolve slot key → actual model ID via settings.modelMapping
            const mapping = loadSettings().modelMapping || DEFAULT_SETTINGS.modelMapping;
            const slotConfig = GEMINI_MODELS[modelKey];
            const modelId = mapping[modelKey] || slotConfig?.id || modelKey;
            const modelName = slotConfig ? `${slotConfig.icon} ${slotConfig.label} (${modelId})` : modelId;
            const modelConfig = {
                id: modelId,
                name: modelName,
                url: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`
            };
            const stats = computePriceStats(adsData);
            const statsSection = stats ? `\n\n## Preisverteilung\n- Minimum: ${stats.min} €\n- Maximum: ${stats.max} €\n- Durchschnitt: ${stats.mean} €\n- Median: ${stats.median} €\n- Anzeigen mit Preis: ${stats.count}` : '';

            const prompt = `Du bist ein Experte für Schnäppchen und Preisanalyse.

SUCHKONTEXT: ${searchContext}

AUFGABE:
Analysiere die folgenden ${SITE_NAME}-Anzeigen und finde die ${topX} BESTEN Schnäppchen/Deals.

KRITERIEN für ein gutes Schnäppchen:
- 35-90% unter dem üblichen Neupreis
- Bei Wiederverkauf garantierter Gewinn möglich
- MUST BUY Qualität
- Echter Mehrwert für den Käufer${statsSection}

ANZEIGEN:
${adsData.map((ad, idx) => `
Anzeige ${idx + 1}:
Titel: ${ad.title}
Preis: ${ad.price}
Beschreibung: ${(ad.description || '').substring(0, 400)}
URL: ${ad.url}
`).join('\n---\n')}

ANTWORT-FORMAT (NUR JSON, KEINE ZUSÄTZLICHEN TEXTE):
{
  "topDeals": [
    {
      "title": "...",
      "price": "...",
      "description": "...",
      "url": "...",
      "reasoning": "Warum ist das ein Top-Deal? (1-2 Sätze)",
      "score": 85
    }
  ]
}

Sortiere die Top ${topX} Deals nach Qualität (beste zuerst). Der score ist 0-100 (100 = absolutes Schnäppchen).`;

            console.log(`${SCRIPT_PREFIX} Using model: ${modelConfig.name} (${modelConfig.id})`);

            // Adaptive token limit based on number of deals
            const baseTokens = 2048;
            const tokensPerDeal = 150;
            const requiredTokens = Math.max(baseTokens, adsData.length * tokensPerDeal + 500);
            const maxOutputTokens = Math.min(8192, requiredTokens);

            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: maxOutputTokens,
<<<<<<< Updated upstream
                    responseMimeType: 'application/json'
=======
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: "object",
                        properties: {
                            topDeals: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string" },
                                        price: { type: "string" },
                                        description: { type: "string" },
                                        url: { type: "string" },
                                        score: { type: "number" },
                                        reasoning: { type: "string" }
                                    },
                                    required: ["title", "price", "description", "url", "score", "reasoning"]
                                }
                            }
                        },
                        required: ["topDeals"]
                    }
>>>>>>> Stashed changes
                }
            };

            const req = GM_xmlhttpRequest({
                method: 'POST',
                url: modelConfig.url,
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                data: JSON.stringify(requestBody),
                timeout: GEMINI_API_TIMEOUT,
                onload: function(response) {
                    activeRequests.delete(req);
                    try {
                        if (response.status === 200) {
                            const data = JSON.parse(response.responseText);
                            const finishReason = data.candidates?.[0]?.finishReason;
                            console.log(`${SCRIPT_PREFIX} Gemini finishReason:`, finishReason);

                            // Check for safety blocks or missing content
                            if (!data.candidates?.[0]?.content?.parts) {
                                const reason = data.candidates?.[0]?.finishReason || 'UNKNOWN';
                                if (['SAFETY', 'RECITATION'].includes(reason)) {
                                    reject(new Error(`Gemini: Inhalt blockiert (${reason})`));
                                } else {
                                    reject(new Error(`Gemini: Kein Inhalt (finishReason: ${reason})`));
                                }
                                return;
                            }

                            const parts = data.candidates[0].content.parts;
                            let fullText = parts.map(p => p.text).join('');
                            console.log(`${SCRIPT_PREFIX} AI Antwort (${parts.length} parts, ${fullText.length} chars):`, fullText.substring(0, 500));

                            if (finishReason === 'MAX_TOKENS') {
                                console.warn(`${SCRIPT_PREFIX} ⚠️ Response bei MAX_TOKENS abgeschnitten!`);
                            } else if (finishReason && finishReason !== 'STOP') {
                                console.warn(`${SCRIPT_PREFIX} ⚠️ Unerwarteter finishReason: ${finishReason}`);
                            }

                            // Methode 1: Direktes JSON
                            try {
                                const direct = JSON.parse(fullText);
                                if (direct.topDeals) {
                                    console.log(`${SCRIPT_PREFIX} ✅ Direktes JSON erfolgreich geparst`);
                                    resolve(direct);
                                    return;
                                }
                            } catch (e) {}

                            // Methode 2: Markdown Codeblock (object or array)
                            let jsonText = null;
                            const markdownMatch = fullText.match(/```(?:json)?\s*([\{\[][\s\S]*[\}\]])\s*```/);
                            if (markdownMatch) {
                                jsonText = markdownMatch[1];
                                console.log(`${SCRIPT_PREFIX} JSON via Markdown extrahiert (${jsonText.length} chars)`);
                            }

                            // Methode 3: Rohes JSON (object or array)
                            if (!jsonText) {
                                const rawMatch = fullText.match(/([\{\[][\s\S]*[\}\]])/);
                                if (rawMatch) {
                                    jsonText = rawMatch[1];
                                    console.log(`${SCRIPT_PREFIX} JSON raw extrahiert (${jsonText.length} chars)`);
                                }
                            }

                            if (jsonText) {
                                try {
                                    resolve(JSON.parse(jsonText));
                                } catch (parseError) {
                                    console.error(`${SCRIPT_PREFIX} JSON Parse Fehler:`, parseError);
                                    if (shouldStop) {
                                        reject(new Error('Aborted'));
                                        return;
                                    }
                                    if (retryCount < MAX_RETRIES) {
<<<<<<< Updated upstream
                                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), RETRY_BASE_DELAY);
=======
                                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), addJitter(RETRY_BASE_DELAY, 0.5));
>>>>>>> Stashed changes
                                    } else {
                                        reject(new Error('JSON Parse Fehler'));
                                    }
                                }
                            } else {
                                console.error(`${SCRIPT_PREFIX} Kein JSON in Antwort gefunden`);
                                if (shouldStop) {
                                    reject(new Error('Aborted'));
                                    return;
                                }
                                if (retryCount < MAX_RETRIES) {
<<<<<<< Updated upstream
                                    setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), RETRY_BASE_DELAY);
=======
                                    setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), addJitter(RETRY_BASE_DELAY, 0.5));
>>>>>>> Stashed changes
                                } else {
                                    reject(new Error('Kein JSON in AI-Antwort'));
                                }
                            }
                        } else if ([400, 401, 403].includes(response.status)) {
                            // Unit 1: no retry for auth/client errors
                            console.error(`${SCRIPT_PREFIX} FINALE FEHLER (kein Retry) - Status: ${response.status}`);
                            reject(new Error(`Gemini API Fehler: ${response.status} - ${response.responseText}`));
                        } else if ([429, 503].includes(response.status)) {
                            // Unit 1: exponential backoff with Retry-After header support
                            if (retryCount < RATE_LIMIT_MAX_RETRIES) {
                                let delay = RATE_LIMIT_BASE_DELAY * Math.pow(2, retryCount); // base 5s
                                let serverDictated = false;
                                // Try to parse Retry-After header
                                const headers = response.responseHeaders;
                                if (headers) {
                                    const match = headers.match(/retry-after:\s*(\d+)/i);
                                    if (match) {
                                        const seconds = parseInt(match[1], 10);
                                        if (!isNaN(seconds)) {
                                            delay = seconds * 1000; // convert to ms
                                            serverDictated = true;
                                            console.log(`${SCRIPT_PREFIX} Retry-After header: ${seconds}s`);
                                        }
                                    }
                                }
                                // Add jitter (+0‑20%) – never less than Retry‑After header
                                delay = addJitter(delay, JITTER_FACTOR);
                                // Only cap self-generated backoff delays; server-dictated Retry-After must be honoured
                                if (!serverDictated) delay = Math.min(delay, MAX_RATE_LIMIT_DELAY);
                                console.log(`${SCRIPT_PREFIX} Rate limit ${response.status} - Retry ${retryCount + 1} in ${Math.round(delay)}ms`);
                                // Notify UI about retry
                                if (onRetry) {
                                    onRetry(response.status, retryCount + 1, Math.round(delay / 1000));
                                }
                                if (shouldStop) {
                                    reject(new Error('Aborted'));
                                    return;
                                }
                                setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), delay);
                            } else {
                                reject(new Error(`Gemini API Fehler: ${response.status}`));
                            }
                        } else if (retryCount < MAX_RETRIES) {
                            console.log(`${SCRIPT_PREFIX} Gemini API Fehler ${response.status} - Retry ${retryCount + 1}`);
                            // Notify UI about retry for non-rate-limit errors
                            if (onRetry) {
                                onRetry(response.status, retryCount + 1, 2); // 2 seconds delay
                            }
                            if (shouldStop) {
                                reject(new Error('Aborted'));
                                return;
                            }
<<<<<<< Updated upstream
                            setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), RETRY_BASE_DELAY);
=======
                            setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), addJitter(RETRY_BASE_DELAY, 0.5));
>>>>>>> Stashed changes
                        } else {
                            console.error(`${SCRIPT_PREFIX} FINALE FEHLER - Status: ${response.status}`);
                            reject(new Error(`Gemini API Fehler: ${response.status} - ${response.responseText}`));
                        }
                    } catch (error) {
                        if (shouldStop) {
                            reject(new Error('Aborted'));
                            return;
                        }
                        if (retryCount < MAX_RETRIES) {
<<<<<<< Updated upstream
                            setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), RETRY_BASE_DELAY);
=======
                            setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), addJitter(RETRY_BASE_DELAY, 0.5));
>>>>>>> Stashed changes
                        } else {
                            reject(error);
                        }
                    }
                },
                onerror: function() {
                    activeRequests.delete(req);
                    if (shouldStop) {
                        reject(new Error('Aborted'));
                        return;
                    }
                    if (retryCount < MAX_RETRIES) {
                        // Notify UI about network error retry
                        if (onRetry) {
                            onRetry('network_error', retryCount + 1, 2);
                        }
<<<<<<< Updated upstream
                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), RETRY_BASE_DELAY);
=======
                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), addJitter(RETRY_BASE_DELAY, 0.5));
>>>>>>> Stashed changes
                    } else {
                        reject(new Error('Netzwerkfehler bei Gemini API'));
                    }
                },
                ontimeout: function() {
                    activeRequests.delete(req);
                    if (shouldStop) {
                        reject(new Error('Aborted'));
                        return;
                    }
                    if (retryCount < MAX_RETRIES) {
                        // Notify UI about timeout retry
                        if (onRetry) {
                            onRetry('timeout', retryCount + 1, 2);
                        }
<<<<<<< Updated upstream
                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), RETRY_BASE_DELAY);
=======
                        setTimeout(() => callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve).catch(reject), addJitter(RETRY_BASE_DELAY, 0.5));
>>>>>>> Stashed changes
                    } else {
                        reject(new Error('Timeout bei Gemini API'));
                    }
                }
            });
            if (req) activeRequests.add(req);
        });
    }

    // ==================== HAUPT-FUNKTIONEN ====================

    async function startDealFinder() {
        const apiKey = document.getElementById(`${P}-api-key`).value.trim();
        const searchContext = document.getElementById(`${P}-search-context`).value.trim();
        const topX = parseInt(document.getElementById(`${P}-top-x`).value);
        const maxPages = parseInt(document.getElementById(`${P}-max-pages`).value) || 10;
        const model = document.getElementById(`${P}-model-select`)?.value || MODEL.FLASH;

        if (!apiKey) { alert('Bitte gib deinen Gemini API Key ein!'); return; }
        if (!searchContext) { alert('Bitte gib einen Suchkontext ein!'); return; }
        if (!Number.isFinite(topX) || topX < 1 || topX > 10) { alert('AI-Picks muss zwischen 1 und 10 liegen!'); return; }
        if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 100) { alert('Maximale Seiten muss zwischen 1 und 100 liegen!'); return; }

        // Preserve existing settings (especially modelMapping) when saving
        const currentSettings = loadSettings();
        currentSettings.apiKey = apiKey;
        currentSettings.searchContext = searchContext;
        currentSettings.topX = topX;
        currentSettings.model = model;
        currentSettings.maxPages = maxPages;
        saveSettings(currentSettings);

        // UX-05: Request notification permission
        if ('Notification' in window) {
            Notification.requestPermission().catch(() => {});
        }

        currentPage = 1;
        allTopDeals = [];
        isRunning = true;
        isPaused = false;
        shouldStop = false;
        captchaPaused = false;

        setUIRunningState();

        try {
            await processCurrentPage(apiKey, searchContext, topX, model, maxPages);
        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Fehler:`, error);
            updateProgress(`❌ Fehler: ${error.message}`, 0);
            if (allTopDeals.length > 0) {
                await finishDealFinder();
            } else {
                resetUI();
                alert(`Fehler: ${error.message}`);
            }
        }
    }

    function pauseDealFinder() {
        isPaused = true;
        const pauseBtn = document.getElementById(`${P}-pause-btn`);
        if (!pauseBtn) return;
        pauseBtn.textContent = '▶ Fortsetzen';
        pauseBtn.style.background = '#28a745';
        pauseBtn.removeEventListener('click', pauseDealFinder);
        pauseBtn.addEventListener('click', resumeDealFinder);
        updateProgress('⏸ Pausiert - Klicke Fortsetzen...', 50);
    }

    function resumeDealFinder() {
        isPaused = false;
        const pauseBtn = document.getElementById(`${P}-pause-btn`);
        if (!pauseBtn) return;
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.style.background = '#ffc107';
        pauseBtn.removeEventListener('click', resumeDealFinder);
        pauseBtn.addEventListener('click', pauseDealFinder);

        // If we're still running and it was a CAPTCHA pause, restart processing
        if (isRunning && captchaPaused) {
            captchaPaused = false;
            const settings = loadSettings();
            const crawlState = loadCrawlState();
            const maxPages = crawlState?.maxPages || settings.maxPages;
            processCurrentPage(settings.apiKey, settings.searchContext, settings.topX, settings.model, maxPages)
                .catch(error => {
                    console.error(`${SCRIPT_PREFIX} Resume error:`, error);
                    updateProgress(`❌ Resume error: ${error.message}`, 0);
                    resetUI();
                });
        }
    }

    function stopDealFinder() {
        shouldStop = true;
        isPaused = false; // Force exit from pause loop
        captchaPaused = false;
        clearCrawlState();
        // Unit 3: abort in-flight requests
        activeRequests.forEach(req => { try { req.abort(); } catch (e) {} });
        activeRequests = new Set();
        updateProgress('⏹ Stoppe nach aktueller Seite...', 95);
    }

    async function processCurrentPage(apiKey, searchContext, topX, model, maxPages = 10) {
        await waitIfPaused();
        if (shouldStop) { await finishDealFinder(); return; }

        // Unit 5: maxPages guard
        if (currentPage > maxPages) { await finishDealFinder(); return; }

        updateProgress(`📋 Seite ${currentPage}: Lade alle Anzeigen...`, 10);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 1500));

        updateProgress(`📋 Seite ${currentPage}: Sammle Anzeigen...`, 15);
        const selectors = findCurrentSelectors();
        if (!selectors) {
            // Unit 7: CAPTCHA detection
            const pageText = (document.title + ' ' + document.body.innerText).toLowerCase();
            if (pageText.includes('captcha') || pageText.includes('challenge')) {
                captchaPaused = true;
<<<<<<< Updated upstream
=======
                // Save state before CAPTCHA pause to survive page reload
                const settings = loadSettings();
                saveCrawlState({
                    currentPage,
                    currentUrl: window.location.href,
                    allTopDeals,
                    maxPages: settings.maxPages
                });
>>>>>>> Stashed changes
                pauseDealFinder();
                updateProgress('⚠️ CAPTCHA erkannt! Bitte lösen und Fortsetzen klicken', 50);
                return;
            }
            throw new Error('Keine Anzeigen gefunden');
        }

        // Unit 4: deduplicate by URL in one pass
        updateProgress(`📋 Seite ${currentPage}: Sammle Basis-Daten...`, 20);
        const seenUrls = new Set();
        const adsData = [];
        for (const ad of Array.from(selectors.adEntries)) {
            const info = extractBasicInfo(ad);
            if (!seenUrls.has(info.url)) {
                seenUrls.add(info.url);
                adsData.push(info);
            }
        }
        console.log(`${SCRIPT_PREFIX} ${adsData.length} Anzeigen gefunden (dedupliziert)`);

        updateProgress(`📋 Seite ${currentPage}: Lade Details (0/${adsData.length})...`, 30);
        let completedCount = 0;

        for (let i = 0; i < adsData.length; i += INITIAL_BATCH_SIZE) {
            // Unit 4: pause check inside each batch iteration
            await waitIfPaused();
            if (shouldStop) break;

            const batch = adsData.slice(i, Math.min(i + INITIAL_BATCH_SIZE, adsData.length));
            await Promise.all(batch.map((adData, batchIndex) => {
                const index = i + batchIndex;
                const fetchPromise = adData.url && adData.url.startsWith('http')
                    ? fetchFullDescription(adData.url)
                    : Promise.resolve({ description: 'Beschreibung nicht verfügbar' });
                return fetchPromise.then(result => {
                    completedCount++;
                    if (shouldStop) return;
                    // Throttle progress updates to reduce DOM writes
                    if (completedCount % 5 === 0 || completedCount === adsData.length) {
                        updateProgress(`📋 Seite ${currentPage}: Lade Details (${completedCount}/${adsData.length})...`, 30 + (completedCount / adsData.length) * 40);
                    }
                    adsData[index].description = result.description;
                });
            }));

            // Unit 4: random delay between batches
            if (i + INITIAL_BATCH_SIZE < adsData.length) {
                await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
            }
        }

        if (shouldStop) { await finishDealFinder(); return; }

        updateProgress(`🤖 Seite ${currentPage}: AI analysiert Angebote...`, 75);
        console.log(`${SCRIPT_PREFIX} Sende ${adsData.length} Anzeigen an Gemini ${GEMINI_MODELS[model]?.name || model}...`);

        // Retry callback for UI feedback
        const onRetry = (status, retryNum, delaySeconds) => {
            const statusText = typeof status === 'number' ? `HTTP ${status}` : status;
            showWarning(`API ${statusText} - Retry ${retryNum} in ${delaySeconds}s...`, 75);
        };

        let aiResult = null;
        try {
            aiResult = await callGeminiAPI(adsData, searchContext, topX, apiKey, model, 0, onRetry);
        } catch (error) {
            if (error.message === 'Aborted' || shouldStop) {
                await finishDealFinder();
                return;
            }
            throw error; // rethrow other errors
        }
        if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
            console.log(`${SCRIPT_PREFIX} AI hat ${aiResult.topDeals.length} Top-Deals gefunden`);
            allTopDeals.push(...aiResult.topDeals.map(deal => ({ ...deal, page: currentPage })));
            updateProgress(`✅ Seite ${currentPage}: ${aiResult.topDeals.length} Top-Deals gefunden!`, 90);
            updateLiveRanking();
        }

        await new Promise(resolve => setTimeout(resolve, 1500));

        if (!shouldStop && goToNextPage({ apiKey, searchContext, topX, model, maxPages })) {
            // page reload in progress — goToNextPage navigates via window.location.href
        } else {
            await finishDealFinder();
        }
    }

    async function finishDealFinder() {
        updateProgress('📊 Erstelle finale Ranking-Liste...', 95);
        clearCrawlState();

        if (allTopDeals.length === 0) {
            updateProgress('❌ Keine Deals gefunden!', 100);
            alert('Keine Top-Deals gefunden! Versuche andere Suchkriterien.');
            resetUI();
            return;
        }

        // Guard: skip API re-ranking if user stopped the crawl
        if (shouldStop) {
            updateProgress('⏹ Crawl gestoppt. Speichere bisherige Deals...', 100);
            saveResults({ deals: allTopDeals, pages: currentPage, timestamp: new Date().toISOString() });
            switchToResultsView();
            resetUI();
            return;
        }

        // Deduplicate across pages (same listing can shift pages on live marketplaces)
        const uniqueDealsMap = new Map();
        for (const d of allTopDeals) {
            if (!uniqueDealsMap.has(d.url)) uniqueDealsMap.set(d.url, d);
        }
        allTopDeals = Array.from(uniqueDealsMap.values());

        // Unit 6: Global re-ranking across all collected deals
        if (allTopDeals.length > 1) {
            try {
                const settings = loadSettings();
                updateProgress('🤖 Globales Re-Ranking aller Deals...', 97);
                // Retry callback for UI feedback
                const onRetry = (status, retryNum, delaySeconds) => {
                    const statusText = typeof status === 'number' ? `HTTP ${status}` : status;
                    showWarning(`Global Re-Ranking: API ${statusText} - Retry ${retryNum} in ${delaySeconds}s...`, 97);
                };

                // Limit re-ranking to top N deals to avoid token overflow
<<<<<<< Updated upstream
                const dealsToReRank = allTopDeals.slice(0, RE_RANK_MAX_DEALS);
                const otherDeals = allTopDeals.slice(RE_RANK_MAX_DEALS);
=======
                const sortedTopDeals = sortDealsByScore(allTopDeals);
                debugLog(`Global re-ranking: sorted ${sortedTopDeals.length} deals, top scores: ${sortedTopDeals.slice(0, 3).map(d => d.score).join(', ')}`);
                const dealsToReRank = sortedTopDeals.slice(0, RE_RANK_MAX_DEALS);
>>>>>>> Stashed changes

                const reRankResult = await callGeminiAPI(
                    dealsToReRank.map(d => ({ title: d.title, price: d.price, description: (d.description || '').substring(0, 400), url: d.url })),
                    settings.searchContext || '',
                    dealsToReRank.length,
                    settings.apiKey,
                    settings.model || MODEL.FLASH,
                    0,
                    onRetry
                );
                if (reRankResult && reRankResult.topDeals && reRankResult.topDeals.length > 0) {
                    const reRankedDeals = reRankResult.topDeals.map(rd => {
<<<<<<< Updated upstream
                        const orig = dealsToReRank.find(d => d.url === rd.url)
                                   || dealsToReRank.find(d => d.title === rd.title);
                        return { ...rd, page: orig?.page ?? 'unbekannt' };
                    });
                    // Combine re-ranked deals (now in new order) with remaining deals
                    allTopDeals = [...reRankedDeals, ...otherDeals].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                    console.log(`${SCRIPT_PREFIX} Global Re-Ranking abgeschlossen (${reRankedDeals.length} Deals neu sortiert)`);
=======
                        const orig = urlToDeal.get(rd.url) || titleToDeal.get(rd.title);
                        // Restore original canonical data to prevent LLM URL hallucinations causing duplicates
                        return {
                            ...rd,
                            url: orig?.url || rd.url,
                            title: orig?.title || rd.title,
                            description: orig?.description || rd.description,
                            page: orig?.page ?? 'unbekannt'
                        };
                    });
                    // Identify deals from sortedTopDeals that were NOT re-ranked (match by canonical original URL)
                    const reRankedUrls = extractSet(reRankedDeals, DEAL_KEYS.URL);
                    const remainingDeals = sortedTopDeals.filter(d => !reRankedUrls.has(d.url));
                    // Concatenate and sort — avoids broken merge when LLM returns unsorted output
                    allTopDeals = sortDealsByScore([...reRankedDeals, ...remainingDeals]);
                    console.log(`${SCRIPT_PREFIX} Global Re-Ranking abgeschlossen (${reRankedDeals.length} Deals neu sortiert, ${remainingDeals.length} Deals behalten)`);
>>>>>>> Stashed changes
                }
            } catch (e) {
                console.warn(`${SCRIPT_PREFIX} Global Re-Ranking fehlgeschlagen:`, e);
            }
        }

        // Unit 8: ISO timestamp
        saveResults({ deals: allTopDeals, pages: currentPage, timestamp: new Date().toISOString() });
        updateProgress(`✅ ${allTopDeals.length} Deals gespeichert!`, 100);

        // UX-05: Fire desktop notification
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('Deal Finder fertig', {
                    body: `${allTopDeals.length} Deals auf ${currentPage} Seiten gefunden`
                });
            } catch (e) {}
        }

        switchToResultsView();
        resetUI();
    }

    function resetUI() {
        isRunning = false;
        isPaused = false;
        shouldStop = false;
        captchaPaused = false;
        // Unit 3: abort any remaining requests
        activeRequests.forEach(req => { try { req.abort(); } catch (e) {} });
        activeRequests = new Set();
        descriptionCache.clear();
        const startBtn = document.getElementById(`${P}-start-btn`);
        const pauseBtn = document.getElementById(`${P}-pause-btn`);
        const stopBtn = document.getElementById(`${P}-stop-btn`);
        const apiKeyInput = document.getElementById(`${P}-api-key`);
        const searchInput = document.getElementById(`${P}-search-context`);
        const topXInput = document.getElementById(`${P}-top-x`);
        if (startBtn) startBtn.style.display = 'block';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        if (apiKeyInput) apiKeyInput.disabled = false;
        if (searchInput) searchInput.disabled = false;
        if (topXInput) topXInput.disabled = false;
    }

    function setUIRunningState() {
        const startBtn = document.getElementById(`${P}-start-btn`);
        const pauseBtn = document.getElementById(`${P}-pause-btn`);
        const stopBtn = document.getElementById(`${P}-stop-btn`);
        const apiKeyInput = document.getElementById(`${P}-api-key`);
        const searchInput = document.getElementById(`${P}-search-context`);
        const topXInput = document.getElementById(`${P}-top-x`);
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'block';
        if (apiKeyInput) apiKeyInput.disabled = true;
        if (searchInput) searchInput.disabled = true;
        if (topXInput) topXInput.disabled = true;
    }

    // ==================== INITIALISIERUNG ====================

    function createDealFinderButton() {
        const buttonId = `${P}-dealfinder-btn`;
        if (document.getElementById(buttonId)) return;
        const button = document.createElement('button');
        button.id = buttonId;
        button.innerHTML = '🔍 Deal Finder';
        button.style.cssText = `
            position: fixed; top: 140px; right: 0; z-index: 99999;
            padding: 12px 16px; background: ${BTN_GRADIENT};
            color: white; border: none; border-radius: 8px 0 0 8px; cursor: pointer;
            box-shadow: -3px 3px 12px rgba(0,0,0,0.25); font-size: 15px; font-weight: bold;
            transition: padding-right 0.2s ease, box-shadow 0.2s ease;
        `;
        button.addEventListener('click', openModal);
        button.addEventListener('mouseenter', () => {
            button.style.paddingRight = '22px';
            button.style.boxShadow = '-5px 4px 18px rgba(0,0,0,0.35)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.paddingRight = '16px';
            button.style.boxShadow = '-3px 3px 12px rgba(0,0,0,0.25)';
        });
        document.body.appendChild(button);
        console.log(`${SCRIPT_PREFIX} Deal Finder Button erstellt`);
    }

    async function resumeCrawlIfActive() {
        const crawlState = loadCrawlState();
        if (!crawlState) {
            console.log(`${SCRIPT_PREFIX} Normale Session - Results bleiben erhalten`);
            return;
        }

        // Unit 4 BUG-03: currentPage was saved as the completed page; resume from next
        // Check if we're still on the same page (refresh) or navigated to new page
        // Normalize URLs by removing hash fragments before comparison
        const normalizedCurrentUrl = normalizeUrl(crawlState.currentUrl);
        const normalizedWindowUrl = normalizeUrl(window.location.href);
        const samePage = normalizedCurrentUrl && normalizedCurrentUrl === normalizedWindowUrl;
        const pageIncrement = samePage ? SAME_PAGE_INCREMENT : NEW_PAGE_INCREMENT;
        console.log(`${SCRIPT_PREFIX} 🔄 Crawl-State gefunden - setze fort ab Seite ${crawlState.currentPage + pageIncrement} (${samePage ? 'Seite neu geladen' : 'Navigation erkannt'})`);
        currentPage = crawlState.currentPage + pageIncrement;
        allTopDeals = crawlState.allTopDeals || [];
        isRunning = true;

        openModal();
        // Unit 8: waitForElement instead of blind setTimeout
        try {
            await waitForElement(`#${P}-progress-container`, 2000);
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        setUIRunningState();
        updateLiveRanking();

        // Unit 4: load credentials from settings, not crawl state (apiKey not stored there)
        const settings = loadSettings();
        const maxPages = crawlState.maxPages || settings.maxPages || 10;

        try {
            await processCurrentPage(settings.apiKey, settings.searchContext, settings.topX, settings.model || MODEL.FLASH, maxPages);
        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Fehler beim Fortsetzen:`, error);
            updateProgress(`❌ Fehler: ${error.message}`, 0);
            clearCrawlState();
            if (allTopDeals.length > 0) {
                await finishDealFinder();
            } else {
                resetUI();
                alert(`Fehler beim Fortsetzen: ${error.message}`);
            }
        }
    }

    async function init() {
        try {
            console.log(`${SCRIPT_PREFIX} Script gestartet`);

            if (IS_WH) {
                const searchIndicators = ['[data-testid="result-list-title"]', '[data-testid*="search-result"]', 'a[href*="/iad/"]'];
                if (!searchIndicators.some(s => document.querySelector(s))) {
                    // Unit 7: initRetries counter
                    if (++initRetries >= MAX_INIT_RETRIES) {
                        console.warn(`${SCRIPT_PREFIX} Max init retries erreicht - zeige Button trotzdem`);
                        createModal();
                        createDealFinderButton();
                        return;
                    }
                    setTimeout(init, 3000);
                    return;
                }
            } else {
                try {
                    await waitForElement('article[data-adid], #srchrslt-adtable', 10000);
                } catch (e) {
                    console.log(`${SCRIPT_PREFIX} Keine Anzeigenliste gefunden, versuche später erneut.`);
                    if (++initRetries >= MAX_INIT_RETRIES) {
                        console.warn(`${SCRIPT_PREFIX} Max init retries erreicht - zeige Button trotzdem`);
                        createModal();
                        createDealFinderButton();
                        return;
                    }
                    setTimeout(init, 3000);
                    return;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1500));
            createModal();
            createDealFinderButton();
            await resumeCrawlIfActive();

        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Initialisierungsfehler:`, error);
            setTimeout(init, 3000);
        }
    }

    init();

})();

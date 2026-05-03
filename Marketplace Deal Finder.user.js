// ==UserScript==
// @name         Marketplace Deal Finder
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      29.3
// @description  Automatic AI-powered deal finder for Willhaben & Kleinanzeigen with live ranking and pause function. Multi-page crawling with Gemini AI analysis.
// @author       marmoris
// @match        https://www.willhaben.at/iad/kaufen-und-verkaufen/*
// @match        https://www.kleinanzeigen.de/s-*
// @match        https://www.kleinanzeigen.de/z-*
// @icon         https://i.imgur.com/oQmtRjQ.png
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM.setValue
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/dom-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/storage-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/network-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/ui-components.js
// @connect      willhaben.at
// @connect      kleinanzeigen.de
// @connect      generativelanguage.googleapis.com
// @noframes
// @sandbox      JavaScript
// @inject-into  content
// @unwrap
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Marketplace%20Deal%20Finder.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Marketplace%20Deal%20Finder.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== SITE DETECTION ====================

    const IS_WH = window.location.hostname.includes('willhaben.at');
    const P = IS_WH ? 'wh' : 'ka';
    const SITE_NAME = IS_WH ? 'WILLHABEN' : 'KLEINANZEIGEN';
    const BTN_GRADIENT = IS_WH
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : 'linear-gradient(135deg, #86a542 0%, #2d2d2d 100%)';
    const Logger = TM.createLogger('Marketplace Deal Finder');

    // ==================== CONSTANTS ====================

    // Regex constants for performance (avoid repeated instantiation)
    const SHIPPING_REGEX = /versand|shipping|porto|lieferung/i;
    const WHITESPACE_REGEX_G = /\s/g;
    const THOUSAND_DOT_REGEX_G = /\./g;
    const COMMA_REGEX_G = /,/g;
    const DECIMAL_NUMBER_REGEX = /(\d+(?:\.\d+)?)/;

    const INITIAL_BATCH_SIZE = 8;
    const MAX_RETRIES = 2;
    const RATE_LIMIT_MAX_RETRIES = 5;
    const DESCRIPTION_PREVIEW_LENGTH = 150;
    const SETTINGS_VERSION = 1;
    const MAX_CACHE_SIZE = 100;
    const REQUEST_TIMEOUT = 15000;
    const GEMINI_API_TIMEOUT = 60000;
    const RETRY_BASE_DELAY = 2000;
    const RATE_LIMIT_BASE_DELAY = 5000;
    const MAX_RATE_LIMIT_DELAY = 300000;
    const RE_RANK_MAX_DEALS = 30;
    const PAUSE_POLL_INTERVAL = 500;
    const JITTER_FACTOR = 0.2;
    const MIN_TITLE_LENGTH = 5;
    const SAME_PAGE_INCREMENT = 0;
    const NEW_PAGE_INCREMENT = 1;
    const MAX_INIT_RETRIES = 5;

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

    // ==================== GEMINI MODEL DEFINITIONS ====================

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

    // ==================== GLOBAL STATE ====================

    let isRunning = false;
    let isPaused = false;
    let shouldStop = false;
    let captchaPaused = false;
    let allTopDeals = [];
    let currentPage = 1;
    let activeRequests = new Set();
    let descriptionCache = new Map();
    let initRetries = 0;
    let cachedSettings = null;

    // ==================== HELPERS ====================

    // XSS escaping
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Validate and return a numeric score, or null if invalid
    function getValidScore(score) {
        const num = Number(score);
        return Number.isFinite(num) ? num : null;
    }

    // Check if score is a valid finite number
    function isValidScore(score) {
        return getValidScore(score) !== null;
    }

    // Parse price string to numeric value (supports European/international formats)
    function parsePriceText(priceStr) {
        if (!priceStr || typeof priceStr !== 'string') return null;
        let normalized = priceStr.replace(WHITESPACE_REGEX_G, '');
        const hasComma = normalized.includes(',');
        const hasDot = normalized.includes('.');
        if (hasComma) {
            normalized = normalized.replace(THOUSAND_DOT_REGEX_G, '');
            normalized = normalized.replace(COMMA_REGEX_G, '.');
        } else if (hasDot) {
            const parts = normalized.split('.');
            if (parts.length > 1) {
                normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
            }
        }
        const match = normalized.match(DECIMAL_NUMBER_REGEX);
        return match ? parseFloat(match[1]) : null;
    }

    // Sort deals by validated score descending
    function sortDealsByScore(deals) {
        return deals.slice().sort((a, b) => (getValidScore(b.score) ?? 0) - (getValidScore(a.score) ?? 0));
    }

    // Check if text consists only of a price (e.g., "12,50 €" or "350 € VB")
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

    // Add positive jitter to a base value (percent as decimal, e.g., 0.2 for +0-20%)
    function addJitter(base, percent) {
        return base * (1 + Math.random() * percent);
    }

    // Normalize URL by removing hash fragment for comparison
    function normalizeUrl(url) {
        if (!url) return url;
        return url.split('#')[0];
    }

    // ==================== STORAGE ====================
    //
    // Uses async TM.storage internally for persistence via GM.getValue/GM.setValue.
    // Function signatures preserved for backward compatibility.
    // Cached settings pattern avoids repeated async reads for UI code.

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

    function deepCopySettings(settings) {
        return {
            ...settings,
            modelMapping: { ...(settings.modelMapping || DEFAULT_SETTINGS.modelMapping) }
        };
    }

    // Load settings from storage. Async first call populates cache; subsequent
    // sync access through cache is fast (no async overhead for UI code paths).
    async function loadSettings() {
        if (cachedSettings !== null) {
            return deepCopySettings(cachedSettings);
        }
        const saved = await TM.storage.loadSetting(`${P}_dealfinder_settings`, null);
        if (!saved) {
            cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
            return deepCopySettings(cachedSettings);
        }
        try {
            const loaded = (typeof saved === 'string') ? JSON.parse(saved) : saved;
            if (loaded.model && !GEMINI_MODELS[loaded.model]) {
                loaded.model = MODEL.FLASH;
            }
            const merged = Object.assign({}, DEFAULT_SETTINGS, loaded);
            cachedSettings = deepCopySettings(merged);
            return deepCopySettings(cachedSettings);
        } catch (e) {
            Logger.warn('Corrupted settings storage, resetting to defaults');
            await TM.storage.saveSetting(`${P}_dealfinder_settings`, null);
            cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
            return deepCopySettings(cachedSettings);
        }
    }

    // Persist settings to storage and update in-memory cache
    async function saveSettings(settings) {
        await TM.storage.saveSetting(`${P}_dealfinder_settings`, JSON.stringify(settings));
        cachedSettings = deepCopySettings(settings);
    }

    // Crawl state — persisted as a single JSON blob per-site
    async function saveCrawlState(state) {
        await TM.storage.saveSetting(`${P}_dealfinder_crawl_state`, JSON.stringify(state));
        Logger.log('Crawl state saved:', state.currentPage, 'page', state.allTopDeals?.length, 'deals');
    }

    async function loadCrawlState() {
        const saved = await TM.storage.loadSetting(`${P}_dealfinder_crawl_state`, null);
        if (!saved) return null;
        try {
            return (typeof saved === 'string') ? JSON.parse(saved) : saved;
        } catch (e) {
            Logger.warn('Corrupted crawl state, resetting');
            await TM.storage.saveSetting(`${P}_dealfinder_crawl_state`, null);
            return null;
        }
    }

    async function clearCrawlState() {
        await TM.storage.saveSetting(`${P}_dealfinder_crawl_state`, null);
        Logger.log('Crawl state cleared');
    }

    // Results — persisted results for display after crawl completes
    async function saveResults(results) {
        await TM.storage.saveSetting(`${P}_dealfinder_results`, JSON.stringify(results));
        Logger.log('Results saved:', results.deals.length, 'deals');
    }

    async function loadResults() {
        const saved = await TM.storage.loadSetting(`${P}_dealfinder_results`, null);
        if (!saved) return null;
        try {
            return (typeof saved === 'string') ? JSON.parse(saved) : saved;
        } catch (e) {
            Logger.warn('Corrupted results storage, resetting');
            await TM.storage.saveSetting(`${P}_dealfinder_results`, null);
            return null;
        }
    }

    async function clearResults() {
        await TM.storage.saveSetting(`${P}_dealfinder_results`, null);
        Logger.log('Results cleared');
    }

    // Available models cache
    async function saveAvailableModels(models) {
        await TM.storage.saveSetting(`${P}_available_models`, JSON.stringify(models));
    }

    async function loadAvailableModels() {
        const saved = await TM.storage.loadSetting(`${P}_available_models`, null);
        if (!saved) return null;
        try { return (typeof saved === 'string') ? JSON.parse(saved) : saved; } catch (e) { return null; }
    }

    // ==================== UI — SETTINGS VIEW ====================

    function renderSettingsView(settings, savedResults) {
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

    // ==================== UI — MARKDOWN / RESULTS / LIVE RANKING ====================

    function generateMarkdown(deals, pages, timestamp) {
        timestamp = timestamp || new Date().toISOString();
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

    function renderResultsView(dealsToShow) {
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

        const settings = cachedSettings || DEFAULT_SETTINGS;
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

    // ==================== MODAL MANAGEMENT ====================

    const SIDEBAR_WIDTH = '400px';

    async function createModal() {
        const modalId = P + '-dealfinder-modal';
        if (document.getElementById(modalId)) return;
        const settings = await loadSettings();
        const savedResults = await loadResults();
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = [
            'display: none; position: fixed; top: 0; right: 0; width: 400px; height: 100vh;',
            'background: white; z-index: 999999; box-shadow: -5px 0 20px rgba(0,0,0,0.2);',
            'overflow-y: auto; transition: transform 0.3s ease;'
        ].join(' ');
        modal.innerHTML = renderSettingsView(settings, savedResults);
        document.body.appendChild(modal);
        attachEventListeners();
        restoreModelSelect();
    }

    function openModal() {
        var modal = document.getElementById(P + '-dealfinder-modal');
        var floatBtn = document.getElementById(P + '-dealfinder-btn');
        if (modal) modal.style.display = 'block';
        if (floatBtn) floatBtn.style.display = 'none';
        document.documentElement.style.transition = 'margin-right 0.3s ease';
        document.documentElement.style.marginRight = SIDEBAR_WIDTH;
    }

    function closeModal() {
        if (isRunning) {
            var btn = document.getElementById(P + '-close-btn-x');
            if (btn) {
                btn.style.color = '#dc3545';
                btn.title = 'Crawl laeuft - erst stoppen';
                setTimeout(function () { btn.style.color = '#999'; btn.title = ''; }, 1000);
            }
            return;
        }
        var modal = document.getElementById(P + '-dealfinder-modal');
        var floatBtn = document.getElementById(P + '-dealfinder-btn');
        if (modal) modal.style.display = 'none';
        if (floatBtn) floatBtn.style.display = 'block';
        document.documentElement.style.marginRight = '';
    }

    function attachEventListeners() {
        var startBtn = document.getElementById(P + '-start-btn');
        var pauseBtn = document.getElementById(P + '-pause-btn');
        var stopBtn = document.getElementById(P + '-stop-btn');
        var closeBtn = document.getElementById(P + '-close-btn-x');
        var showResultsBtn = document.getElementById(P + '-show-results-btn');
        var apiKeyInput = document.getElementById(P + '-api-key');
        var searchContextInput = document.getElementById(P + '-search-context');

        if (startBtn) startBtn.addEventListener('click', function () {
            startDealFinder()['catch'](function (error) {
                Logger.error('Unhandled error in startDealFinder:', error);
                updateProgress('Fehler: ' + error.message, 0, 'error');
                resetUI();
            });
        });
        if (pauseBtn) pauseBtn.addEventListener('click', pauseDealFinder);
        if (stopBtn) stopBtn.addEventListener('click', stopDealFinder);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (showResultsBtn) showResultsBtn.addEventListener('click', showSavedResults);

        if (apiKeyInput) apiKeyInput.addEventListener('blur', async function () {
            var s = await loadSettings();
            var newKey = apiKeyInput.value.trim();
            if (s.apiKey !== newKey) {
                s.apiKey = newKey;
                await saveSettings(s);
            }
        });
        if (searchContextInput) searchContextInput.addEventListener('blur', async function () {
            var s = await loadSettings();
            var newContext = searchContextInput.value.trim();
            if (s.searchContext !== newContext) {
                s.searchContext = newContext;
                await saveSettings(s);
            }
        });

        [startBtn, pauseBtn, stopBtn, showResultsBtn].forEach(function (btn) {
            if (btn) {
                btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.9'; });
                btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
            }
        });
    }

    // ==================== VIEW SWITCHING ====================

    async function showSavedResults() {
        var savedResults = await loadResults();
        if (savedResults) switchToResultsView(savedResults.deals);
    }

    function switchToResultsView(deals) {
        deals = deals || null;
        var modal = document.getElementById(P + '-dealfinder-modal');
        if (!modal) return;
        modal.innerHTML = renderResultsView(deals);

        var closeBtn = document.getElementById(P + '-close-btn-x');
        var backBtn = document.getElementById(P + '-back-to-settings');
        var exportMdBtn = document.getElementById(P + '-export-markdown-btn');
        var exportJsonBtn = document.getElementById(P + '-export-json-btn');
        var exportCsvBtn = document.getElementById(P + '-export-csv-btn');
        var clearBtn = document.getElementById(P + '-clear-results-btn');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (backBtn) backBtn.addEventListener('click', switchToSettingsView);
        if (exportMdBtn) exportMdBtn.addEventListener('click', exportMarkdown);
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJSON);
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);
        if (clearBtn) clearBtn.addEventListener('click', clearResultsAndGoBack);

        [exportMdBtn, exportJsonBtn, exportCsvBtn, clearBtn, backBtn].forEach(function (btn) {
            if (btn) {
                btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.9'; });
                btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
            }
        });
    }

    async function switchToSettingsView() {
        if (isRunning) return;
        var modal = document.getElementById(P + '-dealfinder-modal');
        if (!modal) return;
        var settings = await loadSettings();
        var savedResults = await loadResults();
        modal.innerHTML = renderSettingsView(settings, savedResults);
        attachEventListeners();
        restoreModelSelect();
    }

    // ==================== EXPORT FUNCTIONS ====================

    async function exportMarkdown() {
        var savedResults = await loadResults();
        if (!savedResults) { TM.ui.createToast('Keine Results verfuegbar!', { type: 'error' }); return; }
        var md = generateMarkdown(savedResults.deals, savedResults.pages, savedResults.timestamp);
        try {
            await navigator.clipboard.writeText(md);
            var btn = document.getElementById(P + '-export-markdown-btn');
            if (btn) {
                var orig = btn.textContent;
                btn.textContent = 'Kopiert!';
                setTimeout(function () { btn.textContent = orig; }, 2000);
            }
            Logger.log('Markdown copied to clipboard');
        } catch (error) {
            Logger.error('Clipboard error:', error);
            TM.ui.createToast('Fehler beim Kopieren. Bitte Fenster fokussieren und nochmal versuchen.', { type: 'error', duration: 5000 });
        }
    }

    function exportJSON() {
        var raw = GM_getValue(P + '_dealfinder_results', null);
        if (!raw) { TM.ui.createToast('Keine Results verfuegbar!', { type: 'error' }); return; }
        var savedResults;
        try { savedResults = JSON.parse(raw); } catch (e) { return; }
        var blob = new Blob([JSON.stringify(savedResults, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'deals-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    }

    function exportCSV() {
        var raw = GM_getValue(P + '_dealfinder_results', null);
        if (!raw) { TM.ui.createToast('Keine Results verfuegbar!', { type: 'error' }); return; }
        var savedResults;
        try { savedResults = JSON.parse(raw); } catch (e) { return; }
        var header = ['Rang', 'Titel', 'Preis', 'Score', 'Begruendung', 'Seite', 'URL'];
        var rows = savedResults.deals.map(function (d, i) {
            return [
                i + 1,
                '"' + (d.title || '').replace(/"/g, '""') + '"',
                '"' + (d.price || '').replace(/"/g, '""') + '"',
                d.score !== undefined && Number.isFinite(Number(d.score)) ? d.score : '',
                '"' + (d.reasoning || '').replace(/"/g, '""') + '"',
                d.page || '',
                '"' + (d.url || '').replace(/"/g, '""') + '"'
            ];
        });
        var csv = [header.join(','), rows.map(function (r) { return r.join(','); }).join('\n')].join('\n');
        var bom = String.fromCharCode(0xFEFF);
        var blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'deals-' + Date.now() + '.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    }

    async function clearResultsAndGoBack() {
        if (!confirm('Moechtest du die gespeicherten Results wirklich loeschen?')) return;
        await clearResults();
        switchToSettingsView();
    }

    // ==================== PROGRESS / STATUS BAR ====================

    var statusBar = null;

    function updateProgress(text, percentage, type) {
        type = type || 'info';
        var container = document.getElementById(P + '-progress-container');
        var progressText = document.getElementById(P + '-progress-text');
        var progressBar = document.getElementById(P + '-progress-bar');
        if (container) {
            container.style.display = 'block';
            container.style.borderLeftColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#667eea';
        }
        if (progressText) {
            progressText.textContent = text;
            progressText.style.color = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#333';
        }
        if (progressBar) {
            progressBar.style.width = percentage + '%';
            progressBar.style.backgroundColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#007bff';
            progressBar.style.transition = 'width 0.3s ease, background-color 0.3s ease';
        }
        if (!statusBar) {
            statusBar = TM.ui.createStatusBar({ accentColor: IS_WH ? '#667eea' : '#86a542' });
        }
        statusBar.setText(text);
        statusBar.setProgress(percentage);
    }

    function showError(message, percentage) {
        updateProgress('Fehler: ' + message, percentage || 0, 'error');
    }

    function showWarning(message, percentage) {
        updateProgress('Warnung: ' + message, percentage || 0, 'warning');
    }

    function showSuccess(message, percentage) {
        updateProgress('Erfolg: ' + message, percentage || 100, 'success');
    }

    // ==================== SITE-SPECIFIC: WILLHABEN ====================

    function wh_findCurrentSelectors() {
        var adSelectors = [
            'a[data-testid^="search-result-entry-header-"]',
            'article[data-testid^="search-result-entry-"]',
            '[data-testid*="search-result-entry"]'
        ];
        for (var si = 0; si < adSelectors.length; si++) {
            var entries = document.querySelectorAll(adSelectors[si]);
            if (entries.length > 0) {
                Logger.log('Found ' + entries.length + ' ads (selector: ' + adSelectors[si] + ')');
                return { adEntries: entries };
            }
        }
        var uniqueUrls = new Set();
        var uniqueAds = [];
        var urlRegex = /\/iad\/kaufen-und-verkaufen\/.*\/\d+/;
        document.querySelectorAll('a[href*="/iad/kaufen-und-verkaufen/"]').forEach(function (link) {
            var url = link.href;
            if (urlRegex.test(url) && !uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                var container = link.closest('article, div[class*="box"], [data-testid*="search-result"], .ad-item, .list-item');
                uniqueAds.push(container || link);
            }
        });
        if (uniqueAds.length > 0) {
            Logger.log('Found ' + uniqueAds.length + ' ads (fallback method)');
            return { adEntries: uniqueAds };
        }
        return null;
    }

    function wh_extractBasicInfo(ad) {
        var title = 'Title not available';
        [].concat(['h3', 'h2', '[data-testid*="title"]']).forEach(function (s) {
            var el = ad.querySelector(s);
            if (el) {
                var text = el.textContent.trim();
                if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) title = text;
            }
        });
        var price = 'Price not available';
        var spans = ad.querySelectorAll('span, div, p');
        for (var pi = 0; pi < spans.length; pi++) {
            var text = spans[pi].textContent.trim();
            if ((text.indexOf('€') !== -1 || text.indexOf('EUR') !== -1) && text.length < 20 && text.indexOf('...') === -1) {
                price = text; break;
            }
        }
        var url = ad.href || (ad.querySelector('a[href*="/iad/"]') ? ad.querySelector('a[href*="/iad/"]').href : 'URL not available');
        return { title: title, price: price, url: url };
    }

    function wh_descSelectors() {
        return [
            '[data-testid="ad-description-Beschreibung"]',
            '[data-testid*="description"]',
            '.ad-description',
            '[class*="description"]'
        ];
    }

    function wh_goToNextPage(settings) {
        var nextButton = document.querySelector('[data-testid="pagination-bottom-next-button"]');
        if (!nextButton) {
            var targetPage = currentPage + 1;
            var paginationLinks = document.querySelectorAll('[data-testid*="pagination"] a, nav a');
            for (var li = 0; li < paginationLinks.length; li++) {
                var btn = paginationLinks[li];
                var text = (btn.textContent || '').trim();
                var href = btn.getAttribute('href');
                if (text && (
                    text === String(targetPage) ||
                    text.toLowerCase().indexOf('weiter') !== -1 ||
                    text.toLowerCase().indexOf('next') !== -1 ||
                    text === '›' || text === '>'
                )) {
                    if (!btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true' && href) {
                        nextButton = btn; break;
                    }
                }
            }
        }
        if (nextButton) {
            var isDisabled = nextButton.hasAttribute('disabled');
            var ariaDisabled = nextButton.getAttribute('aria-disabled') === 'true';
            var href = nextButton.getAttribute('href');
            Logger.log('Next button disabled:', isDisabled, '| aria-disabled:', ariaDisabled, '| href:', href);
            if (!isDisabled && !ariaDisabled && href) {
                try {
                    if (new URL(href, location.href).href === location.href) {
                        Logger.log('Next button points to same page - skipped');
                        return false;
                    }
                } catch (e) {
                    Logger.warn('Invalid URL in next button:', href, e);
                    return false;
                }
                saveCrawlStateAndNavigate(href, settings);
                return true;
            }
            Logger.log('Next button not usable');
        }
        return false;
    }

    // ==================== SITE-SPECIFIC: KLEINANZEIGEN ====================

    function ka_findCurrentSelectors() {
        var adSelectors = ['article[data-adid]', 'li.ad-listitem', '.aditem'];
        for (var si = 0; si < adSelectors.length; si++) {
            var entries = document.querySelectorAll(adSelectors[si]);
            if (entries.length > 0) {
                Logger.log('Found ' + entries.length + ' ads (selector: ' + adSelectors[si] + ')');
                return { adEntries: entries };
            }
        }
        var uniqueUrls = new Set();
        var uniqueAds = [];
        var urlRegex = /\/s-anzeige\/.*\/\d+/;
        document.querySelectorAll('a[href*="/s-anzeige/"]').forEach(function (link) {
            var url = link.href;
            if (urlRegex.test(url) && !uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                var container = link.closest('article, li, .aditem, .ad-listitem, [data-adid]');
                uniqueAds.push(container || link);
            }
        });
        if (uniqueAds.length > 0) {
            Logger.log('Found ' + uniqueAds.length + ' ads (fallback method)');
            return { adEntries: uniqueAds };
        }
        return null;
    }

    function ka_extractBasicInfo(ad) {
        var title = 'Title not available';
        [].concat(['h2', 'h3', 'a[class*="ellipsis"]', '[class*="title"]']).forEach(function (s) {
            var el = ad.querySelector(s);
            if (el) {
                var text = el.textContent.trim();
                if (text.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text)) title = text;
            }
        });
        var price = 'Price not available';
        var spans = ad.querySelectorAll('span, div, p, strong');
        for (var pi = 0; pi < spans.length; pi++) {
            var text = spans[pi].textContent.trim();
            if ((text.indexOf('€') !== -1 || text.indexOf('EUR') !== -1 || /^(\d[\d.,]*\s*€?\s*)?VB$/i.test(text.trim())) && text.length < 30 && text.indexOf('...') === -1) {
                price = text; break;
            }
        }
        var url = ad.getAttribute('data-href') || ad.href || (ad.querySelector('a[href*="/s-anzeige/"]') ? ad.querySelector('a[href*="/s-anzeige/"]').href : 'URL not available');
        if (url && url.indexOf('/') === 0) {
            url = 'https://www.kleinanzeigen.de' + url;
        }
        return { title: title, price: price, url: url };
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
        var nextButton = document.querySelector('a[class*="pagination-next"]');
        if (!nextButton) {
            var paginationLinks = document.querySelectorAll('[class*="pagination"] a, nav a, .pagination a');
            for (var li = 0; li < paginationLinks.length; li++) {
                var linkEl = paginationLinks[li];
                var text = (linkEl.textContent || '').trim().toLowerCase();
                var href = linkEl.getAttribute('href');
                if ((text === 'weiter' || text === '>' || text === '›') && href && href.indexOf('seite:') !== -1) {
                    nextButton = linkEl; break;
                }
            }
        }
        if (!nextButton) {
            var targetPage = currentPage + 1;
            var seiteLinks = document.querySelectorAll('a[href*="seite:"]');
            for (var sl = 0; sl < seiteLinks.length; sl++) {
                var href = seiteLinks[sl].getAttribute('href');
                if (href && href.indexOf('seite:' + targetPage) !== -1) {
                    nextButton = seiteLinks[sl]; break;
                }
            }
        }
        if (nextButton) {
            var href = nextButton.getAttribute('href');
            Logger.log('Next button href:', href);
            if (href) {
                try {
                    if (new URL(href, location.href).href === location.href) {
                        Logger.log('Next button points to same page - skipped');
                        return false;
                    }
                } catch (e) {
                    Logger.warn('Invalid URL in next button:', href, e);
                    return false;
                }
                saveCrawlStateAndNavigate(href, settings);
                return true;
            }
            Logger.log('Next button has no href');
        }
        return false;
    }

    // ==================== DISPATCHERS ====================

    function findCurrentSelectors() {
        return IS_WH ? wh_findCurrentSelectors() : ka_findCurrentSelectors();
    }

    function extractBasicInfo(ad) {
        return IS_WH ? wh_extractBasicInfo(ad) : ka_extractBasicInfo(ad);
    }

    function goToNextPage(settings) {
        Logger.log('Searching for next button...');
        var result = IS_WH ? wh_goToNextPage(settings) : ka_goToNextPage(settings);
        if (!result) Logger.log('No more pages available - ending crawl');
        return result;
    }

    // Save crawl state and navigate to next page
    function saveCrawlStateAndNavigate(href, settings) {
        var state = {
            currentPage: currentPage,
            currentUrl: window.location.href,
            allTopDeals: allTopDeals,
            maxPages: settings.maxPages
        };
        // Use sync GM_setValue for reliable persistence before navigation
        GM_setValue(P + '_dealfinder_crawl_state', JSON.stringify(state));
        window.location.href = href;
    }

    // ==================== DESCRIPTION FETCHING ====================

    function fetchFullDescription(url, retryCount) {
        retryCount = retryCount || 0;
        if (descriptionCache.has(url)) {
            var desc = descriptionCache.get(url);
            descriptionCache['delete'](url);
            descriptionCache.set(url, desc);
            return Promise.resolve({ success: true, description: desc });
        }
        var descSelectors = IS_WH ? wh_descSelectors() : ka_descSelectors();
        return new Promise(function (resolve) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: REQUEST_TIMEOUT,
                onload: function (response) {
                    try {
                        if (response.status >= 200 && response.status < 300) {
                            var parser = new DOMParser();
                            var doc = parser.parseFromString(response.responseText, 'text/html');
                            var fullDesc = null;
                            for (var si = 0; si < descSelectors.length; si++) {
                                var element = doc.querySelector(descSelectors[si]);
                                if (element && element.textContent.trim().length > 20) {
                                    fullDesc = element.textContent.replace(/\s+/g, ' ').trim();
                                    break;
                                }
                            }
                            if (fullDesc) {
                                if (descriptionCache.size >= MAX_CACHE_SIZE) {
                                    var firstKey = descriptionCache.keys().next().value;
                                    descriptionCache['delete'](firstKey);
                                }
                                descriptionCache.set(url, fullDesc);
                                resolve({ success: true, description: fullDesc });
                                return;
                            } else if (retryCount < MAX_RETRIES && !shouldStop) {
                                setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
                                return;
                            }
                        } else if (retryCount < MAX_RETRIES && !shouldStop) {
                            setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
                            return;
                        }
                    } catch (e) {
                        if (retryCount < MAX_RETRIES && !shouldStop) {
                            setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
                            return;
                        }
                    }
                    resolve({ success: false, description: 'Description not available' });
                },
                onerror: function () {
                    if (retryCount < MAX_RETRIES && !shouldStop) {
                        setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
                    } else {
                        resolve({ success: false, description: 'Description not available' });
                    }
                },
                ontimeout: function () {
                    if (retryCount < MAX_RETRIES && !shouldStop) {
                        setTimeout(function () { fetchFullDescription(url, retryCount + 1).then(resolve); }, 1000);
                    } else {
                        resolve({ success: false, description: 'Description not available' });
                    }
                }
            });
        });
    }

    // ==================== GEMINI MODEL UI ====================

    function fetchGeminiModels(apiKey) {
        var area = document.getElementById(P + '-model-area');
        if (!area) return;
        area.innerHTML = '<small style="color:#aaa;font-size:12px;">Loading models...</small>';

        var req = GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://generativelanguage.googleapis.com/v1beta/models',
            timeout: REQUEST_TIMEOUT,
            headers: { 'x-goog-api-key': apiKey },
            onload: function (response) {
                try {
                    if (response.status !== 200) {
                        Logger.error('Models API error:', response.status);
                        throw new Error('HTTP ' + response.status);
                    }
                    var data = JSON.parse(response.responseText);
                    var modelIds = (data.models || [])
                        .filter(function (m) {
                            return Array.isArray(m.supportedGenerationMethods) &&
                                m.supportedGenerationMethods.indexOf('generateContent') !== -1 &&
                                m.name.indexOf('gemini') !== -1;
                        })
                        .map(function (m) { return m.name.replace('models/', ''); });
                    if (modelIds.length === 0) throw new Error('No Gemini models found');
                    saveAvailableModels(modelIds);
                    showModelMapper(modelIds);
                } catch (e) {
                    restoreModelSelect();
                    Logger.error('Failed to load models:', e);
                    if (area) {
                        var hint = area.querySelector('small');
                        if (hint) hint.textContent = 'Error: ' + e.message;
                    }
                }
            },
            onerror: function () { restoreModelSelect(); },
            ontimeout: function () { restoreModelSelect(); }
        });
    }

    function showModelMapper(modelIds) {
        var area = document.getElementById(P + '-model-area');
        if (!area) return;
        var mapping = (cachedSettings && cachedSettings.modelMapping) || DEFAULT_SETTINGS.modelMapping;

        var html = '<div style="border:1px solid #e0e0e0;border-radius:4px;padding:12px;background:#fafafa;">';
        html += '<div style="font-size:11px;color:#888;margin-bottom:10px;font-weight:600;">Which model maps to...</div>';
        var modelKeys = Object.keys(GEMINI_MODELS);
        for (var ki = 0; ki < modelKeys.length; ki++) {
            var key = modelKeys[ki];
            var m = GEMINI_MODELS[key];
            var currentVal = mapping[key] || m.id;
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
            html += '<span style="font-size:13px;font-weight:600;color:#444;min-width:70px;">' + m.icon + ' ' + m.label + '</span>';
            html += '<select id="' + P + '-map-' + key + '" style="flex:1;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;background:white;">';
            for (var mi = 0; mi < modelIds.length; mi++) {
                var selected = currentVal === modelIds[mi] ? ' selected' : '';
                html += '<option value="' + escapeHTML(modelIds[mi]) + '"' + selected + '>' + escapeHTML(modelIds[mi]) + '</option>';
            }
            html += '</select></div>';
        }
        html += '<div style="display:flex;gap:8px;margin-top:10px;">';
        html += '<button id="' + P + '-map-save" style="flex:1;padding:7px;background:#28a745;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">Save</button>';
        html += '<button id="' + P + '-map-cancel" style="padding:7px 14px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:13px;cursor:pointer;color:#555;">Cancel</button>';
        html += '</div></div>';
        area.innerHTML = html;

        function saveModelMapping(showFeedback) {
            showFeedback = showFeedback || false;
            var s = JSON.parse(JSON.stringify(cachedSettings || DEFAULT_SETTINGS));
            s.modelMapping = s.modelMapping || {};
            modelKeys.forEach(function (k) {
                var sel = document.getElementById(P + '-map-' + k);
                if (sel) s.modelMapping[k] = sel.value;
            });
            // Persist synchronously for reliability
            GM_setValue(P + '_dealfinder_settings', JSON.stringify(s));
            cachedSettings = s;
            Logger.log('Model mapping saved:', s.modelMapping);

            if (showFeedback) {
                var saveBtn = document.getElementById(P + '-map-save');
                if (saveBtn) {
                    var orig = saveBtn.textContent;
                    saveBtn.textContent = 'Saved!';
                    saveBtn.style.background = '#28a745';
                    setTimeout(function () {
                        saveBtn.textContent = orig;
                        restoreModelSelect();
                    }, 800);
                } else {
                    restoreModelSelect();
                }
            }
        }

        modelKeys.forEach(function (k) {
            var sel = document.getElementById(P + '-map-' + k);
            if (sel) {
                sel.addEventListener('change', function () {
                    saveModelMapping(false);
                    var indicatorId = P + '-map-indicator-' + k;
                    var indicator = document.getElementById(indicatorId);
                    if (!indicator) {
                        var div = document.createElement('div');
                        div.id = indicatorId;
                        div.style.cssText = 'position:absolute;top:-20px;right:0;font-size:11px;color:#28a745;';
                        sel.parentNode.style.position = 'relative';
                        sel.parentNode.appendChild(div);
                    }
                    document.getElementById(indicatorId).textContent = 'auto-saved';
                    setTimeout(function () { document.getElementById(indicatorId).textContent = ''; }, 1500);
                });
            }
        });

        var mapSaveBtn = document.getElementById(P + '-map-save');
        if (mapSaveBtn) mapSaveBtn.addEventListener('click', function () { saveModelMapping(true); });
        var mapCancelBtn = document.getElementById(P + '-map-cancel');
        if (mapCancelBtn) mapCancelBtn.addEventListener('click', restoreModelSelect);
    }

    function restoreModelSelect() {
        var area = document.getElementById(P + '-model-area');
        if (!area) return;
        var settings = cachedSettings || DEFAULT_SETTINGS;
        var html = '<div style="display:flex;gap:8px;align-items:center;">';
        html += '<select id="' + P + '-model-select" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;background:white;cursor:pointer;color:#333;">';
        var modelKeys = Object.keys(GEMINI_MODELS);
        for (var ki = 0; ki < modelKeys.length; ki++) {
            var key = modelKeys[ki];
            var m = GEMINI_MODELS[key];
            var selected = settings.model === key ? ' selected' : '';
            var modelId = (settings.modelMapping && settings.modelMapping[key]) || m.id;
            html += '<option value="' + key + '"' + selected + '>' + m.icon + ' ' + m.label + ' - ' + escapeHTML(modelId) + '</option>';
        }
        html += '</select>';
        html += '<button id="' + P + '-load-models-btn" title="Change model assignment" style="padding:8px 11px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:15px;cursor:pointer;line-height:1;color:#555;">↻</button>';
        html += '</div>';
        html += '<small style="color:#aaa;font-size:11px;display:block;margin-top:4px;">Click ↻ to assign which Gemini model goes with Flash/Pro/Lite</small>';
        area.innerHTML = html;

        var sel = document.getElementById(P + '-model-select');
        if (sel) {
            sel.addEventListener('change', function () {
                var s = JSON.parse(JSON.stringify(cachedSettings || DEFAULT_SETTINGS));
                s.model = sel.value;
                GM_setValue(P + '_dealfinder_settings', JSON.stringify(s));
                cachedSettings = s;
            });
        }
        var loadBtn = document.getElementById(P + '-load-models-btn');
        var apiKeyEl = document.getElementById(P + '-api-key');
        if (loadBtn && apiKeyEl) {
            loadBtn.addEventListener('click', function () {
                var key = apiKeyEl.value.trim();
                if (key) fetchGeminiModels(key);
            });
        }
    }

    // ==================== GEMINI API ====================

    function computePriceStats(adsData) {
        var prices = [];
        for (var ai = 0; ai < adsData.length; ai++) {
            var ad = adsData[ai];
            var match = (ad.price || '')
                .replace(/\./g, '')
                .replace(/,/g, '.')
                .match(/(\d+(?:\.\d+)?)/);
            if (match) {
                var p = parseFloat(match[1]);
                if (p > 0) prices.push(p);
            }
        }
        if (prices.length === 0) return null;
        var sorted = prices.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(sorted.length / 2);
        var median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        var sum = 0;
        for (var si = 0; si < prices.length; si++) sum += prices[si];
        var mean = sum / prices.length;
        return { min: sorted[0], max: sorted[sorted.length - 1], mean: Math.round(mean), median: Math.round(median), count: prices.length };
    }

    function callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount, onRetry) {
        modelKey = modelKey || MODEL.FLASH;
        retryCount = retryCount || 0;
        onRetry = onRetry || null;
        return new Promise(function (resolve, reject) {
            var mapping = (cachedSettings && cachedSettings.modelMapping) || DEFAULT_SETTINGS.modelMapping;
            var slotConfig = GEMINI_MODELS[modelKey];
            var modelId = (mapping && mapping[modelKey]) || (slotConfig ? slotConfig.id : modelKey);
            var modelUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent';
            Logger.log('Using model:', modelId);

            var stats = computePriceStats(adsData);
            var statsSection = stats ? '\n\n## Price Distribution\n- Min: ' + stats.min + ' EUR\n- Max: ' + stats.max + ' EUR\n- Avg: ' + stats.mean + ' EUR\n- Median: ' + stats.median + ' EUR\n- Listings with price: ' + stats.count : '';

            var prompt = 'You are a deal and price analysis expert.\n\nSEARCH CONTEXT: ' + searchContext + '\n\nTASK:\nAnalyze the following ' + SITE_NAME + ' listings and find the ' + topX + ' BEST deals.\n\nCRITERIA for a good deal:\n- 35-90% below the usual new price\n- Guaranteed profit on resale possible\n- MUST BUY quality\n- Real added value for the buyer' + statsSection + '\n\nLISTINGS:\n';

            for (var adi = 0; adi < adsData.length; adi++) {
                var ad = adsData[adi];
                prompt += '\nListing ' + (adi + 1) + ':\nTitle: ' + (ad.title || '') + '\nPrice: ' + (ad.price || '') + '\nDescription: ' + ((ad.description || '').substring(0, 400)) + '\nURL: ' + (ad.url || '') + '\n---\n';
            }

            prompt += '\nRESPONSE FORMAT (JSON ONLY, NO EXTRA TEXT):\n{\n  "topDeals": [\n    {\n      "title": "...",\n      "price": "...",\n      "description": "...",\n      "url": "...",\n      "reasoning": "Why is this a top deal? (1-2 sentences)",\n      "score": 85\n    }\n  ]\n}\n\nSort the top ' + topX + ' deals by quality (best first). Score is 0-100 (100 = absolute bargain).';

            var baseTokens = 2048;
            var tokensPerDeal = 150;
            var requiredTokens = Math.max(baseTokens, adsData.length * tokensPerDeal + 500);
            var maxOutputTokens = Math.min(8192, requiredTokens);

            var requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: maxOutputTokens,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'object',
                        properties: {
                            topDeals: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        price: { type: 'string' },
                                        description: { type: 'string' },
                                        url: { type: 'string' },
                                        score: { type: 'number' },
                                        reasoning: { type: 'string' }
                                    },
                                    required: ['title', 'price', 'description', 'url', 'score', 'reasoning']
                                }
                            }
                        },
                        required: ['topDeals']
                    }
                }
            };

            var req = GM_xmlhttpRequest({
                method: 'POST',
                url: modelUrl,
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                data: JSON.stringify(requestBody),
                timeout: GEMINI_API_TIMEOUT,
                onload: function (response) {
                    try {
                        if (response.status === 200) {
                            var data = JSON.parse(response.responseText);
                            var finishReason = data.candidates && data.candidates[0] ? data.candidates[0].finishReason : null;
                            Logger.log('Gemini finishReason:', finishReason);

                            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
                                var reason = finishReason || 'UNKNOWN';
                                if (reason === 'SAFETY' || reason === 'RECITATION') {
                                    reject(new Error('Gemini: Content blocked (' + reason + ')'));
                                } else {
                                    reject(new Error('Gemini: No content (finishReason: ' + reason + ')'));
                                }
                                return;
                            }

                            var parts = data.candidates[0].content.parts;
                            var fullText = '';
                            for (var pi = 0; pi < parts.length; pi++) {
                                fullText += parts[pi].text || '';
                            }
                            Logger.log('AI response (' + parts.length + ' parts, ' + fullText.length + ' chars)');

                            if (finishReason === 'MAX_TOKENS') {
                                Logger.warn('Response truncated at MAX_TOKENS');
                            }

                            try {
                                var parsed = JSON.parse(fullText);
                                if (parsed.topDeals) {
                                    Logger.log('Direct JSON parsed successfully');
                                    resolve(parsed);
                                    return;
                                }
                            } catch (e) {}

                            // Try JSON code block extraction
                            var jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
                            var jsonText = jsonMatch ? jsonMatch[1] : null;

                            // Try raw JSON extraction
                            if (!jsonText) {
                                var rawMatch = fullText.match(/(\{[\s\S]*\})/);
                                if (rawMatch) jsonText = rawMatch[1];
                            }

                            if (jsonText) {
                                try {
                                    resolve(JSON.parse(jsonText));
                                    return;
                                } catch (parseError) {
                                    Logger.error('JSON parse error:', parseError);
                                }
                            }

                            Logger.error('No JSON found in response');
                            if (retryCount < MAX_RETRIES && !shouldStop) {
                                var delay = addJitter(RETRY_BASE_DELAY, 0.5);
                                setTimeout(function () {
                                    callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve)['catch'](reject);
                                }, delay);
                            } else {
                                reject(new Error('No JSON in AI response'));
                            }
                        } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                            Logger.error('Final error (no retry) - Status:', response.status);
                            reject(new Error('Gemini API error: ' + response.status));
                        } else if (response.status === 429 || response.status === 503) {
                            if (retryCount < RATE_LIMIT_MAX_RETRIES) {
                                var delay = RATE_LIMIT_BASE_DELAY * Math.pow(2, retryCount);
                                var serverDictated = false;
                                if (response.responseHeaders) {
                                    var raMatch = response.responseHeaders.match(/retry-after:\s*(\d+)/i);
                                    if (raMatch) {
                                        var seconds = parseInt(raMatch[1], 10);
                                        if (!isNaN(seconds)) {
                                            delay = seconds * 1000;
                                            serverDictated = true;
                                        }
                                    }
                                }
                                delay = addJitter(delay, JITTER_FACTOR);
                                if (!serverDictated) delay = Math.min(delay, MAX_RATE_LIMIT_DELAY);
                                Logger.log('Rate limit', response.status, '- Retry', (retryCount + 1), 'in', Math.round(delay), 'ms');
                                if (onRetry) onRetry(response.status, retryCount + 1, Math.round(delay / 1000));
                                if (shouldStop) { reject(new Error('Aborted')); return; }
                                setTimeout(function () {
                                    callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve)['catch'](reject);
                                }, delay);
                            } else {
                                reject(new Error('Gemini API error: ' + response.status));
                            }
                        } else if (retryCount < MAX_RETRIES) {
                            Logger.log('API error', response.status, '- Retry', (retryCount + 1));
                            if (onRetry) onRetry(response.status, retryCount + 1, 2);
                            if (shouldStop) { reject(new Error('Aborted')); return; }
                            setTimeout(function () {
                                callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve)['catch'](reject);
                            }, addJitter(RETRY_BASE_DELAY, 0.5));
                        } else {
                            Logger.error('Final error - Status:', response.status);
                            reject(new Error('Gemini API error: ' + response.status));
                        }
                    } catch (error) {
                        if (shouldStop) { reject(new Error('Aborted')); return; }
                        if (retryCount < MAX_RETRIES) {
                            setTimeout(function () {
                                callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve)['catch'](reject);
                            }, addJitter(RETRY_BASE_DELAY, 0.5));
                        } else {
                            reject(error);
                        }
                    }
                },
                onerror: function () {
                    if (shouldStop) { reject(new Error('Aborted')); return; }
                    if (retryCount < MAX_RETRIES) {
                        if (onRetry) onRetry('network_error', retryCount + 1, 2);
                        setTimeout(function () {
                            callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve)['catch'](reject);
                        }, addJitter(RETRY_BASE_DELAY, 0.5));
                    } else {
                        reject(new Error('Network error in Gemini API'));
                    }
                },
                ontimeout: function () {
                    if (shouldStop) { reject(new Error('Aborted')); return; }
                    if (retryCount < MAX_RETRIES) {
                        if (onRetry) onRetry('timeout', retryCount + 1, 2);
                        setTimeout(function () {
                            callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount + 1, onRetry).then(resolve)['catch'](reject);
                        }, addJitter(RETRY_BASE_DELAY, 0.5));
                    } else {
                        reject(new Error('Timeout in Gemini API'));
                    }
                }
            });
        });
    }

    // ==================== MAIN CRAWL LOGIC ====================

    async function startDealFinder() {
        var apiKey = document.getElementById(P + '-api-key').value.trim();
        var searchContext = document.getElementById(P + '-search-context').value.trim();
        var topX = parseInt(document.getElementById(P + '-top-x').value);
        var maxPages = parseInt(document.getElementById(P + '-max-pages').value) || 10;
        var modelEl = document.getElementById(P + '-model-select');
        var model = modelEl ? modelEl.value : MODEL.FLASH;

        if (!apiKey) { alert('Bitte gib deinen Gemini API Key ein!'); return; }
        if (!searchContext) { alert('Bitte gib einen Suchkontext ein!'); return; }
        if (!Number.isFinite(topX) || topX < 1 || topX > 10) { alert('AI-Picks muss zwischen 1 und 10 liegen!'); return; }
        if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 100) { alert('Maximale Seiten muss zwischen 1 und 100 liegen!'); return; }

        var currentSettings = await loadSettings();
        currentSettings.apiKey = apiKey;
        currentSettings.searchContext = searchContext;
        currentSettings.topX = topX;
        currentSettings.model = model;
        currentSettings.maxPages = maxPages;
        await saveSettings(currentSettings);

        if ('Notification' in window) {
            Notification.requestPermission()['catch'](function () {});
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
            Logger.error('Error:', error);
            updateProgress('Fehler: ' + error.message, 0, 'error');
            if (allTopDeals.length > 0) {
                await finishDealFinder();
            } else {
                resetUI();
                alert('Fehler: ' + error.message);
            }
        }
    }

    function pauseDealFinder() {
        isPaused = true;
        var pauseBtn = document.getElementById(P + '-pause-btn');
        if (!pauseBtn) return;
        pauseBtn.textContent = 'Fortsetzen';
        pauseBtn.style.background = '#28a745';
        pauseBtn.removeEventListener('click', pauseDealFinder);
        pauseBtn.addEventListener('click', resumeDealFinder);
        updateProgress('Pausiert - Klicke Fortsetzen...', 50, 'warning');
    }

    function resumeDealFinder() {
        isPaused = false;
        var pauseBtn = document.getElementById(P + '-pause-btn');
        if (!pauseBtn) return;
        pauseBtn.textContent = 'Pause';
        pauseBtn.style.background = '#ffc107';
        pauseBtn.removeEventListener('click', resumeDealFinder);
        pauseBtn.addEventListener('click', pauseDealFinder);

        if (isRunning && captchaPaused) {
            captchaPaused = false;
            var settings = cachedSettings || DEFAULT_SETTINGS;
            var maxPages = settings.maxPages || 10;
            processCurrentPage(settings.apiKey, settings.searchContext, settings.topX, settings.model || MODEL.FLASH, maxPages)
                ['catch'](function (error) {
                    Logger.error('Resume error:', error);
                    updateProgress('Fehler: ' + error.message, 0, 'error');
                    resetUI();
                });
        }
    }

    function stopDealFinder() {
        shouldStop = true;
        isPaused = false;
        captchaPaused = false;
        GM_setValue(P + '_dealfinder_crawl_state', null);
        Logger.log('Crawl stopped by user');
        updateProgress('Stoppe nach aktueller Seite...', 95, 'warning');
    }

    async function processCurrentPage(apiKey, searchContext, topX, model, maxPages) {
        maxPages = maxPages || 10;
        await waitIfPaused();
        if (shouldStop) { await finishDealFinder(); return; }

        if (currentPage > maxPages) { await finishDealFinder(); return; }

        updateProgress('Seite ' + currentPage + ': Lade alle Anzeigen...', 10, 'info');
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await new Promise(function (r) { setTimeout(r, 1500); });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await new Promise(function (r) { setTimeout(r, 1500); });

        updateProgress('Seite ' + currentPage + ': Sammle Anzeigen...', 15, 'info');
        var selectors = findCurrentSelectors();
        if (!selectors) {
            var pageText = (document.title + ' ' + document.body.innerText).toLowerCase();
            if (pageText.indexOf('captcha') !== -1 || pageText.indexOf('challenge') !== -1) {
                captchaPaused = true;
                await saveCrawlState({
                    currentPage: currentPage,
                    currentUrl: window.location.href,
                    allTopDeals: allTopDeals,
                    maxPages: maxPages
                });
                pauseDealFinder();
                updateProgress('CAPTCHA erkannt! Bitte loesen und Fortsetzen klicken', 50, 'warning');
                return;
            }
            throw new Error('Keine Anzeigen gefunden');
        }

        updateProgress('Seite ' + currentPage + ': Sammle Basis-Daten...', 20, 'info');
        var seenUrls = new Set();
        var adsData = [];
        var adArray = Array.from(selectors.adEntries);
        for (var adi = 0; adi < adArray.length; adi++) {
            var info = extractBasicInfo(adArray[adi]);
            if (!seenUrls.has(info.url)) {
                seenUrls.add(info.url);
                adsData.push(info);
            }
        }
        Logger.log(adsData.length + ' ads found (deduplicated)');

        updateProgress('Seite ' + currentPage + ': Lade Details (0/' + adsData.length + ')...', 30, 'info');
        var completedCount = 0;

        for (var bi = 0; bi < adsData.length; bi += INITIAL_BATCH_SIZE) {
            await waitIfPaused();
            if (shouldStop) break;

            var batch = adsData.slice(bi, Math.min(bi + INITIAL_BATCH_SIZE, adsData.length));
            var batchFns = [];
            for (var bj = 0; bj < batch.length; bj++) {
                var adData = batch[bj];
                var index = bi + bj;
                (function (idx, url) {
                    var fetchPromise = url && url.indexOf('http') === 0
                        ? fetchFullDescription(url)
                        : Promise.resolve({ success: false, description: 'Description not available' });
                    batchFns.push(fetchPromise.then(function (result) {
                        completedCount++;
                        if (completedCount % 5 === 0 || completedCount === adsData.length) {
                            updateProgress('Seite ' + currentPage + ': Lade Details (' + completedCount + '/' + adsData.length + ')...', 30 + (completedCount / adsData.length) * 40, 'info');
                        }
                        adsData[idx].description = result.description;
                    }));
                })(index, adData.url);
            }
            await Promise.all(batchFns);

            if (bi + INITIAL_BATCH_SIZE < adsData.length) {
                await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 1000); });
            }
        }

        if (shouldStop) { await finishDealFinder(); return; }

        var modelName = GEMINI_MODELS[model] ? GEMINI_MODELS[model].name : model;
        updateProgress('Seite ' + currentPage + ': AI analysiert Angebote...', 75, 'info');
        Logger.log('Sending ' + adsData.length + ' listings to ' + modelName + '...');

        var onRetry = function (status, retryNum, delaySeconds) {
            var statusText = typeof status === 'number' ? 'HTTP ' + status : status;
            showWarning('API ' + statusText + ' - Retry ' + retryNum + ' in ' + delaySeconds + 's...', 75);
        };

        var aiResult = null;
        try {
            aiResult = await callGeminiAPI(adsData, searchContext, topX, apiKey, model, 0, onRetry);
        } catch (error) {
            if (error.message === 'Aborted' || shouldStop) {
                await finishDealFinder();
                return;
            }
            throw error;
        }

        if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
            Logger.log('AI found ' + aiResult.topDeals.length + ' top deals');
            for (var tdi = 0; tdi < aiResult.topDeals.length; tdi++) {
                var deal = aiResult.topDeals[tdi];
                deal.page = currentPage;
                allTopDeals.push(deal);
            }
            updateProgress('Seite ' + currentPage + ': ' + aiResult.topDeals.length + ' Top-Deals gefunden!', 90, 'success');
            updateLiveRanking();
        }

        await new Promise(function (r) { setTimeout(r, 1500); });

        if (!shouldStop && goToNextPage({ apiKey: apiKey, searchContext: searchContext, topX: topX, model: model, maxPages: maxPages })) {
            // Navigation triggers page reload; execution continues in resumeCrawlIfActive
        } else {
            await finishDealFinder();
        }
    }

    async function finishDealFinder() {
        updateProgress('Erstelle finale Ranking-Liste...', 95, 'info');
        await clearCrawlState();

        if (allTopDeals.length === 0) {
            updateProgress('Keine Deals gefunden!', 100, 'error');
            alert('Keine Top-Deals gefunden! Versuche andere Suchkriterien.');
            resetUI();
            return;
        }

        if (shouldStop) {
            updateProgress('Crawl gestoppt. Speichere bisherige Deals...', 100, 'warning');
            await saveResults({ deals: allTopDeals, pages: currentPage, timestamp: new Date().toISOString() });
            switchToResultsView();
            resetUI();
            return;
        }

        // Deduplicate across pages
        var uniqueDealsMap = new Map();
        for (var di = 0; di < allTopDeals.length; di++) {
            var d = allTopDeals[di];
            if (!uniqueDealsMap.has(d.url)) uniqueDealsMap.set(d.url, d);
        }
        allTopDeals = Array.from(uniqueDealsMap.values());

        // Global re-ranking across all collected deals
        if (allTopDeals.length > 1) {
            try {
                var settings = cachedSettings || DEFAULT_SETTINGS;
                updateProgress('Globales Re-Ranking aller Deals...', 97, 'info');

                var onRetry = function (status, retryNum, delaySeconds) {
                    var statusText = typeof status === 'number' ? 'HTTP ' + status : status;
                    showWarning('Global Re-Ranking: API ' + statusText + ' - Retry ' + retryNum + ' in ' + delaySeconds + 's...', 97);
                };

                var sortedTopDeals = sortDealsByScore(allTopDeals);
                var dealsToReRank = sortedTopDeals.slice(0, RE_RANK_MAX_DEALS);

                var reRankResult = await callGeminiAPI(
                    dealsToReRank.map(function (d) {
                        return { title: d.title, price: d.price, description: (d.description || '').substring(0, 400), url: d.url };
                    }),
                    settings.searchContext || '',
                    dealsToReRank.length,
                    settings.apiKey,
                    settings.model || MODEL.FLASH,
                    0,
                    onRetry
                );

                if (reRankResult && reRankResult.topDeals && reRankResult.topDeals.length > 0) {
                    // Build lookup maps for canonical data
                    var urlToDeal = new Map();
                    var titleToDeal = new Map();
                    for (var ri = 0; ri < dealsToReRank.length; ri++) {
                        urlToDeal.set(dealsToReRank[ri].url, dealsToReRank[ri]);
                        titleToDeal.set(dealsToReRank[ri].title, dealsToReRank[ri]);
                    }

                    var reRankedDeals = reRankResult.topDeals.map(function (rd) {
                        var orig = urlToDeal.get(rd.url) || titleToDeal.get(rd.title);
                        return {
                            title: (orig && orig.title) || rd.title,
                            price: rd.price,
                            description: (orig && orig.description) || rd.description,
                            url: (orig && orig.url) || rd.url,
                            score: rd.score,
                            reasoning: rd.reasoning,
                            page: (orig && orig.page) || 'unknown'
                        };
                    });

                    var reRankedUrls = extractSet(reRankedDeals, DEAL_KEYS.URL);
                    var remainingDeals = sortedTopDeals.filter(function (d) { return !reRankedUrls.has(d.url); });
                    allTopDeals = sortDealsByScore(reRankedDeals.concat(remainingDeals));
                    Logger.log('Global re-ranking complete (' + reRankedDeals.length + ' deals re-ranked, ' + remainingDeals.length + ' deals kept)');
                }
            } catch (e) {
                Logger.warn('Global re-ranking failed:', e);
            }
        }

        await saveResults({ deals: allTopDeals, pages: currentPage, timestamp: new Date().toISOString() });
        updateProgress(allTopDeals.length + ' Deals gespeichert!', 100, 'success');

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('Deal Finder fertig', {
                    body: allTopDeals.length + ' Deals auf ' + currentPage + ' Seiten gefunden'
                });
            } catch (e) {}
        }

        switchToResultsView();
        resetUI();
    }

    // ==================== UI STATE ====================

    function resetUI() {
        isRunning = false;
        isPaused = false;
        shouldStop = false;
        captchaPaused = false;
        descriptionCache = new Map();
        var startBtn = document.getElementById(P + '-start-btn');
        var pauseBtn = document.getElementById(P + '-pause-btn');
        var stopBtn = document.getElementById(P + '-stop-btn');
        var apiKeyInput = document.getElementById(P + '-api-key');
        var searchInput = document.getElementById(P + '-search-context');
        var topXInput = document.getElementById(P + '-top-x');
        if (startBtn) startBtn.style.display = 'block';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        if (apiKeyInput) apiKeyInput.disabled = false;
        if (searchInput) searchInput.disabled = false;
        if (topXInput) topXInput.disabled = false;
        // Clean up status bar
        if (statusBar) {
            try { statusBar.remove(); } catch (e) {}
            statusBar = null;
        }
    }

    function setUIRunningState() {
        var startBtn = document.getElementById(P + '-start-btn');
        var pauseBtn = document.getElementById(P + '-pause-btn');
        var stopBtn = document.getElementById(P + '-stop-btn');
        var apiKeyInput = document.getElementById(P + '-api-key');
        var searchInput = document.getElementById(P + '-search-context');
        var topXInput = document.getElementById(P + '-top-x');
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'block';
        if (apiKeyInput) apiKeyInput.disabled = true;
        if (searchInput) searchInput.disabled = true;
        if (topXInput) topXInput.disabled = true;
    }

    // ==================== INIT ====================

    function createDealFinderButton() {
        var buttonId = P + '-dealfinder-btn';
        if (document.getElementById(buttonId)) return;
        var button = document.createElement('button');
        button.id = buttonId;
        button.textContent = 'Deal Finder';
        button.style.cssText = [
            'position: fixed; top: 140px; right: 0; z-index: 99999;',
            'padding: 12px 16px; background: ' + BTN_GRADIENT + ';',
            'color: white; border: none; border-radius: 8px 0 0 8px; cursor: pointer;',
            'box-shadow: -3px 3px 12px rgba(0,0,0,0.25); font-size: 15px; font-weight: bold;',
            'transition: padding-right 0.2s ease, box-shadow 0.2s ease;'
        ].join(' ');
        button.addEventListener('click', openModal);
        button.addEventListener('mouseenter', function () {
            button.style.paddingRight = '22px';
            button.style.boxShadow = '-5px 4px 18px rgba(0,0,0,0.35)';
        });
        button.addEventListener('mouseleave', function () {
            button.style.paddingRight = '16px';
            button.style.boxShadow = '-3px 3px 12px rgba(0,0,0,0.25)';
        });
        document.body.appendChild(button);
        Logger.log('Deal Finder button created');
    }

    async function resumeCrawlIfActive() {
        var rawState = GM_getValue(P + '_dealfinder_crawl_state', null);
        if (!rawState) {
            Logger.log('Normal session - results preserved');
            return;
        }
        var crawlState;
        try { crawlState = JSON.parse(rawState); } catch (e) { return; }
        if (!crawlState) return;

        var normalizedCurrentUrl = normalizeUrl(crawlState.currentUrl);
        var normalizedWindowUrl = normalizeUrl(window.location.href);
        var samePage = normalizedCurrentUrl && normalizedCurrentUrl === normalizedWindowUrl;
        var pageIncrement = samePage ? SAME_PAGE_INCREMENT : NEW_PAGE_INCREMENT;
        Logger.log('Crawl state found - resuming from page ' + (crawlState.currentPage + pageIncrement) + ' (' + (samePage ? 'page reloaded' : 'navigation detected') + ')');

        currentPage = crawlState.currentPage + pageIncrement;
        allTopDeals = crawlState.allTopDeals || [];
        isRunning = true;

        openModal();

        try {
            await TM.dom.waitForElement('#' + P + '-progress-container', 2000);
        } catch (e) {
            await new Promise(function (r) { setTimeout(r, 500); });
        }

        setUIRunningState();
        updateLiveRanking();

        var settings = cachedSettings || DEFAULT_SETTINGS;
        var maxPages = crawlState.maxPages || settings.maxPages || 10;

        try {
            await processCurrentPage(settings.apiKey, settings.searchContext, settings.topX, settings.model || MODEL.FLASH, maxPages);
        } catch (error) {
            Logger.error('Error resuming:', error);
            updateProgress('Fehler: ' + error.message, 0, 'error');
            await clearCrawlState();
            if (allTopDeals.length > 0) {
                await finishDealFinder();
            } else {
                resetUI();
                alert('Fehler beim Fortsetzen: ' + error.message);
            }
        }
    }

    async function init() {
        try {
            Logger.log('Script started');

            // Pre-populate settings cache
            var rawSettings = GM_getValue(P + '_dealfinder_settings', null);
            if (rawSettings) {
                try {
                    var loaded = JSON.parse(rawSettings);
                    if (loaded.model && !GEMINI_MODELS[loaded.model]) loaded.model = MODEL.FLASH;
                    cachedSettings = deepCopySettings(Object.assign({}, DEFAULT_SETTINGS, loaded));
                } catch (e) {
                    cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
                }
            } else {
                cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
            }

            if (IS_WH) {
                var searchIndicators = ['[data-testid="result-list-title"]', '[data-testid*="search-result"]', 'a[href*="/iad/"]'];
                var hasIndicator = false;
                for (var ssi = 0; ssi < searchIndicators.length; ssi++) {
                    if (document.querySelector(searchIndicators[ssi])) { hasIndicator = true; break; }
                }
                if (!hasIndicator) {
                    if (++initRetries >= MAX_INIT_RETRIES) {
                        Logger.warn('Max init retries reached - showing button anyway');
                        await createModal();
                        createDealFinderButton();
                        return;
                    }
                    setTimeout(init, 3000);
                    return;
                }
            } else {
                try {
                    await TM.dom.waitForElement('article[data-adid], #srchrslt-adtable', 10000);
                } catch (e) {
                    Logger.log('No ad list found, retrying later');
                    if (++initRetries >= MAX_INIT_RETRIES) {
                        Logger.warn('Max init retries reached - showing button anyway');
                        await createModal();
                        createDealFinderButton();
                        return;
                    }
                    setTimeout(init, 3000);
                    return;
                }
            }

            await new Promise(function (r) { setTimeout(r, 1500); });
            await createModal();
            createDealFinderButton();
            await resumeCrawlIfActive();

        } catch (error) {
            Logger.error('Initialization error:', error);
            setTimeout(init, 3000);
        }
    }

    init();

})();

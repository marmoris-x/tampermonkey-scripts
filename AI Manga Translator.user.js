// ==UserScript==
// @name         AI Manga Translator
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Translates manga/comics on any website using gpt-4.1-mini/gemini-2.5-flash-lite vision models, with a rich UI and precise bubble placement.
// @author       AI Assistant
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.openai.com
// @connect      generativelanguage.googleapis.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const ALLOWED_SITES_KEY = 'mangaTranslatorAllowedSites';
    const allowedSites = GM_getValue(ALLOWED_SITES_KEY, []);
    const currentHost = window.location.hostname;
    const isEnabledOnSite = allowedSites.includes(currentHost);

    // --- Tampermonkey Menu Commands ---
    if (isEnabledOnSite) {
        GM_registerMenuCommand('Disable Translator on this Site', () => {
            const updatedSites = allowedSites.filter(site => site !== currentHost);
            GM_setValue(ALLOWED_SITES_KEY, updatedSites);
            alert('Manga Translator disabled for this site. The page will now reload.');
            window.location.reload();
        });
    } else {
        GM_registerMenuCommand('Enable Translator on this Site', () => {
            const updatedSites = [...allowedSites, currentHost];
            GM_setValue(ALLOWED_SITES_KEY, updatedSites);
            alert('Manga Translator enabled for this site. The page will now reload.');
            window.location.reload();
        });
    }

    // --- Gatekeeper ---
    // If the current site is not on the allowed list, stop the script immediately.
    if (!isEnabledOnSite) {
        return;
    }

    // --- Main Script Logic (only runs on allowed sites) ---

    // Inject CSS styles
    GM_addStyle(`
        /* Toggle Button */
        .manga-translator-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            z-index: 999999;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .manga-translator-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        /* Control Panel */
        .manga-translator-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 380px;
            max-height: 85vh;
            background: rgba(20, 20, 30, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 999998;
            display: none;
            overflow: hidden;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .manga-translator-panel.active {
            display: block;
        }

        .panel-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            font-size: 18px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .panel-close {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease;
        }

        .panel-close:hover {
            transform: rotate(90deg);
        }

        .panel-body {
            padding: 20px;
            overflow-y: auto;
            max-height: calc(85vh - 60px);
        }

        .panel-body::-webkit-scrollbar {
            width: 8px;
        }

        .panel-body::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        .panel-body::-webkit-scrollbar-thumb {
            background: rgba(102, 126, 234, 0.3);
            border-radius: 4px;
        }

        .panel-body::-webkit-scrollbar-thumb:hover {
            background: rgba(102, 126, 234, 0.5);
        }

        /* Form Elements */
        .form-section {
            margin-bottom: 25px;
        }

        .form-section h3 {
            color: #e2e8f0;
            margin: 0 0 15px 0;
            font-size: 16px;
            font-weight: 600;
            border-bottom: 1px solid rgba(226, 232, 240, 0.1);
            padding-bottom: 8px;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            color: #a0aec0;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .form-group input,
        .form-group select {
            width: 100%;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: #e2e8f0;
            font-size: 14px;
            transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #667eea;
            background: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .api-status {
            display: inline-block;
            margin-left: 10px;
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
        }

        .api-status.valid {
            color: #4ade80;
            background: rgba(74, 222, 128, 0.1);
        }

        .api-status.invalid {
            color: #f87171;
            background: rgba(248, 113, 113, 0.1);
        }

        /* Action Buttons */
        .action-button {
            width: 100%;
            padding: 12px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .action-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .action-button.secondary {
            background: rgba(255, 255, 255, 0.1);
        }

        .action-button.secondary:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.15);
        }

        /* Status Display */
        .status-display {
            margin-top: 20px;
            padding: 12px;
            border-radius: 6px;
            font-size: 13px;
            text-align: center;
        }

        .status-display.info {
            background: rgba(59, 130, 246, 0.1);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .status-display.success {
            background: rgba(74, 222, 128, 0.1);
            color: #4ade80;
            border: 1px solid rgba(74, 222, 128, 0.2);
        }

        .status-display.error {
            background: rgba(248, 113, 113, 0.1);
            color: #f87171;
            border: 1px solid rgba(248, 113, 113, 0.2);
        }

        /* Translation Bubbles */
        .manga-speech-bubble {
            position: absolute; /* Use absolute positioning to scroll with the page */
            background: #e7f3ff; /* Light blue background from example */
            color: #1a1a1a;
            border: 2px solid #0066cc; /* Darker blue border from example */
            border-radius: 8px; /* Slightly less rounded corners */
            padding: 8px;
            font-family: 'Comic Neue', cursive; /* New, cleaner comic font */
            font-weight: bold;
            text-transform: uppercase; /* ALL CAPS text */
            font-size: 18px;
            line-height: 1.2;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 999990;
            word-wrap: break-word;
            transition: transform 0.2s ease;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            box-sizing: border-box;
            width: auto; /* Let width be determined by content */
            max-width: 300px; /* A sensible max width */
            white-space: pre-wrap; /* Crucial for respecting manual \n */
        }

        .manga-speech-bubble:hover {
            transform: scale(1.1);
            z-index: 999991;
        }

        /* Bubble Tails */
        .manga-speech-bubble::after {
            content: '';
            position: absolute;
            width: 0;
            height: 0;
            border-style: solid;
        }

        .manga-speech-bubble.tail-top::after {
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 0 10px 10px 10px;
            border-color: transparent transparent #0066cc transparent; /* Match border color */
        }

        .manga-speech-bubble.tail-bottom::after {
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 10px 10px 0 10px;
            border-color: #0066cc transparent transparent transparent; /* Match border color */
        }

        .manga-speech-bubble.tail-left::after {
            right: 100%;
            top: 50%;
            transform: translateY(-50%);
            border-width: 10px 10px 10px 0;
            border-color: transparent #0066cc transparent transparent; /* Match border color */
        }

        .manga-speech-bubble.tail-right::after {
            left: 100%;
            top: 50%;
            transform: translateY(-50%);
            border-width: 10px 0 10px 10px;
            border-color: transparent transparent transparent #0066cc; /* Match border color */
        }

        /* Bubble Types */
        .manga-speech-bubble.thought-bubble {
            border-style: dashed;
            background: #f0f0f0;
        }

        .manga-speech-bubble.shout-bubble {
            font-weight: bold;
            font-size: 16px;
            background: #fff3cd;
            animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
        }

        .manga-speech-bubble.narration-bubble {
            border-radius: 6px;
            font-family: system-ui, -apple-system, sans-serif;
            background: #e7f3ff;
            border-color: #0066cc;
        }

        /* Debug Overlay */
        .debug-overlay {
            position: absolute;
            background: rgba(255, 0, 0, 0.2);
            border: 2px solid red;
            pointer-events: none;
            z-index: 999989;
            box-sizing: border-box;
        }
        .debug-overlay.bottom {
            background: rgba(0, 0, 255, 0.2);
            border-color: blue;
        }
        .debug-overlay.middle {
            background: rgba(0, 255, 0, 0.2);
            border-color: green;
        }

        /* Selection Overlay */
        .manga-translator-selection-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999998;
            cursor: crosshair;
        }

        .manga-translator-selection-bubble {
            position: absolute;
            background: rgba(102, 126, 234, 0.4);
            border: 2px solid #fff;
            border-radius: 15px;
            z-index: 10000000;
            display: none; /* Initially hidden */
        }

        .manga-translator-selection-bubble::after {
            content: '';
            position: absolute;
            bottom: -12px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 12px 12px 0 12px;
            border-color: #fff transparent transparent transparent;
        }
    `);

    class MangaTranslator {
        constructor() {
            // API Configuration
            this.openaiApiKey = GM_getValue('openaiApiKey', '');
            this.googleApiKey = GM_getValue('googleApiKey', '');
            this.apiProvider = GM_getValue('apiProvider', 'openai');
            this.targetLanguage = GM_getValue('targetLanguage', 'English');
            this.sourceLanguage = GM_getValue('sourceLanguage', 'Japanese');

            // State Management
            this.isActive = false;
            this.isProcessing = false;
            this.activeRequests = new Set();

            // Data Structures
            this.translationBubbles = [];
            this.processedImages = new Set();
            this.translationCache = new Map();
            this.requestQueue = [];
            this.debugOverlays = [];
            this.fixedBubbles = [];

            // UI Elements
            this.toggleButton = null;
            this.controlPanel = null;

            // Observers
            this.intersectionObserver = null;
            this.mutationObserver = null;
            this.urlObserver = null;

            // Bind methods
            this.processQueue = this.processQueue.bind(this);
            this.updateBubblePositions = this.updateBubblePositions.bind(this);
            this.handleKeyPress = this.handleKeyPress.bind(this);
            this.debouncedFindAndObserve = this.debounce(this.findAndObserveNewImages.bind(this), 500);

            // Initialize
            this.injectFonts();
            this.initUI();
            this.attachEvents();
            this.loadSettings();

            if (this.getCurrentApiKey()) {
                this.validateApiKey();
            }

            // Process queue periodically
            setInterval(this.processQueue, 500);

            console.log('AI Manga Translator initialized');
            /* GM_notification({
                text: 'AI Manga Translator loaded!',
                title: 'Manga Translator',
                timeout: 3000
            }); */

            // URL change detection
            this.lastUrl = location.href;
            // Use a MutationObserver as a more reliable way to detect page changes in SPAs
            this.urlObserver = new MutationObserver(() => {
                if (location.href !== this.lastUrl) {
                    this.lastUrl = location.href;
                    this.handlePageChange();
                }
            });
            this.urlObserver.observe(document.body, { childList: true, subtree: true });
            // Also listen to popstate for back/forward navigation
            window.addEventListener('popstate', () => this.handlePageChange());
        }

        injectFonts() {
            const fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }

        initUI() {
            // Create toggle button
            this.toggleButton = document.createElement('button');
            this.toggleButton.className = 'manga-translator-toggle';
            this.toggleButton.innerHTML = '翻';
            this.toggleButton.title = 'Toggle Manga Translator';
            document.body.appendChild(this.toggleButton);

            // Create control panel
            this.controlPanel = document.createElement('div');
            this.controlPanel.className = 'manga-translator-panel';
            this.controlPanel.innerHTML = `
                <div class="panel-header">
                    <span>AI Manga Translator</span>
                    <button class="panel-close">×</button>
                </div>
                <div class="panel-body">
                    <div class="form-section">
                        <h3>API Configuration</h3>
                        <div class="form-group">
                            <label>API Provider</label>
                            <select id="mt-api-provider">
                                <option value="openai">OpenAI (GPT-4.1-mini)</option>
                                <option value="google">Google (Gemini-2.5-flash-lite)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label id="mt-api-key-label">OpenAI API Key <span class="api-status" id="mt-api-status"></span></label>
                            <input type="password" id="mt-api-key" placeholder="Enter your API key">
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Language Settings</h3>
                        <div class="form-group">
                            <label>Source Language</label>
                            <select id="mt-source-lang">
                                <option value="Japanese">Japanese</option>
                                <option value="Korean">Korean</option>
                                <option value="Chinese">Chinese</option>
                                <option value="Auto">Auto Detect</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Target Language</label>
                            <select id="mt-target-lang">
                                <option value="English">English</option>
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="German">German</option>
                                <option value="Portuguese">Portuguese</option>
                                <option value="Russian">Russian</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Actions</h3>
                        <button class="action-button" id="mt-translate-visible">Translate Visible Images</button>
                        <button class="action-button" id="mt-auto-translate">Start Auto-Translate</button>
                        <button class="action-button" id="mt-select-translate">Select Area to Translate</button>
                        <button class="action-button secondary" id="mt-clear-bubbles">Clear All Bubbles</button>
                        <button class="action-button secondary" id="mt-debug-toggle">Toggle Debug Mode</button>
                        <button class="action-button secondary" id="mt-debug-position">Debug Position</button>
                    </div>

                    <div class="status-display info" id="mt-status">
                        Ready to translate
                    </div>
                </div>
            `;
            document.body.appendChild(this.controlPanel);
        }

        attachEvents() {
            // Toggle button
            this.toggleButton.addEventListener('click', () => {
                this.controlPanel.classList.toggle('active');
            });

            // Close button
            this.controlPanel.querySelector('.panel-close').addEventListener('click', () => {
                this.controlPanel.classList.remove('active');
            });

            // API Provider change
            document.getElementById('mt-api-provider').addEventListener('change', (e) => {
                this.apiProvider = e.target.value;
                GM_setValue('apiProvider', this.apiProvider);
                this.updateApiKeyInput();
                this.validateApiKey();
            });
            document.getElementById('mt-api-key').addEventListener('change', (e) => {
                const key = e.target.value;
                if (this.apiProvider === 'openai') {
                    this.openaiApiKey = key;
                    GM_setValue('openaiApiKey', key);
                } else {
                    this.googleApiKey = key;
                    GM_setValue('googleApiKey', key);
                }
                this.validateApiKey();
            });

            // Language settings
            document.getElementById('mt-source-lang').addEventListener('change', (e) => {
                this.sourceLanguage = e.target.value;
                GM_setValue('sourceLanguage', this.sourceLanguage);
            });

            document.getElementById('mt-target-lang').addEventListener('change', (e) => {
                this.targetLanguage = e.target.value;
                GM_setValue('targetLanguage', this.targetLanguage);
            });

            // Action buttons
            document.getElementById('mt-translate-visible').addEventListener('click', () => {
                this.translateVisibleImages();
            });

            document.getElementById('mt-auto-translate').addEventListener('click', (e) => {
                if (this.isActive) {
                    this.stopAutoTranslate();
                    e.target.textContent = 'Start Auto-Translate';
                } else {
                    this.startAutoTranslate();
                    e.target.textContent = 'Stop Auto-Translate';
                }
            });

            document.getElementById('mt-select-translate').addEventListener('click', () => {
                this.startSelectionMode();
            });

            document.getElementById('mt-clear-bubbles').addEventListener('click', () => {
                this.clearAllBubbles();
            });

            document.getElementById('mt-debug-toggle').addEventListener('click', () => {
                document.body.classList.toggle('mt-debug-mode');
            });
            document.getElementById('mt-debug-position').addEventListener('click', () => {
                this.toggleDebugPosition();
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', this.handleKeyPress);

            // Window events
            window.addEventListener('scroll', this.updateBubblePositions);
            window.addEventListener('resize', this.updateBubblePositions);
        }

        debounce(func, delay) {
            let timeout;
            return function(...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), delay);
            };
        }

        handlePageChange() {
            console.log('MangaTranslator: Page change detected.');

            const wasActive = this.isActive;
            if (wasActive) {
                this.stopAutoTranslate(true); // Pass true to signify it's a page change
            }

            this.clearAllBubbles();

            // A short delay to allow the new page's DOM to settle
            setTimeout(() => {
                if (wasActive) {
                    this.startAutoTranslate();
                } else {
                    // This fulfills the "always start new translation" part
                    this.translateVisibleImages();
                }
            }, 250);
        }

        handleKeyPress(e) {
            if (e.ctrlKey && e.shiftKey) {
                switch (e.key) {
                    case 'M':
                    case 'm':
                        e.preventDefault();
                        this.controlPanel.classList.toggle('active');
                        break;
                    case 'T':
                    case 't':
                        e.preventDefault();
                        this.translateVisibleImages();
                        break;
                }
            }
        }

        loadSettings() {
            document.getElementById('mt-api-provider').value = this.apiProvider;
            this.updateApiKeyInput();
            document.getElementById('mt-source-lang').value = this.sourceLanguage;
            document.getElementById('mt-target-lang').value = this.targetLanguage;
        }

        updateApiKeyInput() {
            const keyInput = document.getElementById('mt-api-key');
            const keyLabel = document.getElementById('mt-api-key-label');

            if (this.apiProvider === 'openai') {
                keyLabel.firstChild.textContent = 'OpenAI API Key ';
                keyInput.value = this.openaiApiKey;
                keyInput.placeholder = "Enter your OpenAI API key";
            } else {
                keyLabel.firstChild.textContent = 'Google API Key ';
                keyInput.value = this.googleApiKey;
                keyInput.placeholder = "Enter your Google API key";
            }
        }

        getCurrentApiKey() {
            return this.apiProvider === 'openai' ? this.openaiApiKey : this.googleApiKey;
        }

        updateStatus(message, type = 'info') {
            const statusEl = document.getElementById('mt-status');
            statusEl.textContent = message;
            statusEl.className = `status-display ${type}`;
        }

        async validateApiKey() {
            const statusEl = document.getElementById('mt-api-status');
            const apiKey = this.getCurrentApiKey();

            if (!apiKey) {
                statusEl.textContent = '';
                statusEl.className = 'api-status';
                return;
            }

            statusEl.textContent = 'Validating...';
            statusEl.className = 'api-status';

            try {
                let isValid = false;
                if (this.apiProvider === 'openai') {
                    const response = await this.makeRequest('https://api.openai.com/v1/models', {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (response.status === 200) {
                        isValid = true;
                    }
                } else if (this.apiProvider === 'google') {
                    // Dummy validation for Google.
                    isValid = true;
                }

                if (isValid) {
                    statusEl.textContent = 'Valid';
                    statusEl.className = 'api-status valid';
                } else {
                    throw new Error('Invalid API key');
                }
            } catch (error) {
                statusEl.textContent = 'Invalid';
                statusEl.className = 'api-status invalid';
            }
        }

        makeRequest(url, options) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: url,
                    headers: options.headers || {},
                    data: options.body,
                    onload: resolve,
                    onerror: reject
                });
            });
        }

        findMangaImages() {
            const images = Array.from(document.querySelectorAll('img'));

            return images.filter(img => {
                // Check if image is loaded and has a valid source
                if (!img.complete || !img.naturalWidth || !img.naturalHeight || !img.src) return false;

                // THE CRITICAL FILTER: Only select large images likely to be manga panels.
                if (img.naturalWidth < 400 || img.naturalHeight < 500) return false;

                // Check visibility: must be at least partially in the viewport
                const rect = img.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0 || rect.right < 0 || rect.bottom < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) {
                    return false;
                }

                // If it passes all checks, it's a valid target
                return true;
            });
        }

        translateVisibleImages() {
            if (!this.getCurrentApiKey()) {
                this.updateStatus('Please configure your API key first', 'error');
                return;
            }

            const images = this.findMangaImages();
            const visibleImages = images.filter(img => {
                const rect = img.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0;
            });

            if (visibleImages.length === 0) {
                this.updateStatus('No manga images found on this page', 'info');
                return;
            }

            this.updateStatus(`Found ${visibleImages.length} images to translate`, 'info');

            visibleImages.forEach(img => {
                this.requestQueue.push(img);
            });
        }

        async processQueue() {
            if (this.isProcessing || this.requestQueue.length === 0) return;
            if (this.activeRequests.size >= 3) return; // Limit concurrent requests

            this.isProcessing = true;
            const image = this.requestQueue.shift();

            if (image && !this.processedImages.has(image.src)) {
                await this.translateImage(image);
            }

            this.isProcessing = false;
        }

        async translateImage(image) {
            const requestId = Math.random().toString(36).substr(2, 9);
            this.activeRequests.add(requestId);
            this.processedImages.add(image.src);

            try {
                this.updateStatus(`Processing image...`, 'info');

                // Ensure image is fully loaded
                if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
                    await new Promise((resolve) => {
                        image.onload = resolve;
                        image.onerror = () => {
                            console.error('Image failed to load');
                            resolve();
                        };
                    });
                }

                // Split image into segments
                const segments = await this.splitImageIntoSections(image, 3); // Split into 3 parts

                if (segments.length === 0) {
                    this.updateStatus('Failed to load image - CORS/Network error', 'error');
                    return;
                }

                // Process each segment in parallel for OCR
                const ocrPromises = segments.map(segment =>
                    this.extractTextFromSegment(segment.dataUrl, segment.index, segments.length)
                );
                const nestedTextData = await Promise.all(ocrPromises);

                // Flatten the array of arrays and adjust coordinates
                const allTextData = [];
                nestedTextData.forEach((textData, segmentIndex) => {
                    if (textData && textData.length > 0) {
                        const segment = segments[segmentIndex];
                        textData.forEach(item => {
                            // FIX: Reliably normalize coordinates if they appear to be in pixels.
                            if (item.box.x > 100 || item.box.y > 100 || item.box.width > 100 || item.box.height > 100) {
                                item.box.x = (item.box.x / segment.width) * 100;
                                item.box.y = (item.box.y / segment.height) * 100;
                                item.box.width = (item.box.width / segment.width) * 100;
                                item.box.height = (item.box.height / segment.height) * 100;
                            }

                            item.box.y = (segmentIndex * (100 / segments.length)) + (item.box.y / segments.length);
                            item.box.height = item.box.height / segments.length;
                            allTextData.push(item);
                        });
                    }
                });

                if (allTextData.length === 0) {
                    this.updateStatus('No text found in the image.', 'info');
                    return;
                }

                // Batch translate all extracted texts at once
                const textsToTranslate = allTextData.map(item => item.text);
                const translations = await this.getBatchTranslation(textsToTranslate);

                // Create bubbles with the translations
                if (translations && translations.length === allTextData.length) {
                    allTextData.forEach((textItem, index) => {
                        if (translations[index]) {
                            // REMOVED the rigid 4-word formatting
                            this.createBubble(textItem, translations[index], image);
                        }
                    });
                    this.updateStatus(`Translated ${allTextData.length} text blocks`, 'success');
                } else {
                    console.error('Batch translation failed or returned mismatched number of translations.');
                    this.updateStatus('Translation failed (batch mismatch)', 'error');
                }

            } catch (error) {
                console.error('Translation error:', error);
                this.updateStatus('Translation failed: ' + error.message, 'error');
            } finally {
                this.activeRequests.delete(requestId);
            }
        }

        async splitImageIntoSections(image, numSegments = 3) {
            // First, load the image via GM_xmlhttpRequest to avoid CORS issues
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.error('Image load timeout');
                    resolve([]);
                }, 30000); // 30 second timeout

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: image.src,
                    responseType: 'blob',
                    headers: {
                        'Referer': window.location.href,
                        'Origin': window.location.origin
                    },
                    onload: (response) => {
                        clearTimeout(timeout);

                        if (response.status !== 200) {
                            console.error(`Failed to load image: ${response.status}`);
                            resolve([]);
                            return;
                        }

                        const blob = response.response;
                        const reader = new FileReader();

                        reader.onload = () => {
                            const dataUrl = reader.result;
                            const img = new Image();

                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');

                                const segmentHeight = img.naturalHeight / numSegments;

                                const segments = [];

                                for (let i = 0; i < numSegments; i++) {
                                    canvas.width = img.naturalWidth;
                                    canvas.height = segmentHeight;

                                    const sourceY = i * segmentHeight;

                                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                                    ctx.drawImage(img, 0, sourceY, img.naturalWidth, segmentHeight, 0, 0, img.naturalWidth, segmentHeight);

                                    try {
                                        segments.push({
                                            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
                                            index: i,
                                            width: canvas.width,
                                            height: canvas.height
                                        });
                                    } catch (e) {
                                        console.error('Canvas export failed:', e);
                                        // Fallback: try with PNG
                                        try {
                                            segments.push({
                                                dataUrl: canvas.toDataURL('image/png'),
                                                index: i,
                                                width: canvas.width,
                                                height: canvas.height
                                            });
                                        } catch (e2) {
                                            console.error('Canvas export failed completely:', e2);
                                        }
                                    }
                                }

                                resolve(segments);
                            };

                            img.onerror = () => {
                                console.error('Failed to load image from data URL');
                                resolve([]);
                            };

                            img.src = dataUrl;
                        };

                        reader.onerror = () => {
                            console.error('Failed to read blob');
                            resolve([]);
                        };

                        reader.readAsDataURL(blob);
                    },
                    onerror: () => {
                        clearTimeout(timeout);
                        console.error('Network error loading image');
                        resolve([]);
                    }
                });
            });
        }

        async extractTextFromSegment(imageDataUrl, segmentIndex, totalSegments) {
            const prompt = `You are a specialized OCR engine for comics. Analyze the user-provided image segment. Identify every piece of text, including speech, thoughts, narration, and sound effects. For each text block, provide its exact text, its type, and its bounding box as percentages of the image's dimensions.

Respond ONLY with a valid JSON array of objects. If no text is found, return an empty array [].

Example object format:
{
  "text": "The original Japanese text here",
  "box": { "x": 15.5, "y": 30.0, "width": 40.2, "height": 10.8 },
  "type": "speech" // Can be "speech", "thought", "narration", or "sound"
}`;

            try {
                let response;
                const apiKey = this.getCurrentApiKey();
                if (this.apiProvider === 'openai') {
                    const requestBody = {
                        model: "gpt-4.1-mini",
                        messages: [
                            {
                                role: "system",
                                content: prompt
                            },
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: imageDataUrl,
                                            detail: "high"
                                        }
                                    }
                                ]
                            }
                        ],
                        max_tokens: 4000,
                        temperature: 0.1
                    };

                    response = await this.makeRequest('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                } else {
                    // Google Gemini
                    const base64Image = imageDataUrl.split(',')[1];
                    const requestBody = {
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: "image/jpeg",
                                        data: base64Image
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 4000
                        }
                    };

                    response = await this.makeRequest(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestBody)
                        }
                    );
                }

                // Parse response
                const responseData = JSON.parse(response.responseText);
                let content;

                if (this.apiProvider === 'openai') {
                    content = responseData.choices[0].message.content;
                } else {
                    content = responseData.candidates[0].content.parts[0].text;
                }

                // Clean up response (remove markdown if present)
                content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

                return JSON.parse(content);

            } catch (error) {
                console.error('OCR error:', error);
                return [];
            }
        }

        async getBatchTranslation(texts) {
            if (texts.length === 0) return [];

            const translations = new Array(texts.length).fill(null);
            const textsToTranslate = [];
            const indicesToTranslate = [];

            // Check cache and separate what needs to be translated
            texts.forEach((text, index) => {
                const cacheKey = `${text}_${this.sourceLanguage}_${this.targetLanguage}`;
                const cached = this.translationCache.get(cacheKey);
                if (cached) {
                    translations[index] = cached;
                } else {
                    textsToTranslate.push(text);
                    indicesToTranslate.push(index);
                }
            });

            // If all were cached, we're done
            if (textsToTranslate.length === 0) {
                return translations;
            }

            const prompt = `You are a professional manga translator. Translate the following array of texts from ${this.sourceLanguage} to natural-sounding ${this.targetLanguage}. Maintain the tone and context for each text. For sound effects, provide an appropriate translation or transliteration.

The user will provide a JSON array of strings. Your response MUST be a JSON array of strings with the exact same number of elements, where each string is the translation of the corresponding text in the input array.

Example Input:
["おはようございます", "これはテストです"]

Example Output:
["Good morning", "This is a test"]

Input Texts:
${JSON.stringify(textsToTranslate)}
`;

            try {
                let response;
                const apiKey = this.getCurrentApiKey();

                if (this.apiProvider === 'openai') {
                    const requestBody = {
                        model: "gpt-4.1-mini",
                        messages: [
                            {
                                role: "system",
                                content: "You are a JSON-in, JSON-out translation service. Respond ONLY with a valid JSON array containing the translations."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        temperature: 0.2,
                        max_tokens: 1500,
                        response_format: { type: "json_object" } // Use JSON mode
                    };

                    response = await this.makeRequest('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                } else { // Google Gemini
                    const requestBody = {
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 1500,
                            response_mime_type: "application/json", // Use JSON mode for Gemini
                        }
                    };

                    response = await this.makeRequest(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        }
                    );
                }

                const responseData = JSON.parse(response.responseText);
                let content;

                if (this.apiProvider === 'openai') {
                    content = responseData.choices[0].message.content;
                } else {
                    content = responseData.candidates[0].content.parts[0].text;
                }

                const parsedContent = JSON.parse(content);
                const apiTranslations = Array.isArray(parsedContent) ? parsedContent : Object.values(parsedContent)[0];

                if (!Array.isArray(apiTranslations) || apiTranslations.length !== textsToTranslate.length) {
                    throw new Error("API returned mismatched number of translations for batch.");
                }

                // Fill in the missing translations and update cache
                apiTranslations.forEach((translation, i) => {
                    const originalIndex = indicesToTranslate[i];
                    translations[originalIndex] = translation;
                    const cacheKey = `${texts[originalIndex]}_${this.sourceLanguage}_${this.targetLanguage}`;
                    this.translationCache.set(cacheKey, translation);
                });

                return translations;

            } catch (error) {
                console.error('Batch translation error:', error);
                console.log('Falling back to individual translation for failed items.');

                const fallbackPromises = textsToTranslate.map(text => this.getTranslation(text));
                const fallbackTranslations = await Promise.all(fallbackPromises);

                fallbackTranslations.forEach((translation, i) => {
                    const originalIndex = indicesToTranslate[i];
                    translations[originalIndex] = translation;
                });

                return translations;
            }
        }

        async getTranslation(text) {
            // Check cache first
            const cacheKey = `${text}_${this.sourceLanguage}_${this.targetLanguage}`;
            if (this.translationCache.has(cacheKey)) {
                return this.translationCache.get(cacheKey);
            }

            const prompt = `Translate the following manga text from ${this.sourceLanguage} to natural-sounding ${this.targetLanguage}. Keep the tone and context. If it's a sound effect, provide an appropriate translation or transliteration. Original text: "${text}"`;

            try {
                let response;
                const apiKey = this.getCurrentApiKey();

                if (this.apiProvider === 'openai') {
                    const requestBody = {
                        model: "gpt-4.1-mini",
                        messages: [
                            {
                                role: "system",
                                content: "You are a professional manga translator. Provide only the translation, no explanations."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 500
                    };

                    response = await this.makeRequest('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                } else {
                    // Google Gemini
                    const requestBody = {
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 500
                        }
                    };

                    response = await this.makeRequest(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestBody)
                        }
                    );
                }

                const responseData = JSON.parse(response.responseText);
                let translation;

                if (this.apiProvider === 'openai') {
                    translation = responseData.choices[0].message.content.trim();
                    translation = responseData.choices[0].message.content.trim();
                } else {
                    translation = responseData.candidates[0].content.parts[0].text.trim();
                }

                // Cache the translation
                this.translationCache.set(cacheKey, translation);

                return translation;

            } catch (error) {
                console.error('Translation error:', error);
                return null;
            }
        }

        createBubble(textData, translation, sourceImage) {
            const bubble = document.createElement('div');
            bubble.className = 'manga-speech-bubble';

            // Add type-specific class
            if (textData.type === 'thought') {
                bubble.classList.add('thought-bubble');
            } else if (textData.type === 'shout' || textData.type === 'sound') {
                bubble.classList.add('shout-bubble');
            } else if (textData.type === 'narration') {
                bubble.classList.add('narration-bubble');
            }

            // Wrap text in a span to ensure proper wrapping in flex container
            const textSpan = document.createElement('span');
            const lines = this.formatText(translation);
            lines.forEach((line, index) => {
                textSpan.appendChild(document.createTextNode(line));
                if (index < lines.length - 1) {
                    textSpan.appendChild(document.createElement('br'));
                }
            });
            bubble.appendChild(textSpan);

            // Add to DOM but keep hidden for position calculation
            bubble.style.visibility = 'hidden';
            document.body.appendChild(bubble);

            // Width is now auto, based on the formatted text content.
            const bubbleRect = bubble.getBoundingClientRect();

            // Center the new bubble over the original text box's area
            const imgRect = sourceImage.getBoundingClientRect();
            const originalBoxCenterX = imgRect.left + window.scrollX + (imgRect.width * (textData.box.x + textData.box.width / 2) / 100);
            const originalBoxCenterY = imgRect.top + window.scrollY + (imgRect.height * (textData.box.y + textData.box.height / 2) / 100);

            const bubbleX = originalBoxCenterX - (bubbleRect.width / 2);
            const bubbleY = originalBoxCenterY - (bubbleRect.height / 2);

            bubble.style.left = bubbleX + 'px';
            bubble.style.top = bubbleY + 'px';

            // Add tail direction
            const tailDirection = this.calculateTailDirection(textData.box);
            bubble.classList.add(`tail-${tailDirection}`);


            // Store reference to source image and original position data
            bubble.dataset.sourceImage = sourceImage.src;
            bubble.dataset.originalBox = JSON.stringify(textData.box);

            // Add click to remove
            bubble.addEventListener('click', () => {
                bubble.remove();
                const index = this.translationBubbles.indexOf(bubble);
                if (index > -1) {
                    this.translationBubbles.splice(index, 1);
                }
            });

            // Check for overlaps and adjust if necessary
            this.avoidOverlap(bubble);

            // Make it visible
            bubble.style.visibility = 'visible';

            this.translationBubbles.push(bubble);
        }

        formatText(text, wordsPerLine = 5) {
            const words = text.split(' ');
            if (words.length <= wordsPerLine) {
                return [text];
            }
            const lines = [];
            let currentLine = '';
            for (let i = 0; i < words.length; i++) {
                currentLine += words[i] + ' ';
                if ((i + 1) % wordsPerLine === 0) {
                    lines.push(currentLine.trim());
                    currentLine = '';
                }
            }
            if (currentLine.trim() !== '') {
                lines.push(currentLine.trim());
            }
            return lines;
        }

        adjustFontSize(element, maxWidth, maxHeight) {
            const textSpan = element.firstChild;
            if (!textSpan) return;

            const paddingAndBorder = 20; // (padding 8px * 2) + (border 2px * 2)
            const availableWidth = maxWidth - paddingAndBorder;
            const availableHeight = maxHeight - paddingAndBorder;

            let minFont = 8;
            let maxFont = 200; // A reasonable upper limit
            let bestSize = minFont;

            // Binary search for the best font size
            while (minFont <= maxFont) {
                let midFont = Math.floor((minFont + maxFont) / 2);
                element.style.fontSize = midFont + 'px';

                // Measure the span's scroll dimensions, not the bubble's
                if (textSpan.scrollWidth <= availableWidth && textSpan.scrollHeight <= availableHeight) {
                    // It fits, try a larger size
                    bestSize = midFont;
                    minFont = midFont + 1;
                } else {
                    // It doesn't fit, try a smaller size
                    maxFont = midFont - 1;
                }
            }

            // Apply the best found size
            element.style.fontSize = bestSize + 'px';
        }

        createFixedBubble(rect, text) {
            const bubble = document.createElement('div');
            bubble.className = 'manga-speech-bubble';

            // Wrap text in a span to ensure proper wrapping in flex container
            const textSpan = document.createElement('span');
            const lines = this.formatText(text);
            lines.forEach((line, index) => {
                textSpan.appendChild(document.createTextNode(line));
                if (index < lines.length - 1) {
                    textSpan.appendChild(document.createElement('br'));
                }
            });
            bubble.appendChild(textSpan);

            // Use absolute positioning and calculate position with scroll offset
            bubble.style.position = 'absolute';
            bubble.style.left = (rect.x + window.scrollX) + 'px';
            bubble.style.top = (rect.y + window.scrollY) + 'px';

            // Store the initial viewport coordinates for scroll updates
            bubble.dataset.viewportX = rect.x;
            bubble.dataset.viewportY = rect.y;

            bubble.style.width = rect.width + 'px';
            bubble.style.height = rect.height + 'px';
            bubble.style.borderRadius = '8px'; // Match main bubble style
            bubble.style.display = 'flex';
            bubble.style.alignItems = 'center';
            bubble.style.justifyContent = 'center';
            bubble.style.textAlign = 'center';
            bubble.style.padding = '8px';
            bubble.style.maxWidth = 'none';

            // Add to DOM but keep it invisible to get correct dimensions
            bubble.style.visibility = 'hidden';
            document.body.appendChild(bubble);

            // Adjust font size to fit the user-defined box
            this.adjustFontSize(bubble, rect.width, rect.height);

            // Make it visible
            bubble.style.visibility = 'visible';

            bubble.addEventListener('click', () => {
                bubble.remove();
                const index = this.fixedBubbles.indexOf(bubble);
                if (index > -1) this.fixedBubbles.splice(index, 1);
            });

            this.fixedBubbles.push(bubble);
        }

        calculateTailDirection(box) {
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;

            if (centerY < 25) return 'top';
            if (centerY > 75) return 'bottom';
            if (centerX < 25) return 'left';
            if (centerX > 75) return 'right';

            // Default based on quadrant
            if (centerY < 50) return 'top';
            return 'bottom';
        }

        avoidOverlap(newBubble) {
            let attempts = 0;
            const maxAttempts = 100; // Prevent infinite loops

            while (attempts < maxAttempts) {
                let didOverlap = false;
                const newRect = newBubble.getBoundingClientRect();

                // Check against all existing bubbles
                for (const existingBubble of this.translationBubbles) {
                    if (existingBubble === newBubble) continue;
                    const existingRect = existingBubble.getBoundingClientRect();

                    if (this.rectsOverlap(newRect, existingRect)) {
                        // Simple strategy: move down by a small amount
                        const currentTop = parseFloat(newBubble.style.top);
                        newBubble.style.top = (currentTop + 5) + 'px'; // Smaller step for finer adjustment
                        didOverlap = true;
                        break; // Re-evaluate from the start with the new position
                    }
                }

                if (!didOverlap) {
                    return; // Position is final, no overlaps found in this pass
                }

                attempts++;
            }

            console.warn(`MangaTranslator: Could not fully resolve bubble overlap for a bubble after ${maxAttempts} attempts.`);
        }

        rectsOverlap(rect1, rect2) {
            return !(rect1.right < rect2.left ||
                     rect2.right < rect1.left ||
                     rect1.bottom < rect2.top ||
                     rect2.bottom < rect1.top);
        }

        updateBubblePositions() {
            this.translationBubbles.forEach(bubble => {
                const sourceImageSrc = bubble.dataset.sourceImage;
                if (!bubble.dataset.originalBox) return;

                const originalBox = JSON.parse(bubble.dataset.originalBox);

                const sourceImage = document.querySelector(`img[src="${sourceImageSrc}"]`);
                if (sourceImage) {
                    const imgRect = sourceImage.getBoundingClientRect();

                    // Width is auto, so we just need to re-center.
                    const bubbleRect = bubble.getBoundingClientRect();

                    // Recalculate center and update position
                    const originalBoxCenterX = imgRect.left + window.scrollX + (imgRect.width * (originalBox.x + originalBox.width / 2) / 100);
                    const originalBoxCenterY = imgRect.top + window.scrollY + (imgRect.height * (originalBox.y + originalBox.height / 2) / 100);

                    const bubbleX = originalBoxCenterX - (bubbleRect.width / 2);
                    const bubbleY = originalBoxCenterY - (bubbleRect.height / 2);

                    bubble.style.left = bubbleX + 'px';
                    bubble.style.top = bubbleY + 'px';
                }
            });
        }

        clearAllBubbles() {
            this.translationBubbles.forEach(bubble => bubble.remove());
            this.translationBubbles = [];
            this.fixedBubbles.forEach(bubble => bubble.remove());
            this.fixedBubbles = [];
            this.processedImages.clear();
            this.updateStatus('All translations cleared', 'success');
        }

        findAndObserveNewImages() {
            if (!this.intersectionObserver) return;
            const images = this.findMangaImages();
            images.forEach(img => {
                if (!img.dataset.mtObserved) {
                    img.dataset.mtObserved = 'true';
                    this.intersectionObserver.observe(img);
                }
            });
        }

        startAutoTranslate() {
            if (!this.getCurrentApiKey()) {
                this.updateStatus('Please configure your API key first', 'error');
                return;
            }

            this.isActive = true;
            this.updateStatus('Auto-translate started', 'success');
            document.getElementById('mt-auto-translate').textContent = 'Stop Auto-Translate';

            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.processedImages.has(entry.target.src)) {
                        this.requestQueue.push(entry.target);
                    }
                });
            }, {
                rootMargin: '200px'
            });

            this.findAndObserveNewImages();

            this.mutationObserver = new MutationObserver((mutations) => {
                this.debouncedFindAndObserve();
            });

            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        stopAutoTranslate(isPageChange = false) {
            this.isActive = false;

            if (this.intersectionObserver) {
                this.intersectionObserver.disconnect();
                this.intersectionObserver = null;
            }

            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }

            document.querySelectorAll('img[data-mt-observed]').forEach(img => {
                delete img.dataset.mtObserved;
            });

            if (!isPageChange) {
                this.updateStatus('Auto-translate stopped', 'info');
                document.getElementById('mt-auto-translate').textContent = 'Start Auto-Translate';
            }
        }

        startSelectionMode() {
            this.updateStatus('Click and drag to select an area.', 'info');
            const overlay = document.createElement('div');
            overlay.className = 'manga-translator-selection-overlay';
            document.body.appendChild(overlay);

            const selectionBubble = document.createElement('div');
            selectionBubble.className = 'manga-translator-selection-bubble';
            overlay.appendChild(selectionBubble);

            let startX, startY, isSelecting = false;

            const onMouseDown = (e) => {
                e.preventDefault();
                isSelecting = true;
                startX = e.clientX;
                startY = e.clientY;
                selectionBubble.style.display = 'none';
            };

            const onMouseMove = (e) => {
                if (!isSelecting) return;
                const currentX = e.clientX;
                const currentY = e.clientY;
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                const left = Math.min(currentX, startX);
                const top = Math.min(currentY, startY);

                selectionBubble.style.width = width + 'px';
                selectionBubble.style.height = height + 'px';
                selectionBubble.style.left = left + 'px';
                selectionBubble.style.top = top + 'px';
                selectionBubble.style.display = 'block';
            };

            const onMouseUp = (e) => {
                isSelecting = false;
                document.body.removeChild(overlay);

                const rect = {
                    x: parseInt(selectionBubble.style.left),
                    y: parseInt(selectionBubble.style.top),
                    width: parseInt(selectionBubble.style.width),
                    height: parseInt(selectionBubble.style.height)
                };

                if (rect.width > 10 && rect.height > 10) {
                    this.processSelection(rect);
                }
            };

            overlay.addEventListener('mousedown', onMouseDown);
            overlay.addEventListener('mousemove', onMouseMove);
            overlay.addEventListener('mouseup', onMouseUp);
        }

        async processSelection(rect) {
            try {
                this.updateStatus('Capturing selection...', 'info');
                const sourceImage = Array.from(document.querySelectorAll('img')).find(img => {
                    const imgRect = img.getBoundingClientRect();
                    return !(rect.x > imgRect.right || rect.x + rect.width < imgRect.left || rect.y > imgRect.bottom || rect.y + rect.height < imgRect.top);
                });

                if (!sourceImage || !sourceImage.complete) {
                    throw new Error("No valid image found under selection.");
                }

                const segments = await this.splitImageIntoSections(sourceImage, 1);
                if (segments.length === 0) throw new Error("Could not load image data.");

                const dataUrl = segments[0].dataUrl;
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = dataUrl;
                });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const imgRect = sourceImage.getBoundingClientRect();
                const scaleX = img.naturalWidth / imgRect.width;
                const scaleY = img.naturalHeight / imgRect.height;
                const cropX = (rect.x - imgRect.left) * scaleX;
                const cropY = (rect.y - imgRect.top) * scaleY;
                const cropWidth = rect.width * scaleX;
                const cropHeight = rect.height * scaleY;

                canvas.width = cropWidth;
                canvas.height = cropHeight;
                ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

                const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

                this.updateStatus('Extracting text...', 'info');
                const textData = await this.extractTextFromSegment(croppedDataUrl, 0, 1);

                if (!textData || textData.length === 0) throw new Error("No text found in selection.");

                const texts = textData.map(t => t.text);
                this.updateStatus('Translating text...', 'info');
                const translations = await this.getBatchTranslation(texts);
                const translatedText = translations.join(' ');

                if (!translatedText) throw new Error("Translation failed.");

                // Create the fixed bubble
                this.createFixedBubble(rect, translatedText);
                this.updateStatus('Selection translated!', 'success');

            } catch (error) {
                console.error("Selection processing error:", error);
                this.updateStatus(error.message, 'error');
            }
        }

        // Debug Position Overlay
        toggleDebugPosition() {
            if (this.debugOverlays.length > 0) {
                this.debugOverlays.forEach(el => el.remove());
                this.debugOverlays = [];
                this.updateStatus('Debug position overlay disabled', 'info');
                return;
            }

            const images = this.findMangaImages();
            if (images.length === 0) {
                this.updateStatus('No manga images found to debug.', 'info');
                return;
            }

            this.updateStatus(`Highlighting ${images.length} detected images.`, 'success');
            images.forEach(img => {
                const rect = img.getBoundingClientRect();
                const segmentHeight = rect.height / 3;

                // Top segment (red)
                const topOverlay = document.createElement('div');
                topOverlay.className = 'debug-overlay';
                topOverlay.style.left = rect.left + window.scrollX + 'px';
                topOverlay.style.top = rect.top + window.scrollY + 'px';
                topOverlay.style.width = rect.width + 'px';
                topOverlay.style.height = segmentHeight + 'px';
                document.body.appendChild(topOverlay);
                this.debugOverlays.push(topOverlay);

                // Middle segment (green)
                const middleOverlay = document.createElement('div');
                middleOverlay.className = 'debug-overlay middle';
                middleOverlay.style.left = rect.left + window.scrollX + 'px';
                middleOverlay.style.top = rect.top + window.scrollY + segmentHeight + 'px';
                middleOverlay.style.width = rect.width + 'px';
                middleOverlay.style.height = segmentHeight + 'px';
                document.body.appendChild(middleOverlay);
                this.debugOverlays.push(middleOverlay);

                // Bottom segment (blue)
                const bottomOverlay = document.createElement('div');
                bottomOverlay.className = 'debug-overlay bottom';
                bottomOverlay.style.left = rect.left + window.scrollX + 'px';
                bottomOverlay.style.top = rect.top + window.scrollY + (segmentHeight * 2) + 'px';
                bottomOverlay.style.width = rect.width + 'px';
                bottomOverlay.style.height = segmentHeight + 'px';
                document.body.appendChild(bottomOverlay);
                this.debugOverlays.push(bottomOverlay);
            });
        }
    }

    // Global instance
    window.mangaTranslator = new MangaTranslator();
})();
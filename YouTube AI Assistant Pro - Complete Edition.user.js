// ==UserScript==
// @name         YouTube AI Assistant Pro - Complete Edition
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Comprehensive YouTube AI Assistant with transcript, AI analysis, translation, export, and advanced features
// @author       You
// @match        https://www.youtube.com/watch*
// @match        https://youtube.com/watch*
// @match        https://m.youtube.com/watch*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_setClipboard
// @require      https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @connect      api.openai.com
// @connect      www.youtube.com
// @connect      youtube.com
// @connect      translate.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 YouTube AI Assistant Pro - Complete Edition Starting...');

    // Configuration
    const CONFIG = {
        OPENAI_API_KEY: GM_getValue('openai_api_key', ''),
        OPENAI_MODEL: 'gpt-4o-mini',
        MAX_TOKENS: 4000,
        TEMPERATURE: 0.7,
        YOUTUBE_API_KEY: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
        TRANSLATE_API_KEY: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
    };

    // Language mappings for YouTube supported languages
    const SUPPORTED_LANGUAGES = {
        'af': 'Afrikaans',
        'sq': 'Albanian',
        'am': 'Amharic',
        'ar': 'Arabic',
        'hy': 'Armenian',
        'az': 'Azerbaijani',
        'bn': 'Bengali',
        'bs': 'Bosnian',
        'bg': 'Bulgarian',
        'ca': 'Catalan',
        'zh': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'hr': 'Croatian',
        'cs': 'Czech',
        'da': 'Danish',
        'nl': 'Dutch',
        'en': 'English',
        'et': 'Estonian',
        'fi': 'Finnish',
        'fr': 'French',
        'gl': 'Galician',
        'ka': 'Georgian',
        'de': 'German',
        'el': 'Greek',
        'gu': 'Gujarati',
        'ht': 'Haitian Creole',
        'ha': 'Hausa',
        'he': 'Hebrew',
        'hi': 'Hindi',
        'hu': 'Hungarian',
        'is': 'Icelandic',
        'ig': 'Igbo',
        'id': 'Indonesian',
        'ga': 'Irish',
        'it': 'Italian',
        'ja': 'Japanese',
        'jw': 'Javanese',
        'kn': 'Kannada',
        'kk': 'Kazakh',
        'km': 'Khmer',
        'ko': 'Korean',
        'ku': 'Kurdish',
        'ky': 'Kyrgyz',
        'lo': 'Lao',
        'la': 'Latin',
        'lv': 'Latvian',
        'lt': 'Lithuanian',
        'lb': 'Luxembourgish',
        'mk': 'Macedonian',
        'mg': 'Malagasy',
        'ms': 'Malay',
        'ml': 'Malayalam',
        'mt': 'Maltese',
        'mi': 'Maori',
        'mr': 'Marathi',
        'mn': 'Mongolian',
        'my': 'Myanmar (Burmese)',
        'ne': 'Nepali',
        'no': 'Norwegian',
        'ny': 'Nyanja (Chichewa)',
        'ps': 'Pashto',
        'fa': 'Persian',
        'pl': 'Polish',
        'pt': 'Portuguese',
        'pa': 'Punjabi',
        'ro': 'Romanian',
        'ru': 'Russian',
        'sm': 'Samoan',
        'gd': 'Scottish Gaelic',
        'sr': 'Serbian',
        'st': 'Sesotho',
        'sn': 'Shona',
        'sd': 'Sindhi',
        'si': 'Sinhala (Sinhalese)',
        'sk': 'Slovak',
        'sl': 'Slovenian',
        'so': 'Somali',
        'es': 'Spanish',
        'su': 'Sundanese',
        'sw': 'Swahili',
        'sv': 'Swedish',
        'tl': 'Tagalog (Filipino)',
        'tg': 'Tajik',
        'ta': 'Tamil',
        'te': 'Telugu',
        'th': 'Thai',
        'tr': 'Turkish',
        'uk': 'Ukrainian',
        'ur': 'Urdu',
        'uz': 'Uzbek',
        'vi': 'Vietnamese',
        'cy': 'Welsh',
        'xh': 'Xhosa',
        'yi': 'Yiddish',
        'yo': 'Yoruba',
        'zu': 'Zulu'
    };

    // YouTube AI Assistant Class
    class YouTubeAIAssistant {
        constructor() {
            this.videoId = this.getVideoId();
            this.transcript = [];
            this.translatedTranscript = {};
            this.currentLanguage = 'en';
            this.notes = GM_getValue(`notes_${this.videoId}`, {});
            this.personalNotes = GM_getValue(`personal_notes_${this.videoId}`, '');
            this.summaryCache = GM_getValue(`summary_${this.videoId}`, null);
            this.bulletsCache = GM_getValue(`bullets_${this.videoId}`, null);
            this.mindmapCache = GM_getValue(`mindmap_${this.videoId}`, null);
            this.presentationCache = GM_getValue(`presentation_${this.videoId}`, null);
            this.isExpanded = GM_getValue('assistant_expanded', true);
            this.activeTab = 'transcript';
            this.chatHistory = GM_getValue(`chat_${this.videoId}`, []);
            this.isProcessing = false;

            console.log('🔧 YouTube AI Assistant initialized for video:', this.videoId);
            this.init();
        }

        init() {
            this.waitForElement('#secondary-inner', () => {
                console.log('✅ Secondary element found, creating UI...');
                this.injectStyles();
                this.createUI();
                this.attachEventListeners();
                this.loadTranscript();
                this.setupVideoChangeObserver();
                this.setupKeyboardShortcuts();
            });
        }

        waitForElement(selector, callback) {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
            } else {
                setTimeout(() => this.waitForElement(selector, callback), 500);
            }
        }

        getVideoId() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('v');
        }

        setupVideoChangeObserver() {
            let currentUrl = location.href;
            new MutationObserver(() => {
                if (location.href !== currentUrl) {
                    currentUrl = location.href;
                    const newVideoId = this.getVideoId();
                    if (newVideoId && newVideoId !== this.videoId) {
                        this.videoId = newVideoId;
                        this.resetForNewVideo();
                    }
                }
            }).observe(document, { subtree: true, childList: true });
        }

        resetForNewVideo() {
            this.transcript = [];
            this.translatedTranscript = {};
            this.currentLanguage = 'en';
            this.notes = GM_getValue(`notes_${this.videoId}`, {});
            this.personalNotes = GM_getValue(`personal_notes_${this.videoId}`, '');
            this.summaryCache = GM_getValue(`summary_${this.videoId}`, null);
            this.bulletsCache = GM_getValue(`bullets_${this.videoId}`, null);
            this.mindmapCache = GM_getValue(`mindmap_${this.videoId}`, null);
            this.presentationCache = GM_getValue(`presentation_${this.videoId}`, null);
            this.chatHistory = GM_getValue(`chat_${this.videoId}`, []);
            this.loadTranscript();
        }

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch(e.key) {
                        case 't':
                            e.preventDefault();
                            this.switchTab('transcript');
                            break;
                        case 's':
                            e.preventDefault();
                            this.switchTab('summary');
                            break;
                        case 'b':
                            e.preventDefault();
                            this.switchTab('bullets');
                            break;
                        case 'n':
                            e.preventDefault();
                            this.toggleNotes();
                            break;
                    }
                }
            });
        }

        injectStyles() {
            GM_addStyle(`
                /* Base Styles */
                #yt-ai-assistant {
                    margin: 24px 0;
                    background: var(--yt-spec-base-background);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 16px;
                    overflow: hidden;
                    font-family: 'YouTube Sans', 'Roboto', Arial, sans-serif;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                }

                #yt-ai-assistant:hover {
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
                }

                /* Header Styles */
                .ytai-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--yt-spec-10-percent-layer);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: linear-gradient(135deg, var(--yt-spec-brand-background-primary), var(--yt-spec-brand-background-secondary));
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                }

                .ytai-header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
                    transform: translateX(-100%);
                    transition: transform 0.6s;
                }

                .ytai-header:hover::before {
                    transform: translateX(100%);
                }

                .ytai-header-left {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .ytai-logo {
                    width: 28px;
                    height: 28px;
                    color: var(--yt-spec-text-primary);
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                }

                .ytai-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--yt-spec-text-primary);
                    margin: 0;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                .ytai-version {
                    font-size: 11px;
                    color: var(--yt-spec-text-secondary);
                    background: rgba(255,255,255,0.2);
                    padding: 2px 6px;
                    border-radius: 8px;
                    margin-left: 8px;
                }

                .ytai-toggle-btn {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    padding: 10px;
                    cursor: pointer;
                    color: var(--yt-spec-text-primary);
                    border-radius: 50%;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                }

                .ytai-toggle-btn:hover {
                    background: rgba(255,255,255,0.2);
                    transform: scale(1.1);
                }

                /* Toolbar Styles */
                .ytai-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    background: var(--yt-spec-general-background-a);
                    border-bottom: 1px solid var(--yt-spec-10-percent-layer);
                }

                .ytai-toolbar-group {
                    display: flex;
                    gap: 8px;
                }

                .ytai-toolbar-btn {
                    padding: 8px 12px;
                    background: var(--yt-spec-badge-chip-background);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 20px;
                    color: var(--yt-spec-text-primary);
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    position: relative;
                    overflow: hidden;
                }

                .ytai-toolbar-btn:hover {
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }

                .ytai-toolbar-btn:active {
                    transform: translateY(0);
                }

                .ytai-toolbar-btn.processing {
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    pointer-events: none;
                }

                .ytai-toolbar-btn.processing::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    animation: loading-shine 1.5s infinite;
                }

                @keyframes loading-shine {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }

                .ytai-toolbar-btn svg {
                    width: 14px;
                    height: 14px;
                }

                .ytai-dropdown {
                    position: relative;
                }

                .ytai-dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: var(--yt-spec-base-background);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 8px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                    z-index: 1000;
                    min-width: 200px;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-10px);
                    transition: all 0.2s ease;
                }

                .ytai-dropdown.open .ytai-dropdown-menu {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                }

                .ytai-dropdown-item {
                    padding: 12px 16px;
                    cursor: pointer;
                    color: var(--yt-spec-text-primary);
                    font-size: 13px;
                    border-bottom: 1px solid var(--yt-spec-10-percent-layer);
                    transition: background 0.15s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .ytai-dropdown-item:last-child {
                    border-bottom: none;
                }

                .ytai-dropdown-item:hover {
                    background: var(--yt-spec-10-percent-layer);
                }

                /* Content Styles */
                .ytai-content {
                    display: none;
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }

                .ytai-content.expanded {
                    display: block;
                    max-height: 800px;
                }

                .ytai-tabs {
                    display: flex;
                    padding: 0 24px;
                    background: var(--yt-spec-general-background-a);
                    border-bottom: 1px solid var(--yt-spec-10-percent-layer);
                    overflow-x: auto;
                    scrollbar-width: none;
                }

                .ytai-tabs::-webkit-scrollbar {
                    display: none;
                }

                .ytai-tab {
                    padding: 16px 24px;
                    background: none;
                    border: none;
                    color: var(--yt-spec-text-secondary);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    position: relative;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                    border-radius: 8px 8px 0 0;
                    margin: 0 2px;
                }

                .ytai-tab:hover {
                    color: var(--yt-spec-text-primary);
                    background: rgba(var(--yt-spec-call-to-action-rgb), 0.1);
                }

                .ytai-tab.active {
                    color: var(--yt-spec-call-to-action);
                    background: var(--yt-spec-base-background);
                }

                .ytai-tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: var(--yt-spec-call-to-action);
                    border-radius: 3px 3px 0 0;
                }

                .ytai-tab-content {
                    display: none;
                    padding: 24px;
                    max-height: 600px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: var(--yt-spec-10-percent-layer) transparent;
                }

                .ytai-tab-content::-webkit-scrollbar {
                    width: 6px;
                }

                .ytai-tab-content::-webkit-scrollbar-track {
                    background: transparent;
                }

                .ytai-tab-content::-webkit-scrollbar-thumb {
                    background: var(--yt-spec-10-percent-layer);
                    border-radius: 3px;
                }

                .ytai-tab-content::-webkit-scrollbar-thumb:hover {
                    background: var(--yt-spec-20-percent-layer);
                }

                .ytai-tab-content.active {
                    display: block;
                }

                /* Transcript Styles */
                .ytai-transcript-item {
                    margin-bottom: 20px;
                    padding: 16px 20px;
                    background: var(--yt-spec-badge-chip-background);
                    border-radius: 12px;
                    position: relative;
                    transition: all 0.2s ease;
                    border-left: 4px solid transparent;
                }

                .ytai-transcript-item:hover {
                    background: var(--yt-spec-10-percent-layer);
                    border-left-color: var(--yt-spec-call-to-action);
                    transform: translateX(4px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .ytai-transcript-time {
                    color: var(--yt-spec-call-to-action);
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-bottom: 12px;
                    display: inline-block;
                    padding: 4px 8px;
                    background: rgba(var(--yt-spec-call-to-action-rgb), 0.1);
                    border-radius: 6px;
                    transition: all 0.2s ease;
                }

                .ytai-transcript-time:hover {
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    transform: scale(1.05);
                }

                .ytai-transcript-text {
                    color: var(--yt-spec-text-primary);
                    font-size: 14px;
                    line-height: 1.7;
                    margin-bottom: 12px;
                }

                .ytai-transcript-text.collapsed {
                    max-height: 80px;
                    overflow: hidden;
                    position: relative;
                }

                .ytai-transcript-text.collapsed::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 40px;
                    background: linear-gradient(transparent, var(--yt-spec-badge-chip-background));
                }

                .ytai-read-more {
                    color: var(--yt-spec-call-to-action);
                    font-size: 12px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: color 0.2s ease;
                }

                .ytai-read-more:hover {
                    color: var(--yt-spec-text-primary);
                    text-decoration: underline;
                }

                .ytai-transcript-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                .ytai-transcript-item:hover .ytai-transcript-actions {
                    opacity: 1;
                }

                .ytai-transcript-action {
                    padding: 4px 8px;
                    background: var(--yt-spec-10-percent-layer);
                    border: none;
                    border-radius: 6px;
                    color: var(--yt-spec-text-secondary);
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ytai-transcript-action:hover {
                    background: var(--yt-spec-call-to-action);
                    color: white;
                }

                /* Note Input Styles */
                .ytai-note-input {
                    width: 100%;
                    margin-top: 12px;
                    padding: 12px 16px;
                    background: var(--yt-spec-general-background-a);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 8px;
                    color: var(--yt-spec-text-primary);
                    font-size: 13px;
                    resize: vertical;
                    min-height: 80px;
                    transition: all 0.2s ease;
                }

                .ytai-note-input:focus {
                    outline: none;
                    border-color: var(--yt-spec-call-to-action);
                    box-shadow: 0 0 0 3px rgba(var(--yt-spec-call-to-action-rgb), 0.1);
                }

                /* AI Content Styles */
                .ytai-ai-content {
                    color: var(--yt-spec-text-primary);
                    font-size: 14px;
                    line-height: 1.8;
                }

                .ytai-ai-content h1, .ytai-ai-content h2, .ytai-ai-content h3 {
                    color: var(--yt-spec-text-primary);
                    margin: 24px 0 16px 0;
                    font-weight: 600;
                }

                .ytai-ai-content ul, .ytai-ai-content ol {
                    margin: 16px 0;
                    padding-left: 24px;
                }

                .ytai-ai-content li {
                    margin-bottom: 8px;
                    color: var(--yt-spec-text-primary);
                }

                .ytai-ai-content p {
                    margin-bottom: 16px;
                }

                .ytai-ai-content code {
                    background: var(--yt-spec-badge-chip-background);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                }

                .ytai-ai-content pre {
                    background: var(--yt-spec-badge-chip-background);
                    padding: 16px;
                    border-radius: 8px;
                    overflow-x: auto;
                    margin: 16px 0;
                }

                /* Chat Styles */
                .ytai-chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 500px;
                }

                .ytai-chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    background: var(--yt-spec-general-background-a);
                    border-radius: 12px;
                    margin-bottom: 16px;
                    scrollbar-width: thin;
                    scrollbar-color: var(--yt-spec-10-percent-layer) transparent;
                }

                .ytai-chat-messages::-webkit-scrollbar {
                    width: 6px;
                }

                .ytai-chat-messages::-webkit-scrollbar-track {
                    background: transparent;
                }

                .ytai-chat-messages::-webkit-scrollbar-thumb {
                    background: var(--yt-spec-10-percent-layer);
                    border-radius: 3px;
                }

                .ytai-chat-message {
                    margin-bottom: 16px;
                    display: flex;
                    gap: 12px;
                    animation: fadeInUp 0.3s ease;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .ytai-chat-message.user {
                    flex-direction: row-reverse;
                }

                .ytai-chat-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--yt-spec-call-to-action);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: 600;
                    color: white;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }

                .ytai-chat-message.user .ytai-chat-avatar {
                    background: var(--yt-spec-text-primary);
                }

                .ytai-chat-bubble {
                    max-width: 75%;
                    padding: 12px 16px;
                    border-radius: 18px;
                    font-size: 14px;
                    line-height: 1.5;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    position: relative;
                }

                .ytai-chat-message.user .ytai-chat-bubble {
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    border-bottom-right-radius: 6px;
                }

                .ytai-chat-message.ai .ytai-chat-bubble {
                    background: var(--yt-spec-badge-chip-background);
                    color: var(--yt-spec-text-primary);
                    border-bottom-left-radius: 6px;
                }

                .ytai-chat-input-container {
                    display: flex;
                    gap: 12px;
                    align-items: end;
                }

                .ytai-chat-input {
                    flex: 1;
                    padding: 12px 16px;
                    background: var(--yt-spec-general-background-a);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 24px;
                    color: var(--yt-spec-text-primary);
                    font-size: 14px;
                    outline: none;
                    resize: none;
                    min-height: 48px;
                    max-height: 120px;
                    transition: all 0.2s ease;
                }

                .ytai-chat-input:focus {
                    border-color: var(--yt-spec-call-to-action);
                    box-shadow: 0 0 0 3px rgba(var(--yt-spec-call-to-action-rgb), 0.1);
                }

                .ytai-chat-send {
                    padding: 12px 20px;
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    border: none;
                    border-radius: 24px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-height: 48px;
                }

                .ytai-chat-send:hover {
                    background: var(--yt-spec-call-to-action-dark);
                    transform: scale(1.05);
                }

                .ytai-chat-send:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                /* Mind Map Styles */
                .ytai-mindmap-container {
                    background: var(--yt-spec-general-background-a);
                    border-radius: 12px;
                    padding: 24px;
                    min-height: 400px;
                    position: relative;
                    overflow: hidden;
                }

                .ytai-mindmap-canvas {
                    width: 100%;
                    height: 400px;
                    border-radius: 8px;
                    cursor: grab;
                }

                .ytai-mindmap-canvas:active {
                    cursor: grabbing;
                }

                .ytai-mindmap-controls {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    display: flex;
                    gap: 8px;
                }

                .ytai-mindmap-control {
                    padding: 8px;
                    background: var(--yt-spec-base-background);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 6px;
                    cursor: pointer;
                    color: var(--yt-spec-text-primary);
                    transition: all 0.2s ease;
                }

                .ytai-mindmap-control:hover {
                    background: var(--yt-spec-call-to-action);
                    color: white;
                }

                /* Presentation Styles */
                .ytai-presentation-container {
                    background: var(--yt-spec-general-background-a);
                    border-radius: 12px;
                    padding: 24px;
                    min-height: 400px;
                }

                .ytai-slide {
                    background: white;
                    border-radius: 8px;
                    padding: 32px;
                    margin-bottom: 24px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                    min-height: 300px;
                    position: relative;
                    color: #333;
                }

                .ytai-slide-number {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .ytai-slide h1 {
                    color: var(--yt-spec-call-to-action);
                    font-size: 28px;
                    margin-bottom: 24px;
                    border-bottom: 3px solid var(--yt-spec-call-to-action);
                    padding-bottom: 12px;
                }

                .ytai-slide h2 {
                    color: #333;
                    font-size: 22px;
                    margin: 20px 0 16px 0;
                }

                .ytai-slide h3 {
                    color: #555;
                    font-size: 18px;
                    margin: 16px 0 12px 0;
                }

                /* Loading Styles */
                .ytai-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 48px;
                    color: var(--yt-spec-text-secondary);
                }

                .ytai-spinner {
                    width: 48px;
                    height: 48px;
                    border: 3px solid var(--yt-spec-10-percent-layer);
                    border-top-color: var(--yt-spec-call-to-action);
                    border-radius: 50%;
                    animation: ytai-spin 1s linear infinite;
                    margin-bottom: 16px;
                }

                @keyframes ytai-spin {
                    to { transform: rotate(360deg); }
                }

                .ytai-progress-bar {
                    width: 200px;
                    height: 4px;
                    background: var(--yt-spec-10-percent-layer);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 16px;
                }

                .ytai-progress-fill {
                    height: 100%;
                    background: var(--yt-spec-call-to-action);
                    width: 0%;
                    transition: width 0.3s ease;
                    border-radius: 2px;
                }

                /* Empty State Styles */
                .ytai-empty {
                    text-align: center;
                    padding: 48px;
                    color: var(--yt-spec-text-secondary);
                }

                .ytai-empty svg {
                    width: 64px;
                    height: 64px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                    color: var(--yt-spec-text-secondary);
                }

                .ytai-empty h3 {
                    margin: 16px 0 8px 0;
                    color: var(--yt-spec-text-primary);
                    font-size: 18px;
                }

                .ytai-empty p {
                    margin-bottom: 24px;
                    line-height: 1.6;
                }

                .ytai-empty button {
                    padding: 12px 24px;
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    border: none;
                    border-radius: 24px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ytai-empty button:hover {
                    background: var(--yt-spec-call-to-action-dark);
                    transform: translateY(-1px);
                }

                /* Footer Styles */
                .ytai-footer {
                    padding: 16px 24px;
                    border-top: 1px solid var(--yt-spec-10-percent-layer);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--yt-spec-general-background-a);
                }

                .ytai-footer-left {
                    display: flex;
                    gap: 12px;
                }

                .ytai-footer-right {
                    display: flex;
                    gap: 8px;
                }

                .ytai-footer-btn {
                    padding: 8px 16px;
                    background: var(--yt-spec-badge-chip-background);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 16px;
                    color: var(--yt-spec-text-primary);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .ytai-footer-btn:hover {
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    transform: translateY(-1px);
                }

                .ytai-footer-btn svg {
                    width: 12px;
                    height: 12px;
                }

                /* Modal Styles */
                .ytai-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }

                .ytai-modal.show {
                    opacity: 1;
                    visibility: visible;
                }

                .ytai-modal-content {
                    background: var(--yt-spec-base-background);
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                }

                .ytai-modal.show .ytai-modal-content {
                    transform: scale(1);
                }

                .ytai-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .ytai-modal-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--yt-spec-text-primary);
                    margin: 0;
                }

                .ytai-modal-close {
                    background: none;
                    border: none;
                    color: var(--yt-spec-text-secondary);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                }

                .ytai-modal-close:hover {
                    background: var(--yt-spec-10-percent-layer);
                    color: var(--yt-spec-text-primary);
                }

                /* Notes Modal Styles */
                .ytai-notes-modal .ytai-modal-content {
                    max-width: 800px;
                }

                .ytai-notes-editor {
                    width: 100%;
                    height: 400px;
                    padding: 16px;
                    background: var(--yt-spec-general-background-a);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 8px;
                    color: var(--yt-spec-text-primary);
                    font-size: 14px;
                    font-family: 'Roboto', Arial, sans-serif;
                    resize: vertical;
                    outline: none;
                }

                .ytai-notes-editor:focus {
                    border-color: var(--yt-spec-call-to-action);
                    box-shadow: 0 0 0 3px rgba(var(--yt-spec-call-to-action-rgb), 0.1);
                }

                .ytai-notes-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 16px;
                }

                .ytai-notes-info {
                    font-size: 12px;
                    color: var(--yt-spec-text-secondary);
                }

                .ytai-notes-save {
                    padding: 10px 20px;
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    border: none;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ytai-notes-save:hover {
                    background: var(--yt-spec-call-to-action-dark);
                    transform: translateY(-1px);
                }

                /* Settings Modal Styles */
                .ytai-settings-field {
                    margin-bottom: 20px;
                }

                .ytai-settings-label {
                    display: block;
                    color: var(--yt-spec-text-primary);
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }

                .ytai-settings-input {
                    width: 100%;
                    padding: 12px 16px;
                    background: var(--yt-spec-general-background-a);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 8px;
                    color: var(--yt-spec-text-primary);
                    font-size: 14px;
                    transition: all 0.2s ease;
                }

                .ytai-settings-input:focus {
                    outline: none;
                    border-color: var(--yt-spec-call-to-action);
                    box-shadow: 0 0 0 3px rgba(var(--yt-spec-call-to-action-rgb), 0.1);
                }

                .ytai-settings-save {
                    width: 100%;
                    padding: 12px;
                    background: var(--yt-spec-call-to-action);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ytai-settings-save:hover {
                    background: var(--yt-spec-call-to-action-dark);
                }

                /* Toast Styles */
                .ytai-toast {
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--yt-spec-base-background);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 12px;
                    padding: 16px 24px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    z-index: 10000;
                    animation: ytai-slide-up 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    max-width: 400px;
                }

                @keyframes ytai-slide-up {
                    from {
                        transform: translate(-50%, 20px);
                        opacity: 0;
                    }
                    to {
                        transform: translate(-50%, 0);
                        opacity: 1;
                    }
                }

                .ytai-toast.success {
                    border-color: #1a7f37;
                    background: #dafbe1;
                    color: #1a7f37;
                }

                .ytai-toast.error {
                    border-color: #cf222e;
                    background: #ffd0d0;
                    color: #cf222e;
                }

                .ytai-toast.info {
                    border-color: #0969da;
                    background: #ddf4ff;
                    color: #0969da;
                }

                .ytai-toast svg {
                    width: 16px;
                    height: 16px;
                }

                /* Language Selector Styles */
                .ytai-language-selector {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .ytai-language-select {
                    padding: 8px 12px;
                    background: var(--yt-spec-badge-chip-background);
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 6px;
                    color: var(--yt-spec-text-primary);
                    font-size: 13px;
                    cursor: pointer;
                    min-width: 120px;
                }

                .ytai-language-select:focus {
                    outline: none;
                    border-color: var(--yt-spec-call-to-action);
                }

                /* Responsive Design */
                @media (max-width: 1200px) {
                    #yt-ai-assistant {
                        margin: 16px 0;
                    }

                    .ytai-header {
                        padding: 16px 20px;
                    }

                    .ytai-toolbar {
                        padding: 12px 20px;
                        flex-direction: column;
                        gap: 12px;
                    }

                    .ytai-toolbar-group {
                        flex-wrap: wrap;
                        justify-content: center;
                    }

                    .ytai-tabs {
                        padding: 0 20px;
                    }

                    .ytai-tab {
                        padding: 12px 16px;
                        font-size: 13px;
                    }

                    .ytai-tab-content {
                        padding: 20px;
                    }

                    .ytai-footer {
                        padding: 12px 20px;
                        flex-direction: column;
                        gap: 12px;
                    }
                }

                @media (max-width: 768px) {
                    .ytai-modal-content {
                        margin: 20px;
                        padding: 24px;
                        width: calc(100% - 40px);
                    }

                    .ytai-chat-container {
                        height: 400px;
                    }

                    .ytai-transcript-item {
                        padding: 12px 16px;
                    }

                    .ytai-toolbar-btn {
                        font-size: 11px;
                        padding: 6px 10px;
                    }

                    .ytai-dropdown-menu {
                        position: fixed;
                        top: auto;
                        bottom: 20px;
                        left: 20px;
                        right: 20px;
                        width: auto;
                    }
                }

                /* Accessibility */
                .ytai-accessible-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border: 0;
                }

                /* High contrast mode support */
                @media (prefers-contrast: high) {
                    #yt-ai-assistant {
                        border: 2px solid;
                    }

                    .ytai-toolbar-btn, .ytai-tab, .ytai-footer-btn {
                        border: 2px solid;
                    }

                    .ytai-transcript-item {
                        border: 1px solid;
                    }
                }

                /* Reduced motion support */
                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }

                /* Focus styles for keyboard navigation */
                .ytai-toolbar-btn:focus,
                .ytai-tab:focus,
                .ytai-footer-btn:focus,
                .ytai-transcript-time:focus {
                    outline: 2px solid var(--yt-spec-call-to-action);
                    outline-offset: 2px;
                }
            `);
        }

        createUI() {
            const container = document.createElement('div');
            container.id = 'yt-ai-assistant';
            container.setAttribute('role', 'region');
            container.setAttribute('aria-label', 'AI Assistant');

            container.innerHTML = `
                <div class="ytai-header" role="button" tabindex="0" aria-expanded="${this.isExpanded}">
                    <div class="ytai-header-left">
                        <svg class="ytai-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
                            <path d="M2 17L12 22L22 17"></path>
                            <path d="M2 12L12 17L22 12"></path>
                        </svg>
                        <h3 class="ytai-title">🤖 AI Assistant Pro<span class="ytai-version">v3.0</span></h3>
                    </div>
                    <button class="ytai-toggle-btn" aria-label="${this.isExpanded ? 'Collapse' : 'Expand'} AI Assistant">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="${this.isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline>
                        </svg>
                    </button>
                </div>

                <div class="ytai-content ${this.isExpanded ? 'expanded' : ''}" aria-hidden="${!this.isExpanded}">
                    <div class="ytai-toolbar">
                        <div class="ytai-toolbar-group">
                            <button class="ytai-toolbar-btn" data-action="transcript" aria-label="Generate Transcript">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                                Transcript
                            </button>
                            <button class="ytai-toolbar-btn" data-action="summary" aria-label="Generate AI Summary">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                                Summary
                            </button>
                            <button class="ytai-toolbar-btn" data-action="bullets" aria-label="Generate Key Points">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M9 12l2 2 4-4"></path>
                                    <path d="M21 12c.552 0 1-.448 1-1V8c0-.552-.448-1-1-1h-3c-.552 0-1 .448-1 1v3c0 .552.448 1 1 1h3z"></path>
                                    <path d="M3 12c.552 0 1-.448 1-1V8c0-.552-.448-1-1-1H1c-.552 0-1 .448-1 1v3c0 .552.448 1 1 1h2z"></path>
                                    <path d="M21 20c.552 0 1-.448 1-1v-3c0-.552-.448-1-1-1h-3c-.552 0-1 .448-1 1v3c0 .552.448 1 1 1h3z"></path>
                                    <path d="M3 20c.552 0 1-.448 1-1v-3c0-.552-.448-1-1-1H1c-.552 0-1 .448-1 1v3c0 .552.448 1 1 1h2z"></path>
                                </svg>
                                Key Points
                            </button>
                            <button class="ytai-toolbar-btn" data-action="chat" aria-label="Open AI Chat">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                AI Chat
                            </button>
                            <button class="ytai-toolbar-btn" data-action="mindmap" aria-label="Generate Mind Map">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M12 1v6m0 6v6"></path>
                                    <path d="M21 12h-6m-6 0H3"></path>
                                    <path d="M18.364 5.636l-4.243 4.243m-4.242 4.242L5.636 18.364"></path>
                                    <path d="M5.636 5.636l4.243 4.243m4.242 4.242l4.243 4.243"></path>
                                </svg>
                                Mind Map
                            </button>
                            <button class="ytai-toolbar-btn" data-action="podcast" aria-label="Generate Podcast Version">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                                Podcast
                            </button>
                            <button class="ytai-toolbar-btn" data-action="presentation" aria-label="Generate Presentation">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                    <line x1="8" y1="21" x2="16" y2="21"></line>
                                    <line x1="12" y1="17" x2="12" y2="21"></line>
                                </svg>
                                Slides
                            </button>
                        </div>

                        <div class="ytai-toolbar-group">
                            <div class="ytai-dropdown" data-dropdown="copy">
                                <button class="ytai-toolbar-btn" aria-label="Copy Options">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Copy ▼
                                </button>
                                <div class="ytai-dropdown-menu">
                                    <div class="ytai-dropdown-item" data-action="copy-with-timestamps">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12 6 12 12 16 14"></polyline>
                                        </svg>
                                        Copy with timestamps
                                    </div>
                                    <div class="ytai-dropdown-item" data-action="copy-without-timestamps">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                        </svg>
                                        Copy without timestamps
                                    </div>
                                </div>
                            </div>

                            <div class="ytai-dropdown" data-dropdown="download">
                                <button class="ytai-toolbar-btn" aria-label="Download Options">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Download ▼
                                </button>
                                <div class="ytai-dropdown-menu">
                                    <div class="ytai-dropdown-item" data-action="download-txt-timestamps">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                        </svg>
                                        TXT with timestamps
                                    </div>
                                    <div class="ytai-dropdown-item" data-action="download-txt-plain">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                        </svg>
                                        TXT without timestamps
                                    </div>
                                    <div class="ytai-dropdown-item" data-action="download-srt">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                            <line x1="8" y1="21" x2="16" y2="21"></line>
                                            <line x1="12" y1="17" x2="12" y2="21"></line>
                                        </svg>
                                        SRT Subtitles
                                    </div>
                                </div>
                            </div>

                            <div class="ytai-dropdown" data-dropdown="translate">
                                <button class="ytai-toolbar-btn" aria-label="Translation Options">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                        <path d="M5 8l6 6"></path>
                                        <path d="M4 14l6-6 2-3"></path>
                                        <path d="M2 5h12"></path>
                                        <path d="M7 2h1"></path>
                                        <path d="M22 22l-5-10-5 10"></path>
                                        <path d="M14 18h6"></path>
                                    </svg>
                                    Translate ▼
                                </button>
                                <div class="ytai-dropdown-menu" style="max-height: 300px; overflow-y: auto;">
                                    ${Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) =>
                                        `<div class="ytai-dropdown-item" data-action="translate" data-lang="${code}">${name}</div>`
                                    ).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="ytai-tabs" role="tablist">
                        <button class="ytai-tab active" data-tab="transcript" role="tab" aria-selected="true" aria-controls="transcript-panel">📝 Transcript</button>
                        <button class="ytai-tab" data-tab="summary" role="tab" aria-selected="false" aria-controls="summary-panel">📋 Summary</button>
                        <button class="ytai-tab" data-tab="bullets" role="tab" aria-selected="false" aria-controls="bullets-panel">🔸 Key Points</button>
                        <button class="ytai-tab" data-tab="chat" role="tab" aria-selected="false" aria-controls="chat-panel">💬 AI Chat</button>
                        <button class="ytai-tab" data-tab="mindmap" role="tab" aria-selected="false" aria-controls="mindmap-panel">🧠 Mind Map</button>
                        <button class="ytai-tab" data-tab="podcast" role="tab" aria-selected="false" aria-controls="podcast-panel">🎙️ Podcast</button>
                        <button class="ytai-tab" data-tab="presentation" role="tab" aria-selected="false" aria-controls="presentation-panel">📊 Slides</button>
                    </div>

                    <div class="ytai-tab-content active" data-content="transcript" id="transcript-panel" role="tabpanel">
                        <div class="ytai-language-selector">
                            <label for="transcript-language">Language:</label>
                            <select id="transcript-language" class="ytai-language-select">
                                <option value="en">English (Original)</option>
                            </select>
                        </div>
                        <div class="ytai-loading">
                            <div class="ytai-spinner"></div>
                            <p>Loading transcript...</p>
                            <div class="ytai-progress-bar">
                                <div class="ytai-progress-fill"></div>
                            </div>
                        </div>
                    </div>

                    <div class="ytai-tab-content" data-content="summary" id="summary-panel" role="tabpanel">
                        <div class="ytai-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            <h3>AI Summary</h3>
                            <p>Generate a comprehensive AI summary of this video content.</p>
                            <button onclick="window.ytaiAssistant.generateSummary()">Generate Summary</button>
                        </div>
                    </div>

                    <div class="ytai-tab-content" data-content="bullets" id="bullets-panel" role="tabpanel">
                        <div class="ytai-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <circle cx="12" cy="12" r="10"></circle>
                            </svg>
                            <h3>Key Points</h3>
                            <p>Extract the most important insights and key takeaways from the video.</p>
                            <button onclick="window.ytaiAssistant.generateBullets()">Generate Key Points</button>
                        </div>
                    </div>

                    <div class="ytai-tab-content" data-content="chat" id="chat-panel" role="tabpanel">
                        <div class="ytai-chat-container">
                            <div class="ytai-chat-messages" id="ytai-chat-messages" role="log" aria-live="polite">
                                <div class="ytai-chat-message ai">
                                    <div class="ytai-chat-avatar">AI</div>
                                    <div class="ytai-chat-bubble">
                                        Hello! I'm your AI assistant. I can help you understand and discuss this video content. What would you like to know?
                                    </div>
                                </div>
                            </div>
                            <div class="ytai-chat-input-container">
                                <textarea class="ytai-chat-input" placeholder="Ask me anything about this video..." id="ytai-chat-input" aria-label="Chat input"></textarea>
                                <button class="ytai-chat-send" id="ytai-chat-send" aria-label="Send message">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="ytai-tab-content" data-content="mindmap" id="mindmap-panel" role="tabpanel">
                        <div class="ytai-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M12 1v6m0 6v6"></path>
                                <path d="M21 12h-6m-6 0H3"></path>
                            </svg>
                            <h3>Mind Map</h3>
                            <p>Create a visual mind map showing the relationships between topics and concepts.</p>
                            <button onclick="window.ytaiAssistant.generateMindMap()">Generate Mind Map</button>
                        </div>
                    </div>

                    <div class="ytai-tab-content" data-content="podcast" id="podcast-panel" role="tabpanel">
                        <div class="ytai-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            </svg>
                            <h3>Podcast Version</h3>
                            <p>Convert this video into an audio-only podcast format for easy listening.</p>
                            <button onclick="window.ytaiAssistant.generatePodcast()">Generate Podcast</button>
                        </div>
                    </div>

                    <div class="ytai-tab-content" data-content="presentation" id="presentation-panel" role="tabpanel">
                        <div class="ytai-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                <line x1="8" y1="21" x2="16" y2="21"></line>
                                <line x1="12" y1="17" x2="12" y2="21"></line>
                            </svg>
                            <h3>Presentation Slides</h3>
                            <p>Generate a structured presentation based on the video content.</p>
                            <button onclick="window.ytaiAssistant.generatePresentation()">Generate Slides</button>
                        </div>
                    </div>

                    <div class="ytai-footer">
                        <div class="ytai-footer-left">
                            <button class="ytai-footer-btn" data-action="notes" aria-label="Open Notes">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path>
                                    <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon>
                                </svg>
                                Notes
                            </button>
                        </div>
                        <div class="ytai-footer-right">
                            <button class="ytai-footer-btn" data-action="like" aria-label="Like">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                                </svg>
                            </button>
                            <button class="ytai-footer-btn" data-action="copy-link" aria-label="Copy">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            <button class="ytai-footer-btn" data-action="notion" aria-label="Export to Notion">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                            </button>
                            <button class="ytai-footer-btn" data-action="email" aria-label="Share via Email">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22 6 12 13 2 6"></polyline>
                                </svg>
                            </button>
                            <button class="ytai-footer-btn" data-action="settings" aria-label="Settings">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M12 1v6m0 6v6m-6-12h6m6 0h6m-3.87-4.13l-4.24 4.24m-1.78 1.78l-4.24 4.24m0-9.9l4.24 4.24m1.78 1.78l4.24 4.24"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const secondary = document.querySelector('#secondary-inner');
            if (secondary) {
                const related = secondary.querySelector('#related');
                if (related) {
                    secondary.insertBefore(container, related);
                } else {
                    secondary.appendChild(container);
                }
                console.log('✅ UI container inserted into DOM');
            }

            this.container = container;
            window.ytaiAssistant = this; // Make available globally for button callbacks
        }

        attachEventListeners() {
            // Header toggle
            const header = this.container.querySelector('.ytai-header');
            header.addEventListener('click', () => this.toggleExpanded());
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleExpanded();
                }
            });

            // Tab navigation
            this.container.querySelectorAll('.ytai-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.switchTab(tab.dataset.tab);
                });
                tab.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.switchTab(tab.dataset.tab);
                    }
                });
            });

            // Toolbar actions
            this.container.querySelectorAll('.ytai-toolbar-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    if (action) this.handleToolbarAction(action);
                });
            });

            // Dropdown handling
            this.container.querySelectorAll('.ytai-dropdown').forEach(dropdown => {
                const btn = dropdown.querySelector('.ytai-toolbar-btn');
                const menu = dropdown.querySelector('.ytai-dropdown-menu');

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDropdown(dropdown);
                });

                menu.addEventListener('click', (e) => {
                    const item = e.target.closest('.ytai-dropdown-item');
                    if (item) {
                        const action = item.dataset.action;
                        const lang = item.dataset.lang;
                        this.handleDropdownAction(action, lang, item.textContent.trim());
                        this.closeAllDropdowns();
                    }
                });
            });

            // Footer actions
            this.container.querySelectorAll('.ytai-footer-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    if (action) this.handleFooterAction(action);
                });
            });

            // Chat functionality
            const chatInput = this.container.querySelector('#ytai-chat-input');
            const chatSend = this.container.querySelector('#ytai-chat-send');

            if (chatInput && chatSend) {
                const sendMessage = () => {
                    const message = chatInput.value.trim();
                    if (message && !this.isProcessing) {
                        this.handleChatMessage(message);
                        chatInput.value = '';
                        chatInput.style.height = 'auto';
                    }
                };

                chatSend.addEventListener('click', sendMessage);
                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                // Auto-resize textarea
                chatInput.addEventListener('input', () => {
                    chatInput.style.height = 'auto';
                    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
                });
            }

            // Language selector
            const langSelect = this.container.querySelector('#transcript-language');
            if (langSelect) {
                langSelect.addEventListener('change', (e) => {
                    this.switchTranscriptLanguage(e.target.value);
                });
            }

            // Close dropdowns when clicking outside
            document.addEventListener('click', () => {
                this.closeAllDropdowns();
            });

            // Restore chat history
            this.restoreChatHistory();
        }

        toggleExpanded() {
            this.isExpanded = !this.isExpanded;
            GM_setValue('assistant_expanded', this.isExpanded);

            const content = this.container.querySelector('.ytai-content');
            const toggleBtn = this.container.querySelector('.ytai-toggle-btn svg polyline');
            const header = this.container.querySelector('.ytai-header');

            if (this.isExpanded) {
                content.classList.add('expanded');
                content.setAttribute('aria-hidden', 'false');
                toggleBtn.setAttribute('points', '18 15 12 9 6 15');
                header.setAttribute('aria-expanded', 'true');
                header.querySelector('.ytai-toggle-btn').setAttribute('aria-label', 'Collapse AI Assistant');
            } else {
                content.classList.remove('expanded');
                content.setAttribute('aria-hidden', 'true');
                toggleBtn.setAttribute('points', '6 9 12 15 18 9');
                header.setAttribute('aria-expanded', 'false');
                header.querySelector('.ytai-toggle-btn').setAttribute('aria-label', 'Expand AI Assistant');
            }
        }

        switchTab(tabName) {
            this.activeTab = tabName;

            // Update tab states
            this.container.querySelectorAll('.ytai-tab').forEach(tab => {
                const isActive = tab.dataset.tab === tabName;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', isActive);
            });

            // Update content states
            this.container.querySelectorAll('.ytai-tab-content').forEach(content => {
                content.classList.toggle('active', content.dataset.content === tabName);
            });

            // Load content based on tab
            switch(tabName) {
                case 'transcript':
                    if (this.transcript.length === 0) this.loadTranscript();
                    break;
                case 'summary':
                    this.loadSummary();
                    break;
                case 'bullets':
                    this.loadBullets();
                    break;
                case 'chat':
                    this.focusChatInput();
                    break;
                case 'mindmap':
                    this.loadMindMap();
                    break;
                case 'podcast':
                    this.loadPodcast();
                    break;
                case 'presentation':
                    this.loadPresentation();
                    break;
            }
        }

        toggleDropdown(dropdown) {
            const isOpen = dropdown.classList.contains('open');
            this.closeAllDropdowns();
            if (!isOpen) {
                dropdown.classList.add('open');
            }
        }

        closeAllDropdowns() {
            this.container.querySelectorAll('.ytai-dropdown').forEach(dropdown => {
                dropdown.classList.remove('open');
            });
        }

        handleToolbarAction(action) {
            switch(action) {
                case 'transcript':
                    this.switchTab('transcript');
                    break;
                case 'summary':
                    this.generateSummary();
                    break;
                case 'bullets':
                    this.generateBullets();
                    break;
                case 'chat':
                    this.switchTab('chat');
                    break;
                case 'mindmap':
                    this.generateMindMap();
                    break;
                case 'podcast':
                    this.generatePodcast();
                    break;
                case 'presentation':
                    this.generatePresentation();
                    break;
            }
        }

        handleDropdownAction(action, lang, text) {
            switch(action) {
                case 'copy-with-timestamps':
                    this.copyTranscript(true);
                    break;
                case 'copy-without-timestamps':
                    this.copyTranscript(false);
                    break;
                case 'download-txt-timestamps':
                    this.downloadTranscript('txt', true);
                    break;
                case 'download-txt-plain':
                    this.downloadTranscript('txt', false);
                    break;
                case 'download-srt':
                    this.downloadTranscript('srt');
                    break;
                case 'translate':
                    this.translateTranscript(lang, text);
                    break;
            }
        }

        handleFooterAction(action) {
            switch(action) {
                case 'notes':
                    this.openNotesModal();
                    break;
                case 'like':
                    this.likeVideo();
                    break;
                case 'copy-link':
                    this.copyVideoLink();
                    break;
                case 'notion':
                    this.exportToNotion();
                    break;
                case 'email':
                    this.shareViaEmail();
                    break;
                case 'settings':
                    this.openSettingsModal();
                    break;
            }
        }

        async loadTranscript() {
            const contentEl = this.container.querySelector('[data-content="transcript"]');
            const progressBar = contentEl.querySelector('.ytai-progress-fill');

            if (progressBar) progressBar.style.width = '10%';

            try {
                console.log('🔄 Loading transcript for video:', this.videoId);

                if (progressBar) progressBar.style.width = '30%';

                const transcript = await this.fetchYouTubeTranscript();

                if (progressBar) progressBar.style.width = '70%';

                if (transcript && transcript.length > 0) {
                    this.transcript = transcript;
                    this.renderTranscript(transcript);
                    this.populateLanguageSelector();
                    console.log('✅ Transcript loaded:', transcript.length, 'items');

                    if (progressBar) progressBar.style.width = '100%';

                    setTimeout(() => {
                        if (progressBar) progressBar.style.width = '0%';
                    }, 500);
                } else {
                    contentEl.innerHTML = `
                        <div class="ytai-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <h3>No Transcript Available</h3>
                            <p>This video doesn't have captions or transcripts available.</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('❌ Error loading transcript:', error);
                contentEl.innerHTML = `
                    <div class="ytai-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <h3>Error Loading Transcript</h3>
                        <p>${error.message}</p>
                        <button onclick="window.ytaiAssistant.loadTranscript()">Try Again</button>
                    </div>
                `;
            }
        }

        async fetchYouTubeTranscript() {
            // Try multiple methods to get transcript
            const methods = [
                () => this.fetchFromYouTubeAPI(),
                () => this.fetchFromAlternativeAPI(),
                () => this.extractFromPage()
            ];

            for (const method of methods) {
                try {
                    const result = await method();
                    if (result && result.length > 0) {
                        return result;
                    }
                } catch (error) {
                    console.warn('Transcript method failed:', error);
                    continue;
                }
            }

            throw new Error('No transcript available through any method');
        }

        async fetchFromYouTubeAPI() {
            const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${CONFIG.YOUTUBE_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    context: {
                        client: {
                            clientName: 'WEB',
                            clientVersion: '2.20231201.00.00'
                        }
                    },
                    videoId: this.videoId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (!captionTracks || captionTracks.length === 0) {
                throw new Error('No captions available');
            }

            const track = captionTracks.find(t => t.languageCode.startsWith('en')) || captionTracks[0];
            const transcriptResponse = await fetch(track.baseUrl);
            const transcriptXml = await transcriptResponse.text();

            return this.parseTranscriptXml(transcriptXml);
        }

        async fetchFromAlternativeAPI() {
            const alternativeUrl = `https://www.youtube.com/api/timedtext?v=${this.videoId}&fmt=srv3&lang=en`;
            const response = await fetch(alternativeUrl);

            if (!response.ok) {
                throw new Error('Alternative API failed');
            }

            const xml = await response.text();
            return this.parseTranscriptXml(xml);
        }

        extractFromPage() {
            // Try to extract transcript from page elements
            const transcriptElements = document.querySelectorAll('[data-purpose="transcript-cue"]');
            if (transcriptElements.length === 0) {
                throw new Error('No transcript elements found on page');
            }

            const transcript = [];
            transcriptElements.forEach((element, index) => {
                const timeElement = element.querySelector('[data-purpose="transcript-time"]');
                const textElement = element.querySelector('[data-purpose="transcript-text"]');

                if (timeElement && textElement) {
                    const timeText = timeElement.textContent.trim();
                    const text = textElement.textContent.trim();
                    const startTime = this.parseTimeToSeconds(timeText);

                    transcript.push({
                        index: index,
                        start: startTime,
                        duration: 3,
                        text: text
                    });
                }
            });

            return transcript;
        }

        parseTimeToSeconds(timeString) {
            const parts = timeString.split(':').map(p => parseInt(p));
            if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
            return 0;
        }

        parseTranscriptXml(xmlContent) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const textElements = xmlDoc.querySelectorAll('text');

            const transcript = [];

            textElements.forEach((element, index) => {
                const start = parseFloat(element.getAttribute('start')) || 0;
                const duration = parseFloat(element.getAttribute('dur')) || 3;
                const text = element.textContent
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();

                if (text) {
                    transcript.push({
                        index: index,
                        start: start,
                        duration: duration,
                        text: text
                    });
                }
            });

            return transcript;
        }

        renderTranscript(transcript, language = 'en') {
            const contentEl = this.container.querySelector('[data-content="transcript"]');

            if (!transcript || transcript.length === 0) {
                contentEl.innerHTML = `
                    <div class="ytai-empty">
                        <h3>No transcript available</h3>
                        <p>This video doesn't have transcripts in the selected language.</p>
                    </div>
                `;
                return;
            }

            const languageSelector = contentEl.querySelector('.ytai-language-selector');
            const transcriptHTML = transcript.map((item, index) => {
                const time = this.formatTime(item.start);
                const isLong = item.text.length > 200;
                const hasNote = this.notes[index] || false;

                return `
                    <div class="ytai-transcript-item" data-index="${index}">
                        <div class="ytai-transcript-time" data-time="${item.start}">${time}</div>
                        <div class="ytai-transcript-text ${isLong ? 'collapsed' : ''}" id="transcript-text-${index}">
                            ${item.text}
                        </div>
                        ${isLong ? `<span class="ytai-read-more" data-index="${index}">Read more ▼</span>` : ''}
                        <div class="ytai-transcript-actions">
                            <button class="ytai-transcript-action" data-action="note" data-index="${index}" aria-label="Add note">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path>
                                    <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon>
                                </svg>
                                ${hasNote ? 'Edit Note' : 'Add Note'}
                            </button>
                            <button class="ytai-transcript-action" data-action="copy" data-index="${index}" aria-label="Copy segment">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Copy
                            </button>
                            <button class="ytai-transcript-action" data-action="jump" data-index="${index}" aria-label="Jump to timestamp">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                                Play
                            </button>
                        </div>
                        <div id="note-area-${index}" style="display: ${hasNote ? 'block' : 'none'};">
                            <textarea class="ytai-note-input" id="note-input-${index}" placeholder="Add your notes here...">${hasNote || ''}</textarea>
                        </div>
                    </div>
                `;
            }).join('');

            contentEl.innerHTML = languageSelector.outerHTML + transcriptHTML;

            this.attachTranscriptEventListeners(contentEl);
        }

        attachTranscriptEventListeners(contentEl) {
            // Timestamp clicks
            contentEl.querySelectorAll('.ytai-transcript-time').forEach(timeEl => {
                timeEl.addEventListener('click', () => {
                    const time = parseFloat(timeEl.dataset.time);
                    this.jumpToTime(time);
                });
            });

            // Read more/less toggles
            contentEl.querySelectorAll('.ytai-read-more').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = btn.dataset.index;
                    const textEl = contentEl.querySelector(`#transcript-text-${index}`);
                    textEl.classList.toggle('collapsed');
                    btn.textContent = textEl.classList.contains('collapsed') ? 'Read more ▼' : 'Show less ▲';
                });
            });

            // Transcript actions
            contentEl.querySelectorAll('.ytai-transcript-action').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const index = parseInt(btn.dataset.index);
                    this.handleTranscriptAction(action, index);
                });
            });

            // Note inputs
            contentEl.querySelectorAll('.ytai-note-input').forEach(input => {
                input.addEventListener('input', () => {
                    const index = input.id.split('-').pop();
                    const noteText = input.value.trim();

                    if (noteText) {
                        this.notes[index] = noteText;
                    } else {
                        delete this.notes[index];
                    }

                    GM_setValue(`notes_${this.videoId}`, this.notes);

                    // Update button text
                    const btn = contentEl.querySelector(`[data-action="note"][data-index="${index}"]`);
                    if (btn) {
                        btn.innerHTML = btn.innerHTML.replace(noteText ? 'Add Note' : 'Edit Note', noteText ? 'Edit Note' : 'Add Note');
                    }
                });
            });

            // Language selector
            const langSelect = contentEl.querySelector('#transcript-language');
            if (langSelect) {
                langSelect.addEventListener('change', (e) => {
                    this.switchTranscriptLanguage(e.target.value);
                });
            }
        }

        handleTranscriptAction(action, index) {
            const item = this.transcript[index];
            if (!item) return;

            switch(action) {
                case 'note':
                    this.toggleNote(index);
                    break;
                case 'copy':
                    this.copySegment(item);
                    break;
                case 'jump':
                    this.jumpToTime(item.start);
                    break;
            }
        }

        toggleNote(index) {
            const noteArea = this.container.querySelector(`#note-area-${index}`);
            const noteInput = this.container.querySelector(`#note-input-${index}`);

            if (noteArea.style.display === 'none') {
                noteArea.style.display = 'block';
                noteInput.focus();
            } else {
                noteArea.style.display = 'none';
            }
        }

        copySegment(item) {
            const text = `${this.formatTime(item.start)}: ${item.text}`;
            this.copyToClipboard(text);
            this.showToast('Segment copied to clipboard!', 'success');
        }

        jumpToTime(time) {
            const video = document.querySelector('video');
            if (video) {
                video.currentTime = time;
                if (video.paused) video.play();
                console.log('⏯️ Jumped to time:', this.formatTime(time));
                this.showToast(`Jumped to ${this.formatTime(time)}`, 'info');
            }
        }

        populateLanguageSelector() {
            const select = this.container.querySelector('#transcript-language');
            if (!select) return;

            // Add original language
            select.innerHTML = '<option value="en">English (Original)</option>';

            // Add popular languages
            const popularLangs = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar'];
            popularLangs.forEach(code => {
                if (SUPPORTED_LANGUAGES[code]) {
                    const option = document.createElement('option');
                    option.value = code;
                    option.textContent = SUPPORTED_LANGUAGES[code];
                    select.appendChild(option);
                }
            });
        }

        async switchTranscriptLanguage(languageCode) {
            if (languageCode === 'en') {
                this.renderTranscript(this.transcript, 'en');
                return;
            }

            if (this.translatedTranscript[languageCode]) {
                this.renderTranscript(this.translatedTranscript[languageCode], languageCode);
                return;
            }

            // Show loading while translating
            const contentEl = this.container.querySelector('[data-content="transcript"]');
            const originalContent = contentEl.innerHTML;

            contentEl.innerHTML = `
                <div class="ytai-loading">
                    <div class="ytai-spinner"></div>
                    <p>Translating to ${SUPPORTED_LANGUAGES[languageCode]}...</p>
                </div>
            `;

            try {
                const translatedTranscript = await this.translateTranscriptToLanguage(languageCode);
                this.translatedTranscript[languageCode] = translatedTranscript;
                this.renderTranscript(translatedTranscript, languageCode);
            } catch (error) {
                console.error('Translation failed:', error);
                contentEl.innerHTML = originalContent;
                this.showToast('Translation failed. Please try again.', 'error');

                // Reset selector
                const select = contentEl.querySelector('#transcript-language');
                if (select) select.value = this.currentLanguage;
            }
        }

        async translateTranscriptToLanguage(targetLang) {
            if (!this.transcript || this.transcript.length === 0) {
                throw new Error('No transcript to translate');
            }

            const translatedItems = [];
            const batchSize = 10; // Translate in batches to avoid rate limits

            for (let i = 0; i < this.transcript.length; i += batchSize) {
                const batch = this.transcript.slice(i, i + batchSize);
                const textsToTranslate = batch.map(item => item.text);

                try {
                    const translatedTexts = await this.translateTexts(textsToTranslate, targetLang);

                    batch.forEach((item, index) => {
                        translatedItems.push({
                            ...item,
                            text: translatedTexts[index] || item.text
                        });
                    });
                } catch (error) {
                    console.error('Batch translation failed:', error);
                    // Fall back to original text for failed batches
                    translatedItems.push(...batch);
                }

                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return translatedItems;
        }

        async translateTexts(texts, targetLang) {
            // Use Google Translate API or fallback to OpenAI
            try {
                return await this.translateWithGoogle(texts, targetLang);
            } catch (error) {
                console.warn('Google Translate failed, trying OpenAI:', error);
                return await this.translateWithOpenAI(texts, targetLang);
            }
        }

        async translateWithGoogle(texts, targetLang) {
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${CONFIG.TRANSLATE_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: texts,
                    target: targetLang,
                    source: 'en'
                })
            });

            if (!response.ok) {
                throw new Error(`Translation API error: ${response.status}`);
            }

            const data = await response.json();
            return data.data.translations.map(t => t.translatedText);
        }

        async translateWithOpenAI(texts, targetLang) {
            if (!CONFIG.OPENAI_API_KEY) {
                throw new Error('OpenAI API key not configured');
            }

            const prompt = `Translate the following texts to ${SUPPORTED_LANGUAGES[targetLang]}. Return only the translations, one per line, in the same order:\n\n${texts.join('\n')}`;

            const response = await this.callOpenAI([
                {
                    role: 'system',
                    content: 'You are a professional translator. Translate the given texts accurately while maintaining the original meaning and context.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            return response.split('\n').filter(line => line.trim());
        }

        formatTime(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);

            if (h > 0) {
                return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            } else {
                return `${m}:${s.toString().padStart(2, '0')}`;
            }
        }

        async generateSummary() {
            if (this.summaryCache) {
                this.switchTab('summary');
                return;
            }

            this.setProcessingState('summary', true);
            const contentEl = this.container.querySelector('[data-content="summary"]');

            contentEl.innerHTML = `
                <div class="ytai-loading">
                    <div class="ytai-spinner"></div>
                    <p>Generating AI summary...</p>
                    <div class="ytai-progress-bar">
                        <div class="ytai-progress-fill"></div>
                    </div>
                </div>
            `;

            try {
                if (!CONFIG.OPENAI_API_KEY) {
                    throw new Error('OpenAI API key not configured. Please add your API key in settings.');
                }

                if (this.transcript.length === 0) {
                    await this.loadTranscript();
                }

                const progressFill = contentEl.querySelector('.ytai-progress-fill');
                if (progressFill) progressFill.style.width = '30%';

                const transcriptText = this.transcript.map(t => t.text).join(' ');

                if (progressFill) progressFill.style.width = '60%';

                const summary = await this.callOpenAI([
                    {
                        role: 'system',
                        content: 'You are an expert content summarizer. Create a comprehensive, well-structured summary that captures the main ideas, key insights, and important details. Use markdown formatting for better readability.'
                    },
                    {
                        role: 'user',
                        content: `Please create a detailed summary of this video transcript:\n\n${transcriptText.substring(0, 12000)}`
                    }
                ]);

                if (progressFill) progressFill.style.width = '100%';

                this.summaryCache = summary;
                GM_setValue(`summary_${this.videoId}`, summary);

                contentEl.innerHTML = `<div class="ytai-ai-content">${marked.parse(summary)}</div>`;
                this.switchTab('summary');
                this.showToast('Summary generated successfully!', 'success');

            } catch (error) {
                console.error('Error generating summary:', error);
                contentEl.innerHTML = `
                    <div class="ytai-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <h3>Error Generating Summary</h3>
                        <p>${error.message}</p>
                        <button onclick="window.ytaiAssistant.generateSummary()">Try Again</button>
                    </div>
                `;
                this.showToast('Failed to generate summary', 'error');
            }

            this.setProcessingState('summary', false);
        }

        async generateBullets() {
            if (this.bulletsCache) {
                this.switchTab('bullets');
                return;
            }

            this.setProcessingState('bullets', true);
            const contentEl = this.container.querySelector('[data-content="bullets"]');

            contentEl.innerHTML = `
                <div class="ytai-loading">
                    <div class="ytai-spinner"></div>
                    <p>Extracting key points...</p>
                    <div class="ytai-progress-bar">
                        <div class="ytai-progress-fill"></div>
                    </div>
                </div>
            `;

            try {
                if (!CONFIG.OPENAI_API_KEY) {
                    throw new Error('OpenAI API key not configured. Please add your API key in settings.');
                }

                if (this.transcript.length === 0) {
                    await this.loadTranscript();
                }

                const progressFill = contentEl.querySelector('.ytai-progress-fill');
                if (progressFill) progressFill.style.width = '40%';

                const transcriptText = this.transcript.map(t => t.text).join(' ');

                if (progressFill) progressFill.style.width = '70%';

                const bullets = await this.callOpenAI([
                    {
                        role: 'system',
                        content: 'You are an expert at extracting key insights and actionable takeaways from content. Create a comprehensive bulleted list that captures the most important points, insights, lessons, and actionable items. Use clear, concise language and organize points logically.'
                    },
                    {
                        role: 'user',
                        content: `Please extract the key points, insights, and takeaways from this video transcript and format them as a well-organized bulleted list:\n\n${transcriptText.substring(0, 12000)}`
                    }
                ]);

                if (progressFill) progressFill.style.width = '100%';

                this.bulletsCache = bullets;
                GM_setValue(`bullets_${this.videoId}`, bullets);

                contentEl.innerHTML = `<div class="ytai-ai-content">${marked.parse(bullets)}</div>`;
                this.switchTab('bullets');
                this.showToast('Key points extracted successfully!', 'success');

            } catch (error) {
                console.error('Error generating bullets:', error);
                contentEl.innerHTML = `
                    <div class="ytai-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <h3>Error Extracting Key Points</h3>
                        <p>${error.message}</p>
                        <button onclick="window.ytaiAssistant.generateBullets()">Try Again</button>
                    </div>
                `;
                this.showToast('Failed to extract key points', 'error');
            }

            this.setProcessingState('bullets', false);
        }

        async generateMindMap() {
            if (this.mindmapCache) {
                this.loadMindMap();
                return;
            }

            this.setProcessingState('mindmap', true);
            const contentEl = this.container.querySelector('[data-content="mindmap"]');

            contentEl.innerHTML = `
                <div class="ytai-loading">
                    <div class="ytai-spinner"></div>
                    <p>Creating mind map...</p>
                    <div class="ytai-progress-bar">
                        <div class="ytai-progress-fill"></div>
                    </div>
                </div>
            `;

            try {
                if (!CONFIG.OPENAI_API_KEY) {
                    throw new Error('OpenAI API key not configured. Please add your API key in settings.');
                }

                if (this.transcript.length === 0) {
                    await this.loadTranscript();
                }

                const progressFill = contentEl.querySelector('.ytai-progress-fill');
                if (progressFill) progressFill.style.width = '30%';

                const transcriptText = this.transcript.map(t => t.text).join(' ');

                if (progressFill) progressFill.style.width = '60%';

                const mindmapJson = await this.callOpenAI([
                    {
                        role: 'system',
                        content: 'You are an expert at creating mind maps. Analyze the content and create a hierarchical mind map structure. Return a JSON object with a central topic and branches. Format: {"central": "Main Topic", "branches": [{"topic": "Branch 1", "subtopics": ["Sub 1", "Sub 2"], "color": "#color"}, ...]}'
                    },
                    {
                        role: 'user',
                        content: `Create a mind map structure from this video transcript:\n\n${transcriptText.substring(0, 10000)}`
                    }
                ]);

                if (progressFill) progressFill.style.width = '90%';

                const mindmapData = JSON.parse(mindmapJson);
                this.mindmapCache = mindmapData;
                GM_setValue(`mindmap_${this.videoId}`, mindmapData);

                if (progressFill) progressFill.style.width = '100%';

                this.renderMindMap(mindmapData);
                this.switchTab('mindmap');
                this.showToast('Mind map created successfully!', 'success');

            } catch (error) {
                console.error('Error generating mind map:', error);
                contentEl.innerHTML = `
                    <div class="ytai-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <h3>Error Creating Mind Map</h3>
                        <p>${error.message}</p>
                        <button onclick="window.ytaiAssistant.generateMindMap()">Try Again</button>
                    </div>
                `;
                this.showToast('Failed to create mind map', 'error');
            }

            this.setProcessingState('mindmap', false);
        }

        async generatePresentation() {
            if (this.presentationCache) {
                this.loadPresentation();
                return;
            }

            this.setProcessingState('presentation', true);
            const contentEl = this.container.querySelector('[data-content="presentation"]');

            contentEl.innerHTML = `
                <div class="ytai-loading">
                    <div class="ytai-spinner"></div>
                    <p>Generating presentation slides...</p>
                    <div class="ytai-progress-bar">
                        <div class="ytai-progress-fill"></div>
                    </div>
                </div>
            `;

            try {
                if (!CONFIG.OPENAI_API_KEY) {
                    throw new Error('OpenAI API key not configured. Please add your API key in settings.');
                }

                if (this.transcript.length === 0) {
                    await this.loadTranscript();
                }

                const progressFill = contentEl.querySelector('.ytai-progress-fill');
                if (progressFill) progressFill.style.width = '40%';

                const transcriptText = this.transcript.map(t => t.text).join(' ');

                if (progressFill) progressFill.style.width = '70%';

                const presentation = await this.callOpenAI([
                    {
                        role: 'system',
                        content: 'You are an expert presentation designer. Create a structured presentation with multiple slides based on the content. Return markdown format with clear slide breaks (use "---" between slides). Each slide should have a title and well-organized content with bullet points.'
                    },
                    {
                        role: 'user',
                        content: `Create a presentation with multiple slides based on this video content. Structure it logically with an introduction, main topics, and conclusion:\n\n${transcriptText.substring(0, 12000)}`
                    }
                ]);

                if (progressFill) progressFill.style.width = '100%';

                this.presentationCache = presentation;
                GM_setValue(`presentation_${this.videoId}`, presentation);

                this.renderPresentation(presentation);
                this.switchTab('presentation');
                this.showToast('Presentation created successfully!', 'success');

            } catch (error) {
                console.error('Error generating presentation:', error);
                contentEl.innerHTML = `
                    <div class="ytai-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <h3>Error Generating Presentation</h3>
                        <p>${error.message}</p>
                        <button onclick="window.ytaiAssistant.generatePresentation()">Try Again</button>
                    </div>
                `;
                this.showToast('Failed to generate presentation', 'error');
            }

            this.setProcessingState('presentation', false);
        }

        async generatePodcast() {
            this.setProcessingState('podcast', true);
            const contentEl = this.container.querySelector('[data-content="podcast"]');

            contentEl.innerHTML = `
                <div class="ytai-loading">
                    <div class="ytai-spinner"></div>
                    <p>Creating podcast version...</p>
                </div>
            `;

            try {
                // For now, create a podcast-style text version
                if (this.transcript.length === 0) {
                    await this.loadTranscript();
                }

                const transcriptText = this.transcript.map(t => t.text).join(' ');

                const podcastScript = await this.callOpenAI([
                    {
                        role: 'system',
                        content: 'You are a podcast script writer. Convert the video content into a engaging podcast format with natural transitions, clear narration, and audio-friendly language. Structure it as a script that could be read aloud.'
                    },
                    {
                        role: 'user',
                        content: `Convert this video content into a podcast script format:\n\n${transcriptText.substring(0, 12000)}`
                    }
                ]);

                contentEl.innerHTML = `
                    <div class="ytai-ai-content">
                        <div style="background: var(--yt-spec-badge-chip-background); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                            <h3>🎙️ Podcast Version</h3>
                            <p>This content has been converted to a podcast-friendly format. You can read along or use text-to-speech software to create an audio version.</p>
                            <div style="display: flex; gap: 12px; margin-top: 12px;">
                                <button class="ytai-toolbar-btn" onclick="window.ytaiAssistant.copyPodcastScript()" style="margin: 0;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Copy Script
                                </button>
                                <button class="ytai-toolbar-btn" onclick="window.ytaiAssistant.downloadPodcastScript()" style="margin: 0;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Download
                                </button>
                            </div>
                        </div>
                        ${marked.parse(podcastScript)}
                    </div>
                `;

                this.podcastCache = podcastScript;
                this.switchTab('podcast');
                this.showToast('Podcast version created!', 'success');

            } catch (error) {
                console.error('Error generating podcast:', error);
                contentEl.innerHTML = `
                    <div class="ytai-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <h3>Error Creating Podcast</h3>
                        <p>${error.message}</p>
                        <button onclick="window.ytaiAssistant.generatePodcast()">Try Again</button>
                    </div>
                `;
                this.showToast('Failed to create podcast version', 'error');
            }

            this.setProcessingState('podcast', false);
        }

        loadSummary() {
            const contentEl = this.container.querySelector('[data-content="summary"]');
            if (this.summaryCache) {
                contentEl.innerHTML = `<div class="ytai-ai-content">${marked.parse(this.summaryCache)}</div>`;
            }
        }

        loadBullets() {
            const contentEl = this.container.querySelector('[data-content="bullets"]');
            if (this.bulletsCache) {
                contentEl.innerHTML = `<div class="ytai-ai-content">${marked.parse(this.bulletsCache)}</div>`;
            }
        }

        loadMindMap() {
            const contentEl = this.container.querySelector('[data-content="mindmap"]');
            if (this.mindmapCache) {
                this.renderMindMap(this.mindmapCache);
            }
        }

        loadPresentation() {
            const contentEl = this.container.querySelector('[data-content="presentation"]');
            if (this.presentationCache) {
                this.renderPresentation(this.presentationCache);
            }
        }

        loadPodcast() {
            const contentEl = this.container.querySelector('[data-content="podcast"]');
            if (this.podcastCache) {
                contentEl.innerHTML = `<div class="ytai-ai-content">${marked.parse(this.podcastCache)}</div>`;
            }
        }

        renderMindMap(data) {
            const contentEl = this.container.querySelector('[data-content="mindmap"]');

            contentEl.innerHTML = `
                <div class="ytai-mindmap-container">
                    <div class="ytai-mindmap-controls">
                        <button class="ytai-mindmap-control" data-action="reset" title="Reset View">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="1 4 1 10 7 10"></polyline>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                            </svg>
                        </button>
                        <button class="ytai-mindmap-control" data-action="download" title="Download Image">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                    </div>
                    <canvas class="ytai-mindmap-canvas" id="ytai-mindmap-canvas"></canvas>
                </div>
            `;

            const canvas = contentEl.querySelector('#ytai-mindmap-canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size
            const container = canvas.parentElement;
            canvas.width = container.offsetWidth;
            canvas.height = 400;

            this.drawMindMap(ctx, data, canvas.width, canvas.height);

            // Add control event listeners
            contentEl.querySelectorAll('.ytai-mindmap-control').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    if (action === 'reset') {
                        this.drawMindMap(ctx, data, canvas.width, canvas.height);
                    } else if (action === 'download') {
                        this.downloadMindMapImage(canvas);
                    }
                });
            });
        }

        drawMindMap(ctx, data, width, height) {
            ctx.clearRect(0, 0, width, height);

            const centerX = width / 2;
            const centerY = height / 2;
            const centralRadius = 80;
            const branchRadius = 50;
            const branchDistance = Math.min(width, height) * 0.3;

            // Color palette
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFCE56', '#6C5CE7', '#A29BFE'];

            // Draw central node
            ctx.beginPath();
            ctx.arc(centerX, centerY, centralRadius, 0, 2 * Math.PI);
            ctx.fillStyle = '#2C3E50';
            ctx.fill();
            ctx.strokeStyle = '#34495E';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Draw central text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Roboto, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            this.wrapText(ctx, data.central || 'Main Topic', centerX, centerY, centralRadius * 1.6);

            if (data.branches && data.branches.length > 0) {
                const angleStep = (2 * Math.PI) / data.branches.length;

                data.branches.forEach((branch, index) => {
                    const angle = index * angleStep - Math.PI / 2;
                    const branchX = centerX + Math.cos(angle) * branchDistance;
                    const branchY = centerY + Math.sin(angle) * branchDistance;
                    const color = branch.color || colors[index % colors.length];

                    // Draw connection line
                    ctx.beginPath();
                    ctx.moveTo(centerX + Math.cos(angle) * centralRadius, centerY + Math.sin(angle) * centralRadius);
                    ctx.lineTo(branchX - Math.cos(angle) * branchRadius, branchY - Math.sin(angle) * branchRadius);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 4;
                    ctx.stroke();

                    // Draw branch node
                    ctx.beginPath();
                    ctx.arc(branchX, branchY, branchRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = this.darkenColor(color, 20);
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Draw branch text
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 14px Roboto, Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    this.wrapText(ctx, branch.topic, branchX, branchY, branchRadius * 1.5);

                    // Draw subtopics
                    if (branch.subtopics && branch.subtopics.length > 0) {
                        const subAngleRange = Math.PI / 2;
                        const subAngleStep = subAngleRange / (branch.subtopics.length + 1);
                        const startAngle = angle - subAngleRange / 2;

                        branch.subtopics.forEach((subtopic, subIndex) => {
                            const subAngle = startAngle + (subIndex + 1) * subAngleStep;
                            const subDistance = 100;
                            const subX = branchX + Math.cos(subAngle) * subDistance;
                            const subY = branchY + Math.sin(subAngle) * subDistance;

                            // Draw subtopic connection
                            ctx.beginPath();
                            ctx.moveTo(branchX + Math.cos(subAngle) * branchRadius, branchY + Math.sin(subAngle) * branchRadius);
                            ctx.lineTo(subX, subY);
                            ctx.strokeStyle = this.lightenColor(color, 40);
                            ctx.lineWidth = 2;
                            ctx.stroke();

                            // Draw subtopic box
                            const boxWidth = 120;
                            const boxHeight = 30;
                            ctx.fillStyle = 'white';
                            ctx.fillRect(subX - boxWidth/2, subY - boxHeight/2, boxWidth, boxHeight);
                            ctx.strokeStyle = color;
                            ctx.lineWidth = 1;
                            ctx.strokeRect(subX - boxWidth/2, subY - boxHeight/2, boxWidth, boxHeight);

                            // Draw subtopic text
                            ctx.fillStyle = '#2C3E50';
                            ctx.font = '12px Roboto, Arial, sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';

                            let text = subtopic;
                            if (ctx.measureText(text).width > boxWidth - 10) {
                                while (ctx.measureText(text + '...').width > boxWidth - 10 && text.length > 0) {
                                    text = text.substring(0, text.length - 1);
                                }
                                text += '...';
                            }
                            ctx.fillText(text, subX, subY);
                        });
                    }
                });
            }
        }

        wrapText(ctx, text, x, y, maxWidth) {
            const words = text.split(' ');
            let line = '';
            let lines = [];

            for (let word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line !== '') {
                    lines.push(line);
                    line = word + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);

            const lineHeight = 18;
            const startY = y - (lines.length - 1) * lineHeight / 2;

            lines.forEach((line, index) => {
                ctx.fillText(line.trim(), x, startY + index * lineHeight);
            });
        }

        darkenColor(color, percent) {
            const num = parseInt(color.replace("#", ""), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) - amt;
            const G = (num >> 8 & 0x00FF) - amt;
            const B = (num & 0x0000FF) - amt;
            return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
        }

        lightenColor(color, percent) {
            const num = parseInt(color.replace("#", ""), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
        }

        renderPresentation(presentationText) {
            const contentEl = this.container.querySelector('[data-content="presentation"]');
            const slides = presentationText.split('---').filter(slide => slide.trim());

            const slidesHTML = slides.map((slide, index) => {
                const slideContent = marked.parse(slide.trim());
                return `
                    <div class="ytai-slide">
                        <div class="ytai-slide-number">Slide ${index + 1}</div>
                        ${slideContent}
                    </div>
                `;
            }).join('');

            contentEl.innerHTML = `
                <div class="ytai-presentation-container">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2>📊 Generated Presentation</h2>
                        <p>Total slides: ${slides.length}</p>
                        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 12px;">
                            <button class="ytai-toolbar-btn" onclick="window.ytaiAssistant.downloadPresentation()" style="margin: 0;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Download
                            </button>
                            <button class="ytai-toolbar-btn" onclick="window.ytaiAssistant.copyPresentation()" style="margin: 0;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                    </div>
                    ${slidesHTML}
                </div>
            `;
        }

        async handleChatMessage(message) {
            const messagesEl = document.querySelector('#ytai-chat-messages');
            const sendBtn = document.querySelector('#ytai-chat-send');

            // Add user message
            messagesEl.innerHTML += `
                <div class="ytai-chat-message user">
                    <div class="ytai-chat-avatar">U</div>
                    <div class="ytai-chat-bubble">${message}</div>
                </div>
            `;

            this.isProcessing = true;
            sendBtn.disabled = true;

            const typingId = 'typing-' + Date.now();
            messagesEl.innerHTML += `
                <div class="ytai-chat-message ai" id="${typingId}">
                    <div class="ytai-chat-avatar">AI</div>
                    <div class="ytai-chat-bubble">
                        <div class="ytai-spinner" style="width: 16px; height: 16px; margin: 0;"></div>
                        Thinking...
                    </div>
                </div>
            `;

            messagesEl.scrollTop = messagesEl.scrollHeight;

            try {
                if (!CONFIG.OPENAI_API_KEY) {
                    throw new Error('OpenAI API key not configured');
                }

                if (this.transcript.length === 0) {
                    await this.loadTranscript();
                }

                const transcriptText = this.transcript.map(t => t.text).join(' ').substring(0, 8000);

                const response = await this.callOpenAI([
                    {
                        role: 'system',
                        content: `You are a helpful AI assistant discussing a YouTube video. Here is the transcript:\n\n${transcriptText}\n\nAnswer questions about this video content. Be helpful, accurate, and conversational.`
                    },
                    ...this.chatHistory,
                    {
                        role: 'user',
                        content: message
                    }
                ]);

                document.getElementById(typingId).remove();

                messagesEl.innerHTML += `
                    <div class="ytai-chat-message ai">
                        <div class="ytai-chat-avatar">AI</div>
                        <div class="ytai-chat-bubble">${marked.parseInline(response)}</div>
                    </div>
                `;

                // Save to chat history
                this.chatHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: response }
                );

                // Limit chat history to last 10 exchanges
                if (this.chatHistory.length > 20) {
                    this.chatHistory = this.chatHistory.slice(-20);
                }

                GM_setValue(`chat_${this.videoId}`, this.chatHistory);

            } catch (error) {
                document.getElementById(typingId).remove();

                messagesEl.innerHTML += `
                    <div class="ytai-chat-message ai">
                        <div class="ytai-chat-avatar">AI</div>
                        <div class="ytai-chat-bubble" style="color: var(--yt-spec-text-error);">
                            Sorry, I encountered an error: ${error.message}
                        </div>
                    </div>
                `;
            }

            this.isProcessing = false;
            sendBtn.disabled = false;
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        restoreChatHistory() {
            const messagesEl = document.querySelector('#ytai-chat-messages');
            if (!messagesEl || this.chatHistory.length === 0) return;

            // Clear default message except for the first AI greeting
            const firstMessage = messagesEl.querySelector('.ytai-chat-message.ai');
            messagesEl.innerHTML = firstMessage ? firstMessage.outerHTML : '';

            // Add chat history
            this.chatHistory.forEach(msg => {
                const isUser = msg.role === 'user';
                messagesEl.innerHTML += `
                    <div class="ytai-chat-message ${isUser ? 'user' : 'ai'}">
                        <div class="ytai-chat-avatar">${isUser ? 'U' : 'AI'}</div>
                        <div class="ytai-chat-bubble">${isUser ? msg.content : marked.parseInline(msg.content)}</div>
                    </div>
                `;
            });

            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        focusChatInput() {
            setTimeout(() => {
                const chatInput = this.container.querySelector('#ytai-chat-input');
                if (chatInput) chatInput.focus();
            }, 100);
        }

        setProcessingState(action, isProcessing) {
            const btn = this.container.querySelector(`[data-action="${action}"]`);
            if (btn) {
                btn.classList.toggle('processing', isProcessing);
                btn.disabled = isProcessing;
            }
        }

        async callOpenAI(messages) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://api.openai.com/v1/chat/completions',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
                    },
                    data: JSON.stringify({
                        model: CONFIG.OPENAI_MODEL,
                        messages: messages,
                        max_tokens: CONFIG.MAX_TOKENS,
                        temperature: CONFIG.TEMPERATURE
                    }),
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                const data = JSON.parse(response.responseText);
                                resolve(data.choices[0].message.content);
                            } catch (error) {
                                reject(new Error('Failed to parse OpenAI response'));
                            }
                        } else {
                            const errorData = JSON.parse(response.responseText);
                            reject(new Error(errorData.error?.message || `OpenAI API error: ${response.status}`));
                        }
                    },
                    onerror: function() {
                        reject(new Error('Network error while calling OpenAI API'));
                    }
                });
            });
        }

        // Copy functions
        copyTranscript(withTimestamps = true) {
            const currentTranscript = this.getCurrentDisplayedTranscript();
            let content = '';

            if (withTimestamps) {
                content = currentTranscript.map(item => `${this.formatTime(item.start)}: ${item.text}`).join('\n\n');
            } else {
                content = currentTranscript.map(item => item.text).join('\n\n');
            }

            this.copyToClipboard(content);
            this.showToast(`Transcript copied ${withTimestamps ? 'with' : 'without'} timestamps!`, 'success');
        }

        copyToClipboard(text) {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text);
            } else {
                navigator.clipboard.writeText(text).catch(() => {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                });
            }
        }

        // Download functions
        downloadTranscript(format = 'txt', withTimestamps = true) {
            const currentTranscript = this.getCurrentDisplayedTranscript();
            let content = '';
            let filename = '';

            if (format === 'srt') {
                content = this.generateSRT(currentTranscript);
                filename = `${this.videoId}_subtitles.srt`;
            } else {
                if (withTimestamps) {
                    content = currentTranscript.map(item => `${this.formatTime(item.start)}: ${item.text}`).join('\n\n');
                    filename = `${this.videoId}_transcript_with_timestamps.txt`;
                } else {
                    content = currentTranscript.map(item => item.text).join('\n\n');
                    filename = `${this.videoId}_transcript.txt`;
                }
            }

            this.downloadFile(content, filename);
            this.showToast(`${format.toUpperCase()} file downloaded!`, 'success');
        }

        generateSRT(transcript) {
            return transcript.map((item, index) => {
                const startTime = this.formatSRTTime(item.start);
                const endTime = this.formatSRTTime(item.start + item.duration);
                return `${index + 1}\n${startTime} --> ${endTime}\n${item.text}\n`;
            }).join('\n');
        }

        formatSRTTime(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            const ms = Math.floor((seconds % 1) * 1000);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
        }

        downloadFile(content, filename) {
            if (typeof GM_download !== 'undefined') {
                const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
                GM_download(dataUrl, filename);
            } else {
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
        }

        getCurrentDisplayedTranscript() {
            return this.translatedTranscript[this.currentLanguage] || this.transcript;
        }

        // Translation functions
        async translateTranscript(targetLang, languageName) {
            this.showToast(`Translating to ${languageName}...`, 'info');

            try {
                await this.switchTranscriptLanguage(targetLang);
                this.currentLanguage = targetLang;
                this.showToast(`Translated to ${languageName}!`, 'success');
            } catch (error) {
                this.showToast('Translation failed', 'error');
            }
        }

        // Footer action functions
        openNotesModal() {
            const modal = document.createElement('div');
            modal.className = 'ytai-modal ytai-notes-modal';
            modal.innerHTML = `
                <div class="ytai-modal-content">
                    <div class="ytai-modal-header">
                        <h2 class="ytai-modal-title">📝 Personal Notes</h2>
                        <button class="ytai-modal-close" aria-label="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <textarea class="ytai-notes-editor" placeholder="Write your personal notes about this video here...">${this.personalNotes}</textarea>
                    <div class="ytai-notes-actions">
                        <div class="ytai-notes-info">Auto-saved locally</div>
                        <button class="ytai-notes-save">Save Notes</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            setTimeout(() => modal.classList.add('show'), 10);

            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                }, 300);
            };

            modal.querySelector('.ytai-modal-close').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            const editor = modal.querySelector('.ytai-notes-editor');
            const saveBtn = modal.querySelector('.ytai-notes-save');

            editor.addEventListener('input', () => {
                this.personalNotes = editor.value;
                GM_setValue(`personal_notes_${this.videoId}`, this.personalNotes);
            });

            saveBtn.addEventListener('click', () => {
                this.personalNotes = editor.value;
                GM_setValue(`personal_notes_${this.videoId}`, this.personalNotes);
                this.showToast('Notes saved!', 'success');
                closeModal();
            });

            editor.focus();
        }

        likeVideo() {
            // Try to click the like button on the page
            const likeButton = document.querySelector('#segmented-like-button button[aria-label*="like"], ytd-toggle-button-renderer[aria-label*="like"] button');
            if (likeButton) {
                likeButton.click();
                this.showToast('Video liked!', 'success');
            } else {
                this.showToast('Like button not found', 'error');
            }
        }

        copyVideoLink() {
            const videoUrl = `https://www.youtube.com/watch?v=${this.videoId}`;
            this.copyToClipboard(videoUrl);
            this.showToast('Video link copied!', 'success');
        }

        exportToNotion() {
            // Create a formatted text for Notion
            const notionContent = this.generateNotionExport();
            this.copyToClipboard(notionContent);
            this.showToast('Content copied! Paste into Notion.', 'success');
        }

        generateNotionExport() {
            const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';
            const videoUrl = `https://www.youtube.com/watch?v=${this.videoId}`;

            let content = `# ${videoTitle}\n\n`;
            content += `**Video URL:** ${videoUrl}\n\n`;

            if (this.summaryCache) {
                content += `## Summary\n\n${this.summaryCache}\n\n`;
            }

            if (this.bulletsCache) {
                content += `## Key Points\n\n${this.bulletsCache}\n\n`;
            }

            if (this.personalNotes) {
                content += `## My Notes\n\n${this.personalNotes}\n\n`;
            }

            const currentTranscript = this.getCurrentDisplayedTranscript();
            if (currentTranscript.length > 0) {
                content += `## Transcript\n\n`;
                content += currentTranscript.map(item => `**${this.formatTime(item.start)}:** ${item.text}`).join('\n\n');
            }

            return content;
        }

        shareViaEmail() {
            const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';
            const videoUrl = `https://www.youtube.com/watch?v=${this.videoId}`;

            const subject = encodeURIComponent(`Check out this video: ${videoTitle}`);
            const body = encodeURIComponent(`I thought you might find this video interesting:\n\n${videoTitle}\n${videoUrl}\n\nGenerated via AI Assistant`);

            window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
        }

        openSettingsModal() {
            const modal = document.createElement('div');
            modal.className = 'ytai-modal';
            modal.innerHTML = `
                <div class="ytai-modal-content">
                    <div class="ytai-modal-header">
                        <h2 class="ytai-modal-title">⚙️ Settings</h2>
                        <button class="ytai-modal-close" aria-label="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="ytai-settings-field">
                        <label class="ytai-settings-label">OpenAI API Key</label>
                        <input type="password" class="ytai-settings-input" id="openai-key" value="${CONFIG.OPENAI_API_KEY}" placeholder="Enter your OpenAI API key">
                        <small style="color: var(--yt-spec-text-secondary); font-size: 12px; display: block; margin-top: 4px;">
                            Required for AI features. Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--yt-spec-call-to-action);">OpenAI Platform</a>
                        </small>
                    </div>
                    <div class="ytai-settings-field">
                        <label class="ytai-settings-label">AI Model</label>
                        <select class="ytai-settings-input" id="openai-model">
                            <option value="gpt-4o-mini" ${CONFIG.OPENAI_MODEL === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini (Recommended)</option>
                            <option value="gpt-4o" ${CONFIG.OPENAI_MODEL === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
                            <option value="gpt-4" ${CONFIG.OPENAI_MODEL === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                            <option value="gpt-3.5-turbo" ${CONFIG.OPENAI_MODEL === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
                        </select>
                    </div>
                    <div class="ytai-settings-field">
                        <label class="ytai-settings-label">Max Tokens</label>
                        <input type="number" class="ytai-settings-input" id="max-tokens" value="${CONFIG.MAX_TOKENS}" min="500" max="8000" placeholder="2000">
                    </div>
                    <div class="ytai-settings-field">
                        <label class="ytai-settings-label">Temperature (Creativity)</label>
                        <input type="range" class="ytai-settings-input" id="temperature" value="${CONFIG.TEMPERATURE}" min="0" max="1" step="0.1">
                        <small style="color: var(--yt-spec-text-secondary); font-size: 12px;">Current: ${CONFIG.TEMPERATURE} (0 = Focused, 1 = Creative)</small>
                    </div>
                    <button class="ytai-settings-save">Save Settings</button>
                </div>
            `;

            document.body.appendChild(modal);
            setTimeout(() => modal.classList.add('show'), 10);

            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                }, 300);
            };

            modal.querySelector('.ytai-modal-close').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // Temperature slider update
            const tempSlider = modal.querySelector('#temperature');
            const tempLabel = modal.querySelector('small');
            tempSlider.addEventListener('input', (e) => {
                tempLabel.textContent = `Current: ${e.target.value} (0 = Focused, 1 = Creative)`;
            });

            modal.querySelector('.ytai-settings-save').addEventListener('click', () => {
                const apiKey = modal.querySelector('#openai-key').value.trim();
                const model = modal.querySelector('#openai-model').value;
                const maxTokens = parseInt(modal.querySelector('#max-tokens').value);
                const temperature = parseFloat(modal.querySelector('#temperature').value);

                CONFIG.OPENAI_API_KEY = apiKey;
                CONFIG.OPENAI_MODEL = model;
                CONFIG.MAX_TOKENS = maxTokens;
                CONFIG.TEMPERATURE = temperature;

                GM_setValue('openai_api_key', apiKey);
                GM_setValue('openai_model', model);
                GM_setValue('max_tokens', maxTokens);
                GM_setValue('temperature', temperature);

                this.showToast('Settings saved!', 'success');
                closeModal();
            });
        }

        // Additional utility functions
        copyPodcastScript() {
            if (this.podcastCache) {
                this.copyToClipboard(this.podcastCache);
                this.showToast('Podcast script copied!', 'success');
            }
        }

        downloadPodcastScript() {
            if (this.podcastCache) {
                this.downloadFile(this.podcastCache, `${this.videoId}_podcast_script.txt`);
                this.showToast('Podcast script downloaded!', 'success');
            }
        }

        copyPresentation() {
            if (this.presentationCache) {
                this.copyToClipboard(this.presentationCache);
                this.showToast('Presentation copied!', 'success');
            }
        }

        downloadPresentation() {
            if (this.presentationCache) {
                this.downloadFile(this.presentationCache, `${this.videoId}_presentation.md`);
                this.showToast('Presentation downloaded!', 'success');
            }
        }

        downloadMindMapImage(canvas) {
            try {
                const link = document.createElement('a');
                link.download = `${this.videoId}_mindmap.png`;
                link.href = canvas.toDataURL();
                link.click();
                this.showToast('Mind map image downloaded!', 'success');
            } catch (error) {
                this.showToast('Failed to download mind map', 'error');
            }
        }

        showToast(message, type = 'success') {
            const existingToast = document.querySelector('.ytai-toast');
            if (existingToast) {
                document.body.removeChild(existingToast);
            }

            const toast = document.createElement('div');
            toast.className = `ytai-toast ${type}`;

            const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

            toast.innerHTML = `
                <span style="font-size: 16px;">${icon}</span>
                <span>${message}</span>
            `;

            document.body.appendChild(toast);

            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 3000);
        }

        toggleNotes() {
            this.openNotesModal();
        }
    }

    // Load saved settings
    CONFIG.OPENAI_MODEL = GM_getValue('openai_model', CONFIG.OPENAI_MODEL);
    CONFIG.MAX_TOKENS = GM_getValue('max_tokens', CONFIG.MAX_TOKENS);
    CONFIG.TEMPERATURE = GM_getValue('temperature', CONFIG.TEMPERATURE);

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new YouTubeAIAssistant();
        });
    } else {
        new YouTubeAIAssistant();
    }

    console.log('🎯 YouTube AI Assistant Pro - Complete Edition loaded successfully');
})();

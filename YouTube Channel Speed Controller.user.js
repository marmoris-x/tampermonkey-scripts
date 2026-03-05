// ==UserScript==
// @name         YouTube Channel Speed Controller
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Adds channel-specific speed control to YouTube settings menu with optimized performance
// @author       marmoris
// @match        https://www.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @icon         https://www.youtube.com/favicon.ico
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration constants
    const CONFIG = {
        DEBUG: false,
        SPEED_SETTINGS_KEY: 'channel_speed_settings',
        TIMING: {
            MENU_INSERT_DELAY: 50,
            SPEED_APPLY_RETRY: 1000,
            INIT_TIMEOUT: 15000,
            LISTENER_CLEANUP: 2000
        }
    };

    // Speed options (0.25 to 2.00 in 0.05 increments)
    const SPEEDS = Array.from({ length: 36 }, (_, i) => Math.round((0.25 + i * 0.05) * 100) / 100);

    // State management
    let settingsCache = null;
    let isInCustomPanel = false;
    let customPanelWrapper = null;
    let cachedLanguage = null;
    const observers = new Set();

    // Debug logging
    function logDebug(...args) {
        if (CONFIG.DEBUG) console.log('[YT-SPEED]', ...args);
    }

    // Language translations
    const translations = {
        // English (default)
        en: {
            channelSpeed: 'Channel Speed',
            speedFor: 'Speed for:',
            thisVideo: 'This video',
            standard: 'Normal',
            slow: 'Slow',
            normal: 'Normal',
            fast: 'Fast',
            veryFast: 'Very fast'
        },
        // German
        de: {
            channelSpeed: 'Kanalgeschwindigkeit',
            speedFor: 'Geschwindigkeit für:',
            thisVideo: 'Dieses Video',
            standard: 'Standard',
            slow: 'Langsam',
            normal: 'Normal',
            fast: 'Schnell',
            veryFast: 'Sehr schnell'
        },
        // Spanish
        es: {
            channelSpeed: 'Velocidad del canal',
            speedFor: 'Velocidad para:',
            thisVideo: 'Este video',
            standard: 'Estándar',
            slow: 'Lento',
            normal: 'Normal',
            fast: 'Rápido',
            veryFast: 'Muy rápido'
        },
        // French
        fr: {
            channelSpeed: 'Vitesse du canal',
            speedFor: 'Vitesse pour:',
            thisVideo: 'Cette vidéo',
            standard: 'Standard',
            slow: 'Lent',
            normal: 'Normal',
            fast: 'Rapide',
            veryFast: 'Très rapide'
        },
        // Mandarin Chinese
        zh: {
            channelSpeed: '频道速度',
            speedFor: '速度设置:',
            thisVideo: '此视频',
            standard: '标准',
            slow: '慢速',
            normal: '正常',
            fast: '快速',
            veryFast: '极快'
        },
        // Hindi
        hi: {
            channelSpeed: 'चैनल गति',
            speedFor: 'इसके लिए गति:',
            thisVideo: 'यह वीडियो',
            standard: 'सामान्य',
            slow: 'धीमा',
            normal: 'सामान्य',
            fast: 'तेज़',
            veryFast: 'बहुत तेज़'
        },
        // Arabic
        ar: {
            channelSpeed: 'سرعة القناة',
            speedFor: 'السرعة لـ:',
            thisVideo: 'هذا الفيديو',
            standard: 'قياسي',
            slow: 'بطيء',
            normal: 'عادي',
            fast: 'سريع',
            veryFast: 'سريع جداً'
        },
        // Portuguese
        pt: {
            channelSpeed: 'Velocidade do Canal',
            speedFor: 'Velocidade para:',
            thisVideo: 'Este vídeo',
            standard: 'Padrão',
            slow: 'Lento',
            normal: 'Normal',
            fast: 'Rápido',
            veryFast: 'Muito rápido'
        },
        // Bengali
        bn: {
            channelSpeed: 'চ্যানেল গতি',
            speedFor: 'এর জন্য গতি:',
            thisVideo: 'এই ভিডিও',
            standard: 'স্ট্যান্ডার্ড',
            slow: 'ধীর',
            normal: 'স্বাভাবিক',
            fast: 'দ্রুত',
            veryFast: 'অতি দ্রুত'
        },
        // Russian
        ru: {
            channelSpeed: 'Скорость канала',
            speedFor: 'Скорость для:',
            thisVideo: 'Этого видео',
            standard: 'Стандартная',
            slow: 'Медленно',
            normal: 'Нормально',
            fast: 'Быстро',
            veryFast: 'Очень быстро'
        },
        // Japanese
        ja: {
            channelSpeed: 'チャンネル速度',
            speedFor: '速度設定:',
            thisVideo: 'この動画',
            standard: '標準',
            slow: '遅い',
            normal: '標準',
            fast: '速い',
            veryFast: '非常に速い'
        },
        // Punjabi
        pa: {
            channelSpeed: 'ਚੈਨਲ ਸਪੀਡ',
            speedFor: 'ਇਸ ਲਈ ਸਪੀਡ:',
            thisVideo: 'ਇਹ ਵੀਡੀਓ',
            standard: 'ਸਟੈਂਡਰਡ',
            slow: 'ਹੌਲੀ',
            normal: 'ਸਧਾਰਨ',
            fast: 'ਤੇਜ਼',
            veryFast: 'ਬਹੁਤ ਤੇਜ਼'
        },
        // Indonesian
        id: {
            channelSpeed: 'Kecepatan Saluran',
            speedFor: 'Kecepatan untuk:',
            thisVideo: 'Video ini',
            standard: 'Standar',
            slow: 'Lambat',
            normal: 'Normal',
            fast: 'Cepat',
            veryFast: 'Sangat cepat'
        },
        // Italian
        it: {
            channelSpeed: 'Velocità del canale',
            speedFor: 'Velocità per:',
            thisVideo: 'Questo video',
            standard: 'Standard',
            slow: 'Lento',
            normal: 'Normale',
            fast: 'Veloce',
            veryFast: 'Molto veloce'
        },
        // Turkish
        tr: {
            channelSpeed: 'Kanal Hızı',
            speedFor: 'Hız ayarı:',
            thisVideo: 'Bu video',
            standard: 'Standart',
            slow: 'Yavaş',
            normal: 'Normal',
            fast: 'Hızlı',
            veryFast: 'Çok hızlı'
        },
        // Korean
        ko: {
            channelSpeed: '채널 속도',
            speedFor: '속도 설정:',
            thisVideo: '이 동영상',
            standard: '표준',
            slow: '느림',
            normal: '보통',
            fast: '빠름',
            veryFast: '매우 빠름'
        },
        // Vietnamese
        vi: {
            channelSpeed: 'Tốc độ kênh',
            speedFor: 'Tốc độ cho:',
            thisVideo: 'Video này',
            standard: 'Tiêu chuẩn',
            slow: 'Chậm',
            normal: 'Bình thường',
            fast: 'Nhanh',
            veryFast: 'Rất nhanh'
        },
        // Polish
        pl: {
            channelSpeed: 'Prędkość kanału',
            speedFor: 'Prędkość dla:',
            thisVideo: 'Ten film',
            standard: 'Standardowa',
            slow: 'Wolno',
            normal: 'Normalna',
            fast: 'Szybko',
            veryFast: 'Bardzo szybko'
        },
        // Dutch
        nl: {
            channelSpeed: 'Kanaalsnelheid',
            speedFor: 'Snelheid voor:',
            thisVideo: 'Deze video',
            standard: 'Standaard',
            slow: 'Langzaam',
            normal: 'Normaal',
            fast: 'Snel',
            veryFast: 'Zeer snel'
        },
        // Thai
        th: {
            channelSpeed: 'ความเร็วช่อง',
            speedFor: 'ความเร็วสำหรับ:',
            thisVideo: 'วิดีโอนี้',
            standard: 'มาตรฐาน',
            slow: 'ช้า',
            normal: 'ปกติ',
            fast: 'เร็ว',
            veryFast: 'เร็วมาก'
        }
    };

    // Get user language (cached)
    function getUserLanguage() {
        if (cachedLanguage) return cachedLanguage;

        try {
            // First check YouTube's language
            const html = document.documentElement;
            if (html?.lang) {
                const ytLang = html.lang.split('-')[0];
                if (translations[ytLang]) {
                    cachedLanguage = ytLang;
                    return ytLang;
                }
            }

            // Then check browser language
            const browserLang = navigator.language || navigator.userLanguage;
            const baseLang = browserLang.split('-')[0];
            if (translations[baseLang]) {
                cachedLanguage = baseLang;
                return baseLang;
            }
        } catch (error) {
            logDebug('Error detecting language:', error);
        }

        // Default to English
        cachedLanguage = 'en';
        return 'en';
    }

    // Get translation string
    function getTranslation(key) {
        const lang = getUserLanguage();
        return translations[lang]?.[key] || translations.en[key];
    }

    // Get YouTube playback speed menu item text
    function getYouTubeSpeedMenuItemText() {
        const speedTextMap = {
            en: 'Playback speed',
            de: 'Wiedergabegeschwindigkeit',
            es: 'Velocidad de reproducción',
            fr: 'Vitesse de lecture'
        };

        try {
            const menuItems = document.querySelectorAll('.ytp-menuitem');
            if (!menuItems.length) return null;

            for (const item of menuItems) {
                const label = item.querySelector('.ytp-menuitem-label');
                if (!label) continue;

                const labelText = label.textContent.trim();
                for (const langText of Object.values(speedTextMap)) {
                    if (labelText === langText) {
                        return labelText;
                    }
                }
            }
        } catch (error) {
            logDebug('Error finding speed menu item:', error);
        }

        return null;
    }

    GM_addStyle(`
        .custom-speed-panel {
            width: 100%;
            height: 100%;
            overflow-y: auto;
        }
        .custom-speed-panel::-webkit-scrollbar {
            width: 5px;
        }
        .custom-speed-panel::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-speed-panel::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.3);
            border-radius: 2px;
        }
        .custom-speed-header {
            display: flex;
            align-items: center;
            padding: 12px;
            color: white;
            cursor: pointer;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .custom-speed-header .back-icon {
            margin-right: 16px;
        }
        .custom-speed-section {
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 4px 0;
        }
        .custom-speed-section:last-child {
            border-bottom: none;
        }
        .custom-speed-section-label {
            padding: 8px 16px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            font-weight: 500;
        }
        .custom-speed-option {
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: white;
            cursor: pointer;
        }
        .custom-speed-option:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        .custom-speed-option.active {
            font-weight: 500;
        }
        .custom-speed-option.active::after {
            content: "✓";
            margin-left: 8px;
        }
        .channel-speed-icon svg {
            fill: white;
        }
    `);

    function getSpeedSettings() {
        if (!settingsCache) {
            try {
                settingsCache = GM_getValue(CONFIG.SPEED_SETTINGS_KEY, {});
            } catch (error) {
                logDebug('Error loading settings:', error);
                settingsCache = {};
            }
        }
        return settingsCache;
    }

    function saveSpeedSetting(channelId, speed) {
        try {
            const settings = getSpeedSettings();
            settings[channelId] = speed;
            settingsCache = settings;
            GM_setValue(CONFIG.SPEED_SETTINGS_KEY, settings);
            logDebug('Saved speed setting:', channelId, speed);
        } catch (error) {
            logDebug('Error saving settings:', error);
        }
    }

    function applySpeed(speed) {
        try {
            const video = document.querySelector('video');
            if (video && Math.abs(video.playbackRate - speed) > 0.01) {
                video.playbackRate = speed;
                logDebug('Applied speed:', speed);
                return true;
            }
        } catch (error) {
            logDebug('Error applying speed:', error);
        }
        return false;
    }

    function getChannelName() {
        try {
            const channelNameElement = document.querySelector('#upload-info #channel-name #text a');
            if (channelNameElement) {
                return channelNameElement.textContent.trim();
            }
        } catch (error) {
            logDebug('Error getting channel name:', error);
        }
        return getTranslation('thisVideo');
    }

    function getChannelId() {
        try {
            const channelName = document.querySelector('#upload-info #channel-name #text a');
            if (channelName) {
                return channelName.href.split('/').pop();
            }

            // Fallback to video ID if channel not found
            const urlParams = new URLSearchParams(window.location.search);
            const videoId = urlParams.get('v');
            return videoId || window.location.href;
        } catch (error) {
            logDebug('Error getting channel ID:', error);
            return window.location.href;
        }
    }

    function updateChannelSpeedMenuItemContent() {
        try {
            const channelId = getChannelId();
            const savedSpeed = getSpeedSettings()[channelId];
            const menuItem = document.querySelector('#channel-speed-menuitem .ytp-menuitem-content');

            if (menuItem) {
                if (savedSpeed && savedSpeed !== 1.0) {
                    menuItem.textContent = `${savedSpeed}x`;
                } else {
                    menuItem.textContent = getTranslation('standard');
                }
            }
        } catch (error) {
            logDebug('Error updating menu item:', error);
        }
    }

    function createCustomSpeedPanel(currentSpeed, closeCallback) {
        const panel = document.createElement('div');
        panel.className = 'custom-speed-panel';

        // Add back button header
        const header = document.createElement('div');
        header.className = 'custom-speed-header';
        header.innerHTML = `
            <div class="back-icon">
                <svg height="24" viewBox="0 0 24 24" width="24">
                    <path d="M20,11H7.83l5.59-5.59L12,4l-8,8l8,8l1.41-1.41L7.83,13H20V11z" fill="white"></path>
                </svg>
            </div>
            <div>${getTranslation('channelSpeed')}</div>
        `;
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCallback();
        });
        panel.appendChild(header);

        // Add channel info
        const channelInfo = document.createElement('div');
        channelInfo.className = 'custom-speed-section-label';
        channelInfo.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        channelInfo.style.padding = '8px 16px 12px';
        channelInfo.innerHTML = `${getTranslation('speedFor')}<br><strong>${getChannelName()}</strong>`;
        panel.appendChild(channelInfo);

        // Group speeds
        const groups = {
            [getTranslation('slow')]: SPEEDS.filter(s => s < 1),
            [getTranslation('normal')]: SPEEDS.filter(s => s === 1),
            [getTranslation('fast')]: SPEEDS.filter(s => s > 1 && s <= 2),
            [getTranslation('veryFast')]: SPEEDS.filter(s => s > 2)
        };

        // Create sections
        Object.entries(groups).forEach(([groupName, speeds]) => {
            if (speeds.length === 0) return;

            const section = document.createElement('div');
            section.className = 'custom-speed-section';

            const label = document.createElement('div');
            label.className = 'custom-speed-section-label';
            label.textContent = groupName;
            section.appendChild(label);

            speeds.forEach(speed => {
                const option = document.createElement('div');
                option.className = `custom-speed-option ${Math.abs(speed - currentSpeed) < 0.01 ? 'active' : ''}`;
                option.textContent = `${speed}x`;

                option.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Apply the speed and save it
                    const channelId = getChannelId();
                    saveSpeedSetting(channelId, speed);
                    applySpeed(speed);

                    // Update UI active state
                    document.querySelectorAll('.custom-speed-option').forEach(opt =>
                        opt.classList.remove('active'));
                    option.classList.add('active');

                    // Update menu item text
                    updateChannelSpeedMenuItemContent();

                    // Close settings menu
                    const closeButton = document.querySelector('.ytp-settings-button');
                    if (closeButton) closeButton.click();
                });

                section.appendChild(option);
            });

            panel.appendChild(section);
        });

        return panel;
    }

    function handleBackButtonClick() {
        try {
            const settingsMenu = document.querySelector('.ytp-settings-menu');
            if (!settingsMenu) return;

            const mainPanel = settingsMenu.querySelector('.ytp-panel');
            if (!mainPanel) return;

            // Remove custom panel
            if (customPanelWrapper) {
                customPanelWrapper.remove();
                customPanelWrapper = null;
            }

            // Show the main panel again
            mainPanel.style.display = '';
            isInCustomPanel = false;
        } catch (error) {
            logDebug('Error handling back button:', error);
        }
    }

    function insertChannelSpeedMenuItem() {
        try {
            const settingsMenu = document.querySelector('.ytp-settings-menu');
            if (!settingsMenu) return false;

            const panelMenu = settingsMenu.querySelector('.ytp-panel-menu');
            if (!panelMenu) return false;

            const speedMenuText = getYouTubeSpeedMenuItemText();
            if (!speedMenuText) return false;

            const existingSpeedItem = Array.from(
                panelMenu.querySelectorAll('.ytp-menuitem')
            ).find(item => {
                const label = item.querySelector('.ytp-menuitem-label');
                return label && label.textContent === speedMenuText;
            });

            if (!existingSpeedItem) return false;

            // Skip if we already inserted our item
            if (document.querySelector('#channel-speed-menuitem')) return true;

            // Create our channel speed menu item
            const channelSpeedItem = document.createElement('div');
            channelSpeedItem.id = 'channel-speed-menuitem';
            channelSpeedItem.className = 'ytp-menuitem';
            channelSpeedItem.setAttribute('role', 'menuitem');
            channelSpeedItem.setAttribute('tabindex', '0');
            channelSpeedItem.setAttribute('aria-haspopup', 'true');

            const channelId = getChannelId();
            const savedSpeed = getSpeedSettings()[channelId];
            const speedDisplay = savedSpeed && savedSpeed !== 1.0 ? `${savedSpeed}x` : getTranslation('standard');

            channelSpeedItem.innerHTML = `
                <div class="ytp-menuitem-icon channel-speed-icon">
                    <svg height="24" viewBox="0 0 24 24" width="24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                        <path d="M12.68 7.76a1.1 1.1 0 0 0-1.36 0L8.5 9.75v4.5l2.82 1.98c.42.3 1 .3 1.42 0l2.82-1.98v-4.5l-2.89-1.99z"/>
                    </svg>
                </div>
                <div class="ytp-menuitem-label">${getTranslation('channelSpeed')}</div>
                <div class="ytp-menuitem-content">${speedDisplay}</div>
            `;

            channelSpeedItem.addEventListener('click', (e) => {
                e.stopPropagation();

                const mainPanel = settingsMenu.querySelector('.ytp-panel');
                if (!mainPanel) return;

                mainPanel.style.display = 'none';

                const currentSpeed = savedSpeed || 1.0;

                customPanelWrapper = document.createElement('div');
                customPanelWrapper.className = 'ytp-panel';
                customPanelWrapper.style.width = mainPanel.style.width;
                customPanelWrapper.style.height = mainPanel.style.height;

                const customPanel = createCustomSpeedPanel(currentSpeed, handleBackButtonClick);

                customPanelWrapper.appendChild(customPanel);
                settingsMenu.appendChild(customPanelWrapper);
                isInCustomPanel = true;
            });

            existingSpeedItem.insertAdjacentElement('afterend', channelSpeedItem);
            return true;
        } catch (error) {
            logDebug('Error inserting menu item:', error);
            return false;
        }
    }

    function monitorSettingsMenu() {
        try {
            const settingsButton = document.querySelector('.ytp-settings-button');
            if (!settingsButton) return;

            // Watch for settings menu visibility changes
            const observer = new MutationObserver(() => {
                try {
                    const settingsMenu = document.querySelector('.ytp-settings-menu');
                    if (settingsMenu && settingsMenu.style.display !== 'none') {
                        setTimeout(() => {
                            insertChannelSpeedMenuItem();
                            updateChannelSpeedMenuItemContent();
                        }, CONFIG.TIMING.MENU_INSERT_DELAY);
                    }
                } catch (error) {
                    logDebug('Error in settings menu observer:', error);
                }
            });

            const settingsMenu = document.querySelector('.ytp-settings-menu');
            if (settingsMenu) {
                observer.observe(settingsMenu, { attributes: true });
                observers.add(observer);
            }

            // Backup click listener
            settingsButton.addEventListener('click', () => {
                setTimeout(() => {
                    const settingsMenu = document.querySelector('.ytp-settings-menu');
                    if (settingsMenu && settingsMenu.style.display !== 'none') {
                        insertChannelSpeedMenuItem();
                        updateChannelSpeedMenuItemContent();
                    }
                }, CONFIG.TIMING.MENU_INSERT_DELAY);
            });
        } catch (error) {
            logDebug('Error monitoring settings menu:', error);
        }
    }

    function handleNavigation() {
        logDebug('Handling navigation for', location.href);

        try {
            // Use MutationObserver instead of polling
            const observer = new MutationObserver(() => {
                try {
                    const video = document.querySelector('video');
                    const channelName = document.querySelector('#upload-info #channel-name #text a');

                    if (video && channelName) {
                        // Stop observing once we found what we need
                        observer.disconnect();

                        const channelId = channelName.href.split('/').pop();
                        const savedSpeed = getSpeedSettings()[channelId];

                        logDebug('Channel detected:', channelId, 'Saved speed:', savedSpeed);

                        if (savedSpeed) {
                            applySpeed(savedSpeed);

                            // Retry after delay (YouTube sometimes resets it)
                            setTimeout(() => {
                                applySpeed(savedSpeed);
                            }, CONFIG.TIMING.SPEED_APPLY_RETRY);
                        }

                        // Set up settings menu monitoring
                        monitorSettingsMenu();

                        // Monitor playback rate changes
                        const speedObserver = new MutationObserver(() => {
                            try {
                                const ytSpeed = video.playbackRate;
                                if (savedSpeed && Math.abs(ytSpeed - savedSpeed) > 0.01) {
                                    logDebug('YouTube changed speed to', ytSpeed, ', resetting to', savedSpeed);
                                    video.playbackRate = savedSpeed;
                                }
                            } catch (error) {
                                logDebug('Error in speed observer:', error);
                            }
                        });

                        speedObserver.observe(video, { attributes: true });
                        observers.add(speedObserver);
                    }
                } catch (error) {
                    logDebug('Error in navigation observer:', error);
                }
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
            observers.add(observer);

            // Cleanup after timeout
            setTimeout(() => {
                observer.disconnect();
                observers.delete(observer);
            }, CONFIG.TIMING.INIT_TIMEOUT);
        } catch (error) {
            logDebug('Error handling navigation:', error);
        }
    }

    function cleanup() {
        // Disconnect all observers
        observers.forEach(observer => {
            try {
                observer.disconnect();
            } catch (error) {
                logDebug('Error disconnecting observer:', error);
            }
        });
        observers.clear();

        // Reset state
        isInCustomPanel = false;
        customPanelWrapper = null;
    }

    // Main initialization
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        try {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;

                // Cleanup before new navigation
                cleanup();

                if (currentUrl.includes('/watch')) {
                    handleNavigation();
                }
            }
        } catch (error) {
            logDebug('Error in URL observer:', error);
        }
    });

    urlObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
    observers.add(urlObserver);

    // Initial execution
    if (location.href.includes('/watch')) {
        handleNavigation();
    }
})();

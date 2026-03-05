// ==UserScript==
// @name        Dark Reader (Auto) - Enhanced
// @description Dark Reader mit Per-Site Einstellungen, Whitelist/Blacklist und Settings-UI. Klicke auf ⚙️ für Einstellungen.
// @author      Modified through Me
// @namespace   i2p.schimon.dimmer
// @homepageURL https://greasyfork.org/en/scripts/466058-dark-reader
// @supportURL  https://greasyfork.org/en/scripts/466058-dark-reader/feedback
// @copyright   2025, Modified through me
// @license     MIT; https://opensource.org/licenses/MIT
// @icon        https://lh3.googleusercontent.com/T66wTLk-gpBBGsMm0SDJJ3VaI8YM0Utr8NaGCSANmXOfb84K-9GmyXORLKoslfxtasKtQ4spDCdq_zlp_t3QQ6SI0A=s60
// @match       *://*/*
// @exclude     devtools://*
// @version     24.01.12
// @require     https://unpkg.com/darkreader@4.9.104/darkreader.js
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_deleteValue
// @grant       GM_registerMenuCommand
// @noframes
// @run-at      document-start
// ==/UserScript==

(async function() {
    /* global DarkReader GM_setValue GM_getValue GM_deleteValue GM_registerMenuCommand */
    'use strict';

    // ================================
    // CONSTANTS & CONFIGURATION
    // ================================
    const CONSTANTS = {
        NAMESPACE: 'i2p-schimon-dimmer',
        STORAGE_KEYS: {
            GLOBAL_SETTINGS: 'darkReaderGlobalSettings',
            SITE_SETTINGS: 'darkReaderSiteSettings',
            WHITELIST: 'darkReaderWhitelist',
            BLACKLIST: 'darkReaderBlacklist',
            ENABLED_STATE: 'darkReaderEnabled',
            UI_VISIBLE: 'darkReaderUIVisible'
        },
        COLORS: {
            TOGGLE_ACTIVE: '#2196F3',
            TOGGLE_INACTIVE: '#ccc',
            PRIMARY: '#2196F3',
            DANGER: '#f44336',
            SUCCESS: '#4CAF50'
        },
        DEFAULT_CONFIG: {
            brightness: 100,
            contrast: 90,
            sepia: 10
        }
    };

    // ================================
    // STORAGE MANAGER
    // ================================
    const StorageManager = {
        get(key, defaultValue = null) {
            try {
                const value = GM_getValue(key);
                return value !== undefined ? JSON.parse(value) : defaultValue;
            } catch (e) {
                console.error(`[Dark Reader] Fehler beim Laden von ${key}:`, e);
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                GM_setValue(key, JSON.stringify(value));
            } catch (e) {
                console.error(`[Dark Reader] Fehler beim Speichern von ${key}:`, e);
            }
        },

        delete(key) {
            try {
                GM_deleteValue(key);
            } catch (e) {
                console.error(`[Dark Reader] Fehler beim Löschen von ${key}:`, e);
            }
        }
    };

    // ================================
    // SETTINGS MANAGER
    // ================================
    const SettingsManager = {
        getCurrentDomain() {
            return window.location.hostname;
        },

        getGlobalSettings() {
            return StorageManager.get(CONSTANTS.STORAGE_KEYS.GLOBAL_SETTINGS, CONSTANTS.DEFAULT_CONFIG);
        },

        setGlobalSettings(settings) {
            StorageManager.set(CONSTANTS.STORAGE_KEYS.GLOBAL_SETTINGS, settings);
        },

        getSiteSettings(domain = null) {
            const currentDomain = domain || this.getCurrentDomain();
            const allSiteSettings = StorageManager.get(CONSTANTS.STORAGE_KEYS.SITE_SETTINGS, {});
            return allSiteSettings[currentDomain] || null;
        },

        setSiteSettings(settings, domain = null) {
            const currentDomain = domain || this.getCurrentDomain();
            const allSiteSettings = StorageManager.get(CONSTANTS.STORAGE_KEYS.SITE_SETTINGS, {});
            allSiteSettings[currentDomain] = settings;
            StorageManager.set(CONSTANTS.STORAGE_KEYS.SITE_SETTINGS, allSiteSettings);
        },

        deleteSiteSettings(domain = null) {
            const currentDomain = domain || this.getCurrentDomain();
            const allSiteSettings = StorageManager.get(CONSTANTS.STORAGE_KEYS.SITE_SETTINGS, {});
            delete allSiteSettings[currentDomain];
            StorageManager.set(CONSTANTS.STORAGE_KEYS.SITE_SETTINGS, allSiteSettings);
        },

        getCurrentSettings() {
            return this.getSiteSettings() || this.getGlobalSettings();
        },

        getWhitelist() {
            return StorageManager.get(CONSTANTS.STORAGE_KEYS.WHITELIST, []);
        },

        getBlacklist() {
            return StorageManager.get(CONSTANTS.STORAGE_KEYS.BLACKLIST, []);
        },

        addToWhitelist(domain) {
            const whitelist = this.getWhitelist();
            if (!whitelist.includes(domain)) {
                whitelist.push(domain);
                StorageManager.set(CONSTANTS.STORAGE_KEYS.WHITELIST, whitelist);
            }
        },

        addToBlacklist(domain) {
            const blacklist = this.getBlacklist();
            if (!blacklist.includes(domain)) {
                blacklist.push(domain);
                StorageManager.set(CONSTANTS.STORAGE_KEYS.BLACKLIST, blacklist);
            }
        },

        removeFromWhitelist(domain) {
            const whitelist = this.getWhitelist().filter(d => d !== domain);
            StorageManager.set(CONSTANTS.STORAGE_KEYS.WHITELIST, whitelist);
        },

        removeFromBlacklist(domain) {
            const blacklist = this.getBlacklist().filter(d => d !== domain);
            StorageManager.set(CONSTANTS.STORAGE_KEYS.BLACKLIST, blacklist);
        },

        isWhitelisted(domain = null) {
            const currentDomain = domain || this.getCurrentDomain();
            return this.getWhitelist().includes(currentDomain);
        },

        isBlacklisted(domain = null) {
            const currentDomain = domain || this.getCurrentDomain();
            return this.getBlacklist().includes(currentDomain);
        },

        shouldEnableOnCurrentSite() {
            if (this.isBlacklisted()) return false;
            return true;
        },

        getEnabledState() {
            return StorageManager.get(CONSTANTS.STORAGE_KEYS.ENABLED_STATE, true);
        },

        setEnabledState(enabled) {
            StorageManager.set(CONSTANTS.STORAGE_KEYS.ENABLED_STATE, enabled);
        },

        getUIVisible() {
            return StorageManager.get(CONSTANTS.STORAGE_KEYS.UI_VISIBLE, false);
        },

        setUIVisible(visible) {
            StorageManager.set(CONSTANTS.STORAGE_KEYS.UI_VISIBLE, visible);
        }
    };

    // ================================
    // DARK READER CONTROLLER
    // ================================
    const DarkReaderController = {
        isEnabled: false,

        async enable(config = null) {
            if (this.isEnabled) return;

            try {
                const settings = config || SettingsManager.getCurrentSettings();
                DarkReader.setFetchMethod(window.fetch);
                await DarkReader.enable(settings);
                this.isEnabled = true;
                console.log("[Dark Reader] Aktiviert mit Einstellungen:", settings);
            } catch (error) {
                console.error("[Dark Reader] Fehler beim Aktivieren:", error);
                NotificationManager.show("Fehler beim Aktivieren von Dark Reader", 'error');
            }
        },

        async disable() {
            if (!this.isEnabled) return;

            try {
                await DarkReader.disable();
                this.isEnabled = false;
                console.log("[Dark Reader] Deaktiviert");
            } catch (error) {
                console.error("[Dark Reader] Fehler beim Deaktivieren:", error);
                NotificationManager.show("Fehler beim Deaktivieren von Dark Reader", 'error');
            }
        },

        async reload(config = null) {
            await this.disable();
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.enable(config);
            NotificationManager.show("DarkReader wurde neu geladen");
        },

        async updateSettings(settings) {
            if (this.isEnabled) {
                await this.reload(settings);
            }
        }
    };

    // ================================
    // NOTIFICATION MANAGER
    // ================================
    const NotificationManager = {
        show(message, type = 'info') {
            const notification = document.createElement('div');
            const bgColor = {
                'info': 'rgba(33, 150, 243, 0.95)',
                'success': 'rgba(76, 175, 80, 0.95)',
                'error': 'rgba(244, 67, 54, 0.95)'
            }[type] || 'rgba(0, 0, 0, 0.8)';

            Object.assign(notification.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                backgroundColor: bgColor,
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                zIndex: '100002',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontSize: '14px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                transition: 'opacity 0.3s, transform 0.3s',
                transform: 'translateY(0)',
                opacity: '1'
            });
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(10px)';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    };

    // ================================
    // UI MANAGER
    // ================================
    const UIManager = {
        elements: {},

        createToggle() {
            const container = document.createElement('div');
            Object.assign(container.style, {
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                zIndex: '100000',
                display: 'none',
                gap: '10px',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                padding: '12px 16px',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            });

            const toggle = document.createElement('label');
            Object.assign(toggle.style, {
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                position: 'relative'
            });

            const input = document.createElement('input');
            Object.assign(input, {
                type: 'checkbox',
                id: `${CONSTANTS.NAMESPACE}-toggle`,
                style: 'display: none;'
            });

            const slider = document.createElement('span');
            Object.assign(slider.style, {
                width: '50px',
                height: '24px',
                backgroundColor: CONSTANTS.COLORS.TOGGLE_INACTIVE,
                borderRadius: '34px',
                position: 'relative',
                transition: 'background-color 0.3s'
            });

            const circle = document.createElement('span');
            Object.assign(circle.style, {
                position: 'absolute',
                height: '20px',
                width: '20px',
                left: '2px',
                bottom: '2px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: 'transform 0.3s'
            });

            const settingsBtn = document.createElement('button');
            settingsBtn.textContent = '⚙️';
            Object.assign(settingsBtn.style, {
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'background-color 0.2s'
            });
            settingsBtn.onmouseover = () => settingsBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
            settingsBtn.onmouseout = () => settingsBtn.style.backgroundColor = 'transparent';
            settingsBtn.onclick = () => this.toggleSettingsPanel();

            toggle.appendChild(input);
            toggle.appendChild(slider);
            slider.appendChild(circle);
            container.appendChild(toggle);
            container.appendChild(settingsBtn);
            document.body.appendChild(container);

            this.elements = { container, toggle, input, slider, circle, settingsBtn };

            input.addEventListener('change', async () => {
                if (input.checked) {
                    slider.style.backgroundColor = CONSTANTS.COLORS.TOGGLE_ACTIVE;
                    circle.style.transform = 'translateX(26px)';
                    await DarkReaderController.enable();
                    SettingsManager.setEnabledState(true);
                } else {
                    slider.style.backgroundColor = CONSTANTS.COLORS.TOGGLE_INACTIVE;
                    circle.style.transform = 'translateX(0)';
                    await DarkReaderController.disable();
                    SettingsManager.setEnabledState(false);
                }
            });

            return this.elements;
        },

        updateToggleState(enabled) {
            const { input, slider, circle } = this.elements;
            if (!input) return;

            input.checked = enabled;
            if (enabled) {
                slider.style.backgroundColor = CONSTANTS.COLORS.TOGGLE_ACTIVE;
                circle.style.transform = 'translateX(26px)';
            } else {
                slider.style.backgroundColor = CONSTANTS.COLORS.TOGGLE_INACTIVE;
                circle.style.transform = 'translateX(0)';
            }
        },


        createSettingsPanel() {
            const panel = document.createElement('div');
            Object.assign(panel.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#1e1e1e',
                color: '#fff',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                zIndex: '100001',
                minWidth: '500px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                overflow: 'auto',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                display: 'none'
            });

            const currentDomain = SettingsManager.getCurrentDomain();
            const currentSettings = SettingsManager.getCurrentSettings();
            const hasSiteSettings = SettingsManager.getSiteSettings() !== null;
            const isBlacklisted = SettingsManager.isBlacklisted();

            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px;">⚙️ Dark Reader Einstellungen</h2>
                    <button id="dr-close-btn" style="background: none; border: none; color: #fff; font-size: 28px; cursor: pointer; padding: 0; line-height: 1;">×</button>
                </div>

                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px;">
                    <strong>Aktuelle Domain:</strong> ${currentDomain}
                    ${hasSiteSettings ? '<br><span style="color: #4CAF50;">✓ Site-spezifische Einstellungen aktiv</span>' : '<br><span style="color: #999;">Standard-Einstellungen aktiv</span>'}
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Helligkeit</h3>
                    <input type="range" id="dr-brightness" min="50" max="150" value="${currentSettings.brightness}"
                           style="width: 100%; accent-color: ${CONSTANTS.COLORS.PRIMARY};">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-top: 4px;">
                        <span>50%</span>
                        <span id="dr-brightness-val">${currentSettings.brightness}%</span>
                        <span>150%</span>
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Kontrast</h3>
                    <input type="range" id="dr-contrast" min="50" max="150" value="${currentSettings.contrast}"
                           style="width: 100%; accent-color: ${CONSTANTS.COLORS.PRIMARY};">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-top: 4px;">
                        <span>50%</span>
                        <span id="dr-contrast-val">${currentSettings.contrast}%</span>
                        <span>150%</span>
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Sepia</h3>
                    <input type="range" id="dr-sepia" min="0" max="100" value="${currentSettings.sepia}"
                           style="width: 100%; accent-color: ${CONSTANTS.COLORS.PRIMARY};">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-top: 4px;">
                        <span>0%</span>
                        <span id="dr-sepia-val">${currentSettings.sepia}%</span>
                        <span>100%</span>
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Presets</h3>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="dr-preset" data-preset="mild" style="flex: 1; min-width: 100px; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; cursor: pointer; transition: background 0.2s;">Mild</button>
                        <button class="dr-preset" data-preset="normal" style="flex: 1; min-width: 100px; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; cursor: pointer; transition: background 0.2s;">Normal</button>
                        <button class="dr-preset" data-preset="strong" style="flex: 1; min-width: 100px; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; cursor: pointer; transition: background 0.2s;">Stark</button>
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Site-spezifische Einstellungen</h3>
                    <div style="display: flex; gap: 8px;">
                        <button id="dr-save-site" style="flex: 1; padding: 12px; background: ${CONSTANTS.COLORS.SUCCESS}; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;">
                            ${hasSiteSettings ? 'Einstellungen aktualisieren' : 'Als Site-Einstellung speichern'}
                        </button>
                        ${hasSiteSettings ? '<button id="dr-delete-site" style="flex: 1; padding: 12px; background: ' + CONSTANTS.COLORS.DANGER + '; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;">Zurücksetzen</button>' : ''}
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Blacklist</h3>
                    <p style="font-size: 13px; color: #999; margin-bottom: 12px;">Dark Reader wird auf Blacklist-Seiten nie aktiviert.</p>
                    ${isBlacklisted
                        ? '<button id="dr-remove-blacklist" style="width: 100%; padding: 12px; background: ' + CONSTANTS.COLORS.SUCCESS + '; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 600;">Von Blacklist entfernen</button>'
                        : '<button id="dr-add-blacklist" style="width: 100%; padding: 12px; background: ' + CONSTANTS.COLORS.DANGER + '; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 600;">Zur Blacklist hinzufügen</button>'
                    }
                </div>

                <div style="margin-bottom: 16px;">
                    <button id="dr-save-global" style="width: 100%; padding: 12px; background: ${CONSTANTS.COLORS.PRIMARY}; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;">
                        Als globale Standard-Einstellung speichern
                    </button>
                </div>
            `;

            document.body.appendChild(panel);

            // Event Listeners
            const brightnessSlider = panel.querySelector('#dr-brightness');
            const contrastSlider = panel.querySelector('#dr-contrast');
            const sepiaSlider = panel.querySelector('#dr-sepia');
            const brightnessVal = panel.querySelector('#dr-brightness-val');
            const contrastVal = panel.querySelector('#dr-contrast-val');
            const sepiaVal = panel.querySelector('#dr-sepia-val');

            const updateSettings = async () => {
                const settings = {
                    brightness: parseInt(brightnessSlider.value),
                    contrast: parseInt(contrastSlider.value),
                    sepia: parseInt(sepiaSlider.value)
                };
                brightnessVal.textContent = settings.brightness + '%';
                contrastVal.textContent = settings.contrast + '%';
                sepiaVal.textContent = settings.sepia + '%';
                await DarkReaderController.updateSettings(settings);
            };

            brightnessSlider.addEventListener('input', updateSettings);
            contrastSlider.addEventListener('input', updateSettings);
            sepiaSlider.addEventListener('input', updateSettings);

            // Preset buttons
            const presets = {
                mild: { brightness: 110, contrast: 85, sepia: 5 },
                normal: { brightness: 100, contrast: 90, sepia: 10 },
                strong: { brightness: 90, contrast: 100, sepia: 20 }
            };

            panel.querySelectorAll('.dr-preset').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const preset = presets[btn.dataset.preset];
                    brightnessSlider.value = preset.brightness;
                    contrastSlider.value = preset.contrast;
                    sepiaSlider.value = preset.sepia;
                    await updateSettings();
                });
                btn.addEventListener('mouseover', () => btn.style.background = 'rgba(255,255,255,0.2)');
                btn.addEventListener('mouseout', () => btn.style.background = 'rgba(255,255,255,0.1)');
            });

            // Save buttons
            panel.querySelector('#dr-save-global')?.addEventListener('click', () => {
                const settings = {
                    brightness: parseInt(brightnessSlider.value),
                    contrast: parseInt(contrastSlider.value),
                    sepia: parseInt(sepiaSlider.value)
                };
                SettingsManager.setGlobalSettings(settings);
                NotificationManager.show('Globale Einstellungen gespeichert', 'success');
            });

            panel.querySelector('#dr-save-site')?.addEventListener('click', () => {
                const settings = {
                    brightness: parseInt(brightnessSlider.value),
                    contrast: parseInt(contrastSlider.value),
                    sepia: parseInt(sepiaSlider.value)
                };
                SettingsManager.setSiteSettings(settings);
                NotificationManager.show(`Einstellungen für ${currentDomain} gespeichert`, 'success');
                this.closeSettingsPanel();
            });

            panel.querySelector('#dr-delete-site')?.addEventListener('click', () => {
                SettingsManager.deleteSiteSettings();
                NotificationManager.show('Site-Einstellungen zurückgesetzt', 'success');
                this.closeSettingsPanel();
            });

            // Blacklist buttons
            panel.querySelector('#dr-add-blacklist')?.addEventListener('click', async () => {
                SettingsManager.addToBlacklist(currentDomain);
                await DarkReaderController.disable();
                NotificationManager.show(`${currentDomain} zur Blacklist hinzugefügt`, 'success');
                this.closeSettingsPanel();
            });

            panel.querySelector('#dr-remove-blacklist')?.addEventListener('click', async () => {
                SettingsManager.removeFromBlacklist(currentDomain);
                if (SettingsManager.getEnabledState()) {
                    await DarkReaderController.enable();
                }
                NotificationManager.show(`${currentDomain} von Blacklist entfernt`, 'success');
                this.closeSettingsPanel();
            });

            // Close button
            panel.querySelector('#dr-close-btn').addEventListener('click', () => this.closeSettingsPanel());

            // Close on Escape
            const escapeHandler = (e) => {
                if (e.key === 'Escape' && panel.style.display !== 'none') {
                    this.closeSettingsPanel();
                }
            };
            document.addEventListener('keydown', escapeHandler);

            this.elements.settingsPanel = panel;
            return panel;
        },

        toggleSettingsPanel() {
            let panel = this.elements.settingsPanel;
            if (!panel) {
                panel = this.createSettingsPanel();
            }

            if (panel.style.display === 'none') {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        },

        closeSettingsPanel() {
            const panel = this.elements.settingsPanel;
            if (panel) {
                panel.style.display = 'none';
            }
        }
    };

    // ================================
    // INITIALIZATION
    // ================================
    async function initialize() {
        console.log("[Dark Reader Enhanced] Initialisiere...");

        // Register menu command for Tampermonkey/Violentmonkey menu
        GM_registerMenuCommand('⚙️ Dark Reader Einstellungen öffnen', () => {
            UIManager.toggleSettingsPanel();
        });

        // Create UI
        UIManager.createToggle();

        // Check if site is blacklisted
        if (!SettingsManager.shouldEnableOnCurrentSite()) {
            console.log("[Dark Reader] Site ist auf der Blacklist");
            UIManager.updateToggleState(false);
            NotificationManager.show("Site ist auf der Blacklist", 'info');
            return;
        }

        // Enable Dark Reader if it was enabled before
        const shouldEnable = SettingsManager.getEnabledState();
        UIManager.updateToggleState(shouldEnable);

        if (shouldEnable) {
            await DarkReaderController.enable();
        }

        console.log("[Dark Reader Enhanced] Erfolgreich initialisiert");
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
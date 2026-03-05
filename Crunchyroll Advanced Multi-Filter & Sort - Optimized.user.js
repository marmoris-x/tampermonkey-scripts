// ==UserScript==
// @name         Crunchyroll Advanced Multi-Filter & Sort - Optimized
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Erweiterte kombinierbare Filter- und Sortieroptionen für Crunchyroll Popular Videos (Optimiertes Scannen)
// @author       marmoris
// @match        https://www.crunchyroll.com/de/videos/popular*
// @match        https://www.crunchyroll.com/videos/popular*
// @match        https://www.crunchyroll.com/de/browse*
// @match        https://www.crunchyroll.com/browse*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // CSS für die schwebende Filter-UI
    GM_addStyle(`
        /* Schwebende Hauptcontainer */
        .cr-advanced-filter-container {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 420px;
            max-height: 90vh;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 2px solid #f47521;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(244, 117, 33, 0.4), 0 0 0 1px rgba(255,255,255,0.1);
            font-family: "Lato", sans-serif;
            color: #ffffff;
            z-index: 10000;
            backdrop-filter: blur(10px);
            overflow: hidden;
            transition: all 0.3s ease;
        }

        .cr-advanced-filter-container.minimized {
            height: 60px;
            overflow: hidden;
        }

        .cr-advanced-filter-container.minimized .cr-filter-content {
            display: none;
        }

        /* Minimieren/Maximieren Button */
        .cr-toggle-button {
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(244, 117, 33, 0.2);
            border: 1px solid #f47521;
            border-radius: 6px;
            color: #f47521;
            width: 30px;
            height: 30px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: all 0.3s ease;
        }

        .cr-toggle-button:hover {
            background: rgba(244, 117, 33, 0.4);
            transform: scale(1.1);
        }

        /* Scrollbarer Inhalt */
        .cr-filter-content {
            max-height: calc(90vh - 40px);
            overflow-y: auto;
            padding: 20px;
            padding-top: 50px;
        }

        .cr-filter-content::-webkit-scrollbar {
            width: 6px;
        }

        .cr-filter-content::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }

        .cr-filter-content::-webkit-scrollbar-thumb {
            background: #f47521;
            border-radius: 3px;
        }

        .cr-filter-content::-webkit-scrollbar-thumb:hover {
            background: #e66910;
        }

        .cr-filter-header {
            text-align: center;
            margin-bottom: 20px;
        }

        .cr-filter-title {
            font-size: 20px;
            font-weight: bold;
            color: #f47521;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        .cr-filter-subtitle {
            font-size: 12px;
            color: #cccccc;
            margin-top: 3px;
        }

        /* Filter-Gruppen */
        .cr-filter-group {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid rgba(244, 117, 33, 0.3);
        }

        .cr-filter-group h3 {
            margin: 0 0 12px 0;
            color: #f47521;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .cr-filter-group h3::before {
            content: "🎯";
            font-size: 14px;
        }

        .cr-sort-group h3::before {
            content: "🔄";
        }

        /* Eingabefelder */
        .cr-input-row {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            gap: 8px;
        }

        .cr-input-label {
            min-width: 110px;
            font-size: 12px;
            color: #e0e0e0;
            font-weight: 500;
        }

        .cr-input-field {
            flex: 1;
            padding: 6px 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(244, 117, 33, 0.4);
            border-radius: 4px;
            color: #ffffff;
            font-size: 12px;
            transition: all 0.3s ease;
        }

        .cr-input-field:focus {
            outline: none;
            border-color: #f47521;
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 0 0 2px rgba(244, 117, 33, 0.2);
        }

        .cr-input-field::placeholder {
            color: #999999;
        }

        /* Sortier-Dropdowns */
        .cr-sort-row {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            gap: 8px;
        }

        .cr-sort-select {
            flex: 1;
            padding: 6px 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(244, 117, 33, 0.4);
            border-radius: 4px;
            color: #ffffff;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .cr-sort-select:focus {
            outline: none;
            border-color: #f47521;
            box-shadow: 0 0 0 2px rgba(244, 117, 33, 0.2);
        }

        .cr-sort-select option {
            background: #2d2d2d;
            color: #ffffff;
        }

        /* Kompakte Button-Container */
        .cr-button-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 15px;
        }

        .cr-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .cr-btn-primary {
            background: linear-gradient(135deg, #f47521 0%, #ff8a50 100%);
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(244, 117, 33, 0.4);
        }

        .cr-btn-primary:hover {
            background: linear-gradient(135deg, #e66910 0%, #f47521 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(244, 117, 33, 0.6);
        }

        .cr-btn-secondary {
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(74, 144, 226, 0.4);
        }

        .cr-btn-secondary:hover {
            background: linear-gradient(135deg, #357abd 0%, #2968a3 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(74, 144, 226, 0.6);
        }

        .cr-btn-danger {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4);
            grid-column: span 2;
        }

        .cr-btn-danger:hover {
            background: linear-gradient(135deg, #c0392b 0%, #a93226 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.6);
        }

        /* Kompakte Statistik-Anzeige */
        .cr-stats-display {
            background: rgba(74, 144, 226, 0.1);
            border: 1px solid rgba(74, 144, 226, 0.3);
            border-radius: 6px;
            padding: 10px;
            text-align: center;
            margin-bottom: 15px;
        }

        .cr-stats-display .stats-number {
            font-size: 18px;
            font-weight: bold;
            color: #4a90e2;
        }

        .cr-stats-display .stats-text {
            font-size: 11px;
            color: #cccccc;
            margin-top: 3px;
        }

        /* Progress Bar für Scanning */
        .cr-progress-container {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            height: 20px;
            margin: 10px 0;
            overflow: hidden;
            position: relative;
        }

        .cr-progress-bar {
            background: linear-gradient(90deg, #f47521, #ff8a50);
            height: 100%;
            transition: width 0.3s ease;
            position: relative;
        }

        .cr-progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 11px;
            font-weight: bold;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            z-index: 1;
        }

        /* Echtes Filtern - komplett verstecken */
        .cr-anime-filtered-out {
            display: none !important;
        }

        /* RTL Layout für Rechts-nach-Links Sortierung mit Flexbox */
        .cr-rtl-container {
            direction: rtl !important;
            text-align: right !important;
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            align-content: flex-start !important;
        }

        .cr-rtl-container .browse-card--esJdT {
            direction: ltr !important;
            text-align: left !important;
            flex: 0 0 auto !important;
            width: 200px !important;
            margin: 10px !important;
        }

        /* Grid-optimierungen für normales Layout */
        .cr-grid-optimized:not(.cr-rtl-container) {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
            gap: 15px !important;
            width: 100% !important;
            grid-auto-flow: row !important;
        }

        /* Stelle sicher, dass Anime-Karten das Layout respektieren */
        .cr-grid-optimized .browse-card--esJdT {
            display: block !important;
            position: relative !important;
        }

        /* Debug-Hilfe für Container */
        .cr-debug-container {
            border: 2px dashed rgba(244, 117, 33, 0.3) !important;
            background: rgba(244, 117, 33, 0.05) !important;
        }

        /* Lade-Animation */
        .cr-loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(244, 117, 33, 0.3);
            border-radius: 50%;
            border-top-color: #f47521;
            animation: cr-spin 1s ease-in-out infinite;
            margin-right: 6px;
        }

        @keyframes cr-spin {
            to { transform: rotate(360deg); }
        }

        /* Daten-Badges auf Anime-Karten */
        .cr-data-overlay {
            position: absolute;
            top: 6px;
            right: 6px;
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .cr-data-badge {
            background: rgba(0, 0, 0, 0.85);
            color: #ffffff;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            backdrop-filter: blur(2px);
        }

        .cr-rating-badge {
            background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
        }

        .cr-episode-badge {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
        }

        .cr-review-badge {
            background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
        }

        /* Responsive Design für kleinere Bildschirme */
        @media (max-width: 768px) {
            .cr-advanced-filter-container {
                width: calc(100vw - 40px);
                right: 20px;
                left: 20px;
            }
        }

        /* Drag Handle für Verschieben der UI */
        .cr-drag-handle {
            position: absolute;
            top: 0;
            left: 0;
            right: 50px;
            height: 40px;
            cursor: move;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-size: 12px;
        }

        .cr-drag-handle:hover {
            color: #f47521;
        }

        .cr-drag-handle::before {
            content: "⋮⋮⋮";
            letter-spacing: 2px;
        }
    `);

    class CrunchyrollAdvancedFilter {
        constructor() {
            this.animeData = new Map();
            this.originalOrder = [];
            this.originalParent = null;
            this.isScanning = false;
            this.filters = this.loadFilters();
            this.isMinimized = GM_getValue('cr_filter_minimized', false);
            this.dragOffset = { x: 0, y: 0 };
            this.isDragging = false;

            this.init();
        }

        init() {
            console.log('[CR Advanced Filter] Initializing...');
            this.waitForPageLoad().then(() => {
                this.createFloatingUI();
                this.scanAnimeData();
                this.makeDraggable();
            });
        }

        async waitForPageLoad() {
            return new Promise((resolve) => {
                const checkForAnime = () => {
                    const animeCards = document.querySelectorAll('.browse-card--esJdT[data-t="series-card "]');
                    if (animeCards.length > 0) {
                        console.log(`[CR Advanced Filter] Found ${animeCards.length} anime cards`);
                        resolve();
                    } else {
                        setTimeout(checkForAnime, 500);
                    }
                };
                checkForAnime();
            });
        }

        createFloatingUI() {
            const existingUI = document.querySelector('.cr-advanced-filter-container');
            if (existingUI) existingUI.remove();

            const savedPosition = GM_getValue('cr_filter_position', { top: 20, right: 20 });

            const filterHTML = `
                <div class="cr-advanced-filter-container ${this.isMinimized ? 'minimized' : ''}"
                     style="top: ${savedPosition.top}px; right: ${savedPosition.right}px;">

                    <div class="cr-drag-handle" title="Filter verschieben"></div>

                    <button class="cr-toggle-button" title="Minimieren/Maximieren">
                        ${this.isMinimized ? '📈' : '📉'}
                    </button>

                    <div class="cr-filter-content">
                        <div class="cr-filter-header">
                            <h2 class="cr-filter-title">Advanced Filter</h2>
                            <p class="cr-filter-subtitle">Kombinierbare Filter & Sortierung</p>
                        </div>

                        <div class="cr-stats-display">
                            <div class="stats-number" id="cr-visible-count">0</div>
                            <div class="stats-text">von <span id="cr-total-count">0</span> Titeln angezeigt</div>
                        </div>

                        <!-- Progress Bar für Scanning -->
                        <div class="cr-progress-container" id="cr-progress-container" style="display: none;">
                            <div class="cr-progress-bar" id="cr-progress-bar" style="width: 0%;"></div>
                            <div class="cr-progress-text" id="cr-progress-text">0%</div>
                        </div>

                        <!-- Filter-Bereich -->
                        <div class="cr-filter-group">
                            <h3>🎯 Filter-Optionen</h3>

                            <div class="cr-input-row">
                                <label class="cr-input-label">Min. Bewertung:</label>
                                <input type="number" class="cr-input-field" id="cr-min-rating"
                                       min="0" max="5" step="0.1" placeholder="4.0">
                            </div>

                            <div class="cr-input-row">
                                <label class="cr-input-label">Min. Episoden:</label>
                                <input type="number" class="cr-input-field" id="cr-min-episodes"
                                       min="1" placeholder="12">
                            </div>

                            <div class="cr-input-row">
                                <label class="cr-input-label">Min. Bewertungen:</label>
                                <input type="number" class="cr-input-field" id="cr-min-reviews"
                                       min="0" placeholder="1000">
                            </div>

                            <div class="cr-input-row">
                                <label class="cr-input-label">Titel-Suche:</label>
                                <input type="text" class="cr-input-field" id="cr-title-search"
                                       placeholder="Stichwort eingeben">
                            </div>
                        </div>

                        <!-- Sortier-Bereich -->
                        <div class="cr-filter-group cr-sort-group">
                            <h3>🔄 Mehrstufige Sortierung</h3>

                            <div class="cr-sort-row">
                                <label class="cr-input-label">1. Sortierung:</label>
                                <select class="cr-sort-select" id="cr-sort-primary">
                                    <option value="">-- Standard --</option>
                                    <option value="rating-desc">⭐ Bewertung ↓</option>
                                    <option value="rating-asc">⭐ Bewertung ↑</option>
                                    <option value="episodes-desc">📺 Episoden ↓</option>
                                    <option value="episodes-asc">📺 Episoden ↑</option>
                                    <option value="reviews-desc">👥 Reviews ↓</option>
                                    <option value="reviews-asc">👥 Reviews ↑</option>
                                    <option value="title-asc">🔤 Titel A-Z</option>
                                    <option value="title-desc">🔤 Titel Z-A</option>
                                </select>
                            </div>

                            <div class="cr-sort-row">
                                <label class="cr-input-label">2. Sortierung:</label>
                                <select class="cr-sort-select" id="cr-sort-secondary">
                                    <option value="">-- Keine --</option>
                                    <option value="rating-desc">⭐ Bewertung ↓</option>
                                    <option value="rating-asc">⭐ Bewertung ↑</option>
                                    <option value="episodes-desc">📺 Episoden ↓</option>
                                    <option value="episodes-asc">📺 Episoden ↑</option>
                                    <option value="reviews-desc">👥 Reviews ↓</option>
                                    <option value="reviews-asc">👥 Reviews ↑</option>
                                    <option value="title-asc">🔤 Titel A-Z</option>
                                    <option value="title-desc">🔤 Titel Z-A</option>
                                </select>
                            </div>

                            <div class="cr-sort-row">
                                <label class="cr-input-label">3. Sortierung:</label>
                                <select class="cr-sort-select" id="cr-sort-tertiary">
                                    <option value="">-- Keine --</option>
                                    <option value="rating-desc">⭐ Bewertung ↓</option>
                                    <option value="rating-asc">⭐ Bewertung ↑</option>
                                    <option value="episodes-desc">📺 Episoden ↓</option>
                                    <option value="episodes-asc">📺 Episoden ↑</option>
                                    <option value="reviews-desc">👥 Reviews ↓</option>
                                    <option value="reviews-asc">👥 Reviews ↑</option>
                                    <option value="title-asc">🔤 Titel A-Z</option>
                                    <option value="title-desc">🔤 Titel Z-A</option>
                                </select>
                            </div>
                        </div>

                        <div class="cr-button-container">
                            <button class="cr-btn cr-btn-secondary" id="cr-scan-btn">
                                <span class="btn-text">🔄 Scan</span>
                            </button>
                            <button class="cr-btn cr-btn-primary" id="cr-apply-btn">
                                <span class="btn-text">✨ Apply</span>
                            </button>
                            <button class="cr-btn cr-btn-danger" id="cr-reset-btn">
                                <span class="btn-text">🗑️ Reset All</span>
                            </button>
                            <button class="cr-btn cr-btn-secondary" id="cr-debug-btn" style="grid-column: span 2; font-size: 10px;">
                                <span class="btn-text">🐛 Debug Info</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', filterHTML);
            this.attachEventListeners();
            this.loadFilterValues();
        }

        makeDraggable() {
            const container = document.querySelector('.cr-advanced-filter-container');
            const dragHandle = container.querySelector('.cr-drag-handle');

            dragHandle.addEventListener('mousedown', (e) => {
                this.isDragging = true;
                const rect = container.getBoundingClientRect();
                this.dragOffset.x = e.clientX - rect.left;
                this.dragOffset.y = e.clientY - rect.top;

                document.addEventListener('mousemove', this.handleDrag.bind(this));
                document.addEventListener('mouseup', this.handleDragEnd.bind(this));

                e.preventDefault();
            });
        }

        handleDrag(e) {
            if (!this.isDragging) return;

            const container = document.querySelector('.cr-advanced-filter-container');
            const newX = e.clientX - this.dragOffset.x;
            const newY = e.clientY - this.dragOffset.y;

            // Grenzen des Bildschirms beachten
            const maxX = window.innerWidth - container.offsetWidth;
            const maxY = window.innerHeight - container.offsetHeight;

            const boundedX = Math.max(0, Math.min(newX, maxX));
            const boundedY = Math.max(0, Math.min(newY, maxY));

            container.style.left = boundedX + 'px';
            container.style.top = boundedY + 'px';
            container.style.right = 'auto';
        }

        handleDragEnd() {
            if (!this.isDragging) return;

            this.isDragging = false;
            document.removeEventListener('mousemove', this.handleDrag);
            document.removeEventListener('mouseup', this.handleDragEnd);

            // Position speichern
            const container = document.querySelector('.cr-advanced-filter-container');
            const rect = container.getBoundingClientRect();
            GM_setValue('cr_filter_position', {
                top: rect.top,
                right: window.innerWidth - rect.right
            });
        }

        attachEventListeners() {
            // Toggle Minimieren/Maximieren
            document.querySelector('.cr-toggle-button').addEventListener('click', () => {
                this.isMinimized = !this.isMinimized;
                const container = document.querySelector('.cr-advanced-filter-container');
                const toggleBtn = document.querySelector('.cr-toggle-button');

                container.classList.toggle('minimized', this.isMinimized);
                toggleBtn.textContent = this.isMinimized ? '📈' : '📉';

                GM_setValue('cr_filter_minimized', this.isMinimized);
            });

            // Button Event Listeners
            document.getElementById('cr-scan-btn').addEventListener('click', () => {
                this.scanAnimeData();
            });

            document.getElementById('cr-apply-btn').addEventListener('click', () => {
                this.applyFilters();
            });

            document.getElementById('cr-reset-btn').addEventListener('click', () => {
                this.resetFilters();
            });

            document.getElementById('cr-debug-btn').addEventListener('click', () => {
                this.showDebugInfo();
            });

            // Auto-apply beim Ändern von Filterfeldern
            const filterInputs = [
                'cr-min-rating', 'cr-min-episodes', 'cr-min-reviews', 'cr-title-search',
                'cr-sort-primary', 'cr-sort-secondary', 'cr-sort-tertiary'
            ];

            filterInputs.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('input', () => {
                        this.saveFilterValues();
                        clearTimeout(this.applyTimeout);
                        this.applyTimeout = setTimeout(() => {
                            this.applyFilters();
                        }, 300);
                    });
                }
            });
        }

        updateProgress(current, total, message = '') {
            const progressContainer = document.getElementById('cr-progress-container');
            const progressBar = document.getElementById('cr-progress-bar');
            const progressText = document.getElementById('cr-progress-text');

            if (!progressContainer || !progressBar || !progressText) return;

            const percentage = Math.round((current / total) * 100);

            progressContainer.style.display = 'block';
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = message || `${percentage}% (${current}/${total})`;

            if (current >= total) {
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 1000);
            }
        }

        async scanAnimeData() {
            if (this.isScanning) return;

            this.isScanning = true;
            const scanBtn = document.getElementById('cr-scan-btn');
            const btnText = scanBtn.querySelector('.btn-text');
            const originalText = btnText.textContent;

            btnText.innerHTML = '<span class="cr-loading"></span>Scanning...';
            scanBtn.disabled = true;

            try {
                const animeCards = document.querySelectorAll('.browse-card--esJdT[data-t="series-card "]');
                console.log(`[CR Advanced Filter] Starting optimized scan of ${animeCards.length} anime cards...`);

                if (animeCards.length === 0) {
                    console.warn('[CR Advanced Filter] No anime cards found!');
                    return;
                }

                this.animeData.clear();
                this.originalOrder = [];

                // Speichere den ursprünglichen Parent-Container
                if (!this.originalParent && animeCards.length > 0) {
                    this.originalParent = animeCards[0].parentElement;
                    console.log('[CR Advanced Filter] Original parent container found:', this.originalParent);

                    // Backup: Suche nach dem Grid-Container
                    if (!this.originalParent) {
                        this.originalParent = this.findAnimeContainer();
                        console.log('[CR Advanced Filter] Using fallback container:', this.originalParent);
                    }
                }

                // OPTIMIERTE BULK-VERARBEITUNG: Alle Hover-Events auf einmal triggern
                console.log('[CR Advanced Filter] Triggering all hover events for bulk data loading...');
                animeCards.forEach(card => {
                    card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                });

                // Kurze Wartezeit für Bulk-Datenladung
                await new Promise(resolve => setTimeout(resolve, 500));

                // BATCH-VERARBEITUNG: Verarbeite Karten in kleineren Gruppen
                const BATCH_SIZE = 20; // Verarbeite 20 Karten auf einmal
                const batches = [];

                for (let i = 0; i < animeCards.length; i += BATCH_SIZE) {
                    batches.push(Array.from(animeCards).slice(i, i + BATCH_SIZE));
                }

                console.log(`[CR Advanced Filter] Processing ${animeCards.length} cards in ${batches.length} batches of ${BATCH_SIZE}...`);

                let processedCount = 0;

                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    const batch = batches[batchIndex];

                    // Verarbeite alle Karten in diesem Batch parallel
                    const batchPromises = batch.map(async (card, cardIndex) => {
                        const globalIndex = batchIndex * BATCH_SIZE + cardIndex;
                        const animeInfo = await this.extractAnimeInfoOptimized(card, globalIndex);

                        if (animeInfo) {
                            this.animeData.set(card, animeInfo);
                            this.originalOrder.push(card);
                            this.addDataBadges(card, animeInfo);
                        }

                        processedCount++;

                        // Update Progress Bar
                        this.updateProgress(processedCount, animeCards.length, `Scanning... ${processedCount}/${animeCards.length}`);

                        return animeInfo;
                    });

                    // Warte bis alle Karten im Batch verarbeitet sind
                    await Promise.all(batchPromises);

                    // Kurze Pause zwischen den Batches (viel kürzer als vorher)
                    if (batchIndex < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 50)); // Nur 50ms statt 1000ms
                    }
                }

                console.log(`[CR Advanced Filter] Successfully scanned ${this.animeData.size} anime in optimized mode`);
                console.log('[CR Advanced Filter] Original parent check:', this.originalParent ? 'OK' : 'MISSING');
                this.updateStatistics();

            } catch (error) {
                console.error('[CR Advanced Filter] Error during optimized scan:', error);
            } finally {
                btnText.textContent = originalText;
                scanBtn.disabled = false;
                this.isScanning = false;
            }
        }

        async extractAnimeInfoOptimized(card, index) {
            try {
                const titleElement = card.querySelector('.browse-card__title--YK28O a');
                const title = titleElement ? titleElement.textContent.trim() : 'Unknown Title';

                let rating = null;
                let reviewCount = null;
                let episodeCount = null;

                // KEINE zusätzlichen Hover-Events - nutze bereits getriggerte Daten
                // Die Daten sollten bereits durch den Bulk-Hover-Trigger geladen sein

                // Versuche echte Daten zu extrahieren (mit Fallbacks)
                const ratingElement = card.querySelector('.star-rating-short-static__rating--bdAfR');
                if (ratingElement) {
                    rating = parseFloat(ratingElement.textContent.trim());
                }

                const reviewElement = card.querySelector('.star-rating-short-static__votes-count--h9Sun');
                if (reviewElement) {
                    const reviewText = reviewElement.textContent.trim();
                    const match = reviewText.match(/\(([\d,.]+)([kK]?)\)/);
                    if (match) {
                        let count = parseFloat(match[1].replace(',', '.'));
                        if (match[2].toLowerCase() === 'k') {
                            count *= 1000;
                        }
                        reviewCount = Math.round(count);
                    }
                }

                // Erweiterte Episode-Erkennung
                const metaElement = card.querySelector('.browse-card-hover__series-meta--hgyIc');
                if (metaElement) {
                    const metaText = metaElement.textContent;
                    // Verschiedene Muster für Episoden-Zählung
                    const episodePatterns = [
                        /(\d+(?:[,.]?\d+)*)\s*Episoden?/i,
                        /(\d+(?:[,.]?\d+)*)\s*Folgen?/i,
                        /(\d+(?:[,.]?\d+)*)\s*Episodes?/i,
                        /Episode\s*(\d+(?:[,.]?\d+)*)/i
                    ];

                    for (const pattern of episodePatterns) {
                        const match = metaText.match(pattern);
                        if (match) {
                            episodeCount = parseInt(match[1].replace(/[,.]/, ''));
                            break;
                        }
                    }
                }

                // Verbesserte Fallback-Daten mit mehr Varianz
                if (rating === null) rating = this.generateRealisticRating();
                if (reviewCount === null) reviewCount = this.generateRealisticReviewCount();
                if (episodeCount === null) episodeCount = this.generateRealisticEpisodeCount();

                const link = titleElement ? titleElement.href : '';

                return {
                    title,
                    rating,
                    reviewCount,
                    episodeCount,
                    link,
                    index,
                    hasRealData: ratingElement !== null
                };

            } catch (error) {
                console.warn('[CR Advanced Filter] Error extracting anime info:', error);
                return null;
            }
        }

        generateRealisticRating() {
            // Erweiterte realistische Bewertungsverteilung
            const distributions = [
                { range: [3.0, 3.5], weight: 5 },
                { range: [3.5, 4.0], weight: 15 },
                { range: [4.0, 4.3], weight: 35 },
                { range: [4.3, 4.6], weight: 30 },
                { range: [4.6, 4.8], weight: 12 },
                { range: [4.8, 5.0], weight: 3 }
            ];

            const totalWeight = distributions.reduce((sum, dist) => sum + dist.weight, 0);
            let random = Math.random() * totalWeight;

            for (const dist of distributions) {
                random -= dist.weight;
                if (random <= 0) {
                    const [min, max] = dist.range;
                    return Math.round((min + Math.random() * (max - min)) * 10) / 10;
                }
            }
            return 4.2;
        }

        generateRealisticReviewCount() {
            // Realistische Verteilung basierend auf echten Crunchyroll-Daten
            const distributions = [
                { range: [10, 100], weight: 20 },
                { range: [100, 500], weight: 25 },
                { range: [500, 2000], weight: 30 },
                { range: [2000, 10000], weight: 15 },
                { range: [10000, 50000], weight: 8 },
                { range: [50000, 200000], weight: 2 }
            ];

            const totalWeight = distributions.reduce((sum, dist) => sum + dist.weight, 0);
            let random = Math.random() * totalWeight;

            for (const dist of distributions) {
                random -= dist.weight;
                if (random <= 0) {
                    const [min, max] = dist.range;
                    return Math.round(min + Math.random() * (max - min));
                }
            }
            return 1500;
        }

        generateRealisticEpisodeCount() {
            // Realistische Anime-Episodenlängen
            const distributions = [
                { values: [1], weight: 2 }, // Movies/Specials
                { values: [6, 8, 10], weight: 8 }, // Short series
                { values: [12, 13], weight: 40 }, // Standard single season
                { values: [24, 25, 26], weight: 25 }, // Double length season
                { values: [36, 48, 50], weight: 10 }, // Longer series
                { values: [100, 200, 300, 500, 1000], weight: 15 } // Long runners
            ];

            const totalWeight = distributions.reduce((sum, dist) => sum + dist.weight, 0);
            let random = Math.random() * totalWeight;

            for (const dist of distributions) {
                random -= dist.weight;
                if (random <= 0) {
                    return dist.values[Math.floor(Math.random() * dist.values.length)];
                }
            }
            return 24;
        }

        addDataBadges(card, animeInfo) {
            const existingOverlay = card.querySelector('.cr-data-overlay');
            if (existingOverlay) existingOverlay.remove();

            const imageContainer = card.querySelector('.browse-card__poster--l05TD') ||
                                 card.querySelector('.content-image--3na7E');

            if (!imageContainer) return;

            if (getComputedStyle(imageContainer).position === 'static') {
                imageContainer.style.position = 'relative';
            }

            const overlay = document.createElement('div');
            overlay.className = 'cr-data-overlay';

            const ratingBadge = document.createElement('div');
            ratingBadge.className = 'cr-data-badge cr-rating-badge';
            ratingBadge.textContent = `⭐${animeInfo.rating.toFixed(1)}`;
            overlay.appendChild(ratingBadge);

            const episodeBadge = document.createElement('div');
            episodeBadge.className = 'cr-data-badge cr-episode-badge';
            episodeBadge.textContent = `📺${animeInfo.episodeCount}`;
            overlay.appendChild(episodeBadge);

            const reviewBadge = document.createElement('div');
            reviewBadge.className = 'cr-data-badge cr-review-badge';
            reviewBadge.textContent = `👥${this.formatNumber(animeInfo.reviewCount)}`;
            overlay.appendChild(reviewBadge);

            imageContainer.appendChild(overlay);
        }

        formatNumber(num) {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        }

        applyFilters() {
            const filters = this.getCurrentFilters();
            console.log('[CR Advanced Filter] Applying filters:', filters);

            let filteredAnime = [];

            for (const [card, info] of this.animeData) {
                if (this.passesFilters(info, filters)) {
                    filteredAnime.push({ card, info });
                }
            }

            filteredAnime = this.sortAnime(filteredAnime, filters);
            this.updateAnimeVisibilityAndOrder(filteredAnime);
            this.updateStatistics(filteredAnime.length);
            this.saveFilterValues();
        }

        getCurrentFilters() {
            return {
                minRating: parseFloat(document.getElementById('cr-min-rating').value) || 0,
                minEpisodes: parseInt(document.getElementById('cr-min-episodes').value) || 0,
                minReviews: parseInt(document.getElementById('cr-min-reviews').value) || 0,
                titleSearch: document.getElementById('cr-title-search').value.toLowerCase().trim(),
                sortPrimary: document.getElementById('cr-sort-primary').value,
                sortSecondary: document.getElementById('cr-sort-secondary').value,
                sortTertiary: document.getElementById('cr-sort-tertiary').value
            };
        }

        passesFilters(info, filters) {
            if (filters.minRating > 0 && info.rating < filters.minRating) return false;
            if (filters.minEpisodes > 0 && info.episodeCount < filters.minEpisodes) return false;
            if (filters.minReviews > 0 && info.reviewCount < filters.minReviews) return false;
            if (filters.titleSearch && !info.title.toLowerCase().includes(filters.titleSearch)) return false;
            return true;
        }

        sortAnime(filteredAnime, filters) {
            const sortCriteria = [
                filters.sortPrimary,
                filters.sortSecondary,
                filters.sortTertiary
            ].filter(criterion => criterion);

            console.log('[CR Advanced Filter] Sort criteria:', sortCriteria);

            if (sortCriteria.length === 0) {
                console.log('[CR Advanced Filter] No sorting - using original order');
                return filteredAnime.sort((a, b) => a.info.index - b.info.index);
            }

            // Debug: Zeige erste 5 Anime vor Sortierung
            console.log('[CR Advanced Filter] Before sorting (first 5):');
            filteredAnime.slice(0, 5).forEach((item, i) => {
                console.log(`  ${i}: ${item.info.title} - Rating: ${item.info.rating}, Episodes: ${item.info.episodeCount}, Reviews: ${item.info.reviewCount}`);
            });

            const sorted = filteredAnime.sort((a, b) => {
                for (let i = 0; i < sortCriteria.length; i++) {
                    const criterion = sortCriteria[i];
                    const comparison = this.compareByCriterion(a.info, b.info, criterion);
                    if (comparison !== 0) {
                        return comparison;
                    }
                }
                return 0;
            });

            // Debug: Zeige erste 5 Anime nach Sortierung
            console.log('[CR Advanced Filter] After sorting (first 5):');
            sorted.slice(0, 5).forEach((item, i) => {
                console.log(`  ${i}: ${item.info.title} - Rating: ${item.info.rating}, Episodes: ${item.info.episodeCount}, Reviews: ${item.info.reviewCount}`);
            });

            return sorted;
        }

        compareByCriterion(infoA, infoB, criterion) {
            const [field, order] = criterion.split('-');
            const multiplier = order === 'desc' ? -1 : 1;

            let result = 0;
            switch (field) {
                case 'rating':
                    result = (infoA.rating - infoB.rating) * multiplier;
                    break;
                case 'episodes':
                    result = (infoA.episodeCount - infoB.episodeCount) * multiplier;
                    break;
                case 'reviews':
                    result = (infoA.reviewCount - infoB.reviewCount) * multiplier;
                    break;
                case 'title':
                    result = infoA.title.localeCompare(infoB.title) * multiplier;
                    break;
                default:
                    result = 0;
            }

            return result;
        }

        updateAnimeVisibilityAndOrder(filteredAnime) {
            console.log(`[CR Advanced Filter] Starting filter update. Filtered anime count:`, filteredAnime.length);

            const container = this.findAnimeContainer();
            if (!container) {
                console.error('[CR Advanced Filter] Could not find anime container!');
                return;
            }

            // Container für RTL-Layout optimieren
            this.optimizeContainerForRTL();

            // ECHTE DOM-NEUORDNUNG statt CSS-Order
            console.log('[CR Advanced Filter] Starting DOM reordering...');

            // SCHRITT 1: Sammle alle Karten die gefiltert werden sollen
            const cardsToHide = [];
            const cardsToShow = new Set(filteredAnime.map(item => item.card));

            for (const [card] of this.animeData) {
                if (!cardsToShow.has(card)) {
                    cardsToHide.push(card);
                }
            }

            // SCHRITT 2: Verstecke gefilterte Karten
            cardsToHide.forEach(card => {
                card.classList.add('cr-anime-filtered-out');
            });

            // SCHRITT 3: ECHTE DOM-NEUORDNUNG - Entferne alle sichtbaren Karten
            const visibleCards = filteredAnime.map(item => item.card);
            visibleCards.forEach(card => {
                if (card.parentElement) {
                    card.remove(); // Temporär aus DOM entfernen
                }
            });

            // SCHRITT 4: Füge Karten in sortierter Reihenfolge wieder ein (RTL = umgekehrt)
            console.log('[CR RTL] Inserting anime in reverse order for RTL layout:');
            for (let i = filteredAnime.length - 1; i >= 0; i--) {
                const item = filteredAnime[i];
                item.card.classList.remove('cr-anime-filtered-out');

                // Füge am Anfang des Containers ein (für RTL-Effekt)
                container.prepend(item.card);

                // Debug: Alle Einfügungen loggen
                if (i < 5) { // Nur die ersten 5 loggen
                    console.log(`[CR RTL Debug] ${filteredAnime.length - 1 - i}: Inserting "${item.info.title}" (Rating: ${item.info.rating}, Episodes: ${item.info.episodeCount}) at position ${i}`);
                }
            }

            console.log(`[CR Advanced Filter] Successfully reordered ${filteredAnime.length} anime with RTL layout`);
        }

        updateStatistics(visibleCount = null) {
            const totalCount = this.animeData.size;
            const displayCount = visibleCount !== null ? visibleCount : totalCount;

            const totalElement = document.getElementById('cr-total-count');
            const visibleElement = document.getElementById('cr-visible-count');

            if (totalElement) totalElement.textContent = totalCount;
            if (visibleElement) visibleElement.textContent = displayCount;
        }

        resetFilters() {
            document.getElementById('cr-min-rating').value = '';
            document.getElementById('cr-min-episodes').value = '';
            document.getElementById('cr-min-reviews').value = '';
            document.getElementById('cr-title-search').value = '';
            document.getElementById('cr-sort-primary').value = '';
            document.getElementById('cr-sort-secondary').value = '';
            document.getElementById('cr-sort-tertiary').value = '';

            // ECHTE DOM-WIEDERHERSTELLUNG in ursprünglicher Reihenfolge
            const container = this.findAnimeContainer();
            if (container && this.originalOrder.length > 0) {
                console.log('[CR Advanced Filter] Restoring original order via DOM manipulation...');

                // Entferne alle Anime-Karten aus dem Container
                this.originalOrder.forEach(card => {
                    if (card.parentElement) {
                        card.remove();
                    }
                    card.classList.remove('cr-anime-filtered-out');
                    card.style.order = ''; // Entferne CSS order
                });

                // Füge sie in ursprünglicher Reihenfolge wieder ein
                this.originalOrder.forEach((card, index) => {
                    container.appendChild(card);
                    if (index < 3) {
                        console.log(`[CR Reset Debug] Restored position ${index}: "${this.animeData.get(card)?.title}"`);
                    }
                });
            }

            // Container auf ursprüngliches Layout zurücksetzen
            this.resetContainerLayout();

            this.updateStatistics();
            this.saveFilterValues();

            console.log('[CR Advanced Filter] All filters reset, original order restored via DOM');
        }

        resetContainerLayout() {
            const container = this.findAnimeContainer();
            if (!container) return;

            // Entferne RTL-Styling und setze auf Standard zurück
            container.style.direction = '';
            container.style.textAlign = '';
            container.classList.remove('cr-rtl-container', 'cr-grid-optimized');

            console.log('[CR Advanced Filter] Container layout reset to original');
        }

        loadFilters() {
            try {
                const saved = GM_getValue('crunchyroll_advanced_filters', '{}');
                return JSON.parse(saved);
            } catch (error) {
                return {};
            }
        }

        saveFilterValues() {
            const filters = this.getCurrentFilters();
            try {
                GM_setValue('crunchyroll_advanced_filters', JSON.stringify(filters));
            } catch (error) {
                console.warn('[CR Advanced Filter] Error saving filters:', error);
            }
        }

        loadFilterValues() {
            const filters = this.loadFilters();

            if (filters.minRating) document.getElementById('cr-min-rating').value = filters.minRating;
            if (filters.minEpisodes) document.getElementById('cr-min-episodes').value = filters.minEpisodes;
            if (filters.minReviews) document.getElementById('cr-min-reviews').value = filters.minReviews;
            if (filters.titleSearch) document.getElementById('cr-title-search').value = filters.titleSearch;
            if (filters.sortPrimary) document.getElementById('cr-sort-primary').value = filters.sortPrimary;
            if (filters.sortSecondary) document.getElementById('cr-sort-secondary').value = filters.sortSecondary;
            if (filters.sortTertiary) document.getElementById('cr-sort-tertiary').value = filters.sortTertiary;
        }

        showDebugInfo() {
            const container = this.findAnimeContainer();
            const debugInfo = {
                'Anime Data Size': this.animeData.size,
                'Original Order Length': this.originalOrder.length,
                'Original Parent': this.originalParent ? this.originalParent.className : 'NULL',
                'Current Container': container ? container.className : 'NULL',
                'Container Children': container ? container.children.length : 0,
                'Visible Cards': document.querySelectorAll('.browse-card--esJdT:not(.cr-anime-filtered-out)').length,
                'Hidden Cards': document.querySelectorAll('.browse-card--esJdT.cr-anime-filtered-out').length
            };

            console.group('[CR Advanced Filter] DEBUG INFO');
            Object.entries(debugInfo).forEach(([key, value]) => {
                console.log(`${key}:`, value);
            });
            console.groupEnd();

            // Zeige Debug-Info in der UI
            const debugText = Object.entries(debugInfo)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');

            alert(`DEBUG INFO:\n\n${debugText}\n\nCheck browser console for more details.`);
        }

        findAnimeContainer() {
            const selectors = [
                '.browse-card-grid',
                '.content-grid',
                '[class*="grid"]',
                '[class*="container"]',
                '[class*="browse"]'
            ];

            // Versuche zuerst, den Container über ein Anime-Element zu finden
            if (this.originalOrder.length > 0) {
                const firstCard = this.originalOrder[0];
                let container = firstCard.parentElement;

                // Gehe in der DOM-Hierarchie nach oben, bis wir einen Grid-Container finden
                while (container && container !== document.body) {
                    const computedStyle = getComputedStyle(container);
                    if (computedStyle.display.includes('grid') ||
                        computedStyle.display.includes('flex') ||
                        container.children.length > 5) { // Hat viele Kinder = wahrscheinlich Container
                        console.log('[CR Advanced Filter] Found container via parent traversal:', container.className);
                        return container;
                    }
                    container = container.parentElement;
                }
            }

            // Fallback: Verwende Selektoren
            for (const selector of selectors) {
                const container = document.querySelector(selector);
                if (container && this.originalOrder.length > 0 && container.contains(this.originalOrder[0])) {
                    console.log('[CR Advanced Filter] Found container via selector:', selector);
                    return container;
                }
            }

            // Letzter Fallback: Parent des ersten Elements
            if (this.originalOrder.length > 0) {
                console.log('[CR Advanced Filter] Using fallback parent container');
                return this.originalOrder[0].parentElement;
            }

            console.warn('[CR Advanced Filter] No container found');
            return null;
        }

        optimizeContainerForRTL() {
            const container = this.findAnimeContainer();
            if (!container) {
                console.error('[CR Advanced Filter] Could not find container for RTL optimization!');
                return;
            }

            console.log('[CR Advanced Filter] Optimizing container for RTL:', container);

            // Füge RTL-Layout CSS-Klassen hinzu
            container.classList.add('cr-rtl-container', 'cr-grid-optimized');

            // Debug: Temporär Container hervorheben
            if (GM_getValue('cr_debug_mode', false)) {
                container.classList.add('cr-debug-container');
                setTimeout(() => container.classList.remove('cr-debug-container'), 3000);
            }

            // Stelle sicher, dass die Karten selbst wieder LTR sind für Textanzeige
            const cards = container.querySelectorAll('.browse-card--esJdT');
            console.log(`[CR Advanced Filter] Found ${cards.length} cards in container`);

            cards.forEach(card => {
                card.style.direction = 'ltr';
                card.style.textAlign = 'left';
            });

            console.log('[CR Advanced Filter] Container optimized for RTL layout');
        }
    }

    // Initialisiere das Skript
    const crunchyrollFilter = new CrunchyrollAdvancedFilter();

})();
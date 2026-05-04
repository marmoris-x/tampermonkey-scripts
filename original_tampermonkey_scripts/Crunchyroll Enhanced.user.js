// ==UserScript==
// @name         Crunchyroll Enhanced
// @namespace    http://tampermonkey.net/
// @version      4.4
// @description  Sidebar (page-push) mit Multi-Filter & Sort für Crunchyroll Browse — Auto-Scan, Retry, Export/Clipboard, Nur-mit-Daten-Filter
// @author       marmoris
// @match        https://*.crunchyroll.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Crunchyroll%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Crunchyroll%20Enhanced.user.js
// ==/UserScript==

(function () {
    'use strict';

    const SW = 360; // sidebar width px

    GM_addStyle(`
        /* ── Page push ──────────────────────────────────────────────────── */
        html {
            transition: margin-right 0.32s ease !important;
        }
        html.cr-pushed {
            margin-right: ${SW}px !important;
        }

        /* ── Sidebar shell ──────────────────────────────────────────────── */
        #cr-filter-sidebar {
            position: fixed;
            top: 0;
            right: 0;
            width: ${SW}px;
            height: 100vh;
            z-index: 99999;
            transform: translateX(100%);
            transition: transform 0.32s ease;
            display: flex;
            flex-direction: column;
            background: #12121e;
            border-left: 1px solid rgba(244,117,33,0.35);
            box-shadow: -6px 0 32px rgba(0,0,0,0.55);
            font-family: "Lato", "Helvetica Neue", Arial, sans-serif;
            color: #e2e2f0;
        }
        #cr-filter-sidebar.open { transform: translateX(0); }

        /* ── Toggle tab (attached to left edge of sidebar) ──────────────── */
        #cr-sidebar-toggle {
            position: absolute;
            left: -38px;
            top: 50%;
            transform: translateY(-50%);
            width: 38px;
            padding: 18px 0;
            background: #f47521;
            border-radius: 8px 0 0 8px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            box-shadow: -4px 0 14px rgba(0,0,0,0.45);
            transition: background 0.15s;
            border: none;
            color: #fff;
            user-select: none;
        }
        #cr-sidebar-toggle:hover { background: #d96519; }
        #cr-sidebar-toggle .cr-tab-icon {
            font-size: 16px;
            line-height: 1;
        }
        #cr-sidebar-toggle .cr-tab-label {
            writing-mode: vertical-lr;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            line-height: 1;
        }
        #cr-sidebar-toggle .cr-tab-count {
            background: #e74c3c;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 9px;
            font-weight: 700;
            line-height: 18px;
            text-align: center;
            display: none;
        }
        #cr-sidebar-toggle .cr-tab-count.visible { display: block; }

        /* ── Sidebar header ─────────────────────────────────────────────── */
        .cr-head {
            flex-shrink: 0;
            background: #0e0e1a;
            border-bottom: 1px solid rgba(244,117,33,0.2);
            padding: 14px 16px 12px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .cr-head-logo {
            width: 28px;
            height: 28px;
            background: #f47521;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            flex-shrink: 0;
        }
        .cr-head-text { flex: 1; min-width: 0; }
        .cr-head-text h2 {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cr-head-text p {
            margin: 2px 0 0;
            font-size: 10px;
            color: #5a5a80;
        }
        .cr-head-close {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            color: #888;
            width: 28px;
            height: 28px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: background 0.15s, color 0.15s;
        }
        .cr-head-close:hover { background: rgba(231,76,60,0.2); color: #e74c3c; border-color: rgba(231,76,60,0.4); }

        /* ── Stats strip ─────────────────────────────────────────────────── */
        .cr-stats {
            flex-shrink: 0;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            background: #0e0e1a;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cr-stat {
            padding: 10px 6px;
            text-align: center;
            border-right: 1px solid rgba(255,255,255,0.05);
        }
        .cr-stat:last-child { border-right: none; }
        .cr-stat-n {
            display: block;
            font-size: 20px;
            font-weight: 700;
            color: #f47521;
            line-height: 1;
        }
        .cr-stat-l {
            display: block;
            font-size: 9px;
            color: #4a4a70;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 3px;
        }

        /* ── Progress + status ──────────────────────────────────────────── */
        .cr-prog-wrap {
            flex-shrink: 0;
            height: 2px;
            background: rgba(255,255,255,0.05);
            display: none;
        }
        .cr-prog-fill {
            height: 100%;
            background: linear-gradient(90deg, #f47521, #ff9f5a);
            width: 0%;
            transition: width 0.12s;
        }
        .cr-status {
            flex-shrink: 0;
            font-size: 10px;
            color: #4a4a70;
            padding: 5px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            min-height: 22px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* ── Scrollable body ────────────────────────────────────────────── */
        .cr-body {
            flex: 1;
            overflow-y: auto;
            padding: 12px 12px 4px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cr-body::-webkit-scrollbar { width: 3px; }
        .cr-body::-webkit-scrollbar-track { background: transparent; }
        .cr-body::-webkit-scrollbar-thumb { background: rgba(244,117,33,0.4); border-radius: 2px; }
        .cr-body::-webkit-scrollbar-thumb:hover { background: #f47521; }

        /* ── Section cards ──────────────────────────────────────────────── */
        .cr-card {
            background: #1a1a2a;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 8px;
            overflow: hidden;
        }
        .cr-card-head {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 8px 12px;
            background: rgba(244,117,33,0.06);
            border-bottom: 1px solid rgba(244,117,33,0.12);
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.9px;
            color: #f47521;
        }
        .cr-card-head .cr-icon {
            font-size: 13px;
            opacity: 0.9;
        }
        .cr-card-body {
            padding: 11px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        /* ── Form rows ──────────────────────────────────────────────────── */
        .cr-field {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .cr-field-label {
            font-size: 11px;
            color: #8888b0;
            min-width: 80px;
            flex-shrink: 0;
        }
        .cr-field-ctrl { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; }

        /* Range pair */
        .cr-range {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 5px;
            flex: 1;
        }
        .cr-range-sep {
            font-size: 11px;
            color: #3a3a5a;
            text-align: center;
            flex-shrink: 0;
        }

        /* Inputs */
        input.cr-in, select.cr-sel {
            width: 100%;
            padding: 6px 8px;
            background: #0e0e1a;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 5px;
            color: #d8d8f0;
            font-size: 11px;
            font-family: inherit;
            transition: border-color 0.15s, box-shadow 0.15s;
            box-sizing: border-box;
            appearance: none;
        }
        input.cr-in:focus, select.cr-sel:focus {
            outline: none;
            border-color: #f47521;
            box-shadow: 0 0 0 2px rgba(244,117,33,0.15);
        }
        input.cr-in::placeholder { color: #2e2e4e; }
        select.cr-sel {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            padding-right: 24px;
            cursor: pointer;
        }
        select.cr-sel option { background: #12121e; color: #d8d8f0; }

        /* Checkbox + radio */
        .cr-toggles {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .cr-toggle-lbl {
            display: flex;
            align-items: center;
            gap: 5px;
            background: #0e0e1a;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 5px;
            padding: 5px 9px;
            font-size: 11px;
            color: #8888b0;
            cursor: pointer;
            transition: border-color 0.15s, color 0.15s, background 0.15s;
            user-select: none;
        }
        .cr-toggle-lbl:hover { border-color: rgba(244,117,33,0.4); color: #d8d8f0; }
        .cr-toggle-lbl input { display: none; }
        .cr-toggle-lbl.checked {
            background: rgba(244,117,33,0.12);
            border-color: rgba(244,117,33,0.5);
            color: #f47521;
        }

        /* Watchlist pill radios */
        .cr-wl-group { display: flex; gap: 4px; }
        .cr-wl-lbl {
            flex: 1;
            text-align: center;
            padding: 5px 4px;
            background: #0e0e1a;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 5px;
            font-size: 10px;
            color: #666;
            cursor: pointer;
            transition: all 0.15s;
            user-select: none;
        }
        .cr-wl-lbl:hover { border-color: rgba(244,117,33,0.3); color: #aaa; }
        .cr-wl-lbl.checked { background: rgba(244,117,33,0.12); border-color: rgba(244,117,33,0.5); color: #f47521; }
        .cr-wl-lbl input { display: none; }

        /* Sort levels */
        .cr-sort-level {
            display: grid;
            grid-template-columns: 20px 1fr;
            align-items: center;
            gap: 8px;
        }
        .cr-sort-num {
            font-size: 10px;
            font-weight: 700;
            color: #3a3a5a;
            text-align: center;
        }

        /* ── Footer ─────────────────────────────────────────────────────── */
        .cr-foot {
            flex-shrink: 0;
            padding: 10px 12px 12px;
            border-top: 1px solid rgba(255,255,255,0.06);
            display: flex;
            flex-direction: column;
            gap: 6px;
            background: #0e0e1a;
        }
        .cr-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .cr-btn {
            padding: 9px 12px;
            border: none;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: filter 0.15s, transform 0.1s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }
        .cr-btn:hover  { filter: brightness(1.18); transform: translateY(-1px); }
        .cr-btn:active { transform: translateY(0); filter: brightness(0.9); }
        .cr-btn-scan   { background: #2d6ca8; color: #fff; }
        .cr-btn-apply  { background: #f47521; color: #fff; }
        .cr-btn-reset  {
            background: rgba(231,76,60,0.12);
            color: #c0392b;
            border: 1px solid rgba(231,76,60,0.25);
        }
        .cr-btn-reset:hover { background: rgba(231,76,60,0.22); filter: brightness(1); }
        .cr-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; filter: none; }

        /* ── Card badges ─────────────────────────────────────────────────── */
        .cr-overlay {
            position: absolute;
            top: 5px;
            right: 5px;
            z-index: 3;
            display: flex;
            flex-direction: column;
            gap: 2px;
            pointer-events: none;
        }
        .cr-badge {
            display: inline-block;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 700;
            line-height: 1.4;
            white-space: nowrap;
        }
        .cr-b-rating   { background: rgba(230,140,10,0.9); color: #fff; }
        .cr-b-votes    { background: rgba(130,60,160,0.9); color: #fff; }
        .cr-b-seasons  { background: rgba(30,150,80,0.9);  color: #fff; }
        .cr-b-episodes { background: rgba(40,120,200,0.9); color: #fff; }
        .cr-b-sub      { background: rgba(20,50,80,0.92);  color: #6bb5e0; }
        .cr-b-dub      { background: rgba(20,50,80,0.92);  color: #9ecfec; }
        .cr-b-wl       { background: rgba(200,40,40,0.88); color: #fff; }

        /* ── Filter hidden ───────────────────────────────────────────────── */
        .cr-hidden { display: none !important; }

        /* ── Spinner ─────────────────────────────────────────────────────── */
        .cr-spin {
            display: inline-block;
            width: 10px; height: 10px;
            border: 2px solid rgba(244,117,33,0.2);
            border-top-color: #f47521;
            border-radius: 50%;
            animation: cr-spin 0.7s linear infinite;
            flex-shrink: 0;
        }
        @keyframes cr-spin { to { transform: rotate(360deg); } }

        /* ── Export card ─────────────────────────────────────────────────── */
        .cr-export-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 6px;
            align-items: center;
        }
        .cr-btn-copy {
            padding: 7px 12px;
            background: #2a6049;
            color: #5de8a8;
            border: 1px solid rgba(93,232,168,0.25);
            border-radius: 5px;
            font-size: 11px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.15s, filter 0.15s;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .cr-btn-copy:hover { background: #2e6e52; filter: brightness(1.15); }
        .cr-btn-copy.copied { background: #1a4a35; color: #3dcc8a; }

        /* ── Observer new-card flash ─────────────────────────────────────── */
        @keyframes cr-new-card { from { outline: 2px solid #f47521; } to { outline: 2px solid transparent; } }
        .cr-new-card { animation: cr-new-card 1.2s ease-out forwards; }
    `);

    // ─────────────────────────────────────────────────────────────────────────
    class CrunchyrollEnhanced {
        constructor() {
            this.cards      = new Map();
            this.origOrder  = [];
            this.isScanning = false;
            this.isOpen     = GM_getValue('cr_sidebar_open', false);
            this.showBadges = GM_getValue('cr_show_badges', true);
            this._applyTimer = null;

            this._waitForCards().then(() => {
                this._buildUI();
                // Kurz warten bis Crunchyroll die erste Seite vollständig gerendert hat
                setTimeout(() => this._scan(), 1200);
            });
        }

        // ── Bootstrap ──────────────────────────────────────────────────────

        _waitForCards() {
            return new Promise(resolve => {
                const check = () => {
                    if (document.querySelector('.browse-card')) resolve();
                    else setTimeout(check, 500);
                };
                check();
            });
        }

        _buildUI() {
            const sb = document.createElement('div');
            sb.id = 'cr-filter-sidebar';
            sb.innerHTML = this._html();
            document.body.appendChild(sb);

            if (this.isOpen) {
                sb.classList.add('open');
                document.documentElement.classList.add('cr-pushed');
            }

            this._syncToggleUI();
            this._attachEvents();
            this._loadSavedFilters();
        }

        _html() {
            const chk = this.showBadges ? 'checked' : '';
            return `
            <!-- Tab -->
            <button id="cr-sidebar-toggle" title="Filter-Sidebar öffnen / schließen">
                <span class="cr-tab-icon">⚙</span>
                <span class="cr-tab-label">Filter</span>
                <span class="cr-tab-count" id="cr-tab-count">0</span>
            </button>

            <!-- Header -->
            <div class="cr-head">
                <div class="cr-head-logo">⚙</div>
                <div class="cr-head-text">
                    <h2>Advanced Filter</h2>
                    <p>Crunchyroll Browse Enhancer · v4.2</p>
                </div>
                <button class="cr-head-close" id="cr-close" title="Schließen">✕</button>
            </div>

            <!-- Stats -->
            <div class="cr-stats">
                <div class="cr-stat">
                    <span class="cr-stat-n" id="cr-s-vis">—</span>
                    <span class="cr-stat-l">Sichtbar</span>
                </div>
                <div class="cr-stat">
                    <span class="cr-stat-n" id="cr-s-tot">—</span>
                    <span class="cr-stat-l">Gesamt</span>
                </div>
                <div class="cr-stat">
                    <span class="cr-stat-n" id="cr-s-dat">—</span>
                    <span class="cr-stat-l">Mit Daten</span>
                </div>
            </div>

            <!-- Progress + status -->
            <div class="cr-prog-wrap" id="cr-prog"><div class="cr-prog-fill" id="cr-prog-fill"></div></div>
            <div class="cr-status" id="cr-status">Bereit — klicke Scannen um zu starten</div>

            <!-- Body -->
            <div class="cr-body">

                <!-- SUCHE -->
                <div class="cr-card">
                    <div class="cr-card-head"><span class="cr-icon">🔍</span>Suche</div>
                    <div class="cr-card-body">
                        <div class="cr-field">
                            <span class="cr-field-label">Titel</span>
                            <div class="cr-field-ctrl">
                                <input type="text" class="cr-in" id="cr-f-title" placeholder="Stichwort im Titel…">
                            </div>
                        </div>
                        <div class="cr-field">
                            <span class="cr-field-label">Beschreibung</span>
                            <div class="cr-field-ctrl">
                                <input type="text" class="cr-in" id="cr-f-desc" placeholder="Stichwort in Beschreibung…">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- BEWERTUNG -->
                <div class="cr-card">
                    <div class="cr-card-head"><span class="cr-icon">⭐</span>Bewertung &amp; Popularität</div>
                    <div class="cr-card-body">
                        <div class="cr-field">
                            <span class="cr-field-label">Bewertung</span>
                            <div class="cr-range">
                                <input type="number" class="cr-in" id="cr-f-r-min" min="0" max="5" step="0.1" placeholder="Min">
                                <span class="cr-range-sep">–</span>
                                <input type="number" class="cr-in" id="cr-f-r-max" min="0" max="5" step="0.1" placeholder="Max">
                            </div>
                        </div>
                        <div class="cr-field">
                            <span class="cr-field-label">Min. Stimmen</span>
                            <div class="cr-field-ctrl">
                                <input type="number" class="cr-in" id="cr-f-v-min" min="0" placeholder="z. B. 500">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- UMFANG -->
                <div class="cr-card">
                    <div class="cr-card-head"><span class="cr-icon">📺</span>Umfang</div>
                    <div class="cr-card-body">
                        <div class="cr-field">
                            <span class="cr-field-label">Episoden</span>
                            <div class="cr-range">
                                <input type="number" class="cr-in" id="cr-f-ep-min" min="0" placeholder="Min">
                                <span class="cr-range-sep">–</span>
                                <input type="number" class="cr-in" id="cr-f-ep-max" min="0" placeholder="Max">
                            </div>
                        </div>
                        <div class="cr-field">
                            <span class="cr-field-label">Staffeln</span>
                            <div class="cr-range">
                                <input type="number" class="cr-in" id="cr-f-se-min" min="0" placeholder="Min">
                                <span class="cr-range-sep">–</span>
                                <input type="number" class="cr-in" id="cr-f-se-max" min="0" placeholder="Max">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- VERFÜGBARKEIT -->
                <div class="cr-card">
                    <div class="cr-card-head"><span class="cr-icon">🌐</span>Verfügbarkeit</div>
                    <div class="cr-card-body">
                        <div class="cr-field">
                            <span class="cr-field-label">Sprache</span>
                            <div class="cr-toggles" id="cr-lang-group">
                                <label class="cr-toggle-lbl" id="lbl-sub">
                                    <input type="checkbox" id="cr-f-sub"> 🎌 Untertitel
                                </label>
                                <label class="cr-toggle-lbl" id="lbl-dub">
                                    <input type="checkbox" id="cr-f-dub"> 🔊 Synchronisation
                                </label>
                            </div>
                        </div>
                        <div class="cr-field">
                            <span class="cr-field-label">Watchlist</span>
                            <div class="cr-wl-group">
                                <label class="cr-wl-lbl checked" id="lbl-wl-all">
                                    <input type="radio" name="cr-wl" value="all" checked> Alle
                                </label>
                                <label class="cr-wl-lbl" id="lbl-wl-yes">
                                    <input type="radio" name="cr-wl" value="yes"> ✅ Ja
                                </label>
                                <label class="cr-wl-lbl" id="lbl-wl-no">
                                    <input type="radio" name="cr-wl" value="no"> ❌ Nein
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SORTIERUNG -->
                <div class="cr-card">
                    <div class="cr-card-head"><span class="cr-icon">🔀</span>Sortierung <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— bis zu 3 Ebenen</span></div>
                    <div class="cr-card-body">
                        <div class="cr-sort-level">
                            <span class="cr-sort-num">1</span>
                            <select class="cr-sel" id="cr-s-1">${this._sortOpts('— Standard —')}</select>
                        </div>
                        <div class="cr-sort-level">
                            <span class="cr-sort-num">2</span>
                            <select class="cr-sel" id="cr-s-2">${this._sortOpts('— Keine —')}</select>
                        </div>
                        <div class="cr-sort-level">
                            <span class="cr-sort-num">3</span>
                            <select class="cr-sel" id="cr-s-3">${this._sortOpts('— Keine —')}</select>
                        </div>
                    </div>
                </div>

                <!-- ANZEIGE -->
                <div class="cr-card">
                    <div class="cr-card-head"><span class="cr-icon">🏷</span>Anzeige</div>
                    <div class="cr-card-body">
                        <label class="cr-toggle-lbl${this.showBadges ? ' checked' : ''}" id="lbl-badges" style="width:fit-content;">
                            <input type="checkbox" id="cr-opt-badges" ${chk}>
                            Badges auf Karten anzeigen
                        </label>
                        <label class="cr-toggle-lbl" id="lbl-data-only" style="width:fit-content;">
                            <input type="checkbox" id="cr-opt-data">
                            Nur Karten mit gescannten Daten
                        </label>
                    </div>
                </div>

                <!-- EXPORT -->
                <div class="cr-card">
                    <div class="cr-card-head"><span class="cr-icon">📋</span>Export <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— sichtbare Titel</span></div>
                    <div class="cr-card-body">
                        <div class="cr-export-row">
                            <select class="cr-sel" id="cr-export-fmt">
                                <option value="numbered">1. Nummerierte Liste</option>
                                <option value="bullets">• Aufzählung</option>
                                <option value="csv">CSV (alle Daten)</option>
                                <option value="json">JSON (alle Daten)</option>
                                <option value="links">Links (URLs)</option>
                                <option value="markdown">Markdown Tabelle</option>
                            </select>
                            <button class="cr-btn-copy" id="cr-btn-copy">📋 Kopieren</button>
                        </div>
                    </div>
                </div>

            </div><!-- /.cr-body -->

            <!-- Footer -->
            <div class="cr-foot">
                <div class="cr-btn-row">
                    <button class="cr-btn cr-btn-scan" id="cr-btn-scan">
                        <span>🔄</span> Scannen
                    </button>
                    <button class="cr-btn cr-btn-apply" id="cr-btn-apply">
                        <span>✨</span> Anwenden
                    </button>
                </div>
                <button class="cr-btn cr-btn-reset" id="cr-btn-reset">
                    ↺ Alle Filter zurücksetzen
                </button>
            </div>
            `;
        }

        _sortOpts(empty) {
            return `
                <option value="">${empty}</option>
                <option value="rating-desc">⭐ Bewertung — hoch → niedrig</option>
                <option value="rating-asc">⭐ Bewertung — niedrig → hoch</option>
                <option value="votes-desc">👥 Stimmen — viele → wenige</option>
                <option value="votes-asc">👥 Stimmen — wenige → viele</option>
                <option value="episodes-desc">📺 Episoden — viele → wenige</option>
                <option value="episodes-asc">📺 Episoden — wenige → viele</option>
                <option value="seasons-desc">📦 Staffeln — viele → wenige</option>
                <option value="seasons-asc">📦 Staffeln — wenige → viele</option>
                <option value="title-asc">🔤 Titel — A → Z</option>
                <option value="title-desc">🔤 Titel — Z → A</option>
            `;
        }

        // ── Events ──────────────────────────────────────────────────────────

        _attachEvents() {
            document.getElementById('cr-sidebar-toggle').addEventListener('click', () => this._toggle());
            document.getElementById('cr-close').addEventListener('click',    () => this._toggle(false));
            document.getElementById('cr-btn-scan').addEventListener('click', () => this._scan());
            document.getElementById('cr-btn-apply').addEventListener('click',() => this._apply());
            document.getElementById('cr-btn-reset').addEventListener('click',() => this._reset());

            // Styled checkbox/radio visual sync
            document.getElementById('cr-f-sub').addEventListener('change', e => {
                document.getElementById('lbl-sub').classList.toggle('checked', e.target.checked);
                this._debounceApply();
            });
            document.getElementById('cr-f-dub').addEventListener('change', e => {
                document.getElementById('lbl-dub').classList.toggle('checked', e.target.checked);
                this._debounceApply();
            });
            document.querySelectorAll('input[name="cr-wl"]').forEach(r => {
                r.addEventListener('change', () => {
                    document.querySelectorAll('.cr-wl-lbl').forEach(l => l.classList.remove('checked'));
                    const v = document.querySelector('input[name="cr-wl"]:checked')?.value;
                    const map = { all: 'lbl-wl-all', yes: 'lbl-wl-yes', no: 'lbl-wl-no' };
                    if (map[v]) document.getElementById(map[v]).classList.add('checked');
                    this._debounceApply();
                });
            });

            document.getElementById('cr-opt-badges').addEventListener('change', e => {
                this.showBadges = e.target.checked;
                document.getElementById('lbl-badges').classList.toggle('checked', this.showBadges);
                GM_setValue('cr_show_badges', this.showBadges);
                this._updateBadgeVisibility();
            });

            document.getElementById('cr-opt-data').addEventListener('change', e => {
                document.getElementById('lbl-data-only').classList.toggle('checked', e.target.checked);
                this._debounceApply();
            });

            document.getElementById('cr-btn-copy').addEventListener('click', () => this._copyExport());

            // Auto-apply on input change
            ['cr-f-title','cr-f-desc','cr-f-r-min','cr-f-r-max','cr-f-v-min',
             'cr-f-ep-min','cr-f-ep-max','cr-f-se-min','cr-f-se-max',
             'cr-s-1','cr-s-2','cr-s-3'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input',  () => this._debounceApply());
                    el.addEventListener('change', () => this._debounceApply());
                }
            });
        }

        _debounceApply() {
            clearTimeout(this._applyTimer);
            this._applyTimer = setTimeout(() => { this._saveFilters(); this._apply(); }, 280);
        }

        _toggle(forceTo) {
            this.isOpen = forceTo !== undefined ? forceTo : !this.isOpen;
            document.getElementById('cr-filter-sidebar').classList.toggle('open', this.isOpen);
            document.documentElement.classList.toggle('cr-pushed', this.isOpen);
            GM_setValue('cr_sidebar_open', this.isOpen);
            this._syncToggleUI();
        }

        _syncToggleUI() {
            // nothing extra needed — CSS handles tab position via sidebar transform
        }

        // ── Scanning ────────────────────────────────────────────────────────

        async _scan() {
            if (this.isScanning) return;
            this.isScanning = true;

            const btn = document.getElementById('cr-btn-scan');
            btn.disabled = true;
            btn.innerHTML = '<span class="cr-spin"></span> Scannen…';
            this._status('Scanne Karten…');
            document.getElementById('cr-prog').style.display = 'block';

            this.cards.clear();
            this.origOrder = [];

            const all = Array.from(document.querySelectorAll('.browse-card'));

            // Hover-Panels per CSS erzwingen — JS-mouseenter setzt keine CSS :hover Pseudo-Klasse,
            // deshalb werden Hover-Inhalte (Episoden, Staffeln) so zuverlässig sichtbar gemacht.
            const forceStyle = document.createElement('style');
            forceStyle.id = 'cr-force-hover';
            forceStyle.textContent = `
                [class*="browse-card-hover"] {
                    opacity: 1 !important;
                    visibility: visible !important;
                    display: block !important;
                    transform: none !important;
                    pointer-events: none !important;
                }
            `;
            document.head.appendChild(forceStyle);
            // mouseenter zusätzlich für React-State-basierte Komponenten
            all.forEach(c => c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));
            await this._sleep(600);

            for (let i = 0; i < all.length; i++) {
                const card = all[i];
                const info = this._extract(card, i);
                this.cards.set(card, info);
                this.origOrder.push(card);

                if (this.showBadges) this._addBadges(card, info);

                document.getElementById('cr-prog-fill').style.width =
                    Math.round((i + 1) / all.length * 100) + '%';
                this._status(`Gescannt: ${i + 1} / ${all.length}`);

                if ((i + 1) % 30 === 0) await this._sleep(0);
            }

            // CSS-Injection entfernen
            document.getElementById('cr-force-hover')?.remove();
            document.getElementById('cr-prog').style.display = 'none';

            // ── Retry-Pass für verbleibende Karten ohne Daten ─────────────
            const noData = Array.from(this.cards.entries())
                .filter(([, info]) => !info.hasData)
                .map(([card]) => card);

            if (noData.length > 0) {
                this._status(`Retry: ${noData.length} Karten ohne Daten…`);

                // Nochmals CSS-Force für die übrigen Karten
                const retryStyle = document.createElement('style');
                retryStyle.id = 'cr-force-hover';
                retryStyle.textContent = `[class*="browse-card-hover"] { opacity: 1 !important; visibility: visible !important; display: block !important; transform: none !important; pointer-events: none !important; }`;
                document.head.appendChild(retryStyle);
                noData.forEach(c => c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));
                await this._sleep(1000);

                let improved = 0;
                noData.forEach(card => {
                    const old = this.cards.get(card);
                    const fresh = this._extract(card, old.index);
                    if (fresh.hasData) {
                        this.cards.set(card, fresh);
                        if (this.showBadges) this._addBadges(card, fresh);
                        improved++;
                    }
                });
                retryStyle.remove();
                this._status(`Retry: +${improved} von ${noData.length} aufgewertet`);
                console.log(`[CR Filter] Retry: ${improved}/${noData.length} Karten haben jetzt Daten`);
            }

            const wd = this._withData();
            this._status(`✅ ${all.length} gescannt · ${wd} mit echten Daten`);
            this._updateStats(all.length, all.length, wd);

            this.isScanning = false;
            btn.disabled = false;
            btn.innerHTML = '<span>🔄</span> Scannen';

            this._apply();
            this._startObserver(); // Observer erst nach Scan starten — Container ist jetzt bekannt
        }

        _extract(card, index) {
            // Title + link
            const titleEl = card.querySelector('h3[data-t="title"] a') ||
                            card.querySelector('[class*="browse-card__title"] a');
            const title = titleEl?.textContent.trim() ?? '';
            const link  = titleEl?.href ?? '';
            const seriesId = link.match(/series\/([A-Z0-9]+)/)?.[1] ?? '';

            // Description
            const description = card.querySelector('p[data-t="description"]')
                ?.textContent.trim() ?? '';

            // Rating
            const ratingEl = card.querySelector('p[class*="star-rating-short-static__rating"]') ||
                             card.querySelector('[data-t="star-rating-short-static"] [class*="rating"]');
            const rating = ratingEl ? (parseFloat(ratingEl.textContent.trim()) || null) : null;

            // Vote count
            const votesEl = card.querySelector('p[data-t="rating-count"]') ||
                            card.querySelector('[class*="votes-count"]') ||
                            card.querySelector('[class*="star-rating-short-static__votes"]');
            let votes = null;
            if (votesEl) {
                const m = votesEl.textContent.match(/([\d,.]+)\s*([kKmM]?)/);
                if (m) {
                    let n = parseFloat(m[1].replace(',', '.'));
                    const s = m[2].toLowerCase();
                    if (s === 'k') n *= 1_000;
                    else if (s === 'm') n *= 1_000_000;
                    votes = Math.round(n);
                }
            }

            // Seasons + Episodes
            const metaEl = card.querySelector('[class*="browse-card-hover__series-meta"]');
            let seasons = null, episodes = null;
            if (metaEl) {
                metaEl.querySelectorAll('span').forEach(span => {
                    const t = span.textContent.trim();
                    const ep = t.match(/(\d+)\s*(?:Episode[ns]?|Folge[n]?)/i);
                    const se = t.match(/(\d+)\s*(?:Staffel[n]?|Season[s]?)/i);
                    if (ep) episodes = parseInt(ep[1]);
                    if (se) seasons  = parseInt(se[1]);
                });
            }

            // Sub / Dub
            let hasSub = false, hasDub = false;
            card.querySelectorAll('[class*="meta-tags"] span, [class*="meta-tag"] span').forEach(el => {
                const t = el.textContent.toLowerCase();
                if (t.includes('untertitel') || t.includes('sub')) hasSub = true;
                if (t.includes('synchro')    || t.includes('dub')) hasDub = true;
            });

            // Watchlist — nur das Label-Element das erscheint wenn die Serie BEREITS auf der Watchlist ist,
            // nicht den generischen Watchlist-Button der auf jeder Karte vorhanden ist.
            const onWatchlist = !!card.querySelector(
                '[class*="card-watchlist-label"], [class*="watchlist-label"]'
            );

            const hasData = rating !== null || votes !== null ||
                            episodes !== null || seasons !== null;

            return { title, description, link, seriesId, rating, votes,
                     episodes, seasons, hasSub, hasDub, onWatchlist, hasData, index };
        }

        // ── Badges ──────────────────────────────────────────────────────────

        _addBadges(card, info) {
            card.querySelector('.cr-overlay')?.remove();

            const anchor = card.querySelector('[class*="browse-card__poster"], [class*="content-image"]') || card;
            if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';

            const ov = document.createElement('div');
            ov.className = 'cr-overlay';

            if (info.rating   !== null) ov.appendChild(this._mkBadge('cr-b-rating',   `⭐ ${info.rating.toFixed(1)}`));
            if (info.votes    !== null) ov.appendChild(this._mkBadge('cr-b-votes',    `👥 ${this._fmt(info.votes)}`));
            if (info.seasons  !== null) ov.appendChild(this._mkBadge('cr-b-seasons',  `📦 ${info.seasons}S`));
            if (info.episodes !== null) ov.appendChild(this._mkBadge('cr-b-episodes', `📺 ${info.episodes}E`));
            if (info.hasSub)            ov.appendChild(this._mkBadge('cr-b-sub',  'SUB'));
            if (info.hasDub)            ov.appendChild(this._mkBadge('cr-b-dub',  'DUB'));
            if (info.onWatchlist)       ov.appendChild(this._mkBadge('cr-b-wl',   '📌'));

            anchor.appendChild(ov);
        }

        _mkBadge(cls, text) {
            const b = document.createElement('div');
            b.className = `cr-badge ${cls}`;
            b.textContent = text;
            return b;
        }

        _updateBadgeVisibility() {
            document.querySelectorAll('.cr-overlay').forEach(el => {
                el.style.display = this.showBadges ? '' : 'none';
            });
        }

        // ── Filter + Sort ────────────────────────────────────────────────────

        _getFilters() {
            const num = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
            const int = id => { const v = parseInt(document.getElementById(id)?.value);   return isNaN(v) ? null : v; };
            const str = id => document.getElementById(id)?.value.trim().toLowerCase() ?? '';
            const chk = id => document.getElementById(id)?.checked ?? false;
            const wl  = ()  => document.querySelector('input[name="cr-wl"]:checked')?.value ?? 'all';
            return {
                title:      str('cr-f-title'),
                desc:       str('cr-f-desc'),
                ratingMin:  num('cr-f-r-min'),
                ratingMax:  num('cr-f-r-max'),
                votesMin:   int('cr-f-v-min'),
                epMin:      int('cr-f-ep-min'),
                epMax:      int('cr-f-ep-max'),
                seasonsMin: int('cr-f-se-min'),
                seasonsMax: int('cr-f-se-max'),
                subOnly:    chk('cr-f-sub'),
                dubOnly:    chk('cr-f-dub'),
                watchlist:  wl(),
                dataOnly:   chk('cr-opt-data'),
                sort: ['cr-s-1','cr-s-2','cr-s-3']
                    .map(id => document.getElementById(id)?.value)
                    .filter(Boolean),
            };
        }

        _passes(info, f) {
            if (f.title && !info.title.toLowerCase().includes(f.title))           return false;
            if (f.desc  && !info.description.toLowerCase().includes(f.desc))      return false;
            if (f.ratingMin  !== null && info.rating   !== null && info.rating   < f.ratingMin)  return false;
            if (f.ratingMax  !== null && info.rating   !== null && info.rating   > f.ratingMax)  return false;
            if (f.votesMin   !== null && info.votes    !== null && info.votes    < f.votesMin)   return false;
            if (f.epMin      !== null && info.episodes !== null && info.episodes < f.epMin)      return false;
            if (f.epMax      !== null && info.episodes !== null && info.episodes > f.epMax)      return false;
            if (f.seasonsMin !== null && info.seasons  !== null && info.seasons  < f.seasonsMin) return false;
            if (f.seasonsMax !== null && info.seasons  !== null && info.seasons  > f.seasonsMax) return false;
            if (f.subOnly && !info.hasSub)                return false;
            if (f.dubOnly && !info.hasDub)                return false;
            if (f.watchlist === 'yes' && !info.onWatchlist) return false;
            if (f.watchlist === 'no'  &&  info.onWatchlist) return false;
            if (f.dataOnly && !info.hasData)                return false;
            return true;
        }

        _cmp(a, b, criterion) {
            const [field, dir] = criterion.split('-');
            const mult = dir === 'desc' ? -1 : 1;
            const numCmp = (va, vb) => {
                if (va === null && vb === null) return 0;
                if (va === null) return 1;   // nulls always last
                if (vb === null) return -1;
                return (va - vb) * mult;
            };
            switch (field) {
                case 'rating':   return numCmp(a.rating,   b.rating);
                case 'votes':    return numCmp(a.votes,    b.votes);
                case 'episodes': return numCmp(a.episodes, b.episodes);
                case 'seasons':  return numCmp(a.seasons,  b.seasons);
                case 'title':    return a.title.localeCompare(b.title) * mult;
                default:         return 0;
            }
        }

        _apply() {
            if (this.cards.size === 0) return;
            this._observerPaused = true;

            const f         = this._getFilters();
            const container = this.origOrder[0]?.parentElement;
            if (!container) return;

            const all     = Array.from(this.cards.entries()).map(([card, info]) => ({ card, info }));
            const visible = all.filter(({ info }) =>  this._passes(info, f));
            const hidden  = all.filter(({ info }) => !this._passes(info, f));

            // Sort
            if (f.sort.length > 0) {
                visible.sort((a, b) => {
                    for (const c of f.sort) {
                        const r = this._cmp(a.info, b.info, c);
                        if (r !== 0) return r;
                    }
                    return a.info.index - b.info.index;
                });
            } else {
                visible.sort((a, b) => a.info.index - b.info.index);
            }

            visible.forEach(({ card }) => { card.classList.remove('cr-hidden'); container.appendChild(card); });
            hidden.forEach(({ card  }) => { card.classList.add('cr-hidden');    container.appendChild(card); });

            this._updateStats(visible.length, this.cards.size, this._withData());
            this._updateTabCount(f);
            setTimeout(() => { this._observerPaused = false; }, 500);
        }

        _reset() {
            ['cr-f-title','cr-f-desc','cr-f-r-min','cr-f-r-max','cr-f-v-min',
             'cr-f-ep-min','cr-f-ep-max','cr-f-se-min','cr-f-se-max',
             'cr-s-1','cr-s-2','cr-s-3'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            // Reset checkboxes
            ['cr-f-sub','cr-f-dub'].forEach(id => {
                document.getElementById(id).checked = false;
            });
            document.getElementById('lbl-sub').classList.remove('checked');
            document.getElementById('lbl-dub').classList.remove('checked');
            document.getElementById('cr-opt-data').checked = false;
            document.getElementById('lbl-data-only').classList.remove('checked');

            // Reset watchlist radios
            document.querySelector('input[name="cr-wl"][value="all"]').checked = true;
            document.querySelectorAll('.cr-wl-lbl').forEach(l => l.classList.remove('checked'));
            document.getElementById('lbl-wl-all').classList.add('checked');

            // Restore original DOM order
            const container = this.origOrder[0]?.parentElement;
            if (container) {
                this.origOrder.forEach(card => {
                    card.classList.remove('cr-hidden');
                    container.appendChild(card);
                });
            }

            this._updateStats(this.cards.size, this.cards.size, this._withData());
            this._updateTabCount(this._getFilters());
            GM_setValue('crunchyroll_advanced_filters', '{}');
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        _status(msg) {
            const el = document.getElementById('cr-status');
            if (el) el.textContent = msg;
        }

        _updateStats(visible, total, withData) {
            const s = id => document.getElementById(id);
            if (s('cr-s-vis')) s('cr-s-vis').textContent = visible;
            if (s('cr-s-tot')) s('cr-s-tot').textContent = total;
            if (s('cr-s-dat')) s('cr-s-dat').textContent = withData;
        }

        _updateTabCount(f) {
            let n = 0;
            if (f.title)               n++;
            if (f.desc)                n++;
            if (f.ratingMin  !== null) n++;
            if (f.ratingMax  !== null) n++;
            if (f.votesMin   !== null) n++;
            if (f.epMin      !== null) n++;
            if (f.epMax      !== null) n++;
            if (f.seasonsMin !== null) n++;
            if (f.seasonsMax !== null) n++;
            if (f.subOnly)             n++;
            if (f.dubOnly)             n++;
            if (f.watchlist !== 'all') n++;
            if (f.dataOnly)            n++;
            f.sort.forEach(() => n++);

            const badge = document.getElementById('cr-tab-count');
            if (badge) {
                badge.textContent = String(n);
                badge.classList.toggle('visible', n > 0);
            }
        }

        // ── MutationObserver ─────────────────────────────────────────────────

        _startObserver() {
            // Bestätigten Container aus dem Scan verwenden
            const target = this.origOrder[0]?.parentElement;
            if (!target) return;

            // Alten Observer abbauen falls vorhanden (z. B. bei erneutem Scan)
            if (this._observer) {
                this._observer.disconnect();
                this._observer = null;
            }
            this._observerPaused = false;
            this._observerTimer = null;

            this._observer = new MutationObserver(mutations => {
                if (this._observerPaused || this.isScanning) return;

                const newCards = [];
                mutations.forEach(m => {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;
                        // Nur direkte Kinder des Containers prüfen (keine tiefen Subtree-Mutationen)
                        if (node.parentElement !== target) return;
                        if (node.classList?.contains('browse-card') && !this.cards.has(node)) {
                            newCards.push(node);
                        }
                        node.querySelectorAll?.('.browse-card').forEach(c => {
                            if (!this.cards.has(c)) newCards.push(c);
                        });
                    });
                });

                if (newCards.length === 0) return;

                // Debounce: Mehrere schnell aufeinanderfolgende Einfügungen zusammenfassen
                clearTimeout(this._observerTimer);
                this._observerTimer = setTimeout(() => {
                    // Nochmals prüfen, Skeleton-Karten (ohne Titel) überspringen
                    const ready = newCards.filter(c => {
                        const t = c.querySelector('h3[data-t="title"] a, [class*="browse-card__title"] a');
                        return t && t.textContent.trim() !== '';
                    });
                    if (ready.length > 0) this._ingestNewCards(ready);
                }, 400);
            });

            // subtree: true nötig für Infinite-Scroll-Wrapper, aber wir filtern auf direkte Container-Kinder
            this._observer.observe(target, { childList: true, subtree: true });
        }

        async _ingestNewCards(cards) {
            // Hover to trigger lazy data, then wait
            cards.forEach(c => c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));
            await this._sleep(700);

            let added = 0;
            cards.forEach(card => {
                if (this.cards.has(card)) return;
                const info = this._extract(card, this.origOrder.length);
                this.cards.set(card, info);
                this.origOrder.push(card);
                if (this.showBadges) this._addBadges(card, info);
                card.classList.add('cr-new-card');
                added++;
            });

            if (added > 0) {
                this._status(`+${added} neue Karten erkannt`);
                this._updateStats(
                    Array.from(this.cards.keys()).filter(c => !c.classList.contains('cr-hidden')).length,
                    this.cards.size,
                    this._withData()
                );
                this._apply();
            }
        }

        // ── Clipboard export ─────────────────────────────────────────────────

        _copyExport() {
            const fmt    = document.getElementById('cr-export-fmt').value;
            const btn    = document.getElementById('cr-btn-copy');
            const items  = Array.from(this.cards.entries())
                .filter(([card]) => !card.classList.contains('cr-hidden'))
                .map(([, info]) => info);

            if (items.length === 0) {
                btn.textContent = '⚠ Keine Titel';
                setTimeout(() => { btn.innerHTML = '📋 Kopieren'; }, 1500);
                return;
            }

            let text = '';

            if (fmt === 'numbered') {
                text = items.map((info, i) => `${i + 1}. ${info.title}`).join('\n');

            } else if (fmt === 'bullets') {
                text = items.map(info => `• ${info.title}`).join('\n');

            } else if (fmt === 'links') {
                text = items.map(info => info.link || info.title).join('\n');

            } else if (fmt === 'csv') {
                const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
                const header = ['Titel','Bewertung','Stimmen','Episoden','Staffeln','Sub','Dub','Watchlist','Link'];
                const rows = items.map(i => [
                    esc(i.title), esc(i.rating ?? ''), esc(i.votes ?? ''),
                    esc(i.episodes ?? ''), esc(i.seasons ?? ''),
                    esc(i.hasSub ? 'Ja' : 'Nein'), esc(i.hasDub ? 'Ja' : 'Nein'),
                    esc(i.onWatchlist ? 'Ja' : 'Nein'), esc(i.link)
                ].join(','));
                text = [header.join(','), ...rows].join('\n');

            } else if (fmt === 'json') {
                text = JSON.stringify(items.map(i => ({
                    title:       i.title,
                    rating:      i.rating,
                    votes:       i.votes,
                    episodes:    i.episodes,
                    seasons:     i.seasons,
                    sub:         i.hasSub,
                    dub:         i.hasDub,
                    onWatchlist: i.onWatchlist,
                    link:        i.link,
                })), null, 2);

            } else if (fmt === 'markdown') {
                const row = (cells) => '| ' + cells.join(' | ') + ' |';
                const header = row(['#', 'Titel', '⭐', '👥', '📺 Ep.', '📦 St.', 'Sub', 'Dub']);
                const sep    = row(['---', '---', '---', '---', '---', '---', '---', '---']);
                const rows   = items.map((i, idx) => row([
                    String(idx + 1),
                    i.title,
                    i.rating != null ? i.rating.toFixed(1) : '—',
                    i.votes  != null ? this._fmt(i.votes)  : '—',
                    i.episodes != null ? String(i.episodes) : '—',
                    i.seasons  != null ? String(i.seasons)  : '—',
                    i.hasSub ? '✓' : '',
                    i.hasDub ? '✓' : '',
                ]));
                text = [header, sep, ...rows].join('\n');
            }

            navigator.clipboard.writeText(text).then(() => {
                btn.classList.add('copied');
                btn.innerHTML = `✅ ${items.length} kopiert`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = '📋 Kopieren';
                }, 1800);
            }).catch(() => {
                btn.textContent = '⚠ Fehler';
                setTimeout(() => { btn.innerHTML = '📋 Kopieren'; }, 1500);
            });
        }

        _withData() {
            return Array.from(this.cards.values()).filter(i => i.hasData).length;
        }

        _fmt(n) {
            if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
            if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
            return String(n);
        }

        _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

        // ── Persistence ─────────────────────────────────────────────────────

        _saveFilters() {
            try { GM_setValue('crunchyroll_advanced_filters', JSON.stringify(this._getFilters())); } catch {}
        }

        _loadSavedFilters() {
            try {
                const s = JSON.parse(GM_getValue('crunchyroll_advanced_filters', '{}'));
                const set = (id, val) => {
                    if (val == null || val === '') return;
                    const el = document.getElementById(id);
                    if (el) el.value = val;
                };
                set('cr-f-title',  s.title);
                set('cr-f-desc',   s.desc);
                set('cr-f-r-min',  s.ratingMin);
                set('cr-f-r-max',  s.ratingMax);
                set('cr-f-v-min',  s.votesMin);
                set('cr-f-ep-min', s.epMin);
                set('cr-f-ep-max', s.epMax);
                set('cr-f-se-min', s.seasonsMin);
                set('cr-f-se-max', s.seasonsMax);
                set('cr-s-1', s.sort?.[0]);
                set('cr-s-2', s.sort?.[1]);
                set('cr-s-3', s.sort?.[2]);
                if (s.dataOnly) {
                    document.getElementById('cr-opt-data').checked = true;
                    document.getElementById('lbl-data-only').classList.add('checked');
                }
                if (s.subOnly) {
                    document.getElementById('cr-f-sub').checked = true;
                    document.getElementById('lbl-sub').classList.add('checked');
                }
                if (s.dubOnly) {
                    document.getElementById('cr-f-dub').checked = true;
                    document.getElementById('lbl-dub').classList.add('checked');
                }
                if (s.watchlist && s.watchlist !== 'all') {
                    const r = document.querySelector(`input[name="cr-wl"][value="${s.watchlist}"]`);
                    if (r) {
                        r.checked = true;
                        document.querySelectorAll('.cr-wl-lbl').forEach(l => l.classList.remove('checked'));
                        const map = { yes: 'lbl-wl-yes', no: 'lbl-wl-no' };
                        if (map[s.watchlist]) document.getElementById(map[s.watchlist]).classList.add('checked');
                        document.getElementById('lbl-wl-all').classList.remove('checked');
                    }
                }
            } catch {}
        }
    }

    // ── PiP Unlock (SPA-sicher: läuft immer, tut nichts wenn kein Video) ────────
    setInterval(() => {
        document.querySelector('video[disablePictureInPicture]')
            ?.removeAttribute('disablePictureInPicture');
    }, 1000);

    // ── Filter-UI (nur auf /videos/popular) ──────────────────────────────────
    if (/\/videos\/popular/.test(location.pathname))
        new CrunchyrollEnhanced();
})();

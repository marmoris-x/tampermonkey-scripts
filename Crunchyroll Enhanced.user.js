// ==UserScript==
// @name         Crunchyroll Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      4.5
// @description  Sidebar (page-push) with multi-filter & sort for Crunchyroll browse — auto-scan, retry, export/clipboard, data-only filter
// @author       marmoris-x
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @match        https://*.crunchyroll.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-idle
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/dom-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/storage-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/ui-components.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/i18n-utils.js
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @unwrap
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Crunchyroll%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Crunchyroll%20Enhanced.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const SW = 360; // sidebar width in px
    const log = TM.createLogger('Crunchyroll Enhanced');

    // ── Page-level styles (applied in light DOM for card badges and keyframes) ──
    GM_addStyle(`
        /* Push animation — the shared sidebar controls marginRight inline */
        html { transition: margin-right 0.32s ease !important; }

        /* Card badge overlays */
        .cr-overlay {
            position: absolute; top: 5px; right: 5px; z-index: 3;
            display: flex; flex-direction: column; gap: 2px; pointer-events: none;
        }
        .cr-badge {
            display: inline-block; padding: 2px 5px; border-radius: 3px;
            font-size: 9px; font-weight: 700; line-height: 1.4; white-space: nowrap;
        }
        .cr-b-rating   { background: rgba(230,140,10,0.9); color: #fff; }
        .cr-b-votes    { background: rgba(130,60,160,0.9); color: #fff; }
        .cr-b-seasons  { background: rgba(30,150,80,0.9);  color: #fff; }
        .cr-b-episodes { background: rgba(40,120,200,0.9); color: #fff; }
        .cr-b-sub      { background: rgba(20,50,80,0.92);  color: #6bb5e0; }
        .cr-b-dub      { background: rgba(20,50,80,0.92);  color: #9ecfec; }
        .cr-b-wl       { background: rgba(200,40,40,0.88); color: #fff; }

        /* Hidden filter state */
        .cr-hidden { display: none !important; }

        /* Spinner keyframes */
        @keyframes cr-spin { to { transform: rotate(360deg); } }

        /* New card flash animation */
        @keyframes cr-new-card { from { outline: 2px solid #f47521; } to { outline: 2px solid transparent; } }
        .cr-new-card { animation: cr-new-card 1.2s ease-out forwards; }
    `);

    // ── Shadow-DOM styles (injected into the shared sidebar's shadow root) ──
    function sidebarStyles() {
        return `
            .body { padding: 0 !important; }
            .body::-webkit-scrollbar { width: 3px; }
            .body::-webkit-scrollbar-track { background: transparent; }
            .body::-webkit-scrollbar-thumb { background: rgba(244,117,33,0.4); border-radius: 2px; }
            .body::-webkit-scrollbar-thumb:hover { background: #f47521; }

            /* ── Custom header (sticky inside bodyEl) ─────────────────────── */
            .cr-head {
                position: sticky; top: 0; z-index: 10;
                flex-shrink: 0; background: #0e0e1a;
                border-bottom: 1px solid rgba(244,117,33,0.2);
                padding: 14px 16px 12px;
                display: flex; align-items: center; gap: 10px;
            }
            .cr-head-logo {
                width: 28px; height: 28px; background: #f47521; border-radius: 6px;
                display: flex; align-items: center; justify-content: center;
                font-size: 15px; flex-shrink: 0;
            }
            .cr-head-text { flex: 1; min-width: 0; }
            .cr-head-text h2 {
                margin: 0; font-size: 14px; font-weight: 700;
                color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .cr-head-text p {
                margin: 2px 0 0; font-size: 10px; color: #5a5a80;
            }
            .cr-head-close {
                background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 6px; color: #888; width: 28px; height: 28px;
                cursor: pointer; font-size: 14px;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0; transition: background 0.15s, color 0.15s;
            }
            .cr-head-close:hover { background: rgba(231,76,60,0.2); color: #e74c3c; border-color: rgba(231,76,60,0.4); }

            /* ── Stats strip ──────────────────────────────────────────────── */
            .cr-stats {
                flex-shrink: 0; display: grid; grid-template-columns: 1fr 1fr 1fr;
                background: #0e0e1a; border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .cr-stat {
                padding: 10px 6px; text-align: center;
                border-right: 1px solid rgba(255,255,255,0.05);
            }
            .cr-stat:last-child { border-right: none; }
            .cr-stat-n {
                display: block; font-size: 20px; font-weight: 700;
                color: #f47521; line-height: 1;
            }
            .cr-stat-l {
                display: block; font-size: 9px; color: #4a4a70;
                text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px;
            }

            /* ── Progress + status ────────────────────────────────────────── */
            .cr-prog-wrap {
                flex-shrink: 0; height: 2px; background: rgba(255,255,255,0.05); display: none;
            }
            .cr-prog-fill {
                height: 100%; background: linear-gradient(90deg, #f47521, #ff9f5a);
                width: 0%; transition: width 0.12s;
            }
            .cr-status {
                flex-shrink: 0; font-size: 10px; color: #4a4a70;
                padding: 5px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
                min-height: 22px; display: flex; align-items: center; gap: 6px;
            }

            /* ── Scrollable body ──────────────────────────────────────────── */
            .cr-body-inner {
                padding: 12px 12px 4px;
                display: flex; flex-direction: column; gap: 8px;
            }

            /* ── Section cards ────────────────────────────────────────────── */
            .cr-card {
                background: #1a1a2a; border: 1px solid rgba(255,255,255,0.07);
                border-radius: 8px; overflow: hidden;
            }
            .cr-card-head {
                display: flex; align-items: center; gap: 7px;
                padding: 8px 12px; background: rgba(244,117,33,0.06);
                border-bottom: 1px solid rgba(244,117,33,0.12);
                font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.9px; color: #f47521;
            }
            .cr-card-head .cr-icon { font-size: 13px; opacity: 0.9; }
            .cr-card-body {
                padding: 11px 12px; display: flex; flex-direction: column; gap: 8px;
            }

            /* ── Form rows ────────────────────────────────────────────────── */
            .cr-field {
                display: flex; align-items: center; gap: 8px;
            }
            .cr-field-label {
                font-size: 11px; color: #8888b0; min-width: 80px; flex-shrink: 0;
            }
            .cr-field-ctrl { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; }
            .cr-range {
                display: grid; grid-template-columns: 1fr auto 1fr;
                align-items: center; gap: 5px; flex: 1;
            }
            .cr-range-sep {
                font-size: 11px; color: #3a3a5a; text-align: center; flex-shrink: 0;
            }
            input.cr-in, select.cr-sel {
                width: 100%; padding: 6px 8px; background: #0e0e1a;
                border: 1px solid rgba(255,255,255,0.1); border-radius: 5px;
                color: #d8d8f0; font-size: 11px; font-family: inherit;
                transition: border-color 0.15s, box-shadow 0.15s;
                box-sizing: border-box; -webkit-appearance: none; appearance: none;
            }
            input.cr-in:focus, select.cr-sel:focus {
                outline: none; border-color: #f47521;
                box-shadow: 0 0 0 2px rgba(244,117,33,0.15);
            }
            input.cr-in::-moz-placeholder { color: #2e2e4e; }
            input.cr-in::placeholder { color: #2e2e4e; }
            select.cr-sel {
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E");
                background-repeat: no-repeat; background-position: right 8px center;
                padding-right: 24px; cursor: pointer;
            }
            select.cr-sel option { background: #12121e; color: #d8d8f0; }
            .cr-toggles { display: flex; flex-wrap: wrap; gap: 6px; }
            .cr-toggle-lbl {
                display: flex; align-items: center; gap: 5px; background: #0e0e1a;
                border: 1px solid rgba(255,255,255,0.1); border-radius: 5px;
                padding: 5px 9px; font-size: 11px; color: #8888b0;
                cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s;
                -webkit-user-select: none; -moz-user-select: none; user-select: none;
            }
            .cr-toggle-lbl:hover { border-color: rgba(244,117,33,0.4); color: #d8d8f0; }
            .cr-toggle-lbl input { display: none; }
            .cr-toggle-lbl.checked {
                background: rgba(244,117,33,0.12); border-color: rgba(244,117,33,0.5); color: #f47521;
            }
            .cr-wl-group { display: flex; gap: 4px; }
            .cr-wl-lbl {
                flex: 1; text-align: center; padding: 5px 4px; background: #0e0e1a;
                border: 1px solid rgba(255,255,255,0.08); border-radius: 5px;
                font-size: 10px; color: #666; cursor: pointer;
                transition: all 0.15s; -webkit-user-select: none; -moz-user-select: none; user-select: none;
            }
            .cr-wl-lbl:hover { border-color: rgba(244,117,33,0.3); color: #aaa; }
            .cr-wl-lbl.checked { background: rgba(244,117,33,0.12); border-color: rgba(244,117,33,0.5); color: #f47521; }
            .cr-wl-lbl input { display: none; }
            .cr-sort-level {
                display: grid; grid-template-columns: 20px 1fr; align-items: center; gap: 8px;
            }
            .cr-sort-num {
                font-size: 10px; font-weight: 700; color: #3a3a5a; text-align: center;
            }

            /* ── Footer ───────────────────────────────────────────────────── */
            .cr-foot {
                flex-shrink: 0; padding: 10px 12px 12px;
                border-top: 1px solid rgba(255,255,255,0.06);
                display: flex; flex-direction: column; gap: 6px; background: #0e0e1a;
            }
            .cr-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
            .cr-btn {
                padding: 9px 12px; border: none; border-radius: 6px;
                font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer;
                text-transform: uppercase; letter-spacing: 0.5px;
                transition: filter 0.15s, transform 0.1s;
                display: flex; align-items: center; justify-content: center; gap: 5px;
            }
            .cr-btn:hover  { filter: brightness(1.18); transform: translateY(-1px); }
            .cr-btn:active { transform: translateY(0); filter: brightness(0.9); }
            .cr-btn-scan   { background: #2d6ca8; color: #fff; }
            .cr-btn-apply  { background: #f47521; color: #fff; }
            .cr-btn-reset {
                background: rgba(231,76,60,0.12); color: #c0392b;
                border: 1px solid rgba(231,76,60,0.25);
            }
            .cr-btn-reset:hover { background: rgba(231,76,60,0.22); filter: brightness(1); }
            .cr-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; filter: none; }

            /* ── Export card ──────────────────────────────────────────────── */
            .cr-export-row {
                display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center;
            }
            .cr-btn-copy {
                padding: 7px 12px; background: #2a6049; color: #5de8a8;
                border: 1px solid rgba(93,232,168,0.25); border-radius: 5px;
                font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer;
                transition: background 0.15s, filter 0.15s;
                white-space: nowrap; display: flex; align-items: center; gap: 5px;
            }
            .cr-btn-copy:hover { background: #2e6e52; filter: brightness(1.15); }
            .cr-btn-copy.copied { background: #1a4a35; color: #3dcc8a; }

            /* ── Spinner ──────────────────────────────────────────────────── */
            .cr-spin {
                display: inline-block; width: 10px; height: 10px;
                border: 2px solid rgba(244,117,33,0.2); border-top-color: #f47521;
                border-radius: 50%; animation: cr-spin 0.7s linear infinite; flex-shrink: 0;
            }
        `;
    }

    // ── Inner body HTML (stats, status, filter cards, footer) ──────────────
    function bodyHTML(showBadges) {
        var chk = showBadges ? 'checked' : '';
        return [
            // Custom header
            '<div class="cr-head">',
            '<div class="cr-head-logo">⚙</div>',
            '<div class="cr-head-text">',
            '<h2>Advanced Filter</h2>',
            '<p>Crunchyroll Browse Enhancer · v4.5</p>',
            '</div>',
            '<button class="cr-head-close" id="cr-close">✕</button>',
            '</div>',

            // Stats
            '<div class="cr-stats">',
            '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-vis">—</span><span class="cr-stat-l">Sichtbar</span></div>',
            '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-tot">—</span><span class="cr-stat-l">Gesamt</span></div>',
            '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-dat">—</span><span class="cr-stat-l">Mit Daten</span></div>',
            '</div>',

            // Progress + status
            '<div class="cr-prog-wrap" id="cr-prog"><div class="cr-prog-fill" id="cr-prog-fill"></div></div>',
            '<div class="cr-status" id="cr-status">Bereit — klicke Scannen um zu starten</div>',

            // Body wrapper
            '<div class="cr-body-inner">',

            // SEARCH
            '<div class="cr-card">',
            '<div class="cr-card-head"><span class="cr-icon">🔍</span>Suche</div>',
            '<div class="cr-card-body">',
            '<div class="cr-field"><span class="cr-field-label">Titel</span><div class="cr-field-ctrl"><input type="text" class="cr-in" id="cr-f-title" placeholder="Stichwort im Titel…"></div></div>',
            '<div class="cr-field"><span class="cr-field-label">Beschreibung</span><div class="cr-field-ctrl"><input type="text" class="cr-in" id="cr-f-desc" placeholder="Stichwort in Beschreibung…"></div></div>',
            '</div></div>',

            // RATING
            '<div class="cr-card">',
            '<div class="cr-card-head"><span class="cr-icon">⭐</span>Bewertung &amp; Popularität</div>',
            '<div class="cr-card-body">',
            '<div class="cr-field"><span class="cr-field-label">Bewertung</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-r-min" min="0" max="5" step="0.1" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-r-max" min="0" max="5" step="0.1" placeholder="Max"></div></div>',
            '<div class="cr-field"><span class="cr-field-label">Min. Stimmen</span><div class="cr-field-ctrl"><input type="number" class="cr-in" id="cr-f-v-min" min="0" placeholder="z. B. 500"></div></div>',
            '</div></div>',

            // SCOPE
            '<div class="cr-card">',
            '<div class="cr-card-head"><span class="cr-icon">📺</span>Umfang</div>',
            '<div class="cr-card-body">',
            '<div class="cr-field"><span class="cr-field-label">Episoden</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-ep-min" min="0" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-ep-max" min="0" placeholder="Max"></div></div>',
            '<div class="cr-field"><span class="cr-field-label">Staffeln</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-se-min" min="0" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-se-max" min="0" placeholder="Max"></div></div>',
            '</div></div>',

            // AVAILABILITY
            '<div class="cr-card">',
            '<div class="cr-card-head"><span class="cr-icon">🌐</span>Verfügbarkeit</div>',
            '<div class="cr-card-body">',
            '<div class="cr-field"><span class="cr-field-label">Sprache</span><div class="cr-toggles" id="cr-lang-group"><label class="cr-toggle-lbl" id="lbl-sub"><input type="checkbox" id="cr-f-sub"> 🎌 Untertitel</label><label class="cr-toggle-lbl" id="lbl-dub"><input type="checkbox" id="cr-f-dub"> 🔊 Synchronisation</label></div></div>',
            '<div class="cr-field"><span class="cr-field-label">Watchlist</span><div class="cr-wl-group"><label class="cr-wl-lbl checked" id="lbl-wl-all"><input type="radio" name="cr-wl" value="all" checked> Alle</label><label class="cr-wl-lbl" id="lbl-wl-yes"><input type="radio" name="cr-wl" value="yes"> ✅ Ja</label><label class="cr-wl-lbl" id="lbl-wl-no"><input type="radio" name="cr-wl" value="no"> ❌ Nein</label></div></div>',
            '</div></div>',

            // SORTING
            '<div class="cr-card">',
            '<div class="cr-card-head"><span class="cr-icon">🔀</span>Sortierung <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— bis zu 3 Ebenen</span></div>',
            '<div class="cr-card-body">',
            '<div class="cr-sort-level"><span class="cr-sort-num">1</span><select class="cr-sel" id="cr-s-1">' + sortOpts('— Standard —') + '</select></div>',
            '<div class="cr-sort-level"><span class="cr-sort-num">2</span><select class="cr-sel" id="cr-s-2">' + sortOpts('— Keine —') + '</select></div>',
            '<div class="cr-sort-level"><span class="cr-sort-num">3</span><select class="cr-sel" id="cr-s-3">' + sortOpts('— Keine —') + '</select></div>',
            '</div></div>',

            // DISPLAY
            '<div class="cr-card">',
            '<div class="cr-card-head"><span class="cr-icon">🏷</span>Anzeige</div>',
            '<div class="cr-card-body">',
            '<label class="cr-toggle-lbl' + (showBadges ? ' checked' : '') + '" id="lbl-badges" style="width:fit-content;"><input type="checkbox" id="cr-opt-badges" ' + chk + '> Badges auf Karten anzeigen</label>',
            '<label class="cr-toggle-lbl" id="lbl-data-only" style="width:fit-content;"><input type="checkbox" id="cr-opt-data"> Nur Karten mit gescannten Daten</label>',
            '</div></div>',

            // EXPORT
            '<div class="cr-card">',
            '<div class="cr-card-head"><span class="cr-icon">📋</span>Export <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— sichtbare Titel</span></div>',
            '<div class="cr-card-body">',
            '<div class="cr-export-row">',
            '<select class="cr-sel" id="cr-export-fmt"><option value="numbered">1. Nummerierte Liste</option><option value="bullets">• Aufzählung</option><option value="csv">CSV (alle Daten)</option><option value="json">JSON (alle Daten)</option><option value="links">Links (URLs)</option><option value="markdown">Markdown Tabelle</option></select>',
            '<button class="cr-btn-copy" id="cr-btn-copy">📋 Kopieren</button>',
            '</div></div></div>',

            // Close body-inner

            // Footer
            '<div class="cr-foot">',
            '<div class="cr-btn-row">',
            '<button class="cr-btn cr-btn-scan" id="cr-btn-scan"><span>🔄</span> Scannen</button>',
            '<button class="cr-btn cr-btn-apply" id="cr-btn-apply"><span>✨</span> Anwenden</button>',
            '</div>',
            '<button class="cr-btn cr-btn-reset" id="cr-btn-reset">↺ Alle Filter zurücksetzen</button>',
            '</div>'
        ].join('');
    }

    function sortOpts(empty) {
        return [
            '<option value="">' + empty + '</option>',
            '<option value="rating-desc">⭐ Bewertung — hoch &darr; niedrig</option>',
            '<option value="rating-asc">⭐ Bewertung — niedrig &rarr; hoch</option>',
            '<option value="votes-desc">👥 Stimmen — viele &rarr; wenige</option>',
            '<option value="votes-asc">👥 Stimmen — wenige &rarr; viele</option>',
            '<option value="episodes-desc">📺 Episoden — viele &rarr; wenige</option>',
            '<option value="episodes-asc">📺 Episoden — wenige &rarr; viele</option>',
            '<option value="seasons-desc">📦 Staffeln — viele &rarr; wenige</option>',
            '<option value="seasons-asc">📦 Staffeln — wenige &rarr; viele</option>',
            '<option value="title-asc">🔤 Titel — A &rarr; Z</option>',
            '<option value="title-desc">🔤 Titel — Z &rarr; A</option>'
        ].join('');
    }

    // ═════════════════════════════════════════════════════════════════════════
    class CrunchyrollEnhanced {
        constructor() {
            this.cards      = new Map();
            this.origOrder  = [];
            this.isScanning = false;
            this.isOpen     = GM_getValue('cr_sidebar_open', false);
            this.showBadges = GM_getValue('cr_show_badges', true);

            this._debounceApply = TM.dom.debounce(function () {
                this._saveFilters();
                this._apply();
            }.bind(this), 280);

            this._waitForCards().then(function () {
                this._buildUI();
                setTimeout(function () { this._scan(); }.bind(this), 1200);
            }.bind(this));
        }

        // ── Bootstrap ─────────────────────────────────────────────────────

        _waitForCards() {
            return TM.dom.waitForElement('.browse-card', 0)
                .catch(function () {});
        }

        async _buildUI() {
            this.sidebar = TM.ui.createSidebar({
                width: SW,
                title: 'Filter',
                accentColor: '#F47521',
                onOpen: function () {
                    this.isOpen = true;
                    GM_setValue('cr_sidebar_open', true);
                }.bind(this),
                onClose: function () {
                    this.isOpen = false;
                    GM_setValue('cr_sidebar_open', false);
                }.bind(this)
            });

            // Inject shadow-DOM styles for the sidebar internals
            var style = document.createElement('style');
            style.textContent = sidebarStyles();
            this.sidebar.root.appendChild(style);

            // Hide the shared sidebar's default header — we build a custom one
            var sharedHdr = this.sidebar.root.querySelector('.header');
            if (sharedHdr) sharedHdr.style.display = 'none';

            // Append all inner content (stats, filter cards, footer, etc.)
            this.sidebar.bodyEl.innerHTML = bodyHTML(this.showBadges);

            if (this.isOpen) this.sidebar.open();

            this._attachEvents();
            await this._loadSavedFilters();
        }

        // ── Helper: query element inside sidebar shadow root ───────────────

        _$(id) {
            return this.sidebar.root.querySelector('#' + CSS.escape(id));
        }

        // ── Events ─────────────────────────────────────────────────────────

        _attachEvents() {
            this._$('cr-close').addEventListener('click', function () { this._toggle(false); }.bind(this));

            this._$('cr-btn-scan').addEventListener('click',  function () { this._scan(); }.bind(this));
            this._$('cr-btn-apply').addEventListener('click', function () { this._apply(); }.bind(this));
            this._$('cr-btn-reset').addEventListener('click', function () { this._reset(); }.bind(this));

            // Checkbox / radio visual sync + auto-apply
            this._$('cr-f-sub').addEventListener('change', function (e) {
                this._$('lbl-sub').classList.toggle('checked', e.target.checked);
                this._debounceApply();
            }.bind(this));
            this._$('cr-f-dub').addEventListener('change', function (e) {
                this._$('lbl-dub').classList.toggle('checked', e.target.checked);
                this._debounceApply();
            }.bind(this));

            var wlRadios = this.sidebar.root.querySelectorAll('input[name="cr-wl"]');
            Array.from(wlRadios).forEach(function (r) {
                r.addEventListener('change', function () {
                    var labels = this.sidebar.root.querySelectorAll('.cr-wl-lbl');
                    Array.from(labels).forEach(function (l) { l.classList.remove('checked'); });
                    var v = this.sidebar.root.querySelector('input[name="cr-wl"]:checked');
                    v = v ? v.value : 'all';
                    var map = { all: 'lbl-wl-all', yes: 'lbl-wl-yes', no: 'lbl-wl-no' };
                    if (map[v]) this._$(map[v]).classList.add('checked');
                    this._debounceApply();
                }.bind(this));
            }.bind(this));

            this._$('cr-opt-badges').addEventListener('change', function (e) {
                this.showBadges = e.target.checked;
                this._$('lbl-badges').classList.toggle('checked', this.showBadges);
                GM_setValue('cr_show_badges', this.showBadges);
                this._updateBadgeVisibility();
            }.bind(this));

            this._$('cr-opt-data').addEventListener('change', function (e) {
                this._$('lbl-data-only').classList.toggle('checked', e.target.checked);
                this._debounceApply();
            }.bind(this));

            this._$('cr-btn-copy').addEventListener('click', function () { this._copyExport(); }.bind(this));

            // Auto-apply on input/change for text fields and selects
            var filterIds = [
                'cr-f-title', 'cr-f-desc',
                'cr-f-r-min', 'cr-f-r-max', 'cr-f-v-min',
                'cr-f-ep-min', 'cr-f-ep-max', 'cr-f-se-min', 'cr-f-se-max',
                'cr-s-1', 'cr-s-2', 'cr-s-3'
            ];
            filterIds.forEach(function (id) {
                var el = this._$(id);
                if (el) {
                    el.addEventListener('input',  function () { this._debounceApply(); }.bind(this));
                    el.addEventListener('change', function () { this._debounceApply(); }.bind(this));
                }
            }.bind(this));
        }

        _toggle(forceTo) {
            if (forceTo === true || (forceTo === undefined && !this.isOpen)) {
                this.sidebar.open();
            } else {
                this.sidebar.close();
            }
        }

        // ── Scanning ───────────────────────────────────────────────────────

        async _scan() {
            if (this.isScanning) return;
            this.isScanning = true;

            var btn = this._$('cr-btn-scan');
            btn.disabled = true;
            btn.innerHTML = '<span class="cr-spin"></span> Scannen…';
            this._status('Scanning cards…');
            this._$('cr-prog').style.display = 'block';

            this.cards.clear();
            this.origOrder = [];

            var all = Array.from(document.querySelectorAll('.browse-card'));

            // Force hover panels via CSS — JS mouseenter does not trigger CSS :hover,
            // so forcing the hover overlay visible is more reliable.
            var forceStyle = document.createElement('style');
            forceStyle.id = 'cr-force-hover';
            forceStyle.textContent = [
                '[class*="browse-card-hover"] {',
                'opacity: 1 !important; visibility: visible !important;',
                'display: block !important; transform: none !important;',
                'pointer-events: none !important;',
                '}'
            ].join('');
            document.head.appendChild(forceStyle);
            // Additional mouseenter for React state-based components
            all.forEach(function (c) { c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
            await this._sleep(600);

            for (var i = 0; i < all.length; i++) {
                var card = all[i];
                var info = this._extract(card, i);
                this.cards.set(card, info);
                this.origOrder.push(card);

                if (this.showBadges) this._addBadges(card, info);

                this._$('cr-prog-fill').style.width =
                    Math.round((i + 1) / all.length * 100) + '%';
                this._status('Scanned: ' + (i + 1) + ' / ' + all.length);

                if ((i + 1) % 30 === 0) await this._sleep(0);
            }

            // Remove forced hover CSS
            var fh = document.getElementById('cr-force-hover');
            if (fh) fh.remove();
            this._$('cr-prog').style.display = 'none';

            // ── Retry pass for cards without data ──────────────────────────
            var noData = Array.from(this.cards.entries())
                .filter(function (e) { return !e[1].hasData; })
                .map(function (e) { return e[0]; });

            if (noData.length > 0) {
                this._status('Retry: ' + noData.length + ' cards without data…');

                var retryStyle = document.createElement('style');
                retryStyle.id = 'cr-force-hover';
                retryStyle.textContent = [
                    '[class*="browse-card-hover"] {',
                    'opacity: 1 !important; visibility: visible !important;',
                    'display: block !important; transform: none !important;',
                    'pointer-events: none !important;',
                    '}'
                ].join('');
                document.head.appendChild(retryStyle);
                noData.forEach(function (c) { c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
                await this._sleep(1000);

                var improved = 0;
                noData.forEach(function (card) {
                    var old = this.cards.get(card);
                    var fresh = this._extract(card, old.index);
                    if (fresh.hasData) {
                        this.cards.set(card, fresh);
                        if (this.showBadges) this._addBadges(card, fresh);
                        improved++;
                    }
                }.bind(this));
                retryStyle.remove();
                this._status('Retry: +' + improved + ' of ' + noData.length + ' upgraded');
                log.log('Retry: ' + improved + '/' + noData.length + ' cards now have data');
            }

            var wd = this._withData();
            this._status('✅ ' + all.length + ' scanned, ' + wd + ' with real data');
            this._updateStats(all.length, all.length, wd);

            this.isScanning = false;
            btn.disabled = false;
            btn.innerHTML = '<span>🔄</span> Scannen';

            this._apply();
            this._startObserver();
        }

        _extract(card, index) {
            var titleEl = card.querySelector('h3[data-t="title"] a') ||
                          card.querySelector('[class*="browse-card__title"] a');
            var title = titleEl ? titleEl.textContent.trim() : '';
            var link  = titleEl ? titleEl.href : '';
            var seriesId = link.match(/series\/([A-Z0-9]+)/) ? link.match(/series\/([A-Z0-9]+)/)[1] : '';

            var descEl = card.querySelector('p[data-t="description"]');
            var description = descEl ? descEl.textContent.trim() : '';

            var ratingEl = card.querySelector('p[class*="star-rating-short-static__rating"]') ||
                           card.querySelector('[data-t="star-rating-short-static"] [class*="rating"]');
            var rating = ratingEl ? (parseFloat(ratingEl.textContent.trim()) || null) : null;

            var votesEl = card.querySelector('p[data-t="rating-count"]') ||
                          card.querySelector('[class*="votes-count"]') ||
                          card.querySelector('[class*="star-rating-short-static__votes"]');
            var votes = null;
            if (votesEl) {
                var m = votesEl.textContent.match(/([\d,.]+)\s*([kKmM]?)/);
                if (m) {
                    var n = parseFloat(m[1].replace(',', '.'));
                    var s = m[2].toLowerCase();
                    if (s === 'k') n *= 1000;
                    else if (s === 'm') n *= 1000000;
                    votes = Math.round(n);
                }
            }

            var metaEl = card.querySelector('[class*="browse-card-hover__series-meta"]');
            var seasons = null, episodes = null;
            if (metaEl) {
                metaEl.querySelectorAll('span').forEach(function (span) {
                    var t = span.textContent.trim();
                    var ep = t.match(/(\d+)\s*(?:Episode[ns]?|Folge[n]?)/i);
                    var se = t.match(/(\d+)\s*(?:Staffel[n]?|Season[s]?)/i);
                    if (ep) episodes = parseInt(ep[1], 10);
                    if (se) seasons  = parseInt(se[1], 10);
                });
            }

            var hasSub = false, hasDub = false;
            card.querySelectorAll('[class*="meta-tags"] span, [class*="meta-tag"] span').forEach(function (el) {
                var t = el.textContent.toLowerCase();
                if (t.indexOf('untertitel') !== -1 || t.indexOf('sub') !== -1) hasSub = true;
                if (t.indexOf('synchro') !== -1    || t.indexOf('dub') !== -1) hasDub = true;
            });

            var onWatchlist = !!card.querySelector(
                '[class*="card-watchlist-label"], [class*="watchlist-label"]'
            );

            var hasData = rating !== null || votes !== null ||
                          episodes !== null || seasons !== null;

            return { title: title, description: description, link: link,
                     seriesId: seriesId, rating: rating, votes: votes,
                     episodes: episodes, seasons: seasons,
                     hasSub: hasSub, hasDub: hasDub, onWatchlist: onWatchlist,
                     hasData: hasData, index: index };
        }

        // ── Badges ─────────────────────────────────────────────────────────

        _addBadges(card, info) {
            var existing = card.querySelector('.cr-overlay');
            if (existing) existing.remove();

            var anchor = card.querySelector('[class*="browse-card__poster"], [class*="content-image"]') || card;
            if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';

            var ov = document.createElement('div');
            ov.className = 'cr-overlay';

            if (info.rating   !== null) ov.appendChild(this._mkBadge('cr-b-rating',   '⭐ ' + info.rating.toFixed(1)));
            if (info.votes    !== null) ov.appendChild(this._mkBadge('cr-b-votes',    '👥 ' + this._fmt(info.votes)));
            if (info.seasons  !== null) ov.appendChild(this._mkBadge('cr-b-seasons',  '📦 ' + info.seasons + 'S'));
            if (info.episodes !== null) ov.appendChild(this._mkBadge('cr-b-episodes', '📺 ' + info.episodes + 'E'));
            if (info.hasSub)            ov.appendChild(this._mkBadge('cr-b-sub',  'SUB'));
            if (info.hasDub)            ov.appendChild(this._mkBadge('cr-b-dub',  'DUB'));
            if (info.onWatchlist)       ov.appendChild(this._mkBadge('cr-b-wl',   '📌'));

            anchor.appendChild(ov);
        }

        _mkBadge(cls, text) {
            var b = document.createElement('div');
            b.className = 'cr-badge ' + cls;
            b.textContent = text;
            return b;
        }

        _updateBadgeVisibility() {
            document.querySelectorAll('.cr-overlay').forEach(function (el) {
                el.style.display = this.showBadges ? '' : 'none';
            }.bind(this));
        }

        // ── Filter + Sort ───────────────────────────────────────────────────

        _getFilters() {
            var $ = this._$.bind(this);
            function num(id) { var v = parseFloat($(id) ? $(id).value : ''); return isNaN(v) ? null : v; }
            function int(id) { var v = parseInt($(id) ? $(id).value : '', 10); return isNaN(v) ? null : v; }
            function str(id) { var el = $(id); return el ? el.value.trim().toLowerCase() : ''; }
            function chk(id) { var el = $(id); return el ? el.checked : false; }
            var wlEl = this.sidebar.root.querySelector('input[name="cr-wl"]:checked');
            var wl = wlEl ? wlEl.value : 'all';
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
                watchlist:  wl,
                dataOnly:   chk('cr-opt-data'),
                sort: ['cr-s-1', 'cr-s-2', 'cr-s-3']
                    .map(function (id) { var el = $(id); return el ? el.value : ''; })
                    .filter(Boolean)
            };
        }

        _passes(info, f) {
            if (f.title && info.title.toLowerCase().indexOf(f.title) === -1) return false;
            if (f.desc  && info.description.toLowerCase().indexOf(f.desc) === -1) return false;
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
            var parts = criterion.split('-');
            var field = parts[0], dir = parts[1];
            var mult = dir === 'desc' ? -1 : 1;
            function numCmp(va, vb) {
                if (va === null && vb === null) return 0;
                if (va === null) return 1;
                if (vb === null) return -1;
                return (va - vb) * mult;
            }
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

            var f         = this._getFilters();
            var container = this.origOrder[0] ? this.origOrder[0].parentElement : null;
            if (!container) return;

            var entries = Array.from(this.cards.entries());
            var all     = entries.map(function (e) { return { card: e[0], info: e[1] }; });
            var visible = all.filter(function (item) { return this._passes(item.info, f); }.bind(this));
            var hidden  = all.filter(function (item) { return !this._passes(item.info, f); }.bind(this));

            // Sort
            if (f.sort.length > 0) {
                visible.sort(function (a, b) {
                    for (var ci = 0; ci < f.sort.length; ci++) {
                        var r = this._cmp(a.info, b.info, f.sort[ci]);
                        if (r !== 0) return r;
                    }
                    return a.info.index - b.info.index;
                }.bind(this));
            } else {
                visible.sort(function (a, b) { return a.info.index - b.info.index; });
            }

            visible.forEach(function (item) {
                item.card.classList.remove('cr-hidden');
                container.appendChild(item.card);
            });
            hidden.forEach(function (item) {
                item.card.classList.add('cr-hidden');
                container.appendChild(item.card);
            });

            this._updateStats(visible.length, this.cards.size, this._withData());
            setTimeout(function () { this._observerPaused = false; }.bind(this), 500);
        }

        _reset() {
            var ids = [
                'cr-f-title', 'cr-f-desc',
                'cr-f-r-min', 'cr-f-r-max', 'cr-f-v-min',
                'cr-f-ep-min', 'cr-f-ep-max', 'cr-f-se-min', 'cr-f-se-max',
                'cr-s-1', 'cr-s-2', 'cr-s-3'
            ];
            ids.forEach(function (id) {
                var el = this._$(id);
                if (el) el.value = '';
            }.bind(this));

            // Reset checkboxes
            ['cr-f-sub', 'cr-f-dub'].forEach(function (id) {
                this._$(id).checked = false;
            }.bind(this));
            this._$('lbl-sub').classList.remove('checked');
            this._$('lbl-dub').classList.remove('checked');
            this._$('cr-opt-data').checked = false;
            this._$('lbl-data-only').classList.remove('checked');

            // Reset watchlist radios
            var allRadio = this.sidebar.root.querySelector('input[name="cr-wl"][value="all"]');
            if (allRadio) allRadio.checked = true;
            var wlLabels = this.sidebar.root.querySelectorAll('.cr-wl-lbl');
            Array.from(wlLabels).forEach(function (l) { l.classList.remove('checked'); });
            this._$('lbl-wl-all').classList.add('checked');

            // Restore original DOM order
            var container = this.origOrder[0] ? this.origOrder[0].parentElement : null;
            if (container) {
                this.origOrder.forEach(function (card) {
                    card.classList.remove('cr-hidden');
                    container.appendChild(card);
                });
            }

            this._updateStats(this.cards.size, this.cards.size, this._withData());
            // Persist empty filters
            this._saveFilters();
        }

        // ── Helpers ─────────────────────────────────────────────────────────

        _status(msg) {
            var el = this._$('cr-status');
            if (el) el.textContent = msg;
        }

        _updateStats(visible, total, withData) {
            var vis = this._$('cr-s-vis');
            var tot = this._$('cr-s-tot');
            var dat = this._$('cr-s-dat');
            if (vis) vis.textContent = String(visible);
            if (tot) tot.textContent = String(total);
            if (dat) dat.textContent = String(withData);
        }

        // ── MutationObserver ────────────────────────────────────────────────

        _startObserver() {
            var target = this.origOrder[0] ? this.origOrder[0].parentElement : null;
            if (!target) return;

            if (this._observer) {
                this._observer.disconnect();
                this._observer = null;
            }
            this._observerPaused = false;
            this._observerTimer = null;

            this._observer = new MutationObserver(function (mutations) {
                if (this._observerPaused || this.isScanning) return;

                var newCards = [];
                mutations.forEach(function (m) {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType !== 1) return;
                        if (node.parentElement !== target) return;
                        if (node.classList && node.classList.contains('browse-card') && !this.cards.has(node)) {
                            newCards.push(node);
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll('.browse-card').forEach(function (c) {
                                if (!this.cards.has(c)) newCards.push(c);
                            }.bind(this));
                        }
                    }.bind(this));
                }.bind(this));

                if (newCards.length === 0) return;

                clearTimeout(this._observerTimer);
                this._observerTimer = setTimeout(function () {
                    var ready = newCards.filter(function (c) {
                        var t = c.querySelector('h3[data-t="title"] a, [class*="browse-card__title"] a');
                        return t && t.textContent.trim() !== '';
                    });
                    if (ready.length > 0) this._ingestNewCards(ready);
                }.bind(this), 400);
            }.bind(this));

            this._observer.observe(target, { childList: true, subtree: true });
        }

        async _ingestNewCards(cards) {
            cards.forEach(function (c) { c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
            await this._sleep(700);

            var added = 0;
            cards.forEach(function (card) {
                if (this.cards.has(card)) return;
                var info = this._extract(card, this.origOrder.length);
                this.cards.set(card, info);
                this.origOrder.push(card);
                if (this.showBadges) this._addBadges(card, info);
                card.classList.add('cr-new-card');
                added++;
            }.bind(this));

            if (added > 0) {
                this._status('+' + added + ' new cards detected');
                var visCount = Array.from(this.cards.keys())
                    .filter(function (c) { return !c.classList.contains('cr-hidden'); }).length;
                this._updateStats(visCount, this.cards.size, this._withData());
                this._apply();
            }
        }

        // ── Clipboard export ────────────────────────────────────────────────

        _copyExport() {
            var fmt = this._$('cr-export-fmt').value;
            var btn = this._$('cr-btn-copy');
            var items = Array.from(this.cards.entries())
                .filter(function (e) { return !e[0].classList.contains('cr-hidden'); })
                .map(function (e) { return e[1]; });

            if (items.length === 0) {
                btn.textContent = '⚠ Keine Titel';
                setTimeout(function () { btn.innerHTML = '📋 Kopieren'; }, 1500);
                return;
            }

            var text = '';

            if (fmt === 'numbered') {
                text = items.map(function (info, i) { return (i + 1) + '. ' + info.title; }).join('\n');

            } else if (fmt === 'bullets') {
                text = items.map(function (info) { return '• ' + info.title; }).join('\n');

            } else if (fmt === 'links') {
                text = items.map(function (info) { return info.link || info.title; }).join('\n');

            } else if (fmt === 'csv') {
                function esc(v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }
                var header = ['Titel','Bewertung','Stimmen','Episoden','Staffeln','Sub','Dub','Watchlist','Link'];
                var rows = items.map(function (i) {
                    return [
                        esc(i.title), esc(i.rating !== null ? i.rating : ''), esc(i.votes !== null ? i.votes : ''),
                        esc(i.episodes !== null ? i.episodes : ''), esc(i.seasons !== null ? i.seasons : ''),
                        esc(i.hasSub ? 'Ja' : 'Nein'), esc(i.hasDub ? 'Ja' : 'Nein'),
                        esc(i.onWatchlist ? 'Ja' : 'Nein'), esc(i.link)
                    ].join(',');
                });
                text = [header.join(','), rows.join('\n')].join('\n');

            } else if (fmt === 'json') {
                text = JSON.stringify(items.map(function (i) {
                    return {
                        title: i.title, rating: i.rating, votes: i.votes,
                        episodes: i.episodes, seasons: i.seasons,
                        sub: i.hasSub, dub: i.hasDub, onWatchlist: i.onWatchlist, link: i.link
                    };
                }), null, 2);

            } else if (fmt === 'markdown') {
                function row(cells) { return '| ' + cells.join(' | ') + ' |'; }
                var mdHeader = row(['#', 'Titel', '⭐', '👥', '📺 Ep.', '📦 St.', 'Sub', 'Dub']);
                var sep = row(['---', '---', '---', '---', '---', '---', '---', '---']);
                var mdRows = items.map(function (info, idx) {
                    return row([
                        String(idx + 1),
                        info.title,
                        info.rating !== null ? info.rating.toFixed(1) : '—',
                        info.votes  !== null ? this._fmt(info.votes)  : '—',
                        info.episodes !== null ? String(info.episodes) : '—',
                        info.seasons  !== null ? String(info.seasons)  : '—',
                        info.hasSub ? '✓' : '',
                        info.hasDub ? '✓' : ''
                    ]);
                }.bind(this));
                text = [mdHeader, sep].concat(mdRows).join('\n');
            }

            navigator.clipboard.writeText(text).then(function () {
                btn.classList.add('copied');
                btn.innerHTML = '✅ ' + items.length + ' kopiert';
                setTimeout(function () {
                    btn.classList.remove('copied');
                    btn.innerHTML = '📋 Kopieren';
                }, 1800);
            }.bind(this)).catch(function () {
                btn.textContent = '⚠ Fehler';
                setTimeout(function () { btn.innerHTML = '📋 Kopieren'; }, 1500);
            });
        }

        _withData() {
            return Array.from(this.cards.values()).filter(function (i) { return i.hasData; }).length;
        }

        _fmt(n) {
            if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
            return String(n);
        }

        _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

        // ── Persistence (async via TM.storage) ──────────────────────────────

        async _saveFilters() {
            try {
                await TM.storage.saveSetting('crunchyroll_advanced_filters', this._getFilters());
            } catch (e) {
                log.warn('Failed to save filters', e);
            }
        }

        async _loadSavedFilters() {
            try {
                var s = await TM.storage.loadSetting('crunchyroll_advanced_filters', {});
                // Handle legacy string-encoded data from old GM_setValue
                if (typeof s === 'string') {
                    try { s = JSON.parse(s); } catch (e) { s = {}; }
                }
                if (!s || typeof s !== 'object') s = {};

                var $ = this._$.bind(this);
                function set(id, val) {
                    if (val == null || val === '') return;
                    var el = $(id);
                    if (el) el.value = String(val);
                }
                set('cr-f-title',  s.title);
                set('cr-f-desc',   s.desc);
                set('cr-f-r-min',  s.ratingMin);
                set('cr-f-r-max',  s.ratingMax);
                set('cr-f-v-min',  s.votesMin);
                set('cr-f-ep-min', s.epMin);
                set('cr-f-ep-max', s.epMax);
                set('cr-f-se-min', s.seasonsMin);
                set('cr-f-se-max', s.seasonsMax);
                set('cr-s-1', s.sort ? s.sort[0] : null);
                set('cr-s-2', s.sort ? s.sort[1] : null);
                set('cr-s-3', s.sort ? s.sort[2] : null);

                if (s.dataOnly) {
                    var doEl = $('cr-opt-data');
                    if (doEl) doEl.checked = true;
                    var doLbl = $('lbl-data-only');
                    if (doLbl) doLbl.classList.add('checked');
                }
                if (s.subOnly) {
                    var subEl = $('cr-f-sub');
                    if (subEl) subEl.checked = true;
                    var subLbl = $('lbl-sub');
                    if (subLbl) subLbl.classList.add('checked');
                }
                if (s.dubOnly) {
                    var dubEl = $('cr-f-dub');
                    if (dubEl) dubEl.checked = true;
                    var dubLbl = $('lbl-dub');
                    if (dubLbl) dubLbl.classList.add('checked');
                }
                if (s.watchlist && s.watchlist !== 'all') {
                    var r = this.sidebar.root.querySelector('input[name="cr-wl"][value="' + s.watchlist + '"]');
                    if (r) {
                        r.checked = true;
                        var wlLbls = this.sidebar.root.querySelectorAll('.cr-wl-lbl');
                        Array.from(wlLbls).forEach(function (l) { l.classList.remove('checked'); });
                        var wlMap = { yes: 'lbl-wl-yes', no: 'lbl-wl-no' };
                        if (wlMap[s.watchlist]) {
                            var targetLbl = $(wlMap[s.watchlist]);
                            if (targetLbl) targetLbl.classList.add('checked');
                        }
                        var allLbl = $('lbl-wl-all');
                        if (allLbl) allLbl.classList.remove('checked');
                    }
                }
            } catch (e) {
                log.warn('Failed to load saved filters', e);
            }
        }
    }

    // ── PiP Unlock (SPA-safe: runs everywhere, no-op when no video exists) ────
    setInterval(function () {
        var v = document.querySelector('video[disablePictureInPicture]');
        if (v) v.removeAttribute('disablePictureInPicture');
    }, 1000);

    // ── Filter UI bootstrap (only on /videos/popular) ─────────────────────────
    if (/\/videos\/popular/.test(location.pathname))
        new CrunchyrollEnhanced();
})();

// src/crunchyroll-enhanced/ui-panel.js — Sidebar UI, events, persistence, reset
// Provides: buildSidebar, attachEvents, updateStatus, updateStats,
//           resetFilters, saveFilters, loadSavedFilters, sidebarStylesHTML, bodyHTML, sortOptsHTML
// Consumers: Crunchyroll Enhanced (entry orchestrator)
(function () {
  'use strict';

  var _CRE = globalThis.__CRE__ = globalThis.__CRE__ || {};

  /**
   * Returns CSS for the Shadow DOM sidebar styling.
   * @returns {string}
   */
  _CRE.sidebarStylesCSS = function sidebarStylesCSS() {
    return [
      '.body { padding: 0 !important; }',
      '.body::-webkit-scrollbar { width: 3px; }',
      '.body::-webkit-scrollbar-track { background: transparent; }',
      '.body::-webkit-scrollbar-thumb { background: rgba(244,117,33,0.4); border-radius: 2px; }',
      '.body::-webkit-scrollbar-thumb:hover { background: #f47521; }',

      // Custom header
      '.cr-head { position:sticky; top:0; z-index:10; flex-shrink:0; background:#0e0e1a; border-bottom:1px solid rgba(244,117,33,0.2); padding:14px 16px 12px; display:flex; align-items:center; gap:10px; }',
      '.cr-head-logo { width:28px; height:28px; background:#f47521; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }',
      '.cr-head-text { flex:1; min-width:0; }',
      '.cr-head-text h2 { margin:0; font-size:14px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
      '.cr-head-text p { margin:2px 0 0; font-size:10px; color:#5a5a80; }',
      '.cr-head-close { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#888; width:28px; height:28px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.15s,color 0.15s; }',
      '.cr-head-close:hover { background:rgba(231,76,60,0.2); color:#e74c3c; border-color:rgba(231,76,60,0.4); }',

      // Stats strip
      '.cr-stats { flex-shrink:0; display:grid; grid-template-columns:1fr 1fr 1fr; background:#0e0e1a; border-bottom:1px solid rgba(255,255,255,0.06); }',
      '.cr-stat { padding:10px 6px; text-align:center; border-right:1px solid rgba(255,255,255,0.05); }',
      '.cr-stat:last-child { border-right:none; }',
      '.cr-stat-n { display:block; font-size:20px; font-weight:700; color:#f47521; line-height:1; }',
      '.cr-stat-l { display:block; font-size:9px; color:#4a4a70; text-transform:uppercase; letter-spacing:0.5px; margin-top:3px; }',

      // Progress + status
      '.cr-prog-wrap { flex-shrink:0; height:2px; background:rgba(255,255,255,0.05); display:none; }',
      '.cr-prog-fill { height:100%; background:linear-gradient(90deg,#f47521,#ff9f5a); width:0%; transition:width 0.12s; }',
      '.cr-status { flex-shrink:0; font-size:10px; color:#4a4a70; padding:5px 16px; border-bottom:1px solid rgba(255,255,255,0.04); min-height:22px; display:flex; align-items:center; gap:6px; }',

      // Scrollable body inner
      '.cr-body-inner { padding:12px 12px 4px; display:flex; flex-direction:column; gap:8px; }',

      // Section cards
      '.cr-card { background:#1a1a2a; border:1px solid rgba(255,255,255,0.07); border-radius:8px; overflow:hidden; }',
      '.cr-card-head { display:flex; align-items:center; gap:7px; padding:8px 12px; background:rgba(244,117,33,0.06); border-bottom:1px solid rgba(244,117,33,0.12); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.9px; color:#f47521; }',
      '.cr-card-head .cr-icon { font-size:13px; opacity:0.9; }',
      '.cr-card-body { padding:11px 12px; display:flex; flex-direction:column; gap:8px; }',

      // Form rows
      '.cr-field { display:flex; align-items:center; gap:8px; }',
      '.cr-field-label { font-size:11px; color:#8888b0; min-width:80px; flex-shrink:0; }',
      '.cr-field-ctrl { flex:1; min-width:0; display:flex; align-items:center; gap:5px; }',
      '.cr-range { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:5px; flex:1; }',
      '.cr-range-sep { font-size:11px; color:#3a3a5a; text-align:center; flex-shrink:0; }',
      'input.cr-in, select.cr-sel { width:100%; padding:6px 8px; background:#0e0e1a; border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:#d8d8f0; font-size:11px; font-family:inherit; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; -webkit-appearance:none; appearance:none; }',
      'input.cr-in:focus, select.cr-sel:focus { outline:none; border-color:#f47521; box-shadow:0 0 0 2px rgba(244,117,33,0.15); }',
      'input.cr-in::placeholder { color:#2e2e4e; }',
      'select.cr-sel { background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%23666\'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; padding-right:24px; cursor:pointer; }',
      'select.cr-sel option { background:#12121e; color:#d8d8f0; }',
      '.cr-toggles { display:flex; flex-wrap:wrap; gap:6px; }',
      '.cr-toggle-lbl { display:flex; align-items:center; gap:5px; background:#0e0e1a; border:1px solid rgba(255,255,255,0.1); border-radius:5px; padding:5px 9px; font-size:11px; color:#8888b0; cursor:pointer; transition:border-color 0.15s,color 0.15s,background 0.15s; -webkit-user-select:none; user-select:none; }',
      '.cr-toggle-lbl:hover { border-color:rgba(244,117,33,0.4); color:#d8d8f0; }',
      '.cr-toggle-lbl input { display:none; }',
      '.cr-toggle-lbl.checked { background:rgba(244,117,33,0.12); border-color:rgba(244,117,33,0.5); color:#f47521; }',
      '.cr-wl-group { display:flex; gap:4px; }',
      '.cr-wl-lbl { flex:1; text-align:center; padding:5px 4px; background:#0e0e1a; border:1px solid rgba(255,255,255,0.08); border-radius:5px; font-size:10px; color:#666; cursor:pointer; transition:all 0.15s; -webkit-user-select:none; user-select:none; }',
      '.cr-wl-lbl:hover { border-color:rgba(244,117,33,0.3); color:#aaa; }',
      '.cr-wl-lbl.checked { background:rgba(244,117,33,0.12); border-color:rgba(244,117,33,0.5); color:#f47521; }',
      '.cr-wl-lbl input { display:none; }',
      '.cr-sort-level { display:grid; grid-template-columns:20px 1fr; align-items:center; gap:8px; }',
      '.cr-sort-num { font-size:10px; font-weight:700; color:#3a3a5a; text-align:center; }',

      // Footer
      '.cr-foot { flex-shrink:0; padding:10px 12px 12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:6px; background:#0e0e1a; }',
      '.cr-btn-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; }',
      '.cr-btn { padding:9px 12px; border:none; border-radius:6px; font-size:11px; font-weight:700; font-family:inherit; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:filter 0.15s,transform 0.1s; display:flex; align-items:center; justify-content:center; gap:5px; }',
      '.cr-btn:hover { filter:brightness(1.18); transform:translateY(-1px); }',
      '.cr-btn:active { transform:translateY(0); filter:brightness(0.9); }',
      '.cr-btn-scan { background:#2d6ca8; color:#fff; }',
      '.cr-btn-apply { background:#f47521; color:#fff; }',
      '.cr-btn-reset { background:rgba(231,76,60,0.12); color:#c0392b; border:1px solid rgba(231,76,60,0.25); }',
      '.cr-btn-reset:hover { background:rgba(231,76,60,0.22); filter:brightness(1); }',
      '.cr-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; filter:none; }',

      // Export card
      '.cr-export-row { display:grid; grid-template-columns:1fr auto; gap:6px; align-items:center; }',
      '.cr-btn-copy { padding:7px 12px; background:#2a6049; color:#5de8a8; border:1px solid rgba(93,232,168,0.25); border-radius:5px; font-size:11px; font-weight:700; font-family:inherit; cursor:pointer; transition:background 0.15s,filter 0.15s; white-space:nowrap; display:flex; align-items:center; gap:5px; }',
      '.cr-btn-copy:hover { background:#2e6e52; filter:brightness(1.15); }',
      '.cr-btn-copy.copied { background:#1a4a35; color:#3dcc8a; }',

      // Spinner
      '.cr-spin { display:inline-block; width:10px; height:10px; border:2px solid rgba(244,117,33,0.2); border-top-color:#f47521; border-radius:50%; animation:cr-spin 0.7s linear infinite; flex-shrink:0; }'
    ].join('\n');
  };

  /**
   * Generates the HTML for the sidebar's inner body.
   * @param {boolean} showBadges
   * @returns {string}
   */
  _CRE.bodyHTML = function bodyHTML(showBadges) {
    var chk = showBadges ? 'checked' : '';
    return [
      '<div class="cr-head">',
      '<div class="cr-head-logo">⚙</div>',
      '<div class="cr-head-text"><h2>Advanced Filter</h2><p>Crunchyroll Browse Enhancer · v4.6</p></div>',
      '<button class="cr-head-close" id="cr-close">✕</button>',
      '</div>',

      '<div class="cr-stats">',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-vis">—</span><span class="cr-stat-l">Sichtbar</span></div>',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-tot">—</span><span class="cr-stat-l">Gesamt</span></div>',
      '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-dat">—</span><span class="cr-stat-l">Mit Daten</span></div>',
      '</div>',

      '<div class="cr-prog-wrap" id="cr-prog"><div class="cr-prog-fill" id="cr-prog-fill"></div></div>',
      '<div class="cr-status" id="cr-status">Bereit — klicke Scannen um zu starten</div>',

      '<div class="cr-body-inner">',

      // Search
      '<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🔍</span>Suche</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Titel</span><div class="cr-field-ctrl"><input type="text" class="cr-in" id="cr-f-title" placeholder="Stichwort im Titel…"></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Beschreibung</span><div class="cr-field-ctrl"><input type="text" class="cr-in" id="cr-f-desc" placeholder="Stichwort in Beschreibung…"></div></div>',
      '</div></div>',

      // Rating
      '<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">⭐</span>Bewertung &amp; Popularität</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Bewertung</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-r-min" min="0" max="5" step="0.1" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-r-max" min="0" max="5" step="0.1" placeholder="Max"></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Min. Stimmen</span><div class="cr-field-ctrl"><input type="number" class="cr-in" id="cr-f-v-min" min="0" placeholder="z. B. 500"></div></div>',
      '</div></div>',

      // Scope
      '<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">📺</span>Umfang</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Episoden</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-ep-min" min="0" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-ep-max" min="0" placeholder="Max"></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Staffeln</span><div class="cr-range"><input type="number" class="cr-in" id="cr-f-se-min" min="0" placeholder="Min"><span class="cr-range-sep">–</span><input type="number" class="cr-in" id="cr-f-se-max" min="0" placeholder="Max"></div></div>',
      '</div></div>',

      // Availability
      '<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🌐</span>Verfügbarkeit</div><div class="cr-card-body">',
      '<div class="cr-field"><span class="cr-field-label">Sprache</span><div class="cr-toggles" id="cr-lang-group"><label class="cr-toggle-lbl" id="lbl-sub"><input type="checkbox" id="cr-f-sub"> 🎌 Untertitel</label><label class="cr-toggle-lbl" id="lbl-dub"><input type="checkbox" id="cr-f-dub"> 🔊 Synchronisation</label></div></div>',
      '<div class="cr-field"><span class="cr-field-label">Watchlist</span><div class="cr-wl-group"><label class="cr-wl-lbl checked" id="lbl-wl-all"><input type="radio" name="cr-wl" value="all" checked> Alle</label><label class="cr-wl-lbl" id="lbl-wl-yes"><input type="radio" name="cr-wl" value="yes"> ✅ Ja</label><label class="cr-wl-lbl" id="lbl-wl-no"><input type="radio" name="cr-wl" value="no"> ❌ Nein</label></div></div>',
      '</div></div>',

      // Sorting
      '<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🔀</span>Sortierung <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— bis zu 3 Ebenen</span></div><div class="cr-card-body">',
      '<div class="cr-sort-level"><span class="cr-sort-num">1</span><select class="cr-sel" id="cr-s-1">' + _CRE.sortOptsHTML('— Standard —') + '</select></div>',
      '<div class="cr-sort-level"><span class="cr-sort-num">2</span><select class="cr-sel" id="cr-s-2">' + _CRE.sortOptsHTML('— Keine —') + '</select></div>',
      '<div class="cr-sort-level"><span class="cr-sort-num">3</span><select class="cr-sel" id="cr-s-3">' + _CRE.sortOptsHTML('— Keine —') + '</select></div>',
      '</div></div>',

      // Display
      '<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">🏷</span>Anzeige</div><div class="cr-card-body">',
      '<label class="cr-toggle-lbl' + (showBadges ? ' checked' : '') + '" id="lbl-badges" style="width:fit-content;"><input type="checkbox" id="cr-opt-badges" ' + chk + '> Badges auf Karten anzeigen</label>',
      '<label class="cr-toggle-lbl" id="lbl-data-only" style="width:fit-content;"><input type="checkbox" id="cr-opt-data"> Nur Karten mit gescannten Daten</label>',
      '</div></div>',

      // Export
      '<div class="cr-card"><div class="cr-card-head"><span class="cr-icon">📋</span>Export <span style="font-size:9px;color:#5a5a80;font-weight:400;text-transform:none;letter-spacing:0;">— sichtbare Titel</span></div><div class="cr-card-body">',
      '<div class="cr-export-row">',
      '<select class="cr-sel" id="cr-export-fmt"><option value="numbered">1. Nummerierte Liste</option><option value="bullets">• Aufzählung</option><option value="csv">CSV (alle Daten)</option><option value="json">JSON (alle Daten)</option><option value="links">Links (URLs)</option><option value="markdown">Markdown Tabelle</option></select>',
      '<button class="cr-btn-copy" id="cr-btn-copy">📋 Kopieren</button>',
      '</div></div></div>',

      // Footer
      '<div class="cr-foot">',
      '<div class="cr-btn-row">',
      '<button class="cr-btn cr-btn-scan" id="cr-btn-scan"><span>🔄</span> Scannen</button>',
      '<button class="cr-btn cr-btn-apply" id="cr-btn-apply"><span>✨</span> Anwenden</button>',
      '</div>',
      '<button class="cr-btn cr-btn-reset" id="cr-btn-reset">↺ Alle Filter zurücksetzen</button>',
      '</div>'
    ].join('');
  };

  /**
   * Returns the HTML options for a sort dropdown.
   * @param {string} empty - Text for the empty/default option
   * @returns {string}
   */
  _CRE.sortOptsHTML = function sortOptsHTML(empty) {
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
  };

  /**
   * Builds the sidebar UI and appends all inner content.
   * @param {object} ctx - Class instance
   * @param {number} sidebarWidth - Sidebar width in px
   */
  _CRE.buildSidebar = function buildSidebar(ctx, sidebarWidth) {
    ctx.sidebar = TM.ui.createSidebar({
      width: sidebarWidth,
      title: 'Filter',
      accentColor: '#F47521',
      onOpen: async function () {
        ctx.isOpen = true;
        await GM.setValue('cr_sidebar_open', true);
      },
      onClose: async function () {
        ctx.isOpen = false;
        await GM.setValue('cr_sidebar_open', false);
      }
    });

    // Inject shadow-DOM styles
    var style = document.createElement('style');
    style.textContent = _CRE.sidebarStylesCSS();
    ctx.sidebar.root.appendChild(style);

    // Hide shared default header
    var sharedHdr = ctx.sidebar.root.querySelector('.header');
    if (sharedHdr) sharedHdr.style.display = 'none';

    // Set body HTML
    ctx.sidebar.bodyEl.innerHTML = _CRE.bodyHTML(ctx.showBadges);

    if (ctx.isOpen) ctx.sidebar.open();
  };

  /**
   * Wires up all event listeners on sidebar controls.
   * @param {object} ctx - Class instance
   */
  _CRE.attachEvents = function attachEvents(ctx) {
    ctx._$('cr-close').addEventListener('click', function () { ctx._toggle(false); });

    ctx._$('cr-btn-scan').addEventListener('click',  function () { ctx._scan(); });
    ctx._$('cr-btn-apply').addEventListener('click', function () { ctx._apply(); });
    ctx._$('cr-btn-reset').addEventListener('click', function () { ctx._reset(); });

    // Checkbox / radio visual sync + auto-apply
    ctx._$('cr-f-sub').addEventListener('change', function (e) {
      ctx._$('lbl-sub').classList.toggle('checked', e.target.checked);
      ctx._debounceApply();
    });
    ctx._$('cr-f-dub').addEventListener('change', function (e) {
      ctx._$('lbl-dub').classList.toggle('checked', e.target.checked);
      ctx._debounceApply();
    });

    var wlRadios = ctx.sidebar.root.querySelectorAll('input[name="cr-wl"]');
    Array.from(wlRadios).forEach(function (r) {
      r.addEventListener('change', function () {
        var labels = ctx.sidebar.root.querySelectorAll('.cr-wl-lbl');
        Array.from(labels).forEach(function (l) { l.classList.remove('checked'); });
        var v = ctx.sidebar.root.querySelector('input[name="cr-wl"]:checked');
        v = v ? v.value : 'all';
        var map = { all: 'lbl-wl-all', yes: 'lbl-wl-yes', no: 'lbl-wl-no' };
        if (map[v]) ctx._$(map[v]).classList.add('checked');
        ctx._debounceApply();
      });
    });

    ctx._$('cr-opt-badges').addEventListener('change', async function (e) {
      ctx.showBadges = e.target.checked;
      ctx._$('lbl-badges').classList.toggle('checked', ctx.showBadges);
      await GM.setValue('cr_show_badges', ctx.showBadges);
      _CRE.updateBadgeVisibility(ctx.showBadges);
    });

    ctx._$('cr-opt-data').addEventListener('change', function (e) {
      ctx._$('lbl-data-only').classList.toggle('checked', e.target.checked);
      ctx._debounceApply();
    });

    ctx._$('cr-btn-copy').addEventListener('click', function () { _CRE.exportVisible(ctx); });

    // Auto-apply on input/change for text fields and selects
    var filterIds = [
      'cr-f-title', 'cr-f-desc',
      'cr-f-r-min', 'cr-f-r-max', 'cr-f-v-min',
      'cr-f-ep-min', 'cr-f-ep-max', 'cr-f-se-min', 'cr-f-se-max',
      'cr-s-1', 'cr-s-2', 'cr-s-3'
    ];
    filterIds.forEach(function (id) {
      var el = ctx._$(id);
      if (el) {
        el.addEventListener('input',  function () { ctx._debounceApply(); });
        el.addEventListener('change', function () { ctx._debounceApply(); });
      }
    });
  };

  /**
   * Toggles sidebar open/closed.
   * @param {object} ctx - Class instance
   * @param {boolean|undefined} forceTo - Force open (true) or close (false)
   */
  _CRE.toggle = function toggle(ctx, forceTo) {
    if (forceTo === true || (forceTo === undefined && !ctx.isOpen)) {
      ctx.sidebar.open();
    } else {
      ctx.sidebar.close();
    }
  };

  /**
   * Updates the status text in the sidebar.
   * @param {object} ctx - Class instance
   * @param {string} msg
   */
  _CRE.updateStatus = function updateStatus(ctx, msg) {
    var el = ctx._$('cr-status');
    if (el) el.textContent = msg;
  };

  /**
   * Updates the stats display.
   * @param {object} ctx - Class instance
   * @param {number} visible - Visible card count
   * @param {number} total - Total card count
   * @param {number} withData - Cards with data count
   */
  _CRE.updateStats = function updateStats(ctx, visible, total, withData) {
    var vis = ctx._$('cr-s-vis');
    var tot = ctx._$('cr-s-tot');
    var dat = ctx._$('cr-s-dat');
    if (vis) vis.textContent = String(visible);
    if (tot) tot.textContent = String(total);
    if (dat) dat.textContent = String(withData);
  };

  /**
   * Resets all filter controls to their default values.
   * @param {object} ctx - Class instance
   */
  _CRE.resetFilters = function resetFilters(ctx) {
    var ids = [
      'cr-f-title', 'cr-f-desc',
      'cr-f-r-min', 'cr-f-r-max', 'cr-f-v-min',
      'cr-f-ep-min', 'cr-f-ep-max', 'cr-f-se-min', 'cr-f-se-max',
      'cr-s-1', 'cr-s-2', 'cr-s-3'
    ];
    ids.forEach(function (id) {
      var el = ctx._$(id);
      if (el) el.value = '';
    });

    ['cr-f-sub', 'cr-f-dub'].forEach(function (id) {
      ctx._$(id).checked = false;
    });
    ctx._$('lbl-sub').classList.remove('checked');
    ctx._$('lbl-dub').classList.remove('checked');
    ctx._$('cr-opt-data').checked = false;
    ctx._$('lbl-data-only').classList.remove('checked');

    var allRadio = ctx.sidebar.root.querySelector('input[name="cr-wl"][value="all"]');
    if (allRadio) allRadio.checked = true;
    var wlLabels = ctx.sidebar.root.querySelectorAll('.cr-wl-lbl');
    Array.from(wlLabels).forEach(function (l) { l.classList.remove('checked'); });
    ctx._$('lbl-wl-all').classList.add('checked');

    // Restore original DOM order
    var container = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
    if (container) {
      ctx.origOrder.forEach(function (card) {
        card.classList.remove('cr-hidden');
        container.appendChild(card);
      });
    }

    ctx._updateStats(ctx.cards.size, ctx.cards.size, window.__CRE__.withData(ctx.cards));
    ctx._saveFilters();
  };

  /**
   * Saves current filter state to storage (async).
   * @param {object} ctx - Class instance
   */
  _CRE.saveFilters = async function saveFilters(ctx) {
    try {
      await TM.storage.saveSetting('crunchyroll_advanced_filters', _CRE.getFilters(ctx._$, ctx.sidebar.root));
    } catch (e) {
      ctx.log.warn('Failed to save filters', e);
    }
  };

  /**
   * Loads saved filter state from storage and applies to DOM.
   * @param {object} ctx - Class instance
   */
  _CRE.loadSavedFilters = async function loadSavedFilters(ctx) {
    try {
      var s = await TM.storage.loadSetting('crunchyroll_advanced_filters', {});
      if (typeof s === 'string') {
        try { s = JSON.parse(s); } catch (e) { s = {}; }
      }
      if (!s || typeof s !== 'object') s = {};

      var $ = ctx._$;
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
        var r = ctx.sidebar.root.querySelector('input[name="cr-wl"][value="' + s.watchlist + '"]');
        if (r) {
          r.checked = true;
          var wlLbls = ctx.sidebar.root.querySelectorAll('.cr-wl-lbl');
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
      ctx.log.warn('Failed to load saved filters', e);
    }
  };
})();

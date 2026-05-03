# Tampermonkey Scripts — Übersicht

17 Userscripte von [marmoris-x/tampermonkey-scripts](https://github.com/marmoris-x/tampermonkey-scripts).
Alle sind standalone `.user.js`-Dateien, IIFE-gekapselt mit `'use strict'`.

## AniSearch Endless Scroll — v3.1.2

- **Datei:** `AniSearch Endless Scroll.user.js`
- **Matches:** https://www.anisearch.de/*, https://anisearch.de/*
- **Grants:** GM_setValue, GM_getValue, GM_xmlhttpRequest
- **Beschreibung:** Lädt ALLE Seiten automatisch nach und hängt Items lückenlos an — kein Limit, kein Scrapen-Fehler. Präziser Rating-Filter via title-Attribut.

```javascript
// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://anisearch.de/
// @version      3.1.2
// @description  Lädt ALLE Seiten automatisch nach und hängt Items lückenlos an — kein Limit, kein Scrapen-Fehler. Präziser Rating-Filter via title-Attribut.
// @author       UserScript
// @match        https://www.anisearch.de/*
// @match        https://anisearch.de/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      anisearch.de
// @icon         https://www.google.com/s2/favicons?sz=64&domain=anisearch.de
// @connect      www.anisearch.de
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/AniSearch%20Endless%20Scroll.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/AniSearch%20Endless%20Scroll.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ════════════════════════════════════════════════
  // CONFIG
  // ════════════════════════════════════════════════

  const STORAGE_KEY_RATING = 'anisearch_rating_min';
  const STATUS_BAR_ID      = 'as-es-statusbar';
  const FETCH_DELAY_MS     = 800;   // Basis-Pause zwischen Seiten-Requests (+ bis zu 400ms Jitter)
  const MAX_PAGES          = 200;   // Absoluter Sicherheits-Deckel
  const REQUEST_TIMEOUT_MS = 20000;
  const MAX_RETRIES        = 3;

  // Alle View-Modi von AniSearch
  const CONTAINER_SELECTORS = [
    'ul.gallery',
    'ul.covers',
    'ul.list',
    'table.table tbody',
  ];

  const ITEM_SELECTOR_MAP = {
    'ul.gallery':        'li',
    'ul.covers':         'li',
    'ul.list':           'li',
    'table.table tbody': 'tr',
  };

  // ════════════════════════════════════════════════
  // STATUS BAR
  // ════════════════════════════════════════════════

  const STATUS_PALETTE = {
    info:    { text: '#93c5fd', accent: '#6366f1' },
    success: { text: '#86efac', accent: '#22c55e' },
    warning: { text: '#fcd34d', accent: '#f59e0b' },
    error:   { text: '#fca5a5', accent: '#ef4444' },
    loading: { text: '#c4b5fd', accent: '#a78bfa' },
  };

  let _bar           = null;
  let _hideTimer     = null;
  let _stopRequested = false;
  let _currentRunId  = 0;

  function ensureBar() {
    if (_bar && document.getElementById(STATUS_BAR_ID)) return;

    _bar = document.createElement('div');
    _bar.id = STATUS_BAR_ID;

    Object.assign(_bar.style, {
      position:     'fixed',
      bottom:       '16px',
      right:        '16px',
      zIndex:       '2147483647',
      background:   'linear-gradient(135deg,#0d0d1a 0%,#111827 55%,#0a1628 100%)',
      border:       '1px solid rgba(99,102,241,0.35)',
      color:        '#e2e8f0',
      fontFamily:   '"Segoe UI",system-ui,sans-serif',
      fontSize:     '11.5px',
      fontWeight:   '500',
      padding:      '9px 15px 9px 12px',
      borderRadius: '10px',
      boxShadow:    '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)',
      lineHeight:   '1.6',
      maxWidth:     '300px',
      minWidth:     '200px',
      pointerEvents:'none',
      transition:   'opacity 0.4s ease, transform 0.4s ease',
      opacity:      '1',
      transform:    'translateY(0)',
      whiteSpace:   'pre-line',
    });

    // Farbiger Akzent-Streifen links
    const accent = document.createElement('div');
    Object.assign(accent.style, {
      position:     'absolute',
      left:         '0',
      top:          '10%',
      height:       '80%',
      width:        '3px',
      borderRadius: '0 3px 3px 0',
      background:   'var(--as-accent, #6366f1)',
      transition:   'background 0.3s ease',
    });
    _bar.appendChild(accent);

    const text = document.createElement('span');
    text.id = STATUS_BAR_ID + '-text';
    Object.assign(text.style, {
      display:     'block',
      paddingLeft: '8px',
    });
    _bar.appendChild(text);

    const stopBtn = document.createElement('button');
    stopBtn.id = STATUS_BAR_ID + '-stop';
    stopBtn.textContent = '✕ Stop';
    Object.assign(stopBtn.style, {
      display:      'none',
      marginTop:    '6px',
      marginLeft:   '8px',
      padding:      '2px 8px',
      fontSize:     '10.5px',
      fontFamily:   '"Segoe UI",system-ui,sans-serif',
      fontWeight:   '600',
      color:        '#fca5a5',
      background:   'rgba(239,68,68,0.15)',
      border:       '1px solid rgba(239,68,68,0.4)',
      borderRadius: '5px',
      cursor:       'pointer',
      pointerEvents:'auto',
    });
    stopBtn.addEventListener('click', () => {
      _stopRequested = true;
      stopBtn.textContent = '⏳ Stoppe…';
      stopBtn.disabled = true;
    });
    _bar.appendChild(stopBtn);

    document.body.appendChild(_bar);
  }

  function setStatus(msg, type = 'info') {
    clearTimeout(_hideTimer);
    ensureBar();
    const text = document.getElementById(STATUS_BAR_ID + '-text');
    const accent = _bar && _bar.querySelector('div');
    if (!text) return;

    const c = STATUS_PALETTE[type] || STATUS_PALETTE.info;
    text.style.color = c.text;
    if (accent) accent.style.background = c.accent;
    if (_bar) _bar.style.setProperty('--as-accent', c.accent);

    text.textContent = msg;
    if (_bar) {
      _bar.style.opacity   = '1';
      _bar.style.transform = 'translateY(0)';

      const stopBtn = document.getElementById(STATUS_BAR_ID + '-stop');
      if (stopBtn) stopBtn.style.display = type === 'loading' ? 'block' : 'none';
    }
  }

  function resetStopButton() {
    const btn = document.getElementById(STATUS_BAR_ID + '-stop');
    if (btn) { btn.textContent = '✕ Stop'; btn.disabled = false; }
  }

  function hideBar(delay = 4000) {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => {
      if (_bar) {
        _bar.style.opacity   = '0';
        _bar.style.transform = 'translateY(6px)';
      }
    }, delay);
  }

  // ════════════════════════════════════════════════
  // DOM HELPERS
  // ════════════════════════════════════════════════

  function findContainer(doc = document) {
    for (const sel of CONTAINER_SELECTORS) {
      const el = doc.querySelector(sel);
      if (el) return { container: el, selector: sel };
    }
    return null;
  }

  function getItemSel(containerSelector) {
    return ITEM_SELECTOR_MAP[containerSelector] || 'li';
  }

  /** Gibt die absolute nächste Seiten-URL zurück oder null */
  function findNextUrl(doc = document) {
    const candidates = [
      '.pagenav a.pagenav-next',
      'a.pagenav-next',
      'nav.pagination a[rel="next"]',
      '.pagination a[rel="next"]',
      'a[rel="next"]',
    ];
    for (const sel of candidates) {
      const el = doc.querySelector(sel);
      if (!el) continue;

      const raw = (el.getAttribute('href') || '').trim();
      if (!raw || raw === '#') continue;

      try {
        // Bereits absolut?
        if (/^https?:\/\//i.test(raw)) {
          const u = new URL(raw);
          if (u.href !== window.location.href) return u.href;
          continue;
        }

        // Relativ mit führendem Slash → gegen Origin auflösen
        if (raw.startsWith('/')) {
          return new URL(raw, window.location.origin).href;
        }

        // Relativ OHNE führenden Slash (z.B. "anime/index/page-2?...")
        // → immer gegen Origin + '/' auflösen, niemals gegen href
        // (verhindert Pfad-Verdoppelung wie /anime/index/anime/index/page-2)
        return new URL('/' + raw, window.location.origin).href;

      } catch {
        continue;
      }
    }
    return null;
  }

  function hideElements(selectors) {
    selectors.forEach(s => {
      document.querySelectorAll(s).forEach(el => {
        el.style.display = 'none';
      });
    });
  }

  /** Versteckt alle Paginierungs-Elemente, da wir selbst alles laden */
  function hidePagination() {
    hideElements([
      '.pagenav', '.pagination', 'nav.pagination',
      '[class*="pagenav"]', '[class*="pagination"]',
    ]);
  }

  // ════════════════════════════════════════════════
  // RATING-FILTER
  // ════════════════════════════════════════════════

  const STAR_SELS = [
    '[class*="star"]',
    '[class*="rating"]',
    '[class*="score"]',
    '.rating', '.score',
  ];

  /**
   * Extrahiert den präzisen Float-Rating aus einem Item-Element.
   * AniSearch: <div class="star0" title="3.66 / 5.00 (1234 Stimmen)">
   */
  function extractRating(itemEl) {

    for (const sel of STAR_SELS) {
      const el = itemEl.querySelector(sel);
      if (!el) continue;

      // 1) title-Attribut (präziseste Quelle), 2) textContent-Fallback
      const title = el.getAttribute('title') || '';
      const txt   = (el.textContent || '').trim();
      for (const src of [title, txt]) {
        const m = src.match(/(\d+(?:[.,]\d+)?)/);
        if (m) {
          const v = parseFloat(m[1].replace(',', '.'));
          if (!isNaN(v) && v > 0) return v;
        }
      }
    }

    // 3) data-Attribute
    const dataEl = itemEl.querySelector('[data-rating],[data-score],[data-average]');
    if (dataEl) {
      const raw = dataEl.getAttribute('data-rating')
                || dataEl.getAttribute('data-score')
                || dataEl.getAttribute('data-average')
                || '';
      const v = parseFloat(raw);
      if (!isNaN(v) && v > 0) return v;
    }

    return null; // kein Rating erkannt → behalten
  }

  function passesRating(itemEl, ratingMin) {
    if (ratingMin === null) return true;
    const r = extractRating(itemEl);
    if (r === null) return true; // unbekannt → Vorteil des Zweifels
    return r >= ratingMin;
  }

  // ════════════════════════════════════════════════
  // URL HELPERS
  // ════════════════════════════════════════════════

  function parseRatingMin() {
    // 1. URL-Parameter (präziseste Quelle, z.B. rating_min=3.25)
    const raw = new URLSearchParams(location.search).get('rating_min');
    if (raw !== null) {
      const v = parseFloat(raw);
      if (!isNaN(v)) {
        GM_setValue(STORAGE_KEY_RATING, v);
        return v;
      }
    }

    // 2. Gespeicherter Wert
    const stored = GM_getValue(STORAGE_KEY_RATING, null);
    if (stored !== null) {
      const v = parseFloat(stored);
      if (!isNaN(v)) return v;
    }

    return null;
  }

  // ════════════════════════════════════════════════
  // NETZWERK
  // ════════════════════════════════════════════════

  function fetchPage(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method:  'GET',
        url,
        headers: { 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
        timeout: REQUEST_TIMEOUT_MS,
        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            try {
              resolve(new DOMParser().parseFromString(res.responseText, 'text/html'));
            } catch (e) {
              reject(new Error('DOMParser: ' + e.message));
            }
          } else {
            reject(new Error('HTTP ' + res.status + ' für ' + url));
          }
        },
        onerror(e)  { reject(new Error('Netzwerkfehler: ' + JSON.stringify(e))); },
        ontimeout() { reject(new Error('Timeout nach ' + REQUEST_TIMEOUT_MS + 'ms')); },
      });
    });
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ════════════════════════════════════════════════
  // ITEM APPEND — sicher für alle Container-Typen
  // ════════════════════════════════════════════════

  function appendItem(container, itemEl) {
    container.appendChild(document.importNode(itemEl, true));
  }

  // ════════════════════════════════════════════════
  // UI UNLOCK (Premium-Sperre entfernen)
  // ════════════════════════════════════════════════

  const PREMIUM_TEXTS = new Set([
    'premium only', 'premium-only',
    'nur für premium', 'nur premium',
    'upgrade to premium',
  ]);

  let _limitObserver = null;

  function unlockUI() {
    // #limit Feld entsperren (falls vorhanden)
    const limitInput = document.querySelector('#limit');
    if (limitInput) {
      limitInput.removeAttribute('disabled');
      limitInput.removeAttribute('readonly');
      limitInput.style.opacity = '1';
      limitInput.style.cursor  = 'text';

      if (_limitObserver) _limitObserver.disconnect();
      _limitObserver = new MutationObserver(() => {
        limitInput.removeAttribute('disabled');
        limitInput.removeAttribute('readonly');
      });
      _limitObserver.observe(limitInput, { attributes: true });
    }

    // "Premium only" / "Nur für Premium" Hinweise verstecken
    hideElements([
      '.premium-only', '.premium-badge', '.locked',
      '.lock-icon', '[class*="premium-lock"]',
    ]);

    // Text-basiertes Suchen nach Premium-Hinweisen — nur in Formular-Gruppen
    document.querySelectorAll('.form-group, .filter-group, label, .input-group').forEach(group => {
      for (const el of group.querySelectorAll('*')) {
        if (el.children.length > 0) continue;
        if (PREMIUM_TEXTS.has(el.textContent.trim().toLowerCase())) {
          group.style.display = 'none';
          break;
        }
      }
    });
  }

  // ════════════════════════════════════════════════
  // LADE-INDIKATOR IM CONTAINER (visuell)
  // ════════════════════════════════════════════════

  const LOADER_ID = 'as-es-loader';

  function showLoader(container) {
    if (document.getElementById(LOADER_ID)) return;
    const loader = document.createElement('div');
    loader.id = LOADER_ID;
    Object.assign(loader.style, {
      textAlign:  'center',
      padding:    '24px',
      color:      '#6366f1',
      fontSize:   '13px',
      fontFamily: '"Segoe UI",system-ui,sans-serif',
      fontWeight: '500',
      letterSpacing: '0.3px',
      gridColumn: '1 / -1',   // funktioniert in Grid-Layouts
    });
    loader.innerHTML =
      '<span style="display:inline-block;animation:as-spin 1s linear infinite;font-size:18px;margin-right:8px">⟳</span>' +
      'Lädt weitere Einträge…';

    // Bei table-Container → tr > td wrapper
    if (container.tagName === 'TBODY') {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 99;
      td.appendChild(loader);
      tr.id = LOADER_ID + '-row';
      tr.appendChild(td);
      container.appendChild(tr);
    } else {
      container.appendChild(loader);
    }
  }

  function removeLoader() {
    [LOADER_ID, LOADER_ID + '-row'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  // ════════════════════════════════════════════════
  // KERN: ENDLESS FETCH LOOP
  // Lädt ALLE verfügbaren Seiten und hängt Items an
  // ════════════════════════════════════════════════

  async function runEndlessLoop(ratingMin, found, runId) {
    const { container, selector } = found;
    const itemSel = getItemSel(selector);

    // ── Schritt 1: Aktuelle Seite filtern ──────────
    const existingItems = Array.from(container.querySelectorAll(itemSel));
    let filteredCount = 0;

    existingItems.forEach(item => {
      if (!passesRating(item, ratingMin)) {
        item.style.display = 'none';
        item.setAttribute('data-as-hidden', 'rating');
        filteredCount++;
      }
    });

    const visibleOnPage1 = existingItems.length - filteredCount;

    // Pagination verstecken — wir übernehmen die Kontrolle
    hidePagination();

    // Nächste Seite aus aktuellem Dokument ermitteln
    let nextUrl = findNextUrl(document);

    if (!nextUrl) {
      // Einzige Seite — fertig
      setStatus(
        `✔ Alle Einträge geladen\n  ${visibleOnPage1} Items` +
        (ratingMin !== null ? `\n  Rating ≥ ${ratingMin}` : ''),
        'success'
      );
      hideBar(5000);
      return;
    }

    setStatus(
      `⟳ Seite 1 — ${visibleOnPage1} Items\n  Lade Seite 2…`,
      'loading'
    );
    showLoader(container);

    // ── Schritt 2: Alle weiteren Seiten abrufen ────
    _stopRequested = false;
    resetStopButton();
    let currentPage  = 2;
    let totalVisible = visibleOnPage1;
    let totalHidden  = filteredCount;
    const visitedUrls = new Set([window.location.href]);

    while (nextUrl && currentPage <= MAX_PAGES) {
      // Nutzer hat Stop gedrückt?
      if (_stopRequested) {
        setStatus(`⏹ Gestoppt.\n  ${totalVisible} Einträge geladen`, 'warning');
        removeLoader();
        hideBar(6000);
        break;
      }

      // Loop-Schutz: URL schon besucht?
      if (visitedUrls.has(nextUrl)) {
        console.warn('[AniSearch ES] Loop erkannt, stoppe:', nextUrl);
        break;
      }
      visitedUrls.add(nextUrl);

      // Fetch mit Retry
      let fetchedDoc = null;
      console.log('[AniSearch ES] Fetche Seite', currentPage, '→', nextUrl);
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          fetchedDoc = await fetchPage(nextUrl);
          break;
        } catch (err) {
          console.warn(`[AniSearch ES] Seite ${currentPage}, Versuch ${attempt} fehlgeschlagen:`, err.message);
          setStatus(
            `⚠ Seite ${currentPage} — Versuch ${attempt}/${MAX_RETRIES}\n  ${err.message}`,
            'error'
          );
          if (attempt < MAX_RETRIES) await sleep(1500 * attempt);
        }
      }

      // Veraltet? (Nutzer hat navigiert, neuer Run hat gestartet)
      if (runId !== _currentRunId) { removeLoader(); return; }

      // Nutzer hat Stop während des Fetches gedrückt?
      if (_stopRequested) {
        setStatus(`⏹ Gestoppt.\n  ${totalVisible} Einträge geladen`, 'warning');
        removeLoader();
        hideBar(6000);
        break;
      }

      if (!fetchedDoc) {
        setStatus(
          `✦ Gestoppt nach ${MAX_RETRIES} Fehlern.\n  ${totalVisible} Items geladen`,
          'error'
        );
        removeLoader();
        hideBar(7000);
        break;
      }

      // Items der geholten Seite auslesen
      const fetchedFound = findContainer(fetchedDoc);
      if (!fetchedFound) {
        // Leere / andere Seitenstruktur → Ende
        console.warn('[AniSearch ES] Container auf Seite', currentPage, 'nicht gefunden.');
        break;
      }

      const newItems = Array.from(
        fetchedFound.container.querySelectorAll(getItemSel(fetchedFound.selector))
      );

      if (newItems.length === 0) {
        // Leere Seite → wirklich letzte Seite
        break;
      }

      // Rating-Filter anwenden und Items anhängen
      removeLoader(); // kurz entfernen, damit Items unten erscheinen

      newItems.forEach(item => {
        if (passesRating(item, ratingMin)) {
          appendItem(container, item);
          totalVisible++;
        } else {
          totalHidden++;
        }
      });

      // Nächste Seite aus dem geholten Dokument lesen
      nextUrl = findNextUrl(fetchedDoc);

      setStatus(
        `⟳ Seite ${currentPage} geladen\n` +
        `  Sichtbar: ${totalVisible}  (${totalHidden} gefiltert)\n` +
        (nextUrl ? `  Lade Seite ${currentPage + 1}…` : '  Letzte Seite erreicht'),
        nextUrl ? 'loading' : 'success'
      );

      if (nextUrl) {
        showLoader(container);
        await sleep(FETCH_DELAY_MS + Math.random() * 400);
        if (runId !== _currentRunId) { removeLoader(); return; }
      }

      currentPage++;
    }

    // ── Schritt 3: Abschluss ───────────────────────
    removeLoader();

    if (!_stopRequested) {
      const cappedByLimit = currentPage > MAX_PAGES;
      setStatus(
        `${cappedByLimit ? '⚠' : '✔'} Fertig!` +
        `\n  ${totalVisible} Einträge sichtbar` +
        (totalHidden > 0 ? `\n  ${totalHidden} via Rating-Filter entfernt` : '') +
        (ratingMin !== null ? `\n  Rating ≥ ${ratingMin}` : '') +
        `\n  ${currentPage - 1} Seiten durchsucht` +
        (cappedByLimit ? '\n  ⚠ Seiten-Limit erreicht!' : ''),
        cappedByLimit ? 'warning' : 'success'
      );
      hideBar(8000);
    }
  }

  // ════════════════════════════════════════════════
  // EINSTIEGSPUNKT
  // ════════════════════════════════════════════════

  async function main() {
    // Laufenden Loop entwerten — er prüft selbst ob seine ID noch aktuell ist
    const runId = ++_currentRunId;

    ensureBar();
    setStatus('⟳ AniSearch Endless Scroll startet…', 'loading');

    // UI-Locks sofort entfernen
    unlockUI();
    // Nochmal nach 1.5s, falls Site-JS sie wiederherstellt
    setTimeout(unlockUI, 1500);

    // Rating-Minimum bestimmen
    const ratingMin = parseRatingMin();
    console.log('[AniSearch ES] Rating-Min:', ratingMin ?? 'kein Filter');

    // Schnell prüfen ob überhaupt eine Liste vorhanden ist (vor dem Sleep)
    if (!findContainer(document)) {
      setStatus('✔ UI entsperrt. (Keine Liste erkannt)', 'success');
      hideBar(4000);
      return;
    }

    // Kurz warten, damit Site-JS fertig rendern kann, dann Container frisch ermitteln
    await sleep(250);
    if (runId !== _currentRunId) { removeLoader(); return; } // veraltet — neuere Navigation hat übernommen

    const found = findContainer(document);
    if (!found) {
      setStatus('✔ UI entsperrt. (Keine Liste erkannt)', 'success');
      hideBar(4000);
      return;
    }

    // Hauptloop
    await runEndlessLoop(ratingMin, found, runId);
  }

  // ════════════════════════════════════════════════
  // BOOT & SPA-SUPPORT
  // ════════════════════════════════════════════════

  function boot() {
    const style = document.createElement('style');
    style.textContent = '@keyframes as-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(style);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', main);
    } else {
      main();
    }
  }

  // History-API patchen für SPA-Navigationen
  (function patchHistory() {
    const _push    = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    let navTimer;

    function scheduleMain() {
      clearTimeout(navTimer);
      navTimer = setTimeout(main, 600);
    }

    history.pushState = function (...a) {
      _push(...a);
      scheduleMain();
    };
    history.replaceState = function (...a) {
      const before = location.href;
      _replace(...a);
      if (location.href !== before) scheduleMain();
    };
    window.addEventListener('popstate', scheduleMain);
  })();

  boot();

})();
```

---

## BotGhost Bulk Choice Extractor — v1.6

- **Datei:** `BotGhost Bulk Choice Extractor.user.js`
- **Matches:** https://dashboard.botghost.com/*
- **Grants:** GM_setClipboard
- **Beschreibung:** Fügt einen "Copy Bulk" Button nur neben dem "Clear All Choices" Button hinzu, um Label/Value-Paare zu kopieren.

```javascript
// ==UserScript==
// @name         BotGhost Bulk Choice Extractor
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Fügt einen "Copy Bulk" Button nur neben dem "Clear All Choices" Button hinzu, um Label/Value-Paare zu kopieren.
// @author       marmoris
// @match        https://dashboard.botghost.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=botghost.com
// @grant        GM_setClipboard
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/BotGhost%20Bulk%20Choice%20Extractor.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/BotGhost%20Bulk%20Choice%20Extractor.user.js
// ==/UserScript==

(function() {
    'use strict';

    function createAndInjectButton() {
        // 1. Finde den "Clear All Choices" Button als Ankerpunkt.
        const clearAllButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === 'Clear All Choices');

        // 2. Fahre nur fort, wenn der Anker-Button existiert.
        if (clearAllButton) {
            const targetContainer = clearAllButton.parentElement;

            // 3. Prüfe, ob der Container gültig ist und unser Button noch nicht existiert.
            if (targetContainer && !document.getElementById('bulk-copy-button')) {
                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy Bulk';
                copyButton.id = 'bulk-copy-button';

                // Styling aus der vorherigen Version.
                copyButton.className = 'ml-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#ffb296] hover:bg-[#4d352a] transition-colors';
                copyButton.style.color = '#ffb296';

                copyButton.addEventListener('click', () => {
                    const choiceContainers = document.querySelectorAll('.space-y-2 > div[class*="bg-"]');
                    const lines = [];

                    choiceContainers.forEach(container => {
                        const inputs = container.querySelectorAll('input[type="text"]');
                        if (inputs.length === 2) {
                            const label = inputs[0].value.trim();
                            const value = inputs[1].value.trim();
                            if (label && value) {
                                lines.push(`${label},${value}`);
                            }
                        }
                    });

                    if (lines.length > 0) {
                        const outputString = lines.join('\n');
                        GM_setClipboard(outputString);
                        copyButton.textContent = `Copied ${lines.length} items!`;
                    } else {
                        copyButton.textContent = 'Nothing to copy!';
                    }

                    setTimeout(() => {
                        copyButton.textContent = 'Copy Bulk';
                    }, 2500);
                });

                // Füge den neuen Button zum Container des Anker-Buttons hinzu.
                targetContainer.appendChild(copyButton);
            }
        }
    }

    const observer = new MutationObserver((mutationsList, observer) => {
        // Die Funktion wird bei jeder DOM-Änderung aufgerufen, ist aber durch die internen Prüfungen sicher.
        createAndInjectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Führe eine initiale Prüfung beim Laden des Skripts durch.
    createAndInjectButton();
})();

```

---

## Copy as Markdown for AI — v2.1.2

- **Datei:** `Copy as Markdown for AI.user.js`
- **Matches:** *://*/*
- **Grants:** GM_setValue, GM_getValue, GM_registerMenuCommand, GM_addStyle, GM_xmlhttpRequest, GM_setClipboard
- **Beschreibung:** Convert web pages, selections, images, and links to Markdown for AI usage with sidebar preview and history

```javascript
// ==UserScript==
// @name         Copy as Markdown for AI
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.1.2
// @description  Convert web pages, selections, images, and links to Markdown for AI usage with sidebar preview and history
// @author       marmoris-x
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @noframes
// @icon         https://lh3.googleusercontent.com/kOVdqiI3s3rT4RlNWeY-dZ61BIuZ63bT2Ou_4rGsk47FDpVxaudzPrdO-AfC6hTj3lqn7IefPYHIXDivJpuT1b8fPA=s60
// @connect      *
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Copy%20as%20Markdown%20for%20AI.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Copy%20as%20Markdown%20for%20AI.user.js
// @run-at       document-idle
// ==/UserScript==
var TurndownService = (function () {
  "use strict";

  function extend(destination) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (source.hasOwnProperty(key)) destination[key] = source[key];
      }
    }
    return destination;
  }

  function repeat(character, count) {
    return Array(count + 1).join(character);
  }

  function trimLeadingNewlines(string) {
    return string.replace(/^\n*/, "");
  }

  function trimTrailingNewlines(string) {
    // avoid match-at-end regexp bottleneck, see #370
    var indexEnd = string.length;
    while (indexEnd > 0 && string[indexEnd - 1] === "\n") indexEnd--;
    return string.substring(0, indexEnd);
  }

  var blockElements = [
    "ADDRESS",
    "ARTICLE",
    "ASIDE",
    "AUDIO",
    "BLOCKQUOTE",
    "BODY",
    "CANVAS",
    "CENTER",
    "DD",
    "DIR",
    "DIV",
    "DL",
    "DT",
    "FIELDSET",
    "FIGCAPTION",
    "FIGURE",
    "FOOTER",
    "FORM",
    "FRAMESET",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HEADER",
    "HGROUP",
    "HR",
    "HTML",
    "ISINDEX",
    "LI",
    "MAIN",
    "MENU",
    "NAV",
    "NOFRAMES",
    "NOSCRIPT",
    "OL",
    "OUTPUT",
    "P",
    "PRE",
    "SECTION",
    "TABLE",
    "TBODY",
    "TD",
    "TFOOT",
    "TH",
    "THEAD",
    "TR",
    "UL",
  ];

  function isBlock(node) {
    return is(node, blockElements);
  }

  var voidElements = [
    "AREA",
    "BASE",
    "BR",
    "COL",
    "COMMAND",
    "EMBED",
    "HR",
    "IMG",
    "INPUT",
    "KEYGEN",
    "LINK",
    "META",
    "PARAM",
    "SOURCE",
    "TRACK",
    "WBR",
  ];

  function isVoid(node) {
    return is(node, voidElements);
  }

  function hasVoid(node) {
    return has(node, voidElements);
  }

  var meaningfulWhenBlankElements = [
    "A",
    "TABLE",
    "THEAD",
    "TBODY",
    "TFOOT",
    "TH",
    "TD",
    "IFRAME",
    "SCRIPT",
    "AUDIO",
    "VIDEO",
  ];

  function isMeaningfulWhenBlank(node) {
    return is(node, meaningfulWhenBlankElements);
  }

  function hasMeaningfulWhenBlank(node) {
    return has(node, meaningfulWhenBlankElements);
  }

  function is(node, tagNames) {
    return tagNames.indexOf(node.nodeName) >= 0;
  }

  function has(node, tagNames) {
    return (
      node.getElementsByTagName &&
      tagNames.some(function (tagName) {
        return node.getElementsByTagName(tagName).length;
      })
    );
  }

  var rules = {};

  rules.paragraph = {
    filter: "p",

    replacement: function (content) {
      return "\n\n" + content + "\n\n";
    },
  };

  rules.lineBreak = {
    filter: "br",

    replacement: function (content, node, options) {
      return options.br + "\n";
    },
  };

  rules.heading = {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],

    replacement: function (content, node, options) {
      var hLevel = Number(node.nodeName.charAt(1));

      if (options.headingStyle === "setext" && hLevel < 3) {
        var underline = repeat(hLevel === 1 ? "=" : "-", content.length);
        return "\n\n" + content + "\n" + underline + "\n\n";
      } else {
        return "\n\n" + repeat("#", hLevel) + " " + content + "\n\n";
      }
    },
  };

  rules.blockquote = {
    filter: "blockquote",

    replacement: function (content) {
      content = content.replace(/^\n+|\n+$/g, "");
      content = content.replace(/^/gm, "> ");
      return "\n\n" + content + "\n\n";
    },
  };

  rules.list = {
    filter: ["ul", "ol"],

    replacement: function (content, node) {
      var parent = node.parentNode;
      if (parent.nodeName === "LI" && parent.lastElementChild === node) {
        return "\n" + content;
      } else {
        return "\n\n" + content + "\n\n";
      }
    },
  };

  rules.listItem = {
    filter: "li",

    replacement: function (content, node, options) {
      content = content
        .replace(/^\n+/, "") // remove leading newlines
        .replace(/\n+$/, "\n") // replace trailing newlines with just a single one
        .replace(/\n/gm, "\n    "); // indent
      var prefix = options.bulletListMarker + "   ";
      var parent = node.parentNode;
      if (parent.nodeName === "OL") {
        var start = parent.getAttribute("start");
        var index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + ".  ";
      }
      return (
        prefix +
        content +
        (node.nextSibling && !/\n$/.test(content) ? "\n" : "")
      );
    },
  };

  rules.indentedCodeBlock = {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === "indented" &&
        node.nodeName === "PRE" &&
        node.firstChild &&
        node.firstChild.nodeName === "CODE"
      );
    },

    replacement: function (content, node, options) {
      return (
        "\n\n    " +
        node.firstChild.textContent.replace(/\n/g, "\n    ") +
        "\n\n"
      );
    },
  };

  rules.fencedCodeBlock = {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === "fenced" &&
        node.nodeName === "PRE" &&
        node.firstChild &&
        node.firstChild.nodeName === "CODE"
      );
    },

    replacement: function (content, node, options) {
      var className = node.firstChild.getAttribute("class") || "";
      var language = (className.match(/language-(\S+)/) || [null, ""])[1];
      var code = node.firstChild.textContent;

      var fenceChar = options.fence.charAt(0);
      var fenceSize = 3;
      var fenceInCodeRegex = new RegExp("^" + fenceChar + "{3,}", "gm");

      var match;
      while ((match = fenceInCodeRegex.exec(code))) {
        if (match[0].length >= fenceSize) {
          fenceSize = match[0].length + 1;
        }
      }

      var fence = repeat(fenceChar, fenceSize);

      return (
        "\n\n" +
        fence +
        language +
        "\n" +
        code.replace(/\n$/, "") +
        "\n" +
        fence +
        "\n\n"
      );
    },
  };

  rules.horizontalRule = {
    filter: "hr",

    replacement: function (content, node, options) {
      return "\n\n" + options.hr + "\n\n";
    },
  };

  rules.inlineLink = {
    filter: function (node, options) {
      return (
        options.linkStyle === "inlined" &&
        node.nodeName === "A" &&
        node.getAttribute("href")
      );
    },

    replacement: function (content, node) {
      var href = node.getAttribute("href");
      var title = cleanAttribute(node.getAttribute("title"));
      if (title) title = ' "' + title + '"';
      return "[" + content + "](" + href + title + ")";
    },
  };

  rules.referenceLink = {
    filter: function (node, options) {
      return (
        options.linkStyle === "referenced" &&
        node.nodeName === "A" &&
        node.getAttribute("href")
      );
    },

    replacement: function (content, node, options) {
      var href = node.getAttribute("href");
      var title = cleanAttribute(node.getAttribute("title"));
      if (title) title = ' "' + title + '"';
      var replacement;
      var reference;

      switch (options.linkReferenceStyle) {
        case "collapsed":
          replacement = "[" + content + "][]";
          reference = "[" + content + "]: " + href + title;
          break;
        case "shortcut":
          replacement = "[" + content + "]";
          reference = "[" + content + "]: " + href + title;
          break;
        default:
          var id = this.references.length + 1;
          replacement = "[" + content + "][" + id + "]";
          reference = "[" + id + "]: " + href + title;
      }

      this.references.push(reference);
      return replacement;
    },

    references: [],

    append: function (options) {
      var references = "";
      if (this.references.length) {
        references = "\n\n" + this.references.join("\n") + "\n\n";
        this.references = []; // Reset references
      }
      return references;
    },
  };

  rules.emphasis = {
    filter: ["em", "i"],

    replacement: function (content, node, options) {
      if (!content.trim()) return "";
      return options.emDelimiter + content + options.emDelimiter;
    },
  };

  rules.strong = {
    filter: ["strong", "b"],

    replacement: function (content, node, options) {
      if (!content.trim()) return "";
      return options.strongDelimiter + content + options.strongDelimiter;
    },
  };

  rules.code = {
    filter: function (node) {
      var hasSiblings = node.previousSibling || node.nextSibling;
      var isCodeBlock = node.parentNode.nodeName === "PRE" && !hasSiblings;

      return node.nodeName === "CODE" && !isCodeBlock;
    },

    replacement: function (content) {
      if (!content) return "";
      content = content.replace(/\r?\n|\r/g, " ");

      var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? " " : "";
      var delimiter = "`";
      var matches = content.match(/`+/gm) || [];
      while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + "`";

      return delimiter + extraSpace + content + extraSpace + delimiter;
    },
  };

  rules.image = {
    filter: "img",

    replacement: function (content, node) {
      var alt = cleanAttribute(node.getAttribute("alt"));
      var src = node.getAttribute("src") || "";
      var title = cleanAttribute(node.getAttribute("title"));
      var titlePart = title ? ' "' + title + '"' : "";
      return src ? "![" + alt + "]" + "(" + src + titlePart + ")" : "";
    },
  };

  function cleanAttribute(attribute) {
    return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
  }

  /**
   * Manages a collection of rules used to convert HTML to Markdown
   */

  function Rules(options) {
    this.options = options;
    this._keep = [];
    this._remove = [];

    this.blankRule = {
      replacement: options.blankReplacement,
    };

    this.keepReplacement = options.keepReplacement;

    this.defaultRule = {
      replacement: options.defaultReplacement,
    };

    this.array = [];
    for (var key in options.rules) this.array.push(options.rules[key]);
  }

  Rules.prototype = {
    add: function (key, rule) {
      this.array.unshift(rule);
    },

    keep: function (filter) {
      this._keep.unshift({
        filter: filter,
        replacement: this.keepReplacement,
      });
    },

    remove: function (filter) {
      this._remove.unshift({
        filter: filter,
        replacement: function () {
          return "";
        },
      });
    },

    forNode: function (node) {
      if (node.isBlank) return this.blankRule;
      var rule;

      if ((rule = findRule(this.array, node, this.options))) return rule;
      if ((rule = findRule(this._keep, node, this.options))) return rule;
      if ((rule = findRule(this._remove, node, this.options))) return rule;

      return this.defaultRule;
    },

    forEach: function (fn) {
      for (var i = 0; i < this.array.length; i++) fn(this.array[i], i);
    },
  };

  function findRule(rules, node, options) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (filterValue(rule, node, options)) return rule;
    }
    return void 0;
  }

  function filterValue(rule, node, options) {
    var filter = rule.filter;
    if (typeof filter === "string") {
      if (filter === node.nodeName.toLowerCase()) return true;
    } else if (Array.isArray(filter)) {
      if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true;
    } else if (typeof filter === "function") {
      if (filter.call(rule, node, options)) return true;
    } else {
      throw new TypeError("`filter` needs to be a string, array, or function");
    }
  }

  /**
   * The collapseWhitespace function is adapted from collapse-whitespace
   * by Luc Thevenard.
   *
   * The MIT License (MIT)
   *
   * Copyright (c) 2014 Luc Thevenard <lucthevenard@gmail.com>
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */

  /**
   * collapseWhitespace(options) removes extraneous whitespace from an the given element.
   *
   * @param {Object} options
   */
  function collapseWhitespace(options) {
    var element = options.element;
    var isBlock = options.isBlock;
    var isVoid = options.isVoid;
    var isPre =
      options.isPre ||
      function (node) {
        return node.nodeName === "PRE";
      };

    if (!element.firstChild || isPre(element)) return;

    var prevText = null;
    var keepLeadingWs = false;

    var prev = null;
    var node = next(prev, element, isPre);

    while (node !== element) {
      if (node.nodeType === 3 || node.nodeType === 4) {
        // Node.TEXT_NODE or Node.CDATA_SECTION_NODE
        var text = node.data.replace(/[ \r\n\t]+/g, " ");

        if (
          (!prevText || / $/.test(prevText.data)) &&
          !keepLeadingWs &&
          text[0] === " "
        ) {
          text = text.substr(1);
        }

        // `text` might be empty at this point.
        if (!text) {
          node = remove(node);
          continue;
        }

        node.data = text;

        prevText = node;
      } else if (node.nodeType === 1) {
        // Node.ELEMENT_NODE
        if (isBlock(node) || node.nodeName === "BR") {
          if (prevText) {
            prevText.data = prevText.data.replace(/ $/, "");
          }

          prevText = null;
          keepLeadingWs = false;
        } else if (isVoid(node) || isPre(node)) {
          // Avoid trimming space around non-block, non-BR void elements and inline PRE.
          prevText = null;
          keepLeadingWs = true;
        } else if (prevText) {
          // Drop protection if set previously.
          keepLeadingWs = false;
        }
      } else {
        node = remove(node);
        continue;
      }

      var nextNode = next(prev, node, isPre);
      prev = node;
      node = nextNode;
    }

    if (prevText) {
      prevText.data = prevText.data.replace(/ $/, "");
      if (!prevText.data) {
        remove(prevText);
      }
    }
  }

  /**
   * remove(node) removes the given node from the DOM and returns the
   * next node in the sequence.
   *
   * @param {Node} node
   * @return {Node} node
   */
  function remove(node) {
    var next = node.nextSibling || node.parentNode;

    node.parentNode.removeChild(node);

    return next;
  }

  /**
   * next(prev, current, isPre) returns the next node in the sequence, given the
   * current and previous nodes.
   *
   * @param {Node} prev
   * @param {Node} current
   * @param {Function} isPre
   * @return {Node}
   */
  function next(prev, current, isPre) {
    if ((prev && prev.parentNode === current) || isPre(current)) {
      return current.nextSibling || current.parentNode;
    }

    return current.firstChild || current.nextSibling || current.parentNode;
  }

  /*
   * Set up window for Node.js
   */

  var root = typeof window !== "undefined" ? window : {};

  /*
   * Parsing HTML strings
   */

  function canParseHTMLNatively() {
    var Parser = root.DOMParser;
    var canParse = false;

    // Adapted from https://gist.github.com/1129031
    // Firefox/Opera/IE throw errors on unsupported types
    try {
      // WebKit returns null on unsupported types
      if (new Parser().parseFromString("", "text/html")) {
        canParse = true;
      }
    } catch (e) {}

    return canParse;
  }

  function createHTMLParser() {
    var Parser = function () {};

    {
      if (shouldUseActiveX()) {
        Parser.prototype.parseFromString = function (string) {
          var doc = new window.ActiveXObject("htmlfile");
          doc.designMode = "on"; // disable on-page scripts
          doc.open();
          doc.write(string);
          doc.close();
          return doc;
        };
      } else {
        Parser.prototype.parseFromString = function (string) {
          var doc = document.implementation.createHTMLDocument("");
          doc.open();
          doc.write(string);
          doc.close();
          return doc;
        };
      }
    }
    return Parser;
  }

  function shouldUseActiveX() {
    var useActiveX = false;
    try {
      document.implementation.createHTMLDocument("").open();
    } catch (e) {
      if (window.ActiveXObject) useActiveX = true;
    }
    return useActiveX;
  }

  var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();

  function RootNode(input, options) {
    var root;
    if (typeof input === "string") {
      var doc = htmlParser().parseFromString(
        // DOM parsers arrange elements in the <head> and <body>.
        // Wrapping in a custom element ensures elements are reliably arranged in
        // a single element.
        '<x-turndown id="turndown-root">' + input + "</x-turndown>",
        "text/html"
      );
      root = doc.getElementById("turndown-root");
    } else {
      root = input.cloneNode(true);
    }
    collapseWhitespace({
      element: root,
      isBlock: isBlock,
      isVoid: isVoid,
      isPre: options.preformattedCode ? isPreOrCode : null,
    });

    return root;
  }

  var _htmlParser;
  function htmlParser() {
    _htmlParser = _htmlParser || new HTMLParser();
    return _htmlParser;
  }

  function isPreOrCode(node) {
    return node.nodeName === "PRE" || node.nodeName === "CODE";
  }

  function Node(node, options) {
    node.isBlock = isBlock(node);
    node.isCode = node.nodeName === "CODE" || node.parentNode.isCode;
    node.isBlank = isBlank(node);
    node.flankingWhitespace = flankingWhitespace(node, options);
    return node;
  }

  function isBlank(node) {
    return (
      !isVoid(node) &&
      !isMeaningfulWhenBlank(node) &&
      /^\s*$/i.test(node.textContent) &&
      !hasVoid(node) &&
      !hasMeaningfulWhenBlank(node)
    );
  }

  function flankingWhitespace(node, options) {
    if (node.isBlock || (options.preformattedCode && node.isCode)) {
      return { leading: "", trailing: "" };
    }

    var edges = edgeWhitespace(node.textContent);

    // abandon leading ASCII WS if left-flanked by ASCII WS
    if (edges.leadingAscii && isFlankedByWhitespace("left", node, options)) {
      edges.leading = edges.leadingNonAscii;
    }

    // abandon trailing ASCII WS if right-flanked by ASCII WS
    if (edges.trailingAscii && isFlankedByWhitespace("right", node, options)) {
      edges.trailing = edges.trailingNonAscii;
    }

    return { leading: edges.leading, trailing: edges.trailing };
  }

  function edgeWhitespace(string) {
    var m = string.match(
      /^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/
    );
    return {
      leading: m[1], // whole string for whitespace-only strings
      leadingAscii: m[2],
      leadingNonAscii: m[3],
      trailing: m[4], // empty for whitespace-only strings
      trailingNonAscii: m[5],
      trailingAscii: m[6],
    };
  }

  function isFlankedByWhitespace(side, node, options) {
    var sibling;
    var regExp;
    var isFlanked;

    if (side === "left") {
      sibling = node.previousSibling;
      regExp = / $/;
    } else {
      sibling = node.nextSibling;
      regExp = /^ /;
    }

    if (sibling) {
      if (sibling.nodeType === 3) {
        isFlanked = regExp.test(sibling.nodeValue);
      } else if (options.preformattedCode && sibling.nodeName === "CODE") {
        isFlanked = false;
      } else if (sibling.nodeType === 1 && !isBlock(sibling)) {
        isFlanked = regExp.test(sibling.textContent);
      }
    }
    return isFlanked;
  }

  var reduce = Array.prototype.reduce;
  var escapes = [
    [/\\/g, "\\\\"],
    [/\*/g, "\\*"],
    [/^-/g, "\\-"],
    [/^\+ /g, "\\+ "],
    [/^(=+)/g, "\\$1"],
    [/^(#{1,6}) /g, "\\$1 "],
    [/`/g, "\\`"],
    [/^~~~/g, "\\~~~"],
    [/\[/g, "\\["],
    [/\]/g, "\\]"],
    [/^>/g, "\\>"],
    [/_/g, "\\_"],
    [/^(\d+)\. /g, "$1\\. "],
  ];

  function TurndownService(options) {
    if (!(this instanceof TurndownService)) return new TurndownService(options);

    var defaults = {
      rules: rules,
      headingStyle: "setext",
      hr: "* * *",
      bulletListMarker: "*",
      codeBlockStyle: "indented",
      fence: "```",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "inlined",
      linkReferenceStyle: "full",
      br: "  ",
      preformattedCode: false,
      blankReplacement: function (content, node) {
        return node.isBlock ? "\n\n" : "";
      },
      keepReplacement: function (content, node) {
        return node.isBlock ? "\n\n" + node.outerHTML + "\n\n" : node.outerHTML;
      },
      defaultReplacement: function (content, node) {
        return node.isBlock ? "\n\n" + content + "\n\n" : content;
      },
    };
    this.options = extend({}, defaults, options);
    this.rules = new Rules(this.options);
  }

  TurndownService.prototype = {
    /**
     * The entry point for converting a string or DOM node to Markdown
     * @public
     * @param {String|HTMLElement} input The string or DOM node to convert
     * @returns A Markdown representation of the input
     * @type String
     */

    turndown: function (input) {
      if (!canConvert(input)) {
        throw new TypeError(
          input + " is not a string, or an element/document/fragment node."
        );
      }

      if (input === "") return "";

      var output = process.call(this, new RootNode(input, this.options));
      return postProcess.call(this, output);
    },

    /**
     * Add one or more plugins
     * @public
     * @param {Function|Array} plugin The plugin or array of plugins to add
     * @returns The Turndown instance for chaining
     * @type Object
     */

    use: function (plugin) {
      if (Array.isArray(plugin)) {
        for (var i = 0; i < plugin.length; i++) this.use(plugin[i]);
      } else if (typeof plugin === "function") {
        plugin(this);
      } else {
        throw new TypeError(
          "plugin must be a Function or an Array of Functions"
        );
      }
      return this;
    },

    /**
     * Adds a rule
     * @public
     * @param {String} key The unique key of the rule
     * @param {Object} rule The rule
     * @returns The Turndown instance for chaining
     * @type Object
     */

    addRule: function (key, rule) {
      this.rules.add(key, rule);
      return this;
    },

    /**
     * Keep a node (as HTML) that matches the filter
     * @public
     * @param {String|Array|Function} filter The unique key of the rule
     * @returns The Turndown instance for chaining
     * @type Object
     */

    keep: function (filter) {
      this.rules.keep(filter);
      return this;
    },

    /**
     * Remove a node that matches the filter
     * @public
     * @param {String|Array|Function} filter The unique key of the rule
     * @returns The Turndown instance for chaining
     * @type Object
     */

    remove: function (filter) {
      this.rules.remove(filter);
      return this;
    },

    /**
     * Escapes Markdown syntax
     * @public
     * @param {String} string The string to escape
     * @returns A string with Markdown syntax escaped
     * @type String
     */

    escape: function (string) {
      return escapes.reduce(function (accumulator, escape) {
        return accumulator.replace(escape[0], escape[1]);
      }, string);
    },
  };

  /**
   * Reduces a DOM node down to its Markdown string equivalent
   * @private
   * @param {HTMLElement} parentNode The node to convert
   * @returns A Markdown representation of the node
   * @type String
   */

  function process(parentNode) {
    var self = this;
    return reduce.call(
      parentNode.childNodes,
      function (output, node) {
        node = new Node(node, self.options);

        var replacement = "";
        if (node.nodeType === 3) {
          replacement = node.isCode
            ? node.nodeValue
            : self.escape(node.nodeValue);
        } else if (node.nodeType === 1) {
          replacement = replacementForNode.call(self, node);
        }

        return join(output, replacement);
      },
      ""
    );
  }

  /**
   * Appends strings as each rule requires and trims the output
   * @private
   * @param {String} output The conversion output
   * @returns A trimmed version of the ouput
   * @type String
   */

  function postProcess(output) {
    var self = this;
    this.rules.forEach(function (rule) {
      if (typeof rule.append === "function") {
        output = join(output, rule.append(self.options));
      }
    });

    return output.replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "");
  }

  /**
   * Converts an element node to its Markdown equivalent
   * @private
   * @param {HTMLElement} node The node to convert
   * @returns A Markdown representation of the node
   * @type String
   */

  function replacementForNode(node) {
    var rule = this.rules.forNode(node);
    var content = process.call(this, node);
    var whitespace = node.flankingWhitespace;
    if (whitespace.leading || whitespace.trailing) content = content.trim();
    return (
      whitespace.leading +
      rule.replacement(content, node, this.options) +
      whitespace.trailing
    );
  }

  /**
   * Joins replacement to the current output with appropriate number of new lines
   * @private
   * @param {String} output The current conversion output
   * @param {String} replacement The string to append to the output
   * @returns Joined output
   * @type String
   */

  function join(output, replacement) {
    var s1 = trimTrailingNewlines(output);
    var s2 = trimLeadingNewlines(replacement);
    var nls = Math.max(
      output.length - s1.length,
      replacement.length - s2.length
    );
    var separator = "\n\n".substring(0, nls);

    return s1 + separator + s2;
  }

  /**
   * Determines whether an input can be converted
   * @private
   * @param {String|HTMLElement} input Describe this parameter
   * @returns Describe what it returns
   * @type String|Object|Array|Boolean|Number
   */

  function canConvert(input) {
    return (
      input != null &&
      (typeof input === "string" ||
        (input.nodeType &&
          (input.nodeType === 1 ||
            input.nodeType === 9 ||
            input.nodeType === 11)))
    );
  }

  return TurndownService;
})();

// ============================================================
// MAIN IMPLEMENTATION
// ============================================================
(function () {
  'use strict';

  // Only run in the top-level frame — @noframes handles Tampermonkey, this guards edge cases
  if (window.top !== window.self) return;
  // Prevent double-init on SPA navigations
  if (window.__mdsLoaded) return;
  window.__mdsLoaded = true;

  const STORAGE_KEY = 'mds_history';
  const MAX_HISTORY = 10;
  const SIDEBAR_WIDTH = 380;

  // ── FIX 1: Language-hint recognition ────────────────────────────────────────
  // Many platforms (Reddit, Discourse, Hashnode, Ghost, legacy WordPress) cannot
  // render fenced code with language identifiers, so they emit a bare <p>bash</p>
  // immediately before a <pre> block instead of a proper ```bash fence.
  // cleanDOM() detects these hint paragraphs and tags the following <pre> with
  // data-mds-lang so the barePre Turndown rule can emit a proper fenced block.
  const LANG_HINTS = new Set([
    'bash','sh','shell','zsh','fish','cmd','bat','powershell','ps1',
    'javascript','js','jsx','typescript','ts','tsx',
    'python','py','ruby','rb','go','rust','java','c','cpp','c++','c#','cs',
    'css','scss','sass','less','html','xml','svg','json','jsonc',
    'yaml','yml','toml','ini','env','dotenv',
    'sql','graphql','gql','r','swift','kotlin','dart','scala',
    'haskell','lua','perl','php','elixir','clojure','clj',
    'dockerfile','makefile','nginx','text','txt','plain','output','log'
  ]);

  // ── FIX 2: HTML entity decoding ─────────────────────────────────────────────
  // Many platforms (Reddit, Discourse, Ghost…) double-encode special characters
  // inside <code> elements: the author wrote <Foo>, the platform stored &lt;Foo&gt;,
  // the browser renders the HTML once → text node contains "&lt;Foo&gt;" literally,
  // and Turndown emits `&lt;Foo&gt;` into the Markdown instead of `<Foo>`.
  // We apply a second decode pass specifically in code contexts.
  // String-replace over DOMParser round-trip: no forced reflow, no extra allocations,
  // and platforms in the wild are essentially limited to these seven named entities.
  function decodeHTMLEntities(str) {
    return str
      .replace(/&amp;/g,  '&')
      .replace(/&lt;/g,   '<')
      .replace(/&gt;/g,   '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, '\u00a0'); // preserve non-breaking space as Unicode, not literal space
  }

  // ── FIX 4: Restore over-escaped asterisk pairs ──────────────────────────────
  // Restore over-escaped asterisk pairs produced by Turndown's escape() function.
  // Turndown escapes ALL * characters in text nodes (rule: /\*/g → "\\*"),
  // but * only needs escaping in specific Markdown contexts. Platforms like Reddit,
  // Discourse, and Ghost embed literal ** in their HTML text nodes (unprocessed
  // Markdown syntax), which Turndown turns into \*\* — producing \*\*X\*\* in
  // the output instead of **X** (bold). This pass restores such sequences.
  // The 1–80 char limit and non-newline constraint prevent false positives on
  // legitimate escaped asterisks that are not part of bold/italic constructs.
  function postProcessMarkdown(md) {
    return md
      // \*\*...\*\* → **...** (restore bold)
      .replace(/\\\*\\\*([^\n]{1,80}?)\\\*\\\*/g, '**$1**')
      // \*...\* → *...* (restore italic) — same root cause, less common
      .replace(/\\\*([^\n*]{1,40}?)\\\*/g, '*$1*');
  }

  // ── CSS — "Terminal Amber" dark theme ────────────────────
  const SIDEBAR_CSS = `
#mds-root {
  --bg:        #0e0c09;
  --surface:   #181510;
  --surface2:  #211d16;
  --border:    #2d2820;
  --border2:   #3d3628;
  --accent:    #f59e0b;
  --accent-dim:#7c5109;
  --accent-lo: #1a1105;
  --text:      #f0ebe0;
  --text-dim:  #7a7060;
  --text-mid:  #b0a890;
  --green:     #34d399;
  --red:       #f87171;
  --mono:      ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans:      system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  position: fixed;
  top: 0;
  right: 0;
  width: ${SIDEBAR_WIDTH}px;
  height: 100vh;
  background: var(--bg);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 40px rgba(0,0,0,0.6);
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--text);
  box-sizing: border-box;
  transform: translateX(0);
  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
#mds-root.hidden {
  transform: translateX(100%);
}
#mds-root *, #mds-root *::before, #mds-root *::after {
  box-sizing: border-box !important;
  font-family: inherit !important;
}
/* Immunize against host-page CSS bleeding in via !important rules */
#mds-root button, #mds-root div, #mds-root span {
  all: revert;
  box-sizing: border-box !important;
  margin: 0 !important;
  line-height: normal !important;
  font-family: var(--sans) !important;
}
#mds-root input {
  all: revert;
  box-sizing: border-box !important;
  margin: 0 !important;
  font-family: var(--sans) !important;
}
#mds-root label {
  all: revert;
  box-sizing: border-box !important;
  margin: 0 !important;
  font-family: var(--sans) !important;
}
#mds-root button {
  appearance: none !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  line-height: 1 !important;
}

/* ── Header ── */
#mds-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 14px !important;
  height: 46px !important;
  background: var(--surface) !important;
  border-bottom: 1px solid var(--border) !important;
  flex-shrink: 0 !important;
}
#mds-logo {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-family: var(--mono) !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  color: var(--accent) !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
}
#mds-logo-icon {
  width: 22px !important;
  height: 22px !important;
  background: var(--accent) !important;
  border-radius: 4px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 11px !important;
  color: var(--bg) !important;
  font-weight: 700 !important;
  flex-shrink: 0 !important;
}
#mds-close {
  width: 28px !important;
  height: 28px !important;
  border: none !important;
  background: var(--surface2) !important;
  color: var(--text-dim) !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background 0.15s, color 0.15s !important;
  padding: 0 !important;
}
#mds-close:hover {
  background: var(--border2) !important;
  color: var(--text) !important;
}

/* ── Section label ── */
.mds-label {
  font-family: var(--mono) !important;
  font-size: 9px !important;
  font-weight: 600 !important;
  letter-spacing: 0.16em !important;
  text-transform: uppercase !important;
  color: var(--text-dim) !important;
  padding: 12px 14px 5px !important;
  display: block !important;
}

/* ── Copy action buttons ── */
#mds-actions {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 6px !important;
  padding: 0 14px 10px !important;
}
.mds-action-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  padding: 8px 10px !important;
  background: var(--surface2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 7px !important;
  color: var(--text-mid) !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: background 0.15s, border-color 0.15s, color 0.15s !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  line-height: 1 !important;
}
.mds-action-btn:hover {
  background: var(--border) !important;
  border-color: var(--border2) !important;
  color: var(--text) !important;
}
.mds-action-btn.mds-active-mode {
  background: var(--accent-lo) !important;
  border-color: var(--accent-dim) !important;
  color: var(--accent) !important;
  animation: mds-pulse 1.5s ease-in-out infinite !important;
}
@keyframes mds-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
  50%       { box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }
}
.mds-action-icon {
  font-size: 13px !important;
  flex-shrink: 0 !important;
  line-height: 1 !important;
}

/* ── Divider ── */
.mds-divider {
  height: 1px !important;
  background: var(--border) !important;
  margin: 4px 0 !important;
  flex-shrink: 0 !important;
}

/* ── Options toggles ── */
#mds-options {
  padding: 0 14px 10px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
}
.mds-toggle-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 6px 8px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  transition: background 0.12s !important;
  user-select: none !important;
}
.mds-toggle-row:hover {
  background: var(--surface2) !important;
}

/* CRITICAL FIX: #mds-root input has specificity (1,0,1) via all:revert rule above.
   Use (1,1,2) + !important to guarantee the checkbox stays hidden. */
#mds-root .mds-toggle-row input[type="checkbox"] {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  position: absolute !important;
  pointer-events: none !important;
}

.mds-toggle-label {
  font-size: 12px !important;
  color: var(--text-mid) !important;
  line-height: 1.4 !important;
  flex: 1 !important;
}
.mds-switch {
  width: 30px !important;
  height: 16px !important;
  background: var(--border2) !important;
  border-radius: 8px !important;
  position: relative !important;
  transition: background 0.2s !important;
  flex-shrink: 0 !important;
  display: block !important;
}
.mds-switch::after {
  content: '' !important;
  position: absolute !important;
  top: 2px !important;
  left: 2px !important;
  width: 12px !important;
  height: 12px !important;
  border-radius: 50% !important;
  background: var(--text-dim) !important;
  transition: transform 0.2s, background 0.2s !important;
}
#mds-root .mds-toggle-row input[type="checkbox"]:checked + .mds-switch {
  background: var(--accent-dim) !important;
}
#mds-root .mds-toggle-row input[type="checkbox"]:checked + .mds-switch::after {
  transform: translateX(14px) !important;
  background: var(--accent) !important;
}

/* ── URL fetch ── */
#mds-url-section {
  padding: 0 14px 10px !important;
}
#mds-url-row {
  display: flex !important;
  gap: 6px !important;
}
#mds-url-input {
  flex: 1 !important;
  padding: 6px 10px !important;
  background: var(--surface2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 7px !important;
  color: var(--text) !important;
  font-size: 12px !important;
  font-family: var(--mono) !important;
  outline: none !important;
  transition: border-color 0.15s !important;
  min-width: 0 !important;
}
#mds-url-input::placeholder {
  color: var(--text-dim) !important;
  opacity: 1 !important;
}
#mds-url-input:focus {
  border-color: var(--accent-dim) !important;
}
#mds-url-fetch {
  padding: 6px 12px !important;
  background: var(--accent) !important;
  color: var(--bg) !important;
  border: none !important;
  border-radius: 7px !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  transition: opacity 0.15s !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}
#mds-url-fetch:hover { opacity: 0.85 !important; }
#mds-url-fetch:disabled { opacity: 0.4 !important; cursor: default !important; }

/* ── Content tabs ── */
#mds-tabs {
  display: flex !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 0 14px !important;
  gap: 0 !important;
  flex-shrink: 0 !important;
}
.mds-tab {
  padding: 8px 12px !important;
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  color: var(--text-dim) !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  margin-bottom: -1px !important;
  transition: color 0.15s, border-color 0.15s !important;
  outline: none !important;
}
.mds-tab:hover { color: var(--text-mid) !important; }
.mds-tab.active {
  color: var(--accent) !important;
  border-bottom-color: var(--accent) !important;
}

/* ── Preview ── */
#mds-panel-preview {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
#mds-panel-preview.hidden { display: none !important; }
#mds-preview-toolbar {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  padding: 6px 14px !important;
  flex-shrink: 0 !important;
  gap: 6px !important;
}
#mds-preview-source {
  font-family: var(--mono) !important;
  font-size: 10px !important;
  color: var(--text-dim) !important;
  flex: 1 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
#mds-copy-preview {
  padding: 4px 12px !important;
  background: var(--surface2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 5px !important;
  color: var(--text-mid) !important;
  cursor: pointer !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  transition: background 0.15s, color 0.15s, border-color 0.15s !important;
}
#mds-copy-preview:hover {
  background: var(--accent) !important;
  color: var(--bg) !important;
  border-color: var(--accent) !important;
}
#mds-preview {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 12px 14px !important;
  font-family: var(--mono) !important;
  font-size: 11.5px !important;
  line-height: 1.7 !important;
  color: var(--text-mid) !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  scrollbar-width: thin !important;
  scrollbar-color: var(--border2) transparent !important;
}
#mds-preview::-webkit-scrollbar { width: 4px !important; }
#mds-preview::-webkit-scrollbar-thumb { background: var(--border2) !important; border-radius: 4px !important; }
.mds-loading {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 80px !important;
  color: var(--text-dim) !important;
  font-size: 12px !important;
  font-style: italic !important;
  gap: 8px !important;
}
.mds-loading::before {
  content: '' !important;
  width: 12px !important;
  height: 12px !important;
  border: 2px solid var(--border2) !important;
  border-top-color: var(--accent) !important;
  border-radius: 50% !important;
  animation: mds-spin 0.8s linear infinite !important;
}
@keyframes mds-spin { to { transform: rotate(360deg); } }

/* ── History ── */
#mds-panel-history {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
#mds-panel-history.hidden { display: none !important; }
#mds-history-list {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 10px 14px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
  scrollbar-width: thin !important;
  scrollbar-color: var(--border2) transparent !important;
}
#mds-history-list::-webkit-scrollbar { width: 4px !important; }
#mds-history-list::-webkit-scrollbar-thumb { background: var(--border2) !important; border-radius: 4px !important; }
.mds-empty {
  color: var(--text-dim) !important;
  font-style: italic !important;
  text-align: center !important;
  padding: 24px 0 !important;
  font-size: 12px !important;
}
.mds-hist-item {
  background: var(--surface) !important;
  border: 1px solid var(--border) !important;
  border-left: 3px solid var(--accent-dim) !important;
  border-radius: 7px !important;
  padding: 10px 11px !important;
  transition: border-left-color 0.15s !important;
}
.mds-hist-item:hover { border-left-color: var(--accent) !important; }
.mds-hist-row1 {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 4px !important;
}
.mds-hist-badge {
  font-family: var(--mono) !important;
  font-size: 9px !important;
  font-weight: 500 !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  color: var(--accent) !important;
  background: var(--accent-lo) !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  border: 1px solid var(--accent-dim) !important;
}
.mds-hist-time {
  font-size: 10px !important;
  color: var(--text-dim) !important;
}
.mds-hist-title {
  font-size: 12px !important;
  font-weight: 500 !important;
  color: var(--text) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  margin-bottom: 3px !important;
}
.mds-hist-preview {
  font-family: var(--mono) !important;
  font-size: 10.5px !important;
  color: var(--text-dim) !important;
  line-height: 1.5 !important;
  overflow: hidden !important;
  max-height: 32px !important;
  margin-bottom: 8px !important;
  word-break: break-all !important;
}
.mds-hist-actions {
  display: flex !important;
  gap: 5px !important;
}
.mds-hist-btn {
  padding: 3px 10px !important;
  border-radius: 4px !important;
  border: 1px solid var(--border2) !important;
  background: var(--surface2) !important;
  color: var(--text-mid) !important;
  font-size: 11px !important;
  cursor: pointer !important;
  transition: background 0.12s, color 0.12s, border-color 0.12s !important;
}
.mds-hist-btn:hover {
  background: var(--accent) !important;
  color: var(--bg) !important;
  border-color: var(--accent) !important;
}
#mds-root .mds-hist-btn.del:hover {
  background: var(--red) !important;
  color: white !important;
  border-color: var(--red) !important;
}

/* ── Toast — CSS vars as fallbacks since toast lives on body, not inside #mds-root ── */
#mds-toast {
  position: fixed;
  bottom: 20px;
  right: ${SIDEBAR_WIDTH + 12}px;
  padding: 8px 14px;
  background: var(--surface2, #211d16);
  border: 1px solid var(--border2, #3d3628);
  color: var(--text, #f0ebe0);
  font-size: 12px;
  border-radius: 8px;
  z-index: 2147483647;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
  font-family: var(--sans, system-ui, -apple-system, sans-serif);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  white-space: nowrap;
}
#mds-toast.mds-toast-show {
  opacity: 1;
  transform: translateY(0);
}
#mds-toast.err { border-color: var(--red, #f87171); color: var(--red, #f87171); }
#mds-toast.ok  { border-color: var(--green, #34d399); color: var(--green, #34d399); }

/* ── Theme button ── */
#mds-theme-btn {
  width: 28px !important;
  height: 28px !important;
  border: none !important;
  background: var(--surface2) !important;
  color: var(--text-dim) !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background 0.15s, color 0.15s !important;
  padding: 0 !important;
}
#mds-theme-btn:hover { background: var(--border2) !important; color: var(--text) !important; }

/* ── Light theme overrides ── */
#mds-root[data-theme="light"] {
  --bg:        #ffffff;
  --surface:   #f5f5f4;
  --surface2:  #ebe9e6;
  --border:    #ddd8d0;
  --border2:   #c9c4bc;
  --accent:    #c77c00;
  --accent-dim:#c77c00;
  --accent-lo: #fff8ec;
  --text:      #1c1a17;
  --text-dim:  #9a9080;
  --text-mid:  #5a5248;
  --green:     #16a34a;
  --red:       #dc2626;
}
#mds-root[data-theme="light"] #mds-preview { color: var(--text-mid) !important; }
#mds-root[data-theme="light"] .mds-hist-item { border-left-color: var(--accent-dim) !important; }

/* ── Edge handle ── */
#mds-handle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 110px;
  background: #f59e0b;
  border: none;
  border-radius: 6px 0 0 6px;
  cursor: pointer;
  z-index: 2147483645;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: -3px 0 12px rgba(0,0,0,0.25);
  transition: right 0.28s cubic-bezier(0.4,0,0.2,1), width 0.15s, background 0.15s;
  padding: 0;
  overflow: hidden;
}
#mds-handle[data-theme="light"] { background: #c77c00; }
#mds-handle:hover { width: 30px; background: #fbbf24; }
#mds-handle[data-theme="light"]:hover { background: #d4860a; }
#mds-handle span {
  writing-mode: vertical-rl;
  font-size: 14px;
  font-weight: 700;
  color: #0c0b09;
  letter-spacing: 0.05em;
  font-family: "DM Mono", monospace;
  user-select: none;
}
#mds-handle.mds-handle-open {
  right: ${SIDEBAR_WIDTH}px;
}
#mds-handle.mds-handle-hidden {
  display: none;
}
`;

  // ── HTML ─────────────────────────────────────────────────
  const SIDEBAR_HTML = `
<div id="mds-header">
  <div id="mds-logo">
    <span id="mds-logo-icon">M↓</span>
    <span>Markdown</span>
  </div>
  <div style="display:flex;gap:4px;align-items:center">
    <button id="mds-theme-btn" title="Toggle dark/light mode">☀</button>
    <button id="mds-close" title="Close sidebar">✕</button>
  </div>
</div>

<div class="mds-label">Copy as</div>
<div id="mds-actions">
  <button class="mds-action-btn" id="mds-act-page">
    <span class="mds-action-icon">📄</span> Page
  </button>
  <button class="mds-action-btn" id="mds-act-sel">
    <span class="mds-action-icon">✂️</span> Selection
  </button>
  <button class="mds-action-btn" id="mds-act-img">
    <span class="mds-action-icon">🖼</span> Image
  </button>
  <button class="mds-action-btn" id="mds-act-link">
    <span class="mds-action-icon">🔗</span> Link
  </button>
</div>

<div class="mds-divider"></div>
<div class="mds-label">Options</div>
<div id="mds-options">
  <label class="mds-toggle-row">
    <span class="mds-toggle-label">Include Title</span>
    <input type="checkbox" id="mds-opt-title" checked>
    <span class="mds-switch"></span>
  </label>
  <label class="mds-toggle-row">
    <span class="mds-toggle-label">Ignore Links & Images</span>
    <input type="checkbox" id="mds-opt-nolinks">
    <span class="mds-switch"></span>
  </label>
  <label class="mds-toggle-row">
    <span class="mds-toggle-label">Clean / Filter</span>
    <input type="checkbox" id="mds-opt-clean" checked>
    <span class="mds-switch"></span>
  </label>
</div>

<div class="mds-divider"></div>
<div class="mds-label">Fetch URL</div>
<div id="mds-url-section">
  <div id="mds-url-row">
    <input type="url" id="mds-url-input" placeholder="https://example.com/article">
    <button id="mds-url-fetch">Fetch →</button>
  </div>
</div>

<div class="mds-divider"></div>
<div id="mds-tabs">
  <button class="mds-tab active" id="mds-tab-preview">Preview</button>
  <button class="mds-tab" id="mds-tab-history">History</button>
</div>

<div id="mds-panel-preview">
  <div id="mds-preview-toolbar">
    <span id="mds-preview-source"></span>
    <button id="mds-copy-preview">Copy</button>
  </div>
  <pre id="mds-preview"><span class="mds-loading"></span></pre>
</div>
<div id="mds-panel-history" class="hidden">
  <div id="mds-history-list"></div>
</div>
`;

  // ── State ─────────────────────────────────────────────────
  let sidebarEl = null;
  let handleEl = null;
  let currentMarkdown = '';
  let currentTheme = GM_getValue('mds_theme', 'dark'); // 'dark' | 'light'
  let cssInjected = false;

  function ensureCSS() {
    if (cssInjected) return;
    GM_addStyle(SIDEBAR_CSS);
    cssInjected = true;
  }

  // ── Persistent options ────────────────────────────────────
  const OPTS_KEY = 'mds_opts';
  const DEFAULT_OPTS = { title: true, nolinks: false, clean: true };

  function loadOpts() {
    const stored = GM_getValue(OPTS_KEY, null);
    if (!stored) return Object.assign({}, DEFAULT_OPTS);
    try {
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
      return Object.assign({}, DEFAULT_OPTS, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULT_OPTS);
    }
  }
  function saveOpts() {
    const o = getOpts();
    GM_setValue(OPTS_KEY, JSON.stringify(o));
    return o;
  }

  function getOpts() {
    const el = document.getElementById('mds-root');
    if (!el) return loadOpts();
    return {
      title:   el.querySelector('#mds-opt-title')?.checked   ?? true,
      nolinks: el.querySelector('#mds-opt-nolinks')?.checked ?? false,
      clean:   el.querySelector('#mds-opt-clean')?.checked   ?? true,
    };
  }

  // ── TurndownService setup ────────────────────────────────
  function createTurndown(opts = {}) {
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

    // ── Images ─────────────────────────────────────────────
    if (opts.nolinks) {
      // "Ignore Links" = strip all hyperlinks AND all images
      td.addRule('stripImages', { filter: 'img',    replacement: () => '' });
      td.addRule('stripLinks',  { filter: 'a',      replacement: (c) => c });
      td.addRule('stripFigure', { filter: 'figure', replacement: () => '' });
      td.addRule('stripPicture',{ filter: 'picture',replacement: () => '' });
    } else {
      // Better image alt: strip query-param-only filenames and data: URIs
      td.addRule('imgAltFallback', {
        filter: 'img',
        replacement: (content, node) => {
          // Cascade through lazy-loading attributes before falling back to src
          const src = node.getAttribute('data-src') ||
                      node.getAttribute('data-lazy-src') ||
                      node.getAttribute('data-original') ||
                      node.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return ''; // skip base64 placeholders
          const rawAlt = node.getAttribute('alt') || '';
          const alt = rawAlt && !/^https?:|^\/|^data:/.test(rawAlt)
            ? rawAlt
            : (src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image');
          return `![${alt}](${src})`;
        }
      });

      // <picture> → extract the img inside it
      td.addRule('picture', {
        filter: 'picture',
        replacement: (content, node) => {
          const img = node.querySelector('img');
          if (!img) return content;
          const src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          const alt = img.getAttribute('alt') || src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image';
          return `![${alt}](${src})`;
        }
      });

      // <figure> → image + optional figcaption as italic line
      td.addRule('figure', {
        filter: 'figure',
        replacement: (content, node) => {
          const img = node.querySelector('img');
          if (!img) return content; // non-image figure, keep processed content
          const src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          const caption = node.querySelector('figcaption');
          const captionText = caption?.textContent.trim() || '';
          const alt = img.getAttribute('alt') || captionText || src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image';
          const imgMd = `![${alt}](${src})`;
          return captionText ? `\n\n${imgMd}\n*${captionText}*\n\n` : `\n\n${imgMd}\n\n`;
        }
      });
    }

    // ── FIX 3: Robust link handling ─────────────────────────────────────────────
    // Overrides Turndown's built-in inlineLink rule (addRule uses unshift, so this
    // rule wins). The filter is a superset: it also checks data-mds-href, a backup
    // attribute written by resolveUrls() for cases where the href attribute is
    // empty/absent when the script runs (e.g. React hydration cleared it, or the
    // platform uses client-side routing that strips href before document-idle).
    // This is a global fix — it applies to any platform with this pattern, not just
    // Reddit. For sites where href is already correct, the output is identical to
    // the built-in inlineLink rule.
    td.addRule('robustLink', {
      filter: (node) => {
        if (node.nodeName !== 'A') return false;
        const href = node.getAttribute('href') || node.getAttribute('data-mds-href') || '';
        return !!(href && href !== '#' && !href.startsWith('javascript:'));
      },
      replacement: (content, node) => {
        if (!content.trim()) return '';
        const href = node.getAttribute('href') || node.getAttribute('data-mds-href') || '';
        if (!href || href === '#' || href.startsWith('javascript:')) return content;
        // Mirrors Turndown's built-in cleanAttribute for title
        const title = (node.getAttribute('title') || '').replace(/(\n+\s*)+/g, '\n');
        const titlePart = title ? ` "${title}"` : '';
        return `[${content}](${href}${titlePart})`;
      }
    });

    // ── FIX 1: Bare <pre> without a <code> child → fenced code block ───────────
    // TurndownService's built-in fencedCodeBlock rule only fires when the pattern
    // is <pre><code>…</code></pre>. Many platforms (Reddit, Discourse, Ghost,
    // legacy WordPress, some wikis) emit bare <pre>…</pre> instead.
    // This rule is mutually exclusive with the built-in one: it only fires when
    // there is NO <code> child, so the two rules can never conflict.
    // data-mds-lang is optionally set by cleanDOM's language-hint detection below.
    td.addRule('barePre', {
      filter: (node) => {
        return (
          node.nodeName === 'PRE' &&
          !(node.firstChild && node.firstChild.nodeName === 'CODE')
        );
      },
      replacement: (content, node) => {
        const lang = node.getAttribute('data-mds-lang') || '';
        // Use textContent (not content arg) because the content arg has already
        // been through Turndown's escape() which corrupts code characters.
        // Apply decodeHTMLEntities because some platforms double-encode inside <pre>.
        const code = decodeHTMLEntities(node.textContent).replace(/\n$/, '');
        // Dynamically size the fence to avoid conflicts with any backtick runs in the code.
        const fenceSize = Math.max(3, (code.match(/`{3,}/gm) || [])
          .reduce((m, s) => Math.max(m, s.length + 1), 3));
        const fence = '`'.repeat(fenceSize);
        return `\n\n${fence}${lang}\n${code}\n${fence}\n\n`;
      }
    });

    // ── FIX 2: Inline <code> with entity decoding ───────────────────────────────
    // Overrides Turndown's built-in inline code rule (addRule uses unshift so ours
    // wins). The filter is identical to the built-in rule so there is no ambiguity.
    // The only addition is a decodeHTMLEntities() call on the content before
    // backtick-wrapping, which fixes the double-encoding problem described above.
    td.addRule('inlineCodeDecoded', {
      filter: (node) => {
        const hasSiblings = node.previousSibling || node.nextSibling;
        const isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;
        return node.nodeName === 'CODE' && !isCodeBlock;
      },
      replacement: (content) => {
        if (!content) return '';
        // content here is the result of processing child nodes, which for a
        // leaf <code> element is just the escaped text. We decode the residual
        // entity layer left by platforms that double-encode angle brackets etc.
        let text = decodeHTMLEntities(content).replace(/\r?\n|\r/g, ' ');
        const extraSpace = /^`|^ .*?[^ ].* $|`$/.test(text) ? ' ' : '';
        let delimiter = '`';
        const matches = text.match(/`+/gm) || [];
        while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`';
        return delimiter + extraSpace + text + extraSpace + delimiter;
      }
    });

    // ── Rich inline elements ────────────────────────────────
    // GFM strikethrough
    td.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (c) => c.trim() ? `~~${c}~~` : ''
    });
    // Highlight (supported by many AI renderers)
    td.addRule('mark', {
      filter: 'mark',
      replacement: (c) => c.trim() ? `==${c}==` : ''
    });
    // Superscript / subscript → keep readable
    td.addRule('sup', { filter: 'sup', replacement: (c) => c ? `^${c}^` : '' });
    td.addRule('sub', { filter: 'sub', replacement: (c) => c ? `~${c}~` : '' });

    // ── Structural elements ─────────────────────────────────
    // <details>/<summary> → bold summary + indented body
    td.addRule('summary', { filter: 'summary', replacement: () => '' }); // handled by details
    td.addRule('details', {
      filter: 'details',
      replacement: (content, node) => {
        const summary = node.querySelector('summary');
        const title   = summary ? summary.textContent.trim() : 'Details';
        // strip the summary text that was already returned as '' from the content
        const body = content.replace(/^\s+/, '').trim();
        return `\n\n**${title}**\n\n${body}\n\n`;
      }
    });

    // Definition lists → bold term + indented definition
    td.addRule('dtdd', { filter: ['dt', 'dd'], replacement: () => '' }); // handled by dl
    td.addRule('dl', {
      filter: 'dl',
      replacement: (content, node) => {
        const parts = [];
        node.querySelectorAll('dt, dd').forEach(el => {
          const clone = el.cloneNode(true);
          const text = td.turndown(clone.innerHTML).replace(/[\r\n]+/g, ' ').trim();
          parts.push(el.tagName === 'DT' ? `**${text}**` : `  ${text}`);
        });
        return '\n\n' + parts.join('\n') + '\n\n';
      }
    });

    // Keyboard shortcuts
    td.addRule('kbd', {
      filter: 'kbd',
      replacement: (c) => c ? `\`${c}\`` : ''
    });

    // Abbreviations → keep title as footnote-like
    td.addRule('abbr', {
      filter: 'abbr',
      replacement: (c, node) => {
        const title = node.getAttribute('title');
        return title ? `${c} _(${title})_` : c;
      }
    });

    // ── Clean headings ─────────────────────────────────────
    // Many frameworks put decorative block children (hash-anchor divs, icon divs)
    // inside <h1>–<h6>. Those block children inject \n\n, producing garbled output.
    // This rule collapses all internal whitespace/newlines to a single space.
    td.addRule('cleanHeadings', {
      filter: ['h1','h2','h3','h4','h5','h6'],
      replacement: (content, node) => {
        const level = Number(node.nodeName.charAt(1));
        // Collapse block-element-induced newlines and extra whitespace
        const clean = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) return '';
        return `\n\n${'#'.repeat(level)} ${clean}\n\n`;
      }
    });

    // ── ARIA-role tables ───────────────────────────────────
    // Some frameworks (GitBook, Notion exports, etc.) build tables entirely
    // out of <div> elements with role="table/row/columnheader/cell".
    // We suppress the internals and handle the container directly.
    td.addRule('ariaTableInternals', {
      filter: (node) => {
        const r = node.getAttribute?.('role');
        return ['rowgroup','row','columnheader','cell','rowheader'].includes(r);
      },
      replacement: () => ''
    });
    td.addRule('ariaTable', {
      filter: (node) => node.getAttribute?.('role') === 'table' || node.getAttribute?.('role') === 'grid',
      replacement: (content, node) => ariaTableToMarkdown(node, td)
    });

    // ── HTML <table> support ────────────────────────────────
    // Suppress TurndownService's default pass-through for table internals;
    // the 'table' rule below reads the DOM node directly and renders GFM.
    td.addRule('tableInternals', {
      filter: ['thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
      replacement: () => ''
    });
    td.addRule('table', {
      filter: 'table',
      replacement: (content, node) => tableNodeToMarkdown(node, td)
    });

    return td;
  }

  // Convert a <table> DOM node to a GFM markdown table string.
  // Handles: thead/tbody, th-first-row, fully headerless tables.
  // Extract cell text while preserving word boundaries at <br> elements.
  // Without this, `textContent` concatenates adjacent words from split lines.
  // Extract cell content as inline Markdown using the active Turndown instance.
  // This preserves links, code, bold etc. inside table cells instead of stripping them.
  // <br> elements are replaced before conversion so words don't concatenate.
  function getSafeCellText(cell, td) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    return td.turndown(clone.innerHTML)
      .replace(/[\r\n]+/g, ' ')
      .replace(/\|/g, '\\|')
      .trim() || ' ';
  }

  function tableNodeToMarkdown(node, td) {
    const allRows = Array.from(node.rows); // HTMLTableElement.rows — scope-aware, excludes nested tables
    if (!allRows.length) return '';

    // Build a virtual 2D grid to correctly handle both rowspan and colspan.
    // Without this, rowspan causes subsequent rows to appear one cell short,
    // shifting all columns left and producing broken GFM pipe syntax.
    const grid = [];
    let maxCols = 0;

    for (let r = 0; r < allRows.length; r++) {
      grid[r] = grid[r] || [];
      let c = 0;
      for (const cell of allRows[r].cells) {
        while (grid[r][c] !== undefined) c++; // skip slots occupied by a previous rowspan
        const text = getSafeCellText(cell, td);
        const rowSp = cell.rowSpan || 1;
        const colSp = cell.colSpan || 1;
        for (let i = 0; i < rowSp; i++) {
          grid[r + i] = grid[r + i] || [];
          for (let j = 0; j < colSp; j++) {
            grid[r + i][c + j] = (i === 0 && j === 0) ? text : ' ';
          }
        }
        c += colSp;
      }
      maxCols = Math.max(maxCols, grid[r].length);
    }

    if (maxCols === 0) return '';

    const rowToMd = (rowArr) => {
      while (rowArr.length < maxCols) rowArr.push(' ');
      return '| ' + rowArr.join(' | ') + ' |';
    };

    const hasThead = node.querySelector('thead') || allRows[0]?.querySelector('th');
    const sep = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';

    if (hasThead && grid.length > 0) {
      const header = rowToMd(grid[0]);
      const body   = grid.slice(1).map(rowToMd).join('\n');
      return '\n\n' + header + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
    } else {
      // Fully headerless — emit an empty header row so GFM stays valid
      const emptyHdr = '| ' + Array(maxCols).fill(' ').join(' | ') + ' |';
      const body     = grid.map(rowToMd).join('\n');
      return '\n\n' + emptyHdr + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
    }
  }

  // Convert a [role="table"] ARIA table (div-based) to GFM markdown.
  function ariaTableToMarkdown(node, td) {
    const cellText = (cell) => getSafeCellText(cell, td);

    const rowToMd = (row) => {
      const cells = Array.from(row.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]'));
      return cells.length ? '| ' + cells.map(cellText).join(' | ') + ' |' : null;
    };

    const allRows = Array.from(node.querySelectorAll('[role="row"]'));
    if (!allRows.length) return '';

    const headerRow = allRows.find(r =>
      r.querySelector('[role="columnheader"],[role="rowheader"]') &&
      !r.querySelector('[role="cell"],[role="gridcell"]')
    );
    const bodyRows = allRows.filter(r => r !== headerRow &&
      r.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]').length > 0
    );

    let headers, colCount;
    if (headerRow) {
      headers = Array.from(
        headerRow.querySelectorAll('[role="columnheader"],[role="rowheader"]')
      ).map(cellText);
      colCount = headers.length;
    } else {
      colCount = Math.max(...bodyRows.map(r =>
        r.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]').length
      ), 1);
      headers = Array(colCount).fill(' ');
    }

    const header = '| ' + headers.join(' | ') + ' |';
    const sep    = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    const body   = bodyRows.map(rowToMd).filter(Boolean).join('\n');

    return '\n\n' + header + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
  }

  // ── DOM cleanup ──────────────────────────────────────────
  function cleanDOM(root) {
    // Decorative heading anchors — hash-link stubs injected by frameworks like
    // GitBook, Docusaurus, Nextra etc. They live inside <h1>–<h6> as block divs
    // containing only a # icon link. Remove them before Turndown sees the heading
    // so they don't inject spurious \n\n into the heading content.
    root.querySelectorAll(
      'h1 [aria-label*="link to"],h1 [aria-label*="anchor"],h1 [aria-label*="permalink"],' +
      'h2 [aria-label*="link to"],h2 [aria-label*="anchor"],h2 [aria-label*="permalink"],' +
      'h3 [aria-label*="link to"],h3 [aria-label*="anchor"],h3 [aria-label*="permalink"],' +
      'h4 [aria-label*="link to"],h4 [aria-label*="anchor"],h4 [aria-label*="permalink"],' +
      'h5 [aria-label*="link to"],h5 [aria-label*="anchor"],h5 [aria-label*="permalink"],' +
      'h6 [aria-label*="link to"],h6 [aria-label*="anchor"],h6 [aria-label*="permalink"]'
    ).forEach(el => el.closest('div,span')?.remove() || el.remove());

    // Hash-icon wrapper divs inside headings (GitBook pattern: class contains "hash")
    root.querySelectorAll('h1 > div, h2 > div, h3 > div, h4 > div, h5 > div, h6 > div').forEach(div => {
      // If the div contains only an anchor (with SVG/icon) and no real text, remove it
      const text = div.textContent.trim();
      if (!text || text === '#') div.remove();
    });

    // Hard-remove structural noise
    root.querySelectorAll(
      'script,style,noscript,template,' +
      'nav,header,footer,aside,' +
      'link[rel="stylesheet"],svg,canvas,iframe,form'
    ).forEach(el => el.remove());

    // ARIA landmark noise
    root.querySelectorAll(
      '[role="navigation"],[role="banner"],[role="complementary"],' +
      '[role="search"],[role="dialog"],[role="alert"],[role="status"],' +
      '[role="toolbar"],[role="menu"],[role="menubar"]'
    ).forEach(el => el.remove());

    // Visibility / hidden
    root.querySelectorAll(
      '[hidden],[aria-hidden="true"],' +
      '[style*="display:none"],[style*="display: none"],' +
      '[style*="visibility:hidden"],[style*="visibility: hidden"]'
    ).forEach(el => el.remove());

    // Common ad / cookie / widget class patterns (case-insensitive via filter)
    // Strict UI-patterns — bound to structural suffixes to avoid false positives
    // e.g. "cookie-recipe" or "pagination-tutorial" must NOT be removed
    const noisePatterns = /((cookie|gdpr)[_-]?(banner|notice|bar|alert|consent)|(popup|modal|overlay|advert|sidebar|breadcrumb|pagination)[_-]?(wrap|container|box|nav|ui|area|region|widget|block|panel)|share[_-]?(buttons?|widget|bar)|social[_-](share|sharing|buttons?|widget|bar|media[_-]?(links?|icons?))|newsletter[_-]?(box|signup|form)?|related[_-]?(posts?|articles?|content)|\btoc\b|table-of-contents|back-to-top|skip-to|print-only)/i;
    root.querySelectorAll('[class],[id]').forEach(el => {
      const cn = (el.getAttribute('class') || '') + ' ' + (el.getAttribute('id') || '');
      if (noisePatterns.test(cn)) el.remove();
    });

    // Remove CSS-hidden elements tagged by convertPage before cloning
    root.querySelectorAll('[data-mds-hidden]').forEach(el => el.remove());

    // Remove the sidebar itself if cloned
    root.querySelector('#mds-root')?.remove();
    root.querySelector('#mds-handle')?.remove();
    root.querySelector('#mds-toast')?.remove();

    mergeOrphanedTables(root);

    // ── FIX 1 (part 2): Language-hint paragraph detection ─────────────────────
    // Detect <p>bash</p> (or any LANG_HINTS token) that immediately precedes a
    // bare <pre>. Tag the <pre> with data-mds-lang and remove the hint paragraph
    // so the barePre Turndown rule can emit a properly language-tagged fence.
    // This is a global fix: it fires on any platform that uses this pattern,
    // not just Reddit. Guarded by LANG_HINTS to avoid false positives on short
    // content paragraphs that happen to precede a code block.
    root.querySelectorAll('pre').forEach(pre => {
      const prev = pre.previousElementSibling;
      if (prev && prev.tagName === 'P') {
        const hint = prev.textContent.trim().toLowerCase();
        if (LANG_HINTS.has(hint)) {
          pre.setAttribute('data-mds-lang', hint);
          prev.remove();
        }
      }
    });
  }

  // Some sites (e.g. sticky-header patterns) split a logical table into two
  // sibling <table> elements: one holding only <thead>, another only <tbody>.
  // TurndownService processes each table independently and produces broken output.
  // This function detects such pairs and merges them into a single table.
  function mergeOrphanedTables(root) {
    const tables = Array.from(root.querySelectorAll('table'));
    const processed = new Set();
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      if (processed.has(t)) continue;
      const hasThead = !!t.querySelector('thead');
      const hasTbody = !!t.querySelector('tbody');
      // thead-only table → scan forward for orphaned tbody-only tables
      if (hasThead && !hasTbody) {
        for (let j = i + 1; j < tables.length; j++) {
          const t2 = tables[j];
          if (processed.has(t2)) continue;
          if (!t2.querySelector('thead') && t2.querySelector('tbody')) {
            Array.from(t2.querySelectorAll('tbody')).forEach(tb => t.appendChild(tb));
            t2.remove();
            processed.add(t2);
          }
        }
      }
      // tbody-only table → scan backward for an orphaned thead-only table
      if (!hasThead && hasTbody) {
        for (let j = i - 1; j >= 0; j--) {
          const t2 = tables[j];
          if (processed.has(t2)) continue;
          if (t2.querySelector('thead') && !t2.querySelector('tbody')) {
            Array.from(t.querySelectorAll('tbody')).forEach(tb => t2.appendChild(tb));
            t.remove();
            processed.add(t);
            break;
          }
        }
      }
    }
  }

  function getMainContent(doc) {
    // Ordered by specificity — pick the first match with meaningful text
    const candidates = [
      '[itemprop="articleBody"]',
      'main[role="main"]',
      '[role="main"]',
      'main',
      'article',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.article-body',
      '.story-body',
      '.content-body',
      '.page-content',
      '.main-content',
      '#content',
      '#main',
      '#article',
    ];
    for (const sel of candidates) {
      try {
        const el = doc.querySelector(sel);
        if (el && el.textContent.trim().length > 150) return el;
      } catch {}
    }
    return doc.body;
  }

  // ── Markdown converters ──────────────────────────────────
  function buildFrontmatter(url, title, lang) {
    const safeTitle = (title || 'Untitled')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .trim();
    const safeUrl = (url || '').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safeLang = lang || navigator.language || 'en';
    return `---\nurl: "${safeUrl}"\ntitle: "${safeTitle}"\ndate: "${new Date().toISOString()}"\nlang: "${safeLang}"\n---\n\n`;
  }

  function convertPage(opts) {
    const td = getTurndown(opts);
    const source = getMainContent(document);
    const hiddenEls = [];

    if (opts.clean) {
      // Evaluate computed CSS visibility in the live DOM *before* cloning.
      // Cloned nodes are detached from stylesheets — getComputedStyle returns
      // misleading defaults on them. Tag hidden elements now, remove after clone.
      const walker = document.createTreeWalker(source, NodeFilter.SHOW_ELEMENT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        // Cascade skipping: if the parent is already tagged hidden, all children
        // are implicitly hidden — skip getComputedStyle to avoid thousands of reflows
        if (node.parentElement?.hasAttribute('data-mds-hidden')) {
          node.setAttribute('data-mds-hidden', '');
          hiddenEls.push(node);
          continue;
        }
        // Prefer checkVisibility() (no forced reflow) over getComputedStyle (synchronous reflow)
        let isHidden = false;
        if (typeof node.checkVisibility === 'function') {
          isHidden = !node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        } else {
          const s = window.getComputedStyle(node);
          isHidden = s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
        }
        if (isHidden) {
          node.setAttribute('data-mds-hidden', '');
          hiddenEls.push(node);
        }
      }
    }

    let root;
    try {
      root = source.cloneNode(true);
    } finally {
      // Guarantee live-DOM cleanup even if cloneNode throws (OOM, cross-origin, etc.)
      hiddenEls.forEach(el => el.removeAttribute('data-mds-hidden'));
    }

    if (opts.clean) cleanDOM(root);
    resolveUrls(root);
    const md = postProcessMarkdown(td.turndown(root.innerHTML));
    return opts.title ? buildFrontmatter(location.href, document.title) + md : md;
  }

  // Resolve relative hrefs/srcs to absolute URLs using the browser's own resolver.
  // Without this, Turndown emits /pricing instead of https://example.com/pricing —
  // useless for an AI that has no idea which domain the page belongs to.
  function resolveUrls(root) {
    root.querySelectorAll('a[href]').forEach(el => {
      try {
        const attr = el.getAttribute('href') || '';
        // Skip empty, anchor-only, and javascript: hrefs — nothing to resolve.
        if (!attr || attr === '#' || attr.startsWith('javascript:')) return;
        let resolved;
        try {
          // Use new URL() with explicit base rather than el.href (IDL attribute),
          // because el.href can return '' for detached/cloned nodes in some browsers
          // even when getAttribute('href') returns the correct content attribute value.
          resolved = new URL(attr, location.href).href;
        } catch {
          resolved = attr; // unparseable URL — keep as-is
        }
        if (resolved) {
          el.setAttribute('href', resolved);
          // Backup attribute: our robustLink rule reads this if href ends up
          // falsy in Turndown's internally re-parsed HTML string.
          el.setAttribute('data-mds-href', resolved);
        }
      } catch {}
    });
    root.querySelectorAll('img[src], source[src]').forEach(el => {
      try {
        const attr = el.getAttribute('src') || '';
        if (!attr || attr.startsWith('data:')) return;
        try { el.setAttribute('src', new URL(attr, location.href).href); } catch {}
      } catch {}
    });
    root.querySelectorAll('img[srcset]').forEach(el => {
      try {
        const resolved = el.srcset.split(',').map(part => {
          const [u, ...rest] = part.trim().split(/\s+/);
          try { return [new URL(u, location.href).href, ...rest].join(' '); } catch { return part.trim(); }
        }).join(', ');
        el.setAttribute('srcset', resolved);
      } catch {}
    });
  }

  function convertSelection(opts) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    if (!sel.toString().trim()) return null;
    if (sel.anchorNode && sidebarEl?.contains(sel.anchorNode)) return null;
    const frag = sel.getRangeAt(0).cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);
    // Clean hidden/noise elements from selection just like a full page copy
    if (opts.clean) cleanDOM(div);
    resolveUrls(div);
    return postProcessMarkdown(getTurndown(opts).turndown(div.innerHTML));
  }

  // ── Remote URL fetch ─────────────────────────────────────
  function fetchUrlAsMarkdown(url, opts) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 15000,
        headers: { 'Accept': 'text/html' },
        onload(resp) {
          if (resp.status >= 400) {
            reject(new Error(`HTTP ${resp.status}: ${resp.statusText || 'Error'}`));
            return;
          }
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(resp.responseText, 'text/html');
            // Resolve URLs against <base href> if present, else against the fetch URL
            const baseTag = doc.querySelector('base[href]');
            const baseUrl = baseTag ? new URL(baseTag.getAttribute('href'), url).href : url;

            doc.querySelectorAll('a[href]').forEach(a => {
              try { a.setAttribute('href', new URL(a.getAttribute('href'), baseUrl).href); } catch {}
            });
            doc.querySelectorAll('img[src], source[srcset]').forEach(el => {
              if (el.hasAttribute('src')) {
                try { el.setAttribute('src', new URL(el.getAttribute('src'), baseUrl).href); } catch {}
              }
              // Remove srcset — Turndown cannot parse it and relative srcset produces broken URLs
              if (el.hasAttribute('srcset')) el.removeAttribute('srcset');
            });
            const pageTitle = doc.title || url;
            const pageLang = doc.documentElement.getAttribute('lang') || undefined;
            const root = getMainContent(doc).cloneNode(true);
            if (opts.clean) cleanDOM(root);
            const td = getTurndown(opts);
            const md = postProcessMarkdown(td.turndown(root.innerHTML));
            const result = opts.title ? buildFrontmatter(url, pageTitle, pageLang) + md : md;
            resolve({ markdown: result, title: pageTitle });
          } catch (e) { reject(e); }
        },
        onerror(e) { reject(new Error('Network error: ' + (e.statusText || e.status || 'failed'))); },
        ontimeout() { reject(new Error('Request timed out after 15s')); }
      });
    });
  }

  // ── Storage ──────────────────────────────────────────────
  function saveToHistory(markdown, copyType, title, url) {
    const stored = GM_getValue(STORAGE_KEY, []);
    const history = Array.isArray(stored) ? stored : [];
    history.unshift({
      id: Date.now().toString(),
      markdown,
      title: title || document.title,
      url: url || location.href,
      copyType,
      timestamp: Date.now()
    });
    if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
    GM_setValue(STORAGE_KEY, history);
  }

  function getHistory() {
    const stored = GM_getValue(STORAGE_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }
  function deleteHistoryItem(id) {
    GM_setValue(STORAGE_KEY, getHistory().filter(item => item.id !== id));
  }

  // ── Clipboard ────────────────────────────────────────────
  async function copyToClipboard(text) {
    // GM_setClipboard bypasses browser Transient User Activation restrictions (async fetch, etc.)
    try { GM_setClipboard(text, 'text'); return true; } catch {}
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      // Last-resort fallback for restrictive environments / Greasemonkey forks
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg, type = '') {
    let t = document.getElementById('mds-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mds-toast';
      // Always append to body — transformed ancestors (e.g. sidebarEl) become
      // containing blocks for position:fixed, which breaks toast positioning
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = type;
    requestAnimationFrame(() => t.classList.add('mds-toast-show'));
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('mds-toast-show'), 2200);
  }

  // ── Helpers ──────────────────────────────────────────────
  function esc(text) {
    return String(text)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function formatTime(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }
  function typeLabel(t) {
    return {copyPage:'Page',copySelection:'Selection',copyImage:'Image',copyLink:'Link',copyUrl:'URL'}[t] || t;
  }

  // ── Sidebar preview/history rendering ────────────────────
  function setPreview(md, sourceLabel = '') {
    currentMarkdown = md;
    const el = document.getElementById('mds-preview');
    const src = document.getElementById('mds-preview-source');
    if (el) el.textContent = md;
    if (src) src.textContent = sourceLabel;
  }

  function setPreviewLoading() {
    const el = document.getElementById('mds-preview');
    if (el) el.innerHTML = '<span class="mds-loading"></span>';
  }

  function setPreviewError(msg) {
    const el = document.getElementById('mds-preview');
    if (el) el.innerHTML = `<span style="color:var(--red,#f87171)">${esc(msg)}</span>`;
  }

  function generatePagePreview() {
    setPreviewLoading();
    const run = () => {
      try {
        const md = convertPage(getOpts());
        setPreview(md, location.hostname);
      } catch (e) {
        setPreviewError('Error: ' + e.message);
      }
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }

  function renderHistory() {
    const listEl = document.getElementById('mds-history-list');
    if (!listEl) return;
    const history = getHistory();
    if (!history.length) {
      listEl.innerHTML = '<div class="mds-empty">No history yet</div>';
      return;
    }
    listEl.innerHTML = history.map(item => `
      <div class="mds-hist-item">
        <div class="mds-hist-row1">
          <span class="mds-hist-badge">${esc(typeLabel(item.copyType))}</span>
          <span class="mds-hist-time">${esc(formatTime(item.timestamp))}</span>
        </div>
        <div class="mds-hist-title">${esc(item.title || item.url || '')}</div>
        <div class="mds-hist-preview">${esc(item.markdown.slice(0, 110))}${item.markdown.length > 110 ? '…' : ''}</div>
        <div class="mds-hist-actions">
          <button class="mds-hist-btn" data-id="${esc(item.id)}">Copy</button>
          <button class="mds-hist-btn del" data-id="${esc(item.id)}">Delete</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.mds-hist-btn:not(.del)').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.id;
        const item = getHistory().find(h => h.id === id);
        if (!item) { showToast('✗ Not found', 'err'); return; }
        const ok = await copyToClipboard(item.markdown);
        showToast(ok ? '✓ Copied' : '✗ Failed', ok ? 'ok' : 'err');
      });
    });
    listEl.querySelectorAll('.mds-hist-btn.del').forEach(btn => {
      btn.addEventListener('click', e => {
        deleteHistoryItem(e.currentTarget.dataset.id);
        renderHistory();
      });
    });
  }

  // ── Interactive click modes ──────────────────────────────
  let activeClickMode = null;
  let _clickListener = null;
  let _keyListener = null;
  let _hoverStyle = null;
  let _toastTimer = null;
  let _cachedTurndown = null;
  let _cachedOptsKey = '';

  function getTurndown(opts) {
    const key = JSON.stringify(opts);
    if (_cachedTurndown && _cachedOptsKey === key) return _cachedTurndown;
    _cachedTurndown = createTurndown(opts);
    _cachedOptsKey = key;
    return _cachedTurndown;
  }
  function startClickMode(mode, hint, selector, handler) {
    if (activeClickMode) stopClickMode();
    activeClickMode = mode;
    const btn = document.getElementById(mode === 'img' ? 'mds-act-img' : 'mds-act-link');
    if (btn) btn.classList.add('mds-active-mode');
    showToast(hint + ' (Esc to cancel)');

    // Visual crosshair feedback — dashed amber outline on hover targets
    _hoverStyle = document.createElement('style');
    const targetSel = mode === 'img' ? 'img' : 'a[href]';
    _hoverStyle.textContent = `${targetSel}:hover { outline: 3px dashed #f59e0b !important; outline-offset: 2px !important; cursor: crosshair !important; opacity: 0.85 !important; }`;
    document.head.appendChild(_hoverStyle);

    // Escape key cancels the mode
    _keyListener = (e) => { if (e.key === 'Escape') stopClickMode(); };
    document.addEventListener('keydown', _keyListener, true);

    const listener = async (e) => {
      // Clicks inside the sidebar itself must not trigger or cancel the mode
      if (sidebarEl?.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const target = selector(e);
      if (!target) {
        // Graceful exit: click landed on empty space — cancel instead of trapping the user
        stopClickMode();
        showToast('Cancelled');
        return;
      }
      const md = handler(target);
      const ok = await copyToClipboard(md);
      if (ok) saveToHistory(md, mode === 'img' ? 'copyImage' : 'copyLink');
      showToast(ok ? '✓ Copied' : '✗ Failed', ok ? 'ok' : 'err');
      setPreview(md, mode === 'img' ? 'image' : 'link');
      stopClickMode();
    };
    _clickListener = listener;
    document.addEventListener('click', listener, true);
  }

  function stopClickMode() {
    if (_clickListener) {
      document.removeEventListener('click', _clickListener, true);
      _clickListener = null;
    }
    if (_keyListener) {
      document.removeEventListener('keydown', _keyListener, true);
      _keyListener = null;
    }
    if (_hoverStyle) {
      _hoverStyle.remove();
      _hoverStyle = null;
    }
    document.getElementById('mds-act-img')?.classList.remove('mds-active-mode');
    document.getElementById('mds-act-link')?.classList.remove('mds-active-mode');
    activeClickMode = null;
  }

  // ── Handle (edge tab) ────────────────────────────────────
  function buildHandle() {
    ensureCSS();
    const el = document.createElement('button');
    el.id = 'mds-handle';
    el.title = 'Open Markdown Sidebar';
    el.setAttribute('data-theme', currentTheme);
    el.innerHTML = '<span>M↓</span>';
    document.body.appendChild(el);
    el.addEventListener('click', () => {
      if (!sidebarEl || sidebarEl.classList.contains('hidden')) {
        showSidebar();
      } else {
        hideSidebar();
      }
    });
    return el;
  }

  function showHandle() {
    if (!handleEl) handleEl = buildHandle();
    handleEl.classList.remove('mds-handle-hidden');
  }
  function hideHandle() {
    handleEl?.classList.add('mds-handle-hidden');
    hideSidebar();
  }

  // ── Theme ────────────────────────────────────────────────
  function applyTheme(theme) {
    currentTheme = theme;
    GM_setValue('mds_theme', theme);
    sidebarEl?.setAttribute('data-theme', theme);
    handleEl?.setAttribute('data-theme', theme);
    const btn = document.getElementById('mds-theme-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
  }

  // ── Show / hide sidebar ──────────────────────────────────
  function showSidebar() {
    if (!sidebarEl) sidebarEl = buildSidebar();
    // Always restore persisted options on every open
    const savedOpts = loadOpts();
    const optEl = (id) => sidebarEl.querySelector(id);
    if (optEl('#mds-opt-title'))   optEl('#mds-opt-title').checked   = savedOpts.title;
    if (optEl('#mds-opt-nolinks')) optEl('#mds-opt-nolinks').checked = savedOpts.nolinks;
    if (optEl('#mds-opt-clean'))   optEl('#mds-opt-clean').checked   = savedOpts.clean;
    sidebarEl.setAttribute('data-theme', currentTheme);
    sidebarEl.classList.remove('hidden');
    handleEl?.classList.add('mds-handle-open');
    generatePagePreview();
    setTimeout(() => sidebarEl.querySelector('#mds-url-input')?.focus(), 300);
  }
  function hideSidebar() {
    stopClickMode();
    sidebarEl?.classList.add('hidden');
    handleEl?.classList.remove('mds-handle-open');
  }

  // ── Build sidebar DOM ────────────────────────────────────
  function buildSidebar() {
    ensureCSS();
    const el = document.createElement('div');
    el.id = 'mds-root';
    el.className = 'hidden';
    el.innerHTML = SIDEBAR_HTML;
    document.body.appendChild(el);

    // Restore persisted options
    const savedOpts = loadOpts();
    if (el.querySelector('#mds-opt-title'))   el.querySelector('#mds-opt-title').checked   = savedOpts.title;
    if (el.querySelector('#mds-opt-nolinks')) el.querySelector('#mds-opt-nolinks').checked = savedOpts.nolinks;
    if (el.querySelector('#mds-opt-clean'))   el.querySelector('#mds-opt-clean').checked   = savedOpts.clean;

    // Restore theme button label
    const themeBtnEl = el.querySelector('#mds-theme-btn');
    if (themeBtnEl) themeBtnEl.textContent = currentTheme === 'dark' ? '☀' : '☾';

    // Close
    el.querySelector('#mds-close').addEventListener('click', hideSidebar);

    // Theme toggle
    themeBtnEl?.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // Copy page
    el.querySelector('#mds-act-page').addEventListener('click', async () => {
      const opts = getOpts();
      try {
        const md = convertPage(opts);
        const ok = await copyToClipboard(md);
        if (ok) saveToHistory(md, 'copyPage');
        showToast(ok ? '✓ Page copied' : '✗ Failed', ok ? 'ok' : 'err');
        setPreview(md, location.hostname);
      } catch (e) { showToast('✗ ' + e.message, 'err'); }
    });

    // Copy selection
    el.querySelector('#mds-act-sel').addEventListener('click', async () => {
      const md = convertSelection(getOpts());
      if (!md) { showToast('No text selected', 'err'); return; }
      const ok = await copyToClipboard(md);
      if (ok) saveToHistory(md, 'copySelection');
      showToast(ok ? '✓ Selection copied' : '✗ Failed', ok ? 'ok' : 'err');
      setPreview(md, 'selection');
    });

    // Copy image — click mode
    el.querySelector('#mds-act-img').addEventListener('click', () => {
      if (activeClickMode === 'img') { stopClickMode(); return; }
      startClickMode('img', 'Click any image…',
        (e) => e.target.tagName === 'IMG' ? e.target : null,
        (imgEl) => {
          const alt = imgEl.alt || imgEl.src.split('/').pop()?.split('?')[0] || 'image';
          return `![${alt}](${imgEl.src})`;
        }
      );
    });

    // Copy link — click mode
    el.querySelector('#mds-act-link').addEventListener('click', () => {
      if (activeClickMode === 'link') { stopClickMode(); return; }
      startClickMode('link', 'Click any link…',
        (e) => e.target.closest('a[href]'),
        (aEl) => {
          const text = aEl.textContent.trim() || aEl.href;
          return `[${text}](${aEl.href})`;
        }
      );
    });

    // Options changes → persist + refresh preview if visible
    ['mds-opt-title','mds-opt-nolinks','mds-opt-clean'].forEach(id => {
      el.querySelector('#' + id)?.addEventListener('change', () => {
        saveOpts();
        if (!el.querySelector('#mds-panel-preview').classList.contains('hidden')) {
          generatePagePreview();
        }
      });
    });

    // URL fetch
    const urlInput = el.querySelector('#mds-url-input');
    const fetchBtn = el.querySelector('#mds-url-fetch');
    const doFetch = async () => {
      const url = urlInput.value.trim();
      if (!url) return;
      fetchBtn.disabled = true;
      fetchBtn.textContent = '…';
      setPreviewLoading();
      try {
        const { markdown, title } = await fetchUrlAsMarkdown(url, getOpts());
        saveToHistory(markdown, 'copyUrl', title, url);
        setPreview(markdown, new URL(url).hostname);
        // Switch to preview tab
        switchTab('preview');
        const ok = await copyToClipboard(markdown);
        showToast(ok ? '✓ Fetched & copied' : '✓ Fetched', 'ok');
      } catch (e) {
        setPreviewError('Fetch failed: ' + e.message);
        showToast('✗ ' + e.message, 'err');
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch →';
      }
    };
    fetchBtn.addEventListener('click', doFetch);
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') doFetch(); });

    // Tabs
    el.querySelector('#mds-tab-preview').addEventListener('click', () => switchTab('preview'));
    el.querySelector('#mds-tab-history').addEventListener('click', () => switchTab('history'));

    // Copy preview button
    el.querySelector('#mds-copy-preview').addEventListener('click', async () => {
      if (!currentMarkdown) return;
      const ok = await copyToClipboard(currentMarkdown);
      saveToHistory(currentMarkdown, 'copyPage');
      showToast(ok ? '✓ Copied' : '✗ Failed', ok ? 'ok' : 'err');
    });

    return el;
  }

  function switchTab(which) {
    const el = sidebarEl;
    if (!el) return;
    el.querySelector('#mds-tab-preview').classList.toggle('active', which === 'preview');
    el.querySelector('#mds-tab-history').classList.toggle('active', which === 'history');
    el.querySelector('#mds-panel-preview').classList.toggle('hidden', which !== 'preview');
    el.querySelector('#mds-panel-history').classList.toggle('hidden', which !== 'history');
    if (which === 'history') renderHistory();
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Menu command toggles the edge handle (not the sidebar directly).
    // If handle is already visible, hide it (and any open sidebar).
    // If handle is hidden/absent, show it.
    GM_registerMenuCommand('↓ Markdown Sidebar', () => {
      if (handleEl && !handleEl.classList.contains('mds-handle-hidden')) {
        hideHandle();
      } else {
        showHandle();
      }
    });
  }

  init(); // @run-at document-idle guarantees DOM is always ready

})();
```

---

## Crunchyroll Enhanced — v4.4

- **Datei:** `Crunchyroll Enhanced.user.js`
- **Matches:** https://*.crunchyroll.com/*
- **Grants:** GM_addStyle, GM_setValue, GM_getValue
- **Beschreibung:** Sidebar (page-push) mit Multi-Filter & Sort für Crunchyroll Browse — Auto-Scan, Retry, Export/Clipboard, Nur-mit-Daten-Filter

```javascript
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

```

---

## Epic Games Library Export — v6.3

- **Datei:** `Epic Games Library Export.user.js`
- **Matches:** https://www.epicgames.com/account/transactions*
- **Grants:** GM_addStyle, GM_setClipboard, GM_registerMenuCommand
- **Beschreibung:** High-Performance Exporter. Start via Tampermonkey menu.

```javascript
// ==UserScript==
// @name         Epic Games Library Export
// @namespace    http://tampermonkey.net/
// @version      6.3
// @description  High-Performance Exporter. Start via Tampermonkey menu.
// @author       marmoris
// @match        https://www.epicgames.com/account/transactions*
// @icon         https://static-assets-prod.epicgames.com/epic-store/static/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Epic%20Games%20Library%20Export.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Epic%20Games%20Library%20Export.user.js
// ==/UserScript==

(function() {
    'use strict';

    GM_registerMenuCommand('Epic Library Export starten', run);

    function run() {

    // Falls das Panel bereits offen ist, Fokus darauf setzen statt neu zu erstellen
    if (document.getElementById('ep-panel')) {
        document.getElementById('ep-panel').classList.remove('ep-hidden');
        document.getElementById('ep-minimized').classList.remove('ep-visible');
        return;
    }

    // --- KONFIGURATION ---
    const CONFIG = {
        selector: '.am-hoct6b',
        ignoreList: ['Standard Edition', 'Add-On', 'Season Pass', 'Saisonpass', 'Demo', 'Free', 'Kostenlos'],
    };

    // --- CSS STYLING ---
    const STYLES = `
        #ep-panel {
            position: fixed; top: 100px; right: 30px; width: 320px;
            background: rgba(20, 20, 20, 0.98); color: #f0f0f0; z-index: 99999;
            border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            font-family: 'Segoe UI', Roboto, Helvetica, sans-serif; font-size: 13px;
            border: 1px solid #333; backdrop-filter: blur(10px);
            transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
            opacity: 0; animation: epFadeIn 0.3s forwards;
        }
        @keyframes epFadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }

        #ep-panel.ep-hidden { opacity: 0; pointer-events: none; transform: translateX(50px); }

        #ep-header {
            background: linear-gradient(90deg, #0a0a0a 0%, #1a1a1a 100%);
            padding: 14px 18px; border-bottom: 1px solid #333;
            border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;
            font-weight: 700; letter-spacing: 0.5px; user-select: none;
        }
        #ep-header span { color: #f1c40f; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; margin-left:5px; }

        .ep-close-btn {
            cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
            border-radius: 50%; color: #666; transition: all 0.2s; font-size: 16px; line-height: 1;
        }
        .ep-close-btn:hover { background: #d63031; color: #fff; }

        #ep-body { padding: 20px; }
        .ep-stat { display: flex; justify-content: space-between; margin-bottom: 8px; color: #888; font-size: 12px; }
        .ep-stat b { color: #fff; font-weight: 600; font-family: monospace; font-size: 13px; }

        .ep-bar-bg { height: 4px; background: #333; margin: 18px 0; border-radius: 2px; overflow: hidden; }
        .ep-bar-fill { height: 100%; background: #f1c40f; width: 0%; transition: width 0.2s linear; }

        .ep-btn-group { display: flex; gap: 10px; margin-top: 10px; }
        .ep-btn {
            flex: 1; padding: 10px; border: none; border-radius: 6px;
            cursor: pointer; font-weight: 600; font-size: 11px;
            text-transform: uppercase; color: white; transition: all 0.1s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .ep-btn:hover { transform: translateY(-1px); filter: brightness(1.15); }

        .btn-start { background: linear-gradient(135deg, #0078f2, #095fb5); }
        .btn-stop { background: linear-gradient(135deg, #d63031, #c0392b); display: none; }
        .btn-action { background: #2d3436; border: 1px solid #444; }
        .btn-copy { background: linear-gradient(135deg, #00b894, #00a884); }

        #ep-export-area { border-top: 1px solid #333; margin-top: 15px; padding-top: 15px; display: none; opacity: 0; }
        .ep-msg { font-size: 10px; color: #666; margin-top: 10px; text-align: center; height: 14px; }

        #ep-minimized {
            position: fixed; top: 110px; right: 0; background: #f1c40f; color: #111;
            padding: 12px 10px 12px 14px; border-radius: 30px 0 0 30px;
            box-shadow: -2px 2px 10px rgba(0,0,0,0.3); cursor: pointer; z-index: 99998;
            font-weight: 800; font-size: 12px; transition: transform 0.3s;
            transform: translateX(100%); display: flex; align-items: center; gap: 5px;
        }
        #ep-minimized.ep-visible { transform: translateX(0); }
    `;

    GM_addStyle(STYLES);

    // --- HTML UI ---
    const uiContainer = document.createElement('div');
    uiContainer.id = 'ep-container-root';
    uiContainer.innerHTML = `
        <div id="ep-minimized">
            <span>TURBO</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 18l-6-6 6-6"/></svg>
        </div>

        <div id="ep-panel">
            <div id="ep-header">
                <div>EPIC<span>TURBO</span></div>
                <div id="ep-close" class="ep-close-btn" title="Schließen">✕</div>
            </div>
            <div id="ep-body">
                <div class="ep-stat"><span>STATUS</span><b id="ep-status">Bereit</b></div>
                <div class="ep-stat"><span>SPIELE</span><b id="ep-count">0</b></div>
                <div class="ep-stat"><span>SEITE</span><b id="ep-page">1</b></div>
                <div class="ep-bar-bg"><div id="ep-progress" class="ep-bar-fill"></div></div>
                <div class="ep-btn-group">
                    <button id="btn-start" class="ep-btn btn-start">Start</button>
                    <button id="btn-stop" class="ep-btn btn-stop">Stop</button>
                </div>
                <div id="ep-export-area">
                    <div style="margin-bottom:10px; font-weight:bold; color:#ccc; font-size:11px; text-transform:uppercase;">Exportieren</div>
                    <div class="ep-btn-group">
                        <button id="btn-txt" class="ep-btn btn-action">TXT</button>
                        <button id="btn-csv" class="ep-btn btn-action">CSV</button>
                    </div>
                    <div class="ep-btn-group">
                        <button id="btn-copy" class="ep-btn btn-copy">Kopieren</button>
                    </div>
                </div>
                <div id="ep-msg" class="ep-msg"></div>
            </div>
        </div>
    `;
    document.body.appendChild(uiContainer);

    // --- REFERENZEN & LOGIK ---
    const ui = {
        closeBtn: document.getElementById('ep-close'),
        panel: document.getElementById('ep-panel'),
        minimized: document.getElementById('ep-minimized'),
        status: document.getElementById('ep-status'),
        count: document.getElementById('ep-count'),
        page: document.getElementById('ep-page'),
        bar: document.getElementById('ep-progress'),
        msg: document.getElementById('ep-msg'),
        btnStart: document.getElementById('btn-start'),
        btnStop: document.getElementById('btn-stop'),
        exportArea: document.getElementById('ep-export-area'),
        btnTxt: document.getElementById('btn-txt'),
        btnCsv: document.getElementById('btn-csv'),
        btnCopy: document.getElementById('btn-copy')
    };

    let isRunning = false;
    let gamesSet = new Set();
    let finalSortedList = [];

    // ÄNDERUNG HIER: Schließen entfernt das Element komplett
    ui.closeBtn.onclick = () => {
        isRunning = false;
        uiContainer.remove();
    };

    ui.minimized.onclick = () => {
        ui.panel.classList.remove('ep-hidden');
        ui.minimized.classList.remove('ep-visible');
    };

    // --- DRAG ---
    const header = document.getElementById('ep-header');
    header.style.cursor = 'grab';
    header.addEventListener('mousedown', e => {
        if (e.target === ui.closeBtn || ui.closeBtn.contains(e.target)) return;
        const rect = ui.panel.getBoundingClientRect();
        const offX = e.clientX - rect.left;
        const offY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
        const onMove = e => {
            ui.panel.style.left = `${e.clientX - offX}px`;
            ui.panel.style.top  = `${e.clientY - offY}px`;
            ui.panel.style.right = 'auto';
        };
        const onUp = () => {
            header.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const scrapePage = () => {
        const nodes = document.querySelectorAll(CONFIG.selector);
        nodes.forEach(node => {
            const txt = node.innerText.trim();
            if (txt && !CONFIG.ignoreList.some(bad => txt.includes(bad))) {
                gamesSet.add(txt);
            }
        });
    };

    const finishScan = () => {
        isRunning = false;
        ui.btnStop.style.display = 'none';
        ui.btnStart.innerText = 'Neu Starten';
        ui.btnStart.style.display = 'block';
        ui.bar.style.width = '100%';
        ui.bar.style.background = '#26bb26';

        if (gamesSet.size > 0) {
            finalSortedList = Array.from(gamesSet).sort((a, b) => a.localeCompare(b)).map((title, index) => `${index + 1}. ${title}`);
            ui.exportArea.style.display = 'block';
            setTimeout(() => ui.exportArea.style.opacity = '1', 50);
            ui.status.innerText = 'FERTIG';
            ui.status.style.color = '#26bb26';
            ui.msg.innerText = `${gamesSet.size} Spiele erfasst.`;
        }
    };

    const processLoop = async () => {
        if (isRunning) return;
        isRunning = true;
        gamesSet.clear();
        let pageNum = 1;

        ui.exportArea.style.display = 'none';
        ui.btnStart.style.display = 'none';
        ui.btnStop.style.display = 'block';
        ui.bar.style.background = '#f1c40f';
        ui.status.innerText = 'TURBO SCAN...';

        while (isRunning) {
            scrapePage();
            ui.count.innerText = gamesSet.size;
            ui.page.innerText = pageNum;
            ui.bar.style.width = (pageNum % 2 === 0) ? '60%' : '90%';

            const nextBtn = document.querySelector('button[aria-label="Next Page"], #next-btn');
            const isDisabled = nextBtn?.disabled || nextBtn?.classList.contains('Mui-disabled');

            if (nextBtn && !isDisabled) {
                const prevFirstText = document.querySelector(CONFIG.selector)?.innerText;
                nextBtn.click();
                pageNum++;
                // Wait for new page content to appear instead of fixed delay
                for (let waited = 0; waited < 5000; waited += 100) {
                    await sleep(100);
                    const newFirstText = document.querySelector(CONFIG.selector)?.innerText;
                    if (newFirstText && newFirstText !== prevFirstText) break;
                }
            } else {
                break;
            }
        }
        if (isRunning) finishScan();
    };

    ui.btnStart.onclick = processLoop;
    ui.btnStop.onclick = () => { isRunning = false; ui.status.innerText = 'STOP'; };

    // Export-Funktionen (TXT, CSV, Copy)
    const downloadFile = (content, filename, type) => {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        ui.msg.innerText = `Gespeichert!`;
    };

    ui.btnTxt.onclick = () => downloadFile(finalSortedList.join('\n'), `EpicGames_Export.txt`, 'text/plain');
    ui.btnCsv.onclick = () => {
        const csv = "Nr;Spiel\n" + finalSortedList.map(line => {
            const idx = line.indexOf('. ');
            return `${line.substring(0, idx)};"${line.substring(idx + 2)}"`
        }).join('\n');
        downloadFile(csv, `EpicGames_Export.csv`, 'text/csv');
    };
    let copyTimer;
    ui.btnCopy.onclick = () => {
        GM_setClipboard(finalSortedList.join('\n'));
        ui.btnCopy.innerText = "✓ Kopiert";
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => ui.btnCopy.innerText = "Kopieren", 1000);
    };

    } // end run()

})();

```

---

## FlameComics Advanced Sort — v1.5

- **Datei:** `FlameComics Advanced Sort.user.js`
- **Matches:** https://flamecomics.xyz/*, https://www.flamecomics.xyz/*, https://flamecomics.com/*, https://www.flamecomics.com/*
- **Grants:** none
- **Beschreibung:** Adds custom sorting options (alphabetical, hearts count) to FlameComics

```javascript
// ==UserScript==
// @name         FlameComics Advanced Sort
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Adds custom sorting options (alphabetical, hearts count) to FlameComics
// @author       marmoris
// @match        https://flamecomics.xyz/*
// @match        https://www.flamecomics.xyz/*
// @match        https://flamecomics.com/*
// @match        https://www.flamecomics.com/*
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://flamecomics.xyz
// @run-at       document-end
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/FlameComics%20Advanced%20Sort.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/FlameComics%20Advanced%20Sort.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('[FlameComics Sort] Script loaded - v1.3');

    const styles = `
        .custom-sort-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            margin-top: 4px;
            background: var(--mantine-color-body, #1a1b1e);
            border: 1px solid var(--mantine-color-default-border, #373a40);
            border-radius: var(--mantine-radius-default, 4px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            z-index: 9999;
            overflow: hidden;
            min-width: 200px;
        }

        .custom-sort-option {
            padding: 10px 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--mantine-color-text, #c1c2c5);
            font-size: 14px;
            font-family: var(--mantine-font-family);
        }

        .custom-sort-option:hover {
            background: var(--mantine-color-default-hover, #25262b);
        }

        .custom-sort-option.active {
            background: var(--mantine-primary-color-filled, #228be6);
            color: white;
        }

        .sort-icon {
            width: 16px;
            height: 16px;
            opacity: 0.9;
        }

        /* Wrapper muss Block sein und 100% Breite haben, da der Original-Button data-block="true" ist */
        .sort-button-wrapper {
            position: relative;
            display: block;
            width: 100%;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    let currentSort = 'default';
    let dropdownOpen = false;

    // --- SORTIER LOGIK (Unverändert gut) ---

    function getSeriesWrappers() {
        // Suche nach inneren Karten-Containern
        const innerCards = document.querySelectorAll('[class*="DescSeriesCard_cardContainer"]');
        const wrappers = new Set();

        innerCards.forEach(card => {
            // Gehe hoch zum Mantine Grid Column
            const wrapper = card.closest('[class*="mantine-Grid-col"]');
            if (wrapper) {
                wrappers.add(wrapper);
            }
        });

        return Array.from(wrappers);
    }

    function getHeartsCount(wrapper) {
        const heartIcon = wrapper.querySelector('svg.bi-heart-fill');
        if (!heartIcon) return 0;

        const group = heartIcon.closest('[class*="mantine-Group-root"]');
        if (group) {
            const textEl = group.querySelector('p[class*="mantine-Text-root"]');
            if (textEl) {
                const text = textEl.textContent.trim();
                let multiplier = 1;
                if (text.toLowerCase().includes('k')) multiplier = 1000;
                if (text.toLowerCase().includes('m')) multiplier = 1000000;

                const num = parseFloat(text.replace(/[^0-9.]/g, ''));
                return Math.floor(num * multiplier) || 0;
            }
        }
        return 0;
    }

    function getTitle(wrapper) {
        const titleEl = wrapper.querySelector('[class*="DescSeriesCard_title"]');
        return titleEl ? titleEl.textContent.trim() : '';
    }

    function performSort(compareFunction) {
        const wrappers = getSeriesWrappers();
        if (wrappers.length === 0) return;

        const container = wrappers[0].parentElement;
        if (!container) return;

        const sortData = wrappers.map(wrapper => ({
            wrapper: wrapper,
            title: getTitle(wrapper),
            hearts: getHeartsCount(wrapper)
        }));

        sortData.sort(compareFunction);

        sortData.forEach(item => {
            container.appendChild(item.wrapper);
        });
    }

    const sortActions = {
        'alpha-asc': () => performSort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true})),
        'alpha-desc': () => performSort((a, b) => b.title.localeCompare(a.title, undefined, {numeric: true})),
        'hearts-desc': () => performSort((a, b) => b.hearts - a.hearts),
        'hearts-asc': () => performSort((a, b) => a.hearts - b.hearts)
    };

    // --- UI LOGIK ---

    function createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-sort-dropdown';

        const options = [
            { id: 'alpha-asc', text: 'Alphabetical (A-Z)', icon: 'M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371zm1.57-.785L11 2.687h-.047l-.652 2.157z M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645zm-8.46-.5a.5.5 0 0 1-1 0V3.707L2.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.5.5 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L4.5 3.707z' },
            { id: 'alpha-desc', text: 'Alphabetical (Z-A)', icon: 'M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371zm1.57-.785L11 2.687h-.047l-.652 2.157z M4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293z' },
            { id: 'hearts-desc', text: 'Most Popular First', icon: 'M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314' },
            { id: 'hearts-asc', text: 'Least Popular First', icon: 'm8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01z' }
        ];

        let html = '';
        options.forEach(opt => {
            html += `
            <div class="custom-sort-option ${currentSort === opt.id ? 'active' : ''}" data-sort="${opt.id}">
                <svg class="sort-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="${opt.icon}"/>
                </svg>
                <span>${opt.text}</span>
            </div>`;
        });
        dropdown.innerHTML = html;

        dropdown.querySelectorAll('.custom-sort-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const sortType = option.dataset.sort;

                if (sortActions[sortType]) {
                    sortActions[sortType]();
                    currentSort = sortType;
                }
                closeDropdown();
            });
        });

        return dropdown;
    }

    function closeDropdown() {
        const dropdown = document.querySelector('.custom-sort-dropdown');
        if (dropdown) dropdown.remove();
        dropdownOpen = false;
    }

    // Präzise Suche nach dem Button anhand der HTML Struktur
    function findSortButton() {
        // Suche nach dem Span mit dem Text "Sort Order"
        const labels = Array.from(document.querySelectorAll('.mantine-Button-label'));
        const label = labels.find(el => el.textContent.trim() === 'Sort Order');

        // Wenn gefunden, gehe hoch zum Button-Element
        if (label) {
            return label.closest('button');
        }
        return null;
    }

    function setupSortButton(button) {
        if (!button || button.getAttribute('data-sort-enhanced') === 'true') return;

        console.log('[FlameComics Sort] Hooking into button:', button);
        button.setAttribute('data-sort-enhanced', 'true');

        // Wrapper erstellen
        const wrapper = document.createElement('div');
        wrapper.className = 'sort-button-wrapper';

        // Button in Wrapper verschieben
        // WICHTIG: insertBefore sorgt dafür, dass der Wrapper an der exakt gleichen Stelle landet
        button.parentNode.insertBefore(wrapper, button);
        wrapper.appendChild(button);

        // Klonen um alte Event Listener der Seite zu entfernen
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        // Neuen Click Handler hinzufügen
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (dropdownOpen) {
                closeDropdown();
            } else {
                const dropdown = createDropdown();
                wrapper.appendChild(dropdown);
                dropdownOpen = true;

                // Close on click outside
                const closeHandler = (evt) => {
                    if (!wrapper.contains(evt.target)) {
                        closeDropdown();
                        document.removeEventListener('click', closeHandler);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeHandler), 0);
            }
        });
    }

    function init() {
        const observer = new MutationObserver(() => {
            const btn = findSortButton();
            // Checken ob Button existiert und noch nicht bearbeitet wurde
            if (btn && !btn.hasAttribute('data-sort-enhanced')) {
                setupSortButton(btn);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initialer Versuch
        const btn = findSortButton();
        if (btn) setupSortButton(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

---

## Global Video Speed Controller — v2.2

- **Datei:** `Global Video Speed Controller.user.js`
- **Matches:** http://*/*, https://*/*
- **Grants:** GM_setValue, GM_getValue, GM_registerMenuCommand, GM_unregisterMenuCommand, GM_addStyle, GM_addValueChangeListener, unsafeWindow, unsafeWindow CSP-Schutz umgehen kann.
- **Beschreibung:** Sets a global playback speed for all HTML5 videos and audios.

```javascript
// ==UserScript==
// @name         Global Video Speed Controller
// @name:de      Globaler Video-Geschwindigkeitsregler
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Sets a global playback speed for all HTML5 videos and audios.
// @description:de Setzt eine globale Wiedergabegeschwindigkeit für alle HTML5-Videos und -Audios.
// @author       Precise Information Specialist
// @match        http://*/*
// @match        https://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @run-at       document-start
// @icon         https://lh3.googleusercontent.com/tPBNat6dgVmnj-qBCsqizbjByLu2x-XTgTFR7MGKWiPwDk422k5eF7_9B__pTlfm97JTt4X7YeIgq0za-3qaR6O6vQ=s60
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Global%20Video%20Speed%20Controller.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Global%20Video%20Speed%20Controller.user.js
// ==/UserScript==

/*
 * ARCHITEKTUR:
 * Tampermonkey läuft in einer isolierten Sandbox. Änderungen an HTMLMediaElement.prototype
 * innerhalb des Skripts betreffen NUR den Sandbox-Kontext – die Seite sieht davon nichts.
 * Lösung (wie die Chrome Extension): Code per <script>-Tag direkt in den Seiten-Kontext
 * injizieren. Kommunikation über CustomEvents auf unsafeWindow (= echtes window der Seite).
 *
 * Fallback-Kette:
 *   1. <script>-Tag Injektion  (primär, läuft im Seiten-Kontext)
 *   2. unsafeWindow-Prototype-Override  (falls CSP inline-scripts blockiert)
 *   3. Periodisches direktes Setzen via unsafeWindow  (letzter Ausweg)
 */

(function () {
    'use strict';

    // =========================================================
    // KONSTANTEN & ZUSTAND (Tampermonkey-Kontext)
    // =========================================================

    const TM_LOG    = '[GlobalSpeed-TM]';
    const PAGE_LOG  = '[GlobalSpeed-Page]';
    const CMD_EVENT  = '__GS_CMD__';

    const STORAGE_KEY_SPEED   = 'global_video_speed';
    const STORAGE_KEY_ENABLED = 'global_video_speed_enabled';

    let tmState = {
        speed:   1.0,
        enabled: true,
    };

    // =========================================================
    // HILFSFUNKTION: Befehl an den Seiten-Kontext senden
    // =========================================================

    function sendCmd(speed, enabled) {
        try {
            // unsafeWindow ist das ECHTE window der Seite – Events hierauf werden
            // vom injizierten Skript empfangen.
            unsafeWindow.dispatchEvent(
                new unsafeWindow.CustomEvent(CMD_EVENT, { detail: { speed, enabled } })
            );
            console.log(TM_LOG, `Befehl gesendet: speed=${speed}, enabled=${enabled}`);
        } catch (e) {
            console.error(TM_LOG, 'sendCmd fehlgeschlagen:', e);
        }
    }

    // =========================================================
    // ANSATZ 1: <script>-Tag Injektion in den Seiten-Kontext
    // =========================================================
    //
    // Dieser Code läuft im echten Seiten-JavaScript-Kontext und kann daher
    // HTMLMediaElement.prototype so modifizieren, dass die Seite es sieht.
    //
    // Das ist exakt das Prinzip, das die Global Speed Chrome Extension nutzt:
    // main.js läuft als Content Script im "MAIN world" – das ist äquivalent dazu.

    function buildPageScript(initialSpeed, initialEnabled) {
        // WICHTIG: Dieser String wird als JavaScript in die Seite injiziert.
        // Er hat KEINEN Zugriff auf Tampermonkey-APIs oder den TM-Kontext.
        return `
(function () {
    if (window.__GS_ACTIVE__) {
        console.log('${PAGE_LOG}', 'Bereits aktiv – Doppel-Injektion verhindert.');
        window.dispatchEvent(new CustomEvent('${CMD_EVENT}', {
            detail: { speed: window.__GS_SPEED__, enabled: window.__GS_ENABLED__ }
        }));
        return;
    }
    window.__GS_ACTIVE__  = true;
    window.__GS_SPEED__   = ${initialSpeed};
    window.__GS_ENABLED__ = ${initialEnabled};

    const LOG = '${PAGE_LOG}';

    // Originalen Deskriptor sichern, BEVOR irgendein Seitenskript ihn ändern kann.
    const origDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!origDesc || !origDesc.get || !origDesc.set) {
        console.error(LOG, 'FATAL: playbackRate-Deskriptor nicht gefunden oder kein getter/setter.', origDesc);
        return;
    }

    console.log(LOG, 'Initialisierung. speed=' + window.__GS_SPEED__ + ', enabled=' + window.__GS_ENABLED__);

    let isApplying = false;
    const seen = new WeakSet();

    // --------------------------------------------------
    // Prototype-Override (läuft jetzt im Seiten-Kontext)
    // --------------------------------------------------
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        configurable: true,
        enumerable:   true,
        get() {
            return window.__GS_ENABLED__ ? window.__GS_SPEED__ : origDesc.get.call(this);
        },
        set(rate) {
            // Nur Werte von uns durchlassen; Seiten-Skripte ignorieren.
            if (isApplying || !window.__GS_ENABLED__) {
                origDesc.set.call(this, rate);
            }
        }
    });

    // --------------------------------------------------
    // Auf einzelnes Element anwenden
    // --------------------------------------------------
    function applyTo(el) {
        if (!(el instanceof HTMLMediaElement) || !window.__GS_ENABLED__) return;
        try {
            isApplying = true;
            origDesc.set.call(el, window.__GS_SPEED__);
            console.log(LOG, 'Angewendet:', window.__GS_SPEED__ + 'x',
                '<' + el.tagName.toLowerCase() + '>',
                (el.src || el.currentSrc || '').slice(0, 70) || '(kein src)');
        } catch (e) {
            console.error(LOG, 'applyTo Fehler:', e);
        } finally {
            isApplying = false;
        }
    }

    function resetTo(el, rate) {
        if (!(el instanceof HTMLMediaElement)) return;
        try {
            isApplying = true;
            origDesc.set.call(el, rate);
        } finally {
            isApplying = false;
        }
    }

    function applyToAll() {
        document.querySelectorAll('video, audio').forEach(applyTo);
    }

    function resetAll() {
        document.querySelectorAll('video, audio').forEach(el => resetTo(el, 1.0));
    }

    // --------------------------------------------------
    // Element registrieren & Events anhängen
    // --------------------------------------------------
    function register(el) {
        if (!(el instanceof HTMLMediaElement)) return;
        if (seen.has(el)) return;
        seen.add(el);

        applyTo(el);

        // Wenn Seite die Rate ändert – sofort korrigieren
        el.addEventListener('ratechange', () => {
            if (!isApplying && window.__GS_ENABLED__) {
                const real = origDesc.get.call(el);
                if (real !== window.__GS_SPEED__) {
                    console.log(LOG, 'ratechange-Korrektur:', real, '->', window.__GS_SPEED__);
                    applyTo(el);
                }
            }
        }, true);

        // Bei jedem dieser Events sicherstellen, dass die Rate stimmt
        ['play', 'playing', 'loadedmetadata', 'canplay', 'seeked'].forEach(evt => {
            el.addEventListener(evt, () => { if (window.__GS_ENABLED__) applyTo(el); }, true);
        });
    }

    // --------------------------------------------------
    // MutationObserver für ein Root-Element
    // --------------------------------------------------
    function observeRoot(root) {
        new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!node || node.nodeType !== 1) continue;
                    if (node instanceof HTMLMediaElement) {
                        register(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('video, audio').forEach(register);
                    }
                }
            }
        }).observe(root, { childList: true, subtree: true });
    }

    observeRoot(document.documentElement);

    // --------------------------------------------------
    // Shadow DOM: wie Global Speed es macht
    // --------------------------------------------------
    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (opts) {
        const shadow = origAttachShadow.call(this, opts);
        observeRoot(shadow);
        setTimeout(() => shadow.querySelectorAll('video, audio').forEach(register), 0);
        setTimeout(() => shadow.querySelectorAll('video, audio').forEach(register), 500);
        return shadow;
    };

    // --------------------------------------------------
    // Sofortiger Scan (Elemente, die schon im DOM sind)
    // --------------------------------------------------
    applyToAll();

    // --------------------------------------------------
    // Periodischer Korrekturscan (30 s)
    // --------------------------------------------------
    let ticks = 0;
    const timer = setInterval(() => {
        if (window.__GS_ENABLED__) {
            document.querySelectorAll('video, audio').forEach(el => {
                if (!seen.has(el)) {
                    console.log(LOG, 'Periodischer Scan: neues Element gefunden.');
                    register(el);
                } else {
                    const real = origDesc.get.call(el);
                    if (real !== window.__GS_SPEED__) {
                        console.log(LOG, 'Periodischer Scan: Rate-Abweichung korrigiert:', real, '->', window.__GS_SPEED__);
                        applyTo(el);
                    }
                }
            });
        }
        if (++ticks >= 30) clearInterval(timer);
    }, 1000);

    // --------------------------------------------------
    // Befehle vom Tampermonkey-Kontext empfangen
    // --------------------------------------------------
    window.addEventListener('${CMD_EVENT}', (e) => {
        const { speed, enabled } = e.detail || {};
        console.log(LOG, 'Befehl empfangen: speed=' + speed + ', enabled=' + enabled);
        window.__GS_SPEED__   = speed;
        window.__GS_ENABLED__ = enabled;
        if (enabled) {
            applyToAll();
        } else {
            resetAll();
        }
    });

    console.log(LOG, 'Bereit. Prototype-Override aktiv im Seiten-Kontext.');
})();
`;
    }

    function injectPageScript(speed, enabled) {
        try {
            const script = document.createElement('script');
            script.setAttribute('type', 'text/javascript');
            script.textContent = buildPageScript(speed, enabled);
            (document.head || document.documentElement).appendChild(script);
            script.remove();
            console.log(TM_LOG, '<script>-Injektion erfolgreich.');
            return true;
        } catch (e) {
            console.error(TM_LOG, '<script>-Injektion fehlgeschlagen (CSP?):', e);
            return false;
        }
    }

    // =========================================================
    // ANSATZ 2: unsafeWindow-Prototype-Override (CSP-Fallback)
    // =========================================================
    // Falls die Seite inline-scripts per CSP blockiert, können wir den
    // Prototype trotzdem über unsafeWindow modifizieren, da Tampermonkey
    // mit @grant unsafeWindow CSP-Schutz umgehen kann.

    let fallbackOrigDesc   = null;
    let fallbackIsApplying = false;

    function setupUnsafeWindowFallback() {
        try {
            const uw = unsafeWindow;
            if (!uw || !uw.HTMLMediaElement) {
                console.warn(TM_LOG, 'Fallback: unsafeWindow.HTMLMediaElement nicht verfügbar.');
                return false;
            }

            fallbackOrigDesc = Object.getOwnPropertyDescriptor(
                uw.HTMLMediaElement.prototype, 'playbackRate'
            );
            if (!fallbackOrigDesc || !fallbackOrigDesc.get || !fallbackOrigDesc.set) {
                console.warn(TM_LOG, 'Fallback: Deskriptor nicht nutzbar.');
                return false;
            }

            // Referenz auf tmState für Closure
            const s = tmState;
            const fd = fallbackOrigDesc;
            let fa = false; // isApplying

            Object.defineProperty(uw.HTMLMediaElement.prototype, 'playbackRate', {
                configurable: true,
                enumerable:   true,
                get() { return s.enabled ? s.speed : fd.get.call(this); },
                set(rate) { if (fa || !s.enabled) fd.set.call(this, rate); }
            });

            // Anwende-Funktion für späteren Aufruf
            unsafeWindow.__gsFallbackApply = function () {
                const elements = uw.document.querySelectorAll('video, audio');
                elements.forEach(el => {
                    try {
                        fa = true;
                        fd.set.call(el, s.enabled ? s.speed : 1.0);
                    } finally {
                        fa = false;
                    }
                });
            };

            console.log(TM_LOG, 'unsafeWindow-Fallback aktiv.');
            return true;
        } catch (e) {
            console.error(TM_LOG, 'unsafeWindow-Fallback Fehler:', e);
            return false;
        }
    }

    function fallbackApply() {
        try {
            if (unsafeWindow.__gsFallbackApply) {
                unsafeWindow.__gsFallbackApply();
            }
        } catch (e) {
            console.error(TM_LOG, 'fallbackApply Fehler:', e);
        }
    }

    // =========================================================
    // ANSATZ 3: Direktes Polling ohne Prototype-Override
    // =========================================================
    // Letzter Ausweg: Einfach jede Sekunde alle Videos zwingen.
    // Kein Prototype-Override, daher können Seiten-Skripte es zwischen
    // den Intervallen überschreiben – aber besser als nichts.

    let pollingActive = false;

    function startDirectPolling() {
        if (pollingActive) return;
        pollingActive = true;
        console.log(TM_LOG, 'Direktes Polling gestartet (letzter Ausweg).');

        let ticks = 0;
        const id = setInterval(() => {
            if (!tmState.enabled) return;
            try {
                const els = unsafeWindow.document.querySelectorAll('video, audio');
                els.forEach(el => {
                    if (Math.abs(el.playbackRate - tmState.speed) > 0.001) {
                        console.log(TM_LOG, 'Polling: Setze Rate', tmState.speed, 'auf', el.tagName);
                        el.playbackRate = tmState.speed;
                    }
                });
            } catch (e) {
                console.error(TM_LOG, 'Polling-Fehler:', e);
            }
            if (++ticks >= 60) clearInterval(id);
        }, 500);
    }

    // =========================================================
    // UI (Tampermonkey-Kontext)
    // =========================================================

    let indicator = null;

    function showIndicator() {
        if (!tmState.enabled) return;
        try {
            const doc = unsafeWindow.document;
            if (!doc.body) return;
            if (!indicator) {
                indicator = doc.createElement('div');
                indicator.id = 'gm-speed-indicator';
                doc.body.appendChild(indicator);
            }
            indicator.textContent = `${tmState.speed.toFixed(2)}x`;
            indicator.style.display = 'block';
            clearTimeout(indicator._timeout);
            indicator._timeout = setTimeout(() => {
                if (indicator) indicator.style.display = 'none';
            }, 1500);
        } catch (e) { /* body noch nicht da */ }
    }

    function updateSetSpeedLabel() {
        if (window.__gsUpdateSetSpeedLabel) window.__gsUpdateSetSpeedLabel();
    }

    function applyAll() {
        sendCmd(tmState.speed, tmState.enabled);
        fallbackApply();
        updateSetSpeedLabel();
    }

    function setupMenuCommands() {
        const setSpeedHandler = () => {
            const input = prompt('Wiedergabegeschwindigkeit (0.07 – 16):', tmState.speed);
            const val = parseFloat(input);
            if (input !== null && !isNaN(val) && val > 0) {
                tmState.speed = Math.max(0.07, Math.min(16, val));
                GM_setValue(STORAGE_KEY_SPEED, tmState.speed);
                applyAll();
                showIndicator();
            }
        };

        let setSpeedId = GM_registerMenuCommand(
            `Geschwindigkeit einstellen (${tmState.speed.toFixed(2)}x)`, setSpeedHandler
        );

        // Aktualisiert das Label wenn sich die Geschwindigkeit ändert.
        window.__gsUpdateSetSpeedLabel = () => {
            if (window !== window.top) return;
            try { GM_unregisterMenuCommand(setSpeedId); } catch (_) {}
            setSpeedId = GM_registerMenuCommand(
                `Geschwindigkeit einstellen (${tmState.speed.toFixed(2)}x)`, setSpeedHandler
            );
        };
        updateSetSpeedLabel();

        GM_registerMenuCommand('Zurücksetzen (1.0x)', () => {
            tmState.speed = 1.0;
            GM_setValue(STORAGE_KEY_SPEED, tmState.speed);
            applyAll();
            showIndicator();
        });

        const label = () => tmState.enabled ? 'Global Speed deaktivieren' : 'Global Speed aktivieren';

        const onToggle = () => {
            tmState.enabled = !tmState.enabled;
            GM_setValue(STORAGE_KEY_ENABLED, tmState.enabled);
            applyAll();
            try {
                GM_unregisterMenuCommand(toggleId);
                toggleId = GM_registerMenuCommand(label(), onToggle);
            } catch (_) {}
            if (tmState.enabled) showIndicator();
            else if (indicator) indicator.style.display = 'none';
        };

        let toggleId = GM_registerMenuCommand(label(), onToggle);
    }

    function addStyles() {
        GM_addStyle(`
            #gm-speed-indicator {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0,0,0,0.78);
                color: #fff;
                padding: 7px 15px;
                border-radius: 6px;
                font: bold 16px/1 sans-serif;
                z-index: 2147483647;
                display: none;
                pointer-events: none;
                user-select: none;
            }
        `);
    }

    // =========================================================
    // INITIALISIERUNG
    // =========================================================

    async function init() {
        console.log(TM_LOG, 'init() – readyState:', document.readyState);

        // SCHRITT 1 — Sofort mit Standardwerten injizieren (synchron, vor jedem await).
        // Selbst wenn die Seite noch nicht geladen ist, muss der Prototype-Override
        // im Seiten-Kontext aktiv sein, bevor Seitenskripte Videos erstellen.
        const injected = injectPageScript(1.0, true);

        // SCHRITT 2 — Gespeicherte Werte laden.
        try {
            tmState.speed   = await GM_getValue(STORAGE_KEY_SPEED,   1.0);
            tmState.enabled = await GM_getValue(STORAGE_KEY_ENABLED, true);
            console.log(TM_LOG, `Gespeichert: speed=${tmState.speed}, enabled=${tmState.enabled}`);
        } catch (e) {
            console.error(TM_LOG, 'GM_getValue Fehler (Standardwerte):', e);
        }

        // SCHRITT 3 — Korrekte Werte an das injizierte Skript übermitteln.
        sendCmd(tmState.speed, tmState.enabled);

        // SCHRITT 4 — Falls Injektion fehlgeschlagen (CSP): unsafeWindow-Fallback.
        if (!injected) {
            console.warn(TM_LOG, 'Primäre Injektion fehlgeschlagen → Fallback 2 (unsafeWindow)...');
            const fallbackOk = setupUnsafeWindowFallback();
            if (!fallbackOk) {
                console.warn(TM_LOG, 'Fallback 2 fehlgeschlagen → Fallback 3 (Polling)...');
                startDirectPolling();
            } else {
                fallbackApply();
            }
        }

        // SCHRITT 5 — UI einrichten (wartet auf DOM).
        const setupUI = () => {
            // Menü und Indikator nur im Top-Frame registrieren.
            // Das Skript läuft in jedem iframe – ohne diese Prüfung würde
            // GM_registerMenuCommand mehrfach aufgerufen und der prompt mehrfach erscheinen.
            if (window !== window.top) return;
            addStyles();
            setupMenuCommands();
            console.log(TM_LOG, 'UI bereit.');
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupUI, { once: true });
        } else {
            setupUI();
        }

        // SCHRITT 6 — Cross-Tab-Synchronisation.
        // Wenn ein anderer Tab GM_setValue aufruft, feuert dieser Callback sofort.
        // "remote" ist true, wenn die Änderung aus einem anderen Tab kommt.
        GM_addValueChangeListener(STORAGE_KEY_SPEED, (_key, _old, newVal, remote) => {
            if (!remote) return;
            tmState.speed = newVal;
            sendCmd(tmState.speed, tmState.enabled);
            fallbackApply();
            console.log(TM_LOG, `Cross-Tab: Geschwindigkeit auf ${newVal}x gesetzt.`);
        });

        GM_addValueChangeListener(STORAGE_KEY_ENABLED, (_key, _old, newVal, remote) => {
            if (!remote) return;
            tmState.enabled = newVal;
            sendCmd(tmState.speed, tmState.enabled);
            fallbackApply();
            console.log(TM_LOG, `Cross-Tab: Enabled auf ${newVal} gesetzt.`);
        });
    }

    init().catch(e => console.error(TM_LOG, 'Kritischer Fehler:', e));

})();

```

---

## Google AI Studio Chat Exporter — v5.2

- **Datei:** `Google AI Studio Chat Exporter.user.js`
- **Matches:** https://aistudio.google.com/*
- **Grants:** none
- **Beschreibung:** Chat exporter in settings sidebar + native mic dialog repositioned & non-blocking

```javascript
// ==UserScript==
// @name         Google AI Studio Chat Exporter
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Chat exporter in settings sidebar + native mic dialog repositioned & non-blocking
// @author       marmoris
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ==================== STYLES ====================

    const style = document.createElement('style');
    style.textContent = `
        /* ── Native mic dialog: non-blocking, repositioned to bottom-left ── */
        .cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-backdrop {
            pointer-events: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: transparent !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-global-overlay-wrapper {
            justify-content: flex-start !important;
            align-items: flex-end !important;
            padding: 0 0 80px 16px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-pane {
            pointer-events: auto !important;
            width: 280px !important;
            height: auto !important;
            min-width: 0 !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-container {
            --mdc-dialog-container-shape: 12px;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-title {
            padding: 12px 16px 8px !important;
            font-size: 14px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-content {
            padding: 0 16px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) ms-mic-audio-canvas {
            display: flex;
            justify-content: center;
            padding: 8px 0;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .recording-outer-ring {
            width: 60px !important;
            height: 60px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .recording-indicator {
            width: 36px !important;
            height: 36px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .recording-pulse {
            width: 60px !important;
            height: 60px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-actions {
            padding: 8px 16px 12px !important;
            min-height: 0 !important;
        }

        /* Remove backdrop blur from all other CDK dialogs too */
        .dialog-backdrop-blur-overlay.cdk-overlay-backdrop-showing {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(0, 0, 0, 0.20) !important;
        }

        /* ── Sidebar section ── */
        #ais-export-section {
            padding: 0 16px 20px;
            font-family: 'Google Sans', Roboto, sans-serif;
        }
        #ais-export-section .ais-divider {
            height: 1px;
            background: var(--mat-divider-color, rgba(255,255,255,0.12));
            margin: 0 -16px;
        }
        #ais-export-section .ais-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 14px 0 8px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--mat-sys-on-surface-variant, rgba(232,234,237,0.5));
        }
        #ais-export-section .ais-header .material-symbols-outlined {
            font-size: 15px;
            line-height: 1;
        }
        #ais-export-section .ais-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 0;
            min-height: 36px;
        }
        #ais-export-section .ais-label {
            font-size: 13px;
            color: var(--mat-sys-on-surface, #e8eaed);
        }

        /* Toggle pill */
        .ais-toggle {
            position: relative;
            width: 36px;
            height: 20px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            padding: 0;
            flex-shrink: 0;
            transition: background 0.2s;
            background: var(--mat-sys-surface-variant, rgba(255,255,255,0.20));
        }
        .ais-toggle.on { background: var(--mat-sys-primary, #8ab4f8); }
        .ais-toggle::after {
            content: '';
            position: absolute;
            top: 3px; left: 3px;
            width: 14px; height: 14px;
            border-radius: 50%;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.35);
            transition: transform 0.2s;
        }
        .ais-toggle.on::after { transform: translateX(16px); }

        /* Copy buttons */
        #ais-export-section .ais-btn-row {
            display: flex;
            gap: 8px;
            padding-top: 8px;
        }
        #ais-export-section .ais-copy-btn {
            flex: 1;
            padding: 7px 8px;
            border-radius: 8px;
            border: 1px solid var(--mat-sys-outline-variant, rgba(255,255,255,0.18));
            background: transparent;
            color: var(--mat-sys-on-surface, #e8eaed);
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, border-color 0.15s, color 0.15s;
            white-space: nowrap;
        }
        #ais-export-section .ais-copy-btn:hover {
            background: var(--mat-sys-surface-variant, rgba(255,255,255,0.08));
            border-color: var(--mat-sys-primary, #8ab4f8);
        }
        #ais-export-section .ais-copy-btn.done {
            background: rgba(76,175,80,0.15);
            border-color: #4caf50;
            color: #4caf50;
        }

        /* Toast */
        #ais-toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            padding: 8px 18px;
            border-radius: 20px;
            font-size: 13px;
            font-family: 'Google Sans', Roboto, sans-serif;
            background: rgba(30,30,46,0.95);
            color: #e8eaed;
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 4px 16px rgba(0,0,0,0.45);
            white-space: nowrap;
            pointer-events: none;
            transition: opacity 0.4s;
        }
        #ais-toast.err { background: #b71c1c; border-color: transparent; }
    `;
    document.head.appendChild(style);

    // ==================== STATE ====================

    let includeThoughts = true;

    // ==================== DOM → MARKDOWN ====================

    const SKIP_TAGS = new Set([
        'button', 'svg', 'path', 'defs', 'clippath', 'lineargradient',
        'g', 'rect', 'stop', 'filter', 'use', 'symbol',
    ]);

    function nodeToMd(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) return '';
        if (tag.startsWith('ms-') || tag.startsWith('mat-')) return childrenToMd(node);
        const inner = childrenToMd(node);
        switch (tag) {
            case 'p':          return inner.trim() ? inner.trim() + '\n\n' : '';
            case 'h1':         return '# '      + inner.trim() + '\n\n';
            case 'h2':         return '## '     + inner.trim() + '\n\n';
            case 'h3':         return '### '    + inner.trim() + '\n\n';
            case 'h4':         return '#### '   + inner.trim() + '\n\n';
            case 'h5':         return '##### '  + inner.trim() + '\n\n';
            case 'h6':         return '###### ' + inner.trim() + '\n\n';
            case 'strong':
            case 'b':          return inner.trim() ? `**${inner.trim()}**` : '';
            case 'em':
            case 'i':          return inner.trim() ? `_${inner.trim()}_` : '';
            case 'br':         return '\n';
            case 'hr':         return '\n---\n\n';
            case 'a':          return inner.trim();
            case 'code':       return node.closest('pre') ? inner : `\`${inner}\``;
            case 'pre': {
                const codeEl = node.querySelector('code');
                const lang = (codeEl?.className.match(/language-(\w+)/) || [])[1] || '';
                return `\`\`\`${lang}\n${(codeEl?.textContent ?? inner).trim()}\n\`\`\`\n\n`;
            }
            case 'ul':
            case 'ol':         return inner.trim() + '\n';
            case 'li':         return `- ${inner.trim()}\n`;
            case 'blockquote': return inner.trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
            case 'table':      return inner + '\n';
            case 'thead':
            case 'tbody':      return inner;
            case 'tr':         return `| ${inner.trim()} |\n`;
            case 'th':
            case 'td':         return `${inner.trim()} | `;
            case 'img':        return node.getAttribute('alt') ? `[${node.getAttribute('alt')}]` : '';
            default:           return inner;
        }
    }

    function childrenToMd(node) {
        let out = '';
        for (const child of node.childNodes) out += nodeToMd(child);
        return out;
    }

    // ==================== EXTRACTION ====================

    function getThoughts(turnEl) {
        const thoughtChunk = turnEl.querySelector('ms-thought-chunk');
        if (!thoughtChunk) return '';
        const panel = thoughtChunk.querySelector('mat-expansion-panel:not([disabled])');
        if (!panel) return '';
        const body = panel.querySelector('.mat-expansion-panel-body');
        return body ? nodeToMd(body).trim() : '';
    }

    function getContent(turnEl) {
        let out = '';
        for (const tc of turnEl.querySelectorAll('ms-text-chunk')) {
            if (tc.closest('ms-thought-chunk')) continue;
            out += nodeToMd(tc);
        }
        return out.trim();
    }

    function extractAllTurns() {
        const result = [];
        for (const el of document.querySelectorAll('ms-chat-turn')) {
            const container = el.querySelector('.virtual-scroll-container');
            if (!container) continue;
            const role      = container.getAttribute('data-turn-role') || 'Unknown';
            const tsEl      = el.querySelector('.author-label .timestamp');
            const timestamp = tsEl ? tsEl.textContent.trim() : '';
            const thoughts  = getThoughts(el);
            const content   = getContent(el);
            if (!thoughts && !content) continue;
            result.push({ role, timestamp, thoughts, content });
        }
        return result;
    }

    // ==================== FORMATTERS ====================

    function turnsToMarkdown(turns) {
        return turns.map(({ role, timestamp, thoughts, content }) => {
            const label = role === 'User' ? '**User**' : '**Model**';
            const ts    = timestamp ? ` _(${timestamp})_` : '';
            const parts = [`${label}${ts}:`];
            if (includeThoughts && thoughts) {
                parts.push('<details>\n<summary>💭 Thinking</summary>\n\n' + thoughts + '\n\n</details>');
            }
            if (content) parts.push(content);
            return parts.join('\n\n');
        }).join('\n\n---\n\n');
    }

    function turnsToPlainText(turns) {
        return turnsToMarkdown(turns)
            .replace(/<details>\n<summary>(.*?)<\/summary>\n\n([\s\S]*?)\n\n<\/details>/g, '[$1]\n$2')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/\*\*(.*?)\*\*/gs, '$1')
            .replace(/_(.*?)_/gs, '$1')
            .replace(/```[\w]*\n([\s\S]*?)```/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/^- /gm, '• ')
            .replace(/^> /gm, '  ')
            .replace(/\[([^\]]+)\]/g, '$1')
            .replace(/^---$/gm, '─'.repeat(40))
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function exportChat(format) {
        const turns = extractAllTurns();
        if (!turns.length) return null;
        return format === 'text' ? turnsToPlainText(turns) : turnsToMarkdown(turns);
    }

    // ==================== SIDEBAR SECTION ====================

    function buildSection() {
        const wrap = document.createElement('div');
        wrap.id = 'ais-export-section';

        wrap.appendChild(makeDivider());
        wrap.appendChild(makeHeader('content_copy', 'Export Chat'));

        // Thoughts toggle row
        const thoughtsRow = document.createElement('div');
        thoughtsRow.className = 'ais-row';
        const lbl = document.createElement('span');
        lbl.className = 'ais-label';
        lbl.textContent = 'Include Thoughts';
        const toggle = document.createElement('button');
        toggle.className = 'ais-toggle' + (includeThoughts ? ' on' : '');
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-checked', String(includeThoughts));
        toggle.setAttribute('aria-label', 'Include thoughts in export');
        toggle.onclick = () => {
            includeThoughts = !includeThoughts;
            toggle.classList.toggle('on', includeThoughts);
            toggle.setAttribute('aria-checked', String(includeThoughts));
        };
        thoughtsRow.append(lbl, toggle);
        wrap.appendChild(thoughtsRow);

        // Copy buttons
        const btnRow = document.createElement('div');
        btnRow.className = 'ais-btn-row';
        btnRow.append(
            makeCopyBtn('Markdown', 'Als Markdown kopieren', 'markdown'),
            makeCopyBtn('Text',     'Als reinen Text kopieren', 'text')
        );
        wrap.appendChild(btnRow);

        return wrap;
    }

    function makeDivider() {
        const d = document.createElement('div');
        d.className = 'ais-divider';
        return d;
    }

    function makeHeader(icon, label) {
        const h = document.createElement('div');
        h.className = 'ais-header';
        h.innerHTML = `<span class="material-symbols-outlined notranslate">${icon}</span>${label}`;
        return h;
    }

    function makeCopyBtn(label, title, format) {
        const btn = document.createElement('button');
        btn.className = 'ais-copy-btn';
        btn.textContent = label;
        btn.title = title;
        btn.onclick = () => handleCopy(format, btn, label);
        return btn;
    }

    async function handleCopy(format, btn, origLabel) {
        const text = exportChat(format);
        if (!text) { showToast('Kein Chat gefunden', true); return; }

        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }

        showToast(`${format === 'markdown' ? 'Markdown' : 'Text'} kopiert — ${(text.length / 1000).toFixed(1)}k Zeichen`);
        btn.classList.add('done');
        btn.textContent = '✓';
        setTimeout(() => { btn.classList.remove('done'); btn.textContent = origLabel; }, 2000);
    }

    function showToast(msg, isErr = false) {
        document.getElementById('ais-toast')?.remove();
        const t = document.createElement('div');
        t.id = 'ais-toast';
        if (isErr) t.classList.add('err');
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; }, 2500);
        setTimeout(() => t.remove(), 3000);
    }

    // ==================== INJECTION ====================

    let observedArea = null;
    let areaObserver = null;

    function syncSidebar() {
        const area = document.querySelector('.scrollable-area');
        if (!area) return;

        if (!area.querySelector('#ais-export-section')) {
            area.appendChild(buildSection());
        }

        if (area !== observedArea) {
            areaObserver?.disconnect();
            areaObserver = new MutationObserver(() => {
                if (!area.querySelector('#ais-export-section')) {
                    area.appendChild(buildSection());
                }
            });
            areaObserver.observe(area, { childList: true });
            observedArea = area;
        }
    }

    setTimeout(syncSidebar, 1500);
    setInterval(syncSidebar, 3000);

})();

```

---

## Google Search Enhanced — v1.0.3

- **Datei:** `Google Search Enhanced.user.js`
- **Matches:** *://www.google.com/search*, *://www.google.de/search*, *://www.google.at/search*, *://www.google.ch/search*, *://www.google.fr/search*, *://www.google.co.uk/search*, *://www.google.ca/search*, *://www.google.com.au/search*, *://encrypted.google.com/search*
- **Grants:** none
- **Beschreibung:** Add Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner.

```javascript
// ==UserScript==
// @name         Google Search Enhanced
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  Add Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner.
// @author       marmoris
// @match        *://www.google.com/search*
// @match        *://www.google.de/search*
// @match        *://www.google.at/search*
// @match        *://www.google.ch/search*
// @match        *://www.google.fr/search*
// @match        *://www.google.co.uk/search*
// @match        *://www.google.ca/search*
// @match        *://www.google.com.au/search*
// @match        *://encrypted.google.com/search*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @run-at       document-end
// @noframes
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Google%20Search%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Google%20Search%20Enhanced.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Skip image search
    if (location.href.includes('tbm=isch')) return;

    const CONFIG = {
        tabs:     { maps: true, youtube: true, reddit: true },
        features: { cleanLinks: true, mapShortcut: true }
    };

    // ==========================================
    // UTILS
    // ==========================================
    const Utils = {
        getQuery: () =>
            new URLSearchParams(location.search).get('q') ||
            document.querySelector('input[name="q"]')?.value || '',

        getMapsUrl: q => `https://maps.google.com/maps?q=${encodeURIComponent(q)}`,

        debounce(fn, ms) {
            let t;
            return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
        }
    };

    // ==========================================
    // STYLES
    // ==========================================
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* "Open in Maps" button on the embedded map widget */
            .gss-map-btn {
                position: absolute;
                top: 10px;
                left: 10px;
                color: #3c4043;
                background: rgba(255, 255, 255, 0.92);
                padding: 7px 15px;
                z-index: 10;
                border-radius: 20px;
                text-decoration: none;
                font-family: 'Google Sans', Roboto, Arial, sans-serif;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15);
                transition: background 0.15s, color 0.15s, transform 0.15s;
            }
            .gss-map-btn:hover {
                background: #fff;
                color: #1a73e8;
                transform: scale(1.04);
            }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // MODULE: NAVIGATION TABS
    // Current Google structure (as of 2025):
    //   div[role="list"]  (.beZ0tf.O1uzAe)
    //     div[role="listitem"]
    //       a.C6AK7c
    //         div.mXwfNd [aria-current="page"] [selected]  ← active tab
    //           span.R1QWuf  ← tab label
    //     ...
    //     div[role="listitem"] [jscontroller]  ← "Mehr" dropdown (last visible item)
    // ==========================================
    const NavigationModule = {
        inject() {
            const query = Utils.getQuery();
            if (!query) return;

            // Find the search tab list — the one that contains "Alle" / "All" / "Tout"
            const lists = document.querySelectorAll('div[role="list"]');
            let list = null;
            for (const l of lists) {
                const labels = [...l.querySelectorAll('span.R1QWuf')].map(s => s.textContent.trim().toLowerCase());
                if (labels.some(t => t === 'alle' || t === 'all' || t === 'tout')) {
                    list = l;
                    break;
                }
            }
            if (!list || list.querySelector('.gss-tab')) return;

            // Reference: first listitem with a real href link (not the active disabled "Alle")
            const refItem = [...list.querySelectorAll('div[role="listitem"]')]
                .find(el => el.querySelector('a.C6AK7c[href]'));
            if (!refItem) return;

            // Insert before the "Mehr" dropdown (has jscontroller attr) to stay in the main bar
            const mehrItem = [...list.querySelectorAll('div[role="listitem"]')]
                .find(el => el.hasAttribute('jscontroller'));

            const createTab = (label, url) => {
                const item = refItem.cloneNode(true);
                item.classList.add('gss-tab');

                // Clear active/selected state
                const inner = item.querySelector('.mXwfNd, [jsname="xBNgKe"]');
                if (inner) {
                    inner.removeAttribute('aria-current');
                    inner.removeAttribute('selected');
                }

                // Set link
                const link = item.querySelector('a.C6AK7c');
                if (link) {
                    link.href = url;
                    link.removeAttribute('aria-disabled');
                    link.removeAttribute('jsname');   // prevent Google from hijacking clicks
                    link.removeAttribute('jsaction');
                }

                // Set label text
                const span = item.querySelector('span.R1QWuf');
                if (span) span.textContent = label;

                return item;
            };

            const insert = tab => {
                if (!tab) return;
                if (mehrItem) list.insertBefore(tab, mehrItem);
                else list.appendChild(tab);
            };

            const q = encodeURIComponent(query);
            if (CONFIG.tabs.reddit)  insert(createTab('Reddit',  `https://www.google.com/search?q=${encodeURIComponent(query + ' site:reddit.com')}`));
            if (CONFIG.tabs.youtube) insert(createTab('YouTube', `https://www.youtube.com/results?search_query=${q}`));
            if (CONFIG.tabs.maps) {
                const existingLabels = [...list.querySelectorAll('span.R1QWuf')].map(s => s.textContent.toLowerCase());
                if (!existingLabels.some(t => t.includes('maps') || t.includes('karten'))) {
                    insert(createTab('Maps', Utils.getMapsUrl(query)));
                }
            }
        }
    };

    // ==========================================
    // MODULE: MAPS SHORTCUT BUTTON
    // ==========================================
    const MapsModule = {
        run() {
            const query = Utils.getQuery();
            if (!query) return;

            const panel = document.querySelector('.SodP3b');
            if (!panel || panel.querySelector('.gss-map-btn')) return;
            if (!panel.querySelector('div.SBzq0c.ZGYHDd, div.zMVLkf.jdQ9hc')) return;

            const btn = document.createElement('a');
            btn.className   = 'gss-map-btn';
            btn.textContent = 'Open in Maps';
            btn.href        = Utils.getMapsUrl(query);
            btn.target      = '_blank';
            btn.rel         = 'noopener noreferrer';
            panel.appendChild(btn);
        }
    };

    // ==========================================
    // MODULE: LINK CLEANER
    // Strips Google's click-tracking attributes from result links
    // ==========================================
    const CleanerModule = {
        run() {
            document.querySelectorAll('a[href^="http"]:not(.gss-clean)').forEach(l => {
                l.removeAttribute('onmousedown');
                l.removeAttribute('ping');
                l.classList.add('gss-clean');
            });
        }
    };

    // ==========================================
    // MAIN CONTROLLER
    // ==========================================
    const Controller = {
        init() {
            addStyles();
            this.run();
            new MutationObserver(Utils.debounce(() => this.run(), 200))
                .observe(document.body, { childList: true, subtree: true });
        },
        run() {
            NavigationModule.inject();
            if (CONFIG.features.mapShortcut) MapsModule.run();
            if (CONFIG.features.cleanLinks)  CleanerModule.run();
        }
    };

    Controller.init();
})();

```

---

## Gutefrage Smart Filters — v3.6

- **Datei:** `Gutefrage Smart Filters.user.js`
- **Matches:** https://www.gutefrage.net/*
- **Grants:** GM_addStyle, GM_setValue, GM_getValue, GM_openInTab, window.close
- **Beschreibung:** Kombinierte Lösung: Erweiterte Filteroptionen und automatisches Tag-Management für gutefrage.net

```javascript
// ==UserScript==
// @name         Gutefrage Smart Filters
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Kombinierte Lösung: Erweiterte Filteroptionen und automatisches Tag-Management für gutefrage.net
// @author       marmoris
// @match        https://www.gutefrage.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gutefrage.net
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @grant        window.close
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Gutefrage%20Smart%20Filters.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Gutefrage%20Smart%20Filters.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // SHARED UTILITIES
    // ============================================

    class Utils {
        static async waitForElements(selector, maxWaitTime = 15000, checkInterval = 500) {
            const startTime = Date.now();
            return new Promise((resolve) => {
                const checkForElements = () => {
                    const elements = document.querySelectorAll(selector);
                    const elapsed = Date.now() - startTime;
                    if (elements.length > 0) {
                        console.log(`[Gutefrage Smart Filters] Elements found: ${selector} after ${elapsed}ms`);
                        resolve(elements);
                        return;
                    }
                    if (elapsed >= maxWaitTime) {
                        console.log(`[Gutefrage Smart Filters] Timeout for ${selector} (${maxWaitTime}ms)`);
                        resolve(elements);
                        return;
                    }
                    setTimeout(checkForElements, checkInterval);
                };
                checkForElements();
            });
        }

        static async waitForPageReady() {
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });

            const criticalSelectors = ['.Tag-container', '.Tag', 'article', 'main'];
            for (const selector of criticalSelectors) {
                const elements = await Utils.waitForElements(selector, 8000, 300);
                if (elements.length > 0) break;
            }

            const adaptiveDelay = Math.min(3000, Math.max(500, document.querySelectorAll('*').length / 100));
            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        }

        static debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    timeout = null;
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Get answer count from a post element
        static getAnswerCount(post) {
            const answerSelectors = [
                'a[href*="/frage/"]', 'a[href*="/diskussion/"]',
                'a[href*="/umfrage/"]', '.ListingElement-bottomBar a'
            ];

            for (const selector of answerSelectors) {
                for (const link of post.querySelectorAll(selector)) {
                    const text = link.textContent.trim();
                    if (text.toLowerCase().includes('keine antwort')) {
                        return 0;
                    }
                    let match = text.match(/(\d+)\s+Antwort/i);
                    if (!match && text.toLowerCase().includes('antwort')) {
                        const nm = text.match(/(\d+)/);
                        if (nm) match = [null, nm[1]];
                    }
                    if (match) {
                        return parseInt(match[1]);
                    }
                }
            }
            return 0;
        }

        // Get a fingerprint for a post based on its content (for caching)
        static getPostFingerprint(post) {
            const title = Utils.getPostTitle(post);
            const author = Utils.getPostAuthor(post);
            const datetime = Utils.getPostDateTime(post);
            const hasImages = Utils.getPostImagesStatus(post);
            const answerCount = Utils.getAnswerCount(post);

            // Create a simple hash from the content
            const titleHash = Utils.hashString(title);
            return `${titleHash}|${author}|${datetime}|${hasImages}|${answerCount}`;
        }

        // Convert datetime-local value to springe-zu format with local timezone offset
        static toSpringeZu(datetimeLocalValue) {
            if (!datetimeLocalValue) return null;
            const d = new Date(datetimeLocalValue);
            const offset = -d.getTimezoneOffset();
            const sign = offset >= 0 ? '+' : '-';
            const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
            const mm = String(Math.abs(offset) % 60).padStart(2, '0');
            const local = datetimeLocalValue.length === 16 ? datetimeLocalValue + ':00' : datetimeLocalValue;
            return local + sign + hh + ':' + mm;
        }

        // Parse comma-separated values into normalized array
        static parseCSV(text, lowercase = true) {
            if (!text || typeof text !== 'string') return [];
            return text.split(',')
                .map(t => lowercase ? t.trim().toLowerCase() : t.trim())
                .filter(Boolean);
        }

        // Simple string hash function (djb2 variant)
        static hashString(str) {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
            }
            // Convert to base36 string (shorter than hex)
            return (hash & 0x7FFFFFFF).toString(36).substring(0, 8);
        }


        // Normalize topic strings for comparison (handles "Religion & Glaube" vs "religion-glaube")
        static normalizeTopic(topic) {
            if (!topic) return '';
            // Convert to lowercase
            let normalized = topic.toLowerCase();

            // Replace German umlauts and ß
            normalized = normalized
                .replace(/ä/g, 'ae')
                .replace(/ö/g, 'oe')
                .replace(/ü/g, 'ue')
                .replace(/ß/g, 'ss');

            // Remove spaces, ampersands, hyphens, underscores, commas, periods, and other separators
            normalized = normalized.replace(/[&\s\-_,.]+/g, '');

            // Remove any remaining non-alphanumeric characters (except letters and numbers)
            normalized = normalized.replace(/[^a-z0-9]/g, '');

            return normalized;
        }

        // Match topics with normalization (handles different representations)
        // Uses substring matching: "Religion" matches "Religion & Glaube"
        static topicsMatch(topic1, topic2) {
            const norm1 = Utils.normalizeTopic(topic1);
            const norm2 = Utils.normalizeTopic(topic2);
            return norm1.includes(norm2) || norm2.includes(norm1);
        }

        // Common DOM query helpers
        static getPostTitle(post) {
            return post.querySelector('.Question-title')?.textContent.trim() || '';
        }

        static getPostAuthor(post) {
            return post.querySelector('.ContentMeta-author a')?.textContent.trim() || '';
        }

        static getPostDateTime(post) {
            const timeEl = post.querySelector('time[datetime]');
            return timeEl ? timeEl.getAttribute('datetime') : '';
        }

        static getPostImagesStatus(post) {
            return !!post.querySelector('button[aria-label="Mit Bildern"]') ||
                   !!post.querySelector('.ListingElement-image');
        }
    }

    // ============================================
    // TAG REMOVER MODULE
    // ============================================

    class TagRemover {
        constructor() {
            this.tagsToRemove = GM_getValue('customTagsToRemove', DEFAULT_TAGS);
            this.init();
        }

        init() {
            this.addRemoveTagButtons();
            this.autoRemoveAndClose();
            this.observeNewContent();
        }

        removeTag(tagElement) {
            const hideButton = tagElement.querySelector('.Tag-action');
            if (hideButton) {
                hideButton.click();
                console.log(`[Tag Remover] Tag removed: ${tagElement.getAttribute('aria-label')}`);
                return true;
            }
            return false;
        }

        async removeUnwantedTags() {
            console.log('[Tag Remover] Starting tag removal process...');
            await Utils.waitForPageReady();

            // Reload tags from storage in case user changed them in sidebar
            this.tagsToRemove = GM_getValue('customTagsToRemove', DEFAULT_TAGS);

            let tagsRemoved = 0;
            const maxAttempts = 3;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const tagContainers = document.querySelectorAll('.Tag-container');
                console.log(`[Tag Remover] Attempt ${attempt}/${maxAttempts}, found ${tagContainers.length} containers`);

                if (tagContainers.length === 0 && attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }

                for (const tagContainer of tagContainers) {
                    const tagSlug = tagContainer.querySelector('.Tag')?.getAttribute('data-tag-slug');
                    if (tagSlug && this.tagsToRemove.includes(tagSlug.toLowerCase())) {
                        if (this.removeTag(tagContainer)) {
                            tagsRemoved++;
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    }
                }

                if (tagContainers.length > 0) break;
            }

            console.log(`[Tag Remover] Completed. Total tags removed: ${tagsRemoved}`);
            return tagsRemoved;
        }

        addRemoveTagButtons() {
            const articles = document.querySelectorAll('article.ListingElement, .ContentCard');

            articles.forEach(article => {
                if (article.querySelector('.custom-remove-tags-button')) return;

                let buttonContainer = article.querySelector('.ListingElement-bottomBar--withItemActions .u-flex:last-child');
                if (!buttonContainer) {
                    buttonContainer = article.querySelector('.ContentCard-action, .ContentCard-actions');
                }
                if (!buttonContainer) {
                    const tagSection = article.querySelector('.Tag');
                    if (tagSection) buttonContainer = tagSection.parentElement;
                }

                if (buttonContainer) {
                    const btnStyle = `
                        color: white;
                        border: none;
                        padding: 4px 12px;
                        margin-left: 8px;
                        border-radius: 12px;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background-color 0.2s;
                        display: inline-flex;
                        align-items: center;
                        height: 24px;
                        white-space: nowrap;
                    `;

                    const removeTagsButton = document.createElement('button');
                    removeTagsButton.className = 'Tag custom-remove-tags-button';
                    removeTagsButton.style.cssText = `background-color: #dc3545; ${btnStyle}`;
                    removeTagsButton.textContent = 'Tags entfernen';
                    removeTagsButton.title = 'Entfernt unerwünschte Tags von diesem Beitrag';

                    removeTagsButton.addEventListener('mouseenter', function() { this.style.backgroundColor = '#c82333'; });
                    removeTagsButton.addEventListener('mouseleave', function() { this.style.backgroundColor = '#dc3545'; });

                    removeTagsButton.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const questionLink = article.querySelector('a[href*="/frage/"], .ContentCard-link, .ListingElement-questionLink');
                        if (questionLink) {
                            const url = new URL(questionLink.href);
                            url.searchParams.set('removeTagsAuto', 'true');

                            removeTagsButton.textContent = 'Wird bearbeitet...';
                            removeTagsButton.style.backgroundColor = '#28a745';

                            if (typeof GM_openInTab !== 'undefined') {
                                GM_openInTab(url.href, { active: false, insert: true, setParent: true });
                            } else {
                                window.open(url.href, '_blank');
                            }

                            setTimeout(() => {
                                removeTagsButton.textContent = 'Tags entfernen';
                                removeTagsButton.style.backgroundColor = '#dc3545';
                            }, 2000);
                        }
                    });

                    buttonContainer.appendChild(removeTagsButton);

                    const authorEl = article.querySelector('.ContentMeta-author a');
                    if (authorEl) {
                        const blockAuthorButton = document.createElement('button');
                        blockAuthorButton.className = 'Tag custom-block-author-button';
                        blockAuthorButton.style.cssText = `background-color: #6c757d; ${btnStyle}`;
                        blockAuthorButton.textContent = 'Autor sperren';
                        blockAuthorButton.title = 'Blendet alle Beiträge dieses Autors aus';

                        blockAuthorButton.addEventListener('mouseenter', function() { this.style.backgroundColor = '#545b62'; });
                        blockAuthorButton.addEventListener('mouseleave', function() { this.style.backgroundColor = '#6c757d'; });

                        blockAuthorButton.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const authorName = authorEl.textContent.trim();
                            const blocked = GM_getValue('blockedAuthors', []);
                            if (!blocked.includes(authorName)) {
                                blocked.push(authorName);
                                GM_setValue('blockedAuthors', blocked);
                            }

                            const postContainer = article.closest('.Plate.ListingElement') || article;
                            postContainer.style.display = 'none';
                        });

                        buttonContainer.appendChild(blockAuthorButton);
                    }
                }
            });
        }

        async autoRemoveAndClose() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('removeTagsAuto') !== 'true') return;

            console.log('[Tag Remover] Auto-remove mode activated');

            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ffc107;
                color: #000;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-size: 14px;
                font-weight: 500;
            `;
            notification.textContent = 'Warte auf vollständiges Laden der Seite...';
            document.body.appendChild(notification);

            const progressInterval = setInterval(() => {
                const tagContainers = document.querySelectorAll('.Tag-container');
                notification.textContent = `Seite wird geladen... (${tagContainers.length} Tags gefunden)`;
            }, 1000);

            try {
                const tagsRemoved = await this.removeUnwantedTags();
                clearInterval(progressInterval);

                notification.style.background = '#4CAF50';
                notification.style.color = '#fff';
                notification.textContent = `\u2713 ${tagsRemoved} Tag(s) entfernt! Tab wird geschlossen...`;

                setTimeout(() => {
                    window.close();
                    setTimeout(() => {
                        notification.textContent = 'Bitte schlie\xdfen Sie diesen Tab manuell.';
                        notification.style.background = '#17a2b8';
                    }, 500);
                }, 2000);

            } catch (error) {
                clearInterval(progressInterval);
                console.error('[Tag Remover] Error:', error);
                notification.style.background = '#dc3545';
                notification.style.color = '#fff';
                notification.textContent = 'Fehler beim Entfernen der Tags!';
            }
        }

        observeNewContent() {
            const observer = new MutationObserver((mutations) => {
                const hasNewContent = mutations.some(mutation => {
                    return Array.from(mutation.addedNodes).some(node => {
                        return node.nodeType === 1 && (
                            node.matches?.('article.ListingElement, .ContentCard') ||
                            node.querySelector?.('article.ListingElement, .ContentCard')
                        );
                    });
                });

                if (hasNewContent) {
                    this.addRemoveTagButtons();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ============================================
    // STYLES
    // ============================================

    // Native FilterMenu improvements
    GM_addStyle(`
        .FilterMenu {
            max-height: 60vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding-right: 10px !important;
            position: relative !important;
            scrollbar-width: thin;
            scrollbar-color: rgba(0,0,0,0.3) rgba(0,0,0,0.1);
        }
        .FilterMenu::-webkit-scrollbar { width: 6px; }
        .FilterMenu::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 3px; }
        .FilterMenu::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.3); border-radius: 3px; }
        .FilterMenu::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.5); }
        .Toggletip-content { max-height: 70vh !important; }
        .FilterMenu-section {
            position: sticky;
            top: -1px;
            background: inherit;
            z-index: 1;
            padding-bottom: 5px;
        }
    `);

    // Sidebar layout, design, push-page, dark mode
    GM_addStyle(`
        body {
            transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        body.gf-sidebar-open {
            margin-right: 360px;
        }

        /* ── Sidebar shell ── */
        #gf-sidebar {
            position: fixed;
            right: -360px;
            top: 0;
            width: 340px;
            height: 100vh;
            background: var(--gf-bg, #ffffff);
            border-left: 1px solid var(--gf-border, rgba(0,0,0,0.09));
            z-index: 10001;
            overflow-y: auto;
            overflow-x: hidden;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 0 0 32px;
            box-sizing: border-box;
            box-shadow: -6px 0 28px rgba(0,0,0,0.08);
            font-size: 11px;
            color: var(--gf-text, #2c3e50);
            scrollbar-width: thin;
            scrollbar-color: rgba(0,0,0,0.12) transparent;
        }
        #gf-sidebar::-webkit-scrollbar { width: 4px; }
        #gf-sidebar::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.15);
            border-radius: 2px;
        }

        /* ── Tab ── */
        #gf-sidebar-tab {
            position: fixed;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            background: #4a90e2;
            color: white;
            border: none;
            border-radius: 8px 0 0 8px;
            padding: 16px 8px;
            writing-mode: vertical-rl;
            text-orientation: mixed;
            cursor: pointer;
            z-index: 10002;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
            box-shadow: -3px 0 12px rgba(74,144,226,0.35);
        }
        #gf-sidebar-tab:hover { background: #3a7bd5; }

        /* ── Header ── */
        .gf-header {
            position: sticky;
            top: 0;
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            padding: 14px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 2;
            box-shadow: 0 2px 10px rgba(74,144,226,0.3);
        }
        .gf-header-title {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.3px;
        }
        .gf-header-close {
            background: rgba(255,255,255,0.18);
            border: none;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 5px;
            line-height: 1;
            transition: background 0.15s;
        }
        .gf-header-close:hover { background: rgba(255,255,255,0.32); }

        /* ── Stats bar ── */
        .gf-stats-bar {
            margin: 12px 14px 0;
            padding: 8px 13px;
            background: rgba(74,144,226,0.07);
            border: 1px solid rgba(74,144,226,0.2);
            border-radius: 7px;
            font-size: 12px;
            color: #4a90e2;
            text-align: center;
            display: none;
            font-weight: 500;
        }
        .gf-stats-bar.active { display: block; }

        /* ── Body padding ── */
        .gf-body { padding: 0 14px; }

        /* ── Section card ── */
        .gf-section {
            margin-top: 10px;
            background: var(--gf-surface, #f7f8fc);
            border-radius: 9px;
            padding: 9px 11px 11px;
            border: 1px solid var(--gf-border, rgba(0,0,0,0.06));
        }
        .gf-section-title {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.9px;
            color: var(--gf-muted, #8896a6);
            margin: 0 0 9px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .gf-section-title::before {
            content: '';
            flex-shrink: 0;
            display: inline-block;
            width: 3px;
            height: 11px;
            background: #4a90e2;
            border-radius: 2px;
        }

        /* ── Inputs ── */
        .gf-input {
            width: 100%;
            padding: 6px 9px;
            border: 1px solid var(--gf-border-input, #dde3ec);
            border-radius: 6px;
            font-size: 12px;
            background: var(--gf-input-bg, #ffffff);
            color: var(--gf-text, #2c3e50);
            box-sizing: border-box;
            transition: border-color 0.15s, box-shadow 0.15s;
            font-family: inherit;
        }
        .gf-input + .gf-input { margin-top: 4px; }
        .gf-input:focus {
            outline: none;
            border-color: #4a90e2;
            box-shadow: 0 0 0 3px rgba(74,144,226,0.12);
        }
        .gf-label {
            font-size: 10px;
            color: var(--gf-muted, #8896a6);
            display: block;
            margin: 6px 0 3px;
            font-weight: 500;
        }
        .gf-label:first-child { margin-top: 0; }
        .gf-hint {
            font-size: 10px;
            color: var(--gf-hint, #b0bec5);
            margin-top: 3px;
            line-height: 1.4;
        }


        /* ── Post type pills ── */
        .gf-pill-row {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .gf-pill-label {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            padding: 5px 12px;
            border: 1.5px solid var(--gf-border-input, #dde3ec);
            border-radius: 20px;
            user-select: none;
            transition: all 0.15s;
            color: var(--gf-muted, #7f8c8d);
            background: var(--gf-input-bg, #fff);
        }
        .gf-pill-label:has(input:checked) {
            background: #4a90e2;
            color: white;
            border-color: #4a90e2;
            box-shadow: 0 2px 6px rgba(74,144,226,0.28);
        }
        .gf-pill-label input { display: none; }

        /* ── Toggle rows ── */
        .gf-toggle-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
        }
        .gf-toggle-row + .gf-toggle-row {
            margin-top: 1px;
            padding-top: 6px;
            border-top: 1px solid var(--gf-border, rgba(0,0,0,0.06));
        }
        .gf-toggle-label {
            font-size: 12px;
            color: var(--gf-text, #2c3e50);
        }

        /* ── Number row ── */
        .gf-number-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .gf-number-row input {
            width: 72px;
            padding: 7px 8px;
            border: 1px solid var(--gf-border-input, #dde3ec);
            border-radius: 6px;
            font-size: 13px;
            background: var(--gf-input-bg, #ffffff);
            color: var(--gf-text, #2c3e50);
            font-family: inherit;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .gf-number-row input:focus {
            outline: none;
            border-color: #4a90e2;
            box-shadow: 0 0 0 3px rgba(74,144,226,0.12);
        }
        .gf-number-row span {
            font-size: 12px;
            color: var(--gf-muted, #8896a6);
        }

        /* ── Date navigation buttons ── */
        .gf-nav-row {
            display: flex;
            gap: 6px;
            margin-top: 8px;
        }
        .gf-nav-btn {
            flex: 1;
            padding: 7px 8px;
            font-size: 11px;
            font-weight: 600;
            background: var(--gf-input-bg, #fff);
            color: #4a90e2;
            border: 1.5px solid #4a90e2;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s;
            font-family: inherit;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .gf-nav-btn:hover {
            background: #4a90e2;
            color: white;
            box-shadow: 0 2px 6px rgba(74,144,226,0.28);
        }
        .gf-nav-btn:disabled {
            opacity: 0.38;
            cursor: not-allowed;
            border-color: var(--gf-border-input, #dde3ec);
            color: var(--gf-muted, #8896a6);
        }
        .gf-nav-btn:disabled:hover {
            background: var(--gf-input-bg, #fff);
            color: var(--gf-muted, #8896a6);
            box-shadow: none;
        }
        .gf-nav-btn.active {
            background: #4a90e2;
            color: white;
            box-shadow: 0 2px 6px rgba(74,144,226,0.28);
        }
        .gf-nav-btn.active:hover {
            background: #3a7bd5;
        }

        /* ── Feed navigation reset button ── */
        #gf-nav-reset {
            background: var(--gf-surface, #f7f8fc);
            color: var(--gf-muted, #8896a6);
            border-color: var(--gf-border-input, #dde3ec);
        }
        #gf-nav-reset:hover {
            background: var(--gf-muted, #8896a6);
            color: white;
            box-shadow: 0 2px 6px rgba(136,150,166,0.28);
        }

        /* ── Reset button ── */
        .gf-reset-btn {
            display: block;
            width: calc(100% - 28px);
            margin: 14px 14px 0;
            padding: 10px;
            background: var(--gf-surface, #f7f8fc);
            border: 1.5px solid var(--gf-border-input, #dde3ec);
            border-radius: 7px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            color: var(--gf-muted, #7f8c8d);
            transition: all 0.2s;
            font-family: inherit;
            letter-spacing: 0.2px;
            text-align: center;
        }
        .gf-reset-btn:hover {
            background: #fff0f0;
            border-color: #e57373;
            color: #c0392b;
        }

        /* ── Dark mode (sidebar-only) ── */
        #gf-sidebar.gf-dark {
            --gf-bg: #1e2130;
            --gf-surface: #262a3c;
            --gf-border: rgba(255,255,255,0.07);
            --gf-border-input: rgba(255,255,255,0.13);
            --gf-text: #dde3ec;
            --gf-muted: #8890a4;
            --gf-hint: #4e5a72;
            --gf-input-bg: #2d3248;
        }
        #gf-sidebar.gf-dark .gf-stats-bar {
            background: rgba(74,144,226,0.12);
            border-color: rgba(74,144,226,0.25);
        }
        #gf-sidebar.gf-dark .gf-reset-btn:hover {
            background: rgba(192,57,43,0.15);
            border-color: rgba(192,57,43,0.4);
            color: #e57373;
        }
        #gf-sidebar.gf-dark ~ #gf-sidebar-tab {
            background: #2a5a9e;
            box-shadow: -3px 0 12px rgba(42,90,158,0.45);
        }
        #gf-sidebar.gf-dark ~ #gf-sidebar-tab:hover { background: #3570be; }
    `);

    // ============================================
    // CONSTANTS
    // ============================================

    const DEFAULT_TAGS = ['islam', 'allah', 'muslime', 'koran', 'mohammed'];

    const DEFAULT_FILTERS = {
        afterDate: '',
        contentFilters: {
            onlyBookmarked: false,
            hideBookmarked: false,
            onlyWithImages: false,
            hideWithImages: false,
            hidePostTypes: []
        },
        interactionFilters: {
            minAnswers: '',
            maxAnswers: '',
            minLikes: ''
        },
        textFilters: {
            keywords: '',
            excludeKeywords: ''
        },
        topicFilters: {
            excludeTopics: '',
            includeTopics: ''
        }
    };

    // ============================================
    // ENHANCED FILTER INTEGRATION (logic only)
    // ============================================

    class EnhancedFilterIntegration {
        constructor() {
            if (!this.isHomePage()) return;

            this.filters = this.loadFilters();
            this.filtersEnabled = false;
            this.sidebar = null;
            this.debouncedApplyFilters = Utils.debounce(() => this.applyFilters(), 300);
            this.filterCache = {}; // Cache for filter results: key = filterHash + '|' + postFingerprint
            this.lastFilterHash = '';
            this.parsedFilterData = {
                excludeTopics: null,
                includeTopics: null,
                keywords: null,
                excludeKeywords: null,
                blockedAuthors: null
            };
        }

        isHomePage() {
            return window.location.pathname.startsWith('/home/');
        }

        loadFilters() {
            const saved = GM_getValue('enhancedFilters', {});
            return {
                afterDate: saved.afterDate ?? DEFAULT_FILTERS.afterDate,
                contentFilters: { ...DEFAULT_FILTERS.contentFilters, ...saved.contentFilters },
                interactionFilters: { ...DEFAULT_FILTERS.interactionFilters, ...saved.interactionFilters },
                textFilters: { ...DEFAULT_FILTERS.textFilters, ...saved.textFilters },
                topicFilters: { ...DEFAULT_FILTERS.topicFilters, ...saved.topicFilters }
            };
        }

        saveFilters() {
            GM_setValue('enhancedFilters', this.filters);
        }

        enableFilters() {
            if (!this.filtersEnabled) {
                this.filtersEnabled = true;
                this.observeNewPosts();
                console.log('[Gutefrage Smart Filters] Filters activated!');
            }
        }

        observeNewPosts() {
            if (this.postObserver) return;

            this.postObserver = new MutationObserver((mutations) => {
                if (!this.filtersEnabled) return;

                const hasNewPosts = mutations.some(mutation => {
                    return Array.from(mutation.addedNodes).some(node => {
                        return node.nodeType === 1 && (
                            node.matches?.('.Plate.ListingElement') ||
                            node.querySelector?.('.Plate.ListingElement')
                        );
                    });
                });

                if (hasNewPosts) {
                    this.debouncedApplyFilters();
                }
            });

            this.postObserver.observe(document.body, { childList: true, subtree: true });
        }

        updateFilterValue(filterPath, value) {
            const paths = filterPath.split('.');
            let current = this.filters;
            for (let i = 0; i < paths.length - 1; i++) {
                current = current[paths[i]];
            }
            current[paths[paths.length - 1]] = value;
            this.saveFilters();
            this.updateFilterIndicator();
        }

        updateFilterIndicator() {
            const countSpan = document.querySelector('.Filter-buttonActiveFiltersCount');
            if (!countSpan) return;

            let activeCount = 0;
            if (this.filters.afterDate) activeCount++;

            const cf = this.filters.contentFilters;
            if (cf.onlyBookmarked) activeCount++;
            if (cf.hideBookmarked) activeCount++;
            if (cf.onlyWithImages) activeCount++;
            if (cf.hideWithImages) activeCount++;
            if (cf.hidePostTypes?.length > 0) activeCount++;

            const inf = this.filters.interactionFilters;
            if (inf.minAnswers || inf.maxAnswers || inf.minLikes) activeCount++;

            const tf = this.filters.textFilters;
            if (tf.keywords || tf.excludeKeywords) activeCount++;

            const top = this.filters.topicFilters;
            if (top.excludeTopics || top.includeTopics) activeCount++;

            countSpan.textContent = activeCount > 0 ? activeCount : '';
            countSpan.style.display = activeCount > 0 ? 'inline-block' : 'none';
        }

        getFilterHash() {
            const blockedAuthors = GM_getValue('blockedAuthors', []);
            const customTags = GM_getValue('customTagsToRemove', []);
            return JSON.stringify({
                filters: this.filters,
                blockedAuthors: blockedAuthors,
                customTags: customTags
            });
        }

        updateParsedFilters() {
            // Parse filter strings once and cache them
            this.parsedFilterData = {
                excludeTopics: Utils.parseCSV(this.filters.topicFilters.excludeTopics),
                includeTopics: Utils.parseCSV(this.filters.topicFilters.includeTopics),
                keywords: Utils.parseCSV(this.filters.textFilters.keywords),
                excludeKeywords: Utils.parseCSV(this.filters.textFilters.excludeKeywords),
                blockedAuthors: GM_getValue('blockedAuthors', []).map(a => a.trim().toLowerCase())
            };
        }

        applyFilters() {
            if (!this.filtersEnabled) return;

            const posts = document.querySelectorAll('.Plate.ListingElement');
            let visibleCount = 0;

            const currentHash = this.getFilterHash();
            const shortHash = Utils.hashString(currentHash);

            // Clear cache if filters changed
            if (currentHash !== this.lastFilterHash) {
                this.filterCache = {};
                this.lastFilterHash = currentHash;
                this.updateParsedFilters();
            }

            // Limit cache size to prevent memory leaks
            if (Object.keys(this.filterCache).length > 1000) {
                this.filterCache = {};
            }

            // Ensure parsed filters are initialized
            if (!this.parsedFilterData || this.parsedFilterData.excludeTopics === null) {
                this.updateParsedFilters();
            }

            for (const post of posts) {
                // Calculate fingerprint for cache (survives DOM recycling)
                const postFingerprint = Utils.getPostFingerprint(post);
                const cacheKey = currentHash + '|' + postFingerprint;

                // Check memory cache first
                if (this.filterCache[cacheKey] !== undefined) {
                    // Use cached result from memory
                    const cachedResult = this.filterCache[cacheKey];
                    if (cachedResult === false) {
                        post.style.display = 'none';
                    } else {
                        visibleCount++;
                        post.style.display = '';
                    }
                    // Also update DOM attributes for consistency
                    post.dataset.filterHash = shortHash;
                    post.dataset.lastFilterResult = cachedResult ? 'visible' : 'hidden';
                    continue;
                }

                // Fallback to DOM cache (for backward compatibility)
                const postHash = post.dataset.filterHash;
                const lastResult = post.dataset.lastFilterResult;

                if (postHash === shortHash && lastResult) {
                    // Use cached result from DOM
                    const cachedResult = lastResult === 'visible';
                    this.filterCache[cacheKey] = cachedResult; // Populate memory cache
                    if (!cachedResult) {
                        post.style.display = 'none';
                    } else {
                        visibleCount++;
                        post.style.display = '';
                    }
                    continue;
                }

                let shouldShow = true;

                // Date filter
                if (this.filters.afterDate) {
                    const timeEl = post.querySelector('time[datetime]');
                    if (timeEl && new Date(timeEl.getAttribute('datetime')) < new Date(this.filters.afterDate)) {
                        shouldShow = false;
                    }
                }

                // Post type filter
                if (shouldShow && this.filters.contentFilters.hidePostTypes?.length > 0) {
                    const link = post.querySelector('a.ListingElement-questionLink[href]');
                    if (link) {
                        const href = link.getAttribute('href');
                        const type = href.includes('/frage/') ? 'frage'
                            : href.includes('/diskussion/') ? 'diskussion'
                            : href.includes('/umfrage/') ? 'umfrage'
                            : null;
                        if (type && this.filters.contentFilters.hidePostTypes.includes(type)) {
                            shouldShow = false;
                        }
                    }
                }

                // Bookmark filter
                if (shouldShow && (this.filters.contentFilters.onlyBookmarked || this.filters.contentFilters.hideBookmarked)) {
                    const isBookmarked = !!post.querySelector('.Icon--bookmark-filled-large');
                    if (this.filters.contentFilters.onlyBookmarked && !isBookmarked) shouldShow = false;
                    if (shouldShow && this.filters.contentFilters.hideBookmarked && isBookmarked) shouldShow = false;
                }

                // Images filter
                if (shouldShow && (this.filters.contentFilters.onlyWithImages || this.filters.contentFilters.hideWithImages)) {
                    const hasImages = Utils.getPostImagesStatus(post);
                    if (this.filters.contentFilters.onlyWithImages && !hasImages) shouldShow = false;
                    if (shouldShow && this.filters.contentFilters.hideWithImages && hasImages) shouldShow = false;
                }

                // Blocked author filter (using cached parsed data)
                if (shouldShow && this.parsedFilterData.blockedAuthors.length > 0) {
                    const authorName = Utils.getPostAuthor(post).toLowerCase();
                    if (authorName && this.parsedFilterData.blockedAuthors.includes(authorName)) {
                        shouldShow = false;
                    }
                }

                // Topic / Themenbereich filter (using cached parsed data)
                if (shouldShow && (this.parsedFilterData.excludeTopics.length > 0 || this.parsedFilterData.includeTopics.length > 0)) {
                    // Collect all topic elements (multiple selectors to catch different Gutefrage layouts)
                    const topicEls = post.querySelectorAll('a[href*="/thema/"], a:has(.BrandAvatar), [data-topic-slug], .ContentMeta-topic, .ContentMeta-category, a.u-strongLight:has(.BrandAvatar--small)');
                    const topicStrings = [];

                    for (const el of topicEls) {
                        const text = (el.textContent ?? '').trim().toLowerCase();
                        if (text) topicStrings.push(text);

                        // Extract slug from href or data attribute
                        const href = el.getAttribute('href');
                        if (href) {
                            // Try to extract any path segment that looks like a topic/category slug
                            // Remove leading/trailing slashes, query params, and hash
                            const cleanHref = href.replace(/^https?:\/\/[^\/]+/, ''); // Remove domain
                            const path = cleanHref.split('?')[0].split('#')[0]; // Remove query/hash
                            const slug = path.replace(/^\/|\/$/g, ''); // Trim slashes
                            if (slug && !slug.match(/^(frage|diskussion|umfrage|home|meine|suche|nutzer)\//)) {
                                // Add the full slug (e.g., "religion-glaube/goetter-propheten-religioese-figuren")
                                topicStrings.push(slug);

                                // If slug contains slashes, also add each component
                                if (slug.includes('/')) {
                                    const parts = slug.split('/');
                                    for (const part of parts) {
                                        if (part) topicStrings.push(part);
                                    }
                                }
                            }
                        }
                        const dataSlug = el.getAttribute('data-topic-slug');
                        if (dataSlug) topicStrings.push(dataSlug.toLowerCase());
                    }

                    // Remove duplicates
                    const uniqueTopics = [...new Set(topicStrings)];

                    // Exclude topics check
                    if (this.parsedFilterData.excludeTopics.length > 0 && uniqueTopics.length > 0) {
                        const hasExcluded = uniqueTopics.some(topic =>
                            this.parsedFilterData.excludeTopics.some(excl =>
                                Utils.topicsMatch(topic, excl)
                            )
                        );
                        if (hasExcluded) shouldShow = false;
                    }

                    // Include topics check (only if not already excluded)
                    if (shouldShow && this.parsedFilterData.includeTopics.length > 0) {
                        // If post has no topics, we can't filter it out based on topics
                        // (it might be a post without any topic assignment)
                        if (uniqueTopics.length === 0) {
                            // Leave it visible - can't determine if it matches or not
                        } else {
                            // Post has topics - check if at least one matches included topics
                            const hasIncluded = uniqueTopics.some(topic =>
                                this.parsedFilterData.includeTopics.some(inc =>
                                    Utils.topicsMatch(topic, inc)
                                )
                            );
                            if (!hasIncluded) shouldShow = false;
                        }
                    }
                }

                // Text filters (using cached parsed data)
                if (shouldShow && (this.parsedFilterData.keywords.length > 0 || this.parsedFilterData.excludeKeywords.length > 0)) {
                    const titleText = Utils.getPostTitle(post).toLowerCase();
                    const bodyText = post.querySelector('.ContentBody')?.textContent.toLowerCase() ?? '';
                    const authorText = Utils.getPostAuthor(post).toLowerCase();
                    const searchableText = titleText + ' ' + bodyText + ' ' + authorText;

                    if (this.parsedFilterData.keywords.length > 0) {
                        if (!this.parsedFilterData.keywords.some(k => searchableText.includes(k))) {
                            shouldShow = false;
                        }
                    }

                    if (shouldShow && this.parsedFilterData.excludeKeywords.length > 0) {
                        if (this.parsedFilterData.excludeKeywords.some(k => searchableText.includes(k))) {
                            shouldShow = false;
                        }
                    }
                }


                // Answer count filter
                if (shouldShow && (this.filters.interactionFilters.minAnswers !== '' || this.filters.interactionFilters.maxAnswers !== '')) {
                    const answerCount = Utils.getAnswerCount(post);
                    const minA = parseInt(this.filters.interactionFilters.minAnswers);
                    const maxA = parseInt(this.filters.interactionFilters.maxAnswers);
                    if (!isNaN(minA) && answerCount < minA) shouldShow = false;
                    if (shouldShow && !isNaN(maxA) && answerCount > maxA) shouldShow = false;
                }

                // Likes filter
                if (shouldShow && this.filters.interactionFilters.minLikes) {
                    const likeBtn = post.querySelector('.ActionBarIcon button[aria-label*="Daumen"]');
                    const likes = likeBtn
                        ? parseInt(likeBtn.getAttribute('aria-label').match(/(\d+)/)?.[1]) || 0
                        : parseInt(post.querySelector('.ActionBarIcon-count')?.textContent) || 0;
                    if (likes < parseInt(this.filters.interactionFilters.minLikes)) shouldShow = false;
                }

                // Store cache
                this.filterCache[cacheKey] = shouldShow; // Memory cache
                post.dataset.filterHash = shortHash;
                post.dataset.lastFilterResult = shouldShow ? 'visible' : 'hidden';

                if (shouldShow) visibleCount++;
                post.style.display = shouldShow ? '' : 'none';
            }

            this.updateStatsOverlay(visibleCount, posts.length);
        }

        updateStatsOverlay(visible, total) {
            if (this.sidebar?.isOpen) {
                this.sidebar.updateStats(visible, total);
                const overlay = document.getElementById('gf-stats-overlay');
                if (overlay) overlay.style.display = 'none';
                return;
            }

            if (this.sidebar) {
                this.sidebar.updateStats(visible, total);
            }

            let overlay = document.getElementById('gf-stats-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'gf-stats-overlay';
                overlay.style.cssText = `
                    position: fixed; bottom: 20px; right: 20px;
                    background: rgba(30,33,48,0.85); color: white;
                    padding: 7px 14px; border-radius: 20px;
                    font-size: 12px; z-index: 9999; pointer-events: none;
                    backdrop-filter: blur(6px); font-weight: 500;
                `;
                document.body.appendChild(overlay);
            }

            const filtered = total - visible;
            overlay.textContent = `${visible} sichtbar \u00b7 ${filtered} gefiltert`;
            overlay.style.display = filtered > 0 ? 'block' : 'none';
        }
    }

    // ============================================
    // SIDEBAR PANEL
    // ============================================

    class SidebarPanel {
        constructor(fi) {
            if (!window.location.pathname.startsWith('/home/')) return;
            this.fi = fi;
            this.fi.sidebar = this;
            this.isOpen = GM_getValue('sidebarOpen', false);
            this.createPanel();
            if (GM_getValue('darkMode', false)) this.panel.classList.add('gf-dark');
            this.createToggleTab();
            if (this.isOpen) this.open(false);
        }

        createPanel() {
            this.panel = document.createElement('div');
            this.panel.id = 'gf-sidebar';
            this.renderContent();
            document.body.appendChild(this.panel);
        }

        createToggleTab() {
            this.tab = document.createElement('button');
            this.tab.id = 'gf-sidebar-tab';
            this.tab.textContent = 'Filter & Tools';
            this.tab.title = 'Erweiterte Filter \u00f6ffnen / schlie\xdfen';
            this.tab.addEventListener('click', () => this.toggle());
            document.body.appendChild(this.tab);
        }

        toggle() { this.isOpen ? this.close() : this.open(); }

        open(save = true) {
            this.isOpen = true;
            this.panel.style.right = '0';
            this.tab.style.right = '340px';
            document.body.classList.add('gf-sidebar-open');
            if (save) GM_setValue('sidebarOpen', true);
            this.fi.enableFilters();
            setTimeout(() => this.fi.applyFilters(), 100);
        }

        close(save = true) {
            this.isOpen = false;
            this.panel.style.right = '-360px';
            this.tab.style.right = '0';
            document.body.classList.remove('gf-sidebar-open');
            if (save) GM_setValue('sidebarOpen', false);
        }

        updateStats(visible, total) {
            const statsEl = this.panel.querySelector('.gf-stats-bar');
            if (!statsEl) return;
            const filtered = total - visible;
            if (filtered > 0) {
                statsEl.textContent = `${visible} sichtbar  \u00b7  ${filtered} ausgeblendet`;
                statsEl.classList.add('active');
            } else {
                statsEl.classList.remove('active');
            }
        }

        renderContent() {
            const f = this.fi.filters;
            const hideTypes = f.contentFilters.hidePostTypes || [];
            const customTags = GM_getValue('customTagsToRemove', DEFAULT_TAGS).join(', ');
            const blockedAuthors = GM_getValue('blockedAuthors', []).join(', ');
            const isDark = GM_getValue('darkMode', false);
            const dateVal = f.afterDate || '';
            const isUnansweredPage = window.location.pathname.includes('/unbeantwortet');

            const togBtn = (id, dataFilter, isOn, label) => `
                <div class="gf-toggle-row">
                    <span class="gf-toggle-label">${label}</span>
                    <button class="Toggle-button u-mrm" type="button" id="${id}" role="switch"
                            aria-checked="${isOn}" ${dataFilter ? `data-filter="${dataFilter}"` : ''}>
                        <span class="Toggle ${isOn ? 'Toggle--on' : 'Toggle--off'}">
                            <span class="Toggle-label"></span>
                        </span>
                    </button>
                </div>`;

            this.panel.innerHTML = `
                <div class="gf-header">
                    <span class="gf-header-title">\u2699 Filter &amp; Tools</span>
                    <button class="gf-header-close" title="Schlie\xdfen">\u2715</button>
                </div>
                <div class="gf-stats-bar"></div>

                <div class="gf-body">

                    <div class="gf-section">
                        <div class="gf-section-title">Fragetyp</div>
                        <div class="gf-pill-row">
                            <label class="gf-pill-label">
                                <input type="checkbox" data-posttype="frage" ${!hideTypes.includes('frage') ? 'checked' : ''}> Fragen
                            </label>
                            <label class="gf-pill-label">
                                <input type="checkbox" data-posttype="diskussion" ${!hideTypes.includes('diskussion') ? 'checked' : ''}> Diskussionen
                            </label>
                            <label class="gf-pill-label">
                                <input type="checkbox" data-posttype="umfrage" ${!hideTypes.includes('umfrage') ? 'checked' : ''}> Umfragen
                            </label>
                        </div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Datum-Filter</div>
                        <input type="datetime-local" class="gf-input" data-filter="afterDate"
                               value="${dateVal}" title="Nur Beitr\u00e4ge ab diesem Datum anzeigen">
                        <div class="gf-hint">Blendet Beitr\u00e4ge <strong>vor</strong> diesem Datum aus (AB-Filter)</div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Feed-Navigation</div>
                        <span class="gf-label">Zu diesem Datum springen:</span>
                        <input type="datetime-local" class="gf-input" id="gf-nav-date"
                               value="${GM_getValue('navDate', '')}"
                               title="Springt im Gutefrage-Feed zu diesem Datum (VOR-Navigation)">
                        <div class="gf-hint">Springt im Feed zu Beitr\u00e4gen <strong>vor</strong> diesem Datum</div>
                        <div class="gf-nav-row">
                            <button class="gf-nav-btn ${!isUnansweredPage ? 'active' : ''}" id="gf-nav-alle"
                                    title="In &lsquo;Alle Beitr\u00e4ge f\u00fcr Dich&rsquo; zu diesem Datum springen">
                                Alle Beitr\u00e4ge \u2192
                            </button>
                            <button class="gf-nav-btn ${isUnansweredPage ? 'active' : ''}" id="gf-nav-unbeantwortet"
                                    title="In &lsquo;Unbeantwortet&rsquo; zu diesem Datum springen">
                                Unbeantwortet \u2192
                            </button>
                            <button class="gf-nav-btn" id="gf-nav-reset"
                                    title="Feed-Navigation zur\u00fccksetzen (Datum l\u00f6schen)">
                                Zur\u00fccksetzen \u21BA
                            </button>
                        </div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Themenbereich</div>
                        <span class="gf-label">Themen ausschlie\xdfen (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. Liebe, Sport, Tiere"
                               value="${f.topicFilters.excludeTopics}" data-filter="topicFilters.excludeTopics">
                        <span class="gf-label">Nur diese Themen (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. Computer, Technik"
                               value="${f.topicFilters.includeTopics}" data-filter="topicFilters.includeTopics">
                        <div class="gf-hint">Themenname oder Slug (z.B. computer-internet)</div>
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Bilder-Filter</div>
                        ${togBtn('sb-only-with-images', 'contentFilters.onlyWithImages', f.contentFilters.onlyWithImages, 'Nur Beitr\u00e4ge mit Bildern')}
                        ${togBtn('sb-hide-with-images', 'contentFilters.hideWithImages', f.contentFilters.hideWithImages, 'Beitr\u00e4ge mit Bildern ausblenden')}
                        <div class="gf-hint">Filtert nach Posts mit oder ohne Bildern</div>
                    </div>


                    <div class="gf-section">
                        <div class="gf-section-title">Gemerkte Beitr\u00e4ge</div>
                        ${togBtn('sb-only-bookmarked', 'contentFilters.onlyBookmarked', f.contentFilters.onlyBookmarked, 'Nur gemerkte anzeigen')}
                        ${togBtn('sb-hide-bookmarked', 'contentFilters.hideBookmarked', f.contentFilters.hideBookmarked, 'Gemerkte ausblenden')}
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Interaktion</div>
                        <span class="gf-label">Anzahl Antworten:</span>
                        <div class="gf-number-row">
                            <input type="number" placeholder="Min" value="${f.interactionFilters.minAnswers}"
                                   data-filter="interactionFilters.minAnswers" min="0">
                            <span>bis</span>
                            <input type="number" placeholder="Max" value="${f.interactionFilters.maxAnswers}"
                                   data-filter="interactionFilters.maxAnswers" min="0">
                        </div>
                        <span class="gf-label">Mindest-Likes:</span>
                        <input type="number" class="gf-input" placeholder="z.B. 5"
                               value="${f.interactionFilters.minLikes}" data-filter="interactionFilters.minLikes" min="0">
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Textfilter</div>
                        <span class="gf-label">Suchbegriffe (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. JavaScript, Python"
                               value="${f.textFilters.keywords}" data-filter="textFilters.keywords">
                        <span class="gf-label">Ausschlie\xdfen (kommagetrennt):</span>
                        <input type="text" class="gf-input" placeholder="z.B. Spam, Werbung"
                               value="${f.textFilters.excludeKeywords}" data-filter="textFilters.excludeKeywords">
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Einstellungen</div>
                        <span class="gf-label">Tags automatisch entfernen (kommagetrennt):</span>
                        <input type="text" class="gf-input" id="gf-custom-tags" value="${customTags}">
                        <span class="gf-label">Gesperrte Autoren (kommagetrennt):</span>
                        <input type="text" class="gf-input" id="gf-blocked-authors" value="${blockedAuthors}">
                    </div>

                    <div class="gf-section">
                        <div class="gf-section-title">Darstellung</div>
                        ${togBtn('sb-dark-mode', '', isDark, 'Dark Mode')}
                    </div>

                    <button class="gf-reset-btn">\u21ba Alle Filter zur\u00fccksetzen</button>

                </div>
            `;

            this.attachEventListeners();
        }

        attachEventListeners() {
            const panel = this.panel;

            panel.querySelector('.gf-header-close').addEventListener('click', () => this.close());

            // Post type checkboxes
            panel.querySelectorAll('[data-posttype]').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const type = checkbox.getAttribute('data-posttype');
                    const hideTypes = [...(this.fi.filters.contentFilters.hidePostTypes || [])];
                    if (checkbox.checked) {
                        const idx = hideTypes.indexOf(type);
                        if (idx > -1) hideTypes.splice(idx, 1);
                    } else {
                        if (!hideTypes.includes(type)) hideTypes.push(type);
                    }
                    this.fi.filters.contentFilters.hidePostTypes = hideTypes;
                    this.fi.saveFilters();
                    this.fi.updateFilterIndicator();
                    this.fi.enableFilters();
                    this.fi.debouncedApplyFilters();
                });
            });

            // Toggle buttons — mutual exclusion for bookmarks
            panel.querySelectorAll('.Toggle-button[data-filter]').forEach(button => {
                button.addEventListener('click', () => {
                    const toggle = button.querySelector('.Toggle');
                    const isOn = toggle.classList.contains('Toggle--on');

                    if (!isOn && (button.id === 'sb-only-bookmarked' || button.id === 'sb-hide-bookmarked')) {
                        const otherId = button.id === 'sb-only-bookmarked' ? 'sb-hide-bookmarked' : 'sb-only-bookmarked';
                        const other = panel.querySelector(`#${otherId}`);
                        if (other?.querySelector('.Toggle').classList.contains('Toggle--on')) {
                            other.querySelector('.Toggle').classList.replace('Toggle--on', 'Toggle--off');
                            other.setAttribute('aria-checked', 'false');
                            this.fi.updateFilterValue(other.getAttribute('data-filter'), false);
                        }
                    }
                    if (!isOn && (button.id === 'sb-only-with-images' || button.id === 'sb-hide-with-images')) {
                        const otherId = button.id === 'sb-only-with-images' ? 'sb-hide-with-images' : 'sb-only-with-images';
                        const other = panel.querySelector(`#${otherId}`);
                        if (other?.querySelector('.Toggle').classList.contains('Toggle--on')) {
                            other.querySelector('.Toggle').classList.replace('Toggle--on', 'Toggle--off');
                            other.setAttribute('aria-checked', 'false');
                            this.fi.updateFilterValue(other.getAttribute('data-filter'), false);
                        }
                    }

                    toggle.classList.toggle('Toggle--on', !isOn);
                    toggle.classList.toggle('Toggle--off', isOn);
                    button.setAttribute('aria-checked', !isOn);
                    this.fi.updateFilterValue(button.getAttribute('data-filter'), !isOn);
                    this.fi.enableFilters();
                    this.fi.debouncedApplyFilters();
                });
            });

            // Dark mode toggle (no data-filter attribute, handled separately)
            panel.querySelector('#sb-dark-mode').addEventListener('click', () => {
                const isDark = !GM_getValue('darkMode', false);
                GM_setValue('darkMode', isDark);
                this.panel.classList.toggle('gf-dark', isDark);
                const btn = panel.querySelector('#sb-dark-mode');
                btn.setAttribute('aria-checked', isDark);
                btn.querySelector('.Toggle').className = 'Toggle ' + (isDark ? 'Toggle--on' : 'Toggle--off');
            });

            // Filter inputs (datetime, text, number — all with data-filter)
            panel.querySelectorAll('input[data-filter]').forEach(input => {
                input.addEventListener('change', () => {
                    this.fi.updateFilterValue(input.getAttribute('data-filter'), input.value);
                    this.fi.enableFilters();
                    this.fi.debouncedApplyFilters();
                });
            });

            // Feed navigation — own separate date input, independent of date filter
            panel.querySelector('#gf-nav-date').addEventListener('change', (e) => {
                GM_setValue('navDate', e.target.value);
            });

            panel.querySelector('#gf-nav-alle').addEventListener('click', () => {
                const tz = Utils.toSpringeZu(GM_getValue('navDate', ''));
                const baseUrl = '/home/meine/alle';
                const url = tz ? `${baseUrl}?springe-zu=${encodeURIComponent(tz)}` : baseUrl;
                window.location.href = url;
            });

            panel.querySelector('#gf-nav-unbeantwortet').addEventListener('click', () => {
                const tz = Utils.toSpringeZu(GM_getValue('navDate', ''));
                const baseUrl = '/home/meine/unbeantwortet';
                const url = tz ? `${baseUrl}?springe-zu=${encodeURIComponent(tz)}` : baseUrl;
                window.location.href = url;
            });

            panel.querySelector('#gf-nav-reset').addEventListener('click', () => {
                // Clear stored date
                GM_setValue('navDate', '');
                // Clear input field
                const dateInput = panel.querySelector('#gf-nav-date');
                if (dateInput) dateInput.value = '';
                // Optionally remove springe-zu parameter from current URL and reload
                const url = new URL(window.location.href);
                if (url.searchParams.has('springe-zu')) {
                    url.searchParams.delete('springe-zu');
                    window.location.href = url.toString();
                }
            });

            // Settings: custom tags
            panel.querySelector('#gf-custom-tags').addEventListener('change', (e) => {
                const tags = Utils.parseCSV(e.target.value, false); // Keep original case for tags
                GM_setValue('customTagsToRemove', tags);
            });

            // Settings: blocked authors
            panel.querySelector('#gf-blocked-authors').addEventListener('change', (e) => {
                const authors = Utils.parseCSV(e.target.value, false); // Case preserved, will be lowercased in updateParsedFilters
                GM_setValue('blockedAuthors', authors);
                this.fi.enableFilters();
                this.fi.debouncedApplyFilters();
            });

            // Reset
            panel.querySelector('.gf-reset-btn').addEventListener('click', () => {
                this.fi.filters = {
                    ...DEFAULT_FILTERS,
                    contentFilters: { ...DEFAULT_FILTERS.contentFilters },
                    interactionFilters: { ...DEFAULT_FILTERS.interactionFilters },
                    textFilters: { ...DEFAULT_FILTERS.textFilters },
                    topicFilters: { ...DEFAULT_FILTERS.topicFilters }
                };
                this.fi.saveFilters();
                this.fi.updateFilterIndicator();
                this.renderContent();
                this.fi.applyFilters();
            });
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    console.log('[Gutefrage Smart Filters] Initializing...');

    new TagRemover();

    const filterIntegration = new EnhancedFilterIntegration();
    new SidebarPanel(filterIntegration);

    console.log('[Gutefrage Smart Filters] Ready!');
})();

```

---

## Manga Panel Downloader — v2.2

- **Datei:** `Manga Panel Downloader.user.js`
- **Matches:** *://*/*
- **Grants:** GM_addStyle, GM_xmlhttpRequest, GM_registerMenuCommand, GM_deleteValue
- **Beschreibung:** Lädt Manga/Manhwa-Panels als ZIP — Pipeline-Download, Retry, Abort, schnelles Scrollen

```javascript
// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Lädt Manga/Manhwa-Panels als ZIP — Pipeline-Download, Retry, Abort, schnelles Scrollen
// @author       marmoris
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_deleteValue
// @connect      *
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ── One-time cleanup of legacy storage keys ───────────────────────────────
    GM_deleteValue('mpd-allowed-sites');
    GM_deleteValue('mpd-manga-mode');

    // ── Session-based activation (no persistent storage) ────────────────────────
    const host = location.hostname;

    // Session variable - resets on page reload
    window.mpd_enabled = window.mpd_enabled || false;
    let downloader = null;

    function initDownloader() {
        if (downloader) return; // Already initialized
        downloader = new MangaDownloader();
    }

    function toggleDownloader() {
        window.mpd_enabled = !window.mpd_enabled;
        if (window.mpd_enabled) {
            initDownloader(); // Create UI when activated
        } else if (downloader) {
            // Remove UI when deactivated
            const sb = document.getElementById('mpd-sb');
            if (sb) sb.remove();
            downloader = null;
        }
    }

    GM_registerMenuCommand(
        window.mpd_enabled ? 'Manga Downloader deaktivieren' : 'Manga Downloader aktivieren',
        toggleDownloader
    );

    // Initialize immediately if enabled
    if (window.mpd_enabled) {
        initDownloader();
    }

    // ── Constants ─────────────────────────────────────────────────────────────
    const SW                = 320;
    const MIN_IMG_PX        = 400;
    const MAX_SEG_H         = 3500;
    const MIN_SEG_H         = 600;
    const CONCURRENT_DL     = 6;
    const MAX_PAGES         = 200;
    const SCROLL_TIMEOUT_MS = 3000;
    const NAV_CLICK_WAIT_MS = 50;   // Wait after clicking next before polling for URL change
    const NAV_LOAD_WAIT_MS  = 150;  // Wait after URL changes before image polling starts
    const NAV_TIMEOUT_MS    = 5000; // Max wait for URL to change after clicking next
    const MANGA_POLL_MS     = 50;   // Poll interval when waiting for images to appear
    const MANGA_MAX_WAIT_MS = 3000; // Max total wait for images per page (increased to compensate)
    const FETCH_RETRY_COUNT = 2;

    // ── Styles ────────────────────────────────────────────────────────────────
    GM_addStyle(`
        html { transition: margin-right 0.3s ease !important; }
        html.mpd-pushed { margin-right: ${SW}px !important; }
        #mpd-sb {
            position: fixed; top: 0; right: 0;
            width: ${SW}px; height: 100vh;
            background: #1a1b1e; color: #c1c2c5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px; z-index: 2147483647;
            transform: translateX(100%); transition: transform 0.3s ease;
            display: flex; flex-direction: column;
            box-shadow: -2px 0 20px rgba(0,0,0,0.6);
        }
        #mpd-sb.open { transform: translateX(0); }
        #mpd-toggle {
            position: absolute; left: -36px; top: 50%;
            transform: translateY(-50%);
            width: 36px; height: 72px;
            background: #2f9e44; color: #fff; border: none;
            border-radius: 6px 0 0 6px; cursor: pointer;
            font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
            writing-mode: vertical-rl; padding: 8px 4px; transition: background 0.15s;
        }
        #mpd-toggle:hover { background: #237032; }
        #mpd-header {
            padding: 14px 16px 12px; border-bottom: 1px solid #2c2d32;
            font-size: 15px; font-weight: 700; color: #fff;
        }
        #mpd-controls {
            padding: 12px 16px; border-bottom: 1px solid #2c2d32;
            display: flex; flex-direction: column; gap: 9px;
        }
        .mpd-btn-row { display: flex; gap: 8px; }
        .mpd-btn-row button { flex: 1; }
        .mpd-btn {
            padding: 7px 12px; border: none; border-radius: 4px;
            font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .mpd-primary   { background: #2f9e44; color: #fff; }
        .mpd-primary:hover:not(:disabled)   { background: #237032; }
        .mpd-danger    { background: #c92a2a; color: #fff; }
        .mpd-danger:hover:not(:disabled)    { background: #a61e1e; }
        .mpd-secondary { background: #2c2d32; color: #c1c2c5; }
        .mpd-secondary:hover:not(:disabled) { background: #373a40; }
        .mpd-btn:disabled { background: #333; color: #555; cursor: not-allowed; }
        #mpd-progress {
            height: 3px; background: #2c2d32; border-radius: 2px;
            overflow: hidden; display: none;
        }
        #mpd-progress-bar {
            height: 100%; background: #2f9e44; width: 0%; transition: width 0.15s;
        }
        #mpd-status { font-size: 12px; color: #909296; min-height: 16px; }
        #mpd-results { flex: 1; overflow-y: auto; padding: 8px 0; }
        #mpd-results::-webkit-scrollbar { width: 5px; }
        #mpd-results::-webkit-scrollbar-track { background: #1a1b1e; }
        #mpd-results::-webkit-scrollbar-thumb { background: #373a40; border-radius: 3px; }
        .mpd-thumb {
            display: flex; align-items: center; gap: 10px;
            padding: 6px 14px; border-bottom: 1px solid #25262b;
        }
        .mpd-thumb img {
            width: 48px; height: 48px; object-fit: cover;
            border-radius: 3px; flex-shrink: 0; background: #25262b;
        }
        .mpd-thumb-info { flex: 1; min-width: 0; }
        .mpd-thumb-name {
            font-size: 11px; color: #909296;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mpd-thumb-size { font-size: 11px; color: #555; }
        .mpd-thumb input[type=checkbox] {
            flex-shrink: 0; width: 15px; height: 15px;
            cursor: pointer; accent-color: #2f9e44;
        }
        #mpd-footer {
            padding: 8px 16px; border-top: 1px solid #2c2d32;
            font-size: 11px; color: #555;
        }
        .mpd-toggle-row {
            display: flex; align-items: center; gap: 8px;
            font-size: 12px; color: #909296; cursor: pointer; user-select: none;
        }
        .mpd-toggle-row input { cursor: pointer; accent-color: #2f9e44; }
    `);

    // ─────────────────────────────────────────────────────────────────────────

    class MangaDownloader {

        constructor() {
            this.segments          = [];   // { filename, blob, previewUrl, w, h }
            this.errors            = [];   // { src, message }
            this.scanning          = false;
            this.aborted           = false;
            this.mangaMode         = window.mpd_mangaMode || false;
            this.scannedUrls       = new Set();
            this.previewRevokeTimer = null;
            this._buildUI();
            this._watchUrlChanges();
        }

        // ── UI ────────────────────────────────────────────────────────────────

        _buildUI() {
            const sb = document.createElement('div');
            sb.id = 'mpd-sb';
            sb.innerHTML = `
                <button id="mpd-toggle">DL</button>
                <div id="mpd-header">Manga Downloader</div>
                <div id="mpd-controls">
                    <div class="mpd-btn-row">
                        <button class="mpd-btn mpd-primary" id="mpd-scan">Scan</button>
                        <button class="mpd-btn mpd-secondary" id="mpd-dl" disabled>ZIP</button>
                    </div>
                    <label class="mpd-toggle-row">
                        <input type="checkbox" id="mpd-manga-mode" ${this.mangaMode ? 'checked' : ''}>
                        <span>Manga-Modus (auto weiterklicken)</span>
                    </label>
                    <div id="mpd-progress"><div id="mpd-progress-bar"></div></div>
                    <div id="mpd-status">Bereit.</div>
                </div>
                <div id="mpd-results"></div>
                <div id="mpd-footer"></div>
            `;
            // Append to <html> not <body> — SPA routers frequently replace body's
            // innerHTML or unmount the root div, which would destroy a body-injected
            // sidebar and crash subsequent getElementById calls with null.
            document.documentElement.appendChild(sb);

            // Scan button doubles as Stop during a running scan
            document.getElementById('mpd-scan').addEventListener('click', () => {
                if (this.scanning) this._abort();
                else               this._scan();
            });
            document.getElementById('mpd-dl').addEventListener('click',     () => this._download());
            document.getElementById('mpd-toggle').addEventListener('click', () => this._toggle());
            document.getElementById('mpd-manga-mode').addEventListener('change', e => {
                this.mangaMode = e.target.checked;
                window.mpd_mangaMode = this.mangaMode;
            });
        }

        _toggle() {
            const sb   = document.getElementById('mpd-sb');
            const open = !sb.classList.contains('open');
            sb.classList.toggle('open', open);
            document.documentElement.classList.toggle('mpd-pushed', open);
        }

        _setScanBtn(scanning) {
            const btn     = document.getElementById('mpd-scan');
            btn.textContent = scanning ? 'Stop' : 'Scan';
            btn.className   = `mpd-btn ${scanning ? 'mpd-danger' : 'mpd-primary'}`;
        }

        _status(msg)   { document.getElementById('mpd-status').textContent = msg; }

        _progress(pct) {
            document.getElementById('mpd-progress').style.display =
                (pct > 0 && pct < 100) ? 'block' : 'none';
            document.getElementById('mpd-progress-bar').style.width = `${pct}%`;
        }

        // ── URL-change watcher ────────────────────────────────────────────────

        _watchUrlChanges() {
            let lastUrl = location.href;
            const onChange = () => {
                if (location.href === lastUrl) return;
                lastUrl = location.href;
                // Never wipe while scanning, and never wipe when results are loaded.
                // Using dl.disabled as guard was wrong: _download() sets disabled=true
                // immediately before async ZIP generation, so any late SPA navigation
                // (the producer's last _navigateNext completing after the scan finished)
                // would trigger _reset() mid-download and destroy all thumbnails.
                if (this.scanning) return;
                if (this.segments.length > 0) return;
                this._reset();
            };
            window.addEventListener('popstate',   onChange);
            window.addEventListener('hashchange', onChange);
            // Poll for SPA pushState/replaceState navigations that don't fire browser
            // events. Avoids cross-world closure issues with unsafeWindow in Firefox
            // (assigning Isolated World functions to Main World history can throw
            // SecurityError in strict Greasemonkey/MV3 environments).
            setInterval(onChange, 1000);
        }

        _reset() {
            if (this.scanning) return;
            clearTimeout(this.previewRevokeTimer);
            this.previewRevokeTimer = null;
            this._revokeAllPreviews();
            this.segments = [];
            this.errors   = [];
            const results = document.getElementById('mpd-results');
            const footer  = document.getElementById('mpd-footer');
            const dl      = document.getElementById('mpd-dl');
            if (results) results.innerHTML  = '';
            if (footer)  footer.textContent = '';
            if (dl)      dl.disabled = true;
            this._status('Bereit.');
            this._progress(0);
        }

        _revokeAllPreviews() {
            this.segments.forEach(s => { try { URL.revokeObjectURL(s.previewUrl); } catch {} });
        }

        // ── URL helpers ───────────────────────────────────────────────────────

        // Strip query-string + hash so CDN tokens don't defeat deduplication
        _normalizeUrl(url) {
            if (!url || url.startsWith('data:')) return url || '';
            try {
                const u = new URL(url, location.href);
                return u.origin + u.pathname;
            } catch {
                return url.split('?')[0].split('#')[0];
            }
        }

        _getSrc(el) {
            const raw = el.src
                || el.currentSrc
                || this._extractLazySrc(el)
                || el.getAttribute('data-srcset')?.split(/[\s,]+/)[0]
                || el.getAttribute('srcset')?.split(/[\s,]+/)[0]
                || '';
            // GM_xmlhttpRequest requires absolute URLs; el.src/currentSrc are already
            // absolute (browser resolves them), but lazy-load attributes may be relative.
            if (!raw || raw.startsWith('data:') || raw.startsWith('http')) return raw;
            try { return new URL(raw, location.href).href; } catch { return raw; }
        }

        _extractLazySrc(el) {
            return el.dataset.src
                || el.dataset.lazySrc
                || el.dataset.original
                || el.dataset.url
                || el.dataset.imgSrc
                || el.dataset.lazyload
                || el.getAttribute('data-cfsrc')
                || el.getAttribute('data-echo')
                || null;
        }

        // All possible URLs this element might have (raw + CDN-normalized variants)
        _allSrcsOf(el) {
            const srcs = new Set();
            const add  = v => {
                if (!v || typeof v !== 'string' || v.length < 5) return;
                srcs.add(v);
                // No normalization here — stripping query params would cause sites that
                // identify images via query string (reader.php?panel=N) to have all
                // subsequent pages flagged as duplicates of the first.
            };
            if (!el) return srcs;
            add(el.src);
            add(el.currentSrc);
            add(this._extractLazySrc(el));
            add(el.getAttribute?.('data-srcset')?.split(/[\s,]+/)[0]);
            add(el.getAttribute?.('srcset')?.split(/[\s,]+/)[0]);
            // Absolutise any relative variants
            for (const s of [...srcs]) {
                if (s && !s.startsWith('data:') && !s.startsWith('http')) {
                    try { add(new URL(s, location.href).href); } catch {}
                }
            }
            return srcs;
        }

        // ── Image detection ───────────────────────────────────────────────────

        _findImages() {
            const seen    = new Set();
            const results = [];

            const tryAdd = (el, src) => {
                if (!src || el?.dataset?.mpdProcessed) return;
                // Deduplicate by raw URL only — normalizing here would incorrectly
                // collapse query-param-identified images (reader.php?panel=1 vs ?panel=2)
                if (seen.has(src)) return;
                if (/\.(svg|gif)(\?|#|$)/i.test(src)) return;
                if (src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) return;

                const parentTag = el.parentElement?.tagName?.toLowerCase();
                if (['nav', 'header', 'footer'].includes(parentTag)) return;

                // Skip invisible elements (pre-loaded adjacent panels hidden in DOM)
                if (el.nodeType === Node.ELEMENT_NODE) {
                    const cs = window.getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return;
                    if (el.tagName === 'IMG' && el.offsetWidth === 0 && el.offsetHeight === 0) return;
                }

                const nw = el.naturalWidth  || parseInt(el.getAttribute?.('width'))  || el.offsetWidth  || 0;
                const nh = el.naturalHeight || parseInt(el.getAttribute?.('height')) || el.offsetHeight || 0;
                if (nw > 0 && nw < 100 && nh > 0 && nh < 100) return;

                seen.add(src);
                results.push({ el, src });
            };

            document.querySelectorAll('img')
                .forEach(img => tryAdd(img, this._getSrc(img)));

            document.querySelectorAll('picture source').forEach(s => {
                const url = s.srcset?.split(/[\s,]+/)[0];
                if (url) tryAdd(s.closest('picture')?.querySelector('img') || s, url);
            });

            document.querySelectorAll('[style*="background"]').forEach(el => {
                const m = el.style.backgroundImage?.match(/url\(['"]?([^'")\s]+)['"]?\)/);
                if (m && el.offsetWidth >= MIN_IMG_PX && el.offsetHeight >= MIN_IMG_PX)
                    tryAdd(el, m[1]);
            });

            document.querySelectorAll('canvas').forEach(c => {
                if (c.width < MIN_IMG_PX || c.height < MIN_IMG_PX) return;
                try {
                    const d = c.toDataURL('image/jpeg', 0.92);
                    if (d?.length > 1000) tryAdd(c, d);
                } catch {}
            });

            return results;
        }

        // ── Lazy-load trigger ─────────────────────────────────────────────────

        _triggerAllLazy() {
            document.querySelectorAll('img').forEach(img => {
                const lazy = this._extractLazySrc(img);
                if (lazy && !img.src.startsWith('http') && !img.src.startsWith('data:'))
                    img.src = lazy;
            });
        }

        // ── Scroll-to-load (non-manga mode only) ──────────────────────────────
        // Jumps directly to unloaded images instead of a slow fixed-step sweep.

        async _scrollLoad() {
            // Pass 1: force all known lazy attributes immediately
            this._triggerAllLazy();
            await this._sleep(150);

            const getUnloaded = () =>
                Array.from(document.querySelectorAll('img')).filter(img =>
                    (!img.complete || !img.naturalWidth) &&
                    (img.src?.startsWith('http') || this._extractLazySrc(img))
                );

            // Pass 2: scroll directly to each unloaded image
            for (const img of getUnloaded()) {
                img.scrollIntoView({ block: 'center', behavior: 'instant' });
                this._triggerAllLazy();
                await this._sleep(60);
            }

            // Pass 3: one fast full-page sweep to catch any stragglers
            const pageH = document.documentElement.scrollHeight;
            for (let y = 0; y <= pageH; y += window.innerHeight) {
                window.scrollTo(0, y);
                this._triggerAllLazy();
                await this._sleep(40);
            }

            // Pass 4: poll until all images loaded, max SCROLL_TIMEOUT_MS
            const deadline = Date.now() + SCROLL_TIMEOUT_MS;
            while (Date.now() < deadline) {
                this._triggerAllLazy();
                if (getUnloaded().length === 0) break;
                await this._sleep(150);
            }

            window.scrollTo(0, 0);
            await this._sleep(100);
        }

        // ── Fetch ─────────────────────────────────────────────────────────────

        _fetchBlob(url, extraHeaders = {}) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    responseType: 'blob',
                    headers: Object.fromEntries(
                        Object.entries({
                            Referer: location.href,
                            Origin:  location.origin,
                            ...extraHeaders,
                        }).filter(([, v]) => v != null)
                    ),
                    onload:    r  => r.status === 200 && r.response?.size > 100
                        ? resolve(r.response)
                        : reject(new Error(`HTTP ${r.status}`)),
                    onerror:   () => reject(new Error('Network error')),
                    ontimeout: () => reject(new Error('Timeout')),
                    timeout: 20000,
                });
            });
        }

        async _fetchBlobWithFallbacks(src, el) {
            if (src?.startsWith('data:')) return (await fetch(src)).blob();

            const errs = [];
            const t = async fn => { try { return await fn(); } catch(e) { errs.push(e.message); } };

            return (
                await t(() => this._fetchBlob(src))
                || await t(() => this._fetchBlob(src, { Origin: null }))
                || await t(() => this._fetchBlob(src, { Referer: null, Origin: null }))
                || await t(async () => {
                    const r = await fetch(src, { credentials: 'include' });
                    if (r.ok) return r.blob();
                    throw new Error(`HTTP ${r.status}`);
                })
                || await t(async () => {
                    // Canvas redraw of already-loaded DOM img
                    if (el?.tagName === 'IMG' && el.complete && el.naturalWidth > 0) {
                        const c = document.createElement('canvas');
                        c.width = el.naturalWidth; c.height = el.naturalHeight;
                        c.getContext('2d').drawImage(el, 0, 0);
                        return new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
                    }
                    throw new Error('Not a loaded img');
                })
                || (() => { throw new Error(errs.join(' | ')); })()
            );
        }

        // Retry wrapper with exponential backoff
        async _fetchWithRetry(src, el) {
            let lastErr;
            for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
                if (this.aborted) throw new Error('Abgebrochen');
                try {
                    return await this._fetchBlobWithFallbacks(src, el);
                } catch(e) {
                    lastErr = e;
                    if (attempt < FETCH_RETRY_COUNT) await this._sleep(600 * (attempt + 1));
                }
            }
            throw lastErr;
        }

        // ── Image processing ──────────────────────────────────────────────────

        _findSplitPoints(h) {
            if (h <= MAX_SEG_H) return [0, h];
            const pts = [0];
            for (let y = MAX_SEG_H; y < h; y += MAX_SEG_H) pts.push(y);
            pts.push(h);
            // Merge a tiny trailing segment into the previous one
            if (pts.length > 2 && pts[pts.length - 1] - pts[pts.length - 2] < MIN_SEG_H)
                pts.splice(pts.length - 2, 1);
            return pts;
        }

        async _processImage(blob, pageNum, srcEl) {
            // Fast path: if the source element has decoded dimensions, no split is needed,
            // AND the blob is already JPEG or PNG — reuse it zero-copy.
            // WebP is excluded from the fast path so it gets re-encoded to JPEG below.
            const ew = srcEl?.naturalWidth, eh = srcEl?.naturalHeight;
            if (ew > 0 && eh > 0 && eh <= MAX_SEG_H && blob.type !== 'image/webp') {
                const ext      = blob.type === 'image/png' ? 'png' : 'jpg';
                const filename = `page_${String(pageNum).padStart(3, '0')}.${ext}`;
                return [{ filename, blob, previewUrl: URL.createObjectURL(blob), w: ew, h: eh }];
            }

            // Decode via ObjectURL — avoids base64 round-trip (33% less memory)
            const objUrl = URL.createObjectURL(blob);
            let img;
            try {
                img = await new Promise((res, rej) => {
                    const el  = new Image();
                    el.onload  = () => res(el);
                    el.onerror = () => rej(new Error('Decode failed'));
                    el.src = objUrl;
                });
            } finally {
                URL.revokeObjectURL(objUrl);
            }

            const { naturalWidth: w, naturalHeight: h } = img;
            const pts    = this._findSplitPoints(h);
            // PNG stays lossless. Everything else (WebP, JPEG needing a split, unknown)
            // goes through canvas → JPEG. We never output WebP.
            const srcExt = (pts.length === 2 && blob.type === 'image/png') ? 'png' : 'jpg';
            const results = [];

            for (let i = 0; i < pts.length - 1; i++) {
                const y0   = pts[i];
                const segH = pts[i + 1] - y0;
                const suffix   = pts.length === 2 ? '' : `_part${i + 1}`;
                const filename = `page_${String(pageNum).padStart(3, '0')}${suffix}.${srcExt}`;

                // No split + already JPEG/PNG → reuse original blob (zero-copy, no re-encode)
                // No split + WebP → canvas re-encode to JPEG
                // Split (any format) → canvas re-encode to JPEG
                const segBlob = (pts.length === 2 && blob.type !== 'image/webp')
                    ? blob
                    : await new Promise(r => {
                        const cv = document.createElement('canvas');
                        cv.width = w; cv.height = segH;
                        cv.getContext('2d').drawImage(img, 0, y0, w, segH, 0, 0, w, segH);
                        cv.toBlob(r, 'image/jpeg', 0.92);
                    });

                results.push({
                    filename,
                    blob:       segBlob,
                    previewUrl: URL.createObjectURL(segBlob),
                    w,
                    h: segH,
                });
            }
            return results;
        }

        // ── Add results to sidebar ────────────────────────────────────────────

        _addSegmentsToUI(segs) {
            segs.forEach(seg => this.segments.push(seg));
        }

        // Called once after all downloads finish — sorts segments by filename and
        // renders the final, correctly-ordered sidebar list.  Because downloads
        // complete out of order (concurrent fetches), live-appending produces a
        // scrambled UI; deferring the render to here fixes that.
        _renderResults() {
            this.segments.sort((a, b) => a.filename.localeCompare(b.filename));
            const list = document.getElementById('mpd-results');
            list.innerHTML = '';
            this.segments.forEach((seg, idx) => {
                const div = document.createElement('div');
                div.className = 'mpd-thumb';
                div.innerHTML = `
                    <img src="${seg.previewUrl}">
                    <div class="mpd-thumb-info">
                        <div class="mpd-thumb-name">${seg.filename}</div>
                        <div class="mpd-thumb-size">${seg.w}×${seg.h}px</div>
                    </div>
                    <input type="checkbox" checked data-idx="${idx}">
                `;
                list.appendChild(div);
            });
        }

        // ── Navigation (manga mode) ───────────────────────────────────────────

        // Derive next URL from common page-number patterns — faster than clicking
        _guessNextUrl(url) {
            try {
                const u = new URL(url);
                if (u.searchParams.has('page')) {
                    const n = parseInt(u.searchParams.get('page'), 10);
                    if (!isNaN(n)) {
                        const next = new URL(url);
                        next.searchParams.set('page', n + 1);
                        return next.href;
                    }
                }
                // Path ending in /N or /N/
                const m = u.pathname.match(/^(.*\/)(\d+)(\/?)$/);
                if (m) {
                    const n = parseInt(m[2], 10);
                    if (!isNaN(n) && n > 0 && n < 10000)
                        return u.origin + m[1] + (n + 1) + m[3] + u.search;
                }
            } catch {}
            return null;
        }

        _clickNextPage() {
            const selectors = [
                'a[rel="next"]',
                '[class*="next"]:not([disabled])',
                '[aria-label*="next" i]', '[title*="next" i]',
                '[aria-label*="weiter" i]', '[title*="weiter" i]',
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) { el.click(); return true; }
            }
            for (const el of document.querySelectorAll('a, button')) {
                const t = el.textContent.trim().toLowerCase();
                if (['next', 'weiter', '>', '›', '→'].includes(t)) { el.click(); return true; }
            }
            return false;
        }

        _navigateNext() {
            // Always click the button so SPA routers can intercept via pushState.
            // Using location.href directly forces a full page reload, destroying the
            // script's in-memory scan state and closing the sidebar.
            // If no button is found, fall back to URL-based navigation as last resort.
            if (this._clickNextPage()) return;
            const nextUrl = this._guessNextUrl(location.href);
            if (nextUrl) location.href = nextUrl;
        }

        _waitForUrlChange(prevUrl, timeout) {
            return new Promise(resolve => {
                const start = Date.now();
                const id    = setInterval(() => {
                    if (location.href !== prevUrl) { clearInterval(id); resolve(true);  return; }
                    if (Date.now() - start > timeout) { clearInterval(id); resolve(false); }
                }, 80);
            });
        }

        // ── Phase 1: collect URLs from current page ───────────────────────────

        async _collectPageUrls() {
            if (!this.mangaMode) {
                await this._scrollLoad();
            } else {
                // Single panel per page — poll until images appear or timeout
                const deadline = Date.now() + MANGA_MAX_WAIT_MS;
                while (Date.now() < deadline) {
                    const images = this._findImages();
                    if (images.length > 0) break;  // Images found, proceed
                    await this._sleep(MANGA_POLL_MS);
                }
            }

            const candidates = this._findImages();

            // Sort top → bottom — precompute rects once to avoid O(n log n) reflows
            // (getBoundingClientRect inside a sort comparator would force a layout
            // recalculation on every comparison)
            const withY = candidates.map(c => ({
                c, y: (c.el.getBoundingClientRect?.()?.top ?? 0) + window.scrollY,
            }));
            withY.sort((a, b) => a.y - b.y);
            const sorted = withY.map(({ c }) => c);

            // Deduplicate against everything seen so far (raw URLs only).
            // We intentionally do NOT store normalized URLs in scannedUrls: sites that
            // encode the image identity in query params (e.g. reader.php?image_id=2)
            // would have all pages collapse to the same normalized path and get skipped.
            const fresh = [];
            for (const c of sorted) {
                if (this.scannedUrls.has(c.src)) continue;
                const srcs = this._allSrcsOf(c.el);
                let seen = false;
                for (const v of srcs) if (this.scannedUrls.has(v)) { seen = true; break; }
                if (seen) continue;
                // Fresh — register raw URLs immediately so the next page won't re-collect them
                this.scannedUrls.add(c.src);
                for (const v of srcs) this.scannedUrls.add(v);
                fresh.push(c);
            }

            return fresh;
        }

        // ── Abort ─────────────────────────────────────────────────────────────

        _abort() {
            this.aborted = true;
            this._status('Wird abgebrochen...');
        }

        // ── Main scan ─────────────────────────────────────────────────────────
        //
        // PIPELINE architecture:
        //   Producer — navigates pages one by one, pushes {src,el,num} into queue
        //   Consumer — drains queue with CONCURRENT_DL parallel fetches+processes
        //
        // Both run via Promise.all, so downloads start as soon as the first page
        // is collected instead of waiting for all pages to be visited first.

        async _scan() {
            if (this.scanning) return;

            this.scanning = true;
            this.aborted  = false;

            // Clean up from any previous run
            // Cancel any pending revoke timer from a previous download — without this,
            // the 30-second timer set by _download() can fire mid-scan and wipe the
            // new scan's thumbnails.
            clearTimeout(this.previewRevokeTimer);
            this.previewRevokeTimer = null;
            this._revokeAllPreviews();
            this.segments = [];
            this.errors   = [];
            this.scannedUrls.clear();
            document.querySelectorAll('[data-mpd-processed]')
                .forEach(el => el.removeAttribute('data-mpd-processed'));
            document.getElementById('mpd-results').innerHTML    = '';
            document.getElementById('mpd-footer').textContent   = '';
            document.getElementById('mpd-dl').disabled          = true;
            this._setScanBtn(true);
            this._progress(0);
            this._status('Startet...');

            // ── Pipeline shared state ─────────────────────────────────────────
            const queue       = [];   // candidates waiting to be downloaded
            let producerDone  = false;
            let totalExpected = 0;    // grows as producer collects more pages
            let dlDone        = 0;

            // ── Producer ─────────────────────────────────────────────────────
            const producer = async () => {
                let seqNum = 0;
                try {
                    if (this.mangaMode) {
                        let page = 1;
                        while (page <= MAX_PAGES && !this.aborted) {
                            this._status(`Seite ${page}: scanne... (${totalExpected} bisher)`);
                            const prevUrl = location.href;
                            const found   = await this._collectPageUrls();

                            found.forEach(c => { c.num = ++seqNum; });
                            queue.push(...found);
                            totalExpected += found.length;

                            this._status(`Seite ${page} ✓ — ${totalExpected} Panel(s) gefunden`);

                            // If no images found on this page, assume end of manga and stop
                            if (found.length === 0) {
                                this._status(`Seite ${page}: keine Panels. Abgeschlossen.`);
                                break;
                            }

                            this._navigateNext();
                            await this._sleep(NAV_CLICK_WAIT_MS);
                            const changed = await this._waitForUrlChange(prevUrl, NAV_TIMEOUT_MS);
                            if (!changed) break;
                            await this._sleep(NAV_LOAD_WAIT_MS);
                            page++;
                        }
                    } else {
                        this._status('Scrolle und suche Panels...');
                        const found = await this._collectPageUrls();
                        found.forEach(c => { c.num = ++seqNum; });
                        queue.push(...found);
                        totalExpected = found.length;
                        this._status(`${totalExpected} Panels gefunden. Lade herunter...`);
                    }
                } finally {
                    producerDone = true;
                }
            };

            // ── Consumer ─────────────────────────────────────────────────────
            const consumer = async () => {
                const running  = new Set();
                const allTasks = [];   // kept for final Promise.allSettled

                const spawn = candidate => {
                    // Note: `task` self-reference works because JS closures capture
                    // the variable binding, not the value at assignment time.
                    let task;
                    task = (async () => {
                        try {
                            if (this.aborted) return;
                            const blob = await this._fetchWithRetry(candidate.src, candidate.el);
                            if (this.aborted) return;
                            const segs = await this._processImage(blob, candidate.num, candidate.el);
                            this._addSegmentsToUI(segs);
                            if (candidate.el) candidate.el.dataset.mpdProcessed = 'true';
                        } catch(e) {
                            this.errors.push({ src: candidate.src, message: e.message });
                            console.warn('[MPD] Failed:', candidate.src?.slice(0, 80), e.message);
                        } finally {
                            dlDone++;
                            running.delete(task);
                            const pct    = totalExpected > 0 ? (dlDone / totalExpected) * 100 : 0;
                            const errStr = this.errors.length ? ` (${this.errors.length} Fehler)` : '';
                            this._progress(pct);
                            this._status(`Lade: ${dlDone}/${totalExpected}${errStr}`);
                        }
                    })();
                    running.add(task);
                    allTasks.push(task);
                };

                while (!this.aborted) {
                    // Fill up to concurrency cap from queue
                    while (queue.length > 0 && running.size < CONCURRENT_DL)
                        spawn(queue.shift());

                    if (producerDone && queue.length === 0 && running.size === 0) break;

                    await this._sleep(40);
                }

                // Wait for any still-running tasks to finish
                if (allTasks.length) await Promise.allSettled(allTasks);
            };

            // ── Run phases ────────────────────────────────────────────────────
            // Manga mode: scan all pages first, then download — so navigation is
            // not interrupted by concurrent network activity.
            // Normal mode: pipeline (producer + consumer concurrently).
            try {
                if (this.mangaMode) {
                    await producer();
                    this._status(`${totalExpected} Panels gefunden. Lade herunter...`);
                    await consumer();
                } else {
                    await Promise.all([producer(), consumer()]);
                }

                this._renderResults();
                this._progress(0);
                const errStr = this.errors.length ? ` | ${this.errors.length} Fehler` : '';
                document.getElementById('mpd-footer').textContent =
                    `${this.segments.length} Segmente${errStr}`;

                this._status(
                    this.aborted
                        ? `Abgebrochen. ${this.segments.length} Dateien geladen.`
                        : `Fertig. ${this.segments.length} Dateien bereit.`
                );

                if (this.segments.length > 0)
                    document.getElementById('mpd-dl').disabled = false;

            } catch(e) {
                this._status(`Fehler: ${e?.message || e}`);
                console.error('[MPD]', e);
            } finally {
                this.scanning = false;
                this._setScanBtn(false);
            }
        }

        // ── Manual STORE-ZIP builder (JSZip fallback) ─────────────────────────
        // Constructs a valid ZIP (STORE/no-compression) from Uint8Arrays without
        // any external library. Uses only FileReader — never blob.arrayBuffer() —
        // because GM_xmlhttpRequest blobs can silently hang on .arrayBuffer() in
        // some Tampermonkey/browser combos.

        async _buildStoreZip(files) {
            const enc     = new TextEncoder();
            const readBuf = blob => new Promise((res, rej) => {
                const fr = new FileReader();
                fr.onload  = () => res(new Uint8Array(fr.result));
                fr.onerror = () => rej(fr.error ?? new Error('FileReader error'));
                fr.readAsArrayBuffer(blob);
            });

            // Pre-built CRC-32 table
            const crcTable = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                crcTable[i] = c;
            }
            const crc32 = buf => {
                let c = 0xFFFFFFFF;
                for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
                return (c ^ 0xFFFFFFFF) >>> 0;
            };

            const w16 = (v, a, o) => { a[o] = v & 0xFF; a[o+1] = (v >>> 8) & 0xFF; };
            const w32 = (v, a, o) => { w16(v, a, o); w16(v >>> 16, a, o + 2); };

            const localParts = [];
            const centralDir = [];
            let   offset     = 0;

            for (const { filename, blob } of files) {
                const name = enc.encode(filename);
                const data = await readBuf(blob);
                const crc  = crc32(data);
                const size = data.length;

                const lfh = new Uint8Array(30 + name.length);
                w32(0x04034b50, lfh,  0);   // local file header signature
                w16(20,         lfh,  4);   // version needed
                w16(0,          lfh,  6);   // general purpose bit flag
                w16(0,          lfh,  8);   // compression: STORE
                w16(0,          lfh, 10);   // last mod time
                w16(0,          lfh, 12);   // last mod date
                w32(crc,        lfh, 14);
                w32(size,       lfh, 18);   // compressed size
                w32(size,       lfh, 22);   // uncompressed size
                w16(name.length,lfh, 26);
                w16(0,          lfh, 28);   // extra field length
                lfh.set(name, 30);

                const cde = new Uint8Array(46 + name.length);
                w32(0x02014b50, cde,  0);   // central directory signature
                w16(20,         cde,  4);   // version made by
                w16(20,         cde,  6);   // version needed
                w16(0,          cde,  8);
                w16(0,          cde, 10);   // STORE
                w16(0,          cde, 12);
                w16(0,          cde, 14);
                w32(crc,        cde, 16);
                w32(size,       cde, 20);
                w32(size,       cde, 24);
                w16(name.length,cde, 28);
                w16(0,          cde, 30);   // extra
                w16(0,          cde, 32);   // comment
                w16(0,          cde, 34);   // disk start
                w16(0,          cde, 36);   // internal attrs
                w32(0,          cde, 38);   // external attrs
                w32(offset,     cde, 42);   // local header offset
                cde.set(name, 46);

                localParts.push(lfh, data);
                centralDir.push(cde);
                offset += 30 + name.length + size;
            }

            const cdSize = centralDir.reduce((s, b) => s + b.length, 0);
            const eocd   = new Uint8Array(22);
            w32(0x06054b50,   eocd,  0);   // end of central directory signature
            w16(0,            eocd,  4);
            w16(0,            eocd,  6);
            w16(files.length, eocd,  8);
            w16(files.length, eocd, 10);
            w32(cdSize,       eocd, 12);
            w32(offset,       eocd, 16);
            w16(0,            eocd, 20);

            return new Blob([...localParts, ...centralDir, eocd], { type: 'application/zip' });
        }

        // ── Download ZIP ──────────────────────────────────────────────────────

        async _download() {
            // Only include segments that still have their blob data
            const checked = Array.from(
                document.querySelectorAll('#mpd-results input[type=checkbox]:checked')
            ).map(cb => this.segments[+cb.dataset.idx]).filter(seg => seg?.blob);

            if (!checked.length) { this._status('Nichts ausgewählt.'); return; }

            document.getElementById('mpd-dl').disabled = true;

            const date    = new Date().toISOString().slice(0, 10);
            const chapter = location.pathname.replace(/\//g, '_').slice(1, 40) || 'chapter';
            const name    = `${host}_${chapter}_${date}.zip`;

            // Shared finish: trigger browser download, null blobs, schedule preview revoke
            const finish = zipBlob => {
                const a = document.createElement('a');
                a.href     = URL.createObjectURL(zipBlob);
                a.download = name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(a.href), 10000);
                this.segments.forEach(seg => { seg.blob = null; });
                document.getElementById('mpd-dl').disabled = true;
                clearTimeout(this.previewRevokeTimer);
                this.previewRevokeTimer = setTimeout(() => this._revokeAllPreviews(), 30000);
                this._status(`Heruntergeladen: ${name}`);
            };

            // ── Attempt 1: manual STORE ZIP ──────────────────────────────────
            try {
                this._status(`Baue ZIP (${checked.length} Dateien)...`);
                const zipBlob = await this._buildStoreZip(checked);
                return finish(zipBlob);
            } catch(e) {
                console.warn('[MPD] Manual ZIP failed, downloading individually:', e.message);
            }

            // ── Attempt 3: individual file downloads ─────────────────────────
            try {
                for (let i = 0; i < checked.length; i++) {
                    const seg = checked[i];
                    this._status(`Lade ${i + 1}/${checked.length}: ${seg.filename}`);
                    const a = document.createElement('a');
                    a.href     = seg.previewUrl;   // object URL — always valid at this point
                    a.download = seg.filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    await this._sleep(300);
                }
                this.segments.forEach(seg => { seg.blob = null; });
                document.getElementById('mpd-dl').disabled = true;
                clearTimeout(this.previewRevokeTimer);
                this.previewRevokeTimer = setTimeout(() => this._revokeAllPreviews(), 30000);
                this._status(`${checked.length} Dateien einzeln heruntergeladen.`);
            } catch(e) {
                this._status(`Fehler: ${e.message}`);
                console.error('[MPD] Download:', e);
                document.getElementById('mpd-dl').disabled = false;
            }
        }

        // ── Utilities ─────────────────────────────────────────────────────────

        _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    }

})();
```

---

## Marketplace Deal Finder — v29.2

- **Datei:** `Marketplace Deal Finder.user.js`
- **Matches:** https://www.willhaben.at/iad/kaufen-und-verkaufen/*, https://www.kleinanzeigen.de/s-*, https://www.kleinanzeigen.de/z-*
- **Grants:** GM_xmlhttpRequest, GM_setValue, GM_getValue
- **Beschreibung:** Automatic AI-powered deal finder for Willhaben & Kleinanzeigen with live ranking and pause function. Multi-page crawling with Gemini AI analysis.

```javascript
// ==UserScript==
// @name         Marketplace Deal Finder
// @namespace    http://tampermonkey.net/
// @version      29.2
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

```

---

## NotebookLM Source Export — v5.3

- **Datei:** `NotebookLM Source Export.user.js`
- **Matches:** https://notebooklm.google.com/*
- **Grants:** GM_addStyle, GM_registerMenuCommand, GM_unregisterMenuCommand
- **Beschreibung:** Automated extraction of source files from NotebookLM with a status interface.

```javascript
// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    http://tampermonkey.net/
// @version      5.3
// @description  Automated extraction of source files from NotebookLM with a status interface.
// @author       marmoris
// @match        https://notebooklm.google.com/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // ⚙️ SYSTEM CONFIGURATION
    // ============================================================
    const CONFIG = {
        selectors: {
            list: '.single-source-container',
            title: '.source-title',
            closeBtn: 'button[mattooltip="Quellenansicht schließen"]',
            content: 'labs-tailwind-structural-element-view-v2',
            notebookTitle: '.title-label-inner.mat-title-large'
        },
        ui: {
            id: 'nlm-export-ui',
            width: '450px'
        },
        audio: {
            enabled: true,
            vol: 0.15
        }
    };

    // ============================================================
    // ⏱️ TIMING CONSTANTS (Tunable parameters)
    // ============================================================
    const TIMING = {
        CONTENT_POLL_ATTEMPTS: 15,          // Max attempts to find loaded content
        CONTENT_POLL_INTERVAL_MS: 200,      // Delay between polls in milliseconds
        CONTENT_RENDER_DELAY_MS: 1200,      // Wait for DOM rendering after click (don't reduce — risks empty exports)
        CONTENT_GONE_ATTEMPTS: 15,          // Max attempts to confirm content closed
        MIN_CONTENT_LENGTH_CHARS: 20,       // Minimum valid content size
        SOURCE_CLOSE_WAIT_MS: 1500,         // (reserved — currently using CONTENT_POLL_INTERVAL_MS for close wait)
        KEEP_ALIVE_VOLUME: 0.001,           // Silent audio for keep-alive
        LOG_MAX_ENTRIES: 50,                // Maximum terminal log entries
        AUDIO_NOTE_DELAYS_MS: [0, 100, 200] // Completion chord timing
    };

    // ============================================================
    // 📋 LOG LEVELS (Type-safe constants)
    // ============================================================
    const LOG_LEVEL = {
        INFO: 'info',
        SUCCESS: 'success',
        WARN: 'warn',
        ERROR: 'error'
    };

    // ============================================================
    // 📊 APP STATE
    // ============================================================
    const STATE = {
        isCancelled: false,
        keepAliveAudio: null,
        menuStartId: null,
        menuStopId: null
    };

    // ============================================================
    // 🎨 CSS (High-End Interface)
    // ============================================================
    const STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');

        #${CONFIG.ui.id} {
            position: fixed;
            top: 20px;
            right: 20px;
            width: ${CONFIG.ui.width};
            background: rgba(15, 15, 20, 0.9);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-left: 4px solid #3b82f6; /* Serious Blue */
            border-radius: 8px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 15px rgba(59, 130, 246, 0.1);
            color: #e2e8f0;
            font-family: 'Inter', sans-serif;
            z-index: 99999999;
            overflow: hidden;
            transition: opacity 0.3s ease;
            animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #${CONFIG.ui.id}.minimized {
            height: 48px;
            width: 220px;
            border-left: 4px solid #64748b;
        }

        /* Header */
        .nlm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            cursor: move;
            user-select: none;
        }

        .nlm-title {
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #60a5fa;
        }

        .nlm-controls {
            display: flex;
            gap: 12px;
        }

        .nlm-btn-icon {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.4);
            cursor: pointer;
            font-size: 14px;
            transition: color 0.2s;
        }
        .nlm-btn-icon:hover { color: #fff; }

        /* Body */
        .nlm-body {
            padding: 20px;
        }

        /* Status Bar */
        .nlm-status-box {
            margin-bottom: 15px;
        }
        .nlm-progress-container {
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }
        .nlm-progress-bar {
            height: 100%;
            width: 0%;
            background: #3b82f6;
            transition: width 0.3s ease;
        }
        .nlm-status-text {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            font-family: 'JetBrains Mono', monospace;
        }

        /* Terminal Log */
        .nlm-terminal {
            height: 140px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 4px;
            padding: 10px;
            overflow-y: auto;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            color: #94a3b8;
            margin-bottom: 20px;
        }
        .nlm-log-entry { margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nlm-log-info { color: #94a3b8; }
        .nlm-log-success { color: #4ade80; }
        .nlm-log-warn { color: #fbbf24; }
        .nlm-log-error { color: #f87171; }

        /* Action Button */
        .nlm-action-btn {
            width: 100%;
            padding: 10px;
            background: #3b82f6;
            border: 1px solid #2563eb;
            color: #fff;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s;
            border-radius: 4px;
        }
        .nlm-action-btn:hover {
            background: #2563eb;
            box-shadow: 0 0 15px rgba(37, 99, 235, 0.4);
        }
        .nlm-action-btn:disabled {
            background: #1e293b;
            border-color: #334155;
            color: #475569;
            cursor: not-allowed;
            box-shadow: none;
        }
        .nlm-stop-btn {
            width: 100%;
            padding: 10px;
            background: transparent;
            border: 1px solid #ef4444;
            color: #ef4444;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            border-radius: 4px;
            margin-top: 8px;
            display: none;
        }
        .nlm-stop-btn:hover { background: rgba(239, 68, 68, 0.1); }

        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .nlm-terminal::-webkit-scrollbar { width: 4px; }
        .nlm-terminal::-webkit-scrollbar-track { background: transparent; }
        .nlm-terminal::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    `;

    // ============================================================
    // 🔊 AUDIO ENGINE (Minimalist)
    // ============================================================
    const SoundFX = {
        _ctx: null,
        get ctx() {
            if (!this._ctx && CONFIG.audio.enabled) {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            return this._ctx;
        },
        playTone: function(freq, type, duration, vol = CONFIG.audio.vol) {
            if(!CONFIG.audio.enabled) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        },
        playStart: function() {
            this.playTone(600, 'sine', 0.15);
        },
        playError: function() {
            this.playTone(150, 'sawtooth', 0.3);
        },
        playComplete: function() {
            // Completion chord: A major (440Hz=A, 554Hz≈C#, 659Hz=E)
            const notes = [
                { freq: 440, duration: 0.6, delay: TIMING.AUDIO_NOTE_DELAYS_MS[0] },
                { freq: 554, duration: 0.6, delay: TIMING.AUDIO_NOTE_DELAYS_MS[1] },
                { freq: 659, duration: 0.8, delay: TIMING.AUDIO_NOTE_DELAYS_MS[2] }
            ];
            notes.forEach(n => setTimeout(() => this.playTone(n.freq, 'sine', n.duration), n.delay));
        }
    };

    // ============================================================
    // 🖥️ UI ENGINE
    // ============================================================
    function init() {
        // Prevent double-init (user clicked menu command while UI is already open)
        if (document.getElementById(CONFIG.ui.id)) return;

        const hud = document.createElement('div');
        hud.id = CONFIG.ui.id;
        hud.innerHTML = `
            <div class="nlm-header" id="nlm-drag-handle">
                <div class="nlm-title">NotebookLM Export</div>
                <div class="nlm-controls">
                    <button class="nlm-btn-icon" id="nlm-min-btn">_</button>
                    <button class="nlm-btn-icon" id="nlm-close-btn">✕</button>
                </div>
            </div>
            <div class="nlm-body" id="nlm-body-content">
                <div class="nlm-status-box">
                    <div class="nlm-status-text">
                        <span id="nlm-status-label">Ready</span>
                        <span id="nlm-percent">0%</span>
                    </div>
                    <div class="nlm-progress-container">
                        <div class="nlm-progress-bar" id="nlm-progress"></div>
                    </div>
                </div>
                <div class="nlm-terminal" id="nlm-terminal">
                    <div class="nlm-log-entry nlm-log-${LOG_LEVEL.INFO}">> Interface loaded.</div>
                    <div class="nlm-log-entry nlm-log-${LOG_LEVEL.INFO}">> Waiting for user command...</div>
                </div>
                <button class="nlm-action-btn" id="nlm-start-btn">Start Extraction</button>
                <button class="nlm-stop-btn" id="nlm-stop-btn">Stop</button>
            </div>
        `;
        document.body.appendChild(hud);

        document.getElementById('nlm-close-btn').onclick = () => hud.remove();
        document.getElementById('nlm-min-btn').onclick = () => {
            hud.classList.toggle('minimized');
            const body = document.getElementById('nlm-body-content');
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        };
        document.getElementById('nlm-start-btn').onclick = runProcess;
        document.getElementById('nlm-stop-btn').onclick = () => {
            STATE.isCancelled = true;
            log("Stop requested by user.", LOG_LEVEL.WARN);
        };

        // Drag logic — pointer capture ensures mouseup is never lost if cursor leaves window
        const header = document.getElementById('nlm-drag-handle');
        let initialX, initialY, xOffset = 0, yOffset = 0, dragInitialized = false;

        const onPointerMove = (e) => {
            const rawX = e.clientX - initialX;
            const rawY = e.clientY - initialY;
            xOffset = Math.max(0, Math.min(rawX, window.innerWidth - hud.offsetWidth));
            yOffset = Math.max(0, Math.min(rawY, window.innerHeight - hud.offsetHeight));
            hud.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
        };
        const onPointerUp = (e) => {
            header.releasePointerCapture(e.pointerId);
            header.removeEventListener('pointermove', onPointerMove);
            header.removeEventListener('pointerup', onPointerUp);
        };
        header.addEventListener('pointerdown', (e) => {
            if (e.target === header || e.target.parentNode === header) {
                if (!dragInitialized) {
                    // Sync xOffset/yOffset with actual rendered position (CSS right: 20px → left-based coords)
                    const rect = hud.getBoundingClientRect();
                    xOffset = rect.left;
                    yOffset = rect.top;
                    hud.style.right = 'auto';
                    hud.style.top = '0';
                    hud.style.left = '0';
                    hud.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
                    dragInitialized = true;
                }
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                header.setPointerCapture(e.pointerId);
                header.addEventListener('pointermove', onPointerMove);
                header.addEventListener('pointerup', onPointerUp);
            }
        });

    }

    // ============================================================
    // 📋 MENU COMMANDS
    // ============================================================
    function registerMenuStart() {
        STATE.menuStartId = GM_registerMenuCommand('▶ Start Export', () => init());
    }
    function registerMenuStop() {
        STATE.menuStopId = GM_registerMenuCommand('⏹ Stop Export', () => {
            STATE.isCancelled = true;
            log("Stop requested via menu.", LOG_LEVEL.WARN);
        });
    }

    // ============================================================
    // 🧠 LOGIC ENGINE
    // ============================================================
    function log(msg, type = 'info') {
        const term = document.getElementById('nlm-terminal');
        if (!term) return;
        const entry = document.createElement('div');
        entry.className = `nlm-log-entry nlm-log-${type}`;
        const time = new Date().toLocaleTimeString(undefined, { hour12: false });
        entry.innerText = `[${time}] ${msg}`;
        term.appendChild(entry);

        // Limit terminal logs to prevent memory leak
        while (term.children.length > TIMING.LOG_MAX_ENTRIES) {
            term.removeChild(term.firstChild);
        }
        term.scrollTop = term.scrollHeight;
    }

    function updateProgress(current, total) {
        const percent = Math.round((current / total) * 100);
        document.getElementById('nlm-progress').style.width = `${percent}%`;
        document.getElementById('nlm-percent').innerText = `${percent}%`;
        document.getElementById('nlm-status-label').innerText = `Processing: ${current}/${total}`;
    }

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function startKeepAlive() {
        STATE.keepAliveAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA");
        STATE.keepAliveAudio.loop = true;
        STATE.keepAliveAudio.volume = TIMING.KEEP_ALIVE_VOLUME;
        STATE.keepAliveAudio.play().catch(() => {
            log("Keep-alive audio blocked by browser. Tab may throttle if left in background.", LOG_LEVEL.WARN);
        });
    }
    function stopKeepAlive() {
        if (STATE.keepAliveAudio) {
            STATE.keepAliveAudio.pause();
            STATE.keepAliveAudio = null;
        }
    }

    function cleanupRun(startBtn) {
        stopKeepAlive();
        const stopBtn = document.getElementById('nlm-stop-btn');
        if (stopBtn) stopBtn.style.display = 'none';
        GM_unregisterMenuCommand(STATE.menuStopId);
        registerMenuStart();
        startBtn.disabled = false;
    }

    async function runProcess() {
        const startBtn = document.getElementById('nlm-start-btn');
        STATE.isCancelled = false;
        updateProgress(0, 1); // Reset progress bar on each run
        startBtn.disabled = true;
        startBtn.innerText = "Running...";
        document.getElementById('nlm-stop-btn').style.display = 'block';

        // Swap Tampermonkey popup button: Start → Stop
        GM_unregisterMenuCommand(STATE.menuStartId);
        registerMenuStop();

        startKeepAlive();
        SoundFX.playStart(); // Safe here — user clicked "Start Extraction" (real user gesture)

        const totalSources = document.querySelectorAll(CONFIG.selectors.list).length;

        if (totalSources === 0) {
            log("Error: No sources found.", LOG_LEVEL.ERROR);
            SoundFX.playError();
            cleanupRun(startBtn);
            startBtn.innerText = "Retry";
            return;
        }

        log(`Scan complete. Found ${totalSources} items.`, LOG_LEVEL.SUCCESS);
        log("Keep this tab active — background tabs may throttle timers.", LOG_LEVEL.WARN);

        const collectedFiles = []; // { name, text }
        let crashed = false;

        try { for (let i = 0; i < totalSources; i++) {
            if (STATE.isCancelled) break;
            updateProgress(i + 1, totalSources);

            // Re-query each iteration — Angular may re-render the list after open/close,
            // making the initial `sources` NodeList contain detached (stale) nodes.
            const source = document.querySelectorAll(CONFIG.selectors.list)[i];

            if (!source) {
                log(`Source index ${i+1} not found. Skipping.`, LOG_LEVEL.ERROR);
                continue;
            }

            const titleEl = source.querySelector(CONFIG.selectors.title);
            let fileName = (titleEl?.textContent?.trim() || `Source_${i+1}`)
                .replace(/[\\/:*?"<>|]/g, '_') // Strip OS-illegal filename characters
                .substring(0, 120)             // Cap length for OS path limits
                .trim();
            if (!fileName.endsWith('.md')) fileName += '.md';

            log(`Opening: ${fileName}`, LOG_LEVEL.INFO);
            document.getElementById('nlm-status-label').innerText = `${i + 1}/${totalSources}: ${fileName}`;

            source.scrollIntoView({ block: 'center' });
            await wait(100); // Brief pause for SPA to settle after scroll
            (titleEl || source).click();

            // Wait logic
            let found = false;
            for(let attempt = 0; attempt < TIMING.CONTENT_POLL_ATTEMPTS; attempt++) {
                await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
                if(document.querySelector(CONFIG.selectors.content)) {
                    found = true;
                    break;
                }
            }

            if(found) {
                await wait(TIMING.CONTENT_RENDER_DELAY_MS); // Wait for rendering
                const allContent = document.querySelectorAll(CONFIG.selectors.content);
                // Filter out nested elements (e.g. inside table cells) — only process top-level blocks
                const lines = Array.from(allContent).filter(
                    el => !el.parentElement.closest(CONFIG.selectors.content)
                );
                const textLines = lines.map(l => htmlToMarkdown(l));
                const text = textLines.join("\n\n");

                if(text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
                    collectedFiles.push({ name: fileName, text });
                    log(`>> Queued: ${fileName} (${text.length} chars)`, LOG_LEVEL.SUCCESS);
                } else {
                    log(">> Warning: Content empty", LOG_LEVEL.WARN);
                }
            } else {
                log(">> Timeout: Content load failed", LOG_LEVEL.ERROR);
            }

            attemptClose();
            // Wait for content to fully leave the DOM before next iteration (prevents stale reads)
            for (let attempt = 0; attempt < TIMING.CONTENT_GONE_ATTEMPTS; attempt++) {
                await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
                if (!document.querySelector(CONFIG.selectors.content)) break;
            }
        } } catch (e) {
            log(`Unexpected error: ${e.message}`, LOG_LEVEL.ERROR);
            startBtn.innerText = "Retry";
            crashed = true;
        } finally {
            cleanupRun(startBtn);
        }

        if (crashed) return;

        if (STATE.isCancelled) {
            log("Extraction stopped by user.", LOG_LEVEL.WARN);
            document.getElementById('nlm-status-label').innerText = "Stopped";
            startBtn.innerText = "Start Extraction";
        } else {
            updateProgress(totalSources, totalSources);

            if (collectedFiles.length > 0) {
                log(`Building ZIP with ${collectedFiles.length} file(s)...`, LOG_LEVEL.INFO);
                const notebookTitle = document.querySelector(CONFIG.selectors.notebookTitle)?.textContent?.trim() || 'NotebookLM';
                const zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + '.zip';
                let zipBlob;
                try {
                    zipBlob = buildZip(collectedFiles);
                } catch (e) {
                    log(`ZIP build failed: ${e.message}`, LOG_LEVEL.ERROR);
                    startBtn.innerText = "Retry";
                    return;
                }
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = zipName;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
                log("ZIP downloaded.", LOG_LEVEL.SUCCESS);
            } else {
                log("No files to export.", LOG_LEVEL.WARN);
            }

            log("Process successfully completed.", LOG_LEVEL.SUCCESS);
            document.getElementById('nlm-status-label').innerText = "Complete";
            startBtn.innerText = "Done";
            SoundFX.playComplete();
        }
    }

    function attemptClose() {
        // Primary: language-independent icon button (most reliable)
        for (const btn of document.querySelectorAll('button')) {
            if (btn.textContent.includes('collapse_content')) {
                btn.click();
                return;
            }
        }
        // Fallback 1: locale-specific tooltip (German UI)
        const localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
        if (localizedBtn) {
            localizedBtn.click();
            return;
        }
        // Fallback 2: Escape key
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    }

    // Converts a DOM element to Markdown, preserving links, headers, bold, lists, etc.
    function htmlToMarkdown(el) {
        function convert(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = node.tagName.toLowerCase();
            const inner = () => Array.from(node.childNodes).map(convert).join('');

            switch (tag) {
                case 'h1': return `# ${inner()}\n\n`;
                case 'h2': return `## ${inner()}\n\n`;
                case 'h3': return `### ${inner()}\n\n`;
                case 'h4': return `#### ${inner()}\n\n`;
                case 'h5': return `##### ${inner()}\n\n`;
                case 'h6': return `###### ${inner()}\n\n`;
                case 'p':  return `${inner()}\n\n`;
                case 'br': return '\n';
                case 'strong': case 'b': return `**${inner()}**`;
                case 'em':     case 'i': return `*${inner()}*`;
                case 'a': {
                    let href = node.getAttribute('href') || '';
                    if (href.includes('google.com/url')) {
                        try { href = new URL(href).searchParams.get('q') || href; } catch(_) {}
                    }
                    const text = inner();
                    return href ? `[${text}](${href})` : text;
                }
                case 'ul': return `${inner()}\n`;
                case 'ol': return `${inner()}\n`;
                case 'li': {
                    // Walk up ancestors since NotebookLM may nest li inside custom elements
                    let ancestor = node.parentElement;
                    while (ancestor && !['ul', 'ol'].includes(ancestor.tagName.toLowerCase())) {
                        ancestor = ancestor.parentElement;
                    }
                    if (ancestor?.tagName.toLowerCase() === 'ol') {
                        // Count li siblings in the ol at the same depth (handles custom element wrappers)
                        const allLis = Array.from(ancestor.querySelectorAll('li'));
                        const nodeIndex = allLis.indexOf(node);
                        // Count only li elements that share the same ol ancestor (not nested ols)
                        let index = 1;
                        for (let j = 0; j < nodeIndex; j++) {
                            let a = allLis[j].parentElement;
                            while (a && !['ul', 'ol'].includes(a.tagName.toLowerCase())) a = a.parentElement;
                            if (a === ancestor) index++;
                        }
                        return `${index}. ${inner().trim()}\n`;
                    }
                    return `- ${inner().trim()}\n`;
                }
                case 'div': {
                    const ariaLevel = node.getAttribute('aria-level');
                    if (ariaLevel) {
                        const hashes = '#'.repeat(Math.min(parseInt(ariaLevel), 6));
                        return `${hashes} ${inner().trim()}\n\n`;
                    }
                    if (/^-{10,}$/.test(node.textContent.trim())) return `---\n\n`;
                    return inner();
                }
                case 's': case 'del': case 'strike': return `~~${inner()}~~`;
                case 'u': return `__${inner()}__`;
                case 'code': {
                    if (node.parentElement?.tagName.toLowerCase() === 'pre') return inner();
                    return `\`${inner()}\``;
                }
                case 'pre': {
                    const codeEl = node.querySelector('code');
                    const langSource = codeEl || node;
                    const lang = langSource.getAttribute('data-language')
                        || langSource.className.match(/language-(\S+)/)?.[1]
                        || langSource.className.match(/lang-(\S+)/)?.[1]
                        || '';
                    return `\`\`\`${lang}\n${codeEl ? codeEl.innerText : inner()}\n\`\`\`\n\n`;
                }
                case 'blockquote': return inner().trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
                case 'hr': return `---\n\n`;
                case 'img': {
                    const src = node.getAttribute('src') || '';
                    const alt = node.getAttribute('alt') || '';
                    return `![${alt}](${src})`;
                }
                case 'table': {
                    const rows = Array.from(node.querySelectorAll('tr'));
                    if (!rows.length) return inner();
                    const toRow = cells => '| ' + cells.map(c => c.innerText.trim().replace(/\|/g, '\\|')).join(' | ') + ' |';
                    const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
                    const header = toRow(headerCells);
                    const separator = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
                    const body = rows.slice(1).map(r => toRow(Array.from(r.querySelectorAll('td')))).join('\n');
                    return [header, separator, body].filter(Boolean).join('\n') + '\n\n';
                }
                default: return inner();
            }
        }
        return convert(el).replace(/\n{3,}/g, '\n\n').trim();
    }

    // Minimal synchronous ZIP builder (STORE, no compression, no external library)
    function buildZip(files) {
        const enc = new TextEncoder();

        // CRC-32 lookup table
        const crcTable = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[i] = c;
        }
        function crc32(u8) {
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < u8.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ u8[i]) & 0xFF];
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
        function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
        function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }

        const localParts = [];
        const centralParts = [];
        const entries = [];
        let localOffset = 0;

        for (const { name, text } of files) {
            const nameBytes = enc.encode(name);
            const data = enc.encode(text);
            const crc = crc32(data);

            // Local file header (30 bytes)
            const local = new Uint8Array([
                0x50, 0x4B, 0x03, 0x04,  // signature
                20, 0,                    // version needed
                ...u16(0x0800),           // flags: Language Encoding Flag (UTF-8 filenames)
                0, 0,                     // compression: STORE
                0, 0, 0, 0,               // mod time + mod date
                ...u32(crc),
                ...u32(data.length),      // compressed size
                ...u32(data.length),      // uncompressed size
                ...u16(nameBytes.length),
                0, 0,                     // extra field length
            ]);

            entries.push({ offset: localOffset, nameBytes, crc, size: data.length });
            localParts.push(local, nameBytes, data);
            localOffset += local.length + nameBytes.length + data.length;
        }

        // Central directory
        let centralSize = 0;
        for (const { offset, nameBytes, crc, size } of entries) {
            const ch = new Uint8Array([
                0x50, 0x4B, 0x01, 0x02,  // signature
                20, 0,                    // version made by
                20, 0,                    // version needed
                ...u16(0x0800),           // flags: Language Encoding Flag (UTF-8 filenames)
                0, 0,                     // compression: STORE
                0, 0, 0, 0,               // mod time + mod date
                ...u32(crc),
                ...u32(size),             // compressed size
                ...u32(size),             // uncompressed size
                ...u16(nameBytes.length),
                0, 0,                     // extra length
                0, 0,                     // comment length
                0, 0,                     // disk number start
                0, 0,                     // internal file attributes
                0, 0, 0, 0,               // external file attributes
                ...u32(offset),           // local header offset
            ]);
            centralParts.push(ch, nameBytes);
            centralSize += ch.length + nameBytes.length;
        }

        // End of central directory record (22 bytes)
        const eocd = new Uint8Array([
            0x50, 0x4B, 0x05, 0x06,  // signature
            0, 0,                     // disk number
            0, 0,                     // disk with central dir
            ...u16(entries.length),   // entries on this disk
            ...u16(entries.length),   // total entries
            ...u32(centralSize),
            ...u32(localOffset),      // central dir offset
            0, 0,                     // comment length
        ]);

        return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
    }

    // Inject CSS via extension API — bypasses page CSP entirely
    GM_addStyle(STYLES);

    // Register Tampermonkey popup button
    registerMenuStart();

})();
```

---

## Picture-in-Picture any site — v5.5

- **Datei:** `Picture-in-Picture any site.user.js`
- **Matches:** *://*/*
- **Grants:** GM_registerMenuCommand
- **Beschreibung:** Adds an entry in the Tampermonkey menu to force the tab into PiP.

```javascript
// ==UserScript==
// @name         Picture-in-Picture any site
// @namespace    http://tampermonkey.net/
// @version      5.5
// @description  Adds an entry in the Tampermonkey menu to force the tab into PiP.
// @author       DeinName
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @icon         https://img.icons8.com/fluency/64/picture-in-picture.png
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Picture-in-Picture%20any%20site.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Picture-in-Picture%20any%20site.user.js
// ==/UserScript==

(function() {
    'use strict';

    let isActivating = false;

    async function togglePiP() {
        if (document.pictureInPictureElement) {
            try {
                await document.exitPictureInPicture();
            } catch (e) {
                console.error("PiP beenden fehlgeschlagen:", e);
            }
            return;
        }

        if (!document.pictureInPictureEnabled) {
            console.warn("PiP: auf dieser Seite deaktiviert.");
            return;
        }

        if (isActivating) return;
        isActivating = true;

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: false,
                selfBrowserSurface: "include",
                preferCurrentTab: true
            });

            const video = document.createElement("video");
            video.srcObject = stream;
            video.muted = true;
            video.autoplay = true;
            // opacity:0 statt display:none — bleibt im Render-Tree, verhindert Black-Screen in Chromium
            video.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;";
            document.body.appendChild(video);

            const cleanup = () => {
                stream.getTracks().forEach(track => track.stop());
                video.remove();
            };

            video.addEventListener("loadedmetadata", async () => {
                try {
                    await video.play();
                    await video.requestPictureInPicture();
                } catch (e) {
                    console.error("PiP Fehler:", e);
                    cleanup();
                } finally {
                    isActivating = false;
                }
            }, { once: true });

            video.addEventListener("leavepictureinpicture", cleanup, { once: true });
            stream.getVideoTracks()[0].addEventListener("ended", cleanup, { once: true });

        } catch (err) {
            console.log("PiP vom Benutzer abgebrochen.");
            isActivating = false;
        }
    }

    GM_registerMenuCommand("Picture-in-Picture", togglePiP);
})();

```

---

## Recaptcha Solver — v2.9

- **Datei:** `Recaptcha Solver.user.js`
- **Matches:** https://www.google.com/recaptcha/*, https://google.com/recaptcha/*, https://www.recaptcha.net/recaptcha/*, https://recaptcha.net/recaptcha/*
- **Grants:** GM_xmlhttpRequest
- **Beschreibung:** Recaptcha Solver in Browser | Start button in challenge footer

```javascript
// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.9
// @description  Recaptcha Solver in Browser | Start button in challenge footer
// @author       marmoris-x
// @match        https://www.google.com/recaptcha/*
// @match        https://google.com/recaptcha/*
// @match        https://www.recaptcha.net/recaptcha/*
// @match        https://recaptcha.net/recaptcha/*
// @icon         https://cms-assets.tutsplus.com/uploads/users/362/posts/29169/preview_image/picCAPTCHA.jpg
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Recaptcha%20Solver.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Recaptcha%20Solver.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════════════
    //  CONTEXT GUARD
    //  Only run inside the bframe (challenge iframe).
    //  The anchor frame (checkbox) is left completely untouched — no
    //  auto-clicking, no observers, nothing.  Everything is manual.
    // ════════════════════════════════════════════════════════════════════════
    if (!window.location.href.includes('bframe')) return;

    // ════════════════════════════════════════════════════════════════════════
    //  SELECTORS
    // ════════════════════════════════════════════════════════════════════════

    const SEL = {
        AUDIO_BUTTON:   '#recaptcha-audio-button',
        AUDIO_SOURCE:   '#audio-source',
        IMAGE_SELECT:   '#rc-imageselect',
        RESPONSE_FIELD: '.rc-audiochallenge-response-field',
        AUDIO_ERROR:    '.rc-audiochallenge-error-message',
        AUDIO_RESPONSE: '#audio-response',
        RELOAD_BUTTON:  '#recaptcha-reload-button',
        STATUS:         '#recaptcha-accessible-status',
        DOSCAPTCHA:     '.rc-doscaptcha-body',
        VERIFY_BUTTON:  '#recaptcha-verify-button',
        RC_BUTTONS:     '.rc-buttons',
        HELP_HOLDER:    '.help-button-holder'
    };

    // ════════════════════════════════════════════════════════════════════════
    //  CONFIG
    // ════════════════════════════════════════════════════════════════════════

    const CFG = {
        MAX_ATTEMPTS:          5,
        INTERVAL_MS:           1000,
        SUBMIT_GRACE_MS:       3500,
        STUCK_TIMEOUT_MS:      45000,
        MAX_RESPONSE_LEN:      100,
        AUDIO_BTN_DEBOUNCE_MS: 4000
    };

    // ════════════════════════════════════════════════════════════════════════
    //  SERVERS
    // ════════════════════════════════════════════════════════════════════════

    const SERVERS   = [
        'https://engageub.pythonanywhere.com',
        'https://engageub1.pythonanywhere.com'
    ];
    const latencies = SERVERS.map(() => Infinity);

    // ════════════════════════════════════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════════════════════════════════════

    let state          = null;
    let solverInterval = null;

    function freshState() {
        return {
            stopped:         false,
            solved:          false,
            waiting:         false,
            waitingStart:    0,
            audioUrl:        '',
            requestCount:    0,
            submittedAt:     0,
            audioBtnClickAt: 0,
            initialStatus:   qs(SEL.STATUS)?.innerText ?? ''
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════════════════════════

    function qs(sel) { return document.querySelector(sel); }

    function isVisible(el) {
        if (!el || el.offsetParent === null) return false;
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden';
    }

    function getLang() {
        const raw = qs('html')?.getAttribute('lang') || navigator.language || 'en-US';
        const map = {
            af:'af-ZA', am:'am-ET', ar:'ar-SA', az:'az-AZ', be:'be-BY',
            bg:'bg-BG', bn:'bn-BD', bs:'bs-BA', ca:'ca-ES', cs:'cs-CZ',
            cy:'cy-GB', da:'da-DK', de:'de-DE', el:'el-GR', es:'es-ES',
            et:'et-EE', eu:'eu-ES', fa:'fa-IR', fi:'fi-FI', fr:'fr-FR',
            ga:'ga-IE', gl:'gl-ES', gu:'gu-IN', he:'he-IL', hi:'hi-IN',
            hr:'hr-HR', hu:'hu-HU', hy:'hy-AM', id:'id-ID', is:'is-IS',
            it:'it-IT', ja:'ja-JP', ka:'ka-GE', kk:'kk-KZ', km:'km-KH',
            kn:'kn-IN', ko:'ko-KR', lt:'lt-LT', lv:'lv-LV', mk:'mk-MK',
            ml:'ml-IN', mn:'mn-MN', mr:'mr-IN', ms:'ms-MY', my:'my-MM',
            nb:'nb-NO', ne:'ne-NP', nl:'nl-NL', pa:'pa-IN', pl:'pl-PL',
            pt:'pt-BR', ro:'ro-RO', ru:'ru-RU', si:'si-LK', sk:'sk-SK',
            sl:'sl-SI', sq:'sq-AL', sr:'sr-RS', sv:'sv-SE', sw:'sw-KE',
            ta:'ta-IN', te:'te-IN', th:'th-TH', tl:'tl-PH', tr:'tr-TR',
            uk:'uk-UA', ur:'ur-PK', uz:'uz-UZ', vi:'vi-VN', zh:'zh-CN',
            zu:'zu-ZA'
        };
        return map[raw] ?? raw;
    }

    function getBestServer(exclude = null) {
        let best = null, bestMs = Infinity;
        for (let i = 0; i < SERVERS.length; i++) {
            if (SERVERS[i] === exclude) continue;
            if (latencies[i] < bestMs) { bestMs = latencies[i]; best = SERVERS[i]; }
        }
        return best ?? SERVERS.find(s => s !== exclude) ?? SERVERS[0];
    }

    function log(msg) { console.log(`[RecaptchaSolver] ${msg}`); }

    // ════════════════════════════════════════════════════════════════════════
    //  PING TESTS  (passive background latency measurement only)
    // ════════════════════════════════════════════════════════════════════════

    SERVERS.forEach((url, i) => {
        const t0 = Date.now();
        GM_xmlhttpRequest({
            method: 'GET', url, timeout: 8000,
            onload(r)   { latencies[i] = r?.responseText === '0' ? Date.now() - t0 : 9999; log(`Ping ${url}: ${latencies[i]}ms`); },
            onerror()   { latencies[i] = Infinity; },
            ontimeout() { latencies[i] = Infinity; }
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    //  TRANSCRIPTION REQUEST
    // ════════════════════════════════════════════════════════════════════════

    function getTextFromAudio(srcUrl, retry = null) {
        const normalizedUrl = srcUrl.replace(/recaptcha\.net/g, 'google.com');
        const lang          = getLang();
        const server        = getBestServer(retry);

        if (!retry) state.requestCount++;
        state.waitingStart = Date.now();
        log(`→ ${server} | lang:${lang} | attempt:${state.requestCount}${retry ? ' [retry]' : ''}`);

        GM_xmlhttpRequest({
            method:  'POST',
            url:     server,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data:    'input=' + encodeURIComponent(normalizedUrl) + '&lang=' + encodeURIComponent(lang),
            timeout: 30000,

            onload(response) {
                try {
                    const text = response.responseText?.trim() ?? '';
                    log(`← "${text.substring(0, 80)}"`);

                    const invalid =
                        !text ||
                        text === '0' ||
                        text.length < 2 ||
                        text.length > CFG.MAX_RESPONSE_LEN ||
                        /<[a-z][\s\S]*?>/i.test(text);

                    if (invalid) {
                        log('Invalid response — will reload on next tick');
                        return;
                    }

                    const audioBtn    = qs(SEL.AUDIO_BUTTON);
                    const audioSrcEl  = qs(SEL.AUDIO_SOURCE);
                    const audioRespEl = qs(SEL.AUDIO_RESPONSE);
                    const verifyBtn   = qs(SEL.VERIFY_BUTTON);

                    const inAudioMode = audioBtn &&
                        window.getComputedStyle(audioBtn).display === 'none';

                    if (inAudioMode && audioSrcEl?.src === srcUrl && audioRespEl && !audioRespEl.value && verifyBtn) {
                        audioRespEl.value = text;
                        audioRespEl.dispatchEvent(new Event('input',  { bubbles: true }));
                        audioRespEl.dispatchEvent(new Event('change', { bubbles: true }));
                        verifyBtn.click();
                        state.submittedAt = Date.now();
                        log(`✓ Submitted: "${text}"`);
                    } else {
                        log('Page state changed — will retry on next challenge');
                    }
                } catch (err) {
                    log(`Response handler error: ${err.message}`);
                } finally {
                    state.waiting = false;
                }
            },

            onerror() {
                log(`✗ Network error from ${server}`);
                if (!retry) { getTextFromAudio(srcUrl, server); }
                else { log('Both servers failed — releasing lock'); state.waiting = false; }
            },

            ontimeout() {
                log(`✗ Timeout from ${server}`);
                if (!retry) { getTextFromAudio(srcUrl, server); }
                else { log('Both servers timed out — releasing lock'); state.waiting = false; }
            }
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SOLVER LOOP
    // ════════════════════════════════════════════════════════════════════════

    function startSolver(btn) {
        state = freshState();
        setButtonState(btn, 'working');

        solverInterval = setInterval(function () {
            try {
                const dosEl = qs(SEL.DOSCAPTCHA);
                if (dosEl?.innerText.length > 0) {
                    log('DoS protection triggered — stopping');
                    stopSolver(btn, 'dos');
                    return;
                }

                if (state.solved || state.stopped) return;

                const statusEl = qs(SEL.STATUS);
                if (statusEl && statusEl.innerText !== state.initialStatus) {
                    log('SOLVED ✓');
                    state.solved = true;
                    stopSolver(btn, 'success');
                    return;
                }

                if (state.requestCount >= CFG.MAX_ATTEMPTS) {
                    log(`Max attempts (${CFG.MAX_ATTEMPTS}) reached`);
                    state.stopped = true;
                    stopSolver(btn, 'failed');
                    return;
                }

                if (state.waiting && (Date.now() - state.waitingStart) > CFG.STUCK_TIMEOUT_MS) {
                    log('XHR appears stuck — releasing lock');
                    state.waiting = false;
                }

                const now         = Date.now();
                const audioBtn    = qs(SEL.AUDIO_BUTTON);
                const imageSelect = qs(SEL.IMAGE_SELECT);

                if (
                    audioBtn    && isVisible(audioBtn)    &&
                    imageSelect && isVisible(imageSelect) &&
                    (now - state.audioBtnClickAt) > CFG.AUDIO_BTN_DEBOUNCE_MS
                ) {
                    log('Switching to audio challenge');
                    audioBtn.click();
                    state.audioBtnClickAt = now;
                    return;
                }

                const audioSrcEl = qs(SEL.AUDIO_SOURCE);
                const reloadBtn  = qs(SEL.RELOAD_BUTTON);
                const audioErrEl = qs(SEL.AUDIO_ERROR);

                const inGrace = state.submittedAt > 0 &&
                    (now - state.submittedAt) < CFG.SUBMIT_GRACE_MS;

                const isStale =
                    !state.waiting && !inGrace &&
                    audioSrcEl?.src &&
                    state.audioUrl === audioSrcEl.src &&
                    reloadBtn;

                const hasError =
                    audioErrEl?.innerText.length > 0 &&
                    reloadBtn && !reloadBtn.disabled;

                if (isStale || hasError) {
                    log(hasError ? 'Error detected — reloading' : 'Stale audio — reloading');
                    reloadBtn.click();
                    return;
                }

                const responseField = qs(SEL.RESPONSE_FIELD);
                const audioRespEl   = qs(SEL.AUDIO_RESPONSE);

                if (
                    !state.waiting &&
                    responseField && isVisible(responseField) &&
                    audioRespEl   && !audioRespEl.value &&
                    audioSrcEl?.src && audioSrcEl.src.length > 0 &&
                    state.audioUrl !== audioSrcEl.src
                ) {
                    state.audioUrl = audioSrcEl.src;
                    state.waiting  = true;
                    getTextFromAudio(state.audioUrl);
                }

            } catch (err) {
                log(`Interval error: ${err.message}`);
                stopSolver(btn, 'failed');
            }
        }, CFG.INTERVAL_MS);
    }

    function stopSolver(btn, result) {
        if (solverInterval) {
            clearInterval(solverInterval);
            solverInterval = null;
        }
        setButtonState(btn, result);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SVG ICONS
    // ════════════════════════════════════════════════════════════════════════

    const SVG = {
        bolt:  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M13 2 3 14h9l-1 8L21 10h-9l1-8z"/></svg>`,
        spin:  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="rs-spin" style="display:block"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="20 6 9 17 4 12"/></svg>`,
        retry: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.95"/></svg>`,
        warn:  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>`
    };

    // ════════════════════════════════════════════════════════════════════════
    //  BUTTON STATES
    // ════════════════════════════════════════════════════════════════════════

    const BUTTON_ID  = 'rs-solve-btn';
    const WRAPPER_ID = 'rs-solve-wrapper';

    const BTN_STATES = {
        ready:   [SVG.bolt,  'Solve automatically',           '',           false],
        working: [SVG.spin,  'Solving…',                     'rs-working',  true ],
        success: [SVG.check, 'Solved!',                      'rs-success',  true ],
        failed:  [SVG.retry, 'Failed — click to retry',      'rs-failed',   false],
        dos:     [SVG.warn,  'Automated query limit reached', 'rs-dos',      true ]
    };

    function setButtonState(btn, stateName) {
        if (!btn) return;
        const [icon, title, cls, disabled] = BTN_STATES[stateName] ?? BTN_STATES.ready;
        btn.innerHTML = icon;
        btn.title     = title;
        btn.disabled  = disabled;
        btn.className = 'rc-button goog-inline-block rs-btn' + (cls ? ' ' + cls : '');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  STYLES
    // ════════════════════════════════════════════════════════════════════════

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* ── Wrapper: sibling of .button-holder divs inside .rc-buttons ── */
            .rs-btn-holder {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                vertical-align: middle !important;
            }

            /* ── Button base ─────────────────────────────────────────────── */
            .rs-btn {
                background-image: none !important;
                background-color: #1a73e8 !important;
                color: #fff !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                border-radius: 4px !important;
                cursor: pointer !important;
                line-height: 0 !important;
                vertical-align: middle !important;
                transition: background-color 0.15s ease, transform 0.1s ease,
                            box-shadow 0.15s ease !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.25) !important;
                outline: none !important;
                user-select: none !important;
            }

            .rs-btn:not(:disabled):hover {
                background-color: #1558b0 !important;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
                transform: translateY(-1px) !important;
            }

            .rs-btn:not(:disabled):active {
                transform: translateY(0) scale(0.96) !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
            }

            .rs-btn:disabled { cursor: default !important; opacity: 0.80 !important; }

            .rs-btn.rs-working { background-color: #f29900 !important; }
            .rs-btn.rs-success { background-color: #1e8e3e !important; }
            .rs-btn.rs-failed  { background-color: #d93025 !important; }
            .rs-btn.rs-failed:not(:disabled):hover { background-color: #b71c1c !important; }
            .rs-btn.rs-dos     { background-color: #e37400 !important; }

            /* SVG spinner */
            .rs-spin {
                animation: rs-rotate 0.9s linear infinite !important;
                transform-origin: center !important;
            }
            @keyframes rs-rotate {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
            }

            .rs-btn:focus-visible {
                outline: 2px solid #1a73e8 !important;
                outline-offset: 2px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BUTTON INJECTION
    //  The button gets its OWN .button-holder wrapper inserted as a sibling
    //  of all other .button-holder divs inside .rc-buttons — NOT appended
    //  inside the existing help-button-holder.  This is the only correct way
    //  to achieve identical vertical alignment with the native buttons.
    // ════════════════════════════════════════════════════════════════════════

    function injectButton() {
        if (document.getElementById(BUTTON_ID)) return true;

        const helpHolder = qs(SEL.HELP_HOLDER);
        if (!helpHolder) return false;

        const btn = document.createElement('button');
        btn.id       = BUTTON_ID;
        btn.tabIndex = 0;
        setButtonState(btn, 'ready');

        btn.addEventListener('click', () => {
            if (state?.stopped && !state.solved) {
                log('Retrying solver…');
                startSolver(btn);
                return;
            }
            if (solverInterval || state?.solved) return;
            log('Solver started by user');
            startSolver(btn);
        });

        const wrapper = document.createElement('div');
        wrapper.id        = WRAPPER_ID;
        wrapper.className = 'button-holder rs-btn-holder';
        wrapper.appendChild(btn);

        // Insert as a proper sibling — immediately after the help-button-holder
        helpHolder.insertAdjacentElement('afterend', wrapper);
        log('Solve button injected');
        return true;
    }

    function waitForButtonHolder() {
        if (injectButton()) return;
        const obs = new MutationObserver(() => {
            if (injectButton()) obs.disconnect();
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BOOT
    // ════════════════════════════════════════════════════════════════════════

    injectStyles();
    waitForButtonHolder();

    // Re-inject if reCAPTCHA rebuilds the footer DOM
    const rebuildGuard = new MutationObserver(() => {
        if (!document.getElementById(BUTTON_ID) && qs(SEL.HELP_HOLDER)) {
            log('Button lost — re-injecting');
            injectButton();
        }
    });
    rebuildGuard.observe(document.body, { childList: true, subtree: true });

})();

```

---

## Reddit Content Unlocker — v2.5.2

- **Datei:** `Reddit Content Unlocker.user.js`
- **Matches:** https://www.reddit.com/*, https://sh.reddit.com/*
- **Grants:** GM_addElement, GM_setValue, GM_getValue
- **Beschreibung:** Removes NSFW popup, un-blurs content, and makes website accessible

```javascript
// ==UserScript==
// @name            Reddit Content Unlocker
// @namespace       https://greasyfork.org/users/821661
// @match           https://www.reddit.com/*
// @match           https://sh.reddit.com/*
// @grant           GM_addElement
// @grant           GM_setValue
// @grant           GM_getValue
// @run-at          document-start
// @noframes
// @version         2.5.2
// @author          hdyzen (modified)
// @description     Removes NSFW popup, un-blurs content, and makes website accessible
// @icon        data:image/png;base64,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
// @license         MIT
// @homepage        https://github.com/zenstorage/Reddit-NSFW-Unblur
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Reddit%20Content%20Unlocker.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Reddit%20Content%20Unlocker.user.js
// ==/UserScript==

'use strict';

// --- State ---
let { state = true, nsfw = true, spoiler = false } = GM_getValue('states', false);
let _t = null, _menuDone = false;

// --- attachShadow hook ---
// Inject reveal CSS the instant Reddit attaches a shadow root to shreddit-blurred-container.
// This eliminates the querySelectorAll('*') scan on every observer tick.
const _origAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function(init) {
    const sr = _origAttachShadow.call(this, init);
    if (this.tagName?.toLowerCase() === 'shreddit-blurred-container') {
        const s = document.createElement('style');
        s.id = 'u-reveal';
        s.textContent =
            'slot[name="blurred"]{display:none!important}' +
            'slot[name="revealed"]{display:block!important;opacity:1!important;height:100%!important}' +
            'div.prompt{display:none!important}';
        sr.appendChild(s);
    }
    return sr;
};

// --- Inline CSS ---
const GLOBAL_CSS = `
    faceplate-modal[blocking], faceplate-modal#blocking-modal,
    faceplate-dialog[id*="nsfw"], faceplate-dialog[id*="qr"],
    div.prompt, xpromo-nsfw-blocking-container a[slot="view-in-app-button"],
    div[style*="backdrop-filter: blur"] { display: none !important; }
    img { filter: none !important; }
    [slot="blurred"] img { opacity: 1 !important; filter: none !important; }
`;

const MENU_CSS = `
    #menu-unblur {
        position: relative; display: flex; align-items: center;
        margin: 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; z-index: 9999;
    }
    #popup-toggle {
        cursor: pointer; padding: 4px 10px; border-radius: 20px; font-size: 13px;
        font-weight: 600; color: #fff; background: #ff4500; user-select: none;
        white-space: nowrap; transition: background .2s;
    }
    #popup-toggle:hover, #menu-unblur.active #popup-toggle { background: #e03d00; }
    #status-container {
        display: none; position: absolute; top: calc(100% + 6px); right: 0;
        background: #1a1a1b; border: 1px solid #343536; border-radius: 8px;
        padding: 10px 14px; min-width: 180px; box-shadow: 0 4px 16px rgba(0,0,0,.5); color: #d7dadc;
    }
    #menu-unblur.active #status-container { display: block; }
    #container-toggle { display: flex; justify-content: center; margin-bottom: 10px; }
    #container-toggle label { cursor: pointer; }
    #container-toggle svg { width: 28px; height: 28px; fill: #ff4500; transition: fill .2s; }
    #container-toggle input { display: none; }
    #container-toggle input:not(:checked) + svg { fill: #818384; }
    #selected-ops { display: flex; flex-direction: column; gap: 8px; }
    #selected-ops label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; }
    #selected-ops input[type="checkbox"] { display: none; }
    .slider {
        position: relative; display: inline-block; width: 34px; height: 18px;
        background: #343536; border-radius: 18px; flex-shrink: 0; transition: background .2s;
    }
    .slider::after {
        content: ''; position: absolute; width: 14px; height: 14px; background: #fff;
        border-radius: 50%; top: 2px; left: 2px; transition: transform .2s;
    }
    input[type="checkbox"]:checked + .slider { background: #ff4500; }
    input[type="checkbox"]:checked + .slider::after { transform: translateX(16px); }
    .slider-label { color: #d7dadc; }
`;

// --- Helpers ---
const removeAll  = s => document.querySelectorAll(s).forEach(e => e.remove());
const reveal     = el => {
    el.style.setProperty('display',  'block', 'important');
    el.style.setProperty('opacity',  '1',     'important');
    el.style.setProperty('filter',   'none',  'important');
    el.style.setProperty('height',   '100%',  'important');
};
const unblurImgs = root => root.querySelectorAll('img:not([data-unblurred])').forEach(img => {
    img.setAttribute('data-unblurred', '1');
    img.classList.remove('opacity-30', 'opacity-50');
    img.style.setProperty('opacity', '1',    'important');
    img.style.setProperty('filter',  'none', 'important');
});

let _globalCSSInjected = false;
function injectGlobalCSS() {
    if (_globalCSSInjected) return;
    _globalCSSInjected = true;
    const s = document.createElement('style');
    s.id = 'unblur-css'; s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
}

function removeImageBlur() {
    document.querySelectorAll('img[src*="blur="]:not([data-unblurred]), img[style*="blur"]:not([data-unblurred])').forEach(img => {
        img.setAttribute('data-unblurred', '1');
        if (img.src.includes('blur=')) {
            const fixed = img.src.replace(/[?&]blur=\d+/g,'').replace(/[?&]format=pjpg/g,'').replace(/&&/g,'&').replace(/\?&/,'?');
            if (fixed !== img.src) img.src = fixed;
        }
        const st = img.getAttribute('style') || '';
        if (st.includes('blur')) img.setAttribute('style', st.replace(/filter:\s*blur\([^)]+\)/g, ''));
    });
}

// --- Main callback ---
function callback() {
    if (!_menuDone) { _menuDone = true; initMenu(); }
    if (!state) return;

    injectGlobalCSS();

    removeAll('faceplate-modal[blocking], faceplate-modal#blocking-modal');
    removeAll('faceplate-dialog#nsfw-qr-dialog, faceplate-dialog[id*="nsfw"], faceplate-dialog[id*="qr"]');
    removeAll('div.thumbnail-shadow, .bg-media-background, div.prompt');
    removeAll('[slot="view-in-app-button"]');
    document.querySelectorAll('[style*="backdrop-filter"]').forEach(el => { if (el.style.position === 'fixed') el.remove(); });
    document.querySelectorAll('[style*="color-scrim"]').forEach(el => { el.style.removeProperty('box-shadow'); el.removeAttribute('open'); });

    [...document.getElementsByTagName('shreddit-async-loader')]
        .filter(e => e.getAttribute('bundlename')?.includes('nsfw'))
        .forEach(e => e.remove());

    // Re-inject shadow CSS into any shreddit-blurred-container whose shadow root exists
    // (handles SPA navigation and components that re-render after the attachShadow hook)
    [...document.getElementsByTagName('shreddit-blurred-container')].forEach(el => {
        const sr = el.shadowRoot;
        if (!sr || sr.querySelector('#u-reveal')) return;
        const s = document.createElement('style');
        s.id = 'u-reveal';
        s.textContent = 'slot[name="blurred"]{display:none!important}slot[name="revealed"]{display:block!important;opacity:1!important;height:100%!important}div.prompt{display:none!important}';
        sr.appendChild(s);
    });

    document.querySelectorAll('[is-nsfw-blocked]').forEach(e => e.removeAttribute('is-nsfw-blocked'));
    document.querySelectorAll('[blurred]').forEach(e => e.removeAttribute('blurred'));

    [...document.getElementsByTagName('shreddit-blurred-container')]
        .filter(e => { const r = e.getAttribute('reason'); return (r === 'nsfw' && nsfw) || (r === 'spoiler' && spoiler); })
        .forEach(blurred => {
            blurred.removeAttribute('blurred');
            blurred.setAttribute('clicked', '');
            try { blurred.click(); } catch {}
            try { blurred.firstElementChild?.click(); } catch {}
            const blurredSlot  = blurred.querySelector('[slot="blurred"]');
            const revealedSlot = blurred.querySelector('[slot="revealed"]');
            if (revealedSlot) { blurredSlot?.style.setProperty('display','none','important'); reveal(revealedSlot); }
            else if (blurredSlot) { reveal(blurredSlot); unblurImgs(blurredSlot); }
        });

    document.querySelectorAll('shreddit-aspect-ratio [slot="blurred"]').forEach(el => { reveal(el); unblurImgs(el); });

    removeImageBlur();
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
}

// --- Menu ---
function initMenu() {
    const menuStyle = document.createElement('style');
    menuStyle.textContent = MENU_CSS;
    document.head.appendChild(menuStyle);

    // Flexible selector — fallback if header.v2 disappears in an A/B test
    const navTarget = document.querySelector('header.v2 > nav')
        || document.querySelector('header nav')
        || document.querySelector('header')
        || document.body;

    const menu = GM_addElement(navTarget, 'div', { id: 'menu-unblur' });

    menu.addEventListener('click', e => {
        if (e.target.id === 'menu' || e.target.id === 'popup-toggle') menu.classList.toggle('active');
    });

    menu.innerHTML = `<div id="popup-toggle">Unblur</div><form id="status-container"><div id="status"></div><div id="container-toggle"><label for="toggle"><input id="toggle" name="toggle" type="checkbox"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V3ZM8.6092 5.8744C9.09211 5.60643 9.26636 4.99771 8.99839 4.5148C8.73042 4.03188 8.12171 3.85763 7.63879 4.1256C4.87453 5.65948 3 8.61014 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 8.66747 19.1882 5.75928 16.5007 4.20465C16.0227 3.92811 15.4109 4.09147 15.1344 4.56953C14.8579 5.04759 15.0212 5.65932 15.4993 5.93586C17.5942 7.14771 19 9.41027 19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 9.3658 6.45462 7.06997 8.6092 5.8744Z"></path></svg></label></div><div id="selected-ops"><label for="toggle-nsfw"><input type="checkbox" name="toggle-nsfw" id="toggle-nsfw"><span class="slider"></span><span class="slider-label">Unblur NSFW</span></label><label for="toggle-spoiler"><input type="checkbox" name="toggle-spoiler" id="toggle-spoiler"><span class="slider"></span><span class="slider-label">Unblur Spoiler</span></label></div></form>`;

    const toggle        = document.getElementById('toggle'),
          toggleNSFW    = document.getElementById('toggle-nsfw'),
          toggleSpoiler = document.getElementById('toggle-spoiler'),
          form          = document.getElementById('status-container');

    toggle.checked        = state;
    toggleNSFW.checked    = nsfw;
    toggleSpoiler.checked = spoiler;

    form.addEventListener('change', () => {
        state   = toggle.checked;
        nsfw    = toggleNSFW.checked;
        spoiler = toggleSpoiler.checked;
        GM_setValue('states', { state, nsfw, spoiler });
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('#menu-unblur') && menu.classList.contains('active')) menu.classList.remove('active');
        if (e.target.closest('media-telemetry-observer')) e.preventDefault();
    });
}

// --- Observer (childList only — attributes:true removed to prevent self-triggering loops) ---
const observer = new MutationObserver(() => { clearTimeout(_t); _t = setTimeout(callback, 150); });
observer.observe(document, { childList: true, subtree: true });

// Disconnect if not shreddit after 8s
setTimeout(() => {
    if (!document.querySelector('shreddit-app')) { clearTimeout(_t); observer.disconnect(); }
}, 8000);

```

---

## YouTube Enhanced — v1.5.2

- **Datei:** `YouTube Enhanced.user.js`
- **Matches:** *://*.youtube.com/*
- **Grants:** GM_getValue, GM_setValue
- **Beschreibung:** Auto max video quality, per-channel playback speed control & auto-stop on page load.

```javascript
// ==UserScript==
// @name         YouTube Enhanced
// @namespace    http://tampermonkey.net/
// @version      1.5.2
// @description  Auto max video quality, per-channel playback speed control & auto-stop on page load.
// @author       marmoris
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @icon         https://www.youtube.com/favicon.ico
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // SHARED CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    const CFG = {
        debug: false,
        preferredQuality: 8,    // Fallback: 0=Auto  5=720p  6=1080p  7=1440p  8=2160p/4K
        SPEED_KEY:    'yt_suite_channel_speeds',
        MENU_DELAY:   50,
        SPEED_RETRY:  1000,
        INIT_TIMEOUT: 15000,
    };

    const QUALITY_MAP = {
        0: 'auto',
        5: 'hd720',
        6: 'hd1080',
        7: 'hd1440',
        8: 'hd2160'
    };

    const log = (...a) => { if (CFG.debug) console.log('[YT-Suite]', ...a); };

    function getLanguage() {
        // Check browser UI language (primary preference)
        const browserLang = navigator.language;
        if (browserLang && browserLang.toLowerCase().startsWith('de')) {
            return 'de';
        }

        return 'en'; // Default
    }

    // Language configuration
    const LANG = (() => {
        const isGerman = getLanguage() === 'de';

        return {
            isGerman,
            // Panel and menu labels
            backToPreviousMenu: isGerman ? 'Zurück zum vorherigen Menü' : 'Back to previous menu',
            channelSpeed: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed',
            decreaseSpeed: isGerman ? 'Kanalgeschwindigkeit reduzieren 0.05' : 'Decrease speed 0.05',
            increaseSpeed: isGerman ? 'Kanalgeschwindigkeit erhöhen 0.05' : 'Increase speed 0.05',
            standard: isGerman ? 'Standard' : 'Normal',
            channelSpeedLabel: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed'
        };
    })();

    const THIRTY_DAYS_MS = 2592000000;
    const PS_PLAYING    = 1; // YouTube player state: PLAYING
    const PS_BUFFERING  = 3; // YouTube player state: BUFFERING

    function roundSpeed(v) { return Math.round(v * 100) / 100; }
    function clampSpeed(v) { return Math.max(0.25, Math.min(3, v)); }

    // Trackers for SPAs (YouTube recycles the <video> tag)
    let handledVidsHD = new WeakSet();
    let handledVids   = new WeakSet();

    function resetVideoTrackers() {
        handledVidsHD = new WeakSet();
        handledVids   = new WeakSet();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 1 · AUTO HD / 4K (API + LocalStorage Fallback)
    // ═════════════════════════════════════════════════════════════════════════

    function patchQuality() {
        try {
            // Alter YouTube Quality Key
            const KEY = 'yt-player-user-settings';
            let us = {};
            try {
                const raw = localStorage.getItem(KEY);
                if (raw) {
                    const p = JSON.parse(raw);
                    if (p && p.data) us = JSON.parse(p.data);
                }
            } catch (_) { }

            const now = Date.now();
            us['482'] = { intValue: CFG.preferredQuality };
            localStorage.setItem(KEY, JSON.stringify({
                creation:   now,
                data:       JSON.stringify(us),
                expiration: now + THIRTY_DAYS_MS,
            }));

            // Neuer YouTube Quality Key (zwingt den Player auf die bevorzugte Qualität)
            localStorage.setItem('yt-player-quality', JSON.stringify({
                data: JSON.stringify({ quality: QUALITY_MAP[CFG.preferredQuality], previousQuality: "auto" }),
                expiration: now + THIRTY_DAYS_MS,
                creation: now
            }));
        } catch (e) { log('patchQuality error:', e); }
    }

    // Greift über die native Player-API ein und zwingt die höchste verfügbare Qualität
    function applyAutoHD(ytPlayer) {
        try {
            if (!ytPlayer || typeof ytPlayer.getAvailableQualityLevels !== 'function') return;

            const levels = ytPlayer.getAvailableQualityLevels();
            if (!levels || levels.length === 0) return;

            const desired = QUALITY_MAP[CFG.preferredQuality];
            let targetQuality = null;

            if (desired && desired !== 'auto') {
                targetQuality = levels.find(q => q === desired);
            }

            if (!targetQuality) {
                // Fallback: highest non-auto quality
                targetQuality = levels.find(q => q && q !== 'auto');
            }

            if (targetQuality) {
                if (typeof ytPlayer.setPlaybackQualityRange === 'function') {
                    ytPlayer.setPlaybackQualityRange(targetQuality, targetQuality); // Setzt Min und Max
                }
                log('AutoHD: Set to', targetQuality);
            }
        } catch (e) { log('applyAutoHD error:', e); }
    }

    function initAutoHD(ytPlayer, vid) {
        if (!ytPlayer || !vid || handledVidsHD.has(vid)) return;
        handledVidsHD.add(vid);

        const force = () => applyAutoHD(ytPlayer);

        force(); // Sofort anwenden
        vid.addEventListener('loadedmetadata', force, { once: true }); // Wenn Auflösungsdaten da sind
        vid.addEventListener('playing', () => setTimeout(force, 100), { once: true }); // Sicherheit beim Loslaufen
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 2 · CHANNEL SPEED CONTROLLER (STRICT 1:1 NATIVE UI & ANIMATION)
    // ═════════════════════════════════════════════════════════════════════════

    let speedCache      = null;
    let speedObs        = new Set();
    let speedAbort      = null;
    let speedRetryTimeout = null;
    let speedInitTimeout  = null;
    let currentChannelId = null;
    let isApplyingSpeed = false;
    let menuPanel       = null;
    let customPanel     = null;
    let inCustomPanel   = false;

    let origMenuWidth  = '';
    let origMenuHeight = '';

    function getSpeeds() {
        if (!speedCache) {
            try { speedCache = GM_getValue(CFG.SPEED_KEY, {}); }
            catch (_) { speedCache = {}; }
        }
        return speedCache;
    }

    function saveSpeed(cid, val) {
        try {
            const s = getSpeeds();
            s[cid] = val;
            speedCache = s;
            GM_setValue(CFG.SPEED_KEY, s);
        } catch (e) { log('saveSpeed error:', e); }
    }

    function applySpeed(val) {
        try {
            const vid = document.querySelector('.html5-main-video');
            if (vid && Math.abs(vid.playbackRate - val) > 0.001) {
                isApplyingSpeed = true;
                try {
                    vid.playbackRate = val;
                } finally {
                    isApplyingSpeed = false;
                }
            }
        } catch (e) { log('applySpeed error:', e); }
    }

    function getChannelId() {
        try {
            // Try regular video page channel link
            const a = document.querySelector('#upload-info #channel-name #text a');
            if (a) return new URL(a.href).pathname.split('/').pop();

            // Try Shorts page channel link
            const shortsChannel = document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a');
            if (shortsChannel) return new URL(shortsChannel.href).pathname.split('/').pop();

            // Try any channel link as fallback (prefer @handle over /channel/)
            const anyChannel = document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
            if (anyChannel) return new URL(anyChannel.href).pathname.split('/').pop();
        } catch (_) {}
        return null;
    }

    function buildSpeedPanel(settingsMenu) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `<div class="ytp-panel" style="width: 330px; height: 250px;"><div class="ytp-panel-header"><div class="ytp-panel-back-button-container"><button class="ytp-button ytp-panel-back-button" aria-label="${LANG.backToPreviousMenu}"></button></div><span class="ytp-panel-title" role="heading" aria-level="2">${LANG.channelSpeed}</span></div><div class="ytp-variable-speed-panel-content" tabindex="0" style="height: 193px;"><div class="ytp-speed-display-container"><div class="ytp-variable-speed-panel-display" aria-live="polite"><div class="ytp-variable-speed-panel-premium-badge" tabindex="-1"><div class="ytp-variable-speed-panel-badge"></div></div><span>1.00x</span></div></div><div class="ytp-variable-speed-panel-slider-container"><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="${LANG.decreaseSpeed}"><span>-</span></button><div class="ytp-input-slider-section"><div class="ytp-speedslider-indicator-container"><div class="ytp-speedslider-badge" aria-label=""></div><p class="ytp-speedslider-text">1.00x</p></div><input class="ytp-input-slider ytp-speedslider ytp-varispeed-input-slider" role="slider" tabindex="0" type="range" min="0.25" max="3" step="0.05" value="1" aria-valuenow="1" aria-valuemin="0.25" aria-valuemax="3" aria-valuetext="1.00" style="--yt-slider-shape-gradient-percent: 42.857142857142854%;"></div><button class="ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button" aria-label="${LANG.increaseSpeed}"><span>+</span></button></div><div class="ytp-variable-speed-panel-chips"><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="5" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1</span></button><div class="ytp-variable-speed-panel-preset-button-label-text">${LANG.standard}</div></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="2" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,25</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="3" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,5</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="0" aria-hidden="true" style="display: none;"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>1,75</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="4" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><span>2</span></button></div><div class="ytp-variable-speed-panel-preset-button-wrapper" data-priority="1" aria-hidden="false"><button class="ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button"><div class="ytp-variable-speed-panel-premium-upsell-icon"></div><span>3.0</span></button></div></div></div></div>`;
        const panel = tempDiv.firstChild;

        let cid = currentChannelId;
        if (!cid) cid = getChannelId();
        const isGerman = LANG.isGerman;
        let curSpeed = cid ? (getSpeeds()[cid] ?? 1.0) : 1.0;

        const backBtn = panel.querySelector('.ytp-panel-back-button');
        const displayTxt = panel.querySelector('.ytp-variable-speed-panel-display span');
        const sliderTxt = panel.querySelector('.ytp-speedslider-text');
        const slider = panel.querySelector('input[type="range"]');
        const btns = panel.querySelectorAll('.ytp-variable-speed-panel-increment-button');
        const btnDec = btns[0];
        const btnInc = btns[1];
        const chips = panel.querySelectorAll('.ytp-variable-speed-panel-preset-button-wrapper button');

        // Localize chip numbers based on language
        if (!isGerman) {
            chips.forEach(btn => {
                const span = btn.querySelector('span');
                if (!span) return;
                // Replace comma with dot for English/international format
                span.textContent = span.textContent.replace(',', '.');
            });
        } else {
            // In German mode, ensure decimal point is comma (for 3.0 chip)
            chips.forEach(btn => {
                const span = btn.querySelector('span');
                if (!span) return;
                span.textContent = span.textContent.replace('.', ',');
            });
        }

        backBtn.addEventListener('click', e => {
            e.stopPropagation();
            closeSpeedPanel(settingsMenu);
        });

        function getSliderPercent(v) {
            const clamped = clampSpeed(v);
            return (Math.max(0, Math.min(1, (clamped - 0.25) / (3 - 0.25))) * 100).toFixed(6) + '%';
        }

        function refreshUI(v) {
            curSpeed = v;
            const strVal = v.toFixed(2) + 'x';
            if (displayTxt) displayTxt.textContent = strVal;
            if (sliderTxt) sliderTxt.textContent = strVal;

            const clampedSlider = clampSpeed(v);
            if (slider) {
                slider.value = String(clampedSlider);
                slider.setAttribute('aria-valuenow', String(v));
                slider.setAttribute('aria-valuetext', v.toFixed(2));
                slider.style.setProperty('--yt-slider-shape-gradient-percent', getSliderPercent(v));
            }

            chips.forEach(btn => {
                const span = btn.querySelector('span');
                if (!span) return;
                const btnVal = parseFloat(span.textContent.replace(',', '.'));
                if (Math.abs(btnVal - v) < 0.001) {
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                } else {
                    btn.style.backgroundColor = 'transparent';
                }
            });
        }

        function commit(v) {
            const rounded = roundSpeed(v);
            refreshUI(rounded);
            if (cid) {
                saveSpeed(cid, rounded);
            }
            applySpeed(rounded);
            updateMenuItemText(rounded);
        }

        if (slider) {
            slider.addEventListener('input', e => commit(parseFloat(e.target.value)));
        }
        if (btnDec) {
            btnDec.addEventListener('click', e => {
                e.stopPropagation();
                commit(Math.max(0.25, roundSpeed(curSpeed - 0.05)));
            });
        }
        if (btnInc) {
            btnInc.addEventListener('click', e => {
                e.stopPropagation();
                commit(Math.min(3.0, roundSpeed(curSpeed + 0.05)));
            });
        }

        chips.forEach(btn => {
            const span = btn.querySelector('span');
            if (!span) return;
            const speedVal = parseFloat(span.textContent.replace(',', '.'));
            btn.addEventListener('click', e => {
                e.stopPropagation();
                commit(speedVal);
            });
        });

        refreshUI(curSpeed);
        return panel;
    }

    function openSpeedPanel(settingsMenu) {
        if (inCustomPanel) return;
        menuPanel = settingsMenu.querySelector('.ytp-panel');
        if (!menuPanel) return;

        origMenuWidth = settingsMenu.style.width;
        origMenuHeight = settingsMenu.style.height;

        inCustomPanel = true;
        customPanel = buildSpeedPanel(settingsMenu);
        settingsMenu.appendChild(customPanel);

        menuPanel.style.display = 'none';
        settingsMenu.style.width = '330px';
        settingsMenu.style.height = '250px';
    }

    function closeSpeedPanel(settingsMenu) {
        if (!inCustomPanel) return;

        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }

        settingsMenu.style.width = origMenuWidth;
        settingsMenu.style.height = origMenuHeight;

        inCustomPanel = false;
    }

    function updateMenuItemText(speed) {
        const el = document.querySelector('#yts-chan-speed .ytp-menuitem-content');
        if (el) el.textContent = speed === 1 ? LANG.standard : speed.toFixed(2) + 'x';
    }

    const SPEED_TERMS =['speed','geschwindigkeit','velocidad','vitesse','速度','속도','velocità','hızı','snelheid','kecepatan','tốc độ','ความเร็ว','prędkość','скорость','سرعة','velocidade','hastighet','rychlost'];

    function insertSpeedMenuItem() {
        const menu = document.querySelector('.ytp-settings-menu');
        if (!menu) return false;
        const panelMenu = menu.querySelector('.ytp-panel-menu');
        if (!panelMenu) return false;

        if (document.querySelector('#yts-chan-speed')) return true;

        const ytSpeedItem =[...panelMenu.querySelectorAll('.ytp-menuitem')].find(el => {
            const lbl = el.querySelector('.ytp-menuitem-label');
            return lbl && SPEED_TERMS.some(t => lbl.textContent.toLowerCase().includes(t));
        });
        if (!ytSpeedItem) return false;

        const cid   = getChannelId();
        const saved = getSpeeds()[cid];
        const label = saved && saved !== 1 ? saved.toFixed(2) + 'x' : LANG.standard;

        const item = document.createElement('div');
        item.id        = 'yts-chan-speed';
        item.className = 'ytp-menuitem';
        item.setAttribute('role',         'menuitem');
        item.setAttribute('tabindex',     '0');
        item.setAttribute('aria-haspopup','true');
        item.innerHTML = `
            <div class="ytp-menuitem-icon">
                <svg height="24" viewBox="0 0 24 24" width="24" fill="white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M9.5 16.5v-9l7 4.5z"/>
                </svg>
            </div>
            <div class="ytp-menuitem-label">${LANG.channelSpeedLabel}</div>
            <div class="ytp-menuitem-content">${label}</div>`;

        item.addEventListener('click', e => {
            e.stopPropagation();
            openSpeedPanel(menu);
        });

        ytSpeedItem.insertAdjacentElement('afterend', item);
        return true;
    }

    function syncSpeedMenuDisplay() {
        insertSpeedMenuItem();
        const s = getSpeeds()[getChannelId()];
        if (s) updateMenuItemText(s);
    }

    function watchSettingsMenu(signal, retryCount = 3) {
        const menu = document.querySelector('.ytp-settings-menu');
        const btn  = document.querySelector('.ytp-settings-button');
        if (!menu || !btn) {
            if (retryCount > 0) {
                setTimeout(() => watchSettingsMenu(signal, retryCount - 1), 500);
            }
            return;
        }

        const obs = new MutationObserver(() => {
            if (menu.style.display === 'none') {
                if (inCustomPanel) closeSpeedPanel(menu);
            } else {
                setTimeout(syncSpeedMenuDisplay, CFG.MENU_DELAY);
            }
        });
        obs.observe(menu, { attributes: true, attributeFilter: ['style'] });
        speedObs.add(obs);

        btn.addEventListener('click', () => setTimeout(() => {
            const m = document.querySelector('.ytp-settings-menu');
            if (m && m.style.display !== 'none') syncSpeedMenuDisplay();
        }, CFG.MENU_DELAY), { signal });
    }

    function initSpeed() {
        if (speedRetryTimeout) clearTimeout(speedRetryTimeout);
        if (speedInitTimeout) clearTimeout(speedInitTimeout);
        const obs = new MutationObserver(() => {
            try {
                const vid = document.querySelector('.html5-main-video');
                // Wait for actual channel link in DOM, not just any ID
                const chan = document.querySelector('#upload-info #channel-name #text a') ||
                             document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a') ||
                             document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
                if (!vid || !chan) return;

                obs.disconnect();
                speedObs.delete(obs);

                const cid = new URL(chan.href).pathname.split('/').pop();
                const saved = getSpeeds()[cid];
                currentChannelId = cid;

                if (speedAbort) speedAbort.abort();
                speedAbort = new AbortController();

                vid.addEventListener('ratechange', () => {
                    if (isApplyingSpeed) return;
                    const currentSaved = getSpeeds()[currentChannelId];
                    if (currentSaved && Math.abs(vid.playbackRate - currentSaved) > 0.01) {
                        isApplyingSpeed = true;
                        vid.playbackRate = currentSaved;
                        isApplyingSpeed = false;
                    }
                }, { signal: speedAbort.signal });

                if (saved) {
                    applySpeed(saved);
                    speedRetryTimeout = setTimeout(() => applySpeed(saved), CFG.SPEED_RETRY);
                }

                watchSettingsMenu(speedAbort.signal);
            } catch (e) { log('initSpeed error:', e); }
        });

        obs.observe(document.documentElement, { childList: true, subtree: true });
        speedObs.add(obs);

        speedInitTimeout = setTimeout(() => {
            obs.disconnect();
            speedObs.delete(obs);
            log('initSpeed: Timeout reached, no channel found');
        }, CFG.INIT_TIMEOUT);
    }

    function cleanupSpeed() {
        speedObs.forEach(o => { try { o.disconnect(); } catch (_) {} });
        speedObs.clear();

        if (speedAbort) { speedAbort.abort(); speedAbort = null; }
        if (speedRetryTimeout) { clearTimeout(speedRetryTimeout); speedRetryTimeout = null; }
        if (speedInitTimeout) { clearTimeout(speedInitTimeout); speedInitTimeout = null; }
        if (customPanel) { customPanel.remove(); customPanel = null; }
        if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }
        currentChannelId = null;
        speedCache = null;
        inCustomPanel = false;
    }


    // ═════════════════════════════════════════════════════════════════════════
    // MODULE 3 · AUTO-STOP PLAYBACK (Original Logic)
    // ═════════════════════════════════════════════════════════════════════════

    const STOP_PATHS  =['/channel','/watch','/shorts','/@','/playlist','/live'];
    let   stopObs     = null;

    function stopVideoPlayback(youtubePlayer, videoElement) {
        if (!youtubePlayer || !videoElement || handledVids.has(videoElement)) return;

        handledVids.add(videoElement);

        try {
            // Immediately pause if playing
            const playerState = youtubePlayer.getPlayerState?.();
            if (playerState === PS_PLAYING || playerState === PS_BUFFERING) {
                youtubePlayer.pauseVideo();
            }
        } catch (error) {
            log('[YouTube Auto-Stop] Error pausing video:', error);
        }

        // Set up ONE-TIME event listener to catch auto-play
        let hasIntercepted = false;

        const handleAutoPlay = () => {
            if (hasIntercepted) return;

            try {
                const state = youtubePlayer.getPlayerState?.();
                if (state === PS_PLAYING || state === PS_BUFFERING) {
                    hasIntercepted = true;
                    youtubePlayer.pauseVideo();

                    videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                    videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
                }
            } catch (error) {
                log('[YouTube Auto-Stop] Error in event handler:', error);
            }
        };

        videoElement.addEventListener('play', handleAutoPlay, { capture: true });
        videoElement.addEventListener('playing', handleAutoPlay, { capture: true });

        // Fallback: Remove listeners after short delay to allow manual play
        setTimeout(() => {
            if (!hasIntercepted) {
                videoElement.removeEventListener('play', handleAutoPlay, { capture: true });
                videoElement.removeEventListener('playing', handleAutoPlay, { capture: true });
            }
        }, 2000);
    }

    function checkForPlayer() {
        const playerElement = document.querySelector('ytd-player');
        const videoElement = document.querySelector('.html5-main-video');

        // BUGFIX: "|| document.getElementById('movie_player')" entfernt.
        // Das Original wartet zwingend auf die Player-API am Element, was verhindert,
        // dass "Geister-Player" vom vorherigen Video zu früh getriggert werden!
        const youtubePlayer = playerElement?.player_;

        if (youtubePlayer && videoElement && youtubePlayer.getPlayerState) {
            stopVideoPlayback(youtubePlayer, videoElement);
            initAutoHD(youtubePlayer, videoElement); // Koppelt hier direkt das API-gesteuerte Auto-HD ein
            cleanupAutoStop(); // Stop observer after successful detection
            return true;
        }
        return false;
    }

    function initAutoStop() {
        if (!STOP_PATHS.some(p => location.pathname.startsWith(p))) {
            cleanupAutoStop(); // BUGFIX: Sauberer Abbruch wie im Original
            return;
        }

        // Try immediate check first
        if (checkForPlayer()) return;

        if (!stopObs) {
            stopObs = new MutationObserver(() => checkForPlayer());
        }
        stopObs.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(checkForPlayer, 100);
    }

    function cleanupAutoStop() {
        if (stopObs) { stopObs.disconnect(); stopObs = null; }
    }


    // ═════════════════════════════════════════════════════════════════════════
    // BOOTSTRAP
    // ═════════════════════════════════════════════════════════════════════════

    patchQuality();

    window.addEventListener('yt-navigate-finish', () => {
        resetVideoTrackers(); // Zwingend für SPAs, damit Auto-Stop und HD bei Folgevideos greifen
        patchQuality();

        cleanupSpeed();
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            initSpeed();
        }

        cleanupAutoStop();
        initAutoStop();
    });


    function boot() {
        if (location.pathname.startsWith('/watch') || location.pathname.startsWith('/shorts')) {
            initSpeed();
        }
        initAutoStop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
```

---


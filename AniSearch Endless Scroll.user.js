// ==UserScript==
// @name         AniSearch Endless Scroll
// @namespace    https://anisearch.de/
// @version      3.1.0
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
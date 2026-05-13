'use strict';

/**
 * UI module for Manga Panel Downloader.
 * Shadow DOM-based sidebar with manga-inspired dark theme.
 * CSP-resilient: adoptedStyleSheets → GM_addElement → plain <style> fallback.
 * @module _ui
 */

/* --- Constants --- */

const SIDEBAR_WIDTH = 320;

/* --- Shared Styles --- */

const CONTENT_CSS = [
  '#mpd-controls { padding:12px 0; border-bottom:1px solid rgba(99,102,241,0.15); display:flex; flex-direction:column; gap:9px; }',
  '.mpd-btn-row { display:flex; gap:8px; }',
  '.mpd-btn-row button { flex:1; }',
  '.mpd-btn { padding:7px 12px; border:none; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s ease; }',
  '.mpd-btn:active { transform:scale(0.96); }',
  '.mpd-primary { background:#2f9e44; color:#fff; box-shadow:0 1px 4px rgba(47,158,68,0.25); }',
  '.mpd-primary:hover:not(:disabled) { background:#237032; box-shadow:0 2px 8px rgba(47,158,68,0.35); }',
  '.mpd-danger { background:#c92a2a; color:#fff; box-shadow:0 1px 4px rgba(201,42,42,0.25); }',
  '.mpd-danger:hover:not(:disabled) { background:#a61e1e; }',
  '.mpd-secondary { background:rgba(255,255,255,0.08); color:#c1c2c5; }',
  '.mpd-secondary:hover:not(:disabled) { background:rgba(255,255,255,0.14); }',
  '.mpd-btn:disabled { background:#333; color:#555; cursor:not-allowed; box-shadow:none; }',
  '#mpd-progress { height:3px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; display:none; }',
  '#mpd-progress-bar { height:100%; background:#2f9e44; width:0%; transition:width 0.25s cubic-bezier(0.4,0,0.2,1); }',
  '#mpd-status { font-size:12px; color:rgba(255,255,255,0.45); min-height:16px; }',
  '.mpd-thumb { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04); }',
  '.mpd-thumb img { width:48px; height:48px; object-fit:cover; border-radius:4px; flex-shrink:0; background:rgba(255,255,255,0.04); }',
  '.mpd-thumb-info { flex:1; min-width:0; }',
  '.mpd-thumb-name { font-size:11px; color:rgba(255,255,255,0.45); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
  '.mpd-thumb-size { font-size:11px; color:rgba(255,255,255,0.2); }',
  '.mpd-thumb input[type=checkbox] { flex-shrink:0; width:15px; height:15px; cursor:pointer; accent-color:#2f9e44; }',
  '#mpd-footer { padding:8px 0; border-top:1px solid rgba(255,255,255,0.04); font-size:11px; color:rgba(255,255,255,0.2); }',
  '.mpd-toggle-row { display:flex; align-items:center; gap:8px; font-size:12px; color:rgba(255,255,255,0.45); cursor:pointer; user-select:none; }',
  '.mpd-toggle-row input { cursor:pointer; accent-color:#2f9e44; }'
].join('');

/* --- Helpers --- */

/**
 * Applies CSS to a ShadowRoot with CSP-resilient fallback chain.
 * Order: GM_addElement (CSP bypass) → adoptedStyleSheets (performant) → plain <style>.
 * GM_addElement is tried first because CSP blocking adoptedStyleSheets
 * is the most common failure mode on manga sites.
 * @param {ShadowRoot} root - The shadow root to style
 * @param {string} cssText - CSS text content
 */
function applyStyles(root, cssText) {
  // 1) GM_addElement bypasses page CSP entirely
  if (typeof GM_addElement !== 'undefined') {
    try {
      GM_addElement(root, 'style', { textContent: cssText });
      return;
    } catch (_) { /* fall through */ }
  }
  // 2) adoptedStyleSheets (shared, no DOM elements created)
  if (root.adoptedStyleSheets !== undefined) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      root.adoptedStyleSheets = [sheet];
      return;
    } catch (_) { /* fall through */ }
  }
  // 3) Last resort: plain style element
  try {
    const style = document.createElement('style');
    style.textContent = cssText;
    root.appendChild(style);
  } catch (_) { /* silently ignore — UI will be unstyled but functional */ }
}

/* --- Shadow DOM Container --- */

/**
 * Creates a closed Shadow DOM container appended to document.body.
 * Falls back to appendChild on documentElement if body is not ready.
 * @param {{ id?: string, tag?: string, styles?: string, className?: string }} [opts]
 * @returns {{ host: HTMLElement, root: ShadowRoot }}
 */
export function createShadowContainer(opts = {}) {
  const host = document.createElement(opts.tag || 'div');
  if (opts.id) host.id = opts.id;
  if (opts.className) host.className = opts.className;
  const root = host.attachShadow({ mode: 'closed' });
  if (opts.styles) {
    applyStyles(root, opts.styles);
  }
  try {
    document.body.appendChild(host);
  } catch (_) {
    document.documentElement.appendChild(host);
  }
  return { host, root };
}

/* --- Sidebar Framework --- */

/**
 * Creates a fixed right-side sidebar with push-page effect, toggle tab, and draggable header.
 *
 * @param {{
 *   width?: number,
 *   title?: string,
 *   accentColor?: string,
 *   cssOverrides?: string,
 *   onOpen?: () => void,
 *   onClose?: () => void
 * }} opts
 * @returns {{
 *   host: HTMLElement, root: ShadowRoot, bodyEl: HTMLElement, tabEl: HTMLElement,
 *   open: () => void, close: () => void, toggle: () => void,
 *   isOpen: () => boolean, setTitle: (t: string) => void
 * }}
 */
export function createSidebar(opts = {}) {
  const width = opts.width || 340;
  const accent = opts.accentColor || '#2196F3';
  const title = opts.title || '';
  let isOpen = false;

  const sidebarCSS = [
    ':host { position:fixed; top:0; right:0; width:' + width + 'px; height:100vh; z-index:2147483645;',
    'background:linear-gradient(180deg,#0d0d1a 0%,#111827 55%,#0a1628 100%);',
    'color:#e2e8f0; font:13px/1.5 system-ui,sans-serif;',
    'transform:translateX(' + width + 'px); transition:transform 0.35s cubic-bezier(0.4,0,0.2,1);',
    'display:flex; flex-direction:column; border-left:1px solid rgba(99,102,241,0.2); }',
    ':host(.open) { transform:translateX(0); }',
    '.header { display:flex; align-items:center; padding:11px 14px;',
    'background:linear-gradient(90deg,rgba(99,102,241,0.08) 0%,transparent 100%);',
    'border-bottom:1px solid rgba(99,102,241,0.15); cursor:move; user-select:none; flex-shrink:0; }',
    '.header h2 { margin:0; font-size:14px; font-weight:600; color:' + accent + '; flex:1;',
    'letter-spacing:0.02em; }',
    '.header button { background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer;',
    'font-size:18px; padding:0 4px; line-height:1; transition:transform 0.2s ease,color 0.2s ease; }',
    '.header button:hover { color:' + accent + '; transform:rotate(90deg); }',
    '.body { flex:1; overflow-y:auto; padding:12px 14px; }',
    '.body::-webkit-scrollbar { width:5px; }',
    '.body::-webkit-scrollbar-track { background:transparent; }',
    '.body::-webkit-scrollbar-thumb { background:rgba(99,102,241,0.3); border-radius:3px; }',
    (opts.cssOverrides || '')
  ].join('');

  const allCSS = sidebarCSS + '\n' + CONTENT_CSS;
  const container = createShadowContainer({ styles: allCSS });
  const root = container.root;

  // Header
  const header = document.createElement('div');
  header.className = 'header';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Sidebar schließen');
  header.appendChild(h2);
  header.appendChild(closeBtn);
  root.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'body';
  root.appendChild(body);

  // Toggle tab (separate Shadow DOM element, partially visible when closed)
  const tab = document.createElement('div');
  const tabRoot = tab.attachShadow({ mode: 'closed' });
  const tabCSS = [
    ':host { position:fixed; top:50%; z-index:2147483644; background:' + accent + '; color:#fff;',
    'padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;',
    'writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);',
    'right:0; transform:translateY(-50%) translateX(calc(100% - 10px));',
    'transition:right 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1); }',
    ':host(:hover) { filter:brightness(1.15); }',
    ':host(.open) { right:' + (width + 8) + 'px; transform:translateY(-50%) translateX(0); }'
  ].join('');
  applyStyles(tabRoot, tabCSS);
  const tabSpan = document.createElement('span');
  tabSpan.textContent = title;
  tabRoot.appendChild(tabSpan);
  try {
    document.body.appendChild(tab);
  } catch (_) {
    document.documentElement.appendChild(tab);
  }

  /* --- Public API --- */

  function open() {
    if (isOpen) return;
    isOpen = true;
    container.host.classList.add('open');
    tab.classList.add('open');
    document.documentElement.style.marginRight = width + 'px';
    if (opts.onOpen) opts.onOpen();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    container.host.classList.remove('open');
    tab.classList.remove('open');
    document.documentElement.style.marginRight = '';
    if (opts.onClose) opts.onClose();
  }

  function toggle() { if (isOpen) close(); else open(); }

  /* --- Header Dragging --- */

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startRight = 0;
  let startTop = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startRight = parseInt(container.host.style.right || '0', 10);
    startTop = parseInt(container.host.style.top || '0', 10);
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    container.host.style.right = (startRight - (e.clientX - startX)) + 'px';
    container.host.style.top = (startTop + (e.clientY - startY)) + 'px';
  });

  document.addEventListener('mouseup', () => { dragging = false; });

  closeBtn.addEventListener('click', close);
  tab.addEventListener('click', toggle);

  return {
    host: container.host,
    root,
    bodyEl: body,
    tabEl: tab,
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    setTitle: (t) => { h2.textContent = t; tabSpan.textContent = t; }
  };
}

/* --- Panel UI --- */

/**
 * Creates the sidebar UI with scan controls, manga-mode toggle, and
 * result/status areas. All element queries must use root (Shadow DOM).
 * @param {boolean} mangaMode - Initial manga mode checkbox state
 * @returns {{
 *   sidebar: ReturnType<typeof createSidebar>,
 *   root: ShadowRoot,
 *   scanBtn: HTMLButtonElement,
 *   dlBtn: HTMLButtonElement,
 *   mangaCheck: HTMLInputElement,
 *   statusEl: HTMLElement,
 *   progressEl: HTMLElement,
 *   progressBar: HTMLElement,
 *   resultsEl: HTMLElement,
 *   footerEl: HTMLElement
 * }}
 */
export function buildUI(mangaMode) {
  const sidebar = createSidebar({
    width: SIDEBAR_WIDTH,
    title: 'Manga Downloader',
    accentColor: '#2f9e44',
  });

  const root = sidebar.root;
  const body = sidebar.bodyEl;

  // Controls container
  const controls = document.createElement('div');
  controls.id = 'mpd-controls';

  // Button row
  const btnRow = document.createElement('div');
  btnRow.className = 'mpd-btn-row';

  const scanBtn = document.createElement('button');
  scanBtn.id = 'mpd-scan';
  scanBtn.className = 'mpd-btn mpd-primary';
  scanBtn.textContent = 'Scan';
  scanBtn.setAttribute('role', 'button');
  scanBtn.setAttribute('aria-label', 'Bilder auf der aktuellen Seite scannen');
  scanBtn.tabIndex = 0;

  const dlBtn = document.createElement('button');
  dlBtn.id = 'mpd-dl';
  dlBtn.className = 'mpd-btn mpd-secondary';
  dlBtn.textContent = 'ZIP';
  dlBtn.disabled = true;
  dlBtn.setAttribute('role', 'button');
  dlBtn.setAttribute('aria-label', 'Ausgewählte Bilder als ZIP herunterladen');
  dlBtn.tabIndex = 0;

  btnRow.appendChild(scanBtn);
  btnRow.appendChild(dlBtn);
  controls.appendChild(btnRow);

  // Manga mode toggle
  const mangaLabel = document.createElement('label');
  mangaLabel.className = 'mpd-toggle-row';

  const mangaCheck = document.createElement('input');
  mangaCheck.type = 'checkbox';
  mangaCheck.id = 'mpd-manga-mode';
  mangaCheck.checked = !!mangaMode;
  mangaCheck.setAttribute('aria-checked', mangaMode ? 'true' : 'false');

  // Persist manga mode changes via GM storage
  mangaCheck.addEventListener('change', () => {
    const val = mangaCheck.checked;
    mangaCheck.setAttribute('aria-checked', val ? 'true' : 'false');
    if (typeof GM !== 'undefined' && GM.setValue) {
      GM.setValue('mpd-manga-mode', val).catch(() => {});
    }
  });

  const mangaLabelSpan = document.createElement('span');
  mangaLabelSpan.textContent = 'Manga-Modus (auto weiterklicken)';

  mangaLabel.appendChild(mangaCheck);
  mangaLabel.appendChild(mangaLabelSpan);
  controls.appendChild(mangaLabel);

  // Progress bar
  const progressEl = document.createElement('div');
  progressEl.id = 'mpd-progress';
  const progressBar = document.createElement('div');
  progressBar.id = 'mpd-progress-bar';
  progressEl.appendChild(progressBar);
  controls.appendChild(progressEl);

  // Status text
  const statusEl = document.createElement('div');
  statusEl.id = 'mpd-status';
  statusEl.textContent = 'Ready.';
  controls.appendChild(statusEl);

  body.appendChild(controls);

  // Results container (populated by addSegmentsToUI)
  const resultsEl = document.createElement('div');
  resultsEl.id = 'mpd-results';
  body.appendChild(resultsEl);

  // Footer
  const footerEl = document.createElement('div');
  footerEl.id = 'mpd-footer';
  body.appendChild(footerEl);

  // Keyboard: Escape closes the sidebar
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') sidebar.close();
  });

  sidebar.open();

  return {
    sidebar,
    root,
    scanBtn,
    dlBtn,
    mangaCheck,
    statusEl,
    progressEl,
    progressBar,
    resultsEl,
    footerEl,
  };
}

/**
 * Toggles the scan button appearance between idle and scanning state.
 * @param {HTMLButtonElement | null} scanBtn - The scan button element
 * @param {boolean} scanning - Whether a scan is in progress
 */
export function setScanBtn(scanBtn, scanning) {
  if (!scanBtn) return;
  scanBtn.textContent = scanning ? 'Stop' : 'Scan';
  scanBtn.className = scanning
    ? 'mpd-btn mpd-danger'
    : 'mpd-btn mpd-primary';
  scanBtn.setAttribute(
    'aria-label',
    scanning
      ? 'Scanvorgang abbrechen'
      : 'Bilder auf der aktuellen Seite scannen'
  );
}

/**
 * Adds image segment entries to the results list.
 * Each entry shows a thumbnail, filename, dimensions, and a selection checkbox.
 * Uses safe DOM APIs (no innerHTML) — all data is user-controlled.
 * @param {Array<{filename?: string, previewUrl?: string, w?: number, h?: number}>} segments
 * @param {HTMLElement | null} resultsEl - The #mpd-results container
 */
export function addSegmentsToUI(segments, resultsEl) {
  if (!resultsEl) return;

  // Clear without innerHTML
  while (resultsEl.firstChild) {
    resultsEl.removeChild(resultsEl.firstChild);
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const div = document.createElement('div');
    div.className = 'mpd-thumb';

    // Thumbnail image — safe: src and alt via setAttribute
    const img = document.createElement('img');
    img.src = seg.previewUrl || '';
    img.alt = seg.filename || 'Segment Vorschau';
    img.loading = 'lazy';

    // Info block — safe: textContent for user data
    const info = document.createElement('div');
    info.className = 'mpd-thumb-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'mpd-thumb-name';
    nameDiv.textContent = seg.filename || '';

    const sizeDiv = document.createElement('div');
    sizeDiv.className = 'mpd-thumb-size';
    sizeDiv.textContent = (seg.w || '?') + ' × ' + (seg.h || '?') + ' px';

    info.appendChild(nameDiv);
    info.appendChild(sizeDiv);

    // Selection checkbox — safe: dataset and aria-label
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.idx = String(i);
    cb.setAttribute('aria-label', seg.filename || 'Segment ' + (i + 1));

    div.appendChild(img);
    div.appendChild(info);
    div.appendChild(cb);
    resultsEl.appendChild(div);
  }
}

/**
 * Triggers a browser download of the given blob.
 * Creates a temporary <a> element, clicks it, and cleans up.
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The download filename
 */
export function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.style.display = 'none';
  a.setAttribute('aria-hidden', 'true');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => { URL.revokeObjectURL(a.href); }, 10000);
}

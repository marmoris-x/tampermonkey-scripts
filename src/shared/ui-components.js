// src/shared/ui-components.js — Reusable UI primitives for Tampermonkey scripts
// Provides: Shadow DOM container factory, toast notifications, status bar, sidebar framework.
// All UI is isolated via closed Shadow DOM to prevent host-page CSS/JS interference.
// Consumers: Crunchyroll, Gutefrage, Manga Panel, NotebookLM, Epic Games, Copy as Markdown,
//            AniSearch, Google AI Studio, Marketplace Deal Finder
//
// Architecture:
//   createShadowContainer() — lowest-level primitive; all other components build on it
//   createToast() — auto-dismissing notification overlay at bottom-center
//   createStatusBar() — persistent bottom-right status indicator with progress bar
//   createSidebar() — fixed right panel with push-page effect, toggle tab, draggable header
//
// All components use textContent (not innerHTML) for user-provided strings to prevent XSS.
// Host-page CSS cannot penetrate closed Shadow DOM; host-page JS cannot query children.

/* ─── Shadow DOM Container ─── */

/**
 * Creates a closed Shadow DOM container appended to `document.body`.
 * @param {{ id?: string, tag?: string, styles?: string, className?: string }} [opts]
 * @returns {{ host: HTMLElement, root: ShadowRoot }}
 */
export function createShadowContainer(opts) {
  opts = opts || {};
  var host = document.createElement(opts.tag || 'div');
  if (opts.id) host.id = opts.id;
  if (opts.className) host.className = opts.className;
  var root = host.attachShadow({ mode: 'closed' });
  if (opts.styles) {
    var style = document.createElement('style');
    style.textContent = opts.styles;
    root.appendChild(style);
  }
  document.body.appendChild(host);
  return { host: host, root: root };
}

/* ─── Toast Notification ─── */

/**
 * Shows a brief auto-dismissing toast notification at bottom-center.
 * Multiple toasts stack vertically via natural DOM flow.
 * @param {string} message - Plain text (uses textContent, not innerHTML)
 * @param {{ duration?: number, type?: 'info'|'success'|'error'|'warn' }} [opts]
 * @returns {HTMLElement} The toast host element (auto-removed after duration + transition)
 */
export function createToast(message, opts) {
  opts = opts || {};
  var duration = opts.duration || 3000;
  var type = opts.type || 'info';
  var colors = { info: '#2196F3', success: '#4CAF50', error: '#F44336', warn: '#FF9800' };
  var toast = document.createElement('div');
  var root = toast.attachShadow({ mode: 'closed' });
  var style = document.createElement('style');
  style.textContent = [
    ':host { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:2147483647;',
    'background:' + (colors[type] || colors.info) + '; color:#fff; padding:10px 20px; border-radius:6px;',
    'font:13px/1.4 system-ui,sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.3);',
    'opacity:0; transition:opacity 0.3s ease; pointer-events:none; max-width:80vw; }',
    ':host(.show) { opacity:1; }'
  ].join('');
  var span = document.createElement('span');
  span.textContent = message;
  root.appendChild(style);
  root.appendChild(span);
  document.body.appendChild(toast);
  requestAnimationFrame(function () { toast.classList.add('show'); });
  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, duration);
  return toast;
}

/* ─── Status Bar ─── */

/**
 * Creates a persistent status bar at the bottom-right of the viewport.
 * Includes a text label and an optional progress bar.
 * @param {{ accentColor?: string }} [opts]
 * @returns {{ host: HTMLElement, root: ShadowRoot, setText: Function, setProgress: Function, remove: Function }}
 */
export function createStatusBar(opts) {
  opts = opts || {};
  var accent = opts.accentColor || '#2196F3';
  var container = createShadowContainer({
    styles: [
      ':host { position:fixed; bottom:0; right:0; z-index:2147483646;',
      'background:#1e1e1e; color:#e0e0e0; font:12px system-ui,sans-serif;',
      'padding:8px 14px; border-radius:8px 0 0 0; min-width:200px; max-width:360px;',
      'border-top:3px solid ' + accent + '; border-left:3px solid ' + accent + '; }',
      '.text { margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
      '.bar { height:4px; background:#333; border-radius:2px; overflow:hidden; }',
      '.fill { height:100%; width:0%; background:' + accent + '; transition:width 0.3s ease; }'
    ].join('')
  });
  var textEl = document.createElement('div');
  textEl.className = 'text';
  var fillEl = document.createElement('div');
  fillEl.className = 'fill';
  var barEl = document.createElement('div');
  barEl.className = 'bar';
  barEl.appendChild(fillEl);
  container.root.appendChild(textEl);
  container.root.appendChild(barEl);
  return {
    host: container.host,
    root: container.root,
    setText: function (msg) { textEl.textContent = msg; },
    setProgress: function (pct) { fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%'; },
    remove: function () { if (container.host.parentNode) container.host.parentNode.removeChild(container.host); }
  };
}

/* ─── Sidebar Framework ─── */

/**
 * Creates a fixed right-side sidebar with push-page effect, toggle tab, and draggable header.
 *
 * The push-page effect is achieved by setting `document.documentElement.style.marginRight`
 * to the sidebar width when open. CSS for the sidebar itself is defined internally.
 * Override styles via the `cssOverrides` parameter string.
 *
 * Toggle tab: a vertical-text tab that sits just to the left of the sidebar. Clicking it
 * toggles the sidebar open/closed. It uses its own closed Shadow DOM for isolation.
 *
 * Header dragging: mousedown on the header (excluding the close button) initiates drag mode.
 * mousemove/mouseup on `document` update position. Position is set via inline `style.right`
 * and `style.top` on the host element.
 *
 * @param {{
 *   width?: number,
 *   title?: string,
 *   accentColor?: string,
 *   cssOverrides?: string,
 *   onOpen?: Function,
 *   onClose?: Function
 * }} opts
 * @returns {{
 *   host: HTMLElement, root: ShadowRoot, bodyEl: HTMLElement, tabEl: HTMLElement,
 *   open: Function, close: Function, toggle: Function, isOpen: Function, setTitle: Function
 * }}
 */
export function createSidebar(opts) {
  opts = opts || {};
  var width = opts.width || 340;
  var accent = opts.accentColor || '#2196F3';
  var title = opts.title || '';
  var isOpen = false;

  var baseCSS = [
    ':host { position:fixed; top:0; right:0; width:' + width + 'px; height:100vh; z-index:2147483645;',
    'background:#1a1a2e; color:#e0e0e0; font:13px/1.5 system-ui,sans-serif;',
    'transform:translateX(' + width + 'px); transition:transform 0.3s ease;',
    'display:flex; flex-direction:column; }',
    ':host(.open) { transform:translateX(0); }',
    '.header { display:flex; align-items:center; padding:10px 14px; background:#16213e;',
    'border-bottom:1px solid #0f3460; cursor:move; user-select:none; flex-shrink:0; }',
    '.header h2 { margin:0; font-size:14px; font-weight:600; color:' + accent + '; flex:1; }',
    '.header button { background:none; border:none; color:#e0e0e0; cursor:pointer; font-size:18px;',
    'padding:0 4px; line-height:1; }',
    '.header button:hover { color:' + accent + '; }',
    '.body { flex:1; overflow-y:auto; padding:12px 14px; }',
    '.body::-webkit-scrollbar { width:6px; }',
    '.body::-webkit-scrollbar-track { background:transparent; }',
    '.body::-webkit-scrollbar-thumb { background:#0f3460; border-radius:3px; }',
    (opts.cssOverrides || '')
  ].join('');

  var container = createShadowContainer({ styles: baseCSS });
  var root = container.root;

  // Header
  var header = document.createElement('div');
  header.className = 'header';
  var h2 = document.createElement('h2');
  h2.textContent = title;
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close sidebar');
  header.appendChild(h2);
  header.appendChild(closeBtn);
  root.appendChild(header);

  // Body
  var body = document.createElement('div');
  body.className = 'body';
  root.appendChild(body);

  // Toggle tab (separate element with its own Shadow DOM)
  var tab = document.createElement('div');
  var tabRoot = tab.attachShadow({ mode: 'closed' });
  var tabStyle = document.createElement('style');
  tabStyle.textContent = [
    ':host { position:fixed; top:50%; z-index:2147483644; background:' + accent + '; color:#fff;',
    'padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;',
    'writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);',
    'right:0; transform:translateY(-50%) translateX(100%);',
    'transition:right 0.3s ease, transform 0.3s ease; }',
    ':host(:hover) { filter:brightness(1.1); }',
    ':host(.open) { right:' + (width + 8) + 'px; transform:translateY(-50%) translateX(0); }'
  ].join('');
  var tabSpan = document.createElement('span');
  tabSpan.textContent = title;
  tabRoot.appendChild(tabStyle);
  tabRoot.appendChild(tabSpan);
  document.body.appendChild(tab);

  /* ─── Public API ─── */
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

  /* ─── Header Dragging ─── */
  var dragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
  header.addEventListener('mousedown', function (e) {
    if (e.target === closeBtn) return;
    dragging = true; startX = e.clientX; startY = e.clientY;
    startRight = parseInt(container.host.style.right || 0, 10);
    startTop = parseInt(container.host.style.top || 0, 10);
    e.preventDefault();
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    container.host.style.right = (startRight - (e.clientX - startX)) + 'px';
    container.host.style.top = (startTop + (e.clientY - startY)) + 'px';
  });
  document.addEventListener('mouseup', function () { dragging = false; });

  closeBtn.addEventListener('click', close);
  tab.addEventListener('click', toggle);

  return {
    host: container.host, root: root, bodyEl: body, tabEl: tab,
    open: open, close: close, toggle: toggle,
    isOpen: function () { return isOpen; },
    setTitle: function (t) { h2.textContent = t; tabSpan.textContent = t; }
  };
}

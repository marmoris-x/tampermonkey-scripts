// Local copy of createShadowContainer + createSidebar from src/shared/ui-components.js
// Side-effect-free extraction for Manga Panel Downloader. No globalThis.TM registration.

/* --- Shadow DOM Container --- */

/**
 * Creates a closed Shadow DOM container appended to `document.body`.
 * @param {{ id?: string, tag?: string, styles?: string, className?: string }} [opts]
 * @returns {{ host: HTMLElement, root: ShadowRoot }}
 */
export function createShadowContainer(opts) {
  opts = opts || {};
  const host = document.createElement(opts.tag || 'div');
  if (opts.id) host.id = opts.id;
  if (opts.className) host.className = opts.className;
  const root = host.attachShadow({ mode: 'closed' });
  if (opts.styles) {
    const style = document.createElement('style');
    style.textContent = opts.styles;
    root.appendChild(style);
  }
  document.body.appendChild(host);
  return { host: host, root: root };
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
  const width = opts.width || 340;
  const accent = opts.accentColor || '#2196F3';
  const title = opts.title || '';
  let isOpen = false;

  const baseCSS = [
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

  const container = createShadowContainer({ styles: baseCSS });
  const root = container.root;

  // Header
  const header = document.createElement('div');
  header.className = 'header';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close sidebar');
  header.appendChild(h2);
  header.appendChild(closeBtn);
  root.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'body';
  root.appendChild(body);

  // Toggle tab (separate element with its own Shadow DOM)
  const tab = document.createElement('div');
  const tabRoot = tab.attachShadow({ mode: 'closed' });
  const tabStyle = document.createElement('style');
  tabStyle.textContent = [
    ':host { position:fixed; top:50%; z-index:2147483644; background:' + accent + '; color:#fff;',
    'padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;',
    'writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);',
    'right:0; transform:translateY(-50%) translateX(100%);',
    'transition:right 0.3s ease, transform 0.3s ease; }',
    ':host(:hover) { filter:brightness(1.1); }',
    ':host(.open) { right:' + (width + 8) + 'px; transform:translateY(-50%) translateX(0); }'
  ].join('');
  const tabSpan = document.createElement('span');
  tabSpan.textContent = title;
  tabRoot.appendChild(tabStyle);
  tabRoot.appendChild(tabSpan);
  document.body.appendChild(tab);

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
  let dragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
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

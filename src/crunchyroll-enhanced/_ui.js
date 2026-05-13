// src/crunchyroll-enhanced/_ui.js — Shadow DOM components (createShadowContainer, createSidebar)
// Provides: createShadowContainer, createSidebar

'use strict';

/**
 * Creates a shadow DOM container and appends it to document.body.
 * @param {object} [opts={}] - Options
 * @param {string} [opts.tag='div'] - Host element tag name
 * @param {string} [opts.id] - Host element ID
 * @param {string} [opts.className] - Host element class name
 * @param {string} [opts.styles] - CSS to inject into the shadow root
 * @returns {{ host: HTMLElement, root: ShadowRoot }}
 */
export function createShadowContainer(opts = {}) {
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

  // Guard: re-insert if React removes the host element
  const _reinsert = new MutationObserver(() => {
    if (!host.isConnected && document.body) {
      document.body.appendChild(host);
    }
  });
  _reinsert.observe(document.body, { childList: true });
  // Disconnect after 60s (generous initial render window)
  setTimeout(() => _reinsert.disconnect(), 60000);

  return { host, root };
}

/**
 * Creates a slide-in sidebar with shadow DOM, toggle tab, and drag support.
 * @param {object} [opts={}] - Options
 * @param {number} [opts.width=340] - Sidebar width in px
 * @param {string} [opts.accentColor='#F47521'] - Accent color
 * @param {string} [opts.title=''] - Sidebar title displayed in header and tab
 * @param {Function} [opts.onOpen] - Called after sidebar opens
 * @param {Function} [opts.onClose] - Called after sidebar closes
 * @param {string} [opts.cssOverrides=''] - Additional CSS for the shadow root
 * @returns {{ host: HTMLElement, root: ShadowRoot, bodyEl: HTMLElement, tabEl: HTMLElement, open: Function, close: Function, toggle: Function, isOpen: Function, setTitle: Function }}
 */
export function createSidebar(opts = {}) {
  const width = opts.width ?? 340;
  const accent = opts.accentColor ?? '#F47521';
  const title = opts.title ?? '';
  let isOpen = false;

  const baseCSS = [
    ':host {',
    'all: initial;',
    'position: fixed; top: 0; right: 0; width: ' + width + 'px; height: 100vh;',
    'z-index: 2147483645;',
    'font: 13px/1.5 system-ui, sans-serif;',
    'transform: translateX(' + width + 'px);',
    'transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);',
    'display: flex; flex-direction: column;',
    '}',
    ':host(.open) { transform: translateX(0); }',
    '.header {',
    'display: flex; align-items: center; padding: 10px 14px;',
    'cursor: move; user-select: none; flex-shrink: 0;',
    '}',
    '.header h2 { margin: 0; font-size: 14px; font-weight: 600; color: ' + accent + '; flex: 1; }',
    '.header button {',
    'background: none; border: none; color: #e0e0e0; cursor: pointer;',
    'font-size: 18px; padding: 0 4px; line-height: 1;',
    '}',
    '.header button:hover { color: ' + accent + '; }',
    '.body { flex: 1; overflow-y: auto; }',
    (opts.cssOverrides || '')
  ].join('\n');

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
  header.append(h2, closeBtn);
  root.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'body';
  root.appendChild(body);

  // Toggle tab (separate element with its own shadow DOM)
  const tab = document.createElement('div');
  const tabRoot = tab.attachShadow({ mode: 'closed' });
  const tabStyle = document.createElement('style');
  tabStyle.textContent = [
    ':host {',
    'all: initial;',
    'position: fixed; top: 50%; z-index: 2147483644;',
    'background: ' + accent + '; color: #fff;',
    'padding: 10px 6px; border-radius: 6px 0 0 6px; cursor: pointer;',
    'font: 12px system-ui, sans-serif;',
    'writing-mode: vertical-rl; text-orientation: mixed;',
    'box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.3);',
    'right: 0; transform: translateY(-50%);',
    'transition: right 0.32s cubic-bezier(0.4, 0, 0.2, 1);',
    'pointer-events: auto;',
    '}',
    ':host(:hover) { filter: brightness(1.15); }',
    ':host(.open) { right: ' + (width + 8) + 'px; }'
  ].join('\n');
  const tabSpan = document.createElement('span');
  tabSpan.textContent = title;
  tabRoot.append(tabStyle, tabSpan);
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

  function toggleFn() { if (isOpen) close(); else open(); }

  /* ─── Header Dragging ─── */
  let dragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
  header.addEventListener('mousedown', function (e) {
    if (e.target === closeBtn) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const cs = getComputedStyle(container.host);
    startRight = parseInt(cs.right, 10) || 0;
    startTop = parseInt(cs.top, 10) || 0;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    container.host.style.right = (startRight - (e.clientX - startX)) + 'px';
    container.host.style.top = (startTop + (e.clientY - startY)) + 'px';
  });
  document.addEventListener('mouseup', function () { dragging = false; });

  closeBtn.addEventListener('click', close);
  tab.addEventListener('click', toggleFn);

  return {
    host: container.host,
    root: root,
    bodyEl: body,
    tabEl: tab,
    open: open,
    close: close,
    toggle: toggleFn,
    isOpen: function () { return isOpen; },
    setTitle: function (t) { h2.textContent = t; tabSpan.textContent = t; }
  };
}

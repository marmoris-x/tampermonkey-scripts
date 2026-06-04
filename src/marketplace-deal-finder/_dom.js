// src/marketplace-deal-finder/_dom.js — DOM utilities
'use strict';

/**
 * Waits for a DOM element matching a CSS selector to appear in the DOM.
 * Uses MutationObserver for efficient detection.
 * @param {string} selector - CSS selector to match
 * @param {number} [timeout=10000] - Timeout in milliseconds (0 = no timeout)
 * @param {Element} [root=document.body] - Root element to observe
 * @returns {Promise<Element>} Resolves when element is found
 */
export function waitForElement(selector, timeout, root) {
  timeout = timeout || 10000;
  root = root || document.body;
  return new Promise(function (resolve, reject) {
    const existing = root.querySelector(selector);
    if (existing) return resolve(existing);
    let timer;
    const observer = new MutationObserver(function () {
      const found = root.querySelector(selector);
      if (found) {
        cleanup();
        resolve(found);
      }
    });
    function cleanup() {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    }
    observer.observe(root, { childList: true, subtree: true });
    if (timeout > 0) {
      timer = setTimeout(function () {
        cleanup();
        reject(new Error('waitForElement timeout: ' + selector));
      }, timeout);
    }
  });
}

/**
 * Creates a Shadow DOM container and appends it to document.body.
 * @param {Object} [opts] - Options
 * @param {string} [opts.tag='div'] - HTML tag for the host element
 * @param {string} [opts.id] - ID for the host element
 * @param {string} [opts.className] - CSS class for the host element
 * @param {string} [opts.styles] - CSS text to inject into the shadow root
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
  // Content container that can be safely replaced via innerHTML
  // without destroying the <style> element holding :host CSS rules.
  const content = document.createElement('div');
  content.id = 'content';
  root.appendChild(content);
  document.body.appendChild(host);
  return { host, root, content };
}

/**
 * Creates a toast notification element with Shadow DOM isolation.
 * Automatically shows, then removes after the specified duration.
 * @param {string} message - Notification text
 * @param {Object} [opts] - Options
 * @param {number} [opts.duration=3000] - Display duration in ms
 * @param {string} [opts.type='info'] - Toast type: 'info'|'success'|'error'|'warn'
 * @returns {HTMLElement} The toast host element
 */
export function createToast(message, opts) {
  opts = opts || {};
  const duration = opts.duration || 3000;
  const type = opts.type || 'info';
  const colors = { info: '#2196F3', success: '#4CAF50', error: '#F44336', warn: '#FF9800' };
  const toast = document.createElement('div');
  const root = toast.attachShadow({ mode: 'closed' });
  const toastStyle = document.createElement('style');
  toastStyle.textContent = [
    ':host { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:2147483647;',
    'background:' + (colors[type] || colors.info) + '; color:#fff; padding:10px 20px; border-radius:6px;',
    'font:13px/1.4 system-ui,sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.3);',
    'opacity:0; transition:opacity 0.3s ease; pointer-events:none; max-width:80vw; }',
    ':host(.show) { opacity:1; }'
  ].join('');
  root.appendChild(toastStyle);
  const span = document.createElement('span');
  span.textContent = message;
  root.appendChild(span);
  document.body.appendChild(toast);
  requestAnimationFrame(function () { toast.classList.add('show'); });
  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, duration);
  return toast;
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {*} str - Value to escape
 * @returns {string} Escaped string
 */
export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

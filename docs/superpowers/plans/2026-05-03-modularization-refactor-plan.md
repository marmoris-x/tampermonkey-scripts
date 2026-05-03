# Tampermonkey Scripts Modularization Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated code from 17 standalone `.user.js` files (~14,112 lines) into 8 shared `src/shared/` modules, enforce 2026 Gold Standards, translate German internals to English, reduce total line count by 25-33%.

**Architecture:** All shared modules attach to `globalThis.TM` namespace. Each is a standalone `.js` file hosted on GitHub Raw, imported via `@require` directive. Scripts remain standalone-installable with no build toolchain. Shared modules use IIFE + `'use strict'`, pure functions where possible, and expose exactly one namespace property.

**Tech Stack:** Vanilla JavaScript (ES6+), Tampermonkey 5.3+ APIs, `@require` for module loading, `@sandbox JavaScript`, `@inject-into content`. No TypeScript, no bundler, no package.json.

---

## File Structure

```
src/shared/               ← ALL NEW FILES
├── dom-utils.js           # waitForElement, debounce, throttle, observeMutations
├── ui-components.js       # createSidebar, createToast, createStatusBar, createShadowContainer
├── storage-utils.js       # loadSetting, saveSetting, loadSettings, saveSettings
├── network-utils.js       # fetchPage, fetchJSON, fetchBlob
├── logging-utils.js       # createLogger
├── zip-builder.js         # buildStoreZip
├── markdown-converter.js  # htmlToMarkdown
└── i18n-utils.js          # normalizeText, matchTerm

*.user.js                  ← ALL MODIFIED (add @require, replace duplicated code, enforce standards)
```

---

### Task 1: Create `src/shared/logging-utils.js`

**Files:**
- Create: `src/shared/logging-utils.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/logging-utils.js — Prefix-based logger factory for Tampermonkey scripts
// Provides console.log/warn/error/info/debug with automatic [Prefix] formatting.
// Consumers: ALL 17 scripts (direct console.log callers replaced with logger instance).
(function () {
  'use strict';

  /**
   * Creates a prefixed logger instance. All methods prepend `[prefix]` to messages.
   * @param {string} prefix - Script identifier (e.g. "Marketplace Deal Finder")
   * @param {boolean} [debugMode=false] - When false, debug() calls are no-ops
   * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
   */
  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    var tag = '[' + prefix + ']';
    return {
      log:   function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.log.apply(console, args); },
      warn:  function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.warn.apply(console, args); },
      error: function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.error.apply(console, args); },
      info:  function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.info.apply(console, args); },
      debug: function () { if (debugMode) { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.debug.apply(console, args); } }
    };
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.createLogger = createLogger;
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/logging-utils.js
git commit -m "feat: add shared logging utility module"
```

---

### Task 2: Create `src/shared/dom-utils.js`

**Files:**
- Create: `src/shared/dom-utils.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/dom-utils.js — DOM observation and timing utilities for Tampermonkey scripts
// Provides Promise-based element waiting, debounce/throttle, and MutationObserver helpers.
// Consumers: 15 of 17 scripts (all except Picture-in-Picture, Copy as Markdown)
(function () {
  'use strict';

  /**
   * Returns a promise that resolves when an element matching `selector` appears in the DOM.
   * Uses MutationObserver internally; disconnects immediately upon match.
   * @param {string} selector - CSS selector string
   * @param {number} [timeout=10000] - Max wait time in ms (0 = no timeout)
   * @param {Element} [root=document.body] - Root element to observe
   * @returns {Promise<Element>} Resolves with the found element, rejects on timeout
   */
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 10000;
    root = root || document.body;
    return new Promise(function (resolve, reject) {
      var existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      var timer;
      var observer = new MutationObserver(function (mutations, obs) {
        for (var m = 0; m < mutations.length; m++) {
          var nodes = mutations[m].addedNodes;
          for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
            if (nodes[i].matches && nodes[i].matches(selector)) { cleanup(); return resolve(nodes[i]); }
            var child = nodes[i].querySelector && nodes[i].querySelector(selector);
            if (child) { cleanup(); return resolve(child); }
          }
        }
      });
      function cleanup() {
        observer.disconnect();
        if (timer) clearTimeout(timer);
      }
      observer.observe(root, { childList: true, subtree: true });
      if (timeout > 0) {
        timer = setTimeout(function () { cleanup(); reject(new Error('waitForElement timeout: ' + selector)); }, timeout);
      }
    });
  }

  /**
   * Creates a debounced version of `fn`. The returned function delays invocation until
   * `ms` milliseconds have elapsed since the last call.
   * @param {Function} fn - Function to debounce
   * @param {number} ms - Delay in milliseconds (default 200)
   * @returns {Function} Debounced function
   */
  function debounce(fn, ms) {
    ms = ms || 200;
    var timer = 0;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /**
   * Creates a throttled version of `fn`. The returned function invokes `fn` at most once
   * per `ms` milliseconds.
   * @param {Function} fn - Function to throttle
   * @param {number} ms - Minimum interval in milliseconds (default 200)
   * @returns {Function} Throttled function
   */
  function throttle(fn, ms) {
    ms = ms || 200;
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, arguments); }
    };
  }

  /**
   * Observes `root` for added elements. Calls `callback` with each added Element node.
   * Returns the MutationObserver instance for .disconnect() when no longer needed.
   * @param {Function} callback - Called with each added Element
   * @param {Element} [root=document.body] - Root element to observe
   * @returns {MutationObserver}
   */
  function observeMutations(callback, root) {
    root = root || document.body;
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var nodes = mutations[m].addedNodes;
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.dom = {
    waitForElement: waitForElement,
    debounce: debounce,
    throttle: throttle,
    observeMutations: observeMutations
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/dom-utils.js
git commit -m "feat: add shared DOM utilities module"
```

---

### Task 3: Create `src/shared/storage-utils.js`

**Files:**
- Create: `src/shared/storage-utils.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/storage-utils.js — Async storage wrappers for GM_getValue/GM_setValue
// Consolidates JSON parsing, default values, and bulk writes into single-call helpers.
// Consumers: Marketplace Deal Finder, Crunchyroll, Gutefrage, YouTube, AniSearch, Reddit,
//            Global Speed Controller, Copy as Markdown
(function () {
  'use strict';

  /**
   * Loads a single setting with fallback default.
   * @param {string} key - Storage key
   * @param {*} [defaultValue] - Fallback if key is absent
   * @returns {Promise<*>} Parsed value or default
   */
  async function loadSetting(key, defaultValue) {
    try {
      var raw = await GM.getValue(key);
      if (raw === undefined || raw === null) return defaultValue;
      return raw;
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Persists a single value.
   * @param {string} key
   * @param {*} value - Objects are JSON-stringified automatically
   * @returns {Promise<void>}
   */
  async function saveSetting(key, value) {
    await GM.setValue(key, value);
  }

  /**
   * Loads multiple settings at once, merging with defaults.
   * @param {Object<string,*>} defaults - Key/defaultValue map
   * @returns {Promise<Object>} Resolved settings object with defaults applied
   */
  async function loadSettings(defaults) {
    var keys = Object.keys(defaults);
    var result = {};
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = await loadSetting(keys[i], defaults[keys[i]]);
    }
    return result;
  }

  /**
   * Persists multiple settings in a single bulk operation.
   * @param {Object<string,*>} obj - Key/value map
   * @returns {Promise<void>}
   */
  async function saveSettings(obj) {
    await GM.setValues(obj);
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.storage = {
    loadSetting: loadSetting,
    saveSetting: saveSetting,
    loadSettings: loadSettings,
    saveSettings: saveSettings
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/storage-utils.js
git commit -m "feat: add shared storage utilities module"
```

---

### Task 4: Create `src/shared/network-utils.js`

**Files:**
- Create: `src/shared/network-utils.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/network-utils.js — Promise-based GM_xmlhttpRequest wrappers with retry
// Standardizes fetch patterns across all network-heavy scripts.
// Consumers: AniSearch, Manga Panel, Recaptcha Solver, Marketplace Deal Finder, Copy as Markdown
(function () {
  'use strict';

  /**
   * Performs an HTTP GET via GM_xmlhttpRequest and returns the responseText parsed as a Document.
   * @param {string} url
   * @param {{ retries?: number, timeout?: number, anonymous?: boolean }} [opts]
   * @returns {Promise<Document>}
   */
  function fetchPage(url, opts) {
    opts = opts || {};
    var retries = opts.retries || 0;
    var timeout = opts.timeout || 15000;
    return new Promise(function (resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          timeout: timeout,
          anonymous: opts.anonymous !== false,
          onload: function (r) {
            if (r.status >= 200 && r.status < 300) {
              try {
                var parser = new DOMParser();
                var doc = parser.parseFromString(r.responseText, 'text/html');
                resolve(doc);
              } catch (e) { reject(new Error('DOMParser failed: ' + e.message)); }
            } else if (n < retries) {
              attempt(n + 1);
            } else {
              reject(new Error('HTTP ' + r.status + ' for ' + url));
            }
          },
          onerror: function () {
            if (n < retries) attempt(n + 1);
            else reject(new Error('Network error for ' + url));
          },
          ontimeout: function () {
            if (n < retries) attempt(n + 1);
            else reject(new Error('Timeout for ' + url));
          }
        });
      }
      attempt(0);
    });
  }

  /**
   * Performs an HTTP GET via GM_xmlhttpRequest and returns parsed JSON.
   * @param {string} url
   * @param {{ retries?: number, timeout?: number, anonymous?: boolean }} [opts]
   * @returns {Promise<*>}
   */
  function fetchJSON(url, opts) {
    opts = opts || {};
    var retries = opts.retries || 0;
    var timeout = opts.timeout || 15000;
    return new Promise(function (resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          timeout: timeout,
          anonymous: opts.anonymous !== false,
          onload: function (r) {
            if (r.status >= 200 && r.status < 300) {
              try { resolve(JSON.parse(r.responseText)); }
              catch (e) { reject(new Error('JSON parse failed: ' + e.message)); }
            } else if (n < retries) {
              attempt(n + 1);
            } else {
              reject(new Error('HTTP ' + r.status + ' for ' + url));
            }
          },
          onerror: function () {
            if (n < retries) attempt(n + 1);
            else reject(new Error('Network error for ' + url));
          },
          ontimeout: function () {
            if (n < retries) attempt(n + 1);
            else reject(new Error('Timeout for ' + url));
          }
        });
      }
      attempt(0);
    });
  }

  /**
   * Fetches a binary blob via GM_xmlhttpRequest.
   * @param {string} url
   * @param {{ retries?: number, timeout?: number }} [opts]
   * @returns {Promise<{blob: Blob, headers: Object}>}
   */
  function fetchBlob(url, opts) {
    opts = opts || {};
    var retries = opts.retries || 2;
    var timeout = opts.timeout || 30000;
    return new Promise(function (resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          timeout: timeout,
          responseType: 'blob',
          onload: function (r) {
            if (r.status >= 200 && r.status < 300) resolve({ blob: r.response, headers: r.responseHeaders });
            else if (n < retries) attempt(n + 1);
            else reject(new Error('HTTP ' + r.status + ' for ' + url));
          },
          onerror: function () {
            if (n < retries) attempt(n + 1);
            else reject(new Error('Network error for ' + url));
          },
          ontimeout: function () {
            if (n < retries) attempt(n + 1);
            else reject(new Error('Timeout for ' + url));
          }
        });
      }
      attempt(0);
    });
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.network = {
    fetchPage: fetchPage,
    fetchJSON: fetchJSON,
    fetchBlob: fetchBlob
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/network-utils.js
git commit -m "feat: add shared network utilities module"
```

---

### Task 5: Create `src/shared/ui-components.js`

**Files:**
- Create: `src/shared/ui-components.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/ui-components.js — Reusable UI primitives for Tampermonkey scripts
// Provides: Shadow DOM container factory, toast notifications, status bar, sidebar framework.
// All UI is isolated via closed Shadow DOM to prevent host-page CSS/JS interference.
// Consumers: Crunchyroll, Gutefrage, Manga Panel, NotebookLM, Epic Games, Copy as Markdown,
//            AniSearch, Google AI Studio, Marketplace Deal Finder
//
// Architecture:
//   createShadowContainer() — lowest-level primitive; all other components build on it
//   createToast() — auto-dismissing notification overlay
//   createStatusBar() — persistent bottom-right status indicator with progress bar
//   createSidebar() — fixed right panel with push-page effect, toggle tab, draggable header
(function () {
  'use strict';

  /* ─── Shadow DOM Container ─── */

  /**
   * Creates a closed Shadow DOM container appended to `document.body`.
   * Host-page CSS cannot penetrate; host-page JS cannot query children.
   * @param {{ id?: string, tag?: string, styles?: string, className?: string }} [opts]
   * @returns {{ host: HTMLElement, root: ShadowRoot }}
   */
  function createShadowContainer(opts) {
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
   * Multiple toasts stack vertically.
   * @param {string} message - Plain text (not HTML — uses textContent)
   * @param {{ duration?: number, type?: 'info'|'success'|'error'|'warn' }} [opts]
   * @returns {HTMLElement} The toast element (removed after duration)
   */
  function createToast(message, opts) {
    opts = opts || {};
    var duration = opts.duration || 3000;
    var type = opts.type || 'info';
    var toast = document.createElement('div');
    var root = toast.attachShadow({ mode: 'closed' });
    var colors = { info: '#2196F3', success: '#4CAF50', error: '#F44336', warn: '#FF9800' };
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
   * @param {{ accentColor?: string }} [opts]
   * @returns {{ host: HTMLElement, root: ShadowRoot, setText: Function, setProgress: Function, remove: Function }}
   */
  function createStatusBar(opts) {
    opts = opts || {};
    var accent = opts.accentColor || '#2196F3';
    var container = createShadowContainer({
      styles: [
        ':host { position:fixed; bottom:0; right:0; z-index:2147483646;',
        'background:#1e1e1e; color:#e0e0e0; font:12px system-ui,sans-serif;',
        'padding:8px 14px; border-radius:8px 0 0 0; min-width:200px; max-width:360px;',
        'border-top:3px solid ' + accent + '; border-left:3px solid ' + accent + '; }',
        '.text { margin-bottom:4px; }',
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
   * The push-page effect is achieved by adding a CSS class to `<html>` that sets `margin-right`
   * or `transform: translateX()`. Override via `cssOverrides` parameter.
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
   *   host: HTMLElement, root: ShadowRoot, bodyEl: HTMLElement,
   *   open: Function, close: Function, toggle: Function, isOpen: Function
   * }}
   */
  function createSidebar(opts) {
    opts = opts || {};
    var width = opts.width || 340;
    var accent = opts.accentColor || '#2196F3';
    var title = opts.title || '';
    var isOpen = false;
    var bodyContent = null;

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
      '.tab { position:fixed; top:50%; right:' + width + 'px; transform:translateY(-50%) translateX(100%);',
      'z-index:2147483644; background:' + accent + '; color:#fff; padding:10px 6px;',
      'border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;',
      'writing-mode:vertical-rl; text-orientation:mixed; transition:right 0.3s ease, transform 0.3s ease; }',
      '.tab.open { right:' + (width + 8) + 'px; transform:translateY(-50%) translateX(0); }',
      (opts.cssOverrides || '')
    ].join('');

    var container = createShadowContainer({ styles: baseCSS });
    var root = container.root;

    // Build header
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

    // Build body
    var body = document.createElement('div');
    body.className = 'body';
    root.appendChild(body);

    // Build toggle tab
    var tab = document.createElement('div');
    var tabRoot = tab.attachShadow({ mode: 'closed' });
    var tabStyle = document.createElement('style');
    tabStyle.textContent = [
      ':host { position:fixed; top:50%; z-index:2147483644; background:' + accent + '; color:#fff;',
      'padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;',
      'writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);',
      'right:' + width + 'px; transform:translateY(-50%) translateX(100%);',
      'transition:right 0.3s ease, transform 0.3s ease; }',
      ':host(.open) { right:' + (width + 8) + 'px; transform:translateY(-50%) translateX(0); }'
    ].join('');
    var tabSpan = document.createElement('span');
    tabSpan.textContent = title;
    tabRoot.appendChild(tabStyle);
    tabRoot.appendChild(tabSpan);
    document.body.appendChild(tab);

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

    // Header dragging
    var dragging = false, startY = 0, startX = 0, startTop = 0, startRight = 0;
    header.addEventListener('mousedown', function (e) {
      if (e.target === closeBtn) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      startRight = parseInt(container.host.style.right || 0);
      startTop = parseInt(container.host.style.top || 0);
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

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.ui = {
    createShadowContainer: createShadowContainer,
    createToast: createToast,
    createStatusBar: createStatusBar,
    createSidebar: createSidebar
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/ui-components.js
git commit -m "feat: add shared UI components module"
```

---

### Task 6: Create `src/shared/zip-builder.js`

**Files:**
- Create: `src/shared/zip-builder.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/zip-builder.js — Zero-dependency STORE (no-compression) ZIP archive builder
// Unifies the two near-identical CRC-32 implementations from NotebookLM Source Export
// and Manga Panel Downloader.
// Consumers: NotebookLM Source Export, Manga Panel Downloader
//
// Architecture:
//   1. Precompute CRC-32 lookup table once (shared by all calls)
//   2. For each file: write local file header + raw data + optional CRC-32
//   3. Write central directory entries
//   4. Write end-of-central-directory (EOCD) record
//   All binary construction uses DataView on an ArrayBuffer.
(function () {
  'use strict';

  /* ─── CRC-32 Table (lazily initialized) ─── */
  var crcTable = null;
  function buildCRCTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c;
    }
    return crcTable;
  }

  function crc32(data) {
    var table = buildCRCTable();
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /* ─── Helpers ─── */
  function pad4(n) { return (n < 0x1000 ? '000' : '') + (n < 0x100 ? '00' : '') + (n < 0x10 ? '0' : '') + n.toString(16); }

  var encoder = new TextEncoder();

  /**
   * Builds a STORE (no-compression) ZIP archive.
   * @param {{ name: string, data: Uint8Array }[]} files - Array of {name, data} objects
   * @returns {Uint8Array} Complete ZIP file as bytes
   */
  function buildStoreZip(files) {
    var localHeaders = [];
    var centralEntries = [];
    var offsets = [];
    var offset = 0;

    for (var f = 0; f < files.length; f++) {
      var nameBytes = encoder.encode(files[f].name);
      var data = files[f].data;
      var crc = crc32(data);
      var nameLen = nameBytes.length;
      var dataLen = data.length;

      // Local file header
      var lh = new ArrayBuffer(30 + nameLen);
      var lv = new DataView(lh);
      lv.setUint32(0, 0x04034b50, true);  // signature
      lv.setUint16(4, 20, true);           // version needed
      lv.setUint16(6, 0x0800, true);       // flags: UTF-8
      lv.setUint16(8, 0, true);            // compression: STORE
      lv.setUint16(10, 0, true);           // mod time
      lv.setUint16(12, 0, true);           // mod date
      lv.setUint32(14, crc, true);         // CRC-32
      lv.setUint32(18, dataLen, true);     // compressed size
      lv.setUint32(22, dataLen, true);     // uncompressed size
      lv.setUint16(26, nameLen, true);     // filename length
      lv.setUint16(28, 0, true);           // extra field length
      var lhBytes = new Uint8Array(lh);
      lhBytes.set(nameBytes, 30);
      localHeaders.push(lhBytes);

      offsets.push(offset);
      offset += lhBytes.length + dataLen;
    }

    // Build output
    var total = offset;
    var cdOffset = total;
    for (f = 0; f < files.length; f++) {
      var cdNameBytes = encoder.encode(files[f].name);
      var cdNameLen = cdNameBytes.length;
      var cd = new ArrayBuffer(46 + cdNameLen);
      var cv = new DataView(cd);
      cv.setUint32(0, 0x02014b50, true);   // central dir signature
      cv.setUint16(4, 20, true);            // version made by
      cv.setUint16(6, 20, true);            // version needed
      cv.setUint16(8, 0x0800, true);        // flags: UTF-8
      cv.setUint16(10, 0, true);            // compression: STORE
      cv.setUint16(12, 0, true);            // mod time
      cv.setUint16(14, 0, true);            // mod date
      cv.setUint32(16, crc32(files[f].data), true); // CRC-32
      cv.setUint32(20, files[f].data.length, true); // compressed size
      cv.setUint32(24, files[f].data.length, true); // uncompressed size
      cv.setUint16(28, cdNameLen, true);    // filename length
      cv.setUint16(30, 0, true);            // extra field length
      cv.setUint16(32, 0, true);            // file comment length
      cv.setUint16(34, 0, true);            // disk number start
      cv.setUint16(36, 0, true);            // internal attrs
      cv.setUint32(38, 0, true);            // external attrs
      cv.setUint32(42, offsets[f], true);   // local header offset
      var cdBytes = new Uint8Array(cd);
      cdBytes.set(cdNameBytes, 46);
      centralEntries.push(cdBytes);
      total += cdBytes.length;
    }
    // EOCD
    var cdSize = centralEntries.reduce(function (s, e) { return s + e.length; }, 0);
    total += 22;
    var out = new Uint8Array(total);
    var pos = 0;
    for (f = 0; f < files.length; f++) {
      out.set(localHeaders[f], pos); pos += localHeaders[f].length;
      out.set(files[f].data, pos);   pos += files[f].data.length;
    }
    for (f = 0; f < centralEntries.length; f++) {
      out.set(centralEntries[f], pos); pos += centralEntries[f].length;
    }
    var eocd = new DataView(out.buffer, pos, 22);
    eocd.setUint32(0, 0x06054b50, true);   // EOCD signature
    eocd.setUint16(4, 0, true);             // disk number
    eocd.setUint16(6, 0, true);             // disk with CD
    eocd.setUint16(8, files.length, true);  // entries on disk
    eocd.setUint16(10, files.length, true); // total entries
    eocd.setUint32(12, cdSize, true);       // CD size
    eocd.setUint32(16, cdOffset, true);     // CD offset
    eocd.setUint16(20, 0, true);            // comment length
    return out;
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.zip = { buildStoreZip: buildStoreZip };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/zip-builder.js
git commit -m "feat: add shared ZIP builder module"
```

---

### Task 7: Create `src/shared/markdown-converter.js`

**Files:**
- Create: `src/shared/markdown-converter.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/markdown-converter.js — Recursive DOM-to-Markdown converter
// Unifies the two independent recursive HTML-to-Markdown implementations from
// NotebookLM Source Export and Google AI Studio Chat Exporter.
// Consumers: NotebookLM Source Export, Google AI Studio Chat Exporter, Copy as Markdown for AI
//
// Architecture:
//   Recursive walker that descends DOM tree, accumulating Markdown strings.
//   Inline elements (strong, em, code, a) produce inline Markdown.
//   Block elements (p, h1-h6, pre, ul/ol, blockquote, table) produce block Markdown
//   separated by double newlines.
//   The top-level entry point is htmlToMarkdown(rootElement).
(function () {
  'use strict';

  var BLOCK_TAGS = {
    'P': true, 'DIV': true, 'H1': true, 'H2': true, 'H3': true, 'H4': true, 'H5': true, 'H6': true,
    'PRE': true, 'BLOCKQUOTE': true, 'UL': true, 'OL': true, 'LI': true, 'TABLE': true,
    'TR': true, 'HR': true, 'SECTION': true, 'ARTICLE': true, 'HEADER': true, 'FOOTER': true, 'MAIN': true
  };
  var INLINE_TAGS = {
    'STRONG': true, 'B': true, 'EM': true, 'I': true, 'CODE': true, 'A': true,
    'SPAN': true, 'S': true, 'DEL': true, 'U': true, 'BR': true, 'IMG': true, 'SUB': true, 'SUP': true
  };
  var HEADING_TAGS = { 'H1': '#', 'H2': '##', 'H3': '###', 'H4': '####', 'H5': '#####', 'H6': '######' };

  function escapeMD(text) {
    return text.replace(/([\\*_\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * Converts a DOM element and its descendants to Markdown.
   * @param {Element} el - Root element to convert
   * @returns {string} Markdown representation
   */
  function htmlToMarkdown(el) {
    if (!el) return '';
    var out = '';
    walk(el, '');
    return out.trim().replace(/\n{3,}/g, '\n\n');

    function walk(node) {
      if (!node) return;
      var children = node.childNodes;
      if (!children || children.length === 0) {
        if (node.nodeType === Node.TEXT_NODE) {
          var text = node.textContent.replace(/\s+/g, ' ');
          if (text && text !== ' ') out += text;
        }
        return;
      }
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === Node.TEXT_NODE) {
          var t = child.textContent.replace(/\s+/g, ' ');
          if (t && t !== ' ') out += t;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        var tag = child.tagName.toUpperCase();

        // Block-level
        if (tag === 'BR') { out += '\n'; continue; }
        if (tag === 'HR') { out += '\n\n---\n\n'; continue; }
        if (HEADING_TAGS[tag]) { out += '\n\n' + HEADING_TAGS[tag] + ' '; walk(child); out += '\n\n'; continue; }
        if (tag === 'P' || tag === 'DIV') { out += '\n\n'; walk(child); out += '\n\n'; continue; }
        if (tag === 'PRE') { out += '\n\n```\n' + (child.textContent || '') + '\n```\n\n'; continue; }
        if (tag === 'BLOCKQUOTE') { out += '\n\n> '; walkInline(child); out += '\n\n'; continue; }
        if (tag === 'UL' || tag === 'OL') { out += '\n\n'; walkList(child, tag === 'OL', 1); out += '\n\n'; continue; }
        if (tag === 'TABLE') { out += '\n\n'; walkTable(child); out += '\n\n'; continue; }

        // Inline
        if (tag === 'STRONG' || tag === 'B') { out += '**'; walk(child); out += '**'; continue; }
        if (tag === 'EM' || tag === 'I') { out += '*'; walk(child); out += '*'; continue; }
        if (tag === 'CODE') { out += '`' + (child.textContent || '') + '`'; continue; }
        if (tag === 'A') { var href = child.getAttribute('href') || ''; out += '['; walk(child); out += '](' + href + ')'; continue; }
        if (tag === 'IMG') { var src = child.getAttribute('src') || ''; var alt = child.getAttribute('alt') || ''; out += '![' + alt + '](' + src + ')'; continue; }
        if (tag === 'DEL' || tag === 'S') { out += '~~'; walk(child); out += '~~'; continue; }
        if (tag === 'U') { out += '<u>'; walk(child); out += '</u>'; continue; }

        // Unknown: recurse
        walk(child);
      }
    }

    function walkInline(node) {
      if (!node) return;
      var children = node.childNodes;
      if (!children) return;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === Node.TEXT_NODE) { out += child.textContent; continue; }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        var tag = child.tagName.toUpperCase();
        if (tag === 'STRONG' || tag === 'B') { out += '**'; walkInline(child); out += '**'; }
        else if (tag === 'EM' || tag === 'I') { out += '*'; walkInline(child); out += '*'; }
        else if (tag === 'CODE') { out += '`' + (child.textContent || '') + '`'; }
        else if (tag === 'A') { var href = child.getAttribute('href') || ''; out += '['; walkInline(child); out += '](' + href + ')'; }
        else if (tag === 'BR') { out += ' '; }
        else { walkInline(child); }
      }
    }

    function walkList(node, ordered, depth) {
      var items = node.querySelectorAll(':scope > li');
      for (var i = 0; i < items.length; i++) {
        var prefix = ordered ? (i + 1) + '. ' : '- ';
        out += '  '.repeat(depth - 1) + prefix;
        walkInline(items[i]);
        out += '\n';
      }
    }

    function walkTable(node) {
      var rows = node.querySelectorAll('tr');
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].querySelectorAll('td, th');
        out += '| ';
        for (var c = 0; c < cells.length; c++) {
          walkInline(cells[c]);
          out += ' | ';
        }
        out += '\n';
        if (r === 0) {
          out += '| ';
          for (c = 0; c < cells.length; c++) { out += '--- | '; }
          out += '\n';
        }
      }
    }
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.markdown = { htmlToMarkdown: htmlToMarkdown };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/markdown-converter.js
git commit -m "feat: add shared markdown converter module"
```

---

### Task 8: Create `src/shared/i18n-utils.js`

**Files:**
- Create: `src/shared/i18n-utils.js`

- [ ] **Step 1: Write the module**

```javascript
// src/shared/i18n-utils.js — Text normalization and multi-language term matching
// Consumers: Gutefrage Smart Filters, YouTube Enhanced, Crunchyroll Enhanced,
//            Manga Panel Downloader, AniSearch Endless Scroll
(function () {
  'use strict';

  /**
   * Normalizes text for comparison: lowercase, remove diacritics, collapse whitespace,
   * trim separators (hyphens, underscores, dots).
   * @param {string} str
   * @returns {string}
   */
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[äæ]/g, 'ae').replace(/[öœ]/g, 'oe').replace(/[ü]/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[àáâãå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõ]/g, 'o').replace(/[ùúû]/g, 'u').replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[-_.:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks if `text` matches any term in `terms` after normalization.
   * @param {string} text
   * @param {string[]} terms
   * @returns {boolean}
   */
  function matchAnyTerm(text, terms) {
    var n = normalizeText(text);
    for (var i = 0; i < terms.length; i++) {
      if (n.indexOf(normalizeText(terms[i])) !== -1) return true;
    }
    return false;
  }

  /**
   * Checks if `text` exactly matches `term` after normalization.
   * @param {string} text
   * @param {string} term
   * @returns {boolean}
   */
  function matchTerm(text, term) {
    return normalizeText(text) === normalizeText(term);
  }

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.i18n = {
    normalizeText: normalizeText,
    matchAnyTerm: matchAnyTerm,
    matchTerm: matchTerm
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/i18n-utils.js
git commit -m "feat: add shared i18n utilities module"
```

---

### Task 9-13: Batch A — Large Scripts (Parallel Teammate Work)

Each of these tasks can be assigned to separate teammates:

**Task 9: Refactor Copy as Markdown for AI.user.js**
- Modify: `Copy as Markdown for AI.user.js`
- Add `@require` for: ui-components, storage-utils, network-utils, logging-utils, markdown-converter
- Replace custom toast/status-bar with `TM.ui.createToast`/`TM.ui.createStatusBar`
- Replace custom storage wrapper with `TM.storage.loadSettings`/`TM.storage.saveSettings`
- Replace custom `fetchRemote` with `TM.network.fetchPage`
- Replace embedded TurndownService with `TM.markdown.htmlToMarkdown` (or keep Turndown for advanced features if needed)
- Add `const log = TM.createLogger('Copy as Markdown');`
- Translate all German comments/variables to English
- Add `@sandbox JavaScript`, `@inject-into content` if missing
- Verify all `@grant` tags
- Wrap UI in closed Shadow DOM
- Bump `@version` patch

**Task 10: Refactor Marketplace Deal Finder.user.js**
- Same pattern: add @require imports, replace duplicated code with TM.* calls
- Replace custom storage layer with TM.storage.*
- Replace custom fetch with TM.network.*
- Replace MutationObserver patterns with TM.dom.*
- Translate German to English
- Bump version

**Task 11: Refactor Crunchyroll Enhanced.user.js**
- Replace sidebar with TM.ui.createSidebar
- Replace custom storage with TM.storage.*
- Replace MutationObserver with TM.dom.*
- Replace custom debounce with TM.dom.debounce
- Translate German to English
- Bump version

---

### Task 14-17: Batch B — Medium Scripts (Parallel Teammate Work)

**Task 14:** Gutefrage Smart Filters
**Task 15:** Manga Panel Downloader
**Task 16:** NotebookLM Source Export
**Task 17:** YouTube Enhanced + Global Video Speed Controller

---

### Task 18-22: Batch C+D — Small Scripts (Parallel Teammate Work)

**Task 18:** AniSearch Endless Scroll
**Task 19:** Recaptcha Solver + Google AI Studio Chat Exporter
**Task 20:** Epic Games Library Export + Google Search Enhanced
**Task 21:** Reddit Content Unlocker + FlameComics Advanced Sort
**Task 22:** BotGhost Bulk Choice Extractor + Picture-in-Picture any site

---

## Review Checklist (Per Script)

- [ ] All `@grant` tags match actual GM API usage
- [ ] `@sandbox JavaScript` present
- [ ] `@inject-into content` present
- [ ] `@noframes` present (unless iframe access needed)
- [ ] `@version` bumped
- [ ] `@require` URLs point to correct GitHub raw paths
- [ ] No remaining German comments, variable names, or console messages
- [ ] IIFE + `'use strict'` intact
- [ ] `console.log` uses `TM.createLogger()` not raw console
- [ ] Shadow DOM for all injected UI
- [ ] `observer.disconnect()` called after target found
- [ ] No `innerHTML` with unsanitized input

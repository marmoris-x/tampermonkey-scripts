// tests/fixtures/gm-mock.js
// Lightweight GM API polyfill for Playwright-based userscript testing
// Injected via page.addInitScript() BEFORE the userscript

window.GM_getValue = undefined;
window.GM_setValue = undefined;

// In-memory storage
const gmStore = new Map();
const valueChangeListeners = new Map();

window.GM = {
  getValue: async (key, defaultValue) => {
    return gmStore.has(key) ? gmStore.get(key) : defaultValue;
  },
  setValue: async (key, value) => {
    const old = gmStore.get(key);
    gmStore.set(key, value);
    // Notify listeners
    const listeners = valueChangeListeners.get(key);
    if (listeners) {
      listeners.forEach(cb => cb(key, old, value, false));
    }
  },
  addStyle: (css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  },
  addElement: (tag, attrs) => {
    const el = document.createElement(tag);
    if (attrs) {
      if (attrs.textContent) el.textContent = attrs.textContent;
      if (attrs.type) el.setAttribute('type', attrs.type);
    }
    (document.head || document.documentElement).appendChild(el);
    return el;
  },
  registerMenuCommand: (name, fn) => {
    window.__gmMenuCommands = window.__gmMenuCommands || {};
    window.__gmMenuCommands[name] = fn;
  },
  unregisterMenuCommand: (id) => {
    // Simplified mock: no-op
  },
  addValueChangeListener: (key, callback) => {
    if (!valueChangeListeners.has(key)) valueChangeListeners.set(key, []);
    valueChangeListeners.get(key).push(callback);
  },
};

// Sync aliases (for code using legacy API names)
window.GM_addStyle = window.GM.addStyle;
window.GM_addElement = window.GM.addElement;
window.GM_registerMenuCommand = window.GM.registerMenuCommand;
window.GM_unregisterMenuCommand = window.GM.unregisterMenuCommand;
window.GM_addValueChangeListener = window.GM.addValueChangeListener;
window.GM_getValue = window.GM.getValue;
window.GM_setValue = window.GM.setValue;

// unsafeWindow: in page context, this is just window
window.unsafeWindow = window;

// Test helpers — exposed for Playwright tests to inspect/trigger
window.__gmTest = {
  getStore: () => gmStore,
  getListeners: () => valueChangeListeners,
  /** Trigger a remote value change notification (simulates another tab) */
  triggerRemoteChange: (key, newValue) => {
    const old = gmStore.get(key);
    gmStore.set(key, newValue);
    const listeners = valueChangeListeners.get(key);
    if (listeners) {
      listeners.forEach(cb => cb(key, old, newValue, true));
    }
  },
};

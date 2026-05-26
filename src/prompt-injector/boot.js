import {
  DEBUG,
  SCRIPT_KEY_DOMAINS,
  SCRIPT_KEY_SETTINGS,
  SCRIPT_KEY_CUSTOM_LANGS,
  HOST_ID,
  INPUT_SELECTOR,
  DEFAULT_SETTINGS,
  THEME,
  ISO_639_1_DB,
  TOP_25_LANGS,
  PROMPT_PREFIXES,
} from './_lang.js';

// ── BLOCK J: Prompt Builder (pure function, extracted for testability) ─────
function buildPrompt(userText, settings) {
  let prefix = '';

  if (settings.webSearch) {
    prefix += PROMPT_PREFIXES.webSearch;
  }

  if (settings.language !== 'none') {
    const langCode = settings.language;
    const langData = ISO_639_1_DB.get(langCode);

    if (langData) {
      if (PROMPT_PREFIXES.language[langCode]) {
        prefix += PROMPT_PREFIXES.language[langCode];
      } else {
        const langName = langData.name.toUpperCase();
        prefix += `THOROUGHLY RESEARCH ${langName}-LANGUAGE SOURCES; ` +
                  `THOSE WRITTEN IN ${langName}: `;
      }
    }
  }

  if (settings.ahlulAthar) {
    prefix += PROMPT_PREFIXES.ahlulAthar;
  }

  return prefix + (userText || '');
}

// ── BLOCK L: Debug & Error Handling ────────────────────────────────────────
function debug(msg, data) {
  if (DEBUG) {
    console.debug(`[PromptInjector] ${msg}`, data !== undefined ? data : '');
  }
}

window.addEventListener('error', (e) => {
  debug('Unhandled error', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  debug('Unhandled rejection', e.reason);
});

// ── BLOCK B: Storage Helpers ───────────────────────────────────────────────
async function loadDomains() {
  try {
    const raw = await GM.getValue(SCRIPT_KEY_DOMAINS, '[]');
    return new Set(JSON.parse(raw));
  } catch (e) {
    debug('loadDomains failed', e);
    return new Set();
  }
}

async function saveDomains(set) {
  try {
    await GM.setValue(SCRIPT_KEY_DOMAINS, JSON.stringify([...set]));
  } catch (e) {
    debug('saveDomains failed', e);
  }
}

async function loadSettings(hostname) {
  try {
    const raw = await GM.getValue(SCRIPT_KEY_SETTINGS + hostname, null);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    debug('loadSettings failed', e);
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(hostname, obj) {
  try {
    await GM.setValue(SCRIPT_KEY_SETTINGS + hostname, JSON.stringify(obj));
  } catch (e) {
    debug('saveSettings failed', e);
  }
}

async function loadCustomLangs() {
  try {
    const raw = await GM.getValue(SCRIPT_KEY_CUSTOM_LANGS, '[]');
    return JSON.parse(raw);
  } catch (e) {
    debug('loadCustomLangs failed', e);
    return [];
  }
}

async function saveCustomLangs(langs) {
  try {
    await GM.setValue(SCRIPT_KEY_CUSTOM_LANGS, JSON.stringify(langs));
  } catch (e) {
    debug('saveCustomLangs failed', e);
  }
}

// ── BLOCK I: Framework Bridge ──────────────────────────────────────────────
function readField(element) {
  if (element.isContentEditable) {
    return element.innerText || element.textContent || '';
  }
  return element.value || '';
}

function writeField(element, value) {
  // Route to contentEditable handler when the element uses that mode
  if (element.isContentEditable) {
    element.focus();

    // Stufe 1: InputEvent (modern)
    try {
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: value,
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(inputEvent);
      if (element.innerText === value || element.textContent === value) return;
    } catch (e1) {
      debug('InputEvent failed', e1);
    }

    // Stufe 2: execCommand (deprecated but reliable fallback)
    try {
      // eslint-disable-next-line deprecation/deprecation
      const success =
        document.execCommand('selectAll', false, null) &&
        document.execCommand('insertText', false, value);
      if (success) return;
    } catch (e2) {
      debug('execCommand failed', e2);
    }

    // Stufe 3: textContent + manuelles Event
    element.textContent = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  // ── textarea / input path ──────────────────────────────────
  const proto =
    element instanceof unsafeWindow?.HTMLTextAreaElement
      ? unsafeWindow.HTMLTextAreaElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof unsafeWindow?.HTMLInputElement
          ? unsafeWindow.HTMLInputElement.prototype
          : HTMLInputElement.prototype;

  const nativeSetter =
    Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  const ownDescriptor = Object.getOwnPropertyDescriptor(element, 'value');
  const effectiveSetter =
    ownDescriptor?.set && ownDescriptor.set !== nativeSetter
      ? nativeSetter
      : nativeSetter;

  if (effectiveSetter) {
    effectiveSetter.call(element, value);
  } else {
    element.value = value;
  }

  if (element._valueTracker) {
    delete element._valueTracker;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── BLOCK C: Domain Guard & Menu ───────────────────────────────────────────
async function registerDomainGuard() {
  const hostname = location.hostname;
  const domains = await loadDomains();
  const isActive = domains.has(hostname);

  const labelText = (active, host) =>
    active
      ? `PromptInjector: ✅ Aktiv auf ${host}`
      : `PromptInjector: ❌ Inaktiv auf ${host}`;

  let menuId = GM.registerMenuCommand(
    labelText(isActive, hostname),
    async () => {
      try {
        const currentDomains = await loadDomains();
        if (currentDomains.has(hostname)) {
          currentDomains.delete(hostname);
        } else {
          currentDomains.add(hostname);
        }
        await saveDomains(currentDomains);
        GM.unregisterMenuCommand(menuId);
        menuId = GM.registerMenuCommand(
          labelText(!currentDomains.has(hostname), hostname),
          arguments.callee
        );
        location.reload();
      } catch (e) {
        debug('toggleCallback failed', e);
      }
    }
  );

  return { hostname, isActive, domains };
}

// ── BLOCK F: Gear Position ─────────────────────────────────────────────────
let lastGearPos = { top: 0, left: 0 };

function positionGear(hostEl, gearEl, field) {
  const rect = field.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let top = rect.top + scrollY + rect.height / 2 - 11;
  let left = rect.right + scrollX + 4;

  if (rect.right + 30 > window.innerWidth) {
    left = rect.left + scrollX - 26;
  }

  if (
    Math.abs(top - lastGearPos.top) > 1 ||
    Math.abs(left - lastGearPos.left) > 1
  ) {
    hostEl.style.top = top + 'px';
    hostEl.style.left = left + 'px';
    lastGearPos = { top, left };
  }

  gearEl.hidden = false;
}

// ── BLOCK G: MutationObserver ──────────────────────────────────────────────
const boundFields = new WeakSet();
let observerTimeout = null;

function initFields() {
  document.querySelectorAll(INPUT_SELECTOR).forEach((el) => {
    if (boundFields.has(el)) return;
    boundFields.add(el);
  });
}

function createFieldObserver() {
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;

    for (const m of mutations) {
      if (m.type !== 'childList') continue;
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (node.matches && node.matches(INPUT_SELECTOR) && !boundFields.has(node)) {
          boundFields.add(node);
          continue;
        }

        if (node.querySelectorAll) {
          const inputs = node.querySelectorAll(INPUT_SELECTOR);
          if (inputs.length > 0) {
            shouldScan = true;
            break;
          }
        }
      }
      if (shouldScan) break;
    }

    if (shouldScan) {
      clearTimeout(observerTimeout);
      observerTimeout = setTimeout(initFields, 200);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  initFields();
  return observer;
}

// ── BLOCK H: Event Interceptor ─────────────────────────────────────────────
function isSubmitButtonFor(btn, field) {
  let el = field;
  for (let i = 0; i < 5; i++) {
    if (!el || !el.parentElement) break;
    el = el.parentElement;
    if (el.contains(btn)) return true;
  }
  return false;
}

const injectedEvents = new WeakSet();

function createEventInterceptor(gearEl, panelEl, hostEl) {
  let lastFocusedField = null;
  let focusoutTimer = null;
  let rafId = null;

  // Focus tracking
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (
      target.matches && target.matches(INPUT_SELECTOR)
    ) {
      clearTimeout(focusoutTimer);
      lastFocusedField = target;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        positionGear(hostEl, gearEl, target);
      });
    }
  });

  document.addEventListener('focusout', () => {
    focusoutTimer = setTimeout(() => {
      gearEl.hidden = true;
      lastFocusedField = null;
    }, 150);
  });

  // Gear click toggles panel
  gearEl.addEventListener('click', (e) => {
    e.stopPropagation();
    panelEl.hidden = !panelEl.hidden;
  });

  // Click outside closes panel
  document.addEventListener('click', (e) => {
    if (!panelEl.hidden && !panelEl.contains(e.target) && e.target !== gearEl) {
      panelEl.hidden = true;
    }
  });

  // Keydown interceptor
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const field = lastFocusedField || document.activeElement;
      if (field && boundFields.has(field)) {
        if (injectedEvents.has(field)) return;
        injectedEvents.add(field);

        const userText = readField(field);
        const fullText = buildPrompt(userText, settings);
        writeField(field, fullText);

        setTimeout(() => injectedEvents.delete(field), 100);
      }
    }
  });

  // Click interceptor for submit buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"]');
    if (!btn || !lastFocusedField) return;
    if (!isSubmitButtonFor(btn, lastFocusedField)) return;
    if (injectedEvents.has(lastFocusedField)) return;
    injectedEvents.add(lastFocusedField);

    const userText = readField(lastFocusedField);
    const fullText = buildPrompt(userText, settings);
    writeField(lastFocusedField, fullText);

    setTimeout(() => injectedEvents.delete(lastFocusedField), 100);
  });

  // Submit interceptor
  document.addEventListener('submit', () => {
    const field = lastFocusedField;
    if (!field || !boundFields.has(field)) return;
    if (injectedEvents.has(field)) return;
    injectedEvents.add(field);

    const userText = readField(field);
    const fullText = buildPrompt(userText, settings);
    writeField(field, fullText);

    setTimeout(() => injectedEvents.delete(field), 100);
  });
}

// Settings object — will be populated in the async IIFE
let settings = { ...DEFAULT_SETTINGS };

// ── BLOCK K: SPA Routing Hook ──────────────────────────────────────────────
function setupSpaPolyfill() {
  if (!('onurlchange' in window)) {
    let lastUrl = location.href;
    const handler = () => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        window.dispatchEvent(new Event('urlchange'));
      }
    };

    window.addEventListener('popstate', handler);
    window.addEventListener('hashchange', handler);

    const titleEl = document.querySelector('title');
    if (titleEl) {
      new MutationObserver(handler).observe(titleEl, { childList: true });
    }

    setInterval(handler, 500);
  }
}

// ── EXPORT: registerBoot — the async IIFE orchestration ─────────────────────
export function registerBoot() {
  (async function () {
    'use strict';

    // ── BLOCK C: Domain Guard ─────────────────────────────────────────
    const { hostname, isActive } = await registerDomainGuard();
    if (!isActive) return;

    // ── BLOCK D: Settings ─────────────────────────────────────────────
    settings = await loadSettings(hostname);
    let customLangs = await loadCustomLangs();

    if (settings.ahlulAthar && settings.language !== 'ar') {
      settings.language = 'ar';
      await saveSettings(hostname, settings);
    }

    // ── BLOCK K: SPA Polyfill ─────────────────────────────────────────
    setupSpaPolyfill();

    // ── BLOCK E: Shadow DOM UI ─────────────────────────────────────────
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText =
      'position:absolute;z-index:2147483647;pointer-events:none;top:0;left:0';
    document.body.appendChild(host);

    let shadowRoot;
    try {
      shadowRoot = host.attachShadow({ mode: 'closed' });
    } catch (e) {
      debug('attachShadow failed', e);
      shadowRoot = host.attachShadow({ mode: 'open' });
    }

    // CSS
    const CSS_TEXT = `
      :host {
        all: initial;
        contain: strict;
        isolation: isolate;
        position: absolute;
        z-index: 2147483647;
        pointer-events: none;
      }
      #gear {
        all: unset;
        pointer-events: auto;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px; height: 22px;
        background: #111827;
        border: 1px solid ${THEME.border};
        border-radius: 4px;
        color: ${THEME.text};
        font-size: 13px;
        opacity: 0.8;
        transition: opacity .15s;
      }
      #gear:hover { opacity: 1; }
      #gear:focus-visible {
        outline: 2px solid ${THEME.accent};
        outline-offset: 2px;
      }
      #panel {
        pointer-events: auto;
        position: fixed;
        background: ${THEME.bg};
        border: 1px solid ${THEME.border};
        border-radius: 6px;
        padding: 12px 16px;
        color: ${THEME.text};
        font: 13px/1.6 system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 240px;
        box-shadow: 0 4px 24px rgba(0,0,0,.5);
      }
      #panel[hidden] { display: none; }
      label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }
      select {
        background: #1a1a2e;
        color: ${THEME.text};
        border: 1px solid ${THEME.border};
        border-radius: 3px;
        padding: 2px 4px;
        min-width: 150px;
      }
      select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      input[type="checkbox"] { accent-color: ${THEME.accent}; }
      #custom-lang-controls { display: flex; gap: 4px; margin-top: 4px; }
      #custom-lang-controls button {
        background: ${THEME.accent};
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        padding: 2px 8px;
        font-size: 12px;
      }
      #custom-lang-controls button:hover {
        filter: brightness(1.15);
      }
      .default-option { color: ${THEME.text}; }
      .none-option { color: #666; }
      .custom-option { color: #93c5fd; }
      .note {
        color: #94a3b8;
        font-size: 11px;
        line-height: 1.4;
      }
    `;

    if (typeof CSSStyleSheet.prototype.replaceSync === 'function') {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS_TEXT);
      shadowRoot.adoptedStyleSheets = [sheet];
    } else {
      const styleEl = document.createElement('style');
      styleEl.textContent = CSS_TEXT;
      shadowRoot.appendChild(styleEl);
    }

    // ── UI elements ───────────────────────────────────────────────────

    // Gear button
    const gear = document.createElement('button');
    gear.id = 'gear';
    gear.setAttribute('aria-label', 'Prompt-Einstellungen');
    gear.setAttribute('tabindex', '0');
    gear.textContent = '⚙';
    shadowRoot.appendChild(gear);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.hidden = true;

    // Helper
    const createLabeledCheckbox = (id, labelText, checked) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = checked;
      label.appendChild(cb);
      label.append(' ' + labelText);
      return label;
    };

    const createOption = (value, text, className) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      if (className) opt.className = className;
      return opt;
    };

    // Web Search
    const webSearchLabel = createLabeledCheckbox(
      'webSearch', 'Web Search', settings.webSearch
    );
    panel.appendChild(webSearchLabel);

    // Language select
    const langLabel = document.createElement('label');
    langLabel.textContent = 'Sprache: ';
    const langSelect = document.createElement('select');
    langSelect.id = 'lang-select';

    const noneOption = createOption('none', '– (keine)', 'none-option');
    langSelect.appendChild(noneOption);

    TOP_25_LANGS.forEach((code) => {
      if (ISO_639_1_DB.has(code)) {
        const lang = ISO_639_1_DB.get(code);
        langSelect.appendChild(
          createOption(code, `${lang.name} (${lang.nativeName})`, 'default-option')
        );
      }
    });

    customLangs.forEach((code) => {
      if (ISO_639_1_DB.has(code) && !TOP_25_LANGS.includes(code)) {
        const lang = ISO_639_1_DB.get(code);
        langSelect.appendChild(
          createOption(code, `${lang.name} (${lang.nativeName})`, 'custom-option')
        );
      }
    });

    langSelect.value = settings.language;
    langLabel.appendChild(langSelect);
    panel.appendChild(langLabel);

    // Ahlul Athar
    const ahlulAtharLabel = createLabeledCheckbox(
      'ahlulAthar', 'Ahlul Athar', settings.ahlulAthar
    );
    panel.appendChild(ahlulAtharLabel);

    // Custom language controls
    const customLangControls = document.createElement('div');
    customLangControls.id = 'custom-lang-controls';
    customLangControls.style.display = 'none';

    const addLangBtn = document.createElement('button');
    addLangBtn.textContent = '+ Sprache';
    const removeLangBtn = document.createElement('button');
    removeLangBtn.textContent = '– Sprache';
    customLangControls.appendChild(addLangBtn);
    customLangControls.appendChild(removeLangBtn);

    const enableCustomLangsLabel = createLabeledCheckbox(
      'enableCustomLangs', 'Eigene Sprachen aktivieren', false
    );
    panel.appendChild(enableCustomLangsLabel);
    panel.appendChild(customLangControls);

    // Hint text
    const hint = document.createElement('div');
    hint.className = 'note';
    hint.textContent =
      'Drücke Enter nach Texteingabe — der Prefix wird automatisch vorangestellt.';
    panel.appendChild(hint);

    shadowRoot.appendChild(panel);

    // ── UI Event Listeners ─────────────────────────────────────────────

    shadowRoot.getElementById('webSearch').addEventListener('change', async (e) => {
      settings.webSearch = e.target.checked;
      await saveSettings(hostname, settings);
    });

    langSelect.addEventListener('change', async (e) => {
      settings.language = e.target.value;
      await saveSettings(hostname, settings);
    });

    const ahlulAtharCheckbox = shadowRoot.getElementById('ahlulAthar');
    ahlulAtharCheckbox.addEventListener('change', async (e) => {
      settings.ahlulAthar = e.target.checked;
      if (e.target.checked) {
        settings.language = 'ar';
        langSelect.value = 'ar';
        langSelect.disabled = true;
      } else {
        langSelect.disabled = false;
      }
      await saveSettings(hostname, settings);
    });

    ahlulAtharCheckbox.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!settings.ahlulAthar) return;

      if (
        confirm(
          'Ahlul Athar ist aktiviert. Möchten Sie die Sprache ' +
          'für diese Session manuell überschreiben?'
        )
      ) {
        langSelect.disabled = false;
        langSelect.focus();
      }
    });

    shadowRoot.getElementById('enableCustomLangs').addEventListener('change', (e) => {
      customLangControls.style.display = e.target.checked ? 'flex' : 'none';
    });

    addLangBtn.addEventListener('click', async () => {
      const code = prompt(
        'ISO-639-1-Code der Sprache eingeben (z.B. "sw" für Swahili):'
      );
      if (code && ISO_639_1_DB.has(code) && !customLangs.includes(code)) {
        customLangs.push(code);
        await saveCustomLangs(customLangs);
        const lang = ISO_639_1_DB.get(code);
        langSelect.appendChild(
          createOption(code, `${lang.name} (${lang.nativeName})`, 'custom-option')
        );
      }
    });

    removeLangBtn.addEventListener('click', async () => {
      const code = prompt(
        'ISO-639-1-Code der zu entfernenden Sprache eingeben:'
      );
      if (code && customLangs.includes(code)) {
        customLangs = customLangs.filter((c) => c !== code);
        await saveCustomLangs(customLangs);
        const opt = langSelect.querySelector(`option[value="${code}"]`);
        if (opt) opt.remove();
      }
    });

    if (settings.ahlulAthar) {
      langSelect.disabled = true;
    }

    // Panel Escape key
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') panel.hidden = true;
    });

    // ── BLOCK F+G+H: Position, Observer, Events ───────────────────────
    createFieldObserver();
    createEventInterceptor(gear, panel, host);

    // ── BLOCK K Listener: SPA URL change ───────────────────────────────
    window.addEventListener('urlchange', (_info) => {
      gear.hidden = true;
      panel.hidden = true;
      lastFocusedField = null;
      setTimeout(initFields, 300);
    });

    debug('Boot complete, script active on', hostname);
  })();
}

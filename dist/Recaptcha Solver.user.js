// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.0.2
// @author       marmoris-x
// @description  Automatically solves reCAPTCHA v2 audio challenges via speech recognition
// @license      MIT
// @icon         https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/RecaptchaLogo.svg/1280px-RecaptchaLogo.svg.png
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Recaptcha%20Solver.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Recaptcha%20Solver.user.js
// @match        https://www.google.com/recaptcha/*
// @match        https://google.com/recaptcha/*
// @match        https://www.recaptcha.net/recaptcha/*
// @match        https://recaptcha.net/recaptcha/*
// @sandbox      raw
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_addElement
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  function createLogger(prefix, debugMode = false) {
    const tag = `[${prefix}]`;
    return {
      log(...args) {
        console.log(tag, ...args);
      },
      warn(...args) {
        console.warn(tag, ...args);
      },
      error(...args) {
        console.error(tag, ...args);
      },
      info(...args) {
        console.info(tag, ...args);
      },
      debug(...args) {
        if (debugMode) console.debug(tag, ...args);
      }
    };
  }
  function waitForElement(selector, timeout = 1e4, root = document.body) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      let timer = null;
      const observer = new MutationObserver((mutations) => {
        var _a, _b;
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if ((_a = node.matches) == null ? void 0 : _a.call(node, selector)) {
              cleanup();
              return resolve(node);
            }
            const child = (_b = node.querySelector) == null ? void 0 : _b.call(node, selector);
            if (child) {
              cleanup();
              return resolve(child);
            }
          }
        }
      });
      const cleanup = () => {
        observer.disconnect();
        if (timer !== null) clearTimeout(timer);
      };
      observer.observe(root, { childList: true, subtree: true });
      if (timeout > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`waitForElement timeout: ${selector}`));
        }, timeout);
      }
    });
  }
  function observeMutations(callback, root = document.body) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            callback(node, observer);
          }
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  }
  function isVisible(el) {
    if (!el || el.offsetParent === null) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }
  function fetchJSON(url, opts = {}) {
    const retries = opts.retries || 0;
    const timeout = opts.timeout || 15e3;
    return new Promise((resolve, reject) => {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout,
          anonymous: opts.anonymous !== false,
          onload(r) {
            if (r.status >= 200 && r.status < 300) {
              try {
                resolve(JSON.parse(r.responseText));
              } catch (e) {
                reject(new Error("JSON parse failed: " + e.message));
              }
            } else if (n < retries) {
              attempt(n + 1);
            } else {
              reject(new Error("HTTP " + r.status + " for " + url));
            }
          },
          onerror() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Network error for " + url));
          },
          ontimeout() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Timeout for " + url));
          }
        });
      }
      attempt(0);
    });
  }
  let latencies = [];
  function measureServerLatencies(servers) {
    const log2 = createLogger("Recaptcha Solver");
    latencies = servers.map(() => Infinity);
    return Promise.all(servers.map((url, i) => {
      const t0 = Date.now();
      return fetchJSON(url, { timeout: 8e3 }).then(() => {
        latencies[i] = Date.now() - t0;
        log2.log(`Ping ${url}: ${latencies[i]}ms`);
      }).catch(() => {
        latencies[i] = Infinity;
      });
    }));
  }
  function getBestServer(servers, latenciesArr, exclude) {
    let best = null;
    let bestMs = Infinity;
    for (let i = 0; i < servers.length; i++) {
      if (servers[i] === exclude) continue;
      if (latenciesArr[i] < bestMs) {
        bestMs = latenciesArr[i];
        best = servers[i];
      }
    }
    return best || servers.filter((s) => s !== exclude)[0] || servers[0];
  }
  const LANG_MAP = {
    af: "af-ZA",
    am: "am-ET",
    ar: "ar-SA",
    az: "az-AZ",
    be: "be-BY",
    bg: "bg-BG",
    bn: "bn-BD",
    bs: "bs-BA",
    ca: "ca-ES",
    cs: "cs-CZ",
    cy: "cy-GB",
    da: "da-DK",
    de: "de-DE",
    el: "el-GR",
    es: "es-ES",
    et: "et-EE",
    eu: "eu-ES",
    fa: "fa-IR",
    fi: "fi-FI",
    fr: "fr-FR",
    ga: "ga-IE",
    gl: "gl-ES",
    gu: "gu-IN",
    he: "he-IL",
    hi: "hi-IN",
    hr: "hr-HR",
    hu: "hu-HU",
    hy: "hy-AM",
    id: "id-ID",
    is: "is-IS",
    it: "it-IT",
    ja: "ja-JP",
    ka: "ka-GE",
    kk: "kk-KZ",
    km: "km-KH",
    kn: "kn-IN",
    ko: "ko-KR",
    lt: "lt-LT",
    lv: "lv-LV",
    mk: "mk-MK",
    ml: "ml-IN",
    mn: "mn-MN",
    mr: "mr-IN",
    ms: "ms-MY",
    my: "my-MM",
    nb: "nb-NO",
    ne: "ne-NP",
    nl: "nl-NL",
    pa: "pa-IN",
    pl: "pl-PL",
    pt: "pt-BR",
    ro: "ro-RO",
    ru: "ru-RU",
    si: "si-SK",
    sk: "sk-SK",
    sl: "sl-SI",
    sq: "sq-AL",
    sr: "sr-RS",
    sv: "sv-SE",
    sw: "sw-KE",
    ta: "ta-IN",
    te: "te-IN",
    th: "th-TH",
    tl: "tl-PH",
    tr: "tr-TR",
    uk: "uk-UA",
    ur: "ur-PK",
    uz: "uz-UZ",
    vi: "vi-VN",
    zh: "zh-CN",
    zu: "zu-ZA"
  };
  function getLang() {
    var _a;
    const raw = ((_a = document.querySelector("html")) == null ? void 0 : _a.getAttribute("lang")) || navigator.language || "en-US";
    return LANG_MAP[raw] || raw;
  }
  const SEL = {
    AUDIO_BUTTON: "#recaptcha-audio-button",
    AUDIO_SOURCE: "#audio-source",
    IMAGE_SELECT: "#rc-imageselect",
    RESPONSE_FIELD: ".rc-audiochallenge-response-field",
    AUDIO_ERROR: ".rc-audiochallenge-error-message",
    AUDIO_RESPONSE: "#audio-response",
    RELOAD_BUTTON: "#recaptcha-reload-button",
    STATUS: "#recaptcha-accessible-status",
    DOSCAPTCHA: ".rc-doscaptcha-body",
    VERIFY_BUTTON: "#recaptcha-verify-button",
    RC_BUTTONS: ".rc-buttons",
    HELP_HOLDER: ".help-button-holder"
  };
  const MAX_ATTEMPTS = 5;
  const INTERVAL_MS = 1e3;
  const SUBMIT_GRACE_MS = 3500;
  const STUCK_TIMEOUT_MS = 45e3;
  const MAX_RESPONSE_LEN = 100;
  const AUDIO_BTN_DEBOUNCE_MS = 4e3;
  const SERVERS = [
    "https://engageub.pythonanywhere.com",
    "https://engageub1.pythonanywhere.com"
  ];
  const BUTTON_ID = "rs-solve-btn";
  const HOST_ID = "rs-solve-host";
  const HELP_SEL = ".help-button-holder";
  const log$1 = createLogger("Recaptcha Solver");
  function finish(result, onStateChange, interval) {
    if (interval) clearInterval(interval);
    onStateChange(result);
  }
  function getTextFromAudio(srcUrl, solverState, excludeServer) {
    const normalizedUrl = srcUrl.replace(/recaptcha\.net/g, "google.com");
    const lang = getLang();
    const server = getBestServer(SERVERS, latencies, excludeServer);
    if (!excludeServer) solverState.requestCount++;
    solverState.waitingStart = Date.now();
    log$1.log(`Request to ${server} | lang:${lang} | attempt:${solverState.requestCount}${excludeServer ? " [retry]" : ""}`);
    GM_xmlhttpRequest({
      method: "POST",
      url: server,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "input=" + encodeURIComponent(normalizedUrl) + "&lang=" + encodeURIComponent(lang),
      timeout: 3e4,
      onload(response) {
        try {
          const text = (response.responseText || "").trim();
          log$1.log('Response: "' + text.substring(0, 80) + '"');
          const invalid = !text || text === "0" || text.length < 2 || text.length > MAX_RESPONSE_LEN || /<[a-z][\s\S]*?>/i.test(text);
          if (invalid) {
            log$1.log("Invalid response — will reload on next tick");
            solverState.waiting = false;
            return;
          }
          const audioBtn = qs(SEL.AUDIO_BUTTON);
          const audioSrcEl = qs(SEL.AUDIO_SOURCE);
          const audioRespEl = qs(SEL.AUDIO_RESPONSE);
          const verifyBtn = qs(SEL.VERIFY_BUTTON);
          const inAudioMode = audioBtn && window.getComputedStyle(audioBtn).display === "none";
          if (inAudioMode && audioSrcEl && audioSrcEl.src === srcUrl && audioRespEl && !audioRespEl.value && verifyBtn) {
            audioRespEl.value = text;
            audioRespEl.dispatchEvent(new Event("input", { bubbles: true }));
            audioRespEl.dispatchEvent(new Event("change", { bubbles: true }));
            verifyBtn.click();
            solverState.submittedAt = Date.now();
            log$1.log('Submitted: "' + text + '"');
          } else {
            log$1.log("Page state changed — will retry on next challenge");
          }
        } catch (err) {
          log$1.error("Response handler error: " + err.message);
        } finally {
          solverState.waiting = false;
        }
      },
      onerror() {
        log$1.warn("Network error from " + server);
        if (!excludeServer) {
          getTextFromAudio(srcUrl, solverState, server);
        } else {
          log$1.warn("Both servers failed — releasing lock");
          solverState.waiting = false;
        }
      },
      ontimeout() {
        log$1.warn("Timeout from " + server);
        if (!excludeServer) {
          getTextFromAudio(srcUrl, solverState, server);
        } else {
          log$1.warn("Both servers failed — releasing lock");
          solverState.waiting = false;
        }
      }
    });
  }
  function startSolver({ state, onStateChange }) {
    onStateChange("working");
    const interval = setInterval(function() {
      try {
        const st = state;
        if (!st) return;
        const dosEl = qs(SEL.DOSCAPTCHA);
        if (dosEl && dosEl.innerText.length > 0) {
          log$1.warn("DoS protection triggered — stopping");
          finish("dos", onStateChange, interval);
          return;
        }
        if (st.solved || st.stopped) return;
        const statusEl = qs(SEL.STATUS);
        if (statusEl && statusEl.innerText !== st.initialStatus) {
          log$1.log("Solved");
          st.solved = true;
          finish("success", onStateChange, interval);
          return;
        }
        if (st.requestCount >= MAX_ATTEMPTS) {
          log$1.warn(`Max attempts (${MAX_ATTEMPTS}) reached`);
          st.stopped = true;
          finish("failed", onStateChange, interval);
          return;
        }
        if (st.waiting && Date.now() - st.waitingStart > STUCK_TIMEOUT_MS) {
          log$1.warn("XHR appears stuck — releasing lock");
          st.waiting = false;
        }
        const now = Date.now();
        const audioBtn = qs(SEL.AUDIO_BUTTON);
        const imageSelect = qs(SEL.IMAGE_SELECT);
        if (audioBtn && isVisible(audioBtn) && imageSelect && isVisible(imageSelect) && now - st.audioBtnClickAt > AUDIO_BTN_DEBOUNCE_MS) {
          log$1.log("Switching to audio challenge");
          audioBtn.click();
          st.audioBtnClickAt = now;
          return;
        }
        const audioSrcEl = qs(SEL.AUDIO_SOURCE);
        const reloadBtn = qs(SEL.RELOAD_BUTTON);
        const audioErrEl = qs(SEL.AUDIO_ERROR);
        const inGrace = st.submittedAt > 0 && now - st.submittedAt < SUBMIT_GRACE_MS;
        const isStale = !st.waiting && !inGrace && audioSrcEl && audioSrcEl.src && st.audioUrl === audioSrcEl.src && reloadBtn;
        const hasError = audioErrEl && audioErrEl.innerText.length > 0 && reloadBtn && !reloadBtn.disabled;
        if (isStale || hasError) {
          log$1.log(hasError ? "Error detected — reloading" : "Stale audio — reloading");
          reloadBtn.click();
          return;
        }
        const responseField = qs(SEL.RESPONSE_FIELD);
        const audioRespEl = qs(SEL.AUDIO_RESPONSE);
        if (!st.waiting && responseField && isVisible(responseField) && audioRespEl && !audioRespEl.value && audioSrcEl && audioSrcEl.src && audioSrcEl.src.length > 0 && st.audioUrl !== audioSrcEl.src) {
          st.audioUrl = audioSrcEl.src;
          st.waiting = true;
          getTextFromAudio(st.audioUrl, st);
        }
      } catch (err) {
        log$1.error("Interval error: " + err.message);
        finish("failed", onStateChange, interval);
      }
    }, INTERVAL_MS);
  }
  function createFreshState(initialStatus = "") {
    return {
      stopped: false,
      solved: false,
      waiting: false,
      waitingStart: 0,
      audioUrl: "",
      requestCount: 0,
      submittedAt: 0,
      audioBtnClickAt: 0,
      initialStatus
    };
  }
  const SVG = {
    bolt: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M13 2 3 14h9l-1 8L21 10h-9l1-8z"/></svg>',
    spin: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="rs-spin" style="display:block"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="20 6 9 17 4 12"/></svg>',
    retry: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.95"/></svg>',
    warn: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>'
  };
  const BTN_STATES = {
    ready: [SVG.bolt, "Solve automatically", "", false],
    working: [SVG.spin, "Solving...", "rs-working", true],
    success: [SVG.check, "Solved!", "rs-success", true],
    failed: [SVG.retry, "Failed — click to retry", "rs-failed", false],
    dos: [SVG.warn, "Automated query limit reached", "rs-dos", true]
  };
  let _styleSheet = null;
  function createStyleSheet() {
    if (_styleSheet) return _styleSheet;
    _styleSheet = new CSSStyleSheet();
    _styleSheet.replaceSync(`
    :host {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
    }
    .rs-btn-holder {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }
    .rs-btn {
      background-image: none;
      background-color: #1a73e8;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      line-height: 0;
      vertical-align: middle;
      transition: background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      outline: none;
      user-select: none;
    }
    .rs-btn:not(:disabled):hover {
      background-color: #1558b0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transform: translateY(-1px);
    }
    .rs-btn:not(:disabled):active {
      transform: translateY(0) scale(0.96);
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    .rs-btn:disabled {
      cursor: default;
      opacity: 0.80;
    }
    .rs-btn.rs-working { background-color: #f29900; }
    .rs-btn.rs-success { background-color: #1e8e3e; }
    .rs-btn.rs-failed  { background-color: #d93025; }
    .rs-btn.rs-failed:not(:disabled):hover { background-color: #b71c1c; }
    .rs-btn.rs-dos     { background-color: #e37400; }
    .rs-spin {
      animation: rs-rotate 0.9s linear infinite;
      transform-origin: center;
    }
    @keyframes rs-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .rs-btn:focus-visible {
      outline: 2px solid #1a73e8;
      outline-offset: 2px;
    }
  `);
    return _styleSheet;
  }
  const log = createLogger("Recaptcha Solver");
  function setButtonState(btn, stateName) {
    if (!btn) return;
    const s = BTN_STATES[stateName] || BTN_STATES.ready;
    btn.innerHTML = s[0];
    btn.title = s[1];
    btn.disabled = s[3];
    btn.className = "rc-button goog-inline-block rs-btn" + (s[2] ? " " + s[2] : "");
  }
  function injectButton({ onClick }) {
    const helpHolder = qs(HELP_SEL);
    if (!helpHolder) return null;
    if (document.getElementById(HOST_ID)) return null;
    const host = document.createElement("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.adoptedStyleSheets = [createStyleSheet()];
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.tabIndex = 0;
    setButtonState(btn, "ready");
    btn.addEventListener("click", onClick);
    const wrapper = document.createElement("div");
    wrapper.className = "rs-btn-holder";
    wrapper.appendChild(btn);
    shadow.appendChild(wrapper);
    helpHolder.insertAdjacentElement("afterend", host);
    log.log("Solve button injected");
    return { host, button: btn, shadowRoot: shadow };
  }
  function registerBoot() {
    const log2 = createLogger("Recaptcha Solver");
    measureServerLatencies(SERVERS);
    let currentState = null;
    let currentInterval = null;
    function handleClick(btn) {
      if (currentState && currentState.stopped && !currentState.solved) {
        log2.log("Retrying solver...");
        const statusEl2 = qs(SEL.STATUS);
        currentState = createFreshState(statusEl2 ? statusEl2.innerText : "");
        currentInterval = startSolver({
          state: currentState,
          onStateChange: (stateName) => {
            setButtonState(btn, stateName);
            if (stateName !== "working") currentInterval = null;
          }
        });
        return;
      }
      if (currentInterval || currentState && currentState.solved) return;
      log2.log("Solver started by user");
      const statusEl = qs(SEL.STATUS);
      currentState = createFreshState(statusEl ? statusEl.innerText : "");
      currentInterval = startSolver({
        state: currentState,
        onStateChange: (stateName) => {
          setButtonState(btn, stateName);
          if (stateName !== "working") currentInterval = null;
        }
      });
    }
    createStyleSheet();
    waitForElement(HELP_SEL, 0).then(() => {
      const btnData = injectButton({
        onClick() {
          handleClick(this);
        }
      });
      if (btnData) {
        log2.log("Boot complete");
      }
    });
    observeMutations(() => {
      if (!document.getElementById(HOST_ID) && qs(HELP_SEL)) {
        log2.log("Button lost — re-injecting");
        injectButton({
          onClick() {
            handleClick(this);
          }
        });
      }
    });
  }
  
  if (window.location.href.includes("bframe")) {
    registerBoot();
  }

})();
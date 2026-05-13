// ==UserScript==
// @name         Recaptcha Solver
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.11.1
// @author       marmoris-x
// @description  Recaptcha Solver in Browser | Start button in challenge footer
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.user.js
// @match        https://www.google.com/recaptcha/*
// @match        https://google.com/recaptcha/*
// @match        https://www.recaptcha.net/recaptcha/*
// @match        https://recaptcha.net/recaptcha/*
// @sandbox      JavaScript
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @inject-into  content
// @run-at       document-idle
// @noframes
// @unwrap
// ==/UserScript==

(function () {
  'use strict';

  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    const tag = "[" + prefix + "]";
    return {
      log: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          const args = [tag];
          for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 1e4;
    root = root || document.body;
    return new Promise(function(resolve, reject) {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      let timer;
      const observer = new MutationObserver(function(mutations) {
        for (let m = 0; m < mutations.length; m++) {
          const nodes = mutations[m].addedNodes;
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
            if (nodes[i].matches && nodes[i].matches(selector)) {
              cleanup();
              return resolve(nodes[i]);
            }
            const child = nodes[i].querySelector && nodes[i].querySelector(selector);
            if (child) {
              cleanup();
              return resolve(child);
            }
          }
        }
      });
      function cleanup() {
        observer.disconnect();
        if (timer) clearTimeout(timer);
      }
      observer.observe(root, { childList: true, subtree: true });
      if (timeout > 0) {
        timer = setTimeout(function() {
          cleanup();
          reject(new Error("waitForElement timeout: " + selector));
        }, timeout);
      }
    });
  }
  function observeMutations(callback, root) {
    root = root || document.body;
    const observer = new MutationObserver(function(mutations) {
      for (let m = 0; m < mutations.length; m++) {
        const nodes = mutations[m].addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  }
  function fetchJSON(url, opts) {
    opts = opts || {};
    const retries = opts.retries || 0;
    const timeout = opts.timeout || 15e3;
    return new Promise(function(resolve, reject) {
      function attempt(n) {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout,
          anonymous: opts.anonymous !== false,
          onload: function(r) {
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
          onerror: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Network error for " + url));
          },
          ontimeout: function() {
            if (n < retries) attempt(n + 1);
            else reject(new Error("Timeout for " + url));
          }
        });
      }
      attempt(0);
    });
  }
  var log$3 = createLogger("Recaptcha Solver");
  var SEL$1 = {
    AUDIO_BUTTON: "#recaptcha-audio-button",
    AUDIO_SOURCE: "#audio-source",
    AUDIO_RESPONSE: "#audio-response",
    VERIFY_BUTTON: "#recaptcha-verify-button"
  };
  var MAX_RESPONSE_LEN = 100;
  var SERVERS = [
    "https://engageub.pythonanywhere.com",
    "https://engageub1.pythonanywhere.com"
  ];
  var latencies = SERVERS.map(function() {
    return Infinity;
  });
  SERVERS.forEach(function(url, i) {
    var t0 = Date.now();
    fetchJSON(url, { timeout: 8e3 }).then(function() {
      latencies[i] = Date.now() - t0;
      log$3.log("Ping " + url + ": " + latencies[i] + "ms");
    }).catch(function() {
      latencies[i] = Infinity;
    });
  });
  function getLang() {
    var raw = (document.querySelector("html") ? document.querySelector("html").getAttribute("lang") : null) || navigator.language || "en-US";
    var map = {
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
    return map[raw] || raw;
  }
  function getBestServer(exclude) {
    var best = null;
    var bestMs = Infinity;
    for (var i = 0; i < SERVERS.length; i++) {
      if (SERVERS[i] === exclude) continue;
      if (latencies[i] < bestMs) {
        bestMs = latencies[i];
        best = SERVERS[i];
      }
    }
    return best || SERVERS.filter(function(s) {
      return s !== exclude;
    })[0] || SERVERS[0];
  }
  function getTextFromAudio(srcUrl, retry) {
    var normalizedUrl = srcUrl.replace(/recaptcha\.net/g, "google.com");
    var lang = getLang();
    var server = getBestServer(retry);
    if (!retry) state.requestCount++;
    state.waitingStart = Date.now();
    log$3.log("Request to " + server + " | lang:" + lang + " | attempt:" + state.requestCount + (retry ? " [retry]" : ""));
    GM_xmlhttpRequest({
      method: "POST",
      url: server,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "input=" + encodeURIComponent(normalizedUrl) + "&lang=" + encodeURIComponent(lang),
      timeout: 3e4,
      onload: function(response) {
        try {
          var text = (response.responseText || "").trim();
          log$3.log('Response: "' + text.substring(0, 80) + '"');
          var invalid = !text || text === "0" || text.length < 2 || text.length > MAX_RESPONSE_LEN || /<[a-z][\s\S]*?>/i.test(text);
          if (invalid) {
            log$3.log("Invalid response — will reload on next tick");
            state.waiting = false;
            return;
          }
          var audioBtn = document.querySelector(SEL$1.AUDIO_BUTTON);
          var audioSrcEl = document.querySelector(SEL$1.AUDIO_SOURCE);
          var audioRespEl = document.querySelector(SEL$1.AUDIO_RESPONSE);
          var verifyBtn = document.querySelector(SEL$1.VERIFY_BUTTON);
          var inAudioMode = audioBtn && window.getComputedStyle(audioBtn).display === "none";
          if (inAudioMode && audioSrcEl && audioSrcEl.src === srcUrl && audioRespEl && !audioRespEl.value && verifyBtn) {
            audioRespEl.value = text;
            audioRespEl.dispatchEvent(new Event("input", { bubbles: true }));
            audioRespEl.dispatchEvent(new Event("change", { bubbles: true }));
            verifyBtn.click();
            state.submittedAt = Date.now();
            log$3.log('Submitted: "' + text + '"');
          } else {
            log$3.log("Page state changed — will retry on next challenge");
          }
        } catch (err) {
          log$3.error("Response handler error: " + err.message);
        } finally {
          state.waiting = false;
        }
      },
      onerror: function() {
        log$3.warn("Network error from " + server);
        if (!retry) {
          getTextFromAudio(srcUrl, server);
        } else {
          log$3.warn("Both servers failed — releasing lock");
          state.waiting = false;
        }
      },
      ontimeout: function() {
        log$3.warn("Timeout from " + server);
        if (!retry) {
          getTextFromAudio(srcUrl, server);
        } else {
          log$3.warn("Both servers failed — releasing lock");
          state.waiting = false;
        }
      }
    });
  }
  var log$2 = createLogger("Recaptcha Solver");
  var SEL = {
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
  var CFG = {
    MAX_ATTEMPTS: 5,
    INTERVAL_MS: 1e3,
    SUBMIT_GRACE_MS: 3500,
    STUCK_TIMEOUT_MS: 45e3,
    MAX_RESPONSE_LEN: 100,
    AUDIO_BTN_DEBOUNCE_MS: 4e3
  };
  function qs(sel) {
    return document.querySelector(sel);
  }
  function isVisible(el) {
    if (!el || el.offsetParent === null) return false;
    var s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  }
  var state = null;
  var solverInterval = null;
  function freshState() {
    return {
      stopped: false,
      solved: false,
      waiting: false,
      waitingStart: 0,
      audioUrl: "",
      requestCount: 0,
      submittedAt: 0,
      audioBtnClickAt: 0,
      initialStatus: qs(SEL.STATUS) ? qs(SEL.STATUS).innerText : ""
    };
  }
  function startSolver(btn) {
    state = freshState();
    setButtonState(btn, "working");
    solverInterval = setInterval(function() {
      try {
        var st = state;
        if (!st) return;
        var dosEl = qs(SEL.DOSCAPTCHA);
        if (dosEl && dosEl.innerText.length > 0) {
          log$2.warn("DoS protection triggered — stopping");
          stopSolver(btn, "dos");
          return;
        }
        if (st.solved || st.stopped) return;
        var statusEl = qs(SEL.STATUS);
        if (statusEl && statusEl.innerText !== st.initialStatus) {
          log$2.log("Solved");
          st.solved = true;
          stopSolver(btn, "success");
          return;
        }
        if (st.requestCount >= CFG.MAX_ATTEMPTS) {
          log$2.warn("Max attempts (" + CFG.MAX_ATTEMPTS + ") reached");
          st.stopped = true;
          stopSolver(btn, "failed");
          return;
        }
        if (st.waiting && Date.now() - st.waitingStart > CFG.STUCK_TIMEOUT_MS) {
          log$2.warn("XHR appears stuck — releasing lock");
          st.waiting = false;
        }
        var now = Date.now();
        var audioBtn = qs(SEL.AUDIO_BUTTON);
        var imageSelect = qs(SEL.IMAGE_SELECT);
        if (audioBtn && isVisible(audioBtn) && imageSelect && isVisible(imageSelect) && now - st.audioBtnClickAt > CFG.AUDIO_BTN_DEBOUNCE_MS) {
          log$2.log("Switching to audio challenge");
          audioBtn.click();
          st.audioBtnClickAt = now;
          return;
        }
        var audioSrcEl = qs(SEL.AUDIO_SOURCE);
        var reloadBtn = qs(SEL.RELOAD_BUTTON);
        var audioErrEl = qs(SEL.AUDIO_ERROR);
        var inGrace = st.submittedAt > 0 && now - st.submittedAt < CFG.SUBMIT_GRACE_MS;
        var isStale = !st.waiting && !inGrace && audioSrcEl && audioSrcEl.src && st.audioUrl === audioSrcEl.src && reloadBtn;
        var hasError = audioErrEl && audioErrEl.innerText.length > 0 && reloadBtn && !reloadBtn.disabled;
        if (isStale || hasError) {
          log$2.log(hasError ? "Error detected — reloading" : "Stale audio — reloading");
          reloadBtn.click();
          return;
        }
        var responseField = qs(SEL.RESPONSE_FIELD);
        var audioRespEl = qs(SEL.AUDIO_RESPONSE);
        if (!st.waiting && responseField && isVisible(responseField) && audioRespEl && !audioRespEl.value && audioSrcEl && audioSrcEl.src && audioSrcEl.src.length > 0 && st.audioUrl !== audioSrcEl.src) {
          st.audioUrl = audioSrcEl.src;
          st.waiting = true;
          getTextFromAudio(st.audioUrl);
        }
      } catch (err) {
        log$2.error("Interval error: " + err.message);
        stopSolver(btn, "failed");
      }
    }, CFG.INTERVAL_MS);
  }
  function stopSolver(btn, result) {
    if (solverInterval) {
      clearInterval(solverInterval);
      solverInterval = null;
    }
    setButtonState(btn, result);
  }
  var log$1 = createLogger("Recaptcha Solver");
  var SVG = {
    bolt: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M13 2 3 14h9l-1 8L21 10h-9l1-8z"/></svg>',
    spin: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="rs-spin" style="display:block"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="20 6 9 17 4 12"/></svg>',
    retry: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.95"/></svg>',
    warn: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>'
  };
  var BUTTON_ID = "rs-solve-btn";
  var WRAPPER_ID = "rs-solve-wrapper";
  var HELP_SEL = ".help-button-holder";
  var BTN_STATES = {
    ready: [SVG.bolt, "Solve automatically", "", false],
    working: [SVG.spin, "Solving...", "rs-working", true],
    success: [SVG.check, "Solved!", "rs-success", true],
    failed: [SVG.retry, "Failed — click to retry", "rs-failed", false],
    dos: [SVG.warn, "Automated query limit reached", "rs-dos", true]
  };
  function setButtonState(btn, stateName) {
    if (!btn) return;
    var s = BTN_STATES[stateName] || BTN_STATES.ready;
    btn.innerHTML = s[0];
    btn.title = s[1];
    btn.disabled = s[3];
    btn.className = "rc-button goog-inline-block rs-btn" + (s[2] ? " " + s[2] : "");
  }
  function injectStyles() {
    var style = document.createElement("style");
    style.textContent = [
      ".rs-btn-holder{display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important}",
      ".rs-btn{background-image:none!important;background-color:#1a73e8!important;color:#fff!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;border:none!important;border-radius:4px!important;cursor:pointer!important;line-height:0!important;vertical-align:middle!important;transition:background-color 0.15s ease,transform 0.1s ease,box-shadow 0.15s ease!important;box-shadow:0 1px 3px rgba(0,0,0,0.25)!important;outline:none!important;user-select:none!important}",
      ".rs-btn:not(:disabled):hover{background-color:#1558b0!important;box-shadow:0 2px 6px rgba(0,0,0,0.3)!important;transform:translateY(-1px)!important}",
      ".rs-btn:not(:disabled):active{transform:translateY(0) scale(0.96)!important;box-shadow:0 1px 2px rgba(0,0,0,0.2)!important}",
      ".rs-btn:disabled{cursor:default!important;opacity:0.80!important}",
      ".rs-btn.rs-working{background-color:#f29900!important}",
      ".rs-btn.rs-success{background-color:#1e8e3e!important}",
      ".rs-btn.rs-failed{background-color:#d93025!important}",
      ".rs-btn.rs-failed:not(:disabled):hover{background-color:#b71c1c!important}",
      ".rs-btn.rs-dos{background-color:#e37400!important}",
      ".rs-spin{animation:rs-rotate 0.9s linear infinite!important;transform-origin:center!important}",
      "@keyframes rs-rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
      ".rs-btn:focus-visible{outline:2px solid #1a73e8!important;outline-offset:2px!important}"
    ].join("");
    document.head.appendChild(style);
  }
  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;
    var helpHolder = document.querySelector(HELP_SEL);
    if (!helpHolder) return;
    var btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.tabIndex = 0;
    setButtonState(btn, "ready");
    btn.addEventListener("click", function() {
      var st = state;
      if (st && st.stopped && !st.solved) {
        log$1.log("Retrying solver...");
        startSolver(btn);
        return;
      }
      if (solverInterval || st && st.solved) return;
      log$1.log("Solver started by user");
      startSolver(btn);
    });
    var wrapper = document.createElement("div");
    wrapper.id = WRAPPER_ID;
    wrapper.className = "button-holder rs-btn-holder";
    wrapper.appendChild(btn);
    helpHolder.insertAdjacentElement("afterend", wrapper);
    log$1.log("Solve button injected");
  }
  
  if (window.location.href.includes("bframe")) {
    var log = createLogger("Recaptcha Solver");
    injectStyles();
    waitForElement(".help-button-holder", 0).then(function() {
      injectButton();
    });
    observeMutations(function() {
      if (!document.getElementById("rs-solve-btn") && document.querySelector(".help-button-holder")) {
        log.log("Button lost — re-injecting");
        injectButton();
      }
    });
  }

})();
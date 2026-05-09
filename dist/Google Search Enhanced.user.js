// ==UserScript==
// @name         Google Search Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.1.0
// @author       marmoris-x
// @description  Add Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20Search%20Enhanced.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20Search%20Enhanced.user.js
// @match        *://www.google.com/search*
// @match        *://www.google.de/search*
// @match        *://www.google.at/search*
// @match        *://www.google.ch/search*
// @match        *://www.google.fr/search*
// @match        *://www.google.co.uk/search*
// @match        *://www.google.ca/search*
// @match        *://www.google.com.au/search*
// @match        *://encrypted.google.com/search*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.createLogger = createLogger;
  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    var tag = "[" + prefix + "]";
    return {
      log: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          var args = [tag];
          for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  globalThis.TM = globalThis.TM || {};
  globalThis.TM.dom = {
    waitForElement,
    debounce,
    throttle,
    observeMutations
  };
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 1e4;
    root = root || document.body;
    return new Promise(function(resolve, reject) {
      var existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      var timer;
      var observer = new MutationObserver(function(mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var nodes = mutations[m].addedNodes;
          for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
            if (nodes[i].matches && nodes[i].matches(selector)) {
              cleanup();
              return resolve(nodes[i]);
            }
            var child = nodes[i].querySelector && nodes[i].querySelector(selector);
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
  function debounce(fn, ms) {
    ms = ms || 200;
    var timer = 0;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(ctx, args);
      }, ms);
    };
  }
  function throttle(fn, ms) {
    ms = ms || 200;
    var last = 0;
    return function() {
      var now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }
  function observeMutations(callback, root) {
    root = root || document.body;
    var observer = new MutationObserver(function(mutations) {
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
  
  createLogger("Google Search Enhanced");
  if (!location.href.includes("tbm=isch")) {
    let addStyles = function() {
      const style = document.createElement("style");
      style.textContent = `
            /* "Open in Maps" button on the embedded map widget */
            .gss-map-btn {
                position: absolute;
                top: 10px;
                left: 10px;
                color: #3c4043;
                background: rgba(255, 255, 255, 0.92);
                padding: 7px 15px;
                z-index: 10;
                border-radius: 20px;
                text-decoration: none;
                font-family: 'Google Sans', Roboto, Arial, sans-serif;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15);
                transition: background 0.15s, color 0.15s, transform 0.15s;
            }
            .gss-map-btn:hover {
                background: #fff;
                color: #1a73e8;
                transform: scale(1.04);
            }
        `;
      document.head.appendChild(style);
    };
    const Utils = {
      getQuery: () => {
        var _a;
        return new URLSearchParams(location.search).get("q") || ((_a = document.querySelector('input[name="q"]')) == null ? void 0 : _a.value) || "";
      },
      getMapsUrl: (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}`
    };
    const NavigationModule = {
inject() {
        const query = Utils.getQuery();
        if (!query) return;
        const lists = document.querySelectorAll('div[role="list"]');
        let list = null;
        for (const l of lists) {
          const labels = [...l.querySelectorAll("span.R1QWuf")].map((s) => s.textContent.trim().toLowerCase());
          if (labels.some((t) => t === "alle" || t === "all" || t === "tout")) {
            list = l;
            break;
          }
        }
        if (!list || list.querySelector(".gss-tab")) return;
        const refItem = [...list.querySelectorAll('div[role="listitem"]')].find((el) => el.querySelector("a.C6AK7c[href]"));
        if (!refItem) return;
        const mehrItem = [...list.querySelectorAll('div[role="listitem"]')].find((el) => el.hasAttribute("jscontroller"));
        const createTab = (label, url) => {
          const item = refItem.cloneNode(true);
          item.classList.add("gss-tab");
          const inner = item.querySelector('.mXwfNd, [jsname="xBNgKe"]');
          if (inner) {
            inner.removeAttribute("aria-current");
            inner.removeAttribute("selected");
          }
          const link = item.querySelector("a.C6AK7c");
          if (link) {
            link.href = url;
            link.removeAttribute("aria-disabled");
            link.removeAttribute("jsname");
            link.removeAttribute("jsaction");
          }
          const span = item.querySelector("span.R1QWuf");
          if (span) span.textContent = label;
          return item;
        };
        const insert = (tab) => {
          if (!tab) return;
          if (mehrItem) list.insertBefore(tab, mehrItem);
          else list.appendChild(tab);
        };
        const q = encodeURIComponent(query);
        insert(createTab("Reddit", `https://www.google.com/search?q=${encodeURIComponent(query + " site:reddit.com")}`));
        insert(createTab("YouTube", `https://www.youtube.com/results?search_query=${q}`));
        {
          const existingLabels = [...list.querySelectorAll("span.R1QWuf")].map((s) => s.textContent.toLowerCase());
          if (!existingLabels.some((t) => t.includes("maps") || t.includes("karten"))) {
            insert(createTab("Maps", Utils.getMapsUrl(query)));
          }
        }
      }
    };
    const MapsModule = {
run() {
        const query = Utils.getQuery();
        if (!query) return;
        const panel = document.querySelector(".SodP3b");
        if (!panel || panel.querySelector(".gss-map-btn")) return;
        if (!panel.querySelector("div.SBzq0c.ZGYHDd, div.zMVLkf.jdQ9hc")) return;
        const btn = document.createElement("a");
        btn.className = "gss-map-btn";
        btn.textContent = "Open in Maps";
        btn.href = Utils.getMapsUrl(query);
        btn.target = "_blank";
        btn.rel = "noopener noreferrer";
        panel.appendChild(btn);
      }
    };
    const CleanerModule = {
run() {
        document.querySelectorAll('a[href^="http"]:not(.gss-clean)').forEach((l) => {
          l.removeAttribute("onmousedown");
          l.removeAttribute("ping");
          l.classList.add("gss-clean");
        });
      }
    };
    const Controller = {
init() {
        addStyles();
        this.run();
        observeMutations(debounce(() => this.run(), 200), document.body);
      },
run() {
        NavigationModule.inject();
        MapsModule.run();
        CleanerModule.run();
      }
    };
    Controller.init();
  }

})();
// ==UserScript==
// @name         Reddit Content Unlocker
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.0.0
// @author       marmoris-x
// @description  Removes NSFW popup, un-blurs content, and makes Reddit accessible
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @homepage     https://github.com/marmoris-x/tampermonkey-scripts
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.user.js
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @sandbox      JavaScript
// @grant        GM_addElement
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        window.onurlchange
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = "states";
  const DEFAULTS = {
    state: true,
nsfw: true,
spoiler: false
};
  let currentState;
  const listeners = [];
  function loadState() {
    try {
      const stored = GM_getValue(STORAGE_KEY, false);
      if (stored && typeof stored === "object") {
        return {
          state: stored.state ?? DEFAULTS.state,
          nsfw: stored.nsfw ?? DEFAULTS.nsfw,
          spoiler: stored.spoiler ?? DEFAULTS.spoiler
        };
      }
    } catch (e) {
      console.warn("[RedditUnlocker] Failed to load state, using defaults:", e);
    }
    return { ...DEFAULTS };
  }
  currentState = loadState();
  function saveState() {
    try {
      GM_setValue(STORAGE_KEY, { ...currentState });
    } catch (e) {
      console.error("[RedditUnlocker] Failed to save state:", e);
    }
  }
  const stateManager = {
getState() {
      return currentState.state;
    },
getNsfw() {
      return currentState.nsfw;
    },
getSpoiler() {
      return currentState.spoiler;
    },
getAll() {
      return { ...currentState };
    },
update(updates) {
      Object.assign(currentState, updates);
      saveState();
      notifyListeners();
    },
onChange(fn) {
      listeners.push(fn);
    }
  };
  function notifyListeners() {
    const snapshot = { ...currentState };
    for (const fn of listeners) {
      try {
        fn(snapshot);
      } catch (e) {
        console.error("[RedditUnlocker] Listener error:", e);
      }
    }
  }
  const SELECTORS = {
FACEPLATE_MODAL_BLOCKING: "faceplate-modal[blocking]",
    FACEPLATE_MODAL_ID: "faceplate-modal#blocking-modal",
    FACEPLATE_DIALOG_NSFW: 'faceplate-dialog[id*="nsfw"]',
    FACEPLATE_DIALOG_QR: 'faceplate-dialog[id*="qr"]',
    FACEPLATE_DIALOG_NSFW_QR: "faceplate-dialog#nsfw-qr-dialog",
    VIEW_IN_APP_BUTTON: '[slot="view-in-app-button"]',
DIV_PROMPT: "div.prompt",
    THUMBNAIL_SHADOW: "div.thumbnail-shadow",
    BG_MEDIA_BACKGROUND: ".bg-media-background",
BACKDROP_FILTER_FIXED: '[style*="backdrop-filter"]',
COLOR_SCRIM: '[style*="color-scrim"]',
REDDIT_APP: "shreddit-app",
ASPECT_RATIO_BLURRED: 'shreddit-aspect-ratio [slot="blurred"]',
HEADER_NAV_V2: "header.v2 > nav",
    HEADER_NAV: "header nav",
    HEADER: "header"
  };
  const ATTRS = {
    DATA_UNBLURRED: "data-unblurred",
    IS_NSFW_BLOCKED: "is-nsfw-blocked",
    BLURRED: "blurred",
    CLICKED: "clicked",
    REASON: "reason",
    BUNDLENAME: "bundlename",
    OPEN: "open"
  };
  const SLOTS = {
    BLURRED: "blurred",
    REVEALED: "revealed"
  };
  const OPACITY_CLASSES = ["opacity-30", "opacity-50"];
  const URL_PATTERNS = {
    BLUR_PARAM: /[?&]blur=\d+/g,
    FORMAT_PJPG: /[?&]format=pjpg/g,
    DOUBLE_AMPERSAND: /&&/g,
    QUESTION_AMPERSAND: /\?&/
  };
  const STYLE_PATTERNS = {
    BLUR_FILTER: /filter:\s*blur\([^)]+\)/g
  };
  const SHADOW_STYLE_IDS = {
    U_REVEAL: "u-reveal",
    UNBLUR_CSS: "unblur-css"
  };
  const BUNDLE_PATTERNS = {
    NSFW: "nsfw"
  };
  const GLOBAL_CSS = `
  faceplate-modal[blocking],
  faceplate-modal#blocking-modal,
  faceplate-dialog[id*="nsfw"],
  faceplate-dialog[id*="qr"],
  div.prompt,
  xpromo-nsfw-blocking-container a[slot="view-in-app-button"],
  div[style*="backdrop-filter: blur"] {
    display: none !important;
  }

  img {
    filter: none !important;
  }

  [slot="blurred"] img {
    opacity: 1 !important;
    filter: none !important;
  }
`;
  const MENU_CSS = `
  #menu-unblur {
    position: relative;
    display: flex;
    align-items: center;
    margin: 0 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    z-index: 9999;
  }

  #popup-toggle {
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: #ff4500;
    user-select: none;
    white-space: nowrap;
    transition: background 0.2s;
  }

  #popup-toggle:hover,
  #menu-unblur.active #popup-toggle {
    background: #e03d00;
  }

  #status-container {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #1a1a1b;
    border: 1px solid #343536;
    border-radius: 8px;
    padding: 10px 14px;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    color: #d7dadc;
  }

  #menu-unblur.active #status-container {
    display: block;
  }

  #container-toggle {
    display: flex;
    justify-content: center;
    margin-bottom: 10px;
  }

  #container-toggle label {
    cursor: pointer;
  }

  #container-toggle svg {
    width: 28px;
    height: 28px;
    fill: #ff4500;
    transition: fill 0.2s;
  }

  #container-toggle input {
    display: none;
  }

  #container-toggle input:not(:checked) + svg {
    fill: #818384;
  }

  #selected-ops {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #selected-ops label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 13px;
  }

  #selected-ops input[type="checkbox"] {
    display: none;
  }

  .slider {
    position: relative;
    display: inline-block;
    width: 34px;
    height: 18px;
    background: #343536;
    border-radius: 18px;
    flex-shrink: 0;
    transition: background 0.2s;
  }

  .slider::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }

  input[type="checkbox"]:checked + .slider {
    background: #ff4500;
  }

  input[type="checkbox"]:checked + .slider::after {
    transform: translateX(16px);
  }

  .slider-label {
    color: #d7dadc;
  }
`;
  let globalCSSInjected = false;
  let menuCSSInjected = false;
  function injectGlobalCSS() {
    if (globalCSSInjected) return;
    globalCSSInjected = true;
    const style = GM_addElement("style", {
      id: SHADOW_STYLE_IDS.UNBLUR_CSS,
      textContent: GLOBAL_CSS
    });
    document.head.appendChild(style);
  }
  function injectMenuCSS() {
    if (menuCSSInjected) return;
    menuCSSInjected = true;
    const style = GM_addElement("style", {
      textContent: MENU_CSS
    });
    document.head.appendChild(style);
  }
  const REVEAL_SHADOW_CSS = [
    `slot[name="${SLOTS.REVEALED}"]{display:block!important;opacity:1!important;height:100%!important}`,
    "div.prompt{display:none!important}"
  ].join("");
  const originalAttachShadow = Element.prototype.attachShadow;
  function patchedAttachShadow(init) {
    var _a;
    const shadowRoot = originalAttachShadow.call(this, init);
    const tagName = (_a = this.tagName) == null ? void 0 : _a.toLowerCase();
    if (tagName === "shreddit-blurred-container") {
      const style = document.createElement("style");
      style.id = SHADOW_STYLE_IDS.U_REVEAL;
      style.textContent = REVEAL_SHADOW_CSS;
      shadowRoot.appendChild(style);
    }
    return shadowRoot;
  }
  function patchAttachShadow() {
    Element.prototype.attachShadow = patchedAttachShadow;
  }
  function observeMutations(callback, root = document.body) {
    const observer2 = new MutationObserver((mutations) => {
      for (let m = 0; m < mutations.length; m++) {
        const addedNodes = mutations[m].addedNodes;
        for (let i = 0; i < addedNodes.length; i++) {
          const node = addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            callback(
node,
              observer2
            );
          }
        }
      }
    });
    observer2.observe(root, {
      childList: true,
      subtree: true
    });
    return observer2;
  }
  function debounce(fn, ms = 200) {
    let timer = 0;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fn.apply(this, args);
      }, ms);
    };
  }
  function removeAll(selector) {
    document.querySelectorAll(selector).forEach((el) => el.remove());
  }
  function reveal(el) {
    el.style.setProperty("display", "block", "important");
    el.style.setProperty("opacity", "1", "important");
    el.style.setProperty("filter", "none", "important");
    el.style.setProperty("height", "100%", "important");
  }
  function unblurImgs(root) {
    const images = root.querySelectorAll("img:not([data-unblurred])");
    images.forEach((img) => {
      img.setAttribute(ATTRS.DATA_UNBLURRED, "1");
      img.classList.remove(...OPACITY_CLASSES);
      img.style.setProperty("opacity", "1", "important");
      img.style.setProperty("filter", "none", "important");
    });
  }
  function removeImageBlur() {
    const selector = [
      'img[src*="blur="]:not([data-unblurred])',
      'img[style*="blur"]:not([data-unblurred])'
    ].join(",");
    document.querySelectorAll(selector).forEach((img) => {
      img.setAttribute(ATTRS.DATA_UNBLURRED, "1");
      if (img.src.includes("blur=")) {
        let fixed = img.src.replace(URL_PATTERNS.BLUR_PARAM, "").replace(URL_PATTERNS.FORMAT_PJPG, "").replace(URL_PATTERNS.DOUBLE_AMPERSAND, "&").replace(URL_PATTERNS.QUESTION_AMPERSAND, "?");
        if (fixed !== img.src) {
          img.src = fixed;
        }
      }
      const style = img.getAttribute("style") || "";
      if (style.includes("blur")) {
        img.setAttribute(
          "style",
          style.replace(STYLE_PATTERNS.BLUR_FILTER, "")
        );
      }
    });
  }
  function unblurCallback() {
    var _a;
    if (!stateManager.getState()) return;
    injectGlobalCSS();
    removeAll(SELECTORS.FACEPLATE_MODAL_BLOCKING);
    removeAll(SELECTORS.FACEPLATE_MODAL_ID);
    removeAll(SELECTORS.FACEPLATE_DIALOG_NSFW_QR);
    removeAll(SELECTORS.FACEPLATE_DIALOG_NSFW);
    removeAll(SELECTORS.FACEPLATE_DIALOG_QR);
    removeAll(SELECTORS.DIV_PROMPT);
    removeAll(SELECTORS.THUMBNAIL_SHADOW);
    removeAll(SELECTORS.BG_MEDIA_BACKGROUND);
    removeAll(SELECTORS.VIEW_IN_APP_BUTTON);
    document.querySelectorAll(SELECTORS.BACKDROP_FILTER_FIXED).forEach((el) => {
      if (el.style.position === "fixed") {
        el.remove();
      }
    });
    document.querySelectorAll(SELECTORS.COLOR_SCRIM).forEach((el) => {
      el.style.removeProperty("box-shadow");
      el.removeAttribute(ATTRS.OPEN);
    });
    const asyncLoaders = document.getElementsByTagName("shreddit-async-loader");
    for (const loader of [...asyncLoaders]) {
      const bundleName = loader.getAttribute(ATTRS.BUNDLENAME);
      if (bundleName == null ? void 0 : bundleName.includes(BUNDLE_PATTERNS.NSFW)) {
        loader.remove();
      }
    }
    const blurredContainers = document.getElementsByTagName("shreddit-blurred-container");
    for (const container of [...blurredContainers]) {
      const shadowRoot = container.shadowRoot;
      if (!shadowRoot || shadowRoot.querySelector("#u-reveal")) continue;
      const style = document.createElement("style");
      style.id = "u-reveal";
      style.textContent = [
        `slot[name="${SLOTS.REVEALED}"]{display:block!important;opacity:1!important;height:100%!important}`,
        "div.prompt{display:none!important}"
      ].join("");
      shadowRoot.appendChild(style);
    }
    document.querySelectorAll(`[${ATTRS.IS_NSFW_BLOCKED}]`).forEach((el) => {
      el.removeAttribute(ATTRS.IS_NSFW_BLOCKED);
    });
    document.querySelectorAll(`[${ATTRS.BLURRED}]`).forEach((el) => {
      el.removeAttribute(ATTRS.BLURRED);
    });
    const state = stateManager.getAll();
    for (const blurred of [...blurredContainers]) {
      const reason = blurred.getAttribute(ATTRS.REASON);
      if (reason === "nsfw" && !state.nsfw) continue;
      if (reason === "spoiler" && !state.spoiler) continue;
      blurred.removeAttribute(ATTRS.BLURRED);
      blurred.setAttribute(ATTRS.CLICKED, "");
      try {
        blurred.click();
      } catch (e) {
      }
      try {
        (_a = blurred.firstElementChild) == null ? void 0 : _a.click();
      } catch (e) {
      }
      const blurredSlot = blurred.querySelector(`[slot="${SLOTS.BLURRED}"]`);
      const revealedSlot = blurred.querySelector(`[slot="${SLOTS.REVEALED}"]`);
      if (revealedSlot) {
        blurredSlot == null ? void 0 : blurredSlot.style.setProperty("display", "none", "important");
        reveal(revealedSlot);
      } else if (blurredSlot) {
        reveal(blurredSlot);
        unblurImgs(blurredSlot);
      }
      const sr = blurred.shadowRoot;
      if (sr && !sr.querySelector('slot[name="blurred"]') && sr.querySelector('slot[name="revealed"]')) {
        const lightBlurred = blurred.querySelector(`[slot="${SLOTS.BLURRED}"]`);
        if (lightBlurred) {
          lightBlurred.setAttribute("slot", SLOTS.REVEALED);
        }
      }
    }
    document.querySelectorAll(SELECTORS.ASPECT_RATIO_BLURRED).forEach((el) => {
      reveal(el);
      unblurImgs(el);
    });
    removeImageBlur();
    document.body.style.removeProperty("overflow");
    document.documentElement.style.removeProperty("overflow");
  }
  let menuElement = null;
  let initialized = false;
  const POWER_ICON_SVG = `
  <svg viewBox="0 0 24 24">
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V3ZM8.6092 5.8744C9.09211 5.60643 9.26636 4.99771 8.99839 4.5148C8.73042 4.03188 8.12171 3.85763 7.63879 4.1256C4.87453 5.65948 3 8.61014 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 8.66747 19.1882 5.75928 16.5007 4.20465C16.0227 3.92811 15.4109 4.09147 15.1344 4.56953C14.8579 5.04759 15.0212 5.65932 15.4993 5.93586C17.5942 7.14771 19 9.41027 19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 9.3658 6.45462 7.06997 8.6092 5.8744Z">
    </path>
  </svg>`;
  function initMenu() {
    if (initialized) return;
    initialized = true;
    const navTarget = document.querySelector(SELECTORS.HEADER_NAV_V2) || document.querySelector(SELECTORS.HEADER_NAV) || document.querySelector(SELECTORS.HEADER) || document.body;
    menuElement = GM_addElement(navTarget, "div", {
      id: "menu-unblur"
    });
    menuElement.innerHTML = getMenuHTML();
    menuElement.addEventListener("click", (e) => {
      const target = (
e.target
      );
      if (target.id === "menu" || target.id === "popup-toggle") {
        menuElement.classList.toggle("active");
      }
    });
    bindFormControls();
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("click", (e) => {
      if (e.target.closest("media-telemetry-observer")) {
        e.preventDefault();
      }
    });
  }
  function getMenuHTML() {
    return `
    <div id="popup-toggle">Unblur</div>
    <form id="status-container">
      <div id="status"></div>
      <div id="container-toggle">
        <label for="toggle">
          <input id="toggle" name="toggle" type="checkbox">
          ${POWER_ICON_SVG}
        </label>
      </div>
      <div id="selected-ops">
        <label for="toggle-nsfw">
          <input type="checkbox" name="toggle-nsfw" id="toggle-nsfw">
          <span class="slider"></span>
          <span class="slider-label">Unblur NSFW</span>
        </label>
        <label for="toggle-spoiler">
          <input type="checkbox" name="toggle-spoiler" id="toggle-spoiler">
          <span class="slider"></span>
          <span class="slider-label">Unblur Spoiler</span>
        </label>
      </div>
    </form>
  `;
  }
  function bindFormControls() {
    const toggle = (
document.getElementById("toggle")
    );
    const toggleNSFW = (
document.getElementById("toggle-nsfw")
    );
    const toggleSpoiler = (
document.getElementById("toggle-spoiler")
    );
    const form = (
document.getElementById("status-container")
    );
    if (!toggle || !toggleNSFW || !toggleSpoiler || !form) return;
    const state = stateManager.getAll();
    toggle.checked = state.state;
    toggleNSFW.checked = state.nsfw;
    toggleSpoiler.checked = state.spoiler;
    form.addEventListener("change", () => {
      stateManager.update({
        state: toggle.checked,
        nsfw: toggleNSFW.checked,
        spoiler: toggleSpoiler.checked
      });
    });
  }
  function handleClickOutside(e) {
    if (!menuElement) return;
    const target = (
e.target
    );
    if (!target.closest("#menu-unblur") && menuElement.classList.contains("active")) {
      menuElement.classList.remove("active");
    }
  }
  let observer = null;
  let menuInitialized = false;
  function registerBoot() {
    patchAttachShadow();
    injectGlobalCSS();
    const debouncedCallback = debounce(handleMutations, 150);
    observer = observeMutations(debouncedCallback, document);
    window.addEventListener("urlchange", onUrlChange);
    setTimeout(() => {
      if (!document.querySelector(SELECTORS.REDDIT_APP)) {
        observer == null ? void 0 : observer.disconnect();
      }
    }, 8e3);
  }
  function handleMutations(_node, _obs) {
    if (!menuInitialized) {
      menuInitialized = true;
      injectMenuCSS();
      initMenu();
    }
    if (!stateManager.getState()) return;
    unblurCallback();
  }
  function onUrlChange() {
    if (stateManager.getState()) {
      unblurCallback();
    }
  }
  
  registerBoot();

})();
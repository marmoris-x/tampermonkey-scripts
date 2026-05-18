// ==UserScript==
// @name         Reddit Content Unlocker
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.4.0
// @author       marmoris-x
// @description  Removes NSFW popup, un-blurs content, and makes Reddit accessible
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @homepage     https://github.com/marmoris-x/tampermonkey-scripts
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Reddit%20Content%20Unlocker.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Reddit%20Content%20Unlocker.user.js
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @match        https://old.reddit.com/*
// @grant        window.onurlchange
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const SELECTORS = {
FACEPLATE_MODAL_BLOCKING: "faceplate-modal[blocking]",
    FACEPLATE_MODAL_ID: "faceplate-modal#blocking-modal",
    FACEPLATE_DIALOG_NSFW: 'faceplate-dialog[id*="nsfw"]',
    FACEPLATE_DIALOG_QR: 'faceplate-dialog[id*="qr"]',
    FACEPLATE_DIALOG_NSFW_QR: "faceplate-dialog#nsfw-qr-dialog",
RPL_DIALOG_BLOCKING: "rpl-dialog[blocking]",
    AUTH_FLOW_MANAGER: "auth-flow-manager",
    VIEW_IN_APP_BUTTON: '[slot="view-in-app-button"]',
DIV_PROMPT: "div.prompt",
    THUMBNAIL_SHADOW: "div.thumbnail-shadow",
    BG_MEDIA_BACKGROUND: ".bg-media-background",
BACKDROP_FILTER_FIXED: '[style*="backdrop-filter"]',
COLOR_SCRIM: '[style*="color-scrim"]',
REDDIT_APP: "shreddit-app",
ASPECT_RATIO_BLURRED: 'shreddit-aspect-ratio [slot="blurred"]'
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
  div[style*="backdrop-filter: blur"],
  rpl-dialog[blocking],
  rpl-dialog[open],
  auth-flow-manager {
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
  let globalCSSInjected = false;
  function injectGlobalCSS() {
    if (globalCSSInjected) return;
    globalCSSInjected = true;
    const style = document.createElement("style");
    style.id = SHADOW_STYLE_IDS.UNBLUR_CSS;
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
  }
  const REVEAL_SHADOW_CSS = [
    `slot[name="${SLOTS.BLURRED}"]{display:none!important}`,
    `slot[name="${SLOTS.REVEALED}"]{display:block!important;opacity:1!important;height:100%!important}`,
    "div.prompt{display:none!important}"
  ].join("");
  const PROMPT_HIDE_CSS = "div.prompt{display:none!important}";
  const originalAttachShadow = Element.prototype.attachShadow;
  function patchedAttachShadow(init) {
    var _a;
    const shadowRoot = originalAttachShadow.call(this, init);
    const style = document.createElement("style");
    const tagName = (_a = this.tagName) == null ? void 0 : _a.toLowerCase();
    if (tagName === "shreddit-blurred-container") {
      style.id = SHADOW_STYLE_IDS.U_REVEAL;
      style.textContent = REVEAL_SHADOW_CSS;
    } else {
      style.textContent = PROMPT_HIDE_CSS;
    }
    shadowRoot.appendChild(style);
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
      const st = img.getAttribute("style") || "";
      if (st.includes("blur")) {
        img.setAttribute("style", st.replace(STYLE_PATTERNS.BLUR_FILTER, ""));
      }
    });
  }
  const PREFIX = "[RedditUnlocker]";
  let enabled = false;
  function enable() {
    enabled = true;
  }
  function logPhase(phase, action, detail) {
    if (!enabled) return;
    const color = detail && detail !== "0" && detail !== "" ? "#22c55e" : "#9ca3af";
    console.log(
      `${PREFIX} %c[${phase}]`,
      `color:${color};font-weight:bold`,
      action,
      detail || ""
    );
  }
  function scanRemaining() {
    if (!enabled) return;
    const suspects = [];
    document.querySelectorAll("*").forEach((el) => {
      var _a, _b, _c, _d, _e, _f;
      if (el.nodeType !== 1) return;
      const tag = (_a = el.tagName) == null ? void 0 : _a.toLowerCase();
      if (["script", "style", "slot", "template"].includes(tag)) return;
      const ariaModal = el.getAttribute("aria-modal");
      const role = el.getAttribute("role");
      const partStr = el.getAttribute("part") || "";
      const cls = typeof el.className === "string" ? el.className : "";
      const isFixed = ((_b = el.style) == null ? void 0 : _b.position) === "fixed";
      const isBlocking = (_c = el.hasAttribute) == null ? void 0 : _c.call(el, "blocking");
      const isOpen = (_d = el.hasAttribute) == null ? void 0 : _d.call(el, "open");
      const hasOverlay = cls.includes("overlay") || partStr.includes("overlay") || tag.includes("overlay");
      const hasDialog = cls.includes("dialog") || partStr.includes("dialog") || role === "dialog" || tag.includes("dialog");
      const isVisible = el.offsetParent !== null;
      if ((ariaModal === "true" || role === "dialog" || isBlocking || isOpen || isFixed) && (isVisible || hasOverlay || hasDialog)) {
        const sr = el.shadowRoot;
        let shadowChildren = [];
        if (sr) {
          sr.querySelectorAll("*").forEach((c) => {
            var _a2;
            const ct = (_a2 = c.tagName) == null ? void 0 : _a2.toLowerCase();
            if (ct && ct.includes("-") && !shadowChildren.includes(ct)) shadowChildren.push(ct);
          });
        }
        suspects.push({
          tag,
          id: el.id || "",
          class: cls.substring(0, 300),
          "aria-modal": ariaModal,
          role,
          part: partStr,
          blocking: isBlocking,
          open: isOpen,
          visible: isVisible,
          fixed: isFixed,
          hasShadow: !!sr,
          shadowChildren,
          text: (el.textContent || "").substring(0, 300).replace(/\s+/g, " ").trim(),
          parentTag: ((_f = (_e = el.parentElement) == null ? void 0 : _e.tagName) == null ? void 0 : _f.toLowerCase()) || ""
        });
      }
    });
    if (suspects.length > 0) {
      console.log(
        `${PREFIX} %c[REMAINING] %c${suspects.length} potenziell blockierend:`,
        "color:#f87171;font-weight:bold",
        "color:#f87171"
      );
      suspects.forEach((s, i) => {
        console.log(
          `${PREFIX}   #${i + 1}`,
          JSON.stringify(s, ["tag", "id", "class", "aria-modal", "role", "part", "blocking", "visible", "fixed", "open", "parentTag", "shadowChildren", "text"], 2)
        );
      });
    } else {
      console.log(
        `${PREFIX} %c[REMAINING] %ckeine blockierenden Elemente gefunden`,
        "color:#22c55e;font-weight:bold",
        "color:#22c55e"
      );
    }
    return suspects;
  }
  function unblurCallback() {
    var _a;
    injectGlobalCSS();
    logPhase("Ph1", "Modals/Dialogs...");
    const p1 = [
      [SELECTORS.FACEPLATE_MODAL_BLOCKING, "FACEPLATE_MODAL_BLOCKING"],
      [SELECTORS.FACEPLATE_MODAL_ID, "FACEPLATE_MODAL_ID"],
      [SELECTORS.FACEPLATE_DIALOG_NSFW_QR, "FACEPLATE_DIALOG_NSFW_QR"],
      [SELECTORS.FACEPLATE_DIALOG_NSFW, "FACEPLATE_DIALOG_NSFW"],
      [SELECTORS.FACEPLATE_DIALOG_QR, "FACEPLATE_DIALOG_QR"],
      [SELECTORS.RPL_DIALOG_BLOCKING, "RPL_DIALOG_BLOCKING"],
      [SELECTORS.AUTH_FLOW_MANAGER, "AUTH_FLOW_MANAGER"]
    ];
    for (const [sel, name] of p1) {
      const n = document.querySelectorAll(sel).length;
      if (n > 0) logPhase("Ph1", `removing ${name}`, n);
      removeAll(sel);
    }
    logPhase("Ph2", "Overlays...");
    const p2 = [
      [SELECTORS.DIV_PROMPT, "DIV_PROMPT"],
      [SELECTORS.THUMBNAIL_SHADOW, "THUMBNAIL_SHADOW"],
      [SELECTORS.BG_MEDIA_BACKGROUND, "BG_MEDIA_BACKGROUND"],
      [SELECTORS.VIEW_IN_APP_BUTTON, "VIEW_IN_APP_BUTTON"]
    ];
    for (const [sel, name] of p2) {
      const n = document.querySelectorAll(sel).length;
      if (n > 0) logPhase("Ph2", `removing ${name}`, n);
      removeAll(sel);
    }
    logPhase("Ph3", "backdrop-filter fixed...");
    let removedBd = 0;
    document.querySelectorAll(SELECTORS.BACKDROP_FILTER_FIXED).forEach((el) => {
      if (el.style.position === "fixed") {
        el.remove();
        removedBd++;
      }
    });
    if (removedBd > 0) logPhase("Ph3", "removed fixed overlays", removedBd);
    logPhase("Ph4", "color-scrim...");
    document.querySelectorAll(SELECTORS.COLOR_SCRIM).forEach((el) => {
      el.style.removeProperty("box-shadow");
      el.removeAttribute(ATTRS.OPEN);
    });
    logPhase("Ph4", "cleaned");
    logPhase("Ph5", "NSFW async loaders...");
    const asyncLoaders = document.getElementsByTagName("shreddit-async-loader");
    let removedAsync = 0;
    for (const loader of [...asyncLoaders]) {
      const bundleName = loader.getAttribute(ATTRS.BUNDLENAME);
      if (bundleName == null ? void 0 : bundleName.includes(BUNDLE_PATTERNS.NSFW)) {
        loader.remove();
        removedAsync++;
      }
    }
    if (removedAsync > 0) logPhase("Ph5", "removed NSFW loaders", removedAsync);
    logPhase("Ph6", "shadow root patching...");
    let patchedCount = 0;
    const blurredContainers = document.getElementsByTagName("shreddit-blurred-container");
    for (const container of [...blurredContainers]) {
      const shadowRoot = container.shadowRoot;
      if (!shadowRoot || shadowRoot.querySelector("#u-reveal")) continue;
      const style = document.createElement("style");
      style.id = "u-reveal";
      style.textContent = [
        `slot[name="${SLOTS.BLURRED}"]{display:none!important}`,
        `slot[name="${SLOTS.REVEALED}"]{display:block!important;opacity:1!important;height:100%!important}`,
        "div.prompt{display:none!important}"
      ].join("");
      shadowRoot.appendChild(style);
      patchedCount++;
    }
    if (patchedCount > 0) logPhase("Ph6", "patched containers", patchedCount);
    logPhase("Ph7", "removing attributes...");
    let removedNsfl = 0;
    document.querySelectorAll(`[${ATTRS.IS_NSFW_BLOCKED}]`).forEach((el) => {
      el.removeAttribute(ATTRS.IS_NSFW_BLOCKED);
      removedNsfl++;
    });
    if (removedNsfl > 0) logPhase("Ph7", "is-nsfw-blocked", removedNsfl);
    document.querySelectorAll(`[${ATTRS.BLURRED}]`).forEach((el) => {
      el.removeAttribute(ATTRS.BLURRED);
    });
    logPhase("Ph8", "click-through blurred...");
    let blurredDone = 0;
    for (const blurred of [...blurredContainers]) {
      const reason = blurred.getAttribute(ATTRS.REASON);
      logPhase("Ph8", "reason=" + reason);
      blurred.removeAttribute(ATTRS.BLURRED);
      blurred.setAttribute(ATTRS.CLICKED, "");
      try {
        blurred.click();
      } catch {
      }
      try {
        (_a = blurred.firstElementChild) == null ? void 0 : _a.click();
      } catch {
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
      blurredDone++;
    }
    if (blurredDone > 0) logPhase("Ph8", "processed containers", blurredDone);
    logPhase("Ph9", "aspect-ratio blurred...");
    let arCount = 0;
    document.querySelectorAll(SELECTORS.ASPECT_RATIO_BLURRED).forEach((el) => {
      reveal(el);
      unblurImgs(el);
      arCount++;
    });
    if (arCount > 0) logPhase("Ph9", "revealed", arCount);
    logPhase("Ph10", "image blur removal...");
    removeImageBlur();
    logPhase("Ph10", "done");
    logPhase("Ph11", "restore scroll...");
    if (document.body) {
      document.body.style.removeProperty("overflow");
    }
    if (document.documentElement) {
      document.documentElement.style.removeProperty("overflow");
    }
    logPhase("Ph11", "done");
    scanRemaining();
  }
  const SEG_POST_CODES = [99, 111, 109, 109, 101, 110, 116, 115];
  const SEG_TYPE_IDX = 2;
  const SOURCE_HOSTS = ["www.reddit.com", "sh.reddit.com"];
  const OLD_HOST = "old.reddit.com";
  function extractPostInfo(url) {
    try {
      const parsed = new URL(url);
      if (!SOURCE_HOSTS.includes(parsed.hostname)) return null;
      const path = parsed.pathname;
      const segments = path.split("/").filter(Boolean);
      if (segments.length < 4) return null;
      if (segments[0].toLowerCase() !== "r") return null;
      if (segments[SEG_TYPE_IDX].length !== SEG_POST_CODES.length) return null;
      for (let i = 0; i < SEG_POST_CODES.length; i++) {
        if (segments[SEG_TYPE_IDX].charCodeAt(i) !== SEG_POST_CODES[i]) {
          return null;
        }
      }
      if (!/^[a-z0-9]+$/i.test(segments[3])) return null;
      if (segments.includes("media") || segments.includes("gallery")) return null;
      return { subreddit: segments[1], postId: segments[3] };
    } catch {
      return null;
    }
  }
  function performRedirect(url) {
    const newUrl = url.replace(/^https?:\/\/(www|sh)\.reddit\.com/, `https://${OLD_HOST}`);
    if (newUrl !== url) {
      location.replace(newUrl);
    }
  }
  async function checkNsfw(subreddit, postId, timeoutMs = 3e3) {
    var _a, _b, _c, _d, _e;
    const apiUrl = `/r/${encodeURIComponent(subreddit)}/comments/${encodeURIComponent(postId)}/.json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(apiUrl, { signal: controller.signal });
      if (!response.ok) return false;
      const data = await response.json();
      return ((_e = (_d = (_c = (_b = (_a = data == null ? void 0 : data[0]) == null ? void 0 : _a.data) == null ? void 0 : _b.children) == null ? void 0 : _c[0]) == null ? void 0 : _d.data) == null ? void 0 : _e.over_18) === true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  function setupSPAListener() {
    const w = (
window
    );
    if (w.onurlchange === null) {
      window.addEventListener("urlchange", (info) => {
        const evt = info;
        const postInfo = extractPostInfo(evt.url);
        if (!postInfo) return;
        checkNsfw(postInfo.subreddit, postInfo.postId).then((isNsfw) => {
          if (isNsfw) {
            performRedirect(evt.url);
          }
        });
      });
    }
  }
  function handleAgeGate() {
    document.cookie = "over18=1; domain=.reddit.com; path=/; max-age=31536000";
    const clickAgeGate = () => {
      const buttons = document.querySelectorAll(
        '.c-btn-primary, button, input[type="submit"], a[href*="over18"]'
      );
      for (const btn of buttons) {
        const text = (btn.textContent || btn.value || "").toLowerCase();
        if (/continue|over\s*18|yes|confirm/i.test(text)) {
          btn.click();
          return;
        }
      }
    };
    if (document.body) {
      clickAgeGate();
    } else {
      document.addEventListener("DOMContentLoaded", clickAgeGate, { once: true });
    }
  }
  let observer = null;
  function registerBoot() {
    enable();
    if (location.hostname === "old.reddit.com") {
      handleAgeGate();
      return;
    }
    const postInfo = extractPostInfo(location.href);
    const nsfwPromise = postInfo ? checkNsfw(postInfo.subreddit, postInfo.postId) : Promise.resolve(false);
    patchAttachShadow();
    injectPromptCSS();
    injectGlobalCSS();
    const debouncedCallback = debounce(handleMutations, 150);
    observer = observeMutations(debouncedCallback, document);
    unblurCallback();
    document.addEventListener("DOMContentLoaded", () => {
      unblurCallback();
    }, { once: true });
    setTimeout(() => {
      unblurCallback();
    }, 1500);
    setTimeout(() => {
      if (!document.querySelector(SELECTORS.REDDIT_APP)) {
        observer == null ? void 0 : observer.disconnect();
      }
    }, 8e3);
    setupSPAListener();
    nsfwPromise.then((isNsfw) => {
      if (isNsfw) {
        performRedirect(location.href);
      }
    });
  }
  function injectPromptCSS() {
    document.querySelectorAll("*").forEach((el) => {
      const sr = el.shadowRoot;
      if (!sr) return;
      for (const child of sr.children) {
        if (child.tagName === "STYLE" && child.textContent.includes("div.prompt{display:none}")) {
          return;
        }
      }
      if (sr.querySelector("div.prompt")) {
        const s = document.createElement("style");
        s.textContent = "div.prompt{display:none!important}";
        sr.appendChild(s);
      }
    });
  }
  function handleMutations(_node, _obs) {
    unblurCallback();
  }
  
  registerBoot();

})();
// ==UserScript==
// @name         Google AI Studio Chat Exporter
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.3.0
// @author       marmoris-x
// @description  Chat exporter in settings sidebar + native mic dialog repositioned & non-blocking
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20AI%20Studio%20Chat%20Exporter.meta.js
// @match        https://aistudio.google.com/*
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
  function createToast(message, opts) {
    opts = opts || {};
    var duration = opts.duration || 3e3;
    var type = opts.type || "info";
    var colors = { info: "#2196F3", success: "#4CAF50", error: "#F44336", warn: "#FF9800" };
    var toast = document.createElement("div");
    var root = toast.attachShadow({ mode: "closed" });
    var style2 = document.createElement("style");
    style2.textContent = [
      ":host { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:2147483647;",
      "background:" + (colors[type] || colors.info) + "; color:#fff; padding:10px 20px; border-radius:6px;",
      "font:13px/1.4 system-ui,sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.3);",
      "opacity:0; transition:opacity 0.3s ease; pointer-events:none; max-width:80vw; }",
      ":host(.show) { opacity:1; }"
    ].join("");
    var span = document.createElement("span");
    span.textContent = message;
    root.appendChild(style2);
    root.appendChild(span);
    document.body.appendChild(toast);
    requestAnimationFrame(function() {
      toast.classList.add("show");
    });
    setTimeout(function() {
      toast.classList.remove("show");
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
    return toast;
  }
  var HEADING_TAGS = { "H1": "#", "H2": "##", "H3": "###", "H4": "####", "H5": "#####", "H6": "######" };
  function htmlToMarkdown(el) {
    if (!el) return "";
    var out = "";
    walk(el);
    return out.trim().replace(/\n{3,}/g, "\n\n");
    function walk(node) {
      if (!node) return;
      var children = node.childNodes;
      if (!children || children.length === 0) {
        if (node.nodeType === Node.TEXT_NODE) {
          var text = node.textContent.replace(/\s+/g, " ");
          if (text && text !== " ") out += text;
        }
        return;
      }
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === Node.TEXT_NODE) {
          var t = child.textContent.replace(/\s+/g, " ");
          if (t && t !== " ") out += t;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        var tag = child.tagName.toUpperCase();
        if (tag === "BR") {
          out += "\n";
          continue;
        }
        if (tag === "HR") {
          out += "\n\n---\n\n";
          continue;
        }
        if (HEADING_TAGS[tag]) {
          out += "\n\n" + HEADING_TAGS[tag] + " ";
          walk(child);
          out += "\n\n";
          continue;
        }
        if (tag === "P" || tag === "DIV") {
          out += "\n\n";
          walk(child);
          out += "\n\n";
          continue;
        }
        if (tag === "PRE") {
          out += "\n\n```\n" + (child.textContent || "") + "\n```\n\n";
          continue;
        }
        if (tag === "BLOCKQUOTE") {
          out += "\n\n> ";
          walkInline(child);
          out += "\n\n";
          continue;
        }
        if (tag === "UL" || tag === "OL") {
          out += "\n\n";
          walkList(child, tag === "OL", 1);
          out += "\n\n";
          continue;
        }
        if (tag === "TABLE") {
          out += "\n\n";
          walkTable(child);
          out += "\n\n";
          continue;
        }
        if (tag === "IMG") {
          var src = child.getAttribute("src") || "";
          var alt = child.getAttribute("alt") || "";
          out += "![" + alt + "](" + src + ")";
          continue;
        }
        if (tag === "STRONG" || tag === "B") {
          out += "**";
          walk(child);
          out += "**";
          continue;
        }
        if (tag === "EM" || tag === "I") {
          out += "*";
          walk(child);
          out += "*";
          continue;
        }
        if (tag === "CODE") {
          out += "`" + (child.textContent || "") + "`";
          continue;
        }
        if (tag === "A") {
          var href = child.getAttribute("href") || "";
          out += "[";
          walk(child);
          out += "](" + href + ")";
          continue;
        }
        if (tag === "DEL" || tag === "S") {
          out += "~~";
          walk(child);
          out += "~~";
          continue;
        }
        if (tag === "U") {
          out += "<u>";
          walk(child);
          out += "</u>";
          continue;
        }
        walk(child);
      }
    }
    function walkInline(node) {
      if (!node) return;
      var children = node.childNodes;
      if (!children) return;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.textContent;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        var tag = child.tagName.toUpperCase();
        if (tag === "STRONG" || tag === "B") {
          out += "**";
          walkInline(child);
          out += "**";
        } else if (tag === "EM" || tag === "I") {
          out += "*";
          walkInline(child);
          out += "*";
        } else if (tag === "CODE") {
          out += "`" + (child.textContent || "") + "`";
        } else if (tag === "A") {
          var href = child.getAttribute("href") || "";
          out += "[";
          walkInline(child);
          out += "](" + href + ")";
        } else if (tag === "BR") {
          out += " ";
        } else if (tag === "IMG") {
          var src = child.getAttribute("src") || "";
          var alt = child.getAttribute("alt") || "";
          out += "![" + alt + "](" + src + ")";
        } else {
          walkInline(child);
        }
      }
    }
    function walkList(node, ordered, depth) {
      var items = node.querySelectorAll(":scope > li");
      for (var i = 0; i < items.length; i++) {
        var prefix = ordered ? i + 1 + ". " : "- ";
        out += "  ".repeat(depth - 1) + prefix;
        walkInline(items[i]);
        out += "\n";
      }
    }
    function walkTable(node) {
      var rows = node.querySelectorAll("tr");
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].querySelectorAll("td, th");
        out += "| ";
        for (var c = 0; c < cells.length; c++) {
          walkInline(cells[c]);
          out += " | ";
        }
        out += "\n";
        if (r === 0) {
          out += "| ";
          for (c = 0; c < cells.length; c++) {
            out += "--- | ";
          }
          out += "\n";
        }
      }
    }
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
  // @license      MIT
  var { log } = createLogger("Google AI Studio Chat Exporter");
  var style = document.createElement("style");
  style.textContent = [
    "/* Native mic dialog: non-blocking, repositioned to bottom-left */",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-backdrop {",
    "    pointer-events: none !important;",
    "    backdrop-filter: none !important;",
    "    -webkit-backdrop-filter: none !important;",
    "    background: transparent !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-global-overlay-wrapper {",
    "    justify-content: flex-start !important;",
    "    align-items: flex-end !important;",
    "    padding: 0 0 80px 16px !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-pane {",
    "    pointer-events: auto !important;",
    "    width: 280px !important;",
    "    height: auto !important;",
    "    min-width: 0 !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-container {",
    "    --mdc-dialog-container-shape: 12px;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-title {",
    "    padding: 12px 16px 8px !important;",
    "    font-size: 14px !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-content {",
    "    padding: 0 16px !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) ms-mic-audio-canvas {",
    "    display: flex;",
    "    justify-content: center;",
    "    padding: 8px 0;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .recording-outer-ring {",
    "    width: 60px !important;",
    "    height: 60px !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .recording-indicator {",
    "    width: 36px !important;",
    "    height: 36px !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .recording-pulse {",
    "    width: 60px !important;",
    "    height: 60px !important;",
    "}",
    ".cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-actions {",
    "    padding: 8px 16px 12px !important;",
    "    min-height: 0 !important;",
    "}",
    "",
    "/* Remove backdrop blur from all other CDK dialogs too */",
    ".dialog-backdrop-blur-overlay.cdk-overlay-backdrop-showing {",
    "    backdrop-filter: none !important;",
    "    -webkit-backdrop-filter: none !important;",
    "    background: rgba(0, 0, 0, 0.20) !important;",
    "}",
    "",
    "/* Sidebar section */",
    "#ais-export-section {",
    "    padding: 0 16px 20px;",
    '    font-family: "Google Sans", Roboto, sans-serif;',
    "}",
    "#ais-export-section .ais-divider {",
    "    height: 1px;",
    "    background: var(--mat-divider-color, rgba(255,255,255,0.12));",
    "    margin: 0 -16px;",
    "}",
    "#ais-export-section .ais-header {",
    "    display: flex;",
    "    align-items: center;",
    "    gap: 6px;",
    "    padding: 14px 0 8px;",
    "    font-size: 11px;",
    "    font-weight: 600;",
    "    letter-spacing: 0.08em;",
    "    text-transform: uppercase;",
    "    color: var(--mat-sys-on-surface-variant, rgba(232,234,237,0.5));",
    "}",
    "#ais-export-section .ais-header .material-symbols-outlined {",
    "    font-size: 15px;",
    "    line-height: 1;",
    "}",
    "#ais-export-section .ais-row {",
    "    display: flex;",
    "    align-items: center;",
    "    justify-content: space-between;",
    "    padding: 5px 0;",
    "    min-height: 36px;",
    "}",
    "#ais-export-section .ais-label {",
    "    font-size: 13px;",
    "    color: var(--mat-sys-on-surface, #e8eaed);",
    "}",
    "",
    "/* Toggle pill */",
    ".ais-toggle {",
    "    position: relative;",
    "    width: 36px;",
    "    height: 20px;",
    "    border-radius: 10px;",
    "    border: none;",
    "    cursor: pointer;",
    "    padding: 0;",
    "    flex-shrink: 0;",
    "    transition: background 0.2s;",
    "    background: var(--mat-sys-surface-variant, rgba(255,255,255,0.20));",
    "}",
    ".ais-toggle.on { background: var(--mat-sys-primary, #8ab4f8); }",
    ".ais-toggle::after {",
    '    content: "";',
    "    position: absolute;",
    "    top: 3px; left: 3px;",
    "    width: 14px; height: 14px;",
    "    border-radius: 50%;",
    "    background: white;",
    "    box-shadow: 0 1px 3px rgba(0,0,0,0.35);",
    "    transition: transform 0.2s;",
    "}",
    ".ais-toggle.on::after { transform: translateX(16px); }",
    "",
    "/* Copy buttons */",
    "#ais-export-section .ais-btn-row {",
    "    display: flex;",
    "    gap: 8px;",
    "    padding-top: 8px;",
    "}",
    "#ais-export-section .ais-copy-btn {",
    "    flex: 1;",
    "    padding: 7px 8px;",
    "    border-radius: 8px;",
    "    border: 1px solid var(--mat-sys-outline-variant, rgba(255,255,255,0.18));",
    "    background: transparent;",
    "    color: var(--mat-sys-on-surface, #e8eaed);",
    "    font-size: 12px;",
    "    font-weight: 500;",
    "    font-family: inherit;",
    "    cursor: pointer;",
    "    display: flex;",
    "    align-items: center;",
    "    justify-content: center;",
    "    transition: background 0.15s, border-color 0.15s, color 0.15s;",
    "    white-space: nowrap;",
    "}",
    "#ais-export-section .ais-copy-btn:hover {",
    "    background: var(--mat-sys-surface-variant, rgba(255,255,255,0.08));",
    "    border-color: var(--mat-sys-primary, #8ab4f8);",
    "}",
    "#ais-export-section .ais-copy-btn.done {",
    "    background: rgba(76,175,80,0.15);",
    "    border-color: #4caf50;",
    "    color: #4caf50;",
    "}"
  ].join("\n");
  document.head.appendChild(style);
  var includeThoughts = true;
  function getThoughts(turnEl) {
    var thoughtChunk = turnEl.querySelector("ms-thought-chunk");
    if (!thoughtChunk) return "";
    var panel = thoughtChunk.querySelector("mat-expansion-panel:not([disabled])");
    if (!panel) return "";
    var body = panel.querySelector(".mat-expansion-panel-body");
    return body ? htmlToMarkdown(body) : "";
  }
  function getContent(turnEl) {
    var out = "";
    var chunks = turnEl.querySelectorAll("ms-text-chunk");
    for (var i = 0; i < chunks.length; i++) {
      if (chunks[i].closest("ms-thought-chunk")) continue;
      out += htmlToMarkdown(chunks[i]);
    }
    return out.trim();
  }
  function extractAllTurns() {
    var result = [];
    var turnEls = document.querySelectorAll("ms-chat-turn");
    for (var i = 0; i < turnEls.length; i++) {
      var el = turnEls[i];
      var container = el.querySelector(".virtual-scroll-container");
      if (!container) continue;
      var role = container.getAttribute("data-turn-role") || "Unknown";
      var tsEl = el.querySelector(".author-label .timestamp");
      var timestamp = tsEl ? tsEl.textContent.trim() : "";
      var thoughts = getThoughts(el);
      var content = getContent(el);
      if (!thoughts && !content) continue;
      result.push({ role, timestamp, thoughts, content });
    }
    return result;
  }
  function turnsToMarkdown(turns) {
    var lines = [];
    for (var i = 0; i < turns.length; i++) {
      var t = turns[i];
      var label = t.role === "User" ? "**User**" : "**Model**";
      var ts = t.timestamp ? " _(" + t.timestamp + ")_" : "";
      var parts = [label + ts + ":"];
      if (includeThoughts && t.thoughts) {
        parts.push("<details>\n<summary>Thinking</summary>\n\n" + t.thoughts + "\n\n</details>");
      }
      if (t.content) parts.push(t.content);
      lines.push(parts.join("\n\n"));
    }
    return lines.join("\n\n---\n\n");
  }
  function turnsToPlainText(turns) {
    return turnsToMarkdown(turns).replace(/<details>\n<summary>(.*?)<\/summary>\n\n([\s\S]*?)\n\n<\/details>/g, "[$1]\n$2").replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/gs, "$1").replace(/_(.*?)_/gs, "$1").replace(/```[\w]*\n([\s\S]*?)```/g, "$1").replace(/`(.*?)`/g, "$1").replace(/^- /gm, "• ").replace(/^> /gm, "  ").replace(/\[([^\]]+)\]/g, "$1").replace(/^---$/gm, "────────────────────────────────────────").replace(/\n{3,}/g, "\n\n").trim();
  }
  function exportChat(format) {
    var turns = extractAllTurns();
    if (!turns.length) return null;
    return format === "text" ? turnsToPlainText(turns) : turnsToMarkdown(turns);
  }
  function buildSection() {
    var wrap = document.createElement("div");
    wrap.id = "ais-export-section";
    wrap.appendChild(makeDivider());
    wrap.appendChild(makeHeader("content_copy", "Export Chat"));
    var thoughtsRow = document.createElement("div");
    thoughtsRow.className = "ais-row";
    var lbl = document.createElement("span");
    lbl.className = "ais-label";
    lbl.textContent = "Include Thoughts";
    var toggle = document.createElement("button");
    toggle.className = "ais-toggle" + (includeThoughts ? " on" : "");
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(includeThoughts));
    toggle.setAttribute("aria-label", "Include thoughts in export");
    toggle.onclick = function() {
      includeThoughts = !includeThoughts;
      toggle.classList.toggle("on", includeThoughts);
      toggle.setAttribute("aria-checked", String(includeThoughts));
    };
    thoughtsRow.appendChild(lbl);
    thoughtsRow.appendChild(toggle);
    wrap.appendChild(thoughtsRow);
    var btnRow = document.createElement("div");
    btnRow.className = "ais-btn-row";
    btnRow.appendChild(makeCopyBtn("Markdown", "Copy as Markdown", "markdown"));
    btnRow.appendChild(makeCopyBtn("Text", "Copy as plain text", "text"));
    wrap.appendChild(btnRow);
    return wrap;
  }
  function makeDivider() {
    var d = document.createElement("div");
    d.className = "ais-divider";
    return d;
  }
  function makeHeader(icon, label) {
    var h = document.createElement("div");
    h.className = "ais-header";
    h.innerHTML = '<span class="material-symbols-outlined notranslate">' + icon + "</span>" + label;
    return h;
  }
  function makeCopyBtn(label, title, format) {
    var btn = document.createElement("button");
    btn.className = "ais-copy-btn";
    btn.textContent = label;
    btn.title = title;
    btn.onclick = function() {
      handleCopy(format, btn, label);
    };
    return btn;
  }
  async function handleCopy(format, btn, origLabel) {
    var text = exportChat(format);
    if (!text) {
      createToast("Kein Chat gefunden", { type: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    var label = format === "markdown" ? "Markdown" : "Text";
    createToast(label + " kopiert — " + (text.length / 1e3).toFixed(1) + "k Zeichen", { type: "success" });
    btn.classList.add("done");
    btn.textContent = "✓";
    setTimeout(function() {
      btn.classList.remove("done");
      btn.textContent = origLabel;
    }, 2e3);
  }
  waitForElement(".scrollable-area", 0).then(function(area) {
    if (!area.querySelector("#ais-export-section")) {
      area.appendChild(buildSection());
      log("Export section injected");
    }
    observeMutations(function() {
      if (!area.querySelector("#ais-export-section")) {
        area.appendChild(buildSection());
        log("Export section re-injected");
      }
    }, area);
  });

})();
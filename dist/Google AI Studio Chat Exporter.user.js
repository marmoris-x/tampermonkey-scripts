// ==UserScript==
// @name         Google AI Studio Chat Exporter
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.5.5
// @author       marmoris-x
// @description  Export AI Studio chat as Markdown via Tampermonkey menu command; non-blocking microphone dialog
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://aistudio.google.com/
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @match        https://aistudio.google.com/*
// @tag          ai
// @grant        GM.download
// @grant        GM.getValue
// @grant        GM.notification
// @grant        GM.registerMenuCommand
// @grant        GM.setClipboard
// @grant        GM.setValue
// @grant        GM_addElement
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_setValue
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  
  (function() {
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
    const { log, warn } = createLogger("AI Studio Exporter");
    GM_addElement("style", { textContent: [
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
      "    will-change: transform;",
      "}",
      ".cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-pane {",
      "    pointer-events: auto !important;",
      "    width: 280px !important;",
      "    height: auto !important;",
      "    min-width: 0 !important;",
      "    contain: layout style;",
      "    animation: ais-mic-fade-in 0.15s ease;",
      "}",
      "@keyframes ais-mic-fade-in {",
      "    from { opacity: 0; transform: translateY(8px); }",
      "    to   { opacity: 1; transform: translateY(0); }",
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
      "/* Remove backdrop blur from CDK dialogs */",
      ".dialog-backdrop-blur-overlay.cdk-overlay-backdrop-showing {",
      "    backdrop-filter: none !important;",
      "    -webkit-backdrop-filter: none !important;",
      "    background: rgba(0, 0, 0, 0.20) !important;",
      "}"
    ].join("\n") });
    let includeThoughts = true;
    const HEADING_TAGS = { "H1": "#", "H2": "##", "H3": "###", "H4": "####", "H5": "#####", "H6": "######" };
    function htmlToMarkdown(el) {
      if (!el) return "";
      let out = "";
      walk(el);
      return out.trim().replace(/\n{3,}/g, "\n\n");
      function walk(node) {
        if (!node) return;
        const children = node.childNodes;
        if (!children || children.length === 0) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, " ");
            if (text && text !== " ") out += text;
          }
          return;
        }
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.nodeType === Node.TEXT_NODE) {
            const t = child.textContent.replace(/\s+/g, " ");
            if (t && t !== " ") out += t;
            continue;
          }
          if (child.nodeType !== Node.ELEMENT_NODE) continue;
          const tag = child.tagName.toUpperCase();
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
            const src = child.getAttribute("src") || "";
            const alt = child.getAttribute("alt") || "";
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
            const href = child.getAttribute("href") || "";
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
        const children = node.childNodes;
        if (!children) return;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.nodeType === Node.TEXT_NODE) {
            out += child.textContent;
            continue;
          }
          if (child.nodeType !== Node.ELEMENT_NODE) continue;
          const tag = child.tagName.toUpperCase();
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
            const href = child.getAttribute("href") || "";
            out += "[";
            walkInline(child);
            out += "](" + href + ")";
          } else if (tag === "BR") {
            out += " ";
          } else if (tag === "IMG") {
            const src = child.getAttribute("src") || "";
            const alt = child.getAttribute("alt") || "";
            out += "![" + alt + "](" + src + ")";
          } else {
            walkInline(child);
          }
        }
      }
      function walkList(node, ordered, depth) {
        const items = node.querySelectorAll(":scope > li");
        for (let i = 0; i < items.length; i++) {
          const prefix = ordered ? i + 1 + ". " : "- ";
          out += "  ".repeat(depth - 1) + prefix;
          walk(items[i]);
          out += "\n";
        }
      }
      function walkTable(node) {
        const rows = node.querySelectorAll("tr");
        for (let r = 0; r < rows.length; r++) {
          const cells = rows[r].querySelectorAll("td, th");
          out += "| ";
          for (let c = 0; c < cells.length; c++) {
            walkInline(cells[c]);
            out += " | ";
          }
          out += "\n";
          if (r === 0) {
            out += "| ";
            for (let c = 0; c < cells.length; c++) {
              out += "--- | ";
            }
            out += "\n";
          }
        }
      }
    }
    function getThoughts(turnEl) {
      const thoughtChunk = turnEl.querySelector("ms-thought-chunk");
      if (!thoughtChunk) return "";
      const panel = thoughtChunk.querySelector("mat-expansion-panel:not([disabled])");
      if (!panel) return "";
      const body = panel.querySelector(".mat-expansion-panel-body");
      return body ? htmlToMarkdown(body) : "";
    }
    function getContent(turnEl) {
      let out = "";
      const selectors = "ms-prompt-chunk, ms-cmark-node, ms-text-chunk";
      const chunks = turnEl.querySelectorAll(selectors);
      for (let i = 0; i < chunks.length; i++) {
        if (chunks[i].closest("ms-thought-chunk")) continue;
        out += htmlToMarkdown(chunks[i]);
      }
      return out.trim();
    }
    function extractTurn(el) {
      const container = el.querySelector(".virtual-scroll-container") || el;
      const role = container.getAttribute("data-turn-role") || "";
      if (!role) {
        const mc = el.querySelector(".model-prompt-container");
        role = mc ? "Model" : "Unknown";
      }
      const tsEl = el.querySelector(".author-label .timestamp");
      const timestamp = tsEl ? tsEl.textContent.trim() : "";
      const thoughts = getThoughts(el);
      const content = getContent(el);
      if (!thoughts && !content) return null;
      return { role, timestamp, thoughts, content };
    }
    function collectTurnIdsFromScrollbar() {
      const buttons = document.querySelectorAll(".items-scrollbar-item button");
      const ids = [];
      for (let i = 0; i < buttons.length; i++) {
        const id = buttons[i].getAttribute("aria-controls");
        if (id) ids.push(id);
      }
      return ids.length > 0 ? ids : null;
    }
    function waitForTurnElement(turnId, timeoutMs) {
      timeoutMs = timeoutMs || 5e3;
      return new Promise(function(resolve) {
        const existing = document.getElementById(turnId);
        if (existing) {
          setTimeout(resolve, 200);
          return;
        }
        const observer = new MutationObserver(function() {
          if (document.getElementById(turnId)) {
            observer.disconnect();
            setTimeout(resolve, 200);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(function() {
          observer.disconnect();
          warn("waitForTurnElement timeout: " + turnId);
          resolve();
        }, timeoutMs);
      });
    }
    async function collectTurnIdsWithRetry(maxWaitMs) {
      maxWaitMs = maxWaitMs || 3e3;
      const step = 300;
      let waited = 0;
      while (waited < maxWaitMs) {
        const ids = collectTurnIdsFromScrollbar();
        if (ids) return ids;
        await new Promise(function(r) {
          setTimeout(r, step);
        });
        waited += step;
      }
      return null;
    }
    async function extractAllTurns() {
      const turnIds = await collectTurnIdsWithRetry(3e3);
      if (!turnIds) {
        log("No scrollbar items found — using DOM-only extraction");
        const result2 = [];
        const turnEls = document.querySelectorAll("ms-chat-turn");
        for (let i = 0; i < turnEls.length; i++) {
          const data = extractTurn(turnEls[i]);
          if (data) result2.push(data);
        }
        return result2;
      }
      log("Found " + turnIds.length + " turns via scrollbar");
      const resultMap = new Map();
      const existingTurns = document.querySelectorAll("ms-chat-turn");
      for (let i = 0; i < existingTurns.length; i++) {
        const el = existingTurns[i];
        const id = el.id || (el.querySelector('[id^="turn-"]') || {}).id;
        const data = extractTurn(el);
        if (data && id) resultMap.set(id, data);
      }
      log("Pre-extracted " + resultMap.size + " already-visible turns");
      for (let i = 0; i < turnIds.length; i++) {
        const id = turnIds[i];
        if (resultMap.has(id)) continue;
        const btn = document.querySelector(
          '.items-scrollbar-item button[aria-controls="' + id + '"]'
        );
        if (!btn) {
          warn("No scrollbar button for turn: " + id);
          continue;
        }
        btn.click();
        await waitForTurnElement(id);
        const target = document.getElementById(id);
        const el = target && (target.matches("ms-chat-turn") ? target : target.closest("ms-chat-turn"));
        if (el) {
          const data = extractTurn(el);
          if (data) resultMap.set(id, data);
        } else {
          warn("Turn element not found after click: " + id);
        }
        await new Promise(function(r) {
          setTimeout(r, 100);
        });
      }
      const result = [];
      for (let i = 0; i < turnIds.length; i++) {
        const data = resultMap.get(turnIds[i]);
        if (data) result.push(data);
      }
      log("Extraction complete: " + result.length + " turns");
      return result;
    }
    function turnsToMarkdown(turns) {
      const lines = [];
      for (let i = 0; i < turns.length; i++) {
        const t = turns[i];
        const showThoughts = includeThoughts && t.thoughts;
        const showContent = t.content;
        if (!showThoughts && !showContent) continue;
        const label = t.role === "User" ? "**User**" : "**Model**";
        const ts = t.timestamp ? " _(" + t.timestamp + ")_" : "";
        const parts = [label + ts + ":"];
        if (showThoughts) {
          parts.push("<details>\n<summary>Thinking</summary>\n\n" + t.thoughts + "\n\n</details>");
        }
        if (showContent) parts.push(t.content);
        lines.push(parts.join("\n\n"));
      }
      return lines.join("\n\n---\n\n");
    }
    function turnsToPlainText(turns) {
      return turnsToMarkdown(turns).replace(/<details>\n<summary>(.*?)<\/summary>\n\n([\s\S]*?)\n\n<\/details>/g, "[$1]\n$2").replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/gs, "$1").replace(/_(.*?)_/gs, "$1").replace(/```[\w]*\n([\s\S]*?)```/g, "$1").replace(/`(.*?)`/g, "$1").replace(/^- /gm, "• ").replace(/^> /gm, "  ").replace(/\[([^\]]+)\]/g, "$1").replace(/^---$/gm, "────────────────────────────────────────").replace(/\n{3,}/g, "\n\n").trim();
    }
    async function exportChat(format) {
      const turns = await extractAllTurns();
      if (!turns.length) return null;
      const text = format === "text" ? turnsToPlainText(turns) : turnsToMarkdown(turns);
      return { text, turnCount: turns.length };
    }
    async function handleCopy() {
      const result = await exportChat("markdown");
      if (!result) {
        GM.notification({
          title: "AI Studio Exporter",
          text: "No chat turns found on this page.",
          timeout: 3e3
        });
        return;
      }
      await GM.setClipboard(result.text, { type: "text/plain" });
      const size = result.text.length >= 1e3 ? (result.text.length / 1e3).toFixed(1) + "k" : String(result.text.length);
      GM.notification({
        title: "AI Studio Exporter",
        text: `${result.turnCount} turns copied (${size} chars)`,
        timeout: 3e3
      });
    }
    async function handleDownload() {
      const result = await exportChat("markdown");
      if (!result) {
        GM.notification({
          title: "AI Studio Exporter",
          text: "No chat turns found on this page.",
          timeout: 3e3
        });
        return;
      }
      const now = new Date();
      const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      const filename = "ai-studio-chat-" + dateStr + ".md";
      const blob = new Blob([result.text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      try {
        await GM.download({ url, name: filename, saveAs: true });
      } catch (_err) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
          a.remove();
        }, 2e3);
      }
      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 3e3);
      GM.notification({
        title: "AI Studio Exporter",
        text: `${result.turnCount} turns saved as ${filename}`,
        timeout: 3e3
      });
    }
    async function handleToggleThoughts() {
      includeThoughts = !includeThoughts;
      await GM.setValue("includeThoughts", includeThoughts);
      GM.notification({
        title: "AI Studio Exporter",
        text: `Include Thoughts: ${includeThoughts ? "ON" : "OFF"}`,
        timeout: 2e3
      });
    }
    async function init() {
      includeThoughts = await GM.getValue("includeThoughts", true);
      GM.registerMenuCommand("Copy Chat as Markdown", handleCopy);
      GM.registerMenuCommand("Download Chat as Markdown", handleDownload);
      GM.registerMenuCommand("Toggle Include Thoughts", handleToggleThoughts);
      log("Ready — menu commands registered");
    }
    init();
  })();

})();
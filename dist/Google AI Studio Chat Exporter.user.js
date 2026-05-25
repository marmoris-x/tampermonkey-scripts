// ==UserScript==
// @name         Google AI Studio Chat Exporter
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.7.3
// @author       marmoris-x
// @description  Export AI Studio chat as Markdown via Tampermonkey menu command; non-blocking microphone dialog
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://aistudio.google.com/
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @match        https://aistudio.google.com/*
// @sandbox      raw
// @tag          ai
// @grant        GM.getValue
// @grant        GM.notification
// @grant        GM.registerMenuCommand
// @grant        GM.setClipboard
// @grant        GM.setValue
// @grant        GM_addElement
// @grant        GM_download
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
    const { log } = createLogger("AI Studio Exporter");
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
      function walk(node, depth) {
        depth = depth || 1;
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
            walk(child, depth);
            out += "\n\n";
            continue;
          }
          if (tag === "P" || tag === "DIV") {
            out += "\n\n";
            walk(child, depth);
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
            walkList(child, tag === "OL", depth);
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
            walk(child, depth);
            out += "**";
            continue;
          }
          if (tag === "EM" || tag === "I") {
            out += "*";
            walk(child, depth);
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
            walk(child, depth);
            out += "](" + href + ")";
            continue;
          }
          if (tag === "DEL" || tag === "S") {
            out += "~~";
            walk(child, depth);
            out += "~~";
            continue;
          }
          if (tag === "U") {
            out += "<u>";
            walk(child, depth);
            out += "</u>";
            continue;
          }
          if (tag === "SPAN") {
            const style = child.getAttribute("style") || "";
            if (style.includes("font-style: italic") || style.includes("font-style:italic")) {
              if (out.length > 0 && out[out.length - 1] !== " " && out[out.length - 1] !== "\n") {
                out += " ";
              }
              out += "*";
              walk(child, depth);
              out += "*";
            } else {
              walk(child, depth);
            }
            continue;
          }
          walk(child, depth);
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
        const items = [];
        (function collectLis(parent) {
          const ch = parent.childNodes;
          for (let c = 0; c < ch.length; c++) {
            if (ch[c].nodeType !== Node.ELEMENT_NODE) continue;
            const t = ch[c].tagName.toUpperCase();
            if (t === "LI") {
              items.push(ch[c]);
            } else if (t !== "UL" && t !== "OL") {
              collectLis(ch[c]);
            }
          }
        })(node);
        for (let i = 0; i < items.length; i++) {
          const prefix = "  ".repeat(depth - 1) + (ordered ? i + 1 + ". " : "- ");
          const before = out.length;
          walk(items[i], depth + 1);
          const itemContent = out.slice(before).trim().replace(/\n\n+/g, "\n");
          out = out.slice(0, before) + prefix + itemContent + "\n";
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
      const primary = turnEl.querySelector("ms-cmark-node");
      if (primary) return htmlToMarkdown(primary).trim();
      const raw = turnEl.querySelector(".very-large-text-container");
      if (raw) return raw.textContent.trim();
      const fallback = turnEl.querySelector("ms-prompt-chunk, ms-text-chunk");
      if (fallback) return htmlToMarkdown(fallback).trim();
      return "";
    }
    function extractTurn(el) {
      const container = el.querySelector(".virtual-scroll-container") || el;
      let role = container.getAttribute("data-turn-role") || "";
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
    async function extractAllTurns() {
      const scrollButtons = document.querySelectorAll(".items-scrollbar-item button");
      if (!scrollButtons.length) {
        log("No scrollbar items — DOM-only extraction");
        const result2 = [];
        const turnEls = document.querySelectorAll("ms-chat-turn");
        for (let i = 0; i < turnEls.length; i++) {
          const data = extractTurn(turnEls[i]);
          if (data) result2.push(data);
        }
        return result2;
      }
      log("Found " + scrollButtons.length + " scrollbar items");
      const extracted = new Map();
      function snapshotVisible() {
        const turnEls = document.querySelectorAll("ms-chat-turn");
        for (let i = 0; i < turnEls.length; i++) {
          const el = turnEls[i];
          const id = el.id || "__noid_" + i;
          if (extracted.has(id)) continue;
          const data = extractTurn(el);
          if (data) extracted.set(id, data);
        }
      }
      async function waitForRender() {
        await new Promise(function(r) {
          setTimeout(r, 500);
        });
        const deadline = Date.now() + 3e3;
        while (Date.now() < deadline) {
          const nodes = document.querySelectorAll("ms-chat-turn ms-cmark-node");
          let ready = nodes.length > 0;
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].childNodes.length === 0) {
              ready = false;
              break;
            }
          }
          if (ready) break;
          await new Promise(function(r) {
            setTimeout(r, 100);
          });
        }
        await new Promise(function(r) {
          setTimeout(r, 400);
        });
      }
      for (let i = 0; i < scrollButtons.length; i++) {
        scrollButtons[i].click();
        await waitForRender();
        snapshotVisible();
        log("Step " + (i + 1) + "/" + scrollButtons.length + " — captured " + extracted.size + " turns so far");
      }
      const result = Array.from(extracted.values());
      log("Extraction complete: " + result.length + " turns");
      return result;
    }
    function deduplicateParagraphs(markdown) {
      const blocks = markdown.split(/\n\n+/);
      const seen = new Set();
      const unique = [];
      for (let i = 0; i < blocks.length; i++) {
        const n = blocks[i].trim();
        if (!n || seen.has(n)) continue;
        seen.add(n);
        unique.push(blocks[i]);
      }
      return unique.join("\n\n");
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
          const tn = t.thoughts.replace(/\s+/g, " ").trim();
          const cn = (t.content || "").replace(/\s+/g, " ").trim();
          if (tn !== cn) {
            parts.push("<details>\n<summary>Thinking</summary>\n\n" + t.thoughts + "\n\n</details>");
          }
        }
        if (showContent) {
          parts.push(deduplicateParagraphs(t.content));
        }
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
      GM_download({
        url,
        name: filename,
        saveAs: true,
        onload: function() {
          URL.revokeObjectURL(url);
        },
        onerror: function() {
          const fallbackUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = fallbackUrl;
          a.download = filename;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          setTimeout(function() {
            a.remove();
            URL.revokeObjectURL(fallbackUrl);
          }, 2e3);
        }
      });
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
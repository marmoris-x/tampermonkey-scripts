// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      6.1
// @author       marmoris-x
// @description  Export NotebookLM sources and chat as ZIP archives
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://notebooklm.google/
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js
// @match        https://notebooklm.google.com/*
// @sandbox      JavaScript
// @grant        GM_addElement
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  let _liCache = new WeakMap();
  function getLiIndex(node) {
    let ancestor = node.parentElement;
    while (ancestor && !["ul", "ol"].includes(ancestor.tagName.toLowerCase())) {
      ancestor = ancestor.parentElement;
    }
    if (!ancestor || ancestor.tagName.toLowerCase() !== "ol") return -1;
    const cached = _liCache.get(node);
    if (cached && cached.ancestor === ancestor) return cached.index;
    const allLis = ancestor.querySelectorAll("li");
    for (let i = 0, idx = 1; i < allLis.length; i++) {
      let a = allLis[i].parentElement;
      while (a && !["ul", "ol"].includes(a.tagName.toLowerCase())) a = a.parentElement;
      if (a === ancestor) {
        _liCache.set(allLis[i], { ancestor, index: idx });
        idx++;
      }
    }
    return (_liCache.get(node) || {}).index || 1;
  }
  function resetLiCache() {
    _liCache = new WeakMap();
  }
  function htmlToMarkdown(el) {
    function convert(node) {
      var _a, _b;
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName.toLowerCase();
      function inner() {
        let result = "";
        for (let child = node.firstChild; child; child = child.nextSibling) {
          result += convert(child);
        }
        return result;
      }
      switch (tag) {
        case "h1":
          return "# " + inner() + "\n\n";
        case "h2":
          return "## " + inner() + "\n\n";
        case "h3":
          return "### " + inner() + "\n\n";
        case "h4":
          return "#### " + inner() + "\n\n";
        case "h5":
          return "##### " + inner() + "\n\n";
        case "h6":
          return "###### " + inner() + "\n\n";
        case "p":
          return inner() + "\n\n";
        case "br":
          return "\n";
        case "strong":
        case "b":
          return "**" + inner() + "**";
        case "em":
        case "i":
          return "*" + inner() + "*";
        case "a": {
          let href = node.getAttribute("href") || "";
          if (href.includes("google.com/url")) {
            try {
              href = new URL(href).searchParams.get("q") || href;
            } catch (_) {
            }
          }
          const text = inner();
          return href ? "[" + text + "](" + href + ")" : text;
        }
        case "ul":
          return inner() + "\n";
        case "ol":
          return inner() + "\n";
        case "li": {
          const index = getLiIndex(node);
          if (index > 0) return index + ". " + inner().trim() + "\n";
          return "- " + inner().trim() + "\n";
        }
        case "div": {
          const ariaLevel = node.getAttribute("aria-level");
          if (ariaLevel) {
            const hashes = "#".repeat(Math.min(parseInt(ariaLevel), 6));
            return hashes + " " + inner().trim() + "\n\n";
          }
          if (/^-{10,}$/.test(node.textContent.trim())) return "---\n\n";
          if (node.classList && node.classList.contains("code")) {
            const codeEl = node.querySelector("code");
            const lang = codeEl ? codeEl.getAttribute("data-language") || "" : "";
            const content = codeEl ? codeEl.textContent : node.textContent;
            return "```" + lang + "\n" + content + "\n```\n\n";
          }
          return inner();
        }
        case "s":
        case "del":
        case "strike":
          return "~~" + inner() + "~~";
        case "u":
          return "__" + inner() + "__";
        case "code": {
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") return inner();
          return "`" + inner() + "`";
        }
        case "pre": {
          const codeEl = node.querySelector("code");
          const langSource = codeEl || node;
          const lang = langSource.getAttribute("data-language") || langSource.className && ((_a = langSource.className.match(/language-(\S+)/)) == null ? void 0 : _a[1]) || langSource.className && ((_b = langSource.className.match(/lang-(\S+)/)) == null ? void 0 : _b[1]) || "";
          return "```" + lang + "\n" + (codeEl ? codeEl.textContent : inner()) + "\n```\n\n";
        }
        case "blockquote":
          return inner().trim().split("\n").map(function(l) {
            return "> " + l;
          }).join("\n") + "\n\n";
        case "hr":
          return "---\n\n";
        case "img": {
          const src = node.getAttribute("src") || "";
          const alt = node.getAttribute("alt") || "";
          return "![" + alt + "](" + src + ")";
        }
        case "table": {
          let toRow2 = function(cells) {
            return "| " + cells.map(function(c) {
              return c.textContent.trim().replace(/\|/g, "\\|");
            }).join(" | ") + " |";
          };
          const rows = Array.from(node.querySelectorAll("tr"));
          if (!rows.length) return inner();
          const headerCells = Array.from(rows[0].querySelectorAll("th, td"));
          const header = toRow2(headerCells);
          const separator = "| " + headerCells.map(function() {
            return "---";
          }).join(" | ") + " |";
          const body = rows.slice(1).map(function(r) {
            return toRow2(Array.from(r.querySelectorAll("td")));
          }).join("\n");
          return [header, separator, body].filter(Boolean).join("\n") + "\n\n";
        }
        default:
          return inner();
      }
    }
    return convert(el).replace(/\n{3,}/g, "\n\n").trim();
  }
  const crcTable = new Uint32Array(256);
  (function buildCRCTable() {
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      crcTable[i] = c;
    }
  })();
  function crc32(u8) {
    let crc = 4294967295;
    for (let i = 0; i < u8.length; i++) crc = crc >>> 8 ^ crcTable[(crc ^ u8[i]) & 255];
    return (crc ^ 4294967295) >>> 0;
  }
  function u16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }
  function u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }
  const enc = new TextEncoder();
  function buildStoreZip(files) {
    const localParts = [];
    const centralParts = [];
    const entries = [];
    let localOffset = 0;
    for (let f = 0; f < files.length; f++) {
      const nameBytes = enc.encode(files[f].name);
      const data = files[f].data || enc.encode(files[f].text);
      const crc = crc32(data);
      const local = new Uint8Array([
        80,
        75,
        3,
        4,
20,
        0,
...u16(2048),
0,
        0,
0,
        0,
        0,
        0,
...u32(crc),
        ...u32(data.length),
...u32(data.length),
...u16(nameBytes.length),
        0,
        0
]);
      entries.push({ offset: localOffset, nameBytes, crc, size: data.length });
      localParts.push(local, nameBytes, data);
      localOffset += local.length + nameBytes.length + data.length;
    }
    let centralSize = 0;
    for (let f = 0; f < entries.length; f++) {
      const e = entries[f];
      const ch = new Uint8Array([
        80,
        75,
        1,
        2,
20,
        0,
20,
        0,
...u16(2048),
0,
        0,
0,
        0,
        0,
        0,
...u32(e.crc),
        ...u32(e.size),
...u32(e.size),
...u16(e.nameBytes.length),
        0,
        0,
0,
        0,
0,
        0,
0,
        0,
0,
        0,
        0,
        0,
...u32(e.offset)
]);
      centralParts.push(ch, e.nameBytes);
      centralSize += ch.length + e.nameBytes.length;
    }
    const eocd = new Uint8Array([
      80,
      75,
      5,
      6,
0,
      0,
0,
      0,
...u16(entries.length),
...u16(entries.length),
...u32(centralSize),
      ...u32(localOffset),
0,
      0
]);
    return new Blob([...localParts, ...centralParts, eocd], { type: "application/zip" });
  }
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
  const SELECTORS = {
    chatContainer: ".chat-panel-content",
    messagePair: ".chat-message-pair",
    userContent: ".from-user-container .message-text-content",
    aiContent: ".to-user-container labs-tailwind-doc-viewer",
    citationButton: ".citation-marker",
    notebookTitle: ".cover-title.mat-headline-medium",
    notebookDate: ".cover-subtitle-date",
    sourceCount: ".cover-subtitle-source-count"
  };
  const FALLBACK_SELECTORS = {
    userContent: '[class*="from-user"] [class*="message-text"]',
    aiContent: '[class*="to-user"] [class*="message-text"], [class*="to-user"] labs-tailwind-doc-viewer',
    notebookTitle: '[class*="title"] [class*="mat-title"], [class*="cover-title"]',
    notebookDate: '[class*="subtitle"] [class*="date"], .cover-subtitle-date',
    sourceCount: '[class*="subtitle"] [class*="source"], .cover-subtitle-source-count'
  };
  function queryFirst(root, selectors) {
    for (let i = 0; i < selectors.length; i++) {
      const el = root.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }
  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function removeCitations(el) {
    if (!el) return;
    const buttons = el.querySelectorAll(SELECTORS.citationButton);
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].remove();
    }
  }
  function extractMetadata() {
    let titleEl = document.querySelector(SELECTORS.notebookTitle);
    if (!titleEl) {
      titleEl = queryFirst(document, [FALLBACK_SELECTORS.notebookTitle]);
    }
    const title = titleEl ? titleEl.textContent.trim() : "NotebookLM Chat";
    let dateEl = document.querySelector(SELECTORS.notebookDate);
    if (!dateEl) {
      dateEl = queryFirst(document, [FALLBACK_SELECTORS.notebookDate]);
    }
    const dateStr = dateEl ? dateEl.textContent.trim() : todayISO();
    let sourceEl = document.querySelector(SELECTORS.sourceCount);
    if (!sourceEl) {
      sourceEl = queryFirst(document, [FALLBACK_SELECTORS.sourceCount]);
    }
    const sourceInfo = sourceEl ? sourceEl.textContent.trim() : null;
    return { title, dateStr, sourceInfo };
  }
  function extractChatToMarkdown(htmlToMarkdown2) {
    const container = document.querySelector(SELECTORS.chatContainer);
    if (!container) return "";
    const pairs = container.querySelectorAll(SELECTORS.messagePair);
    if (!pairs || pairs.length === 0) return "";
    const meta = extractMetadata();
    const lines = [
      "---",
      'title: "' + meta.title + '"',
      "date: " + meta.dateStr,
      "platform: NotebookLM"
    ];
    if (meta.sourceInfo) {
      lines.push("sources: " + meta.sourceInfo);
    }
    lines.push("---");
    lines.push("");
    lines.push("# NotebookLM Chat Export");
    lines.push("");
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      let userEl = pair.querySelector(SELECTORS.userContent);
      if (!userEl) {
        userEl = queryFirst(pair, [FALLBACK_SELECTORS.userContent]);
      }
      let aiEl = pair.querySelector(SELECTORS.aiContent);
      if (!aiEl) {
        aiEl = queryFirst(pair, [FALLBACK_SELECTORS.aiContent]);
      }
      const hasUserText = userEl && userEl.textContent.trim().length > 0;
      const hasAiResponse = aiEl && aiEl.textContent.trim().length > 0;
      if (!hasAiResponse) continue;
      lines.push("---");
      lines.push("");
      lines.push("## User");
      lines.push("");
      if (hasUserText) {
        lines.push(htmlToMarkdown2(userEl));
      } else {
        lines.push("*[non-text message]*");
      }
      lines.push("");
      lines.push("## NotebookLM");
      lines.push("");
      removeCitations(aiEl);
      lines.push(htmlToMarkdown2(aiEl));
      lines.push("");
    }
    return lines.join("\n");
  }
  function extractChatToText() {
    const container = document.querySelector(SELECTORS.chatContainer);
    if (!container) return "";
    const pairs = container.querySelectorAll(SELECTORS.messagePair);
    if (!pairs || pairs.length === 0) return "";
    const meta = extractMetadata();
    const lines = [
      "NotebookLM Chat Export",
      "Title: " + meta.title,
      "Date: " + meta.dateStr,
      "Platform: NotebookLM"
    ];
    if (meta.sourceInfo) lines.push("Sources: " + meta.sourceInfo);
    lines.push("");
    lines.push("---");
    lines.push("");
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      let userEl = pair.querySelector(SELECTORS.userContent);
      if (!userEl) userEl = queryFirst(pair, [FALLBACK_SELECTORS.userContent]);
      let aiEl = pair.querySelector(SELECTORS.aiContent);
      if (!aiEl) aiEl = queryFirst(pair, [FALLBACK_SELECTORS.aiContent]);
      const hasAiResponse = aiEl && aiEl.textContent.trim().length > 0;
      if (!hasAiResponse) continue;
      lines.push("User:");
      if (userEl && userEl.textContent.trim().length > 0) {
        lines.push(userEl.textContent.trim());
      } else {
        lines.push("[non-text message]");
      }
      lines.push("");
      lines.push("NotebookLM:");
      const aiClone = aiEl.cloneNode(true);
      removeCitations(aiClone);
      lines.push(aiClone.textContent.trim());
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    return lines.join("\n");
  }
  function extractChatMessages() {
    const container = document.querySelector(SELECTORS.chatContainer);
    if (!container) return null;
    const pairs = container.querySelectorAll(SELECTORS.messagePair);
    if (!pairs || pairs.length === 0) return null;
    const meta = extractMetadata();
    const messages = [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      let userEl = pair.querySelector(SELECTORS.userContent);
      if (!userEl) {
        userEl = queryFirst(pair, [FALLBACK_SELECTORS.userContent]);
      }
      let aiEl = pair.querySelector(SELECTORS.aiContent);
      if (!aiEl) {
        aiEl = queryFirst(pair, [FALLBACK_SELECTORS.aiContent]);
      }
      const hasUserText = userEl && userEl.textContent.trim().length > 0;
      const hasAiResponse = aiEl && aiEl.textContent.trim().length > 0;
      if (!hasAiResponse) continue;
      let userHtml = null;
      if (userEl && hasUserText) {
        const userClone = userEl.cloneNode(true);
        userHtml = userClone.innerHTML;
      }
      let aiHtml = null;
      if (aiEl) {
        const aiClone = aiEl.cloneNode(true);
        removeCitations(aiClone);
        aiHtml = aiClone.innerHTML;
      }
      messages.push({
        userHtml,
        aiHtml,
        userText: userEl ? userEl.textContent.trim() : "",
        aiText: aiEl ? aiEl.textContent.trim() : ""
      });
    }
    if (messages.length === 0) return null;
    return {
      notebookTitle: meta.title,
      dateStr: meta.dateStr,
      sourceInfo: meta.sourceInfo,
      messages
    };
  }
  const EXPORT_CSS = [
    "*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }",
    'body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;',
    "  font-size:16px; line-height:1.6; color:#1e293b; background:#fff; padding:40px 24px; max-width:800px; margin:0 auto; }",
    "h1 { font-size:24px; font-weight:600; color:#0f172a; margin-bottom:4px; }",
    "h2 { font-size:17px; font-weight:600; color:#334155; margin-bottom:10px; }",
    "a { color:#6366f1; text-decoration:none; }",
    "a:hover { text-decoration:underline; }",
    'code { font-family:"SF Mono","Fira Code","Fira Mono","Roboto Mono",monospace; font-size:0.9em;',
    "  background:#f1f5f9; padding:2px 6px; border-radius:4px; }",
    "pre { background:#0f172a; color:#e2e8f0; padding:16px; border-radius:8px; overflow-x:auto;",
    "  font-size:14px; line-height:1.5; margin:12px 0; }",
    "pre code { background:transparent; padding:0; color:inherit; }",
    "blockquote { border-left:3px solid #6366f1; padding:8px 16px; margin:12px 0; background:#f8fafc;",
    "  border-radius:0 8px 8px 0; }",
    "blockquote p { margin:4px 0; }",
    "table { border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; }",
    "th, td { border:1px solid #e2e8f0; padding:8px 12px; text-align:left; }",
    "th { background:#f8fafc; font-weight:600; color:#334155; }",
    "tr:nth-child(even) { background:#f8fafc; }",
    "ul, ol { padding-left:24px; margin:8px 0; }",
    "li { margin:4px 0; }",
    "p { margin:8px 0; }",
    "hr { border:none; border-top:1px solid #e2e8f0; margin:16px 0; }",
    "img { max-width:100%; height:auto; border-radius:6px; }",
    ".metadata { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; margin:20px 0; }",
    ".metadata h1 { font-size:20px; margin-bottom:8px; }",
    ".metadata dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:14px; }",
    ".metadata dt { color:#64748b; font-weight:500; }",
    ".metadata dd { color:#1e293b; }",
    ".message { margin:24px 0; padding:16px 20px; border-radius:12px; }",
    ".user-message { background:#f1f5f9; border:1px solid #e2e8f0; }",
    ".ai-message { background:#faf5ff; border:1px solid #e8d5ff; }",
    ".message .label { font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }",
    ".user-message .label { color:#6366f1; }",
    ".ai-message .label { color:#a855f7; }",
    ".non-text { color:#94a3b8; font-style:italic; }",
    "@media print { body { padding:20px; font-size:13px; } .message { break-inside:avoid; } }",
"labs-tailwind-doc-viewer, paragraph-element-view { display:block; }",
".table-wrapper { overflow-x:auto; }"
  ].join("\n");
  function sanitizeHTML(html) {
    if (!html) return "";
    return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript\s*:/gi, "");
  }
  function buildChatHTMLDocument(messagesData, options) {
    options = options || {};
    const meta = messagesData;
    let bodyParts = "";
    for (let i = 0; i < meta.messages.length; i++) {
      const msg = meta.messages[i];
      bodyParts += '  <div class="message user-message">\n';
      bodyParts += '    <div class="label">User</div>\n';
      if (msg.userHtml) {
        bodyParts += '    <div class="content">' + sanitizeHTML(msg.userHtml) + "</div>\n";
      } else {
        bodyParts += '    <div class="content non-text">[non-text message]</div>\n';
      }
      bodyParts += "  </div>\n\n";
      bodyParts += '  <div class="message ai-message">\n';
      bodyParts += '    <div class="label">NotebookLM</div>\n';
      if (msg.aiHtml) {
        bodyParts += '    <div class="content">' + sanitizeHTML(msg.aiHtml) + "</div>\n";
      } else {
        bodyParts += '    <div class="content non-text">[empty response]</div>\n';
      }
      bodyParts += "  </div>\n\n";
    }
    const printScript = options.forPrint ? "  <script>window.onload=function(){setTimeout(function(){window.print()},500)};<\/script>\n" : "";
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>' + escapeHTML(meta.notebookTitle) + " - NotebookLM Chat Export</title>\n  <style>" + EXPORT_CSS + '</style>\n</head>\n<body>\n  <div class="metadata">\n    <h1>' + escapeHTML(meta.notebookTitle) + "</h1>\n    <dl>\n      <dt>Date</dt><dd>" + escapeHTML(meta.dateStr) + "</dd>\n      <dt>Platform</dt><dd>NotebookLM</dd>\n    </dl>\n  </div>\n\n" + bodyParts + printScript + "</body>\n</html>";
  }
  function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const log = createLogger("NotebookLM Source Export");
  const CONFIG = {
    audio: { enabled: true, vol: 0.15 },
    selectors: {
      closeBtn: 'button[mattooltip*="schließen"], button[mattooltip*="close"], button[aria-label*="Close"], button[aria-label*="Schließen"]',
      content: ".elements-container labs-tailwind-structural-element-view-v2",
      notebookTitle: ".title-label-inner.mat-title-large",
      sourceContainer: ".single-source-container",
      sourceTitle: ".source-title"
    }
  };
  const TIMING = {
    CONTENT_POLL_ATTEMPTS: 30,
    CONTENT_POLL_INTERVAL_MS: 100,
    CONTENT_STABLE_POLLS: 2,
    CONTENT_GONE_ATTEMPTS: 5,
    MIN_CONTENT_LENGTH_CHARS: 20,
    KEEP_ALIVE_VOLUME: 1e-3,
    LOG_MAX_ENTRIES: 50,
    AUDIO_NOTE_DELAYS_MS: [0, 100, 200]
  };
  const STATE = {
    isCancelled: false,
    keepAliveNode: null,
    menuStopId: null,
    soundFXCloseTimer: null
  };
  const SoundFX = {
    _ctx: null,
    get ctx() {
      if (!this._ctx && CONFIG.audio.enabled) {
        try {
          this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          log.warn("AudioContext creation failed: " + e.message);
        }
      }
      if (this._ctx && this._ctx.state === "suspended") {
        this._ctx.resume().catch(function() {
        });
      }
      return this._ctx;
    },
    playTone: function(freq, type, duration, vol) {
      vol = vol || CONFIG.audio.vol;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (_) {
      }
    },
    playStart: function() {
      this.playTone(600, "sine", 0.15);
    },
    playError: function() {
      this.playTone(150, "sawtooth", 0.3);
    },
    playComplete: function() {
      const delays = TIMING.AUDIO_NOTE_DELAYS_MS;
      const notes = [
        { freq: 440, duration: 0.6, delay: delays[0] },
        { freq: 554, duration: 0.6, delay: delays[1] },
        { freq: 659, duration: 0.8, delay: delays[2] }
      ];
      notes.forEach(function(n) {
        setTimeout(function() {
          SoundFX.playTone(n.freq, "sine", n.duration);
        }, n.delay);
      });
    },
    close: function() {
      if (this._ctx) {
        try {
          this._ctx.close();
        } catch (_) {
        }
        this._ctx = null;
      }
    },
    ensureReady: async function() {
      try {
        const c = this.ctx;
        if (c && c.state === "suspended") {
          await c.resume();
        }
      } catch (_) {
      }
    }
  };
  function wait(ms) {
    return new Promise(function(r) {
      setTimeout(r, ms);
    });
  }
  function waitForContent(selector, timeoutMs) {
    return new Promise(function(resolve) {
      let stabilityTimer = null;
      let contentObserver = null;
      const rootObserver = new MutationObserver(checkAppear);
      function cleanup() {
        if (contentObserver) {
          contentObserver.disconnect();
          contentObserver = null;
        }
        if (stabilityTimer) {
          clearTimeout(stabilityTimer);
          stabilityTimer = null;
        }
        rootObserver.disconnect();
      }
      function done(el) {
        cleanup();
        resolve(el || null);
      }
      function watchStability(el) {
        let lastText = el.textContent;
        contentObserver = new MutationObserver(function() {
          const cur = el.textContent;
          if (cur !== lastText) {
            lastText = cur;
            if (stabilityTimer) clearTimeout(stabilityTimer);
            if (cur.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
              stabilityTimer = setTimeout(function() {
                done(el);
              }, 300);
            }
          }
        });
        contentObserver.observe(el, { childList: true, subtree: true, characterData: true });
        if (el.textContent.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
          stabilityTimer = setTimeout(function() {
            done(el);
          }, 300);
        }
      }
      function checkAppear() {
        const el = document.querySelector(selector);
        if (!el) return;
        rootObserver.disconnect();
        watchStability(el);
      }
      checkAppear();
      if (!contentObserver) {
        rootObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
      setTimeout(function() {
        done(null);
      }, timeoutMs);
    });
  }
  function waitForContentGone(selector, timeoutMs) {
    return new Promise(function(resolve) {
      if (!document.querySelector(selector)) {
        resolve(true);
        return;
      }
      let observeTarget = document.querySelector(".elements-container");
      if (observeTarget) {
        observeTarget = observeTarget.parentElement || observeTarget;
      } else {
        const el = document.querySelector(selector);
        observeTarget = el && el.parentElement || document.documentElement;
      }
      const observer = new MutationObserver(function() {
        if (!document.querySelector(selector)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(observeTarget, { childList: true, subtree: true });
      setTimeout(function() {
        observer.disconnect();
        let pollAttempts = 0;
        const pollTimer = setInterval(function() {
          if (!document.querySelector(selector)) {
            clearInterval(pollTimer);
            resolve(true);
            return;
          }
          pollAttempts++;
          if (pollAttempts >= 5) {
            clearInterval(pollTimer);
            resolve(false);
          }
        }, 100);
      }, timeoutMs);
    });
  }
  function startKeepAlive() {
    try {
      var ctx = SoundFX.ctx;
      if (!ctx) return;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      gain.gain.value = 1e-6;
      osc.type = "sine";
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      STATE.keepAliveNode = { osc, gain };
    } catch (e) {
      log.warn("Keep-alive audio failed: " + e.message);
    }
  }
  function stopKeepAlive() {
    if (STATE.keepAliveNode) {
      try {
        STATE.keepAliveNode.osc.stop();
      } catch (_) {
      }
      try {
        STATE.keepAliveNode.gain.disconnect();
      } catch (_) {
      }
      STATE.keepAliveNode = null;
    }
  }
  async function attemptClose() {
    async function tryStrategy(description, actionFn) {
      actionFn();
      const gone = await waitForContentGone(CONFIG.selectors.content, 300);
      if (gone) {
        log.log("[Close] " + description + " — panel closed.");
        return true;
      }
      return false;
    }
    const closeIcons = ["close", "cancel", "arrow_back", "chevron_left"];
    const buttons = document.querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) {
      const txt = buttons[i].textContent || "";
      for (let j = 0; j < closeIcons.length; j++) {
        if (txt.indexOf(closeIcons[j]) !== -1) {
          const btn = buttons[i];
          if (await tryStrategy('Strategy 1: icon "' + closeIcons[j] + '"', function() {
            btn.click();
          })) return true;
        }
      }
    }
    const localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
    if (localizedBtn) {
      if (await tryStrategy("Strategy 2: tooltip-based button", function() {
        localizedBtn.click();
      })) return true;
    }
    const panelHeaderBtns = document.querySelectorAll('[class*="panel"] button, [class*="dialog"] button, [class*="drawer"] button, [class*="sidebar"] button');
    for (let k = 0; k < panelHeaderBtns.length; k++) {
      const btn = panelHeaderBtns[k];
      const aria = btn.getAttribute("aria-label") || "";
      if (aria.toLowerCase().indexOf("close") !== -1 || aria.toLowerCase().indexOf("schließen") !== -1) {
        if (await tryStrategy("Strategy 3: panel header button", function() {
          btn.click();
        })) return true;
      }
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    log.log("[Close] Strategy 4: Escape key dispatched.");
    return true;
  }
  function downloadZip(blob, name) {
    try {
      GM_download({ url: blob, name, saveAs: true });
    } catch (fallbackErr) {
      log.warn("Direct Blob download failed, using createObjectURL: " + fallbackErr.message);
      try {
        const url = URL.createObjectURL(blob);
        GM_download({ url, name, saveAs: true });
        setTimeout(function() {
          URL.revokeObjectURL(url);
        }, 5e3);
      } catch (e) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
          a.remove();
          URL.revokeObjectURL(url);
        }, 2e3);
      }
    }
  }
  function cleanupRun() {
    stopKeepAlive();
    STATE.soundFXCloseTimer = setTimeout(function() {
      SoundFX.close();
      STATE.soundFXCloseTimer = null;
    }, 2e3);
    if (STATE.menuStopId != null) {
      try {
        GM_unregisterMenuCommand(STATE.menuStopId);
      } catch (_) {
      }
      STATE.menuStopId = null;
    }
  }
  async function exportChat(options) {
    const onStatus = options.onStatus || function() {
    };
    const onComplete = options.onComplete || function() {
    };
    const onError = options.onError || function() {
    };
    try {
      onStatus("Extracting chat messages...");
      const markdown = extractChatToMarkdown(htmlToMarkdown);
      const messagesData = extractChatMessages();
      if (!markdown && !messagesData) {
        onError("No chat messages found.");
        return;
      }
      let html = "";
      let text = "";
      if (messagesData) {
        html = buildChatHTMLDocument(messagesData, {});
        text = extractChatToText();
      }
      const files = [];
      if (markdown) files.push({ name: "chat.md", data: enc.encode(markdown) });
      if (html) files.push({ name: "chat.html", data: enc.encode(html) });
      if (text) files.push({ name: "chat.txt", data: enc.encode(text) });
      if (files.length === 0) {
        onError("No chat messages found.");
        return;
      }
      onStatus("Building ZIP archive...");
      const title = messagesData ? messagesData.notebookTitle : "NotebookLM Chat";
      const zipName = title.replace(/[\\/:*?"<>|]/g, "_").substring(0, 100).trim() + " - chat.zip";
      const zipBlob = buildStoreZip(files);
      downloadZip(zipBlob, zipName);
      log.log("Chat ZIP downloaded: " + zipName);
      onComplete("Chat export complete!");
    } catch (err) {
      log.error("Chat export failed: " + err.message);
      onError("Chat export failed: " + err.message);
    }
  }
  async function exportSources(options) {
    const onProgress = options.onProgress || function() {
    };
    const onComplete = options.onComplete || function() {
    };
    const onError = options.onError || function() {
    };
    const onCancelled = options.onCancelled || function() {
    };
    if (STATE.soundFXCloseTimer) {
      clearTimeout(STATE.soundFXCloseTimer);
      STATE.soundFXCloseTimer = null;
      SoundFX.close();
    }
    STATE.isCancelled = false;
    onProgress(0, 1, "");
    STATE.menuStopId = GM_registerMenuCommand("Stop Export", function() {
      STATE.isCancelled = true;
      log.warn("Stop requested via menu.");
    });
    if (navigator.connection && navigator.connection.saveData) {
      log.warn("Save-Data mode active — keep-alive audio disabled.");
    } else {
      startKeepAlive();
    }
    await SoundFX.ensureReady();
    SoundFX.playStart();
    const totalSources = document.querySelectorAll(CONFIG.selectors.sourceContainer).length;
    if (totalSources === 0) {
      log.error("No sources found.");
      SoundFX.playError();
      cleanupRun();
      onError("No sources found.");
      return;
    }
    log.log("Scan complete. Found " + totalSources + " items.");
    log.warn("Keep this tab active — background tabs may throttle timers.");
    const collectedFiles = [];
    const usedNames = new Set();
    let crashed = false;
    function processContent(text, fileName, linesCount, conversionTimeMs) {
      if (conversionTimeMs > 5e3) {
        log.warn("Slow conversion (" + Math.round(conversionTimeMs) + "ms for " + linesCount + " elements)");
      }
      if (text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
        const data = enc.encode(text);
        collectedFiles.push({ name: fileName, data });
        log.log("Queued: " + fileName + " (" + text.length + " chars)");
      } else {
        log.warn("Content empty for: " + fileName);
      }
    }
    try {
      for (let i = 0; i < totalSources; i++) {
        if (STATE.isCancelled) break;
        onProgress(i + 1, totalSources, "");
        const source = document.querySelectorAll(CONFIG.selectors.sourceContainer)[i];
        if (!source) {
          log.error("Source " + (i + 1) + " not found in DOM. Skipping.");
          continue;
        }
        const titleEl = source.querySelector(CONFIG.selectors.sourceTitle);
        let fileName = (titleEl && titleEl.textContent ? titleEl.textContent.trim() : "Source_" + (i + 1)).replace(/[\\/:*?"<>|]/g, "_").substring(0, 120).trim();
        if (!fileName.endsWith(".md")) fileName += ".md";
        if (usedNames.has(fileName)) {
          const baseName = fileName.replace(/\.md$/, "");
          let counter = 2;
          while (usedNames.has(baseName + "_" + counter + ".md")) counter++;
          fileName = baseName + "_" + counter + ".md";
        }
        usedNames.add(fileName);
        try {
          log.log("Opening: " + fileName);
          onProgress(i + 1, totalSources, fileName);
          source.scrollIntoView({ block: "center" });
          await wait(100);
          const stretchBtn = source.querySelector(".source-stretched-button");
          if (stretchBtn) stretchBtn.click();
          else (titleEl || source).click();
          const contentEl = await waitForContent(CONFIG.selectors.content, 15e3);
          if (STATE.isCancelled) {
            await attemptClose();
            continue;
          }
          if (contentEl) {
            const container = contentEl.closest(".elements-container");
            const allInContainer = container ? container.querySelectorAll("labs-tailwind-structural-element-view-v2") : document.querySelectorAll(CONFIG.selectors.content);
            const lines = Array.from(allInContainer).filter(
              function(el) {
                return !el.parentElement.closest(CONFIG.selectors.content);
              }
            );
            const t0 = performance.now();
            const textLines = lines.map(function(l) {
              return htmlToMarkdown(l);
            });
            const t1 = performance.now();
            const text = textLines.join("\n\n");
            processContent(text, fileName, lines.length, t1 - t0);
          } else {
            const panel = document.querySelector(".elements-container");
            const iframe = panel && panel.querySelector("iframe");
            if (iframe) {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                  const iframeLines = iframeDoc.querySelectorAll("labs-tailwind-structural-element-view-v2");
                  if (iframeLines.length > 0) {
                    log.log("Content found in iframe — extracting...");
                    const lines = Array.from(iframeLines).filter(
                      function(el) {
                        return !el.parentElement.closest("labs-tailwind-structural-element-view-v2");
                      }
                    );
                    const t0 = performance.now();
                    const textLines = lines.map(function(l) {
                      return htmlToMarkdown(l);
                    });
                    const t1 = performance.now();
                    const text = textLines.join("\n\n");
                    processContent(text, fileName, lines.length, t1 - t0);
                  } else {
                    log.error("No content elements found in iframe for: " + fileName);
                  }
                } else {
                  log.error("Cannot access iframe document for: " + fileName);
                }
              } catch (_) {
                log.error("Cross-origin iframe — cannot extract content for: " + fileName);
              }
            } else {
              let fallbackText = "";
              if (panel) {
                const directChildren = panel.children;
                for (let b = 0; b < directChildren.length; b++) {
                  const txt = directChildren[b].textContent.trim();
                  if (txt.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
                    fallbackText += txt + "\n\n";
                  }
                }
              }
              processContent(fallbackText, fileName, 0, 0);
            }
          }
          await attemptClose();
          resetLiCache();
        } catch (sourceErr) {
          log.error("Error processing source " + (i + 1) + ": " + sourceErr.message);
        }
      }
    } catch (e) {
      log.error("Unexpected error: " + e.message);
      crashed = true;
    } finally {
      cleanupRun();
    }
    if (crashed) {
      onError("An unexpected error occurred.");
      return;
    }
    if (STATE.isCancelled) {
      log.warn("Extraction stopped by user.");
      onCancelled("Export stopped.");
      return;
    }
    onProgress(totalSources, totalSources, "");
    if (collectedFiles.length > 0) {
      log.log("Building ZIP with " + collectedFiles.length + " file(s)...");
      const notebookTitleEl = document.querySelector(CONFIG.selectors.notebookTitle);
      const notebookTitle = notebookTitleEl ? notebookTitleEl.textContent.trim() : "NotebookLM";
      const zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, "_").substring(0, 100).trim() + ".zip";
      let zipBlob;
      try {
        zipBlob = buildStoreZip(collectedFiles);
      } catch (zipErr) {
        log.error("ZIP build failed: " + zipErr.message);
        onError("ZIP build failed.");
        return;
      }
      downloadZip(zipBlob, zipName);
      log.log("ZIP downloaded: " + zipName);
      log.log("Process completed successfully.");
      SoundFX.playComplete();
      try {
        GM_notification({
          title: "NotebookLM Source Export",
          text: "Exported " + collectedFiles.length + " source" + (collectedFiles.length !== 1 ? "s" : "") + " successfully.",
          timeout: 5e3
        });
      } catch (_) {
      }
      onComplete("Exported " + collectedFiles.length + " source" + (collectedFiles.length !== 1 ? "s" : "") + ".");
    } else {
      log.warn("No files to export.");
      onError("No files to export.");
    }
  }
  const STYLES = `
  :host {
    all: initial;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #e2e8f0;
    pointer-events: none;
  }
  .container {
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 12px;
    padding: 14px 18px;
    min-width: 300px;
    max-width: 420px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .container.destroy {
    opacity: 0;
    transform: translateY(10px);
  }
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.12);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .spinner.success {
    border-color: #22c55e;
    animation: none;
  }
  .spinner.error {
    border-color: #ef4444;
    animation: none;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .status-text {
    flex: 1;
    font-weight: 500;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-text.success {
    color: #22c55e;
  }
  .status-text.error {
    color: #ef4444;
  }
  .details {
    padding-left: 24px;
  }
  .count-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .progress-track {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #6366f1, #c084fc, #f472b6);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .count-label {
    color: #cbd5e1;
    min-width: 50px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .filename {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 24px;
    margin-top: 2px;
  }
  .stop-btn {
    background: transparent;
    border: 1px solid rgba(248, 113, 113, 0.35);
    color: #f87171;
    border-radius: 6px;
    padding: 3px 12px;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    transition: background 0.15s ease;
    flex-shrink: 0;
  }
  .stop-btn:hover {
    background: rgba(248, 113, 113, 0.1);
  }
  .status-line {
    padding-left: 24px;
    font-size: 12px;
    color: #94a3b8;
  }
`;
  function createProgress(mode, onStop) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "closed" });
    GM_addElement(root, "style", { textContent: STYLES });
    const container = document.createElement("div");
    container.className = "container";
    root.appendChild(container);
    const header = document.createElement("div");
    header.className = "header";
    container.appendChild(header);
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    header.appendChild(spinner);
    const statusText = document.createElement("div");
    statusText.className = "status-text";
    statusText.textContent = mode === "sources" ? "Exporting sources..." : "Exporting chat...";
    header.appendChild(statusText);
    let stopBtn = null;
    if (mode === "sources" && typeof onStop === "function") {
      stopBtn = document.createElement("button");
      stopBtn.className = "stop-btn";
      stopBtn.textContent = "Stop";
      stopBtn.addEventListener("click", function() {
        if (stopBtn.disabled) return;
        stopBtn.disabled = true;
        stopBtn.textContent = "Stopping...";
        statusText.textContent = "Stopping...";
        onStop();
      });
      header.appendChild(stopBtn);
    }
    let details = null;
    let countLabel = null;
    let progressFill = null;
    let filenameEl = null;
    let statusLine = null;
    if (mode === "sources") {
      details = document.createElement("div");
      details.className = "details";
      container.appendChild(details);
      const countLine = document.createElement("div");
      countLine.className = "count-line";
      details.appendChild(countLine);
      const track = document.createElement("div");
      track.className = "progress-track";
      countLine.appendChild(track);
      progressFill = document.createElement("div");
      progressFill.className = "progress-fill";
      track.appendChild(progressFill);
      countLabel = document.createElement("span");
      countLabel.className = "count-label";
      countLabel.textContent = "0 / 0";
      countLine.appendChild(countLabel);
      filenameEl = document.createElement("div");
      filenameEl.className = "filename";
      details.appendChild(filenameEl);
    } else {
      statusLine = document.createElement("div");
      statusLine.className = "status-line";
      statusLine.textContent = "Starting...";
      container.appendChild(statusLine);
    }
    let finished = false;
    let destroyTimer = null;
    function startDestroy(delayMs) {
      if (destroyTimer) clearTimeout(destroyTimer);
      destroyTimer = setTimeout(function() {
        container.classList.add("destroy");
        setTimeout(function() {
          host.remove();
        }, 300);
      }, delayMs);
    }
    function clearDestroy() {
      if (destroyTimer) {
        clearTimeout(destroyTimer);
        destroyTimer = null;
      }
    }
    return {
      update: function(current, total, filename) {
        if (finished) return;
        clearDestroy();
        spinner.className = "spinner";
        statusText.className = "status-text";
        statusText.textContent = "Exporting sources...";
        if (countLabel) countLabel.textContent = String(current) + " / " + String(total);
        if (progressFill) progressFill.style.width = (total > 0 ? current / total * 100 : 0) + "%";
        if (filenameEl) filenameEl.textContent = filename || "";
      },
      setStatus: function(text) {
        if (finished) return;
        clearDestroy();
        spinner.className = "spinner";
        statusText.className = "status-text";
        statusText.textContent = text;
        if (statusLine) statusLine.textContent = text;
      },
      complete: function(message) {
        if (finished) return;
        finished = true;
        clearDestroy();
        spinner.className = "spinner success";
        statusText.className = "status-text success";
        statusText.textContent = message || "Export complete!";
        if (stopBtn) stopBtn.style.display = "none";
        startDestroy(7e3);
      },
      error: function(message) {
        if (finished) return;
        finished = true;
        clearDestroy();
        spinner.className = "spinner error";
        statusText.className = "status-text error";
        statusText.textContent = message || "Export failed!";
        if (stopBtn) stopBtn.style.display = "none";
        startDestroy(7e3);
      },
      cancel: function(message) {
        if (finished) return;
        finished = true;
        clearDestroy();
        spinner.className = "spinner error";
        statusText.className = "status-text error";
        statusText.textContent = message || "Export cancelled.";
        if (stopBtn) {
          stopBtn.textContent = "Stopped";
          stopBtn.disabled = true;
        }
        startDestroy(7e3);
      }
    };
  }
  
  var _busy = false;
  GM_registerMenuCommand("Export Chat", function() {
    if (_busy) return;
    _busy = true;
    var progress = createProgress("chat", null);
    exportChat({
      onStatus: function(t) {
        progress.setStatus(t);
      },
      onComplete: function(m) {
        progress.complete(m);
        _busy = false;
      },
      onError: function(m) {
        progress.error(m);
        _busy = false;
      }
    });
  });
  GM_registerMenuCommand("Export Sources", function() {
    if (_busy) return;
    _busy = true;
    var progress = createProgress("sources", function() {
      STATE.isCancelled = true;
    });
    exportSources({
      onProgress: function(c, t, f) {
        progress.update(c, t, f);
      },
      onComplete: function(m) {
        progress.complete(m);
        _busy = false;
      },
      onError: function(m) {
        progress.error(m);
        _busy = false;
      },
      onCancelled: function(m) {
        progress.cancel(m);
        _busy = false;
      }
    });
  });

})();
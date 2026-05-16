// ==UserScript==
// @name            Copy as Markdown for AI
// @name:de         Als Markdown für KI kopieren
// @namespace       https://github.com/marmoris-x/tampermonkey-scripts
// @version         1.0.2
// @author          marmoris-x
// @description     Select page elements with Ctrl/Cmd+Click and convert them to clean Markdown for AI prompts
// @description:de  Wähle Seitenelemente mit Strg/Cmd+Klick aus und konvertiere sie in sauberes Markdown für KI-Prompts
// @license         MIT
// @icon            https://media.licdn.com/dms/image/v2/D560BAQFyGRIuF2bqeQ/company-logo_200_200/B56ZfTe2EtHoAI-/0/1751599768258/crawl4ai_logo?e=2147483647&v=beta&t=skhRct8O4VaW42IwD7eC9Eqc9Pbavt7n6q7QgaJTQE8
// @supportURL      https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL     https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Copy%20as%20Markdown%20for%20AI.user.js
// @updateURL       https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Copy%20as%20Markdown%20for%20AI.user.js
// @match           *://*/*
// @require         https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js
// @grant           GM.download
// @grant           GM.setClipboard
// @grant           GM_addStyle
// @grant           GM_download
// @grant           GM_registerMenuCommand
// @grant           GM_setClipboard
// @run-at          document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  class MarkdownConverter {
    constructor() {
      this.converters = {
        "H1": (el, ctx) => this.convertHeading(el, 1, ctx),
        "H2": (el, ctx) => this.convertHeading(el, 2, ctx),
        "H3": (el, ctx) => this.convertHeading(el, 3, ctx),
        "H4": (el, ctx) => this.convertHeading(el, 4, ctx),
        "H5": (el, ctx) => this.convertHeading(el, 5, ctx),
        "H6": (el, ctx) => this.convertHeading(el, 6, ctx),
        "P": (el, ctx) => this.convertParagraph(el, ctx),
        "A": (el, ctx) => this.convertLink(el, ctx),
        "IMG": (el, ctx) => this.convertImage(el, ctx),
        "UL": (el, ctx) => this.convertList(el, "ul", ctx),
        "OL": (el, ctx) => this.convertList(el, "ol", ctx),
        "LI": (el, ctx) => this.convertListItem(el, ctx),
        "TABLE": (el, ctx) => this.convertTable(el, ctx),
        "BLOCKQUOTE": (el, ctx) => this.convertBlockquote(el, ctx),
        "PRE": (el, ctx) => this.convertPreformatted(el, ctx),
        "CODE": (el, ctx) => this.convertCode(el, ctx),
        "HR": () => "\n---\n",
        "BR": () => "  \n",
        "STRONG": async (el, ctx) => `**${await this.getTextContent(el, ctx)}**`,
        "B": async (el, ctx) => `**${await this.getTextContent(el, ctx)}**`,
        "EM": async (el, ctx) => `*${await this.getTextContent(el, ctx)}*`,
        "I": async (el, ctx) => `*${await this.getTextContent(el, ctx)}*`,
        "DEL": async (el, ctx) => `~~${await this.getTextContent(el, ctx)}~~`,
        "S": async (el, ctx) => `~~${await this.getTextContent(el, ctx)}~~`,
        "DIV": (el, ctx) => this.convertDiv(el, ctx),
        "SPAN": (el, ctx) => this.convertSpan(el, ctx),
        "ARTICLE": (el, ctx) => this.convertArticle(el, ctx),
        "SECTION": (el, ctx) => this.convertSection(el, ctx),
        "FIGURE": (el, ctx) => this.convertFigure(el, ctx),
        "FIGCAPTION": (el, ctx) => this.convertFigCaption(el, ctx),
        "VIDEO": (el, ctx) => this.convertVideo(el, ctx),
        "IFRAME": (el, ctx) => this.convertIframe(el, ctx),
        "DL": (el, ctx) => this.convertDefinitionList(el, ctx),
        "DT": (el, ctx) => this.convertDefinitionTerm(el, ctx),
        "DD": (el, ctx) => this.convertDefinitionDescription(el, ctx),
        "TR": (el, ctx) => this.convertTableRow(el, ctx)
      };
      this.conversionContext = {
        listDepth: 0,
        inTable: false,
        inCode: false,
        preserveWhitespace: false,
        references: [],
        imageCount: 0,
        linkCount: 0
      };
    }
    async convert(elements, options = {}) {
      this.resetContext();
      this.options = {
        includeImages: true,
        preserveTables: true,
        keepCodeFormatting: true,
        simplifyLayout: false,
        preserveLinks: true,
        ...options
      };
      const parts = [];
      for (const element of elements) {
        const md = await this.convertElement(element, this.conversionContext);
        if (md.trim()) parts.push(md);
      }
      let result = parts.join("\n\n");
      if (this.conversionContext.references.length > 0) {
        result += "\n\n" + this.generateReferences();
      }
      return this.postProcess(result);
    }
    resetContext() {
      this.conversionContext = {
        listDepth: 0,
        inTable: false,
        inCode: false,
        preserveWhitespace: false,
        references: [],
        imageCount: 0,
        linkCount: 0
      };
    }
    async convertElement(element, context) {
      if (this.isHidden(element)) return "";
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return "";
      const converter = this.converters[element.tagName];
      if (converter) return await converter(element, context);
      return await this.processChildren(element, context);
    }
    async processChildren(element, context) {
      const parts = [];
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = this.processTextNode(child, context);
          if (text) parts.push(text);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const md = await this.convertElement(child, context);
          if (md) parts.push(md);
        }
      }
      return parts.join("");
    }
    processTextNode(node, context) {
      let text = node.textContent;
      if (!context.preserveWhitespace && !context.inCode) {
        text = text.replace(/\s+/g, " ");
        if (this.isBlockBoundary(node.previousSibling)) text = text.trimStart();
        if (this.isBlockBoundary(node.nextSibling)) text = text.trimEnd();
      }
      if (!context.inCode) text = this.escapeMarkdown(text);
      return text;
    }
    isBlockBoundary(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return true;
      const blocks = [
        "DIV",
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "UL",
        "OL",
        "LI",
        "BLOCKQUOTE",
        "PRE",
        "TABLE",
        "HR",
        "ARTICLE",
        "SECTION",
        "HEADER",
        "FOOTER",
        "NAV",
        "ASIDE",
        "MAIN"
      ];
      return blocks.includes(node.tagName);
    }
    escapeMarkdown(text) {
      if (this.options.textOnly) return text;
      return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/_/g, "\\_").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\#/g, "\\#").replace(/\+/g, "\\+").replace(/\-/g, "\\-").replace(/\./g, "\\.").replace(/\!/g, "\\!").replace(/\|/g, "\\|");
    }
    async convertHeading(element, level, context) {
      const text = await this.getTextContent(element, context);
      return "#".repeat(level) + " " + text + "\n";
    }
    async convertParagraph(element, context) {
      const content = await this.processChildren(element, context);
      return content.trim() ? content + "\n" : "";
    }
    async convertLink(element, context) {
      if (!this.options.preserveLinks || this.options.textOnly) {
        return await this.getTextContent(element, context);
      }
      const text = await this.getTextContent(element, context);
      const href = element.getAttribute("href");
      const title = element.getAttribute("title");
      if (!href) return text;
      const absoluteUrl = this.makeAbsoluteUrl(href);
      if (text && absoluteUrl) {
        return title ? `[${text}](${absoluteUrl} "${title}")` : `[${text}](${absoluteUrl})`;
      }
      return text;
    }
    async convertImage(element, context) {
      if (!this.options.includeImages || this.options.textOnly) {
        if (this.options.textOnly) {
          const alt2 = element.getAttribute("alt");
          return alt2 ? `[Image: ${alt2}]` : "";
        }
        return "";
      }
      const src = element.getAttribute("src");
      const alt = element.getAttribute("alt") || "";
      const title = element.getAttribute("title");
      if (!src) return "";
      const absoluteUrl = this.makeAbsoluteUrl(src);
      return title ? `![${alt}](${absoluteUrl} "${title}")` : `![${alt}](${absoluteUrl})`;
    }
    async convertList(element, type, context) {
      const oldDepth = context.listDepth;
      context.listDepth++;
      const items = [];
      for (const child of element.children) {
        if (child.tagName === "LI") {
          const md = await this.convertListItem(child, { ...context, listType: type });
          if (md) items.push(md);
        }
      }
      context.listDepth = oldDepth;
      return items.join("\n") + (context.listDepth === 0 ? "\n" : "");
    }
    async convertListItem(element, context) {
      const indent = "  ".repeat(Math.max(0, context.listDepth - 1));
      const bullet = context.listType === "ol" ? "1." : "-";
      const content = (await this.processChildren(element, context)).trim();
      return `${indent}${bullet} ${content}`;
    }
    async convertTable(element, context) {
      if (!this.options.preserveTables || this.options.textOnly) {
        return await this.convertTableToText(element, context);
      }
      const rows = [];
      const headerRows = [];
      let maxCols = 0;
      for (const child of element.children) {
        if (child.tagName === "THEAD") {
          for (const row of child.children) {
            if (row.tagName === "TR") {
              const cells = await this.processTableRow(row, context);
              headerRows.push(cells);
              maxCols = Math.max(maxCols, cells.length);
            }
          }
        } else if (child.tagName === "TBODY") {
          for (const row of child.children) {
            if (row.tagName === "TR") {
              const cells = await this.processTableRow(row, context);
              rows.push(cells);
              maxCols = Math.max(maxCols, cells.length);
            }
          }
        } else if (child.tagName === "TR") {
          const cells = await this.processTableRow(child, context);
          rows.push(cells);
          maxCols = Math.max(maxCols, cells.length);
        }
      }
      const markdownRows = [];
      if (headerRows.length > 0) {
        for (const hr of headerRows) {
          markdownRows.push("| " + this.padTableRow(hr, maxCols).join(" | ") + " |");
        }
        markdownRows.push("| " + Array(maxCols).fill("---").join(" | ") + " |");
      }
      for (const row of rows) {
        markdownRows.push("| " + this.padTableRow(row, maxCols).join(" | ") + " |");
      }
      return markdownRows.join("\n") + "\n";
    }
    async processTableRow(row, context) {
      const cells = [];
      for (const cell of row.children) {
        if (cell.tagName === "TD" || cell.tagName === "TH") {
          cells.push((await this.getTextContent(cell, context)).trim());
        }
      }
      return cells;
    }
    async convertTableRow(element, context) {
      if (this.options.textOnly) {
        const cells2 = await this.processTableRow(element, context);
        return cells2.join(" ");
      }
      const cells = await this.processTableRow(element, context);
      return "| " + cells.join(" | ") + " |";
    }
    padTableRow(row, target) {
      const padded = [...row];
      while (padded.length < target) padded.push("");
      return padded;
    }
    async convertTableToText(element, context) {
      const lines = [];
      for (const row of element.querySelectorAll("tr")) {
        const cellTexts = [];
        for (const cell of row.querySelectorAll("td, th")) {
          const text = (await this.getTextContent(cell, context)).trim();
          if (text) cellTexts.push(text);
        }
        if (cellTexts.length > 0) lines.push(cellTexts.join(" "));
      }
      return lines.join("\n");
    }
    async convertBlockquote(element, context) {
      const lines = (await this.processChildren(element, context)).trim().split("\n");
      return lines.map((l) => "> " + l).join("\n") + "\n";
    }
    async convertPreformatted(element, context) {
      const oldInCode = context.inCode;
      const oldWs = context.preserveWhitespace;
      context.inCode = true;
      context.preserveWhitespace = true;
      let content = "";
      let language = "";
      const codeEl = element.querySelector("code");
      if (codeEl) {
        const langMatch = (codeEl.className || "").match(/language-(\w+)/);
        if (langMatch) language = langMatch[1];
        content = codeEl.textContent;
      } else {
        content = element.textContent;
      }
      context.inCode = oldInCode;
      context.preserveWhitespace = oldWs;
      return "```" + language + "\n" + content + "\n```\n";
    }
    async convertCode(element, context) {
      if (element.parentElement && element.parentElement.tagName === "PRE") {
        return element.textContent;
      }
      return "`" + element.textContent + "`";
    }
    async convertDiv(element, context) {
      if ((element.className || "").includes("code-block") || (element.className || "").includes("highlight")) {
        return await this.convertPreformatted(element, context);
      }
      const content = await this.processChildren(element, context);
      return content.trim() ? content + "\n" : "";
    }
    async convertSpan(element, context) {
      if ((element.className || "").includes("code") || (element.className || "").includes("inline-code")) {
        return this.convertCode(element, context);
      }
      return await this.processChildren(element, context);
    }
    async convertArticle(element, context) {
      const content = await this.processChildren(element, context);
      return content.trim() ? content + "\n" : "";
    }
    async convertSection(element, context) {
      const content = await this.processChildren(element, context);
      return content.trim() ? content + "\n" : "";
    }
    async convertFigure(element, context) {
      const content = await this.processChildren(element, context);
      return content.trim() ? content + "\n" : "";
    }
    async convertFigCaption(element, context) {
      const caption = await this.getTextContent(element, context);
      return caption ? "\n*" + caption + "*\n" : "";
    }
    async convertVideo(element, context) {
      const title = element.getAttribute("title") || "Video";
      if (this.options.textOnly) return `[Video: ${title}]`;
      const src = element.getAttribute("src");
      const poster = element.getAttribute("poster");
      if (!src) return "";
      if (poster) {
        return `[![${title}](${this.makeAbsoluteUrl(poster)})](${this.makeAbsoluteUrl(src)})`;
      }
      return `[${title}](${this.makeAbsoluteUrl(src)})`;
    }
    async convertIframe(element, context) {
      const title = element.getAttribute("title") || "Embedded content";
      if (this.options.textOnly) {
        const src2 = element.getAttribute("src") || "";
        if (src2.includes("youtube.com") || src2.includes("youtu.be")) return `[Video: ${title}]`;
        if (src2.includes("vimeo.com")) return `[Video: ${title}]`;
        return `[Embedded: ${title}]`;
      }
      const src = element.getAttribute("src");
      if (!src) return "";
      if (src.includes("youtube.com") || src.includes("youtu.be")) return `[▶️ ${title}](${src})`;
      if (src.includes("vimeo.com")) return `[▶️ ${title}](${src})`;
      return `[${title}](${src})`;
    }
    async convertDefinitionList(element, context) {
      return await this.processChildren(element, context) + "\n";
    }
    async convertDefinitionTerm(element, context) {
      return "**" + await this.getTextContent(element, context) + "**\n";
    }
    async convertDefinitionDescription(element, context) {
      return ": " + await this.processChildren(element, context) + "\n";
    }
    async getTextContent(element, context) {
      if (context.inCode) return element.textContent;
      return await this.processChildren(element, context);
    }
    makeAbsoluteUrl(url) {
      if (!url) return "";
      try {
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        if (url.startsWith("//")) return window.location.protocol + url;
        const base = window.location.origin;
        if (url.startsWith("/")) return base + url;
        const path = window.location.pathname;
        const pathDir = path.substring(0, path.lastIndexOf("/") + 1);
        return base + pathDir + url;
      } catch (e) {
        return url;
      }
    }
    isHidden(element) {
      const style = window.getComputedStyle(element);
      return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
    }
    generateReferences() {
      return this.conversionContext.references.map((ref, i) => `[${i + 1}]: ${ref.url}`).join("\n");
    }
    postProcess(markdown) {
      if (this.options.textOnly) markdown = this.postProcessTextOnly(markdown);
      markdown = markdown.replace(/\n{3,}/g, "\n\n");
      markdown = markdown.replace(/ +([.,;:!?])/g, "$1");
      markdown = markdown.replace(/\n(#{1,6} )/g, "\n\n$1");
      markdown = markdown.replace(/(#{1,6} .+)\n(?![\n#])/g, "$1\n\n");
      markdown = markdown.replace(/\n\n(-|\d+\.) /g, "\n$1 ");
      return markdown.trim();
    }
    postProcessTextOnly(markdown) {
      const lines = markdown.split("\n");
      const processed = [];
      let inMetadata = false;
      let currentItem = null;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          processed.push("");
          continue;
        }
        const numMatch = line.match(/^(\d+)\.\s*(.+)$/);
        if (numMatch) {
          inMetadata = false;
          currentItem = numMatch[1];
          const content = numMatch[2];
          const domMatch = content.match(/^(.+?)\s*\(([^)]+)\)\s*(.*)$/);
          if (domMatch) {
            const [, title, domain, rest] = domMatch;
            processed.push(`${currentItem}. **${title.trim()}** (${domain})`);
            if (rest.trim()) {
              processed.push(`   ${rest.trim()}`);
              inMetadata = true;
            }
          } else {
            processed.push(`${currentItem}. **${content}**`);
          }
        } else if (line.match(/\b(points?|by|ago|hide|comments?)\b/i) && currentItem) {
          const cleaned = line.replace(/\s+/g, " ").replace(/\s*\|\s*/g, " | ").trim();
          processed.push(`   ${cleaned}`);
          inMetadata = true;
        } else if (inMetadata && line.length < 100) {
          processed.push(`   ${line}`);
        } else {
          inMetadata = false;
          processed.push(line);
        }
      }
      let result = processed.join("\n");
      result = result.replace(/\n{3,}/g, "\n\n");
      result = result.replace(/^(\d+\..+)$\n^(?!\s)/gm, "$1\n\n");
      return result;
    }
  }
  class ContentAnalyzer {
    constructor() {
      this.patterns = {
        article: ["article", "main", "content", "post", "entry"],
        navigation: ["nav", "menu", "navigation", "breadcrumb"],
        sidebar: ["sidebar", "aside", "widget"],
        header: ["header", "masthead", "banner"],
        footer: ["footer", "copyright", "contact"],
        list: ["list", "items", "results", "products", "cards"],
        table: ["table", "grid", "data"],
        media: ["gallery", "carousel", "slideshow", "video", "media"]
      };
    }
    async analyze(elements) {
      return {
        structure: this.analyzeStructure(elements),
        contentType: this.identifyContentType(elements),
        hierarchy: this.buildHierarchy(elements),
        mediaAssets: this.collectMediaAssets(elements),
        textDensity: this.calculateTextDensity(elements),
        semanticRegions: this.identifySemanticRegions(elements),
        relationships: this.analyzeRelationships(elements),
        metadata: this.extractMetadata(elements)
      };
    }
    analyzeStructure(elements) {
      const structure = {
        hasHeadings: false,
        hasLists: false,
        hasTables: false,
        hasMedia: false,
        hasCode: false,
        hasLinks: false,
        layout: "linear",
        depth: 0,
        elementTypes: new Map()
      };
      for (const element of elements) {
        this.analyzeElementStructure(element, structure);
      }
      structure.layout = this.determineLayout(elements);
      structure.depth = this.calculateMaxDepth(elements);
      return structure;
    }
    analyzeElementStructure(element, structure, visited = new Set()) {
      if (visited.has(element)) return;
      visited.add(element);
      const tagName = element.tagName;
      structure.elementTypes.set(tagName, (structure.elementTypes.get(tagName) || 0) + 1);
      if (/^H[1-6]$/.test(tagName)) structure.hasHeadings = true;
      else if (["UL", "OL", "DL"].includes(tagName)) structure.hasLists = true;
      else if (tagName === "TABLE") structure.hasTables = true;
      else if (["IMG", "VIDEO", "IFRAME", "PICTURE"].includes(tagName)) structure.hasMedia = true;
      else if (["CODE", "PRE"].includes(tagName)) structure.hasCode = true;
      else if (tagName === "A") structure.hasLinks = true;
      for (const child of element.children) {
        this.analyzeElementStructure(child, structure, visited);
      }
    }
    identifyContentType(elements) {
      const scores = { article: 0, list: 0, table: 0, form: 0, media: 0, mixed: 0 };
      for (const element of elements) {
        const tagName = element.tagName;
        const className = element.className && typeof element.className === "string" ? element.className.toLowerCase() : "";
        const id = (element.id || "").toLowerCase();
        if (tagName === "ARTICLE" || this.matchesPattern(className + " " + id, this.patterns.article)) {
          scores.article += 10;
        }
        if (["UL", "OL"].includes(tagName) || this.matchesPattern(className, this.patterns.list)) {
          scores.list += 5;
        }
        if (tagName === "TABLE") scores.table += 10;
        if (tagName === "FORM" || element.querySelector("input, select, textarea")) scores.form += 5;
        if (this.matchesPattern(className, this.patterns.media) || element.querySelectorAll("img, video").length > 3) {
          scores.media += 5;
        }
      }
      const maxScore = Math.max(...Object.values(scores));
      if (maxScore === 0) return "unknown";
      for (const [type, score] of Object.entries(scores)) {
        if (score === maxScore) return type;
      }
      return "mixed";
    }
    buildHierarchy(elements) {
      const hierarchy = { root: null, levels: [], headingStructure: [] };
      if (elements.length > 0) {
        hierarchy.root = this.findCommonAncestor(elements);
      }
      const headings = [];
      for (const element of elements) {
        const found = element.querySelectorAll("h1, h2, h3, h4, h5, h6");
        headings.push(...Array.from(found));
      }
      headings.sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
      const stack = [];
      for (const heading of headings) {
        const level = parseInt(heading.tagName.substring(1));
        const item = { level, text: heading.textContent.trim(), element: heading, children: [] };
        while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(item);
        } else {
          hierarchy.headingStructure.push(item);
        }
        stack.push(item);
      }
      return hierarchy;
    }
    collectMediaAssets(elements) {
      const media = { images: [], videos: [], iframes: [], audio: [] };
      for (const element of elements) {
        element.querySelectorAll("img").forEach((img) => {
          media.images.push({ src: img.src, alt: img.alt, title: img.title, width: img.width, height: img.height, element: img });
        });
        element.querySelectorAll("video").forEach((video) => {
          media.videos.push({ src: video.src, poster: video.poster, width: video.width, height: video.height, element: video });
        });
        element.querySelectorAll("iframe").forEach((iframe) => {
          media.iframes.push({ src: iframe.src, width: iframe.width, height: iframe.height, title: iframe.title, element: iframe });
        });
        element.querySelectorAll("audio").forEach((audio) => {
          media.audio.push({ src: audio.src, element: audio });
        });
      }
      return media;
    }
    calculateTextDensity(elements) {
      let totalText = 0, totalElements = 0, linkText = 0, codeText = 0;
      for (const element of elements) {
        const stats = this.getTextStats(element);
        totalText += stats.textLength;
        totalElements += stats.elementCount;
        linkText += stats.linkTextLength;
        codeText += stats.codeTextLength;
      }
      return {
        textLength: totalText,
        elementCount: totalElements,
        averageTextPerElement: totalElements > 0 ? totalText / totalElements : 0,
        linkDensity: totalText > 0 ? linkText / totalText : 0,
        codeDensity: totalText > 0 ? codeText / totalText : 0
      };
    }
    getTextStats(element, visited = new Set()) {
      if (visited.has(element)) return { textLength: 0, elementCount: 0, linkTextLength: 0, codeTextLength: 0 };
      visited.add(element);
      let stats = { textLength: 0, elementCount: 1, linkTextLength: 0, codeTextLength: 0 };
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          stats.textLength += text.length;
          if (element.tagName === "A") stats.linkTextLength += text.length;
          if (["CODE", "PRE"].includes(element.tagName)) stats.codeTextLength += text.length;
        }
      }
      for (const child of element.children) {
        const cs = this.getTextStats(child, visited);
        stats.textLength += cs.textLength;
        stats.elementCount += cs.elementCount;
        stats.linkTextLength += cs.linkTextLength;
        stats.codeTextLength += cs.codeTextLength;
      }
      return stats;
    }
    identifySemanticRegions(elements) {
      const regions = { headers: [], navigation: [], main: [], sidebars: [], footers: [], articles: [] };
      for (const element of elements) {
        let current = element;
        while (current) {
          const tagName = current.tagName;
          const className = current.className && typeof current.className === "string" ? current.className.toLowerCase() : "";
          const role = current.getAttribute("role");
          if (tagName === "HEADER" || role === "banner") regions.headers.push(current);
          else if (tagName === "NAV" || role === "navigation") regions.navigation.push(current);
          else if (tagName === "MAIN" || role === "main") regions.main.push(current);
          else if (tagName === "ASIDE" || role === "complementary") regions.sidebars.push(current);
          else if (tagName === "FOOTER" || role === "contentinfo") regions.footers.push(current);
          else if (tagName === "ARTICLE" || role === "article") regions.articles.push(current);
          if (this.matchesPattern(className, this.patterns.header)) regions.headers.push(current);
          else if (this.matchesPattern(className, this.patterns.navigation)) regions.navigation.push(current);
          else if (this.matchesPattern(className, this.patterns.sidebar)) regions.sidebars.push(current);
          else if (this.matchesPattern(className, this.patterns.footer)) regions.footers.push(current);
          current = current.parentElement;
        }
      }
      for (const key of Object.keys(regions)) {
        regions[key] = Array.from(new Set(regions[key]));
      }
      return regions;
    }
    analyzeRelationships(elements) {
      const relationships = { siblings: [], parents: [], children: [], relatedByClass: new Map(), relatedByStructure: [] };
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          if (elements[i].parentElement === elements[j].parentElement) {
            relationships.siblings.push([elements[i], elements[j]]);
          }
        }
      }
      for (const element of elements) {
        for (const other of elements) {
          if (element !== other) {
            if (element.contains(other)) relationships.parents.push({ parent: element, child: other });
            else if (other.contains(element)) relationships.children.push({ parent: other, child: element });
          }
        }
      }
      for (const element of elements) {
        const classes = Array.from(element.classList);
        for (const cls of classes) {
          if (!relationships.relatedByClass.has(cls)) relationships.relatedByClass.set(cls, []);
          relationships.relatedByClass.get(cls).push(element);
        }
      }
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          if (this.areStructurallySimilar(elements[i], elements[j])) {
            relationships.relatedByStructure.push([elements[i], elements[j]]);
          }
        }
      }
      return relationships;
    }
    areStructurallySimilar(el1, el2) {
      if (el1.tagName !== el2.tagName) return false;
      const c1 = Array.from(el1.classList).sort();
      const c2 = Array.from(el2.classList).sort();
      const intersection = c1.filter((c) => c2.includes(c));
      const union = Array.from( new Set([...c1, ...c2]));
      if (union.length > 0 && intersection.length / union.length >= 0.5) return true;
      if (el1.children.length === el2.children.length) {
        const t1 = Array.from(el1.children).map((c) => c.tagName).sort();
        const t2 = Array.from(el2.children).map((c) => c.tagName).sort();
        if (JSON.stringify(t1) === JSON.stringify(t2)) return true;
      }
      return false;
    }
    extractMetadata(elements) {
      const metadata = { title: null, description: null, author: null, date: null, tags: [], microdata: [] };
      for (const element of elements) {
        const h1 = element.querySelector("h1");
        if (h1 && !metadata.title) metadata.title = h1.textContent.trim();
        const metas = element.querySelectorAll("[itemprop], [property], [name]");
        for (const meta of metas) {
          const prop = meta.getAttribute("itemprop") || meta.getAttribute("property") || meta.getAttribute("name");
          const content = meta.getAttribute("content") || meta.textContent.trim();
          if (prop && content) {
            if (prop.includes("author")) metadata.author = content;
            else if (prop.includes("date") || prop.includes("time")) metadata.date = content;
            else if (prop.includes("description")) metadata.description = content;
            else if (prop.includes("tag") || prop.includes("keyword")) metadata.tags.push(content);
            metadata.microdata.push({ property: prop, value: content });
          }
        }
        const times = element.querySelectorAll("time");
        for (const time of times) {
          if (!metadata.date && time.dateTime) metadata.date = time.dateTime;
        }
      }
      return metadata;
    }
    determineLayout(elements) {
      const positions = elements.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      });
      const rows = new Map();
      for (const pos of positions) {
        const row = Math.round(pos.y / 10) * 10;
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(pos);
      }
      if (Array.from(rows.values()).some((r) => r.length > 1)) return "grid";
      const widths = positions.map((p) => p.width);
      const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
      const variance = widths.reduce((s, w) => s + Math.pow(w - avg, 2), 0) / widths.length;
      if (Math.sqrt(variance) / avg > 0.3) return "mixed";
      return "linear";
    }
    calculateMaxDepth(elements) {
      let max = 0;
      for (const el of elements) max = Math.max(max, this.getElementDepth(el));
      return max;
    }
    getElementDepth(element, depth = 0) {
      if (element.children.length === 0) return depth;
      let maxChild = depth;
      for (const child of element.children) {
        maxChild = Math.max(maxChild, this.getElementDepth(child, depth + 1));
      }
      return maxChild;
    }
    findCommonAncestor(elements) {
      if (elements.length === 0) return null;
      if (elements.length === 1) return elements[0].parentElement;
      let ancestor = elements[0];
      const ancestors = [];
      while (ancestor) {
        ancestors.push(ancestor);
        ancestor = ancestor.parentElement;
      }
      for (const candidate of ancestors) {
        if (elements.every((el) => candidate.contains(el))) return candidate;
      }
      return document.body;
    }
    matchesPattern(text, patterns) {
      return patterns.some((p) => text.includes(p));
    }
  }
  function makeDraggableByHeader(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    const header = element.querySelector(".mdx-toolbar-header");
    if (!header) return;
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".mdx-close-btn")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      element.style.transition = "none";
      header.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      element.style.left = `${initialX + deltaX}px`;
      element.style.top = `${initialY + deltaY}px`;
      element.style.right = "auto";
    });
    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        element.style.transition = "";
        if (header) header.style.cursor = "grab";
      }
    });
  }
  function makeModalDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    const header = element.querySelector(".mdx-preview-header");
    if (!header) return;
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".mdx-preview-close")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      element.style.transition = "none";
      element.style.transform = "none";
      header.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      element.style.left = `${initialX + deltaX}px`;
      element.style.top = `${initialY + deltaY}px`;
    });
    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        element.style.transition = "";
        if (header) header.style.cursor = "grab";
      }
    });
  }
  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  class MarkdownPreviewModal {
    constructor() {
      this.modal = null;
      this.markdownOptions = {
        includeImages: true,
        preserveTables: true,
        keepCodeFormatting: true,
        simplifyLayout: false,
        preserveLinks: true,
        addSeparators: true,
        includeXPath: false,
        textOnly: false
      };
      this.onGenerateMarkdown = null;
      this.currentMarkdown = "";
    }
    show(generateMarkdownCallback) {
      this.onGenerateMarkdown = generateMarkdownCallback;
      if (!this.modal) this.createModal();
      this.updateContent();
      this.modal.style.display = "flex";
    }
    hide() {
      if (this.modal) this.modal.style.display = "none";
    }
    createModal() {
      this.modal = document.createElement("div");
      this.modal.className = "mdx-preview";
      this.modal.innerHTML = `
      <div class="mdx-preview-header">
        <div class="mdx-toolbar-dots">
          <span class="mdx-dot mdx-dot-red"></span>
          <span class="mdx-dot mdx-dot-yellow"></span>
          <span class="mdx-dot mdx-dot-green"></span>
        </div>
        <span class="mdx-preview-title">Markdown Preview</span>
        <button class="mdx-preview-close" title="Close">×</button>
      </div>
      <div class="mdx-preview-options">
        <label class="mdx-option-textonly"><input type="checkbox" name="textOnly"> 👁️ Visual Text Mode (As You See)</label>
        <label><input type="checkbox" name="includeImages" checked> Include Images</label>
        <label><input type="checkbox" name="preserveTables" checked> Preserve Tables</label>
        <label><input type="checkbox" name="preserveLinks" checked> Preserve Links</label>
        <label><input type="checkbox" name="keepCodeFormatting" checked> Keep Code Formatting</label>
        <label><input type="checkbox" name="simplifyLayout"> Simplify Layout</label>
        <label><input type="checkbox" name="addSeparators" checked> Add Separators</label>
        <label><input type="checkbox" name="includeXPath"> Include XPath Headers</label>
      </div>
      <div class="mdx-preview-content">
        <div class="mdx-preview-tabs">
          <button class="mdx-tab active" data-tab="preview">Preview</button>
          <button class="mdx-tab" data-tab="markdown">Markdown</button>
          <button class="mdx-wrap-toggle" title="Toggle word wrap">↔️ Wrap</button>
        </div>
        <div class="mdx-preview-pane active" data-pane="preview"></div>
        <div class="mdx-preview-pane" data-pane="markdown"></div>
      </div>
      <div class="mdx-preview-actions">
        <button class="mdx-download-btn">Download .md</button>
        <button class="mdx-copy-markdown-btn">Copy Markdown</button>
      </div>
    `;
      document.body.appendChild(this.modal);
      makeModalDraggable(this.modal);
      this.modal.style.position = "fixed";
      this.modal.style.top = "50%";
      this.modal.style.left = "50%";
      this.modal.style.transform = "translate(-50%, -50%)";
      this.modal.style.zIndex = "2147483646";
      this.modal.style.display = "none";
      this.modal.style.flexDirection = "column";
      this.setupEventListeners();
    }
    setupEventListeners() {
      this.modal.querySelector(".mdx-preview-close").addEventListener("click", () => this.hide());
      this.modal.querySelectorAll(".mdx-tab").forEach((tab) => {
        tab.addEventListener("click", (e) => this.switchTab(e.target.dataset.tab));
      });
      const wrapToggle = this.modal.querySelector(".mdx-wrap-toggle");
      wrapToggle.addEventListener("click", () => {
        this.modal.querySelectorAll(".mdx-preview-pane").forEach((p) => p.classList.toggle("wrap"));
        wrapToggle.classList.toggle("active");
      });
      this.modal.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener("change", async (e) => {
          this.markdownOptions[e.target.name] = e.target.checked;
          if (e.target.name === "textOnly") {
            const linksCb = this.modal.querySelector('input[name="preserveLinks"]');
            const imagesCb = this.modal.querySelector('input[name="includeImages"]');
            if (e.target.checked) {
              if (linksCb) {
                linksCb.checked = false;
                linksCb.disabled = true;
                this.markdownOptions.preserveLinks = false;
              }
              if (imagesCb) {
                imagesCb.disabled = true;
              }
            } else {
              if (linksCb) linksCb.disabled = false;
              if (imagesCb) imagesCb.disabled = false;
            }
          }
          await this.updateContent();
        });
      });
      this.modal.querySelector(".mdx-copy-markdown-btn").addEventListener("click", () => this.copyToClipboard());
      this.modal.querySelector(".mdx-download-btn").addEventListener("click", () => this.downloadMarkdown());
    }
    switchTab(tabName) {
      this.modal.querySelectorAll(".mdx-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.tab === tabName);
      });
      this.modal.querySelectorAll(".mdx-preview-pane").forEach((p) => {
        p.classList.toggle("active", p.dataset.pane === tabName);
      });
    }
    async updateContent() {
      if (!this.onGenerateMarkdown) return;
      try {
        this.currentMarkdown = await this.onGenerateMarkdown(this.markdownOptions);
        const mdPane = this.modal.querySelector('[data-pane="markdown"]');
        mdPane.innerHTML = `<pre><code>${escapeHtml(this.currentMarkdown)}</code></pre>`;
        const previewPane = this.modal.querySelector('[data-pane="preview"]');
        if (window.marked && window.marked.parse) {
          window.marked.setOptions && window.marked.setOptions({
            gfm: true,
            breaks: true,
            tables: true,
            headerIds: false,
            mangle: false
          });
          const html = window.marked.parse(this.currentMarkdown);
          previewPane.innerHTML = `<div class="mdx-markdown-preview">${html}</div>`;
        } else {
          previewPane.innerHTML = `<div class="mdx-markdown-preview"><pre>${escapeHtml(this.currentMarkdown)}</pre></div>`;
        }
      } catch (error) {
        console.error("[MarkdownExtraction] Preview error:", error);
        this.showToast("Error generating markdown", "error");
      }
    }
    async copyToClipboard() {
      try {
        if (typeof GM_setClipboard !== "undefined") {
          GM_setClipboard(this.currentMarkdown, "text");
          this.showToast("Markdown copied to clipboard!");
        } else if (typeof GM !== "undefined" && GM.setClipboard) {
          await GM.setClipboard(this.currentMarkdown, "text");
          this.showToast("Markdown copied to clipboard!");
        } else {
          await navigator.clipboard.writeText(this.currentMarkdown);
          this.showToast("Markdown copied to clipboard!");
        }
      } catch (err) {
        console.error("[MarkdownExtraction] Copy failed:", err);
        try {
          await navigator.clipboard.writeText(this.currentMarkdown);
          this.showToast("Markdown copied to clipboard!");
        } catch (err2) {
          this.showToast("Failed to copy. Please try again.", "error");
        }
      }
    }
    downloadMarkdown() {
      const timestamp = ( new Date()).toISOString().replace(/[:.]/g, "-").slice(0, -5);
      const filename = `markdown-export-${timestamp}.md`;
      try {
        if (typeof GM_download !== "undefined") {
          GM_download({
            url: URL.createObjectURL(new Blob([this.currentMarkdown], { type: "text/markdown" })),
            name: filename,
            saveAs: true
          });
        } else if (typeof GM !== "undefined" && GM.download) {
          GM.download({
            url: URL.createObjectURL(new Blob([this.currentMarkdown], { type: "text/markdown" })),
            name: filename,
            saveAs: true
          });
        } else {
          const blob = new Blob([this.currentMarkdown], { type: "text/markdown" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        this.showToast(`Downloaded ${filename}`);
      } catch (err) {
        console.error("[MarkdownExtraction] Download failed:", err);
        const blob = new Blob([this.currentMarkdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast(`Downloaded ${filename}`);
      }
    }
    showToast(message, type = "success") {
      const existing = document.querySelector(".mdx-toast");
      if (existing) existing.remove();
      const toast = document.createElement("div");
      toast.className = `mdx-toast mdx-toast-${type}`;
      toast.textContent = message;
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("show"));
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3e3);
    }
    getOptions() {
      return { ...this.markdownOptions };
    }
    setOptions(options) {
      this.markdownOptions = { ...this.markdownOptions, ...options };
      Object.entries(options).forEach(([key, value]) => {
        var _a;
        const cb = (_a = this.modal) == null ? void 0 : _a.querySelector(`input[name="${key}"]`);
        if (cb && typeof value === "boolean") cb.checked = value;
      });
    }
    destroy() {
      if (this.modal) {
        this.modal.remove();
        this.modal = null;
      }
      this.onGenerateMarkdown = null;
    }
  }
  class MarkdownExtraction {
    constructor() {
      this.selectedElements = new Set();
      this.highlightBoxes = new Map();
      this.toolbar = null;
      this.markdownPreviewModal = null;
      this.selectionCounter = 0;
      this.markdownConverter = null;
      this.contentAnalyzer = null;
      this.documentClickHandler = null;
      this.linkClickHandler = null;
      this.documentHoverHandler = null;
      this.documentMouseOutHandler = null;
      this.keyboardHandler = null;
      this.init();
    }
    async init() {
      this.markdownConverter = new MarkdownConverter();
      this.contentAnalyzer = new ContentAnalyzer();
      this.createToolbar();
      this.setupEventListeners();
    }
    createToolbar() {
      this.toolbar = document.createElement("div");
      this.toolbar.className = "mdx-toolbar";
      this.toolbar.innerHTML = `
      <div class="mdx-toolbar-header">
        <div class="mdx-toolbar-dots">
          <span class="mdx-dot mdx-dot-red"></span>
          <span class="mdx-dot mdx-dot-yellow"></span>
          <span class="mdx-dot mdx-dot-green"></span>
        </div>
        <span class="mdx-toolbar-title">Markdown Extraction</span>
        <button class="mdx-close-btn" title="Close">×</button>
      </div>
      <div class="mdx-toolbar-content">
        <div class="mdx-selection-info">
          <span class="mdx-selection-count">0 elements selected</span>
          <button class="mdx-clear-btn" title="Clear selection" disabled>Clear</button>
        </div>
        <div class="mdx-toolbar-actions">
          <button class="mdx-preview-btn" disabled>Preview Markdown</button>
          <button class="mdx-copy-btn" disabled>Copy to Clipboard</button>
        </div>
        <div class="mdx-toolbar-instructions">
          <p>💡 <strong>Ctrl/Cmd + Click</strong> to select multiple elements</p>
          <p>📝 Selected elements will be converted to clean markdown</p>
          <p>⌨️ Press <strong>ESC</strong> to exit</p>
          <p>⌨️ <strong>Ctrl/Cmd + A</strong> to select all visible elements</p>
      </div>
    `;
      document.body.appendChild(this.toolbar);
      this.toolbar.style.position = "fixed";
      this.toolbar.style.top = "20px";
      this.toolbar.style.right = "20px";
      this.toolbar.style.zIndex = "2147483647";
      makeDraggableByHeader(this.toolbar);
    }
    setupEventListeners() {
      this.toolbar.querySelector(".mdx-close-btn").addEventListener("click", () => this.deactivate());
      this.toolbar.querySelector(".mdx-clear-btn").addEventListener("click", () => this.clearSelection());
      this.toolbar.querySelector(".mdx-preview-btn").addEventListener("click", () => this.showPreview());
      this.toolbar.querySelector(".mdx-copy-btn").addEventListener("click", () => this.copyDirectly());
      this.documentClickHandler = (event) => this.handleElementClick(event);
      document.addEventListener("click", this.documentClickHandler, true);
      this.linkClickHandler = (event) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
        }
      };
      document.addEventListener("click", this.linkClickHandler, true);
      this.documentHoverHandler = (event) => this.handleElementHover(event);
      document.addEventListener("mouseover", this.documentHoverHandler, true);
      this.documentMouseOutHandler = (event) => this.handleElementMouseOut(event);
      document.addEventListener("mouseout", this.documentMouseOutHandler, true);
      this.keyboardHandler = (event) => this.handleKeyboard(event);
      document.addEventListener("keydown", this.keyboardHandler);
    }
    handleElementClick(event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const element = event.target;
      if (element.closest(".mdx-toolbar") || element.closest(".mdx-preview") || element.closest(".mdx-selection-badge-fixed")) {
        return;
      }
      if (this.selectedElements.has(element)) {
        this.deselectElement(element);
      } else {
        this.selectElement(element);
      }
      this.updateUI();
    }
    handleElementHover(event) {
      const element = event.target;
      if (element.closest(".mdx-toolbar") || element.closest(".mdx-preview") || element.closest(".mdx-selection-badge-fixed") || element.hasAttribute("data-mdx-badge")) {
        return;
      }
      element.classList.add("mdx-hover-candidate");
    }
    handleElementMouseOut(event) {
      event.target.classList.remove("mdx-hover-candidate");
    }
    handleKeyboard(event) {
      if (event.key === "Escape") {
        this.deactivate();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "a") {
        event.preventDefault();
        const elements = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th, div, span, article, section");
        for (const el of elements) {
          if (el.textContent.trim() && this.isVisible(el) && !this.selectedElements.has(el)) {
            this.selectElement(el);
          }
        }
        this.updateUI();
      }
    }
    isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    }
    selectElement(element) {
      this.selectedElements.add(element);
      this.createHighlightBox(element);
      element.classList.add("mdx-selected");
      this.selectionCounter++;
    }
    deselectElement(element) {
      this.selectedElements.delete(element);
      const badge = this.highlightBoxes.get(element);
      if (badge) {
        if (badge._updatePosition) {
          window.removeEventListener("scroll", badge._updatePosition, true);
          window.removeEventListener("resize", badge._updatePosition);
        }
        badge.remove();
        this.highlightBoxes.delete(element);
      }
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.removeAttribute("data-mdx-selection-order");
      element.classList.remove("mdx-selected");
      this.selectionCounter--;
    }
    createHighlightBox(element) {
      element.setAttribute("data-mdx-selection-order", this.selectionCounter + 1);
      element.style.outline = "2px solid #0fbbaa";
      element.style.outlineOffset = "2px";
      const badge = document.createElement("div");
      badge.className = "mdx-selection-badge-fixed";
      badge.textContent = this.selectionCounter + 1;
      badge.setAttribute("data-mdx-badge", "true");
      badge.title = "Click to deselect";
      const rect = element.getBoundingClientRect();
      badge.style.cssText = `
      position: fixed !important;
      top: ${rect.top - 12}px !important;
      left: ${rect.left - 12}px !important;
      width: 24px !important;
      height: 24px !important;
      background: #0fbbaa !important;
      color: #070708 !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 12px !important;
      font-weight: bold !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
      z-index: 2147483645 !important;
      cursor: pointer !important;
      transition: transform 0.2s ease, background 0.2s ease !important;
      pointer-events: auto !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      line-height: 1 !important;
      text-align: center !important;
      text-decoration: none !important;
      box-sizing: border-box !important;
    `;
      badge.addEventListener("mouseenter", () => {
        badge.style.setProperty("background", "#ff3c74", "important");
        badge.style.setProperty("transform", "scale(1.1)", "important");
      });
      badge.addEventListener("mouseleave", () => {
        badge.style.setProperty("background", "#0fbbaa", "important");
        badge.style.setProperty("transform", "scale(1)", "important");
      });
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.deselectElement(element);
        this.updateUI();
      });
      const updatePosition = () => {
        const newRect = element.getBoundingClientRect();
        badge.style.top = `${newRect.top - 12}px`;
        badge.style.left = `${newRect.left - 12}px`;
      };
      badge._updatePosition = updatePosition;
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      document.body.appendChild(badge);
      this.highlightBoxes.set(element, badge);
      return badge;
    }
    clearSelection() {
      for (const element of this.selectedElements) {
        const badge = this.highlightBoxes.get(element);
        if (badge) {
          if (badge._updatePosition) {
            window.removeEventListener("scroll", badge._updatePosition, true);
            window.removeEventListener("resize", badge._updatePosition);
          }
          badge.remove();
        }
        element.style.outline = "";
        element.style.outlineOffset = "";
        element.removeAttribute("data-mdx-selection-order");
        element.classList.remove("mdx-selected");
      }
      this.selectedElements.clear();
      this.highlightBoxes.clear();
      this.selectionCounter = 0;
      this.updateUI();
    }
    updateUI() {
      const count = this.selectedElements.size;
      this.toolbar.querySelector(".mdx-selection-count").textContent = `${count} element${count !== 1 ? "s" : ""} selected`;
      const hasSelection = count > 0;
      this.toolbar.querySelector(".mdx-preview-btn").disabled = !hasSelection;
      this.toolbar.querySelector(".mdx-copy-btn").disabled = !hasSelection;
      this.toolbar.querySelector(".mdx-clear-btn").disabled = !hasSelection;
    }
    async showPreview() {
      if (!this.markdownPreviewModal) {
        this.markdownPreviewModal = new MarkdownPreviewModal();
      }
      this.markdownPreviewModal.show(async (options) => {
        return await this.generateMarkdown(options);
      });
    }
    async generateMarkdown(options) {
      const elements = Array.from(this.selectedElements);
      const sortedElements = elements.sort((a, b) => {
        const orderA = parseInt(a.getAttribute("data-mdx-selection-order") || "0");
        const orderB = parseInt(b.getAttribute("data-mdx-selection-order") || "0");
        return orderA - orderB;
      });
      const markdownParts = [];
      for (let i = 0; i < sortedElements.length; i++) {
        const element = sortedElements[i];
        if (options.includeXPath) {
          const xpath = this.getXPath(element);
          markdownParts.push(`### Element ${i + 1} - XPath: \`${xpath}\`
`);
        }
        const elementsToConvert = [element];
        const analysis = await this.contentAnalyzer.analyze(elementsToConvert);
        const markdown = await this.markdownConverter.convert(elementsToConvert, {
          ...options,
          analysis
        });
        markdownParts.push(markdown.trim());
        if (options.addSeparators && i < sortedElements.length - 1) {
          markdownParts.push("\n---\n");
        }
      }
      return markdownParts.join("\n");
    }
    getXPath(element) {
      if (element.id) return `//*[@id="${element.id}"]`;
      const parts = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 0;
        let sibling = current.previousSibling;
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) index++;
          sibling = sibling.previousSibling;
        }
        const tagName = current.nodeName.toLowerCase();
        parts.unshift(index > 0 ? `${tagName}[${index + 1}]` : tagName);
        current = current.parentNode;
      }
      return "/" + parts.join("/");
    }
    async copyDirectly() {
      if (this.selectedElements.size === 0) return;
      const options = {
        includeImages: true,
        preserveTables: true,
        keepCodeFormatting: true,
        simplifyLayout: false,
        preserveLinks: true,
        addSeparators: true,
        includeXPath: false,
        textOnly: false
      };
      const markdown = await this.generateMarkdown(options);
      try {
        if (typeof GM_setClipboard !== "undefined") {
          GM_setClipboard(markdown, "text");
        } else if (typeof GM !== "undefined" && GM.setClipboard) {
          await GM.setClipboard(markdown, "text");
        } else {
          await navigator.clipboard.writeText(markdown);
        }
        this.showNotification("Markdown copied to clipboard!");
      } catch (err) {
        try {
          await navigator.clipboard.writeText(markdown);
          this.showNotification("Markdown copied to clipboard!");
        } catch (err2) {
          this.showNotification("Copy failed. Please try again.", "error");
        }
      }
    }
    showNotification(message, type = "success") {
      const existing = document.querySelector(".mdx-toast");
      if (existing) existing.remove();
      const notification = document.createElement("div");
      notification.className = `mdx-toast mdx-toast-${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);
      requestAnimationFrame(() => notification.classList.add("show"));
      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      }, 3e3);
    }
    deactivate() {
      document.removeEventListener("click", this.documentClickHandler, true);
      document.removeEventListener("click", this.linkClickHandler, true);
      document.removeEventListener("mouseover", this.documentHoverHandler, true);
      document.removeEventListener("mouseout", this.documentMouseOutHandler, true);
      document.removeEventListener("keydown", this.keyboardHandler);
      this.clearSelection();
      if (this.toolbar) {
        this.toolbar.remove();
        this.toolbar = null;
      }
      if (this.markdownPreviewModal) {
        this.markdownPreviewModal.destroy();
        this.markdownPreviewModal = null;
      }
      document.querySelectorAll(".mdx-hover-candidate").forEach((el) => {
        el.classList.remove("mdx-hover-candidate");
      });
    }
  }
  const styles = `
/* === Markdown Extraction — Tampermonkey Userscript Styles === */

:root {
  --mdx-bg: #16161a;
  --mdx-surface: #1e1e24;
  --mdx-border: #2d2d38;
  --mdx-text: #e4e4ec;
  --mdx-muted: #8888a0;
  --mdx-accent: #0fbbaa;
  --mdx-accent-hover: #0d9f92;
  --mdx-danger: #ff3c74;
  --mdx-danger-hover: #ff5c84;
  --mdx-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --mdx-font-mono: "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, monospace;
}

/* === Toolbar === */
.mdx-toolbar {
  position: fixed;
  background: var(--mdx-bg);
  border: 1px solid var(--mdx-border);
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  font-family: var(--mdx-font);
  font-size: 13px;
  width: 330px;
  z-index: 2147483647;
  color: var(--mdx-text);
  overflow: hidden;
  pointer-events: auto;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.mdx-toolbar *,
.mdx-preview * {
  font-family: inherit;
  box-sizing: border-box;
}

.mdx-toolbar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
  cursor: grab;
  user-select: none;
}
.mdx-toolbar-header:active { cursor: grabbing; }

.mdx-toolbar-dots {
  display: flex;
  gap: 7px;
  flex-shrink: 0;
}
.mdx-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
  padding: 0;
}
.mdx-dot-red { background: #ff5f57; }
.mdx-dot-red:hover { background: #ff3030; }
.mdx-dot-yellow { background: #ffbd2e; }
.mdx-dot-yellow:hover { background: #ffaa00; }
.mdx-dot-green { background: #28ca42; }
.mdx-dot-green:hover { background: #1eb533; }

.mdx-toolbar-title {
  flex: 1;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--mdx-text);
  letter-spacing: 0.01em;
}

.mdx-close-btn {
  background: transparent;
  border: none;
  color: var(--mdx-muted);
  font-size: 22px;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  line-height: 1;
}
.mdx-close-btn:hover { background: var(--mdx-danger); color: #fff; }

.mdx-toolbar-content { padding: 16px; }

/* === Selection Info === */
.mdx-selection-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--mdx-surface);
  border-radius: 10px;
  border: 1px solid var(--mdx-border);
}
.mdx-selection-count {
  color: var(--mdx-accent);
  font-weight: 600;
  font-size: 13px;
}
.mdx-clear-btn {
  background: transparent;
  border: 1px solid var(--mdx-border);
  color: var(--mdx-muted);
  padding: 5px 14px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}
.mdx-clear-btn:hover:not(:disabled) { border-color: var(--mdx-danger); color: var(--mdx-danger); }
.mdx-clear-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* === Toolbar Actions === */
.mdx-toolbar-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.mdx-preview-btn,
.mdx-copy-btn {
  flex: 1;
  padding: 11px 16px;
  border-radius: 9px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  letter-spacing: 0.01em;
}

.mdx-preview-btn {
  background: var(--mdx-accent);
  color: #070708;
}
.mdx-preview-btn:hover:not(:disabled) {
  background: var(--mdx-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(15, 187, 170, 0.3);
}

.mdx-copy-btn {
  background: var(--mdx-surface);
  color: var(--mdx-text);
  border: 1px solid var(--mdx-border);
}
.mdx-copy-btn:hover:not(:disabled) {
  border-color: var(--mdx-accent);
  color: var(--mdx-accent);
}

.mdx-toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* === Instructions === */
.mdx-toolbar-instructions {
  background: var(--mdx-surface);
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid var(--mdx-border);
}
.mdx-toolbar-instructions p {
  margin: 5px 0;
  color: var(--mdx-muted);
  font-size: 12px;
  line-height: 1.6;
}
.mdx-toolbar-instructions strong {
  color: var(--mdx-text);
  font-weight: 600;
}

/* === Selection Highlight === */
.mdx-hover-candidate {
  outline: 2px dashed var(--mdx-accent) !important;
  outline-offset: 2px;
  cursor: pointer !important;
  transition: outline-color 0.15s ease;
}

.mdx-selected {
  /* outline is set inline */
}

/* === Preview Modal === */
.mdx-preview {
  position: fixed;
  background: var(--mdx-bg);
  border: 1px solid var(--mdx-border);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  font-family: var(--mdx-font);
  width: 640px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  z-index: 2147483646;
  color: var(--mdx-text);
  overflow: hidden;
}

.mdx-preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
  cursor: grab;
  user-select: none;
}
.mdx-preview-header:active { cursor: grabbing; }

.mdx-preview-title {
  flex: 1;
  color: var(--mdx-text);
  font-weight: 600;
  font-size: 14px;
}

.mdx-preview-close {
  background: transparent;
  border: none;
  color: var(--mdx-muted);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  transition: all 0.2s ease;
}
.mdx-preview-close:hover { background: var(--mdx-danger); color: #fff; }

/* === Options === */
.mdx-preview-options {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
  flex-wrap: wrap;
}
.mdx-preview-options label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--mdx-muted);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.mdx-option-textonly {
  color: var(--mdx-accent) !important;
  font-weight: 600;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--mdx-border);
  margin-bottom: 6px;
  width: 100%;
}
.mdx-preview-options input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--mdx-accent);
}

/* === Content Area === */
.mdx-preview-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mdx-preview-tabs {
  display: flex;
  align-items: center;
  background: var(--mdx-surface);
  border-bottom: 1px solid var(--mdx-border);
}

.mdx-tab {
  flex: 1;
  padding: 12px;
  background: transparent;
  border: none;
  color: var(--mdx-muted);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.mdx-tab:hover { color: var(--mdx-text); }
.mdx-tab.active { color: var(--mdx-accent); }
.mdx-tab.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--mdx-accent);
  border-radius: 2px 2px 0 0;
}

.mdx-wrap-toggle {
  margin-left: auto;
  padding: 7px 14px;
  background: transparent;
  border: 1px solid var(--mdx-border);
  color: var(--mdx-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 7px;
  margin-right: 8px;
}
.mdx-wrap-toggle:hover { border-color: var(--mdx-accent); color: var(--mdx-accent); }
.mdx-wrap-toggle.active { background: var(--mdx-accent); color: #070708; border-color: var(--mdx-accent); }

.mdx-preview-pane {
  display: none;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px;
  min-height: 0;
}
.mdx-preview-pane.active { display: block; }

.mdx-preview-pane pre {
  margin: 0;
  white-space: pre;
  overflow-x: auto;
  font-family: var(--mdx-font-mono);
}
.mdx-preview-pane.wrap pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: hidden;
}
.mdx-preview-pane code {
  color: var(--mdx-text);
  font-family: var(--mdx-font-mono);
  font-size: 12.5px;
  line-height: 1.65;
}

/* Scrollbar */
.mdx-preview-pane::-webkit-scrollbar { width: 6px; }
.mdx-preview-pane::-webkit-scrollbar-track { background: transparent; }
.mdx-preview-pane::-webkit-scrollbar-thumb { background: var(--mdx-border); border-radius: 3px; }
.mdx-preview-pane::-webkit-scrollbar-thumb:hover { background: #3d3d48; }

/* Markdown Preview Rendered */
.mdx-markdown-preview {
  color: var(--mdx-text);
  line-height: 1.7;
  font-size: 14px;
}
.mdx-markdown-preview h1, .mdx-markdown-preview h2, .mdx-markdown-preview h3,
.mdx-markdown-preview h4, .mdx-markdown-preview h5, .mdx-markdown-preview h6 {
  color: #fff;
  margin: 18px 0 10px 0;
  font-weight: 600;
}
.mdx-markdown-preview h1 { font-size: 1.5em; }
.mdx-markdown-preview h2 { font-size: 1.3em; }
.mdx-markdown-preview a { color: var(--mdx-accent); text-decoration: none; }
.mdx-markdown-preview a:hover { text-decoration: underline; }
.mdx-markdown-preview code {
  background: var(--mdx-surface);
  padding: 2px 6px;
  border-radius: 5px;
  font-family: var(--mdx-font-mono);
  font-size: 0.9em;
}
.mdx-markdown-preview pre {
  background: var(--mdx-surface);
  padding: 14px;
  border-radius: 10px;
  overflow-x: auto;
  border: 1px solid var(--mdx-border);
}
.mdx-markdown-preview pre code { background: none; padding: 0; }
.mdx-markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  font-size: 13px;
}
.mdx-markdown-preview th, .mdx-markdown-preview td {
  border: 1px solid var(--mdx-border);
  padding: 9px 13px;
  text-align: left;
}
.mdx-markdown-preview th { background: var(--mdx-surface); font-weight: 600; }
.mdx-markdown-preview blockquote {
  border-left: 3px solid var(--mdx-accent);
  margin: 16px 0;
  padding-left: 16px;
  color: var(--mdx-muted);
}
.mdx-markdown-preview hr { border: none; border-top: 1px solid var(--mdx-border); margin: 24px 0; }

/* === Preview Actions === */
.mdx-preview-actions {
  display: flex;
  gap: 8px;
  padding: 14px 18px;
  background: var(--mdx-surface);
  border-top: 1px solid var(--mdx-border);
}

.mdx-download-btn,
.mdx-copy-markdown-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 9px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 13px;
  letter-spacing: 0.01em;
}

.mdx-download-btn {
  background: var(--mdx-surface);
  color: var(--mdx-text);
  border: 1px solid var(--mdx-border);
}
.mdx-download-btn:hover { border-color: var(--mdx-accent); color: var(--mdx-accent); }

.mdx-copy-markdown-btn {
  background: var(--mdx-accent);
  color: #070708;
}
.mdx-copy-markdown-btn:hover {
  background: var(--mdx-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(15, 187, 170, 0.3);
}

/* === Toast Notification === */
.mdx-toast {
  position: fixed;
  bottom: 28px;
  right: 28px;
  background: var(--mdx-bg);
  color: var(--mdx-text);
  padding: 13px 22px;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  font-family: var(--mdx-font);
  font-size: 13.5px;
  font-weight: 500;
  z-index: 2147483647;
  transform: translateY(120px);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--mdx-border);
  letter-spacing: 0.01em;
}
.mdx-toast.show { transform: translateY(0); opacity: 1; }
.mdx-toast-success { border-left: 3px solid var(--mdx-accent); }
.mdx-toast-error { border-left: 3px solid var(--mdx-danger); }

/* === Selection Badge (inline styles overridden where needed) === */
.mdx-selection-badge-fixed {
  pointer-events: auto !important;
}
`;
  
  let activeInstance = null;
  function activate() {
    if (activeInstance) {
      activeInstance.deactivate();
      activeInstance = null;
    }
    activeInstance = new MarkdownExtraction();
  }
  (function init() {
    GM_addStyle(styles);
    GM_registerMenuCommand("📝 Start Markdown Extraction", activate);
  })();

})();
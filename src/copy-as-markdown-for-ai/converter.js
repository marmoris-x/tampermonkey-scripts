'use strict';

export class MarkdownConverter {
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
      "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6",
      "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "TABLE", "HR",
      "ARTICLE", "SECTION", "HEADER", "FOOTER", "NAV", "ASIDE", "MAIN"
    ];
    return blocks.includes(node.tagName);
  }

  escapeMarkdown(text) {
    if (this.options.textOnly) return text;
    return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/_/g, "\\_")
      .replace(/\[/g, "\\[").replace(/\]/g, "\\]")
      .replace(/\(/g, "\\(").replace(/\)/g, "\\)")
      .replace(/\#/g, "\\#").replace(/\+/g, "\\+").replace(/\-/g, "\\-")
      .replace(/\./g, "\\.").replace(/\!/g, "\\!").replace(/\|/g, "\\|");
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

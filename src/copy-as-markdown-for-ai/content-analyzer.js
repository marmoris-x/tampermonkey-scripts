'use strict';

export class ContentAnalyzer {
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
    const union = Array.from(new Set([...c1, ...c2]));
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

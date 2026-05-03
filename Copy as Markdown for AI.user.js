// ==UserScript==
// @name         Copy as Markdown for AI
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.1.3
// @description  Convert web pages, selections, images, and links to Markdown for AI usage with sidebar preview and history
// @author       marmoris-x
// @match        *://*/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @noframes
// @inject-into  content
// @sandbox      JavaScript
// @icon         https://lh3.googleusercontent.com/kOVdqiI3s3rT4RlNWeY-dZ61BIuZ63bT2Ou_4rGsk47FDpVxaudzPrdO-AfC6hTj3lqn7IefPYHIXDivJpuT1b8fPA=s60
// @connect      *
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/logging-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/ui-components.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/storage-utils.js
// @require      https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/network-utils.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Copy%20as%20Markdown%20for%20AI.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Copy%20as%20Markdown%20for%20AI.user.js
// @run-at       document-idle
// @unwrap
// ==/UserScript==
var TurndownService = (function () {
  "use strict";

  function extend(destination) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (source.hasOwnProperty(key)) destination[key] = source[key];
      }
    }
    return destination;
  }

  function repeat(character, count) {
    return Array(count + 1).join(character);
  }

  function trimLeadingNewlines(string) {
    return string.replace(/^\n*/, "");
  }

  function trimTrailingNewlines(string) {
    // avoid match-at-end regexp bottleneck, see #370
    var indexEnd = string.length;
    while (indexEnd > 0 && string[indexEnd - 1] === "\n") indexEnd--;
    return string.substring(0, indexEnd);
  }

  var blockElements = [
    "ADDRESS", "ARTICLE", "ASIDE", "AUDIO", "BLOCKQUOTE", "BODY",
    "CANVAS", "CENTER", "DD", "DIR", "DIV", "DL", "DT", "FIELDSET",
    "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "FRAMESET",
    "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HGROUP", "HR",
    "HTML", "ISINDEX", "LI", "MAIN", "MENU", "NAV", "NOFRAMES",
    "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION", "TABLE",
    "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL",
  ];

  function isBlock(node) { return is(node, blockElements); }

  var voidElements = [
    "AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG",
    "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR",
  ];

  function isVoid(node) { return is(node, voidElements); }
  function hasVoid(node) { return has(node, voidElements); }

  var meaningfulWhenBlankElements = [
    "A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD",
    "IFRAME", "SCRIPT", "AUDIO", "VIDEO",
  ];

  function isMeaningfulWhenBlank(node) { return is(node, meaningfulWhenBlankElements); }
  function hasMeaningfulWhenBlank(node) { return has(node, meaningfulWhenBlankElements); }

  function is(node, tagNames) { return tagNames.indexOf(node.nodeName) >= 0; }

  function has(node, tagNames) {
    return (
      node.getElementsByTagName &&
      tagNames.some(function (tagName) {
        return node.getElementsByTagName(tagName).length;
      })
    );
  }

  var rules = {};

  rules.paragraph = {
    filter: "p",
    replacement: function (content) { return "\n\n" + content + "\n\n"; },
  };

  rules.lineBreak = {
    filter: "br",
    replacement: function (content, node, options) { return options.br + "\n"; },
  };

  rules.heading = {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    replacement: function (content, node, options) {
      var hLevel = Number(node.nodeName.charAt(1));
      if (options.headingStyle === "setext" && hLevel < 3) {
        var underline = repeat(hLevel === 1 ? "=" : "-", content.length);
        return "\n\n" + content + "\n" + underline + "\n\n";
      }
      return "\n\n" + repeat("#", hLevel) + " " + content + "\n\n";
    },
  };

  rules.blockquote = {
    filter: "blockquote",
    replacement: function (content) {
      content = content.replace(/^\n+|\n+$/g, "");
      content = content.replace(/^/gm, "> ");
      return "\n\n" + content + "\n\n";
    },
  };

  rules.list = {
    filter: ["ul", "ol"],
    replacement: function (content, node) {
      var parent = node.parentNode;
      if (parent.nodeName === "LI" && parent.lastElementChild === node) return "\n" + content;
      return "\n\n" + content + "\n\n";
    },
  };

  rules.listItem = {
    filter: "li",
    replacement: function (content, node, options) {
      content = content
        .replace(/^\n+/, "")
        .replace(/\n+$/, "\n")
        .replace(/\n/gm, "\n    ");
      var prefix = options.bulletListMarker + "   ";
      var parent = node.parentNode;
      if (parent.nodeName === "OL") {
        var start = parent.getAttribute("start");
        var index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + ".  ";
      }
      return prefix + content + (node.nextSibling && !/\n$/.test(content) ? "\n" : "");
    },
  };

  rules.indentedCodeBlock = {
    filter: function (node, options) {
      return options.codeBlockStyle === "indented" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
    },
    replacement: function (content, node, options) {
      return "\n\n    " + node.firstChild.textContent.replace(/\n/g, "\n    ") + "\n\n";
    },
  };

  rules.fencedCodeBlock = {
    filter: function (node, options) {
      return options.codeBlockStyle === "fenced" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
    },
    replacement: function (content, node, options) {
      var className = node.firstChild.getAttribute("class") || "";
      var language = (className.match(/language-(\S+)/) || [null, ""])[1];
      var code = node.firstChild.textContent;
      var fenceChar = options.fence.charAt(0);
      var fenceSize = 3;
      var fenceInCodeRegex = new RegExp("^" + fenceChar + "{3,}", "gm");
      var match;
      while ((match = fenceInCodeRegex.exec(code))) {
        if (match[0].length >= fenceSize) fenceSize = match[0].length + 1;
      }
      var fence = repeat(fenceChar, fenceSize);
      return "\n\n" + fence + language + "\n" + code.replace(/\n$/, "") + "\n" + fence + "\n\n";
    },
  };

  rules.horizontalRule = {
    filter: "hr",
    replacement: function (content, node, options) { return "\n\n" + options.hr + "\n\n"; },
  };

  rules.inlineLink = {
    filter: function (node, options) {
      return options.linkStyle === "inlined" && node.nodeName === "A" && node.getAttribute("href");
    },
    replacement: function (content, node) {
      var href = node.getAttribute("href");
      var title = cleanAttribute(node.getAttribute("title"));
      if (title) title = ' "' + title + '"';
      return "[" + content + "](" + href + title + ")";
    },
  };

  rules.referenceLink = {
    filter: function (node, options) {
      return options.linkStyle === "referenced" && node.nodeName === "A" && node.getAttribute("href");
    },
    replacement: function (content, node, options) {
      var href = node.getAttribute("href");
      var title = cleanAttribute(node.getAttribute("title"));
      if (title) title = ' "' + title + '"';
      var replacement;
      var reference;
      switch (options.linkReferenceStyle) {
        case "collapsed":
          replacement = "[" + content + "][]";
          reference = "[" + content + "]: " + href + title;
          break;
        case "shortcut":
          replacement = "[" + content + "]";
          reference = "[" + content + "]: " + href + title;
          break;
        default:
          var id = this.references.length + 1;
          replacement = "[" + content + "][" + id + "]";
          reference = "[" + id + "]: " + href + title;
      }
      this.references.push(reference);
      return replacement;
    },
    references: [],
    append: function (options) {
      var references = "";
      if (this.references.length) {
        references = "\n\n" + this.references.join("\n") + "\n\n";
        this.references = [];
      }
      return references;
    },
  };

  rules.emphasis = {
    filter: ["em", "i"],
    replacement: function (content, node, options) {
      if (!content.trim()) return "";
      return options.emDelimiter + content + options.emDelimiter;
    },
  };

  rules.strong = {
    filter: ["strong", "b"],
    replacement: function (content, node, options) {
      if (!content.trim()) return "";
      return options.strongDelimiter + content + options.strongDelimiter;
    },
  };

  rules.code = {
    filter: function (node) {
      var hasSiblings = node.previousSibling || node.nextSibling;
      var isCodeBlock = node.parentNode.nodeName === "PRE" && !hasSiblings;
      return node.nodeName === "CODE" && !isCodeBlock;
    },
    replacement: function (content) {
      if (!content) return "";
      content = content.replace(/\r?\n|\r/g, " ");
      var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? " " : "";
      var delimiter = "`";
      var matches = content.match(/`+/gm) || [];
      while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + "`";
      return delimiter + extraSpace + content + extraSpace + delimiter;
    },
  };

  rules.image = {
    filter: "img",
    replacement: function (content, node) {
      var alt = cleanAttribute(node.getAttribute("alt"));
      var src = node.getAttribute("src") || "";
      var title = cleanAttribute(node.getAttribute("title"));
      var titlePart = title ? ' "' + title + '"' : "";
      return src ? "![" + alt + "]" + "(" + src + titlePart + ")" : "";
    },
  };

  function cleanAttribute(attribute) {
    return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
  }

  function Rules(options) {
    this.options = options;
    this._keep = [];
    this._remove = [];
    this.blankRule = { replacement: options.blankReplacement };
    this.keepReplacement = options.keepReplacement;
    this.defaultRule = { replacement: options.defaultReplacement };
    this.array = [];
    for (var key in options.rules) this.array.push(options.rules[key]);
  }

  Rules.prototype = {
    add: function (key, rule) { this.array.unshift(rule); },
    keep: function (filter) { this._keep.unshift({ filter: filter, replacement: this.keepReplacement }); },
    remove: function (filter) { this._remove.unshift({ filter: filter, replacement: function () { return ""; } }); },
    forNode: function (node) {
      if (node.isBlank) return this.blankRule;
      var rule;
      if ((rule = findRule(this.array, node, this.options))) return rule;
      if ((rule = findRule(this._keep, node, this.options))) return rule;
      if ((rule = findRule(this._remove, node, this.options))) return rule;
      return this.defaultRule;
    },
    forEach: function (fn) { for (var i = 0; i < this.array.length; i++) fn(this.array[i], i); },
  };

  function findRule(rules, node, options) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (filterValue(rule, node, options)) return rule;
    }
    return void 0;
  }

  function filterValue(rule, node, options) {
    var filter = rule.filter;
    if (typeof filter === "string") {
      if (filter === node.nodeName.toLowerCase()) return true;
    } else if (Array.isArray(filter)) {
      if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true;
    } else if (typeof filter === "function") {
      if (filter.call(rule, node, options)) return true;
    } else {
      throw new TypeError("`filter` needs to be a string, array, or function");
    }
  }

  /**
   * collapseWhitespace is adapted from collapse-whitespace by Luc Thevenard.
   * MIT License (c) 2014 Luc Thevenard <lucthevenard@gmail.com>
   */
  function collapseWhitespace(options) {
    var element = options.element;
    var isBlock = options.isBlock;
    var isVoid = options.isVoid;
    var isPre = options.isPre || function (node) { return node.nodeName === "PRE"; };
    if (!element.firstChild || isPre(element)) return;
    var prevText = null;
    var keepLeadingWs = false;
    var prev = null;
    var node = next(prev, element, isPre);
    while (node !== element) {
      if (node.nodeType === 3 || node.nodeType === 4) {
        var text = node.data.replace(/[ \r\n\t]+/g, " ");
        if (!prevText || / $/.test(prevText.data)) { if (!keepLeadingWs && text[0] === " ") text = text.substr(1); }
        if (!text) { node = remove(node); continue; }
        node.data = text;
        prevText = node;
      } else if (node.nodeType === 1) {
        if (isBlock(node) || node.nodeName === "BR") {
          if (prevText) prevText.data = prevText.data.replace(/ $/, "");
          prevText = null;
          keepLeadingWs = false;
        } else if (isVoid(node) || isPre(node)) {
          prevText = null;
          keepLeadingWs = true;
        } else if (prevText) {
          keepLeadingWs = false;
        }
      } else {
        node = remove(node);
        continue;
      }
      var nextNode = next(prev, node, isPre);
      prev = node;
      node = nextNode;
    }
    if (prevText) {
      prevText.data = prevText.data.replace(/ $/, "");
      if (!prevText.data) remove(prevText);
    }
  }

  function remove(node) {
    var next = node.nextSibling || node.parentNode;
    node.parentNode.removeChild(node);
    return next;
  }

  function next(prev, current, isPre) {
    if ((prev && prev.parentNode === current) || isPre(current)) return current.nextSibling || current.parentNode;
    return current.firstChild || current.nextSibling || current.parentNode;
  }

  var root = typeof window !== "undefined" ? window : {};

  function canParseHTMLNatively() {
    var Parser = root.DOMParser;
    var canParse = false;
    try { if (new Parser().parseFromString("", "text/html")) canParse = true; } catch (e) {}
    return canParse;
  }

  function createHTMLParser() {
    var Parser = function () {};
    if (shouldUseActiveX()) {
      Parser.prototype.parseFromString = function (string) {
        var doc = new window.ActiveXObject("htmlfile");
        doc.designMode = "on";
        doc.open();
        doc.write(string);
        doc.close();
        return doc;
      };
    } else {
      Parser.prototype.parseFromString = function (string) {
        var doc = document.implementation.createHTMLDocument("");
        doc.open();
        doc.write(string);
        doc.close();
        return doc;
      };
    }
    return Parser;
  }

  function shouldUseActiveX() {
    var useActiveX = false;
    try { document.implementation.createHTMLDocument("").open(); } catch (e) { if (window.ActiveXObject) useActiveX = true; }
    return useActiveX;
  }

  var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();

  function RootNode(input, options) {
    var root;
    if (typeof input === "string") {
      var doc = htmlParser().parseFromString(
        '<x-turndown id="turndown-root">' + input + "</x-turndown>", "text/html"
      );
      root = doc.getElementById("turndown-root");
    } else {
      root = input.cloneNode(true);
    }
    collapseWhitespace({
      element: root,
      isBlock: isBlock,
      isVoid: isVoid,
      isPre: options.preformattedCode ? isPreOrCode : null,
    });
    return root;
  }

  var _htmlParser;
  function htmlParser() { _htmlParser = _htmlParser || new HTMLParser(); return _htmlParser; }

  function isPreOrCode(node) { return node.nodeName === "PRE" || node.nodeName === "CODE"; }

  function Node(node, options) {
    node.isBlock = isBlock(node);
    node.isCode = node.nodeName === "CODE" || node.parentNode.isCode;
    node.isBlank = isBlank(node);
    node.flankingWhitespace = flankingWhitespace(node, options);
    return node;
  }

  function isBlank(node) {
    return !isVoid(node) && !isMeaningfulWhenBlank(node) && /^\s*$/i.test(node.textContent) && !hasVoid(node) && !hasMeaningfulWhenBlank(node);
  }

  function flankingWhitespace(node, options) {
    if (node.isBlock || (options.preformattedCode && node.isCode)) return { leading: "", trailing: "" };
    var edges = edgeWhitespace(node.textContent);
    if (edges.leadingAscii && isFlankedByWhitespace("left", node, options)) edges.leading = edges.leadingNonAscii;
    if (edges.trailingAscii && isFlankedByWhitespace("right", node, options)) edges.trailing = edges.trailingNonAscii;
    return { leading: edges.leading, trailing: edges.trailing };
  }

  function edgeWhitespace(string) {
    var m = string.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
    return { leading: m[1], leadingAscii: m[2], leadingNonAscii: m[3], trailing: m[4], trailingNonAscii: m[5], trailingAscii: m[6] };
  }

  function isFlankedByWhitespace(side, node, options) {
    var sibling, regExp, isFlanked;
    if (side === "left") { sibling = node.previousSibling; regExp = / $/; }
    else { sibling = node.nextSibling; regExp = /^ /; }
    if (sibling) {
      if (sibling.nodeType === 3) isFlanked = regExp.test(sibling.nodeValue);
      else if (options.preformattedCode && sibling.nodeName === "CODE") isFlanked = false;
      else if (sibling.nodeType === 1 && !isBlock(sibling)) isFlanked = regExp.test(sibling.textContent);
    }
    return isFlanked;
  }

  var reduce = Array.prototype.reduce;
  var escapes = [
    [/\\/g, "\\\\"], [/\*/g, "\\*"], [/^-/g, "\\-"], [/^\+ /g, "\\+ "],
    [/^(=+)/g, "\\$1"], [/^(#{1,6}) /g, "\\$1 "], [/`/g, "\\`"],
    [/^~~~/g, "\\~~~"], [/\[/g, "\\["], [/\]/g, "\\]"], [/^>/g, "\\>"],
    [/_/g, "\\_"], [/^(\d+)\. /g, "$1\\. "],
  ];

  function TurndownService(options) {
    if (!(this instanceof TurndownService)) return new TurndownService(options);
    var defaults = {
      rules: rules,
      headingStyle: "setext", hr: "* * *", bulletListMarker: "*",
      codeBlockStyle: "indented", fence: "```", emDelimiter: "_",
      strongDelimiter: "**", linkStyle: "inlined", linkReferenceStyle: "full",
      br: "  ", preformattedCode: false,
      blankReplacement: function (content, node) { return node.isBlock ? "\n\n" : ""; },
      keepReplacement: function (content, node) { return node.isBlock ? "\n\n" + node.outerHTML + "\n\n" : node.outerHTML; },
      defaultReplacement: function (content, node) { return node.isBlock ? "\n\n" + content + "\n\n" : content; },
    };
    this.options = extend({}, defaults, options);
    this.rules = new Rules(this.options);
  }

  TurndownService.prototype = {
    turndown: function (input) {
      if (!canConvert(input)) throw new TypeError(input + " is not a string, or an element/document/fragment node.");
      if (input === "") return "";
      var output = process.call(this, new RootNode(input, this.options));
      return postProcess.call(this, output);
    },
    use: function (plugin) {
      if (Array.isArray(plugin)) { for (var i = 0; i < plugin.length; i++) this.use(plugin[i]); }
      else if (typeof plugin === "function") plugin(this);
      else throw new TypeError("plugin must be a Function or an Array of Functions");
      return this;
    },
    addRule: function (key, rule) { this.rules.add(key, rule); return this; },
    keep: function (filter) { this.rules.keep(filter); return this; },
    remove: function (filter) { this.rules.remove(filter); return this; },
    escape: function (string) { return escapes.reduce(function (a, e) { return a.replace(e[0], e[1]); }, string); },
  };

  function process(parentNode) {
    var self = this;
    return reduce.call(parentNode.childNodes, function (output, node) {
      node = new Node(node, self.options);
      var replacement = "";
      if (node.nodeType === 3) replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue);
      else if (node.nodeType === 1) replacement = replacementForNode.call(self, node);
      return join(output, replacement);
    }, "");
  }

  function postProcess(output) {
    var self = this;
    this.rules.forEach(function (rule) { if (typeof rule.append === "function") output = join(output, rule.append(self.options)); });
    return output.replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "");
  }

  function replacementForNode(node) {
    var rule = this.rules.forNode(node);
    var content = process.call(this, node);
    var whitespace = node.flankingWhitespace;
    if (whitespace.leading || whitespace.trailing) content = content.trim();
    return whitespace.leading + rule.replacement(content, node, this.options) + whitespace.trailing;
  }

  function join(output, replacement) {
    var s1 = trimTrailingNewlines(output);
    var s2 = trimLeadingNewlines(replacement);
    var nls = Math.max(output.length - s1.length, replacement.length - s2.length);
    var separator = "\n\n".substring(0, nls);
    return s1 + separator + s2;
  }

  function canConvert(input) {
    return input != null && (typeof input === "string" || (input.nodeType && (input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11)));
  }

  return TurndownService;
})();

// ============================================================
// MAIN IMPLEMENTATION
// ============================================================
(function () {
  'use strict';

  // Only run in the top-level frame — @noframes handles Tampermonkey, this guards edge cases
  if (window.top !== window.self) return;
  // Prevent double-init on SPA navigations
  if (window.__mdsLoaded) return;
  window.__mdsLoaded = true;

  const log = TM.createLogger('Copy as Markdown');

  const STORAGE_KEY = 'mds_history';
  const MAX_HISTORY = 10;
  const SIDEBAR_WIDTH = 380;

  // ── FIX 1: Language-hint recognition ────────────────────────────────────────
  const LANG_HINTS = new Set([
    'bash','sh','shell','zsh','fish','cmd','bat','powershell','ps1',
    'javascript','js','jsx','typescript','ts','tsx',
    'python','py','ruby','rb','go','rust','java','c','cpp','c++','c#','cs',
    'css','scss','sass','less','html','xml','svg','json','jsonc',
    'yaml','yml','toml','ini','env','dotenv',
    'sql','graphql','gql','r','swift','kotlin','dart','scala',
    'haskell','lua','perl','php','elixir','clojure','clj',
    'dockerfile','makefile','nginx','text','txt','plain','output','log'
  ]);

  // ── FIX 2: HTML entity decoding ─────────────────────────────────────────────
  function decodeHTMLEntities(str) {
    return str
      .replace(/&amp;/g,  '&')
      .replace(/&lt;/g,   '<')
      .replace(/&gt;/g,   '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  // ── FIX 4: Restore over-escaped asterisk pairs ──────────────────────────────
  function postProcessMarkdown(md) {
    return md
      .replace(/\\\*\\\*([^\n]{1,80}?)\\\*\\\*/g, '**$1**')
      .replace(/\\\*([^\n*]{1,40}?)\\\*/g, '*$1*');
  }

  // ── Sidebar content CSS (adapted for closed Shadow DOM) ─────────────────
  const ADAPTED_CSS = `
:host {
  --bg:        #0e0c09;
  --surface:   #181510;
  --surface2:  #211d16;
  --border:    #2d2820;
  --border2:   #3d3628;
  --accent:    #f59e0b;
  --accent-dim:#7c5109;
  --accent-lo: #1a1105;
  --text:      #f0ebe0;
  --text-dim:  #7a7060;
  --text-mid:  #b0a890;
  --green:     #34d399;
  --red:       #f87171;
  --mono:      ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans:      system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
*, *::before, *::after {
  box-sizing: border-box !important;
  font-family: inherit !important;
}
button, div, span {
  all: revert;
  box-sizing: border-box !important;
  margin: 0 !important;
  line-height: normal !important;
  font-family: var(--sans) !important;
}
input {
  all: revert;
  box-sizing: border-box !important;
  margin: 0 !important;
  font-family: var(--sans) !important;
}
label {
  all: revert;
  box-sizing: border-box !important;
  margin: 0 !important;
  font-family: var(--sans) !important;
}
button {
  appearance: none !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  line-height: 1 !important;
}

/* ── Header ── */
#mds-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 14px !important;
  height: 46px !important;
  background: var(--surface) !important;
  border-bottom: 1px solid var(--border) !important;
  flex-shrink: 0 !important;
}
#mds-logo {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-family: var(--mono) !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  color: var(--accent) !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
}
#mds-logo-icon {
  width: 22px !important;
  height: 22px !important;
  background: var(--accent) !important;
  border-radius: 4px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 11px !important;
  color: var(--bg) !important;
  font-weight: 700 !important;
  flex-shrink: 0 !important;
}
#mds-close {
  width: 28px !important;
  height: 28px !important;
  border: none !important;
  background: var(--surface2) !important;
  color: var(--text-dim) !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background 0.15s, color 0.15s !important;
  padding: 0 !important;
}
#mds-close:hover {
  background: var(--border2) !important;
  color: var(--text) !important;
}

/* ── Section label ── */
.mds-label {
  font-family: var(--mono) !important;
  font-size: 9px !important;
  font-weight: 600 !important;
  letter-spacing: 0.16em !important;
  text-transform: uppercase !important;
  color: var(--text-dim) !important;
  padding: 12px 14px 5px !important;
  display: block !important;
}

/* ── Copy action buttons ── */
#mds-actions {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 6px !important;
  padding: 0 14px 10px !important;
}
.mds-action-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  padding: 8px 10px !important;
  background: var(--surface2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 7px !important;
  color: var(--text-mid) !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: background 0.15s, border-color 0.15s, color 0.15s !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  line-height: 1 !important;
}
.mds-action-btn:hover {
  background: var(--border) !important;
  border-color: var(--border2) !important;
  color: var(--text) !important;
}
.mds-action-btn.mds-active-mode {
  background: var(--accent-lo) !important;
  border-color: var(--accent-dim) !important;
  color: var(--accent) !important;
  animation: mds-pulse 1.5s ease-in-out infinite !important;
}
@keyframes mds-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
  50%       { box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }
}
.mds-action-icon {
  font-size: 13px !important;
  flex-shrink: 0 !important;
  line-height: 1 !important;
}

/* ── Divider ── */
.mds-divider {
  height: 1px !important;
  background: var(--border) !important;
  margin: 4px 0 !important;
  flex-shrink: 0 !important;
}

/* ── Options toggles ── */
#mds-options {
  padding: 0 14px 10px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
}
.mds-toggle-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 6px 8px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  transition: background 0.12s !important;
  user-select: none !important;
}
.mds-toggle-row:hover {
  background: var(--surface2) !important;
}
.mds-toggle-row input[type="checkbox"] {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  position: absolute !important;
  pointer-events: none !important;
}
.mds-toggle-label {
  font-size: 12px !important;
  color: var(--text-mid) !important;
  line-height: 1.4 !important;
  flex: 1 !important;
}
.mds-switch {
  width: 30px !important;
  height: 16px !important;
  background: var(--border2) !important;
  border-radius: 8px !important;
  position: relative !important;
  transition: background 0.2s !important;
  flex-shrink: 0 !important;
  display: block !important;
}
.mds-switch::after {
  content: '' !important;
  position: absolute !important;
  top: 2px !important;
  left: 2px !important;
  width: 12px !important;
  height: 12px !important;
  border-radius: 50% !important;
  background: var(--text-dim) !important;
  transition: transform 0.2s, background 0.2s !important;
}
.mds-toggle-row input[type="checkbox"]:checked + .mds-switch {
  background: var(--accent-dim) !important;
}
.mds-toggle-row input[type="checkbox"]:checked + .mds-switch::after {
  transform: translateX(14px) !important;
  background: var(--accent) !important;
}

/* ── URL fetch ── */
#mds-url-section {
  padding: 0 14px 10px !important;
}
#mds-url-row {
  display: flex !important;
  gap: 6px !important;
}
#mds-url-input {
  flex: 1 !important;
  padding: 6px 10px !important;
  background: var(--surface2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 7px !important;
  color: var(--text) !important;
  font-size: 12px !important;
  font-family: var(--mono) !important;
  outline: none !important;
  transition: border-color 0.15s !important;
  min-width: 0 !important;
}
#mds-url-input::placeholder {
  color: var(--text-dim) !important;
  opacity: 1 !important;
}
#mds-url-input:focus {
  border-color: var(--accent-dim) !important;
}
#mds-url-fetch {
  padding: 6px 12px !important;
  background: var(--accent) !important;
  color: var(--bg) !important;
  border: none !important;
  border-radius: 7px !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  transition: opacity 0.15s !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}
#mds-url-fetch:hover { opacity: 0.85 !important; }
#mds-url-fetch:disabled { opacity: 0.4 !important; cursor: default !important; }

/* ── Content tabs ── */
#mds-tabs {
  display: flex !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 0 14px !important;
  gap: 0 !important;
  flex-shrink: 0 !important;
}
.mds-tab {
  padding: 8px 12px !important;
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  color: var(--text-dim) !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  margin-bottom: -1px !important;
  transition: color 0.15s, border-color 0.15s !important;
  outline: none !important;
}
.mds-tab:hover { color: var(--text-mid) !important; }
.mds-tab.active {
  color: var(--accent) !important;
  border-bottom-color: var(--accent) !important;
}

/* ── Preview ── */
#mds-panel-preview {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
#mds-panel-preview.hidden { display: none !important; }
#mds-preview-toolbar {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  padding: 6px 14px !important;
  flex-shrink: 0 !important;
  gap: 6px !important;
}
#mds-preview-source {
  font-family: var(--mono) !important;
  font-size: 10px !important;
  color: var(--text-dim) !important;
  flex: 1 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
#mds-copy-preview {
  padding: 4px 12px !important;
  background: var(--surface2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 5px !important;
  color: var(--text-mid) !important;
  cursor: pointer !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  transition: background 0.15s, color 0.15s, border-color 0.15s !important;
}
#mds-copy-preview:hover {
  background: var(--accent) !important;
  color: var(--bg) !important;
  border-color: var(--accent) !important;
}
#mds-preview {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 12px 14px !important;
  font-family: var(--mono) !important;
  font-size: 11.5px !important;
  line-height: 1.7 !important;
  color: var(--text-mid) !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  scrollbar-width: thin !important;
  scrollbar-color: var(--border2) transparent !important;
}
#mds-preview::-webkit-scrollbar { width: 4px !important; }
#mds-preview::-webkit-scrollbar-thumb { background: var(--border2) !important; border-radius: 4px !important; }
.mds-loading {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 80px !important;
  color: var(--text-dim) !important;
  font-size: 12px !important;
  font-style: italic !important;
  gap: 8px !important;
}
.mds-loading::before {
  content: '' !important;
  width: 12px !important;
  height: 12px !important;
  border: 2px solid var(--border2) !important;
  border-top-color: var(--accent) !important;
  border-radius: 50% !important;
  animation: mds-spin 0.8s linear infinite !important;
}
@keyframes mds-spin { to { transform: rotate(360deg); } }

/* ── History ── */
#mds-panel-history {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
#mds-panel-history.hidden { display: none !important; }
#mds-history-list {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 10px 14px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
  scrollbar-width: thin !important;
  scrollbar-color: var(--border2) transparent !important;
}
#mds-history-list::-webkit-scrollbar { width: 4px !important; }
#mds-history-list::-webkit-scrollbar-thumb { background: var(--border2) !important; border-radius: 4px !important; }
.mds-empty {
  color: var(--text-dim) !important;
  font-style: italic !important;
  text-align: center !important;
  padding: 24px 0 !important;
  font-size: 12px !important;
}
.mds-hist-item {
  background: var(--surface) !important;
  border: 1px solid var(--border) !important;
  border-left: 3px solid var(--accent-dim) !important;
  border-radius: 7px !important;
  padding: 10px 11px !important;
  transition: border-left-color 0.15s !important;
}
.mds-hist-item:hover { border-left-color: var(--accent) !important; }
.mds-hist-row1 {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 4px !important;
}
.mds-hist-badge {
  font-family: var(--mono) !important;
  font-size: 9px !important;
  font-weight: 500 !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  color: var(--accent) !important;
  background: var(--accent-lo) !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  border: 1px solid var(--accent-dim) !important;
}
.mds-hist-time {
  font-size: 10px !important;
  color: var(--text-dim) !important;
}
.mds-hist-title {
  font-size: 12px !important;
  font-weight: 500 !important;
  color: var(--text) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  margin-bottom: 3px !important;
}
.mds-hist-preview {
  font-family: var(--mono) !important;
  font-size: 10.5px !important;
  color: var(--text-dim) !important;
  line-height: 1.5 !important;
  overflow: hidden !important;
  max-height: 32px !important;
  margin-bottom: 8px !important;
  word-break: break-all !important;
}
.mds-hist-actions {
  display: flex !important;
  gap: 5px !important;
}
.mds-hist-btn {
  padding: 3px 10px !important;
  border-radius: 4px !important;
  border: 1px solid var(--border2) !important;
  background: var(--surface2) !important;
  color: var(--text-mid) !important;
  font-size: 11px !important;
  cursor: pointer !important;
  transition: background 0.12s, color 0.12s, border-color 0.12s !important;
}
.mds-hist-btn:hover {
  background: var(--accent) !important;
  color: var(--bg) !important;
  border-color: var(--accent) !important;
}
.mds-hist-btn.del:hover {
  background: var(--red) !important;
  color: white !important;
  border-color: var(--red) !important;
}

/* ── Theme button ── */
#mds-theme-btn {
  width: 28px !important;
  height: 28px !important;
  border: none !important;
  background: var(--surface2) !important;
  color: var(--text-dim) !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background 0.15s, color 0.15s !important;
  padding: 0 !important;
}
#mds-theme-btn:hover { background: var(--border2) !important; color: var(--text) !important; }

/* ── Light theme overrides ── */
:host([data-theme="light"]) {
  --bg:        #ffffff;
  --surface:   #f5f5f4;
  --surface2:  #ebe9e6;
  --border:    #ddd8d0;
  --border2:   #c9c4bc;
  --accent:    #c77c00;
  --accent-dim:#c77c00;
  --accent-lo: #fff8ec;
  --text:      #1c1a17;
  --text-dim:  #9a9080;
  --text-mid:  #5a5248;
  --green:     #16a34a;
  --red:       #dc2626;
}
:host([data-theme="light"]) #mds-preview { color: var(--text-mid) !important; }
:host([data-theme="light"]) .mds-hist-item { border-left-color: var(--accent-dim) !important; }
`;

  // ── Sidebar inner HTML (content only — shared sidebar provides the shell) ──
  const SIDEBAR_HTML = `
<div id="mds-header">
  <div id="mds-logo">
    <span id="mds-logo-icon">M↓</span>
    <span>Markdown</span>
  </div>
  <div style="display:flex;gap:4px;align-items:center">
    <button id="mds-theme-btn" title="Toggle dark/light mode">☀</button>
    <button id="mds-close" title="Close sidebar">✕</button>
  </div>
</div>

<div class="mds-label">Copy as</div>
<div id="mds-actions">
  <button class="mds-action-btn" id="mds-act-page">
    <span class="mds-action-icon">📄</span> Page
  </button>
  <button class="mds-action-btn" id="mds-act-sel">
    <span class="mds-action-icon">✂️</span> Selection
  </button>
  <button class="mds-action-btn" id="mds-act-img">
    <span class="mds-action-icon">🖼</span> Image
  </button>
  <button class="mds-action-btn" id="mds-act-link">
    <span class="mds-action-icon">🔗</span> Link
  </button>
</div>

<div class="mds-divider"></div>
<div class="mds-label">Options</div>
<div id="mds-options">
  <label class="mds-toggle-row">
    <span class="mds-toggle-label">Include Title</span>
    <input type="checkbox" id="mds-opt-title" checked>
    <span class="mds-switch"></span>
  </label>
  <label class="mds-toggle-row">
    <span class="mds-toggle-label">Ignore Links & Images</span>
    <input type="checkbox" id="mds-opt-nolinks">
    <span class="mds-switch"></span>
  </label>
  <label class="mds-toggle-row">
    <span class="mds-toggle-label">Clean / Filter</span>
    <input type="checkbox" id="mds-opt-clean" checked>
    <span class="mds-switch"></span>
  </label>
</div>

<div class="mds-divider"></div>
<div class="mds-label">Fetch URL</div>
<div id="mds-url-section">
  <div id="mds-url-row">
    <input type="url" id="mds-url-input" placeholder="https://example.com/article">
    <button id="mds-url-fetch">Fetch →</button>
  </div>
</div>

<div class="mds-divider"></div>
<div id="mds-tabs">
  <button class="mds-tab active" id="mds-tab-preview">Preview</button>
  <button class="mds-tab" id="mds-tab-history">History</button>
</div>

<div id="mds-panel-preview">
  <div id="mds-preview-toolbar">
    <span id="mds-preview-source"></span>
    <button id="mds-copy-preview">Copy</button>
  </div>
  <pre id="mds-preview"><span class="mds-loading"></span></pre>
</div>
<div id="mds-panel-history" class="hidden">
  <div id="mds-history-list"></div>
</div>
`;

  // ── State ─────────────────────────────────────────────────
  let currentMarkdown = '';
  let currentTheme = 'dark';
  let sidebar = null;
  let activeClickMode = null;
  let _clickListener = null;
  let _keyListener = null;
  let _hoverStyle = null;
  let _cachedTurndown = null;
  let _cachedOptsKey = '';

  // ── Persistent options ────────────────────────────────────
  const OPTS_KEY = 'mds_opts';
  const DEFAULT_OPTS = { title: true, nolinks: false, clean: true };

  async function loadOpts() {
    const stored = await TM.storage.loadSetting(OPTS_KEY, null);
    if (!stored) return Object.assign({}, DEFAULT_OPTS);
    try {
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
      return Object.assign({}, DEFAULT_OPTS, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULT_OPTS);
    }
  }

  async function saveOpts() {
    const o = getOpts();
    await TM.storage.saveSetting(OPTS_KEY, o);
    return o;
  }

  function getOpts() {
    const r = sidebar ? sidebar.root : null;
    if (!r) return { title: true, nolinks: false, clean: true };
    return {
      title:   r.querySelector('#mds-opt-title')?.checked   ?? true,
      nolinks: r.querySelector('#mds-opt-nolinks')?.checked ?? false,
      clean:   r.querySelector('#mds-opt-clean')?.checked   ?? true,
    };
  }

  // ── TurndownService setup ────────────────────────────────
  function createTurndown(opts = {}) {
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

    // ── Images ─────────────────────────────────────────────
    if (opts.nolinks) {
      td.addRule('stripImages', { filter: 'img',    replacement: () => '' });
      td.addRule('stripLinks',  { filter: 'a',      replacement: (c) => c });
      td.addRule('stripFigure', { filter: 'figure', replacement: () => '' });
      td.addRule('stripPicture',{ filter: 'picture',replacement: () => '' });
    } else {
      td.addRule('imgAltFallback', {
        filter: 'img',
        replacement: (content, node) => {
          const src = node.getAttribute('data-src') ||
                      node.getAttribute('data-lazy-src') ||
                      node.getAttribute('data-original') ||
                      node.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          const rawAlt = node.getAttribute('alt') || '';
          const alt = rawAlt && !/^https?:|^\/|^data:/.test(rawAlt)
            ? rawAlt
            : (src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image');
          return `![${alt}](${src})`;
        }
      });

      td.addRule('picture', {
        filter: 'picture',
        replacement: (content, node) => {
          const img = node.querySelector('img');
          if (!img) return content;
          const src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          const alt = img.getAttribute('alt') || src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image';
          return `![${alt}](${src})`;
        }
      });

      td.addRule('figure', {
        filter: 'figure',
        replacement: (content, node) => {
          const img = node.querySelector('img');
          if (!img) return content;
          const src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          const caption = node.querySelector('figcaption');
          const captionText = caption?.textContent.trim() || '';
          const alt = img.getAttribute('alt') || captionText || src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image';
          const imgMd = `![${alt}](${src})`;
          return captionText ? `\n\n${imgMd}\n*${captionText}*\n\n` : `\n\n${imgMd}\n\n`;
        }
      });
    }

    // ── FIX 3: Robust link handling ─────────────────────────────────────────────
    td.addRule('robustLink', {
      filter: (node) => {
        if (node.nodeName !== 'A') return false;
        const href = node.getAttribute('href') || node.getAttribute('data-mds-href') || '';
        return !!(href && href !== '#' && !href.startsWith('javascript:'));
      },
      replacement: (content, node) => {
        if (!content.trim()) return '';
        const href = node.getAttribute('href') || node.getAttribute('data-mds-href') || '';
        if (!href || href === '#' || href.startsWith('javascript:')) return content;
        const title = (node.getAttribute('title') || '').replace(/(\n+\s*)+/g, '\n');
        const titlePart = title ? ` "${title}"` : '';
        return `[${content}](${href}${titlePart})`;
      }
    });

    // ── FIX 1: Bare <pre> without a <code> child → fenced code block ───────────
    td.addRule('barePre', {
      filter: (node) => {
        return node.nodeName === 'PRE' && !(node.firstChild && node.firstChild.nodeName === 'CODE');
      },
      replacement: (content, node) => {
        const lang = node.getAttribute('data-mds-lang') || '';
        const code = decodeHTMLEntities(node.textContent).replace(/\n$/, '');
        const fenceSize = Math.max(3, (code.match(/`{3,}/gm) || [])
          .reduce((m, s) => Math.max(m, s.length + 1), 3));
        const fence = '`'.repeat(fenceSize);
        return `\n\n${fence}${lang}\n${code}\n${fence}\n\n`;
      }
    });

    // ── FIX 2: Inline <code> with entity decoding ───────────────────────────────
    td.addRule('inlineCodeDecoded', {
      filter: (node) => {
        const hasSiblings = node.previousSibling || node.nextSibling;
        const isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;
        return node.nodeName === 'CODE' && !isCodeBlock;
      },
      replacement: (content) => {
        if (!content) return '';
        let text = decodeHTMLEntities(content).replace(/\r?\n|\r/g, ' ');
        const extraSpace = /^`|^ .*?[^ ].* $|`$/.test(text) ? ' ' : '';
        let delimiter = '`';
        const matches = text.match(/`+/gm) || [];
        while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`';
        return delimiter + extraSpace + text + extraSpace + delimiter;
      }
    });

    // ── Rich inline elements ────────────────────────────────
    td.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (c) => c.trim() ? `~~${c}~~` : ''
    });
    td.addRule('mark', {
      filter: 'mark',
      replacement: (c) => c.trim() ? `==${c}==` : ''
    });
    td.addRule('sup', { filter: 'sup', replacement: (c) => c ? `^${c}^` : '' });
    td.addRule('sub', { filter: 'sub', replacement: (c) => c ? `~${c}~` : '' });

    // ── Structural elements ─────────────────────────────────
    td.addRule('summary', { filter: 'summary', replacement: () => '' });
    td.addRule('details', {
      filter: 'details',
      replacement: (content, node) => {
        const summary = node.querySelector('summary');
        const title   = summary ? summary.textContent.trim() : 'Details';
        const body = content.replace(/^\s+/, '').trim();
        return `\n\n**${title}**\n\n${body}\n\n`;
      }
    });

    td.addRule('dtdd', { filter: ['dt', 'dd'], replacement: () => '' });
    td.addRule('dl', {
      filter: 'dl',
      replacement: (content, node) => {
        const parts = [];
        node.querySelectorAll('dt, dd').forEach(el => {
          const clone = el.cloneNode(true);
          const text = td.turndown(clone.innerHTML).replace(/[\r\n]+/g, ' ').trim();
          parts.push(el.tagName === 'DT' ? `**${text}**` : `  ${text}`);
        });
        return '\n\n' + parts.join('\n') + '\n\n';
      }
    });

    td.addRule('kbd', {
      filter: 'kbd',
      replacement: (c) => c ? `\`${c}\`` : ''
    });

    td.addRule('abbr', {
      filter: 'abbr',
      replacement: (c, node) => {
        const title = node.getAttribute('title');
        return title ? `${c} _(${title})_` : c;
      }
    });

    // ── Clean headings ─────────────────────────────────────
    td.addRule('cleanHeadings', {
      filter: ['h1','h2','h3','h4','h5','h6'],
      replacement: (content, node) => {
        const level = Number(node.nodeName.charAt(1));
        const clean = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) return '';
        return `\n\n${'#'.repeat(level)} ${clean}\n\n`;
      }
    });

    // ── ARIA-role tables ───────────────────────────────────
    td.addRule('ariaTableInternals', {
      filter: (node) => {
        const r = node.getAttribute?.('role');
        return ['rowgroup','row','columnheader','cell','rowheader'].includes(r);
      },
      replacement: () => ''
    });
    td.addRule('ariaTable', {
      filter: (node) => node.getAttribute?.('role') === 'table' || node.getAttribute?.('role') === 'grid',
      replacement: (content, node) => ariaTableToMarkdown(node, td)
    });

    // ── HTML <table> support ────────────────────────────────
    td.addRule('tableInternals', {
      filter: ['thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
      replacement: () => ''
    });
    td.addRule('table', {
      filter: 'table',
      replacement: (content, node) => tableNodeToMarkdown(node, td)
    });

    return td;
  }

  function getSafeCellText(cell, td) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    return td.turndown(clone.innerHTML)
      .replace(/[\r\n]+/g, ' ')
      .replace(/\|/g, '\\|')
      .trim() || ' ';
  }

  function tableNodeToMarkdown(node, td) {
    const allRows = Array.from(node.rows);
    if (!allRows.length) return '';
    const grid = [];
    let maxCols = 0;
    for (let r = 0; r < allRows.length; r++) {
      grid[r] = grid[r] || [];
      let c = 0;
      for (const cell of allRows[r].cells) {
        while (grid[r][c] !== undefined) c++;
        const text = getSafeCellText(cell, td);
        const rowSp = cell.rowSpan || 1;
        const colSp = cell.colSpan || 1;
        for (let i = 0; i < rowSp; i++) {
          grid[r + i] = grid[r + i] || [];
          for (let j = 0; j < colSp; j++) {
            grid[r + i][c + j] = (i === 0 && j === 0) ? text : ' ';
          }
        }
        c += colSp;
      }
      maxCols = Math.max(maxCols, grid[r].length);
    }
    if (maxCols === 0) return '';
    const rowToMd = (rowArr) => {
      while (rowArr.length < maxCols) rowArr.push(' ');
      return '| ' + rowArr.join(' | ') + ' |';
    };
    const hasThead = node.querySelector('thead') || allRows[0]?.querySelector('th');
    const sep = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
    if (hasThead && grid.length > 0) {
      const header = rowToMd(grid[0]);
      const body   = grid.slice(1).map(rowToMd).join('\n');
      return '\n\n' + header + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
    } else {
      const emptyHdr = '| ' + Array(maxCols).fill(' ').join(' | ') + ' |';
      const body     = grid.map(rowToMd).join('\n');
      return '\n\n' + emptyHdr + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
    }
  }

  function ariaTableToMarkdown(node, td) {
    const cellText = (cell) => getSafeCellText(cell, td);
    const rowToMd = (row) => {
      const cells = Array.from(row.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]'));
      return cells.length ? '| ' + cells.map(cellText).join(' | ') + ' |' : null;
    };
    const allRows = Array.from(node.querySelectorAll('[role="row"]'));
    if (!allRows.length) return '';
    const headerRow = allRows.find(r =>
      r.querySelector('[role="columnheader"],[role="rowheader"]') &&
      !r.querySelector('[role="cell"],[role="gridcell"]')
    );
    const bodyRows = allRows.filter(r => r !== headerRow &&
      r.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]').length > 0
    );
    let headers, colCount;
    if (headerRow) {
      headers = Array.from(headerRow.querySelectorAll('[role="columnheader"],[role="rowheader"]')).map(cellText);
      colCount = headers.length;
    } else {
      colCount = Math.max(...bodyRows.map(r =>
        r.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]').length
      ), 1);
      headers = Array(colCount).fill(' ');
    }
    const header = '| ' + headers.join(' | ') + ' |';
    const sep    = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    const body   = bodyRows.map(rowToMd).filter(Boolean).join('\n');
    return '\n\n' + header + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
  }

  // ── DOM cleanup ──────────────────────────────────────────
  function cleanDOM(root) {
    root.querySelectorAll(
      'h1 [aria-label*="link to"],h1 [aria-label*="anchor"],h1 [aria-label*="permalink"],' +
      'h2 [aria-label*="link to"],h2 [aria-label*="anchor"],h2 [aria-label*="permalink"],' +
      'h3 [aria-label*="link to"],h3 [aria-label*="anchor"],h3 [aria-label*="permalink"],' +
      'h4 [aria-label*="link to"],h4 [aria-label*="anchor"],h4 [aria-label*="permalink"],' +
      'h5 [aria-label*="link to"],h5 [aria-label*="anchor"],h5 [aria-label*="permalink"],' +
      'h6 [aria-label*="link to"],h6 [aria-label*="anchor"],h6 [aria-label*="permalink"]'
    ).forEach(el => el.closest('div,span')?.remove() || el.remove());

    root.querySelectorAll('h1 > div, h2 > div, h3 > div, h4 > div, h5 > div, h6 > div').forEach(div => {
      const text = div.textContent.trim();
      if (!text || text === '#') div.remove();
    });

    root.querySelectorAll(
      'script,style,noscript,template,' +
      'nav,header,footer,aside,' +
      'link[rel="stylesheet"],svg,canvas,iframe,form'
    ).forEach(el => el.remove());

    root.querySelectorAll(
      '[role="navigation"],[role="banner"],[role="complementary"],' +
      '[role="search"],[role="dialog"],[role="alert"],[role="status"],' +
      '[role="toolbar"],[role="menu"],[role="menubar"]'
    ).forEach(el => el.remove());

    root.querySelectorAll(
      '[hidden],[aria-hidden="true"],' +
      '[style*="display:none"],[style*="display: none"],' +
      '[style*="visibility:hidden"],[style*="visibility: hidden"]'
    ).forEach(el => el.remove());

    const noisePatterns = /((cookie|gdpr)[_-]?(banner|notice|bar|alert|consent)|(popup|modal|overlay|advert|sidebar|breadcrumb|pagination)[_-]?(wrap|container|box|nav|ui|area|region|widget|block|panel)|share[_-]?(buttons?|widget|bar)|social[_-](share|sharing|buttons?|widget|bar|media[_-]?(links?|icons?))|newsletter[_-]?(box|signup|form)?|related[_-]?(posts?|articles?|content)|\btoc\b|table-of-contents|back-to-top|skip-to|print-only)/i;
    root.querySelectorAll('[class],[id]').forEach(el => {
      const cn = (el.getAttribute('class') || '') + ' ' + (el.getAttribute('id') || '');
      if (noisePatterns.test(cn)) el.remove();
    });

    root.querySelectorAll('[data-mds-hidden]').forEach(el => el.remove());
    root.querySelector('#mds-root')?.remove();
    root.querySelector('#mds-handle')?.remove();
    root.querySelector('#mds-toast')?.remove();

    mergeOrphanedTables(root);

    root.querySelectorAll('pre').forEach(pre => {
      const prev = pre.previousElementSibling;
      if (prev && prev.tagName === 'P') {
        const hint = prev.textContent.trim().toLowerCase();
        if (LANG_HINTS.has(hint)) {
          pre.setAttribute('data-mds-lang', hint);
          prev.remove();
        }
      }
    });
  }

  function mergeOrphanedTables(root) {
    const tables = Array.from(root.querySelectorAll('table'));
    const processed = new Set();
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      if (processed.has(t)) continue;
      const hasThead = !!t.querySelector('thead');
      const hasTbody = !!t.querySelector('tbody');
      if (hasThead && !hasTbody) {
        for (let j = i + 1; j < tables.length; j++) {
          const t2 = tables[j];
          if (processed.has(t2)) continue;
          if (!t2.querySelector('thead') && t2.querySelector('tbody')) {
            Array.from(t2.querySelectorAll('tbody')).forEach(tb => t.appendChild(tb));
            t2.remove();
            processed.add(t2);
          }
        }
      }
      if (!hasThead && hasTbody) {
        for (let j = i - 1; j >= 0; j--) {
          const t2 = tables[j];
          if (processed.has(t2)) continue;
          if (t2.querySelector('thead') && !t2.querySelector('tbody')) {
            Array.from(t.querySelectorAll('tbody')).forEach(tb => t2.appendChild(tb));
            t.remove();
            processed.add(t);
            break;
          }
        }
      }
    }
  }

  function getMainContent(doc) {
    const candidates = [
      '[itemprop="articleBody"]', 'main[role="main"]', '[role="main"]', 'main', 'article',
      '.post-content', '.article-content', '.entry-content', '.article-body',
      '.story-body', '.content-body', '.page-content', '.main-content',
      '#content', '#main', '#article',
    ];
    for (const sel of candidates) {
      try {
        const el = doc.querySelector(sel);
        if (el && el.textContent.trim().length > 150) return el;
      } catch {}
    }
    return doc.body;
  }

  // ── Markdown converters ──────────────────────────────────
  function buildFrontmatter(url, title, lang) {
    const safeTitle = (title || 'Untitled')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .trim();
    const safeUrl = (url || '').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safeLang = lang || navigator.language || 'en';
    return `---\nurl: "${safeUrl}"\ntitle: "${safeTitle}"\ndate: "${new Date().toISOString()}"\nlang: "${safeLang}"\n---\n\n`;
  }

  function convertPage(opts) {
    const td = getTurndown(opts);
    const source = getMainContent(document);
    const hiddenEls = [];

    if (opts.clean) {
      const walker = document.createTreeWalker(source, NodeFilter.SHOW_ELEMENT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.hasAttribute('data-mds-hidden')) {
          node.setAttribute('data-mds-hidden', '');
          hiddenEls.push(node);
          continue;
        }
        let isHidden = false;
        if (typeof node.checkVisibility === 'function') {
          isHidden = !node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        } else {
          const s = window.getComputedStyle(node);
          isHidden = s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
        }
        if (isHidden) {
          node.setAttribute('data-mds-hidden', '');
          hiddenEls.push(node);
        }
      }
    }

    let root;
    try {
      root = source.cloneNode(true);
    } finally {
      hiddenEls.forEach(el => el.removeAttribute('data-mds-hidden'));
    }

    if (opts.clean) cleanDOM(root);
    resolveUrls(root);
    const md = postProcessMarkdown(td.turndown(root.innerHTML));
    return opts.title ? buildFrontmatter(location.href, document.title) + md : md;
  }

  function resolveUrls(root) {
    root.querySelectorAll('a[href]').forEach(el => {
      try {
        const attr = el.getAttribute('href') || '';
        if (!attr || attr === '#' || attr.startsWith('javascript:')) return;
        let resolved;
        try { resolved = new URL(attr, location.href).href; } catch { resolved = attr; }
        if (resolved) {
          el.setAttribute('href', resolved);
          el.setAttribute('data-mds-href', resolved);
        }
      } catch {}
    });
    root.querySelectorAll('img[src], source[src]').forEach(el => {
      try {
        const attr = el.getAttribute('src') || '';
        if (!attr || attr.startsWith('data:')) return;
        try { el.setAttribute('src', new URL(attr, location.href).href); } catch {}
      } catch {}
    });
    root.querySelectorAll('img[srcset]').forEach(el => {
      try {
        const resolved = el.srcset.split(',').map(part => {
          const [u, ...rest] = part.trim().split(/\s+/);
          try { return [new URL(u, location.href).href, ...rest].join(' '); } catch { return part.trim(); }
        }).join(', ');
        el.setAttribute('srcset', resolved);
      } catch {}
    });
  }

  function convertSelection(opts) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    if (!sel.toString().trim()) return null;
    if (sel.anchorNode && sidebar?.root?.contains(sel.anchorNode)) return null;
    const frag = sel.getRangeAt(0).cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);
    if (opts.clean) cleanDOM(div);
    resolveUrls(div);
    return postProcessMarkdown(getTurndown(opts).turndown(div.innerHTML));
  }

  // ── Remote URL fetch ─────────────────────────────────────
  async function fetchUrlAsMarkdown(url, opts) {
    try {
      const doc = await TM.network.fetchPage(url, { timeout: 15000 });
      const baseTag = doc.querySelector('base[href]');
      const baseUrl = baseTag ? new URL(baseTag.getAttribute('href'), url).href : url;

      doc.querySelectorAll('a[href]').forEach(a => {
        try { a.setAttribute('href', new URL(a.getAttribute('href'), baseUrl).href); } catch {}
      });
      doc.querySelectorAll('img[src], source[srcset]').forEach(el => {
        if (el.hasAttribute('src')) {
          try { el.setAttribute('src', new URL(el.getAttribute('src'), baseUrl).href); } catch {}
        }
        if (el.hasAttribute('srcset')) el.removeAttribute('srcset');
      });
      const pageTitle = doc.title || url;
      const pageLang = doc.documentElement.getAttribute('lang') || undefined;
      const root = getMainContent(doc).cloneNode(true);
      if (opts.clean) cleanDOM(root);
      const td = getTurndown(opts);
      const md = postProcessMarkdown(td.turndown(root.innerHTML));
      const result = opts.title ? buildFrontmatter(url, pageTitle, pageLang) + md : md;
      return { markdown: result, title: pageTitle };
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  // ── Storage ──────────────────────────────────────────────
  async function saveToHistory(markdown, copyType, title, url) {
    const stored = await TM.storage.loadSetting(STORAGE_KEY, []);
    const history = Array.isArray(stored) ? stored : [];
    history.unshift({
      id: Date.now().toString(),
      markdown,
      title: title || document.title,
      url: url || location.href,
      copyType,
      timestamp: Date.now()
    });
    if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
    await TM.storage.saveSetting(STORAGE_KEY, history);
  }

  async function getHistory() {
    const stored = await TM.storage.loadSetting(STORAGE_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }

  async function deleteHistoryItem(id) {
    const history = await getHistory();
    await TM.storage.saveSetting(STORAGE_KEY, history.filter(item => item.id !== id));
  }

  // ── Clipboard ────────────────────────────────────────────
  async function copyToClipboard(text) {
    try { GM_setClipboard(text, 'text'); return true; } catch {}
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  // ── Helpers ──────────────────────────────────────────────
  function esc(text) {
    return String(text)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function formatTime(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function typeLabel(t) {
    return { copyPage:'Page', copySelection:'Selection', copyImage:'Image', copyLink:'Link', copyUrl:'URL' }[t] || t;
  }

  // ── Sidebar preview/history rendering ────────────────────
  function setPreview(md, sourceLabel = '') {
    currentMarkdown = md;
    const r = sidebar?.root;
    if (!r) return;
    const el = r.querySelector('#mds-preview');
    const src = r.querySelector('#mds-preview-source');
    if (el) el.textContent = md;
    if (src) src.textContent = sourceLabel;
  }

  function setPreviewLoading() {
    const r = sidebar?.root;
    if (!r) return;
    const el = r.querySelector('#mds-preview');
    if (el) el.innerHTML = '<span class="mds-loading"></span>';
  }

  function setPreviewError(msg) {
    const r = sidebar?.root;
    if (!r) return;
    const el = r.querySelector('#mds-preview');
    if (el) el.innerHTML = `<span style="color:var(--red,#f87171)">${esc(msg)}</span>`;
  }

  function generatePagePreview() {
    setPreviewLoading();
    const run = () => {
      try {
        const md = convertPage(getOpts());
        setPreview(md, location.hostname);
      } catch (e) {
        setPreviewError('Error: ' + e.message);
      }
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }

  function renderHistory() {
    const r = sidebar?.root;
    if (!r) return;
    const listEl = r.querySelector('#mds-history-list');
    if (!listEl) return;
    getHistory().then(history => {
      if (!history.length) {
        listEl.innerHTML = '<div class="mds-empty">No history yet</div>';
        return;
      }
      listEl.innerHTML = history.map(item => `
        <div class="mds-hist-item">
          <div class="mds-hist-row1">
            <span class="mds-hist-badge">${esc(typeLabel(item.copyType))}</span>
            <span class="mds-hist-time">${esc(formatTime(item.timestamp))}</span>
          </div>
          <div class="mds-hist-title">${esc(item.title || item.url || '')}</div>
          <div class="mds-hist-preview">${esc(item.markdown.slice(0, 110))}${item.markdown.length > 110 ? '…' : ''}</div>
          <div class="mds-hist-actions">
            <button class="mds-hist-btn" data-id="${esc(item.id)}">Copy</button>
            <button class="mds-hist-btn del" data-id="${esc(item.id)}">Delete</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.mds-hist-btn:not(.del)').forEach(btn => {
        btn.addEventListener('click', async e => {
          const id = e.currentTarget.dataset.id;
          const items = await getHistory();
          const item = items.find(h => h.id === id);
          if (!item) { TM.ui.createToast('Not found', { type: 'error', duration: 2200 }); return; }
          const ok = await copyToClipboard(item.markdown);
          TM.ui.createToast(ok ? 'Copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
        });
      });
      listEl.querySelectorAll('.mds-hist-btn.del').forEach(btn => {
        btn.addEventListener('click', async e => {
          await deleteHistoryItem(e.currentTarget.dataset.id);
          renderHistory();
        });
      });
    });
  }

  // ── Interactive click modes ──────────────────────────────
  function getTurndown(opts) {
    const key = JSON.stringify(opts);
    if (_cachedTurndown && _cachedOptsKey === key) return _cachedTurndown;
    _cachedTurndown = createTurndown(opts);
    _cachedOptsKey = key;
    return _cachedTurndown;
  }

  function startClickMode(mode, hint, selector, handler) {
    if (activeClickMode) stopClickMode();
    activeClickMode = mode;
    const r = sidebar?.root;
    const btn = r?.querySelector(mode === 'img' ? '#mds-act-img' : '#mds-act-link');
    if (btn) btn.classList.add('mds-active-mode');
    TM.ui.createToast(hint + ' (Esc to cancel)', { type: 'info', duration: 3000 });

    _hoverStyle = document.createElement('style');
    const targetSel = mode === 'img' ? 'img' : 'a[href]';
    _hoverStyle.textContent = `${targetSel}:hover { outline: 3px dashed #f59e0b !important; outline-offset: 2px !important; cursor: crosshair !important; opacity: 0.85 !important; }`;
    document.head.appendChild(_hoverStyle);

    _keyListener = (e) => { if (e.key === 'Escape') stopClickMode(); };
    document.addEventListener('keydown', _keyListener, true);

    const listener = async (e) => {
      if (sidebar?.host?.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const target = selector(e);
      if (!target) {
        stopClickMode();
        TM.ui.createToast('Cancelled', { type: 'info', duration: 2000 });
        return;
      }
      const md = handler(target);
      const ok = await copyToClipboard(md);
      if (ok) saveToHistory(md, mode === 'img' ? 'copyImage' : 'copyLink');
      TM.ui.createToast(ok ? 'Copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
      setPreview(md, mode === 'img' ? 'image' : 'link');
      stopClickMode();
    };
    _clickListener = listener;
    document.addEventListener('click', listener, true);
  }

  function stopClickMode() {
    if (_clickListener) { document.removeEventListener('click', _clickListener, true); _clickListener = null; }
    if (_keyListener) { document.removeEventListener('keydown', _keyListener, true); _keyListener = null; }
    if (_hoverStyle) { _hoverStyle.remove(); _hoverStyle = null; }
    const r = sidebar?.root;
    r?.querySelector('#mds-act-img')?.classList.remove('mds-active-mode');
    r?.querySelector('#mds-act-link')?.classList.remove('mds-active-mode');
    activeClickMode = null;
  }

  // ── Theme ────────────────────────────────────────────────
  function applyTheme(theme) {
    currentTheme = theme;
    TM.storage.saveSetting('mds_theme', theme);
    if (sidebar) {
      sidebar.host.setAttribute('data-theme', theme);
      const btn = sidebar.root.querySelector('#mds-theme-btn');
      if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
    }
  }

  // ── Show / hide sidebar ──────────────────────────────────
  function showSidebar() {
    if (!sidebar) sidebar = buildSidebar();
    sidebar.open();
  }

  function hideSidebar() {
    if (sidebar) sidebar.close();
  }

  // ── Build sidebar DOM ────────────────────────────────────
  function buildSidebar() {
    const sb = TM.ui.createSidebar({
      width: SIDEBAR_WIDTH,
      title: 'Markdown',
      accentColor: '#f59e0b',
      cssOverrides: ':host { background: #0e0c09; color: #f0ebe0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 2147483646; border-left: 1px solid #2d2820; box-shadow: -8px 0 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; } .header { display: none !important; } .body { padding: 0 !important; display: flex; flex-direction: column; overflow: hidden !important; }',
      onOpen: () => {
        loadOpts().then(savedOpts => {
          const r = sb.root;
          const setCheck = (id, val) => { const el = r.querySelector(id); if (el) el.checked = val; };
          setCheck('#mds-opt-title', savedOpts.title);
          setCheck('#mds-opt-nolinks', savedOpts.nolinks);
          setCheck('#mds-opt-clean', savedOpts.clean);
        });
        sb.host.setAttribute('data-theme', currentTheme);
        generatePagePreview();
        setTimeout(() => sb.root.querySelector('#mds-url-input')?.focus(), 300);
      },
      onClose: () => { stopClickMode(); }
    });

    sidebar = sb;

    // Inject full custom CSS into shadow root (after createSidebar's baseCSS)
    const style = document.createElement('style');
    style.textContent = ADAPTED_CSS;
    sb.root.appendChild(style);

    // Populate inner content
    sb.bodyEl.innerHTML = SIDEBAR_HTML;

    const r = sb.root;

    // Close button
    r.querySelector('#mds-close').addEventListener('click', () => sb.close());

    // Theme toggle
    const themeBtn = r.querySelector('#mds-theme-btn');
    if (themeBtn) {
      themeBtn.textContent = currentTheme === 'dark' ? '☀' : '☾';
      themeBtn.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      });
    }

    // Copy page
    r.querySelector('#mds-act-page').addEventListener('click', async () => {
      const opts = getOpts();
      try {
        const md = convertPage(opts);
        const ok = await copyToClipboard(md);
        if (ok) saveToHistory(md, 'copyPage');
        TM.ui.createToast(ok ? 'Page copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
        setPreview(md, location.hostname);
      } catch (e) { TM.ui.createToast(e.message, { type: 'error', duration: 2200 }); }
    });

    // Copy selection
    r.querySelector('#mds-act-sel').addEventListener('click', async () => {
      const md = convertSelection(getOpts());
      if (!md) { TM.ui.createToast('No text selected', { type: 'error', duration: 2200 }); return; }
      const ok = await copyToClipboard(md);
      if (ok) saveToHistory(md, 'copySelection');
      TM.ui.createToast(ok ? 'Selection copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
      setPreview(md, 'selection');
    });

    // Copy image — click mode
    r.querySelector('#mds-act-img').addEventListener('click', () => {
      if (activeClickMode === 'img') { stopClickMode(); return; }
      startClickMode('img', 'Click any image…',
        (e) => e.target.tagName === 'IMG' ? e.target : null,
        (imgEl) => {
          const alt = imgEl.alt || imgEl.src.split('/').pop()?.split('?')[0] || 'image';
          return `![${alt}](${imgEl.src})`;
        }
      );
    });

    // Copy link — click mode
    r.querySelector('#mds-act-link').addEventListener('click', () => {
      if (activeClickMode === 'link') { stopClickMode(); return; }
      startClickMode('link', 'Click any link…',
        (e) => e.target.closest('a[href]'),
        (aEl) => {
          const text = aEl.textContent.trim() || aEl.href;
          return `[${text}](${aEl.href})`;
        }
      );
    });

    // Options changes → persist + refresh preview if visible
    ['mds-opt-title','mds-opt-nolinks','mds-opt-clean'].forEach(id => {
      r.querySelector('#' + id)?.addEventListener('change', () => {
        saveOpts();
        if (!r.querySelector('#mds-panel-preview')?.classList.contains('hidden')) {
          generatePagePreview();
        }
      });
    });

    // URL fetch
    const urlInput = r.querySelector('#mds-url-input');
    const fetchBtn = r.querySelector('#mds-url-fetch');
    const doFetch = async () => {
      const url = urlInput.value.trim();
      if (!url) return;
      fetchBtn.disabled = true;
      fetchBtn.textContent = '…';
      setPreviewLoading();
      try {
        const { markdown, title } = await fetchUrlAsMarkdown(url, getOpts());
        await saveToHistory(markdown, 'copyUrl', title, url);
        setPreview(markdown, new URL(url).hostname);
        switchTab('preview');
        const ok = await copyToClipboard(markdown);
        TM.ui.createToast(ok ? 'Fetched & copied' : 'Fetched', { type: 'success', duration: 2200 });
      } catch (e) {
        setPreviewError('Fetch failed: ' + e.message);
        TM.ui.createToast(e.message, { type: 'error', duration: 2200 });
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch →';
      }
    };
    fetchBtn.addEventListener('click', doFetch);
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') doFetch(); });

    // Tabs
    r.querySelector('#mds-tab-preview').addEventListener('click', () => switchTab('preview'));
    r.querySelector('#mds-tab-history').addEventListener('click', () => switchTab('history'));

    // Copy preview button
    r.querySelector('#mds-copy-preview').addEventListener('click', async () => {
      if (!currentMarkdown) return;
      const ok = await copyToClipboard(currentMarkdown);
      await saveToHistory(currentMarkdown, 'copyPage');
      TM.ui.createToast(ok ? 'Copied' : 'Failed', { type: ok ? 'success' : 'error', duration: 2200 });
    });

    return sb;
  }

  function switchTab(which) {
    const r = sidebar?.root;
    if (!r) return;
    r.querySelector('#mds-tab-preview').classList.toggle('active', which === 'preview');
    r.querySelector('#mds-tab-history').classList.toggle('active', which === 'history');
    r.querySelector('#mds-panel-preview').classList.toggle('hidden', which !== 'preview');
    r.querySelector('#mds-panel-history').classList.toggle('hidden', which !== 'history');
    if (which === 'history') renderHistory();
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    TM.storage.loadSetting('mds_theme', 'dark').then(t => { currentTheme = t; });

    GM_registerMenuCommand('↓ Markdown Sidebar', () => {
      if (!sidebar) sidebar = buildSidebar();
      sidebar.toggle();
    });

    log.info('Initialized');
  }

  init();

})();

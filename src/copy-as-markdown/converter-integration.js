/**
 * Copy as Markdown — Converter Integration Module
 *
 * Wraps the embedded TurndownService library and provides all Markdown conversion
 * logic: page-to-Markdown, selection-to-Markdown, remote URL fetch, DOM cleanup,
 * URL resolution, and table extraction.
 *
 * @namespace window.__CAM__
 */

(function () {
  'use strict';

  const CAM = (window.__CAM__ = window.__CAM__ || {});

  // ============================================================
  // TurndownService (embedded library — MIT License)
  // ============================================================

  const TurndownService = (function () {
    'use strict';

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
      return string.replace(/^\n*/, '');
    }

    function trimTrailingNewlines(string) {
      var indexEnd = string.length;
      while (indexEnd > 0 && string[indexEnd - 1] === '\n') indexEnd--;
      return string.substring(0, indexEnd);
    }

    var blockElements = [
      'ADDRESS', 'ARTICLE', 'ASIDE', 'AUDIO', 'BLOCKQUOTE', 'BODY',
      'CANVAS', 'CENTER', 'DD', 'DIR', 'DIV', 'DL', 'DT', 'FIELDSET',
      'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'FRAMESET',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP', 'HR',
      'HTML', 'ISINDEX', 'LI', 'MAIN', 'MENU', 'NAV', 'NOFRAMES',
      'NOSCRIPT', 'OL', 'OUTPUT', 'P', 'PRE', 'SECTION', 'TABLE',
      'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
    ];

    function isBlock(node) { return is(node, blockElements); }

    var voidElements = [
      'AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG',
      'INPUT', 'KEYGEN', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR',
    ];

    function isVoid(node) { return is(node, voidElements); }
    function hasVoid(node) { return has(node, voidElements); }

    var meaningfulWhenBlankElements = [
      'A', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TH', 'TD',
      'IFRAME', 'SCRIPT', 'AUDIO', 'VIDEO',
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
      filter: 'p',
      replacement: function (content) { return '\n\n' + content + '\n\n'; },
    };

    rules.lineBreak = {
      filter: 'br',
      replacement: function (content, node, options) { return options.br + '\n'; },
    };

    rules.heading = {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      replacement: function (content, node, options) {
        var hLevel = Number(node.nodeName.charAt(1));
        if (options.headingStyle === 'setext' && hLevel < 3) {
          var underline = repeat(hLevel === 1 ? '=' : '-', content.length);
          return '\n\n' + content + '\n' + underline + '\n\n';
        }
        return '\n\n' + repeat('#', hLevel) + ' ' + content + '\n\n';
      },
    };

    rules.blockquote = {
      filter: 'blockquote',
      replacement: function (content) {
        content = content.replace(/^\n+|\n+$/g, '');
        content = content.replace(/^/gm, '> ');
        return '\n\n' + content + '\n\n';
      },
    };

    rules.list = {
      filter: ['ul', 'ol'],
      replacement: function (content, node) {
        var parent = node.parentNode;
        if (parent.nodeName === 'LI' && parent.lastElementChild === node) return '\n' + content;
        return '\n\n' + content + '\n\n';
      },
    };

    rules.listItem = {
      filter: 'li',
      replacement: function (content, node, options) {
        content = content
          .replace(/^\n+/, '')
          .replace(/\n+$/, '\n')
          .replace(/\n/gm, '\n    ');
        var prefix = options.bulletListMarker + '   ';
        var parent = node.parentNode;
        if (parent.nodeName === 'OL') {
          var start = parent.getAttribute('start');
          var index = Array.prototype.indexOf.call(parent.children, node);
          prefix = (start ? Number(start) + index : index + 1) + '.  ';
        }
        return prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
      },
    };

    rules.indentedCodeBlock = {
      filter: function (node, options) {
        return options.codeBlockStyle === 'indented' && node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
      },
      replacement: function (content, node, options) {
        return '\n\n    ' + node.firstChild.textContent.replace(/\n/g, '\n    ') + '\n\n';
      },
    };

    rules.fencedCodeBlock = {
      filter: function (node, options) {
        return options.codeBlockStyle === 'fenced' && node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
      },
      replacement: function (content, node, options) {
        var className = node.firstChild.getAttribute('class') || '';
        var language = (className.match(/language-(\S+)/) || [null, ''])[1];
        var code = node.firstChild.textContent;
        var fenceChar = options.fence.charAt(0);
        var fenceSize = 3;
        var fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');
        var match;
        while ((match = fenceInCodeRegex.exec(code))) {
          if (match[0].length >= fenceSize) fenceSize = match[0].length + 1;
        }
        var fence = repeat(fenceChar, fenceSize);
        return '\n\n' + fence + language + '\n' + code.replace(/\n$/, '') + '\n' + fence + '\n\n';
      },
    };

    rules.horizontalRule = {
      filter: 'hr',
      replacement: function (content, node, options) { return '\n\n' + options.hr + '\n\n'; },
    };

    rules.inlineLink = {
      filter: function (node, options) {
        return options.linkStyle === 'inlined' && node.nodeName === 'A' && node.getAttribute('href');
      },
      replacement: function (content, node) {
        var href = node.getAttribute('href');
        var title = cleanAttribute(node.getAttribute('title'));
        if (title) title = ' "' + title + '"';
        return '[' + content + '](' + href + title + ')';
      },
    };

    rules.referenceLink = {
      filter: function (node, options) {
        return options.linkStyle === 'referenced' && node.nodeName === 'A' && node.getAttribute('href');
      },
      replacement: function (content, node, options) {
        var href = node.getAttribute('href');
        var title = cleanAttribute(node.getAttribute('title'));
        if (title) title = ' "' + title + '"';
        var replacement;
        var reference;
        switch (options.linkReferenceStyle) {
          case 'collapsed':
            replacement = '[' + content + '][]';
            reference = '[' + content + ']: ' + href + title;
            break;
          case 'shortcut':
            replacement = '[' + content + ']';
            reference = '[' + content + ']: ' + href + title;
            break;
          default:
            var id = this.references.length + 1;
            replacement = '[' + content + '][' + id + ']';
            reference = '[' + id + ']: ' + href + title;
        }
        this.references.push(reference);
        return replacement;
      },
      references: [],
      append: function (options) {
        var references = '';
        if (this.references.length) {
          references = '\n\n' + this.references.join('\n') + '\n\n';
          this.references = [];
        }
        return references;
      },
    };

    rules.emphasis = {
      filter: ['em', 'i'],
      replacement: function (content, node, options) {
        if (!content.trim()) return '';
        return options.emDelimiter + content + options.emDelimiter;
      },
    };

    rules.strong = {
      filter: ['strong', 'b'],
      replacement: function (content, node, options) {
        if (!content.trim()) return '';
        return options.strongDelimiter + content + options.strongDelimiter;
      },
    };

    rules.code = {
      filter: function (node) {
        var hasSiblings = node.previousSibling || node.nextSibling;
        var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;
        return node.nodeName === 'CODE' && !isCodeBlock;
      },
      replacement: function (content) {
        if (!content) return '';
        content = content.replace(/\r?\n|\r/g, ' ');
        var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? ' ' : '';
        var delimiter = '`';
        var matches = content.match(/`+/gm) || [];
        while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`';
        return delimiter + extraSpace + content + extraSpace + delimiter;
      },
    };

    rules.image = {
      filter: 'img',
      replacement: function (content, node) {
        var alt = cleanAttribute(node.getAttribute('alt'));
        var src = node.getAttribute('src') || '';
        var title = cleanAttribute(node.getAttribute('title'));
        var titlePart = title ? ' "' + title + '"' : '';
        return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : '';
      },
    };

    function cleanAttribute(attribute) {
      return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';
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
      remove: function (filter) { this._remove.unshift({ filter: filter, replacement: function () { return ''; } }); },
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
      if (typeof filter === 'string') {
        if (filter === node.nodeName.toLowerCase()) return true;
      } else if (Array.isArray(filter)) {
        if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true;
      } else if (typeof filter === 'function') {
        if (filter.call(rule, node, options)) return true;
      } else {
        throw new TypeError('`filter` needs to be a string, array, or function');
      }
    }

    function collapseWhitespace(options) {
      var element = options.element;
      var isBlock = options.isBlock;
      var isVoid = options.isVoid;
      var isPre = options.isPre || function (node) { return node.nodeName === 'PRE'; };
      if (!element.firstChild || isPre(element)) return;
      var prevText = null;
      var keepLeadingWs = false;
      var prev = null;
      var node = next(prev, element, isPre);
      while (node !== element) {
        if (node.nodeType === 3 || node.nodeType === 4) {
          var text = node.data.replace(/[ \r\n\t]+/g, ' ');
          if (!prevText || / $/.test(prevText.data)) { if (!keepLeadingWs && text[0] === ' ') text = text.substr(1); }
          if (!text) { node = remove(node); continue; }
          node.data = text;
          prevText = node;
        } else if (node.nodeType === 1) {
          if (isBlock(node) || node.nodeName === 'BR') {
            if (prevText) prevText.data = prevText.data.replace(/ $/, '');
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
        prevText.data = prevText.data.replace(/ $/, '');
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

    var root = typeof window !== 'undefined' ? window : {};

    function canParseHTMLNatively() {
      var Parser = root.DOMParser;
      var canParse = false;
      try { if (new Parser().parseFromString('', 'text/html')) canParse = true; } catch (e) {}
      return canParse;
    }

    function createHTMLParser() {
      var Parser = function () {};
      if (shouldUseActiveX()) {
        Parser.prototype.parseFromString = function (string) {
          var doc = new window.ActiveXObject('htmlfile');
          doc.designMode = 'on';
          doc.open();
          doc.write(string);
          doc.close();
          return doc;
        };
      } else {
        Parser.prototype.parseFromString = function (string) {
          var doc = document.implementation.createHTMLDocument('');
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
      try { document.implementation.createHTMLDocument('').open(); } catch (e) { if (window.ActiveXObject) useActiveX = true; }
      return useActiveX;
    }

    var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();

    function RootNode(input, options) {
      var root;
      if (typeof input === 'string') {
        var doc = htmlParser().parseFromString(
          '<x-turndown id="turndown-root">' + input + '</x-turndown>', 'text/html'
        );
        root = doc.getElementById('turndown-root');
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

    function isPreOrCode(node) { return node.nodeName === 'PRE' || node.nodeName === 'CODE'; }

    function Node(node, options) {
      node.isBlock = isBlock(node);
      node.isCode = node.nodeName === 'CODE' || node.parentNode.isCode;
      node.isBlank = isBlank(node);
      node.flankingWhitespace = flankingWhitespace(node, options);
      return node;
    }

    function isBlank(node) {
      return !isVoid(node) && !isMeaningfulWhenBlank(node) && /^\s*$/i.test(node.textContent) && !hasVoid(node) && !hasMeaningfulWhenBlank(node);
    }

    function flankingWhitespace(node, options) {
      if (node.isBlock || (options.preformattedCode && node.isCode)) return { leading: '', trailing: '' };
      var edges = edgeWhitespace(node.textContent);
      if (edges.leadingAscii && isFlankedByWhitespace('left', node, options)) edges.leading = edges.leadingNonAscii;
      if (edges.trailingAscii && isFlankedByWhitespace('right', node, options)) edges.trailing = edges.trailingNonAscii;
      return { leading: edges.leading, trailing: edges.trailing };
    }

    function edgeWhitespace(string) {
      var m = string.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
      return { leading: m[1], leadingAscii: m[2], leadingNonAscii: m[3], trailing: m[4], trailingNonAscii: m[5], trailingAscii: m[6] };
    }

    function isFlankedByWhitespace(side, node, options) {
      var sibling, regExp, isFlanked;
      if (side === 'left') { sibling = node.previousSibling; regExp = / $/; }
      else { sibling = node.nextSibling; regExp = /^ /; }
      if (sibling) {
        if (sibling.nodeType === 3) isFlanked = regExp.test(sibling.nodeValue);
        else if (options.preformattedCode && sibling.nodeName === 'CODE') isFlanked = false;
        else if (sibling.nodeType === 1 && !isBlock(sibling)) isFlanked = regExp.test(sibling.textContent);
      }
      return isFlanked;
    }

    var reduce = Array.prototype.reduce;
    var escapes = [
      [/\\/g, '\\\\'], [/\*/g, '\\*'], [/^-/g, '\\-'], [/^\+ /g, '\\+ '],
      [/^(=+)/g, '\\$1'], [/^(#{1,6}) /g, '\\$1 '], [/`/g, '\\`'],
      [/^~~~/g, '\\~~~'], [/\[/g, '\\['], [/\]/g, '\\]'], [/^>/g, '\\>'],
      [/_/g, '\\_'], [/^(\d+)\. /g, '$1\\. '],
    ];

    function TurndownService(options) {
      if (!(this instanceof TurndownService)) return new TurndownService(options);
      var defaults = {
        rules: rules,
        headingStyle: 'setext', hr: '* * *', bulletListMarker: '*',
        codeBlockStyle: 'indented', fence: '```', emDelimiter: '_',
        strongDelimiter: '**', linkStyle: 'inlined', linkReferenceStyle: 'full',
        br: '  ', preformattedCode: false,
        blankReplacement: function (content, node) { return node.isBlock ? '\n\n' : ''; },
        keepReplacement: function (content, node) { return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML; },
        defaultReplacement: function (content, node) { return node.isBlock ? '\n\n' + content + '\n\n' : content; },
      };
      this.options = extend({}, defaults, options);
      this.rules = new Rules(this.options);
    }

    TurndownService.prototype = {
      turndown: function (input) {
        if (!canConvert(input)) throw new TypeError(input + ' is not a string, or an element/document/fragment node.');
        if (input === '') return '';
        var output = process.call(this, new RootNode(input, this.options));
        return postProcess.call(this, output);
      },
      use: function (plugin) {
        if (Array.isArray(plugin)) { for (var i = 0; i < plugin.length; i++) this.use(plugin[i]); }
        else if (typeof plugin === 'function') plugin(this);
        else throw new TypeError('plugin must be a Function or an Array of Functions');
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
        var replacement = '';
        if (node.nodeType === 3) replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue);
        else if (node.nodeType === 1) replacement = replacementForNode.call(self, node);
        return join(output, replacement);
      }, '');
    }

    function postProcess(output) {
      var self = this;
      this.rules.forEach(function (rule) { if (typeof rule.append === 'function') output = join(output, rule.append(self.options)); });
      return output.replace(/^[\t\r\n]+/, '').replace(/[\t\r\n\s]+$/, '');
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
      var separator = '\n\n'.substring(0, nls);
      return s1 + separator + s2;
    }

    function canConvert(input) {
      return input != null && (typeof input === 'string' || (input.nodeType && (input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11)));
    }

    return TurndownService;
  })();

  // ============================================================
  // Language-hint recognition
  // ============================================================

  const LANG_HINTS = new Set([
    'bash', 'sh', 'shell', 'zsh', 'fish', 'cmd', 'bat', 'powershell', 'ps1',
    'javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx',
    'python', 'py', 'ruby', 'rb', 'go', 'rust', 'java', 'c', 'cpp', 'c++', 'c#', 'cs',
    'css', 'scss', 'sass', 'less', 'html', 'xml', 'svg', 'json', 'jsonc',
    'yaml', 'yml', 'toml', 'ini', 'env', 'dotenv',
    'sql', 'graphql', 'gql', 'r', 'swift', 'kotlin', 'dart', 'scala',
    'haskell', 'lua', 'perl', 'php', 'elixir', 'clojure', 'clj',
    'dockerfile', 'makefile', 'nginx', 'text', 'txt', 'plain', 'output', 'log',
  ]);

  // ============================================================
  // HTML entity decoding
  // ============================================================

  /**
   * Decode common HTML entities in a string.
   * @param {string} str
   * @returns {string}
   */
  function decodeHTMLEntities(str) {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  // ============================================================
  // Post-processing — restore over-escaped asterisk pairs
  // ============================================================

  /**
   * Restore over-escaped bold/italic asterisk pairs that Turndown
   * conservatively escapes but are safe in Markdown context.
   * @param {string} md
   * @returns {string}
   */
  function postProcessMarkdown(md) {
    return md
      .replace(/\\\*\\\*([^\n]{1,80}?)\\\*\\\*/g, '**$1**')
      .replace(/\\\*([^\n*]{1,40}?)\\\*/g, '*$1*');
  }

  // ============================================================
  // DOM cleanup helpers
  // ============================================================

  /**
   * Remove noisy / non-content elements from a cloned DOM subtree.
   * @param {Element} root
   */
  function cleanDOM(root) {
    root.querySelectorAll(
      'h1 [aria-label*="link to"],h1 [aria-label*="anchor"],h1 [aria-label*="permalink"],' +
      'h2 [aria-label*="link to"],h2 [aria-label*="anchor"],h2 [aria-label*="permalink"],' +
      'h3 [aria-label*="link to"],h3 [aria-label*="anchor"],h3 [aria-label*="permalink"],' +
      'h4 [aria-label*="link to"],h4 [aria-label*="anchor"],h4 [aria-label*="permalink"],' +
      'h5 [aria-label*="link to"],h5 [aria-label*="anchor"],h5 [aria-label*="permalink"],' +
      'h6 [aria-label*="link to"],h6 [aria-label*="anchor"],h6 [aria-label*="permalink"]'
    ).forEach(function (el) { el.closest('div,span')?.remove() || el.remove(); });

    root.querySelectorAll('h1 > div, h2 > div, h3 > div, h4 > div, h5 > div, h6 > div').forEach(function (div) {
      var text = div.textContent.trim();
      if (!text || text === '#') div.remove();
    });

    root.querySelectorAll(
      'script,style,noscript,template,' +
      'nav,header,footer,aside,' +
      'link[rel="stylesheet"],svg,canvas,iframe,form'
    ).forEach(function (el) { el.remove(); });

    root.querySelectorAll(
      '[role="navigation"],[role="banner"],[role="complementary"],' +
      '[role="search"],[role="dialog"],[role="alert"],[role="status"],' +
      '[role="toolbar"],[role="menu"],[role="menubar"]'
    ).forEach(function (el) { el.remove(); });

    root.querySelectorAll(
      '[hidden],[aria-hidden="true"],' +
      '[style*="display:none"],[style*="display: none"],' +
      '[style*="visibility:hidden"],[style*="visibility: hidden"]'
    ).forEach(function (el) { el.remove(); });

    var noisePatterns = /((cookie|gdpr)[_-]?(banner|notice|bar|alert|consent)|(popup|modal|overlay|advert|sidebar|breadcrumb|pagination)[_-]?(wrap|container|box|nav|ui|area|region|widget|block|panel)|share[_-]?(buttons?|widget|bar)|social[_-](share|sharing|buttons?|widget|bar|media[_-]?(links?|icons?))|newsletter[_-]?(box|signup|form)?|related[_-]?(posts?|articles?|content)|\btoc\b|table-of-contents|back-to-top|skip-to|print-only)/i;
    root.querySelectorAll('[class],[id]').forEach(function (el) {
      var cn = (el.getAttribute('class') || '') + ' ' + (el.getAttribute('id') || '');
      if (noisePatterns.test(cn)) el.remove();
    });

    root.querySelectorAll('[data-mds-hidden]').forEach(function (el) { el.remove(); });
    root.querySelector('#mds-root')?.remove();
    root.querySelector('#mds-handle')?.remove();
    root.querySelector('#mds-toast')?.remove();

    mergeOrphanedTables(root);

    root.querySelectorAll('pre').forEach(function (pre) {
      var prev = pre.previousElementSibling;
      if (prev && prev.tagName === 'P') {
        var hint = prev.textContent.trim().toLowerCase();
        if (LANG_HINTS.has(hint)) {
          pre.setAttribute('data-mds-lang', hint);
          prev.remove();
        }
      }
    });
  }

  /**
   * Merge adjacent table fragments split by platform CMS (thead orphaned from tbody).
   * @param {Element} root
   */
  function mergeOrphanedTables(root) {
    var tables = Array.from(root.querySelectorAll('table'));
    var processed = new Set();
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (processed.has(t)) continue;
      var hasThead = !!t.querySelector('thead');
      var hasTbody = !!t.querySelector('tbody');
      if (hasThead && !hasTbody) {
        for (var j = i + 1; j < tables.length; j++) {
          var t2 = tables[j];
          if (processed.has(t2)) continue;
          if (!t2.querySelector('thead') && t2.querySelector('tbody')) {
            Array.from(t2.querySelectorAll('tbody')).forEach(function (tb) { t.appendChild(tb); });
            t2.remove();
            processed.add(t2);
          }
        }
      }
      if (!hasThead && hasTbody) {
        for (var j = i - 1; j >= 0; j--) {
          var t2 = tables[j];
          if (processed.has(t2)) continue;
          if (t2.querySelector('thead') && !t2.querySelector('tbody')) {
            Array.from(t.querySelectorAll('tbody')).forEach(function (tb) { t2.appendChild(tb); });
            t.remove();
            processed.add(t);
            break;
          }
        }
      }
    }
  }

  /**
   * Attempt to find the main content area of a page.
   * @param {Document|Element} doc
   * @returns {Element}
   */
  function getMainContent(doc) {
    var candidates = [
      '[itemprop="articleBody"]', 'main[role="main"]', '[role="main"]', 'main', 'article',
      '.post-content', '.article-content', '.entry-content', '.article-body',
      '.story-body', '.content-body', '.page-content', '.main-content',
      '#content', '#main', '#article',
    ];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var el = doc.querySelector(candidates[i]);
        if (el && el.textContent.trim().length > 150) return el;
      } catch (e) {}
    }
    return doc.body;
  }

  // ============================================================
  // Frontmatter builder
  // ============================================================

  /**
   * Build YAML-style frontmatter for a Markdown document.
   * @param {string} url
   * @param {string} title
   * @param {string} [lang]
   * @returns {string}
   */
  function buildFrontmatter(url, title, lang) {
    var safeTitle = (title || 'Untitled')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .trim();
    var safeUrl = (url || '').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    var safeLang = lang || navigator.language || 'en';
    return '---\nurl: "' + safeUrl + '"\ntitle: "' + safeTitle + '"\ndate: "' + new Date().toISOString() + '"\nlang: "' + safeLang + '"\n---\n\n';
  }

  // ============================================================
  // URL resolution
  // ============================================================

  /**
   * Resolve relative URLs to absolute in a cloned DOM subtree.
   * @param {Element} root
   */
  function resolveUrls(root) {
    root.querySelectorAll('a[href]').forEach(function (el) {
      try {
        var attr = el.getAttribute('href') || '';
        if (!attr || attr === '#' || attr.startsWith('javascript:')) return;
        var resolved;
        try { resolved = new URL(attr, location.href).href; } catch (e) { resolved = attr; }
        if (resolved) {
          el.setAttribute('href', resolved);
          el.setAttribute('data-mds-href', resolved);
        }
      } catch (e) {}
    });
    root.querySelectorAll('img[src], source[src]').forEach(function (el) {
      try {
        var attr = el.getAttribute('src') || '';
        if (!attr || attr.startsWith('data:')) return;
        try { el.setAttribute('src', new URL(attr, location.href).href); } catch (e) {}
      } catch (e) {}
    });
    root.querySelectorAll('img[srcset]').forEach(function (el) {
      try {
        var resolved = el.srcset.split(',').map(function (part) {
          var parts = part.trim().split(/\s+/);
          var u = parts[0];
          try { return [new URL(u, location.href).href].concat(parts.slice(1)).join(' '); } catch (e) { return part.trim(); }
        }).join(', ');
        el.setAttribute('srcset', resolved);
      } catch (e) {}
    });
  }

  // ============================================================
  // Table conversion helpers
  // ============================================================

  /**
   * Safely extract cell text for Markdown table rendering.
   * @param {Element} cell
   * @param {TurndownService} td
   * @returns {string}
   */
  function getSafeCellText(cell, td) {
    var clone = cell.cloneNode(true);
    clone.querySelectorAll('br').forEach(function (br) { br.replaceWith(' '); });
    return td.turndown(clone.innerHTML)
      .replace(/[\r\n]+/g, ' ')
      .replace(/\|/g, '\\|')
      .trim() || ' ';
  }

  /**
   * Convert an HTML <table> element to Markdown table syntax.
   * @param {Element} node
   * @param {TurndownService} td
   * @returns {string}
   */
  function tableNodeToMarkdown(node, td) {
    var allRows = Array.from(node.rows);
    if (!allRows.length) return '';
    var grid = [];
    var maxCols = 0;
    for (var r = 0; r < allRows.length; r++) {
      grid[r] = grid[r] || [];
      var c = 0;
      for (var ci = 0; ci < allRows[r].cells.length; ci++) {
        var cell = allRows[r].cells[ci];
        while (grid[r][c] !== undefined) c++;
        var text = getSafeCellText(cell, td);
        var rowSp = cell.rowSpan || 1;
        var colSp = cell.colSpan || 1;
        for (var i = 0; i < rowSp; i++) {
          grid[r + i] = grid[r + i] || [];
          for (var j = 0; j < colSp; j++) {
            grid[r + i][c + j] = (i === 0 && j === 0) ? text : ' ';
          }
        }
        c += colSp;
      }
      maxCols = Math.max(maxCols, grid[r].length);
    }
    if (maxCols === 0) return '';

    function rowToMd(rowArr) {
      while (rowArr.length < maxCols) rowArr.push(' ');
      return '| ' + rowArr.join(' | ') + ' |';
    }

    var hasThead = node.querySelector('thead') || (allRows[0] && allRows[0].querySelector('th'));
    var sep = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
    if (hasThead && grid.length > 0) {
      var header = rowToMd(grid[0]);
      var body = grid.slice(1).map(rowToMd).join('\n');
      return '\n\n' + header + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
    } else {
      var emptyHdr = '| ' + Array(maxCols).fill(' ').join(' | ') + ' |';
      var body = grid.map(rowToMd).join('\n');
      return '\n\n' + emptyHdr + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
    }
  }

  /**
   * Convert ARIA-role tables (role="table" / role="grid") to Markdown.
   * @param {Element} node
   * @param {TurndownService} td
   * @returns {string}
   */
  function ariaTableToMarkdown(node, td) {
    function cellText(cell) { return getSafeCellText(cell, td); }
    function rowToMd(row) {
      var cells = Array.from(row.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]'));
      return cells.length ? '| ' + cells.map(cellText).join(' | ') + ' |' : null;
    }
    var allRows = Array.from(node.querySelectorAll('[role="row"]'));
    if (!allRows.length) return '';
    var headerRow = allRows.find(function (r) {
      return r.querySelector('[role="columnheader"],[role="rowheader"]') &&
        !r.querySelector('[role="cell"],[role="gridcell"]');
    });
    var bodyRows = allRows.filter(function (r) {
      return r !== headerRow &&
        r.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]').length > 0;
    });
    var headers, colCount;
    if (headerRow) {
      headers = Array.from(headerRow.querySelectorAll('[role="columnheader"],[role="rowheader"]')).map(cellText);
      colCount = headers.length;
    } else {
      colCount = Math.max.apply(null, bodyRows.map(function (r) {
        return r.querySelectorAll('[role="cell"],[role="rowheader"],[role="gridcell"]').length;
      }).concat([1]));
      headers = Array(colCount).fill(' ');
    }
    var header = '| ' + headers.join(' | ') + ' |';
    var sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    var body = bodyRows.map(rowToMd).filter(Boolean).join('\n');
    return '\n\n' + header + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
  }

  // ============================================================
  // TurndownService setup with custom rules
  // ============================================================

  /**
   * Create a configured TurndownService instance with Copy-as-Markdown custom rules.
   * @param {{ nolinks?: boolean }} [opts]
   * @returns {TurndownService}
   */
  function createTurndown(opts) {
    opts = opts || {};
    var td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

    // Strip or enhance images and links
    if (opts.nolinks) {
      td.addRule('stripImages', { filter: 'img', replacement: function () { return ''; } });
      td.addRule('stripLinks', { filter: 'a', replacement: function (c) { return c; } });
      td.addRule('stripFigure', { filter: 'figure', replacement: function () { return ''; } });
      td.addRule('stripPicture', { filter: 'picture', replacement: function () { return ''; } });
    } else {
      td.addRule('imgAltFallback', {
        filter: 'img',
        replacement: function (content, node) {
          var src = node.getAttribute('data-src') ||
                    node.getAttribute('data-lazy-src') ||
                    node.getAttribute('data-original') ||
                    node.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          var rawAlt = node.getAttribute('alt') || '';
          var alt = rawAlt && !/^https?:|^\/|^data:/.test(rawAlt)
            ? rawAlt
            : (src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image');
          return '![' + alt + '](' + src + ')';
        }
      });

      td.addRule('picture', {
        filter: 'picture',
        replacement: function (content, node) {
          var img = node.querySelector('img');
          if (!img) return content;
          var src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          var alt = img.getAttribute('alt') || src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image';
          return '![' + alt + '](' + src + ')';
        }
      });

      td.addRule('figure', {
        filter: 'figure',
        replacement: function (content, node) {
          var img = node.querySelector('img');
          if (!img) return content;
          var src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return '';
          var caption = node.querySelector('figcaption');
          var captionText = caption ? caption.textContent.trim() : '';
          var alt = img.getAttribute('alt') || captionText || src.split('/').pop()?.split('?')[0]?.split('.')[0] || 'image';
          var imgMd = '![' + alt + '](' + src + ')';
          return captionText ? '\n\n' + imgMd + '\n*' + captionText + '*\n\n' : '\n\n' + imgMd + '\n\n';
        }
      });
    }

    // Robust link handling
    td.addRule('robustLink', {
      filter: function (node) {
        if (node.nodeName !== 'A') return false;
        var href = node.getAttribute('href') || node.getAttribute('data-mds-href') || '';
        return !!(href && href !== '#' && !href.startsWith('javascript:'));
      },
      replacement: function (content, node) {
        if (!content.trim()) return '';
        var href = node.getAttribute('href') || node.getAttribute('data-mds-href') || '';
        if (!href || href === '#' || href.startsWith('javascript:')) return content;
        var title = (node.getAttribute('title') || '').replace(/(\n+\s*)+/g, '\n');
        var titlePart = title ? ' "' + title + '"' : '';
        return '[' + content + '](' + href + titlePart + ')';
      }
    });

    // Bare <pre> without child <code>
    td.addRule('barePre', {
      filter: function (node) {
        return node.nodeName === 'PRE' && !(node.firstChild && node.firstChild.nodeName === 'CODE');
      },
      replacement: function (content, node) {
        var lang = node.getAttribute('data-mds-lang') || '';
        var code = decodeHTMLEntities(node.textContent).replace(/\n$/, '');
        var fenceSize = Math.max(3, (code.match(/`{3,}/gm) || [])
          .reduce(function (m, s) { return Math.max(m, s.length + 1); }, 3));
        var fence = '`'.repeat(fenceSize);
        return '\n\n' + fence + lang + '\n' + code + '\n' + fence + '\n\n';
      }
    });

    // Inline <code> with entity decoding
    td.addRule('inlineCodeDecoded', {
      filter: function (node) {
        var hasSiblings = node.previousSibling || node.nextSibling;
        var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;
        return node.nodeName === 'CODE' && !isCodeBlock;
      },
      replacement: function (content) {
        if (!content) return '';
        var text = decodeHTMLEntities(content).replace(/\r?\n|\r/g, ' ');
        var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(text) ? ' ' : '';
        var delimiter = '`';
        var matches = text.match(/`+/gm) || [];
        while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`';
        return delimiter + extraSpace + text + extraSpace + delimiter;
      }
    });

    // Rich inline elements
    td.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: function (c) { return c.trim() ? '~~' + c + '~~' : ''; }
    });
    td.addRule('mark', {
      filter: 'mark',
      replacement: function (c) { return c.trim() ? '==' + c + '==' : ''; }
    });
    td.addRule('sup', { filter: 'sup', replacement: function (c) { return c ? '^' + c + '^' : ''; } });
    td.addRule('sub', { filter: 'sub', replacement: function (c) { return c ? '~' + c + '~' : ''; } });

    // Structural elements
    td.addRule('summary', { filter: 'summary', replacement: function () { return ''; } });
    td.addRule('details', {
      filter: 'details',
      replacement: function (content, node) {
        var summary = node.querySelector('summary');
        var title = summary ? summary.textContent.trim() : 'Details';
        var body = content.replace(/^\s+/, '').trim();
        return '\n\n**' + title + '**\n\n' + body + '\n\n';
      }
    });

    td.addRule('dtdd', { filter: ['dt', 'dd'], replacement: function () { return ''; } });
    td.addRule('dl', {
      filter: 'dl',
      replacement: function (content, node) {
        var parts = [];
        node.querySelectorAll('dt, dd').forEach(function (el) {
          var clone = el.cloneNode(true);
          var text = td.turndown(clone.innerHTML).replace(/[\r\n]+/g, ' ').trim();
          parts.push(el.tagName === 'DT' ? '**' + text + '**' : '  ' + text);
        });
        return '\n\n' + parts.join('\n') + '\n\n';
      }
    });

    td.addRule('kbd', {
      filter: 'kbd',
      replacement: function (c) { return c ? '`' + c + '`' : ''; }
    });

    td.addRule('abbr', {
      filter: 'abbr',
      replacement: function (c, node) {
        var title = node.getAttribute('title');
        return title ? c + ' _(' + title + ')_' : c;
      }
    });

    // Clean headings — flatten multi-line heading content
    td.addRule('cleanHeadings', {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      replacement: function (content, node) {
        var level = Number(node.nodeName.charAt(1));
        var clean = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) return '';
        return '\n\n' + '#'.repeat(level) + ' ' + clean + '\n\n';
      }
    });

    // ARIA-role tables
    td.addRule('ariaTableInternals', {
      filter: function (node) {
        var r = node.getAttribute && node.getAttribute('role');
        return ['rowgroup', 'row', 'columnheader', 'cell', 'rowheader'].indexOf(r) >= 0;
      },
      replacement: function () { return ''; }
    });
    td.addRule('ariaTable', {
      filter: function (node) {
        var r = node.getAttribute && node.getAttribute('role');
        return r === 'table' || r === 'grid';
      },
      replacement: function (content, node) { return ariaTableToMarkdown(node, td); }
    });

    // HTML <table> support
    td.addRule('tableInternals', {
      filter: ['thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
      replacement: function () { return ''; }
    });
    td.addRule('table', {
      filter: 'table',
      replacement: function (content, node) { return tableNodeToMarkdown(node, td); }
    });

    return td;
  }

  // ============================================================
  // Cached TurndownService
  // ============================================================

  var _cachedTurndown = null;
  var _cachedOptsKey = '';

  /**
   * Get a cached TurndownService instance, recreating only when options change.
   * @param {{ nolinks?: boolean, clean?: boolean, title?: boolean }} opts
   * @returns {TurndownService}
   */
  function getTurndown(opts) {
    var key = JSON.stringify(opts);
    if (_cachedTurndown && _cachedOptsKey === key) return _cachedTurndown;
    _cachedTurndown = createTurndown(opts);
    _cachedOptsKey = key;
    return _cachedTurndown;
  }

  // ============================================================
  // Page-to-Markdown conversion
  // ============================================================

  /**
   * Convert the current page's main content to Markdown.
   * @param {{ clean?: boolean, title?: boolean, nolinks?: boolean }} opts
   * @returns {string}
   */
  function convertPage(opts) {
    var td = getTurndown(opts);
    var source = getMainContent(document);
    var hiddenEls = [];

    if (opts.clean) {
      var walker = document.createTreeWalker(source, NodeFilter.SHOW_ELEMENT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        if (node.parentElement && node.parentElement.hasAttribute('data-mds-hidden')) {
          node.setAttribute('data-mds-hidden', '');
          hiddenEls.push(node);
          continue;
        }
        var isHidden = false;
        if (typeof node.checkVisibility === 'function') {
          isHidden = !node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        } else {
          var s = window.getComputedStyle(node);
          isHidden = s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
        }
        if (isHidden) {
          node.setAttribute('data-mds-hidden', '');
          hiddenEls.push(node);
        }
      }
    }

    var root;
    try {
      root = source.cloneNode(true);
    } finally {
      hiddenEls.forEach(function (el) { el.removeAttribute('data-mds-hidden'); });
    }

    if (opts.clean) cleanDOM(root);
    resolveUrls(root);
    var md = postProcessMarkdown(td.turndown(root.innerHTML));
    return opts.title ? buildFrontmatter(location.href, document.title) + md : md;
  }

  /**
   * Convert the current user selection to Markdown.
   * @param {{ clean?: boolean, title?: boolean, nolinks?: boolean }} opts
   * @returns {string|null}
   */
  function convertSelection(opts) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    if (!sel.toString().trim()) return null;
    if (sel.anchorNode && window.__CAM__._sidebarHost && window.__CAM__._sidebarHost.contains(sel.anchorNode)) return null;
    var frag = sel.getRangeAt(0).cloneContents();
    var div = document.createElement('div');
    div.appendChild(frag);
    if (opts.clean) cleanDOM(div);
    resolveUrls(div);
    return postProcessMarkdown(getTurndown(opts).turndown(div.innerHTML));
  }

  // ============================================================
  // Remote URL fetch
  // ============================================================

  /**
   * Fetch a remote URL and convert its content to Markdown.
   * @param {string} url
   * @param {{ clean?: boolean, title?: boolean, nolinks?: boolean }} opts
   * @returns {Promise<{ markdown: string, title: string }>}
   */
  async function fetchUrlAsMarkdown(url, opts) {
    try {
      var doc = await TM.network.fetchPage(url, { timeout: 15000 });
      var baseTag = doc.querySelector('base[href]');
      var baseUrl = baseTag ? new URL(baseTag.getAttribute('href'), url).href : url;

      doc.querySelectorAll('a[href]').forEach(function (a) {
        try { a.setAttribute('href', new URL(a.getAttribute('href'), baseUrl).href); } catch (e) {}
      });
      doc.querySelectorAll('img[src], source[srcset]').forEach(function (el) {
        if (el.hasAttribute('src')) {
          try { el.setAttribute('src', new URL(el.getAttribute('src'), baseUrl).href); } catch (e) {}
        }
        if (el.hasAttribute('srcset')) el.removeAttribute('srcset');
      });
      var pageTitle = doc.title || url;
      var pageLang = doc.documentElement.getAttribute('lang') || undefined;
      var root = getMainContent(doc).cloneNode(true);
      if (opts.clean) cleanDOM(root);
      var td = getTurndown(opts);
      var md = postProcessMarkdown(td.turndown(root.innerHTML));
      var result = opts.title ? buildFrontmatter(url, pageTitle, pageLang) + md : md;
      return { markdown: result, title: pageTitle };
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  // ============================================================
  // Exports
  // ============================================================

  CAM.TurndownService = TurndownService;
  CAM.createTurndown = createTurndown;
  CAM.getTurndown = getTurndown;
  CAM.convertPage = convertPage;
  CAM.convertSelection = convertSelection;
  CAM.fetchUrlAsMarkdown = fetchUrlAsMarkdown;
  CAM.cleanDOM = cleanDOM;
  CAM.resolveUrls = resolveUrls;
  CAM.getMainContent = getMainContent;
  CAM.buildFrontmatter = buildFrontmatter;
  CAM.postProcessMarkdown = postProcessMarkdown;
  CAM.decodeHTMLEntities = decodeHTMLEntities;
  CAM.tableNodeToMarkdown = tableNodeToMarkdown;
  CAM.ariaTableToMarkdown = ariaTableToMarkdown;
  CAM.getSafeCellText = getSafeCellText;
  CAM.mergeOrphanedTables = mergeOrphanedTables;
  CAM.LANG_HINTS = LANG_HINTS;
})();

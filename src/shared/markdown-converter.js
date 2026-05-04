// src/shared/markdown-converter.js — Recursive DOM-to-Markdown converter
// Unifies the two independent recursive HTML-to-Markdown implementations from
// NotebookLM Source Export and Google AI Studio Chat Exporter.
// Consumers: NotebookLM Source Export, Google AI Studio Chat Exporter, Copy as Markdown for AI
//
// Architecture:
//   Recursive walker that descends DOM tree, accumulating Markdown strings.
//   Inline elements (strong, em, code, a) produce inline Markdown.
//   Block elements (p, h1-h6, pre, ul/ol, blockquote, table) produce block Markdown
//   separated by double newlines.
//   The top-level entry point is htmlToMarkdown(rootElement).

var HEADING_TAGS = { 'H1': '#', 'H2': '##', 'H3': '###', 'H4': '####', 'H5': '#####', 'H6': '######' };

/**
 * Converts a DOM element and its descendants to Markdown.
 * @param {Element} el - Root element to convert
 * @returns {string} Markdown representation
 */
export function htmlToMarkdown(el) {
  if (!el) return '';
  var out = '';
  walk(el);
  return out.trim().replace(/\n{3,}/g, '\n\n');

  function walk(node) {
    if (!node) return;
    var children = node.childNodes;
    if (!children || children.length === 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        var text = node.textContent.replace(/\s+/g, ' ');
        if (text && text !== ' ') out += text;
      }
      return;
    }
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        var t = child.textContent.replace(/\s+/g, ' ');
        if (t && t !== ' ') out += t;
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      var tag = child.tagName.toUpperCase();

      // Block-level elements
      if (tag === 'BR') { out += '\n'; continue; }
      if (tag === 'HR') { out += '\n\n---\n\n'; continue; }
      if (HEADING_TAGS[tag]) { out += '\n\n' + HEADING_TAGS[tag] + ' '; walk(child); out += '\n\n'; continue; }
      if (tag === 'P' || tag === 'DIV') { out += '\n\n'; walk(child); out += '\n\n'; continue; }
      if (tag === 'PRE') { out += '\n\n```\n' + (child.textContent || '') + '\n```\n\n'; continue; }
      if (tag === 'BLOCKQUOTE') { out += '\n\n> '; walkInline(child); out += '\n\n'; continue; }
      if (tag === 'UL' || tag === 'OL') { out += '\n\n'; walkList(child, tag === 'OL', 1); out += '\n\n'; continue; }
      if (tag === 'TABLE') { out += '\n\n'; walkTable(child); out += '\n\n'; continue; }
      if (tag === 'IMG') { var src = child.getAttribute('src') || ''; var alt = child.getAttribute('alt') || ''; out += '![' + alt + '](' + src + ')'; continue; }

      // Inline elements
      if (tag === 'STRONG' || tag === 'B') { out += '**'; walk(child); out += '**'; continue; }
      if (tag === 'EM' || tag === 'I') { out += '*'; walk(child); out += '*'; continue; }
      if (tag === 'CODE') { out += '`' + (child.textContent || '') + '`'; continue; }
      if (tag === 'A') { var href = child.getAttribute('href') || ''; out += '['; walk(child); out += '](' + href + ')'; continue; }
      if (tag === 'DEL' || tag === 'S') { out += '~~'; walk(child); out += '~~'; continue; }
      if (tag === 'U') { out += '<u>'; walk(child); out += '</u>'; continue; }

      // Unknown element: recurse into children
      walk(child);
    }
  }

  function walkInline(node) {
    if (!node) return;
    var children = node.childNodes;
    if (!children) return;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === Node.TEXT_NODE) { out += child.textContent; continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      var tag = child.tagName.toUpperCase();
      if (tag === 'STRONG' || tag === 'B') { out += '**'; walkInline(child); out += '**'; }
      else if (tag === 'EM' || tag === 'I') { out += '*'; walkInline(child); out += '*'; }
      else if (tag === 'CODE') { out += '`' + (child.textContent || '') + '`'; }
      else if (tag === 'A') { var href = child.getAttribute('href') || ''; out += '['; walkInline(child); out += '](' + href + ')'; }
      else if (tag === 'BR') { out += ' '; }
      else if (tag === 'IMG') { var src = child.getAttribute('src') || ''; var alt = child.getAttribute('alt') || ''; out += '![' + alt + '](' + src + ')'; }
      else { walkInline(child); }
    }
  }

  function walkList(node, ordered, depth) {
    var items = node.querySelectorAll(':scope > li');
    for (var i = 0; i < items.length; i++) {
      var prefix = ordered ? (i + 1) + '. ' : '- ';
      out += '  '.repeat(depth - 1) + prefix;
      walkInline(items[i]);
      out += '\n';
    }
  }

  function walkTable(node) {
    var rows = node.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td, th');
      out += '| ';
      for (var c = 0; c < cells.length; c++) { walkInline(cells[c]); out += ' | '; }
      out += '\n';
      if (r === 0) {
        out += '| ';
        for (c = 0; c < cells.length; c++) { out += '--- | '; }
        out += '\n';
      }
    }
  }
}

/**
 * Standalone recursive DOM-to-Markdown converter.
 * Zero external dependencies.
 *
 * Converts a DOM element and its descendants to GitHub-Flavored Markdown.
 * Handles NotebookLM-specific DOM patterns:
 *   - div[aria-level] → headings (Google's custom element pattern)
 *   - Google redirect URLs → unwrapped q= parameter
 *   - Custom element wrappers around li → correctly counts ol indices
 *   - code[data-language] → fenced code blocks with language tag
 *
 * @param {Element} el - Root element to convert
 * @returns {string} Markdown representation
 */
'use strict';

// Cache for <li> → { ancestor, index } mappings to avoid O(n²) ancestor walks
let _liCache = new WeakMap();

function getLiIndex(node) {
  let ancestor = node.parentElement;
  while (ancestor && !['ul', 'ol'].includes(ancestor.tagName.toLowerCase())) {
    ancestor = ancestor.parentElement;
  }
  if (!ancestor || ancestor.tagName.toLowerCase() !== 'ol') return -1;

  const cached = _liCache.get(node);
  if (cached && cached.ancestor === ancestor) return cached.index;

  // Pre-compute indices for all <li> sharing this ancestor — O(N) once per list
  const allLis = ancestor.querySelectorAll('li');
  for (let i = 0, idx = 1; i < allLis.length; i++) {
    let a = allLis[i].parentElement;
    while (a && !['ul', 'ol'].includes(a.tagName.toLowerCase())) a = a.parentElement;
    if (a === ancestor) {
      _liCache.set(allLis[i], { ancestor: ancestor, index: idx });
      idx++;
    }
  }
  return (_liCache.get(node) || {}).index || 1;
}

/** Clears the <li> index cache. Call between source extractions to prevent stale indices when the DOM changes. */
export function resetLiCache() {
  _liCache = new WeakMap();
}

export function htmlToMarkdown(el) {
  function convert(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    function inner() {
      let result = '';
      for (let child = node.firstChild; child; child = child.nextSibling) {
        result += convert(child);
      }
      return result;
    }

    switch (tag) {
      case 'h1': return '# ' + inner() + '\n\n';
      case 'h2': return '## ' + inner() + '\n\n';
      case 'h3': return '### ' + inner() + '\n\n';
      case 'h4': return '#### ' + inner() + '\n\n';
      case 'h5': return '##### ' + inner() + '\n\n';
      case 'h6': return '###### ' + inner() + '\n\n';
      case 'p':  return inner() + '\n\n';
      case 'br': return '\n';
      case 'strong': case 'b': return '**' + inner() + '**';
      case 'em':     case 'i': return '*' + inner() + '*';
      case 'a': {
        let href = node.getAttribute('href') || '';
        // Unwrap Google redirect URLs to get the actual target
        if (href.includes('google.com/url')) {
          try { href = new URL(href).searchParams.get('q') || href; } catch (_) {}
        }
        const text = inner();
        return href ? '[' + text + '](' + href + ')' : text;
      }
      case 'ul': return inner() + '\n';
      case 'ol': return inner() + '\n';
      case 'li': {
        const index = getLiIndex(node);
        if (index > 0) return index + '. ' + inner().trim() + '\n';
        return '- ' + inner().trim() + '\n';
      }
      case 'div': {
        // NotebookLM uses div[aria-level] for headings inside custom elements
        const ariaLevel = node.getAttribute('aria-level');
        if (ariaLevel) {
          const hashes = '#'.repeat(Math.min(parseInt(ariaLevel), 6));
          return hashes + ' ' + inner().trim() + '\n\n';
        }
        // Horizontal rule pattern
        if (/^-{10,}$/.test(node.textContent.trim())) return '---\n\n';
        // NotebookLM code block: div.paragraph.code > code.code
        if (node.classList && node.classList.contains('code')) {
          const codeEl = node.querySelector('code');
          const lang = codeEl ? (codeEl.getAttribute('data-language') || '') : '';
          const content = codeEl ? codeEl.textContent : node.textContent;
          return '```' + lang + '\n' + content + '\n```\n\n';
        }
        return inner();
      }
      case 's': case 'del': case 'strike': return '~~' + inner() + '~~';
      case 'u': return '__' + inner() + '__';
      case 'code': {
        // Inline code unless the parent is a pre block
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') return inner();
        return '`' + inner() + '`';
      }
      case 'pre': {
        const codeEl = node.querySelector('code');
        const langSource = codeEl || node;
        const lang = langSource.getAttribute('data-language')
          || (langSource.className && langSource.className.match(/language-(\S+)/)?.[1])
          || (langSource.className && langSource.className.match(/lang-(\S+)/)?.[1])
          || '';
        return '```' + lang + '\n' + (codeEl ? codeEl.textContent : inner()) + '\n```\n\n';
      }
      case 'blockquote': return inner().trim().split('\n').map(function (l) { return '> ' + l; }).join('\n') + '\n\n';
      case 'hr': return '---\n\n';
      case 'img': {
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        return '![' + alt + '](' + src + ')';
      }
      case 'table': {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (!rows.length) return inner();
        function toRow(cells) { return '| ' + cells.map(function (c) { return c.textContent.trim().replace(/\|/g, '\\|'); }).join(' | ') + ' |'; }
        const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
        const header = toRow(headerCells);
        const separator = '| ' + headerCells.map(function () { return '---'; }).join(' | ') + ' |';
        const body = rows.slice(1).map(function (r) { return toRow(Array.from(r.querySelectorAll('td'))); }).join('\n');
        return [header, separator, body].filter(Boolean).join('\n') + '\n\n';
      }
      default: return inner();
    }
  }
  return convert(el).replace(/\n{3,}/g, '\n\n').trim();
}

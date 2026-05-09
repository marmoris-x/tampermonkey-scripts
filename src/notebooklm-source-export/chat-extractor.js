/**
 * Extracts chat messages from NotebookLM's chat panel DOM
 * and formats them as Markdown with YAML frontmatter.
 *
 * Also provides structured DOM extraction (for HTML/PDF export)
 * and an HTML document builder.
 *
 * Dependencies: None (htmlToMarkdown is injected by the caller).
 *
 * DOM Structure (notebooklm.google.com):
 *   .chat-panel-content                      — root chat container
 *   .chat-message-pair                       — one user + AI exchange
 *   .from-user-container .message-text-content — user message text
 *   .to-user-container labs-tailwind-doc-viewer — AI response (rich formatted)
 *   .citation-marker                         — inline citation button
 *   .cover-title.mat-headline-medium          — notebook title
 *   .cover-subtitle-date                     — notebook last-modified date
 *   .cover-subtitle-source-count             — source count badge
 *   .summary-content                         — notebook summary text
 */
'use strict';

/** Known NotebookLM chat-panel selectors (subject to Google UI changes). */
const SELECTORS = {
  chatContainer: '.chat-panel-content',
  messagePair: '.chat-message-pair',
  userContent: '.from-user-container .message-text-content',
  aiContent: '.to-user-container labs-tailwind-doc-viewer',
  citationButton: '.citation-marker',
  notebookTitle: '.cover-title.mat-headline-medium',
  notebookDate: '.cover-subtitle-date',
  sourceCount: '.cover-subtitle-source-count',
  summaryContent: '.summary-content'
};

/** Fallback selectors if the primary ones don't match (DOM structure may vary). */
const FALLBACK_SELECTORS = {
  userContent: '[class*="from-user"] [class*="message-text"]',
  aiContent: '[class*="to-user"] [class*="message-text"], [class*="to-user"] labs-tailwind-doc-viewer',
  notebookTitle: '[class*="title"] [class*="mat-title"], [class*="cover-title"]',
  notebookDate: '[class*="subtitle"] [class*="date"], .cover-subtitle-date',
  sourceCount: '[class*="subtitle"] [class*="source"], .cover-subtitle-source-count'
};

/**
 * Returns the first element matching one of the given selectors.
 * @param {Element} root
 * @param {string[]} selectors
 * @returns {Element|null}
 */
function queryFirst(root, selectors) {
  for (let i = 0; i < selectors.length; i++) {
    const el = root.querySelector(selectors[i]);
    if (el) return el;
  }
  return null;
}

/**
 * Formats today's date as YYYY-MM-DD for the frontmatter.
 * @returns {string}
 */
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * Removes citation markers entirely from an element.
 * Used by both Markdown and HTML export paths.
 * @param {Element} el
 */
function removeCitations(el) {
  if (!el) return;
  const buttons = el.querySelectorAll(SELECTORS.citationButton);
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].remove();
  }
}

/**
 * Extracts notebook-level metadata from the DOM.
 * @returns {{ title: string, dateStr: string, sourceInfo: string|null }}
 */
function extractMetadata() {
  let titleEl = document.querySelector(SELECTORS.notebookTitle);
  if (!titleEl) {
    titleEl = queryFirst(document, [FALLBACK_SELECTORS.notebookTitle]);
  }
  const title = titleEl ? titleEl.textContent.trim() : 'NotebookLM Chat';

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

/**
 * Extracts all chat messages from the NotebookLM chat panel and returns them
 * as a Markdown document with YAML frontmatter.
 *
 * @param {Function} htmlToMarkdown - Converter function: (Element) => string
 * @returns {string}  Full Markdown document, or empty string if no chat found
 */
export function extractChatToMarkdown(htmlToMarkdown) {
  const container = document.querySelector(SELECTORS.chatContainer);
  if (!container) return '';

  const pairs = container.querySelectorAll(SELECTORS.messagePair);
  if (!pairs || pairs.length === 0) return '';

  const meta = extractMetadata();

  // Build frontmatter
  const lines = [
    '---',
    'title: "' + meta.title + '"',
    'date: ' + meta.dateStr,
    'platform: NotebookLM'
  ];
  if (meta.sourceInfo) {
    lines.push('sources: ' + meta.sourceInfo);
  }
  lines.push('---');
  lines.push('');
  lines.push('# NotebookLM Chat Export');
  lines.push('');

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

    // Skip pairs where AI response is missing (still generating or incomplete)
    if (!hasAiResponse) continue;

    lines.push('---');
    lines.push('');

    // --- User message ---
    lines.push('## User');
    lines.push('');
    if (hasUserText) {
      lines.push(htmlToMarkdown(userEl));
    } else {
      lines.push('*[non-text message]*');
    }
    lines.push('');

    // --- AI response ---
    lines.push('## NotebookLM');
    lines.push('');
    removeCitations(aiEl);
    lines.push(htmlToMarkdown(aiEl));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Extracts raw chat message data from the NotebookLM chat DOM.
 * Does NOT perform markdown conversion — returns DOM outerHTML.
 * This is used by HTML and PDF export paths.
 *
 * @returns {{ notebookTitle: string, dateStr: string, sourceInfo: string|null,
 *             messages: Array<{ userHtml: string|null, aiHtml: string|null,
 *                               userText: string, aiText: string }> }|null}
 *   Returns null if no chat container or no message pairs found.
 */
export function extractChatMessages() {
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

    // Skip pairs where AI response is missing
    if (!hasAiResponse) continue;

    // Clone AI element before stripping citations (avoids mutating live DOM)
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
      userHtml: userHtml,
      aiHtml: aiHtml,
      userText: userEl ? userEl.textContent.trim() : '',
      aiText: aiEl ? aiEl.textContent.trim() : ''
    });
  }

  if (messages.length === 0) return null;

  return {
    notebookTitle: meta.title,
    dateStr: meta.dateStr,
    sourceInfo: meta.sourceInfo,
    messages: messages
  };
}

/**
 * CSS for the exported HTML document.
 * Renders NotebookLM chat content in a clean, readable format.
 */
const EXPORT_CSS = [
  '*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }',
  'body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;',
  '  font-size:16px; line-height:1.6; color:#1e293b; background:#fff; padding:40px 24px; max-width:800px; margin:0 auto; }',
  'h1 { font-size:24px; font-weight:600; color:#0f172a; margin-bottom:4px; }',
  'h2 { font-size:17px; font-weight:600; color:#334155; margin-bottom:10px; }',
  'a { color:#6366f1; text-decoration:none; }',
  'a:hover { text-decoration:underline; }',
  'code { font-family:"SF Mono","Fira Code","Fira Mono","Roboto Mono",monospace; font-size:0.9em;',
  '  background:#f1f5f9; padding:2px 6px; border-radius:4px; }',
  'pre { background:#0f172a; color:#e2e8f0; padding:16px; border-radius:8px; overflow-x:auto;',
  '  font-size:14px; line-height:1.5; margin:12px 0; }',
  'pre code { background:transparent; padding:0; color:inherit; }',
  'blockquote { border-left:3px solid #6366f1; padding:8px 16px; margin:12px 0; background:#f8fafc;',
  '  border-radius:0 8px 8px 0; }',
  'blockquote p { margin:4px 0; }',
  'table { border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; }',
  'th, td { border:1px solid #e2e8f0; padding:8px 12px; text-align:left; }',
  'th { background:#f8fafc; font-weight:600; color:#334155; }',
  'tr:nth-child(even) { background:#f8fafc; }',
  'ul, ol { padding-left:24px; margin:8px 0; }',
  'li { margin:4px 0; }',
  'p { margin:8px 0; }',
  'hr { border:none; border-top:1px solid #e2e8f0; margin:16px 0; }',
  'img { max-width:100%; height:auto; border-radius:6px; }',
  '.metadata { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; margin:20px 0; }',
  '.metadata h1 { font-size:20px; margin-bottom:8px; }',
  '.metadata dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:14px; }',
  '.metadata dt { color:#64748b; font-weight:500; }',
  '.metadata dd { color:#1e293b; }',
  '.message { margin:24px 0; padding:16px 20px; border-radius:12px; }',
  '.user-message { background:#f1f5f9; border:1px solid #e2e8f0; }',
  '.ai-message { background:#faf5ff; border:1px solid #e8d5ff; }',
  '.message .label { font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }',
  '.user-message .label { color:#6366f1; }',
  '.ai-message .label { color:#a855f7; }',
  '.non-text { color:#94a3b8; font-style:italic; }',
  '@media print { body { padding:20px; font-size:13px; } .message { break-inside:avoid; } }',
  // NotebookLM custom elements: treat as blocks
  'labs-tailwind-doc-viewer, paragraph-element-view { display:block; }',
  // Table wrapper inside NotebookLM
  '.table-wrapper { overflow-x:auto; }'
].join('\n');

/**
 * Strips script tags and event handlers from HTML content for safe export.
 * @param {string} html
 * @returns {string}
 */
function sanitizeHTML(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

/**
 * Builds a complete, self-contained HTML document from extracted chat messages.
 *
 * @param {object} messagesData - Output of extractChatMessages()
 * @param {{ forPrint?: boolean }} [options]
 *   - forPrint: if true, includes print-optimized CSS and auto-triggers window.print()
 * @returns {string} Complete HTML document string
 */
export function buildChatHTMLDocument(messagesData, options) {
  options = options || {};
  const meta = messagesData;

  let bodyParts = '';
  for (let i = 0; i < meta.messages.length; i++) {
    const msg = meta.messages[i];

    bodyParts += '  <div class="message user-message">\n';
    bodyParts += '    <div class="label">User</div>\n';
    if (msg.userHtml) {
      bodyParts += '    <div class="content">' + sanitizeHTML(msg.userHtml) + '</div>\n';
    } else {
      bodyParts += '    <div class="content non-text">[non-text message]</div>\n';
    }
    bodyParts += '  </div>\n\n';

    bodyParts += '  <div class="message ai-message">\n';
    bodyParts += '    <div class="label">NotebookLM</div>\n';
    if (msg.aiHtml) {
      bodyParts += '    <div class="content">' + sanitizeHTML(msg.aiHtml) + '</div>\n';
    } else {
      bodyParts += '    <div class="content non-text">[empty response]</div>\n';
    }
    bodyParts += '  </div>\n\n';
  }

  const printScript = options.forPrint ? '  <script>window.onload=function(){setTimeout(function(){window.print()},500)};<\/script>\n' : '';

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '  <title>' + escapeHTML(meta.notebookTitle) + ' - NotebookLM Chat Export</title>\n' +
    '  <style>' + EXPORT_CSS + '</style>\n' +
    '</head>\n<body>\n' +
    '  <div class="metadata">\n' +
    '    <h1>' + escapeHTML(meta.notebookTitle) + '</h1>\n' +
    '    <dl>\n' +
    '      <dt>Date</dt><dd>' + escapeHTML(meta.dateStr) + '</dd>\n' +
    '      <dt>Platform</dt><dd>NotebookLM</dd>\n' +
    '    </dl>\n' +
    '  </div>\n\n' +
    bodyParts +
    printScript +
    '</body>\n</html>';
}

/**
 * Minimal HTML-escaping for safe insertion into HTML documents.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

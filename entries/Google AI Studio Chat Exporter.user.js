// ==UserScript==
// @name         Google AI Studio Chat Exporter
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.5.3
// @description  Export AI Studio chat as Markdown via Tampermonkey menu command; non-blocking microphone dialog
// @author       marmoris-x
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://aistudio.google.com/
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addElement
// @grant        GM_download
// @grant        GM_setClipboard
// @tag          ai
// @tag          productivity
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
'use strict';

// ==================== LOGGER ====================

function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    const tag = '[' + prefix + ']';
    return {
        log:   function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.log.apply(console, args); },
        warn:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.warn.apply(console, args); },
        error: function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.error.apply(console, args); },
        info:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.info.apply(console, args); },
        debug: function () { if (debugMode) { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.debug.apply(console, args); } },
    };
}

const { log, warn } = createLogger('AI Studio Exporter');

// ==================== STYLES — Microphone Dialog ====================

GM_addElement('style', { textContent: [
    '/* Native mic dialog: non-blocking, repositioned to bottom-left */',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-backdrop {',
    '    pointer-events: none !important;',
    '    backdrop-filter: none !important;',
    '    -webkit-backdrop-filter: none !important;',
    '    background: transparent !important;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-global-overlay-wrapper {',
    '    justify-content: flex-start !important;',
    '    align-items: flex-end !important;',
    '    padding: 0 0 80px 16px !important;',
    '    will-change: transform;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-pane {',
    '    pointer-events: auto !important;',
    '    width: 280px !important;',
    '    height: auto !important;',
    '    min-width: 0 !important;',
    '    contain: layout style;',
    '    animation: ais-mic-fade-in 0.15s ease;',
    '}',
    '@keyframes ais-mic-fade-in {',
    '    from { opacity: 0; transform: translateY(8px); }',
    '    to   { opacity: 1; transform: translateY(0); }',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-container {',
    '    --mdc-dialog-container-shape: 12px;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-title {',
    '    padding: 12px 16px 8px !important;',
    '    font-size: 14px !important;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-content {',
    '    padding: 0 16px !important;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) ms-mic-audio-canvas {',
    '    display: flex;',
    '    justify-content: center;',
    '    padding: 8px 0;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .recording-outer-ring {',
    '    width: 60px !important;',
    '    height: 60px !important;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .recording-indicator {',
    '    width: 36px !important;',
    '    height: 36px !important;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .recording-pulse {',
    '    width: 60px !important;',
    '    height: 60px !important;',
    '}',
    '.cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-actions {',
    '    padding: 8px 16px 12px !important;',
    '    min-height: 0 !important;',
    '}',
    '',
    '/* Remove backdrop blur from CDK dialogs */',
    '.dialog-backdrop-blur-overlay.cdk-overlay-backdrop-showing {',
    '    backdrop-filter: none !important;',
    '    -webkit-backdrop-filter: none !important;',
    '    background: rgba(0, 0, 0, 0.20) !important;',
    '}',
].join('\n') });

// ==================== STATE ====================

let includeThoughts = true;

// ==================== HTML-TO-MARKDOWN CONVERTER ====================

const HEADING_TAGS = { 'H1': '#', 'H2': '##', 'H3': '###', 'H4': '####', 'H5': '#####', 'H6': '######' };

function htmlToMarkdown(el) {
    if (!el) return '';
    let out = '';
    walk(el);
    return out.trim().replace(/\n{3,}/g, '\n\n');

    function walk(node) {
        if (!node) return;
        const children = node.childNodes;
        if (!children || children.length === 0) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.replace(/\s+/g, ' ');
                if (text && text !== ' ') out += text;
            }
            return;
        }
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === Node.TEXT_NODE) {
                const t = child.textContent.replace(/\s+/g, ' ');
                if (t && t !== ' ') out += t;
                continue;
            }
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            const tag = child.tagName.toUpperCase();

            // Block-level elements
            if (tag === 'BR') { out += '\n'; continue; }
            if (tag === 'HR') { out += '\n\n---\n\n'; continue; }
            if (HEADING_TAGS[tag]) { out += '\n\n' + HEADING_TAGS[tag] + ' '; walk(child); out += '\n\n'; continue; }
            if (tag === 'P' || tag === 'DIV') { out += '\n\n'; walk(child); out += '\n\n'; continue; }
            if (tag === 'PRE') { out += '\n\n```\n' + (child.textContent || '') + '\n```\n\n'; continue; }
            if (tag === 'BLOCKQUOTE') { out += '\n\n> '; walkInline(child); out += '\n\n'; continue; }
            if (tag === 'UL' || tag === 'OL') { out += '\n\n'; walkList(child, tag === 'OL', 1); out += '\n\n'; continue; }
            if (tag === 'TABLE') { out += '\n\n'; walkTable(child); out += '\n\n'; continue; }
            if (tag === 'IMG') { const src = child.getAttribute('src') || ''; const alt = child.getAttribute('alt') || ''; out += '![' + alt + '](' + src + ')'; continue; }

            // Inline elements
            if (tag === 'STRONG' || tag === 'B') { out += '**'; walk(child); out += '**'; continue; }
            if (tag === 'EM' || tag === 'I') { out += '*'; walk(child); out += '*'; continue; }
            if (tag === 'CODE') { out += '`' + (child.textContent || '') + '`'; continue; }
            if (tag === 'A') { const href = child.getAttribute('href') || ''; out += '['; walk(child); out += '](' + href + ')'; continue; }
            if (tag === 'DEL' || tag === 'S') { out += '~~'; walk(child); out += '~~'; continue; }
            if (tag === 'U') { out += '<u>'; walk(child); out += '</u>'; continue; }

            walk(child);
        }
    }

    function walkInline(node) {
        if (!node) return;
        const children = node.childNodes;
        if (!children) return;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === Node.TEXT_NODE) { out += child.textContent; continue; }
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            const tag = child.tagName.toUpperCase();
            if (tag === 'STRONG' || tag === 'B') { out += '**'; walkInline(child); out += '**'; }
            else if (tag === 'EM' || tag === 'I') { out += '*'; walkInline(child); out += '*'; }
            else if (tag === 'CODE') { out += '`' + (child.textContent || '') + '`'; }
            else if (tag === 'A') { const href = child.getAttribute('href') || ''; out += '['; walkInline(child); out += '](' + href + ')'; }
            else if (tag === 'BR') { out += ' '; }
            else if (tag === 'IMG') { const src = child.getAttribute('src') || ''; const alt = child.getAttribute('alt') || ''; out += '![' + alt + '](' + src + ')'; }
            else { walkInline(child); }
        }
    }

    function walkList(node, ordered, depth) {
        const items = node.querySelectorAll(':scope > li');
        for (let i = 0; i < items.length; i++) {
            const prefix = ordered ? (i + 1) + '. ' : '- ';
            out += '  '.repeat(depth - 1) + prefix;
            walk(items[i]);
            out += '\n';
        }
    }

    function walkTable(node) {
        const rows = node.querySelectorAll('tr');
        for (let r = 0; r < rows.length; r++) {
            const cells = rows[r].querySelectorAll('td, th');
            out += '| ';
            for (let c = 0; c < cells.length; c++) { walkInline(cells[c]); out += ' | '; }
            out += '\n';
            if (r === 0) {
                out += '| ';
                for (let c = 0; c < cells.length; c++) { out += '--- | '; }
                out += '\n';
            }
        }
    }
}

// ==================== EXTRACTION ====================

function getThoughts(turnEl) {
    const thoughtChunk = turnEl.querySelector('ms-thought-chunk');
    if (!thoughtChunk) return '';
    const panel = thoughtChunk.querySelector('mat-expansion-panel:not([disabled])');
    if (!panel) return '';
    const body = panel.querySelector('.mat-expansion-panel-body');
    return body ? htmlToMarkdown(body) : '';
}

function getContent(turnEl) {
    let out = '';
    const chunks = turnEl.querySelectorAll('ms-text-chunk');
    for (let i = 0; i < chunks.length; i++) {
        if (chunks[i].closest('ms-thought-chunk')) continue;
        out += htmlToMarkdown(chunks[i]);
    }
    return out.trim();
}

function extractTurn(el) {
    const container = el.querySelector('.virtual-scroll-container');
    if (!container) return null;
    const role      = container.getAttribute('data-turn-role') || 'Unknown';
    const tsEl      = el.querySelector('.author-label .timestamp');
    const timestamp = tsEl ? tsEl.textContent.trim() : '';
    const thoughts  = getThoughts(el);
    const content   = getContent(el);
    if (!thoughts && !content) {
        // Diagnostic: log DOM structure when a turn yields empty content
        const kids = [];
        for (let c = 0; c < el.children.length; c++) {
            const child = el.children[c];
            const grandkids = [];
            for (let g = 0; g < child.children.length && grandkids.length < 8; g++) {
                grandkids.push(child.children[g].tagName);
            }
            kids.push(child.tagName + ' > [' + grandkids.join(', ') + ']');
        }
        log('Empty turn (' + role + ') — children: ' + kids.join(' | '));
        return null;
    }
    return { role, timestamp, thoughts, content };
}

function collectTurnIdsFromScrollbar() {
    const buttons = document.querySelectorAll('.items-scrollbar-item button');
    const ids = [];
    for (let i = 0; i < buttons.length; i++) {
        const id = buttons[i].getAttribute('aria-controls');
        if (id) ids.push(id);
    }
    return ids.length > 0 ? ids : null;
}

function waitForTurnElement(turnId, timeoutMs) {
    timeoutMs = timeoutMs || 5000;
    return new Promise(function (resolve) {
        const existing = document.getElementById(turnId);
        if (existing) {
            // Small delay for Angular to finish rendering content
            setTimeout(resolve, 200);
            return;
        }
        const observer = new MutationObserver(function () {
            if (document.getElementById(turnId)) {
                observer.disconnect();
                setTimeout(resolve, 200);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () {
            observer.disconnect();
            warn('waitForTurnElement timeout: ' + turnId);
            resolve();
        }, timeoutMs);
    });
}

async function extractAllTurns() {
    const turnIds = collectTurnIdsFromScrollbar();

    // Fallback: no scrollbar → DOM-only extraction (original behavior)
    if (!turnIds) {
        log('No scrollbar items found — using DOM-only extraction');
        const result = [];
        const turnEls = document.querySelectorAll('ms-chat-turn');
        for (let i = 0; i < turnEls.length; i++) {
            const data = extractTurn(turnEls[i]);
            if (data) result.push(data);
        }
        return result;
    }

    log('Found ' + turnIds.length + ' turns via scrollbar');
    const resultMap = new Map();

    // Step 1: extract already-visible turns without scrolling
    const existingTurns = document.querySelectorAll('ms-chat-turn');
    for (let i = 0; i < existingTurns.length; i++) {
        const el = existingTurns[i];
        const id = el.id || (el.querySelector('[id^="turn-"]') || {}).id;
        const data = extractTurn(el);
        if (data && id) resultMap.set(id, data);
    }

    log('Pre-extracted ' + resultMap.size + ' already-visible turns');

    // Step 2: iterate scrollbar items for missing turns
    for (let i = 0; i < turnIds.length; i++) {
        const id = turnIds[i];
        if (resultMap.has(id)) continue;

        const btn = document.querySelector(
            '.items-scrollbar-item button[aria-controls="' + id + '"]'
        );
        if (!btn) {
            warn('No scrollbar button for turn: ' + id);
            continue;
        }

        btn.click();
        await waitForTurnElement(id);

        const target = document.getElementById(id);
        const el = target && (target.matches('ms-chat-turn') ? target : target.closest('ms-chat-turn'));
        if (el) {
            const data = extractTurn(el);
            if (data) resultMap.set(id, data);
        } else {
            warn('Turn element not found after click: ' + id);
        }

        // Brief debounce before the next scrollbar click
        await new Promise(function (r) { setTimeout(r, 100); });
    }

    // Return in original scrollbar order (deduplication by Map key)
    const result = [];
    for (let i = 0; i < turnIds.length; i++) {
        const data = resultMap.get(turnIds[i]);
        if (data) result.push(data);
    }

    log('Extraction complete: ' + result.length + ' turns');
    return result;
}

// ==================== FORMATTERS ====================

function turnsToMarkdown(turns) {
    const lines = [];
    for (let i = 0; i < turns.length; i++) {
        const t = turns[i];
        const showThoughts = includeThoughts && t.thoughts;
        const showContent = t.content;
        if (!showThoughts && !showContent) continue;
        const label = t.role === 'User' ? '**User**' : '**Model**';
        const ts    = t.timestamp ? ' _(' + t.timestamp + ')_' : '';
        const parts = [label + ts + ':'];
        if (showThoughts) {
            parts.push('<details>\n<summary>Thinking</summary>\n\n' + t.thoughts + '\n\n</details>');
        }
        if (showContent) parts.push(t.content);
        lines.push(parts.join('\n\n'));
    }
    return lines.join('\n\n---\n\n');
}

function turnsToPlainText(turns) {
    return turnsToMarkdown(turns)
        .replace(/<details>\n<summary>(.*?)<\/summary>\n\n([\s\S]*?)\n\n<\/details>/g, '[$1]\n$2')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/gs, '$1')
        .replace(/_(.*?)_/gs, '$1')
        .replace(/```[\w]*\n([\s\S]*?)```/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/^- /gm, '• ')
        .replace(/^> /gm, '  ')
        .replace(/\[([^\]]+)\]/g, '$1')
        .replace(/^---$/gm, '────────────────────────────────────────')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Exports the chat in the requested format.
 * @param {string} format - 'markdown' or 'text'
 * @returns {{ text: string, turnCount: number }|null}
 */
async function exportChat(format) {
    const turns = await extractAllTurns();
    if (!turns.length) return null;
    const text = format === 'text' ? turnsToPlainText(turns) : turnsToMarkdown(turns);
    return { text, turnCount: turns.length };
}

// ==================== MENU COMMAND HANDLERS ====================

async function handleCopy() {
    const result = await exportChat('markdown');
    if (!result) {
        GM.notification({
            title: 'AI Studio Exporter',
            text: 'No chat turns found on this page.',
            timeout: 3000,
        });
        return;
    }
    await GM.setClipboard(result.text, { type: 'text/plain' });
    const size = result.text.length >= 1000
        ? (result.text.length / 1000).toFixed(1) + 'k'
        : String(result.text.length);
    GM.notification({
        title: 'AI Studio Exporter',
        text: `${result.turnCount} turns copied (${size} chars)`,
        timeout: 3000,
    });
}

async function handleDownload() {
    const result = await exportChat('markdown');
    if (!result) {
        GM.notification({
            title: 'AI Studio Exporter',
            text: 'No chat turns found on this page.',
            timeout: 3000,
        });
        return;
    }
    const now = new Date();
    const dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    const filename = 'ai-studio-chat-' + dateStr + '.md';
    const blob = new Blob([result.text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    GM_download({
        url: blob,
        name: filename,
        saveAs: true,
        onload: function () {
            URL.revokeObjectURL(url);
        },
        onerror: function (_err) {
            // TM rejected download (not whitelisted / MV3 restriction).
            // Fallback: DOM anchor click bypasses TM entirely.
            URL.revokeObjectURL(url);
            const fallbackUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = fallbackUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { a.remove(); URL.revokeObjectURL(fallbackUrl); }, 2000);
        }
    });
    GM.notification({
        title: 'AI Studio Exporter',
        text: `${result.turnCount} turns saved as ${filename}`,
        timeout: 3000,
    });
}

async function handleToggleThoughts() {
    includeThoughts = !includeThoughts;
    await GM.setValue('includeThoughts', includeThoughts);
    GM.notification({
        title: 'AI Studio Exporter',
        text: `Include Thoughts: ${includeThoughts ? 'ON' : 'OFF'}`,
        timeout: 2000,
    });
}

// ==================== INIT ====================

async function init() {
    includeThoughts = await GM.getValue('includeThoughts', true);

    GM.registerMenuCommand('Copy Chat as Markdown', handleCopy);
    GM.registerMenuCommand('Download Chat as Markdown', handleDownload);
    GM.registerMenuCommand('Toggle Include Thoughts', handleToggleThoughts);

    log('Ready — menu commands registered');
}

init();

})();

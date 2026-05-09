// ==UserScript==
// @name         Google AI Studio Chat Exporter
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.3.0
// @description  Chat exporter in settings sidebar + native mic dialog repositioned & non-blocking
// @author       marmoris-x
// @match        https://aistudio.google.com/*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==

import { createLogger } from '../src/shared/logging-utils.js';
import { createToast } from '../src/shared/ui-components.js';
import { htmlToMarkdown } from '../src/shared/markdown-converter.js';
import { waitForElement, observeMutations } from '../src/shared/dom-utils.js';

var { log } = createLogger('Google AI Studio Chat Exporter');

    // ==================== STYLES ====================

    var style = document.createElement('style');
    style.textContent = [
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
        '}',
        '.cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-pane {',
        '    pointer-events: auto !important;',
        '    width: 280px !important;',
        '    height: auto !important;',
        '    min-width: 0 !important;',
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
        '/* Remove backdrop blur from all other CDK dialogs too */',
        '.dialog-backdrop-blur-overlay.cdk-overlay-backdrop-showing {',
        '    backdrop-filter: none !important;',
        '    -webkit-backdrop-filter: none !important;',
        '    background: rgba(0, 0, 0, 0.20) !important;',
        '}',
        '',
        '/* Sidebar section */',
        '#ais-export-section {',
        '    padding: 0 16px 20px;',
        '    font-family: "Google Sans", Roboto, sans-serif;',
        '}',
        '#ais-export-section .ais-divider {',
        '    height: 1px;',
        '    background: var(--mat-divider-color, rgba(255,255,255,0.12));',
        '    margin: 0 -16px;',
        '}',
        '#ais-export-section .ais-header {',
        '    display: flex;',
        '    align-items: center;',
        '    gap: 6px;',
        '    padding: 14px 0 8px;',
        '    font-size: 11px;',
        '    font-weight: 600;',
        '    letter-spacing: 0.08em;',
        '    text-transform: uppercase;',
        '    color: var(--mat-sys-on-surface-variant, rgba(232,234,237,0.5));',
        '}',
        '#ais-export-section .ais-header .material-symbols-outlined {',
        '    font-size: 15px;',
        '    line-height: 1;',
        '}',
        '#ais-export-section .ais-row {',
        '    display: flex;',
        '    align-items: center;',
        '    justify-content: space-between;',
        '    padding: 5px 0;',
        '    min-height: 36px;',
        '}',
        '#ais-export-section .ais-label {',
        '    font-size: 13px;',
        '    color: var(--mat-sys-on-surface, #e8eaed);',
        '}',
        '',
        '/* Toggle pill */',
        '.ais-toggle {',
        '    position: relative;',
        '    width: 36px;',
        '    height: 20px;',
        '    border-radius: 10px;',
        '    border: none;',
        '    cursor: pointer;',
        '    padding: 0;',
        '    flex-shrink: 0;',
        '    transition: background 0.2s;',
        '    background: var(--mat-sys-surface-variant, rgba(255,255,255,0.20));',
        '}',
        '.ais-toggle.on { background: var(--mat-sys-primary, #8ab4f8); }',
        '.ais-toggle::after {',
        '    content: "";',
        '    position: absolute;',
        '    top: 3px; left: 3px;',
        '    width: 14px; height: 14px;',
        '    border-radius: 50%;',
        '    background: white;',
        '    box-shadow: 0 1px 3px rgba(0,0,0,0.35);',
        '    transition: transform 0.2s;',
        '}',
        '.ais-toggle.on::after { transform: translateX(16px); }',
        '',
        '/* Copy buttons */',
        '#ais-export-section .ais-btn-row {',
        '    display: flex;',
        '    gap: 8px;',
        '    padding-top: 8px;',
        '}',
        '#ais-export-section .ais-copy-btn {',
        '    flex: 1;',
        '    padding: 7px 8px;',
        '    border-radius: 8px;',
        '    border: 1px solid var(--mat-sys-outline-variant, rgba(255,255,255,0.18));',
        '    background: transparent;',
        '    color: var(--mat-sys-on-surface, #e8eaed);',
        '    font-size: 12px;',
        '    font-weight: 500;',
        '    font-family: inherit;',
        '    cursor: pointer;',
        '    display: flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '    transition: background 0.15s, border-color 0.15s, color 0.15s;',
        '    white-space: nowrap;',
        '}',
        '#ais-export-section .ais-copy-btn:hover {',
        '    background: var(--mat-sys-surface-variant, rgba(255,255,255,0.08));',
        '    border-color: var(--mat-sys-primary, #8ab4f8);',
        '}',
        '#ais-export-section .ais-copy-btn.done {',
        '    background: rgba(76,175,80,0.15);',
        '    border-color: #4caf50;',
        '    color: #4caf50;',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // ==================== STATE ====================

    var includeThoughts = true;

    // ==================== EXTRACTION ====================

    /**
     * Extracts the model's thinking/reasoning content from a chat turn element.
     * Looks for ms-thought-chunk with an enabled expansion panel.
     * @param {HTMLElement} turnEl - The chat turn element
     * @returns {string} Markdown-formatted thought content, or empty string
     */
    function getThoughts(turnEl) {
        var thoughtChunk = turnEl.querySelector('ms-thought-chunk');
        if (!thoughtChunk) return '';
        var panel = thoughtChunk.querySelector('mat-expansion-panel:not([disabled])');
        if (!panel) return '';
        var body = panel.querySelector('.mat-expansion-panel-body');
        return body ? htmlToMarkdown(body) : '';
    }

    /**
     * Extracts the main text content from a chat turn, skipping thought chunks.
     * @param {HTMLElement} turnEl - The chat turn element
     * @returns {string} Trimmed markdown content
     */
    function getContent(turnEl) {
        var out = '';
        var chunks = turnEl.querySelectorAll('ms-text-chunk');
        for (var i = 0; i < chunks.length; i++) {
            if (chunks[i].closest('ms-thought-chunk')) continue;
            out += htmlToMarkdown(chunks[i]);
        }
        return out.trim();
    }

    /**
     * Extracts all chat turns from the page, collecting role, timestamp, thoughts, and content.
     * @returns {Array<{role: string, timestamp: string, thoughts: string, content: string}>}
     */
    function extractAllTurns() {
        var result = [];
        var turnEls = document.querySelectorAll('ms-chat-turn');
        for (var i = 0; i < turnEls.length; i++) {
            var el = turnEls[i];
            var container = el.querySelector('.virtual-scroll-container');
            if (!container) continue;
            var role      = container.getAttribute('data-turn-role') || 'Unknown';
            var tsEl      = el.querySelector('.author-label .timestamp');
            var timestamp = tsEl ? tsEl.textContent.trim() : '';
            var thoughts  = getThoughts(el);
            var content   = getContent(el);
            if (!thoughts && !content) continue;
            result.push({ role: role, timestamp: timestamp, thoughts: thoughts, content: content });
        }
        return result;
    }

    // ==================== FORMATTERS ====================

    /**
     * Formats chat turns as a Markdown document with optional collapsible thinking sections.
     * @param {Array} turns - Array of turn objects from extractAllTurns()
     * @returns {string} Markdown-formatted conversation
     */
    function turnsToMarkdown(turns) {
        var lines = [];
        for (var i = 0; i < turns.length; i++) {
            var t = turns[i];
            var label = t.role === 'User' ? '**User**' : '**Model**';
            var ts    = t.timestamp ? ' _(' + t.timestamp + ')_' : '';
            var parts = [label + ts + ':'];
            if (includeThoughts && t.thoughts) {
                parts.push('<details>\n<summary>Thinking</summary>\n\n' + t.thoughts + '\n\n</details>');
            }
            if (t.content) parts.push(t.content);
            lines.push(parts.join('\n\n'));
        }
        return lines.join('\n\n---\n\n');
    }

    /**
     * Strips Markdown formatting from turn output, returning plain text.
     * Removes headings, bold, italic, code blocks, and replaces separators.
     * @param {Array} turns - Array of turn objects
     * @returns {string} Plain text conversation
     */
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
     * @returns {string|null} The formatted chat, or null if no turns found
     */
    function exportChat(format) {
        var turns = extractAllTurns();
        if (!turns.length) return null;
        return format === 'text' ? turnsToPlainText(turns) : turnsToMarkdown(turns);
    }

    // ==================== SIDEBAR SECTION ====================

    /**
     * Builds the export section DOM element for the sidebar, including toggle and copy buttons.
     * @returns {HTMLDivElement}
     */
    function buildSection() {
        var wrap = document.createElement('div');
        wrap.id = 'ais-export-section';

        wrap.appendChild(makeDivider());
        wrap.appendChild(makeHeader('content_copy', 'Export Chat'));

        // Thoughts toggle row
        var thoughtsRow = document.createElement('div');
        thoughtsRow.className = 'ais-row';
        var lbl = document.createElement('span');
        lbl.className = 'ais-label';
        lbl.textContent = 'Include Thoughts';
        var toggle = document.createElement('button');
        toggle.className = 'ais-toggle' + (includeThoughts ? ' on' : '');
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-checked', String(includeThoughts));
        toggle.setAttribute('aria-label', 'Include thoughts in export');
        toggle.onclick = function () {
            includeThoughts = !includeThoughts;
            toggle.classList.toggle('on', includeThoughts);
            toggle.setAttribute('aria-checked', String(includeThoughts));
        };
        thoughtsRow.appendChild(lbl);
        thoughtsRow.appendChild(toggle);
        wrap.appendChild(thoughtsRow);

        // Copy buttons
        var btnRow = document.createElement('div');
        btnRow.className = 'ais-btn-row';
        btnRow.appendChild(makeCopyBtn('Markdown', 'Copy as Markdown', 'markdown'));
        btnRow.appendChild(makeCopyBtn('Text',     'Copy as plain text', 'text'));
        wrap.appendChild(btnRow);

        return wrap;
    }

    /**
     * Creates a visual divider element.
     * @returns {HTMLDivElement}
     */
    function makeDivider() {
        var d = document.createElement('div');
        d.className = 'ais-divider';
        return d;
    }

    /**
     * Creates a section header with a material icon and label text.
     * @param {string} icon - Material Symbols icon name
     * @param {string} label - Header label text
     * @returns {HTMLDivElement}
     */
    function makeHeader(icon, label) {
        var h = document.createElement('div');
        h.className = 'ais-header';
        h.innerHTML = '<span class="material-symbols-outlined notranslate">' + icon + '</span>' + label;
        return h;
    }

    /**
     * Creates a copy button for a specific export format.
     * @param {string} label - Button display text
     * @param {string} title - Tooltip text
     * @param {string} format - 'markdown' or 'text'
     * @returns {HTMLButtonElement}
     */
    function makeCopyBtn(label, title, format) {
        var btn = document.createElement('button');
        btn.className = 'ais-copy-btn';
        btn.textContent = label;
        btn.title = title;
        btn.onclick = function () { handleCopy(format, btn, label); };
        return btn;
    }

    /**
     * Handles the copy action: exports chat, copies to clipboard, shows feedback.
     * Falls back to textarea-based copy if navigator.clipboard fails.
     * @param {string} format - 'markdown' or 'text'
     * @param {HTMLButtonElement} btn - The clicked button element
     * @param {string} origLabel - Original button label for reset
     */
    async function handleCopy(format, btn, origLabel) {
        var text = exportChat(format);
        if (!text) {
            createToast('Kein Chat gefunden', { type: 'error' });
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
        } catch (_) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }

        var label = format === 'markdown' ? 'Markdown' : 'Text';
        createToast(label + ' kopiert — ' + (text.length / 1000).toFixed(1) + 'k Zeichen', { type: 'success' });
        btn.classList.add('done');
        btn.textContent = '✓';
        setTimeout(function () { btn.classList.remove('done'); btn.textContent = origLabel; }, 2000);
    }

    // ==================== INJECTION ====================

    waitForElement('.scrollable-area', 0).then(function (area) {
        if (!area.querySelector('#ais-export-section')) {
            area.appendChild(buildSection());
            log('Export section injected');
        }
        observeMutations(function () {
            if (!area.querySelector('#ais-export-section')) {
                area.appendChild(buildSection());
                log('Export section re-injected');
            }
        }, area);
    });

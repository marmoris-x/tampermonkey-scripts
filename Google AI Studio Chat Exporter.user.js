// ==UserScript==
// @name         Google AI Studio Chat Exporter
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Chat exporter in settings sidebar + native mic dialog repositioned & non-blocking
// @author       marmoris
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ==================== STYLES ====================

    const style = document.createElement('style');
    style.textContent = `
        /* ── Native mic dialog: non-blocking, repositioned to bottom-left ── */
        .cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-backdrop {
            pointer-events: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: transparent !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-global-overlay-wrapper {
            justify-content: flex-start !important;
            align-items: flex-end !important;
            padding: 0 0 80px 16px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .cdk-overlay-pane {
            pointer-events: auto !important;
            width: 280px !important;
            height: auto !important;
            min-width: 0 !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-container {
            --mdc-dialog-container-shape: 12px;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-title {
            padding: 12px 16px 8px !important;
            font-size: 14px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-content {
            padding: 0 16px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) ms-mic-audio-canvas {
            display: flex;
            justify-content: center;
            padding: 8px 0;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .recording-outer-ring {
            width: 60px !important;
            height: 60px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .recording-indicator {
            width: 36px !important;
            height: 36px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .recording-pulse {
            width: 60px !important;
            height: 60px !important;
        }
        .cdk-overlay-container:has(ms-mic-audio-dialog) .mat-mdc-dialog-actions {
            padding: 8px 16px 12px !important;
            min-height: 0 !important;
        }

        /* Remove backdrop blur from all other CDK dialogs too */
        .dialog-backdrop-blur-overlay.cdk-overlay-backdrop-showing {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(0, 0, 0, 0.20) !important;
        }

        /* ── Sidebar section ── */
        #ais-export-section {
            padding: 0 16px 20px;
            font-family: 'Google Sans', Roboto, sans-serif;
        }
        #ais-export-section .ais-divider {
            height: 1px;
            background: var(--mat-divider-color, rgba(255,255,255,0.12));
            margin: 0 -16px;
        }
        #ais-export-section .ais-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 14px 0 8px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--mat-sys-on-surface-variant, rgba(232,234,237,0.5));
        }
        #ais-export-section .ais-header .material-symbols-outlined {
            font-size: 15px;
            line-height: 1;
        }
        #ais-export-section .ais-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 0;
            min-height: 36px;
        }
        #ais-export-section .ais-label {
            font-size: 13px;
            color: var(--mat-sys-on-surface, #e8eaed);
        }

        /* Toggle pill */
        .ais-toggle {
            position: relative;
            width: 36px;
            height: 20px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            padding: 0;
            flex-shrink: 0;
            transition: background 0.2s;
            background: var(--mat-sys-surface-variant, rgba(255,255,255,0.20));
        }
        .ais-toggle.on { background: var(--mat-sys-primary, #8ab4f8); }
        .ais-toggle::after {
            content: '';
            position: absolute;
            top: 3px; left: 3px;
            width: 14px; height: 14px;
            border-radius: 50%;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.35);
            transition: transform 0.2s;
        }
        .ais-toggle.on::after { transform: translateX(16px); }

        /* Copy buttons */
        #ais-export-section .ais-btn-row {
            display: flex;
            gap: 8px;
            padding-top: 8px;
        }
        #ais-export-section .ais-copy-btn {
            flex: 1;
            padding: 7px 8px;
            border-radius: 8px;
            border: 1px solid var(--mat-sys-outline-variant, rgba(255,255,255,0.18));
            background: transparent;
            color: var(--mat-sys-on-surface, #e8eaed);
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, border-color 0.15s, color 0.15s;
            white-space: nowrap;
        }
        #ais-export-section .ais-copy-btn:hover {
            background: var(--mat-sys-surface-variant, rgba(255,255,255,0.08));
            border-color: var(--mat-sys-primary, #8ab4f8);
        }
        #ais-export-section .ais-copy-btn.done {
            background: rgba(76,175,80,0.15);
            border-color: #4caf50;
            color: #4caf50;
        }

        /* Toast */
        #ais-toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            padding: 8px 18px;
            border-radius: 20px;
            font-size: 13px;
            font-family: 'Google Sans', Roboto, sans-serif;
            background: rgba(30,30,46,0.95);
            color: #e8eaed;
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 4px 16px rgba(0,0,0,0.45);
            white-space: nowrap;
            pointer-events: none;
            transition: opacity 0.4s;
        }
        #ais-toast.err { background: #b71c1c; border-color: transparent; }
    `;
    document.head.appendChild(style);

    // ==================== STATE ====================

    let includeThoughts = true;

    // ==================== DOM → MARKDOWN ====================

    const SKIP_TAGS = new Set([
        'button', 'svg', 'path', 'defs', 'clippath', 'lineargradient',
        'g', 'rect', 'stop', 'filter', 'use', 'symbol',
    ]);

    function nodeToMd(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) return '';
        if (tag.startsWith('ms-') || tag.startsWith('mat-')) return childrenToMd(node);
        const inner = childrenToMd(node);
        switch (tag) {
            case 'p':          return inner.trim() ? inner.trim() + '\n\n' : '';
            case 'h1':         return '# '      + inner.trim() + '\n\n';
            case 'h2':         return '## '     + inner.trim() + '\n\n';
            case 'h3':         return '### '    + inner.trim() + '\n\n';
            case 'h4':         return '#### '   + inner.trim() + '\n\n';
            case 'h5':         return '##### '  + inner.trim() + '\n\n';
            case 'h6':         return '###### ' + inner.trim() + '\n\n';
            case 'strong':
            case 'b':          return inner.trim() ? `**${inner.trim()}**` : '';
            case 'em':
            case 'i':          return inner.trim() ? `_${inner.trim()}_` : '';
            case 'br':         return '\n';
            case 'hr':         return '\n---\n\n';
            case 'a':          return inner.trim();
            case 'code':       return node.closest('pre') ? inner : `\`${inner}\``;
            case 'pre': {
                const codeEl = node.querySelector('code');
                const lang = (codeEl?.className.match(/language-(\w+)/) || [])[1] || '';
                return `\`\`\`${lang}\n${(codeEl?.textContent ?? inner).trim()}\n\`\`\`\n\n`;
            }
            case 'ul':
            case 'ol':         return inner.trim() + '\n';
            case 'li':         return `- ${inner.trim()}\n`;
            case 'blockquote': return inner.trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
            case 'table':      return inner + '\n';
            case 'thead':
            case 'tbody':      return inner;
            case 'tr':         return `| ${inner.trim()} |\n`;
            case 'th':
            case 'td':         return `${inner.trim()} | `;
            case 'img':        return node.getAttribute('alt') ? `[${node.getAttribute('alt')}]` : '';
            default:           return inner;
        }
    }

    function childrenToMd(node) {
        let out = '';
        for (const child of node.childNodes) out += nodeToMd(child);
        return out;
    }

    // ==================== EXTRACTION ====================

    function getThoughts(turnEl) {
        const thoughtChunk = turnEl.querySelector('ms-thought-chunk');
        if (!thoughtChunk) return '';
        const panel = thoughtChunk.querySelector('mat-expansion-panel:not([disabled])');
        if (!panel) return '';
        const body = panel.querySelector('.mat-expansion-panel-body');
        return body ? nodeToMd(body).trim() : '';
    }

    function getContent(turnEl) {
        let out = '';
        for (const tc of turnEl.querySelectorAll('ms-text-chunk')) {
            if (tc.closest('ms-thought-chunk')) continue;
            out += nodeToMd(tc);
        }
        return out.trim();
    }

    function extractAllTurns() {
        const result = [];
        for (const el of document.querySelectorAll('ms-chat-turn')) {
            const container = el.querySelector('.virtual-scroll-container');
            if (!container) continue;
            const role      = container.getAttribute('data-turn-role') || 'Unknown';
            const tsEl      = el.querySelector('.author-label .timestamp');
            const timestamp = tsEl ? tsEl.textContent.trim() : '';
            const thoughts  = getThoughts(el);
            const content   = getContent(el);
            if (!thoughts && !content) continue;
            result.push({ role, timestamp, thoughts, content });
        }
        return result;
    }

    // ==================== FORMATTERS ====================

    function turnsToMarkdown(turns) {
        return turns.map(({ role, timestamp, thoughts, content }) => {
            const label = role === 'User' ? '**User**' : '**Model**';
            const ts    = timestamp ? ` _(${timestamp})_` : '';
            const parts = [`${label}${ts}:`];
            if (includeThoughts && thoughts) {
                parts.push('<details>\n<summary>💭 Thinking</summary>\n\n' + thoughts + '\n\n</details>');
            }
            if (content) parts.push(content);
            return parts.join('\n\n');
        }).join('\n\n---\n\n');
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
            .replace(/^---$/gm, '─'.repeat(40))
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function exportChat(format) {
        const turns = extractAllTurns();
        if (!turns.length) return null;
        return format === 'text' ? turnsToPlainText(turns) : turnsToMarkdown(turns);
    }

    // ==================== SIDEBAR SECTION ====================

    function buildSection() {
        const wrap = document.createElement('div');
        wrap.id = 'ais-export-section';

        wrap.appendChild(makeDivider());
        wrap.appendChild(makeHeader('content_copy', 'Export Chat'));

        // Thoughts toggle row
        const thoughtsRow = document.createElement('div');
        thoughtsRow.className = 'ais-row';
        const lbl = document.createElement('span');
        lbl.className = 'ais-label';
        lbl.textContent = 'Include Thoughts';
        const toggle = document.createElement('button');
        toggle.className = 'ais-toggle' + (includeThoughts ? ' on' : '');
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-checked', String(includeThoughts));
        toggle.setAttribute('aria-label', 'Include thoughts in export');
        toggle.onclick = () => {
            includeThoughts = !includeThoughts;
            toggle.classList.toggle('on', includeThoughts);
            toggle.setAttribute('aria-checked', String(includeThoughts));
        };
        thoughtsRow.append(lbl, toggle);
        wrap.appendChild(thoughtsRow);

        // Copy buttons
        const btnRow = document.createElement('div');
        btnRow.className = 'ais-btn-row';
        btnRow.append(
            makeCopyBtn('Markdown', 'Als Markdown kopieren', 'markdown'),
            makeCopyBtn('Text',     'Als reinen Text kopieren', 'text')
        );
        wrap.appendChild(btnRow);

        return wrap;
    }

    function makeDivider() {
        const d = document.createElement('div');
        d.className = 'ais-divider';
        return d;
    }

    function makeHeader(icon, label) {
        const h = document.createElement('div');
        h.className = 'ais-header';
        h.innerHTML = `<span class="material-symbols-outlined notranslate">${icon}</span>${label}`;
        return h;
    }

    function makeCopyBtn(label, title, format) {
        const btn = document.createElement('button');
        btn.className = 'ais-copy-btn';
        btn.textContent = label;
        btn.title = title;
        btn.onclick = () => handleCopy(format, btn, label);
        return btn;
    }

    async function handleCopy(format, btn, origLabel) {
        const text = exportChat(format);
        if (!text) { showToast('Kein Chat gefunden', true); return; }

        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }

        showToast(`${format === 'markdown' ? 'Markdown' : 'Text'} kopiert — ${(text.length / 1000).toFixed(1)}k Zeichen`);
        btn.classList.add('done');
        btn.textContent = '✓';
        setTimeout(() => { btn.classList.remove('done'); btn.textContent = origLabel; }, 2000);
    }

    function showToast(msg, isErr = false) {
        document.getElementById('ais-toast')?.remove();
        const t = document.createElement('div');
        t.id = 'ais-toast';
        if (isErr) t.classList.add('err');
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; }, 2500);
        setTimeout(() => t.remove(), 3000);
    }

    // ==================== INJECTION ====================

    let observedArea = null;
    let areaObserver = null;

    function syncSidebar() {
        const area = document.querySelector('.scrollable-area');
        if (!area) return;

        if (!area.querySelector('#ais-export-section')) {
            area.appendChild(buildSection());
        }

        if (area !== observedArea) {
            areaObserver?.disconnect();
            areaObserver = new MutationObserver(() => {
                if (!area.querySelector('#ais-export-section')) {
                    area.appendChild(buildSection());
                }
            });
            areaObserver.observe(area, { childList: true });
            observedArea = area;
        }
    }

    setTimeout(syncSidebar, 1500);
    setInterval(syncSidebar, 3000);

})();

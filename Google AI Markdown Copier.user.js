// ==UserScript==
// @name         Google AI Markdown Copier
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Kopiert Google AI Antworten als Markdown mit Tabellen, Code-Blöcken und Keyboard-Shortcut
// @author       marmoris
// @match        https://www.google.com/search?*
// @match        https://www.google.de/search?*
// @match        https://www.google.at/search?*
// @match        https://www.google.ch/search?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://gemini.google.com/?hl=de
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('Google AI Markdown Copier v7.0 gestartet');

    const BUTTON_ID_PREFIX = 'ai-copy-icon';
    const TOAST_ID = 'markdown-copy-toast';

    // ==================== MARKDOWN KONVERTER ====================

    /**
     * Konvertiert eine HTML-Tabelle in eine Markdown-Tabelle
     */
    function convertTableToMarkdown(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        let markdown = '\n';
        let isFirstRow = true;

        rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            if (cells.length === 0) return;

            // Extrahiere Zellinhalt und escape Pipes
            const cellContents = cells.map(cell => {
                return cell.textContent.trim().replace(/\|/g, '\\|');
            });

            // Erstelle Tabellenzeile
            markdown += '| ' + cellContents.join(' | ') + ' |\n';

            // Nach der ersten Zeile (Header) füge Trennzeile hinzu
            if (isFirstRow) {
                const separator = cells.map(() => ':---').join(' | ');
                markdown += '| ' + separator + ' |\n';
                isFirstRow = false;
            }
        });

        return markdown + '\n';
    }

    /**
     * Konvertiert Code-Blöcke korrekt
     */
    function convertCodeBlock(codeContainer) {
        const codeElement = codeContainer.querySelector('code');
        if (!codeElement) return '';

        const languageDiv = codeContainer.querySelector('.z0e9Qd .vVRw1d');
        const language = languageDiv ? languageDiv.textContent.trim() : '';

        const code = codeElement.textContent.trim();

        return '\n```' + language + '\n' + code + '\n```\n';
    }

    /**
     * Konvertiert Google AI HTML in sauberes Markdown
     */
    function htmlToMarkdown(element) {
        if (!element) return '';

        // Wir arbeiten auf einer Kopie, um die Webseite nicht zu verändern
        let clone = element.cloneNode(true);

        // 1. Unnötige Elemente entfernen (Share-Button, "Mehr anzeigen", etc.)
        const junkSelectors = [
            'button:not(.markdown-copy-btn)', '[role="button"]', '.bQ0Yzc',
            '.v4bSkd', 'sup', 'g-more-link', 'svg:not(.markdown-copy-icon)',
            '.z07gg', '.VnsvSb', '.LYZeUd', '.pehLO', '[id^="fbproxy"]', '.HZAySd',
            '.txxDge', // Link-Buttons im Text
            '#' + BUTTON_ID_PREFIX, // Unsere eigenen Buttons
            '.' + BUTTON_ID_PREFIX // Wrapper-Klassen
        ];
        junkSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

        // 2. Rekursive Funktion zur Markdown-Erzeugung
        function processNode(node, inBlockquote = false, depth = 0) {
            if (!node) return '';

            // Textknoten
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            }

            // Element-Knoten
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Tabellen haben Priorität
                if (node.matches && node.matches('table')) {
                    return convertTableToMarkdown(node);
                }

                // Code-Blöcke
                if (node.matches && (node.matches('pre') || node.matches('.r1PmQe'))) {
                    // Versuche erst mit Google's Struktur
                    const converted = convertCodeBlock(node);
                    if (converted) return converted;

                    // Fallback: Standard Pre-Tag
                    const code = node.querySelector('code');
                    const text = code ? code.textContent.trim() : node.textContent.trim();
                    return text ? `\n\`\`\`\n${text}\n\`\`\`\n` : '';
                }

                // Inline Code
                if (node.matches && node.matches('code') && !node.closest('pre')) {
                    const text = node.textContent.trim();
                    return text ? `\`${text}\`` : '';
                }

                // Blockquote (Google nutzt .lQkWXb)
                if (node.matches && (node.matches('blockquote') || node.matches('.lQkWXb'))) {
                    const childMarkdown = processChildren(node, true, depth);
                    if (!childMarkdown.trim()) return '';

                    const lines = childMarkdown.trim().split('\n');
                    const formattedLines = lines
                        .map(line => line.trim() ? `> ${line.trim()}` : '>')
                        .filter(line => line !== '>');

                    return formattedLines.length > 0 ? `\n\n${formattedLines.join('\n')}\n\n` : '';
                }

                // Überschriften (Google nutzt oft aria-level)
                if (node.matches && (node.matches('[aria-level]') || node.matches('[role="heading"]'))) {
                    const level = Math.min(parseInt(node.getAttribute('aria-level') || '3'), 6);
                    const hashes = '#'.repeat(level);
                    const text = processChildren(node, false, depth).trim();
                    return text ? `\n\n${hashes} ${text}\n` : '';
                }

                // Listen
                if (node.matches && (node.matches('ul') || node.matches('ol'))) {
                    return processList(node, depth);
                }

                // Fett
                if (node.matches && (node.matches('b') || node.matches('strong') || node.matches('.Yjhzub'))) {
                    const text = processChildren(node, false, depth).trim();
                    return text ? `**${text}**` : '';
                }

                // Kursiv
                if (node.matches && (node.matches('i') || node.matches('em'))) {
                    const text = processChildren(node, false, depth).trim();
                    return text ? `*${text}*` : '';
                }

                // Links
                if (node.matches && node.matches('a') && node.href) {
                    const text = processChildren(node, false, depth).trim();
                    return text ? `[${text}](${node.href})` : '';
                }

                // Mark/Highlight (wird zu Bold)
                if (node.matches && node.matches('mark')) {
                    const text = processChildren(node, false, depth).trim();
                    return text ? `**${text}**` : '';
                }

                // Absätze mit Leerzeile
                if (node.matches && (node.matches('p') || node.matches('.Y3BBE'))) {
                    const text = processChildren(node, false, depth).trim();
                    return text ? `\n\n${text}` : '';
                }

                // Container-Elemente: Kinder verarbeiten
                return processChildren(node, inBlockquote, depth);
            }

            return '';
        }

        // Hilfsfunktion: Verarbeitet alle Kindknoten
        function processChildren(element, inBlockquote = false, depth = 0) {
            let result = '';
            for (const child of Array.from(element.childNodes)) {
                result += processNode(child, inBlockquote, depth);
            }
            return result;
        }

        // Listen-Verarbeitung
        function processList(list, depth) {
            const items = [];
            const isOrdered = list.tagName === 'OL';

            Array.from(list.children).forEach((li, index) => {
                if (li.tagName !== 'LI') return;
                items.push(processListItem(li, depth, isOrdered, index));
            });

            if (items.length === 0) return '';
            const listContent = items.join('\n');
            return depth === 0 ? `\n${listContent}\n` : listContent;
        }

        function processListItem(li, depth, isOrdered, index) {
            let content = '';

            for (const child of Array.from(li.childNodes)) {
                if (child.nodeType === Node.TEXT_NODE) {
                    content += child.textContent;
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    if (child.matches && (child.matches('ul') || child.matches('ol'))) {
                        // Verschachtelte Liste
                        content += '\n' + processList(child, depth + 1);
                    } else {
                        // Prüfe auf verschachtelte Listen in Wrapper-Elementen
                        const nestedLists = child.querySelectorAll('ul, ol');
                        if (nestedLists.length > 0) {
                            // Clone und entferne Listen für Textinhalt
                            const clone = child.cloneNode(true);
                            clone.querySelectorAll('ul, ol').forEach(list => list.remove());
                            const otherContent = processNode(clone, false, depth);
                            if (otherContent.trim()) content += otherContent;
                            // Verarbeite verschachtelte Listen
                            nestedLists.forEach(list => {
                                content += '\n' + processList(list, depth + 1);
                            });
                        } else {
                            content += processNode(child, false, depth);
                        }
                    }
                }
            }

            content = content.trim();
            if (!content) return '';

            const indent = '  '.repeat(depth);
            const prefix = isOrdered ? `${index + 1}. ` : '- ';
            return `${indent}${prefix}${content}`;
        }

        // 3. Hauptverarbeitung
        const markdown = processNode(clone, false, 0).trim();

        // 4. Bereinigung
        const cleaned = markdown
            .replace(/\n\s*\n\s*\n/g, '\n\n') // Mehrfache Leerzeilen reduzieren
            .replace(/[ \t]{3,}/g, ' ') // Nur 3+ Leerzeichen/Tabs reduzieren
            .trim();

        return cleaned;
    }

    // ==================== TOAST NOTIFICATION ====================

    /**
     * Zeigt eine Toast-Benachrichtigung an
     */
    function showToast(message, isSuccess = true) {
        // Entferne alten Toast falls vorhanden
        const oldToast = document.getElementById(TOAST_ID);
        if (oldToast) oldToast.remove();

        // Erstelle neuen Toast
        const toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: ${isSuccess ? '#188038' : '#d93025'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        `;

        document.body.appendChild(toast);

        // Animiere Toast ein
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        });

        // Entferne Toast nach 2.5s
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // ==================== COPY FUNKTIONALITÄT ====================

    /**
     * Kopiert Markdown in die Zwischenablage
     */
    function copyMarkdown(container) {
        try {
            const markdown = htmlToMarkdown(container);

            if (!markdown || markdown.trim().length === 0) {
                showToast('⚠️ Kein Inhalt zum Kopieren gefunden', false);
                return false;
            }

            // Kopiere in Zwischenablage
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(markdown, 'text');
            } else {
                navigator.clipboard.writeText(markdown);
            }

            showToast('✓ Markdown kopiert!');
            return true;
        } catch (error) {
            console.error('Fehler beim Kopieren:', error);
            showToast('⚠️ Fehler beim Kopieren', false);
            return false;
        }
    }

    // ==================== BUTTON ERSTELLUNG ====================

    /**
     * Erstellt einen Copy-Button im Google-Stil
     */
    function createCopyButton(container, index) {
        const buttonId = `${BUTTON_ID_PREFIX}-${index}`;

        // Erstelle Button (klone Google's Button-Struktur)
        const btn = document.createElement('button');
        btn.id = buttonId;
        btn.className = 'ya9Iof markdown-copy-btn';
        btn.title = "Als Markdown kopieren (Ctrl+Shift+M)";
        btn.setAttribute('aria-label', 'Als Markdown kopieren');
        btn.type = 'button';

        // Icon SVG (Modernes Clipboard-Icon)
        btn.innerHTML = `
            <span class="aP6jZd">
                <svg class="markdown-copy-icon" fill="currentColor" width="20px" height="20px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
            </span>
        `;

        // Styling
        btn.style.cssText = `
            flex-shrink: 0;
            transition: all 0.2s ease;
        `;

        // Hover-Effekte (passend zu Google)
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = 'rgba(60,64,67,0.08)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = 'transparent';
        });

        // Click-Handler
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const success = copyMarkdown(container);
            if (!success) return;

            // Visuelles Feedback (Icon wechselt zu Häkchen)
            const iconSpan = btn.querySelector('.aP6jZd');
            const originalHTML = iconSpan.innerHTML;

            iconSpan.innerHTML = `
                <svg fill="#188038" width="20px" height="20px" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
            `;

            setTimeout(() => {
                iconSpan.innerHTML = originalHTML;
            }, 2000);
        });

        return btn;
    }

    /**
     * Fügt Copy-Button zur Feedback-Leiste hinzu
     */
    function addCopyButton() {
        // Finde alle AI-Inhaltscontainer
        const contentSelectors = [
            '[jsname="KFl8ub"]',
            '.mZJni.Dn7Fzd',
            'div[data-container-id="main-col"]'
        ];

        let contentContainers = [];
        contentSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (!contentContainers.includes(el)) {
                    contentContainers.push(el);
                }
            });
        });

        contentContainers.forEach((container, index) => {
            const buttonId = `${BUTTON_ID_PREFIX}-${index}`;

            // Prüfe ob Button bereits existiert
            if (document.getElementById(buttonId)) return;

            // Finde Feedback-Leiste (Like/Dislike-Buttons)
            const feedbackBar = findFeedbackBar(container);
            if (!feedbackBar) return;

            // Erstelle und füge Button hinzu
            const btn = createCopyButton(container, index);

            // Füge Button nach den existierenden Buttons ein
            const existingButtons = feedbackBar.querySelectorAll('.ya9Iof:not(.markdown-copy-btn)');
            if (existingButtons.length > 0) {
                const lastButton = existingButtons[existingButtons.length - 1];
                lastButton.parentNode.insertBefore(btn, lastButton.nextSibling);
            } else {
                feedbackBar.appendChild(btn);
            }
        });
    }

    /**
     * Findet die Feedback-Leiste (Like/Dislike-Buttons) in der Nähe des Containers
     */
    function findFeedbackBar(contentContainer) {
        // Suche zuerst nach der direkten Feedback-Container-Klasse
        const directBar = contentContainer.querySelector('.VlQBpc');
        if (directBar) return directBar;

        // Suche in Geschwister-Elementen
        let sibling = contentContainer.nextElementSibling;
        for (let i = 0; i < 5 && sibling; i++) {
            if (sibling.matches && sibling.matches('.VlQBpc')) return sibling;
            const found = sibling.querySelector && sibling.querySelector('.VlQBpc');
            if (found) return found;
            sibling = sibling.nextElementSibling;
        }

        // Suche im Parent-Container
        let parent = contentContainer.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
            const found = parent.querySelector('.VlQBpc');
            if (found) return found;
            parent = parent.parentElement;
        }

        return null;
    }

    // ==================== KEYBOARD SHORTCUT ====================

    /**
     * Keyboard-Shortcut: Ctrl+Shift+M zum Kopieren der ersten AI-Antwort
     */
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+M (oder Cmd+Shift+M auf Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
            e.preventDefault();

            // Finde erste AI-Antwort
            const firstContainer = document.querySelector('[jsname="KFl8ub"], .mZJni.Dn7Fzd, div[data-container-id="main-col"]');
            if (firstContainer) {
                copyMarkdown(firstContainer);
            } else {
                showToast('⚠️ Keine AI-Antwort gefunden', false);
            }
        }
    });

    // ==================== INITIALISIERUNG ====================

    /**
     * Beobachter für dynamisch geladene Inhalte
     */
    const observer = new MutationObserver(() => {
        addCopyButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial-Aufruf
    setTimeout(() => {
        addCopyButton();
    }, 1000);

    console.log('✓ Google AI Markdown Copier v7.0 bereit (Shortcut: Ctrl+Shift+M)');

})();
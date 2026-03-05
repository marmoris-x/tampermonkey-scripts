// ==UserScript==
// @name         Absolute Enable Right Click & Copy
// @namespace    http://tampermonkey.net/
// @version      3.1.0
// @description  Force Enable Right Click, Copy, Text Selection & Remove Copy Protection on included websites only
// @author       marmoris
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://chromewebstore.google.com/detail/absolute-enable-right-cli/jdocbkpgdakpekjlhemmfcncgdjeiika
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let protectionRemoved = false;
    let clickCount = 0;
    let isIncluded = false;

    // Funktion zum Abrufen der Include-Liste
    function getIncludeList() {
        const stored = GM_getValue('includeList', '[]');
        try {
            return JSON.parse(stored);
        } catch (e) {
            return [];
        }
    }

    // Funktion zum Speichern der Include-Liste
    function saveIncludeList(list) {
        GM_setValue('includeList', JSON.stringify(list));
    }

    // Funktion zum Überprüfen, ob die aktuelle Website inkludiert ist
    function isCurrentSiteIncluded() {
        const includeList = getIncludeList();
        const currentDomain = window.location.hostname;
        const currentUrl = window.location.href;

        return includeList.some(pattern => {
            // Exakte Domain-Übereinstimmung
            if (pattern === currentDomain) {
                return true;
            }

            // Subdomain-Übereinstimmung (z.B. *.example.com)
            if (pattern.startsWith('*.')) {
                const baseDomain = pattern.slice(2);
                return currentDomain.endsWith('.' + baseDomain) || currentDomain === baseDomain;
            }

            // URL-Pattern-Übereinstimmung
            try {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(currentUrl) || regex.test(currentDomain);
            } catch (e) {
                return false;
            }
        });
    }

    // Funktion zum Hinzufügen der aktuellen Website zur Include-Liste
    function addCurrentSiteToIncludeList() {
        const includeList = getIncludeList();
        const currentDomain = window.location.hostname;

        if (!includeList.includes(currentDomain)) {
            includeList.push(currentDomain);
            saveIncludeList(includeList);
            GM_notification({
                title: 'Website hinzugefügt',
                text: `${currentDomain} wurde zur Include-Liste hinzugefügt`,
                timeout: 2000
            });
        } else {
            GM_notification({
                title: 'Bereits vorhanden',
                text: `${currentDomain} ist bereits in der Include-Liste`,
                timeout: 2000
            });
        }
    }

    // Funktion zum Entfernen der aktuellen Website aus der Include-Liste
    function removeCurrentSiteFromIncludeList() {
        const includeList = getIncludeList();
        const currentDomain = window.location.hostname;
        const index = includeList.indexOf(currentDomain);

        if (index > -1) {
            includeList.splice(index, 1);
            saveIncludeList(includeList);
            GM_notification({
                title: 'Website entfernt',
                text: `${currentDomain} wurde aus der Include-Liste entfernt`,
                timeout: 2000
            });
        } else {
            GM_notification({
                title: 'Nicht gefunden',
                text: `${currentDomain} ist nicht in der Include-Liste`,
                timeout: 2000
            });
        }
    }

    // Prüfe beim Start, ob die aktuelle Website inkludiert ist
    isIncluded = isCurrentSiteIncluded();

    // Wenn die Website nicht inkludiert ist, beende das Script hier
    if (!isIncluded) {
        console.log('[Right Click Enabler] Current site not in include list, script disabled');

        // Registriere nur die Menü-Befehle für die Verwaltung
        GM_registerMenuCommand('✅ Diese Website aktivieren', () => {
            addCurrentSiteToIncludeList();
            // Seite neu laden, damit das Script aktiv wird
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        });

        GM_registerMenuCommand('📋 Include-Liste anzeigen', () => {
            const includeList = getIncludeList();
            const listText = includeList.length > 0 ? includeList.join('\n') : 'Keine Websites in der Liste';
            GM_notification({
                title: 'Include-Liste',
                text: `Aktive Websites:\n${listText}`,
                timeout: 5000
            });
        });

        return; // Beende das Script hier
    }

    console.log('[Right Click Enabler] Current site is included, script active');

    // CSS für Text-Auswahl
    const enableSelectionCSS = `
        * {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
        }

        [style*="user-select: none"] {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
        }

        body, body * {
            cursor: auto !important;
        }

        ::selection {
            background-color: #338fff !important;
            color: #fff !important;
        }

        ::-moz-selection {
            background-color: #338fff !important;
            color: #fff !important;
        }

        body, html {
            overflow: auto !important;
            height: auto !important;
        }
    `;

    // Hauptfunktion zum Entfernen aller Schutzmaßnahmen
    function removeAllProtections() {
        console.log('[Right Click Enabler] Removing all protections...');

        // CSS hinzufügen
        if (!document.getElementById('right-click-enabler-styles')) {
            const style = document.createElement('style');
            style.id = 'right-click-enabler-styles';
            style.textContent = enableSelectionCSS;
            (document.head || document.documentElement).appendChild(style);
        }

        // Inline-Styles korrigieren
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            if (el.style.userSelect === 'none' ||
                el.style.webkitUserSelect === 'none' ||
                el.style.mozUserSelect === 'none') {
                el.style.setProperty('user-select', 'text', 'important');
                el.style.setProperty('-webkit-user-select', 'text', 'important');
                el.style.setProperty('-moz-user-select', 'text', 'important');
            }

            // Entferne Event-Handler direkt vom Element
            el.oncontextmenu = null;
            el.onselectstart = null;
            el.ondragstart = null;
            el.oncopy = null;
            el.oncut = null;
            el.onpaste = null;
            el.onmousedown = null;
            el.onwheel = null;
            el.onscroll = null;
            el.ontouchmove = null;
        });

        // Script injection für tiefere Änderungen
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                // Globale Event-Handler entfernen
                document.oncontextmenu = null;
                document.onselectstart = null;
                document.ondragstart = null;
                document.onmousedown = null;
                document.onmouseup = null;
                document.oncopy = null;
                document.oncut = null;
                document.onpaste = null;
                document.onwheel = null;
                document.onscroll = null;
                document.ontouchmove = null;

                if (document.body) {
                    document.body.oncontextmenu = null;
                    document.body.onselectstart = null;
                    document.body.ondragstart = null;
                    document.body.onmousedown = null;
                    document.body.onmouseup = null;
                    document.body.oncopy = null;
                    document.body.oncut = null;
                    document.body.onpaste = null;
                    document.body.onwheel = null;
                    document.body.onscroll = null;
                    document.body.ontouchmove = null;
                }

                // Event.preventDefault überschreiben für bestimmte Events
                const originalPreventDefault = Event.prototype.preventDefault;
                Event.prototype.preventDefault = function() {
                    if (['contextmenu', 'copy', 'cut', 'paste', 'selectstart', 'wheel', 'scroll', 'touchmove'].includes(this.type)) {
                        console.log('[Right Click Enabler] Blocked preventDefault for:', this.type);
                        return;
                    }
                    return originalPreventDefault.apply(this, arguments);
                };

                // EventTarget.addEventListener überschreiben
                const originalAddEventListener = EventTarget.prototype.addEventListener;
                EventTarget.prototype.addEventListener = function(type, listener, options) {
                    // Blockiere bestimmte Event-Listener
                    if (['contextmenu', 'copy', 'cut', 'paste', 'selectstart', 'dragstart', 'wheel', 'scroll', 'touchmove'].includes(type)) {
                        console.log('[Right Click Enabler] Blocked addEventListener for:', type);
                        return;
                    }
                    return originalAddEventListener.apply(this, arguments);
                };

                // Entferne alle bestehenden Listener (soweit möglich)
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                    // Clone node to remove all event listeners
                    if (el.parentNode && !['BODY', 'HTML', 'HEAD'].includes(el.tagName)) {
                        try {
                            const newEl = el.cloneNode(true);
                            el.parentNode.replaceChild(newEl, el);
                        } catch(e) {
                            // Some elements can't be cloned
                        }
                    }
                });
            })();
        `;
        document.documentElement.appendChild(script);
        script.remove();

        protectionRemoved = true;
    }

    // Event Listener für Rechtsklick
    document.addEventListener('mousedown', function(e) {
        if (e.button === 2) { // Rechte Maustaste
            clickCount++;

            // Beim ersten Rechtsklick: Schutz entfernen
            if (!protectionRemoved || clickCount === 1) {
                removeAllProtections();

                // Zeige kurze Benachrichtigung
                if (GM_notification) {
                    GM_notification({
                        title: 'Right Click Enabled!',
                        text: 'Copy protection removed',
                        timeout: 1000
                    });
                }
            }

            // Verhindere, dass der ursprüngliche Handler ausgeführt wird
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, true); // Capture phase

    // Spezieller Handler für contextmenu Event
    document.addEventListener('contextmenu', function(e) {
        // Erlaube das Kontextmenü
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Falls protectionRemoved false ist, entferne Schutz
        if (!protectionRemoved) {
            removeAllProtections();
        }

        return true;
    }, true);

    // Überwache Copy/Cut/Paste Events
    ['copy', 'cut', 'paste', 'selectstart', 'wheel', 'scroll', 'touchmove'].forEach(eventType => {
        document.addEventListener(eventType, function(e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            return true;
        }, true);
    });

    // Mutation Observer für dynamisch hinzugefügte Elemente
    const observer = new MutationObserver(function(mutations) {
        if (!protectionRemoved) return;

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    // Korrigiere user-select
                    if (node.style && (node.style.userSelect === 'none' ||
                        node.style.webkitUserSelect === 'none')) {
                        node.style.setProperty('user-select', 'text', 'important');
                        node.style.setProperty('-webkit-user-select', 'text', 'important');
                        node.style.setProperty('-moz-user-select', 'text', 'important');
                    }

                    // Entferne Event-Handler
                    node.oncontextmenu = null;
                    node.onselectstart = null;
                    node.oncopy = null;
                    node.onwheel = null;
                    node.onscroll = null;
                    node.ontouchmove = null;

                    // Prüfe auch Kinder
                    if (node.querySelectorAll) {
                        const children = node.querySelectorAll('*');
                        children.forEach(child => {
                            if (child.style && child.style.userSelect === 'none') {
                                child.style.setProperty('user-select', 'text', 'important');
                            }
                            child.oncontextmenu = null;
                           child.onselectstart = null;
                           child.oncopy = null;
                           child.onwheel = null;
                           child.onscroll = null;
                           child.ontouchmove = null;
                       });
                   }
                }
            });
        });
    });

    // Starte Observer wenn DOM bereit ist
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'oncontextmenu', 'onselectstart', 'oncopy', 'onwheel', 'onscroll', 'ontouchmove']
        });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'oncontextmenu', 'onselectstart', 'oncopy', 'onwheel', 'onscroll', 'ontouchmove']
            });
        });
    }

    // Menü-Befehle für inkludierte Websites
    GM_registerMenuCommand('🔄 Force Remove All Protections', () => {
        protectionRemoved = false;
        removeAllProtections();
        GM_notification({
            title: 'Protections Removed!',
            text: 'All copy protections have been removed',
            timeout: 2000
        });
    });

    GM_registerMenuCommand('📋 Test Copy Function', () => {
        const testText = 'Test: Copy protection removed successfully!';
        const textarea = document.createElement('textarea');
        textarea.value = testText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            GM_notification({
                title: 'Copy Test',
                text: 'Text copied to clipboard!',
                timeout: 1500
            });
        } catch (err) {
            GM_notification({
                title: 'Copy Test Failed',
                text: 'Could not copy to clipboard',
                timeout: 1500
            });
        }

        document.body.removeChild(textarea);
    });

    GM_registerMenuCommand('❌ Diese Website deaktivieren', () => {
        removeCurrentSiteFromIncludeList();
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    });

    GM_registerMenuCommand('📋 Include-Liste anzeigen', () => {
        const includeList = getIncludeList();
        const listText = includeList.length > 0 ? includeList.join('\n') : 'Keine Websites in der Liste';
        GM_notification({
            title: 'Include-Liste',
            text: `Aktive Websites:\n${listText}`,
            timeout: 5000
        });
    });

    GM_registerMenuCommand('🗑️ Include-Liste leeren', () => {
        saveIncludeList([]);
        GM_notification({
            title: 'Liste geleert',
            text: 'Include-Liste wurde geleert',
            timeout: 2000
        });
    });

    // Tastenkombinationen
    document.addEventListener('keydown', function(e) {
        // Strg+Shift+R = Schutz entfernen
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            protectionRemoved = false;
            removeAllProtections();
            GM_notification({
                title: 'Hotkey Activated',
                text: 'Copy protection removed!',
                timeout: 1000
            });
        }

        // Strg+Shift+I = Aktuelle Website zur Include-Liste hinzufügen
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            addCurrentSiteToIncludeList();
        }
    });

    // Automatisch nach 500ms ausführen, falls die Seite Schutz hat
    setTimeout(() => {
        // Prüfe ob Rechtsklick oder Scrollen blockiert ist
        const testEl = document.body || document.documentElement;
        if (testEl && (testEl.oncontextmenu !== null ||
            testEl.onselectstart !== null ||
            window.getComputedStyle(testEl).userSelect === 'none' ||
            window.getComputedStyle(testEl).overflow === 'hidden' ||
            window.getComputedStyle(testEl).overflow === 'clip'
            )) {
            removeAllProtections();
            console.log('[Right Click Enabler] Auto-removed protection on page load');
        }
    }, 500);

    // Dauerhafte Erzwingung des Scrollens, um SPA-Navigation und verzögerte Skripte abzufangen
    setInterval(() => {
        if (document.body && (document.body.style.overflow === 'hidden' || document.body.style.overflow === 'clip')) {
            document.body.style.setProperty('overflow', 'auto', 'important');
        }
        if (document.documentElement && (document.documentElement.style.overflow === 'hidden' || document.documentElement.style.overflow === 'clip')) {
            document.documentElement.style.setProperty('overflow', 'auto', 'important');
        }
    }, 250);

})();
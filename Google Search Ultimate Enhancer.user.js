// ==UserScript==
// @name         Google Search Ultimate Enhancer
// @namespace    http://tampermonkey.net/
// @version      6.1.0
// @description  Wide Layout, No-Scroll, Reddit/YT/Maps Tabs & Open in Maps Button
// @author       Enhanced Edition
// @match        *://www.google.com/search*
// @match        *://www.google.de/search*
// @match        *://www.google.at/search*
// @match        *://www.google.ch/search*
// @match        *://www.google.fr/search*
// @match        *://www.google.co.uk/search*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        tabs: { maps: true, youtube: true, reddit: true },
        features: { cleanLinks: true, mapShortcut: true }
    };

    const Utils = {
        getQuery: () => new URLSearchParams(location.search).get('q') || document.querySelector('input[name="q"]')?.value || '',
        getMapsUrl: (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}`,
        debounce: (fn, wait) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); }; }
    };

    // ==========================================
    // STYLES: WIDE MODE & BUTTON DESIGN
    // ==========================================
    const addStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* 1. Scroll-Pfeile komplett entfernen */
            [aria-label="Weiter"], [aria-label="Next"], g-fab, .g-fab, [role="button"][jsaction*="scroll"] {
                display: none !important;
            }

            /* 2. Container entfesseln (Breitbild) */
            #hdtb-msb, .hdtb-msb, [role="navigation"] {
                max-width: 98vw !important;
                width: auto !important;
                overflow: visible !important;
                flex-wrap: nowrap !important;
            }
            div[role="navigation"] > div {
                max-width: none !important;
                width: auto !important;
                overflow: visible !important;
            }

            /* 3. "Open in Maps" Button Design */
            .gue-map-shortcut {
                position: absolute;
                top: 10px;
                left: 10px;
                color: #3c4043;
                background: rgba(255, 255, 255, 0.9);
                padding: 8px 16px;
                z-index: 10;
                border-radius: 20px;
                text-decoration: none;
                font-family: 'Google Sans', Roboto, Arial, sans-serif;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15);
                transition: all 0.2s;
            }
            .gue-map-shortcut:hover {
                background: #ffffff;
                color: #1a73e8;
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);
    };

    // ==========================================
    // MODULE: NAVIGATION TABS
    // ==========================================
    const NavigationModule = {
        inject() {
            const query = Utils.getQuery();
            if (!query) return;

            const navLists = document.querySelectorAll('[role="navigation"] [role="list"], ul li');
            let targetContainer = null, refItem = null, allTab = null;

            for (const list of navLists) {
                const items = Array.from(list.children);
                if (items.some(i => i.querySelector('a'))) {
                    targetContainer = list;
                    refItem = items.find(i => i.querySelector('a'));
                    allTab = items.find(i => {
                        const t = i.textContent.trim().toLowerCase();
                        return t === 'alle' || t === 'all' || t === 'tout';
                    });
                    if (targetContainer.children.length > 2) break;
                }
            }

            if (!targetContainer || !refItem || targetContainer.querySelector('.gue-injected')) return;

            const createTab = (text, url) => {
                const clone = refItem.cloneNode(true);
                clone.classList.add('gue-injected');
                clone.querySelectorAll('[aria-current], .hdtb-msel').forEach(el => {
                    el.removeAttribute('aria-current');
                    el.classList.remove('hdtb-msel');
                    el.className = el.className.replace(/\b\S*selected\S*\b/g, '');
                });
                const link = clone.querySelector('a');
                if (link) {
                    link.href = url;
                    const walk = document.createTreeWalker(link, NodeFilter.SHOW_TEXT, null, false);
                    let n, textNode;
                    while(n = walk.nextNode()) textNode = n;
                    if(textNode) textNode.textContent = text; else link.textContent = text;
                }
                return clone;
            };

            const insert = (tab) => {
                if(!tab) return;
                if(allTab && allTab.nextSibling) targetContainer.insertBefore(tab, allTab.nextSibling);
                else targetContainer.appendChild(tab);
            };

            if (CONFIG.tabs.reddit) insert(createTab('Reddit', `https://www.google.com/search?q=${encodeURIComponent(query + ' site:reddit.com')}`));
            if (CONFIG.tabs.youtube) insert(createTab('YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`));
            if (CONFIG.tabs.maps && !targetContainer.textContent.toLowerCase().includes('maps')) {
                insert(createTab('Maps', Utils.getMapsUrl(query)));
            }
        }
    };

    // ==========================================
    // MODULE: MAP SHORTCUT (Button auf der Karte)
    // ==========================================
    const MapsModule = {
        run() {
            const query = Utils.getQuery();
            if (!query) return;
            const mapsUrl = Utils.getMapsUrl(query);

            // Fügt NUR den Button oben links auf das Karten-Modul ein
            const sodP3b = document.querySelector('.SodP3b');
            if (sodP3b && !sodP3b.querySelector('.gue-map-shortcut')) {
                // Prüfen ob es ein Karten-Element ist (anhand spezifischer Google-Klassen)
                if (sodP3b.querySelector('div.SBzq0c.ZGYHDd, div.zMVLkf.jdQ9hc')) {
                    const btn = document.createElement('a');
                    btn.className = 'gue-map-shortcut';
                    btn.textContent = 'In Maps öffnen';
                    btn.href = mapsUrl;
                    btn.target = "_blank";
                    sodP3b.appendChild(btn);
                }
            }
        }
    };

    // ==========================================
    // MODULE: LINK CLEANER
    // ==========================================
    const CleanerModule = {
        run() {
            document.querySelectorAll('a[href^="http"]:not(.gue-clean)').forEach(l => {
                l.removeAttribute('onmousedown');
                l.removeAttribute('ping');
                l.classList.add('gue-clean');
            });
        }
    };

    // ==========================================
    // MAIN CONTROLLER
    // ==========================================
    const Controller = {
        init() {
            addStyles();
            this.run();
            // Observer für dynamisches Laden
            new MutationObserver(Utils.debounce(() => this.run(), 200))
                .observe(document.body, { childList: true, subtree: true });
        },
        run() {
            NavigationModule.inject();
            if (CONFIG.features.mapShortcut) MapsModule.run();
            if (CONFIG.features.cleanLinks) CleanerModule.run();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Controller.init());
    } else {
        Controller.init();
    }
})();
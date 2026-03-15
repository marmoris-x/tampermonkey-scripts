// ==UserScript==
// @name         Google Search Enhanced
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Add Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner.
// @author       marmoris
// @match        *://www.google.com/search*
// @match        *://www.google.de/search*
// @match        *://www.google.at/search*
// @match        *://www.google.ch/search*
// @match        *://www.google.fr/search*
// @match        *://www.google.co.uk/search*
// @match        *://www.google.ca/search*
// @match        *://www.google.com.au/search*
// @match        *://encrypted.google.com/search*
// @grant        none
// @run-at       document-end
// @noframes
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Google%20Search%20Enhanced.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Google%20Search%20Enhanced.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Skip image search
    if (location.href.includes('tbm=isch')) return;

    const CONFIG = {
        tabs:     { maps: true, youtube: true, reddit: true },
        features: { cleanLinks: true, mapShortcut: true }
    };

    // ==========================================
    // UTILS
    // ==========================================
    const Utils = {
        getQuery: () =>
            new URLSearchParams(location.search).get('q') ||
            document.querySelector('input[name="q"]')?.value || '',

        getMapsUrl: q => `https://maps.google.com/maps?q=${encodeURIComponent(q)}`,

        debounce(fn, ms) {
            let t;
            return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
        }
    };

    // ==========================================
    // STYLES
    // ==========================================
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* "Open in Maps" button on the embedded map widget */
            .gss-map-btn {
                position: absolute;
                top: 10px;
                left: 10px;
                color: #3c4043;
                background: rgba(255, 255, 255, 0.92);
                padding: 7px 15px;
                z-index: 10;
                border-radius: 20px;
                text-decoration: none;
                font-family: 'Google Sans', Roboto, Arial, sans-serif;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15);
                transition: background 0.15s, color 0.15s, transform 0.15s;
            }
            .gss-map-btn:hover {
                background: #fff;
                color: #1a73e8;
                transform: scale(1.04);
            }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // MODULE: NAVIGATION TABS
    // Current Google structure (as of 2025):
    //   div[role="list"]  (.beZ0tf.O1uzAe)
    //     div[role="listitem"]
    //       a.C6AK7c
    //         div.mXwfNd [aria-current="page"] [selected]  ← active tab
    //           span.R1QWuf  ← tab label
    //     ...
    //     div[role="listitem"] [jscontroller]  ← "Mehr" dropdown (last visible item)
    // ==========================================
    const NavigationModule = {
        inject() {
            const query = Utils.getQuery();
            if (!query) return;

            // Find the search tab list — the one that contains "Alle" / "All" / "Tout"
            const lists = document.querySelectorAll('div[role="list"]');
            let list = null;
            for (const l of lists) {
                const labels = [...l.querySelectorAll('span.R1QWuf')].map(s => s.textContent.trim().toLowerCase());
                if (labels.some(t => t === 'alle' || t === 'all' || t === 'tout')) {
                    list = l;
                    break;
                }
            }
            if (!list || list.querySelector('.gss-tab')) return;

            // Reference: first listitem with a real href link (not the active disabled "Alle")
            const refItem = [...list.querySelectorAll('div[role="listitem"]')]
                .find(el => el.querySelector('a.C6AK7c[href]'));
            if (!refItem) return;

            // Insert before the "Mehr" dropdown (has jscontroller attr) to stay in the main bar
            const mehrItem = [...list.querySelectorAll('div[role="listitem"]')]
                .find(el => el.hasAttribute('jscontroller'));

            const createTab = (label, url) => {
                const item = refItem.cloneNode(true);
                item.classList.add('gss-tab');

                // Clear active/selected state
                const inner = item.querySelector('.mXwfNd, [jsname="xBNgKe"]');
                if (inner) {
                    inner.removeAttribute('aria-current');
                    inner.removeAttribute('selected');
                }

                // Set link
                const link = item.querySelector('a.C6AK7c');
                if (link) {
                    link.href = url;
                    link.removeAttribute('aria-disabled');
                    link.removeAttribute('jsname');   // prevent Google from hijacking clicks
                    link.removeAttribute('jsaction');
                }

                // Set label text
                const span = item.querySelector('span.R1QWuf');
                if (span) span.textContent = label;

                return item;
            };

            const insert = tab => {
                if (!tab) return;
                if (mehrItem) list.insertBefore(tab, mehrItem);
                else list.appendChild(tab);
            };

            const q = encodeURIComponent(query);
            if (CONFIG.tabs.reddit)  insert(createTab('Reddit',  `https://www.google.com/search?q=${encodeURIComponent(query + ' site:reddit.com')}`));
            if (CONFIG.tabs.youtube) insert(createTab('YouTube', `https://www.youtube.com/results?search_query=${q}`));
            if (CONFIG.tabs.maps) {
                const existingLabels = [...list.querySelectorAll('span.R1QWuf')].map(s => s.textContent.toLowerCase());
                if (!existingLabels.some(t => t.includes('maps') || t.includes('karten'))) {
                    insert(createTab('Maps', Utils.getMapsUrl(query)));
                }
            }
        }
    };

    // ==========================================
    // MODULE: MAPS SHORTCUT BUTTON
    // ==========================================
    const MapsModule = {
        run() {
            const query = Utils.getQuery();
            if (!query) return;

            const panel = document.querySelector('.SodP3b');
            if (!panel || panel.querySelector('.gss-map-btn')) return;
            if (!panel.querySelector('div.SBzq0c.ZGYHDd, div.zMVLkf.jdQ9hc')) return;

            const btn = document.createElement('a');
            btn.className   = 'gss-map-btn';
            btn.textContent = 'Open in Maps';
            btn.href        = Utils.getMapsUrl(query);
            btn.target      = '_blank';
            btn.rel         = 'noopener noreferrer';
            panel.appendChild(btn);
        }
    };

    // ==========================================
    // MODULE: LINK CLEANER
    // Strips Google's click-tracking attributes from result links
    // ==========================================
    const CleanerModule = {
        run() {
            document.querySelectorAll('a[href^="http"]:not(.gss-clean)').forEach(l => {
                l.removeAttribute('onmousedown');
                l.removeAttribute('ping');
                l.classList.add('gss-clean');
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
            new MutationObserver(Utils.debounce(() => this.run(), 200))
                .observe(document.body, { childList: true, subtree: true });
        },
        run() {
            NavigationModule.inject();
            if (CONFIG.features.mapShortcut) MapsModule.run();
            if (CONFIG.features.cleanLinks)  CleanerModule.run();
        }
    };

    Controller.init();
})();

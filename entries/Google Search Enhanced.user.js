// ==UserScript==
// @name         Google Search Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.4.1
// @description  Add Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner.
// @author       marmoris-x
// @match        *://www.google.com/search*
// @match        *://www.google.de/search*
// @match        *://www.google.at/search*
// @match        *://www.google.ch/search*
// @match        *://www.google.fr/search*
// @match        *://www.google.co.uk/search*
// @match        *://www.google.ca/search*
// @match        *://www.google.com.au/search*
// @match        *://www.google.es/search*
// @match        *://www.google.it/search*
// @match        *://www.google.nl/search*
// @match        *://www.google.pl/search*
// @match        *://www.google.se/search*
// @match        *://www.google.no/search*
// @match        *://www.google.dk/search*
// @match        *://www.google.fi/search*
// @match        *://www.google.be/search*
// @match        *://www.google.pt/search*
// @match        *://www.google.ie/search*
// @match        *://www.google.co.jp/search*
// @match        *://www.google.co.in/search*
// @match        *://www.google.com.br/search*
// @match        *://www.google.com.mx/search*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        window.onurlchange
// @sandbox      raw
// @noframes
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20Search%20Enhanced.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Google%20Search%20Enhanced.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

'use strict';

const CONFIG = {
    tabs:     { maps: true, youtube: true, reddit: true, aimode: true },
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
};

// ==========================================
// STYLES
// ==========================================
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
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
// ==========================================
const NavigationModule = {
    TAB_LABELS: ['alle', 'all', 'tout', 'todos', 'tutto', 'wszystko'],

    inject(query) {
        if (!query) return false;

        const lists = document.querySelectorAll('div[role="list"]');
        let list = null;
        for (const l of lists) {
            const labels = [...l.querySelectorAll('span.R1QWuf, span[class*="R1"]')].map(s => s.textContent.trim().toLowerCase());
            if (labels.some(t => this.TAB_LABELS.includes(t))) {
                list = l;
                break;
            }
        }
        if (!list || list.querySelector('.gss-tab')) return false;

        const listItems = [...list.querySelectorAll('div[role="listitem"]')];
        const refItem = listItems.find(el => el.querySelector('a.C6AK7c[href]'));
        if (!refItem) return false;

        const mehrItem = listItems.find(el => el.hasAttribute('jscontroller'));

        const createTab = (label, url) => {
            const item = refItem.cloneNode(true);
            item.classList.add('gss-tab');
            // Strip Google event-handler attributes from the root element
            item.removeAttribute('jsaction');
            item.removeAttribute('jscontroller');
            item.removeAttribute('jsname');
            item.removeAttribute('jsmodel');
            item.removeAttribute('data-ved');
            item.removeAttribute('data-hveid');

            const inner = item.querySelector('.mXwfNd, [jsname="xBNgKe"]');
            if (inner) {
                inner.removeAttribute('aria-current');
                inner.removeAttribute('selected');
            }

            const link = item.querySelector('a.C6AK7c');
            if (link) {
                link.href = url;
                link.removeAttribute('aria-disabled');
                link.removeAttribute('jsname');
                link.removeAttribute('jsaction');
            }

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
        if (CONFIG.tabs.aimode) {
            const existingLabels = [...list.querySelectorAll('span.R1QWuf')].map(s => s.textContent.toLowerCase());
            if (!existingLabels.some(t => t === 'ki‑modus' || t === 'ki-modus' || t === 'ai mode')) {
                const tab = createTab('KI‑Modus', `https://www.google.com/search?q=${q}&udm=50`);
                if (tab) list.insertBefore(tab, list.firstElementChild);
            }
        }
        if (CONFIG.tabs.reddit)  insert(createTab('Reddit', `https://www.google.com/search?q=${q}+site%3Areddit.com`));
        if (CONFIG.tabs.youtube) insert(createTab('YouTube', `https://www.youtube.com/results?search_query=${q}`));
        if (CONFIG.tabs.maps) {
            const existingLabels = [...list.querySelectorAll('span.R1QWuf')].map(s => s.textContent.toLowerCase());
            if (!existingLabels.some(t => t.includes('maps') || t.includes('karten'))) {
                insert(createTab('Maps', Utils.getMapsUrl(query)));
            }
        }

        return true;
    }
};

// ==========================================
// MODULE: MAPS SHORTCUT BUTTON
// ==========================================
const MapsModule = {
    run(query) {
        if (!query) return false;

        const panel = document.querySelector('.SodP3b');
        if (!panel || panel.querySelector('.gss-map-btn')) return false;
        if (!panel.querySelector('div.SBzq0c.ZGYHDd, div.zMVLkf.jdQ9hc')) return false;

        const btn = document.createElement('a');
        btn.className   = 'gss-map-btn';
        btn.textContent = 'Open in Maps';
        btn.href        = Utils.getMapsUrl(query);
        btn.target      = '_blank';
        btn.rel         = 'noopener noreferrer';
        panel.appendChild(btn);

        return true;
    }
};

// ==========================================
// MODULE: LINK CLEANER
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
    _observer: null,

    init() {
        try {
            addStyles();
            this.run();

            let ready = false;
            this._observer = observeMutations(() => {
                if (ready) return;
                try {
                    const done = this.run();
                    if (done) {
                        ready = true;
                        this._observer.disconnect();
                        this._observer = null;
                    }
                } catch (e) {
                    // silently skip — page may not be fully loaded
                }
            }, document.body);

            if (window.onurlchange === null) {
                window.addEventListener('urlchange', () => this.run());
            }
        } catch (e) {
            // fail gracefully — nothing critical if the enhancement doesn't load
        }
    },

    run() {
        try {
            if (location.href.includes('tbm=isch')) return true;

            const query = Utils.getQuery();
            if (!query) return false;

            const tabsDone = NavigationModule.inject(query);
            if (CONFIG.features.mapShortcut) MapsModule.run(query);
            if (CONFIG.features.cleanLinks)  CleanerModule.run();

            return tabsDone;
        } catch (e) {
            return false;
        }
    }
};

function observeMutations(callback, root) {
    const observer = new MutationObserver(function (mutations) {
        for (let m = 0; m < mutations.length; m++) {
            const nodes = mutations[m].addedNodes;
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].nodeType === Node.ELEMENT_NODE) {
                    callback(nodes[i], observer);
                    return;
                }
            }
        }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
}

Controller.init();

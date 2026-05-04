// ==UserScript==
// @name         Reddit Content Unlocker
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @match        https://www.reddit.com/*
// @match        https://sh.reddit.com/*
// @grant        GM_addElement
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @version      2.6.0
// @author       marmoris-x
// @description  Removes NSFW popup, un-blurs content, and makes website accessible
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

import { createLogger } from './src/shared/logging-utils.js';
import { observeMutations, debounce } from './src/shared/dom-utils.js';

const log = createLogger('Reddit Content Unlocker');

    // --- State ---
    let { state = true, nsfw = true, spoiler = false } = GM_getValue('states', false);
    let _menuDone = false;

    // --- attachShadow hook ---
    // Inject reveal CSS the instant Reddit attaches a shadow root to shreddit-blurred-container.
    // This eliminates the querySelectorAll('*') scan on every observer tick.
    const _origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(init) {
        const sr = _origAttachShadow.call(this, init);
        if (this.tagName?.toLowerCase() === 'shreddit-blurred-container') {
            const s = document.createElement('style');
            s.id = 'u-reveal';
            s.textContent =
                'slot[name="blurred"]{display:none!important}' +
                'slot[name="revealed"]{display:block!important;opacity:1!important;height:100%!important}' +
                'div.prompt{display:none!important}';
            sr.appendChild(s);
        }
        return sr;
    };

    // --- Inline CSS ---
    const GLOBAL_CSS = `
        faceplate-modal[blocking], faceplate-modal#blocking-modal,
        faceplate-dialog[id*="nsfw"], faceplate-dialog[id*="qr"],
        div.prompt, xpromo-nsfw-blocking-container a[slot="view-in-app-button"],
        div[style*="backdrop-filter: blur"] { display: none !important; }
        img { filter: none !important; }
        [slot="blurred"] img { opacity: 1 !important; filter: none !important; }
    `;

    const MENU_CSS = `
        #menu-unblur {
            position: relative; display: flex; align-items: center;
            margin: 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; z-index: 9999;
        }
        #popup-toggle {
            cursor: pointer; padding: 4px 10px; border-radius: 20px; font-size: 13px;
            font-weight: 600; color: #fff; background: #ff4500; user-select: none;
            white-space: nowrap; transition: background .2s;
        }
        #popup-toggle:hover, #menu-unblur.active #popup-toggle { background: #e03d00; }
        #status-container {
            display: none; position: absolute; top: calc(100% + 6px); right: 0;
            background: #1a1a1b; border: 1px solid #343536; border-radius: 8px;
            padding: 10px 14px; min-width: 180px; box-shadow: 0 4px 16px rgba(0,0,0,.5); color: #d7dadc;
        }
        #menu-unblur.active #status-container { display: block; }
        #container-toggle { display: flex; justify-content: center; margin-bottom: 10px; }
        #container-toggle label { cursor: pointer; }
        #container-toggle svg { width: 28px; height: 28px; fill: #ff4500; transition: fill .2s; }
        #container-toggle input { display: none; }
        #container-toggle input:not(:checked) + svg { fill: #818384; }
        #selected-ops { display: flex; flex-direction: column; gap: 8px; }
        #selected-ops label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; }
        #selected-ops input[type="checkbox"] { display: none; }
        .slider {
            position: relative; display: inline-block; width: 34px; height: 18px;
            background: #343536; border-radius: 18px; flex-shrink: 0; transition: background .2s;
        }
        .slider::after {
            content: ''; position: absolute; width: 14px; height: 14px; background: #fff;
            border-radius: 50%; top: 2px; left: 2px; transition: transform .2s;
        }
        input[type="checkbox"]:checked + .slider { background: #ff4500; }
        input[type="checkbox"]:checked + .slider::after { transform: translateX(16px); }
        .slider-label { color: #d7dadc; }
    `;

    // --- Helpers ---
    /**
     * Removes all elements matching the given CSS selector.
     * @param {string} s - CSS selector string
     */
    const removeAll  = s => document.querySelectorAll(s).forEach(e => e.remove());
    /**
     * Force-reveals an element by setting display, opacity, filter, and height to important values.
     * @param {HTMLElement} el - The element to reveal
     */
    const reveal     = el => {
        el.style.setProperty('display',  'block', 'important');
        el.style.setProperty('opacity',  '1',     'important');
        el.style.setProperty('filter',   'none',  'important');
        el.style.setProperty('height',   '100%',  'important');
    };
    /**
     * Unblurs all images within a root element by removing opacity classes and setting inline styles.
     * Marks processed images with data-unblurred attribute.
     * @param {HTMLElement} root - The root element to scan
     */
    const unblurImgs = root => root.querySelectorAll('img:not([data-unblurred])').forEach(img => {
        img.setAttribute('data-unblurred', '1');
        img.classList.remove('opacity-30', 'opacity-50');
        img.style.setProperty('opacity', '1',    'important');
        img.style.setProperty('filter',  'none', 'important');
    });

    /**
     * Injects the global CSS that hides blocking modals and removes blur from images.
     * Only runs once — subsequent calls are no-ops.
     */
    let _globalCSSInjected = false;
    function injectGlobalCSS() {
        if (_globalCSSInjected) return;
        _globalCSSInjected = true;
        const s = document.createElement('style');
        s.id = 'unblur-css'; s.textContent = GLOBAL_CSS;
        document.head.appendChild(s);
    }

    /**
     * Removes blur from images that have URL-based blur parameters or inline blur styles.
     * Rewrites image src to strip blur= and format=pjpg parameters.
     */
    function removeImageBlur() {
        document.querySelectorAll('img[src*="blur="]:not([data-unblurred]), img[style*="blur"]:not([data-unblurred])').forEach(img => {
            img.setAttribute('data-unblurred', '1');
            if (img.src.includes('blur=')) {
                const fixed = img.src.replace(/[?&]blur=\d+/g,'').replace(/[?&]format=pjpg/g,'').replace(/&&/g,'&').replace(/\?&/,'?');
                if (fixed !== img.src) img.src = fixed;
            }
            const st = img.getAttribute('style') || '';
            if (st.includes('blur')) img.setAttribute('style', st.replace(/filter:\s*blur\([^)]+\)/g, ''));
        });
    }

    // --- Main callback ---
    /**
     * Main callback — removes blocking elements, un-blurs images and NSFW/spoiler containers.
     * Called by the MutationObserver and on initial load.
     */
    function callback() {
        if (!_menuDone) { _menuDone = true; initMenu(); }
        if (!state) return;

        injectGlobalCSS();

        removeAll('faceplate-modal[blocking], faceplate-modal#blocking-modal');
        removeAll('faceplate-dialog#nsfw-qr-dialog, faceplate-dialog[id*="nsfw"], faceplate-dialog[id*="qr"]');
        removeAll('div.thumbnail-shadow, .bg-media-background, div.prompt');
        removeAll('[slot="view-in-app-button"]');
        document.querySelectorAll('[style*="backdrop-filter"]').forEach(el => { if (el.style.position === 'fixed') el.remove(); });
        document.querySelectorAll('[style*="color-scrim"]').forEach(el => { el.style.removeProperty('box-shadow'); el.removeAttribute('open'); });

        [...document.getElementsByTagName('shreddit-async-loader')]
            .filter(e => e.getAttribute('bundlename')?.includes('nsfw'))
            .forEach(e => e.remove());

        // Re-inject shadow CSS into any shreddit-blurred-container whose shadow root exists
        // (handles SPA navigation and components that re-render after the attachShadow hook)
        [...document.getElementsByTagName('shreddit-blurred-container')].forEach(el => {
            const sr = el.shadowRoot;
            if (!sr || sr.querySelector('#u-reveal')) return;
            const s = document.createElement('style');
            s.id = 'u-reveal';
            s.textContent = 'slot[name="blurred"]{display:none!important}slot[name="revealed"]{display:block!important;opacity:1!important;height:100%!important}div.prompt{display:none!important}';
            sr.appendChild(s);
        });

        document.querySelectorAll('[is-nsfw-blocked]').forEach(e => e.removeAttribute('is-nsfw-blocked'));
        document.querySelectorAll('[blurred]').forEach(e => e.removeAttribute('blurred'));

        [...document.getElementsByTagName('shreddit-blurred-container')]
            .filter(e => { const r = e.getAttribute('reason'); return (r === 'nsfw' && nsfw) || (r === 'spoiler' && spoiler); })
            .forEach(blurred => {
                blurred.removeAttribute('blurred');
                blurred.setAttribute('clicked', '');
                try { blurred.click(); } catch {}
                try { blurred.firstElementChild?.click(); } catch {}
                const blurredSlot  = blurred.querySelector('[slot="blurred"]');
                const revealedSlot = blurred.querySelector('[slot="revealed"]');
                if (revealedSlot) { blurredSlot?.style.setProperty('display','none','important'); reveal(revealedSlot); }
                else if (blurredSlot) { reveal(blurredSlot); unblurImgs(blurredSlot); }
            });

        document.querySelectorAll('shreddit-aspect-ratio [slot="blurred"]').forEach(el => { reveal(el); unblurImgs(el); });

        removeImageBlur();
        document.body.style.removeProperty('overflow');
        document.documentElement.style.removeProperty('overflow');
    }

    // --- Menu ---
    /**
     * Initializes the in-page "Unblur" menu with toggle controls for NSFW and spoiler unblurring.
     * Persists state via GM_setValue.
     */
    function initMenu() {
        const menuStyle = document.createElement('style');
        menuStyle.textContent = MENU_CSS;
        document.head.appendChild(menuStyle);

        // Flexible selector — fallback if header.v2 disappears in an A/B test
        const navTarget = document.querySelector('header.v2 > nav')
            || document.querySelector('header nav')
            || document.querySelector('header')
            || document.body;

        const menu = GM_addElement(navTarget, 'div', { id: 'menu-unblur' });

        menu.addEventListener('click', e => {
            if (e.target.id === 'menu' || e.target.id === 'popup-toggle') menu.classList.toggle('active');
        });

        menu.innerHTML = '<div id="popup-toggle">Unblur</div><form id="status-container"><div id="status"></div><div id="container-toggle"><label for="toggle"><input id="toggle" name="toggle" type="checkbox"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V3ZM8.6092 5.8744C9.09211 5.60643 9.26636 4.99771 8.99839 4.5148C8.73042 4.03188 8.12171 3.85763 7.63879 4.1256C4.87453 5.65948 3 8.61014 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 8.66747 19.1882 5.75928 16.5007 4.20465C16.0227 3.92811 15.4109 4.09147 15.1344 4.56953C14.8579 5.04759 15.0212 5.65932 15.4993 5.93586C17.5942 7.14771 19 9.41027 19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 9.3658 6.45462 7.06997 8.6092 5.8744Z"></path></svg></label></div><div id="selected-ops"><label for="toggle-nsfw"><input type="checkbox" name="toggle-nsfw" id="toggle-nsfw"><span class="slider"></span><span class="slider-label">Unblur NSFW</span></label><label for="toggle-spoiler"><input type="checkbox" name="toggle-spoiler" id="toggle-spoiler"><span class="slider"></span><span class="slider-label">Unblur Spoiler</span></label></div></form>';

        const toggle        = document.getElementById('toggle'),
              toggleNSFW    = document.getElementById('toggle-nsfw'),
              toggleSpoiler = document.getElementById('toggle-spoiler'),
              form          = document.getElementById('status-container');

        toggle.checked        = state;
        toggleNSFW.checked    = nsfw;
        toggleSpoiler.checked = spoiler;

        form.addEventListener('change', () => {
            state   = toggle.checked;
            nsfw    = toggleNSFW.checked;
            spoiler = toggleSpoiler.checked;
            GM_setValue('states', { state, nsfw, spoiler });
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('#menu-unblur') && menu.classList.contains('active')) menu.classList.remove('active');
            if (e.target.closest('media-telemetry-observer')) e.preventDefault();
        });
    }

    // --- Observer (debounced, childList only) ---
    const observer = observeMutations(debounce(callback, 150), document);

    // Disconnect if not shreddit after 8s
    setTimeout(() => {
        if (!document.querySelector('shreddit-app')) { observer.disconnect(); }
    }, 8000);

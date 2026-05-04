// ==UserScript==
// @name            Reddit Content Unlocker
// @namespace       https://greasyfork.org/users/821661
// @match           https://www.reddit.com/*
// @match           https://sh.reddit.com/*
// @grant           GM_addElement
// @grant           GM_setValue
// @grant           GM_getValue
// @run-at          document-start
// @noframes
// @version         2.5.2
// @author          hdyzen (modified)
// @description     Removes NSFW popup, un-blurs content, and makes website accessible
// @icon        data:image/png;base64,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
// @license         MIT
// @homepage        https://github.com/zenstorage/Reddit-NSFW-Unblur
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Reddit%20Content%20Unlocker.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Reddit%20Content%20Unlocker.user.js
// ==/UserScript==

'use strict';

// --- State ---
let { state = true, nsfw = true, spoiler = false } = GM_getValue('states', false);
let _t = null, _menuDone = false;

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
const removeAll  = s => document.querySelectorAll(s).forEach(e => e.remove());
const reveal     = el => {
    el.style.setProperty('display',  'block', 'important');
    el.style.setProperty('opacity',  '1',     'important');
    el.style.setProperty('filter',   'none',  'important');
    el.style.setProperty('height',   '100%',  'important');
};
const unblurImgs = root => root.querySelectorAll('img:not([data-unblurred])').forEach(img => {
    img.setAttribute('data-unblurred', '1');
    img.classList.remove('opacity-30', 'opacity-50');
    img.style.setProperty('opacity', '1',    'important');
    img.style.setProperty('filter',  'none', 'important');
});

let _globalCSSInjected = false;
function injectGlobalCSS() {
    if (_globalCSSInjected) return;
    _globalCSSInjected = true;
    const s = document.createElement('style');
    s.id = 'unblur-css'; s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
}

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

    menu.innerHTML = `<div id="popup-toggle">Unblur</div><form id="status-container"><div id="status"></div><div id="container-toggle"><label for="toggle"><input id="toggle" name="toggle" type="checkbox"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V3ZM8.6092 5.8744C9.09211 5.60643 9.26636 4.99771 8.99839 4.5148C8.73042 4.03188 8.12171 3.85763 7.63879 4.1256C4.87453 5.65948 3 8.61014 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 8.66747 19.1882 5.75928 16.5007 4.20465C16.0227 3.92811 15.4109 4.09147 15.1344 4.56953C14.8579 5.04759 15.0212 5.65932 15.4993 5.93586C17.5942 7.14771 19 9.41027 19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 9.3658 6.45462 7.06997 8.6092 5.8744Z"></path></svg></label></div><div id="selected-ops"><label for="toggle-nsfw"><input type="checkbox" name="toggle-nsfw" id="toggle-nsfw"><span class="slider"></span><span class="slider-label">Unblur NSFW</span></label><label for="toggle-spoiler"><input type="checkbox" name="toggle-spoiler" id="toggle-spoiler"><span class="slider"></span><span class="slider-label">Unblur Spoiler</span></label></div></form>`;

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

// --- Observer (childList only — attributes:true removed to prevent self-triggering loops) ---
const observer = new MutationObserver(() => { clearTimeout(_t); _t = setTimeout(callback, 150); });
observer.observe(document, { childList: true, subtree: true });

// Disconnect if not shreddit after 8s
setTimeout(() => {
    if (!document.querySelector('shreddit-app')) { clearTimeout(_t); observer.disconnect(); }
}, 8000);

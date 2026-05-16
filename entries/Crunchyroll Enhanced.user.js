// ==UserScript==
// @name         Crunchyroll Enhanced
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.2.2
// @description  Sidebar (page-push) with multi-filter & sort for Crunchyroll browse — auto-scan, retry, export/clipboard, data-only filter
// @author       marmoris-x
// @icon         https://www.google.com/s2/favicons?sz=32&domain=crunchyroll.com
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @match        https://*.crunchyroll.com/*
// @grant        GM_addStyle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        window.onurlchange
// @run-at       document-idle
// @sandbox      raw
// @noframes
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Crunchyroll%20Enhanced.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Crunchyroll%20Enhanced.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

'use strict';

import { init } from '../src/crunchyroll-enhanced/app.js';
import { unlockPiP } from '../src/crunchyroll-enhanced/pip.js';

// ═══════════════════════════════════════════════════════════════════════════
// PiP Unlock — nur auf Watch-Seiten aktiv
// ═══════════════════════════════════════════════════════════════════════════

unlockPiP();

// ═══════════════════════════════════════════════════════════════════════════
// Bootstrap — nur auf /videos/popular
// ═══════════════════════════════════════════════════════════════════════════

if (/\/videos\/popular/.test(location.pathname)) {
  // ── Page-level styles (Badge-Overlays, Sidebar-Transition) ──
  GM_addStyle([
    'html { transition: margin-right 0.32s cubic-bezier(0.4,0,0.2,1) !important; }',

    '.cr-overlay { position:absolute; top:5px; right:5px; z-index:3; display:flex; flex-direction:column; gap:2px; pointer-events:none; }',
    '.cr-badge { display:inline-block; padding:2px 5px; border-radius:3px; font-size:9px; font-weight:700; line-height:1.4; white-space:nowrap; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); }',
    '.cr-b-rating   { background:rgba(230,140,10,0.88); color:#fff; }',
    '.cr-b-votes    { background:rgba(130,60,160,0.88); color:#fff; }',
    '.cr-b-seasons  { background:rgba(30,150,80,0.88);  color:#fff; }',
    '.cr-b-episodes { background:rgba(40,120,200,0.88); color:#fff; }',
    '.cr-b-sub      { background:rgba(20,50,80,0.9);    color:#6bb5e0; }',
    '.cr-b-dub      { background:rgba(20,50,80,0.9);    color:#9ecfec; }',
    '.cr-b-wl       { background:rgba(200,40,40,0.85);  color:#fff; }',

    '.cr-hidden { display:none !important; }',

    '@keyframes cr-spin { to { transform: rotate(360deg); } }',
    '@keyframes cr-new-card { from { outline: 2px solid #f47521; } to { outline: 2px solid transparent; } }',
    '.cr-new-card { animation: cr-new-card 1.2s ease-out forwards; }'
  ].join('\n'));

  // ── App starten ──
  async function bootstrap() {
    try {
      await init({ sidebarWidth: 360 });
    } catch (err) {
      console.error('[Crunchyroll Enhanced] Bootstrap failed', err);
    }
  }
  bootstrap();
}

// ═══════════════════════════════════════════════════════════════════════════
// SPA Navigation — init bei Navigation zu /videos/popular
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window.onurlchange === 'function') {
  window.addEventListener('urlchange', async () => {
    if (/\/videos\/popular/.test(location.pathname)) {
      try {
        await init({ sidebarWidth: 360 });
      } catch (err) {
        console.error('[Crunchyroll Enhanced] SPA bootstrap failed', err);
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Manuelles Triggern via Tampermonkey-Menü
// ═══════════════════════════════════════════════════════════════════════════

if (typeof GM.registerMenuCommand === 'function') {
  GM.registerMenuCommand('🔍 Crunchyroll Enhanced Scan', () => {
    if (/\/videos\/popular/.test(location.pathname)) {
      init({ sidebarWidth: 360 });
    }
  });
}

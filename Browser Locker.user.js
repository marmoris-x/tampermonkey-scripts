// ==UserScript==
// @name         Browser Locker
// @namespace    https://github.com/zimocode/blocker
// @version      2.0.0
// @description  Password-lock your browser. Press Ctrl+Shift+L to lock.
// @author       Converted from Chrome Extension by zimocode
// @match        *://*/*
// @exclude      about:*
// @exclude      chrome:*
// @exclude      moz-extension:*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA2NCA2NCc+PHJlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyByeD0nMTQnIGZpbGw9JyM1Yzc0ZTgnLz48cGF0aCBkPSdNMzIgMTRhMTIgMTIgMCAwMC0xMiAxMnY0aC0yYTQgNCAwIDAwLTQgNHYxNmE0IDQgMCAwMDQgNGgyOGE0IDQgMCAwMDQtNFYzNGE0IDQgMCAwMC00LTRoLTJ2LTRhMTIgMTIgMCAwMC0xMi0xMnptMCA2YTYgNiAwIDAxNiA2djRIMjZ2LTRhNiA2IDAgMDE2LTZ6bTAgMTZhNCA0IDAgMTEwIDggNCA0IDAgMDEwLTh6JyBmaWxsPScjZmZmJy8+PC9zdmc+
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  //  PBKDF2 / AES-GCM  (identical to original Chrome extension)
  // ============================================================
  const ITERATIONS = 102400;
  const SALT_LEN   = 64;

  const hex2buf = hex => {
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
    return b.buffer;
  };
  const buf2hex = buf =>
    [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

  const deriveKey = async (password, salt) => {
    const raw = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  };

  const pbkdf2 = {
    async encrypt(content) {
      if (!content) return null;
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
      const key  = await deriveKey(content, salt);
      const iv   = crypto.getRandomValues(new Uint8Array(12));
      const enc  = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode(content)
      );
      return {
        data: buf2hex(new Uint8Array([...iv, ...new Uint8Array(enc)]).buffer),
        salt: buf2hex(salt.buffer)
      };
    },
    async decrypt(dataHex, password, saltHex) {
      if (!dataHex || !saltHex || saltHex.length % 2 !== 0) return false;
      try {
        const key   = await deriveKey(password, hex2buf(saltHex));
        const bytes = new Uint8Array(hex2buf(dataHex));
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
        return true;
      } catch { return false; }
    }
  };

  // ============================================================
  //  Storage helpers
  // ============================================================
  const getPasswd = ()    => GM_getValue('bl_passwd', null);
  const setPasswd = val   => GM_setValue('bl_passwd', val);

  // ============================================================
  //  PING – browser-restart detection
  //
  //  Every tab pings every 5s while open.
  //  Browser closes → all intervals stop → ping goes stale.
  //  Next start: ping > 15s old → new session → force lock.
  //  ping fresh   → same session → trust current lock state.
  // ============================================================
  const KEY_LOCK = 'bl_lock';  // 'locked' | 'unlocked'
  const KEY_PING = 'bl_ping';  // ms timestamp

  // Ping every 5s while tab is open
  setInterval(() => GM_setValue(KEY_PING, Date.now()), 5000);

  // Per-tab one-time init (sessionStorage prevents repeat on same tab)
  if (!sessionStorage.getItem('bl_checked')) {
    sessionStorage.setItem('bl_checked', '1');
    const lastPing = GM_getValue(KEY_PING, 0);
    if (Date.now() - lastPing > 15000) {
      // Browser was closed → force lock
      GM_setValue(KEY_LOCK, 'locked');
    }
    // Write fresh ping immediately so the NEXT tab in this session sees it
    GM_setValue(KEY_PING, Date.now());
  }

  // ============================================================
  //  Lock / Unlock helpers
  // ============================================================
  const isUnlocked = () => GM_getValue(KEY_LOCK, 'locked') === 'unlocked';

  // Prevents MutationObserver from re-inserting overlay during intentional unlock
  let _unlocking = false;

  const doUnlock = () => {
    _unlocking = true;
    GM_setValue(KEY_LOCK, 'unlocked');
    setTimeout(() => { _unlocking = false; }, 500);
  };

  const doLock = () => {
    _unlocking = false;
    GM_setValue(KEY_LOCK, 'locked');
  };

  // ============================================================
  //  Cross-tab sync
  // ============================================================
  GM_addValueChangeListener(KEY_LOCK, (_n, _o, newVal, remote) => {
    if (!remote) return;
    if (newVal === 'unlocked') {
      _unlocking = true;
      removeBlur();
      restoreTitleFavicon();
      document.getElementById('bl-overlay')?.remove();
      setTimeout(() => { _unlocking = false; }, 500);
    } else if (newVal === 'locked') {
      _unlocking = false;
      if (!document.getElementById('bl-overlay')) showLockOverlay();
    }
  });

  // Lazy-loaded / restored tabs: check on tab focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (document.getElementById('bl-overlay') && isUnlocked()) {
      _unlocking = true;
      removeBlur();
      restoreTitleFavicon();
      document.getElementById('bl-overlay')?.remove();
      setTimeout(() => { _unlocking = false; }, 500);
    }
  });

  // ============================================================
  //  Body blur
  // ============================================================
  const applyBlur = () => {
    if (!document.body) return;
    document.body.style.setProperty('filter',         'blur(12px)', 'important');
    document.body.style.setProperty('user-select',    'none',       'important');
    document.body.style.setProperty('pointer-events', 'none',       'important');
  };
  const removeBlur = () => {
    if (!document.body) return;
    document.body.style.removeProperty('filter');
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('pointer-events');
  };

  // ============================================================
  //  Title + Favicon
  // ============================================================
  let _origTitle = null, _origFavHref = null, _favEl = null;

  const LOGO_DATA = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%235c74e8'/><path d='M32 14a12 12 0 00-12 12v4h-2a4 4 0 00-4 4v16a4 4 0 004 4h28a4 4 0 004-4V34a4 4 0 00-4-4h-2v-4a12 12 0 00-12-12zm0 6a6 6 0 016 6v4H26v-4a6 6 0 016-6zm0 16a4 4 0 110 8 4 4 0 010-8z' fill='%23fff'/></svg>`;

  const lockTitleFavicon = () => {
    _origTitle = document.title;
    const el   = document.querySelector("link[rel*='icon']");
    _origFavHref = el?.href ?? null;
    _favEl = el ?? document.createElement('link');
    _favEl.rel  = 'shortcut icon';
    _favEl.type = 'image/svg+xml';
    _favEl.href = LOGO_DATA;
    if (!el) document.head?.appendChild(_favEl);
    document.title = '🔒 Locked';
  };

  const restoreTitleFavicon = () => {
    if (_origTitle !== null) document.title = _origTitle;
    if (_favEl) { if (_origFavHref) _favEl.href = _origFavHref; else _favEl.remove(); }
    _origTitle = null; _origFavHref = null; _favEl = null;
  };

  // ============================================================
  //  Security: block DevTools + right-click while locked
  // ============================================================
  document.addEventListener('keydown', e => {
    if (isUnlocked()) return;
    if (e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','j','c','I','J','C'].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && ['u','U'].includes(e.key))) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('contextmenu', e => {
    if (isUnlocked()) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  // ============================================================
  //  CSS
  // ============================================================
  GM_addStyle(`
    #bl-overlay {
      all: initial !important;
      position: fixed !important; inset: 0 !important;
      z-index: 2147483647 !important; background: #f4f6fb !important;
      display: flex !important; flex-direction: column !important;
      align-items: center !important; justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    @media (prefers-color-scheme: dark) {
      #bl-overlay { background: #1a1d27 !important; }
      #bl-card    { background: #22263a !important; box-shadow: 0 8px 40px rgba(0,0,0,.5) !important; }
      #bl-card input { background: #2d3148 !important; border-color: #3d4265 !important; color: #e8eaf6 !important; }
      #bl-card input::placeholder { color: #6b7299 !important; }
      .bl-toggle img { filter: invert(1) !important; }
    }
    #bl-card {
      all: initial !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      background: #fff !important; border-radius: 16px !important;
      box-shadow: 0 8px 40px rgba(80,100,200,.12) !important;
      padding: 40px 36px 32px !important; width: 420px !important;
      max-width: calc(100vw - 32px) !important;
      display: flex !important; flex-direction: column !important;
      align-items: center !important; gap: 16px !important;
    }
    #bl-logo  { width: 56px !important; height: 56px !important; }
    #bl-title {
      font-size: 20px !important; font-weight: 600 !important;
      color: #2d3250 !important; margin: 0 !important; text-align: center !important;
    }
    #bl-notif {
      font-size: 13px !important; color: #e07700 !important;
      min-height: 20px !important; text-align: center !important; width: 100% !important;
    }
    .bl-field {
      position: relative !important; width: 100% !important;
      display: flex !important; align-items: center !important;
    }
    .bl-field input {
      width: 100% !important; box-sizing: border-box !important;
      height: 46px !important; border: 1.5px solid #d0d5e8 !important;
      border-radius: 8px !important; font-size: 15px !important;
      padding: 0 44px 0 14px !important; outline: none !important;
      background: #f8f9ff !important; color: #2d3250 !important;
      transition: border-color .18s !important;
    }
    .bl-field input:focus {
      border-color: #7b93f5 !important;
      box-shadow: 0 0 0 3px rgba(123,147,245,.15) !important;
    }
    .bl-toggle {
      all: initial !important; position: absolute !important;
      right: 12px !important; top: 50% !important; transform: translateY(-50%) !important;
      width: 28px !important; height: 28px !important; cursor: pointer !important;
      opacity: .55 !important; display: flex !important;
      align-items: center !important; justify-content: center !important;
    }
    .bl-toggle:hover { opacity: 1 !important; }
    .bl-toggle img   { width: 20px !important; height: 20px !important; pointer-events: none !important; }
    #bl-btn {
      all: initial !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      width: 100% !important; height: 46px !important;
      background: linear-gradient(135deg, #7b93f5, #5c74e8) !important;
      color: #fff !important; font-size: 16px !important; font-weight: 600 !important;
      border-radius: 8px !important; cursor: pointer !important; border: none !important;
      text-align: center !important; transition: opacity .18s !important; margin-top: 4px !important;
    }
    #bl-btn:hover  { opacity: .9 !important; }
    #bl-btn:active { transform: scale(.98) !important; }
    #bl-hint {
      font-size: 11px !important; color: #b0b8d8 !important; text-align: center !important;
    }
    #bl-first {
      font-size: 13px !important; color: #c0392b !important; text-align: center !important;
      line-height: 1.5 !important; padding: 8px 12px !important;
      background: #fff5f5 !important; border-radius: 8px !important;
      border: 1px solid #fad0ce !important; width: 100% !important; box-sizing: border-box !important;
    }
    #bl-footer {
      margin-top: 4px !important; border-top: 1px solid #eef0f8 !important;
      padding-top: 12px !important; width: 100% !important;
      display: flex !important; justify-content: space-evenly !important; font-size: 12px !important;
    }
    #bl-footer a       { color: #99a8d8 !important; text-decoration: none !important; }
    #bl-footer a:hover { text-decoration: underline !important; }
  `);

  // ============================================================
  //  Eye icons
  // ============================================================
  const EYE_OPEN = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>`;
  const EYE_OFF  = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94'/><path d='M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19'/><line x1='1' y1='1' x2='23' y2='23'/></svg>`;

  // ============================================================
  //  Password field with eye toggle
  // ============================================================
  function makeField(id, placeholder, autofocus = false) {
    const wrap = document.createElement('div');
    wrap.className = 'bl-field';
    const inp = document.createElement('input');
    inp.type = 'password'; inp.id = id; inp.placeholder = placeholder;
    if (autofocus) inp.autofocus = true;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'bl-toggle'; btn.tabIndex = -1;
    const img = document.createElement('img'); img.src = EYE_OPEN; img.alt = '';
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      const hide = inp.type === 'password';
      inp.type = hide ? 'text' : 'password';
      img.src  = hide ? EYE_OFF : EYE_OPEN;
    });
    wrap.appendChild(inp); wrap.appendChild(btn);
    return { wrap, inp };
  }

  // ============================================================
  //  Remove overlay
  // ============================================================
  function removeOverlay() {
    _unlocking = true;
    removeBlur();
    restoreTitleFavicon();
    document.getElementById('bl-overlay')?.remove();
    setTimeout(() => { _unlocking = false; }, 500);
  }

  // ============================================================
  //  SETUP OVERLAY
  // ============================================================
  function showSetupOverlay(afterSave) {
    applyBlur();
    lockTitleFavicon();
    document.getElementById('bl-overlay')?.remove();

    const hasPasswd = !!getPasswd();
    const overlay   = document.createElement('div');
    overlay.id      = 'bl-overlay';
    overlay.innerHTML = `
      <div id="bl-card">
        <img id="bl-logo" src="${LOGO_DATA}" alt="">
        <div id="bl-title">${hasPasswd ? 'Change Password' : 'Set a Password'}</div>
        <div id="bl-notif"></div>
        ${!hasPasswd ? `<div id="bl-first">⚠️ First time setup – remember your password! There is no recovery.</div>` : ''}
        ${hasPasswd  ? `<div id="bl-last-wrap"></div>` : ''}
        <div id="bl-new-wrap"></div>
        <div id="bl-check-wrap"></div>
        <button id="bl-btn">${hasPasswd ? 'Change Password' : 'Save Password'}</button>
        <div id="bl-footer">
          <a href="https://chromewebstore.google.com/detail/ioebechakfmaoboaimphhmmjkjjanamn/reviews" target="_blank">⭐ Review</a>
          <a href="https://github.com/zimocode/blocker" target="_blank">🔗 Source</a>
        </div>
      </div>`;
    document.documentElement.appendChild(overlay);

    let inpLast;
    if (hasPasswd) {
      const { wrap, inp } = makeField('bl-last', 'Current password', true);
      overlay.querySelector('#bl-last-wrap').replaceWith(wrap); inpLast = inp;
    }
    const { wrap: wn, inp: inpNew   } = makeField('bl-new',   'New password', !hasPasswd);
    const { wrap: wc, inp: inpCheck } = makeField('bl-check', 'Confirm new password');
    overlay.querySelector('#bl-new-wrap').replaceWith(wn);
    overlay.querySelector('#bl-check-wrap').replaceWith(wc);

    const notif     = overlay.querySelector('#bl-notif');
    const btn       = overlay.querySelector('#bl-btn');
    const showNotif = (msg, color = '#e07700') => {
      notif.textContent = msg; notif.style.color = color;
      setTimeout(() => { notif.textContent = ''; }, 3500);
    };

    const save = async () => {
      const last  = inpLast?.value.trim() ?? '';
      const nw    = inpNew.value.trim();
      const check = inpCheck.value.trim();
      if (!nw)          return showNotif('Please enter a new password.');
      if (nw !== check) return showNotif('Passwords do not match.');
      if (hasPasswd) {
        const s  = getPasswd();
        const ok = await pbkdf2.decrypt(s.data, last, s.salt);
        if (!ok) { if (inpLast) inpLast.value = ''; return showNotif('Current password is incorrect.'); }
      }
      btn.disabled = true; btn.textContent = 'Saving…';
      setPasswd(await pbkdf2.encrypt(nw));
      showNotif('Password saved!', '#2ecc71');
      setTimeout(() => { doUnlock(); removeOverlay(); if (typeof afterSave === 'function') afterSave(); }, 1200);
    };

    btn.addEventListener('click', save);
    [inpNew, inpCheck, ...(inpLast ? [inpLast] : [])].forEach(el =>
      el.addEventListener('keydown', e => { if (e.key === 'Enter') save(); })
    );
    setTimeout(() => overlay.querySelector('input')?.focus(), 50);
  }

  // ============================================================
  //  LOCK OVERLAY
  // ============================================================
  function showLockOverlay() {
    applyBlur();
    lockTitleFavicon();
    document.getElementById('bl-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id    = 'bl-overlay';
    overlay.innerHTML = `
      <div id="bl-card">
        <img id="bl-logo" src="${LOGO_DATA}" alt="">
        <div id="bl-title">🔒 Browser Locked</div>
        <div id="bl-notif"></div>
        <div id="bl-passwd-wrap"></div>
        <button id="bl-btn">Unlock</button>
        <div id="bl-hint">Ctrl+Shift+L (⌘+Shift+L on Mac) to lock anytime</div>
      </div>`;
    document.documentElement.appendChild(overlay);

    const { wrap, inp } = makeField('bl-passwd', 'Enter your password', true);
    overlay.querySelector('#bl-passwd-wrap').replaceWith(wrap);

    const notif     = overlay.querySelector('#bl-notif');
    const btn       = overlay.querySelector('#bl-btn');
    const showNotif = msg => {
      notif.textContent = msg;
      setTimeout(() => { notif.textContent = ''; }, 3000);
    };

    const tryUnlock = async (silent = false) => {
      const passwd = inp.value.trim();
      const stored = getPasswd();
      if (!stored) return;
      const ok = await pbkdf2.decrypt(stored.data, passwd, stored.salt);
      if (ok) { doUnlock(); removeOverlay(); }
      else if (!silent) { inp.value = ''; showNotif('❌ Wrong password'); }
    };

    btn.addEventListener('click',   ()  => tryUnlock(false));
    inp.addEventListener('keydown', e   => { if (e.key === 'Enter') tryUnlock(false); });
    inp.addEventListener('input',   ()  => { if (inp.value.length >= 4) tryUnlock(true); });
    setTimeout(() => inp.focus(), 50);
  }

  // ============================================================
  //  MutationObserver – re-insert overlay if manually removed
  // ============================================================
  let _guardStarted = false;
  function startGuard() {
    if (_guardStarted) return;
    _guardStarted = true;
    new MutationObserver(() => {
      if (_unlocking) return;
      if (!isUnlocked() && !document.getElementById('bl-overlay')) {
        getPasswd() ? showLockOverlay() : showSetupOverlay();
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // ============================================================
  //  Lock now
  // ============================================================
  function lockNow() {
    doLock();
    document.getElementById('bl-overlay')?.remove();
    getPasswd() ? showLockOverlay() : showSetupOverlay();
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyL') {
      e.preventDefault(); lockNow();
    }
  }, true);

  GM_registerMenuCommand('🔒 Lock Browser Now',  lockNow,  'L');
  GM_registerMenuCommand('🔑 Change Password', () => { document.getElementById('bl-overlay')?.remove(); showSetupOverlay(); }, 'P');

  // ============================================================
  //  INIT
  // ============================================================
  function init() {
    if (!getPasswd()) {
      showSetupOverlay();
    } else if (!isUnlocked()) {
      showLockOverlay();
    }
    startGuard();
  }

  if (document.documentElement) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
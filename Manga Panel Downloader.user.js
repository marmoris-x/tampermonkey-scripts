// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Lädt Manga/Manhwa-Panels als ZIP — Pipeline-Download, Retry, Abort, schnelles Scrollen
// @author       marmoris
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_deleteValue
// @connect      *
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ── One-time cleanup of legacy storage keys ───────────────────────────────
    GM_deleteValue('mpd-allowed-sites');
    GM_deleteValue('mpd-manga-mode');

    // ── Session-based activation (no persistent storage) ────────────────────────
    const host = location.hostname;

    // Session variable - resets on page reload
    window.mpd_enabled = window.mpd_enabled || false;
    let downloader = null;

    function initDownloader() {
        if (downloader) return; // Already initialized
        downloader = new MangaDownloader();
    }

    function toggleDownloader() {
        window.mpd_enabled = !window.mpd_enabled;
        if (window.mpd_enabled) {
            initDownloader(); // Create UI when activated
        } else if (downloader) {
            // Remove UI when deactivated
            const sb = document.getElementById('mpd-sb');
            if (sb) sb.remove();
            downloader = null;
        }
    }

    GM_registerMenuCommand(
        window.mpd_enabled ? 'Manga Downloader deaktivieren' : 'Manga Downloader aktivieren',
        toggleDownloader
    );

    // Initialize immediately if enabled
    if (window.mpd_enabled) {
        initDownloader();
    }

    // ── Constants ─────────────────────────────────────────────────────────────
    const SW                = 320;
    const MIN_IMG_PX        = 400;
    const MAX_SEG_H         = 3500;
    const MIN_SEG_H         = 600;
    const CONCURRENT_DL     = 6;
    const MAX_PAGES         = 200;
    const SCROLL_TIMEOUT_MS = 3000;
    const NAV_CLICK_WAIT_MS = 50;   // Wait after clicking next before polling for URL change
    const NAV_LOAD_WAIT_MS  = 150;  // Wait after URL changes before image polling starts
    const NAV_TIMEOUT_MS    = 5000; // Max wait for URL to change after clicking next
    const MANGA_POLL_MS     = 50;   // Poll interval when waiting for images to appear
    const MANGA_MAX_WAIT_MS = 3000; // Max total wait for images per page (increased to compensate)
    const FETCH_RETRY_COUNT = 2;

    // ── Styles ────────────────────────────────────────────────────────────────
    GM_addStyle(`
        html { transition: margin-right 0.3s ease !important; }
        html.mpd-pushed { margin-right: ${SW}px !important; }
        #mpd-sb {
            position: fixed; top: 0; right: 0;
            width: ${SW}px; height: 100vh;
            background: #1a1b1e; color: #c1c2c5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px; z-index: 2147483647;
            transform: translateX(100%); transition: transform 0.3s ease;
            display: flex; flex-direction: column;
            box-shadow: -2px 0 20px rgba(0,0,0,0.6);
        }
        #mpd-sb.open { transform: translateX(0); }
        #mpd-toggle {
            position: absolute; left: -36px; top: 50%;
            transform: translateY(-50%);
            width: 36px; height: 72px;
            background: #2f9e44; color: #fff; border: none;
            border-radius: 6px 0 0 6px; cursor: pointer;
            font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
            writing-mode: vertical-rl; padding: 8px 4px; transition: background 0.15s;
        }
        #mpd-toggle:hover { background: #237032; }
        #mpd-header {
            padding: 14px 16px 12px; border-bottom: 1px solid #2c2d32;
            font-size: 15px; font-weight: 700; color: #fff;
        }
        #mpd-controls {
            padding: 12px 16px; border-bottom: 1px solid #2c2d32;
            display: flex; flex-direction: column; gap: 9px;
        }
        .mpd-btn-row { display: flex; gap: 8px; }
        .mpd-btn-row button { flex: 1; }
        .mpd-btn {
            padding: 7px 12px; border: none; border-radius: 4px;
            font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .mpd-primary   { background: #2f9e44; color: #fff; }
        .mpd-primary:hover:not(:disabled)   { background: #237032; }
        .mpd-danger    { background: #c92a2a; color: #fff; }
        .mpd-danger:hover:not(:disabled)    { background: #a61e1e; }
        .mpd-secondary { background: #2c2d32; color: #c1c2c5; }
        .mpd-secondary:hover:not(:disabled) { background: #373a40; }
        .mpd-btn:disabled { background: #333; color: #555; cursor: not-allowed; }
        #mpd-progress {
            height: 3px; background: #2c2d32; border-radius: 2px;
            overflow: hidden; display: none;
        }
        #mpd-progress-bar {
            height: 100%; background: #2f9e44; width: 0%; transition: width 0.15s;
        }
        #mpd-status { font-size: 12px; color: #909296; min-height: 16px; }
        #mpd-results { flex: 1; overflow-y: auto; padding: 8px 0; }
        #mpd-results::-webkit-scrollbar { width: 5px; }
        #mpd-results::-webkit-scrollbar-track { background: #1a1b1e; }
        #mpd-results::-webkit-scrollbar-thumb { background: #373a40; border-radius: 3px; }
        .mpd-thumb {
            display: flex; align-items: center; gap: 10px;
            padding: 6px 14px; border-bottom: 1px solid #25262b;
        }
        .mpd-thumb img {
            width: 48px; height: 48px; object-fit: cover;
            border-radius: 3px; flex-shrink: 0; background: #25262b;
        }
        .mpd-thumb-info { flex: 1; min-width: 0; }
        .mpd-thumb-name {
            font-size: 11px; color: #909296;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mpd-thumb-size { font-size: 11px; color: #555; }
        .mpd-thumb input[type=checkbox] {
            flex-shrink: 0; width: 15px; height: 15px;
            cursor: pointer; accent-color: #2f9e44;
        }
        #mpd-footer {
            padding: 8px 16px; border-top: 1px solid #2c2d32;
            font-size: 11px; color: #555;
        }
        .mpd-toggle-row {
            display: flex; align-items: center; gap: 8px;
            font-size: 12px; color: #909296; cursor: pointer; user-select: none;
        }
        .mpd-toggle-row input { cursor: pointer; accent-color: #2f9e44; }
    `);

    // ─────────────────────────────────────────────────────────────────────────

    class MangaDownloader {

        constructor() {
            this.segments          = [];   // { filename, blob, previewUrl, w, h }
            this.errors            = [];   // { src, message }
            this.scanning          = false;
            this.aborted           = false;
            this.mangaMode         = window.mpd_mangaMode || false;
            this.scannedUrls       = new Set();
            this.previewRevokeTimer = null;
            this._buildUI();
            this._watchUrlChanges();
        }

        // ── UI ────────────────────────────────────────────────────────────────

        _buildUI() {
            const sb = document.createElement('div');
            sb.id = 'mpd-sb';
            sb.innerHTML = `
                <button id="mpd-toggle">DL</button>
                <div id="mpd-header">Manga Downloader</div>
                <div id="mpd-controls">
                    <div class="mpd-btn-row">
                        <button class="mpd-btn mpd-primary" id="mpd-scan">Scan</button>
                        <button class="mpd-btn mpd-secondary" id="mpd-dl" disabled>ZIP</button>
                    </div>
                    <label class="mpd-toggle-row">
                        <input type="checkbox" id="mpd-manga-mode" ${this.mangaMode ? 'checked' : ''}>
                        <span>Manga-Modus (auto weiterklicken)</span>
                    </label>
                    <div id="mpd-progress"><div id="mpd-progress-bar"></div></div>
                    <div id="mpd-status">Bereit.</div>
                </div>
                <div id="mpd-results"></div>
                <div id="mpd-footer"></div>
            `;
            // Append to <html> not <body> — SPA routers frequently replace body's
            // innerHTML or unmount the root div, which would destroy a body-injected
            // sidebar and crash subsequent getElementById calls with null.
            document.documentElement.appendChild(sb);

            // Scan button doubles as Stop during a running scan
            document.getElementById('mpd-scan').addEventListener('click', () => {
                if (this.scanning) this._abort();
                else               this._scan();
            });
            document.getElementById('mpd-dl').addEventListener('click',     () => this._download());
            document.getElementById('mpd-toggle').addEventListener('click', () => this._toggle());
            document.getElementById('mpd-manga-mode').addEventListener('change', e => {
                this.mangaMode = e.target.checked;
                window.mpd_mangaMode = this.mangaMode;
            });
        }

        _toggle() {
            const sb   = document.getElementById('mpd-sb');
            const open = !sb.classList.contains('open');
            sb.classList.toggle('open', open);
            document.documentElement.classList.toggle('mpd-pushed', open);
        }

        _setScanBtn(scanning) {
            const btn     = document.getElementById('mpd-scan');
            btn.textContent = scanning ? 'Stop' : 'Scan';
            btn.className   = `mpd-btn ${scanning ? 'mpd-danger' : 'mpd-primary'}`;
        }

        _status(msg)   { document.getElementById('mpd-status').textContent = msg; }

        _progress(pct) {
            document.getElementById('mpd-progress').style.display =
                (pct > 0 && pct < 100) ? 'block' : 'none';
            document.getElementById('mpd-progress-bar').style.width = `${pct}%`;
        }

        // ── URL-change watcher ────────────────────────────────────────────────

        _watchUrlChanges() {
            let lastUrl = location.href;
            const onChange = () => {
                if (location.href === lastUrl) return;
                lastUrl = location.href;
                // Never wipe while scanning, and never wipe when results are loaded.
                // Using dl.disabled as guard was wrong: _download() sets disabled=true
                // immediately before async ZIP generation, so any late SPA navigation
                // (the producer's last _navigateNext completing after the scan finished)
                // would trigger _reset() mid-download and destroy all thumbnails.
                if (this.scanning) return;
                if (this.segments.length > 0) return;
                this._reset();
            };
            window.addEventListener('popstate',   onChange);
            window.addEventListener('hashchange', onChange);
            // Poll for SPA pushState/replaceState navigations that don't fire browser
            // events. Avoids cross-world closure issues with unsafeWindow in Firefox
            // (assigning Isolated World functions to Main World history can throw
            // SecurityError in strict Greasemonkey/MV3 environments).
            setInterval(onChange, 1000);
        }

        _reset() {
            if (this.scanning) return;
            clearTimeout(this.previewRevokeTimer);
            this.previewRevokeTimer = null;
            this._revokeAllPreviews();
            this.segments = [];
            this.errors   = [];
            const results = document.getElementById('mpd-results');
            const footer  = document.getElementById('mpd-footer');
            const dl      = document.getElementById('mpd-dl');
            if (results) results.innerHTML  = '';
            if (footer)  footer.textContent = '';
            if (dl)      dl.disabled = true;
            this._status('Bereit.');
            this._progress(0);
        }

        _revokeAllPreviews() {
            this.segments.forEach(s => { try { URL.revokeObjectURL(s.previewUrl); } catch {} });
        }

        // ── URL helpers ───────────────────────────────────────────────────────

        // Strip query-string + hash so CDN tokens don't defeat deduplication
        _normalizeUrl(url) {
            if (!url || url.startsWith('data:')) return url || '';
            try {
                const u = new URL(url, location.href);
                return u.origin + u.pathname;
            } catch {
                return url.split('?')[0].split('#')[0];
            }
        }

        _getSrc(el) {
            const raw = el.src
                || el.currentSrc
                || this._extractLazySrc(el)
                || el.getAttribute('data-srcset')?.split(/[\s,]+/)[0]
                || el.getAttribute('srcset')?.split(/[\s,]+/)[0]
                || '';
            // GM_xmlhttpRequest requires absolute URLs; el.src/currentSrc are already
            // absolute (browser resolves them), but lazy-load attributes may be relative.
            if (!raw || raw.startsWith('data:') || raw.startsWith('http')) return raw;
            try { return new URL(raw, location.href).href; } catch { return raw; }
        }

        _extractLazySrc(el) {
            return el.dataset.src
                || el.dataset.lazySrc
                || el.dataset.original
                || el.dataset.url
                || el.dataset.imgSrc
                || el.dataset.lazyload
                || el.getAttribute('data-cfsrc')
                || el.getAttribute('data-echo')
                || null;
        }

        // All possible URLs this element might have (raw + CDN-normalized variants)
        _allSrcsOf(el) {
            const srcs = new Set();
            const add  = v => {
                if (!v || typeof v !== 'string' || v.length < 5) return;
                srcs.add(v);
                // No normalization here — stripping query params would cause sites that
                // identify images via query string (reader.php?panel=N) to have all
                // subsequent pages flagged as duplicates of the first.
            };
            if (!el) return srcs;
            add(el.src);
            add(el.currentSrc);
            add(this._extractLazySrc(el));
            add(el.getAttribute?.('data-srcset')?.split(/[\s,]+/)[0]);
            add(el.getAttribute?.('srcset')?.split(/[\s,]+/)[0]);
            // Absolutise any relative variants
            for (const s of [...srcs]) {
                if (s && !s.startsWith('data:') && !s.startsWith('http')) {
                    try { add(new URL(s, location.href).href); } catch {}
                }
            }
            return srcs;
        }

        // ── Image detection ───────────────────────────────────────────────────

        _findImages() {
            const seen    = new Set();
            const results = [];

            const tryAdd = (el, src) => {
                if (!src || el?.dataset?.mpdProcessed) return;
                // Deduplicate by raw URL only — normalizing here would incorrectly
                // collapse query-param-identified images (reader.php?panel=1 vs ?panel=2)
                if (seen.has(src)) return;
                if (/\.(svg|gif)(\?|#|$)/i.test(src)) return;
                if (src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) return;

                const parentTag = el.parentElement?.tagName?.toLowerCase();
                if (['nav', 'header', 'footer'].includes(parentTag)) return;

                // Skip invisible elements (pre-loaded adjacent panels hidden in DOM)
                if (el.nodeType === Node.ELEMENT_NODE) {
                    const cs = window.getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return;
                    if (el.tagName === 'IMG' && el.offsetWidth === 0 && el.offsetHeight === 0) return;
                }

                const nw = el.naturalWidth  || parseInt(el.getAttribute?.('width'))  || el.offsetWidth  || 0;
                const nh = el.naturalHeight || parseInt(el.getAttribute?.('height')) || el.offsetHeight || 0;
                if (nw > 0 && nw < 100 && nh > 0 && nh < 100) return;

                seen.add(src);
                results.push({ el, src });
            };

            document.querySelectorAll('img')
                .forEach(img => tryAdd(img, this._getSrc(img)));

            document.querySelectorAll('picture source').forEach(s => {
                const url = s.srcset?.split(/[\s,]+/)[0];
                if (url) tryAdd(s.closest('picture')?.querySelector('img') || s, url);
            });

            document.querySelectorAll('[style*="background"]').forEach(el => {
                const m = el.style.backgroundImage?.match(/url\(['"]?([^'")\s]+)['"]?\)/);
                if (m && el.offsetWidth >= MIN_IMG_PX && el.offsetHeight >= MIN_IMG_PX)
                    tryAdd(el, m[1]);
            });

            document.querySelectorAll('canvas').forEach(c => {
                if (c.width < MIN_IMG_PX || c.height < MIN_IMG_PX) return;
                try {
                    const d = c.toDataURL('image/jpeg', 0.92);
                    if (d?.length > 1000) tryAdd(c, d);
                } catch {}
            });

            return results;
        }

        // ── Lazy-load trigger ─────────────────────────────────────────────────

        _triggerAllLazy() {
            document.querySelectorAll('img').forEach(img => {
                const lazy = this._extractLazySrc(img);
                if (lazy && !img.src.startsWith('http') && !img.src.startsWith('data:'))
                    img.src = lazy;
            });
        }

        // ── Scroll-to-load (non-manga mode only) ──────────────────────────────
        // Jumps directly to unloaded images instead of a slow fixed-step sweep.

        async _scrollLoad() {
            // Pass 1: force all known lazy attributes immediately
            this._triggerAllLazy();
            await this._sleep(150);

            const getUnloaded = () =>
                Array.from(document.querySelectorAll('img')).filter(img =>
                    (!img.complete || !img.naturalWidth) &&
                    (img.src?.startsWith('http') || this._extractLazySrc(img))
                );

            // Pass 2: scroll directly to each unloaded image
            for (const img of getUnloaded()) {
                img.scrollIntoView({ block: 'center', behavior: 'instant' });
                this._triggerAllLazy();
                await this._sleep(60);
            }

            // Pass 3: one fast full-page sweep to catch any stragglers
            const pageH = document.documentElement.scrollHeight;
            for (let y = 0; y <= pageH; y += window.innerHeight) {
                window.scrollTo(0, y);
                this._triggerAllLazy();
                await this._sleep(40);
            }

            // Pass 4: poll until all images loaded, max SCROLL_TIMEOUT_MS
            const deadline = Date.now() + SCROLL_TIMEOUT_MS;
            while (Date.now() < deadline) {
                this._triggerAllLazy();
                if (getUnloaded().length === 0) break;
                await this._sleep(150);
            }

            window.scrollTo(0, 0);
            await this._sleep(100);
        }

        // ── Fetch ─────────────────────────────────────────────────────────────

        _fetchBlob(url, extraHeaders = {}) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    responseType: 'blob',
                    headers: Object.fromEntries(
                        Object.entries({
                            Referer: location.href,
                            Origin:  location.origin,
                            ...extraHeaders,
                        }).filter(([, v]) => v != null)
                    ),
                    onload:    r  => r.status === 200 && r.response?.size > 100
                        ? resolve(r.response)
                        : reject(new Error(`HTTP ${r.status}`)),
                    onerror:   () => reject(new Error('Network error')),
                    ontimeout: () => reject(new Error('Timeout')),
                    timeout: 20000,
                });
            });
        }

        async _fetchBlobWithFallbacks(src, el) {
            if (src?.startsWith('data:')) return (await fetch(src)).blob();

            const errs = [];
            const t = async fn => { try { return await fn(); } catch(e) { errs.push(e.message); } };

            return (
                await t(() => this._fetchBlob(src))
                || await t(() => this._fetchBlob(src, { Origin: null }))
                || await t(() => this._fetchBlob(src, { Referer: null, Origin: null }))
                || await t(async () => {
                    const r = await fetch(src, { credentials: 'include' });
                    if (r.ok) return r.blob();
                    throw new Error(`HTTP ${r.status}`);
                })
                || await t(async () => {
                    // Canvas redraw of already-loaded DOM img
                    if (el?.tagName === 'IMG' && el.complete && el.naturalWidth > 0) {
                        const c = document.createElement('canvas');
                        c.width = el.naturalWidth; c.height = el.naturalHeight;
                        c.getContext('2d').drawImage(el, 0, 0);
                        return new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
                    }
                    throw new Error('Not a loaded img');
                })
                || (() => { throw new Error(errs.join(' | ')); })()
            );
        }

        // Retry wrapper with exponential backoff
        async _fetchWithRetry(src, el) {
            let lastErr;
            for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
                if (this.aborted) throw new Error('Abgebrochen');
                try {
                    return await this._fetchBlobWithFallbacks(src, el);
                } catch(e) {
                    lastErr = e;
                    if (attempt < FETCH_RETRY_COUNT) await this._sleep(600 * (attempt + 1));
                }
            }
            throw lastErr;
        }

        // ── Image processing ──────────────────────────────────────────────────

        _findSplitPoints(h) {
            if (h <= MAX_SEG_H) return [0, h];
            const pts = [0];
            for (let y = MAX_SEG_H; y < h; y += MAX_SEG_H) pts.push(y);
            pts.push(h);
            // Merge a tiny trailing segment into the previous one
            if (pts.length > 2 && pts[pts.length - 1] - pts[pts.length - 2] < MIN_SEG_H)
                pts.splice(pts.length - 2, 1);
            return pts;
        }

        async _processImage(blob, pageNum, srcEl) {
            // Fast path: if the source element has decoded dimensions, no split is needed,
            // AND the blob is already JPEG or PNG — reuse it zero-copy.
            // WebP is excluded from the fast path so it gets re-encoded to JPEG below.
            const ew = srcEl?.naturalWidth, eh = srcEl?.naturalHeight;
            if (ew > 0 && eh > 0 && eh <= MAX_SEG_H && blob.type !== 'image/webp') {
                const ext      = blob.type === 'image/png' ? 'png' : 'jpg';
                const filename = `page_${String(pageNum).padStart(3, '0')}.${ext}`;
                return [{ filename, blob, previewUrl: URL.createObjectURL(blob), w: ew, h: eh }];
            }

            // Decode via ObjectURL — avoids base64 round-trip (33% less memory)
            const objUrl = URL.createObjectURL(blob);
            let img;
            try {
                img = await new Promise((res, rej) => {
                    const el  = new Image();
                    el.onload  = () => res(el);
                    el.onerror = () => rej(new Error('Decode failed'));
                    el.src = objUrl;
                });
            } finally {
                URL.revokeObjectURL(objUrl);
            }

            const { naturalWidth: w, naturalHeight: h } = img;
            const pts    = this._findSplitPoints(h);
            // PNG stays lossless. Everything else (WebP, JPEG needing a split, unknown)
            // goes through canvas → JPEG. We never output WebP.
            const srcExt = (pts.length === 2 && blob.type === 'image/png') ? 'png' : 'jpg';
            const results = [];

            for (let i = 0; i < pts.length - 1; i++) {
                const y0   = pts[i];
                const segH = pts[i + 1] - y0;
                const suffix   = pts.length === 2 ? '' : `_part${i + 1}`;
                const filename = `page_${String(pageNum).padStart(3, '0')}${suffix}.${srcExt}`;

                // No split + already JPEG/PNG → reuse original blob (zero-copy, no re-encode)
                // No split + WebP → canvas re-encode to JPEG
                // Split (any format) → canvas re-encode to JPEG
                const segBlob = (pts.length === 2 && blob.type !== 'image/webp')
                    ? blob
                    : await new Promise(r => {
                        const cv = document.createElement('canvas');
                        cv.width = w; cv.height = segH;
                        cv.getContext('2d').drawImage(img, 0, y0, w, segH, 0, 0, w, segH);
                        cv.toBlob(r, 'image/jpeg', 0.92);
                    });

                results.push({
                    filename,
                    blob:       segBlob,
                    previewUrl: URL.createObjectURL(segBlob),
                    w,
                    h: segH,
                });
            }
            return results;
        }

        // ── Add results to sidebar ────────────────────────────────────────────

        _addSegmentsToUI(segs) {
            segs.forEach(seg => this.segments.push(seg));
        }

        // Called once after all downloads finish — sorts segments by filename and
        // renders the final, correctly-ordered sidebar list.  Because downloads
        // complete out of order (concurrent fetches), live-appending produces a
        // scrambled UI; deferring the render to here fixes that.
        _renderResults() {
            this.segments.sort((a, b) => a.filename.localeCompare(b.filename));
            const list = document.getElementById('mpd-results');
            list.innerHTML = '';
            this.segments.forEach((seg, idx) => {
                const div = document.createElement('div');
                div.className = 'mpd-thumb';
                div.innerHTML = `
                    <img src="${seg.previewUrl}">
                    <div class="mpd-thumb-info">
                        <div class="mpd-thumb-name">${seg.filename}</div>
                        <div class="mpd-thumb-size">${seg.w}×${seg.h}px</div>
                    </div>
                    <input type="checkbox" checked data-idx="${idx}">
                `;
                list.appendChild(div);
            });
        }

        // ── Navigation (manga mode) ───────────────────────────────────────────

        // Derive next URL from common page-number patterns — faster than clicking
        _guessNextUrl(url) {
            try {
                const u = new URL(url);
                if (u.searchParams.has('page')) {
                    const n = parseInt(u.searchParams.get('page'), 10);
                    if (!isNaN(n)) {
                        const next = new URL(url);
                        next.searchParams.set('page', n + 1);
                        return next.href;
                    }
                }
                // Path ending in /N or /N/
                const m = u.pathname.match(/^(.*\/)(\d+)(\/?)$/);
                if (m) {
                    const n = parseInt(m[2], 10);
                    if (!isNaN(n) && n > 0 && n < 10000)
                        return u.origin + m[1] + (n + 1) + m[3] + u.search;
                }
            } catch {}
            return null;
        }

        _clickNextPage() {
            const selectors = [
                'a[rel="next"]',
                '[class*="next"]:not([disabled])',
                '[aria-label*="next" i]', '[title*="next" i]',
                '[aria-label*="weiter" i]', '[title*="weiter" i]',
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) { el.click(); return true; }
            }
            for (const el of document.querySelectorAll('a, button')) {
                const t = el.textContent.trim().toLowerCase();
                if (['next', 'weiter', '>', '›', '→'].includes(t)) { el.click(); return true; }
            }
            return false;
        }

        _navigateNext() {
            // Always click the button so SPA routers can intercept via pushState.
            // Using location.href directly forces a full page reload, destroying the
            // script's in-memory scan state and closing the sidebar.
            // If no button is found, fall back to URL-based navigation as last resort.
            if (this._clickNextPage()) return;
            const nextUrl = this._guessNextUrl(location.href);
            if (nextUrl) location.href = nextUrl;
        }

        _waitForUrlChange(prevUrl, timeout) {
            return new Promise(resolve => {
                const start = Date.now();
                const id    = setInterval(() => {
                    if (location.href !== prevUrl) { clearInterval(id); resolve(true);  return; }
                    if (Date.now() - start > timeout) { clearInterval(id); resolve(false); }
                }, 80);
            });
        }

        // ── Phase 1: collect URLs from current page ───────────────────────────

        async _collectPageUrls() {
            if (!this.mangaMode) {
                await this._scrollLoad();
            } else {
                // Single panel per page — poll until images appear or timeout
                const deadline = Date.now() + MANGA_MAX_WAIT_MS;
                while (Date.now() < deadline) {
                    const images = this._findImages();
                    if (images.length > 0) break;  // Images found, proceed
                    await this._sleep(MANGA_POLL_MS);
                }
            }

            const candidates = this._findImages();

            // Sort top → bottom — precompute rects once to avoid O(n log n) reflows
            // (getBoundingClientRect inside a sort comparator would force a layout
            // recalculation on every comparison)
            const withY = candidates.map(c => ({
                c, y: (c.el.getBoundingClientRect?.()?.top ?? 0) + window.scrollY,
            }));
            withY.sort((a, b) => a.y - b.y);
            const sorted = withY.map(({ c }) => c);

            // Deduplicate against everything seen so far (raw URLs only).
            // We intentionally do NOT store normalized URLs in scannedUrls: sites that
            // encode the image identity in query params (e.g. reader.php?image_id=2)
            // would have all pages collapse to the same normalized path and get skipped.
            const fresh = [];
            for (const c of sorted) {
                if (this.scannedUrls.has(c.src)) continue;
                const srcs = this._allSrcsOf(c.el);
                let seen = false;
                for (const v of srcs) if (this.scannedUrls.has(v)) { seen = true; break; }
                if (seen) continue;
                // Fresh — register raw URLs immediately so the next page won't re-collect them
                this.scannedUrls.add(c.src);
                for (const v of srcs) this.scannedUrls.add(v);
                fresh.push(c);
            }

            return fresh;
        }

        // ── Abort ─────────────────────────────────────────────────────────────

        _abort() {
            this.aborted = true;
            this._status('Wird abgebrochen...');
        }

        // ── Main scan ─────────────────────────────────────────────────────────
        //
        // PIPELINE architecture:
        //   Producer — navigates pages one by one, pushes {src,el,num} into queue
        //   Consumer — drains queue with CONCURRENT_DL parallel fetches+processes
        //
        // Both run via Promise.all, so downloads start as soon as the first page
        // is collected instead of waiting for all pages to be visited first.

        async _scan() {
            if (this.scanning) return;

            this.scanning = true;
            this.aborted  = false;

            // Clean up from any previous run
            // Cancel any pending revoke timer from a previous download — without this,
            // the 30-second timer set by _download() can fire mid-scan and wipe the
            // new scan's thumbnails.
            clearTimeout(this.previewRevokeTimer);
            this.previewRevokeTimer = null;
            this._revokeAllPreviews();
            this.segments = [];
            this.errors   = [];
            this.scannedUrls.clear();
            document.querySelectorAll('[data-mpd-processed]')
                .forEach(el => el.removeAttribute('data-mpd-processed'));
            document.getElementById('mpd-results').innerHTML    = '';
            document.getElementById('mpd-footer').textContent   = '';
            document.getElementById('mpd-dl').disabled          = true;
            this._setScanBtn(true);
            this._progress(0);
            this._status('Startet...');

            // ── Pipeline shared state ─────────────────────────────────────────
            const queue       = [];   // candidates waiting to be downloaded
            let producerDone  = false;
            let totalExpected = 0;    // grows as producer collects more pages
            let dlDone        = 0;

            // ── Producer ─────────────────────────────────────────────────────
            const producer = async () => {
                let seqNum = 0;
                try {
                    if (this.mangaMode) {
                        let page = 1;
                        while (page <= MAX_PAGES && !this.aborted) {
                            this._status(`Seite ${page}: scanne... (${totalExpected} bisher)`);
                            const prevUrl = location.href;
                            const found   = await this._collectPageUrls();

                            found.forEach(c => { c.num = ++seqNum; });
                            queue.push(...found);
                            totalExpected += found.length;

                            this._status(`Seite ${page} ✓ — ${totalExpected} Panel(s) gefunden`);

                            // If no images found on this page, assume end of manga and stop
                            if (found.length === 0) {
                                this._status(`Seite ${page}: keine Panels. Abgeschlossen.`);
                                break;
                            }

                            this._navigateNext();
                            await this._sleep(NAV_CLICK_WAIT_MS);
                            const changed = await this._waitForUrlChange(prevUrl, NAV_TIMEOUT_MS);
                            if (!changed) break;
                            await this._sleep(NAV_LOAD_WAIT_MS);
                            page++;
                        }
                    } else {
                        this._status('Scrolle und suche Panels...');
                        const found = await this._collectPageUrls();
                        found.forEach(c => { c.num = ++seqNum; });
                        queue.push(...found);
                        totalExpected = found.length;
                        this._status(`${totalExpected} Panels gefunden. Lade herunter...`);
                    }
                } finally {
                    producerDone = true;
                }
            };

            // ── Consumer ─────────────────────────────────────────────────────
            const consumer = async () => {
                const running  = new Set();
                const allTasks = [];   // kept for final Promise.allSettled

                const spawn = candidate => {
                    // Note: `task` self-reference works because JS closures capture
                    // the variable binding, not the value at assignment time.
                    let task;
                    task = (async () => {
                        try {
                            if (this.aborted) return;
                            const blob = await this._fetchWithRetry(candidate.src, candidate.el);
                            if (this.aborted) return;
                            const segs = await this._processImage(blob, candidate.num, candidate.el);
                            this._addSegmentsToUI(segs);
                            if (candidate.el) candidate.el.dataset.mpdProcessed = 'true';
                        } catch(e) {
                            this.errors.push({ src: candidate.src, message: e.message });
                            console.warn('[MPD] Failed:', candidate.src?.slice(0, 80), e.message);
                        } finally {
                            dlDone++;
                            running.delete(task);
                            const pct    = totalExpected > 0 ? (dlDone / totalExpected) * 100 : 0;
                            const errStr = this.errors.length ? ` (${this.errors.length} Fehler)` : '';
                            this._progress(pct);
                            this._status(`Lade: ${dlDone}/${totalExpected}${errStr}`);
                        }
                    })();
                    running.add(task);
                    allTasks.push(task);
                };

                while (!this.aborted) {
                    // Fill up to concurrency cap from queue
                    while (queue.length > 0 && running.size < CONCURRENT_DL)
                        spawn(queue.shift());

                    if (producerDone && queue.length === 0 && running.size === 0) break;

                    await this._sleep(40);
                }

                // Wait for any still-running tasks to finish
                if (allTasks.length) await Promise.allSettled(allTasks);
            };

            // ── Run phases ────────────────────────────────────────────────────
            // Manga mode: scan all pages first, then download — so navigation is
            // not interrupted by concurrent network activity.
            // Normal mode: pipeline (producer + consumer concurrently).
            try {
                if (this.mangaMode) {
                    await producer();
                    this._status(`${totalExpected} Panels gefunden. Lade herunter...`);
                    await consumer();
                } else {
                    await Promise.all([producer(), consumer()]);
                }

                this._renderResults();
                this._progress(0);
                const errStr = this.errors.length ? ` | ${this.errors.length} Fehler` : '';
                document.getElementById('mpd-footer').textContent =
                    `${this.segments.length} Segmente${errStr}`;

                this._status(
                    this.aborted
                        ? `Abgebrochen. ${this.segments.length} Dateien geladen.`
                        : `Fertig. ${this.segments.length} Dateien bereit.`
                );

                if (this.segments.length > 0)
                    document.getElementById('mpd-dl').disabled = false;

            } catch(e) {
                this._status(`Fehler: ${e?.message || e}`);
                console.error('[MPD]', e);
            } finally {
                this.scanning = false;
                this._setScanBtn(false);
            }
        }

        // ── Manual STORE-ZIP builder (JSZip fallback) ─────────────────────────
        // Constructs a valid ZIP (STORE/no-compression) from Uint8Arrays without
        // any external library. Uses only FileReader — never blob.arrayBuffer() —
        // because GM_xmlhttpRequest blobs can silently hang on .arrayBuffer() in
        // some Tampermonkey/browser combos.

        async _buildStoreZip(files) {
            const enc     = new TextEncoder();
            const readBuf = blob => new Promise((res, rej) => {
                const fr = new FileReader();
                fr.onload  = () => res(new Uint8Array(fr.result));
                fr.onerror = () => rej(fr.error ?? new Error('FileReader error'));
                fr.readAsArrayBuffer(blob);
            });

            // Pre-built CRC-32 table
            const crcTable = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                crcTable[i] = c;
            }
            const crc32 = buf => {
                let c = 0xFFFFFFFF;
                for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
                return (c ^ 0xFFFFFFFF) >>> 0;
            };

            const w16 = (v, a, o) => { a[o] = v & 0xFF; a[o+1] = (v >>> 8) & 0xFF; };
            const w32 = (v, a, o) => { w16(v, a, o); w16(v >>> 16, a, o + 2); };

            const localParts = [];
            const centralDir = [];
            let   offset     = 0;

            for (const { filename, blob } of files) {
                const name = enc.encode(filename);
                const data = await readBuf(blob);
                const crc  = crc32(data);
                const size = data.length;

                const lfh = new Uint8Array(30 + name.length);
                w32(0x04034b50, lfh,  0);   // local file header signature
                w16(20,         lfh,  4);   // version needed
                w16(0,          lfh,  6);   // general purpose bit flag
                w16(0,          lfh,  8);   // compression: STORE
                w16(0,          lfh, 10);   // last mod time
                w16(0,          lfh, 12);   // last mod date
                w32(crc,        lfh, 14);
                w32(size,       lfh, 18);   // compressed size
                w32(size,       lfh, 22);   // uncompressed size
                w16(name.length,lfh, 26);
                w16(0,          lfh, 28);   // extra field length
                lfh.set(name, 30);

                const cde = new Uint8Array(46 + name.length);
                w32(0x02014b50, cde,  0);   // central directory signature
                w16(20,         cde,  4);   // version made by
                w16(20,         cde,  6);   // version needed
                w16(0,          cde,  8);
                w16(0,          cde, 10);   // STORE
                w16(0,          cde, 12);
                w16(0,          cde, 14);
                w32(crc,        cde, 16);
                w32(size,       cde, 20);
                w32(size,       cde, 24);
                w16(name.length,cde, 28);
                w16(0,          cde, 30);   // extra
                w16(0,          cde, 32);   // comment
                w16(0,          cde, 34);   // disk start
                w16(0,          cde, 36);   // internal attrs
                w32(0,          cde, 38);   // external attrs
                w32(offset,     cde, 42);   // local header offset
                cde.set(name, 46);

                localParts.push(lfh, data);
                centralDir.push(cde);
                offset += 30 + name.length + size;
            }

            const cdSize = centralDir.reduce((s, b) => s + b.length, 0);
            const eocd   = new Uint8Array(22);
            w32(0x06054b50,   eocd,  0);   // end of central directory signature
            w16(0,            eocd,  4);
            w16(0,            eocd,  6);
            w16(files.length, eocd,  8);
            w16(files.length, eocd, 10);
            w32(cdSize,       eocd, 12);
            w32(offset,       eocd, 16);
            w16(0,            eocd, 20);

            return new Blob([...localParts, ...centralDir, eocd], { type: 'application/zip' });
        }

        // ── Download ZIP ──────────────────────────────────────────────────────

        async _download() {
            // Only include segments that still have their blob data
            const checked = Array.from(
                document.querySelectorAll('#mpd-results input[type=checkbox]:checked')
            ).map(cb => this.segments[+cb.dataset.idx]).filter(seg => seg?.blob);

            if (!checked.length) { this._status('Nichts ausgewählt.'); return; }

            document.getElementById('mpd-dl').disabled = true;

            const date    = new Date().toISOString().slice(0, 10);
            const chapter = location.pathname.replace(/\//g, '_').slice(1, 40) || 'chapter';
            const name    = `${host}_${chapter}_${date}.zip`;

            // Shared finish: trigger browser download, null blobs, schedule preview revoke
            const finish = zipBlob => {
                const a = document.createElement('a');
                a.href     = URL.createObjectURL(zipBlob);
                a.download = name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(a.href), 10000);
                this.segments.forEach(seg => { seg.blob = null; });
                document.getElementById('mpd-dl').disabled = true;
                clearTimeout(this.previewRevokeTimer);
                this.previewRevokeTimer = setTimeout(() => this._revokeAllPreviews(), 30000);
                this._status(`Heruntergeladen: ${name}`);
            };

            // ── Attempt 1: manual STORE ZIP ──────────────────────────────────
            try {
                this._status(`Baue ZIP (${checked.length} Dateien)...`);
                const zipBlob = await this._buildStoreZip(checked);
                return finish(zipBlob);
            } catch(e) {
                console.warn('[MPD] Manual ZIP failed, downloading individually:', e.message);
            }

            // ── Attempt 3: individual file downloads ─────────────────────────
            try {
                for (let i = 0; i < checked.length; i++) {
                    const seg = checked[i];
                    this._status(`Lade ${i + 1}/${checked.length}: ${seg.filename}`);
                    const a = document.createElement('a');
                    a.href     = seg.previewUrl;   // object URL — always valid at this point
                    a.download = seg.filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    await this._sleep(300);
                }
                this.segments.forEach(seg => { seg.blob = null; });
                document.getElementById('mpd-dl').disabled = true;
                clearTimeout(this.previewRevokeTimer);
                this.previewRevokeTimer = setTimeout(() => this._revokeAllPreviews(), 30000);
                this._status(`${checked.length} Dateien einzeln heruntergeladen.`);
            } catch(e) {
                this._status(`Fehler: ${e.message}`);
                console.error('[MPD] Download:', e);
                document.getElementById('mpd-dl').disabled = false;
            }
        }

        // ── Utilities ─────────────────────────────────────────────────────────

        _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    }

})();
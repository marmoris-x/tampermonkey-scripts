// ==UserScript==
// @name         Manga Panel Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Lädt Manga/Manhwa-Panels als ZIP herunter — Auto-Scroll, intelligentes Splitting bei zu langen Bildern
// @author       marmoris
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ── Site allowlist ────────────────────────────────────────────────────────
    const SITES_KEY = 'mpd-allowed-sites';
    const host      = location.hostname;
    const allowed   = GM_getValue(SITES_KEY, []);

    GM_registerMenuCommand(
        allowed.includes(host) ? 'Manga Downloader deaktivieren' : 'Manga Downloader aktivieren',
        () => {
            const updated = allowed.includes(host)
                ? allowed.filter(s => s !== host)
                : [...allowed, host];
            GM_setValue(SITES_KEY, updated);
            location.reload();
        }
    );

    if (!allowed.includes(host)) return;

    // ─────────────────────────────────────────────────────────────────────────

    const SW         = 320;
    const MIN_IMG_PX = 400;
    const MAX_SEG_H  = 2500; // px — images taller than this get split
    const MIN_SEG_H  = 600;  // minimum segment height to avoid tiny slices

    GM_addStyle(`
        html { transition: margin-left 0.3s ease !important; }
        html.mpd-pushed { margin-left: ${SW}px !important; }

        #mpd-sb {
            position: fixed;
            top: 0; left: 0;
            width: ${SW}px;
            height: 100vh;
            background: #1a1b1e;
            color: #c1c2c5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 2147483647;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            display: flex;
            flex-direction: column;
            box-shadow: 2px 0 20px rgba(0,0,0,0.6);
        }
        #mpd-sb.open { transform: translateX(0); }

        #mpd-toggle {
            position: absolute;
            right: -36px; top: 50%;
            transform: translateY(-50%);
            width: 36px; height: 72px;
            background: #2f9e44;
            color: #fff;
            border: none;
            border-radius: 0 6px 6px 0;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.5px;
            writing-mode: vertical-rl;
            padding: 8px 4px;
            transition: background 0.15s;
        }
        #mpd-toggle:hover { background: #237032; }

        #mpd-header {
            padding: 14px 16px 12px;
            border-bottom: 1px solid #2c2d32;
            font-size: 15px;
            font-weight: 700;
            color: #fff;
        }

        #mpd-controls {
            padding: 12px 16px;
            border-bottom: 1px solid #2c2d32;
            display: flex;
            flex-direction: column;
            gap: 9px;
        }

        .mpd-btn-row { display: flex; gap: 8px; }
        .mpd-btn-row button { flex: 1; }

        .mpd-btn {
            padding: 7px 12px;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
        }
        .mpd-primary { background: #2f9e44; color: #fff; }
        .mpd-primary:hover:not(:disabled) { background: #237032; }
        .mpd-primary:disabled { background: #555; cursor: not-allowed; }
        .mpd-secondary { background: #2c2d32; color: #c1c2c5; }
        .mpd-secondary:hover:not(:disabled) { background: #373a40; }
        .mpd-secondary:disabled { background: #222; color: #555; cursor: not-allowed; }

        #mpd-progress {
            height: 3px;
            background: #2c2d32;
            border-radius: 2px;
            overflow: hidden;
            display: none;
        }
        #mpd-progress-bar {
            height: 100%;
            background: #2f9e44;
            width: 0%;
            transition: width 0.2s;
        }

        #mpd-status {
            font-size: 12px;
            color: #909296;
            min-height: 16px;
        }

        #mpd-results {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
        }
        #mpd-results::-webkit-scrollbar { width: 5px; }
        #mpd-results::-webkit-scrollbar-track { background: #1a1b1e; }
        #mpd-results::-webkit-scrollbar-thumb { background: #373a40; border-radius: 3px; }

        .mpd-thumb {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px 14px;
            border-bottom: 1px solid #25262b;
        }
        .mpd-thumb img {
            width: 48px;
            height: 48px;
            object-fit: cover;
            border-radius: 3px;
            flex-shrink: 0;
            background: #25262b;
        }
        .mpd-thumb-info {
            flex: 1;
            min-width: 0;
        }
        .mpd-thumb-name {
            font-size: 11px;
            color: #909296;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .mpd-thumb-size {
            font-size: 11px;
            color: #555;
        }
        .mpd-thumb input[type=checkbox] {
            flex-shrink: 0;
            width: 15px;
            height: 15px;
            cursor: pointer;
            accent-color: #2f9e44;
        }

        #mpd-footer {
            padding: 8px 16px;
            border-top: 1px solid #2c2d32;
            font-size: 11px;
            color: #555;
        }
    `);

    // ─────────────────────────────────────────────────────────────────────────

    class MangaDownloader {
        constructor() {
            this.segments = []; // { filename, data: Uint8Array, src, w, h }
            this.scanning = false;
            this.open     = false;
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
                        <button class="mpd-btn mpd-primary"   id="mpd-scan">Scan</button>
                        <button class="mpd-btn mpd-secondary" id="mpd-dl" disabled>Download ZIP</button>
                    </div>
                    <div id="mpd-progress"><div id="mpd-progress-bar"></div></div>
                    <div id="mpd-status">Bereit.</div>
                </div>
                <div id="mpd-results"></div>
                <div id="mpd-footer"></div>
            `;
            document.body.appendChild(sb);

            document.getElementById('mpd-toggle').addEventListener('click', () => this._toggle());
            document.getElementById('mpd-scan').addEventListener('click',   () => this._scan());
            document.getElementById('mpd-dl').addEventListener('click',     () => this._download());
        }

        _toggle() {
            this.open = !this.open;
            document.getElementById('mpd-sb').classList.toggle('open', this.open);
            document.documentElement.classList.toggle('mpd-pushed', this.open);
        }

        _status(msg) { document.getElementById('mpd-status').textContent = msg; }

        _progress(pct) {
            document.getElementById('mpd-progress').style.display = (pct > 0 && pct < 100) ? 'block' : 'none';
            document.getElementById('mpd-progress-bar').style.width = `${pct}%`;
        }

        // ── SPA URL change detection ──────────────────────────────────────────

        _watchUrlChanges() {
            let lastUrl = location.href;
            const reset = () => {
                if (location.href === lastUrl || this.scanning) return;
                lastUrl = location.href;
                this._reset();
            };
            new MutationObserver(reset).observe(document.body, { childList: true, subtree: true });
            window.addEventListener('popstate', reset);
        }

        _reset() {
            this.segments = [];
            document.getElementById('mpd-results').innerHTML = '';
            document.getElementById('mpd-footer').textContent = '';
            document.getElementById('mpd-dl').disabled = true;
            this._status('Bereit.');
        }

        // ── Image detection ───────────────────────────────────────────────────

        _findImages() {
            return Array.from(document.querySelectorAll('img')).filter(img => {
                if (!img.complete || !img.naturalWidth || !img.naturalHeight) return false;
                if (img.naturalWidth < MIN_IMG_PX || img.naturalHeight < MIN_IMG_PX) return false;
                const rect = img.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return false;
                if (img.closest('nav, header, footer, aside, [class*="avatar"], [class*="logo"], [class*="banner"], [class*="ad-"]')) return false;
                const src = img.src || img.currentSrc || '';
                if (!src || src.startsWith('data:image/svg')) return false;
                return true;
            });
        }

        // ── Scroll + IntersectionObserver ─────────────────────────────────────

        async _scrollLoad() {
            await new Promise(resolve => {
                const observed = new Set();
                const io = new IntersectionObserver(entries => {
                    entries.forEach(e => { if (e.isIntersecting) observed.add(e.target); });
                }, { rootMargin: '300px' });

                const observe = () => {
                    document.querySelectorAll('img').forEach(img => {
                        if (!img.dataset.mpdObs) { img.dataset.mpdObs = '1'; io.observe(img); }
                    });
                };
                const mo = new MutationObserver(observe);
                mo.observe(document.body, { childList: true, subtree: true });
                observe();

                const step = window.innerHeight;
                let y = 0;
                const scroll = async () => {
                    while (y < document.documentElement.scrollHeight) {
                        window.scrollTo(0, y);
                        y += step;
                        await this._sleep(150);
                    }
                    window.scrollTo(0, 0);
                    await this._sleep(600);
                    io.disconnect(); mo.disconnect();
                    document.querySelectorAll('img[data-mpd-obs]')
                        .forEach(img => delete img.dataset.mpdObs);
                    resolve();
                };
                scroll();
            });
        }

        // ── Fetch image ───────────────────────────────────────────────────────

        _fetchBlob(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    responseType: 'blob',
                    headers: { 'Referer': location.href, 'Origin': location.origin },
                    onload:  r => r.status === 200 ? resolve(r.response) : reject(new Error(`HTTP ${r.status}`)),
                    onerror: () => reject(new Error('Network error')),
                });
            });
        }

        _blobToDataURL(blob) {
            return new Promise((res, rej) => {
                const reader = new FileReader();
                reader.onload  = () => res(reader.result);
                reader.onerror = rej;
                reader.readAsDataURL(blob);
            });
        }

        _dataURLtoUint8Array(dataUrl) {
            const base64 = dataUrl.split(',')[1];
            const bin    = atob(base64);
            const arr    = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return arr;
        }

        // ── Panel splitting ───────────────────────────────────────────────────
        // Scans pixel rows for bright horizontal bands (panel gaps).
        // Falls back to fixed-interval split if no gaps found.

        _findSplitPoints(data, width, height) {
            const SAMPLE   = 4;    // check every 4th pixel (speed)
            const BRIGHT   = 235;  // brightness threshold
            const COVERAGE = 0.88; // 88% bright pixels = gap row
            const splits   = [0];
            let   last     = 0;

            for (let y = MIN_SEG_H; y < height - MIN_SEG_H; y++) {
                if (y - last < MIN_SEG_H) continue;

                let light = 0, total = 0;
                for (let x = 0; x < width; x += SAMPLE) {
                    const i = (y * width + x) * 4;
                    if ((data[i] + data[i+1] + data[i+2]) / 3 > BRIGHT) light++;
                    total++;
                }

                if (light / total >= COVERAGE) {
                    splits.push(y);
                    last = y;
                    continue;
                }

                // Force split if segment exceeds max height
                if (y - last >= MAX_SEG_H) {
                    splits.push(y);
                    last = y;
                }
            }

            splits.push(height);
            return splits;
        }

        async _processImage(blob, pageNum) {
            const dataUrl = await this._blobToDataURL(blob);
            const img     = await new Promise((res, rej) => {
                const el   = new Image();
                el.onload  = () => res(el);
                el.onerror = rej;
                el.src     = dataUrl;
            });

            const { naturalWidth: w, naturalHeight: h } = img;
            const results = [];

            // No split needed
            if (h <= MAX_SEG_H) {
                results.push({
                    filename: `page_${String(pageNum).padStart(3, '0')}.jpg`,
                    data:     this._dataURLtoUint8Array(dataUrl),
                    w, h,
                    preview:  dataUrl,
                });
                return results;
            }

            // Need to split — scan for panel gaps
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const { data: pixels } = ctx.getImageData(0, 0, w, h);
            const splits = this._findSplitPoints(pixels, w, h);

            for (let i = 0; i < splits.length - 1; i++) {
                const y0 = splits[i];
                const y1 = splits[i + 1];
                const segH = y1 - y0;
                if (segH < 50) continue; // skip tiny slices

                const seg = document.createElement('canvas');
                seg.width = w; seg.height = segH;
                seg.getContext('2d').drawImage(img, 0, y0, w, segH, 0, 0, w, segH);
                const segDataUrl = seg.toDataURL('image/jpeg', 0.92);

                results.push({
                    filename: `page_${String(pageNum).padStart(3, '0')}_part${i + 1}.jpg`,
                    data:     this._dataURLtoUint8Array(segDataUrl),
                    w, h: segH,
                    preview:  segDataUrl,
                });
            }

            return results;
        }

        // ── Main scan ─────────────────────────────────────────────────────────

        async _scan() {
            if (this.scanning) return;
            this.scanning = true;
            this._reset();
            document.getElementById('mpd-scan').disabled = true;

            try {
                this._status('Scrolle zum Laden aller Bilder...');
                await this._scrollLoad();

                const imgs = this._findImages();
                if (imgs.length === 0) { this._status('Keine Panels gefunden.'); return; }

                imgs.sort((a, b) =>
                    (a.getBoundingClientRect().top + window.scrollY) -
                    (b.getBoundingClientRect().top + window.scrollY)
                );

                const resultsEl = document.getElementById('mpd-results');

                for (let i = 0; i < imgs.length; i++) {
                    this._status(`Verarbeite ${i + 1} / ${imgs.length}...`);
                    this._progress((i / imgs.length) * 100);

                    try {
                        const src  = imgs[i].src || imgs[i].currentSrc;
                        const blob = await this._fetchBlob(src);
                        const segs = await this._processImage(blob, i + 1);

                        segs.forEach(seg => {
                            this.segments.push(seg);

                            const div = document.createElement('div');
                            div.className = 'mpd-thumb';
                            div.innerHTML = `
                                <img src="${seg.preview}" loading="lazy">
                                <div class="mpd-thumb-info">
                                    <div class="mpd-thumb-name">${seg.filename}</div>
                                    <div class="mpd-thumb-size">${seg.w}×${seg.h}px</div>
                                </div>
                                <input type="checkbox" checked data-idx="${this.segments.length - 1}">
                            `;
                            resultsEl.appendChild(div);
                            div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        });

                    } catch (err) {
                        console.warn(`[MPD] Seite ${i + 1} fehlgeschlagen:`, err);
                    }
                }

                this._progress(0);
                document.getElementById('mpd-footer').textContent =
                    `${imgs.length} Bilder · ${this.segments.length} Segmente`;
                this._status(`Fertig. ${this.segments.length} Dateien bereit.`);
                document.getElementById('mpd-dl').disabled = false;

            } catch (err) {
                this._status(`Fehler: ${err?.message || String(err)}`);
                console.error('[MPD]', err);
            } finally {
                this.scanning = false;
                document.getElementById('mpd-scan').disabled = false;
            }
        }

        // ── Download ZIP ──────────────────────────────────────────────────────

        async _download() {
            const checked = Array.from(
                document.querySelectorAll('#mpd-results input[type=checkbox]:checked')
            ).map(cb => this.segments[+cb.dataset.idx]).filter(Boolean);

            if (checked.length === 0) { this._status('Keine Dateien ausgewählt.'); return; }

            this._status('Erstelle ZIP...');
            document.getElementById('mpd-dl').disabled = true;

            const zip  = new JSZip();
            checked.forEach(seg => zip.file(seg.filename, seg.data));

            const blob    = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
            const date    = new Date().toISOString().slice(0, 10);
            const chapter = location.pathname.replace(/\//g, '_').slice(1, 40) || 'chapter';
            const name    = `${host}_${chapter}_${date}.zip`;

            const a  = document.createElement('a');
            a.href   = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            URL.revokeObjectURL(a.href);

            this._status(`Heruntergeladen: ${name}`);
            document.getElementById('mpd-dl').disabled = false;
        }

        _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    }

    new MangaDownloader();
})();

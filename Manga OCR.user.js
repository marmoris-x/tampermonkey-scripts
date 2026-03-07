// ==UserScript==
// @name         Manga OCR
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  OCR für Manga/Manhwa-Kapitel — Auto-Scroll, alle Seiten, Text kopieren
// @author       marmoris
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      cdn.jsdelivr.net
// @connect      tessdata.projectnaptha.com
// @connect      *
// @run-at       document-idle
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20OCR.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20OCR.user.js
// ==/UserScript==

(function () {
    'use strict';

    const SW = 340;
    const MIN_IMG_PX = 400;

    const LANGS = [
        { code: 'eng',     label: 'English' },
        { code: 'jpn',     label: 'Japanese (日本語)' },
        { code: 'kor',     label: 'Korean (한국어)' },
        { code: 'chi_sim', label: 'Chinese Simplified (简体)' },
        { code: 'chi_tra', label: 'Chinese Traditional (繁體)' },
    ];

    // ─────────────────────────────────────────────────────────────────────────

    GM_addStyle(`
        html { transition: margin-left 0.3s ease !important; }
        html.ocr-pushed { margin-left: ${SW}px !important; }

        #ocr-sb {
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
        #ocr-sb.open { transform: translateX(0); }

        #ocr-toggle {
            position: absolute;
            right: -36px; top: 50%;
            transform: translateY(-50%);
            width: 36px; height: 72px;
            background: #e85d04;
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
        #ocr-toggle:hover { background: #c44d00; }

        #ocr-header {
            padding: 14px 16px 12px;
            border-bottom: 1px solid #2c2d32;
            font-size: 15px;
            font-weight: 700;
            color: #fff;
        }

        #ocr-controls {
            padding: 12px 16px;
            border-bottom: 1px solid #2c2d32;
            display: flex;
            flex-direction: column;
            gap: 9px;
        }

        #ocr-lang {
            background: #25262b;
            color: #c1c2c5;
            border: 1px solid #373a40;
            border-radius: 4px;
            padding: 7px 10px;
            font-size: 13px;
            width: 100%;
            cursor: pointer;
        }

        .ocr-btn-row { display: flex; gap: 8px; }
        .ocr-btn-row button { flex: 1; }

        .ocr-btn {
            padding: 7px 12px;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
        }
        .ocr-primary { background: #e85d04; color: #fff; }
        .ocr-primary:hover:not(:disabled) { background: #c44d00; }
        .ocr-primary:disabled { background: #555; cursor: not-allowed; }
        .ocr-secondary { background: #2c2d32; color: #c1c2c5; }
        .ocr-secondary:hover { background: #373a40; }

        #ocr-progress {
            height: 3px;
            background: #2c2d32;
            border-radius: 2px;
            overflow: hidden;
            display: none;
        }
        #ocr-progress-bar {
            height: 100%;
            background: #e85d04;
            width: 0%;
            transition: width 0.2s;
        }

        #ocr-status {
            font-size: 12px;
            color: #909296;
            min-height: 16px;
        }

        #ocr-results {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
        }
        #ocr-results::-webkit-scrollbar { width: 5px; }
        #ocr-results::-webkit-scrollbar-track { background: #1a1b1e; }
        #ocr-results::-webkit-scrollbar-thumb { background: #373a40; border-radius: 3px; }

        .ocr-page {
            padding: 8px 16px 10px;
            border-bottom: 1px solid #25262b;
        }
        .ocr-page-hdr {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
            font-size: 11px;
            color: #555;
        }
        .ocr-page-copy {
            background: none;
            border: none;
            color: #555;
            cursor: pointer;
            font-size: 11px;
            padding: 1px 4px;
            border-radius: 3px;
        }
        .ocr-page-copy:hover { color: #e85d04; background: #25262b; }
        .ocr-page-text {
            white-space: pre-wrap;
            line-height: 1.5;
            font-size: 12px;
            color: #c1c2c5;
            user-select: text;
        }
        .ocr-page-text.pending { color: #444; font-style: italic; }
        .ocr-page-text.error   { color: #ff6b6b; font-style: italic; }

        #ocr-footer {
            padding: 8px 16px;
            border-top: 1px solid #2c2d32;
            font-size: 11px;
            color: #555;
        }
    `);

    // ─────────────────────────────────────────────────────────────────────────

    class MangaOCR {
        constructor() {
            this.worker   = null;
            this.results  = [];
            this.scanning = false;
            this.open     = false;
            this._buildUI();
        }

        // ── UI ────────────────────────────────────────────────────────────────

        _buildUI() {
            const sb = document.createElement('div');
            sb.id = 'ocr-sb';
            sb.innerHTML = `
                <button id="ocr-toggle">OCR</button>
                <div id="ocr-header">Manga OCR</div>
                <div id="ocr-controls">
                    <select id="ocr-lang">
                        ${LANGS.map(l => `<option value="${l.code}">${l.label}</option>`).join('')}
                    </select>
                    <div class="ocr-btn-row">
                        <button class="ocr-btn ocr-primary" id="ocr-scan">Scan</button>
                        <button class="ocr-btn ocr-secondary" id="ocr-copy">Copy All</button>
                    </div>
                    <div id="ocr-progress"><div id="ocr-progress-bar"></div></div>
                    <div id="ocr-status">Bereit.</div>
                </div>
                <div id="ocr-results"></div>
                <div id="ocr-footer" id="ocr-info"></div>
            `;
            document.body.appendChild(sb);

            const saved = GM_getValue('ocr-lang', 'eng');
            const langEl = document.getElementById('ocr-lang');
            langEl.value = saved;
            langEl.addEventListener('change', e => GM_setValue('ocr-lang', e.target.value));

            document.getElementById('ocr-toggle').addEventListener('click', () => this._toggle());
            document.getElementById('ocr-scan').addEventListener('click',   () => this._scan());
            document.getElementById('ocr-copy').addEventListener('click',   () => this._copyAll());
        }

        _toggle() {
            this.open = !this.open;
            document.getElementById('ocr-sb').classList.toggle('open', this.open);
            document.documentElement.classList.toggle('ocr-pushed', this.open);
        }

        _status(msg) { document.getElementById('ocr-status').textContent = msg; }

        _progress(pct) {
            document.getElementById('ocr-progress').style.display = (pct > 0 && pct < 100) ? 'block' : 'none';
            document.getElementById('ocr-progress-bar').style.width = `${pct}%`;
        }

        // ── Image detection ───────────────────────────────────────────────────

        _findImages() {
            return Array.from(document.querySelectorAll('img')).filter(img => {
                const w = img.naturalWidth  || img.width;
                const h = img.naturalHeight || img.height;
                if (w < MIN_IMG_PX || h < MIN_IMG_PX) return false;
                if (img.closest('nav, header, footer, aside, [class*="avatar"], [class*="logo"], [class*="banner"], [class*="ad-"]')) return false;
                const src = img.src || img.currentSrc || '';
                if (!src || src.startsWith('data:image/svg')) return false;
                return true;
            });
        }

        _detectFormat(imgs) {
            if (imgs.length < 2) return 'paginated';
            const avgH = imgs.reduce((s, i) => s + (i.naturalHeight || i.height), 0) / imgs.length;
            const avgW = imgs.reduce((s, i) => s + (i.naturalWidth  || i.width),  0) / imgs.length;
            // Webtoon: tall images (height > width), multiple stacked
            return (avgH > avgW && imgs.length >= 2) ? 'webtoon' : 'paginated';
        }

        // ── Scroll to trigger lazy loading ────────────────────────────────────

        async _scrollLoad() {
            const step = window.innerHeight;
            let y = 0;
            while (y < document.documentElement.scrollHeight) {
                window.scrollTo(0, y);
                await this._sleep(200);
                y += step;
            }
            window.scrollTo(0, 0);
            await this._sleep(400);
        }

        // ── Fetch image bytes via GM_xmlhttpRequest (CORS bypass) ────────────────

        _fetchArrayBuffer(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    responseType: 'arraybuffer',
                    headers: { 'Referer': location.href, 'Accept': 'image/*,*/*;q=0.8' },
                    onload: r => {
                        console.log(`[OCR] fetch ${r.status} ${r.response?.byteLength}b`, url);
                        if (r.status !== 200 || !r.response?.byteLength)
                            reject(new Error(`HTTP ${r.status}, ${r.response?.byteLength ?? 0}b`));
                        else
                            resolve(r.response);
                    },
                    onerror: e => {
                        console.error('[OCR] network error', url, e);
                        reject(new Error(`Network error`));
                    },
                });
            });
        }

        // Primary: blob URL → canvas → ImageData (origin-independent via postMessage)
        async _toImageData(arrayBuffer) {
            const blobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
            try {
                const img = await new Promise((res, rej) => {
                    const el = new Image();
                    el.onload = () => res(el);
                    el.onerror = (e) => rej(new Error(`Image load failed: ${e?.message || e}`));
                    el.src = blobUrl;
                });
                console.log(`[OCR] canvas ${img.naturalWidth}x${img.naturalHeight}`);
                const canvas = document.createElement('canvas');
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                return ctx.getImageData(0, 0, canvas.width, canvas.height);
            } finally {
                URL.revokeObjectURL(blobUrl);
            }
        }

        // ── OCR one image with fallback chain ─────────────────────────────────────
        async _ocrImage(src) {
            console.log('[OCR] processing:', src);

            // 1. Fetch bytes
            const buf = await this._fetchArrayBuffer(src);

            // Attempt A: canvas → ImageData (most reliable for cross-origin workers)
            try {
                const imageData = await this._toImageData(buf);
                console.log('[OCR] attempt A: ImageData', imageData.width, 'x', imageData.height);
                const { data: { text } } = await this.worker.recognize(imageData);
                return text.trim();
            } catch (eA) {
                console.warn('[OCR] attempt A failed:', String(eA));
            }

            // Attempt B: Uint8Array directly (some Tesseract builds handle raw bytes)
            try {
                console.log('[OCR] attempt B: Uint8Array');
                const { data: { text } } = await this.worker.recognize(new Uint8Array(buf));
                return text.trim();
            } catch (eB) {
                console.warn('[OCR] attempt B failed:', String(eB));
            }

            // Attempt C: blob URL in main-thread context (last resort)
            try {
                const blobUrl = URL.createObjectURL(new Blob([buf]));
                console.log('[OCR] attempt C: blob URL', blobUrl);
                const { data: { text } } = await this.worker.recognize(blobUrl);
                URL.revokeObjectURL(blobUrl);
                return text.trim();
            } catch (eC) {
                console.warn('[OCR] attempt C failed:', String(eC));
            }

            throw new Error('Alle Methoden fehlgeschlagen – siehe Console');
        }

        // ── Init Tesseract worker ─────────────────────────────────────────────

        async _initWorker(lang) {
            if (this.worker) { await this.worker.terminate(); this.worker = null; }
            this._status(`Lade Sprachpaket (${lang})...`);
            this.worker = await Tesseract.createWorker(lang, 1, {
                workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/worker.min.js',
                corePath:   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
                langPath:   'https://tessdata.projectnaptha.com/4.0.0',
                logger:     () => {},
            });
        }

        // ── Main scan ─────────────────────────────────────────────────────────

        async _scan() {
            if (this.scanning) return;
            this.scanning = true;

            this.results = [];
            document.getElementById('ocr-results').innerHTML = '';
            document.getElementById('ocr-scan').disabled = true;

            try {
                this._status('Scrolle zum Laden aller Bilder...');
                await this._scrollLoad();

                // 2. Find and sort manga images by vertical position
                const imgs = this._findImages();
                if (imgs.length === 0) {
                    this._status('Keine Manga-Bilder gefunden.');
                    return;
                }
                imgs.sort((a, b) => {
                    const ay = a.getBoundingClientRect().top + window.scrollY;
                    const by = b.getBoundingClientRect().top + window.scrollY;
                    return ay - by;
                });

                const fmt = this._detectFormat(imgs);
                document.getElementById('ocr-footer').textContent =
                    `${fmt} · ${imgs.length} Seite${imgs.length !== 1 ? 'n' : ''}`;

                // 3. Init Tesseract
                const lang = document.getElementById('ocr-lang').value;
                await this._initWorker(lang);

                // 4. Build result slots in sidebar
                const resultsEl = document.getElementById('ocr-results');
                imgs.forEach((_, i) => {
                    const div = document.createElement('div');
                    div.className = 'ocr-page';
                    div.id = `ocr-p-${i}`;
                    div.innerHTML = `
                        <div class="ocr-page-hdr">
                            <span>Seite ${i + 1}</span>
                            <button class="ocr-page-copy" data-i="${i}">copy</button>
                        </div>
                        <div class="ocr-page-text pending" id="ocr-t-${i}">Wartend...</div>
                    `;
                    div.querySelector('.ocr-page-copy').addEventListener('click', () => {
                        const t = this.results[i]?.text;
                        if (t) GM_setClipboard(t);
                    });
                    resultsEl.appendChild(div);
                });

                // 5. OCR each image sequentially
                for (let i = 0; i < imgs.length; i++) {
                    this._status(`OCR Seite ${i + 1} / ${imgs.length}...`);
                    this._progress((i / imgs.length) * 100);

                    const textEl = document.getElementById(`ocr-t-${i}`);
                    try {
                        const src = imgs[i].src || imgs[i].currentSrc;
                        const text = await this._ocrImage(src);
                        this.results[i] = { text };
                        textEl.className = 'ocr-page-text';
                        textEl.textContent = text || '(kein Text erkannt)';
                    } catch (err) {
                        const msg = err?.message || String(err) || 'Unbekannter Fehler';
                        console.error(`[OCR] Seite ${i + 1} endgültig fehlgeschlagen:`, err);
                        this.results[i] = { text: '' };
                        textEl.className = 'ocr-page-text error';
                        textEl.textContent = `Fehler: ${msg}`;
                    }

                    document.getElementById(`ocr-p-${i}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }

                this._progress(0);
                this._status(`Fertig. ${imgs.length} Seiten gescannt.`);

            } catch (err) {
                const msg = err?.message || String(err) || 'Unbekannter Fehler';
                console.error('[OCR] Scan fehlgeschlagen:', err);
                this._status(`Fehler: ${msg}`);
            } finally {
                this.scanning = false;
                document.getElementById('ocr-scan').disabled = false;
            }
        }

        // ── Copy all ──────────────────────────────────────────────────────────

        _copyAll() {
            const text = this.results
                .map((r, i) => r?.text ? `--- Seite ${i + 1} ---\n${r.text}` : null)
                .filter(Boolean)
                .join('\n\n');
            if (!text) { this._status('Nichts zu kopieren.'); return; }
            GM_setClipboard(text);
            this._status('Kopiert!');
            setTimeout(() => this._status(`Fertig. ${this.results.length} Seiten gescannt.`), 1500);
        }

        _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    }

    new MangaOCR();
})();

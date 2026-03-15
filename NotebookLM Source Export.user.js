// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Automated extraction of source files from NotebookLM with a status interface.
// @author       marmoris
// @match        https://notebooklm.google.com/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // ⚙️ SYSTEM CONFIGURATION
    // ============================================================
    const CONFIG = {
        selectors: {
            list: '.single-source-container',
            title: '.source-title',
            closeBtn: 'button[mattooltip="Quellenansicht schließen"]',
            content: 'labs-tailwind-structural-element-view-v2',
            notebookTitle: '.title-label-inner.mat-title-large'
        },
        ui: {
            id: 'nlm-export-ui',
            width: '450px'
        },
        audio: {
            enabled: true,
            vol: 0.15
        }
    };

    // ============================================================
    // ⏱️ TIMING CONSTANTS (Tunable parameters)
    // ============================================================
    const TIMING = {
        CONTENT_POLL_ATTEMPTS: 15,          // Max attempts to find loaded content
        CONTENT_POLL_INTERVAL_MS: 200,      // Delay between polls in milliseconds
        CONTENT_RENDER_DELAY_MS: 1200,      // Wait for DOM rendering after click (don't reduce — risks empty exports)
        CONTENT_GONE_ATTEMPTS: 15,          // Max attempts to confirm content closed
        MIN_CONTENT_LENGTH_CHARS: 20,       // Minimum valid content size
        SOURCE_CLOSE_WAIT_MS: 1500,         // (reserved — currently using CONTENT_POLL_INTERVAL_MS for close wait)
        KEEP_ALIVE_VOLUME: 0.001,           // Silent audio for keep-alive
        LOG_MAX_ENTRIES: 50,                // Maximum terminal log entries
        AUDIO_NOTE_DELAYS_MS: [0, 100, 200] // Completion chord timing
    };

    // ============================================================
    // 📋 LOG LEVELS (Type-safe constants)
    // ============================================================
    const LOG_LEVEL = {
        INFO: 'info',
        SUCCESS: 'success',
        WARN: 'warn',
        ERROR: 'error'
    };

    // ============================================================
    // 📊 APP STATE
    // ============================================================
    const STATE = {
        isCancelled: false,
        keepAliveAudio: null,
        menuStartId: null,
        menuStopId: null
    };

    // ============================================================
    // 🎨 CSS (High-End Interface)
    // ============================================================
    const STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');

        #${CONFIG.ui.id} {
            position: fixed;
            top: 20px;
            right: 20px;
            width: ${CONFIG.ui.width};
            background: rgba(15, 15, 20, 0.9);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-left: 4px solid #3b82f6; /* Serious Blue */
            border-radius: 8px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 15px rgba(59, 130, 246, 0.1);
            color: #e2e8f0;
            font-family: 'Inter', sans-serif;
            z-index: 99999999;
            overflow: hidden;
            transition: opacity 0.3s ease;
            animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #${CONFIG.ui.id}.minimized {
            height: 48px;
            width: 220px;
            border-left: 4px solid #64748b;
        }

        /* Header */
        .nlm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            cursor: move;
            user-select: none;
        }

        .nlm-title {
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #60a5fa;
        }

        .nlm-controls {
            display: flex;
            gap: 12px;
        }

        .nlm-btn-icon {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.4);
            cursor: pointer;
            font-size: 14px;
            transition: color 0.2s;
        }
        .nlm-btn-icon:hover { color: #fff; }

        /* Body */
        .nlm-body {
            padding: 20px;
        }

        /* Status Bar */
        .nlm-status-box {
            margin-bottom: 15px;
        }
        .nlm-progress-container {
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }
        .nlm-progress-bar {
            height: 100%;
            width: 0%;
            background: #3b82f6;
            transition: width 0.3s ease;
        }
        .nlm-status-text {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            font-family: 'JetBrains Mono', monospace;
        }

        /* Terminal Log */
        .nlm-terminal {
            height: 140px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 4px;
            padding: 10px;
            overflow-y: auto;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            color: #94a3b8;
            margin-bottom: 20px;
        }
        .nlm-log-entry { margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nlm-log-info { color: #94a3b8; }
        .nlm-log-success { color: #4ade80; }
        .nlm-log-warn { color: #fbbf24; }
        .nlm-log-error { color: #f87171; }

        /* Action Button */
        .nlm-action-btn {
            width: 100%;
            padding: 10px;
            background: #3b82f6;
            border: 1px solid #2563eb;
            color: #fff;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s;
            border-radius: 4px;
        }
        .nlm-action-btn:hover {
            background: #2563eb;
            box-shadow: 0 0 15px rgba(37, 99, 235, 0.4);
        }
        .nlm-action-btn:disabled {
            background: #1e293b;
            border-color: #334155;
            color: #475569;
            cursor: not-allowed;
            box-shadow: none;
        }
        .nlm-stop-btn {
            width: 100%;
            padding: 10px;
            background: transparent;
            border: 1px solid #ef4444;
            color: #ef4444;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            border-radius: 4px;
            margin-top: 8px;
            display: none;
        }
        .nlm-stop-btn:hover { background: rgba(239, 68, 68, 0.1); }

        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .nlm-terminal::-webkit-scrollbar { width: 4px; }
        .nlm-terminal::-webkit-scrollbar-track { background: transparent; }
        .nlm-terminal::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    `;

    // ============================================================
    // 🔊 AUDIO ENGINE (Minimalist)
    // ============================================================
    const SoundFX = {
        _ctx: null,
        get ctx() {
            if (!this._ctx && CONFIG.audio.enabled) {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            return this._ctx;
        },
        playTone: function(freq, type, duration, vol = CONFIG.audio.vol) {
            if(!CONFIG.audio.enabled) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        },
        playStart: function() {
            this.playTone(600, 'sine', 0.15);
        },
        playError: function() {
            this.playTone(150, 'sawtooth', 0.3);
        },
        playComplete: function() {
            // Completion chord: A major (440Hz=A, 554Hz≈C#, 659Hz=E)
            const notes = [
                { freq: 440, duration: 0.6, delay: TIMING.AUDIO_NOTE_DELAYS_MS[0] },
                { freq: 554, duration: 0.6, delay: TIMING.AUDIO_NOTE_DELAYS_MS[1] },
                { freq: 659, duration: 0.8, delay: TIMING.AUDIO_NOTE_DELAYS_MS[2] }
            ];
            notes.forEach(n => setTimeout(() => this.playTone(n.freq, 'sine', n.duration), n.delay));
        }
    };

    // ============================================================
    // 🖥️ UI ENGINE
    // ============================================================
    function init() {
        // Prevent double-init (user clicked menu command while UI is already open)
        if (document.getElementById(CONFIG.ui.id)) return;

        const hud = document.createElement('div');
        hud.id = CONFIG.ui.id;
        hud.innerHTML = `
            <div class="nlm-header" id="nlm-drag-handle">
                <div class="nlm-title">NotebookLM Export</div>
                <div class="nlm-controls">
                    <button class="nlm-btn-icon" id="nlm-min-btn">_</button>
                    <button class="nlm-btn-icon" id="nlm-close-btn">✕</button>
                </div>
            </div>
            <div class="nlm-body" id="nlm-body-content">
                <div class="nlm-status-box">
                    <div class="nlm-status-text">
                        <span id="nlm-status-label">Ready</span>
                        <span id="nlm-percent">0%</span>
                    </div>
                    <div class="nlm-progress-container">
                        <div class="nlm-progress-bar" id="nlm-progress"></div>
                    </div>
                </div>
                <div class="nlm-terminal" id="nlm-terminal">
                    <div class="nlm-log-entry nlm-log-${LOG_LEVEL.INFO}">> Interface loaded.</div>
                    <div class="nlm-log-entry nlm-log-${LOG_LEVEL.INFO}">> Waiting for user command...</div>
                </div>
                <button class="nlm-action-btn" id="nlm-start-btn">Start Extraction</button>
                <button class="nlm-stop-btn" id="nlm-stop-btn">Stop</button>
            </div>
        `;
        document.body.appendChild(hud);

        document.getElementById('nlm-close-btn').onclick = () => hud.remove();
        document.getElementById('nlm-min-btn').onclick = () => {
            hud.classList.toggle('minimized');
            const body = document.getElementById('nlm-body-content');
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        };
        document.getElementById('nlm-start-btn').onclick = runProcess;
        document.getElementById('nlm-stop-btn').onclick = () => {
            STATE.isCancelled = true;
            log("Stop requested by user.", LOG_LEVEL.WARN);
        };

        // Drag logic — pointer capture ensures mouseup is never lost if cursor leaves window
        const header = document.getElementById('nlm-drag-handle');
        let initialX, initialY, xOffset = 0, yOffset = 0, dragInitialized = false;

        const onPointerMove = (e) => {
            const rawX = e.clientX - initialX;
            const rawY = e.clientY - initialY;
            xOffset = Math.max(0, Math.min(rawX, window.innerWidth - hud.offsetWidth));
            yOffset = Math.max(0, Math.min(rawY, window.innerHeight - hud.offsetHeight));
            hud.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
        };
        const onPointerUp = (e) => {
            header.releasePointerCapture(e.pointerId);
            header.removeEventListener('pointermove', onPointerMove);
            header.removeEventListener('pointerup', onPointerUp);
        };
        header.addEventListener('pointerdown', (e) => {
            if (e.target === header || e.target.parentNode === header) {
                if (!dragInitialized) {
                    // Sync xOffset/yOffset with actual rendered position (CSS right: 20px → left-based coords)
                    const rect = hud.getBoundingClientRect();
                    xOffset = rect.left;
                    yOffset = rect.top;
                    hud.style.right = 'auto';
                    hud.style.top = '0';
                    hud.style.left = '0';
                    hud.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
                    dragInitialized = true;
                }
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                header.setPointerCapture(e.pointerId);
                header.addEventListener('pointermove', onPointerMove);
                header.addEventListener('pointerup', onPointerUp);
            }
        });

    }

    // ============================================================
    // 📋 MENU COMMANDS
    // ============================================================
    function registerMenuStart() {
        STATE.menuStartId = GM_registerMenuCommand('▶ Start Export', () => init());
    }
    function registerMenuStop() {
        STATE.menuStopId = GM_registerMenuCommand('⏹ Stop Export', () => {
            STATE.isCancelled = true;
            log("Stop requested via menu.", LOG_LEVEL.WARN);
        });
    }

    // ============================================================
    // 🧠 LOGIC ENGINE
    // ============================================================
    function log(msg, type = 'info') {
        const term = document.getElementById('nlm-terminal');
        if (!term) return;
        const entry = document.createElement('div');
        entry.className = `nlm-log-entry nlm-log-${type}`;
        const time = new Date().toLocaleTimeString(undefined, { hour12: false });
        entry.innerText = `[${time}] ${msg}`;
        term.appendChild(entry);

        // Limit terminal logs to prevent memory leak
        while (term.children.length > TIMING.LOG_MAX_ENTRIES) {
            term.removeChild(term.firstChild);
        }
        term.scrollTop = term.scrollHeight;
    }

    function updateProgress(current, total) {
        const percent = Math.round((current / total) * 100);
        document.getElementById('nlm-progress').style.width = `${percent}%`;
        document.getElementById('nlm-percent').innerText = `${percent}%`;
        document.getElementById('nlm-status-label').innerText = `Processing: ${current}/${total}`;
    }

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function startKeepAlive() {
        STATE.keepAliveAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA");
        STATE.keepAliveAudio.loop = true;
        STATE.keepAliveAudio.volume = TIMING.KEEP_ALIVE_VOLUME;
        STATE.keepAliveAudio.play().catch(() => {
            log("Keep-alive audio blocked by browser. Tab may throttle if left in background.", LOG_LEVEL.WARN);
        });
    }
    function stopKeepAlive() {
        if (STATE.keepAliveAudio) {
            STATE.keepAliveAudio.pause();
            STATE.keepAliveAudio = null;
        }
    }

    function cleanupRun(startBtn) {
        stopKeepAlive();
        const stopBtn = document.getElementById('nlm-stop-btn');
        if (stopBtn) stopBtn.style.display = 'none';
        GM_unregisterMenuCommand(STATE.menuStopId);
        registerMenuStart();
        startBtn.disabled = false;
    }

    async function runProcess() {
        const startBtn = document.getElementById('nlm-start-btn');
        STATE.isCancelled = false;
        updateProgress(0, 1); // Reset progress bar on each run
        startBtn.disabled = true;
        startBtn.innerText = "Running...";
        document.getElementById('nlm-stop-btn').style.display = 'block';

        // Swap Tampermonkey popup button: Start → Stop
        GM_unregisterMenuCommand(STATE.menuStartId);
        registerMenuStop();

        startKeepAlive();
        SoundFX.playStart(); // Safe here — user clicked "Start Extraction" (real user gesture)

        const totalSources = document.querySelectorAll(CONFIG.selectors.list).length;

        if (totalSources === 0) {
            log("Error: No sources found.", LOG_LEVEL.ERROR);
            SoundFX.playError();
            cleanupRun(startBtn);
            startBtn.innerText = "Retry";
            return;
        }

        log(`Scan complete. Found ${totalSources} items.`, LOG_LEVEL.SUCCESS);
        log("Keep this tab active — background tabs may throttle timers.", LOG_LEVEL.WARN);

        const collectedFiles = []; // { name, text }
        let crashed = false;

        try { for (let i = 0; i < totalSources; i++) {
            if (STATE.isCancelled) break;
            updateProgress(i + 1, totalSources);

            // Re-query each iteration — Angular may re-render the list after open/close,
            // making the initial `sources` NodeList contain detached (stale) nodes.
            const source = document.querySelectorAll(CONFIG.selectors.list)[i];

            if (!source) {
                log(`Source index ${i+1} not found. Skipping.`, LOG_LEVEL.ERROR);
                continue;
            }

            const titleEl = source.querySelector(CONFIG.selectors.title);
            let fileName = (titleEl?.textContent?.trim() || `Source_${i+1}`)
                .replace(/[\\/:*?"<>|]/g, '_') // Strip OS-illegal filename characters
                .substring(0, 120)             // Cap length for OS path limits
                .trim();
            if (!fileName.endsWith('.md')) fileName += '.md';

            log(`Opening: ${fileName}`, LOG_LEVEL.INFO);
            document.getElementById('nlm-status-label').innerText = `${i + 1}/${totalSources}: ${fileName}`;

            source.scrollIntoView({ block: 'center' });
            await wait(100); // Brief pause for SPA to settle after scroll
            (titleEl || source).click();

            // Wait logic
            let found = false;
            for(let attempt = 0; attempt < TIMING.CONTENT_POLL_ATTEMPTS; attempt++) {
                await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
                if(document.querySelector(CONFIG.selectors.content)) {
                    found = true;
                    break;
                }
            }

            if(found) {
                await wait(TIMING.CONTENT_RENDER_DELAY_MS); // Wait for rendering
                const allContent = document.querySelectorAll(CONFIG.selectors.content);
                // Filter out nested elements (e.g. inside table cells) — only process top-level blocks
                const lines = Array.from(allContent).filter(
                    el => !el.parentElement.closest(CONFIG.selectors.content)
                );
                const textLines = lines.map(l => htmlToMarkdown(l));
                const text = textLines.join("\n\n");

                if(text.length > TIMING.MIN_CONTENT_LENGTH_CHARS) {
                    collectedFiles.push({ name: fileName, text });
                    log(`>> Queued: ${fileName} (${text.length} chars)`, LOG_LEVEL.SUCCESS);
                } else {
                    log(">> Warning: Content empty", LOG_LEVEL.WARN);
                }
            } else {
                log(">> Timeout: Content load failed", LOG_LEVEL.ERROR);
            }

            attemptClose();
            // Wait for content to fully leave the DOM before next iteration (prevents stale reads)
            for (let attempt = 0; attempt < TIMING.CONTENT_GONE_ATTEMPTS; attempt++) {
                await wait(TIMING.CONTENT_POLL_INTERVAL_MS);
                if (!document.querySelector(CONFIG.selectors.content)) break;
            }
        } } catch (e) {
            log(`Unexpected error: ${e.message}`, LOG_LEVEL.ERROR);
            startBtn.innerText = "Retry";
            crashed = true;
        } finally {
            cleanupRun(startBtn);
        }

        if (crashed) return;

        if (STATE.isCancelled) {
            log("Extraction stopped by user.", LOG_LEVEL.WARN);
            document.getElementById('nlm-status-label').innerText = "Stopped";
            startBtn.innerText = "Start Extraction";
        } else {
            updateProgress(totalSources, totalSources);

            if (collectedFiles.length > 0) {
                log(`Building ZIP with ${collectedFiles.length} file(s)...`, LOG_LEVEL.INFO);
                const notebookTitle = document.querySelector(CONFIG.selectors.notebookTitle)?.textContent?.trim() || 'NotebookLM';
                const zipName = notebookTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() + '.zip';
                let zipBlob;
                try {
                    zipBlob = buildZip(collectedFiles);
                } catch (e) {
                    log(`ZIP build failed: ${e.message}`, LOG_LEVEL.ERROR);
                    startBtn.innerText = "Retry";
                    return;
                }
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = zipName;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
                log("ZIP downloaded.", LOG_LEVEL.SUCCESS);
            } else {
                log("No files to export.", LOG_LEVEL.WARN);
            }

            log("Process successfully completed.", LOG_LEVEL.SUCCESS);
            document.getElementById('nlm-status-label').innerText = "Complete";
            startBtn.innerText = "Done";
            SoundFX.playComplete();
        }
    }

    function attemptClose() {
        // Primary: language-independent icon button (most reliable)
        for (const btn of document.querySelectorAll('button')) {
            if (btn.textContent.includes('collapse_content')) {
                btn.click();
                return;
            }
        }
        // Fallback 1: locale-specific tooltip (German UI)
        const localizedBtn = document.querySelector(CONFIG.selectors.closeBtn);
        if (localizedBtn) {
            localizedBtn.click();
            return;
        }
        // Fallback 2: Escape key
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    }

    // Converts a DOM element to Markdown, preserving links, headers, bold, lists, etc.
    function htmlToMarkdown(el) {
        function convert(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = node.tagName.toLowerCase();
            const inner = () => Array.from(node.childNodes).map(convert).join('');

            switch (tag) {
                case 'h1': return `# ${inner()}\n\n`;
                case 'h2': return `## ${inner()}\n\n`;
                case 'h3': return `### ${inner()}\n\n`;
                case 'h4': return `#### ${inner()}\n\n`;
                case 'h5': return `##### ${inner()}\n\n`;
                case 'h6': return `###### ${inner()}\n\n`;
                case 'p':  return `${inner()}\n\n`;
                case 'br': return '\n';
                case 'strong': case 'b': return `**${inner()}**`;
                case 'em':     case 'i': return `*${inner()}*`;
                case 'a': {
                    let href = node.getAttribute('href') || '';
                    if (href.includes('google.com/url')) {
                        try { href = new URL(href).searchParams.get('q') || href; } catch(_) {}
                    }
                    const text = inner();
                    return href ? `[${text}](${href})` : text;
                }
                case 'ul': return `${inner()}\n`;
                case 'ol': return `${inner()}\n`;
                case 'li': {
                    // Walk up ancestors since NotebookLM may nest li inside custom elements
                    let ancestor = node.parentElement;
                    while (ancestor && !['ul', 'ol'].includes(ancestor.tagName.toLowerCase())) {
                        ancestor = ancestor.parentElement;
                    }
                    if (ancestor?.tagName.toLowerCase() === 'ol') {
                        // Count li siblings in the ol at the same depth (handles custom element wrappers)
                        const allLis = Array.from(ancestor.querySelectorAll('li'));
                        const nodeIndex = allLis.indexOf(node);
                        // Count only li elements that share the same ol ancestor (not nested ols)
                        let index = 1;
                        for (let j = 0; j < nodeIndex; j++) {
                            let a = allLis[j].parentElement;
                            while (a && !['ul', 'ol'].includes(a.tagName.toLowerCase())) a = a.parentElement;
                            if (a === ancestor) index++;
                        }
                        return `${index}. ${inner().trim()}\n`;
                    }
                    return `- ${inner().trim()}\n`;
                }
                case 'div': {
                    const ariaLevel = node.getAttribute('aria-level');
                    if (ariaLevel) {
                        const hashes = '#'.repeat(Math.min(parseInt(ariaLevel), 6));
                        return `${hashes} ${inner().trim()}\n\n`;
                    }
                    if (/^-{10,}$/.test(node.textContent.trim())) return `---\n\n`;
                    return inner();
                }
                case 's': case 'del': case 'strike': return `~~${inner()}~~`;
                case 'u': return `__${inner()}__`;
                case 'code': {
                    if (node.parentElement?.tagName.toLowerCase() === 'pre') return inner();
                    return `\`${inner()}\``;
                }
                case 'pre': {
                    const codeEl = node.querySelector('code');
                    const langSource = codeEl || node;
                    const lang = langSource.getAttribute('data-language')
                        || langSource.className.match(/language-(\S+)/)?.[1]
                        || langSource.className.match(/lang-(\S+)/)?.[1]
                        || '';
                    return `\`\`\`${lang}\n${codeEl ? codeEl.innerText : inner()}\n\`\`\`\n\n`;
                }
                case 'blockquote': return inner().trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
                case 'hr': return `---\n\n`;
                case 'img': {
                    const src = node.getAttribute('src') || '';
                    const alt = node.getAttribute('alt') || '';
                    return `![${alt}](${src})`;
                }
                case 'table': {
                    const rows = Array.from(node.querySelectorAll('tr'));
                    if (!rows.length) return inner();
                    const toRow = cells => '| ' + cells.map(c => c.innerText.trim().replace(/\|/g, '\\|')).join(' | ') + ' |';
                    const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
                    const header = toRow(headerCells);
                    const separator = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
                    const body = rows.slice(1).map(r => toRow(Array.from(r.querySelectorAll('td')))).join('\n');
                    return [header, separator, body].filter(Boolean).join('\n') + '\n\n';
                }
                default: return inner();
            }
        }
        return convert(el).replace(/\n{3,}/g, '\n\n').trim();
    }

    // Minimal synchronous ZIP builder (STORE, no compression, no external library)
    function buildZip(files) {
        const enc = new TextEncoder();

        // CRC-32 lookup table
        const crcTable = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[i] = c;
        }
        function crc32(u8) {
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < u8.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ u8[i]) & 0xFF];
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
        function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
        function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }

        const localParts = [];
        const centralParts = [];
        const entries = [];
        let localOffset = 0;

        for (const { name, text } of files) {
            const nameBytes = enc.encode(name);
            const data = enc.encode(text);
            const crc = crc32(data);

            // Local file header (30 bytes)
            const local = new Uint8Array([
                0x50, 0x4B, 0x03, 0x04,  // signature
                20, 0,                    // version needed
                ...u16(0x0800),           // flags: Language Encoding Flag (UTF-8 filenames)
                0, 0,                     // compression: STORE
                0, 0, 0, 0,               // mod time + mod date
                ...u32(crc),
                ...u32(data.length),      // compressed size
                ...u32(data.length),      // uncompressed size
                ...u16(nameBytes.length),
                0, 0,                     // extra field length
            ]);

            entries.push({ offset: localOffset, nameBytes, crc, size: data.length });
            localParts.push(local, nameBytes, data);
            localOffset += local.length + nameBytes.length + data.length;
        }

        // Central directory
        let centralSize = 0;
        for (const { offset, nameBytes, crc, size } of entries) {
            const ch = new Uint8Array([
                0x50, 0x4B, 0x01, 0x02,  // signature
                20, 0,                    // version made by
                20, 0,                    // version needed
                ...u16(0x0800),           // flags: Language Encoding Flag (UTF-8 filenames)
                0, 0,                     // compression: STORE
                0, 0, 0, 0,               // mod time + mod date
                ...u32(crc),
                ...u32(size),             // compressed size
                ...u32(size),             // uncompressed size
                ...u16(nameBytes.length),
                0, 0,                     // extra length
                0, 0,                     // comment length
                0, 0,                     // disk number start
                0, 0,                     // internal file attributes
                0, 0, 0, 0,               // external file attributes
                ...u32(offset),           // local header offset
            ]);
            centralParts.push(ch, nameBytes);
            centralSize += ch.length + nameBytes.length;
        }

        // End of central directory record (22 bytes)
        const eocd = new Uint8Array([
            0x50, 0x4B, 0x05, 0x06,  // signature
            0, 0,                     // disk number
            0, 0,                     // disk with central dir
            ...u16(entries.length),   // entries on this disk
            ...u16(entries.length),   // total entries
            ...u32(centralSize),
            ...u32(localOffset),      // central dir offset
            0, 0,                     // comment length
        ]);

        return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
    }

    // Inject CSS via extension API — bypasses page CSP entirely
    GM_addStyle(STYLES);

    // Register Tampermonkey popup button
    registerMenuStart();

})();
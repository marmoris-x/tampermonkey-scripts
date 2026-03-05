// ==UserScript==
// @name         NotebookLM Source Export
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Automated extraction of source files from NotebookLM with a status interface.
// @author       marmoris
// @match        https://notebooklm.google.com/*
// @grant        GM_addStyle
// @run-at       context-menu
// @icon         https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
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
            content: 'labs-tailwind-structural-element-view-v2'
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
            transition: opacity 0.3s ease, transform 0.3s ease;
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

        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .nlm-terminal::-webkit-scrollbar { width: 4px; }
        .nlm-terminal::-webkit-scrollbar-track { background: transparent; }
        .nlm-terminal::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    `;

    // ============================================================
    // 🔊 AUDIO ENGINE (Minimalist)
    // ============================================================
    const SoundFX = {
        ctx: new (window.AudioContext || window.webkitAudioContext)(),
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
            // Ein angenehmer, harmonischer Akkord am Ende
            setTimeout(() => this.playTone(440, 'sine', 0.6), 0);
            setTimeout(() => this.playTone(554, 'sine', 0.6), 100);
            setTimeout(() => this.playTone(659, 'sine', 0.8), 200);
        }
    };

    // ============================================================
    // 🖥️ UI ENGINE
    // ============================================================
    function init() {
        const styleEl = document.createElement('style');
        styleEl.innerHTML = STYLES;
        document.head.appendChild(styleEl);

        const oldUI = document.getElementById(CONFIG.ui.id);
        if (oldUI) oldUI.remove();

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
                    <div class="nlm-log-entry nlm-log-info">> Interface loaded.</div>
                    <div class="nlm-log-entry nlm-log-info">> Waiting for user command...</div>
                </div>
                <button class="nlm-action-btn" id="nlm-start-btn">Start Extraction</button>
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

        // Drag logic
        const header = document.getElementById('nlm-drag-handle');
        let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

        header.onmousedown = (e) => {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            if (e.target === header || e.target.parentNode === header) isDragging = true;
        };
        document.onmouseup = () => isDragging = false;
        document.onmousemove = (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                hud.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        };

        SoundFX.playStart();
    }

    // ============================================================
    // 🧠 LOGIC ENGINE
    // ============================================================
    function log(msg, type = 'info') {
        const term = document.getElementById('nlm-terminal');
        const entry = document.createElement('div');
        entry.className = `nlm-log-entry nlm-log-${type}`;
        const time = new Date().toLocaleTimeString('de-DE', { hour12: false });
        entry.innerText = `[${time}] ${msg}`;
        term.appendChild(entry);
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
        const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAEA");
        audio.loop = true;
        audio.volume = 0.001;
        audio.play().catch(() => {});
    }

    async function runProcess() {
        const startBtn = document.getElementById('nlm-start-btn');
        startBtn.disabled = true;
        startBtn.innerText = "Running...";

        startKeepAlive();
        SoundFX.playStart();

        const totalSources = document.querySelectorAll(CONFIG.selectors.list).length;

        if (totalSources === 0) {
            log("Error: No sources found.", "error");
            SoundFX.playError();
            startBtn.disabled = false;
            startBtn.innerText = "Retry";
            return;
        }

        log(`Scan complete. Found ${totalSources} items.`, "success");

        for (let i = 0; i < totalSources; i++) {
            updateProgress(i + 1, totalSources);

            const list = document.querySelectorAll(CONFIG.selectors.list);
            const source = list[i];

            if (!source) {
                log(`Source index ${i+1} invalid. Retrying structure...`, "error");
                continue;
            }

            const titleEl = source.querySelector(CONFIG.selectors.title);
            let fileName = titleEl ? titleEl.innerText.trim() : `Source_${i+1}`;
            if (!fileName.endsWith('.txt')) fileName += '.txt';

            log(`Opening: ${fileName}`, "info");

            (titleEl || source).click();

            // Wait logic
            let found = false;
            for(let attempt = 0; attempt < 15; attempt++) {
                await wait(500);
                if(document.querySelector(CONFIG.selectors.content)) {
                    found = true;
                    break;
                }
            }

            if(found) {
                await wait(1200); // Wait for rendering
                const lines = document.querySelectorAll(CONFIG.selectors.content);
                let text = "";
                lines.forEach(l => text += l.innerText + "\n");

                if(text.length > 20) {
                    downloadFile(fileName, text);
                    log(`>> Saved (${text.length} bytes)`, "success");
                    // KEIN Sound hier, wie gewünscht
                } else {
                    log(">> Warning: Content empty", "warn");
                }
            } else {
                log(">> Timeout: Content load failed", "error");
            }

            await attemptClose();
            await wait(1500);
        }

        updateProgress(totalSources, totalSources);
        log("Process successfully completed.", "success");
        document.getElementById('nlm-status-label').innerText = "Complete";
        startBtn.innerText = "Done";

        // Ton nur am Ende
        SoundFX.playComplete();
    }

    async function attemptClose() {
        const closeBtn = document.querySelector(CONFIG.selectors.closeBtn);
        if(closeBtn) {
            closeBtn.click();
        } else {
            const buttons = Array.from(document.querySelectorAll('button'));
            const magicBtn = buttons.find(b => b.innerHTML.includes('collapse_content'));
            if(magicBtn) magicBtn.click();
            else {
                document.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape'}));
            }
        }
    }

    function downloadFile(filename, content) {
        const blob = new Blob([content], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
    }

    init();

})();
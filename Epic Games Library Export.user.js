// ==UserScript==
// @name         Epic Games Library Export
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  High-Performance Exporter. Start via Tampermonkey menu.
// @author       marmoris
// @match        https://www.epicgames.com/account/transactions*
// @icon         https://static-assets-prod.epicgames.com/epic-store/static/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Epic%20Games%20Library%20Export.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Epic%20Games%20Library%20Export.user.js
// ==/UserScript==

(function() {
    'use strict';

    GM_registerMenuCommand('Epic Library Export starten', run);

    function run() {

    // Falls das Panel bereits offen ist, Fokus darauf setzen statt neu zu erstellen
    if (document.getElementById('ep-panel')) {
        document.getElementById('ep-panel').classList.remove('ep-hidden');
        document.getElementById('ep-minimized').classList.remove('ep-visible');
        return;
    }

    // --- KONFIGURATION ---
    const CONFIG = {
        selector: '.am-hoct6b',
        ignoreList: ['Standard Edition', 'Add-On', 'Season Pass', 'Saisonpass', 'Demo', 'Free', 'Kostenlos'],
    };

    // --- CSS STYLING ---
    const STYLES = `
        #ep-panel {
            position: fixed; top: 100px; right: 30px; width: 320px;
            background: rgba(20, 20, 20, 0.98); color: #f0f0f0; z-index: 99999;
            border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            font-family: 'Segoe UI', Roboto, Helvetica, sans-serif; font-size: 13px;
            border: 1px solid #333; backdrop-filter: blur(10px);
            transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
            opacity: 0; animation: epFadeIn 0.3s forwards;
        }
        @keyframes epFadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }

        #ep-panel.ep-hidden { opacity: 0; pointer-events: none; transform: translateX(50px); }

        #ep-header {
            background: linear-gradient(90deg, #0a0a0a 0%, #1a1a1a 100%);
            padding: 14px 18px; border-bottom: 1px solid #333;
            border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;
            font-weight: 700; letter-spacing: 0.5px; user-select: none;
        }
        #ep-header span { color: #f1c40f; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; margin-left:5px; }

        .ep-close-btn {
            cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
            border-radius: 50%; color: #666; transition: all 0.2s; font-size: 16px; line-height: 1;
        }
        .ep-close-btn:hover { background: #d63031; color: #fff; }

        #ep-body { padding: 20px; }
        .ep-stat { display: flex; justify-content: space-between; margin-bottom: 8px; color: #888; font-size: 12px; }
        .ep-stat b { color: #fff; font-weight: 600; font-family: monospace; font-size: 13px; }

        .ep-bar-bg { height: 4px; background: #333; margin: 18px 0; border-radius: 2px; overflow: hidden; }
        .ep-bar-fill { height: 100%; background: #f1c40f; width: 0%; transition: width 0.2s linear; }

        .ep-btn-group { display: flex; gap: 10px; margin-top: 10px; }
        .ep-btn {
            flex: 1; padding: 10px; border: none; border-radius: 6px;
            cursor: pointer; font-weight: 600; font-size: 11px;
            text-transform: uppercase; color: white; transition: all 0.1s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .ep-btn:hover { transform: translateY(-1px); filter: brightness(1.15); }

        .btn-start { background: linear-gradient(135deg, #0078f2, #095fb5); }
        .btn-stop { background: linear-gradient(135deg, #d63031, #c0392b); display: none; }
        .btn-action { background: #2d3436; border: 1px solid #444; }
        .btn-copy { background: linear-gradient(135deg, #00b894, #00a884); }

        #ep-export-area { border-top: 1px solid #333; margin-top: 15px; padding-top: 15px; display: none; opacity: 0; }
        .ep-msg { font-size: 10px; color: #666; margin-top: 10px; text-align: center; height: 14px; }

        #ep-minimized {
            position: fixed; top: 110px; right: 0; background: #f1c40f; color: #111;
            padding: 12px 10px 12px 14px; border-radius: 30px 0 0 30px;
            box-shadow: -2px 2px 10px rgba(0,0,0,0.3); cursor: pointer; z-index: 99998;
            font-weight: 800; font-size: 12px; transition: transform 0.3s;
            transform: translateX(100%); display: flex; align-items: center; gap: 5px;
        }
        #ep-minimized.ep-visible { transform: translateX(0); }
    `;

    GM_addStyle(STYLES);

    // --- HTML UI ---
    const uiContainer = document.createElement('div');
    uiContainer.id = 'ep-container-root';
    uiContainer.innerHTML = `
        <div id="ep-minimized">
            <span>TURBO</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 18l-6-6 6-6"/></svg>
        </div>

        <div id="ep-panel">
            <div id="ep-header">
                <div>EPIC<span>TURBO</span></div>
                <div id="ep-close" class="ep-close-btn" title="Schließen">✕</div>
            </div>
            <div id="ep-body">
                <div class="ep-stat"><span>STATUS</span><b id="ep-status">Bereit</b></div>
                <div class="ep-stat"><span>SPIELE</span><b id="ep-count">0</b></div>
                <div class="ep-stat"><span>SEITE</span><b id="ep-page">1</b></div>
                <div class="ep-bar-bg"><div id="ep-progress" class="ep-bar-fill"></div></div>
                <div class="ep-btn-group">
                    <button id="btn-start" class="ep-btn btn-start">Start</button>
                    <button id="btn-stop" class="ep-btn btn-stop">Stop</button>
                </div>
                <div id="ep-export-area">
                    <div style="margin-bottom:10px; font-weight:bold; color:#ccc; font-size:11px; text-transform:uppercase;">Exportieren</div>
                    <div class="ep-btn-group">
                        <button id="btn-txt" class="ep-btn btn-action">TXT</button>
                        <button id="btn-csv" class="ep-btn btn-action">CSV</button>
                    </div>
                    <div class="ep-btn-group">
                        <button id="btn-copy" class="ep-btn btn-copy">Kopieren</button>
                    </div>
                </div>
                <div id="ep-msg" class="ep-msg"></div>
            </div>
        </div>
    `;
    document.body.appendChild(uiContainer);

    // --- REFERENZEN & LOGIK ---
    const ui = {
        closeBtn: document.getElementById('ep-close'),
        panel: document.getElementById('ep-panel'),
        minimized: document.getElementById('ep-minimized'),
        status: document.getElementById('ep-status'),
        count: document.getElementById('ep-count'),
        page: document.getElementById('ep-page'),
        bar: document.getElementById('ep-progress'),
        msg: document.getElementById('ep-msg'),
        btnStart: document.getElementById('btn-start'),
        btnStop: document.getElementById('btn-stop'),
        exportArea: document.getElementById('ep-export-area'),
        btnTxt: document.getElementById('btn-txt'),
        btnCsv: document.getElementById('btn-csv'),
        btnCopy: document.getElementById('btn-copy')
    };

    let isRunning = false;
    let gamesSet = new Set();
    let finalSortedList = [];

    // ÄNDERUNG HIER: Schließen entfernt das Element komplett
    ui.closeBtn.onclick = () => {
        isRunning = false;
        uiContainer.remove();
    };

    ui.minimized.onclick = () => {
        ui.panel.classList.remove('ep-hidden');
        ui.minimized.classList.remove('ep-visible');
    };

    // --- DRAG ---
    const header = document.getElementById('ep-header');
    header.style.cursor = 'grab';
    header.addEventListener('mousedown', e => {
        if (e.target === ui.closeBtn || ui.closeBtn.contains(e.target)) return;
        const rect = ui.panel.getBoundingClientRect();
        const offX = e.clientX - rect.left;
        const offY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
        const onMove = e => {
            ui.panel.style.left = `${e.clientX - offX}px`;
            ui.panel.style.top  = `${e.clientY - offY}px`;
            ui.panel.style.right = 'auto';
        };
        const onUp = () => {
            header.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const scrapePage = () => {
        const nodes = document.querySelectorAll(CONFIG.selector);
        nodes.forEach(node => {
            const txt = node.innerText.trim();
            if (txt && !CONFIG.ignoreList.some(bad => txt.includes(bad))) {
                gamesSet.add(txt);
            }
        });
    };

    const finishScan = () => {
        isRunning = false;
        ui.btnStop.style.display = 'none';
        ui.btnStart.innerText = 'Neu Starten';
        ui.btnStart.style.display = 'block';
        ui.bar.style.width = '100%';
        ui.bar.style.background = '#26bb26';

        if (gamesSet.size > 0) {
            finalSortedList = Array.from(gamesSet).sort((a, b) => a.localeCompare(b)).map((title, index) => `${index + 1}. ${title}`);
            ui.exportArea.style.display = 'block';
            setTimeout(() => ui.exportArea.style.opacity = '1', 50);
            ui.status.innerText = 'FERTIG';
            ui.status.style.color = '#26bb26';
            ui.msg.innerText = `${gamesSet.size} Spiele erfasst.`;
        }
    };

    const processLoop = async () => {
        if (isRunning) return;
        isRunning = true;
        gamesSet.clear();
        let pageNum = 1;

        ui.exportArea.style.display = 'none';
        ui.btnStart.style.display = 'none';
        ui.btnStop.style.display = 'block';
        ui.bar.style.background = '#f1c40f';
        ui.status.innerText = 'TURBO SCAN...';

        while (isRunning) {
            scrapePage();
            ui.count.innerText = gamesSet.size;
            ui.page.innerText = pageNum;
            ui.bar.style.width = (pageNum % 2 === 0) ? '60%' : '90%';

            const nextBtn = document.querySelector('button[aria-label="Next Page"], #next-btn');
            const isDisabled = nextBtn?.disabled || nextBtn?.classList.contains('Mui-disabled');

            if (nextBtn && !isDisabled) {
                const prevFirstText = document.querySelector(CONFIG.selector)?.innerText;
                nextBtn.click();
                pageNum++;
                // Wait for new page content to appear instead of fixed delay
                for (let waited = 0; waited < 5000; waited += 100) {
                    await sleep(100);
                    const newFirstText = document.querySelector(CONFIG.selector)?.innerText;
                    if (newFirstText && newFirstText !== prevFirstText) break;
                }
            } else {
                break;
            }
        }
        if (isRunning) finishScan();
    };

    ui.btnStart.onclick = processLoop;
    ui.btnStop.onclick = () => { isRunning = false; ui.status.innerText = 'STOP'; };

    // Export-Funktionen (TXT, CSV, Copy)
    const downloadFile = (content, filename, type) => {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        ui.msg.innerText = `Gespeichert!`;
    };

    ui.btnTxt.onclick = () => downloadFile(finalSortedList.join('\n'), `EpicGames_Export.txt`, 'text/plain');
    ui.btnCsv.onclick = () => {
        const csv = "Nr;Spiel\n" + finalSortedList.map(line => {
            const idx = line.indexOf('. ');
            return `${line.substring(0, idx)};"${line.substring(idx + 2)}"`
        }).join('\n');
        downloadFile(csv, `EpicGames_Export.csv`, 'text/csv');
    };
    let copyTimer;
    ui.btnCopy.onclick = () => {
        GM_setClipboard(finalSortedList.join('\n'));
        ui.btnCopy.innerText = "✓ Kopiert";
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => ui.btnCopy.innerText = "Kopieren", 1000);
    };

    } // end run()

})();

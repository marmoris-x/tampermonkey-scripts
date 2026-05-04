// ==UserScript==
// @name         Epic Games Library Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      6.4.0
// @description  High-Performance Game Library Exporter. Start via Tampermonkey menu.
// @author       marmoris-x
// @match        https://www.epicgames.com/account/transactions*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=epicgames.com
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Epic%20Games%20Library%20Export.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Epic%20Games%20Library%20Export.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @run-at       document-idle
// @sandbox      JavaScript
// @inject-into  content
// @noframes
// @license      MIT
// ==/UserScript==

import { createLogger } from '../shared/logging-utils.js';
import { createSidebar } from '../shared/ui-components.js';

var { log } = createLogger('Epic Games Library Export');

    GM_registerMenuCommand('Epic Library Export', run);

    var CONFIG = {
        selector: '.am-hoct6b',
        ignoreList: ['Standard Edition', 'Add-On', 'Season Pass', 'Saisonpass', 'Demo', 'Free', 'Kostenlos']
    };

    function run() {
        if (document.getElementById('ep-export-sidebar')) {
            log('Panel already open');
            return;
        }

        var sidebar = createSidebar({
            title: 'Epic Turbo Export',
            width: 320,
            accentColor: '#f1c40f'
        });
        sidebar.host.id = 'ep-export-sidebar';
        sidebar.open();

        var body = sidebar.bodyEl;
        body.style.padding = '16px';
        body.style.fontSize = '13px';
        body.style.color = '#e0e0e0';
        body.style.fontFamily = 'system-ui, sans-serif';

        var isRunning = false;
        var gamesSet = new Set();
        var sortedGames = [];

        // ── UI construction ──

        /**
         * Creates a labeled stats display row for the sidebar panel.
         * @param {string} label - The label text
         * @param {string|number} initial - Initial value
         * @returns {{ host: HTMLElement, val: HTMLElement }} Row container and value element
         */
        function statRow(label, initial) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:6px;color:#888;font-size:12px;';
            var lbl = document.createElement('span');
            lbl.textContent = label;
            var val = document.createElement('b');
            val.style.cssText = 'color:#fff;font-weight:600;font-family:monospace;font-size:13px;';
            val.textContent = initial;
            row.appendChild(lbl);
            row.appendChild(val);
            return { host: row, val: val };
        }

        var statusRow = statRow('STATUS', 'Ready');
        var gamesRow  = statRow('GAMES', '0');
        var pageRow   = statRow('PAGE', '1');

        var barWrap = document.createElement('div');
        barWrap.style.cssText = 'height:4px;background:#333;margin:16px 0;border-radius:2px;overflow:hidden;';
        var barFill = document.createElement('div');
        barFill.style.cssText = 'height:100%;width:0%;background:#f1c40f;transition:width 0.2s linear;';
        barWrap.appendChild(barFill);

        /**
         * Creates a styled button element.
         * @param {string} text - Button label
         * @param {string} bg - CSS background value
         * @returns {HTMLButtonElement}
         */
        function makeBtn(text, bg) {
            var btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = [
                'flex:1;padding:10px;border:none;border-radius:6px;cursor:pointer;font-weight:600;',
                'font-size:11px;text-transform:uppercase;color:white;background:' + bg + ';',
                'box-shadow:0 2px 5px rgba(0,0,0,0.2);transition:all 0.1s;'
            ].join('');
            btn.onmouseenter = function () { btn.style.filter = 'brightness(1.15)'; };
            btn.onmouseleave = function () { btn.style.filter = ''; };
            return btn;
        }

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
        var startBtn = makeBtn('Start', 'linear-gradient(135deg,#0078f2,#095fb5)');
        var stopBtn  = makeBtn('Stop', 'linear-gradient(135deg,#d63031,#c0392b)');
        stopBtn.style.display = 'none';
        btnRow.appendChild(startBtn);
        btnRow.appendChild(stopBtn);

        var exportArea = document.createElement('div');
        exportArea.style.cssText = 'display:none;border-top:1px solid #333;margin-top:16px;padding-top:16px;';

        var exportTitle = document.createElement('div');
        exportTitle.style.cssText = 'font-weight:700;color:#ccc;font-size:11px;text-transform:uppercase;margin-bottom:10px;';
        exportTitle.textContent = 'EXPORT';
        exportArea.appendChild(exportTitle);

        var expBtnRow = document.createElement('div');
        expBtnRow.style.cssText = 'display:flex;gap:8px;';
        var txtBtn = makeBtn('TXT', '#2d3436');
        var csvBtn = makeBtn('CSV', '#2d3436');
        expBtnRow.appendChild(txtBtn);
        expBtnRow.appendChild(csvBtn);
        exportArea.appendChild(expBtnRow);

        var copyWrap = document.createElement('div');
        copyWrap.style.cssText = 'margin-top:8px;';
        var copyBtn = makeBtn('Copy', 'linear-gradient(135deg,#00b894,#00a884)');
        copyWrap.appendChild(copyBtn);
        exportArea.appendChild(copyWrap);

        var msgEl = document.createElement('div');
        msgEl.style.cssText = 'font-size:10px;color:#666;margin-top:10px;text-align:center;height:14px;';

        body.appendChild(statusRow.host);
        body.appendChild(gamesRow.host);
        body.appendChild(pageRow.host);
        body.appendChild(barWrap);
        body.appendChild(btnRow);
        body.appendChild(exportArea);
        body.appendChild(copyWrap);
        body.appendChild(msgEl);

        // ── Core logic ──

        /**
         * Promise-based delay.
         * @param {number} ms - Milliseconds to wait
         * @returns {Promise<void>}
         */
        function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

        /**
         * Extracts game titles from the current page's transaction rows.
         * Filters out items matching CONFIG.ignoreList.
         */
        function scrapePage() {
            var nodes = document.querySelectorAll(CONFIG.selector);
            for (var i = 0; i < nodes.length; i++) {
                var txt = nodes[i].innerText.trim();
                if (txt && !CONFIG.ignoreList.some(function (bad) { return txt.includes(bad); })) {
                    gamesSet.add(txt);
                }
            }
        }

        /**
         * Completes the scan, updates UI to show export options and final stats.
         */
        function finishScan() {
            isRunning = false;
            stopBtn.style.display = 'none';
            startBtn.textContent = 'Restart';
            startBtn.style.display = 'block';
            barFill.style.width = '100%';
            barFill.style.background = '#26bb26';

            if (gamesSet.size > 0) {
                sortedGames = Array.from(gamesSet).sort(function (a, b) { return a.localeCompare(b); })
                    .map(function (title, i) { return (i + 1) + '. ' + title; });
                exportArea.style.display = 'block';
                statusRow.val.textContent = 'DONE';
                statusRow.val.style.color = '#26bb26';
                msgEl.textContent = gamesSet.size + ' games captured.';
            }
            log('Scan finished: ' + gamesSet.size + ' games found');
        }

        /**
         * Main pagination loop — iterates through transaction history pages
         * until the Next button is disabled or the user hits Stop.
         */
        async function processLoop() {
            if (isRunning) return;
            isRunning = true;
            gamesSet = new Set();
            sortedGames = [];
            var pageNum = 1;

            exportArea.style.display = 'none';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            barFill.style.background = '#f1c40f';
            barFill.style.width = '0%';
            statusRow.val.textContent = 'SCANNING...';
            statusRow.val.style.color = '#f0f0f0';
            msgEl.textContent = '';

            while (isRunning) {
                scrapePage();
                gamesRow.val.textContent = gamesSet.size;
                pageRow.val.textContent = pageNum;
                barFill.style.width = (pageNum % 2 === 0) ? '60%' : '90%';

                var nextBtn = document.querySelector('button[aria-label="Next Page"], #next-btn');
                var isDisabled = nextBtn && (nextBtn.disabled || nextBtn.classList.contains('Mui-disabled'));

                if (nextBtn && !isDisabled) {
                    var prevFirstText = (function () { var e = document.querySelector(CONFIG.selector); return e ? e.innerText : ''; })();
                    nextBtn.click();
                    pageNum++;
                    for (var waited = 0; waited < 5000; waited += 100) {
                        await sleep(100);
                        var newFirstText = (function () { var e = document.querySelector(CONFIG.selector); return e ? e.innerText : ''; })();
                        if (newFirstText && newFirstText !== prevFirstText) break;
                    }
                } else {
                    break;
                }
            }
            if (isRunning) finishScan();
        }

        /**
         * Triggers a browser file download from a string.
         * @param {string} content - File content
         * @param {string} filename - Output filename
         * @param {string} type - MIME type (e.g. 'text/plain', 'text/csv')
         */
        function downloadFile(content, filename, type) {
            var blob = new Blob([content], { type: type });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
            msgEl.textContent = 'Saved!';
        }

        // ── Button handlers ──

        startBtn.onclick = processLoop;

        stopBtn.onclick = function () {
            isRunning = false;
            statusRow.val.textContent = 'STOPPED';
            log('Scan stopped by user');
        };

        txtBtn.onclick = function () {
            downloadFile(sortedGames.join('\n'), 'EpicGames_Export.txt', 'text/plain');
            log('TXT export: ' + sortedGames.length + ' games');
        };

        csvBtn.onclick = function () {
            var csv = 'Nr;Spiel\n';
            for (var i = 0; i < sortedGames.length; i++) {
                var idx = sortedGames[i].indexOf('. ');
                csv += sortedGames[i].substring(0, idx) + ';"' + sortedGames[i].substring(idx + 2) + '"\n';
            }
            downloadFile(csv, 'EpicGames_Export.csv', 'text/csv');
            log('CSV export: ' + sortedGames.length + ' games');
        };

        var copyTimer;
        copyBtn.onclick = function () {
            GM_setClipboard(sortedGames.join('\n'));
            copyBtn.textContent = 'Copied';
            clearTimeout(copyTimer);
            copyTimer = setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1000);
            msgEl.textContent = 'Copied to clipboard';
            log('Copied ' + sortedGames.length + ' games to clipboard');
        };

        log('Panel initialized');
    }

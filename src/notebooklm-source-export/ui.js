/**
 * "Float" UI for NotebookLM Source Export.
 * Minimal floating glassmorphism panel — replaces the old sidebar entirely.
 *
 * States: FloatPill (idle) → ActivePanel (running) → SuccessGlow (complete)
 *         Click any state to open the Overlay (full log + controls).
 *
 * Zero external dependencies. All Shadow DOM closed, all CSS inline.
 */
'use strict';

import { TIMING, LOG_LEVEL, STATE, runProcess, uiCallbacks, log } from './extractor.js';
import { htmlToMarkdown } from './converter.js';
import { extractChatToMarkdown, extractChatMessages, buildChatHTMLDocument } from './chat-extractor.js';

// ── Internal State ─────────────────────────────────────────────────────────────

const ui = {
  /** @type {HTMLElement|null} */
  floatHost: null,
  /** @type {ShadowRoot|null} */
  floatRoot: null,
  /** @type {HTMLElement|null} */
  overlayHost: null,
  /** @type {ShadowRoot|null} */
  overlayRoot: null,
  /** @type {Function|null} */
  removeStatusBar: null
};

// ── CSS Constants ──────────────────────────────────────────────────────────────

const FLOAT_CSS = [
  ':host { position:fixed; bottom:24px; right:24px; z-index:2147483645; cursor:pointer; }',
  '.pill { display:flex; align-items:center; gap:10px; height:48px; padding:0 20px;',
  '  background:rgba(15,23,42,0.75); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);',
  '  border:1px solid rgba(255,255,255,0.08); border-radius:24px;',
  '  box-shadow:0 8px 32px rgba(0,0,0,0.35); transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);',
  '  font:500 13px/1 system-ui,sans-serif; color:#e2e8f0; white-space:nowrap; user-select:none; }',
  '.pill:hover { border-color:rgba(99,102,241,0.4); box-shadow:0 8px 40px rgba(99,102,241,0.15); }',
  '.dot { width:8px; height:8px; border-radius:50%; background:#4ade80;',
  '  animation:pulse 2s ease-in-out infinite; }',
  '.dot.active { background:linear-gradient(135deg,#6366f1,#c084fc); animation:none; }',
  '.dot.error { background:#f87171; animation:none; }',
  '@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }',
  '.label { flex:1; overflow:hidden; text-overflow:ellipsis; color:#94a3b8; }',
  '.label strong { color:#e2e8f0; font-weight:500; }',
  '.expand-icon { font-size:16px; color:#64748b; transition:transform 0.3s ease; }',
  '.pill:hover .expand-icon { transform:translateX(2px); }'
].join('\n');

const PANEL_CSS = [
  ':host { position:fixed; bottom:24px; right:24px; z-index:2147483645; }',
  '.panel { width:360px; background:rgba(15,23,42,0.85); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);',
  '  border:1px solid rgba(255,255,255,0.08); border-radius:16px;',
  '  box-shadow:0 8px 32px rgba(0,0,0,0.4); overflow:hidden;',
  '  animation:panelIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }',
  '@keyframes panelIn { from { opacity:0; transform:translateY(12px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }',
  '.progress-row { display:flex; align-items:center; gap:14px; padding:16px 18px 8px; }',
  '.progress-ring { flex-shrink:0; width:48px; height:48px; }',
  '.progress-ring circle { transition:stroke-dashoffset 0.4s ease; }',
  '.meta { flex:1; min-width:0; }',
  '.meta .count { font:600 20px/1 system-ui,sans-serif; color:#e2e8f0; }',
  '.meta .count span { color:#64748b; font-weight:400; }',
  '.meta .file { font:11px/1.3 monospace; color:#94a3b8; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
  '.meta .progress-bar { height:3px; background:rgba(255,255,255,0.06); border-radius:2px; margin-top:8px; overflow:hidden; }',
  '.meta .progress-fill { height:100%; width:0%; background:linear-gradient(90deg,#6366f1,#c084fc,#f472b6);',
  '  border-radius:2px; transition:width 0.4s ease; }',
  '.log-area { padding:0 18px 8px; max-height:72px; overflow:hidden; }',
  '.log-line { font:11px/1.4 monospace; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
  '.log-line.info { color:#94a3b8; } .log-line.success { color:#4ade80; }',
  '.log-line.warn { color:#fbbf24; } .log-line.error { color:#f87171; }',
  '.footer { display:flex; justify-content:flex-end; padding:0 14px 12px; }',
  '.btn-stop { padding:6px 16px; border-radius:8px; border:1px solid rgba(248,113,113,0.3);',
  '  background:transparent; color:#f87171; font:500 12px/1 system-ui,sans-serif; cursor:pointer;',
  '  transition:all 0.2s ease; opacity:0.6; }',
  '.btn-stop:hover { opacity:1; background:rgba(248,113,113,0.1); border-color:#f87171; }',
  '.complete { text-align:center; padding:18px; }',
  '.complete .check { font-size:32px; line-height:1; margin-bottom:6px; }',
  '.complete .msg { font:500 14px/1 system-ui,sans-serif; color:#4ade80; }',
  '.complete .sub { font:12px/1 system-ui,sans-serif; color:#64748b; margin-top:4px; }'
].join('\n');

const OVERLAY_CSS = [
  ':host { position:fixed; inset:0; z-index:2147483646; display:flex; align-items:center; justify-content:center; }',
  '.backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }',
  '.card { position:relative; width:480px; max-height:80vh; background:rgba(15,23,42,0.92); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);',
  '  border:1px solid rgba(255,255,255,0.08); border-radius:20px; box-shadow:0 16px 64px rgba(0,0,0,0.5);',
  '  display:flex; flex-direction:column; animation:overlayIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }',
  '@keyframes overlayIn { from { opacity:0; transform:scale(0.92) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }',
  '.header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06); }',
  '.header h2 { margin:0; font:600 15px/1 system-ui,sans-serif; color:#e2e8f0; }',
  '.header h2 span { color:#6366f1; }',
  '.btn-close { background:none; border:none; color:#64748b; font-size:20px; cursor:pointer; padding:0 4px; line-height:1; }',
  '.btn-close:hover { color:#e2e8f0; }',
  '.body { padding:18px 20px; flex:1; overflow-y:auto; }',
  '.body::-webkit-scrollbar { width:6px; }',
  '.body::-webkit-scrollbar-track { background:transparent; }',
  '.body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }',
  '.overlay-progress { display:flex; align-items:center; gap:16px; margin-bottom:18px; }',
  '.overlay-progress .progress-ring { width:56px; height:56px; flex-shrink:0; }',
  '.overlay-progress .progress-ring circle { transition:stroke-dashoffset 0.4s ease; }',
  '.overlay-progress .meta .count { font:600 22px/1 system-ui,sans-serif; color:#e2e8f0; }',
  '.overlay-progress .meta .file { font:12px/1.3 monospace; color:#94a3b8; margin-top:3px; }',
  '.overlay-progress .meta .progress-bar { height:4px; margin-top:10px; }',
  '.overlay-progress .meta .progress-fill { height:100%; width:0%; background:linear-gradient(90deg,#6366f1,#c084fc,#f472b6); border-radius:2px; transition:width 0.4s ease; }',
  '.terminal { background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); border-radius:10px;',
  '  padding:12px; overflow-y:auto; max-height:260px; font:12px/1.5 monospace; color:#94a3b8; }',
  '.terminal::-webkit-scrollbar { width:4px; }',
  '.terminal::-webkit-scrollbar-track { background:transparent; }',
  '.terminal::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }',
  '.log-entry { margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
  '.log-entry:last-child { margin-bottom:0; }',
  '.log-entry.info { color:#94a3b8; } .log-entry.success { color:#4ade80; }',
  '.log-entry.warn { color:#fbbf24; } .log-entry.error { color:#f87171; }',
  '.footer-btns { display:flex; gap:8px; margin-top:16px; justify-content:flex-end; }',
  '.btn { padding:8px 20px; border-radius:10px; font:600 13px/1 system-ui,sans-serif; cursor:pointer; transition:all 0.2s ease; }',
  '.btn-primary { background:linear-gradient(135deg,#6366f1,#a855f7); color:#fff; border:none; }',
  '.btn-primary:hover { box-shadow:0 4px 20px rgba(99,102,241,0.3); }',
  '.btn-primary:disabled { opacity:0.4; cursor:not-allowed; box-shadow:none; }',
  '.btn-stop { background:transparent; color:#f87171; border:1px solid rgba(248,113,113,0.3); }',
  '.btn-stop:hover { background:rgba(248,113,113,0.1); border-color:#f87171; }',
  '.tool-selector { display:flex; gap:12px; padding:12px 0; }',
  '.tool-card { flex:1; padding:20px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);',
  '  cursor:pointer; text-align:center; transition:all 0.2s ease; }',
  '.tool-card:hover { background:rgba(99,102,241,0.1); border-color:rgba(99,102,241,0.3); transform:translateY(-2px); }',
  '.tool-card .icon { font-size:32px; margin-bottom:8px; }',
  '.tool-card .name { font:500 14px/1 system-ui,sans-serif; color:#e2e8f0; }',
  '.tool-card .desc { font:12px/1.3 system-ui,sans-serif; color:#64748b; margin-top:4px; }',
  '.format-selector { display:flex; gap:8px; padding:12px 0; }',
  '.format-btn { flex:1; padding:8px 6px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);',
  '  background:rgba(255,255,255,0.02); color:#94a3b8; font:500 12px/1 system-ui,sans-serif; cursor:pointer;',
  '  text-align:center; transition:all 0.2s ease; }',
  '.format-btn:hover { border-color:rgba(99,102,241,0.25); color:#cbd5e1; }',
  '.format-btn.selected { background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.1));',
  '  border-color:rgba(99,102,241,0.4); color:#e2e8f0; }',
  '.format-btn .ext { font-size:10px; opacity:0.5; display:block; margin-top:2px; }'
].join('\n');

// ── SVG Template ───────────────────────────────────────────────────────────────

const PROGRESS_SVG = [
  '<svg viewBox="0 0 120 120" class="progress-ring">',
  '  <defs>',
  '    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">',
  '      <stop offset="0%" stop-color="#6366f1"/>',
  '      <stop offset="50%" stop-color="#c084fc"/>',
  '      <stop offset="100%" stop-color="#f472b6"/>',
  '    </linearGradient>',
  '    <linearGradient id="pgSuccess" x1="0%" y1="0%" x2="100%" y2="0%">',
  '      <stop offset="0%" stop-color="#4ade80"/>',
  '      <stop offset="100%" stop-color="#22d3ee"/>',
  '    </linearGradient>',
  '  </defs>',
  '  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>',
  '  <circle class="ring-fg" cx="60" cy="60" r="50" fill="none" stroke="url(#pg)" stroke-width="6"',
  '    stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset="314.16"',
  '    transform="rotate(-90, 60, 60)"/>',
  '  <path class="checkmark" d="M48,62 L56,70 L74,48" fill="none" stroke="#4ade80" stroke-width="5"',
  '    stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="50" stroke-dashoffset="50" style="display:none"/>',
  '</svg>'
].join('\n');

// The canvas circumference — 2 * π * 50 = 314.159…
const CIRCUMFERENCE = 314.16;

// ── Helpers ────────────────────────────────────────────────────────────────────

function createShadowContainer(styles) {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'closed' });
  if (styles) GM_addElement(root, 'style', { textContent: styles });
  document.body.appendChild(host);
  return { host: host, root: root };
}

// ── FloatPill (idle state) ─────────────────────────────────────────────────────

let currentState = 'idle'; // 'idle' | 'running' | 'complete'
let currentTool = null; // 'sources' | 'chat'
let selectedFormat = 'md'; // 'md' | 'html' | 'pdf'
let lastLogLines = [];

function createFloatPill() {
  const { host, root } = createShadowContainer(FLOAT_CSS);
  ui.floatHost = host;
  ui.floatRoot = root;

  const pill = document.createElement('div');
  pill.className = 'pill';

  const dot = document.createElement('div');
  dot.className = 'dot';
  pill.appendChild(dot);

  const label = document.createElement('div');
  label.className = 'label';
  label.innerHTML = '<strong>NotebookLM</strong> Export';
  pill.appendChild(label);

  const expand = document.createElement('div');
  expand.className = 'expand-icon';
  expand.textContent = '↗';
  pill.appendChild(expand);

  root.appendChild(pill);

  pill.addEventListener('click', function () {
    if (currentState === 'running') {
      // If running with no panel, rebuild panel
      if (!root.querySelector('.panel')) showActivePanel();
      // Toggle to overlay
      createOverlay(currentTool || 'sources');
    } else if (currentState === 'idle') {
      // Show tool selector
      currentTool = null;
      createOverlay(null);
    } else {
      createOverlay(currentTool || 'sources');
    }
  });

  return { host, root, pill, dot };
}

// ── ActivePanel (running state) ────────────────────────────────────────────────

function showActivePanel() {
  if (!ui.floatRoot) return;
  const root = ui.floatRoot;

  // Clear pill content
  root.innerHTML = '';
  GM_addElement(root, 'style', { textContent: FLOAT_CSS + '\n' + PANEL_CSS });

  const panel = document.createElement('div');
  panel.className = 'panel';

  // Progress row
  const progressRow = document.createElement('div');
  progressRow.className = 'progress-row';

  // SVG container
  const svgWrapper = document.createElement('div');
  svgWrapper.className = 'progress-ring';
  svgWrapper.innerHTML = PROGRESS_SVG;
  progressRow.appendChild(svgWrapper);

  // Meta
  const meta = document.createElement('div');
  meta.className = 'meta';
  const countEl = document.createElement('div');
  countEl.className = 'count';
  countEl.innerHTML = '0 <span>/ 0</span>';
  meta.appendChild(countEl);

  const fileEl = document.createElement('div');
  fileEl.className = 'file';
  fileEl.textContent = 'Waiting...';
  meta.appendChild(fileEl);

  const barOuter = document.createElement('div');
  barOuter.className = 'progress-bar';
  const barFill = document.createElement('div');
  barFill.className = 'progress-fill';
  barOuter.appendChild(barFill);
  meta.appendChild(barOuter);

  progressRow.appendChild(meta);
  panel.appendChild(progressRow);

  // Log area (compact, last 3 lines)
  const logArea = document.createElement('div');
  logArea.className = 'log-area';
  // Show last 3 log entries
  const recentLogs = lastLogLines.slice(-3);
  for (let i = 0; i < recentLogs.length; i++) {
    const line = document.createElement('div');
    line.className = 'log-line ' + recentLogs[i].level;
    line.textContent = recentLogs[i].text;
    logArea.appendChild(line);
  }
  panel.appendChild(logArea);

  // Footer with stop button
  const footer = document.createElement('div');
  footer.className = 'footer';
  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn-stop';
  stopBtn.textContent = '■ Stop';
  stopBtn.onclick = function () {
    STATE.isCancelled = true;
    log.warn('Stop requested by user.');
    addLog('Stop requested by user.', LOG_LEVEL.WARN);
  };
  footer.appendChild(stopBtn);
  panel.appendChild(footer);

  root.appendChild(panel);

  // Store refs for updates
  ui.floatRoot._countEl = countEl;
  ui.floatRoot._fileEl = fileEl;
  ui.floatRoot._barFill = barFill;
  ui.floatRoot._logArea = logArea;
  ui.floatRoot._svgWrapper = svgWrapper;
  ui.floatRoot._stopBtn = stopBtn;
  ui.floatRoot._panel = panel;
}

function updateProgressRing(pct) {
  const svg = ui.floatRoot && ui.floatRoot._svgWrapper;
  if (svg) {
    const ring = svg.querySelector('.ring-fg');
    if (ring) ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct / 100);
  }
  // Also update overlay if open
  if (ui.overlayRoot && ui.overlayRoot._ring) {
    ui.overlayRoot._ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct / 100);
  }
}

// ── Success State ──────────────────────────────────────────────────────────────

function showSuccess(totalCount) {
  if (!ui.floatRoot) return;
  currentState = 'complete';
  const root = ui.floatRoot;
  root.innerHTML = '';
  GM_addElement(root, 'style', { textContent: FLOAT_CSS + '\n' + PANEL_CSS });

  const panel = document.createElement('div');
  panel.className = 'panel';

  const complete = document.createElement('div');
  complete.className = 'complete';

  const check = document.createElement('div');
  check.className = 'check';
  check.textContent = '✓';
  complete.appendChild(check);

  const msg = document.createElement('div');
  msg.className = 'msg';
  msg.textContent = 'Extraction Complete!';
  complete.appendChild(msg);

  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = totalCount + ' source' + (totalCount !== 1 ? 's' : '') + ' exported';
  complete.appendChild(sub);

  panel.appendChild(complete);
  root.appendChild(panel);

  // Animate: show for 6s, then collapse back to pill
  setTimeout(function () {
    if (root._panel) {
      root._panel.style.opacity = '0';
      root._panel.style.transform = 'scale(0.9)';
    }
    setTimeout(function () {
      currentState = 'idle';
      root.innerHTML = '';
      GM_addElement(root, 'style', { textContent: FLOAT_CSS });
      createFloatPill();
    }, 400);
  }, 6000);
}

// ── Overlay (expanded modal) ───────────────────────────────────────────────────

let overlayLogBuffer = [];

function createOverlay(tool) {
  // Set tool mode
  if (tool !== undefined) currentTool = tool;

  // Clean up existing overlay
  if (ui.overlayHost) {
    ui.overlayHost.remove();
    ui.overlayHost = null;
    ui.overlayRoot = null;
  }

  const { host, root } = createShadowContainer(OVERLAY_CSS);
  ui.overlayHost = host;
  ui.overlayRoot = root;

  // Backdrop click → close
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.addEventListener('click', closeOverlay);
  root.appendChild(backdrop);

  // Card
  const card = document.createElement('div');
  card.className = 'card';

  // Header
  const header = document.createElement('div');
  header.className = 'header';

  if (currentTool === null) {
    // Tool selector header
    const h2 = document.createElement('h2');
    h2.innerHTML = '<span>NotebookLM</span> Export';
    header.appendChild(h2);
  } else {
    const h2 = document.createElement('h2');
    h2.innerHTML = '<span>NotebookLM</span> ' + (currentTool === 'chat' ? 'Chat Export' : 'Source Export');
    header.appendChild(h2);

    // Back button to return to tool selector
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-close';
    backBtn.textContent = '←';
    backBtn.title = 'Back to tool selection';
    backBtn.addEventListener('click', function () {
      createOverlay(null);
    });
    header.appendChild(backBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeOverlay);
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'body';

  if (currentTool === null) {
    // ── Tool Selector View ──
    const selector = document.createElement('div');
    selector.className = 'tool-selector';

    // Sources card
    const sourcesCard = document.createElement('div');
    sourcesCard.className = 'tool-card';
    sourcesCard.innerHTML = '<div class="icon">📄</div><div class="name">Export Sources</div><div class="desc">Extract all source files as Markdown</div>';
    sourcesCard.addEventListener('click', function () {
      createOverlay('sources');
    });
    selector.appendChild(sourcesCard);

    // Chat card
    const chatCard = document.createElement('div');
    chatCard.className = 'tool-card';
    chatCard.innerHTML = '<div class="icon">💬</div><div class="name">Export Chat</div><div class="desc">Download chat as Markdown, HTML or PDF</div>';
    chatCard.addEventListener('click', function () {
      createOverlay('chat');
    });
    selector.appendChild(chatCard);

    body.appendChild(selector);

    // Replay buffered logs
    if (overlayLogBuffer.length > 0) {
      const terminal = document.createElement('div');
      terminal.className = 'terminal';
      const termLog = document.createElement('div');
      termLog.className = 'terminal-log';
      for (let i = 0; i < overlayLogBuffer.length; i++) {
        const entry = overlayLogBuffer[i];
        const el = document.createElement('div');
        el.className = 'log-entry ' + entry.level;
        el.textContent = entry.text;
        termLog.appendChild(el);
      }
      terminal.appendChild(termLog);
      terminal.scrollTop = terminal.scrollHeight;
      body.appendChild(terminal);
    }

    card.appendChild(body);
    root.appendChild(card);
    ui.overlayRoot._card = card;
    return;
  }

  // ── Progress section (for sources or chat) ──
  const ovProgress = document.createElement('div');
  ovProgress.className = 'overlay-progress';

  const ovSvg = document.createElement('div');
  ovSvg.className = 'progress-ring';
  ovSvg.innerHTML = PROGRESS_SVG;
  ovProgress.appendChild(ovSvg);

  const ovMeta = document.createElement('div');
  ovMeta.className = 'meta';
  const ovCount = document.createElement('div');
  ovCount.className = 'count';
  ovCount.innerHTML = '0 <span>/ 0</span>';
  ovMeta.appendChild(ovCount);
  const ovFile = document.createElement('div');
  ovFile.className = 'file';
  ovFile.textContent = '';
  ovMeta.appendChild(ovFile);
  const ovBarOuter = document.createElement('div');
  ovBarOuter.className = 'progress-bar';
  const ovBarFill = document.createElement('div');
  ovBarFill.className = 'progress-fill';
  ovBarOuter.appendChild(ovBarFill);
  ovMeta.appendChild(ovBarOuter);
  ovProgress.appendChild(ovMeta);
  body.appendChild(ovProgress);

  // ── Format selector (chat only) ──
  let fmtStartBtn = null;
  if (currentTool === 'chat') {
    const fmtSel = document.createElement('div');
    fmtSel.className = 'format-selector';

    const formats = [
      { key: 'md', label: 'Markdown', ext: '.md' },
      { key: 'html', label: 'HTML', ext: '.html' },
      { key: 'pdf', label: 'PDF (Print)', ext: '.pdf' }
    ];

    for (let i = 0; i < formats.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'format-btn' + (formats[i].key === selectedFormat ? ' selected' : '');
      btn.innerHTML = formats[i].label + '<span class="ext">' + formats[i].ext + '</span>';
      btn.dataset.format = formats[i].key;
      btn.addEventListener('click', function () {
        const parent = btn.parentNode;
        if (!parent) return;
        const allBtns = parent.querySelectorAll('.format-btn');
        for (let j = 0; j < allBtns.length; j++) {
          allBtns[j].className = 'format-btn';
        }
        btn.className = 'format-btn selected';
        selectedFormat = btn.dataset.format;
        if (fmtStartBtn && !fmtStartBtn.disabled) {
          fmtStartBtn.textContent = '▶ Export ' + btn.dataset.format.toUpperCase();
        }
      });
      fmtSel.appendChild(btn);
    }

    body.appendChild(fmtSel);
  }

  // Terminal
  const terminal = document.createElement('div');
  terminal.className = 'terminal';
  const termLog = document.createElement('div');
  termLog.className = 'terminal-log';
  terminal.appendChild(termLog);
  body.appendChild(terminal);

  // Footer buttons
  const footerBtns = document.createElement('div');
  footerBtns.className = 'footer-btns';
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-primary';
  if (currentTool === 'chat') {
    fmtStartBtn = startBtn;
    startBtn.textContent = currentState === 'running' ? 'Running...' : '▶ Export ' + selectedFormat.toUpperCase();
    startBtn.disabled = currentState === 'running';
    startBtn.onclick = function () {
      closeOverlay();
      currentState = 'running';
      showActivePanel();
      startChatExport(selectedFormat);
    };
  } else {
    startBtn.textContent = currentState === 'running' ? 'Running...' : '▶ Start Extraction';
    startBtn.disabled = currentState === 'running';
    startBtn.onclick = function () {
      closeOverlay();
      currentState = 'running';
      showActivePanel();
      runProcess();
    };
  }
  footerBtns.appendChild(startBtn);

  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn btn-stop';
  stopBtn.textContent = '■ Stop';
  stopBtn.style.display = currentState === 'running' ? 'block' : 'none';
  stopBtn.onclick = function () {
    STATE.isCancelled = true;
    log.warn('Stop requested by user.');
    addLog('Stop requested by user.', LOG_LEVEL.WARN);
  };
  footerBtns.appendChild(stopBtn);

  body.appendChild(footerBtns);
  card.appendChild(body);
  root.appendChild(card);

  // Store refs
  ui.overlayRoot._ring = ovSvg.querySelector('.ring-fg');
  ui.overlayRoot._countEl = ovCount;
  ui.overlayRoot._fileEl = ovFile;
  ui.overlayRoot._barFill = ovBarFill;
  ui.overlayRoot._termLog = termLog;
  ui.overlayRoot._startBtn = startBtn;
  ui.overlayRoot._stopBtn = stopBtn;
  ui.overlayRoot._terminal = terminal;
  ui.overlayRoot._card = card;

  // Replay buffered logs into overlay
  for (let i = 0; i < overlayLogBuffer.length; i++) {
    const entry = overlayLogBuffer[i];
    const el = document.createElement('div');
    el.className = 'log-entry ' + entry.level;
    el.textContent = entry.text;
    termLog.appendChild(el);
  }
  terminal.scrollTop = terminal.scrollHeight;

  // Sync progress from active panel if running
  if (ui.floatRoot && currentState === 'running') {
    const oldCount = ui.floatRoot._countEl;
    if (oldCount) {
      ovCount.innerHTML = oldCount.innerHTML;
    }
    const oldFile = ui.floatRoot._fileEl;
    if (oldFile && oldFile.textContent) {
      ovFile.textContent = oldFile.textContent;
    }
    const oldPct = ui.floatRoot._barFill ? ui.floatRoot._barFill.style.width : '0%';
    ovBarFill.style.width = oldPct;
  }
}

/**
 * Starts chat export: extracts chat messages and exports as the selected format.
 * @param {string} format - 'md' | 'html' | 'pdf'
 */
function startChatExport(format) {
  format = format || 'md';
  currentTool = 'chat';
  currentState = 'running';
  showActivePanel();

  addLog('Starting chat export (' + format.toUpperCase() + ')...', LOG_LEVEL.INFO);

  try {
    if (format === 'md') {
      // ── Markdown export ──
      const markdown = extractChatToMarkdown(htmlToMarkdown);
      if (!markdown) {
        addLog('No chat messages found.', LOG_LEVEL.ERROR);
        currentState = 'idle';
        return;
      }
      downloadBlob(
        new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
        'NotebookLM Chat.md'
      );
    } else {
      // ── HTML or PDF export ──
      const messagesData = extractChatMessages();
      if (!messagesData || messagesData.messages.length === 0) {
        addLog('No chat messages found.', LOG_LEVEL.ERROR);
        currentState = 'idle';
        return;
      }
      const html = buildChatHTMLDocument(messagesData, { forPrint: format === 'pdf' });

      if (format === 'html') {
        downloadBlob(
          new Blob([html], { type: 'text/html;charset=utf-8' }),
          'NotebookLM Chat.html'
        );
      } else {
        // PDF: open in new tab, auto-trigger print dialog
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (!printWindow) {
          addLog('Popup blocked — downloading HTML instead. Use File > Print to save as PDF.', LOG_LEVEL.WARN);
          downloadBlob(blob, 'NotebookLM Chat.html');
        }
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      }
    }

    addLog('Chat exported successfully!', LOG_LEVEL.SUCCESS);
    showSuccess(1);
  } catch (err) {
    addLog('Chat export failed: ' + err.message, LOG_LEVEL.ERROR);
    currentState = 'idle';
  }
}

/**
 * Triggers a file download via temporary <a> element.
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

function closeOverlay() {
  if (ui.overlayHost) {
    ui.overlayHost.remove();
    ui.overlayHost = null;
    ui.overlayRoot = null;
  }
}

// Track latest total count for completion display
let _lastTotal = 0;

// ── Public API (same interface as old sidebar) ─────────────────────────────────

/**
 * Appends a log entry to ALL visible log views.
 * @param {string} msg
 * @param {string} [level]
 */
export function addLog(msg, level) {
  level = level || LOG_LEVEL.INFO;
  const timestamp = '[' + new Date().toLocaleTimeString(undefined, { hour12: false }) + ']';
  const text = timestamp + ' ' + msg;

  // Buffer for overlay replay
  overlayLogBuffer.push({ text: text, level: level });
  while (overlayLogBuffer.length > 200) overlayLogBuffer.shift();

  // Compact log (in active panel)
  if (ui.floatRoot && ui.floatRoot._logArea) {
    const line = document.createElement('div');
    line.className = 'log-line ' + level;
    line.textContent = text;
    ui.floatRoot._logArea.appendChild(line);
    // Keep only last 3
    while (ui.floatRoot._logArea.children.length > 3) {
      ui.floatRoot._logArea.removeChild(ui.floatRoot._logArea.firstChild);
    }
  }

  // Full log (in overlay)
  if (ui.overlayRoot && ui.overlayRoot._termLog) {
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + level;
    entry.textContent = text;
    ui.overlayRoot._termLog.appendChild(entry);
    while (ui.overlayRoot._termLog.children.length > TIMING.LOG_MAX_ENTRIES) {
      ui.overlayRoot._termLog.removeChild(ui.overlayRoot._termLog.firstChild);
    }
    if (ui.overlayRoot._terminal) {
      ui.overlayRoot._terminal.scrollTop = ui.overlayRoot._terminal.scrollHeight;
    }
  }

  // Also maintain the old text-based lastLogLines for panel transitions
  lastLogLines.push({ text: text, level: level });
  while (lastLogLines.length > 50) lastLogLines.shift();
}

/**
 * Updates progress display in all views.
 * @param {number} current
 * @param {number} total
 */
export function updateProgress(current, total) {
  _lastTotal = total;
  const pct = Math.round((current / total) * 100);
  const label = current + ' <span>/ ' + total + '</span>';

  // Active panel
  if (ui.floatRoot && ui.floatRoot._countEl) {
    ui.floatRoot._countEl.innerHTML = label;
  }
  if (ui.floatRoot && ui.floatRoot._barFill) {
    ui.floatRoot._barFill.style.width = pct + '%';
  }

  // Overlay
  if (ui.overlayRoot && ui.overlayRoot._countEl) {
    ui.overlayRoot._countEl.innerHTML = label;
  }
  if (ui.overlayRoot && ui.overlayRoot._barFill) {
    ui.overlayRoot._barFill.style.width = pct + '%';
  }

  // SVG progress ring
  updateProgressRing(pct);
}

// ── initUI (called from menu command) ──────────────────────────────────────────

/**
 * Initializes the Float UI. Creates the idle pill.
 * Safe to call multiple times — recycles existing host.
 */
export function initUI() {
  // Always clean up existing host first
  if (ui.floatHost) {
    ui.floatHost.remove();
    ui.floatHost = null;
    ui.floatRoot = null;
  }
  closeOverlay();
  currentState = 'idle';
  overlayLogBuffer = [];
  lastLogLines = [];

  // Create the idle float pill
  createFloatPill();

  // Wire uiCallbacks from extractor.js
  uiCallbacks.addLog = addLog;
  uiCallbacks.updateProgress = updateProgress;
  uiCallbacks.setStatusText = function (text) {
    if (text === 'Stopped') {
      currentState = 'idle';
      // Reset float pill to idle
      if (ui.floatRoot) {
        ui.floatRoot.innerHTML = '';
        GM_addElement(ui.floatRoot, 'style', { textContent: FLOAT_CSS });
        createFloatPill();
      }
      return;
    }
    if (ui.floatRoot && ui.floatRoot._fileEl) ui.floatRoot._fileEl.textContent = text;
    if (ui.overlayRoot && ui.overlayRoot._fileEl) ui.overlayRoot._fileEl.textContent = text;
  };
  uiCallbacks.setStartBtnState = function (disabled, text) {
    if (ui.overlayRoot && ui.overlayRoot._startBtn) {
      ui.overlayRoot._startBtn.disabled = disabled;
      ui.overlayRoot._startBtn.textContent = text;
    }
  };
  uiCallbacks.setStopBtnVisible = function (visible) {
    if (ui.overlayRoot && ui.overlayRoot._stopBtn) {
      ui.overlayRoot._stopBtn.style.display = visible ? 'block' : 'none';
    }
  };

  // Override restartUI to fully re-init
  uiCallbacks.restartUI = function () {
    // Clean up and re-init
    if (ui.floatHost) {
      // Fade out
      ui.floatHost.style.transition = 'opacity 0.3s ease';
      ui.floatHost.style.opacity = '0';
      setTimeout(function () {
        initUI();
      }, 350);
    } else {
      initUI();
    }
  };

  uiCallbacks.removeStatusBar = function () {
    // Trigger success state on extraction completion
    if (currentState === 'running') {
      showSuccess(_lastTotal);
    }
  };
}

// ── Wire extraction callback ───────────────────────────────────────────────────
// Hook into extraction completion — showSuccess is called from the uiCallbacks
// chain when runProcess finishes collecting all sources.

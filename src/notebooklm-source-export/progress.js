/**
 * Mini progress UI for NotebookLM Source Export.
 * Zero innerHTML — all DOM via createElement + textContent.
 * Closed Shadow DOM for style isolation.
 * Self-destructs after 7 seconds on completion/error/cancel.
 */
'use strict';

const STYLES = `
  :host {
    all: initial;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #e2e8f0;
    pointer-events: none;
  }
  .container {
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 12px;
    padding: 14px 18px;
    min-width: 300px;
    max-width: 420px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .container.destroy {
    opacity: 0;
    transform: translateY(10px);
  }
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.12);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .spinner.success {
    border-color: #22c55e;
    animation: none;
  }
  .spinner.error {
    border-color: #ef4444;
    animation: none;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .status-text {
    flex: 1;
    font-weight: 500;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-text.success {
    color: #22c55e;
  }
  .status-text.error {
    color: #ef4444;
  }
  .details {
    padding-left: 24px;
  }
  .count-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .progress-track {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #6366f1, #c084fc, #f472b6);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .count-label {
    color: #cbd5e1;
    min-width: 50px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .filename {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 24px;
    margin-top: 2px;
  }
  .stop-btn {
    background: transparent;
    border: 1px solid rgba(248, 113, 113, 0.35);
    color: #f87171;
    border-radius: 6px;
    padding: 3px 12px;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    transition: background 0.15s ease;
    flex-shrink: 0;
  }
  .stop-btn:hover {
    background: rgba(248, 113, 113, 0.1);
  }
  .status-line {
    padding-left: 24px;
    font-size: 12px;
    color: #94a3b8;
  }
`;

/**
 * Creates a mini progress bar with closed Shadow DOM.
 * No innerHTML used — every element built via document.createElement + textContent.
 *
 * @param {'sources'|'chat'} mode - Display mode
 * @param {Function|null} onStop - Called when user clicks Stop (sources only)
 * @returns {{
 *   update: (current: number, total: number, filename?: string) => void,
 *   setStatus: (text: string) => void,
 *   complete: (message?: string) => void,
 *   error: (message?: string) => void,
 *   cancel: (message?: string) => void
 * }}
 */
export function createProgress(mode, onStop) {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const root = host.attachShadow({ mode: 'closed' });
  GM_addElement(root, 'style', { textContent: STYLES });

  const container = document.createElement('div');
  container.className = 'container';
  root.appendChild(container);

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'header';
  container.appendChild(header);

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  header.appendChild(spinner);

  const statusText = document.createElement('div');
  statusText.className = 'status-text';
  statusText.textContent = mode === 'sources' ? 'Exporting sources...' : 'Exporting chat...';
  header.appendChild(statusText);

  let stopBtn = null;
  if (mode === 'sources' && typeof onStop === 'function') {
    stopBtn = document.createElement('button');
    stopBtn.className = 'stop-btn';
    stopBtn.textContent = 'Stop';
    stopBtn.addEventListener('click', function () {
      if (stopBtn.disabled) return;
      stopBtn.disabled = true;
      stopBtn.textContent = 'Stopping...';
      statusText.textContent = 'Stopping...';
      onStop();
    });
    header.appendChild(stopBtn);
  }

  // ── Mode-specific body ──────────────────────────────────────────────────
  let details = null;
  let countLabel = null;
  let progressFill = null;
  let filenameEl = null;
  let statusLine = null;

  if (mode === 'sources') {
    details = document.createElement('div');
    details.className = 'details';
    container.appendChild(details);

    const countLine = document.createElement('div');
    countLine.className = 'count-line';
    details.appendChild(countLine);

    const track = document.createElement('div');
    track.className = 'progress-track';
    countLine.appendChild(track);

    progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    track.appendChild(progressFill);

    countLabel = document.createElement('span');
    countLabel.className = 'count-label';
    countLabel.textContent = '0 / 0';
    countLine.appendChild(countLabel);

    filenameEl = document.createElement('div');
    filenameEl.className = 'filename';
    details.appendChild(filenameEl);
  } else {
    statusLine = document.createElement('div');
    statusLine.className = 'status-line';
    statusLine.textContent = 'Starting...';
    container.appendChild(statusLine);
  }

  // ── State ───────────────────────────────────────────────────────────────
  let finished = false;
  let destroyTimer = null;

  function startDestroy(delayMs) {
    if (destroyTimer) clearTimeout(destroyTimer);
    destroyTimer = setTimeout(function () {
      container.classList.add('destroy');
      setTimeout(function () { host.remove(); }, 300);
    }, delayMs);
  }

  function clearDestroy() {
    if (destroyTimer) {
      clearTimeout(destroyTimer);
      destroyTimer = null;
    }
  }

  // ── Controller ──────────────────────────────────────────────────────────
  return {
    update: function (current, total, filename) {
      if (finished) return;
      clearDestroy();
      spinner.className = 'spinner';
      statusText.className = 'status-text';
      statusText.textContent = 'Exporting sources...';
      if (countLabel) countLabel.textContent = String(current) + ' / ' + String(total);
      if (progressFill) progressFill.style.width = (total > 0 ? (current / total) * 100 : 0) + '%';
      if (filenameEl) filenameEl.textContent = filename || '';
    },

    setStatus: function (text) {
      if (finished) return;
      clearDestroy();
      spinner.className = 'spinner';
      statusText.className = 'status-text';
      statusText.textContent = text;
      if (statusLine) statusLine.textContent = text;
    },

    complete: function (message) {
      if (finished) return;
      finished = true;
      clearDestroy();
      spinner.className = 'spinner success';
      statusText.className = 'status-text success';
      statusText.textContent = message || 'Export complete!';
      if (stopBtn) stopBtn.style.display = 'none';
      startDestroy(7000);
    },

    error: function (message) {
      if (finished) return;
      finished = true;
      clearDestroy();
      spinner.className = 'spinner error';
      statusText.className = 'status-text error';
      statusText.textContent = message || 'Export failed!';
      if (stopBtn) stopBtn.style.display = 'none';
      startDestroy(7000);
    },

    cancel: function (message) {
      if (finished) return;
      finished = true;
      clearDestroy();
      spinner.className = 'spinner error';
      statusText.className = 'status-text error';
      statusText.textContent = message || 'Export cancelled.';
      if (stopBtn) {
        stopBtn.textContent = 'Stopped';
        stopBtn.disabled = true;
      }
      startDestroy(7000);
    }
  };
}

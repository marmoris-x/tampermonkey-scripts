// src/marketplace-deal-finder/ui-panel.js — All UI rendering and event binding
// Provides modal, settings/results views, progress display, export functions, and floating button.
// Consumers: Marketplace Deal Finder entry file

import { createToast, createStatusBar } from './_ui.js';

/* ─── Internal Helpers ─── */

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var statusBar = null;

/* ─── Settings View ─── */

/**
 * Renders the settings panel HTML.
 * @param {string} prefix - Site prefix ("wh" or "ka") for DOM IDs
 * @param {Object} settings - Current settings object
 * @param {Object|null} savedResults - Previously saved results (or null)
 * @param {string} siteName - "WILLHABEN" or "KLEINANZEIGEN"
 * @returns {string} HTML content
 */
export function renderSettingsView(prefix, settings, savedResults, siteName) {
  var autoContext = settings.searchContext || '';
  if (!autoContext) {
    var urlParams = new URLSearchParams(window.location.search);
    var keyword = urlParams.get('keyword');
    if (keyword) {
      autoContext = keyword;
    } else if (siteName === 'KLEINANZEIGEN') {
      var pathMatch = window.location.pathname.match(/\/s-([^/]+)/);
      if (pathMatch) autoContext = decodeURIComponent(pathMatch[1].replace(/-/g, ' '));
    }
  }

  var savedTs = '';
  if (savedResults && savedResults.timestamp) {
    var ts = savedResults.timestamp;
    savedTs = ts.indexOf('T') !== -1 ? new Date(ts).toLocaleString('de-DE') : ts;
  }

  return [
    '<div id="' + prefix + '-settings-view" style="padding: 25px;">',
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">',
    '<h2 style="margin: 0; color: #333; font-size: 20px;">🔍 Deal Finder</h2>',
    '<button id="' + prefix + '-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">×</button>',
    '</div>',

    (savedResults
      ? '<div style="background: #e8f5e9; padding: 12px; border-radius: 4px; margin-bottom: 18px; border-left: 3px solid #4caf50;">' +
        '<div style="font-size: 13px; color: #2e7d32; font-weight: 600; margin-bottom: 6px;">' +
        '✅ ' + savedResults.deals.length + ' gespeicherte Deals</div>' +
        '<div style="font-size: 11px; color: #558b2f;">Analysierte Seiten: ' + savedResults.pages + ' | ' + savedTs + '</div>' +
        '<button id="' + prefix + '-show-results-btn" style="width:100%;margin-top:8px;padding:8px;background:#4caf50;color:white;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">📊 Ergebnisse anzeigen</button>' +
        '</div>'
      : ''),

    '<div style="margin-bottom: 18px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Gemini API Key</label>',
    '<input type="password" id="' + prefix + '-api-key" placeholder="AIza..." value="' + esc(settings.apiKey) + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
    '<small style="color:#888;font-size:11px;"><a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#667eea;">Kostenlosen Key holen</a></small>',
    '</div>',

    '<div style="margin-bottom: 18px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Suchkontext</label>',
    '<textarea id="' + prefix + '-search-context" placeholder="z.B. Gaming PC RTX 3060, Neupreis €800-1000"',
    ' style="width:100%;height:70px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit;">' + esc(autoContext) + '</textarea>',
    '</div>',

    '<div style="margin-bottom: 18px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">AI-Picks pro Seite</label>',
    '<input type="number" id="' + prefix + '-top-x" min="1" max="10" value="' + settings.topX + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
    '<small style="color:#888;font-size:11px;">Anzahl der besten Deals, die die AI pro Seite auswählt (1–10)</small>',
    '</div>',

    '<div style="margin-bottom: 18px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Max. Seiten</label>',
    '<input type="number" id="' + prefix + '-max-pages" min="1" max="100" value="' + (settings.maxPages || 10) + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
    '</div>',

    '<div style="margin-bottom: 20px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">AI Model</label>',
    '<div id="' + prefix + '-model-area"></div>',
    '</div>',

    '<div id="' + prefix + '-progress-container" style="display:none;margin-bottom:18px;padding:12px;background:#f8f9fa;border-radius:4px;border-left:3px solid #667eea;">',
    '<div id="' + prefix + '-progress-text" style="font-weight:600;color:#333;margin-bottom:8px;font-size:12px;">Bereit...</div>',
    '<div style="background:#e0e0e0;border-radius:4px;height:6px;overflow:hidden;">',
    '<div id="' + prefix + '-progress-bar" style="background:#667eea;height:100%;width:0%;transition:width 0.3s;"></div>',
    '</div></div>',

    '<div id="' + prefix + '-live-ranking" style="display:none;margin-bottom:18px;padding:12px;background:#fff8e1;border-radius:4px;border-left:3px solid #ffc107;">',
    '<h3 style="margin:0 0 10px 0;font-size:14px;color:#333;">🏆 Live Top-Deals</h3>',
    '<div id="' + prefix + '-live-ranking-content" style="font-size:12px;color:#555;"></div>',
    '</div>',

    '<div style="display:flex;gap:8px;flex-wrap:wrap;">',
    '<button id="' + prefix + '-start-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#28a745;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">▶ Start</button>',
    '<button id="' + prefix + '-pause-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#ffc107;color:#333;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">⏸ Pause</button>',
    '<button id="' + prefix + '-stop-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">⏹ Stopp</button>',
    '</div></div>'
  ].join('\n');
}

/* ─── Results View ─── */

/**
 * Renders the results view HTML with deal cards.
 * @param {string} prefix - Site prefix for DOM IDs
 * @param {Array} deals - Array of deal objects to display
 * @returns {string} HTML content
 */
export function renderResultsView(prefix, deals) {
  var items = deals.map(function (deal, index) {
    var safeUrl = (deal.url && deal.url.startsWith('https://')) ? deal.url : '#';
    var safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
    var scoreBar = safeScore !== null
      ? '<div style="margin-bottom:6px;"><div style="font-size:10px;color:#888;margin-bottom:2px;">Score: ' + safeScore + '/100</div>' +
        '<div style="background:#e0e0e0;border-radius:4px;height:4px;overflow:hidden;">' +
        '<div style="background:' + (safeScore >= 70 ? '#28a745' : safeScore >= 40 ? '#ffc107' : '#dc3545') + ';height:100%;width:' + safeScore + '%;"></div>' +
        '</div></div>'
      : '';

    var medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '#' + (index + 1);
    var borderColor = index === 0 ? '#ffc107' : index === 1 ? '#28a745' : index === 2 ? '#17a2b8' : '#6c757d';

    return [
      '<div style="padding:15px;background:' + (index === 0 ? '#fff8e1' : '#f8f9fa') + ';border-radius:4px;margin-bottom:12px;border-left:3px solid ' + borderColor + ';">',
      '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">',
      '<div style="font-weight:700;color:#333;font-size:14px;">' + medal + ' ' + esc(deal.title) + '</div>',
      '<div style="font-size:11px;color:#888;white-space:nowrap;margin-left:8px;">S.' + deal.page + '</div>',
      '</div>',
      '<div style="font-weight:600;color:#28a745;font-size:15px;margin-bottom:8px;">' + esc(deal.price) + '</div>',
      scoreBar,
      '<div style="font-size:11px;color:#666;margin-bottom:8px;font-style:italic;">💡 ' + esc(deal.reasoning || 'Keine Begründung verfügbar') + '</div>',
      (deal.description
        ? '<div style="font-size:11px;color:#555;line-height:1.4;margin-bottom:8px;max-height:60px;overflow:hidden;">' +
          esc(deal.description.substring(0, 150)) +
          (deal.description.length > 150 ? '...' : '') + '</div>'
        : ''),
      '<a href="' + esc(safeUrl) + '" target="_blank" style="font-size:11px;color:#667eea;text-decoration:none;">→ Anzeige öffnen</a>',
      '</div>'
    ].join('\n');
  }).join('\n');

  return [
    '<div id="' + prefix + '-results-view" style="padding: 25px;">',
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">',
    '<h2 style="margin:0;color:#333;font-size:20px;">🏆 Top-Deals</h2>',
    '<button id="' + prefix + '-close-btn-x" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;padding:0;line-height:1;">×</button>',
    '</div>',

    '<div style="background:#667eea;color:white;padding:12px;border-radius:4px;margin-bottom:20px;text-align:center;">',
    '<div style="font-size:24px;font-weight:700;margin-bottom:4px;">' + deals.length + '</div>',
    '<div style="font-size:12px;">Top-Deals gefunden</div>',
    '</div>',

    '<div style="margin-bottom:15px;">' + items + '</div>',

    '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">',
    '<button id="' + prefix + '-export-markdown-btn" style="flex:1;padding:10px 12px;background:#28a745;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">📋 Markdown</button>',
    '<button id="' + prefix + '-export-json-btn" style="flex:1;padding:10px 12px;background:#17a2b8;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">📄 JSON</button>',
    '<button id="' + prefix + '-export-csv-btn" style="flex:1;padding:10px 12px;background:#6f42c1;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">📊 CSV</button>',
    '<button id="' + prefix + '-clear-results-btn" style="padding:10px 12px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">🗑️</button>',
    '</div>',

    '<button id="' + prefix + '-back-to-settings" style="width:100%;padding:10px 16px;background:#6c757d;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">← Zurück zu Einstellungen</button>',
    '</div>'
  ].join('\n');
}

/* ─── Live Ranking ─── */

/**
 * Updates the live ranking panel with current top deals.
 * @param {string} prefix - Site prefix for DOM IDs
 * @param {Array} allTopDeals - Array of deals
 * @param {Object} cachedSettings - Current settings (for topX)
 */
export function updateLiveRanking(prefix, allTopDeals, cachedSettings) {
  var container = document.getElementById(prefix + '-live-ranking');
  var content = document.getElementById(prefix + '-live-ranking-content');
  if (!container || !content) return;
  if (!allTopDeals || allTopDeals.length === 0) {
    container.style.display = 'none';
    return;
  }

  var topX = (cachedSettings && cachedSettings.topX) || 3;
  container.style.display = 'block';

  var sorted = allTopDeals.slice().sort(function (a, b) {
    return ((b && b.score) || 0) - ((a && a.score) || 0);
  });
  var topItems = sorted.slice(0, Math.min(3, topX));

  content.innerHTML = topItems.map(function (deal, idx) {
    var safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
    var border = idx < topItems.length - 1 ? 'border-bottom:1px solid #ffe082;' : '';
    return [
      '<div style="margin-bottom:8px;padding-bottom:8px;' + border + '">',
      '<div style="font-weight:600;color:#333;">' + (idx + 1) + '. ' + esc(deal.title) + '</div>',
      '<div style="color:#28a745;font-weight:600;">' + esc(deal.price) + '</div>',
      (safeScore !== null ? '<div style="font-size:10px;color:#888;">Score: ' + safeScore + '/100</div>' : ''),
      '<div style="font-size:10px;color:#888;">Seite ' + deal.page + '</div>',
      '</div>'
    ].join('\n');
  }).join('\n');
}

/* ─── Progress Display ─── */

/**
 * Updates the progress bar and text in the settings view.
 * @param {string} prefix - Site prefix for DOM IDs
 * @param {string} text - Status message
 * @param {number} percentage - Progress 0-100
 * @param {string} [type] - 'info', 'error', 'warning', 'success'
 * @param {boolean} [isWH] - Whether on Willhaben (controls accent color)
 */
export function updateProgress(prefix, text, percentage, type, isWH) {
  type = type || 'info';
  var container = document.getElementById(prefix + '-progress-container');
  var progressText = document.getElementById(prefix + '-progress-text');
  var progressBar = document.getElementById(prefix + '-progress-bar');

  var borderColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#667eea';
  var textColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#333';
  var barColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#007bff';

  if (container) {
    container.style.display = 'block';
    container.style.borderLeftColor = borderColor;
  }
  if (progressText) {
    progressText.textContent = text;
    progressText.style.color = textColor;
  }
  if (progressBar) {
    progressBar.style.width = percentage + '%';
    progressBar.style.backgroundColor = barColor;
    progressBar.style.transition = 'width 0.3s ease, background-color 0.3s ease';
  }

  // Update status bar
  if (!statusBar) {
    var accent = isWH ? '#667eea' : '#86a542';
    statusBar = createStatusBar({ accentColor: accent });
  }
  statusBar.setText(text);
  statusBar.setProgress(percentage);
}

/**
 * Shows an error message in the progress display.
 * @param {string} prefix
 * @param {string} message
 * @param {number} [percentage]
 * @param {boolean} [isWH]
 */
export function showError(prefix, message, percentage, isWH) {
  updateProgress(prefix, 'Fehler: ' + message, percentage || 0, 'error', isWH);
}

/**
 * Shows a warning message in the progress display.
 * @param {string} prefix
 * @param {string} message
 * @param {number} [percentage]
 * @param {boolean} [isWH]
 */
export function showWarning(prefix, message, percentage, isWH) {
  updateProgress(prefix, 'Warnung: ' + message, percentage || 0, 'warning', isWH);
}

/**
 * Shows a success message in the progress display.
 * @param {string} prefix
 * @param {string} message
 * @param {number} [percentage]
 * @param {boolean} [isWH]
 */
export function showSuccess(prefix, message, percentage, isWH) {
  updateProgress(prefix, 'Erfolg: ' + message, percentage || 100, 'success', isWH);
}

/* ─── UI State ─── */

/**
 * Resets UI to idle state after crawl completes or is stopped.
 * @param {string} prefix - Site prefix for DOM IDs
 */
export function resetUI(prefix) {
  var startBtn = document.getElementById(prefix + '-start-btn');
  var pauseBtn = document.getElementById(prefix + '-pause-btn');
  var stopBtn = document.getElementById(prefix + '-stop-btn');
  var apiKeyInput = document.getElementById(prefix + '-api-key');
  var searchInput = document.getElementById(prefix + '-search-context');
  var topXInput = document.getElementById(prefix + '-top-x');
  if (startBtn) startBtn.style.display = 'block';
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';
  if (apiKeyInput) apiKeyInput.disabled = false;
  if (searchInput) searchInput.disabled = false;
  if (topXInput) topXInput.disabled = false;
  if (statusBar) {
    try { statusBar.remove(); } catch (e) { /* ignore */ }
    statusBar = null;
  }
}

/**
 * Sets UI to running state (hides start, shows pause/stop, disables inputs).
 * @param {string} prefix - Site prefix for DOM IDs
 */
export function setUIRunningState(prefix) {
  var startBtn = document.getElementById(prefix + '-start-btn');
  var pauseBtn = document.getElementById(prefix + '-pause-btn');
  var stopBtn = document.getElementById(prefix + '-stop-btn');
  var apiKeyInput = document.getElementById(prefix + '-api-key');
  var searchInput = document.getElementById(prefix + '-search-context');
  var topXInput = document.getElementById(prefix + '-top-x');
  if (startBtn) startBtn.style.display = 'none';
  if (pauseBtn) pauseBtn.style.display = 'block';
  if (stopBtn) stopBtn.style.display = 'block';
  if (apiKeyInput) apiKeyInput.disabled = true;
  if (searchInput) searchInput.disabled = true;
  if (topXInput) topXInput.disabled = true;
}

/* ─── Modal Management ─── */

var SIDEBAR_WIDTH = '400px';

/**
 * Creates the modal sidebar element and appends it to the document body.
 * Does NOT open it automatically.
 * @param {string} prefix - Site prefix for DOM IDs
 */
export function createModal(prefix) {
  var modalId = prefix + '-dealfinder-modal';
  if (document.getElementById(modalId)) return;

  var modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = [
    'display: none; position: fixed; top: 0; right: 0; width: 400px; height: 100vh;',
    'background: white; z-index: 999999; box-shadow: -5px 0 20px rgba(0,0,0,0.2);',
    'overflow-y: auto; transition: transform 0.3s ease;'
  ].join(' ');
  document.body.appendChild(modal);
}

/**
 * Opens the modal sidebar.
 * @param {string} prefix
 */
export function openModal(prefix) {
  var modal = document.getElementById(prefix + '-dealfinder-modal');
  var floatBtn = document.getElementById(prefix + '-dealfinder-btn');
  if (modal) modal.style.display = 'block';
  if (floatBtn) floatBtn.style.display = 'none';
  document.documentElement.style.transition = 'margin-right 0.3s ease';
  document.documentElement.style.marginRight = SIDEBAR_WIDTH;
}

/**
 * Closes the modal sidebar.
 * @param {string} prefix
 * @param {boolean} isRunning - If true, close is prevented (visual feedback instead)
 */
export function closeModal(prefix, isRunning) {
  if (isRunning) {
    var btn = document.getElementById(prefix + '-close-btn-x');
    if (btn) {
      btn.style.color = '#dc3545';
      btn.title = 'Crawl läuft - erst stoppen';
      setTimeout(function () { btn.style.color = '#999'; btn.title = ''; }, 1000);
    }
    return;
  }
  var modal = document.getElementById(prefix + '-dealfinder-modal');
  var floatBtn = document.getElementById(prefix + '-dealfinder-btn');
  if (modal) modal.style.display = 'none';
  if (floatBtn) floatBtn.style.display = 'block';
  document.documentElement.style.marginRight = '';
}

/* ─── Event Listeners ─── */

/**
 * Attaches event listeners for the settings view.
 * @param {string} prefix
 * @param {Object} callbacks - { start, pause, resume, stop, close, showSavedResults, apiKeyChange, searchContextChange }
 */
export function attachSettingsListeners(prefix, callbacks) {
  var startBtn = document.getElementById(prefix + '-start-btn');
  var pauseBtn = document.getElementById(prefix + '-pause-btn');
  var stopBtn = document.getElementById(prefix + '-stop-btn');
  var closeBtn = document.getElementById(prefix + '-close-btn-x');
  var showResultsBtn = document.getElementById(prefix + '-show-results-btn');
  var apiKeyInput = document.getElementById(prefix + '-api-key');
  var searchContextInput = document.getElementById(prefix + '-search-context');

  if (startBtn && callbacks.start) {
    startBtn.addEventListener('click', function () {
      callbacks.start()['catch'](function (error) {
        console.error('[MDF-UI] Unhandled error in start:', error);
        updateProgress(prefix, 'Fehler: ' + error.message, 0, 'error');
        resetUI(prefix);
      });
    });
  }
  if (pauseBtn && callbacks.pause) {
    pauseBtn.addEventListener('click', callbacks.pause);
  }
  if (stopBtn && callbacks.stop) {
    stopBtn.addEventListener('click', callbacks.stop);
  }
  if (closeBtn && callbacks.close) {
    closeBtn.addEventListener('click', callbacks.close);
  }
  if (showResultsBtn && callbacks.showSavedResults) {
    showResultsBtn.addEventListener('click', callbacks.showSavedResults);
  }

  if (apiKeyInput && callbacks.apiKeyChange) {
    (function (input) {
      input.addEventListener('blur', function () {
        var newKey = input.value.trim();
        callbacks.apiKeyChange(newKey);
      });
    })(apiKeyInput);
  }

  if (searchContextInput && callbacks.searchContextChange) {
    (function (input) {
      input.addEventListener('blur', function () {
        var newContext = input.value.trim();
        callbacks.searchContextChange(newContext);
      });
    })(searchContextInput);
  }

  // Hover effects for all buttons
  [startBtn, pauseBtn, stopBtn, showResultsBtn].forEach(function (btn) {
    if (btn) {
      btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.9'; });
      btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
    }
  });
}

/**
 * Attaches event listeners for the results view.
 * @param {string} prefix
 * @param {Object} callbacks - { close, backToSettings, exportMarkdown, exportJSON, exportCSV, clearResults }
 */
export function attachResultsListeners(prefix, callbacks) {
  var closeBtn = document.getElementById(prefix + '-close-btn-x');
  var backBtn = document.getElementById(prefix + '-back-to-settings');
  var exportMdBtn = document.getElementById(prefix + '-export-markdown-btn');
  var exportJsonBtn = document.getElementById(prefix + '-export-json-btn');
  var exportCsvBtn = document.getElementById(prefix + '-export-csv-btn');
  var clearBtn = document.getElementById(prefix + '-clear-results-btn');

  if (closeBtn && callbacks.close) closeBtn.addEventListener('click', callbacks.close);
  if (backBtn && callbacks.backToSettings) backBtn.addEventListener('click', callbacks.backToSettings);
  if (exportMdBtn && callbacks.exportMarkdown) exportMdBtn.addEventListener('click', callbacks.exportMarkdown);
  if (exportJsonBtn && callbacks.exportJSON) exportJsonBtn.addEventListener('click', callbacks.exportJSON);
  if (exportCsvBtn && callbacks.exportCSV) exportCsvBtn.addEventListener('click', callbacks.exportCSV);
  if (clearBtn && callbacks.clearResults) clearBtn.addEventListener('click', callbacks.clearResults);

  [closeBtn, backBtn, exportMdBtn, exportJsonBtn, exportCsvBtn, clearBtn].forEach(function (btn) {
    if (btn) {
      btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.9'; });
      btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
    }
  });
}

/* ─── View Switching ─── */

/**
 * Switches the modal to results view.
 * @param {string} prefix
 * @param {Array} deals - Deals to display
 */
export function switchToResultsView(prefix, deals) {
  var modal = document.getElementById(prefix + '-dealfinder-modal');
  if (!modal) return;
  modal.innerHTML = renderResultsView(prefix, deals || []);
}

/* ─── Floating Button ─── */

/**
 * Creates the floating "Deal Finder" button on the right edge.
 * @param {string} prefix
 * @param {string} gradient - CSS gradient for button background
 */
export function createDealFinderButton(prefix, gradient) {
  var buttonId = prefix + '-dealfinder-btn';
  if (document.getElementById(buttonId)) return;

  var button = document.createElement('button');
  button.id = buttonId;
  button.textContent = 'Deal Finder';
  button.style.cssText = [
    'position: fixed; top: 140px; right: 0; z-index: 99999;',
    'padding: 12px 16px; background: ' + gradient + ';',
    'color: white; border: none; border-radius: 8px 0 0 8px; cursor: pointer;',
    'box-shadow: -3px 3px 12px rgba(0,0,0,0.25); font-size: 15px; font-weight: bold;',
    'transition: padding-right 0.2s ease, box-shadow 0.2s ease;'
  ].join(' ');

  button.addEventListener('mouseenter', function () {
    button.style.paddingRight = '22px';
    button.style.boxShadow = '-5px 4px 18px rgba(0,0,0,0.35)';
  });
  button.addEventListener('mouseleave', function () {
    button.style.paddingRight = '16px';
    button.style.boxShadow = '-3px 3px 12px rgba(0,0,0,0.25)';
  });

  document.body.appendChild(button);
  return button;
}

/**
 * Hides the floating button.
 * @param {string} prefix
 */
export function hideFloatingButton(prefix) {
  var btn = document.getElementById(prefix + '-dealfinder-btn');
  if (btn) btn.style.display = 'none';
}

/**
 * Shows the floating button.
 * @param {string} prefix
 */
export function showFloatingButton(prefix) {
  var btn = document.getElementById(prefix + '-dealfinder-btn');
  if (btn) btn.style.display = 'block';
}

/* ─── Export Functions ─── */

/**
 * Copies results as Markdown to clipboard.
 * @param {string} prefix
 * @param {Object} rankingEngineRef - Reference to ranking-engine module
 */
export async function exportMarkdown(prefix, rankingEngineRef) {
  var rankEng = rankingEngineRef;
  if (!rankEng) { createToast('Ranking engine not available!', { type: 'error' }); return; }

  var results = await rankEng.loadResults(prefix);
  if (!results) { createToast('Keine Results verfügbar!', { type: 'error' }); return; }

  var siteName = prefix === 'wh' ? 'WILLHABEN' : 'KLEINANZEIGEN';
  var md = rankEng.generateMarkdown(results.deals, results.pages, results.timestamp, siteName);

  try {
    await navigator.clipboard.writeText(md);
    var btn = document.getElementById(prefix + '-export-markdown-btn');
    if (btn) {
      var orig = btn.textContent;
      btn.textContent = 'Kopiert!';
      setTimeout(function () { btn.textContent = orig; }, 2000);
    }
  } catch (error) {
    createToast('Fehler beim Kopieren. Bitte Fenster fokussieren und nochmal versuchen.', { type: 'error', duration: 5000 });
  }
}

/**
 * Downloads results as a JSON file.
 * @param {string} prefix
 */
export async function exportJSON(prefix) {
  var raw = await GM.getValue(prefix + '_dealfinder_results', null);
  if (!raw) { createToast('Keine Results verfügbar!', { type: 'error' }); return; }
  var savedResults;
  try { savedResults = JSON.parse(raw); } catch (e) { return; }

  var blob = new Blob([JSON.stringify(savedResults, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'deals-' + Date.now() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

/**
 * Downloads results as a CSV file (UTF-8 BOM for Excel compatibility).
 * @param {string} prefix
 */
export async function exportCSV(prefix) {
  var raw = await GM.getValue(prefix + '_dealfinder_results', null);
  if (!raw) { createToast('Keine Results verfügbar!', { type: 'error' }); return; }
  var savedResults;
  try { savedResults = JSON.parse(raw); } catch (e) { return; }

  var header = ['Rang', 'Titel', 'Preis', 'Score', 'Begründung', 'Seite', 'URL'];
  var rows = savedResults.deals.map(function (d, i) {
    return [
      i + 1,
      '"' + (d.title || '').replace(/"/g, '""') + '"',
      '"' + (d.price || '').replace(/"/g, '""') + '"',
      d.score !== undefined && Number.isFinite(Number(d.score)) ? d.score : '',
      '"' + (d.reasoning || '').replace(/"/g, '""') + '"',
      d.page || '',
      '"' + (d.url || '').replace(/"/g, '""') + '"'
    ];
  });
  var csv = header.join(',') + '\n' + rows.map(function (r) { return r.join(','); }).join('\n');
  var bom = String.fromCharCode(0xFEFF);
  var blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'deals-' + Date.now() + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// src/marketplace-deal-finder/_ui-progress.js — Progress display + UI state
'use strict';

import { esc } from './_dom.js';
import { setRunning, S as state } from './_state.js';

/* ─── Progress Display ─── */

/**
 * Updates the progress bar and text in the settings view.
 * @param {string} prefix - Site prefix ("wh" or "ka") for DOM IDs
 * @param {string} text - Status message
 * @param {number} percentage - Progress 0-100
 * @param {string} [type] - 'info', 'error', 'warning', 'success'
 */
export function updateProgress(prefix, text, percentage, type) {
  type = type || 'info';
  const container = document.getElementById(prefix + '-progress-container');
  const progressText = document.getElementById(prefix + '-progress-text');
  const progressBar = document.getElementById(prefix + '-progress-bar');

  const borderColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#667eea';
  const textColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#333';
  const barColor = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#007bff';

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

}

/**
 * Shows an error message in the progress display.
 * @param {string} prefix - Site prefix
 * @param {string} message - Error message
 * @param {number} [percentage] - Progress percentage
 */
export function showError(prefix, message, percentage) {
  updateProgress(prefix, 'Fehler: ' + message, percentage || 0, 'error');
}

/**
 * Shows a warning message in the progress display.
 * @param {string} prefix - Site prefix
 * @param {string} message - Warning message
 * @param {number} [percentage] - Progress percentage
 * @param {boolean} [isWH] - Whether on Willhaben
 */
export function showWarning(prefix, message, percentage) {
  updateProgress(prefix, 'Warnung: ' + message, percentage || 0, 'warning');
}

/**
 * Shows a success message in the progress display.
 * @param {string} prefix - Site prefix
 * @param {string} message - Success message
 * @param {number} [percentage] - Progress percentage
 * @param {boolean} [isWH] - Whether on Willhaben
 */
export function showSuccess(prefix, message, percentage) {
  updateProgress(prefix, 'Erfolg: ' + message, percentage || 100, 'success');
}

/* ─── UI State ─── */

/**
 * Resets UI to idle state after crawl completes or is stopped.
 * @param {string} prefix - Site prefix
 */
export function resetUI(prefix) {
  const startBtn = document.getElementById(prefix + '-start-btn');
  const pauseBtn = document.getElementById(prefix + '-pause-btn');
  const stopBtn = document.getElementById(prefix + '-stop-btn');
  const apiKeyInput = document.getElementById(prefix + '-api-key');
  const searchInput = document.getElementById(prefix + '-search-context');
  const topXInput = document.getElementById(prefix + '-top-x');
  const providerSelect = document.getElementById(prefix + '-provider-select');
  const modelIdInput = document.getElementById(prefix + '-model-id');
  const baseUrlInput = document.getElementById(prefix + '-base-url');

  if (startBtn) startBtn.style.display = 'block';
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';
  if (apiKeyInput) apiKeyInput.disabled = false;
  if (searchInput) searchInput.disabled = false;
  if (topXInput) topXInput.disabled = false;
  if (providerSelect) providerSelect.disabled = false;
  if (modelIdInput) modelIdInput.disabled = false;
  if (baseUrlInput) baseUrlInput.disabled = false;

  // Hide progress and live ranking containers when resetting to idle.
  // Without this, stale containers from a previous crawl can remain visible.
  const liveRanking = document.getElementById(prefix + '-live-ranking');
  if (liveRanking) liveRanking.style.display = 'none';
  const progressContainer = document.getElementById(prefix + '-progress-container');
  if (progressContainer) progressContainer.style.display = 'none';

  setRunning(false);
}

/**
 * Sets UI to running state (hides start, shows pause/stop, disables inputs).
 * @param {string} prefix - Site prefix
 */
export function setUIRunningState(prefix) {
  const startBtn = document.getElementById(prefix + '-start-btn');
  const pauseBtn = document.getElementById(prefix + '-pause-btn');
  const stopBtn = document.getElementById(prefix + '-stop-btn');
  const apiKeyInput = document.getElementById(prefix + '-api-key');
  const searchInput = document.getElementById(prefix + '-search-context');
  const topXInput = document.getElementById(prefix + '-top-x');
  const providerSelect = document.getElementById(prefix + '-provider-select');
  const modelIdInput = document.getElementById(prefix + '-model-id');
  const baseUrlInput = document.getElementById(prefix + '-base-url');

  if (startBtn) startBtn.style.display = 'none';
  if (pauseBtn) pauseBtn.style.display = 'block';
  if (stopBtn) stopBtn.style.display = 'block';
  if (apiKeyInput) apiKeyInput.disabled = true;
  if (searchInput) searchInput.disabled = true;
  if (topXInput) topXInput.disabled = true;
  if (providerSelect) providerSelect.disabled = true;
  if (modelIdInput) modelIdInput.disabled = true;
  if (baseUrlInput) baseUrlInput.disabled = true;
}

/* ─── Live Ranking ─── */

/**
 * Updates the live ranking panel with current top deals.
 * All user data is escaped via esc() before insertion into innerHTML.
 * @param {string} prefix - Site prefix
 * @param {Array} allTopDeals - Array of deal objects
 * @param {Object} cachedSettings - Current settings (for topX)
 */
export function updateLiveRanking(prefix, allTopDeals, cachedSettings) {
  const container = document.getElementById(prefix + '-live-ranking');
  const content = document.getElementById(prefix + '-live-ranking-content');
  if (!container || !content) return;
  // Guard: only show live ranking while a crawl is actually running.
  if (!state.isRunning) {
    container.style.display = 'none';
    return;
  }
  if (!allTopDeals || allTopDeals.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Show only the current page's deals — find the highest page number in
  // the accumulated array. This prevents mixing scores from different AI
  // calls (per-page scores are not calibrated against each other).
  let currentPage = 0;
  for (let di = 0; di < allTopDeals.length; di++) {
    if (allTopDeals[di].page > currentPage) currentPage = allTopDeals[di].page;
  }
  const pageDeals = [];
  for (let di = 0; di < allTopDeals.length; di++) {
    if (allTopDeals[di].page === currentPage) pageDeals.push(allTopDeals[di]);
  }
  if (pageDeals.length === 0) {
    container.style.display = 'none';
    return;
  }

  const topX = (cachedSettings && cachedSettings.topX) || 3;
  container.style.display = 'block';

  // Sort current page's deals by score descending
  pageDeals.sort(function (a, b) {
    return ((b && b.score) || 0) - ((a && a.score) || 0);
  });
  const topItems = pageDeals.slice(0, Math.min(3, topX));

  content.innerHTML = topItems.map(function (deal, idx) {
    const borderStyle = idx < topItems.length - 1 ? 'border-bottom:1px solid #ffe082;' : '';
    return [
      '<div style="margin-bottom:8px;padding-bottom:8px;' + borderStyle + '">',
      '<div style="font-weight:600;color:#333;">' + (idx + 1) + '. ' + esc(deal.title) + '</div>',
      '<div style="color:#28a745;font-weight:600;">' + esc(deal.price) + '</div>',
      '<div style="font-size:10px;color:#888;">Seite ' + deal.page + '</div>',
      '</div>'
    ].join('\n');
  }).join('\n');
}

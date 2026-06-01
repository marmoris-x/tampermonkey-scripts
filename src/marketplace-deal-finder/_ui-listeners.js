// src/marketplace-deal-finder/_ui-listeners.js — Event binding for settings/results views
'use strict';

import { updateProgress, resetUI } from './_ui-progress.js';

/* ─── Settings View Listeners ─── */

/**
 * Attaches event listeners for the settings view.
 * @param {string} prefix - Site prefix ("wh" or "ka")
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.start - Start crawl handler
 * @param {Function} callbacks.pause - Pause crawl handler
 * @param {Function} callbacks.stop - Stop crawl handler
 * @param {Function} callbacks.close - Close modal handler
 * @param {Function} callbacks.showSavedResults - Show saved results handler
 * @param {Function} callbacks.apiKeyChange - API key change handler (key: string) => void
 * @param {Function} callbacks.searchContextChange - Search context change handler (text: string) => void
 * @param {Function} callbacks.providerChange - Provider type change handler (type: string) => void
 * @param {Function} callbacks.modelIdChange - Model ID change handler (id: string) => void
 * @param {Function} callbacks.modelPresetClick - Model preset button click handler (modelId: string) => void
 * @param {Function} callbacks.baseUrlChange - Base URL change handler (url: string) => void
 */
export function attachSettingsListeners(prefix, callbacks) {
  const startBtn = document.getElementById(prefix + '-start-btn');
  const pauseBtn = document.getElementById(prefix + '-pause-btn');
  const stopBtn = document.getElementById(prefix + '-stop-btn');
  const closeBtn = document.getElementById(prefix + '-close-btn-x');
  const showResultsBtn = document.getElementById(prefix + '-show-results-btn');
  const apiKeyInput = document.getElementById(prefix + '-api-key');
  const searchContextInput = document.getElementById(prefix + '-search-context');
  const providerSelect = document.getElementById(prefix + '-provider-select');
  const modelIdInput = document.getElementById(prefix + '-model-id');
  const baseUrlInput = document.getElementById(prefix + '-base-url');
  const presetContainer = document.getElementById(prefix + '-model-presets');

  // Start button
  if (startBtn && callbacks.start) {
    startBtn.addEventListener('click', function () {
      callbacks.start()['catch'](function (error) {
        console.error('[MDF] Unhandled error in start:', error);
        updateProgress(prefix, 'Fehler: ' + error.message, 0, 'error');
        resetUI(prefix);
      });
    });
  }

  // Pause button
  if (pauseBtn && callbacks.pause) {
    pauseBtn.addEventListener('click', callbacks.pause);
  }

  // Stop button
  if (stopBtn && callbacks.stop) {
    stopBtn.addEventListener('click', callbacks.stop);
  }

  // Close button
  if (closeBtn && callbacks.close) {
    closeBtn.addEventListener('click', callbacks.close);
  }

  // Show saved results button
  if (showResultsBtn && callbacks.showSavedResults) {
    showResultsBtn.addEventListener('click', callbacks.showSavedResults);
  }

  // API key change on blur
  if (apiKeyInput && callbacks.apiKeyChange) {
    apiKeyInput.addEventListener('blur', function () {
      callbacks.apiKeyChange(apiKeyInput.value.trim());
    });
  }

  // Search context change on blur
  if (searchContextInput && callbacks.searchContextChange) {
    searchContextInput.addEventListener('blur', function () {
      callbacks.searchContextChange(searchContextInput.value.trim());
    });
  }

  // Provider dropdown change
  if (providerSelect && callbacks.providerChange) {
    providerSelect.addEventListener('change', function () {
      callbacks.providerChange(providerSelect.value)['catch'](function (err) {
        console.error('[MDF] Provider change error:', err);
      });
    });
  }

  // Model ID change on blur
  if (modelIdInput && callbacks.modelIdChange) {
    modelIdInput.addEventListener('blur', function () {
      callbacks.modelIdChange(modelIdInput.value.trim());
    });
  }

  // Base URL change on blur
  if (baseUrlInput && callbacks.baseUrlChange) {
    baseUrlInput.addEventListener('blur', function () {
      callbacks.baseUrlChange(baseUrlInput.value.trim());
    });
  }

  // Portkey Config change on blur
  const portkeyConfigInput = document.getElementById(prefix + '-portkey-config');
  if (portkeyConfigInput && callbacks.portkeyConfigChange) {
    portkeyConfigInput.addEventListener('blur', function () {
      callbacks.portkeyConfigChange(portkeyConfigInput.value.trim());
    });
  }

  // Model preset click delegation
  if (presetContainer && callbacks.modelPresetClick) {
    presetContainer.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-model-id]');
      if (btn) {
        const modelId = btn.getAttribute('data-model-id');
        const rawOpts = btn.getAttribute('data-options');
        let options = null;
        if (rawOpts) { try { options = JSON.parse(rawOpts); } catch (e) { /* ignore */ } }
        callbacks.modelPresetClick(modelId, options);
      }
    });
  }

  // Hover effects for action buttons
  [startBtn, pauseBtn, stopBtn, showResultsBtn].forEach(function (btn) {
    if (btn) {
      btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.9'; });
      btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
    }
  });
}

/* ─── Results View Listeners ─── */

/**
 * Attaches event listeners for the results view.
 * @param {string} prefix - Site prefix
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.close - Close modal handler
 * @param {Function} callbacks.backToSettings - Back to settings handler
 * @param {Function} callbacks.exportMarkdown - Export Markdown handler
 * @param {Function} callbacks.exportJSON - Export JSON handler
 * @param {Function} callbacks.exportCSV - Export CSV handler
 * @param {Function} callbacks.clearResults - Clear results handler
 */
export function attachResultsListeners(prefix, callbacks) {
  const closeBtn = document.getElementById(prefix + '-close-btn-x');
  const backBtn = document.getElementById(prefix + '-back-to-settings');
  const exportMdBtn = document.getElementById(prefix + '-export-markdown-btn');
  const exportJsonBtn = document.getElementById(prefix + '-export-json-btn');
  const exportCsvBtn = document.getElementById(prefix + '-export-csv-btn');
  const clearBtn = document.getElementById(prefix + '-clear-results-btn');

  if (closeBtn && callbacks.close) closeBtn.addEventListener('click', callbacks.close);
  if (backBtn && callbacks.backToSettings) backBtn.addEventListener('click', callbacks.backToSettings);
  if (exportMdBtn && callbacks.exportMarkdown) exportMdBtn.addEventListener('click', callbacks.exportMarkdown);
  if (exportJsonBtn && callbacks.exportJSON) exportJsonBtn.addEventListener('click', callbacks.exportJSON);
  if (exportCsvBtn && callbacks.exportCSV) exportCsvBtn.addEventListener('click', callbacks.exportCSV);
  if (clearBtn && callbacks.clearResults) clearBtn.addEventListener('click', callbacks.clearResults);

  // Hover effects
  [closeBtn, backBtn, exportMdBtn, exportJsonBtn, exportCsvBtn, clearBtn].forEach(function (btn) {
    if (btn) {
      btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.9'; });
      btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
    }
  });
}

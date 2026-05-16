// src/marketplace-deal-finder/_ui-panel.js — Modal sidebar + floating button
'use strict';

import { renderResultsView } from './_ui-settings.js';

/** @constant {string} */
const SIDEBAR_WIDTH = '400px';

/* ─── Modal Management ─── */

/**
 * Creates the modal sidebar element and appends it to document.body.
 * Does NOT open it automatically.
 * @param {string} prefix - Site prefix ("wh" or "ka") for DOM IDs
 */
export function createModal(prefix) {
  const modalId = prefix + '-dealfinder-modal';
  if (document.getElementById(modalId)) return;

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = [
    'display: none; position: fixed; top: 0; right: 0; width: 400px; height: 100vh;',
    'background: white; z-index: 999999; box-shadow: -5px 0 20px rgba(0,0,0,0.2);',
    'overflow-y: auto; transition: transform 0.3s ease;'
  ].join(' ');
  document.body.appendChild(modal);
}

/**
 * Opens the modal sidebar (shows it, hides floating button, shifts page).
 * @param {string} prefix - Site prefix
 */
export function openModal(prefix) {
  const modal = document.getElementById(prefix + '-dealfinder-modal');
  const floatBtn = document.getElementById(prefix + '-dealfinder-btn');
  if (modal) modal.style.display = 'block';
  if (floatBtn) floatBtn.style.display = 'none';
  document.documentElement.style.transition = 'margin-right 0.3s ease';
  document.documentElement.style.marginRight = SIDEBAR_WIDTH;
}

/**
 * Closes the modal sidebar (unless crawl is running).
 * @param {string} prefix - Site prefix
 * @param {boolean} isRunning - If true, close is prevented with visual feedback
 */
export function closeModal(prefix, isRunning) {
  if (isRunning) {
    const btn = document.getElementById(prefix + '-close-btn-x');
    if (btn) {
      btn.style.color = '#dc3545';
      btn.title = 'Crawl laeuft - erst stoppen';
      setTimeout(function () { btn.style.color = '#999'; btn.title = ''; }, 1000);
    }
    return;
  }
  const modal = document.getElementById(prefix + '-dealfinder-modal');
  const floatBtn = document.getElementById(prefix + '-dealfinder-btn');
  if (modal) modal.style.display = 'none';
  if (floatBtn) floatBtn.style.display = 'block';
  document.documentElement.style.marginRight = '';
}

/* ─── Floating Button ─── */

/**
 * Creates the floating "Deal Finder" button on the right edge of the viewport.
 * @param {string} prefix - Site prefix
 * @param {string} gradient - CSS gradient for button background
 * @returns {HTMLElement|undefined} The button element, or undefined if already exists
 */
export function createDealFinderButton(prefix, gradient) {
  const buttonId = prefix + '-dealfinder-btn';
  if (document.getElementById(buttonId)) return;

  const button = document.createElement('button');
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
 * @param {string} prefix - Site prefix
 */
export function hideFloatingButton(prefix) {
  const btn = document.getElementById(prefix + '-dealfinder-btn');
  if (btn) btn.style.display = 'none';
}

/**
 * Shows the floating button.
 * @param {string} prefix - Site prefix
 */
export function showFloatingButton(prefix) {
  const btn = document.getElementById(prefix + '-dealfinder-btn');
  if (btn) btn.style.display = 'block';
}

/* ─── View Switching ─── */

/**
 * Switches the modal content to the results view.
 * @param {string} prefix - Site prefix
 * @param {Array} deals - Deals to display
 */
export function switchToResultsView(prefix, deals) {
  const modal = document.getElementById(prefix + '-dealfinder-modal');
  if (!modal) return;
  modal.innerHTML = renderResultsView(prefix, deals || []);
}

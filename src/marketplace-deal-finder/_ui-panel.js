// src/marketplace-deal-finder/_ui-panel.js — Modal sidebar + floating button
'use strict';

import { renderResultsView } from './_ui-settings.js';
import { createShadowContainer } from './_dom.js';
import { S as state } from './_state.js';

/** @constant {string} */
const SIDEBAR_WIDTH = '400px';

/** @constant {string} */
const SHADOW_STYLES = [
  ':host { all: initial; contain: strict; isolation: isolate; }',
  ':host { display: none; position: fixed; top: 0; right: 0; width: 400px; height: 100vh;',
  '  background: white; z-index: 999999; box-shadow: -5px 0 20px rgba(0,0,0,0.2);',
  '  overflow-y: auto; transition: transform 0.3s ease;',
  '  font-family: system-ui, -apple-system, sans-serif;',
  '  pointer-events: auto; }',
  ':host([open]) { display: block; }'
].join('\n');

/* ─── Modal Management ─── */

/**
 * Creates the modal sidebar inside a closed Shadow DOM container.
 * Does NOT open it automatically.
 * @param {string} prefix - Site prefix ("wh" or "ka") for DOM IDs
 */
export function createModal(prefix) {
  var modalId = prefix + '-dealfinder-modal';
  if (document.getElementById(modalId)) return;

  var container = createShadowContainer({
    tag: 'div',
    id: modalId,
    styles: SHADOW_STYLES
  });
  state.uiRoot = container.root;
  state.uiContent = container.content;
}

/**
 * Opens the modal sidebar (shows it, hides floating button, shifts page).
 * @param {string} prefix - Site prefix
 */
export function openModal(prefix) {
  var modal = document.getElementById(prefix + '-dealfinder-modal');
  var floatBtn = document.getElementById(prefix + '-dealfinder-btn');
  if (modal) modal.setAttribute('open', '');
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
    var closeBtn = state.uiRoot ? state.uiRoot.getElementById(prefix + '-close-btn-x') : null;
    if (closeBtn) {
      closeBtn.style.color = '#dc3545';
      closeBtn.title = 'Crawl laeuft - erst stoppen';
      setTimeout(function () { closeBtn.style.color = '#999'; closeBtn.title = ''; }, 1000);
    }
    return;
  }
  var modal = document.getElementById(prefix + '-dealfinder-modal');
  var floatBtn = document.getElementById(prefix + '-dealfinder-btn');
  if (modal) modal.removeAttribute('open');
  if (floatBtn) floatBtn.style.display = 'block';
  document.documentElement.style.marginRight = '';
}

/* ─── Floating Button ─── */

/**
 * Creates the floating "Deal Finder" button on the right edge of the viewport.
 * The button stays in the Light DOM (outside Shadow DOM) so it's always visible.
 * @param {string} prefix - Site prefix
 * @param {string} gradient - CSS gradient for button background
 * @returns {HTMLElement|undefined} The button element, or undefined if already exists
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
 * @param {string} prefix - Site prefix
 */
export function hideFloatingButton(prefix) {
  var btn = document.getElementById(prefix + '-dealfinder-btn');
  if (btn) btn.style.display = 'none';
}

/**
 * Shows the floating button.
 * @param {string} prefix - Site prefix
 */
export function showFloatingButton(prefix) {
  var btn = document.getElementById(prefix + '-dealfinder-btn');
  if (btn) btn.style.display = 'block';
}

/* ─── View Switching ─── */

/**
 * Switches the modal content to the results view.
 * @param {string} prefix - Site prefix
 * @param {Array} deals - Deals to display
 */
export function switchToResultsView(prefix, deals) {
  if (!state.uiContent) return;
  state.uiContent.innerHTML = renderResultsView(prefix, deals || []);
}

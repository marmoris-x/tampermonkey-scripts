/**
 * @fileoverview Inline menu UI for Reddit Content Unlocker.
 * Creates a toggle button in Reddit's header with a dropdown
 * containing:
 * - Master toggle (power button icon)
 * - NSFW unblur checkbox
 * - Spoiler unblur checkbox
 *
 * Click-outside-to-close behavior and state persistence included.
 *
 * @module _menu-ui
 */

import { stateManager } from './_state.js';
import { SELECTORS } from './_selectors.js';

/** @type {HTMLElement|null} */
let menuElement = null;

/** @type {boolean} */
let initialized = false;

/**
 * Power button SVG icon (FontAwesome-style toggle).
 */
const POWER_ICON_SVG = `
  <svg viewBox="0 0 24 24">
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V3ZM8.6092 5.8744C9.09211 5.60643 9.26636 4.99771 8.99839 4.5148C8.73042 4.03188 8.12171 3.85763 7.63879 4.1256C4.87453 5.65948 3 8.61014 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 8.66747 19.1882 5.75928 16.5007 4.20465C16.0227 3.92811 15.4109 4.09147 15.1344 4.56953C14.8579 5.04759 15.0212 5.65932 15.4993 5.93586C17.5942 7.14771 19 9.41027 19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 9.3658 6.45462 7.06997 8.6092 5.8744Z">
    </path>
  </svg>`;

/**
 * Creates and injects the Unblur toggle menu into Reddit's header.
 * Searches for appropriate anchor points in the header navigation.
 * Safe to call multiple times — only initializes once.
 */
export function initMenu() {
  if (initialized) return;
  initialized = true;

  // Find anchor point in Reddit header
  const navTarget =
    document.querySelector(SELECTORS.HEADER_NAV_V2) ||
    document.querySelector(SELECTORS.HEADER_NAV) ||
    document.querySelector(SELECTORS.HEADER) ||
    document.body;

  // Create menu container using GM_addElement for CSP bypass
  menuElement = GM_addElement(navTarget, 'div', {
    id: 'menu-unblur'
  });

  // Build menu HTML
  menuElement.innerHTML = getMenuHTML();

  // Toggle dropdown on button click
  menuElement.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.id === 'menu' || target.id === 'popup-toggle') {
      menuElement.classList.toggle('active');
    }
  });

  // Bind form elements and set initial values
  bindFormControls();

  // Click outside to close
  document.addEventListener('click', handleClickOutside);

  // Prevent media-telemetry-observer from intercepting clicks
  document.addEventListener('click', (e) => {
    if (e.target.closest('media-telemetry-observer')) {
      e.preventDefault();
    }
  });
}

/**
 * Generates the menu HTML structure.
 * @returns {string} HTML string
 */
function getMenuHTML() {
  return `
    <div id="popup-toggle">Unblur</div>
    <form id="status-container">
      <div id="status"></div>
      <div id="container-toggle">
        <label for="toggle">
          <input id="toggle" name="toggle" type="checkbox">
          ${POWER_ICON_SVG}
        </label>
      </div>
      <div id="selected-ops">
        <label for="toggle-nsfw">
          <input type="checkbox" name="toggle-nsfw" id="toggle-nsfw">
          <span class="slider"></span>
          <span class="slider-label">Unblur NSFW</span>
        </label>
        <label for="toggle-spoiler">
          <input type="checkbox" name="toggle-spoiler" id="toggle-spoiler">
          <span class="slider"></span>
          <span class="slider-label">Unblur Spoiler</span>
        </label>
      </div>
    </form>
  `;
}

/**
 * Binds form controls to state manager and sets initial values.
 */
function bindFormControls() {
  const toggle = /** @type {HTMLInputElement} */ (document.getElementById('toggle'));
  const toggleNSFW = /** @type {HTMLInputElement} */ (document.getElementById('toggle-nsfw'));
  const toggleSpoiler = /** @type {HTMLInputElement} */ (document.getElementById('toggle-spoiler'));
  const form = /** @type {HTMLFormElement} */ (document.getElementById('status-container'));

  if (!toggle || !toggleNSFW || !toggleSpoiler || !form) return;

  // Set initial state from storage
  const state = stateManager.getAll();
  toggle.checked = state.state;
  toggleNSFW.checked = state.nsfw;
  toggleSpoiler.checked = state.spoiler;

  // Persist changes on any form change
  form.addEventListener('change', () => {
    stateManager.update({
      state: toggle.checked,
      nsfw: toggleNSFW.checked,
      spoiler: toggleSpoiler.checked
    });
  });
}

/**
 * Closes the dropdown when clicking outside the menu.
 * @param {MouseEvent} e - Click event
 */
function handleClickOutside(e) {
  if (!menuElement) return;

  const target = /** @type {HTMLElement} */ (e.target);
  if (!target.closest('#menu-unblur') && menuElement.classList.contains('active')) {
    menuElement.classList.remove('active');
  }
}

/**
 * Resets menu state so it gets re-created on next init.
 * Should be called after SPA navigation when the header is replaced.
 */
export function resetMenu() {
  menuElement = null;
  initialized = false;
}

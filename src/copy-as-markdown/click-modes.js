/**
 * Copy as Markdown — Click Mode Module
 *
 * Provides interactive click-to-select modes (image picking, link picking).
 * Elements are highlighted on hover and selected via click.
 */

import { createToast } from '../shared/ui-components.js';

/** @type {string|null} */
export let activeClickMode = null;

/** @type {Function|null} */
let _clickListener = null;

/** @type {Function|null} */
let _keyListener = null;

/** @type {HTMLStyleElement|null} */
let _hoverStyle = null;

/**
 * @typedef {Object} ClickModeConfig
 * @property {string}   mode            - Mode identifier ('img' or 'link')
 * @property {string}   hint            - Toast hint text
 * @property {string}   targetSelector  - CSS selector for target elements
 * @property {Function} handler         - (target: Element) => markdownString
 * @property {Function} onResult        - (markdown: string) => Promise<void>
 * @property {Function} [onCancel]      - Called when mode is cancelled
 * @property {Function} [getSidebarHost] - () => Element|null
 * @property {Function} [getModeButton] - () => Element|null
 */

/**
 * Start an interactive click-to-select mode.
 * @param {ClickModeConfig} config
 */
export function startClickMode(config) {
  if (activeClickMode) stopClickMode();
  activeClickMode = config.mode;

  const modeBtn = config.getModeButton ? config.getModeButton() : null;
  if (modeBtn) modeBtn.classList.add('mds-active-mode');

  createToast(config.hint + ' (Esc to cancel)', { type: 'info', duration: 3000 });

  _hoverStyle = document.createElement('style');
  _hoverStyle.textContent = config.targetSelector +
    ':hover { outline: 3px dashed #f59e0b !important; outline-offset: 2px !important; cursor: crosshair !important; opacity: 0.85 !important; }';
  document.head.appendChild(_hoverStyle);

  _keyListener = function (e) {
    if (e.key === 'Escape') {
      stopClickMode();
      if (config.onCancel) config.onCancel();
    }
  };
  document.addEventListener('keydown', _keyListener, true);

  const listener = async function (e) {
    const host = config.getSidebarHost ? config.getSidebarHost() : null;
    if (host && host.contains(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const target = config.targetSelector === 'img'
      ? (e.target.tagName === 'IMG' ? e.target : null)
      : e.target.closest(config.targetSelector);

    if (!target) {
      stopClickMode();
      if (config.onCancel) config.onCancel();
      return;
    }

    const md = config.handler(target);
    stopClickMode();
    await config.onResult(md);
  };
  _clickListener = listener;
  document.addEventListener('click', listener, true);
}

/**
 * Stop the currently active click mode and clean up all listeners.
 */
export function stopClickMode() {
  if (_clickListener) {
    document.removeEventListener('click', _clickListener, true);
    _clickListener = null;
  }
  if (_keyListener) {
    document.removeEventListener('keydown', _keyListener, true);
    _keyListener = null;
  }
  if (_hoverStyle) {
    _hoverStyle.remove();
    _hoverStyle = null;
  }
  activeClickMode = null;
}

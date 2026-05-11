import { CONST } from './_constants.js';

/**
 * Injects the CSS for the speed indicator via GM_addStyle.
 * The indicator uses a fixed position overlay with high z-index.
 */
export function injectStyles() {
  GM_addStyle(`
    #${CONST.INDICATOR_ID} {
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.78);
      color: #fff;
      padding: 7px 15px;
      border-radius: 6px;
      font: bold 16px/1 sans-serif;
      z-index: 2147483647;
      display: none;
      pointer-events: none;
      user-select: none;
    }
  `);
}

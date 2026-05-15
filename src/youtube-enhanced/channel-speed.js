// src/youtube-enhanced/channel-speed.js — Per-channel speed control for YouTube
// Injects a custom "Channel speed" menu item into YouTube's settings panel,
// reads/stores per-channel speed preferences, and applies them to the
// HTML5 <video> element whenever the channel or video changes.
//
// UI follows YouTube's native panel structure (ytp-panel) for seamless
// integration with existing animations and navigation.
'use strict';

import { createLogger } from './_logger.js';
import { loadSetting, saveSetting } from './_storage.js';
import { observeMutations } from './_dom.js';
import { matchAnyTerm } from './_text.js';
import { LANG } from './_i18n.js';

const log = createLogger('YouTube Enhanced');

// =========================================================
// Utility helpers
// =========================================================

function roundSpeed(v) { return Math.round(v * 100) / 100; }
function clampSpeed(v) { return Math.max(0.25, Math.min(3, v)); }

// =========================================================
// Constants
// =========================================================

const SPEED_KEY    = 'yt_suite_channel_speeds';
const MENU_DELAY   = 50;
const SPEED_RETRY  = 1000;
const INIT_TIMEOUT = 15000;

// =========================================================
// State
// =========================================================

let speedCache        = {};
const speedObs          = new Set();
let speedAbort        = null;
let speedRetryTimeout = null;
let speedInitTimeout  = null;
let currentChannelId  = null;
let isApplyingSpeed   = false;
let menuPanel         = null;
let customPanel       = null;
let inCustomPanel     = false;

let origMenuWidth  = '';
let origMenuHeight = '';

// =========================================================
// Speed data persistence
// =========================================================

/**
 * Returns the current speed cache (channelId -> speed map).
 * @returns {object}
 */
export function getSpeeds() { return speedCache; }

/**
 * Loads saved per-channel speeds from storage.
 */
export async function loadSpeedData() {
  try {
    speedCache = await loadSetting(SPEED_KEY, {});
  } catch (_) { speedCache = {}; }
}

/**
 * Saves a speed value for a specific channel to storage.
 * @param {string} cid - Channel ID
 * @param {number} val - Playback speed
 */
async function saveSpeed(cid, val) {
  try {
    speedCache[cid] = val;
    await saveSetting(SPEED_KEY, speedCache);
  } catch (e) { log.debug('saveSpeed error:', e); }
}

// =========================================================
// Speed application
// =========================================================

/**
 * Directly sets playbackRate on the main YouTube <video> element.
 * @param {number} val - Desired playback speed
 */
function applySpeed(val) {
  try {
    const vid = document.querySelector('.html5-main-video');
    if (vid && Math.abs(vid.playbackRate - val) > 0.001) {
      isApplyingSpeed = true;
      try {
        vid.playbackRate = val;
      } finally {
        isApplyingSpeed = false;
      }
    }
  } catch (e) { log.debug('applySpeed error:', e); }
}

/**
 * Extracts the current channel ID from YouTube's page DOM.
 * Tries several selectors in order of reliability.
 * @returns {string|null}
 */
function getChannelId() {
  try {
    const a = document.querySelector('#upload-info #channel-name #text a');
    if (a) return new URL(a.href).pathname.split('/').pop();

    const shortsChannel = document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a');
    if (shortsChannel) return new URL(shortsChannel.href).pathname.split('/').pop();

    const anyChannel = document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
    if (anyChannel) return new URL(anyChannel.href).pathname.split('/').pop();
  } catch (_) {}
  return null;
}

// =========================================================
// Speed Panel UI (native YouTube look & feel)
// =========================================================

/**
 * Builds the full speed control panel as a ytp-panel element with slider,
 * increment/decrement buttons, preset chips, and back navigation.
 * Mirrors YouTube's own variable-speed panel structure exactly.
 * @param {HTMLElement} settingsMenu - The YouTube settings menu container
 * @returns {HTMLElement} The constructed panel element
 */
function buildSpeedPanel(settingsMenu) {
  // Build panel using DOM API (no innerHTML — YouTube enforces Trusted Types CSP)
  const panel = document.createElement('div');
  panel.className = 'ytp-panel';
  panel.style.cssText = 'width:330px;height:250px';

  // Header
  const header = document.createElement('div');
  header.className = 'ytp-panel-header';
  const backBtnContainer = document.createElement('div');
  backBtnContainer.className = 'ytp-panel-back-button-container';
  const backBtn = document.createElement('button');
  backBtn.className = 'ytp-button ytp-panel-back-button';
  backBtn.setAttribute('aria-label', LANG.backToPreviousMenu);
  backBtnContainer.appendChild(backBtn);
  header.appendChild(backBtnContainer);
  const title = document.createElement('span');
  title.className = 'ytp-panel-title';
  title.setAttribute('role', 'heading');
  title.setAttribute('aria-level', '2');
  title.textContent = LANG.channelSpeed;
  header.appendChild(title);
  panel.appendChild(header);

  // Content area
  const content = document.createElement('div');
  content.className = 'ytp-variable-speed-panel-content';
  content.setAttribute('tabindex', '0');
  content.style.height = '193px';

  // Display container
  const displayContainer = document.createElement('div');
  displayContainer.className = 'ytp-speed-display-container';
  const display = document.createElement('div');
  display.className = 'ytp-variable-speed-panel-display';
  display.setAttribute('aria-live', 'polite');
  const badge = document.createElement('div');
  badge.className = 'ytp-variable-speed-panel-premium-badge';
  badge.setAttribute('tabindex', '-1');
  const badgeInner = document.createElement('div');
  badgeInner.className = 'ytp-variable-speed-panel-badge';
  badge.appendChild(badgeInner);
  display.appendChild(badge);
  const displayText = document.createElement('span');
  displayText.textContent = '1.00x';
  display.appendChild(displayText);
  displayContainer.appendChild(display);
  content.appendChild(displayContainer);

  // Slider container
  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'ytp-variable-speed-panel-slider-container';

  // Decrement button
  const btnDec = document.createElement('button');
  btnDec.className = 'ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button';
  btnDec.setAttribute('aria-label', LANG.decreaseSpeed);
  const decSpan = document.createElement('span');
  decSpan.textContent = '-';
  btnDec.appendChild(decSpan);
  sliderContainer.appendChild(btnDec);

  // Slider section
  const sliderSection = document.createElement('div');
  sliderSection.className = 'ytp-input-slider-section';
  const indicator = document.createElement('div');
  indicator.className = 'ytp-speedslider-indicator-container';
  const sliderBadge = document.createElement('div');
  sliderBadge.className = 'ytp-speedslider-badge';
  sliderBadge.setAttribute('aria-label', '');
  indicator.appendChild(sliderBadge);
  const sliderText = document.createElement('p');
  sliderText.className = 'ytp-speedslider-text';
  sliderText.textContent = '1.00x';
  indicator.appendChild(sliderText);
  sliderSection.appendChild(indicator);
  const slider = document.createElement('input');
  slider.className = 'ytp-input-slider ytp-speedslider ytp-varispeed-input-slider';
  slider.setAttribute('role', 'slider');
  slider.setAttribute('tabindex', '0');
  slider.type = 'range';
  slider.min = '0.25';
  slider.max = '3';
  slider.step = '0.05';
  slider.value = '1';
  slider.setAttribute('aria-valuenow', '1');
  slider.setAttribute('aria-valuemin', '0.25');
  slider.setAttribute('aria-valuemax', '3');
  slider.setAttribute('aria-valuetext', '1.00');
  slider.style.setProperty('--yt-slider-shape-gradient-percent', '42.857142857142854%');
  sliderSection.appendChild(slider);
  sliderContainer.appendChild(sliderSection);

  // Increment button
  const btnInc = document.createElement('button');
  btnInc.className = 'ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button';
  btnInc.setAttribute('aria-label', LANG.increaseSpeed);
  const incSpan = document.createElement('span');
  incSpan.textContent = '+';
  btnInc.appendChild(incSpan);
  sliderContainer.appendChild(btnInc);
  content.appendChild(sliderContainer);

  // Chips
  const chips = document.createElement('div');
  chips.className = 'ytp-variable-speed-panel-chips';

  function makeChip(_value, labelText, priority, hidden) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ytp-variable-speed-panel-preset-button-wrapper';
    wrapper.setAttribute('data-priority', String(priority));
    wrapper.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    if (hidden) wrapper.style.display = 'none';
    const btn = document.createElement('button');
    btn.className = 'ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button';
    const span = document.createElement('span');
    span.textContent = labelText;
    btn.appendChild(span);
    wrapper.appendChild(btn);
    if (labelText === '3.0') {
      const upsell = document.createElement('div');
      upsell.className = 'ytp-variable-speed-panel-premium-upsell-icon';
      btn.insertBefore(upsell, span);
    }
    if (labelText === '1') {
      const lbl = document.createElement('div');
      lbl.className = 'ytp-variable-speed-panel-preset-button-label-text';
      lbl.textContent = LANG.standard;
      wrapper.appendChild(lbl);
    }
    chips.appendChild(wrapper);
    return { wrapper, btn, span };
  }

  const chipDefs = [
    { value: '1', label: '1', priority: 5, hidden: false },
    { value: '1,25', label: '1,25', priority: 2, hidden: false },
    { value: '1,5', label: '1,5', priority: 3, hidden: false },
    { value: '1,75', label: '1,75', priority: 0, hidden: true },
    { value: '2', label: '2', priority: 4, hidden: false },
    { value: '3.0', label: '3.0', priority: 1, hidden: false }
  ];
  const chipElements = chipDefs.map(function (d) {
    return makeChip(d.value, d.label, d.priority, d.hidden);
  });
  content.appendChild(chips);

  panel.appendChild(content);

  let cid = currentChannelId;
  if (!cid) cid = getChannelId();
  const stored = getSpeeds();
  let curSpeed = cid && stored[cid] ? stored[cid] : 1.0;

  // Localize chip numbers based on language
  if (!LANG.isGerman) {
    chipElements.forEach(function (ce) {
      ce.span.textContent = ce.span.textContent.replace(',', '.');
    });
  } else {
    chipElements.forEach(function (ce) {
      ce.span.textContent = ce.span.textContent.replace('.', ',');
    });
  }

  backBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeSpeedPanel(settingsMenu);
  });

  function getSliderPercent(v) {
    const clamped = clampSpeed(v);
    return (Math.max(0, Math.min(1, (clamped - 0.25) / (3 - 0.25))) * 100).toFixed(6) + '%';
  }

  function refreshUI(v) {
    curSpeed = v;
    const strVal = v.toFixed(2) + 'x';
    displayText.textContent = strVal;
    sliderText.textContent = strVal;

    const clampedSlider = clampSpeed(v);
    slider.value = String(clampedSlider);
    slider.setAttribute('aria-valuenow', String(v));
    slider.setAttribute('aria-valuetext', v.toFixed(2));
    slider.style.setProperty('--yt-slider-shape-gradient-percent', getSliderPercent(v));

    chipElements.forEach(function (ce) {
      const btnVal = parseFloat(ce.span.textContent.replace(',', '.'));
      if (Math.abs(btnVal - v) < 0.001) {
        ce.btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
      } else {
        ce.btn.style.backgroundColor = 'transparent';
      }
    });
  }

  function commit(v) {
    const rounded = roundSpeed(v);
    refreshUI(rounded);
    if (cid) {
      saveSpeed(cid, rounded);
    }
    applySpeed(rounded);
    updateMenuItemText(rounded);
  }

  slider.addEventListener('input', function (e) { commit(parseFloat(e.target.value)); });
  btnDec.addEventListener('click', function (e) {
    e.stopPropagation();
    commit(Math.max(0.25, roundSpeed(curSpeed - 0.05)));
  });
  btnInc.addEventListener('click', function (e) {
    e.stopPropagation();
    commit(Math.min(3.0, roundSpeed(curSpeed + 0.05)));
  });

  chipElements.forEach(function (ce) {
    const speedVal = parseFloat(ce.span.textContent.replace(',', '.'));
    ce.btn.addEventListener('click', function (e) {
      e.stopPropagation();
      commit(speedVal);
    });
  });

  refreshUI(curSpeed);
  return panel;
}

/**
 * Opens the speed panel inside YouTube's settings menu, hiding the
 * existing menu panel and resizing the container.
 * @param {HTMLElement} settingsMenu
 */
function openSpeedPanel(settingsMenu) {
  if (inCustomPanel) return;
  menuPanel = settingsMenu.querySelector('.ytp-panel');
  if (!menuPanel) return;

  origMenuWidth = settingsMenu.style.width;
  origMenuHeight = settingsMenu.style.height;

  inCustomPanel = true;
  customPanel = buildSpeedPanel(settingsMenu);
  settingsMenu.appendChild(customPanel);

  menuPanel.style.display = 'none';
  settingsMenu.style.width = '330px';
  settingsMenu.style.height = '250px';
}

/**
 * Closes the speed panel and restores YouTube's original settings menu.
 * @param {HTMLElement} settingsMenu
 */
function closeSpeedPanel(settingsMenu) {
  if (!inCustomPanel) return;

  if (customPanel) { customPanel.remove(); customPanel = null; }
  if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }

  settingsMenu.style.width = origMenuWidth;
  settingsMenu.style.height = origMenuHeight;

  inCustomPanel = false;
}

/**
 * Updates the menu item text showing the current channel speed.
 * @param {number} speed
 */
function updateMenuItemText(speed) {
  const el = document.querySelector('#yts-chan-speed .ytp-menuitem-content');
  if (el) el.textContent = speed === 1 ? LANG.standard : speed.toFixed(2) + 'x';
}

// =========================================================
// Menu item injection
// =========================================================

const SPEED_TERMS = ['speed','geschwindigkeit','velocidad','vitesse','速度','속도','velocita','hizi','snelheid','kecepatan','toc do','ความเร็ว','predkosc','скорость','سرعة','velocidade','hastighet','rychlost'];

/**
 * Inserts a "Channel speed" menu item into YouTube's settings panel,
 * positioned right after the native "Speed" item (matched language-agnostically).
 * @returns {boolean} true if the item was inserted (or already exists)
 */
function insertSpeedMenuItem() {
  const menu = document.querySelector('.ytp-settings-menu');
  if (!menu) return false;
  const panelMenu = menu.querySelector('.ytp-panel-menu');
  if (!panelMenu) return false;

  if (document.querySelector('#yts-chan-speed')) return true;

  let ytSpeedItem = null;
  const items = panelMenu.querySelectorAll('.ytp-menuitem');
  for (let i = 0; i < items.length; i++) {
    const lbl = items[i].querySelector('.ytp-menuitem-label');
    if (lbl && matchAnyTerm(lbl.textContent, SPEED_TERMS)) {
      ytSpeedItem = items[i];
      break;
    }
  }
  if (!ytSpeedItem) return false;

  const cid   = getChannelId();
  const stored = getSpeeds();
  const saved = cid ? stored[cid] : undefined;
  const label = saved && saved !== 1 ? saved.toFixed(2) + 'x' : LANG.standard;

  const item = document.createElement('div');
  item.id        = 'yts-chan-speed';
  item.className = 'ytp-menuitem';
  item.setAttribute('role',         'menuitem');
  item.setAttribute('tabindex',     '0');
  item.setAttribute('aria-haspopup','true');

  // Icon container with SVG play button (DOM API — no innerHTML for Trusted Types)
  const iconDiv = document.createElement('div');
  iconDiv.className = 'ytp-menuitem-icon';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('fill', 'white');
  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z');
  svg.appendChild(path1);
  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M9.5 16.5v-9l7 4.5z');
  svg.appendChild(path2);
  iconDiv.appendChild(svg);
  item.appendChild(iconDiv);

  const labelDiv = document.createElement('div');
  labelDiv.className = 'ytp-menuitem-label';
  labelDiv.textContent = LANG.channelSpeedLabel;
  item.appendChild(labelDiv);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'ytp-menuitem-content';
  contentDiv.textContent = label;
  item.appendChild(contentDiv);

  item.addEventListener('click', function (e) {
    e.stopPropagation();
    openSpeedPanel(menu);
  });

  ytSpeedItem.insertAdjacentElement('afterend', item);
  return true;
}

/**
 * Ensures the speed menu item exists and its display matches the
 * currently loaded per-channel speed.
 */
export function syncSpeedMenuDisplay() {
  insertSpeedMenuItem();
  const s = getSpeeds()[getChannelId()];
  if (s) updateMenuItemText(s);
}

// =========================================================
// Settings menu observer
// =========================================================

/**
 * Observes YouTube's settings menu for visibility changes.
 * Opens/closes the speed sub-panel as needed and re-syncs the menu item.
 * @param {AbortSignal} signal - AbortSignal for cleanup
 * @param {number} [retryCount=3] - Number of retries if menu not found
 */
function watchSettingsMenu(signal, retryCount) {
  if (retryCount === undefined) retryCount = 3;
  const menu = document.querySelector('.ytp-settings-menu');
  const btn  = document.querySelector('.ytp-settings-button');
  if (!menu || !btn) {
    if (retryCount > 0) {
      setTimeout(function () { watchSettingsMenu(signal, retryCount - 1); }, 500);
    }
    return;
  }

  const obs = new MutationObserver(function () {
    if (menu.style.display === 'none') {
      if (inCustomPanel) closeSpeedPanel(menu);
    } else {
      setTimeout(syncSpeedMenuDisplay, MENU_DELAY);
    }
  });
  obs.observe(menu, { attributes: true, attributeFilter: ['style'] });
  speedObs.add(obs);

  btn.addEventListener('click', function () {
    setTimeout(function () {
      const m = document.querySelector('.ytp-settings-menu');
      if (m && m.style.display !== 'none') syncSpeedMenuDisplay();
    }, MENU_DELAY);
  }, { signal: signal });
}

// =========================================================
// Initialization
// =========================================================

/**
 * Initializes per-channel speed control. Waits for the YouTube player
 * elements to appear, then applies the saved speed for the current channel.
 * Sets up MutationObserver-based monitoring and settings menu integration.
 */
export function initSpeed() {
  if (speedRetryTimeout) clearTimeout(speedRetryTimeout);
  if (speedInitTimeout) clearTimeout(speedInitTimeout);

  function checkAndSetup(obs) {
    try {
      const vid = document.querySelector('.html5-main-video');
      const chan = document.querySelector('#upload-info #channel-name #text a') ||
                   document.querySelector('ytd-reel-player-header-renderer #channel-name a, ytd-reel-player-overlay-renderer #channel-name a') ||
                   document.querySelector('a[href*="/@"]') || document.querySelector('a[href*="/channel/"]');
      if (!vid || !chan) return;

      obs.disconnect();
      speedObs.delete(obs);

      const cid = new URL(chan.href).pathname.split('/').pop();
      const stored = getSpeeds();
      const saved = stored[cid];
      currentChannelId = cid;

      if (speedAbort) speedAbort.abort();
      speedAbort = new AbortController();

      vid.addEventListener('ratechange', function () {
        if (isApplyingSpeed) return;
        const currentSaved = getSpeeds()[currentChannelId];
        if (currentSaved && Math.abs(vid.playbackRate - currentSaved) > 0.01) {
          isApplyingSpeed = true;
          vid.playbackRate = currentSaved;
          isApplyingSpeed = false;
        }
      }, { signal: speedAbort.signal });

      if (saved) {
        applySpeed(saved);
        speedRetryTimeout = setTimeout(function () { applySpeed(saved); }, SPEED_RETRY);
      }

      watchSettingsMenu(speedAbort.signal);
    } catch (e) { log.debug('initSpeed error:', e); }
  }

  const obs = observeMutations(function (_, obs) {
    checkAndSetup(obs);
  }, document.documentElement);
  speedObs.add(obs);

  // Immediate check for already-present elements
  checkAndSetup(obs);

  speedInitTimeout = setTimeout(function () {
    obs.disconnect();
    speedObs.delete(obs);
    log.debug('initSpeed: Timeout reached, no channel found');
  }, INIT_TIMEOUT);
}

/**
 * Cleans up all speed-related observers, timers, and DOM elements.
 * Called on SPA navigation to reset state for the new page.
 */
export function cleanupSpeed() {
  speedObs.forEach(function (o) { try { o.disconnect(); } catch (_) {} });
  speedObs.clear();

  if (speedAbort) { speedAbort.abort(); speedAbort = null; }
  if (speedRetryTimeout) { clearTimeout(speedRetryTimeout); speedRetryTimeout = null; }
  if (speedInitTimeout) { clearTimeout(speedInitTimeout); speedInitTimeout = null; }
  if (customPanel) { customPanel.remove(); customPanel = null; }
  if (menuPanel)   { menuPanel.style.display = ''; menuPanel = null; }
  currentChannelId = null;
  inCustomPanel = false;
}

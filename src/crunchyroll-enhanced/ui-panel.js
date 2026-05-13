// src/crunchyroll-enhanced/ui-panel.js — Sidebar UI: build, events, persistence, reset
// Provides: sidebarStylesCSS, buildSidebar, attachEvents, updateStatus, updateStats,
//           resetFilters, saveFilters, loadSavedFilters, toggle
// Consumers: app.js (orchestrator)

'use strict';

import { createSidebar } from './_ui.js';
import { saveSetting, loadSetting } from './_storage.js';
import { withData, updateBadgeVisibility } from './scanner.js';
import { getFilters } from './filters.js';
import { exportVisible } from './exporter.js';

// ── CSS Tokens & Glassmorphism Theme ──

const CSS_VARS = [
  ':host {',
  '--cr-bg: #0a0a14;',
  '--cr-surface: rgba(18, 18, 38, 0.65);',
  '--cr-surface-raised: rgba(30, 30, 55, 0.82);',
  '--cr-border: rgba(255, 255, 255, 0.07);',
  '--cr-border-focus: rgba(244, 117, 33, 0.45);',
  '--cr-accent: #f47521;',
  '--cr-accent-glow: rgba(244, 117, 33, 0.25);',
  '--cr-text: #f0f0f8;',
  '--cr-text-secondary: #9898b8;',
  '--cr-text-muted: #5a5a80;',
  '--cr-danger: #e74c3c;',
  '--cr-success: #3dcc8a;',
  '--cr-info: #5b9bd5;',
  '--cr-radius-sm: 6px;',
  '--cr-radius-md: 10px;',
  '--cr-transition: 0.15s cubic-bezier(0.4, 0, 0.2, 1);',
  '--cr-transition-med: 0.25s cubic-bezier(0.4, 0, 0.2, 1);',
  '--cr-blur: 16px;',

  'background: linear-gradient(180deg, rgba(10,10,20,0.97) 0%, rgba(14,14,28,0.95) 50%, rgba(10,10,20,0.97) 100%);',
  'backdrop-filter: blur(var(--cr-blur));',
  '-webkit-backdrop-filter: blur(var(--cr-blur));',
  'border-left: 1px solid var(--cr-border);',
  'box-shadow: -4px 0 32px rgba(0,0,0,0.45);',
  'color: var(--cr-text);',
  '}'
];

/**
 * Returns the complete CSS string for the sidebar shadow DOM.
 * @returns {string}
 */
export function sidebarStylesCSS() {
  return [
    ...CSS_VARS,

    // Scrollbar
    '.body::-webkit-scrollbar { width: 4px; }',
    '.body::-webkit-scrollbar-track { background: transparent; }',
    '.body::-webkit-scrollbar-thumb { background: rgba(244,117,33,0.2); border-radius: 2px; }',
    '.body::-webkit-scrollbar-thumb:hover { background: var(--cr-accent); }',

    // Header
    '.cr-head {',
    'position: sticky; top: 0; z-index: 10; flex-shrink: 0;',
    'background: linear-gradient(180deg, rgba(10,10,20,0.98) 0%, rgba(10,10,20,0.92) 100%);',
    'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);',
    'border-bottom: 1px solid rgba(244,117,33,0.15);',
    'padding: 16px 18px; display: flex; align-items: center; gap: 12px;',
    '}',
    '.cr-head-logo {',
    'width: 32px; height: 32px;',
    'background: linear-gradient(135deg, #f47521, #ff9a3c);',
    'border-radius: var(--cr-radius-sm);',
    'display: flex; align-items: center; justify-content: center;',
    'font-size: 16px; flex-shrink: 0;',
    'box-shadow: 0 2px 8px rgba(244,117,33,0.3);',
    '}',
    '.cr-head-text { flex: 1; min-width: 0; }',
    '.cr-head-text h2 { margin: 0; font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
    '.cr-head-text p { margin: 2px 0 0; font-size: 10px; color: var(--cr-text-muted); letter-spacing: 0.3px; }',
    '.cr-head-close {',
    'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);',
    'border-radius: var(--cr-radius-sm); color: var(--cr-text-muted);',
    'width: 28px; height: 28px; cursor: pointer; font-size: 14px;',
    'display: flex; align-items: center; justify-content: center; flex-shrink: 0;',
    'transition: background var(--cr-transition), color var(--cr-transition), border-color var(--cr-transition);',
    '}',
    '.cr-head-close:hover { background: rgba(231,76,60,0.18); color: var(--cr-danger); border-color: rgba(231,76,60,0.35); }',

    // Stats strip
    '.cr-stats { flex-shrink: 0; display: grid; grid-template-columns: 1fr 1fr 1fr; background: rgba(10,10,20,0.5); border-bottom: 1px solid rgba(255,255,255,0.05); }',
    '.cr-stat { padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.04); }',
    '.cr-stat:last-child { border-right: none; }',
    '.cr-stat-n { display: block; font-size: 22px; font-weight: 700; color: var(--cr-accent); line-height: 1; text-shadow: 0 0 12px var(--cr-accent-glow); }',
    '.cr-stat-l { display: block; font-size: 9px; color: var(--cr-text-muted); text-transform: uppercase; letter-spacing: 0.6px; margin-top: 4px; }',

    // Progress
    '.cr-prog-wrap { flex-shrink: 0; height: 2px; background: rgba(255,255,255,0.04); display: none; }',
    '.cr-prog-fill { height: 100%; background: linear-gradient(90deg, var(--cr-accent), #ffa64d); width: 0%; transition: width 0.2s ease; }',

    // Status
    '.cr-status { flex-shrink: 0; font-size: 10px; color: var(--cr-text-muted); padding: 6px 18px; border-bottom: 1px solid rgba(255,255,255,0.03); min-height: 24px; display: flex; align-items: center; gap: 6px; }',

    // Body inner
    '.cr-body-inner { padding: 12px 14px 8px; display: flex; flex-direction: column; gap: 10px; }',

    // Accordion
    '.cr-accordion { background: var(--cr-surface); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--cr-border); border-radius: var(--cr-radius-md); overflow: hidden; transition: border-color var(--cr-transition-med), box-shadow var(--cr-transition-med); }',
    '.cr-accordion[open] { border-color: rgba(244,117,33,0.18); box-shadow: 0 2px 12px rgba(0,0,0,0.25); }',
    '.cr-accordion-summary { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; user-select: none; -webkit-user-select: none; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--cr-text-secondary); transition: color var(--cr-transition); list-style: none; }',
    '.cr-accordion-summary::-webkit-details-marker { display: none; }',
    '.cr-accordion-summary:hover { color: var(--cr-accent); }',
    '.cr-accordion[open] > .cr-accordion-summary { color: var(--cr-accent); border-bottom: 1px solid rgba(244,117,33,0.1); }',
    '.cr-accordion-icon { font-size: 14px; opacity: 0.8; flex-shrink: 0; }',
    '.cr-accordion-arrow { margin-left: auto; flex-shrink: 0; transition: transform var(--cr-transition-med); font-size: 10px; color: var(--cr-text-muted); }',
    '.cr-accordion[open] .cr-accordion-arrow { transform: rotate(180deg); }',
    '.cr-accordion-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 9px; }',

    // Filter chips
    '.cr-filter-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; background: var(--cr-accent); color: #fff; border-radius: 9px; font-size: 10px; font-weight: 700; margin-left: auto; transition: transform var(--cr-transition), opacity var(--cr-transition); }',
    '.cr-filter-chip[hidden] { display: none; }',
    '.cr-filter-chip:not([hidden]) { animation: cr-chip-pop 0.2s ease-out; }',
    '@keyframes cr-chip-pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }',

    // Form fields
    '.cr-field { display: flex; align-items: center; gap: 8px; }',
    '.cr-field-label { font-size: 11px; color: var(--cr-text-muted); min-width: 80px; flex-shrink: 0; }',
    '.cr-field-ctrl { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }',
    '.cr-range { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 6px; flex: 1; }',
    '.cr-range-sep { font-size: 11px; color: var(--cr-text-muted); text-align: center; flex-shrink: 0; }',

    // Inputs & selects
    'input.cr-in, select.cr-sel { width: 100%; padding: 7px 10px; background: rgba(14,14,30,0.75); border: 1px solid rgba(255,255,255,0.09); border-radius: var(--cr-radius-sm); color: var(--cr-text); font-size: 11px; font-family: inherit; transition: border-color var(--cr-transition), box-shadow var(--cr-transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; }',
    'input.cr-in:focus, select.cr-sel:focus { outline: none; border-color: var(--cr-accent); box-shadow: 0 0 0 3px var(--cr-accent-glow); }',
    'input.cr-in::placeholder { color: rgba(255,255,255,0.15); }',
    'select.cr-sel { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%23666\'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 26px; cursor: pointer; }',
    'select.cr-sel option { background: #14142a; color: var(--cr-text); }',

    // Toggle pills
    '.cr-toggles { display: flex; flex-wrap: wrap; gap: 6px; }',
    '.cr-toggle-lbl { display: flex; align-items: center; gap: 5px; background: rgba(14,14,30,0.55); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--cr-radius-sm); padding: 6px 10px; font-size: 11px; color: var(--cr-text-muted); cursor: pointer; transition: border-color var(--cr-transition), color var(--cr-transition), background var(--cr-transition); user-select: none; -webkit-user-select: none; }',
    '.cr-toggle-lbl:hover { border-color: rgba(244,117,33,0.3); color: var(--cr-text-secondary); }',
    '.cr-toggle-lbl input { display: none; }',
    '.cr-toggle-lbl.active { background: rgba(244,117,33,0.12); border-color: rgba(244,117,33,0.4); color: var(--cr-accent); box-shadow: 0 0 8px rgba(244,117,33,0.1); }',

    // Watchlist radio pills
    '.cr-wl-group { display: flex; gap: 4px; }',
    '.cr-wl-lbl { flex: 1; text-align: center; padding: 6px 4px; background: rgba(14,14,30,0.55); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--cr-radius-sm); font-size: 10px; color: var(--cr-text-muted); cursor: pointer; transition: all var(--cr-transition); user-select: none; -webkit-user-select: none; }',
    '.cr-wl-lbl:hover { border-color: rgba(244,117,33,0.25); color: var(--cr-text-secondary); }',
    '.cr-wl-lbl input { display: none; }',
    '.cr-wl-lbl.active { background: rgba(244,117,33,0.12); border-color: rgba(244,117,33,0.4); color: var(--cr-accent); }',

    // Sort levels
    '.cr-sort-level { display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 8px; }',
    '.cr-sort-num { font-size: 10px; font-weight: 700; color: var(--cr-text-muted); text-align: center; }',

    // Footer
    '.cr-foot { flex-shrink: 0; padding: 12px 14px 14px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 8px; background: linear-gradient(0deg, rgba(10,10,20,0.95) 0%, rgba(14,14,28,0.7) 100%); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }',
    '.cr-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',

    // Buttons
    '.cr-btn { padding: 10px 14px; border: none; border-radius: var(--cr-radius-sm); font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; transition: filter var(--cr-transition), transform 0.1s ease, box-shadow var(--cr-transition); display: flex; align-items: center; justify-content: center; gap: 6px; }',
    '.cr-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }',
    '.cr-btn:active { transform: translateY(0); filter: brightness(0.88); }',
    '.cr-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; filter: none; box-shadow: none; }',
    '.cr-btn-scan { background: linear-gradient(135deg, #2d6ca8, #3a85cc); color: #fff; box-shadow: 0 2px 8px rgba(45,108,168,0.3); }',
    '.cr-btn-apply { background: linear-gradient(135deg, #f47521, #ff9340); color: #fff; box-shadow: 0 2px 10px var(--cr-accent-glow); }',
    '.cr-btn-reset { background: rgba(231,76,60,0.08); color: #c0392b; border: 1px solid rgba(231,76,60,0.2); }',
    '.cr-btn-reset:hover { background: rgba(231,76,60,0.18); filter: brightness(1); box-shadow: 0 2px 10px rgba(231,76,60,0.2); }',

    // Export
    '.cr-export-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }',
    '.cr-btn-copy { padding: 8px 14px; background: linear-gradient(135deg, #1a4a35, #2a6049); color: var(--cr-success); border: 1px solid rgba(61,204,138,0.2); border-radius: var(--cr-radius-sm); font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background var(--cr-transition), filter var(--cr-transition); white-space: nowrap; display: flex; align-items: center; gap: 5px; }',
    '.cr-btn-copy:hover { background: linear-gradient(135deg, #1e5a3f, #2e6e52); filter: brightness(1.15); }',
    '.cr-btn-copy.copied { background: #143528; color: #5de8a8; }',

    // Spinner
    '.cr-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(244,117,33,0.2); border-top-color: var(--cr-accent); border-radius: 50%; animation: cr-spin 0.7s linear infinite; flex-shrink: 0; }',

    // Animations
    '@keyframes cr-spin { to { transform: rotate(360deg); } }',

    // Utility
    '.cr-hidden { display: none !important; }'
  ].join('\n');
}

// ── DOM Helper Functions ──

/**
 * Creates a labeled field with a control element.
 * @param {string} labelText
 * @param {Element} control
 * @returns {HTMLDivElement}
 */
function makeField(labelText, control) {
  const field = document.createElement('div');
  field.className = 'cr-field';
  const label = document.createElement('span');
  label.className = 'cr-field-label';
  label.textContent = labelText;
  field.append(label, control);
  return field;
}

/**
 * Creates a text input.
 * @param {string} id
 * @param {string} placeholder
 * @returns {HTMLInputElement}
 */
function makeTextInput(id, placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cr-in';
  input.id = id;
  input.placeholder = placeholder;
  return input;
}

/**
 * Creates a number input.
 * @param {string} id
 * @param {string} placeholder
 * @param {number} [min]
 * @param {number} [max]
 * @param {number} [step]
 * @returns {HTMLInputElement}
 */
function makeNumberInput(id, placeholder, min, max, step) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'cr-in';
  input.id = id;
  input.placeholder = placeholder;
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  if (step !== undefined) input.step = String(step);
  return input;
}

/**
 * Creates a select dropdown.
 * @param {string} id
 * @param {Array<{value: string, label: string}>} options
 * @returns {HTMLSelectElement}
 */
function makeSelect(id, options) {
  const sel = document.createElement('select');
  sel.className = 'cr-sel';
  sel.id = id;
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    sel.appendChild(el);
  }
  return sel;
}

/**
 * SORT options for select dropdowns.
 * @param {string} emptyLabel - Text for the empty option
 * @returns {Array<{value: string, label: string}>}
 */
function sortOptions(emptyLabel) {
  return [
    { value: '', label: emptyLabel },
    { value: 'rating-desc', label: '⭐ Bewertung — hoch → niedrig' },
    { value: 'rating-asc', label: '⭐ Bewertung — niedrig → hoch' },
    { value: 'votes-desc', label: '👥 Stimmen — viele → wenige' },
    { value: 'votes-asc', label: '👥 Stimmen — wenige → viele' },
    { value: 'episodes-desc', label: '📺 Episoden — viele → wenige' },
    { value: 'episodes-asc', label: '📺 Episoden — wenige → viele' },
    { value: 'seasons-desc', label: '📦 Staffeln — viele → wenige' },
    { value: 'seasons-asc', label: '📦 Staffeln — wenige → viele' },
    { value: 'title-asc', label: '🔤 Titel — A → Z' },
    { value: 'title-desc', label: '🔤 Titel — Z → A' }
  ];
}

/**
 * Creates a toggle pill (checkbox label).
 * @param {string} text
 * @param {string} inputId
 * @param {boolean} [checked=false]
 * @returns {HTMLLabelElement}
 */
function makeToggle(text, inputId, checked) {
  const lbl = document.createElement('label');
  lbl.className = 'cr-toggle-lbl' + (checked ? ' active' : '');
  lbl.id = 'lbl-' + inputId;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = inputId;
  if (checked) input.checked = true;
  lbl.appendChild(input);
  lbl.appendChild(document.createTextNode(text));
  return lbl;
}

/**
 * Creates a radio pill group.
 * @param {string} name
 * @param {Array<{value: string, label: string}>} options
 * @param {string} selectedValue
 * @returns {HTMLDivElement}
 */
function makeRadioGroup(name, options, selectedValue) {
  const group = document.createElement('div');
  group.className = 'cr-wl-group';
  for (const opt of options) {
    const lbl = document.createElement('label');
    lbl.className = 'cr-wl-lbl' + (opt.value === selectedValue ? ' active' : '');
    lbl.id = 'lbl-wl-' + opt.value;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = opt.value;
    if (opt.value === selectedValue) input.checked = true;
    lbl.appendChild(input);
    lbl.appendChild(document.createTextNode(opt.label));
    group.appendChild(lbl);
  }
  return group;
}

/**
 * Creates a range input (min + separator + max).
 * @param {string} idMin
 * @param {string} idMax
 * @param {string} placeholderMin
 * @param {string} placeholderMax
 * @returns {HTMLDivElement}
 */
function makeRange(idMin, idMax, placeholderMin, placeholderMax) {
  const range = document.createElement('div');
  range.className = 'cr-range';
  const minInput = makeNumberInput(idMin, placeholderMin);
  const sep = document.createElement('span');
  sep.className = 'cr-range-sep';
  sep.textContent = '–';
  const maxInput = makeNumberInput(idMax, placeholderMax);
  range.append(minInput, sep, maxInput);
  return range;
}

/**
 * Creates an accordion section with icon, title, body, and optional filter chip.
 * @param {string} icon - Emoji icon
 * @param {string} title - Section title
 * @param {Element[]} bodyElements - Elements for the accordion body
 * @param {string} [chipId] - ID for optional filter count chip
 * @returns {HTMLDetailsElement}
 */
function makeAccordion(icon, title, bodyElements, chipId) {
  const details = document.createElement('details');
  details.className = 'cr-accordion';
  details.open = false;

  const summary = document.createElement('summary');
  summary.className = 'cr-accordion-summary';
  const iconEl = document.createElement('span');
  iconEl.className = 'cr-accordion-icon';
  iconEl.textContent = icon;
  const label = document.createElement('span');
  label.textContent = title;
  summary.append(iconEl, label);

  if (chipId) {
    const chip = document.createElement('span');
    chip.className = 'cr-filter-chip';
    chip.id = chipId;
    chip.hidden = true;
    chip.textContent = '0';
    summary.append(chip);
  }

  const arrow = document.createElement('span');
  arrow.className = 'cr-accordion-arrow';
  arrow.textContent = '▼';
  summary.appendChild(arrow);

  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'cr-accordion-body';
  for (const el of bodyElements) body.appendChild(el);
  details.appendChild(body);

  return details;
}

// ── Body Construction ──

/**
 * Builds the sidebar body content using DOM API.
 * @param {object} state - Application state (showBadges used for initial toggle state)
 * @returns {DocumentFragment}
 */
function buildBodyContent(state) {
  const frag = document.createDocumentFragment();

  // Header
  const head = document.createElement('div');
  head.className = 'cr-head';
  head.innerHTML = [
    '<div class="cr-head-logo">⚙</div>',
    '<div class="cr-head-text"><h2>Advanced Filter</h2><p>Crunchyroll Browse Enhancer · v5.2.1</p></div>',
    '<button class="cr-head-close" id="cr-close">✕</button>'
  ].join('');
  frag.appendChild(head);

  // Stats
  const stats = document.createElement('div');
  stats.className = 'cr-stats';
  stats.innerHTML = [
    '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-vis">—</span><span class="cr-stat-l">Visible</span></div>',
    '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-tot">—</span><span class="cr-stat-l">Total</span></div>',
    '<div class="cr-stat"><span class="cr-stat-n" id="cr-s-dat">—</span><span class="cr-stat-l">With Data</span></div>'
  ].join('');
  frag.appendChild(stats);

  // Progress & Status
  const prog = document.createElement('div');
  prog.className = 'cr-prog-wrap';
  prog.id = 'cr-prog';
  const fill = document.createElement('div');
  fill.className = 'cr-prog-fill';
  fill.id = 'cr-prog-fill';
  prog.appendChild(fill);
  frag.appendChild(prog);

  const status = document.createElement('div');
  status.className = 'cr-status';
  status.id = 'cr-status';
  status.textContent = 'Ready — click Scan to start';
  frag.appendChild(status);

  // Body inner
  const inner = document.createElement('div');
  inner.className = 'cr-body-inner';

  // 1. Search
  inner.appendChild(makeAccordion('🔍', 'Search', [
    makeField('Title', makeTextInput('cr-f-title', 'Search in title…')),
    makeField('Description', makeTextInput('cr-f-desc', 'Search in description…'))
  ], 'cr-chip-search'));

  // 2. Rating & Popularity
  inner.appendChild(makeAccordion('⭐', 'Rating & Popularity', [
    makeField('Rating', makeRange('cr-f-r-min', 'cr-f-r-max', 'Min', 'Max')),
    makeField('Min Votes', makeField('Min Votes',
      (() => { const inp = makeNumberInput('cr-f-v-min', 'e.g. 500'); return inp; })()
    ))
  ], 'cr-chip-rating'));

  // 3. Scope
  inner.appendChild(makeAccordion('📺', 'Scope', [
    makeField('Episodes', makeRange('cr-f-ep-min', 'cr-f-ep-max', 'Min', 'Max')),
    makeField('Seasons', makeRange('cr-f-se-min', 'cr-f-se-max', 'Min', 'Max'))
  ], 'cr-chip-scope'));

  // 4. Availability
  const subDubGroup = document.createElement('div');
  subDubGroup.className = 'cr-toggles';
  subDubGroup.id = 'cr-lang-group';
  subDubGroup.appendChild(makeToggle('🎌 Subtitles', 'cr-f-sub'));
  subDubGroup.appendChild(makeToggle('🔊 Dubbing', 'cr-f-dub'));

  inner.appendChild(makeAccordion('🌐', 'Availability', [
    makeField('Language', subDubGroup),
    makeField('Watchlist', makeRadioGroup('cr-wl', [
      { value: 'all', label: 'All' },
      { value: 'yes', label: '✅ Yes' },
      { value: 'no', label: '❌ No' }
    ], 'all'))
  ], 'cr-chip-avail'));

  // 5. Sorting
  inner.appendChild(makeAccordion('🔀', 'Sorting', [
    (() => {
      const lvl = document.createElement('div');
      lvl.className = 'cr-sort-level';
      const n1 = document.createElement('span');
      n1.className = 'cr-sort-num';
      n1.textContent = '1';
      lvl.append(n1, makeSelect('cr-s-1', sortOptions('— Default —')));
      return lvl;
    })(),
    (() => {
      const lvl = document.createElement('div');
      lvl.className = 'cr-sort-level';
      const n2 = document.createElement('span');
      n2.className = 'cr-sort-num';
      n2.textContent = '2';
      lvl.append(n2, makeSelect('cr-s-2', sortOptions('— None —')));
      return lvl;
    })(),
    (() => {
      const lvl = document.createElement('div');
      lvl.className = 'cr-sort-level';
      const n3 = document.createElement('span');
      n3.className = 'cr-sort-num';
      n3.textContent = '3';
      lvl.append(n3, makeSelect('cr-s-3', sortOptions('— None —')));
      return lvl;
    })()
  ]));

  // 6. Display
  inner.appendChild(makeAccordion('🏷', 'Display', [
    (() => {
      const container = document.createElement('div');
      container.className = 'cr-toggles';
      container.appendChild(makeToggle('Show badges on cards', 'cr-opt-badges', state.showBadges));
      container.appendChild(makeToggle('Only cards with scanned data', 'cr-opt-data'));
      return container;
    })()
  ]));

  // 7. Export
  const exportRow = document.createElement('div');
  exportRow.className = 'cr-export-row';
  exportRow.appendChild(makeSelect('cr-export-fmt', [
    { value: 'numbered', label: '1. Numbered List' },
    { value: 'bullets', label: '• Bullet List' },
    { value: 'csv', label: 'CSV (all data)' },
    { value: 'json', label: 'JSON (all data)' },
    { value: 'links', label: 'Links (URLs)' },
    { value: 'markdown', label: 'Markdown Table' }
  ]));
  const copyBtn = document.createElement('button');
  copyBtn.className = 'cr-btn-copy';
  copyBtn.id = 'cr-btn-copy';
  copyBtn.textContent = '📋 Copy';
  exportRow.appendChild(copyBtn);

  inner.appendChild(makeAccordion('📋', 'Export', [exportRow]));

  frag.appendChild(inner);

  // Footer
  const foot = document.createElement('div');
  foot.className = 'cr-foot';
  foot.innerHTML = [
    '<div class="cr-btn-row">',
    '<button class="cr-btn cr-btn-scan" id="cr-btn-scan">🔄 Scan</button>',
    '<button class="cr-btn cr-btn-apply" id="cr-btn-apply">✨ Apply</button>',
    '</div>',
    '<button class="cr-btn cr-btn-reset" id="cr-btn-reset">↺ Reset All Filters</button>'
  ].join('');
  frag.appendChild(foot);

  return frag;
}

// ── Exported Functions ──

/**
 * Builds the sidebar UI.
 * @param {object} state - Application state (sidebar reference stored here)
 * @param {number} sidebarWidth - Sidebar width in px
 */
export function buildSidebar(state, sidebarWidth) {
  state.sidebar = createSidebar({
    width: sidebarWidth,
    title: 'Filter',
    accentColor: '#F47521',
    onOpen: async function () {
      state.isOpen = true;
      await GM.setValue('cr_sidebar_open', true);
    },
    onClose: async function () {
      state.isOpen = false;
      await GM.setValue('cr_sidebar_open', false);
    }
  });

  // Inject shadow-DOM styles
  const style = document.createElement('style');
  style.textContent = sidebarStylesCSS();
  state.sidebar.root.appendChild(style);

  // Hide shared default header
  const sharedHdr = state.sidebar.root.querySelector('.header');
  if (sharedHdr) sharedHdr.style.display = 'none';

  // Build body using DOM API
  state.sidebar.bodyEl.textContent = '';
  state.sidebar.bodyEl.appendChild(buildBodyContent(state));

  if (state.isOpen) state.sidebar.open();
}

/**
 * Wires up all event listeners on sidebar controls.
 * @param {object} state - Application state
 * @param {Function} _$ - Query-by-ID helper bound to sidebar root
 * @param {object} emitter - Event emitter
 * @param {Function} debouncedApply - Debounced filter apply function
 */
export function attachEvents(state, _$, emitter, debouncedApply) {
  // Close button
  _$('cr-close').addEventListener('click', () => {
    try { toggle(state, false); } catch (err) { console.error('[Crunchyroll Enhanced] Close error:', err); }
  });

  // Scan button (scanCards is wired onto state by app.js)
  _$('cr-btn-scan').addEventListener('click', () => {
    try { state._scan(); } catch (err) { console.error('[Crunchyroll Enhanced] Scan error:', err); }
  });

  // Apply button
  _$('cr-btn-apply').addEventListener('click', () => {
    try { debouncedApply(); } catch (err) { console.error('[Crunchyroll Enhanced] Apply error:', err); }
  });

  // Reset button
  _$('cr-btn-reset').addEventListener('click', () => {
    try {
      resetFilters(state, _$, emitter);
      debouncedApply();
    } catch (err) { console.error('[Crunchyroll Enhanced] Reset error:', err); }
  });

  // Sub/Dub toggles
  _$('cr-f-sub').addEventListener('change', (e) => {
    _$('lbl-cr-f-sub').classList.toggle('active', e.target.checked);
    emitter.emit('filter:changed');
  });
  _$('cr-f-dub').addEventListener('change', (e) => {
    _$('lbl-cr-f-dub').classList.toggle('active', e.target.checked);
    emitter.emit('filter:changed');
  });

  // Watchlist radios
  const wlInputs = state.sidebar.root.querySelectorAll('input[name="cr-wl"]');
  for (const r of wlInputs) {
    r.addEventListener('change', () => {
      for (const l of state.sidebar.root.querySelectorAll('.cr-wl-lbl')) {
        l.classList.remove('active');
      }
      const checked = state.sidebar.root.querySelector('input[name="cr-wl"]:checked');
      const val = checked ? checked.value : 'all';
      const map = { all: 'lbl-wl-all', yes: 'lbl-wl-yes', no: 'lbl-wl-no' };
      if (map[val]) _$('lbl-wl-' + val).classList.add('active');
      emitter.emit('filter:changed');
    });
  }

  // Badge toggle
  _$('cr-opt-badges').addEventListener('change', async (e) => {
    state.showBadges = e.target.checked;
    _$('lbl-cr-opt-badges').classList.toggle('active', state.showBadges);
    await GM.setValue('cr_show_badges', state.showBadges);
    updateBadgeVisibility(state.showBadges);
  });

  // Data-only toggle
  _$('cr-opt-data').addEventListener('change', (e) => {
    _$('lbl-cr-opt-data').classList.toggle('active', e.target.checked);
    emitter.emit('filter:changed');
  });

  // Copy button
  _$('cr-btn-copy').addEventListener('click', () => {
    try {
      exportVisible({ cards: state.cards, _$: _$, ...state });
    } catch (err) { console.error('[Crunchyroll Enhanced] Copy error:', err); }
  });

  // Auto-apply on input/change
  const filterIds = [
    'cr-f-title', 'cr-f-desc',
    'cr-f-r-min', 'cr-f-r-max', 'cr-f-v-min',
    'cr-f-ep-min', 'cr-f-ep-max', 'cr-f-se-min', 'cr-f-se-max',
    'cr-s-1', 'cr-s-2', 'cr-s-3'
  ];
  for (const id of filterIds) {
    const el = _$(id);
    if (el) {
      el.addEventListener('input', () => emitter.emit('filter:changed'));
      el.addEventListener('change', () => emitter.emit('filter:changed'));
    }
  }

  // Don't register emitter here — app.js handles the event subscription
}

/**
 * Toggles sidebar open/closed.
 * @param {object} state - Application state
 * @param {boolean|undefined} forceTo - Force open (true) or close (false)
 */
export function toggle(state, forceTo) {
  if (!state.sidebar) return;
  if (forceTo === true || (forceTo === undefined && !state.isOpen)) {
    state.sidebar.open();
  } else {
    state.sidebar.close();
  }
}

/**
 * Updates the status text in the sidebar.
 * @param {object} state - Application state
 * @param {string} msg - Status message
 */
export function updateStatus(state, msg) {
  if (!state.sidebar) return;
  const el = state.sidebar.root.querySelector('#cr-status');
  if (el) el.textContent = msg;
}

/**
 * Updates the stats display.
 * @param {object} state - Application state
 * @param {number} visible - Visible card count
 * @param {number} total - Total card count
 * @param {number} withDataCount - Cards with extracted data
 */
export function updateStats(state, visible, total, withDataCount) {
  if (!state.sidebar) return;
  const vis = state.sidebar.root.querySelector('#cr-s-vis');
  const tot = state.sidebar.root.querySelector('#cr-s-tot');
  const dat = state.sidebar.root.querySelector('#cr-s-dat');
  if (vis) vis.textContent = String(visible);
  if (tot) tot.textContent = String(total);
  if (dat) dat.textContent = String(withDataCount);
}

/**
 * Resets all filter controls to their default values.
 * @param {object} state - Application state
 * @param {Function} _$ - Query-by-ID helper
 * @param {object} emitter - Event emitter
 */
export function resetFilters(state, _$, emitter) {
  const ids = [
    'cr-f-title', 'cr-f-desc',
    'cr-f-r-min', 'cr-f-r-max', 'cr-f-v-min',
    'cr-f-ep-min', 'cr-f-ep-max', 'cr-f-se-min', 'cr-f-se-max',
    'cr-s-1', 'cr-s-2', 'cr-s-3'
  ];
  for (const id of ids) {
    const el = _$(id);
    if (el) el.value = '';
  }

  // Checkboxes
  for (const id of ['cr-f-sub', 'cr-f-dub']) {
    const el = _$(id);
    if (el) el.checked = false;
  }
  for (const lblId of ['lbl-cr-f-sub', 'lbl-cr-f-dub']) {
    const el = _$(lblId);
    if (el) el.classList.remove('active');
  }

  // Data-only
  const dataEl = _$('cr-opt-data');
  if (dataEl) dataEl.checked = false;
  const dataLbl = _$('lbl-cr-opt-data');
  if (dataLbl) dataLbl.classList.remove('active');

  // Watchlist
  const allRadio = state.sidebar.root.querySelector('input[name="cr-wl"][value="all"]');
  if (allRadio) allRadio.checked = true;
  for (const l of state.sidebar.root.querySelectorAll('.cr-wl-lbl')) {
    l.classList.remove('active');
  }
  const allLbl = _$('lbl-wl-all');
  if (allLbl) allLbl.classList.add('active');

  // Restore original DOM order
  const container = state.origOrder[0] ? state.origOrder[0].parentElement : null;
  if (container) {
    for (const card of state.origOrder) {
      card.classList.remove('cr-hidden');
      container.appendChild(card);
    }
  }

  updateStats(state, state.cards.size, state.cards.size, withData(state.cards));
  emitter.emit('filter:changed');
}

/**
 * Saves current filter state to GM storage.
 * @param {object} state - Application state
 * @param {Function} _$ - Query-by-ID helper
 * @param {object} emitter - Event emitter (unused, for API consistency)
 * @param {object} log - Logger
 */
export async function saveFilters(state, _$, _emitter, log) {
  try {
    await saveSetting('cr_filters',
      getFilters(_$, state.sidebar.root));
  } catch (e) {
    if (log) log.warn('Failed to save filters', e);
  }
}

/**
 * Loads saved filter state from GM storage and applies to DOM.
 * Handles migration from old key (crunchyroll_advanced_filters) to new key (cr_filters).
 * @param {object} state - Application state
 * @param {Function} _$ - Query-by-ID helper
 * @param {object} emitter - Event emitter (unused, for API consistency)
 * @param {object} log - Logger
 */
export async function loadSavedFilters(state, _$, _emitter, log) {
  try {
    // Try new key first, fall back to old key (migration)
    let s = await loadSetting('cr_filters', null);
    if (s === null) {
      const old = await loadSetting('crunchyroll_advanced_filters', null);
      if (old !== null) {
        s = old;
        // Migrate to new key
        await saveSetting('cr_filters', JSON.stringify(s));
      } else {
        s = {};
      }
    }
    if (typeof s === 'string') {
      try { s = JSON.parse(s); } catch (e) { s = {}; }
    }
    if (!s || typeof s !== 'object') s = {};

    const setField = (id, val) => {
      if (val == null || val === '') return;
      const el = _$(id);
      if (el) el.value = String(val);
    };
    setField('cr-f-title',  s.title);
    setField('cr-f-desc',   s.desc);
    setField('cr-f-r-min',  s.ratingMin);
    setField('cr-f-r-max',  s.ratingMax);
    setField('cr-f-v-min',  s.votesMin);
    setField('cr-f-ep-min', s.epMin);
    setField('cr-f-ep-max', s.epMax);
    setField('cr-f-se-min', s.seasonsMin);
    setField('cr-f-se-max', s.seasonsMax);
    setField('cr-s-1', s.sort ? s.sort[0] : null);
    setField('cr-s-2', s.sort ? s.sort[1] : null);
    setField('cr-s-3', s.sort ? s.sort[2] : null);

    if (s.dataOnly) {
      const doEl = _$('cr-opt-data');
      if (doEl) doEl.checked = true;
      const doLbl = _$('lbl-cr-opt-data');
      if (doLbl) doLbl.classList.add('active');
    }
    if (s.subOnly) {
      const subEl = _$('cr-f-sub');
      if (subEl) subEl.checked = true;
      const subLbl = _$('lbl-cr-f-sub');
      if (subLbl) subLbl.classList.add('active');
    }
    if (s.dubOnly) {
      const dubEl = _$('cr-f-dub');
      if (dubEl) dubEl.checked = true;
      const dubLbl = _$('lbl-cr-f-dub');
      if (dubLbl) dubLbl.classList.add('active');
    }
    if (s.watchlist && s.watchlist !== 'all') {
      try {
        const r = state.sidebar.root.querySelector(
          'input[name="cr-wl"][value="' + s.watchlist + '"]');
        if (r) {
          r.checked = true;
          for (const l of state.sidebar.root.querySelectorAll('.cr-wl-lbl')) {
            l.classList.remove('active');
          }
          const wlMap = { yes: 'lbl-wl-yes', no: 'lbl-wl-no' };
          if (wlMap[s.watchlist]) {
            const targetLbl = _$(wlMap[s.watchlist]);
            if (targetLbl) targetLbl.classList.add('active');
          }
          const allLbl = _$('lbl-wl-all');
          if (allLbl) allLbl.classList.remove('active');
        }
      } catch (e2) {
        if (log) log.warn('Failed to restore watchlist filter', e2);
      }
    }
  } catch (e) {
    if (log) log.warn('Failed to load saved filters', e);
  }
}

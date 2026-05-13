// src/gutefrage-smart-filters/ui-panel.js — Sidebar panel (filter UI)
// Provides: SidebarPanel class, SIDEBAR_CSS

import { createSidebar } from './_ui.js';
import { createLogger } from './_logger.js';
import { DEFAULT_TAGS } from './tag-remover.js';
import { DEFAULT_FILTERS, parseCSV } from './filter-engine.js';
import { navigateToDate, resetNavigation } from './feed-navigation.js';

const panelLog = createLogger('Gutefrage UI Panel');

// ---- Sidebar Content CSS (scoped inside shadow DOM) ----

const SIDEBAR_CSS = [
  '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:opsz@9..40&family=IBM+Plex+Serif:wght@600&display=swap");',

  '.body { background:#0f1117; }',

  '.gf-stats-bar { margin:8px 0; padding:10px 16px; background:linear-gradient(135deg,#171923,#1a1c2e); border:1px solid rgba(212,163,115,0.2); border-radius:10px; font-size:13px; color:#d4a373; text-align:center; display:none; font-weight:500; box-shadow:0 4px 12px rgba(0,0,0,0.2); }',
  '.gf-stats-bar.active { display:block; }',

  '.gf-section { margin-top:10px; background:#171923; border-radius:9px; padding:12px 14px 14px; border:1px solid rgba(255,255,255,0.06); box-shadow:inset 0 1px 0 rgba(255,255,255,0.04); }',
  '.gf-section-title { font-size:13px; font-weight:600; color:#e8e6e3; margin:0 0 10px; letter-spacing:0.3px; }',

  '.gf-input { width:100%; padding:7px 10px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; font-size:12px; background:#1e2030; color:#e8e6e3; box-sizing:border-box; transition:border-color 0.2s,box-shadow 0.2s; }',
  '.gf-input + .gf-input { margin-top:5px; }',
  '.gf-input:focus { outline:none; border-color:#d4a373; box-shadow:0 0 0 3px rgba(212,163,115,0.15); }',
  '.gf-input::placeholder { color:#4a5568; }',

  '.gf-label { font-size:10px; color:#8890a4; display:block; margin:7px 0 3px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }',
  '.gf-label:first-child { margin-top:0; }',
  '.gf-hint { font-size:10px; color:#5a6785; margin-top:4px; line-height:1.5; }',

  '.gf-pill-row { display:flex; gap:6px; flex-wrap:wrap; }',
  '.gf-pill-label { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:500; cursor:pointer; padding:5px 14px; border:1.5px solid rgba(255,255,255,0.1); border-radius:20px; user-select:none; transition:all 0.2s; color:#8890a4; background:#1e2030; }',
  '.gf-pill-label:hover { border-color:rgba(212,163,115,0.3); color:#e8e6e3; }',
  '.gf-pill-label:has(input:checked) { background:#d4a373; color:#0f1117; border-color:#d4a373; box-shadow:0 2px 8px rgba(212,163,115,0.25); }',
  '.gf-pill-label input { display:none; }',

  '.gf-switch { display:flex; align-items:center; gap:10px; cursor:pointer; width:100%; padding:3px 0; font-family:"DM Sans",system-ui,sans-serif; }',
  '.gf-switch + .gf-switch { margin-top:1px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06); }',
  '.gf-switch input { display:none; }',
  '.gf-switch-track { width:36px; height:20px; background:#2d3142; border-radius:10px; position:relative; transition:background 0.2s; flex-shrink:0; }',
  '.gf-switch-thumb { width:16px; height:16px; background:#e8e6e3; border-radius:50%; position:absolute; top:2px; left:2px; transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }',
  '.gf-switch input:checked + .gf-switch-track { background:#d4a373; }',
  '.gf-switch input:checked + .gf-switch-track .gf-switch-thumb { transform:translateX(16px); }',
  '.gf-switch-label { font-size:12px; color:#e8e6e3; }',

  '.gf-number-row { display:flex; align-items:center; gap:8px; }',
  '.gf-number-row input { width:72px; padding:7px 8px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; font-size:13px; background:#1e2030; color:#e8e6e3; transition:border-color 0.2s,box-shadow 0.2s; }',
  '.gf-number-row input:focus { outline:none; border-color:#d4a373; box-shadow:0 0 0 3px rgba(212,163,115,0.15); }',
  '.gf-number-row span { font-size:12px; color:#8890a4; }',

  '.gf-nav-row { display:flex; gap:6px; margin-top:8px; }',
  '.gf-nav-btn { flex:1; padding:7px 8px; font-size:11px; font-weight:600; background:#1e2030; color:#d4a373; border:1.5px solid #d4a373; border-radius:6px; cursor:pointer; transition:all 0.2s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
  '.gf-nav-btn:hover { background:#d4a373; color:#0f1117; box-shadow:0 2px 8px rgba(212,163,115,0.25); }',
  '.gf-nav-btn:disabled { opacity:0.38; cursor:not-allowed; border-color:rgba(255,255,255,0.1); color:#5a6785; }',
  '.gf-nav-btn:disabled:hover { background:#1e2030; color:#5a6785; box-shadow:none; }',
  '.gf-nav-btn.active { background:#d4a373; color:#0f1117; }',
  '#gf-nav-reset { background:#1e2030; color:#8890a4; border-color:rgba(255,255,255,0.1); }',
  '#gf-nav-reset:hover { background:rgba(192,57,43,0.15); border-color:rgba(192,57,43,0.4); color:#e57373; }',

  '.gf-reset-btn { display:block; width:100%; margin-top:16px; padding:10px; background:#171923; border:1.5px solid rgba(255,255,255,0.06); border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; color:#5a6785; transition:all 0.2s; letter-spacing:0.2px; text-align:center; }',
  '.gf-reset-btn:hover { background:rgba(192,57,43,0.12); border-color:rgba(192,57,43,0.35); color:#e57373; }'
].join('\n');

// ---- Sidebar Panel ----

/**
 * Filter UI sidebar panel wrapping createSidebar.
 * Contains all filter controls: post type, date, topics, images, bookmarks,
 * interaction thresholds, text filters, feed navigation, and settings.
 */
export class SidebarPanel {
  /**
   * @param {EnhancedFilterIntegration} fi - The filter integration instance
   */
  constructor(fi) {
    if (!window.location.pathname.startsWith('/home/')) return;
    this.fi = fi;
    fi.sidebar = this;

    this.sb = createSidebar({
      width: 340,
      title: 'Gutefrage Filter',
      accentColor: '#d4a373',
      onOpen: function () {
        fi.enableFilters();
        setTimeout(function () { fi.applyFilters(); }, 100);
      },
      onClose: function () { /* no-op */ }
    });

    this.renderContent().catch(function (err) {
      panelLog.warn('Panel render error:', err);
    });
  }

  /**
   * Returns whether the sidebar is currently open.
   * @returns {boolean}
   */
  isOpen() {
    return this.sb.isOpen();
  }

  /**
   * Updates the stats bar with visible/total post counts.
   * @param {number} visible - Visible posts
   * @param {number} total - Total posts
   */
  updateStats(visible, total) {
    const statsEl = this.sb.bodyEl.querySelector('.gf-stats-bar');
    if (!statsEl) return;
    const filtered = total - visible;
    if (filtered > 0) {
      statsEl.textContent = visible + ' sichtbar  ·  ' + filtered + ' ausgeblendet';
      statsEl.classList.add('active');
    } else {
      statsEl.classList.remove('active');
    }
  }

  // ---- DOM helper methods ----

  /**
   * Creates a DOM element with attributes and children.
   * @param {string} tag - HTML tag name
   * @param {Object} [attrs] - Attribute key/value pairs
   * @param {...(Node|string)} children - Child nodes or text
   * @returns {HTMLElement}
   */
  _ce(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (key === 'className') {
          el.className = value;
        } else if (key === 'textContent') {
          el.textContent = value;
        } else {
          el.setAttribute(key, value);
        }
      }
    }
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    }
    return el;
  }

  /**
   * Creates a section wrapper with title.
   * @param {string} title - Section title
   * @returns {HTMLElement} The section div (children can be appended afterward)
   */
  _section(title) {
    const sec = this._ce('div', { className: 'gf-section' });
    sec.appendChild(this._ce('div', { className: 'gf-section-title', textContent: title }));
    return sec;
  }

  /**
   * Creates a pill-style checkbox label.
   * @param {string} postType - Post type value (frage/diskussion/umfrage)
   * @param {string} label - Display label
   * @param {boolean} checked - Whether checked
   * @returns {HTMLElement}
   */
  _pillCheckbox(postType, label, checked) {
    const lbl = this._ce('label', { className: 'gf-pill-label' });
    const input = this._ce('input', { type: 'checkbox', 'data-posttype': postType });
    input.checked = checked;
    lbl.appendChild(input);
    lbl.appendChild(document.createTextNode(' ' + label));
    return lbl;
  }

  /**
   * Creates a toggle switch element using the new iOS-style switch design.
   * @param {string} id - Element ID
   * @param {string} dataFilter - Filter data attribute value
   * @param {boolean} isOn - Whether the toggle is on
   * @param {string} label - Display label
   * @returns {HTMLElement} The switch label element
   */
  _toggleEl(id, dataFilter, isOn, label) {
    const lbl = this._ce('label', { className: 'gf-switch', id });
    const input = this._ce('input', { type: 'checkbox', role: 'switch' });
    if (dataFilter) input.setAttribute('data-filter', dataFilter);
    input.checked = isOn;
    lbl.appendChild(input);
    const track = this._ce('span', { className: 'gf-switch-track' });
    track.appendChild(this._ce('span', { className: 'gf-switch-thumb' }));
    lbl.appendChild(track);
    lbl.appendChild(this._ce('span', { className: 'gf-switch-label', textContent: label }));
    return lbl;
  }

  /**
   * Renders all filter controls into the sidebar body.
   */
  async renderContent() {
    const f = this.fi.filters;
    const hideTypes = f.contentFilters.hidePostTypes || [];
    const customTags = (await GM.getValue('customTagsToRemove', DEFAULT_TAGS)).join(', ');
    const blockedAuthors = (await GM.getValue('blockedAuthors', [])).join(', ');
    const dateVal = f.afterDate || '';
    const navDateVal = await GM.getValue('navDate', '');
    const isUnansweredPage = window.location.pathname.indexOf('/unbeantwortet') !== -1;

    const container = this.sb.bodyEl;
    container.textContent = '';
    const fragment = document.createDocumentFragment();

    // Style
    const styleEl = document.createElement('style');
    styleEl.textContent = SIDEBAR_CSS;
    fragment.appendChild(styleEl);

    // Stats bar
    fragment.appendChild(this._ce('div', { className: 'gf-stats-bar' }));

    // --- Fragetyp ---
    {
      const sec = this._section('Fragetyp');
      const row = this._ce('div', { className: 'gf-pill-row' });
      row.appendChild(this._pillCheckbox('frage', 'Fragen', hideTypes.indexOf('frage') === -1));
      row.appendChild(this._pillCheckbox('diskussion', 'Diskussionen', hideTypes.indexOf('diskussion') === -1));
      row.appendChild(this._pillCheckbox('umfrage', 'Umfragen', hideTypes.indexOf('umfrage') === -1));
      sec.appendChild(row);
      fragment.appendChild(sec);
    }

    // --- Datum-Filter ---
    {
      const sec = this._section('Datum-Filter');
      const dateInput = this._ce('input', { type: 'datetime-local', className: 'gf-input', 'data-filter': 'afterDate' });
      dateInput.value = dateVal;
      dateInput.title = 'Nur Beiträge ab diesem Datum anzeigen';
      sec.appendChild(dateInput);
      const hint = this._ce('div', { className: 'gf-hint' });
      hint.appendChild(document.createTextNode('Blendet Beiträge '));
      const hintStrong = document.createElement('strong');
      hintStrong.textContent = 'vor';
      hint.appendChild(hintStrong);
      hint.appendChild(document.createTextNode(' diesem Datum aus (AB-Filter)'));
      sec.appendChild(hint);
      fragment.appendChild(sec);
    }

    // --- Feed-Navigation ---
    {
      const sec = this._section('Feed-Navigation');
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Zu diesem Datum springen:' }));
      const navInput = this._ce('input', { type: 'datetime-local', className: 'gf-input', id: 'gf-nav-date' });
      navInput.value = navDateVal;
      sec.appendChild(navInput);
      const navHint = this._ce('div', { className: 'gf-hint' });
      navHint.appendChild(document.createTextNode('Springt im Feed zu Beiträgen '));
      const navStrong = document.createElement('strong');
      navStrong.textContent = 'vor';
      navHint.appendChild(navStrong);
      navHint.appendChild(document.createTextNode(' diesem Datum'));
      sec.appendChild(navHint);
      const navRow = this._ce('div', { className: 'gf-nav-row' });
      navRow.appendChild(this._ce('button', { className: 'gf-nav-btn' + (!isUnansweredPage ? ' active' : ''), id: 'gf-nav-alle', title: 'In „Alle Beiträge für Dich“ zu diesem Datum springen', textContent: 'Alle Beiträge →' }));
      navRow.appendChild(this._ce('button', { className: 'gf-nav-btn' + (isUnansweredPage ? ' active' : ''), id: 'gf-nav-unbeantwortet', title: 'Zu diesem Datum in „Unbeantwortet“ springen', textContent: 'Unbeantwortet →' }));
      navRow.appendChild(this._ce('button', { className: 'gf-nav-btn', id: 'gf-nav-reset', title: 'Feed-Navigation zurücksetzen (Datum löschen)', textContent: 'Zurücksetzen ↺' }));
      sec.appendChild(navRow);
      fragment.appendChild(sec);
    }

    // --- Themenbereich ---
    {
      const sec = this._section('Themenbereich');
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Themen ausschließen (kommagetrennt):' }));
      const excludeInput = this._ce('input', { type: 'text', className: 'gf-input', placeholder: 'z.B. Liebe, Sport, Tiere', 'data-filter': 'topicFilters.excludeTopics' });
      excludeInput.value = f.topicFilters.excludeTopics;
      sec.appendChild(excludeInput);
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Nur diese Themen (kommagetrennt):' }));
      const includeInput = this._ce('input', { type: 'text', className: 'gf-input', placeholder: 'z.B. Computer, Technik', 'data-filter': 'topicFilters.includeTopics' });
      includeInput.value = f.topicFilters.includeTopics;
      sec.appendChild(includeInput);
      sec.appendChild(this._ce('div', { className: 'gf-hint', textContent: 'Themenname oder Slug (z.B. computer-internet)' }));
      fragment.appendChild(sec);
    }

    // --- Bilder-Filter ---
    {
      const sec = this._section('Bilder-Filter');
      sec.appendChild(this._toggleEl('sb-only-with-images', 'contentFilters.onlyWithImages', f.contentFilters.onlyWithImages, 'Nur Beiträge mit Bildern'));
      sec.appendChild(this._toggleEl('sb-hide-with-images', 'contentFilters.hideWithImages', f.contentFilters.hideWithImages, 'Beiträge mit Bildern ausblenden'));
      sec.appendChild(this._ce('div', { className: 'gf-hint', textContent: 'Filtert nach Posts mit oder ohne Bildern' }));
      fragment.appendChild(sec);
    }

    // --- Gemerkte Beiträge ---
    {
      const sec = this._section('Gemerkte Beiträge');
      sec.appendChild(this._toggleEl('sb-only-bookmarked', 'contentFilters.onlyBookmarked', f.contentFilters.onlyBookmarked, 'Nur gemerkte anzeigen'));
      sec.appendChild(this._toggleEl('sb-hide-bookmarked', 'contentFilters.hideBookmarked', f.contentFilters.hideBookmarked, 'Gemerkte ausblenden'));
      fragment.appendChild(sec);
    }

    // --- Interaktion ---
    {
      const sec = this._section('Interaktion');
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Anzahl Antworten:' }));
      const numRow = this._ce('div', { className: 'gf-number-row' });
      const minAns = this._ce('input', { type: 'number', placeholder: 'Min', 'data-filter': 'interactionFilters.minAnswers' });
      minAns.value = f.interactionFilters.minAnswers;
      minAns.setAttribute('min', '0');
      numRow.appendChild(minAns);
      numRow.appendChild(this._ce('span', { textContent: 'bis' }));
      const maxAns = this._ce('input', { type: 'number', placeholder: 'Max', 'data-filter': 'interactionFilters.maxAnswers' });
      maxAns.value = f.interactionFilters.maxAnswers;
      maxAns.setAttribute('min', '0');
      numRow.appendChild(maxAns);
      sec.appendChild(numRow);
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Mindest-Likes:' }));
      const likesInput = this._ce('input', { type: 'number', className: 'gf-input', placeholder: 'z.B. 5', 'data-filter': 'interactionFilters.minLikes' });
      likesInput.value = f.interactionFilters.minLikes;
      likesInput.setAttribute('min', '0');
      sec.appendChild(likesInput);
      fragment.appendChild(sec);
    }

    // --- Textfilter ---
    {
      const sec = this._section('Textfilter');
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Suchbegriffe (kommagetrennt):' }));
      const kwInput = this._ce('input', { type: 'text', className: 'gf-input', placeholder: 'z.B. JavaScript, Python', 'data-filter': 'textFilters.keywords' });
      kwInput.value = f.textFilters.keywords;
      sec.appendChild(kwInput);
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Ausschließen (kommagetrennt):' }));
      const exKwInput = this._ce('input', { type: 'text', className: 'gf-input', placeholder: 'z.B. Spam, Werbung', 'data-filter': 'textFilters.excludeKeywords' });
      exKwInput.value = f.textFilters.excludeKeywords;
      sec.appendChild(exKwInput);
      fragment.appendChild(sec);
    }

    // --- Einstellungen ---
    {
      const sec = this._section('Einstellungen');
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Tags automatisch entfernen (kommagetrennt):' }));
      const tagsInput = this._ce('input', { type: 'text', className: 'gf-input', id: 'gf-custom-tags' });
      tagsInput.value = customTags;
      sec.appendChild(tagsInput);
      sec.appendChild(this._ce('span', { className: 'gf-label', textContent: 'Gesperrte Autoren (kommagetrennt):' }));
      const blockedInput = this._ce('input', { type: 'text', className: 'gf-input', id: 'gf-blocked-authors' });
      blockedInput.value = blockedAuthors;
      sec.appendChild(blockedInput);
      fragment.appendChild(sec);
    }

    // Reset button
    fragment.appendChild(this._ce('button', { className: 'gf-reset-btn', textContent: 'Alle Filter zurücksetzen ↺' }));

    container.appendChild(fragment);
    this.attachEventListeners();
  }

  /**
   * Escapes HTML special characters in a string.
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  _escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /**
   * Attaches event listeners to all filter controls in the sidebar.
   */
  attachEventListeners() {
    const body = this.sb.bodyEl;
    const fi = this.fi;

    // Post type checkboxes
    const typeChecks = body.querySelectorAll('[data-posttype]');
    for (let tc = 0; tc < typeChecks.length; tc++) {
      typeChecks[tc].addEventListener('change', function () {
        const type = this.getAttribute('data-posttype');
        const hideTypes = (fi.filters.contentFilters.hidePostTypes || []).slice();
        if (this.checked) {
          const idx = hideTypes.indexOf(type);
          if (idx > -1) hideTypes.splice(idx, 1);
        } else {
          if (hideTypes.indexOf(type) === -1) hideTypes.push(type);
        }
        fi.filters.contentFilters.hidePostTypes = hideTypes;
        fi.saveFilters().then(function () {
          fi.updateFilterIndicator();
          fi.enableFilters();
          fi.debouncedApplyFilters();
        });
      });
    }

    // Toggle switches (iOS-style) with mutual exclusion for bookmark/image pairs
    const toggleSwitches = body.querySelectorAll('.gf-switch input[data-filter]');
    for (let ts = 0; ts < toggleSwitches.length; ts++) {
      toggleSwitches[ts].addEventListener('change', function () {
        const switchLabel = this.closest('.gf-switch');
        const isNowChecked = this.checked;

        // Mutual exclusion for bookmark toggles
        const switchId = switchLabel ? switchLabel.id : '';
        if (isNowChecked && (switchId === 'sb-only-bookmarked' || switchId === 'sb-hide-bookmarked')) {
          const otherId = switchId === 'sb-only-bookmarked' ? 'sb-hide-bookmarked' : 'sb-only-bookmarked';
          const other = body.querySelector('#' + otherId);
          if (other) {
            const otherInput = other.querySelector('input[data-filter]');
            if (otherInput && otherInput.checked) {
              otherInput.checked = false;
              fi.updateFilterValue(otherInput.getAttribute('data-filter'), false);
            }
          }
        }
        if (isNowChecked && (switchId === 'sb-only-with-images' || switchId === 'sb-hide-with-images')) {
          const otherId2 = switchId === 'sb-only-with-images' ? 'sb-hide-with-images' : 'sb-only-with-images';
          const other2 = body.querySelector('#' + otherId2);
          if (other2) {
            const otherInput2 = other2.querySelector('input[data-filter]');
            if (otherInput2 && otherInput2.checked) {
              otherInput2.checked = false;
              fi.updateFilterValue(otherInput2.getAttribute('data-filter'), false);
            }
          }
        }

        fi.updateFilterValue(this.getAttribute('data-filter'), isNowChecked).then(function () {
          fi.enableFilters();
          fi.debouncedApplyFilters();
        });
      });
    }

    // Filter inputs (text, number, date — not checkboxes, those are handled above)
    const filterInputs = body.querySelectorAll('input[data-filter]:not([type="checkbox"])');
    for (let fi2 = 0; fi2 < filterInputs.length; fi2++) {
      filterInputs[fi2].addEventListener('change', function () {
        fi.updateFilterValue(this.getAttribute('data-filter'), this.value).then(function () {
          fi.enableFilters();
          fi.debouncedApplyFilters();
        });
      });
    }

    // Feed navigation
    const navDate = body.querySelector('#gf-nav-date');
    if (navDate) {
      navDate.addEventListener('change', async function () { await GM.setValue('navDate', this.value); });
    }

    const navAlle = body.querySelector('#gf-nav-alle');
    if (navAlle) {
      navAlle.addEventListener('click', function () {
        navigateToDate('alle');
      });
    }

    const navUnbeantwortet = body.querySelector('#gf-nav-unbeantwortet');
    if (navUnbeantwortet) {
      navUnbeantwortet.addEventListener('click', function () {
        navigateToDate('unbeantwortet');
      });
    }

    const navReset = body.querySelector('#gf-nav-reset');
    if (navReset) {
      navReset.addEventListener('click', function () {
        resetNavigation();
        const dateInput = body.querySelector('#gf-nav-date');
        if (dateInput) dateInput.value = '';
        const url = new URL(window.location.href);
        if (url.searchParams.has('springe-zu')) {
          url.searchParams.delete('springe-zu');
          window.location.href = url.toString();
        }
      });
    }

    // Custom tags
    const customTagsInput = body.querySelector('#gf-custom-tags');
    if (customTagsInput) {
      customTagsInput.addEventListener('change', async function () {
        await GM.setValue('customTagsToRemove', parseCSV(this.value, false));
      });
    }

    // Blocked authors
    const blockedAuthorsInput = body.querySelector('#gf-blocked-authors');
    if (blockedAuthorsInput) {
      blockedAuthorsInput.addEventListener('change', async function () {
        await GM.setValue('blockedAuthors', parseCSV(this.value, false));
        fi.enableFilters();
        fi.debouncedApplyFilters();
      });
    }

    // Reset button
    const resetBtn = body.querySelector('.gf-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async function () {
        fi.filters = {
          afterDate: DEFAULT_FILTERS.afterDate,
          contentFilters: Object.assign({}, DEFAULT_FILTERS.contentFilters),
          interactionFilters: Object.assign({}, DEFAULT_FILTERS.interactionFilters),
          textFilters: Object.assign({}, DEFAULT_FILTERS.textFilters),
          topicFilters: Object.assign({}, DEFAULT_FILTERS.topicFilters)
        };
        await fi.saveFilters();
        await this.renderContent();
        fi.updateFilterIndicator();
        await fi.applyFilters();
      }.bind(this));
    }
  }
}

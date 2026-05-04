// src/gutefrage-smart-filters/ui-panel.js — Sidebar panel (filter UI)
// Provides: SidebarPanel class, SIDEBAR_CSS

import { createSidebar } from '../shared/ui-components.js';
import { DEFAULT_TAGS } from './tag-remover.js';
import { DEFAULT_FILTERS, parseCSV } from './filter-engine.js';
import { navigateToDate, resetNavigation } from './feed-navigation.js';

// ---- Sidebar Content CSS (scoped inside shadow DOM) ----

var SIDEBAR_CSS = [
  '.gf-stats-bar { margin:8px 0; padding:8px 13px; background:rgba(76,175,80,0.1); border:1px solid rgba(76,175,80,0.25); border-radius:7px; font-size:12px; color:#81c784; text-align:center; display:none; font-weight:500; }',
  '.gf-stats-bar.active { display:block; }',

  '.gf-section { margin-top:10px; background:#262a3c; border-radius:9px; padding:9px 11px 11px; border:1px solid rgba(255,255,255,0.07); }',
  '.gf-section-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.9px; color:#8890a4; margin:0 0 9px; display:flex; align-items:center; gap:6px; }',
  '.gf-section-title::before { content:""; flex-shrink:0; display:inline-block; width:3px; height:11px; background:#4CAF50; border-radius:2px; }',

  '.gf-input { width:100%; padding:6px 9px; border:1px solid rgba(255,255,255,0.13); border-radius:6px; font-size:12px; background:#2d3248; color:#dde3ec; box-sizing:border-box; transition:border-color 0.15s; font-family:inherit; }',
  '.gf-input + .gf-input { margin-top:4px; }',
  '.gf-input:focus { outline:none; border-color:#4CAF50; box-shadow:0 0 0 3px rgba(76,175,80,0.15); }',

  '.gf-label { font-size:10px; color:#8890a4; display:block; margin:6px 0 3px; font-weight:500; }',
  '.gf-label:first-child { margin-top:0; }',
  '.gf-hint { font-size:10px; color:#4e5a72; margin-top:3px; line-height:1.4; }',

  '.gf-pill-row { display:flex; gap:6px; flex-wrap:wrap; }',
  '.gf-pill-label { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:500; cursor:pointer; padding:5px 12px; border:1.5px solid rgba(255,255,255,0.13); border-radius:20px; user-select:none; transition:all 0.15s; color:#8890a4; background:#2d3248; }',
  '.gf-pill-label:has(input:checked) { background:#4CAF50; color:#fff; border-color:#4CAF50; box-shadow:0 2px 6px rgba(76,175,80,0.28); }',
  '.gf-pill-label input { display:none; }',

  '.gf-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:3px 0; }',
  '.gf-toggle-row + .gf-toggle-row { margin-top:1px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.07); }',
  '.gf-toggle-label { font-size:12px; color:#dde3ec; }',

  '.gf-number-row { display:flex; align-items:center; gap:8px; }',
  '.gf-number-row input { width:72px; padding:7px 8px; border:1px solid rgba(255,255,255,0.13); border-radius:6px; font-size:13px; background:#2d3248; color:#dde3ec; font-family:inherit; transition:border-color 0.15s; }',
  '.gf-number-row input:focus { outline:none; border-color:#4CAF50; box-shadow:0 0 0 3px rgba(76,175,80,0.15); }',
  '.gf-number-row span { font-size:12px; color:#8890a4; }',

  '.gf-nav-row { display:flex; gap:6px; margin-top:8px; }',
  '.gf-nav-btn { flex:1; padding:7px 8px; font-size:11px; font-weight:600; background:#2d3248; color:#4CAF50; border:1.5px solid #4CAF50; border-radius:6px; cursor:pointer; transition:all 0.15s; font-family:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
  '.gf-nav-btn:hover { background:#4CAF50; color:#fff; box-shadow:0 2px 6px rgba(76,175,80,0.28); }',
  '.gf-nav-btn:disabled { opacity:0.38; cursor:not-allowed; border-color:rgba(255,255,255,0.13); color:#8890a4; }',
  '.gf-nav-btn:disabled:hover { background:#2d3248; color:#8890a4; box-shadow:none; }',
  '.gf-nav-btn.active { background:#4CAF50; color:#fff; }',
  '#gf-nav-reset { background:#2d3248; color:#8890a4; border-color:rgba(255,255,255,0.13); }',
  '#gf-nav-reset:hover { background:#8890a4; color:#fff; }',

  '.gf-reset-btn { display:block; width:100%; margin-top:14px; padding:10px; background:#262a3c; border:1.5px solid rgba(255,255,255,0.07); border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; color:#8890a4; transition:all 0.2s; font-family:inherit; letter-spacing:0.2px; text-align:center; }',
  '.gf-reset-btn:hover { background:rgba(192,57,43,0.15); border-color:rgba(192,57,43,0.4); color:#e57373; }'
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
      accentColor: '#4CAF50',
      onOpen: function () {
        fi.enableFilters();
        setTimeout(function () { fi.applyFilters(); }, 100);
      },
      onClose: function () { /* no-op */ }
    });

    this.renderContent()['catch'](function (err) {
      console.warn('[GSF] Panel render error:', err);
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
    var statsEl = this.sb.bodyEl.querySelector('.gf-stats-bar');
    if (!statsEl) return;
    var filtered = total - visible;
    if (filtered > 0) {
      statsEl.textContent = visible + ' sichtbar  ·  ' + filtered + ' ausgeblendet';
      statsEl.classList.add('active');
    } else {
      statsEl.classList.remove('active');
    }
  }

  /**
   * Renders all filter controls into the sidebar body.
   */
  async renderContent() {
    var f = this.fi.filters;
    var hideTypes = f.contentFilters.hidePostTypes || [];
    var customTags = (await GM.getValue('customTagsToRemove', DEFAULT_TAGS)).join(', ');
    var blockedAuthors = (await GM.getValue('blockedAuthors', [])).join(', ');
    var dateVal = f.afterDate || '';
    var isUnansweredPage = window.location.pathname.indexOf('/unbeantwortet') !== -1;

    var html = '<style>' + SIDEBAR_CSS + '</style>';

    html += '<div class="gf-stats-bar"></div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Fragetyp</div>';
    html += '<div class="gf-pill-row">';
    html += '<label class="gf-pill-label"><input type="checkbox" data-posttype="frage"' + (hideTypes.indexOf('frage') === -1 ? ' checked' : '') + '> Fragen</label>';
    html += '<label class="gf-pill-label"><input type="checkbox" data-posttype="diskussion"' + (hideTypes.indexOf('diskussion') === -1 ? ' checked' : '') + '> Diskussionen</label>';
    html += '<label class="gf-pill-label"><input type="checkbox" data-posttype="umfrage"' + (hideTypes.indexOf('umfrage') === -1 ? ' checked' : '') + '> Umfragen</label>';
    html += '</div></div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Datum-Filter</div>';
    html += '<input type="datetime-local" class="gf-input" data-filter="afterDate" value="' + dateVal + '" title="Nur Beiträge ab diesem Datum anzeigen">';
    html += '<div class="gf-hint">Blendet Beiträge <strong>vor</strong> diesem Datum aus (AB-Filter)</div></div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Feed-Navigation</div>';
    html += '<span class="gf-label">Zu diesem Datum springen:</span>';
    html += '<input type="datetime-local" class="gf-input" id="gf-nav-date" value="' + (await GM.getValue('navDate', '')) + '" title="Springt im Gutefrage-Feed zu diesem Datum (VOR-Navigation)">';
    html += '<div class="gf-hint">Springt im Feed zu Beiträgen <strong>vor</strong> diesem Datum</div>';
    html += '<div class="gf-nav-row">';
    html += '<button class="gf-nav-btn' + (!isUnansweredPage ? ' active' : '') + '" id="gf-nav-alle" title="In „Alle Beiträge für Dich“ zu diesem Datum springen">Alle Beiträge →</button>';
    html += '<button class="gf-nav-btn' + (isUnansweredPage ? ' active' : '') + '" id="gf-nav-unbeantwortet" title="Zu diesem Datum in „Unbeantwortet“ springen">Unbeantwortet →</button>';
    html += '<button class="gf-nav-btn" id="gf-nav-reset" title="Feed-Navigation zurücksetzen (Datum löschen)">Zurücksetzen ↺</button>';
    html += '</div></div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Themenbereich</div>';
    html += '<span class="gf-label">Themen ausschließen (kommagetrennt):</span>';
    html += '<input type="text" class="gf-input" placeholder="z.B. Liebe, Sport, Tiere" value="' + this._escapeHTML(f.topicFilters.excludeTopics) + '" data-filter="topicFilters.excludeTopics">';
    html += '<span class="gf-label">Nur diese Themen (kommagetrennt):</span>';
    html += '<input type="text" class="gf-input" placeholder="z.B. Computer, Technik" value="' + this._escapeHTML(f.topicFilters.includeTopics) + '" data-filter="topicFilters.includeTopics">';
    html += '<div class="gf-hint">Themenname oder Slug (z.B. computer-internet)</div></div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Bilder-Filter</div>';
    html += this._toggleHTML('sb-only-with-images', 'contentFilters.onlyWithImages', f.contentFilters.onlyWithImages, 'Nur Beiträge mit Bildern');
    html += this._toggleHTML('sb-hide-with-images', 'contentFilters.hideWithImages', f.contentFilters.hideWithImages, 'Beiträge mit Bildern ausblenden');
    html += '<div class="gf-hint">Filtert nach Posts mit oder ohne Bildern</div></div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Gemerkte Beiträge</div>';
    html += this._toggleHTML('sb-only-bookmarked', 'contentFilters.onlyBookmarked', f.contentFilters.onlyBookmarked, 'Nur gemerkte anzeigen');
    html += this._toggleHTML('sb-hide-bookmarked', 'contentFilters.hideBookmarked', f.contentFilters.hideBookmarked, 'Gemerkte ausblenden');
    html += '</div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Interaktion</div>';
    html += '<span class="gf-label">Anzahl Antworten:</span>';
    html += '<div class="gf-number-row">';
    html += '<input type="number" placeholder="Min" value="' + f.interactionFilters.minAnswers + '" data-filter="interactionFilters.minAnswers" min="0">';
    html += '<span>bis</span>';
    html += '<input type="number" placeholder="Max" value="' + f.interactionFilters.maxAnswers + '" data-filter="interactionFilters.maxAnswers" min="0">';
    html += '</div>';
    html += '<span class="gf-label">Mindest-Likes:</span>';
    html += '<input type="number" class="gf-input" placeholder="z.B. 5" value="' + f.interactionFilters.minLikes + '" data-filter="interactionFilters.minLikes" min="0">';
    html += '</div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Textfilter</div>';
    html += '<span class="gf-label">Suchbegriffe (kommagetrennt):</span>';
    html += '<input type="text" class="gf-input" placeholder="z.B. JavaScript, Python" value="' + this._escapeHTML(f.textFilters.keywords) + '" data-filter="textFilters.keywords">';
    html += '<span class="gf-label">Ausschließen (kommagetrennt):</span>';
    html += '<input type="text" class="gf-input" placeholder="z.B. Spam, Werbung" value="' + this._escapeHTML(f.textFilters.excludeKeywords) + '" data-filter="textFilters.excludeKeywords">';
    html += '</div>';

    html += '<div class="gf-section">';
    html += '<div class="gf-section-title">Einstellungen</div>';
    html += '<span class="gf-label">Tags automatisch entfernen (kommagetrennt):</span>';
    html += '<input type="text" class="gf-input" id="gf-custom-tags" value="' + this._escapeHTML(customTags) + '">';
    html += '<span class="gf-label">Gesperrte Autoren (kommagetrennt):</span>';
    html += '<input type="text" class="gf-input" id="gf-blocked-authors" value="' + this._escapeHTML(blockedAuthors) + '">';
    html += '</div>';

    html += '<button class="gf-reset-btn">↺; Alle Filter zurücksetzen</button>';

    this.sb.bodyEl.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Builds a toggle switch HTML fragment.
   * @param {string} id - Element ID
   * @param {string} dataFilter - Filter data attribute value
   * @param {boolean} isOn - Whether the toggle is on
   * @param {string} label - Display label
   * @returns {string} HTML
   */
  _toggleHTML(id, dataFilter, isOn, label) {
    return [
      '<div class="gf-toggle-row">',
      '<span class="gf-toggle-label">' + label + '</span>',
      '<button class="Toggle-button u-mrm" type="button" id="' + id + '" role="switch" aria-checked="' + isOn + '"' + (dataFilter ? ' data-filter="' + dataFilter + '"' : '') + '>',
      '<span class="Toggle ' + (isOn ? 'Toggle--on' : 'Toggle--off') + '"><span class="Toggle-label"></span></span>',
      '</button></div>'
    ].join('');
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
    var body = this.sb.bodyEl;
    var fi = this.fi;

    // Post type checkboxes
    var typeChecks = body.querySelectorAll('[data-posttype]');
    for (var tc = 0; tc < typeChecks.length; tc++) {
      typeChecks[tc].addEventListener('change', function () {
        var type = this.getAttribute('data-posttype');
        var hideTypes = (fi.filters.contentFilters.hidePostTypes || []).slice();
        if (this.checked) {
          var idx = hideTypes.indexOf(type);
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

    // Toggle buttons with mutual exclusion for bookmark/image pairs
    var toggleBtns = body.querySelectorAll('.Toggle-button[data-filter]');
    for (var tb = 0; tb < toggleBtns.length; tb++) {
      toggleBtns[tb].addEventListener('click', function () {
        var toggle = this.querySelector('.Toggle');
        var isOn = toggle.classList.contains('Toggle--on');

        // Mutual exclusion for bookmark toggles
        if (!isOn && (this.id === 'sb-only-bookmarked' || this.id === 'sb-hide-bookmarked')) {
          var otherId = this.id === 'sb-only-bookmarked' ? 'sb-hide-bookmarked' : 'sb-only-bookmarked';
          var other = body.querySelector('#' + otherId);
          if (other && other.querySelector('.Toggle').classList.contains('Toggle--on')) {
            other.querySelector('.Toggle').classList.replace('Toggle--on', 'Toggle--off');
            other.setAttribute('aria-checked', 'false');
            fi.updateFilterValue(other.getAttribute('data-filter'), false);
          }
        }
        if (!isOn && (this.id === 'sb-only-with-images' || this.id === 'sb-hide-with-images')) {
          var otherId2 = this.id === 'sb-only-with-images' ? 'sb-hide-with-images' : 'sb-only-with-images';
          var other2 = body.querySelector('#' + otherId2);
          if (other2 && other2.querySelector('.Toggle').classList.contains('Toggle--on')) {
            other2.querySelector('.Toggle').classList.replace('Toggle--on', 'Toggle--off');
            other2.setAttribute('aria-checked', 'false');
            fi.updateFilterValue(other2.getAttribute('data-filter'), false);
          }
        }

        toggle.classList.toggle('Toggle--on', !isOn);
        toggle.classList.toggle('Toggle--off', isOn);
        this.setAttribute('aria-checked', !isOn);
        fi.updateFilterValue(this.getAttribute('data-filter'), !isOn).then(function () {
          fi.enableFilters();
          fi.debouncedApplyFilters();
        });
      });
    }

    // Filter inputs
    var filterInputs = body.querySelectorAll('input[data-filter]');
    for (var fi2 = 0; fi2 < filterInputs.length; fi2++) {
      filterInputs[fi2].addEventListener('change', function () {
        fi.updateFilterValue(this.getAttribute('data-filter'), this.value).then(function () {
          fi.enableFilters();
          fi.debouncedApplyFilters();
        });
      });
    }

    // Feed navigation
    var navDate = body.querySelector('#gf-nav-date');
    if (navDate) {
      navDate.addEventListener('change', async function () { await GM.setValue('navDate', this.value); });
    }

    var navAlle = body.querySelector('#gf-nav-alle');
    if (navAlle) {
      navAlle.addEventListener('click', function () {
        navigateToDate('alle');
      });
    }

    var navUnanswered = body.querySelector('#gf-nav-unbeantwortet');
    if (navUnanswered) {
      navUnanswered.addEventListener('click', function () {
        navigateToDate('unbeantwortet');
      });
    }

    var navReset = body.querySelector('#gf-nav-reset');
    if (navReset) {
      navReset.addEventListener('click', function () {
        resetNavigation();
        var dateInput = body.querySelector('#gf-nav-date');
        if (dateInput) dateInput.value = '';
        var url = new URL(window.location.href);
        if (url.searchParams.has('springe-zu')) {
          url.searchParams.delete('springe-zu');
          window.location.href = url.toString();
        }
      });
    }

    // Custom tags
    var customTagsInput = body.querySelector('#gf-custom-tags');
    if (customTagsInput) {
      customTagsInput.addEventListener('change', async function () {
        await GM.setValue('customTagsToRemove', parseCSV(this.value, false));
      });
    }

    // Blocked authors
    var blockedAuthorsInput = body.querySelector('#gf-blocked-authors');
    if (blockedAuthorsInput) {
      blockedAuthorsInput.addEventListener('change', async function () {
        await GM.setValue('blockedAuthors', parseCSV(this.value, false));
        fi.enableFilters();
        fi.debouncedApplyFilters();
      });
    }

    // Reset button
    var resetBtn = body.querySelector('.gf-reset-btn');
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

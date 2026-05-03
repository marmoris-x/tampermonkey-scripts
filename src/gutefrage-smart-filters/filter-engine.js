// src/gutefrage-smart-filters/filter-engine.js — Core filtering logic
// Provides: EnhancedFilterIntegration class, helper functions, DEFAULT_FILTERS
// Exports via window.__GSF__

(function () {
  'use strict';

  var log = TM.createLogger('Gutefrage Smart Filters');

  var DEFAULT_FILTERS = {
    afterDate: '',
    contentFilters: { onlyBookmarked: false, hideBookmarked: false, onlyWithImages: false, hideWithImages: false, hidePostTypes: [] },
    interactionFilters: { minAnswers: '', maxAnswers: '', minLikes: '' },
    textFilters: { keywords: '', excludeKeywords: '' },
    topicFilters: { excludeTopics: '', includeTopics: '' }
  };

  /**
   * Produces a short alphanumeric hash from a string (djb2 variant).
   * @param {string} str - Input string
   * @returns {string} 8-character hash
   */
  function hashString(str) {
    var hash = 5381, i;
    for (i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
    return (hash & 0x7FFFFFFF).toString(36).substring(0, 8);
  }

  /**
   * Parses a comma-separated string into an array of optionally lowercased tokens.
   * @param {string} text - Comma-separated input
   * @param {boolean} [lowercase=true] - Whether to lowercase tokens
   * @returns {string[]} Filtered array of non-empty tokens
   */
  function parseCSV(text, lowercase) {
    if (!text || typeof text !== 'string') return [];
    return text.split(',').map(function (t) { return lowercase !== false ? t.trim().toLowerCase() : t.trim(); }).filter(Boolean);
  }

  /**
   * Checks if two topic strings match using i18n-aware term matching.
   * @param {string} t1 - First topic
   * @param {string} t2 - Second topic
   * @returns {boolean}
   */
  function topicsMatch(t1, t2) {
    return TM.i18n.matchAnyTerm(t1, [t2]) || TM.i18n.matchAnyTerm(t2, [t1]);
  }

  // ---- DOM helpers ----

  /**
   * Returns the title text of a post element.
   * @param {Element} post - The post/DOM element
   * @returns {string}
   */
  function getPostTitle(post) {
    var el = post.querySelector('.Question-title');
    return el ? el.textContent.trim() : '';
  }

  /**
   * Returns the author name of a post element.
   * @param {Element} post - The post/DOM element
   * @returns {string}
   */
  function getPostAuthor(post) {
    var el = post.querySelector('.ContentMeta-author a');
    return el ? el.textContent.trim() : '';
  }

  /**
   * Returns the datetime attribute value of a post element.
   * @param {Element} post - The post/DOM element
   * @returns {string}
   */
  function getPostDateTime(post) {
    var el = post.querySelector('time[datetime]');
    return el ? el.getAttribute('datetime') : '';
  }

  /**
   * Checks whether a post element has an attached image.
   * @param {Element} post - The post/DOM element
   * @returns {boolean}
   */
  function getPostImagesStatus(post) {
    return !!post.querySelector('button[aria-label="Mit Bildern"]') || !!post.querySelector('.ListingElement-image');
  }

  /**
   * Extracts the answer count from a post element.
   * Searches through multiple selector patterns to find answer count text.
   * @param {Element} post - The post/DOM element
   * @returns {number}
   */
  function getAnswerCount(post) {
    var selectors = ['a[href*="/frage/"]', 'a[href*="/diskussion/"]', 'a[href*="/umfrage/"]', '.ListingElement-bottomBar a'];
    for (var s = 0; s < selectors.length; s++) {
      var links = post.querySelectorAll(selectors[s]);
      for (var i = 0; i < links.length; i++) {
        var text = links[i].textContent.trim();
        if (text.toLowerCase().indexOf('keine antwort') !== -1) return 0;
        var match = text.match(/(\d+)\s+Antwort/i);
        if (!match && text.toLowerCase().indexOf('antwort') !== -1) {
          var nm = text.match(/(\d+)/);
          if (nm) match = [null, nm[1]];
        }
        if (match) return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  /**
   * Produces a unique fingerprint string for a post element.
   * Used for caching filter results.
   * @param {Element} post - The post/DOM element
   * @returns {string}
   */
  function getPostFingerprint(post) {
    return hashString(getPostTitle(post)) + '|' + getPostAuthor(post) + '|' + getPostDateTime(post) + '|' + getPostImagesStatus(post) + '|' + getAnswerCount(post);
  }

  // ---- Enhanced Filter Integration ----

  /**
   * Core filtering engine for the Gutefrage feed.
   * Manages filter state, applies filter rules to posts, caches results,
   * and communicates with the sidebar panel for UI updates.
   */
  class EnhancedFilterIntegration {
    constructor() {
      if (!window.location.pathname.startsWith('/home/')) return;

      this.filters = {
        afterDate: DEFAULT_FILTERS.afterDate,
        contentFilters: Object.assign({}, DEFAULT_FILTERS.contentFilters),
        interactionFilters: Object.assign({}, DEFAULT_FILTERS.interactionFilters),
        textFilters: Object.assign({}, DEFAULT_FILTERS.textFilters),
        topicFilters: Object.assign({}, DEFAULT_FILTERS.topicFilters)
      };
      this.filtersEnabled = false;
      this.sidebar = null;
      this.debouncedApplyFilters = TM.dom.debounce(function () { this.applyFilters(); }.bind(this), 300);
      this.filterCache = {};
      this.lastFilterHash = '';
      this.parsedFilterData = { excludeTopics: null, includeTopics: null, keywords: null, excludeKeywords: null, blockedAuthors: null };
    }

    /**
     * Loads saved filters and initializes the filter engine.
     * @returns {Promise<void>}
     */
    async init() {
      if (!window.location.pathname.startsWith('/home/')) return;
      this.filters = await this.loadFilters();
    }

    /**
     * Loads filter settings from storage.
     * @returns {Promise<object>} The loaded filter configuration
     */
    async loadFilters() {
      var saved = await TM.storage.loadSetting('enhancedFilters', {});
      return {
        afterDate: saved.afterDate !== undefined ? saved.afterDate : DEFAULT_FILTERS.afterDate,
        contentFilters: this._mergeShallow(DEFAULT_FILTERS.contentFilters, saved.contentFilters),
        interactionFilters: this._mergeShallow(DEFAULT_FILTERS.interactionFilters, saved.interactionFilters),
        textFilters: this._mergeShallow(DEFAULT_FILTERS.textFilters, saved.textFilters),
        topicFilters: this._mergeShallow(DEFAULT_FILTERS.topicFilters, saved.topicFilters)
      };
    }

    /**
     * Persists current filter state to storage.
     * @returns {Promise<void>}
     */
    async saveFilters() {
      await TM.storage.saveSetting('enhancedFilters', this.filters);
    }

    /**
     * Merges a shallow defaults object with override values.
     * @param {object} defaults - Default values
     * @param {object} [overrides] - Override values
     * @returns {object} Merged object
     */
    _mergeShallow(defaults, overrides) {
      if (!overrides || typeof overrides !== 'object') return Object.assign({}, defaults);
      var result = Object.assign({}, defaults);
      Object.keys(overrides).forEach(function (k) { if (overrides[k] !== undefined) result[k] = overrides[k]; });
      return result;
    }

    /**
     * Enables filters and starts observing new posts.
     */
    enableFilters() {
      if (!this.filtersEnabled) {
        this.filtersEnabled = true;
        this.observeNewPosts();
        log.log('Filters activated!');
      }
    }

    /**
     * Sets up a MutationObserver to apply filters to newly added posts.
     */
    observeNewPosts() {
      if (this.postObserver) return;
      var self = this;
      this.postObserver = TM.dom.observeMutations(function (node) {
        if (!self.filtersEnabled) return;
        if (node.matches && (node.matches('.Plate.ListingElement') || node.querySelector('.Plate.ListingElement'))) {
          self.debouncedApplyFilters();
        }
      });
    }

    /**
     * Updates a single filter value by dot-separated path and persists.
     * @param {string} filterPath - Dot-separated path (e.g. "contentFilters.onlyBookmarked")
     * @param {*} value - New value
     * @returns {Promise<void>}
     */
    async updateFilterValue(filterPath, value) {
      var paths = filterPath.split('.');
      var current = this.filters;
      for (var i = 0; i < paths.length - 1; i++) current = current[paths[i]];
      current[paths[paths.length - 1]] = value;
      await this.saveFilters();
      this.updateFilterIndicator();
    }

    /**
     * Updates the active filter count badge in the sidebar.
     */
    updateFilterIndicator() {
      var countSpan = document.querySelector('.Filter-buttonActiveFiltersCount');
      if (!countSpan) return;

      var activeCount = 0;
      if (this.filters.afterDate) activeCount++;
      var cf = this.filters.contentFilters;
      if (cf.onlyBookmarked) activeCount++;
      if (cf.hideBookmarked) activeCount++;
      if (cf.onlyWithImages) activeCount++;
      if (cf.hideWithImages) activeCount++;
      if (cf.hidePostTypes && cf.hidePostTypes.length > 0) activeCount++;
      var inf = this.filters.interactionFilters;
      if (inf.minAnswers || inf.maxAnswers || inf.minLikes) activeCount++;
      var tf = this.filters.textFilters;
      if (tf.keywords || tf.excludeKeywords) activeCount++;
      var topf = this.filters.topicFilters;
      if (topf.excludeTopics || topf.includeTopics) activeCount++;

      countSpan.textContent = activeCount > 0 ? String(activeCount) : '';
      countSpan.style.display = activeCount > 0 ? 'inline-block' : 'none';
    }

    /**
     * Returns a hash string representing the current filter + blocked/custom state.
     * @returns {string} JSON-stringified filter state hash
     */
    async getFilterHash() {
      return JSON.stringify({
        filters: this.filters,
        blockedAuthors: await GM.getValue('blockedAuthors', []),
        customTags: await GM.getValue('customTagsToRemove', [])
      });
    }

    /**
     * Parses CSV filter fields into cached arrays for faster matching.
     */
    async updateParsedFilters() {
      var blockedAuthors = await GM.getValue('blockedAuthors', []);
      this.parsedFilterData = {
        excludeTopics: parseCSV(this.filters.topicFilters.excludeTopics),
        includeTopics: parseCSV(this.filters.topicFilters.includeTopics),
        keywords: parseCSV(this.filters.textFilters.keywords),
        excludeKeywords: parseCSV(this.filters.textFilters.excludeKeywords),
        blockedAuthors: blockedAuthors.map(function (a) { return a.trim().toLowerCase(); })
      };
    }

    /**
     * Applies all active filters to every post on the page.
     * Uses a two-tier cache (in-memory map + DOM data attributes) for performance.
     */
    async applyFilters() {
      if (!this.filtersEnabled) return;

      var posts = document.querySelectorAll('.Plate.ListingElement');
      var visibleCount = 0;
      var currentHash = await this.getFilterHash();
      var shortHash = hashString(currentHash);

      if (currentHash !== this.lastFilterHash) {
        this.filterCache = {};
        this.lastFilterHash = currentHash;
        await this.updateParsedFilters();
      }

      if (Object.keys(this.filterCache).length > 1000) this.filterCache = {};

      if (!this.parsedFilterData || this.parsedFilterData.excludeTopics === null) await this.updateParsedFilters();

      for (var p = 0; p < posts.length; p++) {
        var post = posts[p];
        var fingerprint = getPostFingerprint(post);
        var cacheKey = currentHash + '|' + fingerprint;

        if (this.filterCache[cacheKey] !== undefined) {
          var cached = this.filterCache[cacheKey];
          post.style.display = cached ? '' : 'none';
          post.dataset.filterHash = shortHash;
          post.dataset.lastFilterResult = cached ? 'visible' : 'hidden';
          if (cached) visibleCount++;
          continue;
        }

        var postHash = post.dataset.filterHash;
        var lastResult = post.dataset.lastFilterResult;
        if (postHash === shortHash && lastResult) {
          var domCached = lastResult === 'visible';
          this.filterCache[cacheKey] = domCached;
          post.style.display = domCached ? '' : 'none';
          if (domCached) visibleCount++;
          continue;
        }

        var shouldShow = true;

        // Date filter
        if (shouldShow && this.filters.afterDate) {
          var timeEl = post.querySelector('time[datetime]');
          if (timeEl) {
            var postDate = new Date(timeEl.getAttribute('datetime'));
            if (postDate < new Date(this.filters.afterDate)) shouldShow = false;
          }
        }

        // Post type filter
        if (shouldShow && this.filters.contentFilters.hidePostTypes && this.filters.contentFilters.hidePostTypes.length > 0) {
          var link = post.querySelector('a.ListingElement-questionLink[href]');
          if (link) {
            var href = link.getAttribute('href');
            var type = href.indexOf('/frage/') !== -1 ? 'frage' : href.indexOf('/diskussion/') !== -1 ? 'diskussion' : href.indexOf('/umfrage/') !== -1 ? 'umfrage' : null;
            if (type && this.filters.contentFilters.hidePostTypes.indexOf(type) !== -1) shouldShow = false;
          }
        }

        // Bookmark filter
        if (shouldShow && (this.filters.contentFilters.onlyBookmarked || this.filters.contentFilters.hideBookmarked)) {
          var isBookmarked = !!post.querySelector('.Icon--bookmark-filled-large');
          if (this.filters.contentFilters.onlyBookmarked && !isBookmarked) shouldShow = false;
          if (shouldShow && this.filters.contentFilters.hideBookmarked && isBookmarked) shouldShow = false;
        }

        // Images filter
        if (shouldShow && (this.filters.contentFilters.onlyWithImages || this.filters.contentFilters.hideWithImages)) {
          var hasImages = getPostImagesStatus(post);
          if (this.filters.contentFilters.onlyWithImages && !hasImages) shouldShow = false;
          if (shouldShow && this.filters.contentFilters.hideWithImages && hasImages) shouldShow = false;
        }

        // Blocked author filter
        if (shouldShow && this.parsedFilterData.blockedAuthors.length > 0) {
          var authorName = getPostAuthor(post).toLowerCase();
          if (authorName && this.parsedFilterData.blockedAuthors.indexOf(authorName) !== -1) shouldShow = false;
        }

        // Topic filter
        if (shouldShow && (this.parsedFilterData.excludeTopics.length > 0 || this.parsedFilterData.includeTopics.length > 0)) {
          var topicEls = post.querySelectorAll('a[href*="/thema/"], a:has(.BrandAvatar), [data-topic-slug], .ContentMeta-topic, .ContentMeta-category, a.u-strongLight:has(.BrandAvatar--small)');
          var topicStrings = [];
          for (var t = 0; t < topicEls.length; t++) {
            var el = topicEls[t];
            var text = (el.textContent || '').trim().toLowerCase();
            if (text) topicStrings.push(text);
            var href = el.getAttribute('href');
            if (href) {
              var clean = href.replace(/^https?:\/\/[^\/]+/, '').split('?')[0].split('#')[0].replace(/^\/|\/$/g, '');
              if (clean && !clean.match(/^(frage|diskussion|umfrage|home|meine|suche|nutzer)\//)) {
                topicStrings.push(clean);
                if (clean.indexOf('/') !== -1) {
                  var parts = clean.split('/');
                  for (var pt = 0; pt < parts.length; pt++) { if (parts[pt]) topicStrings.push(parts[pt]); }
                }
              }
            }
            var dataSlug = el.getAttribute('data-topic-slug');
            if (dataSlug) topicStrings.push(dataSlug.toLowerCase());
          }

          var uniqueTopics = [];
          for (var u = 0; u < topicStrings.length; u++) {
            if (uniqueTopics.indexOf(topicStrings[u]) === -1) uniqueTopics.push(topicStrings[u]);
          }

          if (shouldShow && this.parsedFilterData.excludeTopics.length > 0 && uniqueTopics.length > 0) {
            for (var ex = 0; ex < uniqueTopics.length; ex++) {
              for (var ec = 0; ec < this.parsedFilterData.excludeTopics.length; ec++) {
                if (topicsMatch(uniqueTopics[ex], this.parsedFilterData.excludeTopics[ec])) { shouldShow = false; break; }
              }
              if (!shouldShow) break;
            }
          }

          if (shouldShow && this.parsedFilterData.includeTopics.length > 0 && uniqueTopics.length > 0) {
            var hasMatch = false;
            for (var ic = 0; ic < uniqueTopics.length; ic++) {
              for (var ic2 = 0; ic2 < this.parsedFilterData.includeTopics.length; ic2++) {
                if (topicsMatch(uniqueTopics[ic], this.parsedFilterData.includeTopics[ic2])) { hasMatch = true; break; }
              }
              if (hasMatch) break;
            }
            if (!hasMatch) shouldShow = false;
          }
        }

        // Text filters
        if (shouldShow && (this.parsedFilterData.keywords.length > 0 || this.parsedFilterData.excludeKeywords.length > 0)) {
          var titleText = getPostTitle(post).toLowerCase();
          var bodyText = post.querySelector('.ContentBody') ? (post.querySelector('.ContentBody').textContent || '').toLowerCase() : '';
          var authorText = getPostAuthor(post).toLowerCase();
          var searchable = titleText + ' ' + bodyText + ' ' + authorText;

          if (this.parsedFilterData.keywords.length > 0) {
            var kwMatch = false;
            for (var kw = 0; kw < this.parsedFilterData.keywords.length; kw++) {
              if (searchable.indexOf(this.parsedFilterData.keywords[kw]) !== -1) { kwMatch = true; break; }
            }
            if (!kwMatch) shouldShow = false;
          }

          if (shouldShow && this.parsedFilterData.excludeKeywords.length > 0) {
            for (var ek = 0; ek < this.parsedFilterData.excludeKeywords.length; ek++) {
              if (searchable.indexOf(this.parsedFilterData.excludeKeywords[ek]) !== -1) { shouldShow = false; break; }
            }
          }
        }

        // Answer count filter
        if (shouldShow && (this.filters.interactionFilters.minAnswers !== '' || this.filters.interactionFilters.maxAnswers !== '')) {
          var answerCount = getAnswerCount(post);
          var minA = parseInt(this.filters.interactionFilters.minAnswers, 10);
          var maxA = parseInt(this.filters.interactionFilters.maxAnswers, 10);
          if (!isNaN(minA) && answerCount < minA) shouldShow = false;
          if (shouldShow && !isNaN(maxA) && answerCount > maxA) shouldShow = false;
        }

        // Likes filter
        if (shouldShow && this.filters.interactionFilters.minLikes) {
          var likeBtn = post.querySelector('.ActionBarIcon button[aria-label*="Daumen"]');
          var likes = likeBtn ? parseInt((likeBtn.getAttribute('aria-label').match(/(\d+)/) || [])[1], 10) || 0 : parseInt((post.querySelector('.ActionBarIcon-count') || {}).textContent, 10) || 0;
          if (likes < parseInt(this.filters.interactionFilters.minLikes, 10)) shouldShow = false;
        }

        this.filterCache[cacheKey] = shouldShow;
        post.dataset.filterHash = shortHash;
        post.dataset.lastFilterResult = shouldShow ? 'visible' : 'hidden';

        if (shouldShow) visibleCount++;
        post.style.display = shouldShow ? '' : 'none';
      }

      this.updateStats(visibleCount, posts.length);
    }

    /**
     * Updates the sidebar stats display with visible/total counts.
     * @param {number} visible - Number of visible posts
     * @param {number} total - Total number of posts
     */
    updateStats(visible, total) {
      if (this.sidebar) this.sidebar.updateStats(visible, total);
    }
  }

  window.__GSF__ = window.__GSF__ || {};
  window.__GSF__.EnhancedFilterIntegration = EnhancedFilterIntegration;
  window.__GSF__.DEFAULT_FILTERS = DEFAULT_FILTERS;
  window.__GSF__.hashString = hashString;
  window.__GSF__.parseCSV = parseCSV;
  window.__GSF__.topicsMatch = topicsMatch;
})();

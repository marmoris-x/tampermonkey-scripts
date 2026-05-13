// src/gutefrage-smart-filters/filter-engine.js — Orchestration layer
// Provides: EnhancedFilterIntegration class, DEFAULT_FILTERS, parseCSV (re-export), hashString (re-export)

import { createLogger } from './_logger.js';
import { debounce, observeMutations } from './_dom.js';
import { loadSetting, saveSetting } from './_storage.js';
import { hashString, getPostFingerprint } from './filter-cache.js';
import { parseCSV, applyDateFilter, applyPostTypeFilter, applyBookmarkFilter, applyImagesFilter, applyAuthorFilter, applyTopicFilter, applyTextFilter, applyInteractionFilter } from './filter-rules.js';

const log = createLogger('Gutefrage Smart Filters');

export { parseCSV, hashString };

export const DEFAULT_FILTERS = {
  afterDate: '',
  contentFilters: { onlyBookmarked: false, hideBookmarked: false, onlyWithImages: false, hideWithImages: false, hidePostTypes: [] },
  interactionFilters: { minAnswers: '', maxAnswers: '', minLikes: '' },
  textFilters: { keywords: '', excludeKeywords: '' },
  topicFilters: { excludeTopics: '', includeTopics: '' }
};

// ---- Enhanced Filter Integration ----

/**
 * Core filtering engine for the Gutefrage feed.
 * Manages filter state, applies filter rules to posts, caches results,
 * and communicates with the sidebar panel for UI updates.
 */
export class EnhancedFilterIntegration {
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
    this.debouncedApplyFilters = debounce(function () { this.applyFilters(); }.bind(this), 300);
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
    this.enableFilters();
  }

  /**
   * Loads filter settings from storage.
   * @returns {Promise<object>} The loaded filter configuration
   */
  async loadFilters() {
    const saved = await loadSetting('enhancedFilters', {});
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
    await saveSetting('enhancedFilters', this.filters);
  }

  /**
   * Merges a shallow defaults object with override values.
   * @param {object} defaults - Default values
   * @param {object} [overrides] - Override values
   * @returns {object} Merged object
   */
  _mergeShallow(defaults, overrides) {
    if (!overrides || typeof overrides !== 'object') return Object.assign({}, defaults);
    const result = Object.assign({}, defaults);
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
    const self = this;
    this.postObserver = observeMutations(function (node) {
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
    const paths = filterPath.split('.');
    let current = this.filters;
    for (let i = 0; i < paths.length - 1; i++) current = current[paths[i]];
    current[paths[paths.length - 1]] = value;
    await this.saveFilters();
    this.updateFilterIndicator();
  }

  /**
   * Updates the active filter count badge in the sidebar.
   */
  updateFilterIndicator() {
    const countSpan = document.querySelector('.Filter-buttonActiveFiltersCount');
    if (!countSpan) return;

    let activeCount = 0;
    if (this.filters.afterDate) activeCount++;
    const cf = this.filters.contentFilters;
    if (cf.onlyBookmarked) activeCount++;
    if (cf.hideBookmarked) activeCount++;
    if (cf.onlyWithImages) activeCount++;
    if (cf.hideWithImages) activeCount++;
    if (cf.hidePostTypes && cf.hidePostTypes.length > 0) activeCount++;
    const inf = this.filters.interactionFilters;
    if (inf.minAnswers || inf.maxAnswers || inf.minLikes) activeCount++;
    const tf = this.filters.textFilters;
    if (tf.keywords || tf.excludeKeywords) activeCount++;
    const topf = this.filters.topicFilters;
    if (topf.excludeTopics || topf.includeTopics) activeCount++;

    countSpan.textContent = activeCount > 0 ? String(activeCount) : '';
    countSpan.style.display = activeCount > 0 ? 'inline-block' : 'none';
  }

  /**
   * Returns a hash string representing the current filter + blocked/custom state.
   * @returns {Promise<string>} JSON-stringified filter state hash
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
    const blockedAuthors = await GM.getValue('blockedAuthors', []);
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
   * Delegates filter logic to pure functions in filter-rules.js.
   */
  async applyFilters() {
    if (!this.filtersEnabled) return;

    const posts = document.querySelectorAll('.Plate.ListingElement');
    let visibleCount = 0;
    const currentHash = await this.getFilterHash();
    const shortHash = hashString(currentHash);

    if (currentHash !== this.lastFilterHash) {
      this.filterCache = {};
      this.lastFilterHash = currentHash;
      await this.updateParsedFilters();
    }

    if (Object.keys(this.filterCache).length > 1000) this.filterCache = {};

    if (!this.parsedFilterData || this.parsedFilterData.excludeTopics === null) await this.updateParsedFilters();

    const {
      afterDate,
      contentFilters: { onlyBookmarked, hideBookmarked, onlyWithImages, hideWithImages, hidePostTypes },
      interactionFilters: { minAnswers, maxAnswers, minLikes }
    } = this.filters;
    const { excludeTopics: parsedExcludeTopics, includeTopics: parsedIncludeTopics, keywords: parsedKeywords, excludeKeywords: parsedExcludeKeywords, blockedAuthors } = this.parsedFilterData;

    for (let p = 0; p < posts.length; p++) {
      const post = posts[p];
      const fingerprint = getPostFingerprint(post);
      const cacheKey = currentHash + '|' + fingerprint;

      // Tier 1: in-memory cache
      if (this.filterCache[cacheKey] !== undefined) {
        const cached = this.filterCache[cacheKey];
        post.style.display = cached ? '' : 'none';
        post.dataset.filterHash = shortHash;
        post.dataset.lastFilterResult = cached ? 'visible' : 'hidden';
        if (cached) visibleCount++;
        continue;
      }

      // Tier 2: DOM data attribute cache
      const postHash = post.dataset.filterHash;
      const lastResult = post.dataset.lastFilterResult;
      if (postHash === shortHash && lastResult) {
        const domCached = lastResult === 'visible';
        this.filterCache[cacheKey] = domCached;
        post.style.display = domCached ? '' : 'none';
        if (domCached) visibleCount++;
        continue;
      }

      // Chain pure filter functions — short-circuit on first rejection
      let shouldShow = true;

      if (shouldShow) shouldShow = applyDateFilter(post, afterDate);
      if (shouldShow) shouldShow = applyPostTypeFilter(post, hidePostTypes);
      if (shouldShow) shouldShow = applyBookmarkFilter(post, onlyBookmarked, hideBookmarked);
      if (shouldShow) shouldShow = applyImagesFilter(post, onlyWithImages, hideWithImages);
      if (shouldShow) shouldShow = applyAuthorFilter(post, blockedAuthors);
      if (shouldShow) shouldShow = applyTopicFilter(post, parsedExcludeTopics, parsedIncludeTopics);
      if (shouldShow) shouldShow = applyTextFilter(post, parsedKeywords, parsedExcludeKeywords);
      if (shouldShow) shouldShow = applyInteractionFilter(post, minAnswers, maxAnswers, minLikes);

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

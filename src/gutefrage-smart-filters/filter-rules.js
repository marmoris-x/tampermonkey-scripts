// src/gutefrage-smart-filters/filter-rules.js — Pure filter functions
// Provides: parseCSV, topicsMatch, DOM helpers, and all apply* filter functions

import { matchAnyTerm } from './_i18n.js';

// ---- String utilities ----

/**
 * Parses a comma-separated string into an array of optionally lowercased tokens.
 * @param {string} text - Comma-separated input
 * @param {boolean} [lowercase=true] - Whether to lowercase tokens
 * @returns {string[]} Filtered array of non-empty tokens
 */
export function parseCSV(text, lowercase) {
  if (!text || typeof text !== 'string') return [];
  return text.split(',').map(function (t) { return lowercase !== false ? t.trim().toLowerCase() : t.trim(); }).filter(Boolean);
}

/**
 * Checks if two topic strings match using i18n-aware term matching.
 * @param {string} t1 - First topic
 * @param {string} t2 - Second topic
 * @returns {boolean}
 */
export function topicsMatch(t1, t2) {
  return matchAnyTerm(t1, [t2]) || matchAnyTerm(t2, [t1]);
}

// ---- DOM helpers for data extraction ----

/**
 * Returns the title text of a post element.
 * @param {Element} post - The post/DOM element
 * @returns {string}
 */
export function getPostTitle(post) {
  const el = post.querySelector('.Question-title');
  return el ? el.textContent.trim() : '';
}

/**
 * Returns the author name of a post element.
 * @param {Element} post - The post/DOM element
 * @returns {string}
 */
export function getPostAuthor(post) {
  const el = post.querySelector('.ContentMeta-author a');
  return el ? el.textContent.trim() : '';
}

/**
 * Returns the datetime attribute value of a post element.
 * @param {Element} post - The post/DOM element
 * @returns {string}
 */
export function getPostDateTime(post) {
  const el = post.querySelector('time[datetime]');
  return el ? el.getAttribute('datetime') : '';
}

/**
 * Checks whether a post element has an attached image.
 * @param {Element} post - The post/DOM element
 * @returns {boolean}
 */
export function getPostImagesStatus(post) {
  return !!post.querySelector('button[aria-label="Mit Bildern"]') || !!post.querySelector('.ListingElement-image');
}

/**
 * Extracts the answer count from a post element.
 * Searches through multiple selector patterns to find answer count text.
 * @param {Element} post - The post/DOM element
 * @returns {number}
 */
export function getAnswerCount(post) {
  const selectors = ['a[href*="/frage/"]', 'a[href*="/diskussion/"]', 'a[href*="/umfrage/"]', '.ListingElement-bottomBar a'];
  for (let s = 0; s < selectors.length; s++) {
    const links = post.querySelectorAll(selectors[s]);
    for (let i = 0; i < links.length; i++) {
      const text = links[i].textContent.trim();
      if (text.toLowerCase().indexOf('keine antwort') !== -1) return 0;
      let match = text.match(/(\d+)\s+Antwort/i);
      if (!match && text.toLowerCase().indexOf('antwort') !== -1) {
        const nm = text.match(/(\d+)/);
        if (nm) match = [null, nm[1]];
      }
      if (match) return parseInt(match[1], 10);
    }
  }
  return 0;
}

// ---- Pure filter functions ----

/**
 * Applies a date-based filter: shows posts on or after the given date.
 * @param {Element} post - The post/DOM element
 * @param {string} afterDate - ISO date string to filter after (empty = no filter)
 * @returns {boolean} true if the post should be visible
 */
export function applyDateFilter(post, afterDate) {
  if (!afterDate) return true;
  const timeEl = post.querySelector('time[datetime]');
  if (!timeEl) return true;
  const postDate = new Date(timeEl.getAttribute('datetime'));
  return postDate >= new Date(afterDate);
}

/**
 * Applies post type filter (hide specific types like frage/diskussion/umfrage).
 * @param {Element} post - The post/DOM element
 * @param {string[]} hideTypes - Array of type strings to hide
 * @returns {boolean} true if the post should be visible
 */
export function applyPostTypeFilter(post, hideTypes) {
  if (!hideTypes || hideTypes.length === 0) return true;
  const link = post.querySelector('a.ListingElement-questionLink[href]');
  if (!link) return true;
  const href = link.getAttribute('href');
  const type = href.indexOf('/frage/') !== -1 ? 'frage' : href.indexOf('/diskussion/') !== -1 ? 'diskussion' : href.indexOf('/umfrage/') !== -1 ? 'umfrage' : null;
  if (type && hideTypes.indexOf(type) !== -1) return false;
  return true;
}

/**
 * Applies bookmark-based visibility filter.
 * @param {Element} post - The post/DOM element
 * @param {boolean} onlyBookmarked - Show only bookmarked posts
 * @param {boolean} hideBookmarked - Hide bookmarked posts
 * @returns {boolean} true if the post should be visible
 */
export function applyBookmarkFilter(post, onlyBookmarked, hideBookmarked) {
  if (!onlyBookmarked && !hideBookmarked) return true;
  const isBookmarked = !!post.querySelector('.Icon--bookmark-filled-large');
  if (onlyBookmarked && !isBookmarked) return false;
  if (hideBookmarked && isBookmarked) return false;
  return true;
}

/**
 * Applies image-based visibility filter.
 * @param {Element} post - The post/DOM element
 * @param {boolean} onlyWithImages - Show only posts with images
 * @param {boolean} hideWithImages - Hide posts with images
 * @returns {boolean} true if the post should be visible
 */
export function applyImagesFilter(post, onlyWithImages, hideWithImages) {
  if (!onlyWithImages && !hideWithImages) return true;
  const hasImages = getPostImagesStatus(post);
  if (onlyWithImages && !hasImages) return false;
  if (hideWithImages && hasImages) return false;
  return true;
}

/**
 * Applies author blocklist filter.
 * @param {Element} post - The post/DOM element
 * @param {string[]} blockedAuthors - Array of lowercased author names to block
 * @returns {boolean} true if the post should be visible
 */
export function applyAuthorFilter(post, blockedAuthors) {
  if (!blockedAuthors || blockedAuthors.length === 0) return true;
  const authorName = getPostAuthor(post).toLowerCase();
  if (authorName && blockedAuthors.indexOf(authorName) !== -1) return false;
  return true;
}

/**
 * Applies topic-based filter (exclude/include topics).
 * Optimized with Set for unique topic deduplication.
 * @param {Element} post - The post/DOM element
 * @param {string[]} excludeTopics - Topics to exclude
 * @param {string[]} includeTopics - Topics to require
 * @returns {boolean} true if the post should be visible
 */
export function applyTopicFilter(post, excludeTopics, includeTopics) {
  if ((!excludeTopics || excludeTopics.length === 0) && (!includeTopics || includeTopics.length === 0)) return true;

  const topicEls = post.querySelectorAll('a[href*="/thema/"], a:has(.BrandAvatar), [data-topic-slug], .ContentMeta-topic, .ContentMeta-category, a.u-strongLight:has(.BrandAvatar--small)');
  const topicStrings = [];

  for (let t = 0; t < topicEls.length; t++) {
    const el = topicEls[t];
    const text = (el.textContent || '').trim().toLowerCase();
    if (text) topicStrings.push(text);
    const href = el.getAttribute('href');
    if (href) {
      const clean = href.replace(/^https?:\/\/[^\/]+/, '').split('?')[0].split('#')[0].replace(/^\/|\/$/g, '');
      if (clean && !clean.match(/^(frage|diskussion|umfrage|home|meine|suche|nutzer)\//)) {
        topicStrings.push(clean);
        if (clean.indexOf('/') !== -1) {
          const parts = clean.split('/');
          for (let pt = 0; pt < parts.length; pt++) { if (parts[pt]) topicStrings.push(parts[pt]); }
        }
      }
    }
    const dataSlug = el.getAttribute('data-topic-slug');
    if (dataSlug) topicStrings.push(dataSlug.toLowerCase());
  }

  // Use Set for O(n) uniqueness instead of indexOf O(n^2)
  const uniqueTopics = [...new Set(topicStrings)];

  if (excludeTopics && excludeTopics.length > 0 && uniqueTopics.length > 0) {
    for (let ex = 0; ex < uniqueTopics.length; ex++) {
      for (let ec = 0; ec < excludeTopics.length; ec++) {
        if (topicsMatch(uniqueTopics[ex], excludeTopics[ec])) return false;
      }
    }
  }

  if (includeTopics && includeTopics.length > 0 && uniqueTopics.length > 0) {
    for (let ic = 0; ic < uniqueTopics.length; ic++) {
      for (let ic2 = 0; ic2 < includeTopics.length; ic2++) {
        if (topicsMatch(uniqueTopics[ic], includeTopics[ic2])) return true;
      }
    }
    return false;
  }

  return true;
}

/**
 * Applies text keyword filter (include/exclude by keyword matching).
 * @param {Element} post - The post/DOM element
 * @param {string[]} keywords - Keywords that must appear (at least one)
 * @param {string[]} excludeKeywords - Keywords that must NOT appear
 * @returns {boolean} true if the post should be visible
 */
export function applyTextFilter(post, keywords, excludeKeywords) {
  if ((!keywords || keywords.length === 0) && (!excludeKeywords || excludeKeywords.length === 0)) return true;

  const titleText = getPostTitle(post).toLowerCase();
  const bodyEl = post.querySelector('.ContentBody');
  const bodyText = bodyEl ? (bodyEl.textContent || '').toLowerCase() : '';
  const authorText = getPostAuthor(post).toLowerCase();
  const searchable = titleText + ' ' + bodyText + ' ' + authorText;

  if (keywords && keywords.length > 0) {
    let kwMatch = false;
    for (let kw = 0; kw < keywords.length; kw++) {
      if (searchable.indexOf(keywords[kw]) !== -1) { kwMatch = true; break; }
    }
    if (!kwMatch) return false;
  }

  if (excludeKeywords && excludeKeywords.length > 0) {
    for (let ek = 0; ek < excludeKeywords.length; ek++) {
      if (searchable.indexOf(excludeKeywords[ek]) !== -1) return false;
    }
  }

  return true;
}

/**
 * Applies interaction-based filters (min/max answers, min likes).
 * @param {Element} post - The post/DOM element
 * @param {string} minAnswers - Minimum number of answers (empty = no filter)
 * @param {string} maxAnswers - Maximum number of answers (empty = no filter)
 * @param {string} minLikes - Minimum number of likes (empty = no filter)
 * @returns {boolean} true if the post should be visible
 */
export function applyInteractionFilter(post, minAnswers, maxAnswers, minLikes) {
  if (minAnswers !== '' || maxAnswers !== '') {
    const answerCount = getAnswerCount(post);
    const minA = parseInt(minAnswers, 10);
    const maxA = parseInt(maxAnswers, 10);
    if (!isNaN(minA) && answerCount < minA) return false;
    if (!isNaN(maxA) && answerCount > maxA) return false;
  }

  if (minLikes) {
    const likeBtn = post.querySelector('.ActionBarIcon button[aria-label*="Daumen"]');
    const likes = likeBtn ? parseInt((likeBtn.getAttribute('aria-label').match(/(\d+)/) || [])[1], 10) || 0 : parseInt((post.querySelector('.ActionBarIcon-count') || {}).textContent, 10) || 0;
    if (likes < parseInt(minLikes, 10)) return false;
  }

  return true;
}

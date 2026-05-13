// src/gutefrage-smart-filters/filter-cache.js — Caching utilities
// Provides: hashString, getPostFingerprint

import { getPostTitle, getPostAuthor, getPostDateTime, getPostImagesStatus, getAnswerCount } from './filter-rules.js';

/**
 * Produces a short alphanumeric hash from a string (djb2 variant).
 * @param {string} str - Input string
 * @returns {string} 8-character hash
 */
export function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return (hash & 0x7FFFFFFF).toString(36).substring(0, 8);
}

/**
 * Produces a unique fingerprint string for a post element.
 * Used for caching filter results.
 * @param {Element} post - The post/DOM element
 * @returns {string}
 */
export function getPostFingerprint(post) {
  return hashString(getPostTitle(post)) + '|' + getPostAuthor(post) + '|' + getPostDateTime(post) + '|' + getPostImagesStatus(post) + '|' + getAnswerCount(post);
}

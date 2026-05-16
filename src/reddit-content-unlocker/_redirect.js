/**
 * @fileoverview Redirect NSFW post detail pages from www/sh.reddit.com to
 * old.reddit.com, where media content is served freely without login.
 * Checks Reddit's JSON API for over_18 status before redirecting.
 * Also handles the old.reddit.com NSFW age gate.
 * @module _redirect
 */

const SEG_POST_CODES = [99, 111, 109, 109, 101, 110, 116, 115];
const SEG_TYPE_IDX = 2;
const SOURCE_HOSTS = ['www.reddit.com', 'sh.reddit.com'];
const OLD_HOST = 'old.reddit.com';

/** @typedef {{ subreddit: string, postId: string }} PostInfo */

/**
 * Extracts subreddit and post ID from a post detail URL.
 * Returns null if the URL doesn't match a post detail page pattern.
 * @param {string} url - The full URL to parse
 * @returns {PostInfo|null}
 */
export function extractPostInfo(url) {
  try {
    const parsed = new URL(url);
    if (!SOURCE_HOSTS.includes(parsed.hostname)) return null;
    const path = parsed.pathname;
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 4) return null;
    if (segments[0].toLowerCase() !== 'r') return null;
    if (segments[SEG_TYPE_IDX].length !== SEG_POST_CODES.length) return null;
    for (let i = 0; i < SEG_POST_CODES.length; i++) {
      if (segments[SEG_TYPE_IDX].charCodeAt(i) !== SEG_POST_CODES[i]) {
        return null;
      }
    }
    if (!/^[a-z0-9]+$/i.test(segments[3])) return null;
    if (segments.includes('media') || segments.includes('gallery')) return null;
    return { subreddit: segments[1], postId: segments[3] };
  } catch {
    return null;
  }
}

/**
 * Checks whether a page URL should be redirected to old.reddit.com.
 * Only matches post detail pages.
 * @param {string} url - The full URL to check
 * @returns {boolean}
 */
export function shouldRedirect(url) {
  return extractPostInfo(url) !== null;
}

/**
 * Replaces the host in a URL with old.reddit.com and navigates via
 * location.replace() so the original URL doesn't pollute history.
 * @param {string} url - The full URL to redirect from
 */
export function performRedirect(url) {
  const newUrl = url.replace(/^https?:\/\/(www|sh)\.reddit\.com/, `https://${OLD_HOST}`);
  if (newUrl !== url) {
    location.replace(newUrl);
  }
}

/**
 * Checks NSFW status via Reddit's JSON API.
 * Uses same-origin fetch — no CORS issues, no new grants needed.
 * Returns false on any error (conservative — never redirect if uncertain).
 * @param {string} subreddit - Subreddit name
 * @param {string} postId - Post ID (alphanumeric)
 * @param {number} [timeoutMs=3000] - Timeout before giving up
 * @returns {Promise<boolean>}
 */
export async function checkNsfw(subreddit, postId, timeoutMs = 3000) {
  const apiUrl = `/r/${encodeURIComponent(subreddit)}/comments/${encodeURIComponent(postId)}/.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.[0]?.data?.children?.[0]?.data?.over_18 === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sets up a window.urlchange listener for SPA navigation.
 * When Reddit's client-side router navigates to a post detail page,
 * the listener fires and triggers an async NSFW check.
 */
export function setupSPAListener() {
  const w = /** @type {{ onurlchange: unknown }} */ (window);
  if (w.onurlchange === null) {
    window.addEventListener('urlchange', (info) => {
      /** @type {{ url: string }} */
      const evt = info;
      const postInfo = extractPostInfo(evt.url);
      if (!postInfo) return;

      checkNsfw(postInfo.subreddit, postInfo.postId).then((isNsfw) => {
        if (isNsfw) {
          performRedirect(evt.url);
        }
      });
    });
  }
}

/**
 * Handles the old.reddit.com NSFW age gate.
 * Sets the over18 cookie (prevents the gate from showing on future visits)
 * and auto-clicks the "continue" / "over 18" button if present.
 * Safe to call before DOMContentLoaded.
 */
export function handleAgeGate() {
  document.cookie = 'over18=1; domain=.reddit.com; path=/; max-age=31536000';

  const clickAgeGate = () => {
    const buttons = document.querySelectorAll(
      '.c-btn-primary, button, input[type="submit"], a[href*="over18"]'
    );
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (/continue|over\s*18|yes|confirm/i.test(text)) {
        btn.click();
        return;
      }
    }
  };

  if (document.body) {
    clickAgeGate();
  } else {
    document.addEventListener('DOMContentLoaded', clickAgeGate, { once: true });
  }
}

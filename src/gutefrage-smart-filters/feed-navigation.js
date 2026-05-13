// src/gutefrage-smart-filters/feed-navigation.js — Date-based feed navigation
// Provides: toSpringeZu, navigateToDate, resetNavigation

/**
 * Converts a datetime-local value to ISO format with local timezone offset.
 * @param {string} datetimeLocalValue - Value from an <input type="datetime-local">
 * @returns {string|null} ISO-formatted date string with timezone, or null
 */
export function toSpringeZu(datetimeLocalValue) {
  if (!datetimeLocalValue) return null;
  const d = new Date(datetimeLocalValue);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offset) % 60).padStart(2, '0');
  const local = datetimeLocalValue.length === 16 ? datetimeLocalValue + ':00' : datetimeLocalValue;
  return local + sign + hh + ':' + mm;
}

/**
 * Navigates to a Gutefrage feed section with the saved date parameter.
 * @param {string} section - Feed section: 'alle' or 'unbeantwortet'
 */
export async function navigateToDate(section) {
  const navDate = await GM.getValue('navDate', '');
  const tz = toSpringeZu(navDate);
  const base = section === 'unbeantwortet' ? '/home/meine/unbeantwortet' : '/home/meine/alle';
  const url = tz ? base + '?springe-zu=' + encodeURIComponent(tz) : base;
  window.location.href = url;
}

/**
 * Clears the saved feed navigation date.
 */
export async function resetNavigation() {
  await GM.setValue('navDate', '');
}

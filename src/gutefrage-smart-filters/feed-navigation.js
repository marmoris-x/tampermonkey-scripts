// src/gutefrage-smart-filters/feed-navigation.js — Date-based feed navigation
// Provides: toSpringeZu, navigateToDate, resetNavigation
// Exports via window.__GSF__

(function () {
  'use strict';

  /**
   * Converts a datetime-local value to ISO format with local timezone offset.
   * @param {string} datetimeLocalValue - Value from an <input type="datetime-local">
   * @returns {string|null} ISO-formatted date string with timezone, or null
   */
  function toSpringeZu(datetimeLocalValue) {
    if (!datetimeLocalValue) return null;
    var d = new Date(datetimeLocalValue);
    var offset = -d.getTimezoneOffset();
    var sign = offset >= 0 ? '+' : '-';
    var hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    var mm = String(Math.abs(offset) % 60).padStart(2, '0');
    var local = datetimeLocalValue.length === 16 ? datetimeLocalValue + ':00' : datetimeLocalValue;
    return local + sign + hh + ':' + mm;
  }

  /**
   * Navigates to a Gutefrage feed section with the saved date parameter.
   * @param {string} section - Feed section: 'alle' or 'unbeantwortet'
   */
  async function navigateToDate(section) {
    var navDate = await GM.getValue('navDate', '');
    var tz = toSpringeZu(navDate);
    var base = section === 'unbeantwortet' ? '/home/meine/unbeantwortet' : '/home/meine/alle';
    var url = tz ? base + '?springe-zu=' + encodeURIComponent(tz) : base;
    window.location.href = url;
  }

  /**
   * Clears the saved feed navigation date.
   */
  async function resetNavigation() {
    await GM.setValue('navDate', '');
  }

  window.__GSF__ = window.__GSF__ || {};
  window.__GSF__.toSpringeZu = toSpringeZu;
  window.__GSF__.navigateToDate = navigateToDate;
  window.__GSF__.resetNavigation = resetNavigation;
})();

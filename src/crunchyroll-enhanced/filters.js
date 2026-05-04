// src/crunchyroll-enhanced/filters.js — Filter evaluation and card sorting
// Provides: getFilters, passesFilter, compareCards, applySort
// Consumers: Crunchyroll Enhanced (entry orchestrator)

import { withData } from './scanner.js';

/**
 * Reads current filter state from the sidebar DOM.
 * @param {Function} $ - Selector helper bound to sidebar root (ctx._$)
 * @param {ShadowRoot} sidebarRoot - The sidebar's shadow root
 * @returns {object} Filter state object
 */
export function getFilters($, sidebarRoot) {
  function num(id) { var v = parseFloat($(id) ? $(id).value : ''); return isNaN(v) ? null : v; }
  function intVal(id) { var v = parseInt($(id) ? $(id).value : '', 10); return isNaN(v) ? null : v; }
  function str(id) { var el = $(id); return el ? el.value.trim().toLowerCase() : ''; }
  function chk(id) { var el = $(id); return el ? el.checked : false; }
  var wlEl = sidebarRoot.querySelector('input[name="cr-wl"]:checked');
  var wl = wlEl ? wlEl.value : 'all';
  return {
    title:      str('cr-f-title'),
    desc:       str('cr-f-desc'),
    ratingMin:  num('cr-f-r-min'),
    ratingMax:  num('cr-f-r-max'),
    votesMin:   intVal('cr-f-v-min'),
    epMin:      intVal('cr-f-ep-min'),
    epMax:      intVal('cr-f-ep-max'),
    seasonsMin: intVal('cr-f-se-min'),
    seasonsMax: intVal('cr-f-se-max'),
    subOnly:    chk('cr-f-sub'),
    dubOnly:    chk('cr-f-dub'),
    watchlist:  wl,
    dataOnly:   chk('cr-opt-data'),
    sort: ['cr-s-1', 'cr-s-2', 'cr-s-3']
      .map(function (id) { var el = $(id); return el ? el.value : ''; })
      .filter(Boolean)
  };
}

/**
 * Checks whether a card's info passes all active filters.
 * @param {object} info - Extracted card data
 * @param {object} f - Filter state object
 * @returns {boolean}
 */
export function passesFilter(info, f) {
  if (f.title && info.title.toLowerCase().indexOf(f.title) === -1) return false;
  if (f.desc  && info.description.toLowerCase().indexOf(f.desc) === -1) return false;
  if (f.ratingMin  !== null && info.rating   !== null && info.rating   < f.ratingMin)  return false;
  if (f.ratingMax  !== null && info.rating   !== null && info.rating   > f.ratingMax)  return false;
  if (f.votesMin   !== null && info.votes    !== null && info.votes    < f.votesMin)   return false;
  if (f.epMin      !== null && info.episodes !== null && info.episodes < f.epMin)      return false;
  if (f.epMax      !== null && info.episodes !== null && info.episodes > f.epMax)      return false;
  if (f.seasonsMin !== null && info.seasons  !== null && info.seasons  < f.seasonsMin) return false;
  if (f.seasonsMax !== null && info.seasons  !== null && info.seasons  > f.seasonsMax) return false;
  if (f.subOnly && !info.hasSub)                return false;
  if (f.dubOnly && !info.hasDub)                return false;
  if (f.watchlist === 'yes' && !info.onWatchlist) return false;
  if (f.watchlist === 'no'  &&  info.onWatchlist) return false;
  if (f.dataOnly && !info.hasData)                return false;
  return true;
}

/**
 * Compares two card info objects by a single criterion.
 * @param {object} a - First card info
 * @param {object} b - Second card info
 * @param {string} criterion - e.g. 'rating-desc', 'title-asc'
 * @returns {number} -1, 0, or 1
 */
export function compareCards(a, b, criterion) {
  var parts = criterion.split('-');
  var field = parts[0], dir = parts[1];
  var mult = dir === 'desc' ? -1 : 1;
  function numCmp(va, vb) {
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * mult;
  }
  switch (field) {
    case 'rating':   return numCmp(a.rating,   b.rating);
    case 'votes':    return numCmp(a.votes,    b.votes);
    case 'episodes': return numCmp(a.episodes, b.episodes);
    case 'seasons':  return numCmp(a.seasons,  b.seasons);
    case 'title':    return a.title.localeCompare(b.title) * mult;
    default:         return 0;
  }
}

/**
 * Applies filter + sort to card list and reorders DOM.
 * Visible cards get .cr-hidden removed; hidden cards get it added.
 * @param {object} ctx - Class instance with cards, origOrder, sidebar
 */
export function applyFilterAndSort(ctx) {
  if (ctx.cards.size === 0) return;
  ctx._observerPaused = true;

  var f = getFilters(ctx._$, ctx.sidebar.root);
  var container = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
  if (!container) return;

  var entries = Array.from(ctx.cards.entries());
  var all = entries.map(function (e) { return { card: e[0], info: e[1] }; });
  var visible = all.filter(function (item) { return passesFilter(item.info, f); });
  var hidden  = all.filter(function (item) { return !passesFilter(item.info, f); });

  // Sort visible cards
  if (f.sort.length > 0) {
    visible.sort(function (a, b) {
      for (var ci = 0; ci < f.sort.length; ci++) {
        var r = compareCards(a.info, b.info, f.sort[ci]);
        if (r !== 0) return r;
      }
      return a.info.index - b.info.index;
    });
  } else {
    visible.sort(function (a, b) { return a.info.index - b.info.index; });
  }

  visible.forEach(function (item) {
    item.card.classList.remove('cr-hidden');
    container.appendChild(item.card);
  });
  hidden.forEach(function (item) {
    item.card.classList.add('cr-hidden');
    container.appendChild(item.card);
  });

  ctx._updateStats(visible.length, ctx.cards.size, withData(ctx.cards));
  setTimeout(function () { ctx._observerPaused = false; }, 500);
}

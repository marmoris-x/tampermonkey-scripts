// src/crunchyroll-enhanced/filters.js — Filter evaluation and card sorting
// Provides: getFilters, passesFilter, compareCards, applyFilterAndSort
// Consumers: app.js (orchestrator), ui-panel.js (save/load filters)

'use strict';
import { withData } from './scanner.js';

/**
 * Reads current filter state from the sidebar DOM.
 * @param {Function} $ - Selector helper bound to sidebar shadow root
 * @param {ShadowRoot} sidebarRoot - The sidebar's shadow root
 * @returns {object} Filter state with title, ratingMin, subOnly, sort, etc.
 */
export function getFilters($, sidebarRoot) {
  const num = (id) => { const v = parseFloat($(id) ? $(id).value : ''); return isNaN(v) ? null : v; };
  const intVal = (id) => { const v = parseInt($(id) ? $(id).value : '', 10); return isNaN(v) ? null : v; };
  const str = (id) => { const el = $(id); return el ? el.value.trim().toLowerCase() : ''; };
  const chk = (id) => { const el = $(id); return el ? el.checked : false; };
  const wlEl = sidebarRoot.querySelector('input[name="cr-wl"]:checked');
  const wl = wlEl ? wlEl.value : 'all';
  const result = {
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
      .map((id) => { const el = $(id); return el ? el.value : ''; })
      .filter(Boolean)
  };
  return result;
}

/**
 * Checks whether a card's info passes all active filters.
 * @param {object} info - Extracted card data (title, rating, episodes, etc.)
 * @param {object} f - Filter state object
 * @returns {boolean} True if the card passes all filters
 */
export function passesFilter(info, f) {
  if (f.title && !info.title.toLowerCase().includes(f.title)) return false;
  if (f.desc  && !info.description.toLowerCase().includes(f.desc)) return false;
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
  const parts = criterion.split('-');
  const field = parts[0], dir = parts[1];
  const mult = dir === 'desc' ? -1 : 1;

  const numCmp = (va, vb) => {
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * mult;
  };

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
 * @param {object} ctx - Context with cards map, origOrder, sidebar root, _$, _observerPaused, _updateStats, log
 */
export function applyFilterAndSort(ctx) {
  try {
    if (ctx.cards.size === 0) return;
    ctx._observerPaused = true;

    const f = getFilters(ctx._$, ctx.sidebar.root);
  const card0 = ctx.origOrder[0];
  const container = card0 ? card0.parentElement : null;
  if (!container) return;

  const entries = [...ctx.cards.entries()];
  const all = entries.map((e) => ({ card: e[0], info: e[1] }));
  const visible = all.filter((item) => passesFilter(item.info, f));
  const hidden  = all.filter((item) => !passesFilter(item.info, f));

  // Sort visible cards
  if (f.sort.length > 0) {
    visible.sort((a, b) => {
      for (let ci = 0; ci < f.sort.length; ci++) {
        const r = compareCards(a.info, b.info, f.sort[ci]);
        if (r !== 0) return r;
      }
      return a.info.index - b.info.index;
    });
  } else {
    visible.sort((a, b) => a.info.index - b.info.index);
  }

  for (const item of visible) {
    item.card.classList.remove('cr-hidden');
    container.appendChild(item.card);
  }
  for (const item of hidden) {
    item.card.classList.add('cr-hidden');
    container.appendChild(item.card);
  }

  ctx._updateStats(visible.length, ctx.cards.size, withData(ctx.cards));
  setTimeout(() => { ctx._observerPaused = false; }, 500);
  } catch (err) {
    console.error('[Crunchyroll Enhanced] applyFilterAndSort error:', err);
  }
}

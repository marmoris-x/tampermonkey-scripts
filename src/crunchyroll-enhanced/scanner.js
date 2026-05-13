// src/crunchyroll-enhanced/scanner.js — Card scanning, data extraction, badges, and observer
// Provides: scanCards, extractInfo, triggerHover, retryNoData, addBadges, mkBadge, createSpinner,
//           updateBadgeVisibility, startObserver, ingestNewCards, withData, fmtNum
// Consumers: app.js (orchestrator), ui-panel.js (badge vis), exporter.js (fmtNum)

'use strict';

/**
 * Main scan loop — iterates all .browse-card elements, extracts data, adds badges.
 * @param {object} ctx - Context with cards, origOrder, showBadges, sidebar, _$, log, _status, _updateStats, _sleep, _apply
 */
export async function scanCards(ctx) {
  if (ctx.isScanning) return;
  ctx.isScanning = true;

  const btn = ctx._$('cr-btn-scan');
  btn.disabled = true;
  btn.textContent = '';
  btn.append(createSpinner(), document.createTextNode(' Scanning…'));
  ctx._status('Scanning cards…');
  ctx._$('cr-prog').style.display = 'block';

  ctx.cards.clear();
  ctx.origOrder.length = 0;

  const all = document.querySelectorAll('.browse-card');

  // Force hover panels visible via CSS
  const forceStyle = document.createElement('style');
  forceStyle.id = 'cr-force-hover';
  forceStyle.textContent = [
    '[class*="browse-card-hover"] {',
    'opacity: 1 !important; visibility: visible !important;',
    'display: block !important; transform: none !important;',
    'pointer-events: none !important;',
    '}'
  ].join('');
  document.head.appendChild(forceStyle);

  for (const card of all) {
    card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  }
  await ctx._sleep(600);

  for (let i = 0; i < all.length; i++) {
    try {
      const card = all[i];
      const info = extractInfo(card, i);
      ctx.cards.set(card, info);
      ctx.origOrder.push(card);

      if (ctx.showBadges) addBadges(card, info);
    } catch (err) {
      ctx.log.warn('Scan error on card', i, err);
    }

    ctx._$('cr-prog-fill').style.width =
      Math.round((i + 1) / all.length * 100) + '%';
    ctx._status('Scanned: ' + (i + 1) + ' / ' + all.length);
    if ((i + 1) % 30 === 0) await ctx._sleep(0);
  }

  const fh = document.getElementById('cr-force-hover');
  if (fh) fh.remove();
  ctx._$('cr-prog').style.display = 'none';

  // Retry pass for cards without data
  const noData = [...ctx.cards.entries()]
    .filter(function (e) { return !e[1].hasData; })
    .map(function (e) { return e[0]; });

  if (noData.length > 0) {
    retryNoData(ctx, noData);
  }

  const wd = withData(ctx.cards);
  ctx._status('✅ ' + all.length + ' scanned, ' + wd + ' with data');
  ctx._updateStats(all.length, all.length, wd);

  ctx.isScanning = false;
  btn.disabled = false;
  btn.textContent = '';
  btn.innerHTML = '<span>\u{1F504}</span> Scan';

  ctx._apply();
  startObserver(ctx);
}

/**
 * Extracts anime info from a single card element.
 * Falls back through multiple selectors for Crunchyroll UI resilience.
 * @param {Element} card - The .browse-card element
 * @param {number} index - Position in the original card order
 * @returns {object} Extracted card data with title, description, rating, votes, etc.
 */
export function extractInfo(card, index) {
  const titleEl =
    card.querySelector('h3[data-t="title"] a') ||
    card.querySelector('[class*="browse-card__title"] a') ||
    card.querySelector('[data-testid="card-title"] a') ||
    card.querySelector('a[class*="title"]') ||
    card.querySelector('a[href*="/series/"]');
  const title = titleEl ? titleEl.textContent.trim() : '';
  const link  = titleEl ? titleEl.href : '';
  const seriesId = link.match(/series\/([A-Z0-9]+)/)
    ? link.match(/series\/([A-Z0-9]+)/)[1]
    : '';

  const descEl =
    card.querySelector('p[data-t="description"]') ||
    card.querySelector('[class*="browse-card__description"]') ||
    card.querySelector('[data-testid="card-description"]') ||
    card.querySelector('[class*="description"]');
  const description = descEl ? descEl.textContent.trim() : '';

  const ratingEl =
    card.querySelector('p[class*="star-rating-short-static__rating"]') ||
    card.querySelector('[data-t="star-rating-short-static"] [class*="rating"]') ||
    card.querySelector('[class*="rating"][data-t]') ||
    card.querySelector('[class*="star-rating"] [class*="rating"]') ||
    card.querySelector('[class*="rating"]');
  const rating = ratingEl ? (parseFloat(ratingEl.textContent.trim()) || null) : null;

  const votesEl =
    card.querySelector('p[data-t="rating-count"]') ||
    card.querySelector('[class*="votes-count"]') ||
    card.querySelector('[class*="star-rating-short-static__votes"]') ||
    card.querySelector('[class*="rating-count"]');
  let votes = null;
  if (votesEl) {
    const m = votesEl.textContent.match(/([\d,.]+)\s*([kKmM]?)/);
    if (m) {
      let n = parseFloat(m[1].replace(',', '.'));
      const s = m[2].toLowerCase();
      if (s === 'k') n *= 1000;
      else if (s === 'm') n *= 1000000;
      votes = Math.round(n);
    }
  }

  const metaEl = card.querySelector('[class*="browse-card-hover__series-meta"]') ||
                 card.querySelector('[class*="series-meta"]');
  let seasons = null, episodes = null;
  if (metaEl) {
    for (const span of metaEl.querySelectorAll('span')) {
      const t = span.textContent.trim();
      const ep = t.match(/(\d+)\s*(?:Episode[ns]?|Folge[n]?)/i);
      const se = t.match(/(\d+)\s*(?:Staffel[n]?|Season[s]?)/i);
      if (ep) episodes = parseInt(ep[1], 10);
      if (se) seasons  = parseInt(se[1], 10);
    }
  }

  let hasSub = false, hasDub = false;
  for (const el of card.querySelectorAll('[class*="meta-tags"] span, [class*="meta-tag"] span')) {
    const t = el.textContent.toLowerCase();
    if (t.includes('untertitel') || t.includes('sub')) hasSub = true;
    if (t.includes('synchro') || t.includes('dub')) hasDub = true;
  }

  const onWatchlist = !!card.querySelector(
    '[class*="card-watchlist-label"], [class*="watchlist-label"]'
  );

  const hasData = rating !== null || votes !== null ||
                  episodes !== null || seasons !== null;

  return { title, description, link,
           seriesId, rating, votes,
           episodes, seasons,
           hasSub, hasDub, onWatchlist,
           hasData, index };
}

/**
 * Forces hover state on cards via CSS and mouseenter events.
 * @param {Element[]} cards - Array of card elements
 */
export function triggerHover(cards) {
  const style = document.createElement('style');
  style.id = 'cr-force-hover';
  style.textContent = [
    '[class*="browse-card-hover"] {',
    'opacity: 1 !important; visibility: visible !important;',
    'display: block !important; transform: none !important;',
    'pointer-events: none !important;',
    '}'
  ].join('');
  document.head.appendChild(style);
  for (const c of cards) {
    c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  }
}

/**
 * Retry pass for cards that failed to load data on first scan.
 * @param {object} ctx - Context with cards map, _$, log, _sleep, _status
 * @param {Element[]} noDataCards - Cards without extracted data
 */
export async function retryNoData(ctx, noDataCards) {
  ctx._status('Retry: ' + noDataCards.length + ' cards without data…');

  triggerHover(noDataCards);
  await ctx._sleep(1000);

  let improved = 0;
  for (const card of noDataCards) {
    try {
      const old = ctx.cards.get(card);
      if (!old) continue;
      const fresh = extractInfo(card, old.index);
      if (fresh.hasData) {
        ctx.cards.set(card, fresh);
        if (ctx.showBadges) addBadges(card, fresh);
        improved++;
      }
    } catch (err) {
      ctx.log.warn('Retry error on card', err);
    }
  }

  const fh = document.getElementById('cr-force-hover');
  if (fh) fh.remove();

  ctx._status('Retry: +' + improved + ' of ' + noDataCards.length + ' upgraded');
  ctx.log.log('Retry: ' + improved + '/' + noDataCards.length + ' cards now have data');
}

/**
 * Adds badge overlays to a card element.
 * @param {Element} card - Card element
 * @param {object} info - Extracted card data
 */
export function addBadges(card, info) {
  const existing = card.querySelector('.cr-overlay');
  if (existing) existing.remove();

  const anchor = card.querySelector('[class*="browse-card__poster"], [class*="content-image"]') || card;

  // Batch read: check if anchor needs relative positioning
  if (getComputedStyle(anchor).position === 'static') {
    anchor.style.position = 'relative';
  }

  const ov = document.createElement('div');
  ov.className = 'cr-overlay';

  if (info.rating   !== null) ov.appendChild(mkBadge('cr-b-rating',   '⭐ ' + info.rating.toFixed(1)));
  if (info.votes    !== null) ov.appendChild(mkBadge('cr-b-votes',    '👥 ' + fmtNum(info.votes)));
  if (info.seasons  !== null) ov.appendChild(mkBadge('cr-b-seasons',  '📦 ' + info.seasons + 'S'));
  if (info.episodes !== null) ov.appendChild(mkBadge('cr-b-episodes', '📺 ' + info.episodes + 'E'));
  if (info.hasSub)            ov.appendChild(mkBadge('cr-b-sub',  'SUB'));
  if (info.hasDub)            ov.appendChild(mkBadge('cr-b-dub',  'DUB'));
  if (info.onWatchlist)       ov.appendChild(mkBadge('cr-b-wl',   '📌'));

  anchor.appendChild(ov);
}

/**
 * Creates a single badge element.
 * @param {string} cls - CSS class
 * @param {string} text - Badge text
 * @returns {HTMLDivElement}
 */
export function mkBadge(cls, text) {
  const b = document.createElement('div');
  b.className = 'cr-badge ' + cls;
  b.textContent = text;
  return b;
}

/**
 * Creates a spinner element for loading states.
 * @returns {HTMLSpanElement}
 */
export function createSpinner() {
  const span = document.createElement('span');
  span.className = 'cr-spin';
  return span;
}

/**
 * Toggles badge visibility on all cards.
 * @param {boolean} show - Whether badges should be visible
 */
export function updateBadgeVisibility(show) {
  for (const el of document.querySelectorAll('.cr-overlay')) {
    el.style.display = show ? '' : 'none';
  }
}

/**
 * Starts a MutationObserver on the card container to detect new cards.
 * @param {object} ctx - Context with origOrder, cards, showBadges, _$, _observer, _observerPaused, _observerTimer, log
 */
export function startObserver(ctx) {
  const target = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
  if (!target) return;

  if (ctx._observer) {
    ctx._observer.disconnect();
    ctx._observer = null;
  }
  ctx._observerPaused = false;
  ctx._observerTimer = null;

  ctx._observer = new MutationObserver(function (mutations) {
    if (ctx._observerPaused || ctx.isScanning) return;

    const newCards = [];
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.parentElement !== target) continue;
        if (node.classList && node.classList.contains('browse-card') && !ctx.cards.has(node)) {
          newCards.push(node);
        }
        if (node.querySelectorAll) {
          for (const c of node.querySelectorAll('.browse-card')) {
            if (!ctx.cards.has(c)) newCards.push(c);
          }
        }
      }
    }

    if (newCards.length === 0) return;

    clearTimeout(ctx._observerTimer);
    ctx._observerTimer = setTimeout(function () {
      const ready = newCards.filter(function (c) {
        const t = c.querySelector('h3[data-t="title"] a, [class*="browse-card__title"] a');
        return t && t.textContent.trim() !== '';
      });
      if (ready.length > 0) ingestNewCards(ctx, ready);
    }, 400);
  });

  ctx._observer.observe(target, { childList: true, subtree: true });
}

/**
 * Processes newly detected cards from the observer.
 * @param {object} ctx - Context with cards, origOrder, showBadges, log, _sleep, _status, _updateStats, _apply
 * @param {Element[]} cards - New card elements
 */
export async function ingestNewCards(ctx, cards) {
  for (const c of cards) {
    c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  }
  await ctx._sleep(700);

  let added = 0;
  for (const card of cards) {
    try {
      if (ctx.cards.has(card)) continue;
      const info = extractInfo(card, ctx.origOrder.length);
      ctx.cards.set(card, info);
      ctx.origOrder.push(card);
      if (ctx.showBadges) addBadges(card, info);
      card.classList.add('cr-new-card');
      added++;
    } catch (err) {
      ctx.log.warn('ingestNewCards error', err);
    }
  }

  if (added > 0) {
    ctx._status('+' + added + ' new cards detected');
    let visCount = 0;
    for (const c of ctx.cards.keys()) {
      if (!c.classList.contains('cr-hidden')) visCount++;
    }
    ctx._updateStats(visCount, ctx.cards.size, withData(ctx.cards));
    ctx._apply();
  }
}

/**
 * Counts cards that have actual data.
 * @param {Map} cards - Cards map
 * @returns {number}
 */
export function withData(cards) {
  let count = 0;
  for (const info of cards.values()) {
    if (info.hasData) count++;
  }
  return count;
}

/**
 * Formats a number with K/M suffixes.
 * @param {number} n
 * @returns {string}
 */
export function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

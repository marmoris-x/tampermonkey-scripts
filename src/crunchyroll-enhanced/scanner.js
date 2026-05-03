// src/crunchyroll-enhanced/scanner.js — Card scanning, data extraction, badges, and observer
// Provides: scanCards, extractInfo, triggerHover, retryNoData, addBadges,
//           updateBadgeVisibility, startObserver, ingestNewCards
// Consumers: Crunchyroll Enhanced (entry orchestrator)
(function () {
  'use strict';

  var _CRE = globalThis.__CRE__ = globalThis.__CRE__ || {};

  /**
   * Main scan loop — iterates all .browse-card elements, extracts data, adds badges.
   * @param {object} ctx - Class instance with cards, origOrder, showBadges, sidebar, etc.
   */
  _CRE.scanCards = async function scanCards(ctx) {
    if (ctx.isScanning) return;
    ctx.isScanning = true;

    var btn = ctx._$('cr-btn-scan');
    btn.disabled = true;
    btn.innerHTML = '<span class="cr-spin"></span> Scannen…';
    ctx._status('Scanning cards…');
    ctx._$('cr-prog').style.display = 'block';

    ctx.cards.clear();
    ctx.origOrder = [];

    var all = Array.from(document.querySelectorAll('.browse-card'));

    // Force hover panels visible via CSS
    var forceStyle = document.createElement('style');
    forceStyle.id = 'cr-force-hover';
    forceStyle.textContent = [
      '[class*="browse-card-hover"] {',
      'opacity: 1 !important; visibility: visible !important;',
      'display: block !important; transform: none !important;',
      'pointer-events: none !important;',
      '}'
    ].join('');
    document.head.appendChild(forceStyle);
    all.forEach(function (c) { c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
    await ctx._sleep(600);

    for (var i = 0; i < all.length; i++) {
      var card = all[i];
      var info = _CRE.extractInfo(card, i);
      ctx.cards.set(card, info);
      ctx.origOrder.push(card);

      if (ctx.showBadges) _CRE.addBadges(card, info);

      ctx._$('cr-prog-fill').style.width =
        Math.round((i + 1) / all.length * 100) + '%';
      ctx._status('Scanned: ' + (i + 1) + ' / ' + all.length);
      if ((i + 1) % 30 === 0) await ctx._sleep(0);
    }

    var fh = document.getElementById('cr-force-hover');
    if (fh) fh.remove();
    ctx._$('cr-prog').style.display = 'none';

    // Retry pass for cards without data
    var noData = Array.from(ctx.cards.entries())
      .filter(function (e) { return !e[1].hasData; })
      .map(function (e) { return e[0]; });

    if (noData.length > 0) {
      _CRE.retryNoData(ctx, noData);
    }

    var wd = _CRE.withData(ctx.cards);
    ctx._status('✅ ' + all.length + ' scanned, ' + wd + ' with real data');
    ctx._updateStats(all.length, all.length, wd);

    ctx.isScanning = false;
    btn.disabled = false;
    btn.innerHTML = '<span>🔄</span> Scannen';

    ctx._apply();
    _CRE.startObserver(ctx);
  };

  /**
   * Extracts anime info from a single card element.
   * @param {Element} card - The .browse-card element
   * @param {number} index - Position in the original card order
   * @returns {object} Extracted card data
   */
  _CRE.extractInfo = function extractInfo(card, index) {
    var titleEl = card.querySelector('h3[data-t="title"] a') ||
                  card.querySelector('[class*="browse-card__title"] a');
    var title = titleEl ? titleEl.textContent.trim() : '';
    var link  = titleEl ? titleEl.href : '';
    var seriesId = link.match(/series\/([A-Z0-9]+)/) ? link.match(/series\/([A-Z0-9]+)/)[1] : '';

    var descEl = card.querySelector('p[data-t="description"]');
    var description = descEl ? descEl.textContent.trim() : '';

    var ratingEl = card.querySelector('p[class*="star-rating-short-static__rating"]') ||
                   card.querySelector('[data-t="star-rating-short-static"] [class*="rating"]');
    var rating = ratingEl ? (parseFloat(ratingEl.textContent.trim()) || null) : null;

    var votesEl = card.querySelector('p[data-t="rating-count"]') ||
                  card.querySelector('[class*="votes-count"]') ||
                  card.querySelector('[class*="star-rating-short-static__votes"]');
    var votes = null;
    if (votesEl) {
      var m = votesEl.textContent.match(/([\d,.]+)\s*([kKmM]?)/);
      if (m) {
        var n = parseFloat(m[1].replace(',', '.'));
        var s = m[2].toLowerCase();
        if (s === 'k') n *= 1000;
        else if (s === 'm') n *= 1000000;
        votes = Math.round(n);
      }
    }

    var metaEl = card.querySelector('[class*="browse-card-hover__series-meta"]');
    var seasons = null, episodes = null;
    if (metaEl) {
      metaEl.querySelectorAll('span').forEach(function (span) {
        var t = span.textContent.trim();
        var ep = t.match(/(\d+)\s*(?:Episode[ns]?|Folge[n]?)/i);
        var se = t.match(/(\d+)\s*(?:Staffel[n]?|Season[s]?)/i);
        if (ep) episodes = parseInt(ep[1], 10);
        if (se) seasons  = parseInt(se[1], 10);
      });
    }

    var hasSub = false, hasDub = false;
    card.querySelectorAll('[class*="meta-tags"] span, [class*="meta-tag"] span').forEach(function (el) {
      var t = el.textContent.toLowerCase();
      if (t.indexOf('untertitel') !== -1 || t.indexOf('sub') !== -1) hasSub = true;
      if (t.indexOf('synchro') !== -1    || t.indexOf('dub') !== -1) hasDub = true;
    });

    var onWatchlist = !!card.querySelector(
      '[class*="card-watchlist-label"], [class*="watchlist-label"]'
    );

    var hasData = rating !== null || votes !== null ||
                  episodes !== null || seasons !== null;

    return { title: title, description: description, link: link,
             seriesId: seriesId, rating: rating, votes: votes,
             episodes: episodes, seasons: seasons,
             hasSub: hasSub, hasDub: hasDub, onWatchlist: onWatchlist,
             hasData: hasData, index: index };
  };

  /**
   * Forces hover state on cards via CSS and mouseenter events.
   * @param {Element[]} cards - Array of card elements
   */
  _CRE.triggerHover = function triggerHover(cards) {
    var style = document.createElement('style');
    style.id = 'cr-force-hover';
    style.textContent = [
      '[class*="browse-card-hover"] {',
      'opacity: 1 !important; visibility: visible !important;',
      'display: block !important; transform: none !important;',
      'pointer-events: none !important;',
      '}'
    ].join('');
    document.head.appendChild(style);
    cards.forEach(function (c) { c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
  };

  /**
   * Retry pass for cards that failed to load data on first scan.
   * @param {object} ctx - Class instance
   * @param {Element[]} noDataCards - Cards without extracted data
   */
  _CRE.retryNoData = async function retryNoData(ctx, noDataCards) {
    ctx._status('Retry: ' + noDataCards.length + ' cards without data…');

    _CRE.triggerHover(noDataCards);
    await ctx._sleep(1000);

    var improved = 0;
    noDataCards.forEach(function (card) {
      var old = ctx.cards.get(card);
      var fresh = _CRE.extractInfo(card, old.index);
      if (fresh.hasData) {
        ctx.cards.set(card, fresh);
        if (ctx.showBadges) _CRE.addBadges(card, fresh);
        improved++;
      }
    });

    var fh = document.getElementById('cr-force-hover');
    if (fh) fh.remove();

    ctx._status('Retry: +' + improved + ' of ' + noDataCards.length + ' upgraded');
    ctx.log.log('Retry: ' + improved + '/' + noDataCards.length + ' cards now have data');
  };

  /**
   * Adds badge overlays to a card element.
   * @param {Element} card - Card element
   * @param {object} info - Extracted card data
   */
  _CRE.addBadges = function addBadges(card, info) {
    var existing = card.querySelector('.cr-overlay');
    if (existing) existing.remove();

    var anchor = card.querySelector('[class*="browse-card__poster"], [class*="content-image"]') || card;
    if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';

    var ov = document.createElement('div');
    ov.className = 'cr-overlay';

    if (info.rating   !== null) ov.appendChild(_CRE.mkBadge('cr-b-rating',   '⭐ ' + info.rating.toFixed(1)));
    if (info.votes    !== null) ov.appendChild(_CRE.mkBadge('cr-b-votes',    '👥 ' + _CRE.fmtNum(info.votes)));
    if (info.seasons  !== null) ov.appendChild(_CRE.mkBadge('cr-b-seasons',  '📦 ' + info.seasons + 'S'));
    if (info.episodes !== null) ov.appendChild(_CRE.mkBadge('cr-b-episodes', '📺 ' + info.episodes + 'E'));
    if (info.hasSub)            ov.appendChild(_CRE.mkBadge('cr-b-sub',  'SUB'));
    if (info.hasDub)            ov.appendChild(_CRE.mkBadge('cr-b-dub',  'DUB'));
    if (info.onWatchlist)       ov.appendChild(_CRE.mkBadge('cr-b-wl',   '📌'));

    anchor.appendChild(ov);
  };

  /**
   * Creates a single badge element.
   * @param {string} cls - CSS class
   * @param {string} text - Badge text
   * @returns {Element}
   */
  _CRE.mkBadge = function mkBadge(cls, text) {
    var b = document.createElement('div');
    b.className = 'cr-badge ' + cls;
    b.textContent = text;
    return b;
  };

  /**
   * Toggles badge visibility on all cards.
   * @param {boolean} show - Whether badges should be visible
   */
  _CRE.updateBadgeVisibility = function updateBadgeVisibility(show) {
    document.querySelectorAll('.cr-overlay').forEach(function (el) {
      el.style.display = show ? '' : 'none';
    });
  };

  /**
   * Starts a MutationObserver on the card container to detect new cards.
   * @param {object} ctx - Class instance
   */
  _CRE.startObserver = function startObserver(ctx) {
    var target = ctx.origOrder[0] ? ctx.origOrder[0].parentElement : null;
    if (!target) return;

    if (ctx._observer) {
      ctx._observer.disconnect();
      ctx._observer = null;
    }
    ctx._observerPaused = false;
    ctx._observerTimer = null;

    ctx._observer = new MutationObserver(function (mutations) {
      if (ctx._observerPaused || ctx.isScanning) return;

      var newCards = [];
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.parentElement !== target) return;
          if (node.classList && node.classList.contains('browse-card') && !ctx.cards.has(node)) {
            newCards.push(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('.browse-card').forEach(function (c) {
              if (!ctx.cards.has(c)) newCards.push(c);
            });
          }
        });
      });

      if (newCards.length === 0) return;

      clearTimeout(ctx._observerTimer);
      ctx._observerTimer = setTimeout(function () {
        var ready = newCards.filter(function (c) {
          var t = c.querySelector('h3[data-t="title"] a, [class*="browse-card__title"] a');
          return t && t.textContent.trim() !== '';
        });
        if (ready.length > 0) _CRE.ingestNewCards(ctx, ready);
      }, 400);
    });

    ctx._observer.observe(target, { childList: true, subtree: true });
  };

  /**
   * Processes newly detected cards from the observer.
   * @param {object} ctx - Class instance
   * @param {Element[]} cards - New card elements
   */
  _CRE.ingestNewCards = async function ingestNewCards(ctx, cards) {
    cards.forEach(function (c) { c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
    await ctx._sleep(700);

    var added = 0;
    cards.forEach(function (card) {
      if (ctx.cards.has(card)) return;
      var info = _CRE.extractInfo(card, ctx.origOrder.length);
      ctx.cards.set(card, info);
      ctx.origOrder.push(card);
      if (ctx.showBadges) _CRE.addBadges(card, info);
      card.classList.add('cr-new-card');
      added++;
    });

    if (added > 0) {
      ctx._status('+' + added + ' new cards detected');
      var visCount = Array.from(ctx.cards.keys())
        .filter(function (c) { return !c.classList.contains('cr-hidden'); }).length;
      ctx._updateStats(visCount, ctx.cards.size, _CRE.withData(ctx.cards));
      ctx._apply();
    }
  };

  /**
   * Counts cards that have actual data.
   * @param {Map} cards - Cards map
   * @returns {number}
   */
  _CRE.withData = function withData(cards) {
    return Array.from(cards.values()).filter(function (i) { return i.hasData; }).length;
  };

  /**
   * Formats a number with K/M suffixes.
   * @param {number} n
   * @returns {string}
   */
  _CRE.fmtNum = function fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
    return String(n);
  };
})();

// src/crunchyroll-enhanced/exporter.js — Clipboard export in multiple formats
// Provides: exportVisible, escCsv
// Consumers: Crunchyroll Enhanced (entry orchestrator)
(function () {
  'use strict';

  var _CRE = globalThis.__CRE__ = globalThis.__CRE__ || {};

  /**
   * Escapes a value for CSV: wraps in quotes, escapes inner quotes.
   * @param {*} v
   * @returns {string}
   */
  function escCsv(v) {
    return '"' + String(v || '').replace(/"/g, '""') + '"';
  }

  /**
   * Exports visible (non-hidden) cards to clipboard in the chosen format.
   * @param {object} ctx - Class instance with cards map and sidebar
   */
  _CRE.exportVisible = function exportVisible(ctx) {
    var fmt = ctx._$('cr-export-fmt').value;
    var btn = ctx._$('cr-btn-copy');
    var items = Array.from(ctx.cards.entries())
      .filter(function (e) { return !e[0].classList.contains('cr-hidden'); })
      .map(function (e) { return e[1]; });

    if (items.length === 0) {
      btn.textContent = '⚠ Keine Titel';
      setTimeout(function () { btn.innerHTML = '📋 Kopieren'; }, 1500);
      return;
    }

    var text = '';

    switch (fmt) {
      case 'numbered':
        text = items.map(function (info, i) { return (i + 1) + '. ' + info.title; }).join('\n');
        break;

      case 'bullets':
        text = items.map(function (info) { return '• ' + info.title; }).join('\n');
        break;

      case 'links':
        text = items.map(function (info) { return info.link || info.title; }).join('\n');
        break;

      case 'csv': {
        var header = ['Titel','Bewertung','Stimmen','Episoden','Staffeln','Sub','Dub','Watchlist','Link'];
        var rows = items.map(function (i) {
          return [
            escCsv(i.title), escCsv(i.rating !== null ? i.rating : ''), escCsv(i.votes !== null ? i.votes : ''),
            escCsv(i.episodes !== null ? i.episodes : ''), escCsv(i.seasons !== null ? i.seasons : ''),
            escCsv(i.hasSub ? 'Ja' : 'Nein'), escCsv(i.hasDub ? 'Ja' : 'Nein'),
            escCsv(i.onWatchlist ? 'Ja' : 'Nein'), escCsv(i.link)
          ].join(',');
        });
        text = [header.join(','), rows.join('\n')].join('\n');
        break;
      }

      case 'json':
        text = JSON.stringify(items.map(function (i) {
          return {
            title: i.title, rating: i.rating, votes: i.votes,
            episodes: i.episodes, seasons: i.seasons,
            sub: i.hasSub, dub: i.hasDub, onWatchlist: i.onWatchlist, link: i.link
          };
        }), null, 2);
        break;

      case 'markdown': {
        function row(cells) { return '| ' + cells.join(' | ') + ' |'; }
        var mdHeader = row(['#', 'Titel', '⭐', '👥', '📺 Ep.', '📦 St.', 'Sub', 'Dub']);
        var sep = row(['---', '---', '---', '---', '---', '---', '---', '---']);
        var mdRows = items.map(function (info, idx) {
          return row([
            String(idx + 1),
            info.title,
            info.rating !== null ? info.rating.toFixed(1) : '—',
            info.votes  !== null ? _CRE.fmtNum(info.votes) : '—',
            info.episodes !== null ? String(info.episodes) : '—',
            info.seasons  !== null ? String(info.seasons) : '—',
            info.hasSub ? '✓' : '',
            info.hasDub ? '✓' : ''
          ]);
        });
        text = [mdHeader, sep].concat(mdRows).join('\n');
        break;
      }
    }

    navigator.clipboard.writeText(text).then(function () {
      btn.classList.add('copied');
      btn.innerHTML = '✅ ' + items.length + ' kopiert';
      setTimeout(function () {
        btn.classList.remove('copied');
        btn.innerHTML = '📋 Kopieren';
      }, 1800);
    }).catch(function () {
      btn.textContent = '⚠ Fehler';
      setTimeout(function () { btn.innerHTML = '📋 Kopieren'; }, 1500);
    });
  };
})();

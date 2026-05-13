// src/crunchyroll-enhanced/exporter.js — Clipboard export in multiple formats
// Provides: exportVisible
// Consumers: app.js (orchestrator), ui-panel.js (copy button handler)

'use strict';
import { fmtNum } from './scanner.js';

/**
 * Escapes a value for CSV: wraps in quotes, escapes inner quotes.
 * @param {*} v - Value to escape
 * @returns {string} CSV-escaped string
 */
function escCsv(v) {
  const s = String(v ?? '');
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Exports visible (non-hidden) cards to clipboard in the chosen format.
 * @param {object} ctx - Context with cards map, _$ selector, log
 */
export function exportVisible(ctx) {
  const fmt = ctx._$('cr-export-fmt').value;
  const btn = ctx._$('cr-btn-copy');
  const items = [...ctx.cards.entries()]
    .filter((e) => !e[0].classList.contains('cr-hidden'))
    .map((e) => e[1]);

  if (items.length === 0) {
    btn.textContent = '⚠ No titles';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500);
    return;
  }

  let text = '';

  switch (fmt) {
    case 'numbered':
      text = items.map((info, i) => (i + 1) + '. ' + info.title).join('\n');
      break;

    case 'bullets':
      text = items.map((info) => '• ' + info.title).join('\n');
      break;

    case 'links':
      text = items.map((info) => info.link || info.title).join('\n');
      break;

    case 'csv': {
      const header = ['Titel','Bewertung','Stimmen','Episoden','Staffeln','Sub','Dub','Watchlist','Link'];
      const rows = items.map((i) => {
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
      text = JSON.stringify(items.map((i) => ({
        title: i.title, rating: i.rating, votes: i.votes,
        episodes: i.episodes, seasons: i.seasons,
        sub: i.hasSub, dub: i.hasDub, onWatchlist: i.onWatchlist, link: i.link
      })), null, 2);
      break;

    case 'markdown': {
      const row = (cells) => '| ' + cells.join(' | ') + ' |';
      const mdHeader = row(['#', 'Titel', '⭐', '👥', '📺 Ep.', '📦 St.', 'Sub', 'Dub']);
      const sep = row(['---', '---', '---', '---', '---', '---', '---', '---']);
      const mdRows = items.map((info, idx) => {
        return row([
          String(idx + 1),
          info.title,
          info.rating !== null ? info.rating.toFixed(1) : '—',
          info.votes  !== null ? fmtNum(info.votes) : '—',
          info.episodes !== null ? String(info.episodes) : '—',
          info.seasons  !== null ? String(info.seasons) : '—',
          info.hasSub ? '✓' : '',
          info.hasDub ? '✓' : ''
        ]);
      });
      text = [mdHeader, sep, ...mdRows].join('\n');
      break;
    }
  }

  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.textContent = '✅ ' + items.length + ' copied';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = '📋 Copy';
    }, 1800);
  }).catch(() => {
    btn.textContent = '⚠ Error';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500);
  });
}

'use strict';

import { computePriceStats, isValidScore } from './_ranker.js';

/**
 * Escapes pipe characters in a string for Markdown table cells.
 * @param {string} str - Input text
 * @returns {string} Escaped text
 */
function escapeTable(str) {
  return (str || '').replace(/\|/g, '\\|');
}

/**
 * Formats a date string to German locale.
 * @param {string} isoString - ISO 8601 timestamp
 * @returns {string} Formatted date
 */
function formatDate(isoString) {
  try {
    let d = new Date(isoString);
    return d.toLocaleDateString('de-DE', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

/**
 * Generates a Best-Practice Markdown export with summary table + detail sections.
 * @param {Array} deals - Array of deal objects
 * @param {number} pages - Total pages analyzed
 * @param {string} timestamp - ISO timestamp
 * @param {string} siteName - "WILLHABEN" or "KLEINANZEIGEN"
 * @returns {string} Markdown content
 */
export function generateMarkdown(deals, pages, timestamp, siteName) {
  let ts = timestamp || new Date().toISOString();
  let md = '# ' + siteName + ' — Top-Deals\n\n';
  md += '- **Gefunden:** ' + deals.length + ' Top-Deals\n';
  md += '- **Analysierte Seiten:** ' + pages + '\n';
  md += '- **Erstellt:** ' + formatDate(ts) + '\n\n';

  // Price statistics
  let stats = computePriceStats(deals);
  if (stats) {
    md += '### Preis-Statistik\n\n';
    md += '| Kennzahl | Wert |\n';
    md += '|----------|-----|\n';
    md += '| Minimal | ' + stats.min.toLocaleString('de-DE') + ' EUR |\n';
    md += '| Maximal | ' + stats.max.toLocaleString('de-DE') + ' EUR |\n';
    md += '| Median | ' + stats.median.toLocaleString('de-DE') + ' EUR |\n';
    md += '| Durchschnitt | ' + stats.mean.toLocaleString('de-DE') + ' EUR |\n\n';
  }

  // === Summary table ===
  md += '## Uebersicht\n\n';
  md += '| # | Titel | Preis | Score | Seite |\n';
  md += '|---|-------|-------|-------|------|\n';
  for (let i = 0; i < deals.length; i++) {
    let deal = deals[i];
    let rank = i + 1;
    let title = escapeTable(deal.title || 'Unbekannt');
    let price = escapeTable(deal.price || '-');
    let score = deal.score !== undefined && isValidScore(deal.score) ? deal.score + '/100' : '-';
    let page = deal.page || '-';
    md += '| ' + rank + ' | ' + title + ' | ' + price + ' | ' + score + ' | ' + page + ' |\n';
  }
  md += '\n';

  // === Detail sections ===
  md += '---\n\n## Details\n\n';
  for (let j = 0; j < deals.length; j++) {
    let d = deals[j];
    let r = j + 1;
    md += '### #' + r + ' — ' + (d.title || 'Unbekannt') + '\n\n';
    md += '- **Preis:** ' + (d.price || 'Unbekannt') + '\n';
    if (d.score !== undefined && isValidScore(d.score)) {
      md += '- **Score:** ' + d.score + '/100\n';
    }
    md += '- **Begruendung:** ' + (d.reasoning || 'Keine Begruendung') + '\n';
    md += '- **Seite:** ' + (d.page || '?') + '\n\n';
    if (d.description) {
      md += '**Beschreibung:**\n\n```\n' + d.description + '\n```\n\n';
    } else {
      md += '*Keine Beschreibung geladen.*\n\n';
    }
    md += '[Anzeige oeffnen](' + d.url + ')\n\n';
    if (j < deals.length - 1) {
      md += '---\n\n';
    }
  }
  return md;
}

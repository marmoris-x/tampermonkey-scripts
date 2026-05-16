// src/marketplace-deal-finder/_export.js — Export functions (Markdown, JSON, CSV)
'use strict';

import { loadResults } from './_storage.js';
import { generateMarkdown } from './_markdown.js';
import { createToast } from './_dom.js';

/**
 * Escapes a value for CSV: wraps in quotes, doubles inner quotes,
 * replaces newlines with spaces for Excel compatibility.
 * @param {*} val - Value to escape
 * @returns {string} Escaped CSV cell value
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  str = str.replace(/[\r\n]+/g, ' ');
  return '"' + str.replace(/"/g, '""') + '"';
}

/**
 * Copies results as Markdown to clipboard.
 * @param {string} prefix - Site prefix ("wh" or "ka")
 */
export async function exportMarkdown(prefix) {
  let results = await loadResults(prefix);
  if (!results) {
    createToast('Keine Results verfuegbar!', { type: 'error' });
    return;
  }

  let siteName = prefix === 'wh' ? 'WILLHABEN' : 'KLEINANZEIGEN';
  let md = generateMarkdown(results.deals, results.pages, results.timestamp, siteName);

  try {
    await navigator.clipboard.writeText(md);
    let btn = document.getElementById(prefix + '-export-markdown-btn');
    if (btn) {
      let orig = btn.textContent;
      btn.textContent = 'Kopiert!';
      setTimeout(function () { btn.textContent = orig; }, 2000);
    }
  } catch (error) {
    createToast('Fehler beim Kopieren. Bitte Fenster fokussieren und nochmal versuchen.', { type: 'error', duration: 5000 });
  }
}

/**
 * Downloads results as a structured JSON file.
 * Outer structure pretty-printed, each deal on one compact line.
 * @param {string} prefix - Site prefix
 */
export async function exportJSON(prefix) {
  let results = await loadResults(prefix);
  if (!results) {
    createToast('Keine Results verfuegbar!', { type: 'error' });
    return;
  }

  let siteName = prefix === 'wh' ? 'WILLHABEN' : 'KLEINANZEIGEN';
  let deals = results.deals || [];

  // Build: pretty-printed outer, compact per-deal lines
  let metaJson = JSON.stringify({
    site: siteName,
    totalDeals: deals.length,
    pages: results.pages || 0,
    timestamp: results.timestamp || new Date().toISOString()
  });

  let jsonOut = '{\n  "metadata": ' + metaJson + ',\n  "deals": [\n';
  for (let i = 0; i < deals.length; i++) {
    jsonOut += '    ' + JSON.stringify(deals[i]);
    if (i < deals.length - 1) jsonOut += ',\n';
    else jsonOut += '\n';
  }
  jsonOut += '  ]\n}\n';

  let blob = new Blob([jsonOut], { type: 'application/json' });
  let url = URL.createObjectURL(blob);
  let a = GM_addElement('a', { href: url, download: 'deals-' + Date.now() + '.json' });
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

/**
 * Downloads results as a CSV file optimized for German Excel.
 * Uses ; as delimiter, UTF-8 BOM, \r\n line endings.
 * @param {string} prefix - Site prefix
 */
export async function exportCSV(prefix) {
  let results = await loadResults(prefix);
  if (!results) {
    createToast('Keine Results verfuegbar!', { type: 'error' });
    return;
  }

  let deals = results.deals || [];
  let header = ['Rang', 'Titel', 'Preis', 'Score', 'Begruendung', 'Seite', 'Beschreibung', 'URL'];

  let rows = deals.map(function (d, i) {
    return [
      i + 1,
      escapeCsv(d.title),
      escapeCsv(d.price),
      d.score !== undefined && Number.isFinite(Number(d.score)) ? d.score : '',
      escapeCsv(d.reasoning || d.reason),
      d.page || '',
      escapeCsv(d.description),
      escapeCsv(d.url)
    ].join(';');
  });

  let csv = '﻿' + header.join(';') + '\r\n' + rows.join('\r\n');
  let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  let url = URL.createObjectURL(blob);
  let a = GM_addElement('a', { href: url, download: 'deals-' + Date.now() + '.csv' });
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

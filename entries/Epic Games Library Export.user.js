// ==UserScript==
// @name         Epic Games Library Export
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      8.0.1
// @description  One-click game library export — clipboard (titles) or ZIP (enriched with prices, order IDs, play time)
// @author       marmoris-x
// @match        https://accounts.epicgames.com/account/transactions*
// @match        https://www.epicgames.com/account/transactions*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=epicgames.com
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/jszip@3.9.1/dist/jszip.min.js#sha256-aSPPIlJfSHQ5T7wunbPcp7tM0rlq5dHoUGeN8O5odMg=
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Epic%20Games%20Library%20Export.user.js
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Epic%20Games%20Library%20Export.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @run-at       document-idle
// @sandbox      JavaScript
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ═══ Configuration ═══════════════════════════════════════════════════

  const IGNORE_LIST = ['Standard Edition', 'Add-On', 'Season Pass', 'Saisonpass', 'Demo', 'Free', 'Kostenlos'];

  let isRunning = false;

  // ═══ Logger ═════════════════════════════════════════════════════════

  const log = (...args) => console.log('[Epic Games Library Export]', ...args);

  // ═══ Self-Destructing Mini Overlay ═══════════════════════════════════

  function createFloater() {
    const el = document.createElement('div');
    el.textContent = 'Scanning...';
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647',
      background: 'linear-gradient(135deg, #7c5cfc, #6050dc)',
      color: '#fff',
      padding: '10px 18px',
      borderRadius: '8px',
      font: '600 13px/1.4 system-ui, -apple-system, sans-serif',
      letterSpacing: '0.02em',
      boxShadow: '0 4px 16px rgba(124, 92, 252, 0.35)',
      opacity: '0',
      transform: 'translateY(10px)',
      transition: 'opacity 250ms ease, transform 250ms ease',
      pointerEvents: 'none',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    return {
      update: (text) => { el.textContent = text; },
      done: (text) => {
        el.textContent = text;
        el.style.background = 'linear-gradient(135deg, #26d98b, #1aad6b)';
        el.style.boxShadow = '0 4px 16px rgba(38, 217, 139, 0.35)';
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(10px)';
          setTimeout(() => el.remove(), 300);
        }, 2500);
      },
      error: (text) => {
        el.textContent = text;
        el.style.background = 'linear-gradient(135deg, #ff4d6a, #d63447)';
        el.style.boxShadow = '0 4px 16px rgba(255, 77, 106, 0.35)';
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(10px)';
          setTimeout(() => el.remove(), 300);
        }, 3000);
      },
    };
  }

  // ═══ Enriched Scraping Engine (für ZIP) ═════════════════════════════

  // DOM-basierte Expansion entfernt — verwendet jetzt API (ajaxGetOrderHistory)

  // ═══ Export Helpers ═════════════════════════════════════════════════

  function makeCsv(games) {
    const BOM = '﻿';
    let csv = 'Number;Title;Price;Currency;Order_ID;Acquired_Date;Marketplace;Quantity;Namespace;Total_Paid_Cents;Is_Promotion;Savings_Price;Discount_Pct;Tax_Cents;Gift_Recipient\n';
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      csv += `${i + 1};${csvEsc(g.title)};${csvEsc(g.price)};${csvEsc(g.currency)};${csvEsc(g.orderId)};${csvEsc(g.acquiredDate)};${csvEsc(g.marketplace)};${g.quantity};${csvEsc(g.namespace)};${g.totalPaidCents};${g.isPromotion};${String(g.savingsPrice).replace('.', ',')};${String(g.discountPct).replace('.', ',')};${g.taxCents};${csvEsc(g.giftRecipient)}\n`;
    }
    return BOM + csv;
  }

  function csvEsc(str) {
    const s = String(str || '');
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function makeJson(games) {
    const now = new Date();
    return JSON.stringify({
      export_metadata: {
        script: 'Epic Games Library Export',
        version: '8.0.0',
        exported_at: now.toISOString(),
        source_url: 'https://www.epicgames.com/account/transactions',
        game_count: games.length,
      },
      games: games.map((g, i) => ({
        number: i + 1,
        title: g.title || '',
        price: g.price || '',
        currency: g.currency || '',
        order_id: g.orderId || '',
        acquired_date: g.acquiredDate || '',
        marketplace: g.marketplace || '',
        quantity: g.quantity,
        namespace: g.namespace || '',
        total_paid_cents: g.totalPaidCents,
        is_promotion: g.isPromotion,
        savings_price: g.savingsPrice,
        discount_pct: g.discountPct,
        tax_cents: g.taxCents,
        gift_recipient: g.giftRecipient || '',
      })),
    }, null, 2);
  }

  function downloadFile(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  }

  // ═══ API-based Fetch Engine (schnell — kein DOM-Klicken) ════════════

  const API_BASE = 'https://www.epicgames.com/account/v2/payment';

  function apiFetch(url) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url,
        onload: resolve,
        onerror: reject,
        ontimeout: () => reject(new Error('API timeout')),
        timeout: 15000,
      });
    });
  }

  async function fetchAllOrdersApi(floater) {
    const games = [];
    let pageToken = '';
    let pageNum = 1;

    while (true) {
      const params = new URLSearchParams({ sortDir: 'DESC', sortBy: 'DATE', locale: navigator.language || 'en-US' });
      if (pageToken) params.set('nextPageToken', pageToken);

      floater.update(`API page ${pageNum}...`);

      let data;
      try {
        const res = await apiFetch(`${API_BASE}/ajaxGetOrderHistory?${params}`);
        data = JSON.parse(res.responseText);
      } catch (err) {
        floater.error(`API failed: ${err.message || 'unknown'}`);
        throw err;
      }

      for (const order of data.orders || []) {
        for (const item of order.items || []) {
          const title = item.description || '';
          if (title && !IGNORE_LIST.some((bad) => title.includes(bad))) {
            // amount is in cents (e.g. 1799 = 17,99 €)
            const cents = typeof item.amount === 'number' ? item.amount : 0;
            const priceNum = cents > 0 ? cents / 100 : (order.total?.amount > 0 ? order.total.amount / 100 : 0);
            const priceFormatted = String(priceNum).replace('.', ',');

            const promo = order.promotions?.[0];
            const discountPct = promo && cents > 0
              ? Math.round((Number(promo.amount) / cents) * 1000) / 10
              : 0;

            games.push({
              orderId: order.orderId || '',
              title,
              price: priceFormatted,
              currency: item.currency || order.total?.currency || '',
              acquiredDate: order.createdAtMillis
                ? new Date(order.createdAtMillis).toISOString().slice(0, 10)
                : '',
              marketplace: order.marketplaceName || '',
              quantity: item.quantity || 1,
              namespace: item.namespace || '',
              totalPaidCents: order.total?.amount ?? cents,
              isPromotion: !!promo,
              savingsPrice: promo ? (promo.amount || 0) / 100 : 0,
              discountPct,
              taxCents: order.tax?.amount ?? 0,
              giftRecipient: item.giftRecipient || '',
            });
          }
        }
      }

      floater.update(`API page ${pageNum} — ${games.length} games`);

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
      pageNum++;
    }

    games.sort((a, b) => a.title.localeCompare(b.title));
    return games;
  }

  // ═══ Export Commands ════════════════════════════════════════════════

  async function exportToClipboard() {
    if (isRunning) return;
    isRunning = true;
    const floater = createFloater();

    try {
      const games = await fetchAllOrdersApi(floater);
      if (games.length === 0) {
        floater.error('No games found');
        isRunning = false;
        return;
      }

      const text = games.map((g, i) => `${i + 1}. ${g.title}`).join('\n');
      await GM.setClipboard(text);
      const msg = `${games.length} games copied to clipboard`;
      floater.done(msg);
      GM.notification({ title: 'Epic Library Export', text: msg, timeout: 3000 });
      log(`Clipboard export: ${games.length} games`);
    } catch (err) {
      floater.error(`Error: ${err.message || 'unknown'}`);
      log(`Clipboard export failed: ${err}`);
    }

    isRunning = false;
  }

  async function exportAsZipApi() {
    if (isRunning) return;
    isRunning = true;
    const floater = createFloater();

    try {
      const games = await fetchAllOrdersApi(floater);
      if (games.length === 0) {
        floater.error('No games found via API');
        isRunning = false;
        return;
      }

      const JSZip = /** @type {*} */ (window.JSZip);
      const zip = new JSZip();

      const text = games.map((g, i) => `${i + 1}. ${g.title}`).join('\n');
      zip.file('games.txt', text);
      zip.file('games.csv', makeCsv(games));
      zip.file('games.json', makeJson(games));

      floater.update(`Zipping ${games.length} games...`);
      const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
        if (meta.percent !== undefined) {
          const pct = Math.round(meta.percent);
          if (pct % 10 === 0) floater.update(`Zipping... ${pct}%`);
        }
      });

      const date = new Date().toISOString().slice(0, 10);
      downloadFile(blob, `EpicGames_Library_${date}.zip`, 'application/zip');

      const msg = `${games.length} games exported via API`;
      floater.done(msg);
      GM.notification({ title: 'Epic Library Export', text: msg, timeout: 3000 });
      log(`API export: ${games.length} games`);
    } catch (err) {
      floater.error(`API error: ${err.message || 'unknown'}`);
      log(`API export failed: ${err}`);
    }

    isRunning = false;
  }

  // ═══ Bootstrap ══════════════════════════════════════════════════════

  GM.registerMenuCommand('Export Epic Library to Clipboard', exportToClipboard);
  GM.registerMenuCommand('Export Epic Library as ZIP', exportAsZipApi);
  log('Ready — menu commands registered');
})();

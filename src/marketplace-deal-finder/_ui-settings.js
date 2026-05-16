// src/marketplace-deal-finder/_ui-settings.js — Settings/results view HTML
'use strict';

import { esc } from './_dom.js';
import { MODEL_PRESETS, PROVIDER_TYPES } from './_constants.js';

/* ─── Settings View ─── */

/**
 * Renders the settings panel HTML with multi-provider support.
 * @param {string} prefix - Site prefix ("wh" or "ka") for DOM IDs
 * @param {Object} settings - Current settings object (v2 schema)
 * @param {Object|null} savedResults - Previously saved results (or null)
 * @param {string} siteName - "WILLHABEN" or "KLEINANZEIGEN"
 * @returns {string} HTML content
 */
export function renderSettingsView(prefix, settings, savedResults, siteName) {
  const provider = settings.provider || {};
  const providerType = provider.type || PROVIDER_TYPES.GEMINI;

  // Auto-detect search context from URL if not set
  let autoContext = settings.searchContext || '';
  if (!autoContext) {
    const urlParams = new URLSearchParams(window.location.search);
    const keyword = urlParams.get('keyword');
    if (keyword) {
      autoContext = keyword;
    } else if (siteName === 'KLEINANZEIGEN') {
      const pathMatch = window.location.pathname.match(/\/s-([^/]+)/);
      if (pathMatch) autoContext = decodeURIComponent(pathMatch[1].replace(/-/g, ' '));
    }
  }

  // Format saved results timestamp
  let savedTs = '';
  if (savedResults && savedResults.timestamp) {
    const ts = savedResults.timestamp;
    savedTs = ts.indexOf('T') !== -1 ? new Date(ts).toLocaleString('de-DE') : ts;
  }

  // Build provider options
  const providerOptions = Object.values(PROVIDER_TYPES).map(function (type) {
    const labels = {
      gemini: 'Google Gemini',
      openai: 'OpenAI',
      deepseek: 'DeepSeek',
      claude: 'Anthropic Claude',
      openrouter: 'OpenRouter',
      portkey: 'Portkey'
    };
    const selected = type === providerType ? ' selected' : '';
    return '<option value="' + type + '"' + selected + '>' + (labels[type] || type) + '</option>';
  }).join('\n');

  // Build model preset buttons for current provider
  const presets = MODEL_PRESETS[providerType] || [];
  const presetButtons = presets.map(function (preset) {
    const active = preset.id === provider.modelId ? ' background:#6366f1; color:#fff; border-color:#6366f1;' : '';
    const optionsJson = preset.options ? esc(JSON.stringify(preset.options)) : '';
    return '<button data-model-id="' + esc(preset.id) + '" data-options="' + optionsJson + '" class="' + prefix + '-model-preset" style="padding:4px 8px;font-size:11px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#f8f9fa;color:#333;' + active + '">' +
      esc(preset.icon) + ' ' + esc(preset.label) + '</button>';
  }).join('');

  return [
    '<div id="' + prefix + '-settings-view" style="padding: 25px;">',
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">',
    '<h2 style="margin: 0; color: #333; font-size: 20px;">Deal Finder</h2>',
    '<button id="' + prefix + '-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">x</button>',
    '</div>',

    // Saved results banner
    (savedResults
      ? '<div style="background: #e8f5e9; padding: 12px; border-radius: 4px; margin-bottom: 18px; border-left: 3px solid #4caf50;">' +
        '<div style="font-size: 13px; color: #2e7d32; font-weight: 600; margin-bottom: 6px;">' +
        savedResults.deals.length + ' gespeicherte Deals</div>' +
        '<div style="font-size: 11px; color: #558b2f;">Analysierte Seiten: ' + savedResults.pages + ' | ' + savedTs + '</div>' +
        '<button id="' + prefix + '-show-results-btn" style="width:100%;margin-top:8px;padding:8px;background:#4caf50;color:white;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">Ergebnisse anzeigen</button>' +
        '</div>'
      : ''),

    // Provider selector
    '<div style="margin-bottom: 16px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Provider</label>',
    '<select id="' + prefix + '-provider-select" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;background:white;">',
    providerOptions,
    '</select>',
    '</div>',

    // Provider API Key
    '<div style="margin-bottom: 16px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Provider API Key</label>',
    '<input type="password" id="' + prefix + '-api-key" placeholder="API Key..." value="' + esc(provider.apiKey) + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
    '</div>',

    // Portkey Config (only for Portkey provider)
    (providerType === PROVIDER_TYPES.PORTKEY
      ? '<div id="' + prefix + '-portkey-config-container" style="margin-bottom: 16px;">' +
        '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Portkey Config</label>' +
        '<input type="text" id="' + prefix + '-portkey-config" placeholder="z.B. pc-gemini-6910ed" value="' + esc((provider.options && provider.options.config) || '') + '"' +
        ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;font-family:monospace;">' +
        '<small style="color:#888;font-size:11px;">Config-ID aus dem Portkey-Dashboard (pc-...)</small>' +
        '</div>'
      : ''),

    // Model ID
    '<div style="margin-bottom: 16px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Model ID</label>',
    '<input type="text" id="' + prefix + '-model-id" placeholder="z.B. gemini-2.5-flash" value="' + esc(provider.modelId) + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;font-family:monospace;">',
    (presetButtons ? '<div id="' + prefix + '-model-presets" style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">' + presetButtons + '</div>' : ''),
    '</div>',

    // Base URL (optional)
    '<div style="margin-bottom: 16px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Base URL (optional)</label>',
    '<input type="text" id="' + prefix + '-base-url" placeholder="https://api.openai.com/v1" value="' + esc(provider.baseUrl || '') + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;font-family:monospace;">',
    '</div>',

    // Search Context
    '<div style="margin-bottom: 16px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Suchkontext</label>',
    '<textarea id="' + prefix + '-search-context" placeholder="z.B. Gaming PC RTX 3060, Neupreis 800-1000 EUR"',
    ' style="width:100%;height:70px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit;">' + esc(autoContext) + '</textarea>',
    '</div>',

    // AI Picks per page
    '<div style="margin-bottom: 16px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">AI-Picks pro Seite</label>',
    '<input type="number" id="' + prefix + '-top-x" min="1" max="10" value="' + (settings.topX ?? 3) + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
    '<small style="color:#888;font-size:11px;">Anzahl der besten Deals, die die AI pro Seite auswaehlt (1-10)</small>',
    '</div>',

    // Max Pages
    '<div style="margin-bottom: 16px;">',
    '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Max. Seiten</label>',
    '<input type="number" id="' + prefix + '-max-pages" min="1" max="100" value="' + (settings.maxPages || 10) + '"',
    ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
    '</div>',

    // Progress container
    '<div id="' + prefix + '-progress-container" style="display:none;margin-bottom:18px;padding:12px;background:#f8f9fa;border-radius:4px;border-left:3px solid #667eea;">',
    '<div id="' + prefix + '-progress-text" style="font-weight:600;color:#333;margin-bottom:8px;font-size:12px;">Bereit...</div>',
    '<div style="background:#e0e0e0;border-radius:4px;height:6px;overflow:hidden;">',
    '<div id="' + prefix + '-progress-bar" style="background:#667eea;height:100%;width:0%;transition:width 0.3s;"></div>',
    '</div></div>',

    // Live ranking
    '<div id="' + prefix + '-live-ranking" style="display:none;margin-bottom:18px;padding:12px;background:#fff8e1;border-radius:4px;border-left:3px solid #ffc107;">',
    '<h3 style="margin:0 0 10px 0;font-size:14px;color:#333;">Live Top-Deals</h3>',
    '<div id="' + prefix + '-live-ranking-content" style="font-size:12px;color:#555;"></div>',
    '</div>',

    // Action buttons
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">',
    '<button id="' + prefix + '-start-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#28a745;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">Start</button>',
    '<button id="' + prefix + '-pause-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#ffc107;color:#333;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">Pause</button>',
    '<button id="' + prefix + '-stop-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">Stopp</button>',
    '</div></div>'
  ].join('\n');
}

/* ─── Results View ─── */

/**
 * Renders the results view HTML with deal cards.
 * @param {string} prefix - Site prefix for DOM IDs
 * @param {Array} deals - Array of deal objects to display
 * @returns {string} HTML content
 */
export function renderResultsView(prefix, deals) {
  const items = deals.map(function (deal, index) {
    const safeUrl = (deal.url && deal.url.startsWith('https://')) ? deal.url : '#';
    const safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
    const scoreBar = safeScore !== null
      ? '<div style="margin-bottom:6px;"><div style="font-size:10px;color:#888;margin-bottom:2px;">Score: ' + safeScore + '/100</div>' +
        '<div style="background:#e0e0e0;border-radius:4px;height:4px;overflow:hidden;">' +
        '<div style="background:' + (safeScore >= 70 ? '#28a745' : safeScore >= 40 ? '#ffc107' : '#dc3545') + ';height:100%;width:' + safeScore + '%;"></div>' +
        '</div></div>'
      : '';

    const medal = index === 0 ? '#1' : index === 1 ? '#2' : index === 2 ? '#3' : '#' + (index + 1);
    const borderColor = index === 0 ? '#ffc107' : index === 1 ? '#28a745' : index === 2 ? '#17a2b8' : '#6c757d';
    const bgColor = index === 0 ? '#fff8e1' : '#f8f9fa';

    return [
      '<div style="padding:15px;background:' + bgColor + ';border-radius:4px;margin-bottom:12px;border-left:3px solid ' + borderColor + ';">',
      '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">',
      '<div style="font-weight:700;color:#333;font-size:14px;">' + medal + ' ' + esc(deal.title) + '</div>',
      '<div style="font-size:11px;color:#888;white-space:nowrap;margin-left:8px;">S.' + deal.page + '</div>',
      '</div>',
      '<div style="font-weight:600;color:#28a745;font-size:15px;margin-bottom:8px;">' + esc(deal.price) + '</div>',
      scoreBar,
      '<div style="font-size:11px;color:#666;margin-bottom:8px;font-style:italic;">' + esc(deal.reasoning || 'Keine Begruendung verfuegbar') + '</div>',
      (deal.description
        ? '<div style="font-size:11px;color:#555;line-height:1.4;margin-bottom:8px;max-height:60px;overflow:hidden;">' +
          esc(deal.description.substring(0, 150)) +
          (deal.description.length > 150 ? '...' : '') + '</div>'
        : ''),
      '<a href="' + esc(safeUrl) + '" target="_blank" style="font-size:11px;color:#667eea;text-decoration:none;">Anzeige oeffnen</a>',
      '</div>'
    ].join('\n');
  }).join('\n');

  return [
    '<div id="' + prefix + '-results-view" style="padding: 25px;">',
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">',
    '<h2 style="margin:0;color:#333;font-size:20px;">Top-Deals</h2>',
    '<button id="' + prefix + '-close-btn-x" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;padding:0;line-height:1;">x</button>',
    '</div>',

    '<div style="background:#667eea;color:white;padding:12px;border-radius:4px;margin-bottom:20px;text-align:center;">',
    '<div style="font-size:24px;font-weight:700;margin-bottom:4px;">' + deals.length + '</div>',
    '<div style="font-size:12px;">Top-Deals gefunden</div>',
    '</div>',

    '<div style="margin-bottom:15px;">' + items + '</div>',

    '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">',
    '<button id="' + prefix + '-export-markdown-btn" style="flex:1;padding:10px 12px;background:#28a745;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">Markdown</button>',
    '<button id="' + prefix + '-export-json-btn" style="flex:1;padding:10px 12px;background:#17a2b8;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">JSON</button>',
    '<button id="' + prefix + '-export-csv-btn" style="flex:1;padding:10px 12px;background:#6f42c1;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">CSV</button>',
    '<button id="' + prefix + '-clear-results-btn" style="padding:10px 12px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">Loeschen</button>',
    '</div>',

    '<button id="' + prefix + '-back-to-settings" style="width:100%;padding:10px 16px;background:#6c757d;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">Zurueck zu Einstellungen</button>',
    '</div>'
  ].join('\n');
}

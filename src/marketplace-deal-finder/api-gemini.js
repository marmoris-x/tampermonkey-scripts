// src/marketplace-deal-finder/api-gemini.js — Gemini AI integration
// Provides Gemini API calling, price statistics, and model selection UI.
// Consumers: Marketplace Deal Finder entry file, ranking-engine
(function () {
  'use strict';

  /* ─── Model Definitions ─── */

  var GEMINI_MODELS = {
    flash: {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      icon: '⚡', label: 'Flash', desc: 'Schnell & effizient'
    },
    pro: {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      icon: '🧠', label: 'Pro', desc: 'Maximum Intelligenz'
    },
    nano: {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini Flash Lite',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
      icon: '💡', label: 'Lite', desc: 'Sparsam & schnell'
    }
  };

  var MODEL = {
    FLASH: 'flash',
    PRO: 'pro',
    NANO: 'nano'
  };

  /* ─── Price Statistics ─── */

  /**
   * Computes price statistics (min, max, mean, median, count) from ad data.
   * @param {Array} adsData - Array of ad objects with .price strings
   * @returns {{ min: number, max: number, mean: number, median: number, count: number }|null}
   */
  function computePriceStats(adsData) {
    var prices = [];
    for (var ai = 0; ai < adsData.length; ai++) {
      var ad = adsData[ai];
      var match = (ad.price || '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
        .match(/(\d+(?:\.\d+)?)/);
      if (match) {
        var p = parseFloat(match[1]);
        if (p > 0) prices.push(p);
      }
    }
    if (prices.length === 0) return null;
    var sorted = prices.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    var median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    var sum = 0;
    for (var si = 0; si < prices.length; si++) sum += prices[si];
    var mean = sum / prices.length;
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(mean),
      median: Math.round(median),
      count: prices.length
    };
  }

  /* ─── Gemini API Call ─── */

  /**
   * Calls the Gemini API to analyze deals and return top picks.
   * Handles rate limiting with exponential backoff, JSON response parsing,
   * and multiple retry strategies.
   *
   * @param {Array} adsData - Array of ad objects with title, price, description, url
   * @param {string} searchContext - User's search context/description
   * @param {number} topX - Number of top deals to request
   * @param {string} apiKey - Gemini API key
   * @param {string} modelKey - Model slot key ("flash", "pro", or "nano")
   * @param {number} [retryCount=0] - Current retry attempt
   * @param {Function} [onRetry] - Callback for retry notifications (status, retryNum, delaySeconds)
   * @param {string} [siteName] - "WILLHABEN" or "KLEINANZEIGEN" (defaults to "WILLHABEN")
   * @returns {Promise<{ topDeals: Array }>} Parsed Gemini response
   */
  function callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount, onRetry, siteName) {
    modelKey = modelKey || MODEL.FLASH;
    retryCount = retryCount || 0;
    onRetry = onRetry || null;
    siteName = siteName || 'WILLHABEN';

    var MAX_RETRIES = 2;
    var RATE_LIMIT_MAX_RETRIES = 5;
    var RETRY_BASE_DELAY = 2000;
    var RATE_LIMIT_BASE_DELAY = 5000;
    var MAX_RATE_LIMIT_DELAY = 300000;
    var GEMINI_API_TIMEOUT = 60000;
    var JITTER_FACTOR = 0.2;
    var SHOULD_STOP = false;

    return (async function () {
      // Read model mapping from storage or use defaults
      var rawMapping = null;
      try {
        var raw = await GM.getValue('wh_dealfinder_settings', null) || await GM.getValue('ka_dealfinder_settings', null);
        if (raw) {
          var parsed = JSON.parse(raw);
          rawMapping = parsed.modelMapping || null;
        }
      } catch (e) { /* use defaults */ }

      var mapping = rawMapping || {
        flash: GEMINI_MODELS.flash.id,
        pro: GEMINI_MODELS.pro.id,
        nano: GEMINI_MODELS.nano.id
      };
      var slotConfig = GEMINI_MODELS[modelKey];
      var modelId = mapping[modelKey] || (slotConfig ? slotConfig.id : modelKey);
      var modelUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent';

      var stats = computePriceStats(adsData);
      var statsSection = stats
        ? '\n\n## Price Distribution\n- Min: ' + stats.min + ' EUR\n- Max: ' + stats.max + ' EUR\n- Avg: ' + stats.mean + ' EUR\n- Median: ' + stats.median + ' EUR\n- Listings with price: ' + stats.count
        : '';

      var prompt = 'You are a deal and price analysis expert.\n\nSEARCH CONTEXT: ' + searchContext +
        '\n\nTASK:\nAnalyze the following ' + siteName + ' listings and find the ' + topX + ' BEST deals.\n\n' +
        'CRITERIA for a good deal:\n- 35-90% below the usual new price\n' +
        '- Guaranteed profit on resale possible\n- MUST BUY quality\n- Real added value for the buyer' +
        statsSection + '\n\nLISTINGS:\n';

      for (var adi = 0; adi < adsData.length; adi++) {
        var ad = adsData[adi];
        prompt += '\nListing ' + (adi + 1) + ':\nTitle: ' + (ad.title || '') +
          '\nPrice: ' + (ad.price || '') +
          '\nDescription: ' + ((ad.description || '').substring(0, 400)) +
          '\nURL: ' + (ad.url || '') + '\n---\n';
      }

      prompt += '\nRESPONSE FORMAT (JSON ONLY, NO EXTRA TEXT):\n{\n  "topDeals": [\n    {\n' +
        '      "title": "...",\n      "price": "...",\n      "description": "...",\n' +
        '      "url": "...",\n      "reasoning": "Why is this a top deal? (1-2 sentences)",\n' +
        '      "score": 85\n    }\n  ]\n}\n\nSort the top ' + topX +
        ' deals by quality (best first). Score is 0-100 (100 = absolute bargain).';

      var baseTokens = 2048;
      var tokensPerDeal = 150;
      var requiredTokens = Math.max(baseTokens, adsData.length * tokensPerDeal + 500);
      var maxOutputTokens = Math.min(8192, requiredTokens);

      var requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              topDeals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    price: { type: 'string' },
                    description: { type: 'string' },
                    url: { type: 'string' },
                    score: { type: 'number' },
                    reasoning: { type: 'string' }
                  },
                  required: ['title', 'price', 'description', 'url', 'score', 'reasoning']
                }
              }
            },
            required: ['topDeals']
          }
        }
      };

      return new Promise(function (resolve, reject) {
        function attempt(n) {
          GM_xmlhttpRequest({
            method: 'POST',
            url: modelUrl,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            data: JSON.stringify(requestBody),
            timeout: GEMINI_API_TIMEOUT,
            onload: function (response) {
              try {
                if (response.status === 200) {
                  var data = JSON.parse(response.responseText);
                  var finishReason = data.candidates && data.candidates[0]
                    ? data.candidates[0].finishReason : null;
                  console.log('[MDF-API] Gemini finishReason:', finishReason);

                  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content ||
                      !data.candidates[0].content.parts) {
                    var reason = finishReason || 'UNKNOWN';
                    if (reason === 'SAFETY' || reason === 'RECITATION') {
                      reject(new Error('Gemini: Content blocked (' + reason + ')'));
                    } else {
                      reject(new Error('Gemini: No content (finishReason: ' + reason + ')'));
                    }
                    return;
                  }

                  var parts = data.candidates[0].content.parts;
                  var fullText = '';
                  for (var pi = 0; pi < parts.length; pi++) {
                    fullText += parts[pi].text || '';
                  }
                  console.log('[MDF-API] AI response (' + parts.length + ' parts, ' + fullText.length + ' chars)');

                  if (finishReason === 'MAX_TOKENS') {
                    console.warn('[MDF-API] Response truncated at MAX_TOKENS');
                  }

                  // Direct JSON parse attempt
                  try {
                    var parsed = JSON.parse(fullText);
                    if (parsed.topDeals) {
                      resolve(parsed);
                      return;
                    }
                  } catch (e) { /* fall through to extraction methods */ }

                  // Try JSON code block extraction
                  var jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
                  var jsonText = jsonMatch ? jsonMatch[1] : null;

                  // Try raw JSON extraction
                  if (!jsonText) {
                    var rawMatch = fullText.match(/(\{[\s\S]*\})/);
                    if (rawMatch) jsonText = rawMatch[1];
                  }

                  if (jsonText) {
                    try {
                      resolve(JSON.parse(jsonText));
                      return;
                    } catch (parseError) {
                      console.error('[MDF-API] JSON parse error:', parseError);
                    }
                  }

                  console.error('[MDF-API] No JSON found in response');
                  if (n < MAX_RETRIES && !SHOULD_STOP) {
                    var jitterDelay = RETRY_BASE_DELAY * (1 + Math.random() * 0.5);
                    setTimeout(function () { attempt(n + 1); }, jitterDelay);
                  } else {
                    reject(new Error('No JSON in AI response'));
                  }

                } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                  console.error('[MDF-API] Final error (no retry) - Status:', response.status);
                  reject(new Error('Gemini API error: ' + response.status));
                } else if (response.status === 429 || response.status === 503) {
                  if (n < RATE_LIMIT_MAX_RETRIES) {
                    var delay = RATE_LIMIT_BASE_DELAY * Math.pow(2, n);
                    var serverDictated = false;
                    if (response.responseHeaders) {
                      var raMatch = response.responseHeaders.match(/retry-after:\s*(\d+)/i);
                      if (raMatch) {
                        var seconds = parseInt(raMatch[1], 10);
                        if (!isNaN(seconds)) {
                          delay = seconds * 1000;
                          serverDictated = true;
                        }
                      }
                    }
                    delay = delay * (1 + Math.random() * JITTER_FACTOR);
                    if (!serverDictated) delay = Math.min(delay, MAX_RATE_LIMIT_DELAY);
                    console.log('[MDF-API] Rate limit', response.status, '- Retry', (n + 1), 'in', Math.round(delay), 'ms');
                    if (onRetry) onRetry(response.status, n + 1, Math.round(delay / 1000));
                    if (SHOULD_STOP) { reject(new Error('Aborted')); return; }
                    setTimeout(function () { attempt(n + 1); }, delay);
                  } else {
                    reject(new Error('Gemini API error: ' + response.status));
                  }
                } else if (n < MAX_RETRIES) {
                  console.log('[MDF-API] API error', response.status, '- Retry', (n + 1));
                  if (onRetry) onRetry(response.status, n + 1, 2);
                  if (SHOULD_STOP) { reject(new Error('Aborted')); return; }
                  setTimeout(function () { attempt(n + 1); }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
                } else {
                  console.error('[MDF-API] Final error - Status:', response.status);
                  reject(new Error('Gemini API error: ' + response.status));
                }
              } catch (error) {
                if (SHOULD_STOP) { reject(new Error('Aborted')); return; }
                if (n < MAX_RETRIES) {
                  setTimeout(function () { attempt(n + 1); }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
                } else {
                  reject(error);
                }
              }
            },
            onerror: function () {
              if (SHOULD_STOP) { reject(new Error('Aborted')); return; }
              if (n < MAX_RETRIES) {
                if (onRetry) onRetry('network_error', n + 1, 2);
                setTimeout(function () { attempt(n + 1); }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
              } else {
                reject(new Error('Network error in Gemini API'));
              }
            },
            ontimeout: function () {
              if (SHOULD_STOP) { reject(new Error('Aborted')); return; }
              if (n < MAX_RETRIES) {
                if (onRetry) onRetry('timeout', n + 1, 2);
                setTimeout(function () { attempt(n + 1); }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
              } else {
                reject(new Error('Timeout in Gemini API'));
              }
            }
          });
        }
        attempt(0);
      });
    })();
  }

  /* ─── Model Selection UI ─── */

  /**
   * Fetches available Gemini models from the API and shows the model mapper UI.
   * @param {string} apiKey - Gemini API key
   * @param {string} prefix - Site storage prefix ("wh" or "ka")
   * @param {Object} cachedSettings - Current settings object
   * @param {Function} saveAvailableModelsFn - Storage function for model list
   */
  function fetchGeminiModels(apiKey, prefix, cachedSettings, saveAvailableModelsFn) {
    var area = document.getElementById(prefix + '-model-area');
    if (!area) return;
    area.innerHTML = '<small style="color:#aaa;font-size:12px;">Loading models...</small>';

    var REQUEST_TIMEOUT = 15000;

    GM_xmlhttpRequest({
      method: 'GET',
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      timeout: REQUEST_TIMEOUT,
      headers: { 'x-goog-api-key': apiKey },
      onload: function (response) {
        try {
          if (response.status !== 200) {
            console.error('[MDF-API] Models API error:', response.status);
            throw new Error('HTTP ' + response.status);
          }
          var data = JSON.parse(response.responseText);
          var modelIds = (data.models || [])
            .filter(function (m) {
              return Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.indexOf('generateContent') !== -1 &&
                m.name.indexOf('gemini') !== -1;
            })
            .map(function (m) { return m.name.replace('models/', ''); });
          if (modelIds.length === 0) throw new Error('No Gemini models found');
          if (saveAvailableModelsFn) saveAvailableModelsFn(modelIds, prefix);
          showModelMapper(modelIds, prefix, cachedSettings);
        } catch (e) {
          restoreModelSelect(prefix, cachedSettings);
          console.error('[MDF-API] Failed to load models:', e);
          if (area) {
            var hint = area.querySelector('small');
            if (hint) hint.textContent = 'Error: ' + e.message;
          }
        }
      },
      onerror: function () { restoreModelSelect(prefix, cachedSettings); },
      ontimeout: function () { restoreModelSelect(prefix, cachedSettings); }
    });
  }

  /**
   * Renders the model-to-slot mapping UI with dropdowns for each slot.
   * @param {string[]} modelIds - Available model IDs from the API
   * @param {string} prefix - Site storage prefix ("wh" or "ka")
   * @param {Object} cachedSettings - Current settings object
   */
  function showModelMapper(modelIds, prefix, cachedSettings) {
    var area = document.getElementById(prefix + '-model-area');
    if (!area) return;

    var DEFAULT_SETTINGS = {
      modelMapping: {
        flash: GEMINI_MODELS.flash.id,
        pro: GEMINI_MODELS.pro.id,
        nano: GEMINI_MODELS.nano.id
      }
    };

    var mapping = (cachedSettings && cachedSettings.modelMapping) || DEFAULT_SETTINGS.modelMapping;

    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    var html = '<div style="border:1px solid #e0e0e0;border-radius:4px;padding:12px;background:#fafafa;">';
    html += '<div style="font-size:11px;color:#888;margin-bottom:10px;font-weight:600;">Which model maps to...</div>';
    var modelKeys = Object.keys(GEMINI_MODELS);
    for (var ki = 0; ki < modelKeys.length; ki++) {
      var key = modelKeys[ki];
      var m = GEMINI_MODELS[key];
      var currentVal = mapping[key] || m.id;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
      html += '<span style="font-size:13px;font-weight:600;color:#444;min-width:70px;">' + m.icon + ' ' + m.label + '</span>';
      html += '<select id="' + prefix + '-map-' + key + '" style="flex:1;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;background:white;">';
      for (var mi = 0; mi < modelIds.length; mi++) {
        var selected = currentVal === modelIds[mi] ? ' selected' : '';
        html += '<option value="' + escapeHTML(modelIds[mi]) + '"' + selected + '>' + escapeHTML(modelIds[mi]) + '</option>';
      }
      html += '</select></div>';
    }
    html += '<div style="display:flex;gap:8px;margin-top:10px;">';
    html += '<button id="' + prefix + '-map-save" style="flex:1;padding:7px;background:#28a745;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">Save</button>';
    html += '<button id="' + prefix + '-map-cancel" style="padding:7px 14px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:13px;cursor:pointer;color:#555;">Cancel</button>';
    html += '</div></div>';
    area.innerHTML = html;

    async function saveModelMapping(showFeedback) {
      showFeedback = showFeedback || false;
      var s = JSON.parse(JSON.stringify(cachedSettings || DEFAULT_SETTINGS));
      s.modelMapping = s.modelMapping || {};
      modelKeys.forEach(function (k) {
        var sel = document.getElementById(prefix + '-map-' + k);
        if (sel) s.modelMapping[k] = sel.value;
      });
      await GM.setValue(prefix + '_dealfinder_settings', JSON.stringify(s));
      if (cachedSettings) {
        cachedSettings.modelMapping = s.modelMapping;
      }

      if (showFeedback) {
        var saveBtn = document.getElementById(prefix + '-map-save');
        if (saveBtn) {
          var orig = saveBtn.textContent;
          saveBtn.textContent = 'Saved!';
          saveBtn.style.background = '#28a745';
          setTimeout(function () {
            saveBtn.textContent = orig;
            restoreModelSelect(prefix, cachedSettings);
          }, 800);
        } else {
          restoreModelSelect(prefix, cachedSettings);
        }
      }
    }

    modelKeys.forEach(function (k) {
      var sel = document.getElementById(prefix + '-map-' + k);
      if (sel) {
        sel.addEventListener('change', async function () {
          await saveModelMapping(false);
          var indicatorId = prefix + '-map-indicator-' + k;
          var indicator = document.getElementById(indicatorId);
          if (!indicator) {
            var div = document.createElement('div');
            div.id = indicatorId;
            div.style.cssText = 'position:absolute;top:-20px;right:0;font-size:11px;color:#28a745;';
            sel.parentNode.style.position = 'relative';
            sel.parentNode.appendChild(div);
          }
          document.getElementById(indicatorId).textContent = 'auto-saved';
          setTimeout(function () {
            var el = document.getElementById(indicatorId);
            if (el) el.textContent = '';
          }, 1500);
        });
      }
    });

    var mapSaveBtn = document.getElementById(prefix + '-map-save');
    if (mapSaveBtn) mapSaveBtn.addEventListener('click', async function () { await saveModelMapping(true); });
    var mapCancelBtn = document.getElementById(prefix + '-map-cancel');
    if (mapCancelBtn) mapCancelBtn.addEventListener('click', function () { restoreModelSelect(prefix, cachedSettings); });
  }

  /**
   * Renders the simplified model selection dropdown (compact view).
   * @param {string} prefix - Site storage prefix ("wh" or "ka")
   * @param {Object} cachedSettings - Current settings object
   */
  function restoreModelSelect(prefix, cachedSettings) {
    var area = document.getElementById(prefix + '-model-area');
    if (!area) return;

    var DEFAULT_SETTINGS = {
      model: 'flash',
      modelMapping: {
        flash: GEMINI_MODELS.flash.id,
        pro: GEMINI_MODELS.pro.id,
        nano: GEMINI_MODELS.nano.id
      }
    };

    var settings = cachedSettings || DEFAULT_SETTINGS;

    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    var html = '<div style="display:flex;gap:8px;align-items:center;">';
    html += '<select id="' + prefix + '-model-select" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;background:white;cursor:pointer;color:#333;">';
    var modelKeys = Object.keys(GEMINI_MODELS);
    for (var ki = 0; ki < modelKeys.length; ki++) {
      var key = modelKeys[ki];
      var m = GEMINI_MODELS[key];
      var selected = settings.model === key ? ' selected' : '';
      var modelId = (settings.modelMapping && settings.modelMapping[key]) || m.id;
      html += '<option value="' + key + '"' + selected + '>' + m.icon + ' ' + m.label + ' - ' + escapeHTML(modelId) + '</option>';
    }
    html += '</select>';
    html += '<button id="' + prefix + '-load-models-btn" title="Change model assignment" style="padding:8px 11px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:15px;cursor:pointer;line-height:1;color:#555;">↻</button>';
    html += '</div>';
    html += '<small style="color:#aaa;font-size:11px;display:block;margin-top:4px;">Click ↻ to assign which Gemini model goes with Flash/Pro/Lite</small>';
    area.innerHTML = html;

    var sel = document.getElementById(prefix + '-model-select');
    if (sel) {
      sel.addEventListener('change', async function () {
        var s = JSON.parse(JSON.stringify(cachedSettings || DEFAULT_SETTINGS));
        s.model = sel.value;
        await GM.setValue(prefix + '_dealfinder_settings', JSON.stringify(s));
        if (cachedSettings) {
          cachedSettings.model = sel.value;
        }
      });
    }
    var loadBtn = document.getElementById(prefix + '-load-models-btn');
    var apiKeyEl = document.getElementById(prefix + '-api-key');
    if (loadBtn && apiKeyEl) {
      loadBtn.addEventListener('click', function () {
        var key = apiKeyEl.value.trim();
        if (key) fetchGeminiModels(key, prefix, cachedSettings, null);
      });
    }
  }

  /* ─── Namespace Registration ─── */
  window.__MDF__ = window.__MDF__ || {};
  window.__MDF__.geminiAPI = {
    GEMINI_MODELS: GEMINI_MODELS,
    MODEL: MODEL,
    computePriceStats: computePriceStats,
    callGeminiAPI: callGeminiAPI,
    fetchGeminiModels: fetchGeminiModels,
    showModelMapper: showModelMapper,
    restoreModelSelect: restoreModelSelect
  };

})();

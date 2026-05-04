// ==UserScript==
// @name         Marketplace Deal Finder
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      30.0
// @author       marmoris
// @description  Cross-platform deal aggregator for Willhaben and Kleinanzeigen with AI-powered price analysis. Multi-page crawling with Gemini AI.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=willhaben.at
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.meta.js
// @match        https://www.willhaben.at/iad/kaufen-und-verkaufen/*
// @match        https://www.kleinanzeigen.de/s-*
// @match        https://www.kleinanzeigen.de/z-*
// @sandbox      JavaScript
// @connect      willhaben.at
// @connect      kleinanzeigen.de
// @connect      generativelanguage.googleapis.com
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_xmlhttpRequest
// @inject-into  content
// @run-at       document-idle
// @noframes
// @unwrap
// ==/UserScript==

(function () {
  'use strict';

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.createLogger = createLogger;
  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    var tag = "[" + prefix + "]";
    return {
      log: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          var args = [tag];
          for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  globalThis.TM = globalThis.TM || {};
  globalThis.TM.storage = {
    loadSetting,
    saveSetting,
    loadSettings: loadSettings$1,
    saveSettings
  };
  async function loadSetting(key, defaultValue) {
    try {
      var raw = await GM.getValue(key);
      if (raw === void 0 || raw === null) return defaultValue;
      return raw;
    } catch (e) {
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    await GM.setValue(key, value);
  }
  async function loadSettings$1(defaults) {
    var keys = Object.keys(defaults);
    var result = {};
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = await loadSetting(keys[i], defaults[keys[i]]);
    }
    return result;
  }
  async function saveSettings(obj) {
    await GM.setValues(obj);
  }
  globalThis.TM = globalThis.TM || {};
  globalThis.TM.dom = {
    waitForElement,
    debounce,
    throttle,
    observeMutations
  };
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 1e4;
    root = root || document.body;
    return new Promise(function(resolve, reject) {
      var existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      var timer;
      var observer = new MutationObserver(function(mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var nodes = mutations[m].addedNodes;
          for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
            if (nodes[i].matches && nodes[i].matches(selector)) {
              cleanup();
              return resolve(nodes[i]);
            }
            var child = nodes[i].querySelector && nodes[i].querySelector(selector);
            if (child) {
              cleanup();
              return resolve(child);
            }
          }
        }
      });
      function cleanup() {
        observer.disconnect();
        if (timer) clearTimeout(timer);
      }
      observer.observe(root, { childList: true, subtree: true });
      if (timeout > 0) {
        timer = setTimeout(function() {
          cleanup();
          reject(new Error("waitForElement timeout: " + selector));
        }, timeout);
      }
    });
  }
  function debounce(fn, ms) {
    ms = ms || 200;
    var timer = 0;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(ctx, args);
      }, ms);
    };
  }
  function throttle(fn, ms) {
    ms = ms || 200;
    var last = 0;
    return function() {
      var now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }
  function observeMutations(callback, root) {
    root = root || document.body;
    var observer = new MutationObserver(function(mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var nodes = mutations[m].addedNodes;
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  }
  var GEMINI_MODELS = {
    flash: {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      icon: "⚡",
      label: "Flash",
      desc: "Schnell & effizient"
    },
    pro: {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
      icon: "🧠",
      label: "Pro",
      desc: "Maximum Intelligenz"
    },
    nano: {
      id: "gemini-2.0-flash-lite",
      name: "Gemini Flash Lite",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent",
      icon: "💡",
      label: "Lite",
      desc: "Sparsam & schnell"
    }
  };
  var MODEL = {
    FLASH: "flash",
    PRO: "pro",
    NANO: "nano"
  };
  function computePriceStats(adsData) {
    var prices = [];
    for (var ai = 0; ai < adsData.length; ai++) {
      var ad = adsData[ai];
      var match = (ad.price || "").replace(/\./g, "").replace(/,/g, ".").match(/(\d+(?:\.\d+)?)/);
      if (match) {
        var p = parseFloat(match[1]);
        if (p > 0) prices.push(p);
      }
    }
    if (prices.length === 0) return null;
    var sorted = prices.slice().sort(function(a, b) {
      return a - b;
    });
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
  function callGeminiAPI(adsData, searchContext, topX, apiKey, modelKey, retryCount, onRetry, siteName) {
    modelKey = modelKey || MODEL.FLASH;
    onRetry = onRetry || null;
    siteName = siteName || "WILLHABEN";
    var MAX_RETRIES2 = 2;
    var RATE_LIMIT_MAX_RETRIES = 5;
    var RETRY_BASE_DELAY = 2e3;
    var RATE_LIMIT_BASE_DELAY = 5e3;
    var MAX_RATE_LIMIT_DELAY = 3e5;
    var GEMINI_API_TIMEOUT = 6e4;
    var JITTER_FACTOR = 0.2;
    var SHOULD_STOP = false;
    return (async function() {
      var rawMapping = null;
      try {
        var raw = await GM.getValue("wh_dealfinder_settings", null) || await GM.getValue("ka_dealfinder_settings", null);
        if (raw) {
          var parsed = JSON.parse(raw);
          rawMapping = parsed.modelMapping || null;
        }
      } catch (e) {
      }
      var mapping = rawMapping || {
        flash: GEMINI_MODELS.flash.id,
        pro: GEMINI_MODELS.pro.id,
        nano: GEMINI_MODELS.nano.id
      };
      var slotConfig = GEMINI_MODELS[modelKey];
      var modelId = mapping[modelKey] || (slotConfig ? slotConfig.id : modelKey);
      var modelUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + modelId + ":generateContent";
      var stats = computePriceStats(adsData);
      var statsSection = stats ? "\n\n## Price Distribution\n- Min: " + stats.min + " EUR\n- Max: " + stats.max + " EUR\n- Avg: " + stats.mean + " EUR\n- Median: " + stats.median + " EUR\n- Listings with price: " + stats.count : "";
      var prompt = "You are a deal and price analysis expert.\n\nSEARCH CONTEXT: " + searchContext + "\n\nTASK:\nAnalyze the following " + siteName + " listings and find the " + topX + " BEST deals.\n\nCRITERIA for a good deal:\n- 35-90% below the usual new price\n- Guaranteed profit on resale possible\n- MUST BUY quality\n- Real added value for the buyer" + statsSection + "\n\nLISTINGS:\n";
      for (var adi = 0; adi < adsData.length; adi++) {
        var ad = adsData[adi];
        prompt += "\nListing " + (adi + 1) + ":\nTitle: " + (ad.title || "") + "\nPrice: " + (ad.price || "") + "\nDescription: " + (ad.description || "").substring(0, 400) + "\nURL: " + (ad.url || "") + "\n---\n";
      }
      prompt += '\nRESPONSE FORMAT (JSON ONLY, NO EXTRA TEXT):\n{\n  "topDeals": [\n    {\n      "title": "...",\n      "price": "...",\n      "description": "...",\n      "url": "...",\n      "reasoning": "Why is this a top deal? (1-2 sentences)",\n      "score": 85\n    }\n  ]\n}\n\nSort the top ' + topX + " deals by quality (best first). Score is 0-100 (100 = absolute bargain).";
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
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              topDeals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    price: { type: "string" },
                    description: { type: "string" },
                    url: { type: "string" },
                    score: { type: "number" },
                    reasoning: { type: "string" }
                  },
                  required: ["title", "price", "description", "url", "score", "reasoning"]
                }
              }
            },
            required: ["topDeals"]
          }
        }
      };
      return new Promise(function(resolve, reject) {
        function attempt(n) {
          GM_xmlhttpRequest({
            method: "POST",
            url: modelUrl,
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            data: JSON.stringify(requestBody),
            timeout: GEMINI_API_TIMEOUT,
            onload: function(response) {
              try {
                if (response.status === 200) {
                  var data = JSON.parse(response.responseText);
                  var finishReason = data.candidates && data.candidates[0] ? data.candidates[0].finishReason : null;
                  console.log("[MDF-API] Gemini finishReason:", finishReason);
                  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
                    var reason = finishReason || "UNKNOWN";
                    if (reason === "SAFETY" || reason === "RECITATION") {
                      reject(new Error("Gemini: Content blocked (" + reason + ")"));
                    } else {
                      reject(new Error("Gemini: No content (finishReason: " + reason + ")"));
                    }
                    return;
                  }
                  var parts = data.candidates[0].content.parts;
                  var fullText = "";
                  for (var pi = 0; pi < parts.length; pi++) {
                    fullText += parts[pi].text || "";
                  }
                  console.log("[MDF-API] AI response (" + parts.length + " parts, " + fullText.length + " chars)");
                  if (finishReason === "MAX_TOKENS") {
                    console.warn("[MDF-API] Response truncated at MAX_TOKENS");
                  }
                  try {
                    var parsed2 = JSON.parse(fullText);
                    if (parsed2.topDeals) {
                      resolve(parsed2);
                      return;
                    }
                  } catch (e) {
                  }
                  var jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
                  var jsonText = jsonMatch ? jsonMatch[1] : null;
                  if (!jsonText) {
                    var rawMatch = fullText.match(/(\{[\s\S]*\})/);
                    if (rawMatch) jsonText = rawMatch[1];
                  }
                  if (jsonText) {
                    try {
                      resolve(JSON.parse(jsonText));
                      return;
                    } catch (parseError) {
                      console.error("[MDF-API] JSON parse error:", parseError);
                    }
                  }
                  console.error("[MDF-API] No JSON found in response");
                  if (n < MAX_RETRIES2 && !SHOULD_STOP) {
                    var jitterDelay = RETRY_BASE_DELAY * (1 + Math.random() * 0.5);
                    setTimeout(function() {
                      attempt(n + 1);
                    }, jitterDelay);
                  } else {
                    reject(new Error("No JSON in AI response"));
                  }
                } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                  console.error("[MDF-API] Final error (no retry) - Status:", response.status);
                  reject(new Error("Gemini API error: " + response.status));
                } else if (response.status === 429 || response.status === 503) {
                  if (n < RATE_LIMIT_MAX_RETRIES) {
                    var delay = RATE_LIMIT_BASE_DELAY * Math.pow(2, n);
                    var serverDictated = false;
                    if (response.responseHeaders) {
                      var raMatch = response.responseHeaders.match(/retry-after:\s*(\d+)/i);
                      if (raMatch) {
                        var seconds = parseInt(raMatch[1], 10);
                        if (!isNaN(seconds)) {
                          delay = seconds * 1e3;
                          serverDictated = true;
                        }
                      }
                    }
                    delay = delay * (1 + Math.random() * JITTER_FACTOR);
                    if (!serverDictated) delay = Math.min(delay, MAX_RATE_LIMIT_DELAY);
                    console.log("[MDF-API] Rate limit", response.status, "- Retry", n + 1, "in", Math.round(delay), "ms");
                    if (onRetry) onRetry(response.status, n + 1, Math.round(delay / 1e3));
                    if (SHOULD_STOP) ;
                    setTimeout(function() {
                      attempt(n + 1);
                    }, delay);
                  } else {
                    reject(new Error("Gemini API error: " + response.status));
                  }
                } else if (n < MAX_RETRIES2) {
                  console.log("[MDF-API] API error", response.status, "- Retry", n + 1);
                  if (onRetry) onRetry(response.status, n + 1, 2);
                  if (SHOULD_STOP) ;
                  setTimeout(function() {
                    attempt(n + 1);
                  }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
                } else {
                  console.error("[MDF-API] Final error - Status:", response.status);
                  reject(new Error("Gemini API error: " + response.status));
                }
              } catch (error) {
                if (n < MAX_RETRIES2) {
                  setTimeout(function() {
                    attempt(n + 1);
                  }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
                } else {
                  reject(error);
                }
              }
            },
            onerror: function() {
              if (n < MAX_RETRIES2) {
                if (onRetry) onRetry("network_error", n + 1, 2);
                setTimeout(function() {
                  attempt(n + 1);
                }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
              } else {
                reject(new Error("Network error in Gemini API"));
              }
            },
            ontimeout: function() {
              if (n < MAX_RETRIES2) {
                if (onRetry) onRetry("timeout", n + 1, 2);
                setTimeout(function() {
                  attempt(n + 1);
                }, RETRY_BASE_DELAY * (1 + Math.random() * 0.5));
              } else {
                reject(new Error("Timeout in Gemini API"));
              }
            }
          });
        }
        attempt(0);
      });
    })();
  }
  function fetchGeminiModels(apiKey, prefix, cachedSettings2, saveAvailableModelsFn) {
    var area = document.getElementById(prefix + "-model-area");
    if (!area) return;
    area.innerHTML = '<small style="color:#aaa;font-size:12px;">Loading models...</small>';
    var REQUEST_TIMEOUT2 = 15e3;
    GM_xmlhttpRequest({
      method: "GET",
      url: "https://generativelanguage.googleapis.com/v1beta/models",
      timeout: REQUEST_TIMEOUT2,
      headers: { "x-goog-api-key": apiKey },
      onload: function(response) {
        try {
          if (response.status !== 200) {
            console.error("[MDF-API] Models API error:", response.status);
            throw new Error("HTTP " + response.status);
          }
          var data = JSON.parse(response.responseText);
          var modelIds = (data.models || []).filter(function(m) {
            return Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.indexOf("generateContent") !== -1 && m.name.indexOf("gemini") !== -1;
          }).map(function(m) {
            return m.name.replace("models/", "");
          });
          if (modelIds.length === 0) throw new Error("No Gemini models found");
          if (saveAvailableModelsFn) ;
          showModelMapper(modelIds, prefix, cachedSettings2);
        } catch (e) {
          restoreModelSelect(prefix, cachedSettings2);
          console.error("[MDF-API] Failed to load models:", e);
          if (area) {
            var hint = area.querySelector("small");
            if (hint) hint.textContent = "Error: " + e.message;
          }
        }
      },
      onerror: function() {
        restoreModelSelect(prefix, cachedSettings2);
      },
      ontimeout: function() {
        restoreModelSelect(prefix, cachedSettings2);
      }
    });
  }
  function showModelMapper(modelIds, prefix, cachedSettings2) {
    var area = document.getElementById(prefix + "-model-area");
    if (!area) return;
    var DEFAULT_SETTINGS2 = {
      modelMapping: {
        flash: GEMINI_MODELS.flash.id,
        pro: GEMINI_MODELS.pro.id,
        nano: GEMINI_MODELS.nano.id
      }
    };
    var mapping = cachedSettings2 && cachedSettings2.modelMapping || DEFAULT_SETTINGS2.modelMapping;
    function esc2(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    var html = '<div style="border:1px solid #e0e0e0;border-radius:4px;padding:12px;background:#fafafa;">';
    html += '<div style="font-size:11px;color:#888;margin-bottom:10px;font-weight:600;">Which model maps to...</div>';
    var modelKeys = Object.keys(GEMINI_MODELS);
    for (var ki = 0; ki < modelKeys.length; ki++) {
      var key = modelKeys[ki];
      var m = GEMINI_MODELS[key];
      var currentVal = mapping[key] || m.id;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
      html += '<span style="font-size:13px;font-weight:600;color:#444;min-width:70px;">' + m.icon + " " + m.label + "</span>";
      html += '<select id="' + prefix + "-map-" + key + '" style="flex:1;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;background:white;">';
      for (var mi = 0; mi < modelIds.length; mi++) {
        var selected = currentVal === modelIds[mi] ? " selected" : "";
        html += '<option value="' + esc2(modelIds[mi]) + '"' + selected + ">" + esc2(modelIds[mi]) + "</option>";
      }
      html += "</select></div>";
    }
    html += '<div style="display:flex;gap:8px;margin-top:10px;">';
    html += '<button id="' + prefix + '-map-save" style="flex:1;padding:7px;background:#28a745;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">Save</button>';
    html += '<button id="' + prefix + '-map-cancel" style="padding:7px 14px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:13px;cursor:pointer;color:#555;">Cancel</button>';
    html += "</div></div>";
    area.innerHTML = html;
    async function saveModelMapping(showFeedback) {
      showFeedback = showFeedback || false;
      var s = JSON.parse(JSON.stringify(cachedSettings2 || DEFAULT_SETTINGS2));
      s.modelMapping = s.modelMapping || {};
      modelKeys.forEach(function(k) {
        var sel = document.getElementById(prefix + "-map-" + k);
        if (sel) s.modelMapping[k] = sel.value;
      });
      await GM.setValue(prefix + "_dealfinder_settings", JSON.stringify(s));
      if (cachedSettings2) {
        cachedSettings2.modelMapping = s.modelMapping;
      }
      if (showFeedback) {
        var saveBtn = document.getElementById(prefix + "-map-save");
        if (saveBtn) {
          var orig = saveBtn.textContent;
          saveBtn.textContent = "Saved!";
          saveBtn.style.background = "#28a745";
          setTimeout(function() {
            saveBtn.textContent = orig;
            restoreModelSelect(prefix, cachedSettings2);
          }, 800);
        } else {
          restoreModelSelect(prefix, cachedSettings2);
        }
      }
    }
    modelKeys.forEach(function(k) {
      var sel = document.getElementById(prefix + "-map-" + k);
      if (sel) {
        sel.addEventListener("change", async function() {
          await saveModelMapping(false);
          var indicatorId = prefix + "-map-indicator-" + k;
          var indicator = document.getElementById(indicatorId);
          if (!indicator) {
            var div = document.createElement("div");
            div.id = indicatorId;
            div.style.cssText = "position:absolute;top:-20px;right:0;font-size:11px;color:#28a745;";
            sel.parentNode.style.position = "relative";
            sel.parentNode.appendChild(div);
          }
          document.getElementById(indicatorId).textContent = "auto-saved";
          setTimeout(function() {
            var el = document.getElementById(indicatorId);
            if (el) el.textContent = "";
          }, 1500);
        });
      }
    });
    var mapSaveBtn = document.getElementById(prefix + "-map-save");
    if (mapSaveBtn) mapSaveBtn.addEventListener("click", async function() {
      await saveModelMapping(true);
    });
    var mapCancelBtn = document.getElementById(prefix + "-map-cancel");
    if (mapCancelBtn) mapCancelBtn.addEventListener("click", function() {
      restoreModelSelect(prefix, cachedSettings2);
    });
  }
  function restoreModelSelect(prefix, cachedSettings2) {
    var area = document.getElementById(prefix + "-model-area");
    if (!area) return;
    var DEFAULT_SETTINGS2 = {
      model: "flash",
      modelMapping: {
        flash: GEMINI_MODELS.flash.id,
        pro: GEMINI_MODELS.pro.id,
        nano: GEMINI_MODELS.nano.id
      }
    };
    var settings = cachedSettings2 || DEFAULT_SETTINGS2;
    function esc2(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    var html = '<div style="display:flex;gap:8px;align-items:center;">';
    html += '<select id="' + prefix + '-model-select" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;background:white;cursor:pointer;color:#333;">';
    var modelKeys = Object.keys(GEMINI_MODELS);
    for (var ki = 0; ki < modelKeys.length; ki++) {
      var key = modelKeys[ki];
      var m = GEMINI_MODELS[key];
      var selected = settings.model === key ? " selected" : "";
      var modelId = settings.modelMapping && settings.modelMapping[key] || m.id;
      html += '<option value="' + key + '"' + selected + ">" + m.icon + " " + m.label + " - " + esc2(modelId) + "</option>";
    }
    html += "</select>";
    html += '<button id="' + prefix + '-load-models-btn" title="Change model assignment" style="padding:8px 11px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:15px;cursor:pointer;line-height:1;color:#555;">↻</button>';
    html += "</div>";
    html += '<small style="color:#aaa;font-size:11px;display:block;margin-top:4px;">Click ↻ to assign which Gemini model goes with Flash/Pro/Lite</small>';
    area.innerHTML = html;
    var sel = document.getElementById(prefix + "-model-select");
    if (sel) {
      sel.addEventListener("change", async function() {
        var s = JSON.parse(JSON.stringify(cachedSettings2 || DEFAULT_SETTINGS2));
        s.model = sel.value;
        await GM.setValue(prefix + "_dealfinder_settings", JSON.stringify(s));
        if (cachedSettings2) {
          cachedSettings2.model = sel.value;
        }
      });
    }
    var loadBtn = document.getElementById(prefix + "-load-models-btn");
    var apiKeyEl = document.getElementById(prefix + "-api-key");
    if (loadBtn && apiKeyEl) {
      loadBtn.addEventListener("click", function() {
        var key2 = apiKeyEl.value.trim();
        if (key2) fetchGeminiModels(key2, prefix, cachedSettings2, null);
      });
    }
  }
  var INITIAL_BATCH_SIZE = 8;
  var MAX_RETRIES = 2;
  var DESCRIPTION_PREVIEW_LENGTH = 150;
  var SETTINGS_VERSION = 1;
  var MAX_CACHE_SIZE = 100;
  var REQUEST_TIMEOUT = 15e3;
  var RE_RANK_MAX_DEALS = 30;
  var PAUSE_POLL_INTERVAL = 500;
  var SAME_PAGE_INCREMENT = 0;
  var NEW_PAGE_INCREMENT = 1;
  var MAX_INIT_RETRIES = 5;
  var DEAL_KEYS = {
    URL: "url",
    TITLE: "title",
    PRICE: "price",
    DESCRIPTION: "description",
    SCORE: "score",
    REASON: "reason",
    PAGE: "page"
  };
  var DEFAULT_SETTINGS = {
    version: SETTINGS_VERSION,
    apiKey: "",
    searchContext: "",
    topX: 3,
    model: "flash",
    modelMapping: {
      flash: "gemini-2.0-flash",
      pro: "gemini-1.5-pro",
      nano: "gemini-2.0-flash-lite"
    },
    maxPages: 10
  };
  function getValidScore(score) {
    var num = Number(score);
    return Number.isFinite(num) ? num : null;
  }
  function isValidScore(score) {
    return getValidScore(score) !== null;
  }
  function sortDealsByScore(deals) {
    return deals.slice().sort(function(a, b) {
      return (getValidScore(b.score) ?? 0) - (getValidScore(a.score) ?? 0);
    });
  }
  function extractSet(arr, key) {
    return new Set(arr.map(function(item) {
      return item[key];
    }));
  }
  function normalizeUrl(url) {
    if (!url) return url;
    return url.split("#")[0];
  }
  function deepCopySettings(settings) {
    return {
      ...settings,
      modelMapping: { ...settings.modelMapping || DEFAULT_SETTINGS.modelMapping }
    };
  }
  async function loadSettings(storagePrefix, cachedSettings2) {
    if (cachedSettings2 !== null) {
      return { settings: deepCopySettings(cachedSettings2), cachedSettings: cachedSettings2 };
    }
    var saved = await loadSetting(storagePrefix + "_dealfinder_settings", null);
    if (!saved) {
      var defaults = deepCopySettings(DEFAULT_SETTINGS);
      return { settings: deepCopySettings(defaults), cachedSettings: defaults };
    }
    try {
      var loaded = typeof saved === "string" ? JSON.parse(saved) : saved;
      if (loaded.model && !{ flash: 1, pro: 1, nano: 1 }[loaded.model]) {
        loaded.model = "flash";
      }
      var merged = Object.assign({}, DEFAULT_SETTINGS, loaded);
      var cs = deepCopySettings(merged);
      return { settings: deepCopySettings(cs), cachedSettings: cs };
    } catch (e) {
      console.warn("[MDF] Corrupted settings storage, resetting to defaults");
      await saveSetting(storagePrefix + "_dealfinder_settings", null);
      var defs = deepCopySettings(DEFAULT_SETTINGS);
      return { settings: deepCopySettings(defs), cachedSettings: defs };
    }
  }
  async function saveCrawlState(state, storagePrefix) {
    await saveSetting(storagePrefix + "_dealfinder_crawl_state", JSON.stringify(state));
  }
  async function clearCrawlState(storagePrefix) {
    await saveSetting(storagePrefix + "_dealfinder_crawl_state", null);
  }
  async function saveResults(results, storagePrefix) {
    await saveSetting(storagePrefix + "_dealfinder_results", JSON.stringify(results));
  }
  async function loadResults(storagePrefix) {
    var saved = await loadSetting(storagePrefix + "_dealfinder_results", null);
    if (!saved) return null;
    try {
      return typeof saved === "string" ? JSON.parse(saved) : saved;
    } catch (e) {
      await saveSetting(storagePrefix + "_dealfinder_results", null);
      return null;
    }
  }
  async function clearResults(storagePrefix) {
    await saveSetting(storagePrefix + "_dealfinder_results", null);
  }
  function deduplicateDeals(deals) {
    var seen = new Map();
    for (var i = 0; i < deals.length; i++) {
      var d = deals[i];
      if (!seen.has(d.url)) seen.set(d.url, d);
    }
    return Array.from(seen.values());
  }
  async function reRankGlobal(allTopDeals2, apiKey, searchContext, model, logFn) {
    var log = logFn || console;
    if (!allTopDeals2 || allTopDeals2.length <= 1) return allTopDeals2 || [];
    var sortedTopDeals = sortDealsByScore(allTopDeals2);
    var dealsToReRank = sortedTopDeals.slice(0, RE_RANK_MAX_DEALS);
    try {
      var onRetry = function(status, retryNum, delaySeconds) {
        log.warn("Global Re-Ranking: API " + status + " - Retry " + retryNum + " in " + delaySeconds + "s...");
      };
      var reRankResult = await callGeminiAPI(
        dealsToReRank.map(function(d) {
          return {
            title: d.title,
            price: d.price,
            description: (d.description || "").substring(0, 400),
            url: d.url
          };
        }),
        searchContext || "",
        dealsToReRank.length,
        apiKey,
        model,
        0,
        onRetry
      );
      if (reRankResult && reRankResult.topDeals && reRankResult.topDeals.length > 0) {
        var urlToDeal = new Map();
        var titleToDeal = new Map();
        for (var ri = 0; ri < dealsToReRank.length; ri++) {
          urlToDeal.set(dealsToReRank[ri].url, dealsToReRank[ri]);
          titleToDeal.set(dealsToReRank[ri].title, dealsToReRank[ri]);
        }
        var reRankedDeals = reRankResult.topDeals.map(function(rd) {
          var orig = urlToDeal.get(rd.url) || titleToDeal.get(rd.title);
          return {
            title: orig && orig.title || rd.title,
            price: rd.price,
            description: orig && orig.description || rd.description,
            url: orig && orig.url || rd.url,
            score: rd.score,
            reasoning: rd.reasoning,
            page: orig && orig.page || "unknown"
          };
        });
        var reRankedUrls = extractSet(reRankedDeals, DEAL_KEYS.URL);
        var remainingDeals = sortedTopDeals.filter(function(d) {
          return !reRankedUrls.has(d.url);
        });
        var result = sortDealsByScore(reRankedDeals.concat(remainingDeals));
        log.log("Global re-ranking complete (" + reRankedDeals.length + " deals re-ranked, " + remainingDeals.length + " deals kept)");
        return result;
      }
    } catch (e) {
      log.warn("Global re-ranking failed:", e);
    }
    return allTopDeals2;
  }
  function generateMarkdown(deals, pages, timestamp, siteName) {
    timestamp = timestamp || ( new Date()).toISOString();
    var md = "# 🏆 " + siteName + " DEAL FINDER - FINALE RANKING\n\n";
    md += "**Gefunden:** " + deals.length + " Top-Deals  \n";
    md += "**Analysierte Seiten:** " + pages + "  \n";
    md += "**Erstellt:** " + timestamp + "\n\n";
    for (var i = 0; i < deals.length; i++) {
      var deal = deals[i];
      var rank = i + 1;
      var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + rank;
      md += "## " + medal + " RANG " + rank + " (Seite " + deal.page + ")\n\n";
      md += "**Titel:** " + (deal.title || "Unbekannt") + "  \n";
      md += "**Preis:** " + (deal.price || "Unbekannt") + "  \n";
      if (deal.score !== void 0 && isValidScore(deal.score)) {
        md += "**Score:** " + deal.score + "/100  \n";
      }
      md += "**Begründung:** " + (deal.reasoning || "Keine Begründung") + "  \n\n";
      if (deal.description) {
        md += "**Beschreibung:**\n> " + deal.description.substring(0, DESCRIPTION_PREVIEW_LENGTH) + (deal.description.length > DESCRIPTION_PREVIEW_LENGTH ? "..." : "") + "\n\n";
      }
      md += "**Link:** [Anzeige öffnen](" + deal.url + ")\n\n";
    }
    return md;
  }
  var MIN_TITLE_LENGTH$1 = 5;
  function isPriceOnlyText$1(text) {
    return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
  }
  function findAds$1() {
    var adSelectors = [
      'a[data-testid^="search-result-entry-header-"]',
      'article[data-testid^="search-result-entry-"]',
      '[data-testid*="search-result-entry"]'
    ];
    for (var si = 0; si < adSelectors.length; si++) {
      var entries = document.querySelectorAll(adSelectors[si]);
      if (entries.length > 0) {
        console.log("[MDF-WH] Found " + entries.length + " ads (selector: " + adSelectors[si] + ")");
        return { adEntries: entries };
      }
    }
    var uniqueUrls = new Set();
    var uniqueAds = [];
    var urlRegex = /\/iad\/kaufen-und-verkaufen\/.*\/\d+/;
    document.querySelectorAll('a[href*="/iad/kaufen-und-verkaufen/"]').forEach(function(link) {
      var url = link.href;
      if (urlRegex.test(url) && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        var container = link.closest('article, div[class*="box"], [data-testid*="search-result"], .ad-item, .list-item');
        uniqueAds.push(container || link);
      }
    });
    if (uniqueAds.length > 0) {
      console.log("[MDF-WH] Found " + uniqueAds.length + " ads (fallback method)");
      return { adEntries: uniqueAds };
    }
    return null;
  }
  function extractBasicInfo$1(ad) {
    var title = "Title not available";
    [].concat(["h3", "h2", '[data-testid*="title"]']).forEach(function(s) {
      var el = ad.querySelector(s);
      if (el) {
        var text2 = el.textContent.trim();
        if (text2.length > MIN_TITLE_LENGTH$1 && !isPriceOnlyText$1(text2)) title = text2;
      }
    });
    var price = "Price not available";
    var spans = ad.querySelectorAll("span, div, p");
    for (var pi = 0; pi < spans.length; pi++) {
      var text = spans[pi].textContent.trim();
      if ((text.indexOf("€") !== -1 || text.indexOf("EUR") !== -1) && text.length < 20 && text.indexOf("...") === -1) {
        price = text;
        break;
      }
    }
    var url = ad.href || (ad.querySelector('a[href*="/iad/"]') ? ad.querySelector('a[href*="/iad/"]').href : "URL not available");
    return { title, price, url };
  }
  function descSelectors$1() {
    return [
      '[data-testid="ad-description-Beschreibung"]',
      '[data-testid*="description"]',
      ".ad-description",
      '[class*="description"]'
    ];
  }
  function goToNextPage$1(currentPage2) {
    var nextButton = document.querySelector('[data-testid="pagination-bottom-next-button"]');
    if (!nextButton) {
      var targetPage = currentPage2 + 1;
      var paginationLinks = document.querySelectorAll('[data-testid*="pagination"] a, nav a');
      for (var li = 0; li < paginationLinks.length; li++) {
        var btn = paginationLinks[li];
        var text = (btn.textContent || "").trim();
        var href = btn.getAttribute("href");
        if (text && (text === String(targetPage) || text.toLowerCase().indexOf("weiter") !== -1 || text.toLowerCase().indexOf("next") !== -1 || text === "›" || text === ">")) {
          if (!btn.hasAttribute("disabled") && btn.getAttribute("aria-disabled") !== "true" && href) {
            nextButton = btn;
            break;
          }
        }
      }
    }
    if (nextButton) {
      var isDisabled = nextButton.hasAttribute("disabled");
      var ariaDisabled = nextButton.getAttribute("aria-disabled") === "true";
      var href = nextButton.getAttribute("href");
      console.log("[MDF-WH] Next button disabled:", isDisabled, "| aria-disabled:", ariaDisabled, "| href:", href);
      if (!isDisabled && !ariaDisabled && href) {
        try {
          if (new URL(href, location.href).href === location.href) {
            console.log("[MDF-WH] Next button points to same page - skipped");
            return false;
          }
        } catch (e) {
          console.warn("[MDF-WH] Invalid URL in next button:", href, e);
          return false;
        }
        return href;
      }
      console.log("[MDF-WH] Next button not usable");
    }
    return false;
  }
  var MIN_TITLE_LENGTH = 5;
  function isPriceOnlyText(text) {
    return /^\s*[\d.,]+\s*€?\s*(VB)?\s*$/i.test(text);
  }
  function findAds() {
    var adSelectors = ["article[data-adid]", "li.ad-listitem", ".aditem"];
    for (var si = 0; si < adSelectors.length; si++) {
      var entries = document.querySelectorAll(adSelectors[si]);
      if (entries.length > 0) {
        console.log("[MDF-KA] Found " + entries.length + " ads (selector: " + adSelectors[si] + ")");
        return { adEntries: entries };
      }
    }
    var uniqueUrls = new Set();
    var uniqueAds = [];
    var urlRegex = /\/s-anzeige\/.*\/\d+/;
    document.querySelectorAll('a[href*="/s-anzeige/"]').forEach(function(link) {
      var url = link.href;
      if (urlRegex.test(url) && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        var container = link.closest("article, li, .aditem, .ad-listitem, [data-adid]");
        uniqueAds.push(container || link);
      }
    });
    if (uniqueAds.length > 0) {
      console.log("[MDF-KA] Found " + uniqueAds.length + " ads (fallback method)");
      return { adEntries: uniqueAds };
    }
    return null;
  }
  function extractBasicInfo(ad) {
    var title = "Title not available";
    [].concat(["h2", "h3", 'a[class*="ellipsis"]', '[class*="title"]']).forEach(function(s) {
      var el = ad.querySelector(s);
      if (el) {
        var text2 = el.textContent.trim();
        if (text2.length > MIN_TITLE_LENGTH && !isPriceOnlyText(text2)) title = text2;
      }
    });
    var price = "Price not available";
    var spans = ad.querySelectorAll("span, div, p, strong");
    for (var pi = 0; pi < spans.length; pi++) {
      var text = spans[pi].textContent.trim();
      if ((text.indexOf("€") !== -1 || text.indexOf("EUR") !== -1 || /^(\d[\d.,]*\s*€?\s*)?VB$/i.test(text.trim())) && text.length < 30 && text.indexOf("...") === -1) {
        price = text;
        break;
      }
    }
    var url = ad.getAttribute("data-href") || ad.href || (ad.querySelector('a[href*="/s-anzeige/"]') ? ad.querySelector('a[href*="/s-anzeige/"]').href : "URL not available");
    if (url && url.indexOf("/") === 0) {
      url = "https://www.kleinanzeigen.de" + url;
    }
    return { title, price, url };
  }
  function descSelectors() {
    return [
      "#viewad-description-text",
      ".ad-description",
      'div[class*="description"]',
      '[class*="description"]'
    ];
  }
  function goToNextPage(currentPage2) {
    var nextButton = document.querySelector('a[class*="pagination-next"]');
    if (!nextButton) {
      var paginationLinks = document.querySelectorAll('[class*="pagination"] a, nav a, .pagination a');
      for (var li = 0; li < paginationLinks.length; li++) {
        var linkEl = paginationLinks[li];
        var text = (linkEl.textContent || "").trim().toLowerCase();
        var href = linkEl.getAttribute("href");
        if ((text === "weiter" || text === ">" || text === "›") && href && href.indexOf("seite:") !== -1) {
          nextButton = linkEl;
          break;
        }
      }
    }
    if (!nextButton) {
      var targetPage = currentPage2 + 1;
      var seiteLinks = document.querySelectorAll('a[href*="seite:"]');
      for (var sl = 0; sl < seiteLinks.length; sl++) {
        var href = seiteLinks[sl].getAttribute("href");
        if (href && href.indexOf("seite:" + targetPage) !== -1) {
          nextButton = seiteLinks[sl];
          break;
        }
      }
    }
    if (nextButton) {
      var href = nextButton.getAttribute("href");
      console.log("[MDF-KA] Next button href:", href);
      if (href) {
        try {
          if (new URL(href, location.href).href === location.href) {
            console.log("[MDF-KA] Next button points to same page - skipped");
            return false;
          }
        } catch (e) {
          console.warn("[MDF-KA] Invalid URL in next button:", href, e);
          return false;
        }
        return href;
      }
      console.log("[MDF-KA] Next button has no href");
    }
    return false;
  }
  function createShadowContainer(opts) {
    opts = opts || {};
    var host = document.createElement(opts.tag || "div");
    if (opts.id) host.id = opts.id;
    if (opts.className) host.className = opts.className;
    var root = host.attachShadow({ mode: "closed" });
    if (opts.styles) {
      var style = document.createElement("style");
      style.textContent = opts.styles;
      root.appendChild(style);
    }
    document.body.appendChild(host);
    return { host, root };
  }
  function createToast(message, opts) {
    opts = opts || {};
    var duration = opts.duration || 3e3;
    var type = opts.type || "info";
    var colors = { info: "#2196F3", success: "#4CAF50", error: "#F44336", warn: "#FF9800" };
    var toast = document.createElement("div");
    var root = toast.attachShadow({ mode: "closed" });
    var style = document.createElement("style");
    style.textContent = [
      ":host { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:2147483647;",
      "background:" + (colors[type] || colors.info) + "; color:#fff; padding:10px 20px; border-radius:6px;",
      "font:13px/1.4 system-ui,sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.3);",
      "opacity:0; transition:opacity 0.3s ease; pointer-events:none; max-width:80vw; }",
      ":host(.show) { opacity:1; }"
    ].join("");
    var span = document.createElement("span");
    span.textContent = message;
    root.appendChild(style);
    root.appendChild(span);
    document.body.appendChild(toast);
    requestAnimationFrame(function() {
      toast.classList.add("show");
    });
    setTimeout(function() {
      toast.classList.remove("show");
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
    return toast;
  }
  function createStatusBar(opts) {
    opts = opts || {};
    var accent = opts.accentColor || "#2196F3";
    var container = createShadowContainer({
      styles: [
        ":host { position:fixed; bottom:0; right:0; z-index:2147483646;",
        "background:#1e1e1e; color:#e0e0e0; font:12px system-ui,sans-serif;",
        "padding:8px 14px; border-radius:8px 0 0 0; min-width:200px; max-width:360px;",
        "border-top:3px solid " + accent + "; border-left:3px solid " + accent + "; }",
        ".text { margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
        ".bar { height:4px; background:#333; border-radius:2px; overflow:hidden; }",
        ".fill { height:100%; width:0%; background:" + accent + "; transition:width 0.3s ease; }"
      ].join("")
    });
    var textEl = document.createElement("div");
    textEl.className = "text";
    var fillEl = document.createElement("div");
    fillEl.className = "fill";
    var barEl = document.createElement("div");
    barEl.className = "bar";
    barEl.appendChild(fillEl);
    container.root.appendChild(textEl);
    container.root.appendChild(barEl);
    return {
      host: container.host,
      root: container.root,
      setText: function(msg) {
        textEl.textContent = msg;
      },
      setProgress: function(pct) {
        fillEl.style.width = Math.min(100, Math.max(0, pct)) + "%";
      },
      remove: function() {
        if (container.host.parentNode) container.host.parentNode.removeChild(container.host);
      }
    };
  }
  function esc(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  var statusBar = null;
  function renderSettingsView(prefix, settings, savedResults, siteName) {
    var autoContext = settings.searchContext || "";
    if (!autoContext) {
      var urlParams = new URLSearchParams(window.location.search);
      var keyword = urlParams.get("keyword");
      if (keyword) {
        autoContext = keyword;
      } else if (siteName === "KLEINANZEIGEN") {
        var pathMatch = window.location.pathname.match(/\/s-([^/]+)/);
        if (pathMatch) autoContext = decodeURIComponent(pathMatch[1].replace(/-/g, " "));
      }
    }
    var savedTs = "";
    if (savedResults && savedResults.timestamp) {
      var ts = savedResults.timestamp;
      savedTs = ts.indexOf("T") !== -1 ? new Date(ts).toLocaleString("de-DE") : ts;
    }
    return [
      '<div id="' + prefix + '-settings-view" style="padding: 25px;">',
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">',
      '<h2 style="margin: 0; color: #333; font-size: 20px;">🔍 Deal Finder</h2>',
      '<button id="' + prefix + '-close-btn-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; line-height: 1;">×</button>',
      "</div>",
      savedResults ? '<div style="background: #e8f5e9; padding: 12px; border-radius: 4px; margin-bottom: 18px; border-left: 3px solid #4caf50;"><div style="font-size: 13px; color: #2e7d32; font-weight: 600; margin-bottom: 6px;">✅ ' + savedResults.deals.length + ' gespeicherte Deals</div><div style="font-size: 11px; color: #558b2f;">Analysierte Seiten: ' + savedResults.pages + " | " + savedTs + '</div><button id="' + prefix + '-show-results-btn" style="width:100%;margin-top:8px;padding:8px;background:#4caf50;color:white;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">📊 Ergebnisse anzeigen</button></div>' : "",
      '<div style="margin-bottom: 18px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Gemini API Key</label>',
      '<input type="password" id="' + prefix + '-api-key" placeholder="AIza..." value="' + esc(settings.apiKey) + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
      '<small style="color:#888;font-size:11px;"><a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#667eea;">Kostenlosen Key holen</a></small>',
      "</div>",
      '<div style="margin-bottom: 18px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Suchkontext</label>',
      '<textarea id="' + prefix + '-search-context" placeholder="z.B. Gaming PC RTX 3060, Neupreis €800-1000"',
      ' style="width:100%;height:70px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit;">' + esc(autoContext) + "</textarea>",
      "</div>",
      '<div style="margin-bottom: 18px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">AI-Picks pro Seite</label>',
      '<input type="number" id="' + prefix + '-top-x" min="1" max="10" value="' + settings.topX + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
      '<small style="color:#888;font-size:11px;">Anzahl der besten Deals, die die AI pro Seite auswählt (1–10)</small>',
      "</div>",
      '<div style="margin-bottom: 18px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">Max. Seiten</label>',
      '<input type="number" id="' + prefix + '-max-pages" min="1" max="100" value="' + (settings.maxPages || 10) + '"',
      ' style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">',
      "</div>",
      '<div style="margin-bottom: 20px;">',
      '<label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px;">AI Model</label>',
      '<div id="' + prefix + '-model-area"></div>',
      "</div>",
      '<div id="' + prefix + '-progress-container" style="display:none;margin-bottom:18px;padding:12px;background:#f8f9fa;border-radius:4px;border-left:3px solid #667eea;">',
      '<div id="' + prefix + '-progress-text" style="font-weight:600;color:#333;margin-bottom:8px;font-size:12px;">Bereit...</div>',
      '<div style="background:#e0e0e0;border-radius:4px;height:6px;overflow:hidden;">',
      '<div id="' + prefix + '-progress-bar" style="background:#667eea;height:100%;width:0%;transition:width 0.3s;"></div>',
      "</div></div>",
      '<div id="' + prefix + '-live-ranking" style="display:none;margin-bottom:18px;padding:12px;background:#fff8e1;border-radius:4px;border-left:3px solid #ffc107;">',
      '<h3 style="margin:0 0 10px 0;font-size:14px;color:#333;">🏆 Live Top-Deals</h3>',
      '<div id="' + prefix + '-live-ranking-content" style="font-size:12px;color:#555;"></div>',
      "</div>",
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">',
      '<button id="' + prefix + '-start-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#28a745;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">▶ Start</button>',
      '<button id="' + prefix + '-pause-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#ffc107;color:#333;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">⏸ Pause</button>',
      '<button id="' + prefix + '-stop-btn" style="flex:1;min-width:100px;padding:10px 16px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;display:none;">⏹ Stopp</button>',
      "</div></div>"
    ].join("\n");
  }
  function renderResultsView(prefix, deals) {
    var items = deals.map(function(deal, index) {
      var safeUrl = deal.url && deal.url.startsWith("https://") ? deal.url : "#";
      var safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
      var scoreBar = safeScore !== null ? '<div style="margin-bottom:6px;"><div style="font-size:10px;color:#888;margin-bottom:2px;">Score: ' + safeScore + '/100</div><div style="background:#e0e0e0;border-radius:4px;height:4px;overflow:hidden;"><div style="background:' + (safeScore >= 70 ? "#28a745" : safeScore >= 40 ? "#ffc107" : "#dc3545") + ";height:100%;width:" + safeScore + '%;"></div></div></div>' : "";
      var medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "#" + (index + 1);
      var borderColor = index === 0 ? "#ffc107" : index === 1 ? "#28a745" : index === 2 ? "#17a2b8" : "#6c757d";
      return [
        '<div style="padding:15px;background:' + (index === 0 ? "#fff8e1" : "#f8f9fa") + ";border-radius:4px;margin-bottom:12px;border-left:3px solid " + borderColor + ';">',
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">',
        '<div style="font-weight:700;color:#333;font-size:14px;">' + medal + " " + esc(deal.title) + "</div>",
        '<div style="font-size:11px;color:#888;white-space:nowrap;margin-left:8px;">S.' + deal.page + "</div>",
        "</div>",
        '<div style="font-weight:600;color:#28a745;font-size:15px;margin-bottom:8px;">' + esc(deal.price) + "</div>",
        scoreBar,
        '<div style="font-size:11px;color:#666;margin-bottom:8px;font-style:italic;">💡 ' + esc(deal.reasoning || "Keine Begründung verfügbar") + "</div>",
        deal.description ? '<div style="font-size:11px;color:#555;line-height:1.4;margin-bottom:8px;max-height:60px;overflow:hidden;">' + esc(deal.description.substring(0, 150)) + (deal.description.length > 150 ? "..." : "") + "</div>" : "",
        '<a href="' + esc(safeUrl) + '" target="_blank" style="font-size:11px;color:#667eea;text-decoration:none;">→ Anzeige öffnen</a>',
        "</div>"
      ].join("\n");
    }).join("\n");
    return [
      '<div id="' + prefix + '-results-view" style="padding: 25px;">',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">',
      '<h2 style="margin:0;color:#333;font-size:20px;">🏆 Top-Deals</h2>',
      '<button id="' + prefix + '-close-btn-x" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;padding:0;line-height:1;">×</button>',
      "</div>",
      '<div style="background:#667eea;color:white;padding:12px;border-radius:4px;margin-bottom:20px;text-align:center;">',
      '<div style="font-size:24px;font-weight:700;margin-bottom:4px;">' + deals.length + "</div>",
      '<div style="font-size:12px;">Top-Deals gefunden</div>',
      "</div>",
      '<div style="margin-bottom:15px;">' + items + "</div>",
      '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">',
      '<button id="' + prefix + '-export-markdown-btn" style="flex:1;padding:10px 12px;background:#28a745;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">📋 Markdown</button>',
      '<button id="' + prefix + '-export-json-btn" style="flex:1;padding:10px 12px;background:#17a2b8;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">📄 JSON</button>',
      '<button id="' + prefix + '-export-csv-btn" style="flex:1;padding:10px 12px;background:#6f42c1;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">📊 CSV</button>',
      '<button id="' + prefix + '-clear-results-btn" style="padding:10px 12px;background:#dc3545;color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">🗑️</button>',
      "</div>",
      '<button id="' + prefix + '-back-to-settings" style="width:100%;padding:10px 16px;background:#6c757d;color:white;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">← Zurück zu Einstellungen</button>',
      "</div>"
    ].join("\n");
  }
  function updateLiveRanking(prefix, allTopDeals2, cachedSettings2) {
    var container = document.getElementById(prefix + "-live-ranking");
    var content = document.getElementById(prefix + "-live-ranking-content");
    if (!container || !content) return;
    if (!allTopDeals2 || allTopDeals2.length === 0) {
      container.style.display = "none";
      return;
    }
    var topX = cachedSettings2 && cachedSettings2.topX || 3;
    container.style.display = "block";
    var sorted = allTopDeals2.slice().sort(function(a, b) {
      return (b && b.score || 0) - (a && a.score || 0);
    });
    var topItems = sorted.slice(0, Math.min(3, topX));
    content.innerHTML = topItems.map(function(deal, idx) {
      var safeScore = Number.isFinite(Number(deal.score)) ? Math.min(100, Math.max(0, Number(deal.score))) : null;
      var border = idx < topItems.length - 1 ? "border-bottom:1px solid #ffe082;" : "";
      return [
        '<div style="margin-bottom:8px;padding-bottom:8px;' + border + '">',
        '<div style="font-weight:600;color:#333;">' + (idx + 1) + ". " + esc(deal.title) + "</div>",
        '<div style="color:#28a745;font-weight:600;">' + esc(deal.price) + "</div>",
        safeScore !== null ? '<div style="font-size:10px;color:#888;">Score: ' + safeScore + "/100</div>" : "",
        '<div style="font-size:10px;color:#888;">Seite ' + deal.page + "</div>",
        "</div>"
      ].join("\n");
    }).join("\n");
  }
  function updateProgress(prefix, text, percentage, type, isWH) {
    type = type || "info";
    var container = document.getElementById(prefix + "-progress-container");
    var progressText = document.getElementById(prefix + "-progress-text");
    var progressBar = document.getElementById(prefix + "-progress-bar");
    var borderColor = type === "error" ? "#dc3545" : type === "warning" ? "#ffc107" : type === "success" ? "#28a745" : "#667eea";
    var textColor = type === "error" ? "#dc3545" : type === "warning" ? "#ffc107" : type === "success" ? "#28a745" : "#333";
    var barColor = type === "error" ? "#dc3545" : type === "warning" ? "#ffc107" : type === "success" ? "#28a745" : "#007bff";
    if (container) {
      container.style.display = "block";
      container.style.borderLeftColor = borderColor;
    }
    if (progressText) {
      progressText.textContent = text;
      progressText.style.color = textColor;
    }
    if (progressBar) {
      progressBar.style.width = percentage + "%";
      progressBar.style.backgroundColor = barColor;
      progressBar.style.transition = "width 0.3s ease, background-color 0.3s ease";
    }
    if (!statusBar) {
      var accent = isWH ? "#667eea" : "#86a542";
      statusBar = createStatusBar({ accentColor: accent });
    }
    statusBar.setText(text);
    statusBar.setProgress(percentage);
  }
  function showWarning(prefix, message, percentage, isWH) {
    updateProgress(prefix, "Warnung: " + message, percentage, "warning", isWH);
  }
  function resetUI(prefix) {
    var startBtn = document.getElementById(prefix + "-start-btn");
    var pauseBtn = document.getElementById(prefix + "-pause-btn");
    var stopBtn = document.getElementById(prefix + "-stop-btn");
    var apiKeyInput = document.getElementById(prefix + "-api-key");
    var searchInput = document.getElementById(prefix + "-search-context");
    var topXInput = document.getElementById(prefix + "-top-x");
    if (startBtn) startBtn.style.display = "block";
    if (pauseBtn) pauseBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "none";
    if (apiKeyInput) apiKeyInput.disabled = false;
    if (searchInput) searchInput.disabled = false;
    if (topXInput) topXInput.disabled = false;
    if (statusBar) {
      try {
        statusBar.remove();
      } catch (e) {
      }
      statusBar = null;
    }
  }
  function setUIRunningState(prefix) {
    var startBtn = document.getElementById(prefix + "-start-btn");
    var pauseBtn = document.getElementById(prefix + "-pause-btn");
    var stopBtn = document.getElementById(prefix + "-stop-btn");
    var apiKeyInput = document.getElementById(prefix + "-api-key");
    var searchInput = document.getElementById(prefix + "-search-context");
    var topXInput = document.getElementById(prefix + "-top-x");
    if (startBtn) startBtn.style.display = "none";
    if (pauseBtn) pauseBtn.style.display = "block";
    if (stopBtn) stopBtn.style.display = "block";
    if (apiKeyInput) apiKeyInput.disabled = true;
    if (searchInput) searchInput.disabled = true;
    if (topXInput) topXInput.disabled = true;
  }
  var SIDEBAR_WIDTH = "400px";
  function createModal(prefix) {
    var modalId = prefix + "-dealfinder-modal";
    if (document.getElementById(modalId)) return;
    var modal = document.createElement("div");
    modal.id = modalId;
    modal.style.cssText = [
      "display: none; position: fixed; top: 0; right: 0; width: 400px; height: 100vh;",
      "background: white; z-index: 999999; box-shadow: -5px 0 20px rgba(0,0,0,0.2);",
      "overflow-y: auto; transition: transform 0.3s ease;"
    ].join(" ");
    document.body.appendChild(modal);
  }
  function openModal(prefix) {
    var modal = document.getElementById(prefix + "-dealfinder-modal");
    var floatBtn = document.getElementById(prefix + "-dealfinder-btn");
    if (modal) modal.style.display = "block";
    if (floatBtn) floatBtn.style.display = "none";
    document.documentElement.style.transition = "margin-right 0.3s ease";
    document.documentElement.style.marginRight = SIDEBAR_WIDTH;
  }
  function closeModal(prefix, isRunning2) {
    if (isRunning2) {
      var btn = document.getElementById(prefix + "-close-btn-x");
      if (btn) {
        btn.style.color = "#dc3545";
        btn.title = "Crawl läuft - erst stoppen";
        setTimeout(function() {
          btn.style.color = "#999";
          btn.title = "";
        }, 1e3);
      }
      return;
    }
    var modal = document.getElementById(prefix + "-dealfinder-modal");
    var floatBtn = document.getElementById(prefix + "-dealfinder-btn");
    if (modal) modal.style.display = "none";
    if (floatBtn) floatBtn.style.display = "block";
    document.documentElement.style.marginRight = "";
  }
  function attachSettingsListeners(prefix, callbacks) {
    var startBtn = document.getElementById(prefix + "-start-btn");
    var pauseBtn = document.getElementById(prefix + "-pause-btn");
    var stopBtn = document.getElementById(prefix + "-stop-btn");
    var closeBtn = document.getElementById(prefix + "-close-btn-x");
    var showResultsBtn = document.getElementById(prefix + "-show-results-btn");
    var apiKeyInput = document.getElementById(prefix + "-api-key");
    var searchContextInput = document.getElementById(prefix + "-search-context");
    if (startBtn && callbacks.start) {
      startBtn.addEventListener("click", function() {
        callbacks.start()["catch"](function(error) {
          console.error("[MDF-UI] Unhandled error in start:", error);
          updateProgress(prefix, "Fehler: " + error.message, 0, "error");
          resetUI(prefix);
        });
      });
    }
    if (pauseBtn && callbacks.pause) {
      pauseBtn.addEventListener("click", callbacks.pause);
    }
    if (stopBtn && callbacks.stop) {
      stopBtn.addEventListener("click", callbacks.stop);
    }
    if (closeBtn && callbacks.close) {
      closeBtn.addEventListener("click", callbacks.close);
    }
    if (showResultsBtn && callbacks.showSavedResults) {
      showResultsBtn.addEventListener("click", callbacks.showSavedResults);
    }
    if (apiKeyInput && callbacks.apiKeyChange) {
      (function(input) {
        input.addEventListener("blur", function() {
          var newKey = input.value.trim();
          callbacks.apiKeyChange(newKey);
        });
      })(apiKeyInput);
    }
    if (searchContextInput && callbacks.searchContextChange) {
      (function(input) {
        input.addEventListener("blur", function() {
          var newContext = input.value.trim();
          callbacks.searchContextChange(newContext);
        });
      })(searchContextInput);
    }
    [startBtn, pauseBtn, stopBtn, showResultsBtn].forEach(function(btn) {
      if (btn) {
        btn.addEventListener("mouseenter", function() {
          btn.style.opacity = "0.9";
        });
        btn.addEventListener("mouseleave", function() {
          btn.style.opacity = "1";
        });
      }
    });
  }
  function attachResultsListeners(prefix, callbacks) {
    var closeBtn = document.getElementById(prefix + "-close-btn-x");
    var backBtn = document.getElementById(prefix + "-back-to-settings");
    var exportMdBtn = document.getElementById(prefix + "-export-markdown-btn");
    var exportJsonBtn = document.getElementById(prefix + "-export-json-btn");
    var exportCsvBtn = document.getElementById(prefix + "-export-csv-btn");
    var clearBtn = document.getElementById(prefix + "-clear-results-btn");
    if (closeBtn && callbacks.close) closeBtn.addEventListener("click", callbacks.close);
    if (backBtn && callbacks.backToSettings) backBtn.addEventListener("click", callbacks.backToSettings);
    if (exportMdBtn && callbacks.exportMarkdown) exportMdBtn.addEventListener("click", callbacks.exportMarkdown);
    if (exportJsonBtn && callbacks.exportJSON) exportJsonBtn.addEventListener("click", callbacks.exportJSON);
    if (exportCsvBtn && callbacks.exportCSV) exportCsvBtn.addEventListener("click", callbacks.exportCSV);
    if (clearBtn && callbacks.clearResults) clearBtn.addEventListener("click", callbacks.clearResults);
    [closeBtn, backBtn, exportMdBtn, exportJsonBtn, exportCsvBtn, clearBtn].forEach(function(btn) {
      if (btn) {
        btn.addEventListener("mouseenter", function() {
          btn.style.opacity = "0.9";
        });
        btn.addEventListener("mouseleave", function() {
          btn.style.opacity = "1";
        });
      }
    });
  }
  function switchToResultsView(prefix, deals) {
    var modal = document.getElementById(prefix + "-dealfinder-modal");
    if (!modal) return;
    modal.innerHTML = renderResultsView(prefix, deals || []);
  }
  function createDealFinderButton(prefix, gradient) {
    var buttonId = prefix + "-dealfinder-btn";
    if (document.getElementById(buttonId)) return;
    var button = document.createElement("button");
    button.id = buttonId;
    button.textContent = "Deal Finder";
    button.style.cssText = [
      "position: fixed; top: 140px; right: 0; z-index: 99999;",
      "padding: 12px 16px; background: " + gradient + ";",
      "color: white; border: none; border-radius: 8px 0 0 8px; cursor: pointer;",
      "box-shadow: -3px 3px 12px rgba(0,0,0,0.25); font-size: 15px; font-weight: bold;",
      "transition: padding-right 0.2s ease, box-shadow 0.2s ease;"
    ].join(" ");
    button.addEventListener("mouseenter", function() {
      button.style.paddingRight = "22px";
      button.style.boxShadow = "-5px 4px 18px rgba(0,0,0,0.35)";
    });
    button.addEventListener("mouseleave", function() {
      button.style.paddingRight = "16px";
      button.style.boxShadow = "-3px 3px 12px rgba(0,0,0,0.25)";
    });
    document.body.appendChild(button);
    return button;
  }
  async function exportMarkdown(prefix, rankingEngineRef) {
    var rankEng = rankingEngineRef;
    if (!rankEng) {
      createToast("Ranking engine not available!", { type: "error" });
      return;
    }
    var results = await rankEng.loadResults(prefix);
    if (!results) {
      createToast("Keine Results verfügbar!", { type: "error" });
      return;
    }
    var siteName = prefix === "wh" ? "WILLHABEN" : "KLEINANZEIGEN";
    var md = rankEng.generateMarkdown(results.deals, results.pages, results.timestamp, siteName);
    try {
      await navigator.clipboard.writeText(md);
      var btn = document.getElementById(prefix + "-export-markdown-btn");
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = "Kopiert!";
        setTimeout(function() {
          btn.textContent = orig;
        }, 2e3);
      }
    } catch (error) {
      createToast("Fehler beim Kopieren. Bitte Fenster fokussieren und nochmal versuchen.", { type: "error", duration: 5e3 });
    }
  }
  async function exportJSON(prefix) {
    var raw = await GM.getValue(prefix + "_dealfinder_results", null);
    if (!raw) {
      createToast("Keine Results verfügbar!", { type: "error" });
      return;
    }
    var savedResults;
    try {
      savedResults = JSON.parse(raw);
    } catch (e) {
      return;
    }
    var blob = new Blob([JSON.stringify(savedResults, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "deals-" + Date.now() + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1e3);
  }
  async function exportCSV(prefix) {
    var raw = await GM.getValue(prefix + "_dealfinder_results", null);
    if (!raw) {
      createToast("Keine Results verfügbar!", { type: "error" });
      return;
    }
    var savedResults;
    try {
      savedResults = JSON.parse(raw);
    } catch (e) {
      return;
    }
    var header = ["Rang", "Titel", "Preis", "Score", "Begründung", "Seite", "URL"];
    var rows = savedResults.deals.map(function(d, i) {
      return [
        i + 1,
        '"' + (d.title || "").replace(/"/g, '""') + '"',
        '"' + (d.price || "").replace(/"/g, '""') + '"',
        d.score !== void 0 && Number.isFinite(Number(d.score)) ? d.score : "",
        '"' + (d.reasoning || "").replace(/"/g, '""') + '"',
        d.page || "",
        '"' + (d.url || "").replace(/"/g, '""') + '"'
      ];
    });
    var csv = header.join(",") + "\n" + rows.map(function(r) {
      return r.join(",");
    }).join("\n");
    var bom = String.fromCharCode(65279);
    var blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "deals-" + Date.now() + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1e3);
  }
  // @license      MIT
  var IS_WH = window.location.hostname.includes("willhaben.at");
  var P = IS_WH ? "wh" : "ka";
  var SITE_NAME = IS_WH ? "WILLHABEN" : "KLEINANZEIGEN";
  var BTN_GRADIENT = IS_WH ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "linear-gradient(135deg, #86a542 0%, #2d2d2d 100%)";
  var Logger = createLogger("Marketplace Deal Finder");
  var SCRAPER = IS_WH ? { findAds: findAds$1, extractBasicInfo: extractBasicInfo$1, descSelectors: descSelectors$1, goToNextPage: goToNextPage$1 } : { findAds, extractBasicInfo, descSelectors, goToNextPage };
  var isRunning = false;
  var isPaused = false;
  var shouldStop = false;
  var captchaPaused = false;
  var allTopDeals = [];
  var currentPage = 1;
  var descriptionCache = new Map();
  var initRetries = 0;
  var cachedSettings = null;
  async function waitIfPaused() {
    while (isPaused && !shouldStop) {
      await new Promise(function(r) {
        setTimeout(r, PAUSE_POLL_INTERVAL);
      });
    }
  }
  function fetchFullDescription(url, retryCount) {
    retryCount = retryCount || 0;
    if (descriptionCache.has(url)) {
      var desc = descriptionCache.get(url);
      descriptionCache.delete(url);
      descriptionCache.set(url, desc);
      return Promise.resolve({ success: true, description: desc });
    }
    var descSelectors2 = SCRAPER.descSelectors();
    return new Promise(function(resolve) {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: REQUEST_TIMEOUT,
        onload: function(response) {
          try {
            if (response.status >= 200 && response.status < 300) {
              var parser = new DOMParser();
              var doc = parser.parseFromString(response.responseText, "text/html");
              var fullDesc = null;
              for (var si = 0; si < descSelectors2.length; si++) {
                var element = doc.querySelector(descSelectors2[si]);
                if (element && element.textContent.trim().length > 20) {
                  fullDesc = element.textContent.replace(/\s+/g, " ").trim();
                  break;
                }
              }
              if (fullDesc) {
                if (descriptionCache.size >= MAX_CACHE_SIZE) {
                  var firstKey = descriptionCache.keys().next().value;
                  descriptionCache.delete(firstKey);
                }
                descriptionCache.set(url, fullDesc);
                resolve({ success: true, description: fullDesc });
                return;
              } else if (retryCount < MAX_RETRIES && !shouldStop) {
                setTimeout(function() {
                  fetchFullDescription(url, retryCount + 1).then(resolve);
                }, 1e3);
                return;
              }
            } else if (retryCount < MAX_RETRIES && !shouldStop) {
              setTimeout(function() {
                fetchFullDescription(url, retryCount + 1).then(resolve);
              }, 1e3);
              return;
            }
          } catch (e) {
            if (retryCount < MAX_RETRIES && !shouldStop) {
              setTimeout(function() {
                fetchFullDescription(url, retryCount + 1).then(resolve);
              }, 1e3);
              return;
            }
          }
          resolve({ success: false, description: "Description not available" });
        },
        onerror: function() {
          if (retryCount < MAX_RETRIES && !shouldStop) {
            setTimeout(function() {
              fetchFullDescription(url, retryCount + 1).then(resolve);
            }, 1e3);
          } else {
            resolve({ success: false, description: "Description not available" });
          }
        },
        ontimeout: function() {
          if (retryCount < MAX_RETRIES && !shouldStop) {
            setTimeout(function() {
              fetchFullDescription(url, retryCount + 1).then(resolve);
            }, 1e3);
          } else {
            resolve({ success: false, description: "Description not available" });
          }
        }
      });
    });
  }
  async function saveCrawlStateAndNavigate(href, settings) {
    var state = {
      currentPage,
      currentUrl: window.location.href,
      allTopDeals,
      maxPages: settings.maxPages
    };
    await GM.setValue(P + "_dealfinder_crawl_state", JSON.stringify(state));
    window.location.href = href;
  }
  async function startDealFinder() {
    var apiKey = document.getElementById(P + "-api-key").value.trim();
    var searchContext = document.getElementById(P + "-search-context").value.trim();
    var topX = parseInt(document.getElementById(P + "-top-x").value);
    var maxPages = parseInt(document.getElementById(P + "-max-pages").value) || 10;
    var modelEl = document.getElementById(P + "-model-select");
    var model = modelEl ? modelEl.value : MODEL.FLASH;
    if (!apiKey) {
      alert("Bitte gib deinen Gemini API Key ein!");
      return;
    }
    if (!searchContext) {
      alert("Bitte gib einen Suchkontext ein!");
      return;
    }
    if (!Number.isFinite(topX) || topX < 1 || topX > 10) {
      alert("AI-Picks muss zwischen 1 und 10 liegen!");
      return;
    }
    if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 100) {
      alert("Maximale Seiten muss zwischen 1 und 100 liegen!");
      return;
    }
    var currentSettings = await loadSettings(P, cachedSettings);
    cachedSettings = currentSettings.cachedSettings;
    var settings = currentSettings.settings;
    settings.apiKey = apiKey;
    settings.searchContext = searchContext;
    settings.topX = topX;
    settings.model = model;
    settings.maxPages = maxPages;
    await saveSetting(P + "_dealfinder_settings", JSON.stringify(settings));
    cachedSettings = deepCopySettings(settings);
    if ("Notification" in window) {
      Notification.requestPermission()["catch"](function() {
      });
    }
    currentPage = 1;
    allTopDeals = [];
    isRunning = true;
    isPaused = false;
    shouldStop = false;
    captchaPaused = false;
    setUIRunningState(P);
    try {
      await processCurrentPage(apiKey, searchContext, topX, model, maxPages);
    } catch (error) {
      Logger.error("Error:", error);
      updateProgress(P, "Fehler: " + error.message, 0, "error", IS_WH);
      if (allTopDeals.length > 0) {
        await finishDealFinder();
      } else {
        resetUI(P);
        alert("Fehler: " + error.message);
      }
    }
  }
  function pauseDealFinder() {
    isPaused = true;
    var pauseBtn = document.getElementById(P + "-pause-btn");
    if (!pauseBtn) return;
    pauseBtn.textContent = "Fortsetzen";
    pauseBtn.style.background = "#28a745";
    pauseBtn.removeEventListener("click", pauseDealFinder);
    pauseBtn.addEventListener("click", resumeDealFinder);
    updateProgress(P, "Pausiert - Klicke Fortsetzen...", 50, "warning", IS_WH);
  }
  function resumeDealFinder() {
    isPaused = false;
    var pauseBtn = document.getElementById(P + "-pause-btn");
    if (!pauseBtn) return;
    pauseBtn.textContent = "Pause";
    pauseBtn.style.background = "#ffc107";
    pauseBtn.removeEventListener("click", resumeDealFinder);
    pauseBtn.addEventListener("click", pauseDealFinder);
    if (isRunning && captchaPaused) {
      captchaPaused = false;
      var settings = cachedSettings || DEFAULT_SETTINGS;
      var maxPages = settings.maxPages || 10;
      processCurrentPage(
        settings.apiKey,
        settings.searchContext,
        settings.topX,
        settings.model || MODEL.FLASH,
        maxPages
      )["catch"](function(error) {
        Logger.error("Resume error:", error);
        updateProgress(P, "Fehler: " + error.message, 0, "error", IS_WH);
        resetUI(P);
      });
    }
  }
  async function stopDealFinder() {
    shouldStop = true;
    isPaused = false;
    captchaPaused = false;
    await GM.setValue(P + "_dealfinder_crawl_state", null);
    Logger.log("Crawl stopped by user");
    updateProgress(P, "Stoppe nach aktueller Seite...", 95, "warning", IS_WH);
  }
  async function processCurrentPage(apiKey, searchContext, topX, model, maxPages) {
    maxPages = maxPages || 10;
    await waitIfPaused();
    if (shouldStop) {
      await finishDealFinder();
      return;
    }
    if (currentPage > maxPages) {
      await finishDealFinder();
      return;
    }
    updateProgress(P, "Seite " + currentPage + ": Lade alle Anzeigen...", 10, "info", IS_WH);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await new Promise(function(r) {
      setTimeout(r, 1500);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    await new Promise(function(r) {
      setTimeout(r, 1500);
    });
    updateProgress(P, "Seite " + currentPage + ": Sammle Anzeigen...", 15, "info", IS_WH);
    var selectors = SCRAPER.findAds();
    if (!selectors) {
      var pageText = (document.title + " " + document.body.innerText).toLowerCase();
      if (pageText.indexOf("captcha") !== -1 || pageText.indexOf("challenge") !== -1) {
        captchaPaused = true;
        await saveCrawlState({
          currentPage,
          currentUrl: window.location.href,
          allTopDeals,
          maxPages
        }, P);
        pauseDealFinder();
        updateProgress(P, "CAPTCHA erkannt! Bitte lösen und Fortsetzen klicken", 50, "warning", IS_WH);
        return;
      }
      throw new Error("Keine Anzeigen gefunden");
    }
    updateProgress(P, "Seite " + currentPage + ": Sammle Basis-Daten...", 20, "info", IS_WH);
    var seenUrls = new Set();
    var adsData = [];
    var adArray = Array.from(selectors.adEntries);
    for (var adi = 0; adi < adArray.length; adi++) {
      var info = SCRAPER.extractBasicInfo(adArray[adi]);
      if (!seenUrls.has(info.url)) {
        seenUrls.add(info.url);
        adsData.push(info);
      }
    }
    Logger.log(adsData.length + " ads found (deduplicated)");
    updateProgress(P, "Seite " + currentPage + ": Lade Details (0/" + adsData.length + ")...", 30, "info", IS_WH);
    var completedCount = 0;
    for (var bi = 0; bi < adsData.length; bi += INITIAL_BATCH_SIZE) {
      await waitIfPaused();
      if (shouldStop) break;
      var batch = adsData.slice(bi, Math.min(bi + INITIAL_BATCH_SIZE, adsData.length));
      var batchFns = [];
      for (var bj = 0; bj < batch.length; bj++) {
        var adDataBatch = batch[bj];
        var idx = bi + bj;
        (function(index, url) {
          var fetchPromise = url && url.indexOf("http") === 0 ? fetchFullDescription(url) : Promise.resolve({ success: false, description: "Description not available" });
          batchFns.push(fetchPromise.then(function(result) {
            completedCount++;
            if (completedCount % 5 === 0 || completedCount === adsData.length) {
              updateProgress(
                P,
                "Seite " + currentPage + ": Lade Details (" + completedCount + "/" + adsData.length + ")...",
                30 + completedCount / adsData.length * 40,
                "info",
                IS_WH
              );
            }
            adsData[index].description = result.description;
          }));
        })(idx, adDataBatch.url);
      }
      await Promise.all(batchFns);
      if (bi + INITIAL_BATCH_SIZE < adsData.length) {
        await new Promise(function(r) {
          setTimeout(r, 500 + Math.random() * 1e3);
        });
      }
    }
    if (shouldStop) {
      await finishDealFinder();
      return;
    }
    var modelName = GEMINI_MODELS[model] ? GEMINI_MODELS[model].name : model;
    updateProgress(P, "Seite " + currentPage + ": AI analysiert Angebote...", 75, "info", IS_WH);
    Logger.log("Sending " + adsData.length + " listings to " + modelName + "...");
    var onRetry = function(status, retryNum, delaySeconds) {
      var statusText = typeof status === "number" ? "HTTP " + status : status;
      showWarning(P, "API " + statusText + " - Retry " + retryNum + " in " + delaySeconds + "s...", 75, IS_WH);
    };
    var aiResult = null;
    try {
      aiResult = await callGeminiAPI(adsData, searchContext, topX, apiKey, model, 0, onRetry, SITE_NAME);
    } catch (error) {
      if (error.message === "Aborted" || shouldStop) {
        await finishDealFinder();
        return;
      }
      throw error;
    }
    if (aiResult && aiResult.topDeals && aiResult.topDeals.length > 0) {
      Logger.log("AI found " + aiResult.topDeals.length + " top deals");
      for (var tdi = 0; tdi < aiResult.topDeals.length; tdi++) {
        var deal = aiResult.topDeals[tdi];
        deal.page = currentPage;
        allTopDeals.push(deal);
      }
      updateProgress(P, "Seite " + currentPage + ": " + aiResult.topDeals.length + " Top-Deals gefunden!", 90, "success", IS_WH);
      updateLiveRanking(P, allTopDeals, cachedSettings);
    }
    await new Promise(function(r) {
      setTimeout(r, 1500);
    });
    if (!shouldStop) {
      var nextUrl = SCRAPER.goToNextPage(currentPage);
      if (nextUrl) {
        Logger.log("Navigating to next page: " + nextUrl);
        await saveCrawlStateAndNavigate(nextUrl, { maxPages });
      } else {
        Logger.log("No more pages available - ending crawl");
        await finishDealFinder();
      }
    } else {
      await finishDealFinder();
    }
  }
  async function finishDealFinder() {
    updateProgress(P, "Erstelle finale Ranking-Liste...", 95, "info", IS_WH);
    await clearCrawlState(P);
    if (allTopDeals.length === 0) {
      updateProgress(P, "Keine Deals gefunden!", 100, "error", IS_WH);
      alert("Keine Top-Deals gefunden! Versuche andere Suchkriterien.");
      resetUI(P);
      return;
    }
    if (shouldStop) {
      updateProgress(P, "Crawl gestoppt. Speichere bisherige Deals...", 100, "warning", IS_WH);
      await saveResults({ deals: allTopDeals, pages: currentPage, timestamp: ( new Date()).toISOString() }, P);
      switchToResultsView(P, allTopDeals);
      resetUI(P);
      return;
    }
    allTopDeals = deduplicateDeals(allTopDeals);
    if (allTopDeals.length > 1) {
      updateProgress(P, "Globales Re-Ranking aller Deals...", 97, "info", IS_WH);
      var settings = cachedSettings || DEFAULT_SETTINGS;
      allTopDeals = await reRankGlobal(
        allTopDeals,
        settings.apiKey,
        settings.searchContext,
        settings.model || MODEL.FLASH,
        Logger
      );
    }
    await saveResults({ deals: allTopDeals, pages: currentPage, timestamp: ( new Date()).toISOString() }, P);
    updateProgress(P, allTopDeals.length + " Deals gespeichert!", 100, "success", IS_WH);
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Deal Finder fertig", {
          body: allTopDeals.length + " Deals auf " + currentPage + " Seiten gefunden"
        });
      } catch (e) {
      }
    }
    switchToResultsView(P, allTopDeals);
    resetUI(P);
  }
  async function resumeCrawlIfActive() {
    var rawState = await GM.getValue(P + "_dealfinder_crawl_state", null);
    if (!rawState) {
      Logger.log("Normal session - results preserved");
      return;
    }
    var crawlState;
    try {
      crawlState = JSON.parse(rawState);
    } catch (e) {
      return;
    }
    if (!crawlState) return;
    var normalizedCurrentUrl = normalizeUrl(crawlState.currentUrl);
    var normalizedWindowUrl = normalizeUrl(window.location.href);
    var samePage = normalizedCurrentUrl && normalizedCurrentUrl === normalizedWindowUrl;
    var pageIncrement = samePage ? SAME_PAGE_INCREMENT : NEW_PAGE_INCREMENT;
    Logger.log("Crawl state found - resuming from page " + (crawlState.currentPage + pageIncrement) + " (" + (samePage ? "page reloaded" : "navigation detected") + ")");
    currentPage = crawlState.currentPage + pageIncrement;
    allTopDeals = crawlState.allTopDeals || [];
    isRunning = true;
    openModal(P);
    try {
      await waitForElement("#" + P + "-progress-container", 2e3);
    } catch (e) {
      await new Promise(function(r) {
        setTimeout(r, 500);
      });
    }
    setUIRunningState(P);
    updateLiveRanking(P, allTopDeals, cachedSettings);
    var settings = cachedSettings || DEFAULT_SETTINGS;
    var maxPages = crawlState.maxPages || settings.maxPages || 10;
    try {
      await processCurrentPage(
        settings.apiKey,
        settings.searchContext,
        settings.topX,
        settings.model || MODEL.FLASH,
        maxPages
      );
    } catch (error) {
      Logger.error("Error resuming:", error);
      updateProgress(P, "Fehler: " + error.message, 0, "error", IS_WH);
      await clearCrawlState(P);
      if (allTopDeals.length > 0) {
        await finishDealFinder();
      } else {
        resetUI(P);
        alert("Fehler beim Fortsetzen: " + error.message);
      }
    }
  }
  async function renderAndWireSettings() {
    var result = await loadSettings(P, cachedSettings);
    cachedSettings = result.cachedSettings;
    var settings = result.settings;
    var savedResults = await loadResults(P);
    var modal = document.getElementById(P + "-dealfinder-modal");
    if (!modal) return;
    modal.innerHTML = renderSettingsView(P, settings, savedResults, SITE_NAME);
    attachSettingsListeners(P, {
      start: startDealFinder,
      pause: pauseDealFinder,
      stop: stopDealFinder,
      close: function() {
        closeModal(P, isRunning);
      },
      showSavedResults: async function() {
        var sr = await loadResults(P);
        if (sr) {
          switchToResultsView(P, sr.deals);
          attachResultsListeners(P, resultsCallbacks);
        }
      },
      apiKeyChange: async function(newKey) {
        var s = await loadSettings(P, cachedSettings);
        cachedSettings = s.cachedSettings;
        var settingsObj = s.settings;
        if (settingsObj.apiKey !== newKey) {
          settingsObj.apiKey = newKey;
          await saveSetting(P + "_dealfinder_settings", JSON.stringify(settingsObj));
          cachedSettings = deepCopySettings(settingsObj);
        }
      },
      searchContextChange: async function(newContext) {
        var s = await loadSettings(P, cachedSettings);
        cachedSettings = s.cachedSettings;
        var settingsObj = s.settings;
        if (settingsObj.searchContext !== newContext) {
          settingsObj.searchContext = newContext;
          await saveSetting(P + "_dealfinder_settings", JSON.stringify(settingsObj));
          cachedSettings = deepCopySettings(settingsObj);
        }
      }
    });
    restoreModelSelect(P, cachedSettings);
  }
  var resultsCallbacks = {
    close: function() {
      closeModal(P, isRunning);
    },
    backToSettings: renderAndWireSettings,
    exportMarkdown: async function() {
      await exportMarkdown(P, { loadResults, generateMarkdown });
    },
    exportJSON: function() {
      exportJSON(P);
    },
    exportCSV: function() {
      exportCSV(P);
    },
    clearResults: async function() {
      if (!confirm("Möchtest du die gespeicherten Results wirklich löschen?")) return;
      await clearResults(P);
      renderAndWireSettings();
    }
  };
  async function init() {
    try {
      Logger.log("Script started");
      var rawSettings = await GM.getValue(P + "_dealfinder_settings", null);
      if (rawSettings) {
        try {
          var loaded = JSON.parse(rawSettings);
          if (loaded.model && !{ flash: 1, pro: 1, nano: 1 }[loaded.model]) loaded.model = "flash";
          cachedSettings = deepCopySettings(Object.assign({}, DEFAULT_SETTINGS, loaded));
        } catch (e) {
          cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
        }
      } else {
        cachedSettings = deepCopySettings(DEFAULT_SETTINGS);
      }
      if (IS_WH) {
        var searchIndicators = [
          '[data-testid="result-list-title"]',
          '[data-testid*="search-result"]',
          'a[href*="/iad/"]'
        ];
        var hasIndicator = false;
        for (var ssi = 0; ssi < searchIndicators.length; ssi++) {
          if (document.querySelector(searchIndicators[ssi])) {
            hasIndicator = true;
            break;
          }
        }
        if (!hasIndicator) {
          if (++initRetries >= MAX_INIT_RETRIES) {
            Logger.warn("Max init retries reached - showing button anyway");
            createModal(P);
            createDealFinderButton(P, BTN_GRADIENT);
            openModal(P);
            await renderAndWireSettings();
            return;
          }
          setTimeout(init, 3e3);
          return;
        }
      } else {
        try {
          await waitForElement("article[data-adid], #srchrslt-adtable", 1e4);
        } catch (e) {
          Logger.log("No ad list found, retrying later");
          if (++initRetries >= MAX_INIT_RETRIES) {
            Logger.warn("Max init retries reached - showing button anyway");
            createModal(P);
            createDealFinderButton(P, BTN_GRADIENT);
            await renderAndWireSettings();
            return;
          }
          setTimeout(init, 3e3);
          return;
        }
      }
      await new Promise(function(r) {
        setTimeout(r, 1500);
      });
      createModal(P);
      createDealFinderButton(P, BTN_GRADIENT);
      var floatBtn = document.getElementById(P + "-dealfinder-btn");
      if (floatBtn) {
        floatBtn.addEventListener("click", function() {
          openModal(P);
          renderAndWireSettings();
        });
      }
      await renderAndWireSettings();
      await resumeCrawlIfActive();
    } catch (error) {
      Logger.error("Initialization error:", error);
      setTimeout(init, 3e3);
    }
  }
  init();

})();
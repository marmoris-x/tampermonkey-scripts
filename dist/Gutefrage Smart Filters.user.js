// ==UserScript==
// @name         Gutefrage Smart Filters
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      3.10
// @author       marmoris
// @description  Enhanced filtering options and automatic tag management for gutefrage.net
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=gutefrage.net
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Gutefrage%20Smart%20Filters.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Gutefrage%20Smart%20Filters.user.js
// @match        https://www.gutefrage.net/*
// @sandbox      JavaScript
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        window.close
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
  var tagLog = createLogger("Gutefrage Tag Remover");
  var DEFAULT_TAGS = ["islam", "allah", "muslime", "koran", "mohammed"];
  async function waitForTagPageReady() {
    if (document.readyState !== "complete") await new Promise(function(r) {
      window.addEventListener("load", r);
    });
    try {
      await waitForElement(".Tag-container, .Tag, article, main", 8e3);
    } catch (e) {
    }
    var delay = Math.min(3e3, Math.max(500, document.querySelectorAll("*").length / 100));
    await new Promise(function(r) {
      setTimeout(r, delay);
    });
  }
  class TagRemover {
    constructor() {
      this.tagsToRemove = DEFAULT_TAGS;
      this.init();
    }
init() {
      this.addRemoveButtons();
      this.autoRemoveAndClose();
      this.observeNewContent();
    }
removeTag(tagElement) {
      var hideButton = tagElement.querySelector(".Tag-action");
      if (hideButton) {
        hideButton.click();
        tagLog.log("Tag removed:", tagElement.getAttribute("aria-label"));
        return true;
      }
      return false;
    }
async removeUnwantedTags() {
      tagLog.log("Starting tag removal process...");
      await waitForTagPageReady();
      this.tagsToRemove = await GM.getValue("customTagsToRemove", DEFAULT_TAGS);
      var tagsRemoved = 0, maxAttempts = 3;
      for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        var tagContainers = document.querySelectorAll(".Tag-container");
        tagLog.log("Attempt " + attempt + "/" + maxAttempts + ", found " + tagContainers.length + " containers");
        if (tagContainers.length === 0 && attempt < maxAttempts) {
          await new Promise(function(r) {
            setTimeout(r, 2e3);
          });
          continue;
        }
        for (var i = 0; i < tagContainers.length; i++) {
          var tagSlug = tagContainers[i].querySelector(".Tag");
          tagSlug = tagSlug ? tagSlug.getAttribute("data-tag-slug") : null;
          if (tagSlug && this.tagsToRemove.indexOf(tagSlug.toLowerCase()) !== -1) {
            if (this.removeTag(tagContainers[i])) {
              tagsRemoved++;
              await new Promise(function(r) {
                setTimeout(r, 200);
              });
            }
          }
        }
        if (tagContainers.length > 0) break;
      }
      tagLog.log("Completed. Total tags removed: " + tagsRemoved);
      return tagsRemoved;
    }
addRemoveButtons() {
      var btnStyle = [
        "color:white; border:none; padding:4px 12px; margin-left:8px; border-radius:12px;",
        "font-size:13px; font-weight:500; cursor:pointer; transition:background-color 0.2s;",
        "display:inline-flex; align-items:center; height:24px; white-space:nowrap;"
      ].join(" ");
      Array.prototype.forEach.call(document.querySelectorAll("article.ListingElement, .ContentCard"), function(article) {
        if (article.querySelector(".custom-remove-tags-button")) return;
        var buttonContainer = article.querySelector(".ListingElement-bottomBar--withItemActions .u-flex:last-child");
        if (!buttonContainer) buttonContainer = article.querySelector(".ContentCard-action, .ContentCard-actions");
        if (!buttonContainer) {
          var tagSection = article.querySelector(".Tag");
          if (tagSection) buttonContainer = tagSection.parentElement;
        }
        if (!buttonContainer) return;
        var removeBtn = document.createElement("button");
        removeBtn.className = "Tag custom-remove-tags-button";
        removeBtn.style.cssText = "background-color:#dc3545; " + btnStyle;
        removeBtn.textContent = "Tags entfernen";
        removeBtn.title = "Removes unwanted tags from this post";
        removeBtn.addEventListener("mouseenter", function() {
          this.style.backgroundColor = "#c82333";
        });
        removeBtn.addEventListener("mouseleave", function() {
          this.style.backgroundColor = "#dc3545";
        });
        removeBtn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          var ql = article.querySelector('a[href*="/frage/"], .ContentCard-link, .ListingElement-questionLink');
          if (ql) {
            var url = new URL(ql.href);
            url.searchParams.set("removeTagsAuto", "true");
            removeBtn.textContent = "Wird bearbeitet...";
            removeBtn.style.backgroundColor = "#28a745";
            if (typeof GM_openInTab !== "undefined") {
              GM_openInTab(url.href, { active: false, insert: true, setParent: true });
            } else {
              window.open(url.href, "_blank");
            }
            setTimeout(function() {
              removeBtn.textContent = "Tags entfernen";
              removeBtn.style.backgroundColor = "#dc3545";
            }, 2e3);
          }
        });
        buttonContainer.appendChild(removeBtn);
        var authorEl = article.querySelector(".ContentMeta-author a");
        if (authorEl) {
          var blockBtn = document.createElement("button");
          blockBtn.className = "Tag custom-block-author-button";
          blockBtn.style.cssText = "background-color:#6c757d; " + btnStyle;
          blockBtn.textContent = "Autor sperren";
          blockBtn.title = "Hides all posts from this author";
          blockBtn.addEventListener("mouseenter", function() {
            this.style.backgroundColor = "#545b62";
          });
          blockBtn.addEventListener("mouseleave", function() {
            this.style.backgroundColor = "#6c757d";
          });
          blockBtn.addEventListener("click", async function(e) {
            e.preventDefault();
            e.stopPropagation();
            var name = authorEl.textContent.trim();
            var blocked = await GM.getValue("blockedAuthors", []);
            if (blocked.indexOf(name) === -1) {
              blocked.push(name);
              await GM.setValue("blockedAuthors", blocked);
            }
            var container = article.closest(".Plate.ListingElement") || article;
            container.style.display = "none";
          });
          buttonContainer.appendChild(blockBtn);
        }
      });
    }
async autoRemoveAndClose() {
      var urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("removeTagsAuto") !== "true") return;
      tagLog.log("Auto-remove mode activated");
      var notification = document.createElement("div");
      notification.style.cssText = [
        "position:fixed; top:20px; left:50%; transform:translateX(-50%);",
        "background:#ffc107; color:#000; padding:15px 20px; border-radius:8px;",
        "z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px; font-weight:500;"
      ].join(" ");
      notification.textContent = "Warte auf vollstandiges Laden der Seite...";
      document.body.appendChild(notification);
      var progressInterval = setInterval(function() {
        var containers = document.querySelectorAll(".Tag-container");
        notification.textContent = "Seite wird geladen... (" + containers.length + " Tags gefunden)";
      }, 1e3);
      try {
        var tagsRemoved = await this.removeUnwantedTags();
        clearInterval(progressInterval);
        notification.style.background = "#4CAF50";
        notification.style.color = "#fff";
        notification.textContent = "✓ " + tagsRemoved + " Tag(s) entfernt! Tab wird geschlossen...";
        setTimeout(function() {
          window.close();
          setTimeout(function() {
            notification.textContent = "Bitte schließen Sie diesen Tab manuell.";
            notification.style.background = "#17a2b8";
          }, 500);
        }, 2e3);
      } catch (error) {
        clearInterval(progressInterval);
        tagLog.error("Error:", error);
        notification.style.background = "#dc3545";
        notification.style.color = "#fff";
        notification.textContent = "Fehler beim Entfernen der Tags!";
      }
    }
observeNewContent() {
      var self = this;
      observeMutations(function(node) {
        if (node.matches && (node.matches("article.ListingElement, .ContentCard") || node.querySelector("article.ListingElement, .ContentCard"))) {
          self.addRemoveButtons();
        }
      });
    }
  }
  globalThis.TM = globalThis.TM || {};
  globalThis.TM.storage = {
    loadSetting,
    saveSetting,
    loadSettings,
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
  async function loadSettings(defaults) {
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
  globalThis.TM.i18n = {
    normalizeText,
    matchAnyTerm,
    matchTerm
  };
  function normalizeText(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[äæ]/g, "ae").replace(/[öœ]/g, "oe").replace(/[ü]/g, "ue").replace(/ß/g, "ss").replace(/[àáâãå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i").replace(/[òóôõ]/g, "o").replace(/[ùúû]/g, "u").replace(/[ñ]/g, "n").replace(/[ç]/g, "c").replace(/[-_.:]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function matchAnyTerm(text, terms) {
    var n = normalizeText(text);
    for (var i = 0; i < terms.length; i++) {
      if (n.indexOf(normalizeText(terms[i])) !== -1) return true;
    }
    return false;
  }
  function matchTerm(text, term) {
    return normalizeText(text) === normalizeText(term);
  }
  var log$1 = createLogger("Gutefrage Smart Filters");
  var DEFAULT_FILTERS = {
    afterDate: "",
    contentFilters: { onlyBookmarked: false, hideBookmarked: false, onlyWithImages: false, hideWithImages: false, hidePostTypes: [] },
    interactionFilters: { minAnswers: "", maxAnswers: "", minLikes: "" },
    textFilters: { keywords: "", excludeKeywords: "" },
    topicFilters: { excludeTopics: "", includeTopics: "" }
  };
  function hashString(str) {
    var hash = 5381, i;
    for (i = 0; i < str.length; i++) hash = (hash << 5) + hash + str.charCodeAt(i);
    return (hash & 2147483647).toString(36).substring(0, 8);
  }
  function parseCSV(text, lowercase) {
    if (!text || typeof text !== "string") return [];
    return text.split(",").map(function(t) {
      return lowercase !== false ? t.trim().toLowerCase() : t.trim();
    }).filter(Boolean);
  }
  function topicsMatch(t1, t2) {
    return matchAnyTerm(t1, [t2]) || matchAnyTerm(t2, [t1]);
  }
  function getPostTitle(post) {
    var el = post.querySelector(".Question-title");
    return el ? el.textContent.trim() : "";
  }
  function getPostAuthor(post) {
    var el = post.querySelector(".ContentMeta-author a");
    return el ? el.textContent.trim() : "";
  }
  function getPostDateTime(post) {
    var el = post.querySelector("time[datetime]");
    return el ? el.getAttribute("datetime") : "";
  }
  function getPostImagesStatus(post) {
    return !!post.querySelector('button[aria-label="Mit Bildern"]') || !!post.querySelector(".ListingElement-image");
  }
  function getAnswerCount(post) {
    var selectors = ['a[href*="/frage/"]', 'a[href*="/diskussion/"]', 'a[href*="/umfrage/"]', ".ListingElement-bottomBar a"];
    for (var s = 0; s < selectors.length; s++) {
      var links = post.querySelectorAll(selectors[s]);
      for (var i = 0; i < links.length; i++) {
        var text = links[i].textContent.trim();
        if (text.toLowerCase().indexOf("keine antwort") !== -1) return 0;
        var match = text.match(/(\d+)\s+Antwort/i);
        if (!match && text.toLowerCase().indexOf("antwort") !== -1) {
          var nm = text.match(/(\d+)/);
          if (nm) match = [null, nm[1]];
        }
        if (match) return parseInt(match[1], 10);
      }
    }
    return 0;
  }
  function getPostFingerprint(post) {
    return hashString(getPostTitle(post)) + "|" + getPostAuthor(post) + "|" + getPostDateTime(post) + "|" + getPostImagesStatus(post) + "|" + getAnswerCount(post);
  }
  class EnhancedFilterIntegration {
    constructor() {
      if (!window.location.pathname.startsWith("/home/")) return;
      this.filters = {
        afterDate: DEFAULT_FILTERS.afterDate,
        contentFilters: Object.assign({}, DEFAULT_FILTERS.contentFilters),
        interactionFilters: Object.assign({}, DEFAULT_FILTERS.interactionFilters),
        textFilters: Object.assign({}, DEFAULT_FILTERS.textFilters),
        topicFilters: Object.assign({}, DEFAULT_FILTERS.topicFilters)
      };
      this.filtersEnabled = false;
      this.sidebar = null;
      this.debouncedApplyFilters = debounce((function() {
        this.applyFilters();
      }).bind(this), 300);
      this.filterCache = {};
      this.lastFilterHash = "";
      this.parsedFilterData = { excludeTopics: null, includeTopics: null, keywords: null, excludeKeywords: null, blockedAuthors: null };
    }
async init() {
      if (!window.location.pathname.startsWith("/home/")) return;
      this.filters = await this.loadFilters();
    }
async loadFilters() {
      var saved = await loadSetting("enhancedFilters", {});
      return {
        afterDate: saved.afterDate !== void 0 ? saved.afterDate : DEFAULT_FILTERS.afterDate,
        contentFilters: this._mergeShallow(DEFAULT_FILTERS.contentFilters, saved.contentFilters),
        interactionFilters: this._mergeShallow(DEFAULT_FILTERS.interactionFilters, saved.interactionFilters),
        textFilters: this._mergeShallow(DEFAULT_FILTERS.textFilters, saved.textFilters),
        topicFilters: this._mergeShallow(DEFAULT_FILTERS.topicFilters, saved.topicFilters)
      };
    }
async saveFilters() {
      await saveSetting("enhancedFilters", this.filters);
    }
_mergeShallow(defaults, overrides) {
      if (!overrides || typeof overrides !== "object") return Object.assign({}, defaults);
      var result = Object.assign({}, defaults);
      Object.keys(overrides).forEach(function(k) {
        if (overrides[k] !== void 0) result[k] = overrides[k];
      });
      return result;
    }
enableFilters() {
      if (!this.filtersEnabled) {
        this.filtersEnabled = true;
        this.observeNewPosts();
        log$1.log("Filters activated!");
      }
    }
observeNewPosts() {
      if (this.postObserver) return;
      var self = this;
      this.postObserver = observeMutations(function(node) {
        if (!self.filtersEnabled) return;
        if (node.matches && (node.matches(".Plate.ListingElement") || node.querySelector(".Plate.ListingElement"))) {
          self.debouncedApplyFilters();
        }
      });
    }
async updateFilterValue(filterPath, value) {
      var paths = filterPath.split(".");
      var current = this.filters;
      for (var i = 0; i < paths.length - 1; i++) current = current[paths[i]];
      current[paths[paths.length - 1]] = value;
      await this.saveFilters();
      this.updateFilterIndicator();
    }
updateFilterIndicator() {
      var countSpan = document.querySelector(".Filter-buttonActiveFiltersCount");
      if (!countSpan) return;
      var activeCount = 0;
      if (this.filters.afterDate) activeCount++;
      var cf = this.filters.contentFilters;
      if (cf.onlyBookmarked) activeCount++;
      if (cf.hideBookmarked) activeCount++;
      if (cf.onlyWithImages) activeCount++;
      if (cf.hideWithImages) activeCount++;
      if (cf.hidePostTypes && cf.hidePostTypes.length > 0) activeCount++;
      var inf = this.filters.interactionFilters;
      if (inf.minAnswers || inf.maxAnswers || inf.minLikes) activeCount++;
      var tf = this.filters.textFilters;
      if (tf.keywords || tf.excludeKeywords) activeCount++;
      var topf = this.filters.topicFilters;
      if (topf.excludeTopics || topf.includeTopics) activeCount++;
      countSpan.textContent = activeCount > 0 ? String(activeCount) : "";
      countSpan.style.display = activeCount > 0 ? "inline-block" : "none";
    }
async getFilterHash() {
      return JSON.stringify({
        filters: this.filters,
        blockedAuthors: await GM.getValue("blockedAuthors", []),
        customTags: await GM.getValue("customTagsToRemove", [])
      });
    }
async updateParsedFilters() {
      var blockedAuthors = await GM.getValue("blockedAuthors", []);
      this.parsedFilterData = {
        excludeTopics: parseCSV(this.filters.topicFilters.excludeTopics),
        includeTopics: parseCSV(this.filters.topicFilters.includeTopics),
        keywords: parseCSV(this.filters.textFilters.keywords),
        excludeKeywords: parseCSV(this.filters.textFilters.excludeKeywords),
        blockedAuthors: blockedAuthors.map(function(a) {
          return a.trim().toLowerCase();
        })
      };
    }
async applyFilters() {
      if (!this.filtersEnabled) return;
      var posts = document.querySelectorAll(".Plate.ListingElement");
      var visibleCount = 0;
      var currentHash = await this.getFilterHash();
      var shortHash = hashString(currentHash);
      if (currentHash !== this.lastFilterHash) {
        this.filterCache = {};
        this.lastFilterHash = currentHash;
        await this.updateParsedFilters();
      }
      if (Object.keys(this.filterCache).length > 1e3) this.filterCache = {};
      if (!this.parsedFilterData || this.parsedFilterData.excludeTopics === null) await this.updateParsedFilters();
      for (var p = 0; p < posts.length; p++) {
        var post = posts[p];
        var fingerprint = getPostFingerprint(post);
        var cacheKey = currentHash + "|" + fingerprint;
        if (this.filterCache[cacheKey] !== void 0) {
          var cached = this.filterCache[cacheKey];
          post.style.display = cached ? "" : "none";
          post.dataset.filterHash = shortHash;
          post.dataset.lastFilterResult = cached ? "visible" : "hidden";
          if (cached) visibleCount++;
          continue;
        }
        var postHash = post.dataset.filterHash;
        var lastResult = post.dataset.lastFilterResult;
        if (postHash === shortHash && lastResult) {
          var domCached = lastResult === "visible";
          this.filterCache[cacheKey] = domCached;
          post.style.display = domCached ? "" : "none";
          if (domCached) visibleCount++;
          continue;
        }
        var shouldShow = true;
        if (shouldShow && this.filters.afterDate) {
          var timeEl = post.querySelector("time[datetime]");
          if (timeEl) {
            var postDate = new Date(timeEl.getAttribute("datetime"));
            if (postDate < new Date(this.filters.afterDate)) shouldShow = false;
          }
        }
        if (shouldShow && this.filters.contentFilters.hidePostTypes && this.filters.contentFilters.hidePostTypes.length > 0) {
          var link = post.querySelector("a.ListingElement-questionLink[href]");
          if (link) {
            var href = link.getAttribute("href");
            var type = href.indexOf("/frage/") !== -1 ? "frage" : href.indexOf("/diskussion/") !== -1 ? "diskussion" : href.indexOf("/umfrage/") !== -1 ? "umfrage" : null;
            if (type && this.filters.contentFilters.hidePostTypes.indexOf(type) !== -1) shouldShow = false;
          }
        }
        if (shouldShow && (this.filters.contentFilters.onlyBookmarked || this.filters.contentFilters.hideBookmarked)) {
          var isBookmarked = !!post.querySelector(".Icon--bookmark-filled-large");
          if (this.filters.contentFilters.onlyBookmarked && !isBookmarked) shouldShow = false;
          if (shouldShow && this.filters.contentFilters.hideBookmarked && isBookmarked) shouldShow = false;
        }
        if (shouldShow && (this.filters.contentFilters.onlyWithImages || this.filters.contentFilters.hideWithImages)) {
          var hasImages = getPostImagesStatus(post);
          if (this.filters.contentFilters.onlyWithImages && !hasImages) shouldShow = false;
          if (shouldShow && this.filters.contentFilters.hideWithImages && hasImages) shouldShow = false;
        }
        if (shouldShow && this.parsedFilterData.blockedAuthors.length > 0) {
          var authorName = getPostAuthor(post).toLowerCase();
          if (authorName && this.parsedFilterData.blockedAuthors.indexOf(authorName) !== -1) shouldShow = false;
        }
        if (shouldShow && (this.parsedFilterData.excludeTopics.length > 0 || this.parsedFilterData.includeTopics.length > 0)) {
          var topicEls = post.querySelectorAll('a[href*="/thema/"], a:has(.BrandAvatar), [data-topic-slug], .ContentMeta-topic, .ContentMeta-category, a.u-strongLight:has(.BrandAvatar--small)');
          var topicStrings = [];
          for (var t = 0; t < topicEls.length; t++) {
            var el = topicEls[t];
            var text = (el.textContent || "").trim().toLowerCase();
            if (text) topicStrings.push(text);
            var href = el.getAttribute("href");
            if (href) {
              var clean = href.replace(/^https?:\/\/[^\/]+/, "").split("?")[0].split("#")[0].replace(/^\/|\/$/g, "");
              if (clean && !clean.match(/^(frage|diskussion|umfrage|home|meine|suche|nutzer)\//)) {
                topicStrings.push(clean);
                if (clean.indexOf("/") !== -1) {
                  var parts = clean.split("/");
                  for (var pt = 0; pt < parts.length; pt++) {
                    if (parts[pt]) topicStrings.push(parts[pt]);
                  }
                }
              }
            }
            var dataSlug = el.getAttribute("data-topic-slug");
            if (dataSlug) topicStrings.push(dataSlug.toLowerCase());
          }
          var uniqueTopics = [];
          for (var u = 0; u < topicStrings.length; u++) {
            if (uniqueTopics.indexOf(topicStrings[u]) === -1) uniqueTopics.push(topicStrings[u]);
          }
          if (shouldShow && this.parsedFilterData.excludeTopics.length > 0 && uniqueTopics.length > 0) {
            for (var ex = 0; ex < uniqueTopics.length; ex++) {
              for (var ec = 0; ec < this.parsedFilterData.excludeTopics.length; ec++) {
                if (topicsMatch(uniqueTopics[ex], this.parsedFilterData.excludeTopics[ec])) {
                  shouldShow = false;
                  break;
                }
              }
              if (!shouldShow) break;
            }
          }
          if (shouldShow && this.parsedFilterData.includeTopics.length > 0 && uniqueTopics.length > 0) {
            var hasMatch = false;
            for (var ic = 0; ic < uniqueTopics.length; ic++) {
              for (var ic2 = 0; ic2 < this.parsedFilterData.includeTopics.length; ic2++) {
                if (topicsMatch(uniqueTopics[ic], this.parsedFilterData.includeTopics[ic2])) {
                  hasMatch = true;
                  break;
                }
              }
              if (hasMatch) break;
            }
            if (!hasMatch) shouldShow = false;
          }
        }
        if (shouldShow && (this.parsedFilterData.keywords.length > 0 || this.parsedFilterData.excludeKeywords.length > 0)) {
          var titleText = getPostTitle(post).toLowerCase();
          var bodyText = post.querySelector(".ContentBody") ? (post.querySelector(".ContentBody").textContent || "").toLowerCase() : "";
          var authorText = getPostAuthor(post).toLowerCase();
          var searchable = titleText + " " + bodyText + " " + authorText;
          if (this.parsedFilterData.keywords.length > 0) {
            var kwMatch = false;
            for (var kw = 0; kw < this.parsedFilterData.keywords.length; kw++) {
              if (searchable.indexOf(this.parsedFilterData.keywords[kw]) !== -1) {
                kwMatch = true;
                break;
              }
            }
            if (!kwMatch) shouldShow = false;
          }
          if (shouldShow && this.parsedFilterData.excludeKeywords.length > 0) {
            for (var ek = 0; ek < this.parsedFilterData.excludeKeywords.length; ek++) {
              if (searchable.indexOf(this.parsedFilterData.excludeKeywords[ek]) !== -1) {
                shouldShow = false;
                break;
              }
            }
          }
        }
        if (shouldShow && (this.filters.interactionFilters.minAnswers !== "" || this.filters.interactionFilters.maxAnswers !== "")) {
          var answerCount = getAnswerCount(post);
          var minA = parseInt(this.filters.interactionFilters.minAnswers, 10);
          var maxA = parseInt(this.filters.interactionFilters.maxAnswers, 10);
          if (!isNaN(minA) && answerCount < minA) shouldShow = false;
          if (shouldShow && !isNaN(maxA) && answerCount > maxA) shouldShow = false;
        }
        if (shouldShow && this.filters.interactionFilters.minLikes) {
          var likeBtn = post.querySelector('.ActionBarIcon button[aria-label*="Daumen"]');
          var likes = likeBtn ? parseInt((likeBtn.getAttribute("aria-label").match(/(\d+)/) || [])[1], 10) || 0 : parseInt((post.querySelector(".ActionBarIcon-count") || {}).textContent, 10) || 0;
          if (likes < parseInt(this.filters.interactionFilters.minLikes, 10)) shouldShow = false;
        }
        this.filterCache[cacheKey] = shouldShow;
        post.dataset.filterHash = shortHash;
        post.dataset.lastFilterResult = shouldShow ? "visible" : "hidden";
        if (shouldShow) visibleCount++;
        post.style.display = shouldShow ? "" : "none";
      }
      this.updateStats(visibleCount, posts.length);
    }
updateStats(visible, total) {
      if (this.sidebar) this.sidebar.updateStats(visible, total);
    }
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
  function createSidebar(opts) {
    opts = opts || {};
    var width = opts.width || 340;
    var accent = opts.accentColor || "#2196F3";
    var title = opts.title || "";
    var isOpen = false;
    var baseCSS = [
      ":host { position:fixed; top:0; right:0; width:" + width + "px; height:100vh; z-index:2147483645;",
      "background:#1a1a2e; color:#e0e0e0; font:13px/1.5 system-ui,sans-serif;",
      "transform:translateX(" + width + "px); transition:transform 0.3s ease;",
      "display:flex; flex-direction:column; }",
      ":host(.open) { transform:translateX(0); }",
      ".header { display:flex; align-items:center; padding:10px 14px; background:#16213e;",
      "border-bottom:1px solid #0f3460; cursor:move; user-select:none; flex-shrink:0; }",
      ".header h2 { margin:0; font-size:14px; font-weight:600; color:" + accent + "; flex:1; }",
      ".header button { background:none; border:none; color:#e0e0e0; cursor:pointer; font-size:18px;",
      "padding:0 4px; line-height:1; }",
      ".header button:hover { color:" + accent + "; }",
      ".body { flex:1; overflow-y:auto; padding:12px 14px; }",
      ".body::-webkit-scrollbar { width:6px; }",
      ".body::-webkit-scrollbar-track { background:transparent; }",
      ".body::-webkit-scrollbar-thumb { background:#0f3460; border-radius:3px; }",
      opts.cssOverrides || ""
    ].join("");
    var container = createShadowContainer({ styles: baseCSS });
    var root = container.root;
    var header = document.createElement("div");
    header.className = "header";
    var h2 = document.createElement("h2");
    h2.textContent = title;
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close sidebar");
    header.appendChild(h2);
    header.appendChild(closeBtn);
    root.appendChild(header);
    var body = document.createElement("div");
    body.className = "body";
    root.appendChild(body);
    var tab = document.createElement("div");
    var tabRoot = tab.attachShadow({ mode: "closed" });
    var tabStyle = document.createElement("style");
    tabStyle.textContent = [
      ":host { position:fixed; top:50%; z-index:2147483644; background:" + accent + "; color:#fff;",
      "padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;",
      "writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);",
      "right:" + width + "px; transform:translateY(-50%) translateX(100%);",
      "transition:right 0.3s ease, transform 0.3s ease; }",
      ":host(:hover) { filter:brightness(1.1); }",
      ":host(.open) { right:" + (width + 8) + "px; transform:translateY(-50%) translateX(0); }"
    ].join("");
    var tabSpan = document.createElement("span");
    tabSpan.textContent = title;
    tabRoot.appendChild(tabStyle);
    tabRoot.appendChild(tabSpan);
    document.body.appendChild(tab);
    function open() {
      if (isOpen) return;
      isOpen = true;
      container.host.classList.add("open");
      tab.classList.add("open");
      document.documentElement.style.marginRight = width + "px";
      if (opts.onOpen) opts.onOpen();
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      container.host.classList.remove("open");
      tab.classList.remove("open");
      document.documentElement.style.marginRight = "";
      if (opts.onClose) opts.onClose();
    }
    function toggle() {
      if (isOpen) close();
      else open();
    }
    var dragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
    header.addEventListener("mousedown", function(e) {
      if (e.target === closeBtn) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(container.host.style.right || 0, 10);
      startTop = parseInt(container.host.style.top || 0, 10);
      e.preventDefault();
    });
    document.addEventListener("mousemove", function(e) {
      if (!dragging) return;
      container.host.style.right = startRight - (e.clientX - startX) + "px";
      container.host.style.top = startTop + (e.clientY - startY) + "px";
    });
    document.addEventListener("mouseup", function() {
      dragging = false;
    });
    closeBtn.addEventListener("click", close);
    tab.addEventListener("click", toggle);
    return {
      host: container.host,
      root,
      bodyEl: body,
      tabEl: tab,
      open,
      close,
      toggle,
      isOpen: function() {
        return isOpen;
      },
      setTitle: function(t) {
        h2.textContent = t;
        tabSpan.textContent = t;
      }
    };
  }
  function toSpringeZu(datetimeLocalValue) {
    if (!datetimeLocalValue) return null;
    var d = new Date(datetimeLocalValue);
    var offset = -d.getTimezoneOffset();
    var sign = offset >= 0 ? "+" : "-";
    var hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    var mm = String(Math.abs(offset) % 60).padStart(2, "0");
    var local = datetimeLocalValue.length === 16 ? datetimeLocalValue + ":00" : datetimeLocalValue;
    return local + sign + hh + ":" + mm;
  }
  async function navigateToDate(section) {
    var navDate = await GM.getValue("navDate", "");
    var tz = toSpringeZu(navDate);
    var base = section === "unbeantwortet" ? "/home/meine/unbeantwortet" : "/home/meine/alle";
    var url = tz ? base + "?springe-zu=" + encodeURIComponent(tz) : base;
    window.location.href = url;
  }
  async function resetNavigation() {
    await GM.setValue("navDate", "");
  }
  var SIDEBAR_CSS = [
    ".gf-stats-bar { margin:8px 0; padding:8px 13px; background:rgba(76,175,80,0.1); border:1px solid rgba(76,175,80,0.25); border-radius:7px; font-size:12px; color:#81c784; text-align:center; display:none; font-weight:500; }",
    ".gf-stats-bar.active { display:block; }",
    ".gf-section { margin-top:10px; background:#262a3c; border-radius:9px; padding:9px 11px 11px; border:1px solid rgba(255,255,255,0.07); }",
    ".gf-section-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.9px; color:#8890a4; margin:0 0 9px; display:flex; align-items:center; gap:6px; }",
    '.gf-section-title::before { content:""; flex-shrink:0; display:inline-block; width:3px; height:11px; background:#4CAF50; border-radius:2px; }',
    ".gf-input { width:100%; padding:6px 9px; border:1px solid rgba(255,255,255,0.13); border-radius:6px; font-size:12px; background:#2d3248; color:#dde3ec; box-sizing:border-box; transition:border-color 0.15s; font-family:inherit; }",
    ".gf-input + .gf-input { margin-top:4px; }",
    ".gf-input:focus { outline:none; border-color:#4CAF50; box-shadow:0 0 0 3px rgba(76,175,80,0.15); }",
    ".gf-label { font-size:10px; color:#8890a4; display:block; margin:6px 0 3px; font-weight:500; }",
    ".gf-label:first-child { margin-top:0; }",
    ".gf-hint { font-size:10px; color:#4e5a72; margin-top:3px; line-height:1.4; }",
    ".gf-pill-row { display:flex; gap:6px; flex-wrap:wrap; }",
    ".gf-pill-label { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:500; cursor:pointer; padding:5px 12px; border:1.5px solid rgba(255,255,255,0.13); border-radius:20px; user-select:none; transition:all 0.15s; color:#8890a4; background:#2d3248; }",
    ".gf-pill-label:has(input:checked) { background:#4CAF50; color:#fff; border-color:#4CAF50; box-shadow:0 2px 6px rgba(76,175,80,0.28); }",
    ".gf-pill-label input { display:none; }",
    ".gf-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:3px 0; }",
    ".gf-toggle-row + .gf-toggle-row { margin-top:1px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.07); }",
    ".gf-toggle-label { font-size:12px; color:#dde3ec; }",
    ".gf-number-row { display:flex; align-items:center; gap:8px; }",
    ".gf-number-row input { width:72px; padding:7px 8px; border:1px solid rgba(255,255,255,0.13); border-radius:6px; font-size:13px; background:#2d3248; color:#dde3ec; font-family:inherit; transition:border-color 0.15s; }",
    ".gf-number-row input:focus { outline:none; border-color:#4CAF50; box-shadow:0 0 0 3px rgba(76,175,80,0.15); }",
    ".gf-number-row span { font-size:12px; color:#8890a4; }",
    ".gf-nav-row { display:flex; gap:6px; margin-top:8px; }",
    ".gf-nav-btn { flex:1; padding:7px 8px; font-size:11px; font-weight:600; background:#2d3248; color:#4CAF50; border:1.5px solid #4CAF50; border-radius:6px; cursor:pointer; transition:all 0.15s; font-family:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
    ".gf-nav-btn:hover { background:#4CAF50; color:#fff; box-shadow:0 2px 6px rgba(76,175,80,0.28); }",
    ".gf-nav-btn:disabled { opacity:0.38; cursor:not-allowed; border-color:rgba(255,255,255,0.13); color:#8890a4; }",
    ".gf-nav-btn:disabled:hover { background:#2d3248; color:#8890a4; box-shadow:none; }",
    ".gf-nav-btn.active { background:#4CAF50; color:#fff; }",
    "#gf-nav-reset { background:#2d3248; color:#8890a4; border-color:rgba(255,255,255,0.13); }",
    "#gf-nav-reset:hover { background:#8890a4; color:#fff; }",
    ".gf-reset-btn { display:block; width:100%; margin-top:14px; padding:10px; background:#262a3c; border:1.5px solid rgba(255,255,255,0.07); border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; color:#8890a4; transition:all 0.2s; font-family:inherit; letter-spacing:0.2px; text-align:center; }",
    ".gf-reset-btn:hover { background:rgba(192,57,43,0.15); border-color:rgba(192,57,43,0.4); color:#e57373; }"
  ].join("\n");
  class SidebarPanel {
constructor(fi) {
      if (!window.location.pathname.startsWith("/home/")) return;
      this.fi = fi;
      fi.sidebar = this;
      this.sb = createSidebar({
        width: 340,
        title: "Gutefrage Filter",
        accentColor: "#4CAF50",
        onOpen: function() {
          fi.enableFilters();
          setTimeout(function() {
            fi.applyFilters();
          }, 100);
        },
        onClose: function() {
        }
      });
      this.renderContent()["catch"](function(err) {
        console.warn("[GSF] Panel render error:", err);
      });
    }
isOpen() {
      return this.sb.isOpen();
    }
updateStats(visible, total) {
      var statsEl = this.sb.bodyEl.querySelector(".gf-stats-bar");
      if (!statsEl) return;
      var filtered = total - visible;
      if (filtered > 0) {
        statsEl.textContent = visible + " sichtbar  ·  " + filtered + " ausgeblendet";
        statsEl.classList.add("active");
      } else {
        statsEl.classList.remove("active");
      }
    }
async renderContent() {
      var f = this.fi.filters;
      var hideTypes = f.contentFilters.hidePostTypes || [];
      var customTags = (await GM.getValue("customTagsToRemove", DEFAULT_TAGS)).join(", ");
      var blockedAuthors = (await GM.getValue("blockedAuthors", [])).join(", ");
      var dateVal = f.afterDate || "";
      var isUnansweredPage = window.location.pathname.indexOf("/unbeantwortet") !== -1;
      var html = "<style>" + SIDEBAR_CSS + "</style>";
      html += '<div class="gf-stats-bar"></div>';
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Fragetyp</div>';
      html += '<div class="gf-pill-row">';
      html += '<label class="gf-pill-label"><input type="checkbox" data-posttype="frage"' + (hideTypes.indexOf("frage") === -1 ? " checked" : "") + "> Fragen</label>";
      html += '<label class="gf-pill-label"><input type="checkbox" data-posttype="diskussion"' + (hideTypes.indexOf("diskussion") === -1 ? " checked" : "") + "> Diskussionen</label>";
      html += '<label class="gf-pill-label"><input type="checkbox" data-posttype="umfrage"' + (hideTypes.indexOf("umfrage") === -1 ? " checked" : "") + "> Umfragen</label>";
      html += "</div></div>";
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Datum-Filter</div>';
      html += '<input type="datetime-local" class="gf-input" data-filter="afterDate" value="' + dateVal + '" title="Nur Beiträge ab diesem Datum anzeigen">';
      html += '<div class="gf-hint">Blendet Beiträge <strong>vor</strong> diesem Datum aus (AB-Filter)</div></div>';
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Feed-Navigation</div>';
      html += '<span class="gf-label">Zu diesem Datum springen:</span>';
      html += '<input type="datetime-local" class="gf-input" id="gf-nav-date" value="' + await GM.getValue("navDate", "") + '" title="Springt im Gutefrage-Feed zu diesem Datum (VOR-Navigation)">';
      html += '<div class="gf-hint">Springt im Feed zu Beiträgen <strong>vor</strong> diesem Datum</div>';
      html += '<div class="gf-nav-row">';
      html += '<button class="gf-nav-btn' + (!isUnansweredPage ? " active" : "") + '" id="gf-nav-alle" title="In „Alle Beiträge für Dich“ zu diesem Datum springen">Alle Beiträge →</button>';
      html += '<button class="gf-nav-btn' + (isUnansweredPage ? " active" : "") + '" id="gf-nav-unbeantwortet" title="Zu diesem Datum in „Unbeantwortet“ springen">Unbeantwortet →</button>';
      html += '<button class="gf-nav-btn" id="gf-nav-reset" title="Feed-Navigation zurücksetzen (Datum löschen)">Zurücksetzen ↺</button>';
      html += "</div></div>";
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Themenbereich</div>';
      html += '<span class="gf-label">Themen ausschließen (kommagetrennt):</span>';
      html += '<input type="text" class="gf-input" placeholder="z.B. Liebe, Sport, Tiere" value="' + this._escapeHTML(f.topicFilters.excludeTopics) + '" data-filter="topicFilters.excludeTopics">';
      html += '<span class="gf-label">Nur diese Themen (kommagetrennt):</span>';
      html += '<input type="text" class="gf-input" placeholder="z.B. Computer, Technik" value="' + this._escapeHTML(f.topicFilters.includeTopics) + '" data-filter="topicFilters.includeTopics">';
      html += '<div class="gf-hint">Themenname oder Slug (z.B. computer-internet)</div></div>';
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Bilder-Filter</div>';
      html += this._toggleHTML("sb-only-with-images", "contentFilters.onlyWithImages", f.contentFilters.onlyWithImages, "Nur Beiträge mit Bildern");
      html += this._toggleHTML("sb-hide-with-images", "contentFilters.hideWithImages", f.contentFilters.hideWithImages, "Beiträge mit Bildern ausblenden");
      html += '<div class="gf-hint">Filtert nach Posts mit oder ohne Bildern</div></div>';
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Gemerkte Beiträge</div>';
      html += this._toggleHTML("sb-only-bookmarked", "contentFilters.onlyBookmarked", f.contentFilters.onlyBookmarked, "Nur gemerkte anzeigen");
      html += this._toggleHTML("sb-hide-bookmarked", "contentFilters.hideBookmarked", f.contentFilters.hideBookmarked, "Gemerkte ausblenden");
      html += "</div>";
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Interaktion</div>';
      html += '<span class="gf-label">Anzahl Antworten:</span>';
      html += '<div class="gf-number-row">';
      html += '<input type="number" placeholder="Min" value="' + f.interactionFilters.minAnswers + '" data-filter="interactionFilters.minAnswers" min="0">';
      html += "<span>bis</span>";
      html += '<input type="number" placeholder="Max" value="' + f.interactionFilters.maxAnswers + '" data-filter="interactionFilters.maxAnswers" min="0">';
      html += "</div>";
      html += '<span class="gf-label">Mindest-Likes:</span>';
      html += '<input type="number" class="gf-input" placeholder="z.B. 5" value="' + f.interactionFilters.minLikes + '" data-filter="interactionFilters.minLikes" min="0">';
      html += "</div>";
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Textfilter</div>';
      html += '<span class="gf-label">Suchbegriffe (kommagetrennt):</span>';
      html += '<input type="text" class="gf-input" placeholder="z.B. JavaScript, Python" value="' + this._escapeHTML(f.textFilters.keywords) + '" data-filter="textFilters.keywords">';
      html += '<span class="gf-label">Ausschließen (kommagetrennt):</span>';
      html += '<input type="text" class="gf-input" placeholder="z.B. Spam, Werbung" value="' + this._escapeHTML(f.textFilters.excludeKeywords) + '" data-filter="textFilters.excludeKeywords">';
      html += "</div>";
      html += '<div class="gf-section">';
      html += '<div class="gf-section-title">Einstellungen</div>';
      html += '<span class="gf-label">Tags automatisch entfernen (kommagetrennt):</span>';
      html += '<input type="text" class="gf-input" id="gf-custom-tags" value="' + this._escapeHTML(customTags) + '">';
      html += '<span class="gf-label">Gesperrte Autoren (kommagetrennt):</span>';
      html += '<input type="text" class="gf-input" id="gf-blocked-authors" value="' + this._escapeHTML(blockedAuthors) + '">';
      html += "</div>";
      html += '<button class="gf-reset-btn">↺; Alle Filter zurücksetzen</button>';
      this.sb.bodyEl.innerHTML = html;
      this.attachEventListeners();
    }
_toggleHTML(id, dataFilter, isOn, label) {
      return [
        '<div class="gf-toggle-row">',
        '<span class="gf-toggle-label">' + label + "</span>",
        '<button class="Toggle-button u-mrm" type="button" id="' + id + '" role="switch" aria-checked="' + isOn + '"' + (dataFilter ? ' data-filter="' + dataFilter + '"' : "") + ">",
        '<span class="Toggle ' + (isOn ? "Toggle--on" : "Toggle--off") + '"><span class="Toggle-label"></span></span>',
        "</button></div>"
      ].join("");
    }
_escapeHTML(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
attachEventListeners() {
      var body = this.sb.bodyEl;
      var fi = this.fi;
      var typeChecks = body.querySelectorAll("[data-posttype]");
      for (var tc = 0; tc < typeChecks.length; tc++) {
        typeChecks[tc].addEventListener("change", function() {
          var type = this.getAttribute("data-posttype");
          var hideTypes = (fi.filters.contentFilters.hidePostTypes || []).slice();
          if (this.checked) {
            var idx = hideTypes.indexOf(type);
            if (idx > -1) hideTypes.splice(idx, 1);
          } else {
            if (hideTypes.indexOf(type) === -1) hideTypes.push(type);
          }
          fi.filters.contentFilters.hidePostTypes = hideTypes;
          fi.saveFilters().then(function() {
            fi.updateFilterIndicator();
            fi.enableFilters();
            fi.debouncedApplyFilters();
          });
        });
      }
      var toggleBtns = body.querySelectorAll(".Toggle-button[data-filter]");
      for (var tb = 0; tb < toggleBtns.length; tb++) {
        toggleBtns[tb].addEventListener("click", function() {
          var toggle = this.querySelector(".Toggle");
          var isOn = toggle.classList.contains("Toggle--on");
          if (!isOn && (this.id === "sb-only-bookmarked" || this.id === "sb-hide-bookmarked")) {
            var otherId = this.id === "sb-only-bookmarked" ? "sb-hide-bookmarked" : "sb-only-bookmarked";
            var other = body.querySelector("#" + otherId);
            if (other && other.querySelector(".Toggle").classList.contains("Toggle--on")) {
              other.querySelector(".Toggle").classList.replace("Toggle--on", "Toggle--off");
              other.setAttribute("aria-checked", "false");
              fi.updateFilterValue(other.getAttribute("data-filter"), false);
            }
          }
          if (!isOn && (this.id === "sb-only-with-images" || this.id === "sb-hide-with-images")) {
            var otherId2 = this.id === "sb-only-with-images" ? "sb-hide-with-images" : "sb-only-with-images";
            var other2 = body.querySelector("#" + otherId2);
            if (other2 && other2.querySelector(".Toggle").classList.contains("Toggle--on")) {
              other2.querySelector(".Toggle").classList.replace("Toggle--on", "Toggle--off");
              other2.setAttribute("aria-checked", "false");
              fi.updateFilterValue(other2.getAttribute("data-filter"), false);
            }
          }
          toggle.classList.toggle("Toggle--on", !isOn);
          toggle.classList.toggle("Toggle--off", isOn);
          this.setAttribute("aria-checked", !isOn);
          fi.updateFilterValue(this.getAttribute("data-filter"), !isOn).then(function() {
            fi.enableFilters();
            fi.debouncedApplyFilters();
          });
        });
      }
      var filterInputs = body.querySelectorAll("input[data-filter]");
      for (var fi2 = 0; fi2 < filterInputs.length; fi2++) {
        filterInputs[fi2].addEventListener("change", function() {
          fi.updateFilterValue(this.getAttribute("data-filter"), this.value).then(function() {
            fi.enableFilters();
            fi.debouncedApplyFilters();
          });
        });
      }
      var navDate = body.querySelector("#gf-nav-date");
      if (navDate) {
        navDate.addEventListener("change", async function() {
          await GM.setValue("navDate", this.value);
        });
      }
      var navAlle = body.querySelector("#gf-nav-alle");
      if (navAlle) {
        navAlle.addEventListener("click", function() {
          navigateToDate("alle");
        });
      }
      var navUnanswered = body.querySelector("#gf-nav-unbeantwortet");
      if (navUnanswered) {
        navUnanswered.addEventListener("click", function() {
          navigateToDate("unbeantwortet");
        });
      }
      var navReset = body.querySelector("#gf-nav-reset");
      if (navReset) {
        navReset.addEventListener("click", function() {
          resetNavigation();
          var dateInput = body.querySelector("#gf-nav-date");
          if (dateInput) dateInput.value = "";
          var url = new URL(window.location.href);
          if (url.searchParams.has("springe-zu")) {
            url.searchParams.delete("springe-zu");
            window.location.href = url.toString();
          }
        });
      }
      var customTagsInput = body.querySelector("#gf-custom-tags");
      if (customTagsInput) {
        customTagsInput.addEventListener("change", async function() {
          await GM.setValue("customTagsToRemove", parseCSV(this.value, false));
        });
      }
      var blockedAuthorsInput = body.querySelector("#gf-blocked-authors");
      if (blockedAuthorsInput) {
        blockedAuthorsInput.addEventListener("change", async function() {
          await GM.setValue("blockedAuthors", parseCSV(this.value, false));
          fi.enableFilters();
          fi.debouncedApplyFilters();
        });
      }
      var resetBtn = body.querySelector(".gf-reset-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", (async function() {
          fi.filters = {
            afterDate: DEFAULT_FILTERS.afterDate,
            contentFilters: Object.assign({}, DEFAULT_FILTERS.contentFilters),
            interactionFilters: Object.assign({}, DEFAULT_FILTERS.interactionFilters),
            textFilters: Object.assign({}, DEFAULT_FILTERS.textFilters),
            topicFilters: Object.assign({}, DEFAULT_FILTERS.topicFilters)
          };
          await fi.saveFilters();
          await this.renderContent();
          fi.updateFilterIndicator();
          await fi.applyFilters();
        }).bind(this));
      }
    }
  }
  // @license      MIT
  var log = createLogger("Gutefrage Smart Filters");
  GM_addStyle([
    ".FilterMenu { max-height:60vh !important; overflow-y:auto !important; overflow-x:hidden !important; padding-right:10px !important; position:relative !important; scrollbar-width:thin; scrollbar-color:rgba(0,0,0,0.3) rgba(0,0,0,0.1); }",
    ".FilterMenu::-webkit-scrollbar { width:6px; }",
    ".FilterMenu::-webkit-scrollbar-track { background:rgba(0,0,0,0.1); border-radius:3px; }",
    ".FilterMenu::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.3); border-radius:3px; }",
    ".FilterMenu::-webkit-scrollbar-thumb:hover { background:rgba(0,0,0,0.5); }",
    ".Toggletip-content { max-height:70vh !important; }",
    ".FilterMenu-section { position:sticky; top:-1px; background:inherit; z-index:1; padding-bottom:5px; }"
  ].join("\n"));
  log.log("Initializing...");
  new TagRemover();
  var filterIntegration = new EnhancedFilterIntegration();
  filterIntegration.init().then(function() {
    new SidebarPanel(filterIntegration);
  });
  log.log("Ready!");

})();
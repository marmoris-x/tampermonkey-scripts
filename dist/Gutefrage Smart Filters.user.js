// ==UserScript==
// @name         Gutefrage Smart Filters
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      4.0.2
// @author       marmoris
// @description  Enhanced filtering options and automatic tag management for gutefrage.net
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=gutefrage.net
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Gutefrage%20Smart%20Filters.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Gutefrage%20Smart%20Filters.user.js
// @match        https://www.gutefrage.net/*
// @sandbox      raw
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        window.close
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    const tag = "[" + prefix + "]";
    return {
      log: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        const args = [tag];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          const args = [tag];
          for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  function waitForElement(selector, timeout, root) {
    timeout = timeout || 1e4;
    root = root || document.body;
    return new Promise(function(resolve, reject) {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);
      let timer;
      const observer = new MutationObserver(function(mutations) {
        for (let m = 0; m < mutations.length; m++) {
          const nodes = mutations[m].addedNodes;
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType !== Node.ELEMENT_NODE) continue;
            if (nodes[i].matches && nodes[i].matches(selector)) {
              cleanup();
              return resolve(nodes[i]);
            }
            const child = nodes[i].querySelector && nodes[i].querySelector(selector);
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
    let timer = 0;
    return function() {
      const ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(ctx, args);
      }, ms);
    };
  }
  function observeMutations(callback, root) {
    root = root || document.body;
    const observer = new MutationObserver(function(mutations) {
      for (let m = 0; m < mutations.length; m++) {
        const nodes = mutations[m].addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === Node.ELEMENT_NODE) callback(nodes[i], observer);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  }
  const tagLog = createLogger("Gutefrage Tag Remover");
  const DEFAULT_TAGS = ["islam", "allah", "muslime", "koran", "mohammed"];
  const TAG_REMOVER_CSS = [
    ".gf-tr-btn { color:white; border:none; padding:4px 12px; margin-left:8px; border-radius:12px; font-size:13px; font-weight:500; cursor:pointer; transition:background-color 0.2s; display:inline-flex; align-items:center; height:24px; white-space:nowrap; }",
    ".gf-tr-btn-remove { background-color:#dc3545; }",
    ".gf-tr-btn-remove:hover { background-color:#c82333; }",
    ".gf-tr-btn-block { background-color:#6c757d; }",
    ".gf-tr-btn-block:hover { background-color:#545b62; }",
    ".gf-tr-notification { position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#ffc107; color:#000; padding:15px 20px; border-radius:8px; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px; font-weight:500; }"
  ].join("\n");
  async function waitForTagPageReady() {
    if (document.readyState !== "complete") await new Promise(function(r) {
      window.addEventListener("load", r);
    });
    try {
      await waitForElement(".Tag-container, .Tag, article, main", 8e3);
    } catch (e) {
    }
    const delay = Math.min(3e3, Math.max(500, document.querySelectorAll("*").length / 100));
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
      GM_addStyle(TAG_REMOVER_CSS);
      this.addRemoveButtons();
      this.autoRemoveAndClose();
      this.observeNewContent();
    }
removeTag(tagElement) {
      const hideButton = tagElement.querySelector(".Tag-action");
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
      let tagsRemoved = 0;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const tagContainers = document.querySelectorAll(".Tag-container");
        tagLog.log("Attempt " + attempt + "/" + maxAttempts + ", found " + tagContainers.length + " containers");
        if (tagContainers.length === 0 && attempt < maxAttempts) {
          await new Promise(function(r) {
            setTimeout(r, 2e3);
          });
          continue;
        }
        for (let i = 0; i < tagContainers.length; i++) {
          let tagSlug = tagContainers[i].querySelector(".Tag");
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
      Array.prototype.forEach.call(document.querySelectorAll("article.ListingElement, .ContentCard"), function(article) {
        if (article.querySelector(".custom-remove-tags-button")) return;
        let buttonContainer = article.querySelector(".ListingElement-bottomBar--withItemActions .u-flex:last-child");
        if (!buttonContainer) buttonContainer = article.querySelector(".ContentCard-action, .ContentCard-actions");
        if (!buttonContainer) {
          const tagSection = article.querySelector(".Tag");
          if (tagSection) buttonContainer = tagSection.parentElement;
        }
        if (!buttonContainer) return;
        const removeBtn = document.createElement("button");
        removeBtn.className = "Tag custom-remove-tags-button gf-tr-btn gf-tr-btn-remove";
        removeBtn.textContent = "Tags entfernen";
        removeBtn.title = "Removes unwanted tags from this post";
        removeBtn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          const ql = article.querySelector('a[href*="/frage/"], .ContentCard-link, .ListingElement-questionLink');
          if (ql) {
            const url = new URL(ql.href);
            url.searchParams.set("removeTagsAuto", "true");
            removeBtn.textContent = "Wird bearbeitet...";
            removeBtn.classList.remove("gf-tr-btn-remove");
            removeBtn.classList.add("gf-tr-btn-done");
            removeBtn.style.backgroundColor = "#28a745";
            if (typeof GM_openInTab !== "undefined") {
              GM_openInTab(url.href, { active: false, insert: true, setParent: true });
            } else {
              window.open(url.href, "_blank");
            }
            setTimeout(function() {
              removeBtn.textContent = "Tags entfernen";
              removeBtn.style.backgroundColor = "#dc3545";
              removeBtn.classList.remove("gf-tr-btn-done");
              removeBtn.classList.add("gf-tr-btn-remove");
            }, 2e3);
          }
        });
        buttonContainer.appendChild(removeBtn);
        const authorEl = article.querySelector(".ContentMeta-author a");
        if (authorEl) {
          const blockBtn = document.createElement("button");
          blockBtn.className = "Tag custom-block-author-button gf-tr-btn gf-tr-btn-block";
          blockBtn.textContent = "Autor sperren";
          blockBtn.title = "Hides all posts from this author";
          blockBtn.addEventListener("click", async function(e) {
            e.preventDefault();
            e.stopPropagation();
            const name = authorEl.textContent.trim();
            const blocked = await GM.getValue("blockedAuthors", []);
            if (blocked.indexOf(name) === -1) {
              blocked.push(name);
              await GM.setValue("blockedAuthors", blocked);
            }
            const container = article.closest(".Plate.ListingElement") || article;
            container.style.display = "none";
          });
          buttonContainer.appendChild(blockBtn);
        }
      });
    }
async autoRemoveAndClose() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("removeTagsAuto") !== "true") return;
      tagLog.log("Auto-remove mode activated");
      const notification = document.createElement("div");
      notification.className = "gf-tr-notification";
      notification.textContent = "Warte auf vollstandiges Laden der Seite...";
      document.body.appendChild(notification);
      const progressInterval = setInterval(function() {
        const containers = document.querySelectorAll(".Tag-container");
        notification.textContent = "Seite wird geladen... (" + containers.length + " Tags gefunden)";
      }, 1e3);
      try {
        const tagsRemoved = await this.removeUnwantedTags();
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
      const self = this;
      observeMutations(function(node) {
        if (node.matches && (node.matches("article.ListingElement, .ContentCard") || node.querySelector("article.ListingElement, .ContentCard"))) {
          self.addRemoveButtons();
        }
      });
    }
  }
  async function loadSetting(key, defaultValue) {
    try {
      const raw = await GM.getValue(key);
      if (raw === void 0 || raw === null) return defaultValue;
      return raw;
    } catch (e) {
      return defaultValue;
    }
  }
  async function saveSetting(key, value) {
    await GM.setValue(key, value);
  }
  function normalizeText(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[äæ]/g, "ae").replace(/[öœ]/g, "oe").replace(/[ü]/g, "ue").replace(/ß/g, "ss").replace(/[àáâãå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i").replace(/[òóôõ]/g, "o").replace(/[ùúû]/g, "u").replace(/[ñ]/g, "n").replace(/[ç]/g, "c").replace(/[-_.:]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function matchAnyTerm(text, terms) {
    const n = normalizeText(text);
    for (let i = 0; i < terms.length; i++) {
      if (n.indexOf(normalizeText(terms[i])) !== -1) return true;
    }
    return false;
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
    const el = post.querySelector(".Question-title");
    return el ? el.textContent.trim() : "";
  }
  function getPostAuthor(post) {
    const el = post.querySelector(".ContentMeta-author a");
    return el ? el.textContent.trim() : "";
  }
  function getPostDateTime(post) {
    const el = post.querySelector("time[datetime]");
    return el ? el.getAttribute("datetime") : "";
  }
  function getPostImagesStatus(post) {
    return !!post.querySelector('button[aria-label="Mit Bildern"]') || !!post.querySelector(".ListingElement-image");
  }
  function getAnswerCount(post) {
    const selectors = ['a[href*="/frage/"]', 'a[href*="/diskussion/"]', 'a[href*="/umfrage/"]', ".ListingElement-bottomBar a"];
    for (let s = 0; s < selectors.length; s++) {
      const links = post.querySelectorAll(selectors[s]);
      for (let i = 0; i < links.length; i++) {
        const text = links[i].textContent.trim();
        if (text.toLowerCase().indexOf("keine antwort") !== -1) return 0;
        let match = text.match(/(\d+)\s+Antwort/i);
        if (!match && text.toLowerCase().indexOf("antwort") !== -1) {
          const nm = text.match(/(\d+)/);
          if (nm) match = [null, nm[1]];
        }
        if (match) return parseInt(match[1], 10);
      }
    }
    return 0;
  }
  function applyDateFilter(post, afterDate) {
    if (!afterDate) return true;
    const timeEl = post.querySelector("time[datetime]");
    if (!timeEl) return true;
    const postDate = new Date(timeEl.getAttribute("datetime"));
    return postDate >= new Date(afterDate);
  }
  function applyPostTypeFilter(post, hideTypes) {
    if (!hideTypes || hideTypes.length === 0) return true;
    const link = post.querySelector("a.ListingElement-questionLink[href]");
    if (!link) return true;
    const href = link.getAttribute("href");
    const type = href.indexOf("/frage/") !== -1 ? "frage" : href.indexOf("/diskussion/") !== -1 ? "diskussion" : href.indexOf("/umfrage/") !== -1 ? "umfrage" : null;
    if (type && hideTypes.indexOf(type) !== -1) return false;
    return true;
  }
  function applyBookmarkFilter(post, onlyBookmarked, hideBookmarked) {
    if (!onlyBookmarked && !hideBookmarked) return true;
    const isBookmarked = !!post.querySelector(".Icon--bookmark-filled-large");
    if (onlyBookmarked && !isBookmarked) return false;
    if (hideBookmarked && isBookmarked) return false;
    return true;
  }
  function applyImagesFilter(post, onlyWithImages, hideWithImages) {
    if (!onlyWithImages && !hideWithImages) return true;
    const hasImages = getPostImagesStatus(post);
    if (onlyWithImages && !hasImages) return false;
    if (hideWithImages && hasImages) return false;
    return true;
  }
  function applyAuthorFilter(post, blockedAuthors) {
    if (!blockedAuthors || blockedAuthors.length === 0) return true;
    const authorName = getPostAuthor(post).toLowerCase();
    if (authorName && blockedAuthors.indexOf(authorName) !== -1) return false;
    return true;
  }
  function applyTopicFilter(post, excludeTopics, includeTopics) {
    if ((!excludeTopics || excludeTopics.length === 0) && (!includeTopics || includeTopics.length === 0)) return true;
    const topicEls = post.querySelectorAll('a[href*="/thema/"], a:has(.BrandAvatar), [data-topic-slug], .ContentMeta-topic, .ContentMeta-category, a.u-strongLight:has(.BrandAvatar--small)');
    const topicStrings = [];
    for (let t = 0; t < topicEls.length; t++) {
      const el = topicEls[t];
      const text = (el.textContent || "").trim().toLowerCase();
      if (text) topicStrings.push(text);
      const href = el.getAttribute("href");
      if (href) {
        const clean = href.replace(/^https?:\/\/[^\/]+/, "").split("?")[0].split("#")[0].replace(/^\/|\/$/g, "");
        if (clean && !clean.match(/^(frage|diskussion|umfrage|home|meine|suche|nutzer)\//)) {
          topicStrings.push(clean);
          if (clean.indexOf("/") !== -1) {
            const parts = clean.split("/");
            for (let pt = 0; pt < parts.length; pt++) {
              if (parts[pt]) topicStrings.push(parts[pt]);
            }
          }
        }
      }
      const dataSlug = el.getAttribute("data-topic-slug");
      if (dataSlug) topicStrings.push(dataSlug.toLowerCase());
    }
    const uniqueTopics = [...new Set(topicStrings)];
    if (excludeTopics && excludeTopics.length > 0 && uniqueTopics.length > 0) {
      for (let ex = 0; ex < uniqueTopics.length; ex++) {
        for (let ec = 0; ec < excludeTopics.length; ec++) {
          if (topicsMatch(uniqueTopics[ex], excludeTopics[ec])) return false;
        }
      }
    }
    if (includeTopics && includeTopics.length > 0 && uniqueTopics.length > 0) {
      for (let ic = 0; ic < uniqueTopics.length; ic++) {
        for (let ic2 = 0; ic2 < includeTopics.length; ic2++) {
          if (topicsMatch(uniqueTopics[ic], includeTopics[ic2])) return true;
        }
      }
      return false;
    }
    return true;
  }
  function applyTextFilter(post, keywords, excludeKeywords) {
    if ((!keywords || keywords.length === 0) && (!excludeKeywords || excludeKeywords.length === 0)) return true;
    const titleText = getPostTitle(post).toLowerCase();
    const bodyEl = post.querySelector(".ContentBody");
    const bodyText = bodyEl ? (bodyEl.textContent || "").toLowerCase() : "";
    const authorText = getPostAuthor(post).toLowerCase();
    const searchable = titleText + " " + bodyText + " " + authorText;
    if (keywords && keywords.length > 0) {
      let kwMatch = false;
      for (let kw = 0; kw < keywords.length; kw++) {
        if (searchable.indexOf(keywords[kw]) !== -1) {
          kwMatch = true;
          break;
        }
      }
      if (!kwMatch) return false;
    }
    if (excludeKeywords && excludeKeywords.length > 0) {
      for (let ek = 0; ek < excludeKeywords.length; ek++) {
        if (searchable.indexOf(excludeKeywords[ek]) !== -1) return false;
      }
    }
    return true;
  }
  function applyInteractionFilter(post, minAnswers, maxAnswers, minLikes) {
    if (minAnswers !== "" || maxAnswers !== "") {
      const answerCount = getAnswerCount(post);
      const minA = parseInt(minAnswers, 10);
      const maxA = parseInt(maxAnswers, 10);
      if (!isNaN(minA) && answerCount < minA) return false;
      if (!isNaN(maxA) && answerCount > maxA) return false;
    }
    if (minLikes) {
      const likeBtn = post.querySelector('.ActionBarIcon button[aria-label*="Daumen"]');
      const likes = likeBtn ? parseInt((likeBtn.getAttribute("aria-label").match(/(\d+)/) || [])[1], 10) || 0 : parseInt((post.querySelector(".ActionBarIcon-count") || {}).textContent, 10) || 0;
      if (likes < parseInt(minLikes, 10)) return false;
    }
    return true;
  }
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) hash = (hash << 5) + hash + str.charCodeAt(i);
    return (hash & 2147483647).toString(36).substring(0, 8);
  }
  function getPostFingerprint(post) {
    return hashString(getPostTitle(post)) + "|" + getPostAuthor(post) + "|" + getPostDateTime(post) + "|" + getPostImagesStatus(post) + "|" + getAnswerCount(post);
  }
  const log$1 = createLogger("Gutefrage Smart Filters");
  const DEFAULT_FILTERS = {
    afterDate: "",
    contentFilters: { onlyBookmarked: false, hideBookmarked: false, onlyWithImages: false, hideWithImages: false, hidePostTypes: [] },
    interactionFilters: { minAnswers: "", maxAnswers: "", minLikes: "" },
    textFilters: { keywords: "", excludeKeywords: "" },
    topicFilters: { excludeTopics: "", includeTopics: "" }
  };
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
      this.enableFilters();
    }
async loadFilters() {
      const saved = await loadSetting("enhancedFilters", {});
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
      const result = Object.assign({}, defaults);
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
      const self = this;
      this.postObserver = observeMutations(function(node) {
        if (!self.filtersEnabled) return;
        if (node.matches && (node.matches(".Plate.ListingElement") || node.querySelector(".Plate.ListingElement"))) {
          self.debouncedApplyFilters();
        }
      });
    }
async updateFilterValue(filterPath, value) {
      const paths = filterPath.split(".");
      let current = this.filters;
      for (let i = 0; i < paths.length - 1; i++) current = current[paths[i]];
      current[paths[paths.length - 1]] = value;
      await this.saveFilters();
      this.updateFilterIndicator();
    }
updateFilterIndicator() {
      const countSpan = document.querySelector(".Filter-buttonActiveFiltersCount");
      if (!countSpan) return;
      let activeCount = 0;
      if (this.filters.afterDate) activeCount++;
      const cf = this.filters.contentFilters;
      if (cf.onlyBookmarked) activeCount++;
      if (cf.hideBookmarked) activeCount++;
      if (cf.onlyWithImages) activeCount++;
      if (cf.hideWithImages) activeCount++;
      if (cf.hidePostTypes && cf.hidePostTypes.length > 0) activeCount++;
      const inf = this.filters.interactionFilters;
      if (inf.minAnswers || inf.maxAnswers || inf.minLikes) activeCount++;
      const tf = this.filters.textFilters;
      if (tf.keywords || tf.excludeKeywords) activeCount++;
      const topf = this.filters.topicFilters;
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
      const blockedAuthors = await GM.getValue("blockedAuthors", []);
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
      const posts = document.querySelectorAll(".Plate.ListingElement");
      let visibleCount = 0;
      const currentHash = await this.getFilterHash();
      const shortHash = hashString(currentHash);
      if (currentHash !== this.lastFilterHash) {
        this.filterCache = {};
        this.lastFilterHash = currentHash;
        await this.updateParsedFilters();
      }
      if (Object.keys(this.filterCache).length > 1e3) this.filterCache = {};
      if (!this.parsedFilterData || this.parsedFilterData.excludeTopics === null) await this.updateParsedFilters();
      const {
        afterDate,
        contentFilters: { onlyBookmarked, hideBookmarked, onlyWithImages, hideWithImages, hidePostTypes },
        interactionFilters: { minAnswers, maxAnswers, minLikes }
      } = this.filters;
      const { excludeTopics: parsedExcludeTopics, includeTopics: parsedIncludeTopics, keywords: parsedKeywords, excludeKeywords: parsedExcludeKeywords, blockedAuthors } = this.parsedFilterData;
      for (let p = 0; p < posts.length; p++) {
        const post = posts[p];
        const fingerprint = getPostFingerprint(post);
        const cacheKey = currentHash + "|" + fingerprint;
        if (this.filterCache[cacheKey] !== void 0) {
          const cached = this.filterCache[cacheKey];
          post.style.display = cached ? "" : "none";
          post.dataset.filterHash = shortHash;
          post.dataset.lastFilterResult = cached ? "visible" : "hidden";
          if (cached) visibleCount++;
          continue;
        }
        const postHash = post.dataset.filterHash;
        const lastResult = post.dataset.lastFilterResult;
        if (postHash === shortHash && lastResult) {
          const domCached = lastResult === "visible";
          this.filterCache[cacheKey] = domCached;
          post.style.display = domCached ? "" : "none";
          if (domCached) visibleCount++;
          continue;
        }
        let shouldShow = true;
        if (shouldShow) shouldShow = applyDateFilter(post, afterDate);
        if (shouldShow) shouldShow = applyPostTypeFilter(post, hidePostTypes);
        if (shouldShow) shouldShow = applyBookmarkFilter(post, onlyBookmarked, hideBookmarked);
        if (shouldShow) shouldShow = applyImagesFilter(post, onlyWithImages, hideWithImages);
        if (shouldShow) shouldShow = applyAuthorFilter(post, blockedAuthors);
        if (shouldShow) shouldShow = applyTopicFilter(post, parsedExcludeTopics, parsedIncludeTopics);
        if (shouldShow) shouldShow = applyTextFilter(post, parsedKeywords, parsedExcludeKeywords);
        if (shouldShow) shouldShow = applyInteractionFilter(post, minAnswers, maxAnswers, minLikes);
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
    const host = document.createElement(opts.tag || "div");
    if (opts.id) host.id = opts.id;
    if (opts.className) host.className = opts.className;
    const root = host.attachShadow({ mode: "closed" });
    if (opts.styles) {
      const style = document.createElement("style");
      style.textContent = opts.styles;
      root.appendChild(style);
    }
    document.body.appendChild(host);
    return { host, root };
  }
  function createSidebar(opts) {
    opts = opts || {};
    const width = opts.width || 340;
    const accent = opts.accentColor || "#2196F3";
    const title = opts.title || "";
    let isOpen = false;
    const baseCSS = [
      ":host { all:initial; contain:strict; isolation:isolate; position:fixed; top:0; right:0; width:" + width + "px; height:100vh; z-index:2147483645;",
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
    const container = createShadowContainer({ styles: baseCSS });
    const root = container.root;
    const header = document.createElement("div");
    header.className = "header";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close sidebar");
    header.appendChild(h2);
    header.appendChild(closeBtn);
    root.appendChild(header);
    const body = document.createElement("div");
    body.className = "body";
    root.appendChild(body);
    const tab = document.createElement("div");
    const tabRoot = tab.attachShadow({ mode: "closed" });
    const tabStyle = document.createElement("style");
    tabStyle.textContent = [
      ":host { position:fixed; top:50%; z-index:2147483644; background:" + accent + "; color:#fff;",
      "padding:10px 6px; border-radius:6px 0 0 6px; cursor:pointer; font:12px system-ui,sans-serif;",
      "writing-mode:vertical-rl; text-orientation:mixed; box-shadow:-2px 2px 8px rgba(0,0,0,0.3);",
      "right:0; transform:translateY(-50%) translateX(calc(100% - 28px));",
      "transition:right 0.3s ease, transform 0.3s ease; }",
      ":host(:hover) { filter:brightness(1.1); }",
      ":host(.open) { right:" + (width + 8) + "px; transform:translateY(-50%) translateX(0); }"
    ].join("");
    const tabSpan = document.createElement("span");
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
    let dragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
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
    const d = new Date(datetimeLocalValue);
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const mm = String(Math.abs(offset) % 60).padStart(2, "0");
    const local = datetimeLocalValue.length === 16 ? datetimeLocalValue + ":00" : datetimeLocalValue;
    return local + sign + hh + ":" + mm;
  }
  async function navigateToDate(section) {
    const navDate = await GM.getValue("navDate", "");
    const tz = toSpringeZu(navDate);
    const base = section === "unbeantwortet" ? "/home/meine/unbeantwortet" : "/home/meine/alle";
    const url = tz ? base + "?springe-zu=" + encodeURIComponent(tz) : base;
    window.location.href = url;
  }
  async function resetNavigation() {
    await GM.setValue("navDate", "");
  }
  const panelLog = createLogger("Gutefrage UI Panel");
  const SIDEBAR_CSS = [
    '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:opsz@9..40&family=IBM+Plex+Serif:wght@600&display=swap");',
    ".body { background:#0f1117; }",
    ".gf-stats-bar { margin:8px 0; padding:10px 16px; background:linear-gradient(135deg,#171923,#1a1c2e); border:1px solid rgba(212,163,115,0.2); border-radius:10px; font-size:13px; color:#d4a373; text-align:center; display:none; font-weight:500; box-shadow:0 4px 12px rgba(0,0,0,0.2); }",
    ".gf-stats-bar.active { display:block; }",
    ".gf-section { margin-top:10px; background:#171923; border-radius:9px; padding:12px 14px 14px; border:1px solid rgba(255,255,255,0.06); box-shadow:inset 0 1px 0 rgba(255,255,255,0.04); }",
    ".gf-section-title { font-size:13px; font-weight:600; color:#e8e6e3; margin:0 0 10px; letter-spacing:0.3px; }",
    ".gf-input { width:100%; padding:7px 10px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; font-size:12px; background:#1e2030; color:#e8e6e3; box-sizing:border-box; transition:border-color 0.2s,box-shadow 0.2s; }",
    ".gf-input + .gf-input { margin-top:5px; }",
    ".gf-input:focus { outline:none; border-color:#d4a373; box-shadow:0 0 0 3px rgba(212,163,115,0.15); }",
    ".gf-input::placeholder { color:#4a5568; }",
    ".gf-label { font-size:10px; color:#8890a4; display:block; margin:7px 0 3px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }",
    ".gf-label:first-child { margin-top:0; }",
    ".gf-hint { font-size:10px; color:#5a6785; margin-top:4px; line-height:1.5; }",
    ".gf-pill-row { display:flex; gap:6px; flex-wrap:wrap; }",
    ".gf-pill-label { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:500; cursor:pointer; padding:5px 14px; border:1.5px solid rgba(255,255,255,0.1); border-radius:20px; user-select:none; transition:all 0.2s; color:#8890a4; background:#1e2030; }",
    ".gf-pill-label:hover { border-color:rgba(212,163,115,0.3); color:#e8e6e3; }",
    ".gf-pill-label:has(input:checked) { background:#d4a373; color:#0f1117; border-color:#d4a373; box-shadow:0 2px 8px rgba(212,163,115,0.25); }",
    ".gf-pill-label input { display:none; }",
    '.gf-switch { display:flex; align-items:center; gap:10px; cursor:pointer; width:100%; padding:3px 0; font-family:"DM Sans",system-ui,sans-serif; }',
    ".gf-switch + .gf-switch { margin-top:1px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06); }",
    ".gf-switch input { display:none; }",
    ".gf-switch-track { width:36px; height:20px; background:#2d3142; border-radius:10px; position:relative; transition:background 0.2s; flex-shrink:0; }",
    ".gf-switch-thumb { width:16px; height:16px; background:#e8e6e3; border-radius:50%; position:absolute; top:2px; left:2px; transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }",
    ".gf-switch input:checked + .gf-switch-track { background:#d4a373; }",
    ".gf-switch input:checked + .gf-switch-track .gf-switch-thumb { transform:translateX(16px); }",
    ".gf-switch-label { font-size:12px; color:#e8e6e3; }",
    ".gf-number-row { display:flex; align-items:center; gap:8px; }",
    ".gf-number-row input { width:72px; padding:7px 8px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; font-size:13px; background:#1e2030; color:#e8e6e3; transition:border-color 0.2s,box-shadow 0.2s; }",
    ".gf-number-row input:focus { outline:none; border-color:#d4a373; box-shadow:0 0 0 3px rgba(212,163,115,0.15); }",
    ".gf-number-row span { font-size:12px; color:#8890a4; }",
    ".gf-nav-row { display:flex; gap:6px; margin-top:8px; }",
    ".gf-nav-btn { flex:1; padding:7px 8px; font-size:11px; font-weight:600; background:#1e2030; color:#d4a373; border:1.5px solid #d4a373; border-radius:6px; cursor:pointer; transition:all 0.2s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
    ".gf-nav-btn:hover { background:#d4a373; color:#0f1117; box-shadow:0 2px 8px rgba(212,163,115,0.25); }",
    ".gf-nav-btn:disabled { opacity:0.38; cursor:not-allowed; border-color:rgba(255,255,255,0.1); color:#5a6785; }",
    ".gf-nav-btn:disabled:hover { background:#1e2030; color:#5a6785; box-shadow:none; }",
    ".gf-nav-btn.active { background:#d4a373; color:#0f1117; }",
    "#gf-nav-reset { background:#1e2030; color:#8890a4; border-color:rgba(255,255,255,0.1); }",
    "#gf-nav-reset:hover { background:rgba(192,57,43,0.15); border-color:rgba(192,57,43,0.4); color:#e57373; }",
    ".gf-reset-btn { display:block; width:100%; margin-top:16px; padding:10px; background:#171923; border:1.5px solid rgba(255,255,255,0.06); border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; color:#5a6785; transition:all 0.2s; letter-spacing:0.2px; text-align:center; }",
    ".gf-reset-btn:hover { background:rgba(192,57,43,0.12); border-color:rgba(192,57,43,0.35); color:#e57373; }"
  ].join("\n");
  class SidebarPanel {
constructor(fi) {
      if (!window.location.pathname.startsWith("/home/")) return;
      this.fi = fi;
      fi.sidebar = this;
      this.sb = createSidebar({
        width: 340,
        title: "Gutefrage Filter",
        accentColor: "#d4a373",
        onOpen: function() {
          fi.enableFilters();
          setTimeout(function() {
            fi.applyFilters();
          }, 100);
        },
        onClose: function() {
        }
      });
      this.renderContent().catch(function(err) {
        panelLog.warn("Panel render error:", err);
      });
    }
isOpen() {
      return this.sb.isOpen();
    }
updateStats(visible, total) {
      const statsEl = this.sb.bodyEl.querySelector(".gf-stats-bar");
      if (!statsEl) return;
      const filtered = total - visible;
      if (filtered > 0) {
        statsEl.textContent = visible + " sichtbar  ·  " + filtered + " ausgeblendet";
        statsEl.classList.add("active");
      } else {
        statsEl.classList.remove("active");
      }
    }

_ce(tag, attrs, ...children) {
      const el = document.createElement(tag);
      if (attrs) {
        for (const key of Object.keys(attrs)) {
          const value = attrs[key];
          if (key === "className") {
            el.className = value;
          } else if (key === "textContent") {
            el.textContent = value;
          } else {
            el.setAttribute(key, value);
          }
        }
      }
      for (const child of children) {
        if (typeof child === "string") {
          el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          el.appendChild(child);
        }
      }
      return el;
    }
_section(title) {
      const sec = this._ce("div", { className: "gf-section" });
      sec.appendChild(this._ce("div", { className: "gf-section-title", textContent: title }));
      return sec;
    }
_pillCheckbox(postType, label, checked) {
      const lbl = this._ce("label", { className: "gf-pill-label" });
      const input = this._ce("input", { type: "checkbox", "data-posttype": postType });
      input.checked = checked;
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(" " + label));
      return lbl;
    }
_toggleEl(id, dataFilter, isOn, label) {
      const lbl = this._ce("label", { className: "gf-switch", id });
      const input = this._ce("input", { type: "checkbox", role: "switch" });
      if (dataFilter) input.setAttribute("data-filter", dataFilter);
      input.checked = isOn;
      lbl.appendChild(input);
      const track = this._ce("span", { className: "gf-switch-track" });
      track.appendChild(this._ce("span", { className: "gf-switch-thumb" }));
      lbl.appendChild(track);
      lbl.appendChild(this._ce("span", { className: "gf-switch-label", textContent: label }));
      return lbl;
    }
async renderContent() {
      const f = this.fi.filters;
      const hideTypes = f.contentFilters.hidePostTypes || [];
      const customTags = (await GM.getValue("customTagsToRemove", DEFAULT_TAGS)).join(", ");
      const blockedAuthors = (await GM.getValue("blockedAuthors", [])).join(", ");
      const dateVal = f.afterDate || "";
      const navDateVal = await GM.getValue("navDate", "");
      const isUnansweredPage = window.location.pathname.indexOf("/unbeantwortet") !== -1;
      const container = this.sb.bodyEl;
      container.textContent = "";
      const fragment = document.createDocumentFragment();
      const styleEl = document.createElement("style");
      styleEl.textContent = SIDEBAR_CSS;
      fragment.appendChild(styleEl);
      fragment.appendChild(this._ce("div", { className: "gf-stats-bar" }));
      {
        const sec = this._section("Fragetyp");
        const row = this._ce("div", { className: "gf-pill-row" });
        row.appendChild(this._pillCheckbox("frage", "Fragen", hideTypes.indexOf("frage") === -1));
        row.appendChild(this._pillCheckbox("diskussion", "Diskussionen", hideTypes.indexOf("diskussion") === -1));
        row.appendChild(this._pillCheckbox("umfrage", "Umfragen", hideTypes.indexOf("umfrage") === -1));
        sec.appendChild(row);
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Datum-Filter");
        const dateInput = this._ce("input", { type: "datetime-local", className: "gf-input", "data-filter": "afterDate" });
        dateInput.value = dateVal;
        dateInput.title = "Nur Beiträge ab diesem Datum anzeigen";
        sec.appendChild(dateInput);
        const hint = this._ce("div", { className: "gf-hint" });
        hint.appendChild(document.createTextNode("Blendet Beiträge "));
        const hintStrong = document.createElement("strong");
        hintStrong.textContent = "vor";
        hint.appendChild(hintStrong);
        hint.appendChild(document.createTextNode(" diesem Datum aus (AB-Filter)"));
        sec.appendChild(hint);
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Feed-Navigation");
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Zu diesem Datum springen:" }));
        const navInput = this._ce("input", { type: "datetime-local", className: "gf-input", id: "gf-nav-date" });
        navInput.value = navDateVal;
        sec.appendChild(navInput);
        const navHint = this._ce("div", { className: "gf-hint" });
        navHint.appendChild(document.createTextNode("Springt im Feed zu Beiträgen "));
        const navStrong = document.createElement("strong");
        navStrong.textContent = "vor";
        navHint.appendChild(navStrong);
        navHint.appendChild(document.createTextNode(" diesem Datum"));
        sec.appendChild(navHint);
        const navRow = this._ce("div", { className: "gf-nav-row" });
        navRow.appendChild(this._ce("button", { className: "gf-nav-btn" + (!isUnansweredPage ? " active" : ""), id: "gf-nav-alle", title: "In „Alle Beiträge für Dich“ zu diesem Datum springen", textContent: "Alle Beiträge →" }));
        navRow.appendChild(this._ce("button", { className: "gf-nav-btn" + (isUnansweredPage ? " active" : ""), id: "gf-nav-unbeantwortet", title: "Zu diesem Datum in „Unbeantwortet“ springen", textContent: "Unbeantwortet →" }));
        navRow.appendChild(this._ce("button", { className: "gf-nav-btn", id: "gf-nav-reset", title: "Feed-Navigation zurücksetzen (Datum löschen)", textContent: "Zurücksetzen ↺" }));
        sec.appendChild(navRow);
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Themenbereich");
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Themen ausschließen (kommagetrennt):" }));
        const excludeInput = this._ce("input", { type: "text", className: "gf-input", placeholder: "z.B. Liebe, Sport, Tiere", "data-filter": "topicFilters.excludeTopics" });
        excludeInput.value = f.topicFilters.excludeTopics;
        sec.appendChild(excludeInput);
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Nur diese Themen (kommagetrennt):" }));
        const includeInput = this._ce("input", { type: "text", className: "gf-input", placeholder: "z.B. Computer, Technik", "data-filter": "topicFilters.includeTopics" });
        includeInput.value = f.topicFilters.includeTopics;
        sec.appendChild(includeInput);
        sec.appendChild(this._ce("div", { className: "gf-hint", textContent: "Themenname oder Slug (z.B. computer-internet)" }));
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Bilder-Filter");
        sec.appendChild(this._toggleEl("sb-only-with-images", "contentFilters.onlyWithImages", f.contentFilters.onlyWithImages, "Nur Beiträge mit Bildern"));
        sec.appendChild(this._toggleEl("sb-hide-with-images", "contentFilters.hideWithImages", f.contentFilters.hideWithImages, "Beiträge mit Bildern ausblenden"));
        sec.appendChild(this._ce("div", { className: "gf-hint", textContent: "Filtert nach Posts mit oder ohne Bildern" }));
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Gemerkte Beiträge");
        sec.appendChild(this._toggleEl("sb-only-bookmarked", "contentFilters.onlyBookmarked", f.contentFilters.onlyBookmarked, "Nur gemerkte anzeigen"));
        sec.appendChild(this._toggleEl("sb-hide-bookmarked", "contentFilters.hideBookmarked", f.contentFilters.hideBookmarked, "Gemerkte ausblenden"));
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Interaktion");
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Anzahl Antworten:" }));
        const numRow = this._ce("div", { className: "gf-number-row" });
        const minAns = this._ce("input", { type: "number", placeholder: "Min", "data-filter": "interactionFilters.minAnswers" });
        minAns.value = f.interactionFilters.minAnswers;
        minAns.setAttribute("min", "0");
        numRow.appendChild(minAns);
        numRow.appendChild(this._ce("span", { textContent: "bis" }));
        const maxAns = this._ce("input", { type: "number", placeholder: "Max", "data-filter": "interactionFilters.maxAnswers" });
        maxAns.value = f.interactionFilters.maxAnswers;
        maxAns.setAttribute("min", "0");
        numRow.appendChild(maxAns);
        sec.appendChild(numRow);
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Mindest-Likes:" }));
        const likesInput = this._ce("input", { type: "number", className: "gf-input", placeholder: "z.B. 5", "data-filter": "interactionFilters.minLikes" });
        likesInput.value = f.interactionFilters.minLikes;
        likesInput.setAttribute("min", "0");
        sec.appendChild(likesInput);
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Textfilter");
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Suchbegriffe (kommagetrennt):" }));
        const kwInput = this._ce("input", { type: "text", className: "gf-input", placeholder: "z.B. JavaScript, Python", "data-filter": "textFilters.keywords" });
        kwInput.value = f.textFilters.keywords;
        sec.appendChild(kwInput);
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Ausschließen (kommagetrennt):" }));
        const exKwInput = this._ce("input", { type: "text", className: "gf-input", placeholder: "z.B. Spam, Werbung", "data-filter": "textFilters.excludeKeywords" });
        exKwInput.value = f.textFilters.excludeKeywords;
        sec.appendChild(exKwInput);
        fragment.appendChild(sec);
      }
      {
        const sec = this._section("Einstellungen");
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Tags automatisch entfernen (kommagetrennt):" }));
        const tagsInput = this._ce("input", { type: "text", className: "gf-input", id: "gf-custom-tags" });
        tagsInput.value = customTags;
        sec.appendChild(tagsInput);
        sec.appendChild(this._ce("span", { className: "gf-label", textContent: "Gesperrte Autoren (kommagetrennt):" }));
        const blockedInput = this._ce("input", { type: "text", className: "gf-input", id: "gf-blocked-authors" });
        blockedInput.value = blockedAuthors;
        sec.appendChild(blockedInput);
        fragment.appendChild(sec);
      }
      fragment.appendChild(this._ce("button", { className: "gf-reset-btn", textContent: "Alle Filter zurücksetzen ↺" }));
      container.appendChild(fragment);
      this.attachEventListeners();
    }
_escapeHTML(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
attachEventListeners() {
      const body = this.sb.bodyEl;
      const fi = this.fi;
      const typeChecks = body.querySelectorAll("[data-posttype]");
      for (let tc = 0; tc < typeChecks.length; tc++) {
        typeChecks[tc].addEventListener("change", function() {
          const type = this.getAttribute("data-posttype");
          const hideTypes = (fi.filters.contentFilters.hidePostTypes || []).slice();
          if (this.checked) {
            const idx = hideTypes.indexOf(type);
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
      const toggleSwitches = body.querySelectorAll(".gf-switch input[data-filter]");
      for (let ts = 0; ts < toggleSwitches.length; ts++) {
        toggleSwitches[ts].addEventListener("change", function() {
          const switchLabel = this.closest(".gf-switch");
          const isNowChecked = this.checked;
          const switchId = switchLabel ? switchLabel.id : "";
          if (isNowChecked && (switchId === "sb-only-bookmarked" || switchId === "sb-hide-bookmarked")) {
            const otherId = switchId === "sb-only-bookmarked" ? "sb-hide-bookmarked" : "sb-only-bookmarked";
            const other = body.querySelector("#" + otherId);
            if (other) {
              const otherInput = other.querySelector("input[data-filter]");
              if (otherInput && otherInput.checked) {
                otherInput.checked = false;
                fi.updateFilterValue(otherInput.getAttribute("data-filter"), false);
              }
            }
          }
          if (isNowChecked && (switchId === "sb-only-with-images" || switchId === "sb-hide-with-images")) {
            const otherId2 = switchId === "sb-only-with-images" ? "sb-hide-with-images" : "sb-only-with-images";
            const other2 = body.querySelector("#" + otherId2);
            if (other2) {
              const otherInput2 = other2.querySelector("input[data-filter]");
              if (otherInput2 && otherInput2.checked) {
                otherInput2.checked = false;
                fi.updateFilterValue(otherInput2.getAttribute("data-filter"), false);
              }
            }
          }
          fi.updateFilterValue(this.getAttribute("data-filter"), isNowChecked).then(function() {
            fi.enableFilters();
            fi.debouncedApplyFilters();
          });
        });
      }
      const filterInputs = body.querySelectorAll('input[data-filter]:not([type="checkbox"])');
      for (let fi2 = 0; fi2 < filterInputs.length; fi2++) {
        filterInputs[fi2].addEventListener("change", function() {
          fi.updateFilterValue(this.getAttribute("data-filter"), this.value).then(function() {
            fi.enableFilters();
            fi.debouncedApplyFilters();
          });
        });
      }
      const navDate = body.querySelector("#gf-nav-date");
      if (navDate) {
        navDate.addEventListener("change", async function() {
          await GM.setValue("navDate", this.value);
        });
      }
      const navAlle = body.querySelector("#gf-nav-alle");
      if (navAlle) {
        navAlle.addEventListener("click", function() {
          navigateToDate("alle");
        });
      }
      const navUnbeantwortet = body.querySelector("#gf-nav-unbeantwortet");
      if (navUnbeantwortet) {
        navUnbeantwortet.addEventListener("click", function() {
          navigateToDate("unbeantwortet");
        });
      }
      const navReset = body.querySelector("#gf-nav-reset");
      if (navReset) {
        navReset.addEventListener("click", function() {
          resetNavigation();
          const dateInput = body.querySelector("#gf-nav-date");
          if (dateInput) dateInput.value = "";
          const url = new URL(window.location.href);
          if (url.searchParams.has("springe-zu")) {
            url.searchParams.delete("springe-zu");
            window.location.href = url.toString();
          }
        });
      }
      const customTagsInput = body.querySelector("#gf-custom-tags");
      if (customTagsInput) {
        customTagsInput.addEventListener("change", async function() {
          await GM.setValue("customTagsToRemove", parseCSV(this.value, false));
        });
      }
      const blockedAuthorsInput = body.querySelector("#gf-blocked-authors");
      if (blockedAuthorsInput) {
        blockedAuthorsInput.addEventListener("change", async function() {
          await GM.setValue("blockedAuthors", parseCSV(this.value, false));
          fi.enableFilters();
          fi.debouncedApplyFilters();
        });
      }
      const resetBtn = body.querySelector(".gf-reset-btn");
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
  
  const log = createLogger("Gutefrage Smart Filters");
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
  const filterIntegration = new EnhancedFilterIntegration();
  filterIntegration.init().then(function() {
    new SidebarPanel(filterIntegration);
  });
  log.log("Ready!");

})();
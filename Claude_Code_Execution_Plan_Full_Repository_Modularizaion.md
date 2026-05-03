# Claude Code Execution Plan: Full Repository Modularization

**Target:** Transform 17 standalone Tampermonkey userscripts (~14 000 lines) into a modular, maintainable, Gold‑Standards‑compliant codebase.  
**Approach:** Extract shared libraries into `src/shared/`; for every script with enough unique logic, create a **script‑specific module folder** under `src/<script-slug>/`. The main `.user.js` file will become a thin orchestrator that `@require`s all needed modules.

---

## 0. Your Role as Claude Code

You are both the **Team Lead** and the **execution engine**. Follow this plan strictly:

- **Do not write code until Phase 2 begins** (after I approve the plan).  
- In Phase 1, you will explore, plan, and **present this entire document** (the final plan) for approval.  
- In Phase 2, you will create an **agent team** (using your internal parallel processing) and dispatch the work according to the batch assignments below.  
- Every agent must adhere to the rules and checklists described later.  
- You will review each batch, commit, and iterate.

---

## 1. Phase 1 – Deep Explore & Plan

Before touching a single file, you must:

1. **Read** `Userscripts_Gold_Standards_2026.md` completely.  
2. **Run a Google search** (via tool) for “Tampermonkey @require modularization 2026 Manifest V3” and note any new constraints.  
3. **Scan all 17 `.user.js` files**:
   - Measure exact line counts.
   - Identify duplicated code blocks (status bars, sidebars, DOM‑waiters, ZIP builders, network wrappers, storage helpers, toasts, etc.).
   - Map `@grant` and `@connect` usage per script.
   - Determine which scripts can most benefit from internal modularization.
4. **Produce the final architecture** exactly as described in the following sections.
5. **Pause and present this complete plan to the user.** Only after explicit approval should you proceed to Phase 2.

---

## 2. Architecture & Folder Structure

After refactoring, the repository will look like this:

```
tampermonkey-scripts/
├── CLAUDE.md
├── Userscripts_Gold_Standards_2026.md
├── README.md                           (will be updated at the end)
├── src/
│   ├── shared/                         (language‑agnostic, reusable modules)
│   │   ├── dom-utils.js
│   │   ├── ui-components.js
│   │   ├── storage-utils.js
│   │   ├── network-utils.js
│   │   ├── logging-utils.js
│   │   ├── zip-builder.js
│   │   ├── markdown-converter.js
│   │   └── i18n-utils.js
│   │
│   ├── marketplace-deal-finder/        (namespace __MDF__)
│   │   ├── api-gemini.js
│   │   ├── scraper-willhaben.js
│   │   ├── scraper-kleinanzeigen.js
│   │   ├── ranking-engine.js
│   │   └── ui-panel.js
│   │
│   ├── copy-as-markdown/               (namespace __CAM__)
│   │   ├── converter-integration.js
│   │   ├── click-modes.js
│   │   └── ui-sidebar.js
│   │
│   ├── crunchyroll-enhanced/           (namespace __CRE__)
│   │   ├──.js
│   │   ├── filters.js
│   │   ├── exporter.js
│   │   └── ui-panel.js
│   │
│   ├── gutefrage-smart-filters/        (namespace __GSF__)
│   │   ├── tag-remover.js
│   │   ├── filter-engine.js
│   │   ├── feed-navigation.js
│   │   └── ui-panel.js
│   │
│   ├── manga-panel-downloader/         (namespace __MPD__)
│   │   ├── image-finder.js
│   │   ├── image-processor.js
│   │   ├── page-navigator.js
│   │   └── ui-panel.js
│   │
│   ├── notebooklm-source-export/       (namespace __NLM__)
│   │   ├── extractor.js
│   │   └── ui-panel.js
│   │
│   ├── recaptcha-solver/               (namespace __RCS__)
│   │   ├── solver-engine.js
│   │   ├── audio-api.js
│   │   └── ui-button.js
│   │
│   ├── global-speed-controller/        (namespace __GSC__)
│   │   ├── page-script-builder.js
│   │   ├── injection-strategies.js
│   │   └── ui-controller.js
│   │
│   ├── youtube-enhanced/               (namespace __YTE__)
│   │   ├── auto-hd.js
│   │   ├── channel-speed.js
│   │   └── auto-stop.js
│   │
│   └── anisearch-endless-scroll/       (namespace __AES__)
│       ├── endless-loop.js
│       ├── rating-filter.js
│       └── ui-statusbar.js
│
├── AniSearch Endless Scroll.user.js    (thin entry wrapper)
├── BotGhost Bulk Choice Extractor.user.js
├── Copy as Markdown for AI.user.js
├── Crunchyroll Enhanced.user.js
├── Epic Games Library Export.user.js
├── FlameComics Advanced Sort.user.js
├── Global Video Speed Controller.user.js
├── Google AI Studio Chat Exporter.user.js
├── Google Search Enhanced.user.js
├── Gutefrage Smart Filters.user.js
├── Manga Panel Downloader.user.js
├── Marketplace Deal Finder.user.js
├── NotebookLM Source Export.user.js
├── Picture-in-Picture any site.user.js
├── Recaptcha Solver.user.js
├── Reddit Content Unlocker.user.js
└── YouTube Enhanced.user.js
```

**Why the root still contains the original filenames?**  
Tampermonkey’s automatic update links point to these raw GitHub URLs. Moving them would break updates for existing users. The files themselves will be dramatically slimmed down.

**Scripts that remain single‑file (no subfolder):**  
- BotGhost Bulk Choice Extractor  
- Epic Games Library Export  
- FlameComics Advanced Sort  
- Google AI Studio Chat Exporter  
- Google Search Enhanced  
- Picture-in-Picture any site  
- Reddit Content Unlocker  

These are small (< 300 lines) or have no clear internal seams. They will still be refactored to use shared libraries and comply with standards.

---

## 3. Shared Libraries – `src/shared/`

All modules attach to `window.__MMS__`. Each is an IIFE, `'use strict'`.

| File | Exports (on `__MMS__`) | Description |
|------|------------------------|-------------|
| `dom-utils.js` | `domUtils.waitForElement`, `domUtils.debounce`, `domUtils.throttle`, `domUtils.observeNewElements` | Efficient DOM observation and timing utilities. |
| `ui-components.js` | `ui.createToast`, `ui.createStatusBar`, `ui.createSidebar`, `ui.createFloatingPanel`, `ui.createToggleSwitch` | All custom UI components use closed Shadow DOM. |
| `storage-utils.js` | `storage.loadSetting`, `storage.saveSetting`, `storage.loadSettings`, `storage.saveSettings`, `storage.onChange` | Async wrappers around GM.* storage APIs. |
| `network-utils.js` | `network.fetch`, `network.fetchText`, `network.fetchJSON`, `network.fetchBlob` | GM_xmlhttpRequest wrappers with retry, timeout, and Save‑Data awareness. |
| `logging-utils.js` | `logging.createLogger` | Prefix‑based logger with configurable log level. |
| `zip-builder.js` | `zip.buildStoreZip` | Zero‑dependency STORE ZIP builder using CRC‑32 and DataView. |
| `markdown-converter.js` | `markdown.htmlToMarkdown` | Custom DOM→Markdown converter (no Turndown). |
| `i18n-utils.js` | `i18n.normalizeText`, `i18n.matchTerm`, `i18n.umlautMap` | German umlaut normalization and fuzzy text matching. |

Every function must have JSDoc comments explaining its purpose, parameters, and any edge cases.

---

## 4. Script‑Specific Modules

For each script listed below, you will create the exact modules. All modules use an IIFE and attach to their namespace (e.g., `window.__MDF__`). The `@require` order in the main `.user.js` must respect dependencies: shared modules first, then internal modules in dependency order.

### 4.1 Marketplace Deal Finder (`marketplace-deal-finder/`)
**Namespace:** `window.__MDF__`  
**Entry:** `Marketplace Deal Finder.user.js` (updates: `@require` list, thin bootstrapper)  

**Modules:**
- `api-gemini.js` – `callGeminiAPI`, `computePriceStats`, `getModelUrl`  
- `scraper-willhaben.js` – `findAds`, `extractBasicInfo`, `fetchDescription`, `wh_descSelectors`, `goToNextPage`  
- `scraper-kleinanzeigen.js` – Same pattern, site‑specific  
- `ranking-engine.js` – `mergeDeals`, `reRankGlobal`  
- `ui-panel.js` – `createModal`, `updateProgress`, `showResults`, `export*`

### 4.2 Copy as Markdown for AI (`copy-as-markdown/`)
**Namespace:** `window.__CAM__`  
**Entry:** `Copy as Markdown for AI.user.js`

**Modules:**
- `converter-integration.js` – `createTurndownInstance` (now replaced by shared `markdown-converter`), `convertPage`, `convertSelection`, `fetchUrlAsMarkdown`  
- `click-modes.js` – `startClickMode`, `stopClickMode`  
- `ui-sidebar.js` – `buildSidebar`, `renderHistory`, `generatePagePreview`, `theme logic`

### 4.3 Crunchyroll Enhanced (`crunchyroll-enhanced/`)
**Namespace:** `window.__CRE__`  
**Entry:** `Crunchyroll Enhanced.user.js`

**Modules:**
- `scanner.js` – `scanCards`, `extractInfo`, `triggerHover`, `retryNoData`  
- `filters.js` – `getFilters`, `passesFilter`, `applySort`  
- `exporter.js` – `exportAs(format)`  
- `ui-panel.js` – `buildSidebar`, `updateStats`, `attachEvents`

### 4.4 Gutefrage Smart Filters (`gutefrage-smart-filters/`)
**Namespace:** `window.__GSF__`  
**Entry:** `Gutefrage Smart Filters.user.js`

**Modules:**
- `tag-remover.js` – `removeUnwantedTags`, `addRemoveButtons`, `autoRemoveAndClose`  
- `filter-engine.js` – `EnhancedFilterIntegration` class  
- `feed-navigation.js` – `navigateToDate`  
- `ui-panel.js` – `SidebarPanel` class

### 4.5 Manga Panel Downloader (`manga-panel-downloader/`)
**Namespace:** `window.__MPD__`  
**Entry:** `Manga Panel Downloader.user.js`

**Modules:**
- `image-finder.js` – `findImages`, `getSrc`, `triggerLazy`  
- `image-processor.js` – `processImage`, `findSplitPoints`  
- `page-navigator.js` – `scrollLoad`, `navigateNext`, `waitForUrlChange`  
- `ui-panel.js` – `buildUI`, `addSegmentsToUI`, `downloadZip`

### 4.6 NotebookLM Source Export (`notebooklm-source-export/`)
**Namespace:** `window.__NLM__`  
**Entry:** `NotebookLM Source Export.user.js`

**Modules:**
- `extractor.js` – `runProcess`, `attemptClose`, `keepAlive`  
- `ui-panel.js` – floating panel creation using shared `ui-components`

### 4.7 Recaptcha Solver (`recaptcha-solver/`)
**Namespace:** `window.__RCS__`  
**Entry:** `Recaptcha Solver.user.js`

**Modules:**
- `solver-engine.js` – state machine, `startSolver`, `stopSolver`  
- `audio-api.js` – `getTextFromAudio`, server selection, latency measurement  
- `ui-button.js` – button injection, styles, SVG icons

### 4.8 Global Video Speed Controller (`global-speed-controller/`)
**Namespace:** `window.__GSC__`  
**Entry:** `Global Video Speed Controller.user.js`

**Modules:**
- `page-script-builder.js` – generates the page‑context script string  
- `injection-strategies.js` – `injectPageScript`, `setupUnsafeWindowFallback`, `startDirectPolling`  
- `ui-controller.js` – Tampermonkey menu commands, indicator, cross‑tab sync

### 4.9 YouTube Enhanced (`youtube-enhanced/`)
**Namespace:** `window.__YTE__`  
**Entry:** `YouTube Enhanced.user.js`

**Modules:**
- `auto-hd.js` – `patchQuality`, `applyAutoHD`  
- `channel-speed.js` – `initSpeed`, `buildSpeedPanel`, `watchSettingsMenu`  
- `auto-stop.js` – `stopVideoPlayback`, `checkForPlayer`

### 4.10 AniSearch Endless Scroll (`anisearch-endless-scroll/`)
**Namespace:** `window.__AES__`  
**Entry:** `AniSearch Endless Scroll.user.js`

**Modules:**
- `endless-loop.js` – `runEndlessLoop`, `findContainer`, `findNextUrl`  
- `rating-filter.js` – `extractRating`, `passesRating`, `parseRatingMin`  
- `ui-statusbar.js` – `setStatus`, `ensureBar`, `showLoader`

*Small scripts (BotGhost, Epic Games, FlameComics, Google AI Studio Exporter, Google Search Enhanced, Picture‑in‑Picture, Reddit Content Unlocker) remain as single files, directly using shared libraries where beneficial.*

---

## 5. Batch Assignments & Agent Workload

You will simulate four parallel agents (plus Team Lead). The following table shows the workload distribution.

| Batch | Agent | Task |
|-------|-------|------|
| **1** | Team Lead | Create all 8 shared library files (`src/shared/*`). Commit. |
| **2** (large) | Agent 1 | `Copy as Markdown for AI` – create folder + 3 modules, refactor entry. |
|       | Agent 2 | `Marketplace Deal Finder` – folder + 5 modules, refactor entry. |
|       | Agent 3 | `Crunchyroll Enhanced` – folder + 4 modules, refactor entry. |
| **3** (medium) | Agent 1 | `Gutefrage Smart Filters` (folder + 4 modules), then `AniSearch Endless Scroll` (folder + 3 modules). |
|       | Agent 2 | `Manga Panel Downloader` (folder + 4 modules), then `NotebookLM Source Export` (folder + 2 modules). |
|       | Agent 3 | `Recaptcha Solver` (folder + 3 modules), then `Global Video Speed Controller` (folder + 3 modules), then `YouTube Enhanced` (folder + 3 modules). |
| **4** (small) | Agents 1‑3 (split) | Refactor remaining single‑file scripts: `BotGhost Bulk Choice Extractor`, `Epic Games Library Export`, `FlameComics Advanced Sort`, `Google AI Studio Chat Exporter`, `Google Search Enhanced`, `Picture-in-Picture any site`, `Reddit Content Unlocker`. Assign 2‑3 per agent. |

**Rules for every agent (applied to every touched file):**

1. **Metadata overhaul:** Ensure `@grant`, `@connect`, `@require`, `@sandbox`, `@version` are correct.  
2. **Extract duplicated code** into the shared libraries; import via `@require`.  
3. **Translate all German comments/logs/variable names** to English (exception: user‑facing UI strings may stay German).  
4. **Write exhaustive JSDoc comments** – every function, every module, every important code block must explain *why* it exists, not just *what* it does.  
5. **Enforce 2026 Gold Standards:** IIFE, `'use strict'`, closed Shadow DOM for all UI, async GM_* APIs, `DocumentFragment`, `MutationObserver` best practices.  
6. **Verify no missing grants** – compare with actual GM_* calls.  
7. **Ensure the total line count decreases** (modularization + deduplication).  
8. **Commit each script (or folder) separately** with a meaningful message.

---

## 6. Gold Standards Checklist (per file)

Apply this checklist to every `.js` file you create or modify:

- [ ] Wrapped in `(() => { 'use strict'; … })();` (unless the file is a valid ES module loaded via `@require`, but we use IIFEs to avoid global scope).  
- [ ] No global variables except the designated namespace (`__MMS__` or `__XXX__`).  
- [ ] All UI components use `element.attachShadow({mode:'closed'})` and inline styles (via `GM_addStyle` only once per component).  
- [ ] XSS‑safe: use `textContent`, `setAttribute`, never `innerHTML` for user data.  
- [ ] Batching of DOM writes: use `DocumentFragment` when adding multiple elements.  
- [ ] `requestAnimationFrame` for any deferred layout changes.  
- [ ] Network calls use `network-utils` or at least retry logic.  
- [ ] Comments in **English** and detailed.  
- [ ] Files end with a newline.  
- [ ] NO synchronous GM_* calls. Use `await` with `GM.getValue`, `GM.setValue`, etc.  
- [ ] `@connect` lists every domain accessed via `GM_xmlhttpRequest` (excluding the same origin).  
- [ ] `@grant` lists every GM_* API used; no `@grant none` if any are used.  
- [ ] `@sandbox JavaScript` included when `unsafeWindow` is used.  
- [ ] `@inject-into content` where appropriate to avoid page script tampering.

---

## 7. Commit Strategy

- **Batch 1:** `feat(shared): add 8 utility modules`  
- For each script: `refactor(<slug>): modularize into sub‑modules, apply Gold Standards`  
- If a script requires a new shared utility (discovered during refactoring), the Team Lead will first extend the shared library and commit.  
- **Final commit:** `docs: update README with new architecture`

---

## 8. Continuous Review and Final Verification

After each batch, the Team Lead must:

- Run `git status` to confirm only intended files are staged.  
- Spot‑check at least 2 files for syntax correctness (no `require` mismatches).  
- After all batches, perform a global check:  
  - Search for any remaining global `var` or `function` outside IIFEs.  
  - Search for any `GM_getValue` / `GM_setValue` calls that are not awaited.  
  - Confirm that every `@require` URL points to a valid raw GitHub path.  
  - Ensure the total line count across the repository has dropped by at least 20%.

---

## 9. Final Deliverables

After execution, the repository will be a shining example of 2026 Gold Standards compliance, with:

- 8 production‑ready shared libraries.  
- 10 script‑specific modular folders containing 3‑5 modules each.  
- 17 thin entry‑point `.user.js` files  
- Up‑to‑date `README.md`.  
- All German code comments and internal identifiers translated to English.  
- Rigorous JSDoc documentation throughout.
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ First Step for Everything

**ALWAYS read `Userscripts_Gold_Standards_2026.md` first** before editing, creating, or brainstorming scripts. It defines the metadata architecture, security boundaries, performance rules, and distribution standards for this repository. Everything below is a compressed summary; the Gold Standards file is the authoritative reference.

## Commands

No build, test, or lint tooling exists. Each `.user.js` file is a standalone Tampermonkey script installed directly via a userscript manager. After editing scripts, update `README.md` if the script catalog table or feature comparison matrix needs reflecting.

## Versioning — Mandatory

**Every time a `.user.js` file is modified, increment its `@version` field.** Follow semver: bump major for breaking changes (e.g. removed features, rewritten modules), minor for new features or significant additions, patch for bug fixes and small tweaks. The exact bump is at your discretion — but never skip it.

## Repository Structure

```
├── *.user.js                    # 17 standalone Tampermonkey scripts
├── README.md                    # Script catalog with feature comparison matrix
├── LICENSE                      # MIT
├── Userscripts_Gold_Standards_2026.md  # Best-practices reference
└── .gitattributes               # LF normalization
```

No `package.json`, no bundler, no TypeScript, no test framework. Each script is fully self-contained.

## Gold Standards — Compressed Reference

### Metadata Header Template

```javascript
// ==UserScript==
// @name         Script Name
// @name:de      Skriptname (German, if applicable)
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.0.0
// @author       marmoris-x
// @description  What it does
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=target-site.com
// @match        https://*.target-site.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.trusted-domain.com
// @run-at       document-idle
// @inject-into  content           (Gold Standards recommendation)
// @sandbox      JavaScript        (Gold Standards recommendation)
// @noframes
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/{{filename}}.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/{{filename}}.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==
```

### Critical Directives
- **`@grant`**: List functions individually (e.g., `GM_addStyle`, not `GM_*`). `@grant none` = runs in page context, no GM APIs.
- **`@match`** over `@include` — stricter URL validation.
- **`@connect`**: Authorize EVERY domain used in `GM_xmlhttpRequest`.
- **`@run-at`**: `document-start` for early localStorage/JS patching; `document-idle` (default) for most; `context-menu` for on-demand.
- **`@inject-into content`**: Forces extension-context execution, protects variables from page pollution (Gold Standards recommendation).
- **`@noframes`**: Prevents execution in iframes (ads, embeds); use `@allFrames` only when needed.
- **`@icon64`**: Use `https://www.google.com/s2/favicons?sz=64&domain=...` for automatic favicon, or a custom icon URL.
- **`@supportURL`**: Always link to `https://github.com/marmoris-x/tampermonkey-scripts/issues`.

### Manifest V3
- Chrome 138+ requires "Allow User Scripts" toggle in `chrome://extensions` for Tampermonkey.
- No `GM_webRequest` — deprecated in Tampermonkey 5.2+.
- Use Chromium 120+ `userScripts` API for strict CSP bypass.

### Security
- Wrap all logic in IIFE + `'use strict'` to isolate from host page tampering.
- For injected UI: use `element.attachShadow({mode: 'closed'})` to prevent host-page CSS/JS interference.
- Never use `innerHTML` with unsanitized input. Prefer `textContent`.
- Use `setAttribute` with quoted values (no string concatenation for attributes).

### Performance
- Batch DOM reads before writes. Build node structures offline in `DocumentFragment` before appending.
- Use `requestAnimationFrame` for deferred layout changes. Toggle visibility via CSS class, not inline styles.
- MutationObserver: `childList: true, subtree: true` only. `observer.disconnect()` immediately after target found.
- Debounce high-frequency events at 200ms. Throttle scroll/resize handlers.

### Storage
- **Async first:** `await GM.getValue()` / `await GM.setValues({...})` (Tampermonkey 5.3+).
- Consolidate writes: `GM_setValues({key1: val1, key2: val2})` instead of individual calls.
- **IndexedDB** for datasets exceeding ~5MB. Stringify objects with `JSON.stringify` before storage.
- Use `GM_addValueChangeListener` for cross-tab sync.

### Distribution
- GreasyFork requires **non-minified, non-obfuscated** code with preserved whitespace.
- Increment `@version` before every commit. Update checks run max 1/day.
- Host `@updateURL`/`@downloadURL` on GitHub Raw for auto-install detection.

## Architecture Patterns (Shared Across All Scripts)

- **IIFE wrapper:** `(function() { 'use strict'; ... })()` — every script uses this. No ES modules.
- **`@run-at document-idle`** is the default. Exceptions: `YouTube Enhanced` and `Global Video Speed Controller` use `document-start`; some smaller scripts omit it (defaults to `document-end`).
- **Persistence:** `GM_setValue`/`GM_getValue` for preferences (except stateless scripts like Recaptcha Solver, PiP any site, Google Search Enhanced).
- **UI injection:** Always direct DOM manipulation (`document.body.appendChild`). CSS via `GM_addStyle` or inline `<style>` elements. **Existing scripts do not use Shadow DOM** — but the Gold Standards recommend `attachShadow({mode: 'closed'})` for new UI-heavy scripts to isolate from host-page CSS/JS interference.
- **SPA support:** `MutationObserver` on `document.body` with `{ childList: true, subtree: true }`, debounced at 150–400ms.
- **Logging:** `console.log('[ScriptName]', ...)` with script-specific prefix.
- **`@match`** is always specific URL patterns, never broad wildcards.
- **`@grant`** lists only the GM APIs actually used — never `GM_*` wildcard.

## Script Categories

### Video & Media
| Script | Key Architecture |
|--------|-----------------|
| **Global Video Speed Controller** | Three-tier fallback injection: (1) `<script>` tag into page context, (2) `unsafeWindow` prototype override, (3) 500ms polling. Cross-context communication via `CustomEvent`. Cross-tab sync via `GM_addValueChangeListener`. Runs on `*://*/*`. |
| **YouTube Enhanced** | `document-start` critical — patches `localStorage` before YouTube reads it. Three modules: Auto HD, Channel Speed Controller, Auto-Stop. SPA navigation via `yt-navigate-finish` event. Language-agnostic menu text matching across 18 languages. |
| **Crunchyroll Enhanced** | Class-based (`CrunchyrollEnhanced`). Page-push sidebar (`html.cr-pushed { margin-right: 360px }`). Data extraction via forced `mouseenter` on browse cards. Conditional instantiation only on `/videos/popular`. PiP unlock runs on all pages via `setInterval`. |
| **Picture-in-Picture any site** | Screen Capture API (`getDisplayMedia`) → hidden `<video>` → `requestPictureInPicture()`. No DOM interaction. |

### Marketplace & Shopping
| Script | Key Architecture |
|--------|-----------------|
| **Marketplace Deal Finder** | Multi-page crawler for Willhaben/Kleinanzeigen. Gemini AI analysis via `GM_xmlhttpRequest`. Resume-capable crawl state. LRU description cache (100 entries). Platform-adaptive selectors with `IS_WH` flag and `wh_`/`ka_` storage prefix. Rate limiting with exponential backoff (5s–5min). |

### Export & Data
| Script | Key Architecture |
|--------|-----------------|
| **Copy as Markdown for AI** | Embeds full TurndownService (~1060 lines, MIT). CSS isolation via high-specificity `#mds-root` prefix + `all: revert`. Sidebar with preview/history tabs. Click-mode for element selection. Runs on `*://*/*`. |
| **NotebookLM Source Export** | Menu-command triggered. Draggable HUD panel with terminal-style logging. Web Audio API sound feedback. Zero-dependency ZIP builder (CRC-32 + DataView). Recursive HTML-to-Markdown converter. Keep-alive audio against browser throttling. |
| **Google AI Studio Chat Exporter** | `@grant none`. Polling-based sidebar injection into Angular app. Overrides CDK overlay styles for mic dialog. Recursive `nodeToMd()` conversor. |
| **Epic Games Library Export** | Menu-command triggered. Paginates transaction history via Next-button click loop. Minifiable UI panel. |
| **BotGhost Bulk Choice Extractor** | Simplest script. Observes DOM for "Clear All Choices" button, injects "Copy Bulk" sibling. |

### Forum & Community
| Script | Key Architecture |
|--------|-----------------|
| **Reddit Content Unlocker** | `document-start` critical. Hooks `Element.prototype.attachShadow` to inject CSS before Reddit creates shadow roots. Removes modals, un-blurs images, strips NSFW/Spoiler overlays. 8-second safety disconnect if no `shreddit-app` found. |
| **Gutefrage Smart Filters** | Three-class architecture (`TagRemover`, `EnhancedFilterIntegration`, `SidebarPanel`). Page-push sidebar. Tag auto-removal with multi-attempt retry. Two-tier filter cache (in-memory Map + DOM data attributes). |

### Manga & Comics
| Script | Key Architecture |
|--------|-----------------|
| **Manga Panel Downloader** | Producer-consumer download pipeline. 5-fallback fetch chain (`GM_xmlhttpRequest` with headers → without Origin → without Referer → native `fetch` → canvas redraw). Zero-dependency ZIP builder. Image splitter for tall panels (3500px segments). |
| **FlameComics Advanced Sort** | Hijack-and-replace pattern: clones sort button to strip native listeners. Custom dropdown with 4 sort options (A-Z, Z-A, Most Popular, Least Popular). |
| **AniSearch Endless Scroll** | Fetch-loop paginator with `DOMParser`. Rating filter from URL query param (`?rating_min=N.NN`) or `GM_getValue`. Run-ID pattern invalidates stale loops on SPA navigation. MAX_PAGES = 200 hard cap. |

### Security & CAPTCHA
| Script | Key Architecture |
|--------|-----------------|
| **Recaptcha Solver** | Context guard: only runs inside reCAPTCHA challenge iframe (`bframe`). Stateless — no `GM_setValue`. Dual-server failover with latency ping. Button with state machine (ready/working/success/failed/dos). Rebuild guard observer re-injects button if DOM resets. |

## Recurring Techniques

- **Page-push sidebar:** `html.cr-pushed { margin-right: 360px }` (Crunchyroll, Gutefrage, Manga Downloader). Sidebar sits in a fixed-position div with CSS transition.
- **Zero-dependency ZIP:** Manual CRC-32 computation + binary construction via `DataView` (Manga Downloader, NotebookLM Export).
- **HTML-to-Markdown:** Either embedded TurndownService (Copy as Markdown) or recursive DOM-to-Markdown (NotebookLM, Google AI Studio).
- **Stale-loop guard:** Incrementing run ID checked after every `await` to discard results from superseded SPA navigations (AniSearch, YouTube Enhanced).
- **Language-agnostic matching:** Term matching across 18+ languages for YouTube UI elements (YouTube Enhanced).
- **Fallback chains:** Multiple strategies tried sequentially with increasing degradation (Global Speed: script→unsafeWindow→polling; Manga Downloader: 5 fetch strategies; NotebookLM: 3 close strategies).

## Adding a New Script

1. **Read `Userscripts_Gold_Standards_2026.md` first.**
2. Create `.user.js` with the Metadata Header Template above (Gold Standards format).
3. Use IIFE pattern, `'use strict'`, console prefix logging.
4. Add script to README.md — both the catalog table and feature comparison matrix.
5. Git commit with conventional commit style: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.

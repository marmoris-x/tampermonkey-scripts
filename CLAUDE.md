# CLAUDE.md — Tampermonkey Scripts Monorepo

## MANDATORY PRE-ACTION PROTOCOL — NEVER SKIP

**Before ANY change, correction, new script, or code modification — NO EXCEPTIONS — you MUST execute this protocol first.**

### CRITICAL: Always use Explore agents — never research directly

**Every `web_search`, `web_fetch`, and `docs/` exploration MUST happen inside an Explore agent (`subagent_type: "Explore"`).** Never call these tools directly from the main context. Reason: research results bloat your context window and trigger auto-compaction, which destroys detail. Explore agents run in isolated contexts and return only a concise summary to you.

This is not optional. Even for a one-line fix — spawn an Explore agent. Context is precious.

### The Protocol (executed inside Explore agents)

1. **Explore the `docs/` directory** — Read relevant files in `C:\Dev\Projects\tampermonkey-scripts\docs\` (especially `Userscripts_Gold_Standards_2026.md` for coding rules, `Tampermonkey_Documentation.md` for API reference, `Manifest_V3_UserScripts_Standards.md` for MV3 constraints). These are authoritative over CLAUDE.md.

2. **Web search & web fetch** — Verify current API status, MV3 compatibility, and best practices (May 2026). Tampermonkey, Chrome, and userscript ecosystems evolve rapidly. Never assume training data is current.

### When this applies

- Editing any source file in `src/` or `entries/`
- Creating a new userscript
- Fixing bugs or adding features
- Modifying `CLAUDE.md` itself
- Refactoring or modernizing code
- Answering technical questions about the project

### Minimal Explore-agent budget per task type

| Task scope | Explore agents | Min. searches | Min. fetches |
|------------|---------------|---------------|--------------|
| Simple typo/one-line fix | 1 agent | 1 | 1 |
| Single-file change | 1 agent | 3 | 5 |
| New feature/script | 1 agent | 5 | 10 |
| Multi-script or architecture change | 2+ agents (parallel) | 10 per agent | 15 per agent |

**Consequence of skipping:** You WILL make decisions based on outdated information (wrong API versions, deprecated patterns, broken MV3 assumptions) AND you WILL overflow the context window. The Explore-agent pattern exists precisely to prevent both failures simultaneously.

---

## Project Identity

Monorepo of 18 standalone Tampermonkey userscripts maintained by `marmoris-x`, distributed via jsDelivr CDN to GreasyFork. Every script is self-contained, built from modular ESM source through a Vite 6 + vite-plugin-monkey 7 pipeline, and published as non-minified `.user.js` files.

- **Owner:** marmoris-x (GitHub) — **License:** MIT
- **Package:** `"private": true`, `"type": "module"`
- **Primary target:** Tampermonkey 5.5+ on Chrome MV3 (Edge/Brave/Opera/Firefox/Safari secondary)
- **Test framework:** None (desired: Vitest with `vi.stubGlobal()` for GM API mocking — Priority: Low) — **CI/CD:** None
- **Language:** Plain JavaScript (no TypeScript), ESM `import`/`export` with JSDoc annotations

## Tech Stack

| Component | Version | Role |
|-----------|---------|------|
| Vite | ^6.0.0 (target: ^8.0.0) | Bundler |
| vite-plugin-monkey | ^7.0.0 (target: ^8.0.2) | Userscript metadata, IIFE wrapping, auto-grant detection |
| marked | 15.0.12 (CDN) | Markdown rendering (Copy as Markdown only) |

Zero production/runtime dependencies beyond the CDN `@require` for `marked`.

**Note:** vite-plugin-monkey v8.0.0 (May 7, 2026) requires Vite ^8.0.0. This project has not yet been migrated. When upgrading, Vite 8 replaces esbuild+Rollup with Rolldown (Rust) — `build.rollupOptions` becomes `build.rolldownOptions`, `esbuild.*` becomes `oxc.*`. The upgrade is non-trivial and should be done as a dedicated migration branch.

## Directory Structure

```
tampermonkey-scripts/
├── build.mjs                  # Custom build script — iterates entries/, runs Vite per script
├── entries/                   # 18 entry files — metadata + imports + bootstrap
├── src/                       # Per-script ESM modules
│   ├── anisearch-endless-scroll/
│   ├── copy-as-markdown-for-ai/
│   ├── crunchyroll-enhanced/
│   ├── global-speed-controller/
│   ├── gutefrage-smart-filters/
│   ├── manga-panel-downloader/
│   ├── marketplace-deal-finder/
│   ├── notebooklm-source-export/
│   ├── recaptcha-solver/
│   ├── reddit-content-unlocker/
│   └── youtube-enhanced/
├── dist/                      # Build output: 18 standalone .user.js files (non-minified)
├── docs/                      # Authoritative standards and TM API reference
└── .claude/                   # Claude Code configuration
```

Each `src/<script>/` directory contains local utility modules (`_logger.js`, `_storage.js`, `_dom.js`, `_ui.js`, `_i18n.js`, `_network.js`, `_zip.js`). No centralized `src/shared/` — each script owns its utilities. The `_` prefix convention marks modules split from former shared utilities (acknowledged tech debt).

## Essential Commands

**Requires Node.js ≥18.18** (Vite 6 minimum). Check with `node --version`.

```bash
node build.mjs          # Build all 18 scripts → dist/ (must succeed: "18 built, 0 failed")
```

There is no dev server, no watch mode, no HMR. Build output is **not minified** (`build.minify: false`) — a GreasyFork requirement for transparency review.

### Build Process

1. **Entry Discovery:** Reads `entries/`, filters `*.user.js`
2. **Metadata Parsing:** Extracts `// ==UserScript==` block → converts to vite-plugin-monkey config
3. **Vite Build:** `vite.build()` with `monkey()` plugin → `outDir: 'dist'`, `emptyOutDir: false`, `minify: false`
4. **Post-processing:** Strips `@license` comments from IIFE body

### Hardcoded Paths (CRITICAL)

Lines 6-7 in `build.mjs`:
```javascript
const ROOT = 'C:\\Dev\\Projects\\tampermonkey-scripts';
const ENTRIES_DIR = 'C:\\Dev\\Projects\\tampermonkey-scripts\\entries';
```
**MUST be changed to relative paths** before building on macOS/Linux. Use `process.cwd()` or `import.meta.url`.

## Entry File Pattern

Every entry in `entries/` follows this structure:
1. `// ==UserScript==` metadata block (parsed by build.mjs)
2. `'use strict';`
3. `import` statements from `../src/<script-name>/<module>.js`
4. Bootstrap — either `registerBoot()` call or inline orchestration

Simple boot pattern (AniSearch):
```javascript
import { registerBoot } from '../src/anisearch-endless-scroll/boot.js';
registerBoot();
```

Self-contained pattern (TikTok Enhanced, FlameComics Advanced Sort, BotGhost Bulk Choice Extractor, Google Search Enhanced, Epic Games Library Export, Google AI Studio Chat Exporter, Picture-in-Picture any site — no `src/` folder):
```javascript
(function () {
  'use strict';
  // all code inline, no imports
})();
```

## Metadata Conventions

### Gold Standard Header (May 2026)

- **MUST use `@match`** over `@include` — glob patterns only, no regex (regex `@include` injects into every frame under MV3 Dynamic mode)
- **MUST declare every GM API individually in `@grant`** — never wildcards
- **MUST use async storage APIs** (`GM.getValue`/`GM.setValue`) — never synchronous `GM_getValue`/`GM_setValue`
- **MUST add SRI hashes** for any `@require`/`@resource` with external URLs (SHA-256 native, format: `#sha256=<hash>`)
- **MUST include `@noframes`** unless iframe execution is intentional
- **MUST use `@sandbox`** for execution context control — NOT `@unwrap` (breaks GM APIs) or `@inject-into` (Violentmonkey-only feature, does NOT exist in Tampermonkey)
- **MUST NOT use `@connect *`** — always list exact domains
- **SHOULD use `@sandbox raw`** for page context access, `@sandbox JavaScript` for Firefox USERSCRIPT_WORLD, `@sandbox DOM` for ISOLATED_WORLD
- **SHOULD use `window.onurlchange`** (requires `@grant window.onurlchange`) for SPA navigation — not History API monkey-patching

### @sandbox Reference

| Value | Context | Notes |
|-------|---------|-------|
| `raw` (default) | MAIN_WORLD — page context | Falls back to other modes if CSP blocks |
| `JavaScript` | USERSCRIPT_WORLD (Firefox) / raw (elsewhere) | Bypasses CSP on Firefox; needs `cloneInto`/`exportFunction` |
| `DOM` | ISOLATED_WORLD — content script context | Has near-full extension permissions — potentially unsecure |

### Common Execution Pattern

Many scripts use this for direct page access:
```
// @sandbox      JavaScript
// @inject-into  content
// @unwrap
```
**Note:** `@inject-into` is a Violentmonkey feature — it has no effect in Tampermonkey. `@unwrap` removes ALL sandboxing and breaks any GM API access. This pattern is legacy and should be migrated to `@sandbox raw` with proper `@grant` declarations.

## Tampermonkey API Conventions

### Async vs Sync (MUST use Promise-based)

| Operation | Legacy (avoid) | Modern (use) |
|-----------|---------------|--------------|
| Storage get | `GM_getValue` | `GM.getValue` |
| Storage set | `GM_setValue` | `GM.setValue` |
| Storage delete | `GM_deleteValue` | `GM.deleteValue` |
| Bulk set | — | `GM.setValues` (TM 5.3+) |
| Bulk get | — | `GM.getValues` (TM 5.3+) |
| XHR | `GM_xmlhttpRequest` | `GM.xmlHttpRequest` (note capital H) |
| Download | `GM_download` | `GM.download` |
| Menu command | `GM_registerMenuCommand` | `GM.registerMenuCommand` |
| Add style | `GM_addStyle` | `GM.addStyle` |
| Clipboard | `GM_setClipboard` | `GM.setClipboard` |

### GM_xmlhttpRequest

Key parameters: `anonymous: true` (privacy), `responseType: 'stream'` (MV3 progress), always set `timeout`.

**MV3 serialization:** Under Chrome MV3, GM_xmlhttpRequest calls are **serialized** — each waits for the previous to complete. Workaround available via `@require`:
```
// @require https://raw.githubusercontent.com/Tampermonkey/utils/refs/heads/main/requires/gh_2215_make_GM_xhr_more_parallel_again.js
```
Drawbacks: no `progress` events, 401 responses not handled. Firefox is unaffected.

**Binary data under MV3:** Chrome uses JSON-only messaging — `File`, `Blob`, `FormData`, `ArrayBuffer` arrive as empty `{}`. Base64-encode manually or use IndexedDB bridge.

### GM_addElement

Use instead of `document.createElement` for `script`/`style`/`img` — bypasses page CSP (critical under MV3 since CSP partial relaxation was removed):
```javascript
GM_addElement('script', { textContent: '...' });
GM_addElement(parentNode, 'style', { textContent: '...' });
```

### window.onurlchange

For SPAs: grant `window.onurlchange`, listen for `urlchange` events instead of polling `location.href`:
```javascript
window.addEventListener('urlchange', (info) => { /* info.url */ });
```

### Storage Limits

No hard quota. **Practical guideline: keep individual values under ~500KB** — Chrome's extension message passing has a per-call size limit. TM 5.4.0+ improved storage handling and fixed the "Message length exceeded" error for most cases. TM uses its own LevelDB instance (not chrome.storage.local), so the chrome.storage 10 MB quota does not apply. For storing large crawled datasets (multi-MB), use page-level `indexedDB` (fully accessible from user scripts).

## MV3 Constraints

### Critical Changes (TM 5.2+)

| API/Feature | MV3 Status | Workaround |
|-------------|-----------|------------|
| `GM_webRequest` | **Permanently removed** | Redesign without request interception; `@webRequest` header for static rules only |
| `GM_xmlhttpRequest` | **Serialized** (Chrome) | Parallel XHR workaround (see above); Firefox unaffected |
| CSP partial relaxation | **Removed** | `GM_addElement` for element injection |
| `@require` with RegExp | Injected in every frame (Dynamic mode) | Use exact URL matching |
| `@resource` external URLs | Not auto-updated | Inline or manual refresh |
| Binary data in messaging | JSON-only (Chrome) | Base64 encode / IndexedDB bridge |

### Chrome User Requirements

- **Chrome 138+:** Users must enable **"Allow User Scripts"** toggle at `chrome://extensions/?id=<TM_ID>`
- **Chrome <138:** Developer Mode toggle required instead
- **TM Settings → Security → Content Script API:** Set to `UserScripts API Dynamic` for true `document-start` support on Chrome

### Script Manager Landscape (May 2026)

| Manager | MV3 | Chrome Viable | Notes |
|---------|-----|---------------|-------|
| **Tampermonkey** 5.5+ | Yes | Yes | Primary target |
| **Violentmonkey** 2.36 | No (MV2) | **No** — disabled since July 2025 | Firefox-only; no MV3 planned |
| **ScriptCat** 1.1.2 | Yes | Yes | Open-source MV3 alternative; GPLv3 |
| **Greasemonkey** 4.13 | No | Firefox-only | No updates since Aug 2024 |

## Coding Standards

### MUST — Non-Negotiable

- **MUST use `'use strict'`** at the top of every function/IIFE
- **MUST use `textContent`** for user-facing text injection, never `innerHTML` — XSS-safe. Exception: sanitized HTML from trusted source (e.g., markdown preview via DOMPurify or marked)
- **MUST use `let`/`const`, not `var`** — codebase is in transition; all new code MUST use `let`/`const`
- **MUST use closed Shadow DOM (`mode: 'closed'`)** for all injected UI
- **MUST use `GM_addElement()`** instead of `document.createElement` for `script`/`style`/`img` — bypasses CSP
- **MUST increment `@version`** before every commit that changes script behavior
- **MUST use `@match`** instead of `@include` — glob patterns only, no regex
- **MUST declare every GM API individually in `@grant`** — never wildcards

### SHOULD — Strongly Recommended

- **SHOULD batch DOM reads before DOM writes** to avoid forced synchronous layouts
- **SHOULD use `MutationObserver`** instead of `setInterval`-based polling — call `observer.disconnect()` immediately after target found
- **SHOULD use `requestAnimationFrame`** for non-critical DOM updates
- **SHOULD log via `createLogger`** for consistent `[ScriptName]` prefix — not raw `console.log`
- **SHOULD add JSDoc type annotations** to function parameters and return values
- **SHOULD use `adoptedStyleSheets`** with `CSSStyleSheet.replaceSync()` over `<style>` elements for Shadow DOM — more performant, shareable across shadow roots

### NEVER — Forbidden

- **NEVER `eval()`, `new Function()`, `document.write()`**
- **NEVER `@connect *`** — always specify exact domains
- **NEVER publish minified/obfuscated code to GreasyFork**
- **NEVER rely on synchronous XHR**
- **NEVER assume `unsafeWindow` is available** — requires explicit `@grant`
- **NEVER use `innerHTML` for user/API data** — applies to 25+ existing locations that need migration

## Security Rules

### XSS Prevention

- `textContent` for text, never `innerHTML` for user/API data
- `setAttribute` with quoted strings for attributes
- `encodeURIComponent()` for URL params
- If host enforces Trusted Types (Baseline 2026 — now supported in all modern browsers): use `trustedTypes.createPolicy()` or avoid innerHTML entirely
- **Trusted Types warning:** Pages with `require-trusted-types-for 'script'` CSP will throw `TypeError` on raw `.innerHTML =` assignments. `textContent` and `createElement` patterns avoid this entirely.

### Shadow DOM Isolation

- All injected UI MUST use `attachShadow({ mode: 'closed' })`
- `:host { all: initial; }` as CSS reset
- `:host { contain: strict; isolation: isolate; }` for layout/style/paint containment
- `pointer-events: none` on host, `pointer-events: auto` on interactive children
- `composed: false` on custom events to prevent leakage through shadow boundary

### @grant Least Privilege

| Grant | Execution Context | GM API Access |
|-------|-------------------|---------------|
| `@grant none` | Page context | Only `GM_info` |
| `@grant GM_xxx` (specific) | Isolated sandbox | Only declared APIs |
| `@grant unsafeWindow` + APIs | Sandbox + page window | Declared APIs + page JS |

Scripts on `*://*/*` (Copy as Markdown, PiP, Global Speed Controller) MUST be especially conservative.

## Performance Rules

- **100ms rule:** Every synchronous main-thread operation MUST complete within 100ms (formalized as INP metric, target <200ms good, <100ms ideal)
- **Batch DOM reads before writes** — no interleaving
- **`DocumentFragment`** for batch insertion
- **`requestAnimationFrame`** for non-critical visual updates
- **`classList` toggle** over inline style changes
- **Debounce/throttle:** scroll 100-250ms, resize 150-300ms, input 300-500ms, MutationObserver callbacks 100-200ms
- **Native `for` loops** in high-frequency callbacks (not forEach/map)
- **Filter by node type** in MutationObserver — skip TEXT/COMMENT nodes

## UI Patterns

### Theme

- Background: `linear-gradient(135deg, #0d0d1a 0%, #111827 55%, #0a1628 100%)`
- Border: `rgba(99, 102, 241, 0.35)`
- Text: `#e2e8f0`
- Accent: `#6366f1` (indigo)
- Deviate only when a site's native theme requires it.

### CSS Strategy

- All styles INSIDE Shadow DOM
- `:host { all: initial; contain: strict; isolation: isolate; }` as reset
- `!important` sparingly
- CSS `:has()`/`:not()` over JS traversal
- `classList` toggle over inline style changes

## JavaScript Features

Targeting modern browsers (Chrome 137+, Firefox 136+, Safari 18.4+).

### ES2025 — safe to use (shipping in all target browsers)

| Feature | Min. Chrome | Min. Firefox | Min. Safari | Use Case |
|---------|-------------|-------------|-------------|----------|
| Iterator Helpers (`.map().filter().take().toArray()`) | 122 | 131 | 18.4 | Data pipeline chains |
| Set methods (`.intersection()`, `.union()`, etc.) | 122 | 127 | 17 | Collection operations |
| `Promise.try(fn)` | 128 | 134 | 18.2 | Wrapping sync/async uniformly |
| `RegExp.escape(str)` | 136 | 134 | 18.2 | Safe regex from user input |

### ES2026 — shipping, but NOT in all target browsers yet

| Feature | Min. Chrome | Min. Firefox | Safari | Status for this project |
|---------|-------------|-------------|--------|--------------------------|
| `Error.isError(val)` | 134 | **138** | **No support** | Missing Firefox 136, no Safari |
| `Math.sumPrecise([vals])` | **140** | **Not shipped** | 26.2 | Missing all target browsers |
| `Uint8Array.fromBase64()` / `.toBase64()` | **140** | **Not shipped** | 26.2 | Missing all target browsers |
| `Map.getOrInsert(key, default)` | **145** | **144** | 26.2 | Missing all target browsers |

**DO NOT use ES2026-only features without transpilation or polyfills.** They will throw ReferenceError/TypeError in the declared minimum browser versions.

Temporal API and `using` declarations are ES2027 — **not yet available**.

## Distribution

### CDN

```
https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/<URL-ENCODED-FILENAME>
```

`@updateURL`/`@downloadURL` point to jsDelivr. Updates propagate within 24h. **Always pin exact versions** in `@require` URLs — never `@latest` (different caching: 1 year for exact, 7 days for ranges).

### GreasyFork

- Non-minified, non-obfuscated code — **mandatory**
- Max file size: 2.0 MB
- `@antifeature` declared if ads/tracking/mining present
- `@license` mandatory
- Update checks max 1x/day

### Version Bumping (CRITICAL)

Before EVERY commit that changes script behavior:
1. Increment `@version` in the entry file (semver)
2. Run `node build.mjs`
3. Commit entry + dist in the **SAME** commit

## Known Issues & Technical Debt

### CRITICAL

- **`@connect *` Wildcard — 2 Scripts:** Copy as Markdown for AI and Manga Panel Downloader. Copy as Markdown's use case is legitimate (arbitrary URL fetching). Manga Panel Downloader should be restricted.
- **Circular Dependencies — 3 Script Families:** `notebooklm-source-export/` (extractor.js ↔ ui.js), `recaptcha-solver/` (solver-engine.js ↔ ui-button.js), `crunchyroll-enhanced/` (scanner.js ↔ ui-panel.js ↔ exporter.js + filters.js)

### HIGH

- **Widespread `var` Usage:** Only newer modules (copy-as-markdown-for-ai/, global-speed-controller/) use `let`/`const` consistently. Marketplace Deal Finder, YouTube Enhanced, Crunchyroll Enhanced still use `var`.
- **`innerHTML` with User/API Data — 25+ Locations:** In gutefrage-smart-filters/ui-panel.js, youtube-enhanced/channel-speed.js, marketplace-deal-finder/ui-panel.js, marketplace-deal-finder/api-gemini.js. No project-wide HTML escaping utility exists.

### MEDIUM

- **Raw `console.log` — 50+ Occurrences:** Scrapers and api-gemini.js use raw `console.log` instead of `createLogger`.
- **`setInterval` Polling:** Crunchyroll Enhanced (PiP attributes, 1s) and Manga Panel Downloader (URL changes, 1s). Replace with `MutationObserver` or `window.onurlchange`.
- **History API Monkey-Patching:** AniSearch Endless Scroll patches `history.pushState`/`replaceState`. Replace with `window.onurlchange`.

### LOW

- **Utility Naming Inconsistency:** Some scripts use `_` prefix (`_logger.js`), others don't (`logger.js`).
- **No .gitignore Coverage:** Only `node_modules/` is gitignored. Missing: `dist/`, `.claude/`, `.env`, `*.log`.

## Git Conventions

### Commit Format

```
<type>(<scope>): <description>
```
Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`
Scope: script name in kebab-case (`copy-as-markdown`, `youtube-enhanced`, `shared`, `build`)

### Branch Strategy

- `main` = production
- Feature branches from `main` for multi-script changes
- Single-script fixes ok directly on `main` if low-risk

### Pre-Commit Checklist

- `@version` bumped
- `node build.mjs` succeeds (18 built, 0 failed)
- Dist changes reviewed (non-minified)
- No debug `console.log` (use `createLogger`)
- New `@grant` entries added if new GM APIs used
- `@match` patterns tested

## Script Catalog Quick Reference

| # | Script | Target | Grants |
|---|--------|--------|--------|
| 1 | AniSearch Endless Scroll | anisearch.de | GM_xmlhttpRequest, GM.getValue, GM.setValue, GM_getValue, GM_setValue, GM_registerMenuCommand |
| 2 | BotGhost Bulk Choice Extractor | botghost.com | GM_setClipboard |
| 3 | Copy as Markdown for AI | *://*/* | GM_registerMenuCommand, GM_addStyle, GM_setClipboard, GM_download |
| 4 | Crunchyroll Enhanced | crunchyroll.com | GM_addStyle, GM_getValue, GM_setValue, GM.registerMenuCommand, window.onurlchange |
| 5 | Epic Games Library Export | epicgames.com | GM_setClipboard, GM_registerMenuCommand |
| 6 | FlameComics Advanced Sort | flamecomics.com | none |
| 7 | Global Video Speed Controller | http*://*/* | GM_setValue, GM_getValue, GM_registerMenuCommand, unsafeWindow, GM_addStyle, GM_addElement, GM_addValueChangeListener, GM_unregisterMenuCommand |
| 8 | Google AI Studio Chat Exporter | aistudio.google.com | GM_registerMenuCommand, GM_notification, GM_getValue, GM_setValue, GM_addElement, GM_download, GM_setClipboard |
| 9 | Google Search Enhanced | google.com/search | none |
| 10 | Gutefrage Smart Filters | gutefrage.net | GM_addStyle, GM_setValue, GM_getValue, GM.setValues, GM_openInTab |
| 11 | Manga Panel Downloader | various manga sites | GM_xmlhttpRequest, GM.xmlHttpRequest, GM_registerMenuCommand, window.onurlchange |
| 12 | Marketplace Deal Finder | willhaben.at, kleinanzeigen.de | GM_xmlhttpRequest, GM.getValue, GM.setValue |
| 13 | NotebookLM Source Export | notebooklm.google.com | GM_registerMenuCommand, GM_unregisterMenuCommand, GM_addElement, GM_download, GM_notification |
| 14 | Picture-in-Picture any site | *://*/* | GM_registerMenuCommand |
| 15 | Recaptcha Solver | google.com/recaptcha | GM_xmlhttpRequest, GM_addElement |
| 16 | Reddit Content Unlocker | reddit.com | GM_addElement, GM_setValue, GM_getValue, window.onurlchange |
| 17 | YouTube Enhanced | *.youtube.com/* | GM_getValue, GM_setValue, GM.getValue, GM.setValue |
| 18 | TikTok Enhanced | *://*.tiktok.com/* | GM_addStyle, window.onurlchange |


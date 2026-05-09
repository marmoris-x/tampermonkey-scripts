# CLAUDE.md — Tampermonkey Scripts Monorepo

## Project Identity

This is the **tampermonkey-scripts** monorepo — a collection of 17 standalone Tampermonkey userscripts maintained by `marmoris-x` and distributed via jsDelivr CDN. Every script is self-contained (no external runtime dependencies), built from modular ESM source files through a Vite + vite-plugin-monkey pipeline, and published as non-minified `.user.js` files for transparency review on GreasyFork.

- **Owner:** marmoris-x (GitHub)
- **License:** MIT
- **Package:** private, `"type": "module"`
- **Build tool:** Vite 6.x + vite-plugin-monkey 7.x
- **Language:** Plain JavaScript (no TypeScript), ESM import/export syntax
- **Test framework:** None (no Jest, no Vitest, no Playwright config)
- **CI/CD:** None (no `.github/` directory)
- **Target platforms:** Tampermonkey 5.5+ on Chrome/Edge/Brave/Opera/Firefox/Safari
- **Script manager compatibility:** Tampermonkey (primary), partial Violentmonkey, partial Greasemonkey

All source code lives in `src/`. The build output is 17 standalone `.user.js` files in `dist/`. Detailed project standards are maintained in `docs/` — that directory is authoritative for coding rules, API types, MV3 constraints, and security policies.

---

## Build System

### Build Command

```
node build.mjs
```

There is **no dev server, no watch mode, no HMR**. The build script iterates all 17 entry files in `src/entries/`, runs each through Vite with vite-plugin-monkey, and writes the output to `dist/`. Output files are **not minified** (`build.minify: false`) for transparent human review — this is a GreasyFork requirement.

### Build Process (build.mjs)

The build script operates in three phases:

**Phase 1 — Entry Discovery:** Reads `src/entries/`, filters for `*.user.js` files, produces a list of 17 entry points.

**Phase 2 — Metadata Parsing (parseUserscriptBlock):** For each entry file, extracts the `// ==UserScript==` block using regex and converts it into the vite-plugin-monkey `userscript` option format. The parser handles:
- **String keys:** `@name`, `@namespace`, `@version`, `@description`, `@author`, `@icon`, `@icon64`, `@run-at`, `@sandbox`, `@inject-into`, `@license`, `@updateURL`, `@downloadURL`, `@supportURL`
- **Array keys:** `@match`, `@grant`, `@connect`, `@require`, `@resource`, `@include`, `@antifeature` — accumulated into arrays
- **i18n keys:** `@name:de`, `@description:de` — nested into `name: { de: "..." }` objects
- **Flag keys:** `@noframes`, `@unwrap` — set to boolean `true`
- **Boolean coercion:** String values `"true"` and `"false"` are converted to boolean literals
- **@require removal:** All `@require` directives are stripped because vite-plugin-monkey inlines all modules — the final `.user.js` files have zero external dependencies

**Phase 3 — Vite Build:** Calls `vite.build()` for each entry with `monkey({ entry, userscript, build: { fileName, metaFileName: false } })`. Key settings: `outDir: 'dist'`, `emptyOutDir: false` (cumulative build), `minify: false`.

### Output Structure

Each `dist/<Name>.user.js` file contains:

```
// ==UserScript==
// @name         ...        (parsed from entry metadata)
// @namespace    ...
// @grant        GM.getValue    (individual grants, possibly augmented by plugin)
// @grant        GM_getValue
// ...
// ==/UserScript==

(function () {
  'use strict';

  // All shared modules inlined first (globalThis.TM namespace setup)
  // Then script-specific modules
  // Entry bootstrap logic last
})();
```

Key output characteristics:
- Single IIFE wrapping all code with `'use strict'`
- All ESM imports are resolved and inlined — no dynamic imports, no code splitting
- `globalThis.TM` namespace provides cross-module communication inside the IIFE
- `@require` directives are removed (modules are inlined instead)
- Vite debug info is stripped from output
- `@unwrap` directive ensures TM doesn't add another wrapper

### Dependencies

| Package | Version | Role |
|---------|---------|------|
| vite | ^6.0.0 (resolved: 6.4.2) | Bundler |
| vite-plugin-monkey | ^7.0.0 (resolved: 7.1.9) | Userscript metadata, IIFE wrapping, auto-grant detection |

Zero production/runtime dependencies. All userscript logic is self-contained.

### Hardcoded Windows Paths (CRITICAL)

Lines 6-7 in `build.mjs` use hardcoded Windows absolute paths:
```javascript
const ROOT = 'C:\\Dev\\Projects\\tampermonkey-scripts';
const ENTRIES_DIR = 'C:\\Dev\\Projects\\tampermonkey-scripts\\src\\entries';
```
**MUST be changed to relative paths** before the repo can be built on macOS/Linux. Use `process.cwd()` or `import.meta.url` instead.

---

## Project Structure

```
tampermonkey-scripts/
├── build.mjs                  # Custom build script (no vite.config.* file)
├── package.json               # Project config, scripts, dependencies
├── package-lock.json          # Lockfile v3
├── .gitignore                 # node_modules/ only
├── .gitattributes             # LF normalization
├── CLAUDE.md                  # This file
├── README.md                  # Project README
├── LICENSE                    # MIT
├── docs/                      # Authoritative standards and reference
│   ├── Userscripts_Gold_Standards_2026.md       # Coding rules, performance, security
│   ├── Tampermonkey_Types.d.ts                  # Full TypeScript API definitions
│   ├── Manifest_V3_UserScripts_Standards.md     # MV3 constraints, chrome.userScripts API
│   ├── Tampermonkey_Scripts_Overiew_Examples.md # All 17 scripts with metadata
│   └── Tampermonkey_Documentation.md            # Official TM docs mirror
├── src/
│   ├── entries/               # 17 entry point .user.js files (thin orchestrators)
│   │   ├── AniSearch Endless Scroll.user.js
│   │   ├── BotGhost Bulk Choice Extractor.user.js
│   │   ├── Copy as Markdown for AI.user.js
│   │   ├── Crunchyroll Enhanced.user.js
│   │   ├── Epic Games Library Export.user.js
│   │   ├── FlameComics Advanced Sort.user.js
│   │   ├── Global Video Speed Controller.user.js
│   │   ├── Google AI Studio Chat Exporter.user.js
│   │   ├── Google Search Enhanced.user.js
│   │   ├── Gutefrage Smart Filters.user.js
│   │   ├── Manga Panel Downloader.user.js
│   │   ├── Marketplace Deal Finder.user.js
│   │   ├── NotebookLM Source Export.user.js
│   │   ├── Picture-in-Picture any site.user.js
│   │   ├── Recaptcha Solver.user.js
│   │   ├── Reddit Content Unlocker.user.js
│   │   └── YouTube Enhanced.user.js
│   ├── shared/                # 8 cross-cutting utility modules
│   │   ├── dom-utils.js       # waitForElement, debounce, throttle, observeMutations
│   │   ├── i18n-utils.js      # normalizeText, matchAnyTerm, matchTerm
│   │   ├── logging-utils.js   # createLogger (prefixed console logger factory)
│   │   ├── markdown-converter.js  # htmlToMarkdown (DOM→GFM)
│   │   ├── network-utils.js   # fetchPage, fetchJSON, fetchBlob (GM_xmlhttpRequest wrappers)
│   │   ├── storage-utils.js   # loadSetting, saveSetting, loadSettings, saveSettings (async)
│   │   ├── ui-components.js   # createShadowContainer, createToast, createStatusBar, createSidebar
│   │   └── zip-builder.js     # buildStoreZip (zero-dependency STORE ZIP)
│   ├── anisearch-endless-scroll/   # 3 modules: endless-loop, rating-filter, ui-statusbar
│   ├── copy-as-markdown/           # 9 modules: content-pipeline, converter, sidebar, preview, overlay, click-modes, pruning, density, bm25
│   ├── crunchyroll-enhanced/       # 4 modules: scanner, filters, exporter, ui-panel
│   ├── global-speed-controller/    # 3 modules: page-script-builder, injection-strategies, ui-controller
│   ├── gutefrage-smart-filters/    # 4 modules: tag-remover, filter-engine, feed-navigation, ui-panel
│   ├── manga-panel-downloader/    # 4 modules: image-finder, image-processor, page-navigator, ui-panel
│   ├── marketplace-deal-finder/   # 5 modules: ranking-engine, api-gemini, scraper-willhaben, scraper-kleinanzeigen, ui-panel
│   ├── notebooklm-source-export/  # 2 modules: extractor, ui-panel
│   ├── recaptcha-solver/          # 3 modules: solver-engine, audio-api, ui-button
│   └── youtube-enhanced/          # 3 modules: auto-hd, channel-speed, auto-stop
├── dist/                     # Build output: 17 standalone .user.js files
├── .claude/                  # Agent outputs and temporary files
└── node_modules/             # Build dependencies only
```

### Entry File Pattern

Every entry file in `src/entries/` follows this structure:
1. `// ==UserScript==` metadata block (parsed by build.mjs)
2. Optional multi-line comment describing architecture
3. `import { ... } from '../shared/<module>.js'` — shared utility imports
4. `import { ... } from '../<script-name>/<module>.js'` — script-specific imports
5. Bootstrap logic (init/boot/main function)
6. DOMContentLoaded listener or immediate init() call

Entry files are **thin orchestrators** — they import functionality, wire it together, and start execution. All substantive logic lives in the script-specific modules and shared utilities.

### Dependency Flow

```
src/entries/<Script>.user.js      (thin orchestrator)
├── imports from src/shared/*     (cross-cutting: logging, DOM, storage, network, UI, i18n, markdown, zip)
└── imports from src/<script>/*   (script-specific business logic)
        │
        ▼
    Vite + vite-plugin-monkey
        │
        ▼
dist/<Script>.user.js             (single IIFE, all modules inlined, @require stripped)
```

---

## Coding Standards

All standards are documented in detail in `docs/Userscripts_Gold_Standards_2026.md`. This section summarizes the rules that apply to every edit in this repo.

### MUST — Non-Negotiable Rules

**MUST use `'use strict'` at the top of every function/IIFE.** Prevents `arguments.callee` leaks and ensures the call stack cannot be walked by hostile page scripts.

**MUST use `textContent` for all user-facing text injection, never `innerHTML`.** The Trusted Types API blocks innerHTML on many modern sites. Setting `textContent` is inherently XSS-safe. The only exception is when injecting sanitized HTML from a trusted source (e.g., the markdown preview modal).

**MUST use `let`/`const`, not `var`.** The codebase is in transition — newer modules (copy-as-markdown/) use `let`/`const`, older modules still use `var`. All new code and edits MUST use `let`/`const`.

**MUST use async storage APIs (`GM.getValue`/`GM.setValue`) — never the synchronous `GM_getValue`/`GM_setValue`.** Tampermonkey 5.3+ mandates async storage to avoid loading the entire storage dictionary into memory on every page load.

**MUST declare every GM API in `@grant` individually.** Never use wildcards. Start with the minimal set and add grants only when the code actually uses the API.

**MUST use `@match` instead of `@include`.** `@include` is deprecated and triggers ESLint warnings. `@match` does not support regex — use glob patterns only.

**MUST NOT use `GM_webRequest`.** This API is permanently unavailable under Manifest V3 in Tampermonkey 5.2+. There is no direct replacement.

**MUST wrap all userscript logic in an IIFE.** Even though `@unwrap` removes Tampermonkey's auto-wrapper, the IIFE protects against global namespace pollution from the host page.

**MUST use closed Shadow DOM (`mode: 'closed'`) for all injected UI.** Prevents host-page CSS from bleeding into userscript UI and vice versa. The `createShadowContainer()` factory in `shared/ui-components.js` handles this.

**MUST increment the `@version` number before every commit that changes script behavior.** Tampermonkey checks the version to decide whether to update. Without a version bump, users won't get the update.

### SHOULD — Strongly Recommended

**SHOULD batch DOM reads before DOM writes** to avoid forced synchronous layouts. Read all measurements first, then apply all mutations.

**SHOULD use `DocumentFragment` for batch DOM insertion** to trigger exactly one reflow instead of one per element.

**SHOULD use `MutationObserver` with `childList: true, subtree: true`** instead of `setTimeout`-based polling for waiting on dynamic content.

**SHOULD call `observer.disconnect()` immediately** after the target element is found to reclaim memory.

**SHOULD use `requestAnimationFrame`** for non-critical DOM updates to avoid blocking the main thread during page load.

**SHOULD use `GM_addElement` instead of `document.createElement` + `appendChild`** when adding `script`, `style`, or `img` elements — it bypasses CSP restrictions.

**SHOULD log via the `createLogger` factory** from `shared/logging-utils.js` for consistent `[ScriptName]` prefixing.

**SHOULD add JSDoc type annotations** to function parameters and return values — they serve as documentation even without TypeScript.

### NEVER — Forbidden Patterns

**NEVER use `eval()`, `new Function()`, or `document.write()`.** These are blocked by CSP on most modern sites and are XSS vectors.

**NEVER use `@connect *`.** Always specify the exact domains needed for `GM_xmlhttpRequest`. Both initial and redirect URLs are checked against `@connect`.

**NEVER publish minified or obfuscated code to GreasyFork.** The platform requires human-readable source code for moderation review.

**NEVER rely on synchronous XHR.** Manifest V3 has removed synchronous XMLHttpRequest permanently.

**NEVER assume `unsafeWindow` is available.** It requires `@grant unsafeWindow` or `@grant none` (page context). In sandboxed mode without explicit grant, `unsafeWindow` is undefined.

---

## Manifest V3 & Browser Constraints

### Tampermonkey MV3 Status (2026)

Tampermonkey has been fully migrated to Manifest V3 since version 5.2.0 (May 2024), with continuous refinements through the current version 5.5+. The MV2 "Tampermonkey Legacy" extension is no longer supported.

### Required User Settings

For scripts using `@run-at document-start` to work correctly, users MUST configure Tampermonkey:
1. Navigate to Tampermonkey Settings → Security
2. Set **Content Script API** to `UserScripts API Dynamic` (not the default `Content Script`)
3. For local `.user.js` file testing, set **Userscript URL detection** to `Legacy`

In Chrome 138+, users must also enable the **"Allow User Scripts"** toggle on the Tampermonkey extension details page (`chrome://extensions/?id=<TM_ID>`). In Chrome versions before 138, **Developer Mode** must be enabled instead.

### MV3 API Limitations

| API | MV3 Status | Workaround |
|-----|-----------|------------|
| `GM_webRequest` | Permanently removed | None — redesign script without request interception |
| `GM_xmlhttpRequest` progress events | Only one event fires (not per-progress) | Use `responseType: 'stream'` |
| `GM_xmlhttpRequest` requests | Run serialized (not parallel) | Batch requests or accept serial latency |
| `@require` with RegExp | Injected in every frame in Dynamic mode | Avoid RegExp `@require`, use exact URL matching |
| `@resource` external URLs | Not auto-updated on script update | Use inline resources or manual refresh |
| Script installation | Downloads may run in parallel | Wait for full installation before reloading |

### Chrome userScripts API (Chrome 120+)

The native `chrome.userScripts` API provides the foundation for Tampermonkey's MV3 operation:

- **`userScripts.register(scripts)`** — Register one or more user scripts
- **`userScripts.execute(injection)`** — (Chrome 135+) Execute a script immediately on a target tab
- **`userScripts.configureWorld(properties)`** — Configure CSP and messaging for `USER_SCRIPT` worlds
- **`worldId`** (Chrome 133+) — Each script can run in its own isolated world, preventing cross-script interference
- **ExecutionWorlds:** `USER_SCRIPT` (isolated from page) or `MAIN` (shared with page JavaScript)

### Firefox userScripts API

Firefox implements the same API under `browser.userScripts` with key differences:
- `userScripts` is an **optional-only permission** — must be requested at runtime via `permissions.request()`
- Firefox uses `cloneInto()` and `exportFunction()` for safe cross-boundary object sharing
- Firefox continues to support MV2 `webRequest` (not applicable to userscripts directly, but relevant for TM internals)
- **Firefox blocks `runtime.onMessage` in UserScripts** by design — user scripts cannot use extension messaging. Use `GM_addValueChangeListener` for cross-context communication instead
- Firefox does NOT require Developer Mode for userscripts

### Script Manager Landscape (2026)

| Manager | MV3 Support | Chrome Viable | Open Source | Notes |
|---------|------------|---------------|-------------|-------|
| **Tampermonkey** 5.5+ | Yes (since 5.2.0) | Yes | No (proprietary core) | Primary target for this repo |
| **Violentmonkey** 2.36 | No (still MV2) | **No** — disabled by Chrome since July 2025 | Yes (MIT) | Firefox-only going forward |
| **ScriptCat** | Yes | Yes | Yes | Only open-source MV3 alternative, stable since mid-2025 |
| **Greasemonkey** 4.x | Yes | Firefox-only | Yes | Firefox-only |

**This repo targets Tampermonkey as primary platform.** Violentmonkey compatibility is best-effort (most scripts work but `@inject-into` is a Violentmonkey-only directive that TM silently ignores). Scripts using `@grant none` (page context) have the broadest cross-manager compatibility.

### CSP Handling

- Tampermonkey 5.0+ attempts to auto-inject a `nonce` into the host page CSP for inline script execution
- For manual CSP handling, extract the nonce: `document.querySelector('script[nonce]')?.nonce`
- Use `GM_addElement('script', { textContent: code })` to inject scripts that bypass CSP
- Chrome MV3 removed the ability to partially relax CSP — only "remove entirely" remains

---

## Security Rules

### @grant Least Privilege (CRITICAL)

Every script MUST declare only the GM APIs it actually uses. The grant determines the execution context:

| Grant Setting | Execution Context | GM API Access |
|--------------|-------------------|---------------|
| `@grant none` | Page context (no sandbox) | None except `GM_info` (read-only) |
| `@grant GM_xxx` (specific APIs) | Isolated sandbox | Only the explicitly granted APIs |
| `@grant unsafeWindow` + specific APIs | Sandbox with page window access | Granted APIs + direct page JS access |

Scripts running on `*://*/*` (Copy as Markdown for AI, Picture-in-Picture any site, Global Video Speed Controller) MUST be especially conservative — they execute on every site the user visits.

### @connect Restriction

Every domain used in `GM_xmlhttpRequest` MUST be explicitly listed in `@connect`. Both the initial request URL AND the final URL after redirects are checked. Never use `@connect *` — it allows exfiltration to any domain.

### XSS Prevention

- Use `textContent` for all text injection (never `innerHTML` for user/API-sourced content)
- Use `setAttribute` with quoted string values for attribute manipulation
- Use `encodeURIComponent()` for URL parameter values
- Trusted Types: If the host page enforces Trusted Types, create a policy via `trustedTypes.createPolicy()` or use `GM_addElement` which bypasses the restriction

### Subresource Integrity (SRI)

For any `@require` or `@resource` pointing to external URLs, add SRI hashes:
```
// @require https://cdn.example.com/lib@1.0.js#sha256-abc123...
// @resource myLib https://example.com/lib.js#md5=def456...
```
Tampermonkey verifies the hash at install time and rejects mismatches.

### Shadow DOM Isolation

All UI injected by userscripts MUST use closed Shadow DOM. This prevents:
- Host page CSS from breaking userscript UI styling
- Host page JavaScript from reading or modifying userscript UI via `document.querySelector()`
- Userscript CSS from accidentally affecting host page layout

The factory function `createShadowContainer()` in `shared/ui-components.js` handles the boilerplate. For custom implementations, use `element.attachShadow({ mode: 'closed' })` and inject styles via `GM_addElement(shadowRoot, 'style', { textContent: css })`.

Note: `closed` mode prevents casual access via `element.shadowRoot` but does NOT prevent access via DevTools — it is a style isolation mechanism, not a security boundary against determined attackers.

---

## UI Patterns

### Shadow DOM Container Factory

`createShadowContainer(opts)` from `shared/ui-components.js` is the standard entry point for all userscript UI. It:
1. Creates a host `div` with positioning and z-index
2. Attaches a closed Shadow DOM root
3. Injects a CSS reset (`:host { all: initial; }`)
4. Returns `{ host, root }` for the script to build its UI

### Available UI Primitives

| Function | File | Purpose |
|----------|------|---------|
| `createShadowContainer(opts)` | shared/ui-components.js | Closed Shadow DOM host + root |
| `createToast(message, opts)` | shared/ui-components.js | Auto-dismissing notification, bottom-right |
| `createStatusBar(opts)` | shared/ui-components.js | Persistent bottom-right bar with progress |
| `createSidebar(opts)` | shared/ui-components.js | Draggable right sidebar with push-page effect |

### CSS Strategy

- Inject all styles INSIDE the Shadow DOM, never in the page context
- Use `:host { all: initial; }` as CSS reset to neutralize inherited page styles
- Use `!important` sparingly — only when the Shadow DOM boundary isn't respected by a particular property
- Use CSS `:has()` and `:not()` pseudo-classes for complex element hiding instead of JavaScript traversal
- Toggle visibility via `classList` rather than modifying individual inline styles
- Set `pointer-events: none` on the host container, `pointer-events: auto` on interactive children — prevents the invisible UI container from blocking page clicks

### Theme Consistency

All script UIs should use a consistent dark theme palette:
- Background: `linear-gradient(135deg, #0d0d1a 0%, #111827 55%, #0a1628 100%)`
- Border: `rgba(99, 102, 241, 0.35)`
- Text: `#e2e8f0`
- Accent: `#6366f1` (indigo)

Deviate only when matching a specific website's native theme is functionally necessary.

---

## Performance Rules

### The 100ms Rule

Every synchronous operation in the main thread MUST complete within 100ms. Longer operations cause visible jank. For heavy computation:
- Use `Web Worker` (initialized from a Blob URL) for CPU-intensive work
- Use `OffscreenCanvas` for image processing in a worker
- Split work across multiple `requestAnimationFrame` callbacks

### DOM Manipulation

- **Batch reads before writes:** Read all layout measurements (`offsetWidth`, `getBoundingClientRect`, etc.) first, then apply all mutations — prevents forced synchronous layouts
- **Use `DocumentFragment`:** Assemble new nodes offline, then append the fragment once to trigger a single reflow
- **Use `requestAnimationFrame`:** Defer non-critical DOM updates until after the current frame renders
- **Toggle `classList`:** Modify one CSS class instead of multiple inline style properties sequentially

### MutationObserver Patterns

MUST use Promise-based `MutationObserver` wrappers (like `waitForElement()` from `shared/dom-utils.js`) instead of polling with `setTimeout`:
```javascript
// CORRECT: Promise-based observer
const el = await waitForElement('.target-selector', 5000);

// WRONG: Polling
const interval = setInterval(() => {
  const el = document.querySelector('.target-selector');
  if (el) { clearInterval(interval); /* ... */ }
}, 100);
```

Key observer rules:
- Use `{ childList: true, subtree: true }` for watching for new elements
- Call `observer.disconnect()` immediately when the target is found
- Process batched mutations together — inserting multiple elements via `innerHTML` triggers a single callback with multiple nodes
- Filter by node type (skip text and comment nodes) in the callback
- Use plain `for` loops inside the callback — high-frequency observer callbacks make array iteration overhead measurable

### Network Awareness

- Check `navigator.connection.saveData` before large background fetches — respect user's data-saving preference
- Check `navigator.connection.effectiveType` — disable HD image prefetching on `'2g'` or `'slow-2g'` connections

### Storage Performance

- Use `GM.setValues({ key1: val1, key2: val2 })` for bulk writes — consolidates multiple operations into one
- Use IndexedDB (`window.indexedDB`) for datasets exceeding ~23MB (the `GM_setValue` LevelDB soft limit)
- Always `JSON.stringify()` objects before storage — unsupported types fail silently in GM storage
- Stringify before comparing objects for change detection — object references don't work across page loads

---

## Tampermonkey API Usage

### Async vs Sync APIs

Tampermonkey provides both callback-based (`GM_*`) and Promise-based (`GM.*`) APIs:

| Operation | Sync/Callback | Promise-based | Preferred |
|-----------|--------------|---------------|-----------|
| Storage get | `GM_getValue(key, default)` | `GM.getValue(key, default)` | `GM.getValue` |
| Storage set | `GM_setValue(key, val)` | `GM.setValue(key, val)` | `GM.setValue` |
| Storage delete | `GM_deleteValue(key)` | `GM.deleteValue(key)` | `GM.deleteValue` |
| Storage list | `GM_listValues()` | `GM.listValues()` | `GM.listValues` |
| Bulk set | `GM_setValues(obj)` | — | `GM_setValues` |
| XHR | `GM_xmlhttpRequest(details)` | `GM.xmlHttpRequest(details)` | `GM.xmlHttpRequest` (returns Promise with abort) |
| Download | `GM_download(details)` | `GM.download(details)` | `GM.download` |
| Menu command | `GM_registerMenuCommand(...)` | `GM.registerMenuCommand(...)` | `GM.registerMenuCommand` |
| Add style | `GM_addStyle(css)` | `GM.addStyle(css)` | `GM.addStyle` |
| Set clipboard | `GM_setClipboard(data)` | `GM.setClipboard(data)` | `GM.setClipboard` |

MUST always prefer the Promise-based `GM.*` form. The callback-based `GM_*` form is for backward compatibility only.

### GM_xmlhttpRequest (CRITICAL)

This is callback-based even in the Promise wrapper. The `shared/network-utils.js` module provides pre-built wrappers:

- `fetchPage(url, opts)` — HTTP GET → parsed Document (via DOMParser)
- `fetchJSON(url, opts)` — HTTP GET → parsed JSON object
- `fetchBlob(url, opts)` — HTTP GET → Blob

Key parameters:
- `anonymous: true` — block cookies from being sent (privacy/CORS avoidance)
- `responseType: 'stream'` — required for progress events in MV3
- `fetch: true` — use Fetch API instead of XHR (loses XHR-specific events but may perform better)
- `timeout` — always set a timeout (20000ms default in most scripts)

### GM_addElement (CSP-Safe Injection)

Use `GM_addElement` instead of `document.createElement` for `script`, `style`, and `img` elements:
```javascript
GM_addElement('script', { textContent: 'console.log("injected")' });
GM_addElement(parentNode, 'style', { textContent: '.my-class { color: red; }' });
```
This bypasses CSP restrictions that block dynamically created elements.

### GM_registerMenuCommand

Registers commands in the Tampermonkey popup menu and page context menu. Scripts should register at least one menu command (typically a settings toggle). Global Video Speed Controller uses menu commands extensively for speed presets (0.5x through 16x).

### window.onurlchange

For SPAs that use History API navigation: grant `window.onurlchange` and listen for `urlchange` events instead of polling `location.href`. Requires explicit `@grant window.onurlchange`.

---

## Storage Strategy

### Key-Value Storage (GM Storage)

- **Primary storage:** `GM.getValue`/`GM.setValue` (async, Promise-based)
- **Bulk operations:** `GM.setValues({ key1: val1, key2: val2 })` — TM 5.3+ only
- **Bulk reads:** `GM.getValues({ key1: default1, key2: default2 })` — TM 5.3+ only
- **Change listeners:** `GM.addValueChangeListener(key, (name, oldVal, newVal, remote) => { ... })` — the `remote` boolean parameter indicates whether the change came from another tab
- **Tab-scoped storage:** `GM_getTab`/`GM_saveTab` for data that should persist only while a specific tab is open

### Storage Utilities (shared/storage-utils.js)

This module wraps GM storage with async convenience functions:
- `loadSetting(key, defaultValue)` → single key, async
- `saveSetting(key, value)` → single key, async, auto-JSON-stringify
- `loadSettings(defaults)` → bulk load with defaults object
- `saveSettings(obj)` → bulk save, auto-JSON-stringify each value

These functions also register themselves on `globalThis.TM.storage`.

### Large Dataset Strategy

For datasets exceeding ~23MB (e.g., Marketplace Deal Finder with its crawled deal cache):
- Use `window.indexedDB` instead of GM storage
- IndexedDB supports indexes, cursors, and transactions for efficient querying
- GM storage is LevelDB-backed and optimized for small key-value pairs, not large documents

### Cross-Tab Synchronization

Use `GM_addValueChangeListener` for real-time sync between tabs. The `remote: true` flag in the callback indicates external changes. This is used by Global Video Speed Controller to sync speed settings across all tabs.

---

## Known Issues & Technical Debt

This section documents known problems discovered during the May 2026 code audit. These are acknowledged issues, not accusations — they exist because the scripts evolved organically over time.

### [CRITICAL] @connect * Wildcard — 2 Scripts

Copy as Markdown for AI and Manga Panel Downloader use `@connect *`, granting unrestricted network access. Copy as Markdown's use case (fetching arbitrary URLs for markdown conversion) is legitimate — the script must connect to any domain the user wants to convert. Manga Panel Downloader should be restricted to known manga hosting domains. **Any new script MUST NOT use `@connect *` without explicit justification documented here.**

### [HIGH] Circular Dependencies — 3 Script Families

- `notebooklm-source-export/`: extractor.js ↔ ui-panel.js
- `recaptcha-solver/`: solver-engine.js ↔ ui-button.js
- `crunchyroll-enhanced/`: scanner.js ↔ ui-panel.js ↔ exporter.js + filters.js

Circular imports create fragile initialization ordering. The modules work at runtime because Vite's module resolution handles cycles, but the dependency graph is brittle. **When adding new modules, check for circularity.** Break cycles by extracting shared state into a separate config/state module that both sides import.

### [HIGH] Widespread `var` Usage — ~1,474 Occurrences

Only 4 of 17 scripts use `let`/`const` consistently: BotGhost, Reddit, FlameComics, Google Search Enhanced. All 8 shared modules use `var` exclusively. The copy-as-markdown modules have been partially converted. **All new code MUST use `let`/`const`. Existing `var` declarations should be updated when the containing file is edited for other reasons.**

### [HIGH] innerHTML with User/API Data — 25+ Locations

`innerHTML` is used to inject user-generated content and API responses in:
- `gutefrage-smart-filters/ui-panel.js`
- `youtube-enhanced/channel-speed.js`
- `marketplace-deal-finder/ui-panel.js`
- `marketplace-deal-finder/api-gemini.js`

An `esc()` HTML-escaping function exists in `copy-as-markdown/ui-sidebar.js` but is not shared project-wide. **Before touching any of these files, extract the escape function to a shared utility and apply it to all innerHTML injection points.** Converting to `textContent` + DOM manipulation is the preferred approach.

### [MEDIUM] Raw console.log in Production — 50+ Occurrences

Scrapers (`scraper-willhaben.js`, `scraper-kleinanzeigen.js`) and `api-gemini.js` use raw `console.log` instead of the `createLogger` factory. **All new debugging output MUST use `createLogger`. Existing raw `console.log` calls should be converted when editing those files.**

### [MEDIUM] setInterval Polling Instead of Events

- Crunchyroll Enhanced polls every 1s for PiP attributes
- Manga Panel Downloader polls every 1s for URL changes

**Use `MutationObserver` or `window.onurlchange` (`@grant window.onurlchange`) instead of interval-based polling.** SPA navigation detection should use History API events, not timers.

### [MEDIUM] History API Monkey-Patching

AniSearch Endless Scroll patches `history.pushState`/`replaceState` at module level. This approach is fragile, conflicts with other scripts that also patch the History API, and is not cleaned up when the script is disabled. **Prefer `window.addEventListener('urlchange', ...)` with `@grant window.onurlchange` where available.**

### [LOW] No .gitignore Coverage

Only `node_modules/` is gitignored. Missing entries for: `dist/` (generated), `.claude/` (temporary agent outputs), `.env` (secrets), `*.log` (logs). Add these when setting up CI/CD.

---

## Testing & Debugging

### Current State

There is **no test framework, no test files, and no testing dependencies** in this project. This is a known gap.

### gobj Mapping for Jest

The Gold Standards document describes a `gobj` pattern for exposing private module functions to external test frameworks:
```javascript
// In the userscript
globalThis.gobj = globalThis.gobj || {};
globalThis.gobj.myFunction = myFunction;

// In the Jest test
const { myFunction } = globalThis.gobj;
```
This pattern is documented but not yet implemented in any script.

### Debugging Checklist

1. **Check the console:** All scripts log via `createLogger` with a `[ScriptName]` prefix. Look for these messages first.
2. **Check Tampermonkey settings:** Is the script enabled? Is "UserScripts API Dynamic" selected?
3. **Check `@match` patterns:** Does the current URL actually match? Test with `GM_info.script.matches`.
4. **Check CSP:** Is the host page blocking inline scripts? Try `GM_addElement` instead of direct injection.
5. **Check Shadow DOM:** Is the UI being injected? Inspect with DevTools — Shadow DOM elements are visible in the Elements panel.
6. **Check storage:** Use the Tampermonkey dashboard Storage tab to inspect stored values.

### Source Maps

The build currently does NOT generate source maps. For debugging, search the dist file for the function name — the output is non-minified so identifiers are preserved.

---

## Distribution & Publishing

### CDN Distribution

All 17 scripts are distributed via jsDelivr CDN with this URL pattern:
```
https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/<URL-ENCODED-FILENAME>
```

The `@updateURL` and `@downloadURL` metadata fields in each entry point to these CDN URLs. When a version is bumped in the entry file and pushed to main, jsDelivr picks up the change and Tampermonkey auto-updates users within 24 hours.

### GreasyFork Publishing Rules

- Code MUST be non-minified and non-obfuscated (original whitespace, readable variable names)
- `@antifeature` MUST be declared if the script contains ads, tracking, or cryptocurrency mining
- `@description` MUST be accurate and descriptive
- Scripts are subject to moderator review — keep the code clean and well-organized

### Version Bumping (CRITICAL)

Before EVERY commit that changes script behavior:
1. Increment the `@version` number in the entry file
2. Run `node build.mjs` to regenerate the dist file
3. Commit both the source change and the rebuilt dist file together

Without a version bump, Tampermonkey will not detect the update and users will remain on the old version indefinitely.

### .meta.js Pattern

The current build sets `metaFileName: false` — no separate `.meta.js` files are generated. If bandwidth optimization becomes necessary (many users polling for updates), enable `.meta.js` generation. The `.meta.js` file contains only the metadata block (under 1KB) which TM checks daily; the full `.user.js` is downloaded only when the version changes.

---

## Script Catalog

### 1. AniSearch Endless Scroll (v3.3.0)
- **Entry:** `src/entries/AniSearch Endless Scroll.user.js`
- **Target:** `anisearch.de/anime*`
- **Grants:** `GM_setValue`, `GM_getValue`, `GM_xmlhttpRequest`
- **Shared modules:** dom-utils, logging-utils, storage-utils, network-utils, i18n-utils, ui-components
- **Script modules:** `endless-loop.js` (pagination + item extraction), `rating-filter.js` (star rating filtering), `ui-statusbar.js` (status bar + spinner)
- **What it does:** Auto-loads ALL pages of AniSearch anime listings, appends items seamlessly, filters by minimum star rating. Uses MutationObserver to detect container type (gallery/covers/list/table). Has absolute 200-page safety cap with 3-retry fetch logic.
- **Complexity:** Medium — 3 modules, stateful pagination loop with abort logic

### 2. BotGhost Bulk Choice Extractor
- **Entry:** `src/entries/BotGhost Bulk Choice Extractor.user.js`
- **Target:** `botghost.com`
- **Grants:** Minimal
- **Shared modules:** logging-utils
- **Script modules:** None (single-file entry)
- **What it does:** Extracts multiple-choice options from BotGhost bot builder. Simple DOM scraping utility.
- **Complexity:** Low — single file, no sub-modules

### 3. Copy as Markdown for AI (v3.1.0)
- **Entry:** `src/entries/Copy as Markdown for AI.user.js`
- **Target:** `*://*/*` (all sites)
- **Grants:** `GM_getValue`, `GM_setValue`, `GM_setClipboard`, `GM_registerMenuCommand`, `GM_xmlhttpRequest`, `GM_addStyle`
- **Shared modules:** logging-utils, storage-utils, ui-components, markdown-converter, network-utils
- **Script modules:** `content-pipeline.js` (6-stage extraction: PreFilter → MainContent → ContentFilter → Relevance → Convert → PostProcess), `converter-integration.js` (embedded TurndownService for HTML→Markdown), `ui-sidebar.js` (Shadow-DOM sidebar with options/history/themes), `preview-modal.js` (rendered Markdown preview + raw source tabs), `visual-overlay.js` (floating highlight boxes for element picking), `click-modes.js` (interactive click-to-select: images, links), `pruning-filter.js` (Crawl4AI port: weighted composite score filtering), `density-filter.js` (text/link density scoring), `bm25-filter.js` (Crawl4AI port: BM25 Okapi relevance scoring)
- **What it does:** Converts any web page, selection, or remote URL to clean Markdown optimized for AI prompts. Includes interactive element picking, content filtering pipeline, and preview/editing modal.
- **Complexity:** High — 9 modules, embedded TurndownService, 6-stage pipeline, interactive overlay system

### 4. Crunchyroll Enhanced
- **Entry:** `src/entries/Crunchyroll Enhanced.user.js`
- **Target:** `crunchyroll.com`
- **Grants:** `GM_getValue`, `GM_setValue`, `GM_addStyle`, `GM_registerMenuCommand`
- **Shared modules:** logging-utils, dom-utils, storage-utils, i18n-utils, ui-components
- **Script modules:** `scanner.js` (card scanning + rating badge injection + MutationObserver), `filters.js` (multi-criteria filtering + sorting), `exporter.js` (CSV/clipboard export), `ui-panel.js` (sidebar with filter controls + stats + persistence)
- **What it does:** Adds rating badges, multi-criteria filtering, and batch export to Crunchyroll's show listings. Uses MutationObserver for dynamically loaded cards.
- **Complexity:** Medium-High — 4 modules, observer-based scanning, filter persistence

### 5. Epic Games Library Export
- **Entry:** `src/entries/Epic Games Library Export.user.js`
- **Target:** `epicgames.com`
- **Grants:** Minimal
- **Shared modules:** logging-utils, ui-components
- **Script modules:** None (single-file entry)
- **What it does:** Exports user's Epic Games Store library. Simple DOM extraction utility.
- **Complexity:** Low — single file, uses shared UI components

### 6. FlameComics Advanced Sort
- **Entry:** `src/entries/FlameComics Advanced Sort.user.js`
- **Target:** `flamecomics.com`
- **Grants:** Minimal
- **Shared modules:** logging-utils
- **Script modules:** None (single-file entry)
- **What it does:** Advanced sorting for FlameComics manga listings. DOM manipulation utility.
- **Complexity:** Low — single file

### 7. Global Video Speed Controller (v2.5.0)
- **Entry:** `src/entries/Global Video Speed Controller.user.js`
- **Target:** `http://*/*`, `https://*/*` (all sites)
- **Grants:** `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`, `GM_addStyle`
- **Shared modules:** logging-utils, dom-utils, storage-utils
- **Script modules:** `page-script-builder.js` (generates code that overrides `HTMLMediaElement.prototype.playbackRate`), `injection-strategies.js` (three-tier fallback: script tag, unsafeWindow prototype, direct polling), `ui-controller.js` (speed indicator overlay + TM menu commands 0.5x–16x + cross-tab sync)
- **What it does:** Adds global video speed control to ANY video element on ANY website. The three-tier injection strategy ensures compatibility with sites that block script injection (e.g., Netflix). Menu commands provide keyboard shortcut access to speed presets.
- **Complexity:** Medium — 3 modules, cross-context injection (page script + content script)

### 8. Google AI Studio Chat Exporter
- **Entry:** `src/entries/Google AI Studio Chat Exporter.user.js`
- **Target:** `aistudio.google.com`
- **Grants:** `GM_setClipboard`
- **Shared modules:** logging-utils, markdown-converter, ui-components
- **Script modules:** None (single-file entry)
- **What it does:** Exports Google AI Studio chat conversations to Markdown. Uses shared markdown-converter for DOM-to-Markdown transformation.
- **Complexity:** Low — single file, leverages shared modules

### 9. Google Search Enhanced
- **Entry:** `src/entries/Google Search Enhanced.user.js`
- **Target:** `google.com/search`
- **Grants:** Minimal
- **Shared modules:** logging-utils
- **Script modules:** None (single-file entry)
- **What it does:** Enhances Google Search results. DOM enhancement utility.
- **Complexity:** Low — single file

### 10. Gutefrage Smart Filters
- **Entry:** `src/entries/Gutefrage Smart Filters.user.js`
- **Target:** `gutefrage.net`
- **Grants:** `GM_getValue`, `GM_setValue`, `GM_addStyle`
- **Shared modules:** logging-utils, dom-utils, storage-utils, i18n-utils, ui-components
- **Script modules:** `tag-remover.js` (TagRemover class: tag removal + author blocking + observer), `filter-engine.js` (EnhancedFilterIntegration: date/content/interaction/text/topic multi-criteria filtering), `feed-navigation.js` (date-based navigation with timezone-aware URL construction), `ui-panel.js` (SidebarPanel: filter controls + stats bar + pill-style toggles)
- **What it does:** Adds smart filtering, tag removal, author blocking, and date-based navigation to Gutefrage.net. Sidebar panel with filter controls and statistics.
- **Complexity:** Medium — 4 modules, custom filter engine, observer-based tag removal

### 11. Manga Panel Downloader
- **Entry:** `src/entries/Manga Panel Downloader.user.js`
- **Target:** Various manga sites
- **Grants:** `GM_xmlhttpRequest`, `GM_download`, `GM_getValue`, `GM_setValue`
- **Shared modules:** logging-utils, dom-utils, network-utils, i18n-utils, ui-components, zip-builder
- **Script modules:** `image-finder.js` (lazy-load image URL extraction from multiple attributes), `image-processor.js` (5-fallback fetch chain, splits tall panels into 3500px segments), `page-navigator.js` (scroll-to-load + button-based + URL-guessing page navigation), `ui-panel.js` (Shadow-DOM sidebar with scan controls + segment listing + ZIP download)
- **What it does:** Downloads manga panels from various manga reader sites. Smart image detection from lazy-load attributes, automatic tall-image splitting, and ZIP packaging of all panels.
- **Complexity:** Medium-High — 4 modules, multi-site compatibility, image processing pipeline

### 12. Marketplace Deal Finder (v30.0)
- **Entry:** `src/entries/Marketplace Deal Finder.user.js`
- **Target:** `willhaben.at`, `kleinanzeigen.de`
- **Grants:** `GM_setValue`, `GM_getValue`, `GM_xmlhttpRequest`, `GM_registerMenuCommand`, `GM_addStyle`
- **Shared modules:** logging-utils, dom-utils, storage-utils, network-utils, ui-components
- **Script modules:** `ranking-engine.js` (deal processing, dedup, global re-ranking, markdown report generation), `api-gemini.js` (Google Gemini AI with 3 models: Flash/Pro/Lite, price statistics), `scraper-willhaben.js` (willhaben.at ad detection + data extraction + pagination), `scraper-kleinanzeigen.js` (kleinanzeigen.de ad detection + data extraction + pagination), `ui-panel.js` (modal, settings/results views, progress display, multi-format export: Markdown/JSON/CSV)
- **What it does:** Scrapes marketplace listings, ranks deals using AI (Gemini), and presents results in a filterable, exportable UI. Most complex script in the repo.
- **Complexity:** Very High — 5 modules, AI integration, dual-site scraping, ranking engine, multi-format export

### 13. NotebookLM Source Export
- **Entry:** `src/entries/NotebookLM Source Export.user.js`
- **Target:** `notebooklm.google.com`
- **Grants:** `GM_getValue`, `GM_setClipboard`, `GM_xmlhttpRequest`
- **Shared modules:** logging-utils, dom-utils, markdown-converter, network-utils, ui-components, zip-builder
- **Script modules:** `extractor.js` (iterates NotebookLM sources, converts to Markdown, builds ZIP, keeps browser awake via inaudible audio loop), `ui-panel.js` (sidebar with terminal log, progress bar, sound effects)
- **What it does:** Exports all sources from a NotebookLM notebook as Markdown files in a ZIP archive. Includes keep-alive mechanism to prevent browser sleep during long exports.
- **Complexity:** Medium — 2 modules, keep-alive mechanism, ZIP packaging

### 14. Picture-in-Picture any site
- **Entry:** `src/entries/Picture-in-Picture any site.user.js`
- **Target:** `*://*/*` (all sites)
- **Grants:** None (`@grant none` — page context)
- **Shared modules:** logging-utils
- **Script modules:** None (single-file entry)
- **What it does:** Enables Picture-in-Picture mode for any video element on any website. Runs in page context (`@grant none`) for maximum compatibility with video element access.
- **Complexity:** Low — single file, page context execution

### 15. Recaptcha Solver (v2.11.0)
- **Entry:** `src/entries/Recaptcha Solver.user.js`
- **Target:** `google.com/recaptcha`, `recaptcha.net`
- **Grants:** `GM_xmlhttpRequest`
- **Shared modules:** logging-utils, dom-utils, network-utils
- **Script modules:** `solver-engine.js` (state machine: ready→working→success/failed/dos, interval-based solving with audio challenge fallback), `audio-api.js` (audio transcription via external API with dual-server failover + latency measurement), `ui-button.js` (injectable solve button in reCAPTCHA iframe with SVG state icons)
- **What it does:** Automates reCAPTCHA solving via audio challenge transcription. State machine manages the solve lifecycle, with automatic retry and rate-limit detection.
- **Complexity:** Medium-High — 3 modules, state machine, external API integration, iframe injection

### 16. Reddit Content Unlocker
- **Entry:** `src/entries/Reddit Content Unlocker.user.js`
- **Target:** `reddit.com`
- **Grants:** `GM_getValue`, `GM_setValue`
- **Shared modules:** logging-utils, dom-utils, storage-utils
- **Script modules:** None (single-file entry)
- **What it does:** Unlocks/blurs locked Reddit content. DOM manipulation utility.
- **Complexity:** Low — single file, leverages shared modules

### 17. YouTube Enhanced (v1.7.0)
- **Entry:** `src/entries/YouTube Enhanced.user.js`
- **Target:** `*.youtube.com/*`
- **Grants:** `GM_getValue`, `GM_setValue`, `GM_addStyle`
- **Shared modules:** logging-utils, dom-utils, storage-utils, i18n-utils
- **Script modules:** `auto-hd.js` (patches localStorage + YouTube player for max quality up to 2160p), `channel-speed.js` (per-channel playback speed with native YouTube settings panel UI), `auto-stop.js` (auto-pauses video on navigation, intercepts auto-play)
- **What it does:** Three independent YouTube enhancements: auto-HD quality selection, per-channel speed memory, and auto-stop on navigation.
- **Complexity:** Medium — 3 modules, YouTube player API integration, native UI integration

---

## Shared Module Reference

Every shared module registers its exports on `globalThis.TM.<namespace>` as a side effect. This makes functions available to all inlined modules at runtime inside the IIFE.

### shared/logging-utils.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `createLogger` | `(prefix: string, debugMode?: boolean) => { log, warn, error, info, debug }` | Creates a prefixed console logger. Output format: `[Prefix] message` |

Registers: `globalThis.TM.createLogger`

Consumed by: ALL 17 scripts

### shared/dom-utils.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `waitForElement` | `(selector: string, timeout?: number, root?: Element) => Promise<Element>` | Promise-based MutationObserver wrapper — resolves when element appears, rejects on timeout (default 5000ms) |
| `debounce` | `(fn: Function, ms?: number) => Function` | Debounce wrapper (default 250ms delay) |
| `throttle` | `(fn: Function, ms?: number) => Function` | Throttle wrapper (default 200ms interval) |
| `observeMutations` | `(callback: Function, root?: Element) => MutationObserver` | Creates a MutationObserver with `{ childList: true, subtree: true }` |

Registers: `globalThis.TM.dom`

Consumed by: 15 scripts (all except PiP and Copy as Markdown)

### shared/storage-utils.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `loadSetting` | `async (key: string, defaultValue?: any) => any` | Wraps `GM.getValue` with JSON parse |
| `saveSetting` | `async (key: string, value: any) => void` | Wraps `GM.setValue` with JSON stringify |
| `loadSettings` | `async (defaults: object) => object` | Bulk load with defaults fallback |
| `saveSettings` | `async (obj: object) => void` | Bulk save with JSON stringify per value |

Registers: `globalThis.TM.storage`

Consumed by: 8 scripts (Marketplace Deal Finder, Crunchyroll, Gutefrage, YouTube, AniSearch, Reddit, Speed Controller, Copy as Markdown)

### shared/network-utils.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `fetchPage` | `async (url: string, opts?: object) => Document` | GM_xmlhttpRequest wrapper → parsed HTML Document via DOMParser |
| `fetchJSON` | `async (url: string, opts?: object) => object` | GM_xmlhttpRequest wrapper → parsed JSON |
| `fetchBlob` | `async (url: string, opts?: object) => Blob` | GM_xmlhttpRequest wrapper → Blob response |

Registers: `globalThis.TM.network`

Consumed by: 5 scripts (AniSearch, Manga Panel, Recaptcha Solver, Marketplace Deal Finder, Copy as Markdown)

### shared/ui-components.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `createShadowContainer` | `(opts?: { id?, position?, zIndex? }) => { host, root }` | Creates closed Shadow DOM container attached to `document.body`. Returns host element and shadow root. |
| `createToast` | `(message: string, opts?: { duration?, type? }) => HTMLElement` | Auto-dismissing toast notification, fixed position bottom-right |
| `createStatusBar` | `(opts?: { id?, palette? }) => { setStatus, removeStatus, showLoader, removeLoader }` | Persistent status bar with progress indicator |
| `createSidebar` | `(opts?: { id?, width?, position? }) => { host, root, show, hide, toggle }` | Draggable sidebar with push-page effect |

All UI components use `textContent` (not innerHTML) for XSS prevention.

Registers: `globalThis.TM.ui`

Consumed by: 9+ scripts (Crunchyroll, Gutefrage, Manga Panel, NotebookLM, Epic Games, Copy as Markdown, AniSearch, Google AI Studio, Marketplace Deal Finder)

### shared/i18n-utils.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `normalizeText` | `(str: string) => string` | Diacritics removal + whitespace collapse + lowercase |
| `matchAnyTerm` | `(text: string, terms: string[]) => boolean` | Returns true if any term matches after normalization |
| `matchTerm` | `(text: string, term: string) => boolean` | Exact match after normalization |

Registers: `globalThis.TM.i18n`

Consumed by: 5 scripts (Gutefrage, YouTube, Crunchyroll, Manga Panel, AniSearch)

### shared/markdown-converter.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `htmlToMarkdown` | `(el: Element) => string` | Recursive DOM-to-GitHub-Flavored-Markdown converter. Handles all inline elements (strong, em, code, a, img, del, u) and block elements (h1-h6, p, div, pre, blockquote, ul/ol, table, hr). |

Registers: `globalThis.TM.markdown`

Consumed by: 3 scripts (NotebookLM, Google AI Studio, Copy as Markdown)

### shared/zip-builder.js
| Export | Signature | Purpose |
|--------|-----------|---------|
| `buildStoreZip` | `(files: Array<{name: string, data: Uint8Array}>) => Uint8Array` | Zero-dependency STORE (no compression) ZIP archive builder. Includes lazy CRC-32 table, local file headers, central directory, EOCD. |

Registers: `globalThis.TM.zip`

Consumed by: 2 scripts (NotebookLM Source Export, Manga Panel Downloader)

---

## Git Conventions

### Commit Message Format

Use conventional commit style:
```
<type>(<scope>): <description>
```
Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`

Scope is the script name in kebab-case: `copy-as-markdown`, `youtube-enhanced`, `marketplace-deal-finder`, `shared`, `build`.

Examples:
```
fix(copy-as-markdown): register menu command synchronously, restore @inject-into
refactor(shared): convert async storage wrappers to Promise-based GM.* APIs
feat(youtube-enhanced): add per-channel playback speed memory
chore(build): upgrade vite-plugin-monkey to 7.1.9
```

### Version Bumping Rule (CRITICAL)

Before EVERY commit that changes script behavior:
1. Increment `@version` in the entry file (semver)
2. Run `node build.mjs` to regenerate the dist file
3. Commit the entry file change AND the rebuilt dist file in the SAME commit — never commit them separately

### Branch Strategy

- `main` is the production branch — all dist files are built from main
- Create feature branches from `main` for any change touching more than one script
- Single-script fixes can be committed directly to `main` if they're low-risk

### Pre-Commit Checklist

- [ ] `@version` bumped in entry file
- [ ] `node build.mjs` runs without errors (17 built, 0 failed)
- [ ] Dist file changes reviewed (non-minified, human-readable)
- [ ] No debug `console.log` left in production code (use `createLogger` with `debugMode`)
- [ ] New `@grant` entries added if new GM APIs are used
- [ ] `@match` patterns tested against actual target URLs

---

## Workflow & Commands

### Build

```bash
node build.mjs
```
Builds all 17 scripts. Output: `dist/<Name>.user.js`. Must succeed with "17 built, 0 failed".

### Development Workflow

1. Edit source files in `src/entries/`, `src/shared/`, or `src/<script-name>/`
2. Run `node build.mjs` to rebuild
3. Load the built `dist/<Name>.user.js` file in Tampermonkey for testing
4. For local file testing: Create a proxy userscript in Tampermonkey with `@require file:///C:/Dev/Projects/tampermonkey-scripts/dist/<Name>.user.js`
5. Remember: set TM's "Userscript URL detection" to "Legacy" for local file URLs

### Adding a New Script

1. Create `src/<script-name>/` directory with script-specific modules
2. Create `src/entries/<Script Name>.user.js` entry file with full metadata block
3. Import from `../shared/*` and `../<script-name>/*` as needed
4. Run `node build.mjs` to verify the build
5. Update `@updateURL` and `@downloadURL` to point to jsDelivr CDN

### Adding a New Shared Module

1. Create `src/shared/<module-name>.js`
2. Export functions with `export function`
3. Register on `globalThis.TM.<namespace>` for runtime access
4. Add JSDoc type annotations
5. Update this CLAUDE.md to document the new module

### Documentation

- `docs/Userscripts_Gold_Standards_2026.md` — Authoritative coding rules, security policies, performance standards
- `docs/Tampermonkey_Types.d.ts` — Complete TypeScript API definitions
- `docs/Manifest_V3_UserScripts_Standards.md` — MV3 constraints and chrome.userScripts API reference
- `docs/Tampermonkey_Scripts_Overiew_Examples.md` — All 17 scripts with metadata and code excerpts
- `docs/Tampermonkey_Documentation.md` — Official TM documentation mirror (last updated 2026-04-27)

When in doubt about a coding rule, API usage, or security policy, consult `docs/` first. The docs are authoritative over any information in this CLAUDE.md.

# Tampermonkey Scripts Modularization Refactor — Design Spec

**Date:** 2026-05-03
**Scope:** All 17 `.user.js` files (~14,112 lines)
**Goal:** Extract duplicated code into `src/shared/` modules, enforce 2026 Gold Standards

## Architecture

### Shared Modules (`src/shared/`)

Each module is a standalone `.js` file hosted on GitHub Raw, imported via `@require`.

| Module | Exports (via global namespace `TM`) | Consumers |
|--------|-------------------------------------|-----------|
| `dom-utils.js` | `waitForElement`, `debounce`, `throttle`, `observeMutations` | 15 scripts |
| `ui-components.js` | `createSidebar`, `createToast`, `createStatusBar`, `createShadowContainer` | 7 scripts |
| `storage-utils.js` | `loadSetting`, `saveSetting`, `loadSettings`, `saveSettings` | 8 scripts |
| `network-utils.js` | `fetchPage`, `fetchJSON`, `fetchBlob` (all Promise-wrapped `GM_xmlhttpRequest`) | 5 scripts |
| `logging-utils.js` | `createLogger(prefix)` → `{ log, warn, error, info, debug }` | 17 scripts |
| `zip-builder.js` | `buildStoreZip(files)` — CRC-32 + DataView, STORE-only | NotebookLM, Manga Panel |
| `markdown-converter.js` | `htmlToMarkdown(element)` — recursive DOM walker | NotebookLM, Google AI Studio, Copy as Markdown |
| `i18n-utils.js` | `normalizeText`, `matchTerm`, `matchAnyTerm` | Gutefrage, YouTube, Crunchyroll, Manga Panel, AniSearch |

### Namespace Convention

All shared modules attach to `globalThis.TM` (single namespace). Each module self-registers:

```javascript
globalThis.TM = globalThis.TM || {};
globalThis.TM.dom = { waitForElement, debounce, throttle, observeMutations };
```

### Per-Script Changes

1. Add `@require` directives for needed shared modules
2. Replace duplicated code with `TM.module.function()` calls
3. Translate German comments/logs/variables to English
4. Add `@sandbox JavaScript` and `@inject-into content` where missing
5. Ensure all `@grant` tags match actual GM API usage
6. Bump `@version` patch number
7. Wrap UI in `attachShadow({mode: 'closed'})`

### Refactoring Order

1. Create all 8 shared modules → commit
2. Batch A (large): Marketplace Deal Finder, Copy as Markdown, Crunchyroll Enhanced
3. Batch B (medium): Gutefrage, Manga Panel Downloader, NotebookLM, YouTube Enhanced
4. Batch C (medium): AniSearch, Global Speed Controller, Recaptcha Solver, Google AI Studio, Epic Games, Google Search Enhanced
5. Batch D (small): Reddit Content Unlocker, FlameComics, BotGhost, Picture-in-Picture

### Non-Negotiables

- No build tools, no package.json, no TypeScript
- Every `.user.js` remains standalone-installable
- All `@require` URLs point to `https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/src/shared/{file}.js`
- German user-facing UI text stays German; all code internals become English

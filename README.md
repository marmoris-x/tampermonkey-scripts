# marmoris-x Userscript Collection

A curated collection of high-quality Tampermonkey/Greasemonkey/Violentmonkey userscripts that enhance your browsing experience on YouTube, Google, marketplaces, forums, manga sites, and more.

> [!NOTE]
> This repository is actively maintained. Scripts are regularly updated and new ones are added as needed.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Script Catalog](#script-catalog)
  - [Video & Media Tools](#video--media-tools)
  - [Marketplace & Shopping](#marketplace--shopping)
  - [Search & Content Enhancement](#search--content-enhancement)
  - [Export & Data Tools](#export--data-tools)
  - [Forum & Community Tools](#forum--community-tools)
  - [Manga & Comics Tools](#manga--comics-tools)
- [Features Comparison](#features-comparison)
- [Usage & Configuration](#usage--configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

This repository contains a personal collection of userscripts written for the Tampermonkey browser extension. Each script is designed to solve a specific problem or add useful functionality to a particular website. The scripts are written with performance, reliability, and ease of use in mind.

**Who is this for?**
- Power users who want to automate repetitive tasks
- Users who want to improve the usability of their favorite websites
- Developers looking for examples of real-world userscript patterns

**Why userscripts?**
- No need to install separate browser extensions for each small enhancement
- Full control over the code -- you can inspect, modify, or disable any script
- Lightweight and fast -- runs only on the sites you specify

## Architecture

The repository was fully modularized in April 2026. Entry files in `src/entries/` are thin orchestrators that import shared and script-specific modules via ES module `import` syntax. A Vite-based build step (`npm run build`) bundles everything into standalone `.user.js` files in `dist/` with all modules inlined.

### Structure

```
├── src/
│   ├── entries/                  # 18 entry files — metadata blocks + ES module imports
│   │   ├── AniSearch Endless Scroll.user.js
│   │   ├── ... (all 18 scripts)
│   │   └── YouTube Enhanced.user.js
│   │
│   ├── shared/                  # 8 shared modules on the globalThis.TM namespace
│   │   ├── dom-utils.js         #   DOM helpers (waitForElement, debounce, throttle, observeMutations)
│   │   ├── i18n-utils.js        #   Internationalization utilities
│   │   ├── logging-utils.js     #   Prefix-based logger factory
│   │   ├── markdown-converter.js #   HTML-to-Markdown converter
│   │   ├── network-utils.js     #   Network request helpers (fetchPage, fetchJSON, fetchBlob)
│   │   ├── storage-utils.js     #   Async GM.getValue/GM.setValue wrappers
│   │   ├── ui-components.js     #   Reusable UI component factory (Shadow DOM)
│   │   └── zip-builder.js       #   Zero-dependency ZIP builder (CRC-32 + DataView)
│   │
│   ├── anisearch-endless-scroll/  # 3 modules
│   ├── copy-as-markdown/          # 9 modules (largest script: content pipeline, filters, overlay, click modes)
│   ├── crunchyroll-enhanced/      # 4 modules
│   ├── global-speed-controller/   # 3 modules
│   ├── gutefrage-smart-filters/   # 4 modules
│   ├── manga-panel-downloader/    # 4 modules
│   ├── marketplace-deal-finder/   # 5 modules
│   ├── notebooklm-source-export/  # 2 modules
│   ├── recaptcha-solver/          # 3 modules
│   ├── reddit-content-unlocker/   # 9 modules
│   └── youtube-enhanced/          # 3 modules
│
├── dist/                        # Build output — 18 standalone .user.js files (all modules inlined)
│   ├── AniSearch Endless Scroll.user.js
│   ├── ... (all 17 scripts)
│   └── YouTube Enhanced.user.js
│
├── build.mjs                    # Vite build orchestrator (parses entries, bundles with vite-plugin-monkey)
├── package.json                 # Vite + vite-plugin-monkey only
└── README.md
```

### Module System

**Shared modules** (in `src/shared/`) expose APIs via ES module `export` and also register on the `globalThis.TM` namespace for backward compatibility. All 18 scripts depend on `logging-utils.js`. Heavier scripts use additional shared modules for DOM, storage, networking, UI components, i18n, markdown conversion, and ZIP building. The dependency tree is flat — shared modules never import each other.

**Script-specific modules** (in `src/<slug>/`) export constructors, configuration objects, and utility functions via ES module `export`. The entry file imports from them and wires everything together. Each folder contains 2-7 focused modules that split the original monolithic script into single-responsibility units.

**Entry files** (in `entries/`) are kept minimal:
1. Full `==UserScript==` metadata block with `@grant`, `@match`, `@connect`, etc.
2. ES module `import` statements from `../shared/` and `../<script-name>/` modules
3. A thin orchestration block: double-init guard, menu command registration, async init IIFE

### Build System

A custom build script (`build.mjs`) uses **Vite 6** + **vite-plugin-monkey 7** to bundle each entry file:
1. Parses the `==UserScript==` metadata block from each entry file
2. Resolves all ES module imports across `src/`
3. Inlines all shared and script-specific modules into a single IIFE-wrapped `.user.js` file
4. Outputs to `dist/` (non-minified, GreasyFork-compatible)

Run `npm run build` to regenerate all 18 `dist/` files after editing source files. There are no runtime `@require` dependencies — all code is self-contained in each output file.

## Installation

### Prerequisites
1. Install a userscript manager extension:
   - [Tampermonkey](https://www.tampermonkey.net/) (recommended)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
   - [Violentmonkey](https://violentmonkey.github.io/) (cross-platform)

### Method 1: Install from jsDelivr CDN (recommended)
1. Navigate to the script you want in the [dist/ directory](https://github.com/marmoris-x/tampermonkey-scripts/tree/main/dist).
2. Click the file, then click the **Raw** button — or use the direct jsDelivr CDN link from the table below.
3. Your userscript manager will detect the script and offer to install it.
4. Confirm the installation.

*The installed script is fully self-contained — no external dependencies are fetched at runtime.*

### Method 2: Build and install locally
1. Clone the repository: `git clone https://github.com/marmoris-x/tampermonkey-scripts.git`
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Open your userscript manager's dashboard and import the `.user.js` files from the `dist/` directory.

### Updating
Scripts with an `@updateURL` will be automatically updated by your userscript manager when new versions are released. You can also manually check for updates in the dashboard.

## Script Catalog

### Video & Media Tools

| File | Name | Description | Modules | Grant | Update URL |
|------|------|-------------|---------|-------|------------|
| `Global Video Speed Controller.user.js` | **Global Video Speed Controller**<br>*(Globaler Video-Geschwindigkeitsregler)* | Sets a global playback speed for all HTML5 videos and audios, with three-tier fallback injection. | 3 shared + 3 script | `GM_setValue`, `GM_getValue`, `GM_registerMenuCommand`, `GM_unregisterMenuCommand`, `GM_addStyle`, `GM_addValueChangeListener`, `unsafeWindow` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Global%20Video%20Speed%20Controller.user.js) |
| `YouTube Enhanced.user.js` | **YouTube Enhanced** | Auto max video quality, per-channel playback speed control & auto-stop on page load. | 4 shared + 3 script | `GM_getValue`, `GM_setValue` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/YouTube%20Enhanced.user.js) |
| `Picture-in-Picture any site.user.js` | **Picture-in-Picture any site** | Adds a Tampermonkey menu entry to force the current tab into Picture-in-Picture mode. | 1 shared | `GM_registerMenuCommand` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Picture-in-Picture%20any%20site.user.js) |
| `Crunchyroll Enhanced.user.js` | **Crunchyroll Enhanced** | Sidebar with multi-filter & sort for Crunchyroll Browse -- auto-scan, retry, export/clipboard, data-only filter. | 5 shared + 4 script | `GM_addStyle`, `GM_setValue`, `GM_getValue` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.user.js) |

### Marketplace & Shopping

| File | Name | Description | Modules | Grant | Update URL |
|------|------|-------------|---------|-------|------------|
| `Marketplace Deal Finder.user.js` | **Marketplace Deal Finder** | Cross-platform AI-powered deal finder for Willhaben & Kleinanzeigen with live ranking and pause/resume. Multi-page crawling with Gemini AI analysis. | 6 shared + 5 script | `GM_xmlhttpRequest`, `GM_setValue`, `GM_getValue` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js) |

### Search & Content Enhancement

| File | Name | Description | Modules | Grant | Update URL |
|------|------|-------------|---------|-------|------------|
| `Google Search Enhanced.user.js` | **Google Search Enhanced** | Adds Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner. | 2 shared | `none` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20Search%20Enhanced.user.js) |
| `AniSearch Endless Scroll.user.js` | **AniSearch Endless Scroll** | Loads ALL pages automatically and appends items seamlessly -- no limit, no scrape errors. Precise rating filter via title attribute. | 5 shared + 3 script | `GM_setValue`, `GM_getValue`, `GM_xmlhttpRequest` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/AniSearch%20Endless%20Scroll.user.js) |
| `FlameComics Advanced Sort.user.js` | **FlameComics Advanced Sort** | Adds custom sorting options (alphabetical, hearts count) to FlameComics. | 2 shared | `none` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/FlameComics%20Advanced%20Sort.user.js) |
| `Gutefrage Smart Filters.user.js` | **Gutefrage Smart Filters** | Enhanced filtering options and automatic tag management for gutefrage.net with a page-push sidebar. | 5 shared + 4 script | `GM_addStyle`, `GM_setValue`, `GM_getValue`, `GM_openInTab`, `window.close` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Gutefrage%20Smart%20Filters.user.js) |

### Export & Data Tools

| File | Name | Description | Modules | Grant | Update URL |
|------|------|-------------|---------|-------|------------|
| `Epic Games Library Export.user.js` | **Epic Games Library Export** | High-performance game library exporter. Start via Tampermonkey menu command. | 2 shared | `GM_setClipboard`, `GM_registerMenuCommand` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Epic%20Games%20Library%20Export.user.js) |
| `NotebookLM Source Export.user.js` | **NotebookLM Source Export** | Automated extraction of source files from NotebookLM with ZIP export and markdown conversion. | 4 shared + 2 script | `GM_registerMenuCommand`, `GM_unregisterMenuCommand` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js) |
| `Google AI Studio Chat Exporter.user.js` | **Google AI Studio Chat Exporter** | Chat exporter in settings sidebar with recursive HTML-to-Markdown conversion. | 4 shared | `none` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js) |
| `BotGhost Bulk Choice Extractor.user.js` | **BotGhost Bulk Choice Extractor** | Adds a "Copy Bulk" button next to "Clear All Choices" to copy label/value pairs. | 2 shared | `GM_setClipboard` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js) |
| `Copy as Markdown for AI.user.js` | **Copy as Markdown for AI** | Converts web pages, selections, images, and links to Markdown for AI usage. 6-stage content pipeline, BM25/density/pruning filters, interactive element picking, sidebar with preview and history. | 5 shared + 9 script | `GM_setValue`, `GM_getValue`, `GM_registerMenuCommand`, `GM_xmlhttpRequest`, `GM_setClipboard` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Copy%20as%20Markdown%20for%20AI.user.js) |

### Forum & Community Tools

| File | Name | Description | Modules | Grant | Update URL |
|------|------|-------------|---------|-------|------------|
| `Reddit Content Unlocker.user.js` | **Reddit Content Unlocker** | Removes NSFW popup, un-blurs content, and makes Reddit accessible. Runs at document-start. | 0 shared + 9 script | `GM_addElement`, `GM_setValue`, `GM_getValue` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.user.js) |

### Manga & Comics Tools

| File | Name | Description | Modules | Grant | Update URL |
|------|------|-------------|---------|-------|------------|
| `Manga Panel Downloader.user.js` | **Manga Panel Downloader** | Downloads manga/manhwa panels as ZIP -- pipeline download, retry, abort, fast scrolling, image splitting. | 4 shared + 4 script | `GM_addStyle`, `GM_xmlhttpRequest`, `GM_registerMenuCommand`, `GM_deleteValue` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js) |

### Security & CAPTCHA Tools

| File | Name | Description | Modules | Grant | Update URL |
|------|------|-------------|---------|-------|------------|
| `Recaptcha Solver.user.js` | **Recaptcha Solver** | Automatically solves Recaptcha in browser with start button in challenge footer. Dual-server failover. | 3 shared + 3 script | `GM_xmlhttpRequest` | [GitHub Raw](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.user.js) |

## Features Comparison

| Feature | Global Video Speed Controller | YouTube Enhanced | PiP any site | Crunchyroll Enhanced | Marketplace Deal Finder | Google Search Enhanced | AniSearch Endless Scroll | FlameComics Advanced Sort | Gutefrage Smart Filters | Epic Games Library Export | NotebookLM Source Export | Google AI Studio Chat Exporter | BotGhost Bulk Choice Extractor | Reddit Content Unlocker | Manga Panel Downloader | Copy as Markdown for AI | Recaptcha Solver |
|---------|-------------------------------|------------------|--------------|----------------------|-------------------------|------------------------|--------------------------|--------------------------|-------------------------|---------------------------|--------------------------|---------------------------------|--------------------------------|-------------------------|------------------------|-------------------------|-------------------|
| Video speed control | ✓ | ✓ (per-channel) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Auto-quality | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Picture-in-Picture | -- | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Advanced filtering | -- | -- | -- | ✓ | -- | -- | ✓ | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- |
| AI integration | -- | -- | -- | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Search enhancements | -- | -- | -- | -- | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Endless scrolling | -- | -- | -- | -- | -- | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Custom sorting | -- | -- | -- | -- | -- | -- | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Tag management | -- | -- | -- | -- | -- | -- | -- | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- |
| Data export | -- | -- | -- | ✓ | -- | -- | -- | -- | -- | ✓ | ✓ | ✓ | ✓ | -- | ✓ | -- | -- |
| NSFW unblur | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | ✓ | -- | -- | -- |
| Bulk copy | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | ✓ | -- | -- | -- | -- |
| Multi-page crawling | -- | -- | -- | -- | ✓ | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Markdown export | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | ✓ | ✓ | -- | -- | -- | ✓ | -- |
| Cross-site support | ✓ | -- | ✓ | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | ✓ | ✓ | -- |
| CAPTCHA solving | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | ✓ |
| Modular architecture | 3 shared + 3 script | 4 shared + 3 script | 1 shared | 5 shared + 4 script | 6 shared + 5 script | 2 shared | 5 shared + 3 script | 2 shared | 5 shared + 4 script | 2 shared | 4 shared + 2 script | 4 shared | 2 shared | 2 shared | 4 shared + 4 script | 5 shared + 9 script | 3 shared + 3 script |

## Usage & Configuration

Most scripts are ready to use immediately after installation. Some offer configuration options:

### Tampermonkey Menu Commands
Several scripts add entries to the Tampermonkey menu (the extension icon in your browser's toolbar). Look for commands like:
- **Epic Library Export starten** -- opens the export panel
- **Picture-in-Picture any site** -- toggles PiP mode
- **Global Video Speed Controller** -- opens a speed selection dialog
- **Manga Panel Downloader** -- activates panel download mode

### Persistent Settings
Scripts that use `GM_setValue`/`GM_getValue` store preferences locally (in your browser's extension storage). To reset them, open the script in Tampermonkey's editor and look for `GM_deleteValue` calls, or simply uninstall and reinstall the script.

### Keybindings
A few scripts define hotkeys (e.g., `Ctrl+Shift+Ü` for Dark Reader Auto). Refer to the individual script's header comments for details.

### Grant Permissions Explained
- `GM_setValue`/`GM_getValue` -- store and retrieve user preferences
- `GM_xmlhttpRequest` -- make cross-origin requests (used for API calls, downloading images, etc.)
- `GM_addStyle` -- inject CSS into the page
- `GM_registerMenuCommand` -- add a custom entry to the Tampermonkey menu
- `GM_setClipboard` -- copy text to the clipboard
- `unsafeWindow` -- access the page's native `window` object (required for some deep integrations)
- `GM_openInTab` -- open a new background tab
- `window.close` -- close the current tab (only allowed on tabs opened by the script itself)
- `GM_addElement` -- dynamically add elements to the page
- `GM_addValueChangeListener` -- react to changes in stored values

## Troubleshooting

### Script isnt running
1. Make sure the userscript manager is enabled and the script is turned on.
2. Verify the `@match` pattern matches the URL you are on.
3. Check the browser's console (F12) for error messages.
4. Some sites use Content Security Policy (CSP) that may block certain userscript features. If a script relies on `GM_xmlhttpRequest` and you see CSP errors, you may need to adjust the script's `@connect` directives or request permission for additional domains.

### Conflicts with other extensions
If a script behaves unexpectedly, try disabling other extensions (especially those that modify the same site) to see if there is a conflict.

### Updating issues
If a script has an `@updateURL` but isnt updating, open the script in Tampermonkey's dashboard and click "Check for updates". You can also manually replace the script with the latest raw GitHub URL.

### Performance impact
Most scripts are lightweight, but scripts that run on every page (e.g., Global Video Speed Controller) may have a slight overhead. If you notice slowdowns, consider disabling scripts you do not need on certain sites via Tampermonkey's "Excludes" settings.

## Contributing

Contributions are welcome! If you have an idea for a new script or an improvement to an existing one, please follow these steps:

1. **Report bugs or request features** -- open a [GitHub Issue](https://github.com/marmoris-x/tampermonkey-scripts/issues).
2. **Submit a pull request** -- fork the repository, make your changes, and open a PR.

### Code Style
- Use **ES module syntax** (`import`/`export`) for all source files in `src/`.
- Entry files in `src/entries/` must NOT wrap themselves in an IIFE — the build system adds the IIFE wrapper.
- Use `createLogger` from `src/shared/logging-utils.js` for all console output — never raw `console.log`.
- Place configuration constants at the top of each module.
- Use `'use strict';` — added automatically by the build system.
- Comment complex logic briefly; avoid redundant comments on obvious code.

### Adding a new script
1. **Read `docs/Userscripts_Gold_Standards_2026.md` first** — it defines all metadata, security, and performance standards.
2. Create `src/<script-slug>/` with focused ES modules that `export` their public API.
3. Create `src/entries/<Script Name>.user.js` with the canonical metadata block and ES module `import` statements.
4. Reuse shared modules from `src/shared/` where possible — check existing utilities before writing new ones.
5. Add a double-init guard: `if (window.__MYSCRIPT__) throw new Error(); window.__MYSCRIPT__ = true;`
6. Run `npm run build` — verify the output in `dist/` builds cleanly.
7. Update this README: add to the script catalog table, add a column to the feature comparison matrix.
8. Increment `@version` before the first commit.

## License

This collection is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full terms.

All scripts are provided **as-is** without warranty. By using these scripts, you agree to the license terms.

---

*Last updated: May 2026*
*If you find these scripts useful, consider starring the repository on GitHub!*

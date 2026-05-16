# marmoris-x Userscript Collection

A curated collection of high-quality Tampermonkey/Greasemonkey/Violentmonkey userscripts that enhance your browsing experience on YouTube, Google, TikTok, marketplaces, forums, manga sites, and more.

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
  - [Security & CAPTCHA Tools](#security--captcha-tools)
- [Features Comparison](#features-comparison)
- [TikTok Enhanced](#tiktok-enhanced)
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
- Full control over the code — you can inspect, modify, or disable any script
- Lightweight and fast — runs only on the sites you specify

## Architecture

The repository is organized as a monorepo of 18 standalone userscripts. Entry files in `entries/` are thin orchestrators that import script-specific modules via ES module `import` syntax. A Vite-based build step (`node build.mjs`) bundles everything into standalone `.user.js` files in `dist/` with all modules inlined.

### Structure

```
tampermonkey-scripts/
├── build.mjs                  # Vite build orchestrator (parses entries, bundles with vite-plugin-monkey)
├── entries/                   # 18 entry files — metadata blocks + ES module imports + self-contained scripts
│   ├── AniSearch Endless Scroll.user.js
│   ├── BotGhost Bulk Choice Extractor.user.js
│   ├── Copy as Markdown for AI.user.js
│   ├── Crunchyroll Enhanced.user.js
│   ├── Epic Games Library Export.user.js
│   ├── FlameComics Advanced Sort.user.js
│   ├── Global Video Speed Controller.user.js
│   ├── Google AI Studio Chat Exporter.user.js
│   ├── Google Search Enhanced.user.js
│   ├── Gutefrage Smart Filters.user.js
│   ├── Manga Panel Downloader.user.js
│   ├── Marketplace Deal Finder.user.js
│   ├── NotebookLM Source Export.user.js
│   ├── Picture-in-Picture any site.user.js
│   ├── Recaptcha Solver.user.js
│   ├── Reddit Content Unlocker.user.js
│   ├── TikTok Enhanced.user.js
│   └── YouTube Enhanced.user.js
│
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
│
├── dist/                      # Build output — 18 standalone .user.js files (all modules inlined)
├── docs/                      # Authoritative standards and TM API reference
├── build.mjs                  # Build orchestrator
├── package.json               # Vite + vite-plugin-monkey only
└── README.md
```

### Module System

**Script-specific modules** (in `src/<slug>/`) export constructors, configuration objects, and utility functions via ES module `export`. The entry file imports from them and wires everything together.

**Self-contained scripts** (TikTok Enhanced, FlameComics Advanced Sort, BotGhost Bulk Choice Extractor, Google Search Enhanced) include all code directly in the entry file — no corresponding `src/` folder needed.

**Entry files** (in `entries/`) follow one of two patterns:
1. **Thin bootstrap:** Metadata block + ES module `import` + orchestration (most scripts)
2. **Self-contained:** Metadata block + all code inline (simple scripts)

### Build System

A custom build script (`build.mjs`) uses **Vite 6** + **vite-plugin-monkey 7** to bundle each entry file:
1. Parses the `==UserScript==` metadata block from each entry file
2. Resolves all ES module imports across `src/`
3. Inlines all modules into a single IIFE-wrapped `.user.js` file
4. Outputs to `dist/` (non-minified, GreasyFork-compatible)

Run `node build.mjs` to regenerate all 18 `dist/` files after editing source files.

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
3. Build: `node build.mjs`
4. Open your userscript manager's dashboard and import the `.user.js` files from the `dist/` directory.

### Updating
Scripts with an `@updateURL` will be automatically updated by your userscript manager when new versions are released. You can also manually check for updates in the dashboard.

## Script Catalog

### Video & Media Tools

| File | Name | Description | Grants | Update URL |
|------|------|-------------|--------|------------|
| `Global Video Speed Controller.user.js` | **Global Video Speed Controller** | Global playback speed for all HTML5 videos and audios. Three-tier fallback injection. | `GM_setValue`, `GM_getValue`, `GM_registerMenuCommand`, `GM_unregisterMenuCommand`, `GM_addStyle`, `GM_addValueChangeListener`, `unsafeWindow` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Global%20Video%20Speed%20Controller.user.js) |
| `YouTube Enhanced.user.js` | **YouTube Enhanced** | Auto max video quality, per-channel playback speed control & auto-stop on page load. | `GM_getValue`, `GM_setValue` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/YouTube%20Enhanced.user.js) |
| `Picture-in-Picture any site.user.js` | **Picture-in-Picture any site** | Forces the current tab into Picture-in-Picture mode via menu command. | `GM_registerMenuCommand` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Picture-in-Picture%20any%20site.user.js) |
| `Crunchyroll Enhanced.user.js` | **Crunchyroll Enhanced** | Sidebar with multi-filter & sort for Crunchyroll Browse — auto-scan, retry, export/clipboard, data-only filter. | `GM_addStyle`, `GM_setValue`, `GM_getValue` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Crunchyroll%20Enhanced.user.js) |
| `TikTok Enhanced.user.js` | **TikTok Enhanced** | Restores middle-click and right-click on TikTok video links. SPA-aware with MutationObserver-free design. | `GM_addStyle`, `window.onurlchange` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/TikTok%20Enhanced.user.js) |

### Marketplace & Shopping

| File | Name | Description | Grants | Update URL |
|------|------|-------------|--------|------------|
| `Marketplace Deal Finder.user.js` | **Marketplace Deal Finder** | Cross-platform AI-powered deal finder for Willhaben & Kleinanzeigen with live ranking and pause/resume. Multi-page crawling with Gemini AI analysis. | `GM_xmlhttpRequest`, `GM_setValue`, `GM_getValue` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js) |

### Search & Content Enhancement

| File | Name | Description | Grants | Update URL |
|------|------|-------------|--------|------------|
| `Google Search Enhanced.user.js` | **Google Search Enhanced** | Adds Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner. | `none` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20Search%20Enhanced.user.js) |
| `AniSearch Endless Scroll.user.js` | **AniSearch Endless Scroll** | Loads ALL pages automatically and appends items seamlessly. Precise rating filter via title attribute. | `GM_setValue`, `GM_getValue`, `GM_xmlhttpRequest` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/AniSearch%20Endless%20Scroll.user.js) |
| `FlameComics Advanced Sort.user.js` | **FlameComics Advanced Sort** | Custom sorting options (alphabetical, hearts count) for FlameComics. | `none` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/FlameComics%20Advanced%20Sort.user.js) |
| `Gutefrage Smart Filters.user.js` | **Gutefrage Smart Filters** | Enhanced filtering options and automatic tag management for gutefrage.net. | `GM_addStyle`, `GM_setValue`, `GM_getValue`, `GM_openInTab`, `window.close` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Gutefrage%20Smart%20Filters.user.js) |

### Export & Data Tools

| File | Name | Description | Grants | Update URL |
|------|------|-------------|--------|------------|
| `Epic Games Library Export.user.js` | **Epic Games Library Export** | High-performance game library exporter. Start via Tampermonkey menu command. | `GM_setClipboard`, `GM_registerMenuCommand` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Epic%20Games%20Library%20Export.user.js) |
| `NotebookLM Source Export.user.js` | **NotebookLM Source Export** | Automated extraction of source files from NotebookLM with ZIP export and markdown conversion. | `GM_registerMenuCommand`, `GM_unregisterMenuCommand` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/NotebookLM%20Source%20Export.user.js) |
| `Google AI Studio Chat Exporter.user.js` | **Google AI Studio Chat Exporter** | Chat exporter in settings sidebar with recursive HTML-to-Markdown conversion. | `GM_registerMenuCommand`, `GM_notification`, `GM_setClipboard`, `GM_download` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Google%20AI%20Studio%20Chat%20Exporter.user.js) |
| `BotGhost Bulk Choice Extractor.user.js` | **BotGhost Bulk Choice Extractor** | Adds a "Copy Bulk" button to copy label/value pairs. | `GM_setClipboard` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/BotGhost%20Bulk%20Choice%20Extractor.user.js) |
| `Copy as Markdown for AI.user.js` | **Copy as Markdown for AI** | Converts web pages, selections, images, and links to Markdown for AI usage. 6-stage content pipeline, BM25/density/pruning filters, interactive element picking. | `GM_registerMenuCommand`, `GM_addStyle`, `GM_setClipboard`, `GM_download` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Copy%20as%20Markdown%20for%20AI.user.js) |

### Forum & Community Tools

| File | Name | Description | Grants | Update URL |
|------|------|-------------|--------|------------|
| `Reddit Content Unlocker.user.js` | **Reddit Content Unlocker** | Removes NSFW popup, un-blurs content, and makes Reddit accessible. Runs at document-start. | `GM_addElement`, `GM_getValue`, `GM_setValue` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Reddit%20Content%20Unlocker.user.js) |

### Manga & Comics Tools

| File | Name | Description | Grants | Update URL |
|------|------|-------------|--------|------------|
| `Manga Panel Downloader.user.js` | **Manga Panel Downloader** | Downloads manga/manhwa panels as ZIP — pipeline download, retry, abort, fast scrolling, image splitting. | `GM_addStyle`, `GM_xmlhttpRequest`, `GM_registerMenuCommand`, `GM_deleteValue` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Manga%20Panel%20Downloader.user.js) |

### Security & CAPTCHA Tools

| File | Name | Description | Grants | Update URL |
|------|------|-------------|--------|------------|
| `Recaptcha Solver.user.js` | **Recaptcha Solver** | Automatically solves Recaptcha in browser with start button in challenge footer. Dual-server failover. | `GM_xmlhttpRequest`, `GM_addElement` | [jsDelivr](https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Recaptcha%20Solver.user.js) |

## Features Comparison

| Feature | Global Video Speed Controller | YouTube Enhanced | PiP any site | Crunchyroll Enhanced | TikTok Enhanced | Marketplace Deal Finder | Google Search Enhanced | AniSearch Endless Scroll | FlameComics Advanced Sort | Gutefrage Smart Filters | Epic Games Library Export | NotebookLM Source Export | Google AI Studio Chat Exporter | BotGhost Bulk Choice Extractor | Reddit Content Unlocker | Manga Panel Downloader | Copy as Markdown for AI | Recaptcha Solver |
|---------|-------------------------------|------------------|--------------|----------------------|-----------------|-------------------------|------------------------|--------------------------|--------------------------|-------------------------|---------------------------|--------------------------|---------------------------------|--------------------------------|-------------------------|------------------------|-------------------------|-------------------|
| Video speed control | ✓ | ✓ (per-channel) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Auto-quality | — | ✓ | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Picture-in-Picture | — | — | ✓ | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Advanced filtering | — | — | — | ✓ | — | — | — | ✓ | — | ✓ | — | — | — | — | — | — | — | — |
| AI integration | — | — | — | — | — | ✓ | — | — | — | — | — | — | — | — | — | — | — | — |
| Search enhancements | — | — | — | — | — | — | ✓ | — | — | — | — | — | — | — | — | — | — | — |
| Endless scrolling | — | — | — | — | — | — | — | ✓ | — | — | — | — | — | — | — | — | — | — |
| Custom sorting | — | — | — | — | — | — | — | — | ✓ | — | — | — | — | — | — | — | — | — |
| Tag management | — | — | — | — | — | — | — | — | — | ✓ | — | — | — | — | — | — | — | — |
| Data export | — | — | — | ✓ | — | — | — | — | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — |
| NSFW unblur | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — | — | — |
| Bulk copy | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — | — | — | — |
| Multi-page crawling | — | — | — | — | — | ✓ | — | ✓ | — | — | — | — | — | — | — | — | — | — |
| Markdown export | — | — | — | — | — | — | — | — | — | — | — | ✓ | ✓ | — | — | — | ✓ | — |
| Cross-site support | ✓ | — | ✓ | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | ✓ | — |
| CAPTCHA solving | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ |
| Right/middle-click fix | — | — | — | — | ✓ | — | — | — | — | — | — | — | — | — | — | — | — | — |
| SPA navigation | — | — | — | — | ✓ | — | — | — | — | — | — | — | — | — | — | — | — | — |

## Usage & Configuration

Most scripts are ready to use immediately after installation. Some offer configuration options:

### Tampermonkey Menu Commands
Several scripts add entries to the Tampermonkey menu (the extension icon in your browser's toolbar). Look for commands like:
- **Epic Library Export starten** — opens the export panel
- **Picture-in-Picture any site** — toggles PiP mode
- **Global Video Speed Controller** — opens a speed selection dialog
- **Manga Panel Downloader** — activates panel download mode

### Persistent Settings
Scripts that use `GM_setValue`/`GM_getValue` store preferences locally (in your browser's extension storage). To reset them, open the script in Tampermonkey's editor and look for `GM_deleteValue` calls, or simply uninstall and reinstall the script.

### Keybindings
A few scripts define hotkeys (e.g., `Ctrl+Shift+Ü` for Dark Reader Auto). Refer to the individual script's header comments for details.

### Grant Permissions Explained
- `GM_setValue`/`GM_getValue` — store and retrieve user preferences
- `GM_xmlhttpRequest` — make cross-origin requests (used for API calls, downloading images, etc.)
- `GM_addStyle` — inject CSS into the page
- `GM_registerMenuCommand` — add a custom entry to the Tampermonkey menu
- `GM_setClipboard` — copy text to the clipboard
- `unsafeWindow` — access the page's native `window` object (required for some deep integrations)
- `GM_openInTab` — open a new background tab
- `window.close` — close the current tab (only allowed on tabs opened by the script itself)
- `window.onurlchange` — SPA navigation detection (TikTok Enhanced)

## Troubleshooting

### Script is not running
1. Make sure the userscript manager is enabled and the script is turned on.
2. Verify the `@match` pattern matches the URL you are on.
3. Check the browser's console (F12) for error messages.
4. Some sites use Content Security Policy (CSP) that may block certain userscript features. If a script relies on `GM_xmlhttpRequest` and you see CSP errors, you may need to adjust the script's `@connect` directives or request permission for additional domains.

### Conflicts with other extensions
If a script behaves unexpectedly, try disabling other extensions (especially those that modify the same site) to see if there is a conflict.

### Updating issues
If a script has an `@updateURL` but is not updating, open the script in Tampermonkey's dashboard and click "Check for updates". You can also manually replace the script with the latest raw GitHub URL.

### Performance impact
Most scripts are lightweight, but scripts that run on every page (e.g., Global Video Speed Controller) may have a slight overhead. If you notice slowdowns, consider disabling scripts you do not need on certain sites via Tampermonkey's "Excludes" settings.

## Contributing

Contributions are welcome! If you have an idea for a new script or an improvement to an existing one, please follow these steps:

1. **Report bugs or request features** — open a [GitHub Issue](https://github.com/marmoris-x/tampermonkey-scripts/issues).
2. **Submit a pull request** — fork the repository, make your changes, and open a PR.

### Code Style
- Use **ES module syntax** (`import`/`export`) for all source files in `src/`.
- Use `createLogger` for all console output — never raw `console.log`.
- Place configuration constants at the top of each module.
- Use `'use strict';` — added automatically by the build system.
- Comment complex logic briefly; avoid redundant comments on obvious code.

### Adding a new script
1. **Read `docs/Userscripts_Gold_Standards_2026.md` first** — it defines all metadata, security, and performance standards.
2. Create `src/<script-slug>/` with focused ES modules or write a self-contained entry file.
3. Create `entries/<Script Name>.user.js` with the canonical metadata block.
4. Run `node build.mjs` — verify the output in `dist/` builds cleanly.
5. Update this README: add to the script catalog table, add a column to the feature comparison matrix.
6. Increment `@version` before the first commit.

## License

This collection is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full terms.

All scripts are provided **as-is** without warranty. By using these scripts, you agree to the license terms.

---

*Last updated: May 2026*
*If you find these scripts useful, consider starring the repository on GitHub!*

# 🤖 marmoris‑x Userscript Collection

A curated collection of high‑quality Tampermonkey/Greasemonkey/Violentmonkey userscripts that enhance your browsing experience on YouTube, Google, marketplaces, forums, manga sites, and more.

> [!NOTE]
> This repository is actively maintained. Scripts are regularly updated and new ones are added as needed.

<!-- Badges will be added when version tags are created (LICENSE file now present) -->
<!--
![License](https://img.shields.io/github/license/marmoris-x/tampermonkey-scripts)
![Version](https://img.shields.io/github/v/tag/marmoris-x/tampermonkey-scripts)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-✓-green)
-->

## 📖 Table of Contents

- [Overview](#overview)
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
- [Changelog](#changelog)
- [Support & Contact](#support--contact)
- [Privacy & Security](#privacy--security)
- [Compatibility](#compatibility)
- [Acknowledgements](#acknowledgements)

## 📝 Overview

This repository contains a personal collection of userscripts written for the Tampermonkey browser extension. Each script is designed to solve a specific problem or add useful functionality to a particular website. The scripts are written with performance, reliability, and ease of use in mind.

**Who is this for?**
- Power users who want to automate repetitive tasks
- Users who want to improve the usability of their favorite websites
- Developers looking for examples of real‑world userscript patterns

**Why userscripts?**
- No need to install separate browser extensions for each small enhancement
- Full control over the code – you can inspect, modify, or disable any script
- Lightweight and fast – runs only on the sites you specify

## 🛠 Installation

### Prerequisites
1. Install a userscript manager extension:
   - [Tampermonkey](https://www.tampermonkey.net/) (recommended)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
   - [Violentmonkey](https://violentmonkey.github.io/) (cross‑platform)

### Method 1: Install from GitHub (recommended)
1. Navigate to the script you want in the [file list](https://github.com/marmoris-x/tampermonkey-scripts).
2. Click the **Raw** button (top‑right of the code view).
3. Your userscript manager will detect the script and offer to install it.
4. Confirm the installation.

### Method 2: Install locally
1. Clone or download this repository.
2. Open your userscript manager's dashboard.
3. Choose **Import from file** or drag‑and‑drop the `.user.js` file.
4. Save the script.

### Updating
Scripts with an `@updateURL` will be automatically updated by your userscript manager when new versions are released. You can also manually check for updates in the dashboard.

## 📂 Script Catalog

### Video & Media Tools

| File | Name | Description | Match | Grant | Update URL |
|------|------|-------------|-------|-------|------------|
| `Global Video Speed Controller.user.js` | **Global Video Speed Controller**<br>*(Globaler Video‑Geschwindigkeitsregler)* | Sets a global playback speed for all HTML5 videos and audios. | `http://*/*`<br>`https://*/*` | `GM_setValue`, `GM_getValue`, `GM_registerMenuCommand`, `GM_unregisterMenuCommand`, `GM_addStyle`, `GM_addValueChangeListener`, `unsafeWindow` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Global%20Video%20Speed%20Controller.user.js) |
| `YouTube Enhanced.user.js` | **YouTube Enhanced** | Auto max video quality, per‑channel playback speed control & auto‑stop on page load. | `*://*.youtube.com/*` | `GM_getValue`, `GM_setValue` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/YouTube%20Enhanced.user.js) |
| `YouTube CPU Tamer by AnimationFrame.user.js` | **YouTube CPU Tamer by AnimationFrame** | Reduces browser energy impact while playing YouTube videos. | Multiple YouTube domains (see script header) | `none` | [GreasyFork](https://update.greasyfork.org/scripts/431573/YouTube%20CPU%20Tamer%20by%20AnimationFrame.meta.js) |
| `Picture‑in‑Picture any site.user.js` | **Picture‑in‑Picture any site** | Adds a Tampermonkey menu entry to force the current tab into Picture‑in‑Picture mode. | `*://*/*` | `GM_registerMenuCommand` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Picture-in-Picture%20any%20site.user.js) |
| `Crunchyroll Enhanced.user.js` | **Crunchyroll Enhanced** | Sidebar with multi‑filter & sort for Crunchyroll Browse – auto‑scan, retry, export/clipboard, data‑only filter. | `https://*.crunchyroll.com/*` | `GM_addStyle`, `GM_setValue`, `GM_getValue` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Crunchyroll%20Enhanced.user.js) |

### Marketplace & Shopping

| File | Name | Description | Match | Grant | Update URL |
|------|------|-------------|-------|-------|------------|
| `Marketplace Deal Finder.user.js` | **Marketplace Deal Finder** | Automatic AI‑powered deal finder for Willhaben & Kleinanzeigen with live ranking and pause function. Multi‑page crawling with Gemini AI analysis. | `https://www.willhaben.at/iad/kaufen-und-verkaufen/*`<br>`https://www.kleinanzeigen.de/s-*`<br>`https://www.kleinanzeigen.de/z-*` | `GM_xmlhttpRequest`, `GM_setValue`, `GM_getValue` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Marketplace%20Deal%20Finder.user.js) |

### Search & Content Enhancement

| File | Name | Description | Match | Grant | Update URL |
|------|------|-------------|-------|-------|------------|
| `Google Search Enhanced.user.js` | **Google Search Enhanced** | Adds Reddit, YouTube & Maps tabs to Google Search, plus quick Maps button & link cleaner. | Multiple Google search domains (see script header) | `none` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Google%20Search%20Enhanced.user.js) |
| `AniSearch Endless Scroll.user.js` | **AniSearch Endless Scroll** | Loads ALL pages automatically and appends items seamlessly – no limit, no scrape errors. Precise rating filter via title attribute. | `https://www.anisearch.de/*`<br>`https://anisearch.de/*` | `GM_setValue`, `GM_getValue`, `GM_xmlhttpRequest` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/AniSearch%20Endless%20Scroll.user.js) |
| `FlameComics Advanced Sort.user.js` | **FlameComics Advanced Sort** | Adds custom sorting options (alphabetical, hearts count) to FlameComics. | `https://flamecomics.xyz/*`<br>`https://www.flamecomics.xyz/*`<br>`https://flamecomics.com/*`<br>`https://www.flamecomics.com/*` | `none` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/FlameComics%20Advanced%20Sort.user.js) |
| `Gutefrage Smart Filters.user.js` | **Gutefrage Smart Filters** | Combined solution: extended filter options and automatic tag management for gutefrage.net. | `https://www.gutefrage.net/*` | `GM_addStyle`, `GM_setValue`, `GM_getValue`, `GM_openInTab`, `window.close` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Gutefrage%20Smart%20Filters.user.js) |

### Export & Data Tools

| File | Name | Description | Match | Grant | Update URL |
|------|------|-------------|-------|-------|------------|
| `Epic Games Library Export.user.js` | **Epic Games Library Export** | High‑performance exporter. Start via Tampermonkey menu. | `https://www.epicgames.com/account/transactions*` | `GM_addStyle`, `GM_setClipboard`, `GM_registerMenuCommand` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Epic%20Games%20Library%20Export.user.js) |
| `NotebookLM Source Export.user.js` | **NotebookLM Source Export** | Automated extraction of source files from NotebookLM with a status interface. | `https://notebooklm.google.com/*` | `GM_addStyle`, `GM_registerMenuCommand`, `GM_unregisterMenuCommand` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/NotebookLM%20Source%20Export.user.js) |
| `Google AI Studio Chat Exporter.user.js` | **Google AI Studio Chat Exporter** | Chat exporter in settings sidebar + native mic dialog repositioned & non‑blocking. | `https://aistudio.google.com/*` | `none` | *(no update URL – install manually)* |
| `BotGhost Bulk Choice Extractor.user.js` | **BotGhost Bulk Choice Extractor** | Adds a “Copy Bulk” button next to the “Clear All Choices” button to copy label/value pairs. | `https://dashboard.botghost.com/*` | `GM_setClipboard` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/BotGhost%20Bulk%20Choice%20Extractor.user.js) |

### Forum & Community Tools

| File | Name | Description | Match | Grant | Update URL |
|------|------|-------------|-------|-------|------------|
| `Reddit Content Unlocker.user.js` | **Reddit Content Unlocker** | Removes NSFW popup, un‑blurs content, and makes website accessible. | `https://www.reddit.com/*`<br>`https://sh.reddit.com/*` | `GM_addElement`, `GM_setValue`, `GM_getValue` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Reddit%20Content%20Unlocker.user.js) |

### Manga & Comics Tools

| File | Name | Description | Match | Grant | Update URL |
|------|------|-------------|-------|-------|------------|
| `Manga Panel Downloader.user.js` | **Manga Panel Downloader** | Downloads manga/manhwa panels as ZIP – pipeline download, retry, abort, fast scrolling. | `*://*/*` | `GM_addStyle`, `GM_xmlhttpRequest`, `GM_registerMenuCommand`, `GM_deleteValue` | [GitHub Raw](https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Manga%20Panel%20Downloader.user.js) |

## 📊 Features Comparison

| Feature | Global Video Speed Controller | YouTube Enhanced | YouTube CPU Tamer | PiP any site | Crunchyroll Enhanced | Marketplace Deal Finder | Google Search Enhanced | AniSearch Endless Scroll | FlameComics Advanced Sort | Gutefrage Smart Filters | Epic Games Library Export | NotebookLM Source Export | Google AI Studio Chat Exporter | BotGhost Bulk Choice Extractor | Reddit Content Unlocker | Manga Panel Downloader |
|---------|-------------------------------|------------------|-------------------|--------------|----------------------|-------------------------|------------------------|--------------------------|--------------------------|-------------------------|---------------------------|--------------------------|---------------------------------|--------------------------------|-------------------------|------------------------|
| Video speed control | ✓ | ✓ (per‑channel) | – | – | – | – | – | – | – | – | – | – | – | – | – | – |
| Auto‑quality | – | ✓ | – | – | – | – | – | – | – | – | – | – | – | – | – | – |
| Energy saving | – | – | ✓ | – | – | – | – | – | – | – | – | – | – | – | – | – |
| Picture‑in‑Picture | – | – | – | ✓ | – | – | – | – | – | – | – | – | – | – | – | – |
| Advanced filtering | – | – | – | – | ✓ | – | – | ✓ | – | ✓ | – | – | – | – | – | – |
| AI integration | – | – | – | – | – | ✓ | – | – | – | – | – | – | – | – | – | – |
| Search enhancements | – | – | – | – | – | – | ✓ | – | – | – | – | – | – | – | – | – |
| Endless scrolling | – | – | – | – | – | – | – | ✓ | – | – | – | – | – | – | – | – |
| Custom sorting | – | – | – | – | – | – | – | – | ✓ | – | – | – | – | – | – | – |
| Tag management | – | – | – | – | – | – | – | – | – | ✓ | – | – | – | – | – | – |
| Data export | – | – | – | – | ✓ | – | – | – | – | – | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| NSFW unblur | – | – | – | – | – | – | – | – | – | – | – | – | – | – | ✓ | – |
| Bulk copy | – | – | – | – | – | – | – | – | – | – | – | – | – | ✓ | – | – |
| Multi‑page crawling | – | – | – | – | – | ✓ | – | – | – | – | – | – | – | – | – | – |
| Cross‑site support | ✓ | – | – | ✓ | – | – | – | – | – | – | – | – | – | – | – | ✓ |

## ⚙️ Usage & Configuration

Most scripts are ready to use immediately after installation. Some offer configuration options:

### Tampermonkey Menu Commands
Several scripts add entries to the Tampermonkey menu (the extension icon in your browser’s toolbar). Look for commands like:
- **Epic Library Export starten** – opens the export panel
- **Picture‑in‑Picture any site** – toggles PiP mode
- **Global Video Speed Controller** – opens a speed selection dialog

### Persistent Settings
Scripts that use `GM_setValue`/`GM_getValue` store preferences locally (in your browser’s extension storage). To reset them, open the script in Tampermonkey’s editor and look for `GM_deleteValue` calls, or simply uninstall and reinstall the script.

### Keybindings
A few scripts define hotkeys (e.g., `Ctrl+Shift+Ü` for Dark Reader Auto). Refer to the individual script’s header comments for details.

### Grant Permissions Explained
- `GM_setValue`/`GM_getValue` – store and retrieve user preferences
- `GM_xmlhttpRequest` – make cross‑origin requests (used for API calls, downloading images, etc.)
- `GM_addStyle` – inject CSS into the page
- `GM_registerMenuCommand` – add a custom entry to the Tampermonkey menu
- `GM_setClipboard` – copy text to the clipboard
- `unsafeWindow` – access the page’s native `window` object (required for some deep integrations)
- `GM_openInTab` – open a new background tab
- `window.close` – close the current tab (only allowed on tabs opened by the script itself)
- `GM_addElement` – dynamically add elements to the page
- `GM_addValueChangeListener` – react to changes in stored values

## 🚨 Troubleshooting

### Script isn’t running
1. Make sure the userscript manager is enabled and the script is turned on.
2. Verify the `@match` pattern matches the URL you’re on.
3. Check the browser’s console (F12) for error messages.
4. Some sites use Content Security Policy (CSP) that may block certain userscript features. If a script relies on `GM_xmlhttpRequest` and you see CSP errors, you may need to adjust the script’s `@connect` directives or request permission for additional domains.

### Conflicts with other extensions
If a script behaves unexpectedly, try disabling other extensions (especially those that modify the same site) to see if there’s a conflict.

### Updating issues
If a script has an `@updateURL` but isn’t updating, open the script in Tampermonkey’s dashboard and click “Check for updates”. You can also manually replace the script with the latest raw GitHub URL.

### Performance impact
Most scripts are lightweight, but scripts that run on every page (e.g., Global Video Speed Controller) may have a slight overhead. If you notice slowdowns, consider disabling scripts you don’t need on certain sites via Tampermonkey’s “Excludes” settings.

## 🤝 Contributing

Contributions are welcome! If you have an idea for a new script or an improvement to an existing one, please follow these steps:

1. **Report bugs or request features** – open a [GitHub Issue](https://github.com/marmoris-x/tampermonkey-scripts/issues).
2. **Submit a pull request** – fork the repository, make your changes, and open a PR.

### Code Style
- Use **IIFE (Immediately Invoked Function Expression)** pattern to avoid polluting the global scope.
- Prefix log messages with `[ScriptName]` for easy debugging.
- Place configuration constants at the top of the file.
- Use `'use strict';`.
- Comment complex logic.

### Adding a new script
1. Create a new `.user.js` file in the root directory.
2. Follow the existing header format (include `@name`, `@namespace`, `@version`, `@description`, `@match`, `@grant`, `@updateURL`, etc.).
3. Test thoroughly on the target site(s).
4. Update this README’s catalog and feature table.

## 📄 License

This collection is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full terms.

All scripts are provided **as‑is** without warranty. By using these scripts, you agree to the license terms.

## 📋 Changelog

See the [GitHub Releases](https://github.com/marmoris-x/tampermonkey-scripts/releases) page for a detailed version history.
Alternatively, browse the commit log for individual script updates.

## 💬 Support & Contact

- **GitHub Issues**: Use the [issue tracker](https://github.com/marmoris-x/tampermonkey-scripts/issues) for bug reports, feature requests, and general questions.
- **Direct contact**: Not publicly provided; please use GitHub Issues for transparency.

## 🔒 Privacy & Security

All scripts run **only** on the websites specified in their `@match` directives.
Scripts that store data use the browser’s extension storage (`GM_setValue`/`GM_getValue`), which stays on your machine.
No script sends personal data to external servers unless explicitly stated (e.g., Marketplace Deal Finder uses Google’s Gemini API for analysis; the API key must be supplied by the user).
Always review the script’s code before installing if you have privacy concerns.

## 🌐 Compatibility

| Browser | Tampermonkey | Greasemonkey | Violentmonkey |
|---------|--------------|--------------|---------------|
| Chrome  | ✓            | –            | ✓             |
| Firefox | ✓            | ✓            | ✓             |
| Edge    | ✓            | –            | ✓             |
| Safari  | ✓ (Tampermonkey for Safari) | – | – |

Most scripts are tested on **Chrome** with **Tampermonkey**. They should work on other browsers/managers that support the same GM\_* API, but minor adjustments may be needed.

## 🙏 Acknowledgements

- **Tampermonkey** – for the excellent extension that makes userscripting easy
- **GreasyFork** and **OpenUserJS** – for hosting and distributing userscripts
- **The userscript community** – for inspiration and shared knowledge
- **Original authors** – some scripts are based on or inspired by existing works; credit is given in the script headers where applicable.

---

*Last updated: March 2026*
*If you find these scripts useful, consider starring the repository on GitHub!*
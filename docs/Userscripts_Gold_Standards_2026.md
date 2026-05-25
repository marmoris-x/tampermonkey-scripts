# Professional Tampermonkey Development — Gold Standards (May 2026)

## Metadata Architecture: Complete Directive Catalog

Tampermonkey metadata headers define security boundaries, execution scoping, and update lifecycles. The metadata block (`// ==UserScript==` to `// ==/UserScript==`) supports **35+ standardized keys** across 8 functional categories. Every key listed below is current and fully usable in Tampermonkey 5.5+ as of May 2026.

Modern enterprise development deploys a lightweight `.meta.js` file for update checks to optimize server load and reduce bandwidth consumption. The `.meta.js` contains only the metadata block (<1 KB) which TM checks daily; the full `.user.js` is downloaded only when the version changes.

---

### 1. Script Identification & Core Information

| Directive | Example | Description |
|:---|:---|:---|
| `@name` | `Professional Script` | Display name. Localizable via `@name:de`, `@name:zh-CN`, etc. TM selects locale based on user's browser language. |
| `@namespace` | `https://github.com/user/repo` | Unique identifier. Combined with `@name` to detect duplicate installations. |
| `@version` | `1.0.4` | Mozilla-style version format. **Essential** for auto-update detection. Must be incremented before every commit. |
| `@description` | `Adds feature X to site Y` | Short description. Localizable via `@description:es`, `@description:ru`, etc. |
| `@author` | `Developer Name` | Script author displayed in the TM dashboard. |
| `@copyright` | `2026 Developer Name` | Copyright notice shown in the TM UI header. |

**i18n Localization Keys:** Any text-based metadata key supports ISO 639-1 language codes and optional ISO 3166 region codes appended via colon (`@name:XX-YY`, `@description:XX-YY`). Each variant is a fully valid, independent metadata key. Tampermonkey dynamically selects the matching locale based on the end user's browser language. Examples: `@name:de`, `@name:zh-CN`, `@description:ru`, `@description:pt-BR`.

---

### 2. URL Matching & Injection Rules (Where the Script Runs)

| Directive | Example | Description |
|:---|:---|:---|
| `@match` | `*://*.youtube.com/*` | **Modern standard.** Chrome extension match pattern. Secure, performant, well-defined glob syntax. Always prefer over `@include`. |
| `@include` | `https://example.com/*` | **Legacy.** Allows regex-like wildcards at any URL position. Deprecated due to performance and security concerns — use `@match` instead. |
| `@exclude` | `https://example.com/admin/*` | Blacklist — matching URLs are ignored even if covered by `@match`/`@include`. |
| `@exclude-match` | `*://*.staging.example.com/*` | Violentmonkey-compatible exclusion pattern. Tolerated by TM without error. |
| `@noframes` | _(flag, no value)_ | **Critical.** Prevents script execution in embedded `<iframe>` elements. Script fires only in the top-level document. Always include unless iframe execution is intentional. |

**Pattern guidance:**
- `@match` supports three wildcard levels: `*` (any string), `?` (any single character), and scheme-specific `*://` matching.
- `@match` does NOT support regex or path-globbing — use multiple `@match` lines for complex URL patterns.
- `@include` supports `*` globs anywhere in the URL plus regex-like syntax but is significantly slower.

---

### 3. External Resources & Dependencies

| Directive | Example | Description |
|:---|:---|:---|
| `@require` | `https://cdn.com/lib@1.0.js#sha256=abc...` | Injects external JavaScript before script execution. **Always add SRI hash.** Under MV3 Dynamic mode, RegExp `@require` patterns are injected in every frame — use exact URL matching. Only external http/https URLs survive the build; local paths are inlined. |
| `@resource` | `myCSS https://cdn.com/style.css` | Loads non-executable assets (CSS, JSON, images, Base64). Accessible via `GM_getResourceText(name)` or `GM_getResourceURL(name)`. External URLs are NOT auto-updated on script update — prefer inline resources or manual refresh. |

**Subresource Integrity (SRI):** TM verifies SRI hashes at install time and rejects mismatches. Supported natively: SHA-256 (`#sha256=...`), MD5 (`#md5=...`). SHA-1, SHA-384, SHA-512 are supported via `window.crypto`.

---

### 4. Execution Context & Sandboxing (CRITICAL)

Tampermonkey v4.18+ introduced `@sandbox` to provide precise control over script isolation. This replaces the deprecated directive: `@unwrap`.

#### `@sandbox` — THE MODERN STANDARD (since TM v4.18+)

| Value | Execution World | Description | Use Case |
|:---|:---|:---|:---|
| `raw` | MAIN_WORLD | **(Default when @sandbox is absent.)** Script runs directly in the page context with full access to page JS variables and `unsafeWindow`. Equivalent to old `@unwrap`. | Scripts that need to read/modify page JS state, override prototypes, or interact with page-level APIs (e.g., YouTube player, React fiber). Most common for this repo. |
| `JavaScript` | USERSCRIPT_WORLD (Firefox) / falls back to `raw` (Chrome) | Creates a specialized execution context on Firefox that provides `unsafeWindow` access while bypassing restrictive CSP rules. On Chrome and other non-Firefox browsers: **falls back to `raw`** — identical behavior to the default, no special CSP handling. See TM FAQ Q404. | Scripts that need `unsafeWindow` but encounter CSP blocks — primarily a Firefox feature. |
| `DOM` | ISOLATED_WORLD | Extension-isolated execution. Access to DOM but NOT to page JavaScript variables or `unsafeWindow`. **Highest security.** | Scripts that only need DOM manipulation without interacting with page JS. Use when security isolation matters more than page JS access. |

**Why `@sandbox` replaced the old directives:**
- `@unwrap` removed the IIFE wrapper entirely, leaving the script naked in the global scope — a security risk that could cause variable collisions and breakage.
- `@sandbox` provides three clearly-defined, browser-aware execution worlds that align with Chrome Manifest V3's security model.
- Active sandbox improvements were shipped in TM v5.4.1 (November 2025), proving this is the actively maintained path forward.

#### Avoid in New Scripts — Prefer `@sandbox`

| Directive | Status | Why Avoid | Replacement |
|:---|:---|:---|:---|
| `@unwrap` | **Avoid for GM API scripts.** Still listed in official TM documentation without a formal deprecation notice, but confirmed by TM maintainers to break GM API access (TM Issue #2024): the sandbox is required to provide GM APIs securely. Removes the IIFE wrapper entirely — script runs raw in global scope without namespace protection. Still recognized by TM for backward compatibility; may be useful for pure scriptlets that need zero GM API access. | Use `@sandbox raw` for page context access. This preserves the IIFE wrapper while giving full MAIN_WORLD access. Note: `@sandbox raw` is the default when `@sandbox` is omitted — most scripts don't need to declare it explicitly. |

#### `@run-at` — Injection Timing

| Value | Behavior | When to Use |
|:---|:---|:---|
| `document-start` | Earliest possible injection — DOM may not exist yet. Requires "UserScripts API Dynamic" TM setting. | Scripts that must run before page JS initializes (e.g., prototype patching, `localStorage` interception). |
| `document-body` | After `<body>` tag is parsed but before full document load. | Scripts that need the body element but want to beat `DOMContentLoaded`. |
| `document-end` | When `DOMContentLoaded` event fires. | Scripts that need the full DOM but not necessarily images/stylesheets. |
| `document-idle` | **(Default.)** After all page load events complete, including images and frames. | Most scripts — safest timing, everything is available. |
| `context-menu` | Script fires ONLY when user explicitly clicks the script name in the browser's right-click context menu. | Scripts that should not auto-run — preserves resources until manually triggered. |

#### `@run-in` — Tab & Container Context (since TM v5.3+)

| Value | Behavior |
|:---|:---|
| `normal-tabs` | Only in standard (non-private) browser windows. |
| `incognito-tabs` | Only in private/incognito browsing windows. |
| `container-id-<ID>` | Only in a specific Firefox Multi-Account Container tab. |

---

### 5. API Permissions & Network Control

| Directive | Example | Description |
|:---|:---|:---|
| `@grant` | `GM.setValue` | **Whitelist gatekeeper.** Every `GM.*` API must be individually declared. Special grants: `none` (unprivileged page context — only `GM_info` available), `unsafeWindow` (direct page JS access). Also grants browser privileges: `window.close`, `window.focus`, `window.onurlchange`. **Never use wildcards.** |
| `@connect` | `api.trusted-domain.com` | **Mandatory** for `GM_xmlhttpRequest`. Whitelist exact domains. Both initial AND redirect URLs are checked. **Never use `*`** — it enables data exfiltration to any domain. |
| `@webRequest` | `{"selector":"*://*.tracker.com/*","action":"cancel"}` | Native network request blocking before JavaScript execution. Accepts JSON string format with `selector` (URL pattern) and `action` (`cancel` or `redirect`). |

**Grant execution context matrix:**

| Grant Setting | Execution Context | Available APIs |
|:---|:---|:---|
| `@grant none` | Page context (no sandbox overhead) | Only `GM_info` (read-only script metadata) |
| `@grant GM_xxx` (specific) | Isolated sandbox | Only the explicitly granted `GM.*` APIs |
| `@grant unsafeWindow` + specific APIs | Sandbox with page window access | Granted APIs + direct access to page JS via `unsafeWindow` |

**Security rule:** Scripts running on `*://*/*` (all sites) MUST be especially conservative with grants — they execute on every page the user visits.

---

### 6. Updates & Distribution

| Directive | Example | Description |
|:---|:---|:---|
| `@updateURL` | `https://domain.com/script.user.js` | URL TM polls to check for version changes. Can point to `.meta.js` (lightweight, ~1 KB) or `.user.js` directly. TM auto-updates users within 24h of version bump on CDN. |
| `@downloadURL` | `https://domain.com/script.user.js` | Full script payload URL for actual updates. When `@updateURL` detects a version change, this URL is fetched. |
| `@installURL` | `https://domain.com/script.user.js` | Original installation source. Used as fallback for update resolution when other URLs fail. |
| `@supportURL` | `https://github.com/user/repo/issues` | Link to bug tracker / support forum. Displayed as clickable link in TM UI. |

**Best practice:** For jsDelivr CDN distribution, point `@updateURL` and `@downloadURL` directly to the `.user.js` file on CDN. The CDN serves the latest commit on `@main`, and TM's daily poll detects version changes in the metadata block. The `.meta.js` pattern (separate lightweight metadata file) is a bandwidth optimization for scripts with very large user bases but is not required.

---

### 7. UI Display & Store Compliance

| Directive | Example | Description |
|:---|:---|:---|
| `@icon` / `@iconURL` / `@defaulticon` | `https://domain.com/icon32.png` | **(3 aliases.)** 32×32 pixel icon shown in TM dashboard next to script name. HTTPS URL or Base64 data URI. |
| `@icon64` / `@icon64URL` | `https://domain.com/icon64.png` | **(2 aliases.)** 64×64 high-resolution icon. |
| `@homepage` / `@homepageURL` / `@website` / `@source` | `https://github.com/user/repo` | **(4 aliases.)** Clickable project link displayed in TM UI. |
| `@tag` | `social` `productivity` | Label string for filtering and organizing scripts in the TM dashboard. Multiple `@tag` lines can be used. |
| `@license` | `MIT` | SPDX license identifier. **Required by GreasyFork.** Without it, strict copyright applies — no redistribution allowed. Displayed in TM's script info tab. |
| `@antifeature` | `ads Displays banner ads` | **Transparency clause.** Syntax: `<type> <description>`. **Required by GreasyFork/OpenUserJS** if script contains ads, tracking, or crypto mining. Types: `ads`, `tracking`, `miner`. |
| `@contributionURL` | `https://ko-fi.com/developer` | Donation link (PayPal, Patreon, Ko-fi, Bitcoin address). TM displays a "Support" / "Donate" button in the UI. |
| `@contributionAmount` | `5 EUR` | Suggested donation amount displayed alongside `@contributionURL`. Format: `<value> <currency>` (e.g., `1.00 USD`, `5 EUR`). |
| `@collaborator` | `co-dev-username` | Additional developers with administrative rights for the script on hosts like OpenUserJS (historically `@oujs:collaborator`). |
| `@history` | `v1.0.4 Fixed memory leak in observer` | Changelog or version history entries. Parsed and displayed by OpenUserJS and GreasyFork. Multiple `@history` lines can be used for multi-line changelogs. |

---

### 8. Cross-Engine Compatibility

| Directive | Example | Description |
|:---|:---|:---|
| `@compatible` | `firefox Chrome 85+` | Declares tested and verified browsers/script managers. Displayed in script info on hosts. |
| `@incompatible` | `Safari` | Warns users about known incompatibilities. Prevents installation friction on unsupported platforms. |
| `@nocompat` | `Chrome` | Disables TM's internal compatibility shims for a specific engine. Advanced usage — only when you are certain the shim causes issues. Use sparingly. |

**Cross-engine strategy for this repo:** Tampermonkey is the primary target. Violentmonkey compatibility is best-effort. Scripts using `@grant none` (page context) have the broadest cross-manager compatibility. TM silently ignores Violentmonkey-specific directives without throwing errors. For dual-manager support, `@sandbox` controls TM behavior while Violentmonkey uses its own equivalent settings.

---

## Gold Standard Metadata Header (May 2026)

```javascript
// ==UserScript==
// @name         Professional Script 2026
// @name:de      Professionelles Skript 2026
// @namespace    https://github.com/user/project
// @version      1.0.4
// @author       Author Name
// @description  Implements performance-optimized DOM manipulation and secure APIs.
// @description:de Implementiert leistungsoptimierte DOM-Manipulation und sichere APIs.
// @match        https://*.target-site.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      api.trusted-domain.com
// @run-at       document-idle
// @sandbox      raw
// @noframes
// @updateURL    https://cdn.jsdelivr.net/gh/user/repo@main/dist/Script.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/user/repo@main/dist/Script.user.js
// @supportURL   https://github.com/user/project/issues
// @homepage     https://github.com/user/project
// @icon         https://domain.com/icon32.png
// @icon64       https://domain.com/icon64.png
// @license      MIT
// @tag          productivity
// ==/UserScript==
```

### Key Changes from Pre-2026 Standards

- **Removed `@unwrap`** — deprecated. Use `@sandbox raw` for page context access. Modern `@sandbox` preserves the IIFE wrapper while granting MAIN_WORLD access.
- **Added `@homepage`**, `@icon`, `@icon64`, `@tag` — for full TM dashboard UI integration.
- **Added i18n keys** (`@name:de`, `@description:de`) — for multilingual user bases.
- **`@grant` uses Promise-based APIs** (`GM.getValue`, not legacy `GM_getValue`).
- **`@updateURL`/`@downloadURL` point directly to CDN `.user.js`** — jsDelivr auto-serves the latest commit. No separate `.meta.js` needed unless bandwidth optimization is required.

---

## Manifest V3 Architecture & Extension Configuration

Userscripts must align with **Manifest V3** security standards utilizing strict sandboxing and minimum privilege architectures. MV3 prohibits browser extensions from downloading and executing arbitrary remote code globally.

### Chrome MV3 Requirements

- End users must navigate to **Chrome 138+** extension management (`chrome://extensions/?id=<TM_ID>`) and explicitly enable the **"Allow User Scripts"** toggle to grant Tampermonkey execution clearance. Newly installed extensions default to OFF. (Before Chrome 138: Developer Mode required instead.)
- Scripts execute via the dedicated **Chromium 120+ `userScripts` API**, isolating userscript operations from the primary web page environment and bypassing strict CSP execution walls.
- `worldId` (Chrome 133+) enables per-script isolated worlds, preventing cross-script interference.
- `userScripts.execute()` (Chrome 135+) enables immediate script injection on a target tab.
- `configureWorld()` (Chrome 135+) configures CSP and messaging for `USER_SCRIPT` worlds.
- **Messaging:** Use `runtime.onUserScriptMessage` / `runtime.onUserScriptConnect` (NOT `runtime.onMessage` — that is for extension pages, not user scripts).
- **GM_webRequest is permanently removed** in TM 5.2+ — no replacement. Redesign scripts that relied on request interception.
- **CSP partial relaxation removed** — Chrome MV3 only allows "remove CSP entirely." Use `GM_addElement` for script/style injection as the primary CSP bypass strategy.
- Avoid RegExp `@require` patterns — the `userScripts` API injects them in every frame under Dynamic mode without caching, increasing CPU overhead. Use exact URL matching.

### Firefox MV3 Specifics

- `userScripts` is an **optional-only permission** in Firefox — must be requested at runtime via `permissions.request()`.
- Use `permissions.contains()` to check for the permission dynamically before requesting.
- Set `@sandbox JavaScript` when the script requires `unsafeWindow` access within Firefox's protected security boundary — this creates a special `USERSCRIPT_WORLD` that bypasses restrictive CSP while retaining `unsafeWindow`.
- `cloneInto()` — securely modify `unsafeWindow` properties across restrictive boundaries without triggering CSP exceptions.
- `exportFunction()` — securely expose isolated extension functions to the unprivileged page execution environment.
- **Firefox blocks `runtime.onMessage` in UserScripts** by design — user scripts cannot use extension messaging. Use `GM_addValueChangeListener` for cross-context communication instead.
- Firefox does **NOT** require Developer Mode for userscripts.

---

## Content Script Injection Methodologies

- Configure **"UserScripts API Dynamic"** in TM Settings → Security to deploy wrapper code and userscript code synchronously, achieving true `document-start` execution without background messaging latency. This is the default-recommended setting for Manifest V3.
- Switch **"Userscript URL detection"** from "Auto" to **"Legacy"** to bypass strict MV3 file ingestion blocks during local `.user.js` testing via `file://` URLs.
- Extract the runtime **CSP Nonce** from the host document: `document.querySelector('script[nonce]')?.nonce`. Use this to authorize dynamically injected stylesheets and script nodes against the host CSP.
- Tampermonkey 5.0+ attempts automated nonce injection — appending a valid `nonce` to the host CSP when the page entirely blocks inline script execution. **This is unreliable in strict MV3 environments** — prefer `GM_addElement` as the primary injection method.
- **`GM_addElement` is the primary CSP bypass:** it adds elements through the extension's privileged context, completely bypassing the page's CSP. Use for all `script`, `style`, and `img` injection.
  ```javascript
  GM_addElement('script', { textContent: 'console.log("injected")' });
  GM_addElement(parentNode, 'style', { textContent: '.my-class { color: red; }' });
  ```

---

## Hostile Environment Sabotage Mitigation

Complex host environments frequently deploy scripts intended to deliberately intercept or break userscript functionality.

- Wrap critical userscript logic inside strict-mode IIFE functions to encapsulate global variables and bypass host-level script tampering.
- Redefine the `get` property of native JavaScript sink functions (`document.write`, `eval`) using `Object.defineProperties` combined with an empty `NOOP` function to actively sabotage hostile website scripts attempting to overwrite userscript logic.
- Shadow native DOM prototypes directly inside the script execution context before the host page loads, preventing the website from detecting or modifying core structural properties utilized by the userscript.
- The `@sandbox raw` mode (MAIN_WORLD) is the preferred approach when the script must defend against hostile page JS — it provides direct access to patch prototypes before page scripts execute.

---

## UI Security & Shadow DOM Isolation

Professional userscripts injecting custom UI components must protect those components from hostile host-page CSS interference and JavaScript observation.

- Initialize all custom injected UI containers using `element.attachShadow({ mode: 'closed' })` to generate an isolated rendering tree impervious to page-level CSS selectors.
- Use `closed` mode exclusively to prevent the host website from accessing injected elements via `document.querySelector()` traversals (though note: DevTools can still inspect closed Shadow DOMs).
- Inject required stylesheet definitions directly into the closed Shadow DOM instance: `GM_addElement(shadowRoot, 'style', { textContent: css })`. This prevents host CSS bleed in both directions.
- `closed` mode prevents casual access via `element.shadowRoot` but does NOT prevent access via DevTools — it is a **style isolation mechanism**, not a security boundary against determined attackers.
- All injected UI text MUST use `textContent` (never `innerHTML` for user/API-sourced content) — XSS-safe by design.

### CSS Strategy for Injected UI

- Inject all styles INSIDE the Shadow DOM, never in the page context.
- Use `:host { all: initial; }` as CSS reset to neutralize inherited page styles.
- Use `!important` sparingly — only when the Shadow DOM boundary is not respected by a particular CSS property.
- Use CSS `:has()` and `:not()` pseudo-classes for complex element hiding instead of JavaScript traversal.
- Toggle visibility via `classList` rather than modifying individual inline style properties — one DOM change instead of many.
- Set `pointer-events: none` on the host container, `pointer-events: auto` on interactive children — prevents the invisible UI container from blocking page clicks.

---

## Trusted Types API & XSS Prevention

The **Trusted Types API** prevents Cross-Site Scripting (XSS) by neutralizing dangerous sink functions and enforcing strict sanitized input policies natively within the browser rendering engine. If the host page enforces Trusted Types, create a policy via `trustedTypes.createPolicy()` or use `GM_addElement` which bypasses the restriction entirely.

| Context | Safe Method | Unsafe (Blocked) |
|:---|:---|:---|
| HTML injection | `element.textContent = value` | `element.innerHTML = value` |
| Attribute injection | `element.setAttribute('attr', 'value')` | `element.attr = value` (for URL-bearing attributes) |
| URL parameters | `encodeURIComponent(value)` | Raw string concatenation |
| Script injection | `GM_addElement('script', { textContent: code })` | `document.createElement('script').textContent = code` |
| Style injection | `GM_addElement(shadowRoot, 'style', { textContent: css })` | `document.createElement('style').textContent = css` |

---

## Layout Optimization & Multi-Threading

Professional userscripts must adhere to a strict **100-millisecond computational response threshold** to maintain instantaneous UI interactivity and prevent rendering calculation cascades.

### DOM Manipulation Rules

- **Batch all read operations before executing any write operations** — prevents dozens of forced synchronous layouts per animation frame. Read all `offsetWidth`, `getBoundingClientRect`, etc. first, then apply all mutations.
- **Construct new node structures offline** using `DocumentFragment` before appending to the live DOM tree — triggers exactly one reflow and repaint sequence instead of one per element.
- **Defer non-critical updates via `requestAnimationFrame`** — invisible node modifications complete after the current frame renders without penalizing performance metrics.
- **Toggle a single CSS class** via `classList` rather than modifying individual inline style properties sequentially — minimizes recalculation complexity.
- **Use `GM_addStyle` with `!important`** to hide dynamic elements natively through the browser rendering engine instead of JavaScript-based programmatic node removal.
- **Apply CSS `:has()` / `:not()` pseudo-classes** to efficiently hide complex nested elements purely via stylesheets without requiring recursive JavaScript DOM traversal.

### Web Worker & OffscreenCanvas Integration

- Instantiate isolated background threads via `Web Worker` initialized from a Blob URL to execute computationally intensive operations without blocking the main UI thread.
- Bypass rigid `worker-src` CSP blocks by fetching worker code strings via `GM_xmlhttpRequest` and executing them asynchronously.
- Transfer heavy graphical manipulations entirely to background workers using `OffscreenCanvas` to guarantee smooth 60fps page scrolling during intensive canvas rendering.

---

## High-Performance DOM Observation

Unoptimized element polling techniques generate severe processing load, memory leaks, and frame rate drops in complex Single Page Applications (SPAs).

### MutationObserver — The Correct Pattern

```javascript
// CORRECT: Promise-based MutationObserver wrapper
const el = await waitForElement('.target-selector', 5000);

// WRONG: setTimeout-based polling
const interval = setInterval(() => {
  const el = document.querySelector('.target-selector');
  if (el) { clearInterval(interval); /* ... */ }
}, 100);
```

### Observer Performance Rules

- Construct Promise-based utility functions wrapping the native **MutationObserver API** — await element appearance via microtasks without blocking the event loop.
- Execute **`observer.disconnect()` immediately** upon locating target elements to terminate active scanning and reclaim allocated memory.
- Implement native `for` loops inside MutationObserver callbacks instead of array iteration methods — high-frequency callback invocation makes `forEach`/`map` overhead measurable.
- Filter detected mutation nodes strictly by **node type** — explicitly skip text nodes (`Node.TEXT_NODE`) and comment nodes (`Node.COMMENT_NODE`) in the callback.
- Configure options with **`{ childList: true, subtree: true }`** when scanning for newly appended elements — bypasses computationally expensive attribute-change polling.
- Process batched mutation events comprehensively — inserting multiple elements via `innerHTML` triggers a single observer callback with multiple nodes in the `addedNodes` array.
- Throttle high-frequency browser dimension events using a standard throttle wrapper (default 200ms interval).
- **For SPA navigation detection:** Prefer `window.addEventListener('urlchange', ...)` with `@grant window.onurlchange` over interval-based `location.href` polling or fragile History API monkey-patching (`pushState`/`replaceState` overrides).

---

## Storage APIs & Large Dataset Handling

Tampermonkey 5.3+ mandates asynchronous storage APIs over legacy synchronous methods to prevent loading the entire script storage dictionary into active browser memory during every page execution cycle.

### Async Storage (MANDATORY)

| Operation | Legacy (deprecated) | Modern (required) |
|:---|:---|:---|
| Get single key | `GM_getValue(key, default)` | `await GM.getValue(key, default)` |
| Set single key | `GM_setValue(key, val)` | `await GM.setValue(key, val)` |
| Delete key | `GM_deleteValue(key)` | `await GM.deleteValue(key)` |
| List all keys | `GM_listValues()` | `await GM.listValues()` |
| Bulk get | — | `await GM.getValues({ key1: def1, key2: def2 })` (TM 5.3+) |
| Bulk set | `GM_setValues(obj)` | `await GM.setValues({ key1: val1, key2: val2 })` (TM 5.3+) |
| Bulk delete | — | `await GM.deleteValues(['key1', 'key2'])` (TM 5.3+) |

### Storage Best Practices

- **Always `JSON.stringify()` objects before storage** — unsupported types fail silently in GM storage. Stringify before comparing for change detection (object references don't survive page loads).
- **Use `GM_addValueChangeListener(key, (name, oldVal, newVal, remote) => { ... })`** for cross-tab synchronization. The `remote: true` boolean parameter indicates the change came from another tab.
- **Use `GM_getTab` / `GM_saveTab`** for data that should persist only within the current browser tab session.
- **Firefox cross-context communication:** Since `runtime.onMessage` is blocked in UserScripts, use `GM_addValueChangeListener` as the primary cross-context communication channel.

### IndexedDB for Big Data

- Transition to `window.indexedDB` when individual stored values exceed several hundred KB or the total dataset reaches multiple MB. TM uses its own LevelDB instance (not chrome.storage.local) — the practical bottleneck is Chrome's IPC message passing between content script and background script, not a fixed storage quota. The "Message length exceeded" error (addressed in TM 5.4.0+) indicates when values are too large for a single storage operation. For scripts like Marketplace Deal Finder with large crawled deal caches, IndexedDB provides indexed querying beyond simple key-value lookups.
- IndexedDB supports indexes, cursors, and transactions for efficient querying — GM storage is LevelDB-backed and optimized for small key-value pairs, not large documents.

---

## Networking, Data Saving & Cookie Management

Standard networking protocol operations encounter Same-Origin Policy (SOP) and Content Security Policy blocking mechanisms imposed by target host websites.

### GM_xmlhttpRequest (CRITICAL)

- Execute cross-domain HTTP requests strictly through `GM_xmlhttpRequest` from the extension background security context — prevents host websites from hijacking privileged internal routing.
- Pass **`anonymous: true`** to block native browser cookie leakage to unauthorized third-party server endpoints.
- Use **`responseType: 'stream'`** for progress events in MV3 — since only one progress event fires (not per-progress), streaming is the workaround.
- **Requests run serialized in MV3** (not parallel). Batch requests or accept serial latency — redesign around this constraint.
- **Always set a `timeout`** (default 20000ms in most scripts). Without it, hanging requests block the serial queue indefinitely.

### Cookie & Connection Awareness

- Use `GM_cookie.list()` to asynchronously retrieve specific browser cookie definitions for evaluation. Extract the `HttpOnly` boolean property to evaluate server-side isolated authorization tokens.
- Query **`navigator.connection.saveData`** before initiating massive background data fetches — respect users explicitly requesting reduced data consumption on metered networks.
- Query **`navigator.connection.effectiveType`** — disable HD image prefetching or high-definition graphical injections when the client is on `'2g'` or `'slow-2g'` connections.

---

## Secure Testing Workflows & Bundling

Enterprise-grade userscript creation integrates local IDEs alongside dedicated compilation build pipelines.

### gobj Mapping & Unit Testing

- Expose private functional modules to external testing frameworks via the `gobj` mapping methodology — append isolated class methods to `globalThis.gobj`:
  ```javascript
  globalThis.gobj = globalThis.gobj || {};
  globalThis.gobj.myFunction = myFunction;
  ```
- This permits external testing suites like **Jest** to invoke internal userscript functions asynchronously without triggering CORS blocks or module isolation barriers.
- Top-level `await` is natively supported by Vite 6+ for ESM projects (`"type": "module"`). No extra plugin is needed — `vite-plugin-monkey` handles IIFE wrapping including TLA transformation internally.
- Access the isolated script window object via the `monkeyWindow` global provided by `vite-plugin-monkey`, guaranteeing functional context retention when compilation output combines UMD and IIFE payloads.

### Source Mapping & Build Configurations

- Generate **inline source maps** during compilation via `vite-plugin-monkey` configurations to retain exact source code mapping in browser DevTools.
- Calculate the exact **line offset** generated by the Tampermonkey metadata wrapper block when mapping issues arise — ensures inline sourcemap error traces point accurately to the correct local file row.
- Bundle modular source files using modern **Vite** or **esbuild** environments. Inject external CDN URLs automatically into compiled userscript directives to decouple massive third-party library dependencies from the core script payload.

### Local File Tracking Deployment

1. Navigate to Chrome extension management and enable **"Allow User Scripts"** toggle (Chrome 138+) or Developer Mode (Chrome <138).
2. Grant Tampermonkey explicit permission to access local file URLs via the extension details configuration panel.
3. Set TM's **"Userscript URL detection"** to **"Legacy"** for local file URL support.
4. Construct a lightweight proxy userscript in TM containing only metadata headers + a single `@require file:///C:/path/to/dist/Script.user.js` directive.
5. Save local source modifications in your editor, run `node build.mjs`, and reload the target page.

---

## Distribution, Hosting & Repository Standards

Distributing userscripts securely requires strict adherence to community repository moderation rules to maintain public trust and avoid automated anti-malware moderation deletion.

### GreasyFork Requirements

- Publish ALL code in **non-minified and non-obfuscated** format — fully retaining original whitespace and human-readable variable names. This is mandatory for moderator review.
- Maximum file size: **2.0 MB**.
- **`@antifeature` MUST be declared** if the script contains ads, tracking, or cryptocurrency mining. Syntax: `@antifeature <type> <description>`.
- **`@license` MUST be declared** — without it, strict copyright applies (no redistribution allowed).
- **Update checks must not exceed 1x per day** — TM enforces this automatically through its polling interval.

### Version Bumping & Commit Protocol (CRITICAL)

Before EVERY commit that changes script behavior:
1. **Increment `@version`** in the entry file (semver: `1.0.4` → `1.0.5`).
2. **Run `node build.mjs`** to regenerate the dist file.
3. **Commit the entry file change AND the rebuilt dist file in the SAME commit** — never separately. Without a version bump, TM will NOT detect the update and users remain on the old version.

### CDN Distribution

This repo distributes via jsDelivr CDN:
```
https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/<URL-ENCODED-FILENAME>
```
`@updateURL` and `@downloadURL` in each entry point to these CDN URLs. When a version bump is pushed to main, jsDelivr picks up the change and TM auto-updates users within 24 hours.

### Additional Distribution Notes

- `@resource` external URLs are **NOT auto-updated** on script update — use inline resources or require manual refresh.
- Script installation downloads may run in parallel — wait for full installation confirmation before reloading.
- `@require` with RegExp patterns is injected in every frame under Dynamic mode — avoid, use exact URL matching.

---

## Script Manager Landscape (May 2026)

| Manager | Version | MV3 Support | Chrome Viable | Open Source | Notes |
|:---|:---|:---|:---|:---|:---|
| **Tampermonkey** | 5.5+ | Yes (since 5.2.0, May 2024) | Yes | No (proprietary core) | **Primary target for this repo.** Active sandbox/CSP improvements through v5.4.1 (Nov 2025). |
| **Violentmonkey** | 2.36 | No (still MV2) | **No** — disabled by Chrome since July 2025 | Yes (MIT) | Firefox-only going forward. Best-effort compatibility from this repo. |
| **ScriptCat** | latest | Yes | Yes | Yes | Only open-source MV3 alternative. Stable since mid-2025. |
| **Greasemonkey** | 4.x | Yes | Firefox-only | Yes | Firefox-only. |

**Cross-engine compatibility strategy:** Scripts using `@grant none` (page context) have the broadest cross-manager compatibility. TM silently ignores Violentmonkey-specific directives without errors. For dual-manager support, `@sandbox` controls TM behavior while Violentmonkey uses its own equivalent settings. This repo targets Tampermonkey as primary; Violentmonkey/Greasemonkey compatibility is best-effort.

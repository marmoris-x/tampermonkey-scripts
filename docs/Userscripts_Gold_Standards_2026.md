# Professional Tampermonkey Development April 2026 Gold Standards

## Metadata Architecture and Directives
Tampermonkey metadata headers define the security boundaries, execution scoping, and update lifecycles for browser extension scripts. Modern enterprise development mandates deploying a minimal `.meta.js` file for update checks to optimize host server load and reduce bandwidth consumption.

### Standardized Directives
| Directive | Standard Implementation | Purpose |
| :--- | :--- | :--- |
| `@name` | `Professional Script` | Defines the display name of the userscript within the extension interface. |
| `@namespace` | `com.domain.project` | Prevents naming collisions by utilizing unique domains or GitHub usernames. |
| `@version` | `1.0.4` | Facilitates automated updates via the internal tracking engine. |
| `@author` | `Developer Name` | Specifies the original creator or current maintainer of the userscript. |
| `@icon64` | `https://domain.com/icon64.png` | Renders a high-resolution 64x64 pixel image inside the dashboard. |
| `@updateURL` | `https://domain.com/script.meta.js` | Specifies the lightweight metadata file location to trigger security patches. |
| `@downloadURL` | `https://domain.com/script.user.js` | Specifies the exact location for downloading the full userscript payload. |
| `@supportURL` | `https://github.com/repo/issues` | Directs end-users to the official repository issue tracker for bug reporting. |
| `@match` | `https://*.target-site.com/*` | Enforces stricter Uniform Resource Locator (URL) pattern checks compared to legacy directives. |
| `@require` | `https://cdn.lib.com/lib@1.0.js` | Injects external JavaScript dependencies into the environment prior to execution. |
| `@connect` | `api.trusted-domain.com` | Authorizes specific domains for cross-origin network requests via network Application Programming Interfaces (APIs). |
| `@grant` | `GM_xmlhttpRequest` | Whitelists specific privileged functions for script usage. |
| `@antifeature` | `tracking Records data` | Discloses functionality benefiting the author to maintain user transparency. |
| `@sandbox` | `JavaScript` | Configures the isolated boundary context setting for the script execution environment. |
| `@unwrap` | N/A | Removes the default Immediately Invoked Function Expression (IIFE) wrapper applied natively. |

### Gold Standard Metadata Header Implementation
```javascript
// ==UserScript==
// @name         Professional Script 2026
// @namespace    com.domain.project
// @version      1.0.4
// @author       Author Name
// @description  Implements performance-optimized DOM manipulation and secure APIs.
// @match        https://*.target-site.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// @grant        window.onurlchange
// @connect      api.trusted-domain.com
// @run-at       document-idle
// @inject-into  content
// @sandbox      JavaScript
// @noframes
// @unwrap
// @updateURL    https://domain.com/script.meta.js
// @downloadURL  https://domain.com/script.user.js
// @require      https://cdn.lib.com/library@1.2.3/dist/index.js#sha256-hash...
// @supportURL   https://github.com/domain/project/issues
// @license      MIT
// @antifeature  tracking Records anonymized usage data
// ==/UserScript==
```
### Advanced Runtime Execution Options
*   Configure `@run-at context-menu` to delay userscript injection entirely until the end-user explicitly clicks the userscript name within the native browser right-click context menu, drastically preserving resources on heavy pages.
*   Configure `@run-at document-start` to inject the script synchronously as fast as possible to preemptively construct element wrappers or execute early Cascading Style Sheets (CSS) injection.
*   Configure `@run-at document-idle` to inject the script immediately following the content loaded event dispatch, acting as the standard default behavior to prevent missing element parsing errors.
*   Configure `@inject-into content` to force script execution strictly into the extension context, protecting script variables from global namespace pollution.
*   Configure `@noframes` to exclude script execution within advertisement iframes inherently, preserving memory allocation.
*   Configure `@allFrames true` to command the engine to explicitly target deeply nested subframes regardless of parent document status.

### Runtime Metadata Extraction
*   Extract connected metadata block variables dynamically during script runtime by referencing the `GM_info.script.version` object property to generate changelog popups accurately.
*   Access external metadata injection arguments seamlessly utilizing the `GM_info.scriptMetaStr` property to parse custom tags defined beyond standard directives.
*   Extract connected browser metrics safely utilizing `navigator.userAgentData` properties instead of referencing the legacy `GM_info.userAgent` string to maintain compatibility with modern anti-fingerprinting system protections.

## Manifest V3 Architecture and Extension Configuration
Userscripts must align with **Manifest V3** security standards utilizing strict sandboxing and minimum privilege architectures. The Manifest V3 specification strictly prohibits browser extensions from downloading and executing arbitrary remote code globally.

### Chrome Security Toggles
*   Require end-users to navigate to the Chrome 138+ extension management console and explicitly enable the "Allow User Scripts" toggle to grant Tampermonkey execution clearance without triggering browser security warnings.
*   Execute scripts securely utilizing the dedicated Chromium 120+ `userScripts` API to isolate userscript operations from the primary web page environment, successfully bypassing strict Content Security Policy (CSP) execution walls.
*   Avoid relying on native regular expression matching within the Manifest V3 `userScripts` API engine, as the engine requires recompiling massive regular expressions continuously without caching, increasing Central Processing Unit (CPU) overhead.
*   Remove all dependencies on the experimental `GM_webRequest` API, as Tampermonkey version 5.2+ completely deprecates extension-level network interception capabilities to comply with Manifest V3 restrictions.
*   Declare `// @grant none` explicitly if no special Tampermonkey APIs are required, allowing the userscript to execute directly in the unprivileged page context.
*   List required functions individually (e.g., `// @grant GM_addStyle`) to isolate API access and restrict potential compromise damage.

### Firefox Legacy and API Specifics
*   Check for the `optional_permissions` declaration dynamically within Firefox environments utilizing `permissions.contains()`, as Firefox implements Manifest V3 userscript execution permissions differently than the Chromium engine.
*   Assign the `JavaScript` setting to the `@sandbox` directive when the userscript requires direct `unsafeWindow` access within a protected Firefox security boundary.
*   Implement `cloneInto` utility methods inside Firefox browsers to securely modify `unsafeWindow` properties across restrictive boundaries without triggering CSP exceptions.
*   Implement `exportFunction` utility methods when operating inside Firefox browsers to securely expose isolated extension functions directly to the unprivileged page execution environment.
*   Configure the userscript to explicitly run inside a `USER_SCRIPT` world rather than the `MAIN` world when registering dynamic scripts in Firefox, enforcing absolute isolation from the host page JavaScript scope.

## Content Script Injection Methodologies
*   Configure the "UserScripts API Dynamic" advanced extension setting directly within the Tampermonkey dashboard to deploy wrapper code and userscript code synchronously, achieving true `document-start` execution without background messaging latency.
*   Switch the "Userscript URL detection" software setting from "Auto" to "Legacy" to seamlessly bypass strict Manifest V3 file ingestion blocks during local `.user.js` testing.
*   Extract the runtime CSP Nonce from the host document utilizing `document.querySelector('script[nonce]')?.nonce` to authorize dynamically injected stylesheet and script nodes directly against the host Content Security Policy.
*   Rely on Tampermonkey 5.0.0+ automated nonce injection capabilities which attempt to append a valid `nonce` to the host CSP dynamically when the page CSP entirely blocks inline script execution.

## Hostile Environment Sabotage Mitigation
Complex host environments frequently deploy scripts intended to deliberately intercept or break userscript functionality.

*   Wrap critical userscript logic directly inside strict-mode IIFE functions to encapsulate global variables and completely bypass host-level script tampering.
*   Redefine the `get` property of native JavaScript sink functions (such as `document.write` or `eval`) utilizing `Object.defineProperties` combined with an empty `NOOP` function to actively sabotage hostile website scripts attempting to overwrite userscript logic.
*   Shadow native Document Object Model (DOM) prototypes directly inside the script execution context before the host page loads, preventing the website from detecting or modifying core structural properties utilized by the userscript.

## UI Security and Shadow DOM Isolation
Professional userscripts injecting custom User Interface (UI) components must protect those components from hostile host-page CSS interference and JavaScript observation.

*   Initialize all custom injected UI containers utilizing `element.attachShadow({mode: 'closed'})` to generate an isolated rendering tree.
*   Utilize the `closed` mode exclusively to completely prevent the host website from accessing the injected elements via native `document.querySelector()` traversals.
*   Inject required stylesheet definitions directly into the closed Shadow DOM instance utilizing `GM_addElement(shadowDOM, 'style', { textContent: '...' })` to prevent host CSS bleed.

## Trusted Types API and XSS Prevention
The **Trusted Types API** prevents Cross-Site Scripting (XSS) vulnerabilities by neutralizing sink functions and enforcing strict sanitized input policies natively within the browser rendering engine. Generating an approved policy wrapper enables userscripts to safely bypass rigid directives applied by complex host platforms.

| Context | Safe Handling Method |
| :--- | :--- |
| HTML Context | Employ `textContent` exclusively to prevent browser execution of injected malicious script nodes. |
| Attribute Context | Employ `setAttribute` with strictly quoted string values to isolate object properties. |
| JavaScript/URL Context | Employ Unicode escape sequences and `encodeURIComponent()` to explicitly sanitize URL parameter strings. |

## Layout Optimization and Multi-Threading
Professional userscripts must adhere to a strict 100-millisecond computational response threshold to maintain instantaneous UI interactivity and prevent rendering calculation cascades.

*   Batch all read operations before executing any write operations to prevent the browser engine from executing dozens of forced synchronous layouts per animation frame.
*   Construct new node structures offline utilizing a `DocumentFragment` instance before appending the fully assembled fragment to the live tree to trigger exactly one reflow and repaint sequence.
*   Implement `requestAnimationFrame` to deliberately delay layout responses until after the initial render sequence completes, permitting invisible node modifications without penalizing performance metrics.
*   Toggle a single CSS class utilizing `classList` rather than modifying individual inline style properties sequentially to minimize recalculation complexity.
*   Execute `GM_addStyle` with `!important` flags to hide dynamic elements natively through the browser rendering engine instead of utilizing JavaScript-based programmatic node removal logic.
*   Apply the CSS `:has()` pseudo-class selector combined with the `:not()` pseudo-class selector to efficiently hide complex nested elements purely via stylesheets without requiring recursive JavaScript traversal algorithms.

### Web Worker and OffscreenCanvas Integration
*   Instantiate isolated background threads utilizing the `Web Worker` API initialized from a Blob URL to execute computationally intensive parsing arrays without blocking the main browser UI thread.
*   Bypass rigid `worker-src` CSP blocks preventing Blob execution by fetching worker strings natively via `GM_xmlhttpRequest` and executing them asynchronously.
*   Transfer heavy graphical manipulations entirely to background workers utilizing the `OffscreenCanvas` interface to guarantee buttery smooth 60fps host page scrolling during intensive canvas rendering operations.

## High-Performance DOM Observation
Unoptimized element polling techniques generate severe processing load, memory leaks, and frame rate drops inside complex Single Page Applications (SPAs).

*   Construct Promise-based utility functions wrapping the native **MutationObserver API** to await the appearance of specific nodes via microtasks without blocking the primary browser event loop.
*   Execute `observer.disconnect()` immediately upon locating target elements to terminate active scanning processes and dynamically reclaim allocated system random-access memory.
*   Implement native `for` loops inside the MutationObserver callback function instead of relying on array iterations, because high-frequency function invocation overhead inside active observers degrades performance rapidly.
*   Filter detected node mutations strictly by evaluating node types to explicitly prevent processing extraneous text nodes or comment nodes within the primary callback logic.
*   Configure the options dictionary strictly with `childList: true` and `subtree: true` when scanning for newly appended elements to successfully bypass computationally expensive attribute-change polling.
*   Process batched mutation events generated by the browser microtask queue comprehensively, because inserting multiple elements via `innerHTML` simultaneously triggers only a single observer callback containing multiple nodes within the added nodes array.
*   Throttle high-frequency browser dimension events utilizing a standard throttle wrapper function to restrict callback execution strictly to once every 200 milliseconds.

## Storage APIs and Large Dataset Handling
Tampermonkey version 5.3+ mandates utilizing asynchronous storage APIs over legacy synchronous methods to prevent loading the entire script storage dictionary into active browser memory during every page execution cycle.

*   Invoke `await GM.getValue()` and `await GM.setValues()` for all asynchronous storage read and write database interaction functions.
*   Execute `GM_setValues({ key1: 'val1', key2: 'val2' })` to consolidate multiple individual native storage method calls into a single optimized bulk network operation.
*   Utilize `GM_getTab` and `GM_saveTab` to restrict script database persistence securely and exclusively to the current active browser tab session context.
*   Track real-time setting modifications across multiple browser tabs simultaneously utilizing the remote boolean parameter provided explicitly within the `GM_addValueChangeListener` callback structure.

### IndexedDB Integration for Big Data
*   Transition entirely to the browser native `window.indexedDB` interface when managing datasets exceeding the 23MB-70MB memory threshold of standard `GM_setValue` LevelDB limits.
*   Stringify complex nested objects strictly using `JSON.stringify()` prior to injecting them into any storage API to prevent catastrophic silent failures associated with unsupported variable types.

## Networking, Data Saving, and Cookie Management
Standard networking protocol operations encounter Same-Origin Policy (SOP) and Content Security Policy blocking mechanisms directly imposed by target host websites.

*   Execute cross-domain network HTTP requests strictly through the extension background security context utilizing `GM_xmlhttpRequest` to prevent host websites from hijacking privileged internal routing functions.
*   Pass the `anonymous: true` parameter within `GM_xmlhttpRequest` network configuration objects to definitively block native browser cookie leakage to unauthorized third-party server endpoints.
*   Execute `GM_cookie.list()` to asynchronously retrieve specific browser cookie definitions for evaluation.
*   Extract the `HttpOnly` boolean property directly from `GM_cookie.list()` responses to successfully evaluate server-side isolated authorization tokens.

### Navigator Network Information API
*   Query the `navigator.connection.saveData` boolean flag prior to initializing massive background data fetches to respect users explicitly requesting reduced data consumption on metered networks.
*   Query the `navigator.connection.effectiveType` variable dynamically to disable massive image prefetching or high-definition graphical injections when the client device is actively utilizing a `2g` or slow network.

## Secure Testing Workflows and Bundling
Enterprise-grade userscript creation workflows integrate local Integrated Development Environments alongside dedicated compilation build pipelines for highly scalable code deployment.

### Global Object Mapping (gobj) and Unit Testing
*   Expose private functional modules directly to active testing environment frameworks utilizing the `gobj` mapping methodology, deliberately appending isolated class methods to a generic global object reference (e.g., `globalThis.gobj`).
*   Utilize this explicit `gobj` mapping to permit external testing suites like **Jest** to invoke internal userscript functions asynchronously without triggering Cross-Origin Resource Sharing blocks or module isolation barriers.
*   Integrate the `rollup-plugin-tla` module directly into the Vite build configuration to support top-level await syntax seamlessly within the IIFE compilation phase.
*   Access the isolated script window object securely utilizing the `monkeyWindow` global variable provided by `vite-plugin-monkey`, guaranteeing functional context retention when compilation output combines UMDF and IIFE payloads.

### Source Mapping and Vite Configurations
*   Generate **inline source maps** seamlessly during the compilation phase utilizing `vite-plugin-monkey` configurations to retain exact TypeScript code mapping directly inside the browser developer tools.
*   Calculate the exact line offset generated by the Tampermonkey metadata wrapper block manually when mapping issues arise to ensure inline sourcemap error traces point accurately to the correct local file row.
*   Bundle modular source files, compile TypeScript syntax directly, and manage external dependency packages utilizing modern **Vite** or esbuild environments.
*   Inject external Content Delivery Network URLs automatically into the compiled userscript directives utilizing configuration options to definitively decouple massive third-party library dependencies from the core script payload.

### Local File Tracking Deployment Instructions
1. Navigate to the core Chromium extension management console and successfully enable the developer mode toggle switch.
2. Grant the Tampermonkey browser extension explicit security permission to access local filesystem URLs via the extension details configuration panel.
3. Construct a lightweight proxy userscript inside the Tampermonkey online dashboard containing exclusively comment metadata headers paired directly with a single `@require file:////path/to/local/build.user.js` testing directive.
4. Save local source code modifications within the desktop editor to automatically trigger the background watcher script and immediately rebuild the local project payload.

## Distribution, Hosting, and Repository Standards
Distributing userscripts securely requires strict developer adherence to established community repository moderation rules to maintain public user trust and successfully avoid automated anti-malware moderation deletion algorithms.

*   Publish all source code on the GreasyFork repository platform strictly in non-minified and non-obfuscated script formats, fully retaining the original whitespace characters and human-readable variable names.
*   Host raw userscript code files directly on public GitHub source repositories to immediately trigger automatic engine recognition events and browser installation prompts.
*   Increment the semantic versioning numerical index inside the version header block strictly before finalizing every single repository commit to ensure client managers reliably fetch the newest payload data array.
*   Configure external server update queries inside the metadata block to execute absolutely no more than once per day, safely delegating automated network update checks directly to the internal tracking engine.
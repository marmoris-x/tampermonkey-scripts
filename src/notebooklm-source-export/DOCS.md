# NotebookLM Source Export — Developer Documentation

Exports all sources from a NotebookLM notebook as Markdown files in a ZIP archive.

## Architecture

```
NotebookLM Source Export.user.js     Tampermonkey entry (in entries/)
    ├── extractor.js                 registerMenuStart → menu command
    └── ui.js                        initUI → sidebar + buttons
            ├── extractor.js         Config, State, SoundFX, KeepAlive, extraction loop
            │       ├── converter.js Recursive DOM-to-Markdown (standalone)
            │       ├── zip.js       STORE ZIP builder with CRC-32 (standalone)
            │       └── logger.js    Prefixed console logger (standalone)
            └── logger.js            Prefixed console logger (standalone)
```

**Zero shared/ dependencies.** All utilities are inlined in this directory.

## File Map

**Entry point:** `entries/NotebookLM Source Export.user.js` (Tampermonkey metadata + `import { init } from '../src/notebooklm-source-export/entry.js'` → calls `init()`).

| File | Lines | Responsibility |
|------|-------|---------------|
| `ui.js` | ~310 | Sidebar (Shadow DOM), terminal, start/stop buttons, status bar |
| `extractor.js` | ~420 | Config, State, SoundFX, KeepAlive, extraction loop |
| `converter.js` | ~130 | `htmlToMarkdown(el)` — recursive DOM→GFM converter |
| `zip.js` | ~135 | `buildStoreZip(files)` — STORE ZIP archive builder |
| `logger.js` | ~25 | `createLogger(prefix)` — prefixed console logger |

## Dataflow

```
User clicks "Start Export" in TM menu
  → entry.js → registerMenuStart(onStart)
  → onStart → initUI() [ui.js creates sidebar + buttons]
  → User clicks "Start Extraction" button
  → runProcess() [extractor.js]
     ├── Disable start button, show stop button
     ├── Register "Stop Export" menu command
     ├── Start keep-alive audio loop (prevents timer throttling in background tabs)
     └── For each .single-source-container:
          1. Scroll into view, click source title
          2. Poll for labs-tailwind-structural-element-view-v2 content
             (max 15 attempts × 200ms = 3s timeout, then 1200ms render delay)
          3. Query ALL content elements, filter to top-level only (not nested)
          4. htmlToMarkdown() on each content element → join with \n\n
          5. Check MIN_CONTENT_LENGTH_CHARS (20) — skip if too short
          6. Collect {name, data} object (name sanitized, truncated to 120 chars, .md appended)
          7. attemptClose() (3-strategy fallback: collapse icon → tooltip → Escape key)
          8. Poll for content panel to unmount (max 15 attempts × 200ms)
     Build ZIP via buildStoreZip()
     Trigger download via Blob URL + <a> click
     Cleanup: stop keep-alive, re-register "Start Export" menu command
```

## Selector Reference

These selectors target the NotebookLM DOM. Update them if Google changes the UI.

| Purpose | Selector | Found In |
|---------|----------|----------|
| Source list items | `.single-source-container` | SOURCE LIST |
| Source title | `.source-title` (inside `.source-title-column`) | SOURCE LIST |
| Source content | `labs-tailwind-structural-element-view-v2` (primary), `labs-tailwind-doc-viewer`, `paragraph-element-view`, `element-list-renderer`, `[class*="scroll-container"]` (fallback chain — array of selectors tried in sequence) | SOURCE CONTENT |
| Notebook title | `.title-label-inner.mat-title-large` | PROJECT TITLE |
| Close button | `button[mattooltip*="schließen"], button[mattooltip*="close"], button[aria-label*="Close"], button[aria-label*="Schließen"]` | UI Chrome |

### Source Content Structure

The content panel renders each paragraph/section as a separate custom element. Paragraph variants include `heading1`, `heading2`, `heading3`, `normal`, and `code`:

```html
<labs-tailwind-structural-element-view-v2>
  <paragraph-element-view>
    <div class="paragraph heading1" role="heading" aria-level="1">
      <span>Heading text</span>
    </div>
  </paragraph-element-view>
</labs-tailwind-structural-element-view-v2>
```

```html
<labs-tailwind-structural-element-view-v2>
  <paragraph-element-view>
    <div class="paragraph normal">
      <span>Normal paragraph text</span>
    </div>
  </paragraph-element-view>
</labs-tailwind-structural-element-view-v2>
```

The extractor queries ALL content elements, then filters to top-level only (not nested inside others).

## Source Types

NotebookLM supports multiple source types, each with its own content rendering behavior:

| Type | Icon | Selector / Detection | Behavior |
|------|------|---------------------|----------|
| **Web Pages** | 🔗 | URL-based sources. Content opens in a panel with `labs-tailwind-structural-element-view-v2` elements. | Each paragraph/section is wrapped in `<paragraph-element-view>`. Content is fetched and rendered server-side. |
| **YouTube Videos** | ▶️ | Video URL sources. | Same content panel structure as web pages. Video transcript is rendered as text paragraphs in the same `labs-tailwind-structural-element-view-v2` / `<paragraph-element-view>` layout. |
| **Pasted Text** | 📝 | Inline/pasted content. Detected via `description` mat-icon. | Direct text content stored in NotebookLM. May open in a different content viewer than web sources. Falls through the multi-selector chain if the primary structural element selector yields no results. |
| **Google Docs** | 📄 | Linked Google Document. | Content is synced from the original document. Renders in the standard content panel when opened. |
| **Google Slides** | 🖼️ | Linked Google Slides presentation. | Content is synced from the original presentation. |
| **PDF** | 📕 | Uploaded PDF file. | Content is extracted from the PDF and rendered as text paragraphs in the content panel. |

All source types follow the same extraction flow: click source title, poll for content panel, convert HTML to Markdown.

## Limits

- **Pasted text sources:** May not render content in the same panel as web sources. Content detection uses a multi-selector fallback chain to handle different renderer types.
- **Background tabs:** Timers are throttled. The inaudible keep-alive audio loop (`KeepAlive`) prevents throttling during extraction.
- **Content polling:** Max 15 attempts × 200ms = 3s wait per source. Adjust `TIMING.CONTENT_POLL_ATTEMPTS` for slow connections.
- **Content render delay:** 1200ms wait (`TIMING.CONTENT_RENDER_DELAY_MS`) after content panel appears before conversion starts.
- **Minimum content length:** Sources shorter than 20 characters (`TIMING.MIN_CONTENT_LENGTH_CHARS`) are skipped as empty.
- **File naming:** Source titles are sanitized (invalid filename chars replaced with `_`), truncated to 120 chars, and `.md` is appended.
- **Large notebooks:** 100+ sources may trigger browser memory pressure. Each source is converted individually.
- **Terminal log:** Capped at 50 entries (`TIMING.LOG_MAX_ENTRIES`). Older entries are dropped.
- **Angular IDs:** `_ngcontent-ng-c*` and `_nghost-ng-c*` attributes are auto-generated and change between page loads. Never depend on them in selectors.
- **ZIP format:** STORE (no compression). Files are UTF-8 encoded Markdown.
- **Audio feedback (`SoundFX`):** Startup tone (600Hz sine), error tone (150Hz sawtooth), completion chime (440/554/659Hz ascending). Volume 0.15, disabled if `AudioContext` is denied.
